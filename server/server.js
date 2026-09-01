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
      "https://whiteboard-app-psi-ten.vercel.app",
    ],
  },
});

// =========================
// ROOM STORAGE
// =========================

let rooms = {};

let redoRooms = {};

// =========================
// SOCKET CONNECTION
// =========================

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // =========================
  // JOIN ROOM
  // =========================

  socket.on("joinRoom", (roomId) => {
    console.log(
      "✅ JOIN:",
      socket.id,
      "->",
      roomId
    );

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (!redoRooms[roomId]) {
      redoRooms[roomId] = [];
    }

    socket.emit(
      "loadBoard",
      rooms[roomId]
    );
  });

  // =========================
  // DRAW
  // =========================

  socket.on(
    "draw",
    ({ roomId, stroke }) => {
      console.log(
        "🎨 DRAW:",
        socket.id,
        "room:",
        roomId
      );

      if (!rooms[roomId]) {
        rooms[roomId] = [];
      }

      if (!redoRooms[roomId]) {
        redoRooms[roomId] = [];
      }

      rooms[roomId].push(stroke);

      // New drawing clears redo history
      redoRooms[roomId] = [];

      socket
        .to(roomId)
        .emit("draw", stroke);
    }
  );

  // =========================
  // UNDO
  // =========================

  socket.on("undo", (roomId) => {
    console.log(
      "↶ UNDO:",
      socket.id,
      "room:",
      roomId
    );

    if (!rooms[roomId]) {
      return;
    }

    if (!redoRooms[roomId]) {
      redoRooms[roomId] = [];
    }

    if (rooms[roomId].length === 0) {
      return;
    }

    const removedStroke =
      rooms[roomId].pop();

    redoRooms[roomId].push(
      removedStroke
    );

    io.to(roomId).emit(
      "loadBoard",
      rooms[roomId]
    );
  });

  // =========================
  // REDO
  // =========================

  socket.on("redo", (roomId) => {
    console.log(
      "↷ REDO:",
      socket.id,
      "room:",
      roomId
    );

    if (!redoRooms[roomId]) {
      return;
    }

    if (
      redoRooms[roomId].length === 0
    ) {
      return;
    }

    const restoredStroke =
      redoRooms[roomId].pop();

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    rooms[roomId].push(
      restoredStroke
    );

    io.to(roomId).emit(
      "loadBoard",
      rooms[roomId]
    );
  });

  // =========================
  // CLEAR BOARD
  // =========================

  socket.on("clear", (roomId) => {
    console.log(
      "🧹 CLEAR:",
      roomId
    );

    rooms[roomId] = [];
    redoRooms[roomId] = [];

    io.to(roomId).emit("clear");
  });

  // =========================
  // LOAD BOARD
  // =========================

  socket.on("getBoard", (roomId) => {
    console.log(
      "📥 LOAD BOARD:",
      roomId
    );

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    socket.emit(
      "loadBoard",
      rooms[roomId]
    );
  });

  // =========================
  // DISCONNECT
  // =========================

  socket.on("disconnect", () => {
    console.log(
      "❌ User disconnected:",
      socket.id
    );
  });
});

// =========================
// ROOT ROUTE
// =========================

app.get("/", (req, res) => {
  res.send(
    "Whiteboard backend is running 🚀"
  );
});

// =========================
// SERVER
// =========================

const PORT =
  process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
});