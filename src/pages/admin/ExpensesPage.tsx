import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import { expensesService } from '../../services/expenses';
import { Plus, Trash2, X, FileText } from 'lucide-react';
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
  fuel: '#f59e0b',
  salary: '#3b82f6',
  delivery: '#10b981',
  electricity: '#8b5cf6',
  maintenance: '#ef4444',
  other: '#6b7280',
};

const CATEGORIES: ExpenseCategory[] = ['fuel', 'salary', 'delivery', 'electricity', 'maintenance', 'other'];

type PeriodTab = 'today' | 'week' | 'month';

export const ExpensesPage: React.FC = () => {
  const store = useStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{
    today: number; week: number; month: number;
    categoryBreakdown: { category: ExpenseCategory; total: number; count: number }[];
  } | null>(null);
  const [period, setPeriod] = useState<PeriodTab>('today');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    title: 'Fuel', amount: '', category: 'fuel' as ExpenseCategory, description: '', date: new Date().toISOString().split('T')[0],
  });
  const [addError, setAddError] = useState('');

  // Table filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | ''>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let dateFrom: string;
      const dateTo = now.toISOString().split('T')[0];

      if (period === 'today') {
        dateFrom = dateTo;
      } else if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        dateFrom = d.toISOString().split('T')[0];
      } else {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      }

      const [expensesRes, summaryRes] = await Promise.all([
        expensesService.getAll({ dateFrom, dateTo }),
        expensesService.getSummary(),
      ]);
      setExpenses(expensesRes.expenses);
      setSummary(summaryRes);
    } catch {
      store.addNotification('error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [period]);

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
      loadData();
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
      loadData();
    } catch {
      store.addNotification('error', 'Failed to delete expense');
    }
  };

  // Client-side filtered expense list for the table
  const filteredExpenses = expenses.filter((e) => {
    const eDate = new Date(e.date).toISOString().split('T')[0];
    const matchFrom = !filterDateFrom || eDate >= filterDateFrom;
    const matchTo = !filterDateTo || eDate <= filterDateTo;
    const matchCat = !filterCategory || e.category === filterCategory;
    return matchFrom && matchTo && matchCat;
  });

  const chartData = summary?.categoryBreakdown.map((c) => ({
    name: CATEGORY_LABELS[c.category],
    total: c.total,
    fill: CATEGORY_COLORS[c.category],
  })) || [];

  const PERIOD_LABELS: Record<PeriodTab, string> = { today: "Today", week: "This Week", month: "This Month" };

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expense Tracking</h1>
            <p className="text-sm text-gray-500 mt-0.5">Daily business expense management</p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} className="mr-1" /> Add Expense
          </Button>
        </div>

        {/* Summary KPI Cards — clickable with selected state */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {([['today', 'Today', 'blue'], ['week', 'This Week', 'purple'], ['month', 'This Month', 'green']] as [PeriodTab, string, string][]).map(([key, label, color]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer select-none ${
                period === key
                  ? `border-${color}-500 bg-${color}-50 ring-2 ring-${color}-200 scale-[1.02] shadow-sm`
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm hover:scale-[1.01]'
              }`}
            >
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${
                period === key ? `text-${color}-700` : 'text-gray-900'
              }`}>
                ₨{summary ? (key === 'today' ? summary.today : key === 'week' ? summary.week : summary.month).toFixed(0) : '—'}
              </p>
              {period === key && (
                <p className="text-xs mt-1 font-semibold" style={{ color: `var(--tw-${color})` }}>● Selected</p>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {/* Category Breakdown Chart */}
          <Card title={`Monthly Breakdown by Category`} className="lg:col-span-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </Card>

          {/* Pie Chart */}
          <Card title="Category Share">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
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
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </Card>
        </div>

        {/* Expense List */}
        <Card>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">
              {PERIOD_LABELS[period]} — {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}&nbsp;
              <span className="text-gray-500 font-normal">Total: ₨{filteredExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(0)}</span>
            </h3>
            {/* Inline filters */}
            <div className="flex flex-wrap gap-2 ml-auto items-center">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-400 focus:outline-none"
                title="From date"
              />
              <span className="text-xs text-gray-400">–</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-400 focus:outline-none"
                title="To date"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | '')}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              {(filterDateFrom || filterDateTo || filterCategory) && (
                <button
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterCategory(''); }}
                  className="text-xs text-blue-600 hover:underline"
                >Clear</button>
              )}
            </div>
          </div>
          {loading ? (
            <p className="text-center py-8 text-gray-400 text-sm">Loading...</p>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-10">
              <FileText size={40} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No expenses recorded for this period</p>
              <Button size="sm" className="mt-3" onClick={() => setShowAddModal(true)}>
                Add First Expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-xs">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Title</th>
                    <th className="text-left py-2 px-2">Category</th>
                    <th className="text-left py-2 px-2">Description</th>
                    <th className="text-left py-2 px-2">By</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-500 text-xs">{new Date(expense.date).toLocaleDateString()}</td>
                      <td className="py-2 px-2 font-medium text-gray-900">{expense.title}</td>
                      <td className="py-2 px-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: CATEGORY_COLORS[expense.category] + '20',
                            color: CATEGORY_COLORS[expense.category],
                          }}
                        >
                          {CATEGORY_LABELS[expense.category]}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-500 text-xs max-w-xs truncate">{expense.description || '—'}</td>
                      <td className="py-2 px-2 text-gray-500 text-xs">{expense.createdBy?.name || '—'}</td>
                      <td className="py-2 px-2 text-right font-bold text-gray-900">₨{Number(expense.amount).toFixed(0)}</td>
                      <td className="py-2 px-2">
                        <button onClick={() => handleDelete(expense.id)} className="text-red-400 hover:text-red-600">
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
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Add Expense</h3>
                <button onClick={() => setShowAddModal(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              {addError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{addError}</div>
              )}
              <div className="space-y-3">
                {/* Category first — auto-fills title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                          addForm.category === cat
                            ? 'text-white border-transparent'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                        style={addForm.category === cat ? { backgroundColor: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] } : {}}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title — auto-filled & hidden for non-Other categories */}
                {addForm.category === 'other' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={addForm.title}
                      onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Describe the expense..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Title <span className="text-xs text-gray-400 font-normal">(auto-filled)</span></label>
                    <div className="w-full text-sm border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-gray-600">
                      {addForm.title || CATEGORY_LABELS[addForm.category]}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₨) *</label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.amount}
                      onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={addForm.date}
                      onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional details..."
                    rows={2}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
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
