import { Router } from "express";
import { prisma } from "../db.js";
import { auth } from "../middleware/auth.js";
import { locationSchema, validate } from "../utils/validators.js";

const router = Router();

router.get("/me", auth(true), async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      lat: true,
      lng: true,
      radiusKmDefault: true,
      isOnline: true,
      inCall: true
    }
  });

  return res.json(me);
});

router.patch("/me/location", auth(true), async (req, res) => {
  try {
    const body = validate(locationSchema, req.body);
    const data = {};

    if (Object.prototype.hasOwnProperty.call(body, "lat")) data.lat = body.lat;
    if (Object.prototype.hasOwnProperty.call(body, "lng")) data.lng = body.lng;
    if (Object.prototype.hasOwnProperty.call(body, "radiusKmDefault"))
      data.radiusKmDefault = body.radiusKmDefault;

    await prisma.user.update({ where: { id: req.user.id }, data });
    return res.json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Failed to update location" });
  }
});

router.patch("/me/status", auth(true), async (req, res) => {
  const { isOnline, inCall } = req.body;
  
  // If user is coming online, automatically reset inCall to false unless explicitly set
  const updateData = {};
  
  if (typeof isOnline === "boolean") {
    updateData.isOnline = isOnline;
    // When coming online, reset inCall status unless explicitly provided
    if (isOnline && typeof inCall !== "boolean") {
      updateData.inCall = false;
    }
  }
  
  if (typeof inCall === "boolean") {
    updateData.inCall = inCall;
  }
  
  await prisma.user.update({
    where: { id: req.user.id },
    data: updateData
  });
  
  return res.json({ ok: true });
});

export default router;
