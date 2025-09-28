import { Router } from "express";
import { prisma } from "../db.js";
import { auth } from "../middleware/auth.js";
import { requestMatch } from "../services/matchmaking.js";
import { config } from "../config.js";

const router = Router();

router.post("/match/request", auth(true), async (req, res) => {
  const mode = req.body?.mode || "near";
  const radiusKm = req.body?.radiusKm;

  const match = await requestMatch(req.user.id, mode, radiusKm);
  if (!match) return res.json({ match: null });

  const room = await prisma.chatRoom.create({ data: { type: "call" } });
  const callLog = await prisma.callLog.create({
    data: {
      callerId: req.user.id,
      calleeId: match.partner.id,
      distanceKm: Number.isFinite(match.distanceKm) ? match.distanceKm : null
    }
  });

  const caller = {
    id: match.me.id,
    displayName: match.me.displayName,
    email: match.me.email,
    lat: match.me.lat,
    lng: match.me.lng
  };

  const partner = {
    id: match.partner.id,
    displayName: match.partner.displayName,
    email: match.partner.email,
    lat: match.partner.lat,
    lng: match.partner.lng
  };

  const payload = {
    partner,
    self: caller,
    distanceKm: match.distanceKm,
    roomId: room.id,
    callLogId: callLog.id,
    iceServers: config.iceServers
  };

  const io = req.app.get("io");
  if (io) {
    io.of("/realtime").to(match.partner.id).emit("match:incoming", {
      partner: caller,
      roomId: room.id,
      callLogId: callLog.id,
      distanceKm: match.distanceKm,
      iceServers: config.iceServers
    });
  }

  return res.json({ match: payload });
});

router.post("/match/end", auth(true), async (req, res) => {
  const partnerId = req.body?.partnerId;
  const callLogId = req.body?.callLogId;

  const ops = [prisma.user.update({ where: { id: req.user.id }, data: { inCall: false } })];

  if (partnerId) {
    ops.push(prisma.user.update({ where: { id: partnerId }, data: { inCall: false } }));
  }

  await prisma.$transaction(ops);

  if (callLogId) {
    await prisma.callLog.update({
      where: { id: callLogId },
      data: { endedAt: new Date() }
    });
  }

  return res.json({ ok: true });
});

// Reset user status (for when users refresh page or reconnect)
router.post("/match/reset-status", auth(true), async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        inCall: false,
        isOnline: true
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error resetting user status:", error);
    res.status(500).json({ error: "Failed to reset status" });
  }
});

// Cleanup stale inCall statuses (for calls that ended abruptly)
router.post("/match/cleanup-stale", auth(true), async (req, res) => {
  try {
    // Find call logs that started more than 1 hour ago and haven't ended
    const staleCallLogs = await prisma.callLog.findMany({
      where: {
        endedAt: null,
        startedAt: {
          lt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      }
    });

    // End these calls and reset user statuses
    for (const callLog of staleCallLogs) {
      await prisma.$transaction([
        prisma.callLog.update({
          where: { id: callLog.id },
          data: { endedAt: new Date() }
        }),
        prisma.user.update({
          where: { id: callLog.callerId },
          data: { inCall: false }
        }),
        prisma.user.update({
          where: { id: callLog.calleeId },
          data: { inCall: false }
        })
      ]);
    }

    res.json({ 
      success: true, 
      cleanedUp: staleCallLogs.length 
    });
  } catch (error) {
    console.error("Error cleaning up stale calls:", error);
    res.status(500).json({ error: "Failed to cleanup stale calls" });
  }
});

// Emergency reset - reset all users' inCall status (admin/debug use)
router.post("/match/reset-all", auth(true), async (req, res) => {
  try {
    // Only allow this in development or for specific admin users
    if (process.env.NODE_ENV === 'production' && !req.user.email?.includes('admin')) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await prisma.user.updateMany({
      where: { inCall: true },
      data: { inCall: false }
    });

    res.json({ 
      success: true, 
      resetCount: result.count 
    });
  } catch (error) {
    console.error("Error resetting all users:", error);
    res.status(500).json({ error: "Failed to reset all users" });
  }
});

export default router;
