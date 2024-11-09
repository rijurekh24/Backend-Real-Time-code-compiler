const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => ({
      socketId,
      username: userSocketMap[socketId],
    })
  );
}

io.on("connection", (socket) => {
  console.log("New client connected: ", socket.id);

  socket.on("JOIN", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("JOINED", {
        clients,
        username,
        socketId: socket.id,
      });
    });

    console.log(`${username} joined room ${roomId}`);
  });

  socket.on("CODE_CHANGE", ({ roomId, code }) => {
    socket.in(roomId).emit("CODE_CHANGE", { code });
  });

  socket.on("SEND_MESSAGE", ({ roomId, message }) => {
    const username = userSocketMap[socket.id];
    if (username) {
      const chatMessage = {
        username,
        message,
        timestamp: new Date().toISOString(),
      };
      io.in(roomId).emit("RECEIVE_MESSAGE", chatMessage);
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit("DISCONNECTED", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
