import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { authService } from './services/auth';
import { LoginPage } from './pages/auth/LoginPage';
import { SalesPage } from './pages/worker/SalesPage';
import { WorkerRetailersPage } from './pages/worker/WorkerRetailersPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { InventoryPage } from './pages/admin/InventoryPage';
import { RetailersPage } from './pages/admin/RetailersPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { WorkersPage } from './pages/admin/WorkersPage';
import { ExpensesPage } from './pages/admin/ExpensesPage';
import { AdminBillsPage } from './pages/admin/AdminBillsPage';
import { X } from 'lucide-react';
import './index.css';

// ── Auth Persistence ──────────────────────────────────────────────────────────
// On page refresh Zustand state is empty. We re-validate the stored JWT before
// rendering protected routes so the user is NOT bounced to /login incorrectly.

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setChecking(false); return; }

    authService
      .getCurrentUser()
      .then(({ user }) => { setCurrentUser(user); })
      .catch(() => {
        localStorage.removeItem('accessToken');
        setCurrentUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ── Protected Route ───────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRole?: 'admin' | 'worker';
}> = ({ children, requiredRole }) => {
  const currentUser = useStore((s) => s.currentUser);

  if (!currentUser) return <Navigate to="/login" replace />;

  // Admins can access everything; workers can only access worker routes
  if (requiredRole === 'admin' && currentUser.role !== 'admin') {
    return <Navigate to="/worker/sales" replace />;
  }

  return <>{children}</>;
};

// ── Notifications ─────────────────────────────────────────────────────────────
// Single-toast-at-a-time system. The store's addNotification always replaces
// the notifications array with exactly one entry, so this component never
// renders more than one toast. Timer restarts cleanly on every id change.
const Notifications: React.FC = () => {
  const notifications = useStore((s) => s.notifications);
  const removeNotification = useStore((s) => s.removeNotification);

  // Auto-dismiss in 1.5 s. The id in the dep-array means the timer restarts
  // fresh on every new toast (rapid +/− clicks each get a clean countdown).
  const toast = notifications[0] ?? null;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => removeNotification(toast.id), 1500);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  const bgColor =
    toast.type === 'success' ? 'bg-green-600'
    : toast.type === 'error'   ? 'bg-red-600'
    : toast.type === 'warning' ? 'bg-yellow-500'
    : 'bg-blue-600';

  return (
    // Top-center — clear of the RGB stock ± buttons and cart table
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-72 max-w-[90vw]">
      <div
        key={toast.id}
        className={`pointer-events-auto overflow-hidden rounded-lg shadow-xl text-white ${bgColor}`}
        style={{ animation: 'toast-in 0.18s ease-out' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => removeNotification(toast.id)}
            className="hover:opacity-75 flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
        {/* Progress bar — shrinks from 100 → 0 in 1.5 s */}
        <div className="h-1 bg-black bg-opacity-20">
          <div
            className="h-full bg-white bg-opacity-50 origin-left"
            style={{ animation: 'toast-shrink 1.5s linear forwards' }}
          />
        </div>
      </div>
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const currentUser = useStore((s) => s.currentUser);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthGate>
        <Notifications />
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Worker Routes */}
          <Route path="/worker/sales"     element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
          <Route path="/worker/retailers" element={<ProtectedRoute><WorkerRetailersPage /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/inventory" element={<ProtectedRoute requiredRole="admin"><InventoryPage /></ProtectedRoute>} />
          <Route path="/admin/retailers" element={<ProtectedRoute requiredRole="admin"><RetailersPage /></ProtectedRoute>} />
          <Route path="/admin/reports"   element={<ProtectedRoute requiredRole="admin"><ReportsPage /></ProtectedRoute>} />
          <Route path="/admin/workers"   element={<ProtectedRoute requiredRole="admin"><WorkersPage /></ProtectedRoute>} />
          <Route path="/admin/expenses"  element={<ProtectedRoute requiredRole="admin"><ExpensesPage /></ProtectedRoute>} />
          <Route path="/admin/bills"     element={<ProtectedRoute requiredRole="admin"><AdminBillsPage /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route
            path="/"
            element={
              currentUser
                ? currentUser.role === 'admin'
                  ? <Navigate to="/admin/dashboard" replace />
                  : <Navigate to="/worker/sales" replace />
                : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </Router>
  );
}
