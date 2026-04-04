const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://whiteboard-app-psi-ten.vercel.app" // ❗ removed trailing /
    ],
  },
});

// ✅ In-memory storage
let rooms = {};

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // ✅ JOIN ROOM
  socket.on("joinRoom", (roomId) => {
    console.log("✅ JOIN:", socket.id, "->", roomId);

    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];

    // send existing strokes
    socket.emit("loadBoard", rooms[roomId]);
  });

  // ✅ DRAW EVENT
  socket.on("draw", ({ roomId, stroke }) => {
    console.log("🎨 DRAW:", socket.id, "room:", roomId);

    if (!rooms[roomId]) rooms[roomId] = [];

    rooms[roomId].push(stroke);

    // send to others in same room
    socket.to(roomId).emit("draw", stroke);
  });

  // ✅ CLEAR BOARD
  socket.on("clear", (roomId) => {
    console.log("🧹 CLEAR:", roomId);

    rooms[roomId] = [];

    io.to(roomId).emit("clear");
  });

  // ✅ LOAD BOARD (manual request)
  socket.on("getBoard", (roomId) => {
    console.log("📥 LOAD BOARD:", roomId);

    if (!rooms[roomId]) rooms[roomId] = [];

    socket.emit("loadBoard", rooms[roomId]);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// Optional route (so "Cannot GET /" disappears)
app.get("/", (req, res) => {
  res.send("Whiteboard backend is running 🚀");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});