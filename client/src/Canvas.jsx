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

  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);

  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  /* =========================
     DRAW STROKE
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

    strokesRef.current.forEach((stroke) => {
      drawStroke(stroke);
    });
  };

  /* =========================
     GET COORDINATES
  ========================= */

  const getCoords = (e) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

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
     CANVAS + SOCKET
  ========================= */

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !roomId) return;

    const setupCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext("2d");

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctxRef.current = ctx;

      redrawBoard();
    };

    setupCanvas();

    /* =========================
       LOAD BOARD
    ========================= */

    const handleLoadBoard = (strokes) => {
      console.log(
        "📥 BOARD UPDATED:",
        strokes.length
      );

      strokesRef.current = [...strokes];

      redrawBoard();
    };

    /* =========================
       RECEIVE DRAW
    ========================= */

    const handleDraw = (stroke) => {
      strokesRef.current.push(stroke);

      drawStroke(stroke);
    };

    /* =========================
       RECEIVE CLEAR
    ========================= */

    const handleClear = () => {
      console.log("🧹 BOARD CLEARED");

      strokesRef.current = [];

      redrawBoard();
    };

    /* =========================
       SOCKET CONNECT
    ========================= */

    const handleConnect = () => {
      console.log(
        "🔌 SOCKET CONNECTED:",
        socket.id
      );

      console.log(
        "Joining room:",
        roomId
      );

      socket.emit(
        "joinRoom",
        roomId
      );

      /*
        Request latest board again.
        Important after mobile tab switching
        or reconnecting.
      */

      socket.emit(
        "getBoard",
        roomId
      );
    };

    /* =========================
       REGISTER LISTENERS FIRST
    ========================= */

    socket.on(
      "loadBoard",
      handleLoadBoard
    );

    socket.on(
      "draw",
      handleDraw
    );

    socket.on(
      "clear",
      handleClear
    );

    socket.on(
      "connect",
      handleConnect
    );

    /* =========================
       JOIN CURRENT ROOM
    ========================= */

    if (socket.connected) {
      handleConnect();
    }

    /* =========================
       RESIZE
    ========================= */

    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    /* =========================
       CLEANUP
    ========================= */

    return () => {
      socket.off(
        "loadBoard",
        handleLoadBoard
      );

      socket.off(
        "draw",
        handleDraw
      );

      socket.off(
        "clear",
        handleClear
      );

      socket.off(
        "connect",
        handleConnect
      );

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
    const { x, y } = getCoords(e);

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

    const { x, y } = getCoords(e);

    const points =
      currentStroke.points;

    const previousPoint =
      points[points.length - 1];

    points.push({
      x,
      y,
    });

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (!ctx || !canvas) return;

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

    strokesRef.current.push(
      completedStroke
    );

    socket.emit("draw", {
      roomId,
      stroke: completedStroke,
    });
  };

  /* =========================
     UNDO
  ========================= */

  const undo = () => {
    if (!roomId) return;

    console.log(
      "↶ UNDO:",
      roomId
    );

    socket.emit(
      "undo",
      roomId
    );
  };

  /* =========================
     REDO
  ========================= */

  const redo = () => {
    if (!roomId) return;

    console.log(
      "↷ REDO:",
      roomId
    );

    socket.emit(
      "redo",
      roomId
    );
  };

  /* =========================
     CLEAR
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

      {/* TOP BAR */}

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

      {/* TOOLBAR */}

      <div className="toolbar">

        {/* PEN */}

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

        {/* ERASER */}

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

        {/* COLOR */}

        <label
          className="color-control"
          title="Stroke color"
        >
          <span
            className="color-preview"
            style={{
              backgroundColor: color,
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

        {/* BRUSH SIZE */}

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

        {/* UNDO */}

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

        {/* REDO */}

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

        {/* CLEAR */}

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

      {/* CONNECTION */}

      <div className="connection-status">

        <span className="status-dot" />

        Connected

      </div>

      {/* CANVAS */}

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