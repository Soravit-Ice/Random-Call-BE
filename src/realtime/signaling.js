export function signaling(io) {
  const namespace = io.of("/realtime");

  namespace.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("user:online", (userId) => {
      socket.data.userId = userId;
      socket.join(userId);
      console.log(`User ${userId} joined room`);
    });

    // WebRTC signaling
    socket.on("webrtc:offer", ({ to, sdp }) => {
      namespace.to(to).emit("webrtc:offer", { from: socket.data.userId, sdp });
    });

    socket.on("webrtc:answer", ({ to, sdp }) => {
      namespace.to(to).emit("webrtc:answer", { from: socket.data.userId, sdp });
    });

    socket.on("webrtc:candidate", ({ to, candidate }) => {
      namespace.to(to).emit("webrtc:candidate", { from: socket.data.userId, candidate });
    });

    // Call chat (during active calls)
    socket.on("chat:send", ({ toRoom, text }) => {
      namespace.to(toRoom).emit("chat:message", {
        from: socket.data.userId,
        text,
        ts: Date.now(),
        type: 'call'
      });
    });

    socket.on("chat:typing", ({ to, typing }) => {
      namespace.to(to).emit("chat:typing", {
        from: socket.data.userId,
        typing
      });
    });

    // Friend requests
    socket.on("friend:request", ({ to, requestId, message }) => {
      namespace.to(to).emit("friend:request", {
        from: socket.data.userId,
        requestId,
        message
      });
    });

    socket.on("friend:response", ({ to, accepted }) => {
      namespace.to(to).emit("friend:response", {
        from: socket.data.userId,
        accepted
      });
    });

    // Private messaging
    socket.on("private:send", ({ to, text }) => {
      namespace.to(to).emit("private:message", {
        from: socket.data.userId,
        text,
        ts: Date.now(),
        type: 'private'
      });
    });

    socket.on("private:typing", ({ to, typing }) => {
      namespace.to(to).emit("private:typing", {
        from: socket.data.userId,
        typing
      });
    });

    // Call management
    socket.on("call:hangup", ({ to }) => {
      namespace.to(to).emit("call:hangup", { from: socket.data.userId });
    });

    // Match notifications
    socket.on("match:incoming", ({ to, partner, roomId, callLogId, iceServers }) => {
      namespace.to(to).emit("match:incoming", {
        partner,
        roomId,
        callLogId,
        iceServers
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}
