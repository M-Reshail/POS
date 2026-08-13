import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useStore } from '../../store';
import { authService } from '../../services/auth';

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface LayoutProps {
  children: React.ReactNode;
  sidebarItems: SidebarItem[];
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebarItems }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const currentUser = useStore((state) => state.currentUser);
  const setCurrentUser = useStore((state) => state.setCurrentUser);

  const handleLogout = async () => {
    try {
      // Call the backend logout endpoint to clear the httpOnly refresh-token cookie.
      // Without this the cookie persists in the browser even after clearing localStorage.
      await authService.logout();
    } catch {
      // If the network call fails, still clear local state so the user
      // isn't stuck on a broken session.
    } finally {
      localStorage.removeItem('accessToken');
      setCurrentUser(null);
      navigate('/login', { replace: true });
    }
  };

  // Close mobile menu when route changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Hidden on mobile, visible on larger screens */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col hidden md:flex`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold">AbdulHaq</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600'
                  : 'hover:bg-gray-800'
              }`}
            >
              {item.icon}
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>
        
        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          {sidebarOpen && (
            <div className="mb-3">
              <p className="text-sm text-gray-400">Logged in as</p>
              <p className="text-sm font-medium truncate">{currentUser?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{currentUser?.role}</p>
            </div>
          )}
          {/* Shift-end reminder — visible only when sidebar is expanded */}
          {sidebarOpen && (
            <p className="text-xs text-yellow-400 mb-2 leading-snug">
              Leaving your shift? Log out so noone can use your account.
            </p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-gray-900 text-white transition-transform duration-300 z-50 md:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">AbdulHaq</h1>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600'
                  : 'hover:bg-gray-800'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>
        
        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <div className="mb-3">
            <p className="text-sm text-gray-400">Logged in as</p>
            <p className="text-sm font-medium truncate">{currentUser?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{currentUser?.role}</p>
          </div>
          {/* Shift-end reminder */}
          <p className="text-xs text-yellow-400 mb-2 leading-snug">
            Leaving your shift? Log out so the next person can't use your account.
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 shadow-sm flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 truncate">
            {sidebarItems.find((item) => item.path === location.pathname)?.label}
          </h2>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
};

export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3 sm:p-4 md:p-6 animate-page-fade">{children}</div>
);
