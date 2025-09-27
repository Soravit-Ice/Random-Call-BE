import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExp: Number(process.env.JWT_ACCESS_EXPIRES || 900),
    refreshExp: Number(process.env.JWT_REFRESH_EXPIRES || 2592000)
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT
  },
  iceServers: JSON.parse('[{"urls":"stun:stun.l.google.com:19302"}]' || "[]")
};
