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
import friendsRoutes from "./routes/friends.js";
import chatRoutes from "./routes/chat.js";
import { attachSocket } from "./realtime/socket.js";
import { setupVapid } from "./services/push.js";

setupVapid();

const app = express();
app.use(helmet());
const allowedOrigins = [
  "https://aquamarine-mochi-52c1f7.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173"
];

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    
    try {
      const host = new URL(origin).host;
      // Allow localhost and netlify domains
      if (allowedOrigins.includes(origin) || 
          /\.netlify\.app$/.test(host) || 
          host.includes('localhost') || 
          host.includes('127.0.0.1')) {
        return cb(null, true);
      }
    } catch (_) {
      // If URL parsing fails, allow it for development
      if (process.env.NODE_ENV !== 'production') {
        return cb(null, true);
      }
    }
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With"],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.options("*", cors(corsOptions))
app.use("/auth", authRoutes);
app.use("/", meRoutes);
app.use("/", feedRoutes);
app.use("/", notificationsRoutes);
app.use("/", matchRoutes);
app.use("/", friendsRoutes);
app.use("/", chatRoutes);

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

// Periodic cleanup of stale call statuses (every 5 minutes)
setInterval(async () => {
  try {
    console.log("Running periodic cleanup of stale calls...");
    
    // Find call logs that started more than 30 minutes ago and haven't ended
    const staleCallLogs = await prisma.callLog.findMany({
      where: {
        endedAt: null,
        startedAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        }
      }
    });

    if (staleCallLogs.length > 0) {
      console.log(`Found ${staleCallLogs.length} stale calls, cleaning up...`);
      
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
      
      console.log(`Cleaned up ${staleCallLogs.length} stale calls`);
    }
  } catch (error) {
    console.error("Error in periodic cleanup:", error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
