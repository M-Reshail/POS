import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { authService } from '../../services/auth';
import { Input, Button, Card } from '../../components/common';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock users removed; using API

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { accessToken, user } = await authService.login(email, password);
      localStorage.setItem('accessToken', accessToken);
      setCurrentUser(user);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/worker/sales');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-center text-gray-900">Beverage POS</h1>
          <p className="text-center text-gray-600 mt-2">Wholesale & Retail Management</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="admin@gmail.com or worker@gmail.com"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>

          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            <p className="font-medium mb-2">Demo Credentials:</p>
            <p>Admin: admin@gmail.com / admin</p>
            <p>Worker: worker@gmail.com / worker</p>
          </div>
        </form>
      </Card>
    </div>
  );
};
