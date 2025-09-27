export function signaling(io) {
  const namespace = io.of("/realtime");

  namespace.on("connection", (socket) => {
    socket.on("user:online", (userId) => {
      socket.data.userId = userId;
      socket.join(userId);
    });

    socket.on("webrtc:offer", ({ to, sdp }) => {
      namespace.to(to).emit("webrtc:offer", { from: socket.data.userId, sdp });
    });

    socket.on("webrtc:answer", ({ to, sdp }) => {
      namespace.to(to).emit("webrtc:answer", { from: socket.data.userId, sdp });
    });

    socket.on("webrtc:candidate", ({ to, candidate }) => {
      namespace.to(to).emit("webrtc:candidate", { from: socket.data.userId, candidate });
    });

    socket.on("chat:send", ({ toRoom, text }) => {
      namespace.to(toRoom).emit("chat:message", {
        from: socket.data.userId,
        text,
        ts: Date.now()
      });
    });

    socket.on("call:hangup", ({ to }) => {
      namespace.to(to).emit("call:hangup", { from: socket.data.userId });
    });
  });
}
