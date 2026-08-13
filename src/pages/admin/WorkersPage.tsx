import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Badge } from '../../components/common';
import { useStore } from '../../store';
import { workersService } from '../../services/workers';
import { Eye, EyeOff, X, Lock, CheckCircle, XCircle, Users, Plus, TrendingUp } from 'lucide-react';
import { Worker } from '../../types';
import { ADMIN_SIDEBAR } from '../../constants/navigation';

export const WorkersPage: React.FC = () => {
  const store = useStore();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', cnic: '', phone: '', joinDate: '',
  });
  const [createError, setCreateError] = useState('');

  // Password reset modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<Worker | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const data = await workersService.getAll();
      setWorkers(data);
    } catch {
      store.addNotification('error', 'Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWorkers(); }, []);

  const handleCreate = async () => {
    setCreateError('');
    if (!createForm.name || !createForm.email || !createForm.password) {
      setCreateError('Name, email and password are required.');
      return;
    }
    try {
      await workersService.create(createForm);
      store.addNotification('success', `Worker ${createForm.name} created`);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', cnic: '', phone: '', joinDate: '' });
      loadWorkers();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create worker');
    }
  };

  const handleToggleStatus = async (worker: Worker) => {
    try {
      await workersService.update(worker.id, { isActive: !worker.isActive });
      store.addNotification('success', `${worker.name} ${worker.isActive ? 'disabled' : 'enabled'}`);
      loadWorkers();
    } catch {
      store.addNotification('error', 'Failed to update status');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword) return;
    try {
      await workersService.resetPassword(resetTarget.id, newPassword);
      store.addNotification('success', `Password reset for ${resetTarget.name}`);
      setShowResetModal(false);
      setNewPassword('');
      setResetTarget(null);
    } catch {
      store.addNotification('error', 'Failed to reset password');
    }
  };

  const totalRevenue = workers.reduce((s, w) => s + (w.totalRevenue || 0), 0);
  const activeWorkers = workers.filter((w) => w.isActive).length;

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Worker Management</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage sales team accounts and performance</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto justify-center text-xs sm:text-sm py-2 px-3">
            <Plus size={16} className="mr-1" /> Add Worker
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {[
            { label: 'Total Workers', value: workers.length, color: 'blue', icon: <Users size={20} /> },
            { label: 'Active', value: activeWorkers, color: 'green', icon: <CheckCircle size={20} /> },
            { label: 'Inactive', value: workers.length - activeWorkers, color: 'red', icon: <XCircle size={20} /> },
            { label: 'Total Revenue', value: `₨${(totalRevenue / 1000).toFixed(0)}K`, color: 'purple', icon: <TrendingUp size={20} /> },
          ].map(({ label, value, color, icon }) => (
            <Card key={label} className={`border-l-4 border-${color}-500 p-3 sm:p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-xs text-gray-500">{label}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">{value}</p>
                </div>
                <div className={`text-${color}-400 opacity-60 hidden sm:block`}>{icon}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Workers Table */}
        {selectedWorker ? (
          // Worker Profile View
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setSelectedWorker(null)} className="text-sm text-blue-600 hover:underline">
                ← Back to Workers
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedWorker.name}</h2>
                <p className="text-sm text-gray-500">{selectedWorker.email}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">CNIC</span><span>{selectedWorker.cnic || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{selectedWorker.phone || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Joined</span><span>{selectedWorker.joinDate ? new Date(selectedWorker.joinDate).toLocaleDateString() : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Status</span>
                    <Badge variant={selectedWorker.isActive ? 'success' : 'danger'}>
                      {selectedWorker.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <Button
                    size="sm"
                    variant={selectedWorker.isActive ? 'danger' : 'primary'}
                    onClick={() => handleToggleStatus(selectedWorker)}
                  >
                    {selectedWorker.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => { setResetTarget(selectedWorker); setShowResetModal(true); }}
                  >
                    <Lock size={14} className="mr-1" /> Reset Password
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Bills', value: selectedWorker.totalBills || 0, color: 'blue' },
                  { label: 'Total Revenue', value: `₨${((selectedWorker.totalRevenue || 0) / 1000).toFixed(1)}K`, color: 'green' },
                  { label: 'Total Paid', value: `₨${((selectedWorker.totalPaid || 0) / 1000).toFixed(1)}K`, color: 'purple' },
                  { label: 'Outstanding', value: `₨${((selectedWorker.totalPending || 0) / 1000).toFixed(1)}K`, color: 'orange' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-3 bg-${color}-50 rounded-lg border border-${color}-100`}>
                    <p className={`text-xs text-${color}-600 font-medium`}>{label}</p>
                    <p className={`text-xl font-bold text-${color}-700 mt-1`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-sm min-w-[620px]">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Email</th>
                    <th className="text-left py-2 px-3">Phone</th>
                    <th className="text-center py-2 px-3">Bills</th>
                    <th className="text-right py-2 px-3">Revenue</th>
                    <th className="text-right py-2 px-3">Outstanding</th>
                    <th className="text-center py-2 px-3">Status</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
                  ) : workers.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">No workers yet. Add your first worker!</td></tr>
                  ) : (
                    workers.map((worker) => (
                      <tr key={worker.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{worker.name}</td>
                        <td className="py-2.5 px-3 text-gray-500">{worker.email}</td>
                        <td className="py-2.5 px-3 text-gray-500">{worker.phone || '—'}</td>
                        <td className="py-2.5 px-3 text-center">{worker.totalBills}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">₨{((worker.totalRevenue || 0) / 1000).toFixed(1)}K</td>
                        <td className="py-2.5 px-3 text-right text-orange-600">₨{((worker.totalPending || 0) / 1000).toFixed(1)}K</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={worker.isActive ? 'success' : 'danger'}>
                            {worker.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedWorker(worker)}
                              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleToggleStatus(worker)}
                              className={`text-xs font-medium ${worker.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                            >
                              {worker.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => { setResetTarget(worker); setShowResetModal(true); }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Lock size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Create Worker Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Add Worker</h3>
                <button onClick={() => setShowCreateModal(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              {createError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>
              )}
              <div className="space-y-3">
                {[
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Ahmed Khan' },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'worker@example.com' },
                  { label: 'CNIC', key: 'cnic', type: 'text', placeholder: '12345-1234567-1' },
                  { label: 'Phone', key: 'phone', type: 'text', placeholder: '0300-1234567' },
                  { label: 'Join Date', key: 'joinDate', type: 'date', placeholder: '' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <input
                      type={type}
                      value={createForm[key as keyof typeof createForm]}
                      onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button onClick={handleCreate} className="flex-1">Create Worker</Button>
                <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetModal && resetTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
                <button onClick={() => setShowResetModal(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Setting new password for <strong>{resetTarget.name}</strong>
              </p>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 6 chars)"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-gray-400"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleResetPassword} className="flex-1">Reset Password</Button>
                <Button variant="secondary" onClick={() => setShowResetModal(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
