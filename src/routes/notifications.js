import { Router } from "express";
import { prisma } from "../db.js";
import { auth } from "../middleware/auth.js";
import { pushSubscriptionSchema, validate } from "../utils/validators.js";

const router = Router();

router.post("/notifications/subscribe", auth(true), async (req, res) => {
  try {
    const body = validate(pushSubscriptionSchema, req.body);
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: req.user.id,
        endpoint: body.endpoint,
        p256dh: body.keys?.p256dh || "",
        auth: body.keys?.auth || ""
      },
      update: {
        userId: req.user.id,
        p256dh: body.keys?.p256dh || "",
        auth: body.keys?.auth || ""
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Failed to subscribe" });
  }
});

export default router;
