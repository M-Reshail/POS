/**
 * Shared sidebar navigation constants.
 * Import these in every page so the sidebar is always consistent.
 */
import { BarChart3, Users, Package, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react';

export const ADMIN_SIDEBAR = [
  { label: 'Dashboard',   icon: <BarChart3 size={18} />,    path: '/admin/dashboard' },
  { label: 'Create Sale', icon: <ShoppingCart size={18} />, path: '/worker/sales' },
  { label: 'Inventory',   icon: <Package size={18} />,      path: '/admin/inventory' },
  { label: 'Retailers',   icon: <Users size={18} />,        path: '/admin/retailers' },
  { label: 'Workers',     icon: <Users size={18} />,        path: '/admin/workers' },
  { label: 'Expenses',    icon: <DollarSign size={18} />,   path: '/admin/expenses' },
  { label: 'Bills',       icon: <ShoppingCart size={18} />, path: '/admin/bills' },
  { label: 'Reports',     icon: <TrendingUp size={18} />,   path: '/admin/reports' },
];

export const WORKER_SIDEBAR = [
  { label: 'Create Sale', icon: <ShoppingCart size={18} />, path: '/worker/sales' },
  { label: 'Retailers',   icon: <Users size={18} />,        path: '/worker/retailers' },
];
