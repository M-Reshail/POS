import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { User } from '../../types';
import { Input, Button, Card } from '../../components/common';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock users - in real app, this would be from an API
  const mockUsers: Record<string, { password: string; user: User }> = {
    'admin@pos.com': {
      password: 'admin123',
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@pos.com',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
      },
    },
    'worker@pos.com': {
      password: 'worker123',
      user: {
        id: '2',
        name: 'Shop Worker',
        email: 'worker@pos.com',
        role: 'worker',
        isActive: true,
        createdAt: new Date(),
      },
    },
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      const userRecord = mockUsers[email];
      if (userRecord && userRecord.password === password) {
        setCurrentUser(userRecord.user);
        navigate(userRecord.user.role === 'admin' ? '/admin/dashboard' : '/worker/sales');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
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
            placeholder="admin@pos.com or worker@pos.com"
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
            <p>Admin: admin@pos.com / admin123</p>
            <p>Worker: worker@pos.com / worker123</p>
          </div>
        </form>
      </Card>
    </div>
  );
};
