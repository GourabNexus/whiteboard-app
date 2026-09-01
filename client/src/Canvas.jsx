import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const Canvas = ({ roomId }) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastEmitRef = useRef(0);
  const strokesRef = useRef([]);

  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  // Draw one stroke on the canvas
  const drawStroke = ({
    x0,
    y0,
    x1,
    y1,
    color,
    size,
    normalized,
  }) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (!ctx || !canvas) return;

    ctx.strokeStyle = color || "#000000";
    ctx.lineWidth = size || 3;

    // Convert normalized coordinates into
    // the current canvas's pixel coordinates.
    const startX = normalized ? x0 * canvas.width : x0;
    const startY = normalized ? y0 * canvas.height : y0;
    const endX = normalized ? x1 * canvas.width : x1;
    const endY = normalized ? y1 * canvas.height : y1;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.closePath();
  };

  // Convert mouse/touch position into normalized coordinates
  const getCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return {
      x: x / rect.width,
      y: y / rect.height,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    // Set initial canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";

    ctxRef.current = ctx;

    if (!roomId) return;

    console.log("Joining room:", roomId);

    socket.emit("joinRoom", roomId);

    // Receive existing board
    socket.on("loadBoard", (strokes) => {
      strokesRef.current = strokes;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      strokes.forEach(drawStroke);
    });

    // Receive new drawing from another user
    socket.on("draw", (stroke) => {
      strokesRef.current.push(stroke);
      drawStroke(stroke);
    });

    // Clear board
    socket.on("clear", () => {
      strokesRef.current = [];

      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Handle browser/device resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const newCtx = canvas.getContext("2d");
      newCtx.lineCap = "round";

      ctxRef.current = newCtx;

      // Redraw all stored strokes
      strokesRef.current.forEach(drawStroke);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      socket.off("draw");
      socket.off("loadBoard");
      socket.off("clear");

      window.removeEventListener("resize", handleResize);
    };
  }, [roomId]);

  const startDrawing = (e) => {
    setDrawing(true);

    const { x, y } = getCoords(e);

    ctxRef.current.currentX = x;
    ctxRef.current.currentY = y;
  };

  const stopDrawing = () => {
    setDrawing(false);

    ctxRef.current.currentX = null;
    ctxRef.current.currentY = null;
  };

  const draw = (e) => {
    if (!drawing) return;

    const { x, y } = getCoords(e);
    const ctx = ctxRef.current;

    if (ctx.currentX == null || ctx.currentY == null) {
      ctx.currentX = x;
      ctx.currentY = y;
      return;
    }

    const strokeColor = isEraser ? "#ffffff" : color;

    const stroke = {
      x0: ctx.currentX,
      y0: ctx.currentY,
      x1: x,
      y1: y,
      color: strokeColor,
      size: Number(brushSize),
      normalized: true,
    };

    // Save stroke locally
    strokesRef.current.push(stroke);

    // Draw locally
    drawStroke(stroke);

    // Send to other users
    if (Date.now() - lastEmitRef.current > 10) {
      socket.emit("draw", {
        roomId,
        stroke,
      });

      lastEmitRef.current = Date.now();
    }

    ctx.currentX = x;
    ctx.currentY = y;
  };

  const clearBoard = () => {
    socket.emit("clear", roomId);
  };

  return (
    <>
      {/* TOOLBAR */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          background: "rgba(30, 30, 30, 0.9)",
          backdropFilter: "blur(10px)",
          padding: "10px 16px",
          borderRadius: "16px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          zIndex: 1000,
        }}
      >
        {/* Clear */}
        <button onClick={clearBoard} style={btnStyle}>
          🧹
        </button>

        {/* Color Picker */}
        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setIsEraser(false);
          }}
          style={{
            width: 32,
            height: 32,
            border: "none",
            cursor: "pointer",
          }}
        />

        {/* Brush Size */}
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          style={{
            cursor: "pointer",
          }}
        />

        {/* Eraser */}
        <button
          onClick={() => setIsEraser(!isEraser)}
          style={{
            ...btnStyle,
            background: isEraser
              ? "rgba(255,255,255,0.2)"
              : "transparent",
          }}
        >
          {isEraser ? "✏️" : "🩹"}
        </button>
      </div>

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          backgroundColor: "#f9fafb",
          touchAction: "none",
        }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
        onTouchStart={(e) => startDrawing(e.touches[0])}
        onTouchEnd={stopDrawing}
        onTouchMove={(e) => {
          e.preventDefault();
          draw(e.touches[0]);
        }}
      />
    </>
  );
};

const btnStyle = {
  border: "none",
  background: "transparent",
  color: "white",
  fontSize: "18px",
  cursor: "pointer",
  padding: "6px 10px",
  borderRadius: "8px",
};

export default Canvas;