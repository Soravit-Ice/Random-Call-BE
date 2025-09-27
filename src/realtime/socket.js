import { Server } from "socket.io";
import { signaling } from "./signaling.js";

export function attachSocket(server, corsOrigin) {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      credentials: false
    }
  });

  signaling(io);
  return io;
}
