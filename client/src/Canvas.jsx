import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const Canvas = ({ roomId }) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastEmitRef = useRef(0);

  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = color;

    ctxRef.current = ctx;

    if (!roomId) return;

    console.log("Joining room:", roomId);
    socket.emit("joinRoom", roomId);

    socket.on("init", (strokes) => {
      strokes.forEach(drawStroke);
    });

    socket.on("draw", (stroke) => {
      drawStroke(stroke);
    });

    socket.on("clear", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off("draw");
      socket.off("init");
      socket.off("clear");
    };
  }, [roomId]);

  const drawStroke = ({ x0, y0, x1, y1, color, size }) => {
    const ctx = ctxRef.current;
    ctx.strokeStyle = color || "#000000";
    ctx.lineWidth = size || 3;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();
  };

  const getCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

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

    const strokeColor = isEraser ? "#FFFFFF" : color;

    const stroke = {
      x0: ctx.currentX,
      y0: ctx.currentY,
      x1: x,
      y1: y,
      color: strokeColor,
      size: Number(brushSize),
    };

    drawStroke(stroke);

    if (Date.now() - lastEmitRef.current > 10) {
      socket.emit("draw", { roomId, stroke });
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
      {/* Controls */}
      <div style={{ position: "fixed", top: 10, left: 10, zIndex: 10 }}>
        <button onClick={clearBoard}>Clear</button>

        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setIsEraser(false);
          }}
          style={{ marginLeft: 10 }}
        />

        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          style={{ marginLeft: 10 }}
        />

        <button
          onClick={() => setIsEraser(!isEraser)}
          style={{ marginLeft: 10 }}
        >
          {isEraser ? "Pen" : "Eraser"}
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          backgroundColor: "white",
          touchAction: "none", // 🔥 important for mobile
        }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
        onTouchStart={(e) => startDrawing(e.touches[0])}
        onTouchEnd={stopDrawing}
        onTouchMove={(e) => {
          e.preventDefault(); // 🔥 prevents scroll
          draw(e.touches[0]);
        }}
      />
    </>
  );
};

export default Canvas;