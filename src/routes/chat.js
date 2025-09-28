import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Send private message
router.post("/chat/private", requireAuth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, message } = req.body;

    if (!recipientId || !message) {
      return res.status(400).json({ error: "Recipient ID and message are required" });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: "Cannot send message to yourself" });
    }

    // Check if users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: senderId, user2Id: recipientId },
          { user1Id: recipientId, user2Id: senderId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ error: "Can only send messages to friends" });
    }

    // Create private message
    const privateMessage = await prisma.privateMessage.create({
      data: {
        senderId,
        recipientId,
        message: message.trim()
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

    res.status(201).json(privateMessage);
  } catch (error) {
    console.error("Error sending private message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get chat history with a friend
router.get("/chat/history/:friendId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Check if users are friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: friendId },
          { user1Id: friendId, user2Id: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ error: "Can only view chat history with friends" });
    }

    // Get messages between the two users
    const messages = await prisma.privateMessage.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: friendId },
          { senderId: friendId, recipientId: userId }
        ]
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
        createdAt: "asc"
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Transform to match frontend format
    const formattedMessages = messages.map(msg => ({
      from: msg.senderId,
      text: msg.message,
      ts: msg.createdAt.getTime(),
      user: msg.sender,
      type: 'private'
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// Mark messages as read
router.post("/chat/read/:friendId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    // Mark all unread messages from this friend as read
    await prisma.privateMessage.updateMany({
      where: {
        senderId: friendId,
        recipientId: userId,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

// Get unread message count
router.get("/chat/unread", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await prisma.privateMessage.count({
      where: {
        recipientId: userId,
        readAt: null
      }
    });

    // Get unread count per friend
    const unreadByFriend = await prisma.privateMessage.groupBy({
      by: ['senderId'],
      where: {
        recipientId: userId,
        readAt: null
      },
      _count: {
        id: true
      }
    });

    res.json({
      total: unreadCount,
      byFriend: unreadByFriend.reduce((acc, item) => {
        acc[item.senderId] = item._count.id;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// Get recent conversations
router.get("/chat/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get friends with their latest message
    const friends = await prisma.friendship.findMany({
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

    const conversations = await Promise.all(
      friends.map(async (friendship) => {
        const friend = friendship.user1Id === userId ? friendship.user2 : friendship.user1;
        
        // Get latest message
        const latestMessage = await prisma.privateMessage.findFirst({
          where: {
            OR: [
              { senderId: userId, recipientId: friend.id },
              { senderId: friend.id, recipientId: userId }
            ]
          },
          orderBy: {
            createdAt: "desc"
          },
          include: {
            sender: {
              select: {
                displayName: true
              }
            }
          }
        });

        // Get unread count
        const unreadCount = await prisma.privateMessage.count({
          where: {
            senderId: friend.id,
            recipientId: userId,
            readAt: null
          }
        });

        return {
          friend,
          latestMessage: latestMessage ? {
            text: latestMessage.message,
            createdAt: latestMessage.createdAt,
            isFromMe: latestMessage.senderId === userId
          } : null,
          unreadCount
        };
      })
    );

    // Sort by latest message time
    conversations.sort((a, b) => {
      if (!a.latestMessage && !b.latestMessage) return 0;
      if (!a.latestMessage) return 1;
      if (!b.latestMessage) return -1;
      return new Date(b.latestMessage.createdAt) - new Date(a.latestMessage.createdAt);
    });

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

export default router;