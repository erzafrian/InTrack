import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar, { MobileHeader } from './components/Sidebar';
import Login from './pages/Login';
import Absen from './pages/intern/Absen';
import Logbook from './pages/intern/Logbook';
import Planner from './pages/intern/Planner';
import FaceEnroll from './pages/intern/FaceEnroll';
import Dashboard from './pages/mentor/Dashboard';
import AttendanceView from './pages/mentor/AttendanceView';
import AiChat from './pages/mentor/AiChat';
import InternProgress from './pages/mentor/InternProgress';
import Users from './pages/admin/Users';
import Settings from './pages/admin/Settings';

function AppLayout({ children }) {

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <MobileHeader onMenuOpen={() => setMobileOpen(true)} />
      <main
        className="pt-16 lg:pt-0 lg:ml-64"
      >
        <div
          className="p-4 sm:p-6 lg:p-8 transition-all duration-300"
        >
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'INTERN') return <Navigate to="/absen" replace />;
  return <Navigate to="/mentor/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/absen" element={<ProtectedRoute roles={['INTERN']}><AppLayout><Absen /></AppLayout></ProtectedRoute>} />
          <Route path="/face-enroll" element={<ProtectedRoute roles={['INTERN']}><AppLayout><FaceEnroll /></AppLayout></ProtectedRoute>} />
          <Route path="/logbook" element={<ProtectedRoute roles={['INTERN']}><AppLayout><Logbook /></AppLayout></ProtectedRoute>} />
          <Route path="/planner" element={<ProtectedRoute roles={['INTERN']}><AppLayout><Planner /></AppLayout></ProtectedRoute>} />
          <Route path="/mentor/dashboard" element={<ProtectedRoute roles={['MENTOR', 'SUPERUSER']}><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/mentor/attendance" element={<ProtectedRoute roles={['MENTOR', 'SUPERUSER']}><AppLayout><AttendanceView /></AppLayout></ProtectedRoute>} />
          <Route path="/mentor/intern-progress" element={<ProtectedRoute roles={['MENTOR', 'SUPERUSER']}><AppLayout><InternProgress /></AppLayout></ProtectedRoute>} />
          <Route path="/mentor/ai-chat" element={<ProtectedRoute roles={['MENTOR', 'SUPERUSER']}><AppLayout><AiChat /></AppLayout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['SUPERUSER']}><AppLayout><Users /></AppLayout></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['SUPERUSER']}><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
