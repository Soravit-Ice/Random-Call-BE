import { Router } from "express";
import { prisma } from "../db.js";
import { auth } from "../middleware/auth.js";
import { postSchema, validate } from "../utils/validators.js";

const router = Router();

router.get("/feed", auth(false), async (req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, displayName: true } },
      _count: { select: { likes: true, comments: true } }
    },
    take: 50
  });

  return res.json(posts);
});

router.post("/feed", auth(true), async (req, res) => {
  try {
    const body = validate(postSchema, req.body);
    const post = await prisma.post.create({ data: { userId: req.user.id, content: body.content } });
    return res.json(post);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Failed to create post" });
  }
});

export default router;
