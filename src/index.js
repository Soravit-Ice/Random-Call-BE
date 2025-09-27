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
const allowedOrigins = [
  "https://aquamarine-mochi-52c1f7.netlify.app",
  "http://localhost:5173",
];
// ถ้ามี deploy preview บน Netlify แนะนำ regex
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // สำหรับ server-to-server/curl
    try {
      const host = new URL(origin).host;
      if (allowedOrigins.includes(origin) || /\.netlify\.app$/.test(host)) {
        return cb(null, true);
      }
    } catch (_) {}
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With"],
  credentials: false, // ถ้าใช้คุกกี้ ให้ true แล้วฝั่ง FE ใส่ credentials: 'include'
  optionsSuccessStatus: 204,
};
app.use(
  cors({
    origin: "https://aquamarine-mochi-52c1f7.netlify.app",
    credentials: false
  })
);
app.use(express.json());
app.use(cookieParser());
app.options("*", cors(corsOptions))
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
