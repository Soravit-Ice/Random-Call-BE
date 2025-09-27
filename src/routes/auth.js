import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signTokens } from "../middleware/auth.js";
import { loginSchema, registerSchema, validate } from "../utils/validators.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const body = validate(registerSchema, req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        displayName: body.displayName || body.email.split("@")[0]
      }
    });

    const tokens = signTokens(user);
    return res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      tokens
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Failed to register" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const body = validate(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const tokens = signTokens(user);
    return res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      tokens
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Failed to login" });
  }
});

export default router;
