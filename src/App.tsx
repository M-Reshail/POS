import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { authService } from './services/auth';
import { LoginPage } from './pages/auth/LoginPage';
import { SalesPage } from './pages/worker/SalesPage';
import { WorkerRetailersPage } from './pages/worker/WorkerRetailersPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { InventoryPage } from './pages/admin/InventoryPage';
import { RetailersPage } from './pages/admin/RetailersPage';
import { RetailerDetailPage } from './pages/admin/RetailerDetailPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { WorkersPage } from './pages/admin/WorkersPage';
import { ExpensesPage } from './pages/admin/ExpensesPage';
import { AdminBillsPage } from './pages/admin/AdminBillsPage';
import { X, LogIn, Clock } from 'lucide-react';
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

// ── Session Expired Modal ─────────────────────────────────────────────────────
// Rendered when the interceptor in api.ts dispatches a 'session-expired' event.
// Blocks the entire UI with a clear, non-dismissable overlay and prompts the
// user to log in again. Uses React Router navigation — no hard page reload.
const SessionExpiredModal: React.FC = () => {
  const sessionExpired = useStore((s) => s.sessionExpired);
  const setSessionExpired = useStore((s) => s.setSessionExpired);
  const navigate = useNavigate();

  if (!sessionExpired) return null;

  const handleLoginAgain = () => {
    setSessionExpired(false);
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-orange-500" />
        </div>

        {/* Message */}
        <h2 id="session-expired-title" className="text-xl font-bold text-gray-900 mb-2">
          Session Expired
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your session has timed out. Please log in again to continue — your work
          on this page remains in place until you do.
        </p>

        {/* CTA */}
        <button
          id="session-expired-login-btn"
          onClick={handleLoginAgain}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <LogIn size={16} />
          Log in again
        </button>
      </div>
    </div>
  );
};

// ── Session Expired Event Listener ────────────────────────────────────────────
// Mounted once at the app root. Listens for the CustomEvent fired by api.ts
// when both the access token and refresh token are no longer valid.
const SessionExpiredListener: React.FC = () => {
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const setSessionExpired = useStore((s) => s.setSessionExpired);

  useEffect(() => {
    const handler = () => {
      // Clear user from store — ProtectedRoute will block any navigation attempts.
      setCurrentUser(null);
      // Show the persistent modal (not the 1.5s auto-dismiss toast).
      setSessionExpired(true);
    };

    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, [setCurrentUser, setSessionExpired]);

  return null;
};

// ── Inactivity Auto-Logout ────────────────────────────────────────────────────
// Tracks user activity (mouse, keyboard, touch, scroll). If no activity is
// detected for INACTIVITY_TIMEOUT_MS the same 'session-expired' CustomEvent
// is fired so the existing modal + redirect flow handles the logout gracefully.
// The timer only runs when a user is logged in.
//
// Activity events counted:
//   mousemove, mousedown, keydown, touchstart, scroll
//
// NOTE FOR TESTING: Temporarily lower INACTIVITY_TIMEOUT_MS to e.g. 30_000 (30s),
// confirm the modal fires, then restore to 15 * 60 * 1000 before committing.
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const InactivityTimer: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    // Only run the timer when someone is logged in
    if (!currentUser) return;

    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Fire the same event the token interceptor fires — reuses the
        // existing SessionExpiredListener → modal → login redirect flow.
        window.dispatchEvent(new CustomEvent('session-expired'));
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Events that count as "activity"
    const events: string[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    // Start the timer immediately on mount / user change
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [currentUser]);

  return null;
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const currentUser = useStore((s) => s.currentUser);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthGate>
        <SessionExpiredListener />
        <InactivityTimer />
        <SessionExpiredModal />
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
          <Route path="/admin/retailers/:id" element={<ProtectedRoute requiredRole="admin"><RetailerDetailPage /></ProtectedRoute>} />
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
