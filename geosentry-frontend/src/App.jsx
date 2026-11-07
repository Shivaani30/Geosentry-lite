import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import MapDashboard from "./pages/Mapdashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<MapDashboard />} />
    </Routes>
  );
}

export default App;

