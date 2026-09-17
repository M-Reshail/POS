import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, Truck, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { authService } from '../../services/auth';
import loginBg from '../../assets/login-bg.jpg';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter your username.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);

    try {
      const { accessToken, user } = await authService.login(username.trim().toLowerCase(), password);
      localStorage.setItem('accessToken', accessToken);
      setCurrentUser(user);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/worker/sales');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your username and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden flex items-center justify-center lg:justify-end bg-[#071324] select-none">
      {/* Background image positioned to preserve warehouse truck on left/center across all viewports */}
      <img
        src={loginBg}
        alt="Warehouse Background"
        className="absolute inset-0 w-full h-full object-cover object-left md:object-[25%_center] lg:object-center pointer-events-none"
      />

      {/* Subtle ambient overlays for readability without obstructing background graphics */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/35 via-slate-950/15 to-slate-950/65 pointer-events-none" />
      <div className="absolute inset-0 bg-slate-950/25 md:bg-transparent pointer-events-none" />

      {/* Right-aligned overlay card container */}
      <div className="relative z-10 w-full max-w-[440px] px-4 sm:px-6 lg:px-0 lg:mr-16 xl:mr-28 py-8 sm:py-12 my-auto flex justify-center">
        <div className="w-full max-w-[420px] sm:w-[420px] bg-[#0a2341]/65 backdrop-blur-[16px] border border-[rgba(150,180,210,0.35)] rounded-[22px] p-7 sm:p-9 shadow-2xl shadow-slate-950/80 animate-card-slide-up">
          
          {/* Header section */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-3.5 text-amber-400 shadow-inner">
              <Truck className="w-6 h-6 text-amber-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              ABDUL HAQ
            </h1>
            
          </div>


          {/* Error notice */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs sm:text-sm text-center font-medium shadow-sm">
              {error}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-4.5">
            {/* Username field */}
            <div>
              <label htmlFor="username-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  id="username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  required
                  className="w-full h-[50px] pl-11 pr-4 bg-[#071426]/70 border border-[rgba(150,180,210,0.30)] rounded-xl text-slate-100 placeholder-slate-400/70 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all text-sm font-medium"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  className="w-full h-[50px] pl-11 pr-11 bg-[#071426]/70 border border-[rgba(150,180,210,0.30)] rounded-xl text-slate-100 placeholder-slate-400/70 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Primary Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] mt-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[#0b1d3a] font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 text-sm sm:text-base cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#0b1d3a]" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight className="w-5 h-5 text-[#0b1d3a]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


