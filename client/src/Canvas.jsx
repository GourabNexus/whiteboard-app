import { useEffect, useRef, useState } from "react";
import {
  Pen,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Share2,
} from "lucide-react";
import { socket } from "./socket";

const Canvas = ({ roomId }) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  // All completed strokes
  const strokesRef = useRef([]);

  // Current stroke being drawn
  const currentStrokeRef = useRef(null);

  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  /* =========================
     DRAW COMPLETE STROKE
  ========================= */

  const drawStroke = (stroke) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (!ctx || !canvas || !stroke) return;

    const {
      points,
      color,
      size,
      normalized,
    } = stroke;

    if (!points || points.length === 0) return;

    ctx.strokeStyle = color || "#000000";
    ctx.lineWidth = size || 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();

    points.forEach((point, index) => {
      const x = normalized
        ? point.x * canvas.width
        : point.x;

      const y = normalized
        ? point.y * canvas.height
        : point.y;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
    ctx.closePath();
  };

  /* =========================
     REDRAW BOARD
  ========================= */

  const redrawBoard = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!canvas || !ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    strokesRef.current.forEach(
      drawStroke
    );
  };

  /* =========================
     GET COORDINATES
  ========================= */

  const getCoords = (e) => {
    const canvas = canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (e.clientX - rect.left) /
        rect.width,

      y:
        (e.clientY - rect.top) /
        rect.height,
    };
  };

  /* =========================
     CANVAS + SOCKET SETUP
  ========================= */

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctxRef.current = ctx;

    if (!roomId) return;

    console.log(
      "Joining room:",
      roomId
    );

    socket.emit(
      "joinRoom",
      roomId
    );

    /* =========================
       LOAD BOARD
    ========================= */

    socket.on("loadBoard", (strokes) => {
    console.log("🔥 LOADBOARD EVENT RECEIVED", strokes);
    console.log("📥 BOARD UPDATED:", strokes.length);

    strokesRef.current = [...strokes];

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokesRef.current.forEach((stroke) => {
      drawStroke(stroke);
    });
  });

    /* =========================
       RECEIVE DRAWING
    ========================= */

    socket.on(
      "draw",
      (stroke) => {
        strokesRef.current.push(
          stroke
        );

        drawStroke(stroke);
      }
    );

    /* =========================
       RECEIVE CLEAR
    ========================= */

    socket.on(
      "clear",
      () => {
        strokesRef.current = [];

        redrawBoard();
      }
    );

    /* =========================
       RESIZE
    ========================= */

    const handleResize = () => {
      canvas.width =
        window.innerWidth;

      canvas.height =
        window.innerHeight;

      const newCtx =
        canvas.getContext("2d");

      newCtx.lineCap = "round";
      newCtx.lineJoin = "round";

      ctxRef.current = newCtx;

      redrawBoard();
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      socket.off("draw");
      socket.off("loadBoard");
      socket.off("clear");

      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [roomId]);

  /* =========================
     START DRAWING
  ========================= */

  const startDrawing = (e) => {
    const { x, y } =
      getCoords(e);

    const strokeColor = isEraser
      ? "#f9fafb"
      : color;

    currentStrokeRef.current = {
      points: [
        {
          x,
          y,
        },
      ],

      color: strokeColor,

      size: Number(brushSize),

      normalized: true,
    };

    setDrawing(true);
  };

  /* =========================
     DRAW
  ========================= */

  const draw = (e) => {
    if (!drawing) return;

    const currentStroke =
      currentStrokeRef.current;

    if (!currentStroke) return;

    const { x, y } =
      getCoords(e);

    const points =
      currentStroke.points;

    const previousPoint =
      points[points.length - 1];

    // Add new point
    points.push({
      x,
      y,
    });

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (!ctx || !canvas) return;

    /* Draw only the newest segment */

    ctx.strokeStyle =
      currentStroke.color;

    ctx.lineWidth =
      currentStroke.size;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const startX =
      previousPoint.x *
      canvas.width;

    const startY =
      previousPoint.y *
      canvas.height;

    const endX =
      x * canvas.width;

    const endY =
      y * canvas.height;

    ctx.beginPath();

    ctx.moveTo(
      startX,
      startY
    );

    ctx.lineTo(
      endX,
      endY
    );

    ctx.stroke();

    ctx.closePath();
  };

  /* =========================
     STOP DRAWING
  ========================= */

  const stopDrawing = () => {
    if (!drawing) return;

    const completedStroke =
      currentStrokeRef.current;

    setDrawing(false);

    currentStrokeRef.current =
      null;

    if (
      !completedStroke ||
      completedStroke.points.length === 0
    ) {
      return;
    }

    /*
      Store ONE complete drawing
      as ONE stroke.
    */

    strokesRef.current.push(
      completedStroke
    );

    /*
      Send ONE complete stroke
      to the server.
    */

    socket.emit("draw", {
      roomId,
      stroke: completedStroke,
    });
  };

  /* =========================
     UNDO
  ========================= */

  const undo = () => {
  console.log("UNDO BUTTON CLICKED", roomId);

  if (!roomId) {
    console.log("NO ROOM ID");
    return;
  }

  socket.emit("undo", roomId);
  console.log("UNDO SENT TO SERVER");
  };

  /* =========================
     REDO
  ========================= */

  const redo = () => {
  console.log("REDO BUTTON CLICKED", roomId);

  if (!roomId) {
    console.log("NO ROOM ID");
    return;
  }

  socket.emit("redo", roomId);
  console.log("REDO SENT TO SERVER");
  };  

  /* =========================
     CLEAR BOARD
  ========================= */

  const clearBoard = () => {
    if (!roomId) return;

    socket.emit(
      "clear",
      roomId
    );
  };

  /* =========================
     SHARE
  ========================= */

  const shareBoard = async () => {
    try {
      await navigator.clipboard.writeText(
        window.location.href
      );

      alert(
        "Board link copied!"
      );
    } catch (error) {
      console.error(
        "Failed to copy:",
        error
      );
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="whiteboard">

      {/* =========================
          TOP NAVIGATION
      ========================= */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            ✦
          </div>

          <div>
            <h1>
              CollabBoard
            </h1>

            <span>
              Real-time workspace
            </span>
          </div>

        </div>

        <div className="room-info">

          <span className="room-label">
            ROOM
          </span>

          <span className="room-id">
            {roomId || "default"}
          </span>

          <button
            className="share-btn"
            onClick={shareBoard}
          >
            <Share2 size={15} />

            <span>
              Share
            </span>
          </button>

        </div>

      </header>

      {/* =========================
          TOOLBAR
      ========================= */}

      <div className="toolbar">

        {/* Pen */}

        <button
          className={
            !isEraser
              ? "tool-btn active"
              : "tool-btn"
          }
          onClick={() =>
            setIsEraser(false)
          }
          title="Pen"
        >
          <Pen
            size={18}
            strokeWidth={2}
          />
        </button>

        {/* Eraser */}

        <button
          className={
            isEraser
              ? "tool-btn active"
              : "tool-btn"
          }
          onClick={() =>
            setIsEraser(true)
          }
          title="Eraser"
        >
          <Eraser
            size={18}
            strokeWidth={2}
          />
        </button>

        <div className="toolbar-divider" />

        {/* Color */}

        <label
          className="color-control"
          title="Stroke color"
        >
          <span
            className="color-preview"
            style={{
              backgroundColor:
                color,
            }}
          />

          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(
                e.target.value
              );

              setIsEraser(false);
            }}
          />
        </label>

        {/* Brush Size */}

        <div className="size-control">

          <span className="size-label">
            Stroke
          </span>

          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) =>
              setBrushSize(
                Number(
                  e.target.value
                )
              )
            }
          />

          <span className="size-value">
            {brushSize}px
          </span>

        </div>

        <div className="toolbar-divider" />

        {/* Undo */}

        <button
          className="tool-btn"
          title="Undo"
          onClick={undo}
        >
          <Undo2
            size={18}
            strokeWidth={2}
          />
        </button>

        {/* Redo */}

        <button
          className="tool-btn"
          title="Redo"
          onClick={redo}
        >
          <Redo2
            size={18}
            strokeWidth={2}
          />
        </button>

        <div className="toolbar-divider" />

        {/* Clear */}

        <button
          className="tool-btn clear-btn"
          onClick={clearBoard}
          title="Clear board"
        >
          <Trash2
            size={18}
            strokeWidth={2}
          />
        </button>

      </div>

      {/* =========================
          CONNECTION STATUS
      ========================= */}

      <div className="connection-status">

        <span className="status-dot" />

        Connected

      </div>

      {/* =========================
          CANVAS
      ========================= */}

      <canvas
        ref={canvasRef}
        className="drawing-canvas"

        onMouseDown={
          startDrawing
        }

        onMouseMove={
          draw
        }

        onMouseUp={
          stopDrawing
        }

        onMouseLeave={
          stopDrawing
        }

        onTouchStart={(e) => {
          e.preventDefault();

          startDrawing(
            e.touches[0]
          );
        }}

        onTouchMove={(e) => {
          e.preventDefault();

          draw(
            e.touches[0]
          );
        }}

        onTouchEnd={(e) => {
          e.preventDefault();

          stopDrawing();
        }}
      />

    </div>
  );
};

export default Canvas;