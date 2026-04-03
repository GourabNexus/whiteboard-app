const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
  },
});

// ✅ In-memory storage
let rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];

    socket.emit("init", rooms[roomId]);
  });

  socket.on("draw", ({ roomId, stroke }) => {
    if (!rooms[roomId]) rooms[roomId] = [];

    rooms[roomId].push(stroke);

    socket.to(roomId).emit("draw", stroke);
  });

  socket.on("clear", (roomId) => {
    rooms[roomId] = [];
    io.to(roomId).emit("clear");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});