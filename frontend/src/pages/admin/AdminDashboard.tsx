import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { useStore } from '../../store';
import {
  Users, TrendingUp, AlertTriangle, Boxes,
  CreditCard, DollarSign, Clock, Plus,
  CheckCircle2, ArrowRight, ShieldAlert, Activity, BellPlus, ShoppingCart, RotateCcw
} from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { DueRemindersWidget } from '../../components/reminders/DueRemindersWidget';
import { AddReminderModal } from '../../components/reminders/AddReminderModal';
import { UpcomingCollectionsCard } from '../../components/reminders/UpcomingCollectionsCard';
import { Card, StatIcon, Figure } from '../../components/ui/Card';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState(false);
  const [salesOverviewPeriod, setSalesOverviewPeriod] = useState<'today' | 'week' | 'month'>('week');

  const bills = useStore((state) => state.bills);
  const retailers = useStore((state) => state.retailers);
  const stockBatches = useStore((state) => state.stockBatches);
  const rgbItems = useStore((state) => state.rgbItems);
  const fetchInitialData = useStore((state) => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Local calendar date helper (Pakistan UTC+5 safe)
  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Real-time calculated metrics
  const totalPending = useMemo(() => bills.reduce((sum, b) => sum + Number(b.pendingAmount || 0), 0), [bills]);

  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);
  const todaysBills = useMemo(
    () => bills.filter((b) => getLocalDateStr(new Date(b.createdAt)) === todayStr),
    [bills, todayStr]
  );
  const todaysSalesAmount = useMemo(
    () => todaysBills.reduce((sum, b) => sum + Number(b.total || 0), 0),
    [todaysBills]
  );
  const todaysPaidAmount = useMemo(
    () => todaysBills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0),
    [todaysBills]
  );
  const todaysCreditDue = useMemo(
    () => todaysBills.reduce((sum, b) => sum + Number(b.pendingAmount || 0), 0),
    [todaysBills]
  );

  // Total credit due from all customers / ledgers
  const totalPendingReceivables = useMemo(() => {
    const fromRetailers = retailers.reduce((s, r) => s + (r.outstanding || 0), 0);
    return fromRetailers > 0 ? fromRetailers : totalPending;
  }, [retailers, totalPending]);

  // Inventory & RGB metrics
  const totalStockQuantity = useMemo(() => stockBatches.reduce((s, b) => s + b.quantity, 0), [stockBatches]);
  const totalRgbCrates = useMemo(() => rgbItems.reduce((s, item) => s + item.stockQuantity, 0), [rgbItems]);

  const cratesWithRetailers = useMemo(() => {
    return retailers.reduce((s, r) => {
      const crateSum = (r.rgbBalances || []).reduce((bSum, b) => bSum + (b.balance || 0), 0);
      return s + crateSum;
    }, 0);
  }, [retailers]);

  const retailersWithCratesCount = useMemo(() => {
    return retailers.filter((r) => (r.rgbBalances || []).some((b) => (b.balance || 0) > 0)).length;
  }, [retailers]);

  // Computed smart alerts from store data
  const lowStockBatches = useMemo(() => stockBatches.filter((b) => b.quantity < 25), [stockBatches]);
  const nearExpiryBatches = useMemo(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return stockBatches.filter(
      (b) => b.expiryDate && new Date(b.expiryDate) <= thirtyDaysFromNow && b.quantity > 0
    );
  }, [stockBatches]);

  // Sales Overview Chart Data
  const salesChartData = useMemo(() => {
    const now = new Date();
    if (salesOverviewPeriod === 'today') {
      const hours = ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];
      const slotValues: Record<string, number> = {};
      hours.forEach((h) => {
        slotValues[h] = 0;
      });
      todaysBills.forEach((b) => {
        const hour = new Date(b.createdAt).getHours();
        let slot = '8am';
        if (hour >= 20) slot = '8pm';
        else if (hour >= 18) slot = '6pm';
        else if (hour >= 16) slot = '4pm';
        else if (hour >= 14) slot = '2pm';
        else if (hour >= 12) slot = '12pm';
        else if (hour >= 10) slot = '10am';
        else if (hour >= 8) slot = '8am';
        slotValues[slot] = (slotValues[slot] || 0) + Number(b.total || 0);
      });
      return hours.map((h) => ({ label: h, amount: slotValues[h] }));
    } else if (salesOverviewPeriod === 'week') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateStr(d);
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayTotal = bills
          .filter((b) => getLocalDateStr(new Date(b.createdAt)) === dateStr)
          .reduce((sum, b) => sum + Number(b.total || 0), 0);
        days.push({ label: dayLabel, amount: dayTotal });
      }
      return days;
    } else {
      const intervals = [];
      for (let i = 4; i >= 0; i--) {
        const dEnd = new Date(now);
        dEnd.setDate(dEnd.getDate() - i * 6);
        const dStart = new Date(dEnd);
        dStart.setDate(dStart.getDate() - 5);
        const startStr = getLocalDateStr(dStart);
        const endStr = getLocalDateStr(dEnd);
        const intervalTotal = bills
          .filter((b) => {
            const bDate = getLocalDateStr(new Date(b.createdAt));
            return bDate >= startStr && bDate <= endStr;
          })
          .reduce((sum, b) => sum + Number(b.total || 0), 0);
        intervals.push({
          label: `${dStart.getDate()}–${dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          amount: intervalTotal,
        });
      }
      return intervals;
    }
  }, [salesOverviewPeriod, todaysBills, bills]);

  // Recent 6 bills (newest first)
  const recentBills = useMemo(
    () =>
      [...bills]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
    [bills]
  );

  const dashboardHeaderActions = (
    <div className="flex items-center gap-2 sm:gap-2.5">
      {/* Add Reminder Button with Tooltip */}
      <div className="relative group">
        <button
          onClick={() => setIsAddReminderModalOpen(true)}
          aria-label="Add Reminder"
          className="p-2 sm:p-2.5 rounded-control bg-surface-card hover:bg-surface-muted text-ink-muted hover:text-brand-700 border border-border transition-all flex items-center justify-center shadow-xs"
        >
          <BellPlus size={16} className="text-brand-700" />
        </button>
        <div className="group-hover:opacity-100 group-hover:visible opacity-0 invisible transition-all duration-150 absolute top-full mt-2 right-0 z-50 whitespace-nowrap bg-brand-900 text-white text-xs font-medium px-2.5 py-1 rounded-control border border-brand-700 shadow-xl pointer-events-none">
          Add Reminder
        </div>
      </div>

      {/* Create Sale Hero CTA Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          navigate('/worker/sales');
        }}
        className="flex items-center justify-center gap-1.5 sm:gap-2 bg-accent-500 hover:bg-accent-400 text-brand-900 text-xs sm:text-sm font-bold px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-control shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
      >
        <Plus size={15} />
        <ShoppingCart size={15} />
        <span className="hidden xs:inline">Create Sale</span>
      </button>
    </div>
  );

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR} headerActions={dashboardHeaderActions}>
      <PageContainer>
        <AddReminderModal
          isOpen={isAddReminderModalOpen}
          onClose={() => setIsAddReminderModalOpen(false)}
          onSuccess={() => fetchInitialData()}
        />

        {/* Due Payment Reminders Alert Banner (Visible when reminders are due) */}
        <DueRemindersWidget />

        {/* ── Priority Alert: Upcoming Collections Card ─────────────────────────── */}
        <UpcomingCollectionsCard />

        {/* ── LEVEL 1: Today's Sales & Financial Pulse (Primary Visual Focus) ───── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink-subtle">
              Today's Sales
            </h2>
            <span className="text-xs text-ink-muted flex items-center gap-1 font-medium">
              <Activity size={12} className="text-accent-500 animate-pulse" /> Live activity
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Card 1: Today's Sales */}
            <Card variant="stat" className="border-brand-600/30 bg-gradient-to-br from-surface-card to-brand-50/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink-muted">Today's Sales</span>
                <StatIcon icon={<DollarSign size={18} />} tone="brand" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-ink">
                ₨<Figure>{todaysSalesAmount.toLocaleString()}</Figure>
              </h3>
              <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border flex items-center justify-between">
                <span>{todaysBills.length} bill{todaysBills.length !== 1 ? 's' : ''} today</span>
                <span className="font-semibold text-brand-700">Gross sales</span>
              </p>
            </Card>

            {/* Card 2: Received (Today) */}
            <Card variant="stat">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink-muted">Received</span>
                <StatIcon icon={<CheckCircle2 size={18} />} tone="success" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-success-500">
                ₨<Figure>{todaysPaidAmount.toLocaleString()}</Figure>
              </h3>
              <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border flex items-center justify-between">
                <span>{todaysBills.filter((b) => Number(b.paidAmount) > 0).length} bills collected</span>
                <span className="text-success-500 font-semibold">Cash in</span>
              </p>
            </Card>

            {/* Card 3: Credit Due (Today) */}
            <Card variant="stat">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink-muted">Credit Due</span>
                <StatIcon icon={<CreditCard size={18} />} tone="warning" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-warning-500">
                ₨<Figure>{todaysCreditDue.toLocaleString()}</Figure>
              </h3>
              <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border flex items-center justify-between">
                <span>{todaysBills.filter((b) => Number(b.pendingAmount) > 0).length} bills on udhaar</span>
                <span className="text-warning-500 font-semibold">Today's unpaid</span>
              </p>
            </Card>

            {/* Card 4: Pending Receivables (Total Unpaid from All Customer Ledgers) */}
            <Card variant="stat">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink-muted">Pending Receivables</span>
                <StatIcon icon={<TrendingUp size={18} />} tone="info" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-brand-800">
                ₨<Figure>{totalPendingReceivables.toLocaleString()}</Figure>
              </h3>
              <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-border flex items-center justify-between">
                <span>All customer ledgers</span>
                <button
                  onClick={() => navigate('/admin/retailers')}
                  className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
                >
                  Ledgers <ArrowRight size={11} />
                </button>
              </p>
            </Card>
          </div>
        </div>

        {/* ── LEVEL 2: Operational Metrics (Inventory, Retailers, RGB Crates) ───── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card 1: Inventory */}
          <Card variant="default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Inventory</span>
              <Boxes size={16} className="text-brand-600" />
            </div>
            <div className="space-y-1 my-2">
              <p className="text-lg sm:text-xl font-bold text-ink">
                <Figure>{totalStockQuantity.toLocaleString()}</Figure> <span className="text-xs font-normal text-ink-subtle">PET units</span>
              </p>
              <p className="text-sm font-medium text-ink-muted">
                <Figure>{totalRgbCrates.toLocaleString()}</Figure> <span className="text-xs font-normal text-ink-subtle">RGB warehouse crates</span>
              </p>
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              {lowStockBatches.length > 0 ? (
                <span className="text-warning-500 font-semibold">{lowStockBatches.length} batch needs restocking</span>
              ) : (
                <span className="text-success-500 font-medium">Stock levels healthy</span>
              )}
              <button
                onClick={() => navigate('/admin/inventory')}
                className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
              >
                View Inventory <ArrowRight size={12} />
              </button>
            </div>
          </Card>

          {/* Card 2: Retailers */}
          <Card variant="default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Retailers</span>
              <Users size={16} className="text-brand-600" />
            </div>
            <div className="space-y-1 my-2">
              <p className="text-lg sm:text-xl font-bold text-ink">
                <Figure>{retailers.length}</Figure> <span className="text-xs font-normal text-ink-subtle">shops</span>
              </p>
              <p className="text-sm font-medium text-warning-500">
                ₨<Figure>{totalPendingReceivables.toLocaleString()}</Figure> <span className="text-xs font-normal text-ink-subtle">credit due</span>
              </p>
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-ink-muted">Active retailer accounts</span>
              <button
                onClick={() => navigate('/admin/retailers')}
                className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
              >
                View Retailers <ArrowRight size={12} />
              </button>
            </div>
          </Card>

          {/* Card 3: RGB Crates */}
          <Card variant="default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">RGB Crates</span>
              <RotateCcw size={16} className="text-brand-600" />
            </div>
            <div className="space-y-1 my-2">
              <p className="text-lg sm:text-xl font-bold text-ink">
                <Figure>{totalRgbCrates.toLocaleString()}</Figure> <span className="text-xs font-normal text-ink-subtle">in warehouse</span>
              </p>
              <p className="text-sm font-medium text-ink-muted">
                <Figure>{cratesWithRetailers.toLocaleString()}</Figure> <span className="text-xs font-normal text-ink-subtle">with {retailersWithCratesCount} shops</span>
              </p>
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-ink-muted">Tracked glass crates</span>
              <button
                onClick={() => navigate('/admin/inventory')}
                className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
              >
                View RGB <ArrowRight size={12} />
              </button>
            </div>
          </Card>
        </div>

        {/* ── LEVEL 3 & 4: Sales Overview Chart & Needs Attention Split Grid ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column (2 spans): Sales Overview Chart */}
          <div className="lg:col-span-2">
            <Card variant="default" className="h-full flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">Sales Overview</h3>
                    <p className="text-xs text-ink-subtle">Revenue performance over time</p>
                  </div>
                  {/* Period Switcher Tabs */}
                  <div className="flex items-center bg-surface-muted p-1 rounded-control border border-border">
                    {(['today', 'week', 'month'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSalesOverviewPeriod(p)}
                        className={`px-3 py-1 text-xs font-semibold rounded-control transition-all capitalize ${salesOverviewPeriod === p
                            ? 'bg-brand-700 text-white shadow-xs'
                            : 'text-ink-muted hover:text-ink'
                          }`}
                      >
                        {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Today'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts Area Chart */}
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5654E3" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#5654E3" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(val: any) => [`₨${Number(val).toLocaleString()}`, 'Sales']}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E5E7EB',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#5654E3"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#salesGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column (1 span): Needs Attention */}
          <div className="lg:col-span-1">
            <Card variant="default" className="h-full flex flex-col justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-ink mb-3.5 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-warning-500" /> Needs Attention
                </h3>

                <div className="space-y-3">
                  {/* Low Stock Item */}
                  {lowStockBatches.length > 0 ? (
                    <div className="p-3 bg-warning-50 rounded-control border border-warning-500/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-warning-500" /> Low Stock
                        </span>
                        <button
                          onClick={() => navigate('/admin/inventory')}
                          className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
                        >
                          Restock <ArrowRight size={11} />
                        </button>
                      </div>
                      <p className="text-ink-muted mt-1">
                        {lowStockBatches.length} batch{lowStockBatches.length !== 1 ? 'es' : ''} running under 25 units.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-success-50 rounded-control border border-success-500/30 text-xs text-success-500 flex items-center gap-2">
                      <CheckCircle2 size={15} />
                      <span>Stock levels are healthy</span>
                    </div>
                  )}

                  {/* Expiry Risk Item */}
                  {nearExpiryBatches.length > 0 && (
                    <div className="p-3 bg-danger-50 rounded-control border border-danger-500/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-danger-500" /> Expiring Soon
                        </span>
                        <button
                          onClick={() => navigate('/admin/inventory')}
                          className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
                        >
                          View <ArrowRight size={11} />
                        </button>
                      </div>
                      <p className="text-ink-muted mt-1">
                        {nearExpiryBatches.length} batch{nearExpiryBatches.length !== 1 ? 'es' : ''} expire within 30 days.
                      </p>
                    </div>
                  )}

                  {/* RGB Returns Pending */}
                  {retailersWithCratesCount > 0 && (
                    <div className="p-3 bg-surface-muted rounded-control border border-border text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink flex items-center gap-1.5">
                          <RotateCcw size={14} className="text-brand-600" /> RGB Returns
                        </span>
                        <button
                          onClick={() => navigate('/admin/inventory')}
                          className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5"
                        >
                          View RGB <ArrowRight size={11} />
                        </button>
                      </div>
                      <p className="text-ink-muted mt-1">
                        {cratesWithRetailers} crates out across {retailersWithCratesCount} shops.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ── LEVEL 5: Recent Sales Table ───────────────────────────────────────── */}
        <Card variant="default">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-ink flex items-center gap-2">
                <Clock size={18} className="text-brand-600" /> Recent Sales
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Latest sales</p>
            </div>
            <button
              onClick={() => navigate('/admin/bills')}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 flex-shrink-0"
            >
              View All Sales <ArrowRight size={14} />
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border text-[11px] font-bold uppercase text-ink-subtle tracking-wider bg-surface-muted">
                  <th className="py-2.5 px-3">Bill #</th>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs bg-surface-card">
                {recentBills.map((bill) => {
                  const retailer = retailers.find((r) => r.id === bill.retailerId);
                  const shopName =
                    retailer?.shopName || bill.retailer?.shopName || bill.retailerId.substring(0, 8);
                  return (
                    <tr key={bill.id} className="hover:bg-surface-muted/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-ink-muted">
                        <Figure>{bill.billNumber}</Figure>
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink">{shopName}</td>
                      <td className="py-3 px-3 text-ink-subtle">
                        {new Date(bill.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-ink">
                        ₨<Figure>{Number(bill.total).toLocaleString()}</Figure>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-control text-[10px] font-bold capitalize ${bill.status === 'paid'
                              ? 'bg-success-50 text-success-500'
                              : bill.status === 'partial'
                                ? 'bg-warning-50 text-warning-500'
                                : 'bg-danger-50 text-danger-500'
                            }`}
                        >
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {recentBills.length === 0 && (
              <div className="py-10 text-center text-xs text-ink-subtle">No sales recorded yet.</div>
            )}
          </div>
        </Card>
      </PageContainer>
    </Layout>
  );
};
