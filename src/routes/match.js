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

export default router;
