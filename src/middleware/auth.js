import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      if (required) return res.status(401).json({ error: "Unauthorized" });
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret);
      req.user = payload;
      return next();
    } catch (err) {
      if (required) return res.status(401).json({ error: "Invalid token" });
      req.user = null;
      return next();
    }
  };
}

export const requireAuth = auth(true);

export function signTokens(user) {
  const access = jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, {
    expiresIn: config.jwt.accessExp
  });
  const refresh = jwt.sign({ id: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExp
  });
  return { access, refresh };
}
