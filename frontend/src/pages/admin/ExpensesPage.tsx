import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button } from '../../components/common';
import { Card, Figure } from '../../components/ui/Card';
import { useStore } from '../../store';
import { expensesService } from '../../services/expenses';
import { Plus, Trash2, X, FileText, RotateCcw } from 'lucide-react';
import { Expense, ExpenseCategory } from '../../types';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: '⛽ Fuel',
  salary: '💼 Salary',
  delivery: '🚚 Delivery',
  electricity: '⚡ Electricity',
  maintenance: '🔧 Maintenance',
  other: '📌 Other',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  fuel: '#D9A63E',    // accent-500 — operational cost
  salary: '#5654E3',  // brand-600
  delivery: '#1F9D66', // success-500
  electricity: '#4D4CCC', // brand-700
  maintenance: '#DC3545', // danger-500
  other: '#8A93A3',   // ink-subtle
};

const CATEGORIES: ExpenseCategory[] = ['fuel', 'salary', 'delivery', 'electricity', 'maintenance', 'other'];

type PeriodTab = 'today' | 'week' | 'month' | null;

export const ExpensesPage: React.FC = () => {
  const store = useStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{
    today: number; week: number; month: number;
    categoryBreakdown: { category: ExpenseCategory; total: number; count: number }[];
  } | null>(null);

  // period is null by default so ALL historical expenses load initially
  const [period, setPeriod] = useState<PeriodTab>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    title: 'Fuel', amount: '', category: 'fuel' as ExpenseCategory, description: '', date: new Date().toISOString().split('T')[0],
  });
  const [addError, setAddError] = useState('');

  // Custom backend filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | ''>('');

  const fetchSummary = async () => {
    try {
      const summaryRes = await expensesService.getSummary();
      setSummary(summaryRes);
    } catch {
      console.error('Failed to fetch expense summary');
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let queryDateFrom: string | undefined = filterDateFrom || undefined;
      let queryDateTo: string | undefined = filterDateTo || undefined;

      // Calculate period preset range ONLY if period is selected AND no custom date inputs are entered
      if (period && !filterDateFrom && !filterDateTo) {
        const now = new Date();
        queryDateTo = now.toISOString().split('T')[0];

        if (period === 'today') {
          queryDateFrom = queryDateTo;
        } else if (period === 'week') {
          const d = new Date(now);
          d.setDate(d.getDate() - 6);
          queryDateFrom = d.toISOString().split('T')[0];
        } else if (period === 'month') {
          queryDateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        }
      }

      const queryParams: { dateFrom?: string; dateTo?: string; category?: ExpenseCategory } = {};
      if (queryDateFrom) queryParams.dateFrom = queryDateFrom;
      if (queryDateTo) queryParams.dateTo = queryDateTo;
      if (filterCategory) queryParams.category = filterCategory;

      const res = await expensesService.getAll(queryParams);
      setExpenses(res.expenses);
    } catch {
      store.addNotification('error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [period, filterDateFrom, filterDateTo, filterCategory]);

  const handlePeriodClick = (key: PeriodTab) => {
    if (period === key) {
      // Clicking an active card again deselects it -> back to All Expenses
      setPeriod(null);
    } else {
      setPeriod(key);
      setFilterDateFrom('');
      setFilterDateTo('');
    }
  };

  const handleDateFromChange = (val: string) => {
    setFilterDateFrom(val);
    if (period) setPeriod(null);
  };

  const handleDateToChange = (val: string) => {
    setFilterDateTo(val);
    if (period) setPeriod(null);
  };

  const handleClearFilters = () => {
    setPeriod(null);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterCategory('');
  };

  const handleCreate = async () => {
    setAddError('');
    const isOther = addForm.category === 'other';
    const resolvedTitle = isOther ? addForm.title : CATEGORY_LABELS[addForm.category];
    if (isOther && !addForm.title.trim()) {
      setAddError('Title is required for "Other" category.');
      return;
    }
    if (!addForm.amount) {
      setAddError('Amount is required.');
      return;
    }
    const amount = parseFloat(addForm.amount);
    if (isNaN(amount) || amount <= 0) {
      setAddError('Enter a valid positive amount.');
      return;
    }
    try {
      await expensesService.create({ ...addForm, title: resolvedTitle, amount });
      store.addNotification('success', 'Expense recorded');
      setShowAddModal(false);
      setAddForm({ title: 'Fuel', amount: '', category: 'fuel', description: '', date: new Date().toISOString().split('T')[0] });
      fetchSummary();
      fetchExpenses();
    } catch (err: any) {
      setAddError(err.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleCategoryChange = (cat: ExpenseCategory) => {
    const autoTitle = cat !== 'other' ? CATEGORY_LABELS[cat] : '';
    setAddForm((f) => ({ ...f, category: cat, title: autoTitle }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesService.delete(id);
      store.addNotification('success', 'Expense deleted');
      fetchSummary();
      fetchExpenses();
    } catch {
      store.addNotification('error', 'Failed to delete expense');
    }
  };

  const chartData = React.useMemo(() => {
    const breakdownMap: Record<ExpenseCategory, number> = {
      fuel: 0,
      salary: 0,
      delivery: 0,
      electricity: 0,
      maintenance: 0,
      other: 0,
    };

    expenses.forEach((e) => {
      if (breakdownMap[e.category] !== undefined) {
        breakdownMap[e.category] += Number(e.amount);
      }
    });

    return CATEGORIES.map((cat) => ({
      name: CATEGORY_LABELS[cat],
      category: cat,
      total: breakdownMap[cat],
      fill: CATEGORY_COLORS[cat],
    })).filter((item) => item.total > 0);
  }, [expenses]);

  const getChartTitle = () => {
    if (period === 'today') return "Today's Category Breakdown";
    if (period === 'week') return "This Week's Category Breakdown";
    if (period === 'month') return "This Month's Category Breakdown";
    if (filterDateFrom || filterDateTo || filterCategory) return 'Filtered Category Breakdown';
    return 'All-Time Category Breakdown';
  };

  const getTableTitle = () => {
    if (period === 'today') return "Today's Expenses";
    if (period === 'week') return "This Week's Expenses";
    if (period === 'month') return "This Month's Expenses";
    if (filterDateFrom || filterDateTo || filterCategory) return 'Filtered Expenses';
    return 'All Historical Expenses';
  };

  const hasActiveFilters = period !== null || Boolean(filterDateFrom) || Boolean(filterDateTo) || Boolean(filterCategory);

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Expense Tracking</h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">Daily business expense management</p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto justify-center text-xs sm:text-sm py-2 px-3">
            <Plus size={16} className="mr-1" /> Add Expense
          </Button>
        </div>

        {/* Summary KPI Cards header bar with Show All action */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Quick Period Presets</p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              Show All Expenses
            </button>
          )}
        </div>

        {/* Summary KPI Cards — clickable with selected toggle state */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
          {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']] as [NonNullable<PeriodTab>, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handlePeriodClick(key)}
              className={`p-2.5 sm:p-4 rounded-card border-2 text-left transition-all cursor-pointer select-none ${
                period === key
                  ? 'border-brand-600 bg-brand-900/5 ring-2 ring-brand-600/20 scale-[1.02] shadow-sm'
                  : 'border-border bg-surface-card hover:border-border-strong hover:shadow-sm hover:scale-[1.01]'
              }`}
              title={period === key ? 'Click again to deselect & show all expenses' : `Filter table for ${label}`}
            >
              <p className="text-[10px] sm:text-xs text-ink-muted font-medium">{label}</p>
              <p className={`text-base sm:text-2xl font-bold mt-0.5 sm:mt-1 ${period === key ? 'text-brand-700' : 'text-ink'}`}>
                ₨<Figure>{summary ? (key === 'today' ? summary.today : key === 'week' ? summary.week : summary.month).toFixed(0) : '—'}</Figure>
              </p>
              {period === key ? (
                <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-semibold text-brand-600 flex items-center gap-1">
                  ● Filtered (click to reset)
                </p>
              ) : (
                <p className="text-[10px] sm:text-xs text-ink-subtle mt-0.5 sm:mt-1">Click to filter</p>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {/* Category Breakdown Chart */}
          <Card variant="default" className="lg:col-span-2">
            <h3 className="text-sm font-bold text-ink mb-3">{getChartTitle()}</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any) => [`₨${Number(v).toFixed(0)}`, 'Amount']} />
                  <Bar dataKey="total">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-ink-subtle text-sm">No data yet</div>
            )}
          </Card>

          {/* Pie Chart */}
          <Card variant="default">
            <h3 className="text-sm font-bold text-ink mb-3">Category Share</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    label={({ percent }) => (percent && percent >= 0.03 ? `${(percent * 100).toFixed(0)}%` : '')}
                    labelLine={false}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₨${Number(v).toFixed(0)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-ink-subtle text-sm">No data yet</div>
            )}
          </Card>
        </div>

        {/* Expense List */}
        <Card variant="default">
          <div className="flex flex-wrap items-center gap-3 mb-4 border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-ink text-base">
                {getTableTitle()}
              </h3>
              <p className="text-xs text-ink-muted font-medium">
                {expenses.length} record{expenses.length !== 1 ? 's' : ''} &bull; Total: <span className="font-bold text-ink">₨<Figure>{expenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}</Figure></span>
              </p>
            </div>

            {/* Backend Query Filters */}
            <div className="flex flex-wrap gap-2 ml-auto items-center">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-accent-500 focus:outline-none bg-surface-card text-ink font-medium"
                title="From date filter"
              />
              <span className="text-xs text-ink-subtle font-bold">–</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-accent-500 focus:outline-none bg-surface-card text-ink font-medium"
                title="To date filter"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | '')}
                className="text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-accent-500 focus:outline-none bg-surface-card text-ink font-medium"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-brand-600 hover:text-brand-700 hover:underline font-semibold px-2 py-1 bg-surface-muted border border-border rounded-control transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-ink-muted text-sm font-medium">Fetching expense records from backend…</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-card bg-surface-muted flex items-center justify-center">
                <FileText size={22} className="text-ink-subtle" />
              </div>
              <p className="text-ink-muted text-sm font-medium">No expenses match the current filter.</p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-brand-600 hover:underline font-medium"
                >
                  Clear filters to show all history
                </button>
              )}
              <Button size="sm" className="mt-1" onClick={() => setShowAddModal(true)}>
                Add Expense
              </Button>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card">
              <table className="w-full text-xs text-left min-w-[540px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-surface-muted text-ink-subtle uppercase border-b-2 border-border-strong font-bold tracking-wider text-[11px]">
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3">Date</th>
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3">Title</th>
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3">Category</th>
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3">Description</th>
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3">By</th>
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3 text-right">Amount</th>
                    <th className="sticky top-0 z-20 bg-surface-muted py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface-card">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-border hover:bg-surface-muted/50 transition-colors">
                      <td className="py-3 px-3 text-ink-muted font-medium whitespace-nowrap">
                        {new Date(expense.date).toLocaleDateString('en-PK', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-3 font-bold text-ink">{expense.title}</td>
                      <td className="py-3 px-3">
                        <span
                          className="px-2 py-0.5 rounded-control text-[11px] font-bold border"
                          style={{
                            backgroundColor: CATEGORY_COLORS[expense.category] + '20',
                            borderColor: CATEGORY_COLORS[expense.category] + '40',
                            color: CATEGORY_COLORS[expense.category],
                          }}
                        >
                          {CATEGORY_LABELS[expense.category]}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-ink-muted max-w-xs truncate">{expense.description || '—'}</td>
                      <td className="py-3 px-3 text-ink-muted font-medium">{expense.createdBy?.name || '—'}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-ink">₨<Figure>{Number(expense.amount).toLocaleString('en-PK', { minimumFractionDigits: 0 })}</Figure></td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handleDelete(expense.id)} className="text-danger-500 hover:text-danger-600 p-1 rounded-control hover:bg-danger-50 transition-colors" title="Delete Expense">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add Expense Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-start justify-center z-[9999] p-3 sm:p-4 pt-6 sm:pt-10 md:pt-12 overflow-y-auto backdrop-blur-xs"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-surface-card rounded-hero border border-border shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[85vh] flex flex-col overflow-hidden animate-card-slide-up relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-border flex-shrink-0">
                <h3 className="text-base sm:text-lg font-bold text-ink">Add Expense</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-control hover:bg-surface-muted transition-colors text-ink-subtle hover:text-ink cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              {addError && (
                <div className="mb-3 p-2.5 bg-danger-50 border border-danger-500/30 rounded-control text-xs text-danger-500 font-medium flex-shrink-0">{addError}</div>
              )}
              <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Category</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`py-1.5 text-xs font-semibold rounded-control border-2 transition-all cursor-pointer ${
                          addForm.category === cat
                            ? 'text-white border-transparent shadow-sm'
                            : 'border-border text-ink-muted hover:border-border-strong'
                        }`}
                        style={addForm.category === cat ? { backgroundColor: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] } : {}}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {addForm.category === 'other' ? (
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Title <span className="text-danger-500">*</span></label>
                    <input
                      type="text"
                      value={addForm.title}
                      onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Describe the expense..."
                      className="input-field text-xs sm:text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Title <span className="text-xs text-ink-subtle font-normal">(auto-filled)</span></label>
                    <div className="input-field text-xs sm:text-sm text-ink-muted bg-surface-muted font-medium py-1.5">
                      {addForm.title || CATEGORY_LABELS[addForm.category]}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Amount (₨) *</label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.amount}
                      onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      className="input-field text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Date</label>
                    <input
                      type="date"
                      value={addForm.date}
                      onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                      className="input-field text-xs sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Description</label>
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional details..."
                    rows={2}
                    className="input-field text-xs sm:text-sm resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border flex-shrink-0">
                <Button onClick={handleCreate} className="flex-1">Save Expense</Button>
                <Button variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
