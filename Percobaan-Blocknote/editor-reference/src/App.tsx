import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminEditorPage } from "./pages/AdminEditorPage";
import { PublicReader } from "./pages/PublicReader";
import { CanvasPrototypePage } from "./pages/CanvasPrototypePage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        {/* Simple navigation bar */}
        <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="font-bold text-xl text-blue-600">BlockNote CMS Reference</div>
            <div className="flex gap-4">
              <a href="/admin" className="text-gray-600 hover:text-blue-600 transition font-medium">Admin Dashboard</a>
            </div>
          </div>
        </nav>

        {/* Main Routes */}
        <main className="py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/edit/:id" element={<AdminEditorPage />} />
            <Route path="/article/:id" element={<PublicReader />} />
            <Route path="/canvas" element={<CanvasPrototypePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
