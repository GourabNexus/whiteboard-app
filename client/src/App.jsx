import Canvas from "./Canvas";
import "./App.css";

function App() {
  // Get roomId from URL manually
  const path = window.location.pathname;
  const roomId = path.split("/")[2] || "default";

  return <Canvas roomId={roomId} />;
}

export default App;