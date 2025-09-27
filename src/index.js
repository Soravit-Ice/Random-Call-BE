import express from "express";
import http from "http";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { prisma } from "./db.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import feedRoutes from "./routes/feed.js";
import notificationsRoutes from "./routes/notifications.js";
import matchRoutes from "./routes/match.js";
import { attachSocket } from "./realtime/socket.js";
import { setupVapid } from "./services/push.js";

setupVapid();

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: "https://incandescent-pavlova-dc36ec.netlify.app",
    credentials: false
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/", meRoutes);
app.use("/", feedRoutes);
app.use("/", notificationsRoutes);
app.use("/", matchRoutes);

app.get("/health", (_, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  return res.status(status).json({ error: err.message || "Server error" });
});

const server = http.createServer(app);
const io = attachSocket(server, config.corsOrigin);
app.set("io", io);

server.listen(config.port, () => {
  console.log(`API on :${config.port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
