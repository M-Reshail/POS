import React, { useState, useEffect, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Card, Figure } from '../../components/ui/Card';
import { useStore } from '../../store';
import { expensesService } from '../../services/expenses';
import { ReceiptText } from 'lucide-react';
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
      { name: 'Paid', value: paid, color: '#1F9D66' },      // success-500
      { name: 'Pending', value: pending, color: '#D9A63E' }, // warning-500 / accent-500
      { name: 'Partial', value: partial, color: '#5654E3' }, // info-500 / brand-600
    ].filter((d) => d.value > 0);
  }, [filteredBills]);

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Header + Range */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Reports &amp; Analytics</h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">Business performance insights</p>
          </div>
          <div className="flex gap-1 bg-surface-muted rounded-card p-1 w-full sm:w-auto justify-center border border-border">
            {(['7d', '30d', '90d'] as RangeType[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-control transition-all text-center ${
                  range === r ? 'bg-surface-card text-ink shadow-sm border border-border' : 'text-ink-subtle hover:text-ink-muted'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Two Single Cards Layout (Financial Performance & Sales Statistics) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
          {/* Card 1: Financial Performance (Single Card with 6 Metrics in 1 Column) */}
          <Card variant="default" className="p-3 sm:p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border">
                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                  Financial Performance
                </span>
              </div>

              <div className="flex flex-col divide-y divide-border">
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Revenue</span>
                  <span className="text-xs sm:text-sm font-extrabold text-brand-700">
                    ₨<Figure>{(totalRevenue / 1000).toFixed(1)}K</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Paid</span>
                  <span className="text-xs sm:text-sm font-extrabold text-success-500">
                    ₨<Figure>{(totalPaid / 1000).toFixed(1)}K</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Outstanding</span>
                  <span className="text-xs sm:text-sm font-extrabold text-warning-500">
                    ₨<Figure>{(totalPending / 1000).toFixed(1)}K</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Expenses (Month)</span>
                  <span className="text-xs sm:text-sm font-extrabold text-danger-500">
                    ₨<Figure>{(monthlyExpenses / 1000).toFixed(1)}K</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Net Profit</span>
                  <span className={`text-xs sm:text-sm font-extrabold ${netProfit >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                    ₨<Figure>{(netProfit / 1000).toFixed(1)}K</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">PET Sold</span>
                  <span className="text-xs sm:text-sm font-extrabold text-ink">
                    <Figure>{totalPET.toLocaleString()}</Figure>
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Sales Statistics (Single Card with 4 Metrics in 1 Column) */}
          <Card variant="default" className="p-3 sm:p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border">
                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                  Sales Statistics
                </span>
              </div>

              <div className="flex flex-col divide-y divide-border">
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Bills</span>
                  <span className="text-xs sm:text-sm font-extrabold text-ink">
                    <Figure>{filteredBills.length}</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Avg Bill Value</span>
                  <span className="text-xs sm:text-sm font-extrabold text-ink">
                    ₨<Figure>{filteredBills.length > 0 ? (totalRevenue / filteredBills.length).toFixed(0) : 0}</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Discounts</span>
                  <span className="text-xs sm:text-sm font-extrabold text-brand-600">
                    ₨<Figure>{(totalDiscount / 1000).toFixed(1)}K</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Collection Rate</span>
                  <span className="text-xs sm:text-sm font-extrabold text-success-500">
                    <Figure>{totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(0) : 0}</Figure>%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Daily Sales Area Chart */}
        <Card variant="default" className="mb-5">
          <h3 className="text-sm font-bold text-ink mb-3">Daily Revenue — Last {rangeDays} Days</h3>
          {dailySalesData.some((d) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4D4CCC" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4D4CCC" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F9D66" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1F9D66" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(rangeDays / 7)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => `₨${Number(v).toFixed(0)}`} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4D4CCC" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="paid" name="Paid" stroke="#1F9D66" fill="url(#paidGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-ink-subtle text-sm">No bill data for this period</div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Revenue by Product */}
          <Card variant="default">
            <h3 className="text-sm font-bold text-ink mb-3">Revenue by Product</h3>
            {productRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productRevenueData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v: any) => [`₨${Number(v).toFixed(0)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#4D4CCC" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-ink-subtle text-sm">No data</div>
            )}
          </Card>

          {/* Revenue by Worker */}
          <Card variant="default">
            <h3 className="text-sm font-bold text-ink mb-3">Revenue by Worker</h3>
            {workerRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workerRevenueData} margin={{ top: 5, right: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EC" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any, name: any) => [`₨${Number(v).toFixed(0)}`, name === 'revenue' ? 'Revenue' : 'Discount']} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="revenue" name="Revenue" fill="#1F9D66" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="discount" name="Discounts" fill="#D9A63E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-ink-subtle text-sm">No data</div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Retailer Revenue */}
          <Card variant="default">
            <h3 className="text-sm font-bold text-ink mb-3">Top Retailers by Revenue</h3>
            {retailerRevenueData.length > 0 ? (
              <div className="space-y-2">
                {retailerRevenueData.map((r, idx) => {
                  const maxRev = retailerRevenueData[0].revenue;
                  return (
                    <div key={r.name} className="flex items-center gap-2">
                      <span className="w-5 text-xs text-ink-subtle font-bold">{idx + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium text-ink">{r.name}</span>
                          <span className="text-ink-muted">₨<Figure>{(r.revenue / 1000).toFixed(1)}K</Figure></span>
                        </div>
                        <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-600 rounded-full"
                            style={{ width: `${(r.revenue / maxRev) * 100}%` }}
                          />
                        </div>
                        {r.outstanding > 0 && (
                          <p className="text-xs text-warning-500 mt-0.5">
                            Outstanding: ₨<Figure>{(r.outstanding / 1000).toFixed(1)}K</Figure>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-ink-subtle text-sm">
                <ReceiptText size={32} className="opacity-40" />
                No data
              </div>
            )}
          </Card>

          {/* Bill Status Pie */}
          <Card variant="default">
            <h3 className="text-sm font-bold text-ink mb-3">Bill Status Breakdown</h3>
            {statusPieData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200} className="sm:w-[60%]">
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
                <div className="flex-1 w-full sm:w-auto flex sm:flex-col justify-around sm:justify-start gap-3">
                  {statusPieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-ink-muted">{item.name}</p>
                        <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-ink-subtle text-sm">No bill data</div>
            )}
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
};
