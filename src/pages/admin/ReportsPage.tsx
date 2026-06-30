import React, { useState, useEffect, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Card } from '../../components/common';
import { useStore } from '../../store';
import { expensesService } from '../../services/expenses';
import { ArrowUpRight, ArrowDownRight, Package, TrendingUp, DollarSign } from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

type RangeType = '7d' | '30d' | '90d';

export const ReportsPage: React.FC = () => {
  const { bills, retailers, products, fetchInitialData } = useStore();
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [range, setRange] = useState<RangeType>('30d');

  useEffect(() => {
    fetchInitialData();
    expensesService.getSummary().then(setExpenseSummary).catch(() => {});
  }, []);

  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - rangeDays);

  const filteredBills = useMemo(
    () => bills.filter((b) => new Date(b.createdAt) >= rangeStart),
    [bills, range]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalRevenue = filteredBills.reduce((s, b) => s + Number(b.total), 0);
  const totalPaid = filteredBills.reduce((s, b) => s + Number(b.paidAmount), 0);
  const totalPending = filteredBills.reduce((s, b) => s + Number(b.pendingAmount), 0);
  const totalDiscount = filteredBills.reduce((s, b) => s + Number(b.discount || 0), 0);
  const totalPET = filteredBills.reduce((s, b) => s + b.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const monthlyExpenses = expenseSummary?.month || 0;
  const netProfit = totalRevenue - monthlyExpenses;

  // ── Daily Sales Chart ─────────────────────────────────────────────────────────
  const dailySalesData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; bills: number; paid: number }>();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      map.set(key, { date: label, revenue: 0, bills: 0, paid: 0 });
    }
    filteredBills.forEach((b) => {
      const key = new Date(b.createdAt).toISOString().split('T')[0];
      const existing = map.get(key);
      if (existing) {
        existing.revenue += Number(b.total);
        existing.bills += 1;
        existing.paid += Number(b.paidAmount);
      }
    });
    return Array.from(map.values());
  }, [filteredBills, range]);

  // ── Revenue by Product ────────────────────────────────────────────────────────
  const productRevenueData = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; sold: number }>();
    filteredBills.forEach((b) =>
      b.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        const name = product ? `${product.brand} ${product.variant}` : item.productId.slice(0, 10);
        const existing = map.get(item.productId) || { name, revenue: 0, sold: 0 };
        existing.revenue += Number(item.total);
        existing.sold += item.quantity;
        map.set(item.productId, existing);
      })
    );
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredBills, products]);

  // ── Revenue by Worker ─────────────────────────────────────────────────────────
  const workerRevenueData = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; bills: number; discount: number }>();
    filteredBills.forEach((b) => {
      const workerName = (b as any).worker?.name || b.workerId.slice(0, 8);
      const existing = map.get(b.workerId) || { name: workerName, revenue: 0, bills: 0, discount: 0 };
      existing.revenue += Number(b.total);
      existing.bills += 1;
      existing.discount += Number(b.discount || 0);
      map.set(b.workerId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredBills]);

  // ── Revenue by Retailer ───────────────────────────────────────────────────────
  const retailerRevenueData = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; outstanding: number }>();
    filteredBills.forEach((b) => {
      const retailer = retailers.find((r) => r.id === b.retailerId);
      const name = retailer?.shopName || b.retailerId.slice(0, 10);
      const existing = map.get(b.retailerId) || { name, revenue: 0, outstanding: 0 };
      existing.revenue += Number(b.total);
      existing.outstanding += Number(b.pendingAmount);
      map.set(b.retailerId, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredBills, retailers]);

  // ── Status breakdown pie ─────────────────────────────────────────────────────
  const statusPieData = useMemo(() => {
    const paid = filteredBills.filter((b) => b.status === 'paid').length;
    const pending = filteredBills.filter((b) => b.status === 'pending').length;
    const partial = filteredBills.filter((b) => b.status === 'partial').length;
    return [
      { name: 'Paid', value: paid, color: '#10b981' },
      { name: 'Pending', value: pending, color: '#f59e0b' },
      { name: 'Partial', value: partial, color: '#3b82f6' },
    ].filter((d) => d.value > 0);
  }, [filteredBills]);

  const KPI = ({
    label, value, subValue, color, icon,
  }: {
    label: string; value: string; subValue?: string; color: string; icon: React.ReactNode;
  }) => (
    <Card className={`border-l-4 border-${color}-500`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 text-${color}-700`}>{value}</p>
          {subValue && <p className="text-xs text-gray-400 mt-0.5">{subValue}</p>}
        </div>
        <div className={`text-${color}-400 opacity-60`}>{icon}</div>
      </div>
    </Card>
  );

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Header + Range */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">Business performance insights</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as RangeType[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <KPI label="Total Revenue" value={`₨${(totalRevenue / 1000).toFixed(1)}K`} color="blue" icon={<TrendingUp size={22} />} />
          <KPI label="Total Paid" value={`₨${(totalPaid / 1000).toFixed(1)}K`} color="green" icon={<DollarSign size={22} />} />
          <KPI label="Outstanding" value={`₨${(totalPending / 1000).toFixed(1)}K`} color="orange" icon={<ArrowDownRight size={22} />} />
          <KPI label="Expenses (Month)" value={`₨${(monthlyExpenses / 1000).toFixed(1)}K`} color="red" icon={<ArrowDownRight size={22} />} />
          <KPI label="Net Profit" value={`₨${(netProfit / 1000).toFixed(1)}K`} color="purple" icon={<ArrowUpRight size={22} />} />
          <KPI label="PET Sold" value={totalPET.toLocaleString()} color="teal" icon={<Package size={22} />} />
        </div>

        {/* Row 2: Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Card>
            <p className="text-xs text-gray-500">Total Bills</p>
            <p className="text-xl font-bold">{filteredBills.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Avg Bill Value</p>
            <p className="text-xl font-bold">₨{filteredBills.length > 0 ? (totalRevenue / filteredBills.length).toFixed(0) : 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Total Discounts</p>
            <p className="text-xl font-bold text-purple-600">₨{(totalDiscount / 1000).toFixed(1)}K</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Collection Rate</p>
            <p className="text-xl font-bold text-green-600">
              {totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(0) : 0}%
            </p>
          </Card>
        </div>

        {/* Daily Sales Area Chart */}
        <Card title={`Daily Revenue — Last ${rangeDays} Days`} className="mb-5">
          {dailySalesData.some((d) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(rangeDays / 7)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => `₨${Number(v).toFixed(0)}`} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="paid" name="Paid" stroke="#10b981" fill="url(#paidGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No bill data for this period</div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Revenue by Product */}
          <Card title="Revenue by Product">
            {productRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productRevenueData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v: any) => [`₨${Number(v).toFixed(0)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
            )}
          </Card>

          {/* Revenue by Worker */}
          <Card title="Revenue by Worker">
            {workerRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workerRevenueData} margin={{ top: 5, right: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any, name: any) => [`₨${Number(v).toFixed(0)}`, name === 'revenue' ? 'Revenue' : 'Discount']} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="discount" name="Discounts" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Retailer Revenue */}
          <Card title="Top Retailers by Revenue">
            {retailerRevenueData.length > 0 ? (
              <div className="space-y-2">
                {retailerRevenueData.map((r, idx) => {
                  const maxRev = retailerRevenueData[0].revenue;
                  return (
                    <div key={r.name} className="flex items-center gap-2">
                      <span className="w-5 text-xs text-gray-400 font-bold">{idx + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium text-gray-800">{r.name}</span>
                          <span className="text-gray-500">₨{(r.revenue / 1000).toFixed(1)}K</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(r.revenue / maxRev) * 100}%` }}
                          />
                        </div>
                        {r.outstanding > 0 && (
                          <p className="text-xs text-orange-500 mt-0.5">Outstanding: ₨{(r.outstanding / 1000).toFixed(1)}K</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
            )}
          </Card>

          {/* Bill Status Pie */}
          <Card title="Bill Status Breakdown">
            {statusPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {statusPieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-700">{item.name}</p>
                        <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No bill data</div>
            )}
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
};
