import { io } from "socket.io-client";

export const socket = io(
  "https://whiteboard-app-sikc.onrender.com",
  {
    transports: ["polling", "websocket"],
    withCredentials: true,
  }
);