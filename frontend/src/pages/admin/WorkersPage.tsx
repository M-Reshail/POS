import React, { useState, useEffect, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, ReorderableTh, ColumnManagerModal } from '../../components/common';
import { Card, StatIcon, Figure } from '../../components/ui/Card';
import { useStore } from '../../store';
import { workersService } from '../../services/workers';
import { Eye, EyeOff, X, Lock, CheckCircle, XCircle, Users, Plus, TrendingUp, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Worker } from '../../types';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { useReorderableColumns, ColumnConfig } from '../../hooks/useReorderableColumns';

type WorkerColumnId = 'name' | 'email' | 'phone' | 'bills' | 'revenue' | 'outstanding' | 'status' | 'actions';

const DEFAULT_WORKER_COLUMNS: ColumnConfig<WorkerColumnId>[] = [
  { id: 'name', label: 'Name', align: 'left', sortable: true, minWidth: '140px' },
  { id: 'email', label: 'Email', align: 'left', sortable: true, minWidth: '150px' },
  { id: 'phone', label: 'Phone', align: 'left', sortable: true, minWidth: '120px' },
  { id: 'bills', label: 'Bills', align: 'center', sortable: true, minWidth: '90px' },
  { id: 'revenue', label: 'Revenue', align: 'right', sortable: true, minWidth: '110px' },
  { id: 'outstanding', label: 'Outstanding', align: 'right', sortable: true, minWidth: '120px' },
  { id: 'status', label: 'Status', align: 'center', sortable: true, minWidth: '100px' },
  { id: 'actions', label: 'Actions', align: 'center', sortable: false, reorderable: false, minWidth: '140px' },
];

export const WorkersPage: React.FC = () => {
  const store = useStore();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);

  // ── Column Reordering & Sorting Hook ───────────────────────────────────────
  const {
    columns,
    sortField,
    sortDirection,
    draggedColumnId,
    dragOverColumnId,
    dropPosition,
    isCustomOrder,
    handleSort,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    moveColumn,
    resetColumns,
  } = useReorderableColumns<WorkerColumnId>({
    storageKey: 'pos_workers_table_columns_order',
    defaultColumns: DEFAULT_WORKER_COLUMNS,
  });

  // Sort workers based on active column and direction
  const sortedWorkers = useMemo(() => {
    if (!sortField || !sortDirection) return workers;

    return [...workers].sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortField) {
        case 'name':
          valA = a.name ? a.name.toLowerCase() : null;
          valB = b.name ? b.name.toLowerCase() : null;
          break;
        case 'email':
          valA = a.email ? a.email.toLowerCase() : null;
          valB = b.email ? b.email.toLowerCase() : null;
          break;
        case 'phone':
          valA = a.phone ? a.phone.toLowerCase() : null;
          valB = b.phone ? b.phone.toLowerCase() : null;
          break;
        case 'bills':
          valA = a.totalBills != null && !isNaN(Number(a.totalBills)) ? Number(a.totalBills) : null;
          valB = b.totalBills != null && !isNaN(Number(b.totalBills)) ? Number(b.totalBills) : null;
          break;
        case 'revenue':
          valA = a.totalRevenue != null && !isNaN(Number(a.totalRevenue)) ? Number(a.totalRevenue) : null;
          valB = b.totalRevenue != null && !isNaN(Number(b.totalRevenue)) ? Number(b.totalRevenue) : null;
          break;
        case 'outstanding':
          valA = a.totalPending != null && !isNaN(Number(a.totalPending)) ? Number(a.totalPending) : null;
          valB = b.totalPending != null && !isNaN(Number(b.totalPending)) ? Number(b.totalPending) : null;
          break;
        case 'status':
          valA = a.isActive !== undefined ? (a.isActive ? 1 : 0) : null;
          valB = b.isActive !== undefined ? (b.isActive ? 1 : 0) : null;
          break;
        default:
          return 0;
      }

      const isInvalid = (v: any) => v === null || v === undefined || (typeof v === 'number' && isNaN(v));
      if (isInvalid(valA)) {
        if (isInvalid(valB)) return 0;
        return 1;
      }
      if (isInvalid(valB)) {
        return -1;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [workers, sortField, sortDirection]);

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
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Worker Management</h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">Manage sales team accounts and performance</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto justify-center text-xs sm:text-sm py-2 px-3">
            <Plus size={16} className="mr-1" /> Add Worker
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <Card variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs text-ink-muted font-medium">Total Workers</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 text-ink">{workers.length}</p>
              </div>
              <div className="hidden sm:block">
                <StatIcon icon={<Users size={18} />} tone="brand" />
              </div>
            </div>
          </Card>

          <Card variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs text-ink-muted font-medium">Active</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 text-ink">{activeWorkers}</p>
              </div>
              <div className="hidden sm:block">
                <StatIcon icon={<CheckCircle size={18} />} tone="success" />
              </div>
            </div>
          </Card>

          <Card variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs text-ink-muted font-medium">Inactive</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 text-ink">{workers.length - activeWorkers}</p>
              </div>
              <div className="hidden sm:block">
                <StatIcon icon={<XCircle size={18} />} tone="danger" />
              </div>
            </div>
          </Card>

          <Card variant="stat">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs text-ink-muted font-medium">Total Revenue</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 text-ink">
                  ₨<Figure>{(totalRevenue / 1000).toFixed(0)}K</Figure>
                </p>
              </div>
              <div className="hidden sm:block">
                <StatIcon icon={<TrendingUp size={18} />} tone="brand" />
              </div>
            </div>
          </Card>
        </div>

        {/* Workers Table / Worker Profile */}
        {selectedWorker ? (
          // Worker Profile View
          <Card variant="default">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setSelectedWorker(null)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                ← Back to Workers
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-bold text-ink mb-1">{selectedWorker.name}</h2>
                <p className="text-sm text-ink-muted">{selectedWorker.email}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">CNIC</span>
                    <span className="text-ink">{selectedWorker.cnic || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Phone</span>
                    <span className="text-ink">{selectedWorker.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Joined</span>
                    <span className="text-ink">{selectedWorker.joinDate ? new Date(selectedWorker.joinDate).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted">Status</span>
                    <span className={`px-2.5 py-0.5 rounded-control text-xs font-bold ${
                      selectedWorker.isActive
                        ? 'bg-success-50 text-success-500 border border-success-500/30'
                        : 'bg-danger-50 text-danger-500 border border-danger-500/30'
                    }`}>
                      {selectedWorker.isActive ? 'Active' : 'Inactive'}
                    </span>
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

              {/* Worker Stat Tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-info-50 rounded-card border border-info-500/20">
                  <p className="text-xs text-info-500 font-medium">Total Bills</p>
                  <p className="text-xl font-bold text-ink mt-1">
                    <Figure>{selectedWorker.totalBills || 0}</Figure>
                  </p>
                </div>
                <div className="p-3 bg-success-50 rounded-card border border-success-500/20">
                  <p className="text-xs text-success-500 font-medium">Total Revenue</p>
                  <p className="text-xl font-bold text-ink mt-1">
                    ₨<Figure>{((selectedWorker.totalRevenue || 0) / 1000).toFixed(1)}K</Figure>
                  </p>
                </div>
                <div className="p-3 bg-surface-muted rounded-card border border-border">
                  <p className="text-xs text-ink-muted font-medium">Total Paid</p>
                  <p className="text-xl font-bold text-ink mt-1">
                    ₨<Figure>{((selectedWorker.totalPaid || 0) / 1000).toFixed(1)}K</Figure>
                  </p>
                </div>
                <div className="p-3 bg-warning-50 rounded-card border border-warning-500/20">
                  <p className="text-xs text-warning-500 font-medium">Outstanding</p>
                  <p className="text-xl font-bold text-ink mt-1">
                    ₨<Figure>{((selectedWorker.totalPending || 0) / 1000).toFixed(1)}K</Figure>
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card variant="default">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-ink">Workers</h3>
                <span className="text-[11px] text-ink-subtle hidden sm:inline font-medium">
                  (drag headers to reorder, click to sort)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsColumnManagerOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink font-semibold px-2.5 py-1 rounded-control bg-surface-muted hover:bg-border/40 border border-border transition-colors"
                  title="Manage table columns"
                >
                  <SlidersHorizontal size={12} />
                  <span>Columns</span>
                </button>

                {isCustomOrder && (
                  <button
                    type="button"
                    onClick={resetColumns}
                    className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink font-semibold px-2 py-1 rounded-control hover:bg-surface-muted transition-colors"
                    title="Reset column order to default"
                  >
                    <RotateCcw size={12} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-ink-muted">Loading workers...</div>
            ) : workers.length === 0 ? (
              /* Empty state — per DESIGN_TOKENS.md: no fixed min-height, show explicit empty state */
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-card bg-surface-muted flex items-center justify-center">
                  <Users size={22} className="text-ink-subtle" />
                </div>
                <p className="text-sm text-ink-muted font-medium">No workers added yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary text-xs"
                >
                  <Plus size={14} className="inline mr-1" /> Add Worker
                </button>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border-strong">
                      {columns.map((col) => (
                        <ReorderableTh
                          key={col.id}
                          column={col}
                          isDragging={draggedColumnId === col.id}
                          isDragOver={dragOverColumnId === col.id}
                          dropPosition={dropPosition}
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWorkers.map((worker) => (
                      <tr key={worker.id} className="border-b border-border hover:bg-surface-muted/50 transition-colors">
                        {columns.map((col) => {
                          switch (col.id) {
                            case 'name':
                              return (
                                <td key={col.id} className="py-2.5 px-3 font-medium text-ink">
                                  {worker.name}
                                </td>
                              );
                            case 'email':
                              return (
                                <td key={col.id} className="py-2.5 px-3 text-ink-muted">
                                  {worker.email}
                                </td>
                              );
                            case 'phone':
                              return (
                                <td key={col.id} className="py-2.5 px-3 text-ink-muted">
                                  {worker.phone || '—'}
                                </td>
                              );
                            case 'bills':
                              return (
                                <td key={col.id} className="py-2.5 px-3 text-center text-ink">
                                  <Figure>{worker.totalBills}</Figure>
                                </td>
                              );
                            case 'revenue':
                              return (
                                <td key={col.id} className="py-2.5 px-3 text-right font-semibold text-ink">
                                  ₨<Figure>{((worker.totalRevenue || 0) / 1000).toFixed(1)}K</Figure>
                                </td>
                              );
                            case 'outstanding':
                              return (
                                <td key={col.id} className="py-2.5 px-3 text-right text-warning-500 font-semibold">
                                  ₨<Figure>{((worker.totalPending || 0) / 1000).toFixed(1)}K</Figure>
                                </td>
                              );
                            case 'status':
                              return (
                                <td key={col.id} className="py-2.5 px-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-control text-[10px] font-bold ${
                                    worker.isActive
                                      ? 'bg-success-50 text-success-500 border border-success-500/30'
                                      : 'bg-danger-50 text-danger-500 border border-danger-500/30'
                                  }`}>
                                    {worker.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                              );
                            case 'actions':
                              return (
                                <td key={col.id} className="py-2.5 px-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setSelectedWorker(worker)}
                                      className="text-brand-600 hover:text-brand-700 text-xs font-semibold cursor-pointer"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => handleToggleStatus(worker)}
                                      className={`text-xs font-semibold cursor-pointer ${worker.isActive ? 'text-danger-500 hover:text-danger-600' : 'text-success-500 hover:text-success-600'}`}
                                    >
                                      {worker.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                      onClick={() => { setResetTarget(worker); setShowResetModal(true); }}
                                      className="text-ink-subtle hover:text-ink-muted cursor-pointer"
                                      title="Reset Password"
                                    >
                                      <Lock size={13} />
                                    </button>
                                  </div>
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Create Worker Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-surface-card rounded-hero shadow-xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-ink">Add Worker</h3>
                <button onClick={() => setShowCreateModal(false)}>
                  <X size={18} className="text-ink-subtle hover:text-ink" />
                </button>
              </div>
              {createError && (
                <div className="mb-3 p-3 bg-danger-50 border border-danger-500/30 rounded-control text-sm text-danger-500">
                  {createError}
                </div>
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
                    <label className="block text-xs font-semibold text-ink-muted mb-1">{label}</label>
                    <input
                      type={type}
                      value={createForm[key as keyof typeof createForm]}
                      onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="input-field text-sm"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className="input-field text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-ink-subtle hover:text-ink-muted"
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
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-surface-card rounded-hero shadow-xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-ink">Reset Password</h3>
                <button onClick={() => setShowResetModal(false)}>
                  <X size={18} className="text-ink-subtle hover:text-ink" />
                </button>
              </div>
              <p className="text-sm text-ink-muted mb-4">
                Setting new password for <strong className="text-ink">{resetTarget.name}</strong>
              </p>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 6 chars)"
                  className="input-field text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-ink-subtle hover:text-ink-muted"
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

        {/* Column Manager Modal (Mobile / Accessibility) */}
        <ColumnManagerModal
          isOpen={isColumnManagerOpen}
          onClose={() => setIsColumnManagerOpen(false)}
          columns={columns}
          moveColumn={moveColumn}
          resetColumns={resetColumns}
          isCustomOrder={isCustomOrder}
        />
      </PageContainer>
    </Layout>
  );
};
