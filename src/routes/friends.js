import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Get user's friends
router.get("/friends", requireAuth, async (req, res) => {
  try {
    console.log("Fetching friends for user:", req.user.id);
    const userId = req.user.id;

    // Get friendships where user is either user1 or user2
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: {
        user1: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            isOnline: true
          }
        },
        user2: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            isOnline: true
          }
        }
      }
    });

    console.log("Found friendships:", friendships.length);

    // Map to get the friend (not the current user)
    const friends = friendships.map(friendship => {
      const friend = friendship.user1Id === userId ? friendship.user2 : friendship.user1;
      return {
        ...friend,
        friendshipDate: friendship.createdAt
      };
    });

    console.log("Returning friends:", friends.length);
    res.json(friends);
  } catch (error) {
    console.error("Error fetching friends:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ error: "Failed to fetch friends", details: error.message });
  }
});

// Get pending friend requests (received)
router.get("/friends/requests", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await prisma.friendRequest.findMany({
      where: {
        recipientId: userId,
        status: "pending"
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json(requests);
  } catch (error) {
    console.error("Error fetching friend requests:", error);
    res.status(500).json({ error: "Failed to fetch friend requests" });
  }
});

// Send friend request
router.post("/friends/request", requireAuth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, message } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: "Recipient ID is required" });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId }
    });

    if (!recipient) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if they're already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: senderId, user2Id: recipientId },
          { user1Id: recipientId, user2Id: senderId }
        ]
      }
    });

    if (existingFriendship) {
      return res.status(400).json({ error: "Already friends" });
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, recipientId },
          { senderId: recipientId, recipientId: senderId }
        ],
        status: "pending"
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: "Friend request already exists" });
    }

    // Create friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId,
        recipientId,
        message: message || null
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        },
        recipient: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// Accept friend request
router.post("/friends/accept/:requestId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: true,
        recipient: true
      }
    });

    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (friendRequest.recipientId !== userId) {
      return res.status(403).json({ error: "Not authorized to accept this request" });
    }

    if (friendRequest.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update request status
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: "accepted" }
      });

      // Create friendship (always put smaller ID first for consistency)
      const user1Id = friendRequest.senderId < friendRequest.recipientId 
        ? friendRequest.senderId 
        : friendRequest.recipientId;
      const user2Id = friendRequest.senderId < friendRequest.recipientId 
        ? friendRequest.recipientId 
        : friendRequest.senderId;

      const friendship = await tx.friendship.create({
        data: {
          user1Id,
          user2Id
        }
      });

      return friendship;
    });

    res.json({ success: true, friendship: result });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

// Decline friend request
router.post("/friends/decline/:requestId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (friendRequest.recipientId !== userId) {
      return res.status(403).json({ error: "Not authorized to decline this request" });
    }

    if (friendRequest.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    // Update request status
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "declined" }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error declining friend request:", error);
    res.status(500).json({ error: "Failed to decline friend request" });
  }
});

// Remove friend
router.delete("/friends/:friendId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    // Find the friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: friendId },
          { user1Id: friendId, user2Id: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(404).json({ error: "Friendship not found" });
    }

    // Delete the friendship
    await prisma.friendship.delete({
      where: { id: friendship.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// Check if users are friends
router.get("/friends/check/:userId", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: userId },
          { user1Id: userId, user2Id: currentUserId }
        ]
      }
    });

    res.json({ areFriends: !!friendship });
  } catch (error) {
    console.error("Error checking friendship:", error);
    res.status(500).json({ error: "Failed to check friendship" });
  }
});

// Get online users (for debugging and showing who's available)
router.get("/users/online", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    const onlineUsers = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        isOnline: true,
        blockedBy: { none: { blockerId: currentUserId } },
        blocks: { none: { blockedId: currentUserId } }
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        isOnline: true,
        inCall: true,
        lat: true,
        lng: true
      },
      take: 50
    });

    res.json(onlineUsers);
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({ error: "Failed to fetch online users" });
  }
});

export default router;