import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
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

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: 'admin' | 'worker' }> = ({
  children,
  requiredRole,
}) => {
  const currentUser = useStore((state) => state.currentUser);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && currentUser.role !== requiredRole && currentUser.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Notification Component
const Notifications: React.FC = () => {
  const notifications = useStore((state) => state.notifications);
  const removeNotification = useStore((state) => state.removeNotification);

  return (
    <div className="fixed top-4 right-4 space-y-2 z-50 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg text-white font-medium shadow-lg animate-fade-in ${
            notif.type === 'success'
              ? 'bg-green-600'
              : notif.type === 'error'
              ? 'bg-red-600'
              : notif.type === 'warning'
              ? 'bg-yellow-600'
              : 'bg-blue-600'
          }`}
        >
          <span>{notif.message}</span>
          <button
            onClick={() => removeNotification(notif.id)}
            className="hover:opacity-80"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const currentUser = useStore((state) => state.currentUser);

  useEffect(() => {
    // Auto-remove notifications after 5 seconds
    const timer = setInterval(() => {
      const notifications = useStore.getState().notifications;
      if (notifications.length > 0) {
        const firstNotif = notifications[0];
        setTimeout(() => {
          useStore.getState().removeNotification(firstNotif.id);
        }, 5000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Router>
      <Notifications />
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Worker Routes */}
        <Route path="/worker/sales" element={<ProtectedRoute requiredRole="worker"><SalesPage /></ProtectedRoute>} />
        <Route path="/worker/retailers" element={<ProtectedRoute requiredRole="worker"><WorkerRetailersPage /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/inventory" element={<ProtectedRoute requiredRole="admin"><InventoryPage /></ProtectedRoute>} />
        <Route path="/admin/retailers" element={<ProtectedRoute requiredRole="admin"><RetailersPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><ReportsPage /></ProtectedRoute>} />
        <Route path="/admin/workers" element={<ProtectedRoute requiredRole="admin"><WorkersPage /></ProtectedRoute>} />
        <Route path="/admin/expenses" element={<ProtectedRoute requiredRole="admin"><ExpensesPage /></ProtectedRoute>} />
        <Route path="/admin/bills" element={<ProtectedRoute requiredRole="admin"><AdminBillsPage /></ProtectedRoute>} />

        {/* Default */}
        <Route
          path="/"
          element={
            currentUser ? (
              currentUser.role === 'admin' ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/worker/sales" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
