import React, { useState, useEffect, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Card, Figure } from '../../components/ui/Card';
import { useStore } from '../../store';
import { billsService } from '../../services/bills';
import { rgbService } from '../../services/rgb';
import { Search, ChevronDown, ChevronUp, Filter, RotateCcw, FileText, RefreshCw } from 'lucide-react';

import { Bill, RGBTransactionRecord } from '../../types';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { ExpandableBillRow } from '../../components/bills/ExpandableBillRow';

type PeriodPreset = 'today' | 'week' | 'month' | null;

interface GroupedRGBTransaction {
  key: string;
  saleId: string | null;
  retailerId: string;
  retailerName: string;
  retailerOwner: string;
  rgbItemId: string;
  itemName: string;
  workerId?: string;
  workerName: string;
  cratesGiven: number;
  cratesReturned: number;
  createdAt: string | Date;
  transactions: RGBTransactionRecord[];
}

const RenderBillDetails: React.FC<{ bill: Bill }> = ({ bill }) => {
  const workerName = (bill as any).worker?.name || bill.workerId.slice(0, 8);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Line items */}
      <div>
        <p className="text-xs font-bold text-ink-muted mb-2">Line Items</p>
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-surface-card">
            <tr className="text-ink-subtle border-b border-border bg-surface-card">
              <th className="text-left pb-1">Product</th>
              <th className="text-center pb-1">Qty</th>
              <th className="text-right pb-1">Price</th>
              <th className="text-right pb-1">Disc</th>
              <th className="text-right pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-border">
                <td className="py-0.5 text-ink-muted">
                  {item.product
                    ? `${item.product.brand} ${item.product.variant}`
                    : item.productId.slice(0, 12)}
                </td>
                <td className="py-0.5 text-center text-ink"><Figure>{item.quantity}</Figure></td>
                <td className="py-0.5 text-right text-ink">₨<Figure>{Number(item.price).toFixed(0)}</Figure></td>
                <td className="py-0.5 text-right text-brand-600">
                  {Number(item.discount) > 0 ? <>₨<Figure>{Number(item.discount).toFixed(0)}</Figure></> : '—'}
                </td>
                <td className="py-0.5 text-right font-semibold text-ink">₨<Figure>{Number(item.total).toFixed(0)}</Figure></td>
              </tr>
            ))}
            {bill.items.length === 0 && !(bill as any).rgbExchanges?.length && (
              <tr><td colSpan={5} className="py-1 text-ink-subtle italic">No product items</td></tr>
            )}
          </tbody>
        </table>
        {/* RGB Exchange Entries */}
        {(bill as any).rgbExchanges?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-info-50">
            <p className="text-[10px] font-bold text-info-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <RotateCcw size={10} /> Crate Exchanges
            </p>
            {(bill as any).rgbExchanges.map((ex: any) => {
              const isIssue = ex.type?.toLowerCase() === 'issue';
              return (
                <div key={ex.id} className="flex items-center justify-between text-xs py-0.5">
                  <span className={`flex items-center gap-1 font-medium ${isIssue ? 'text-warning-500' : 'text-success-500'}`}>
                    <span className="text-[10px]">{isIssue ? '📦↓' : '📦↑'}</span>
                    {ex.itemName} — {isIssue ? 'Given' : 'Returned'}
                  </span>
                  <span className={`font-bold ${isIssue ? 'text-warning-500' : 'text-success-500'}`}>
                    <Figure>{ex.quantity}</Figure> crates
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Info */}
      <div>
        <p className="text-xs font-bold text-ink-muted mb-2">Payment Details</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-ink-subtle">Subtotal</span><span className="text-ink">₨<Figure>{Number(bill.subtotal).toFixed(0)}</Figure></span></div>
          {Number(bill.discount) > 0 && <div className="flex justify-between text-brand-600"><span>Discount</span><span>−₨<Figure>{Number(bill.discount).toFixed(0)}</Figure></span></div>}
          {Number(bill.previousPendingAdded) > 0 && <div className="flex justify-between text-warning-500"><span>Prev. Pending</span><span>+₨<Figure>{Number(bill.previousPendingAdded).toFixed(0)}</Figure></span></div>}
          <div className="flex justify-between font-bold border-t border-border pt-1"><span className="text-ink">Total</span><span className="text-ink">₨<Figure>{Number(bill.total).toFixed(0)}</Figure></span></div>
          <div className="flex justify-between text-success-500"><span>Paid</span><span>₨<Figure>{Number(bill.paidAmount).toFixed(0)}</Figure></span></div>
          {Number(bill.pendingAmount) > 0 && <div className="flex justify-between text-warning-500"><span>Udhari</span><span>₨<Figure>{Number(bill.pendingAmount).toFixed(0)}</Figure></span></div>}
          <div className="flex justify-between text-ink-subtle pt-1"><span>Worker</span><span>{workerName}</span></div>
          <div className="flex justify-between text-ink-subtle"><span>Created</span><span>{new Date(bill.createdAt).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
};

export const AdminBillsPage: React.FC = () => {
  const { retailers, fetchInitialData } = useStore();
  const store = useStore();

  // Full dataset state
  const [bills, setBills] = useState<Bill[]>([]);
  const [rgbTransactions, setRgbTransactions] = useState<RGBTransactionRecord[]>([]);

  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [activeBillSection, setActiveBillSection] = useState<'all' | 'rgb'>('all');

  // Quick Period Presets state
  const [period, setPeriod] = useState<PeriodPreset>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [retailerFilter, setRetailerFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Local calendar date helper (Pakistan UTC+5 safe)
  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /** Fetch full bills and RGB transactions dataset */
  const fetchBills = async () => {
    setInitialLoading(true);
    try {
      const [billsRes, rgbRes] = await Promise.all([
        billsService.list({ limit: 2000 }),
        rgbService.getTransactions({ limit: 2000 }),
      ]);
      setBills(billsRes.bills || []);
      setRgbTransactions(rgbRes.transactions || []);

      // Extract unique workers from loaded bills
      const workerMap = new Map<string, string>();
      (billsRes.bills || []).forEach((b) => {
        const workerName = (b as any).worker?.name || b.workerId;
        if (workerName) workerMap.set(b.workerId, workerName);
      });
      (rgbRes.transactions || []).forEach((tx) => {
        if (tx.workerId && tx.workerName) workerMap.set(tx.workerId, tx.workerName);
      });
      setWorkers(Array.from(workerMap.entries()).map(([id, name]) => ({ id, name })));
    } catch {
      store.addNotification('error', 'Failed to load bills');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchBills();
  }, []);

  const loadBills = () => fetchBills();

  // Refresh bills without showing full loader
  const refreshBillsQuietly = async () => {
    try {
      const res = await billsService.list({ limit: 2000 });
      if (res.bills?.length) {
        setBills(res.bills);
      }
      await store.fetchRetailers();
    } catch {
      // ignore
    }
  };

  const getPresetRanges = () => {
    const now = new Date();
    const todayStr = getLocalDateStr(now);

    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - 6);
    const weekStr = getLocalDateStr(weekDate);

    const monthStr = getLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

    return { todayStr, weekStr, monthStr };
  };

  // Calculate revenue totals and bill counts across ALL bills for Today, This Week, and This Month immediately on page load
  const presetAggregates = useMemo(() => {
    const { todayStr, weekStr, monthStr } = getPresetRanges();
    const totals = { today: 0, week: 0, month: 0 };
    const counts = { today: 0, week: 0, month: 0 };

    bills.forEach((b) => {
      const bDate = getLocalDateStr(new Date(b.createdAt));
      const val = Number(b.total) || 0;

      if (bDate === todayStr) {
        totals.today += val;
        counts.today += 1;
      }
      if (bDate >= weekStr && bDate <= todayStr) {
        totals.week += val;
        counts.week += 1;
      }
      if (bDate >= monthStr && bDate <= todayStr) {
        totals.month += val;
        counts.month += 1;
      }
    });

    return { totals, counts };
  }, [bills]);

  const handlePeriodClick = (selectedPeriod: 'today' | 'week' | 'month') => {
    if (period === selectedPeriod) {
      setPeriod(null);
      setDateFrom('');
      setDateTo('');
    } else {
      setPeriod(selectedPeriod);
      const { todayStr, weekStr, monthStr } = getPresetRanges();
      if (selectedPeriod === 'today') {
        setDateFrom(todayStr);
        setDateTo(todayStr);
      } else if (selectedPeriod === 'week') {
        setDateFrom(weekStr);
        setDateTo(todayStr);
      } else if (selectedPeriod === 'month') {
        setDateFrom(monthStr);
        setDateTo(todayStr);
      }
    }
  };

  const handleClearFilters = () => {
    setPeriod(null);
    setSearchTerm('');
    setWorkerFilter('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setRetailerFilter('');
  };

  const isFilterActive =
    period !== null ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(searchTerm) ||
    Boolean(retailerFilter) ||
    Boolean(workerFilter) ||
    Boolean(statusFilter);

  // Client-side filtering for all bill criteria
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      const retailer = retailers.find((r) => r.id === bill.retailerId);
      const workerName = (bill as any).worker?.name || '';
      const s = searchTerm.toLowerCase();

      const matchSearch =
        !s ||
        bill.billNumber.toLowerCase().includes(s) ||
        (retailer?.shopName || '').toLowerCase().includes(s) ||
        (retailer?.ownerName || '').toLowerCase().includes(s) ||
        workerName.toLowerCase().includes(s);

      const matchRetailer = !retailerFilter || bill.retailerId === retailerFilter;
      const matchWorker = !workerFilter || bill.workerId === workerFilter;
      const matchStatus = !statusFilter || bill.status === statusFilter;

      const billDate = getLocalDateStr(new Date(bill.createdAt));
      const matchFrom = !dateFrom || billDate >= dateFrom;
      const matchTo = !dateTo || billDate <= dateTo;

      return matchSearch && matchRetailer && matchWorker && matchStatus && matchFrom && matchTo;
    });
  }, [bills, retailers, searchTerm, retailerFilter, workerFilter, statusFilter, dateFrom, dateTo]);

  const displayedBills = filteredBills;

  const filteredRgbTransactions = useMemo(() => {
    return rgbTransactions.filter((tx) => {
      const retailer = retailers.find((r) => r.id === tx.retailerId);
      const shopName = tx.retailerName || retailer?.shopName || '';
      const ownerName = tx.retailerOwner || retailer?.ownerName || '';
      const workerName = tx.workerName || '';
      const itemName = tx.itemName || '';
      const linkedBill = tx.saleId ? bills.find((b) => b.id === tx.saleId) : null;
      const billNumber = linkedBill ? linkedBill.billNumber : '';
      const s = searchTerm.toLowerCase();

      const matchSearch =
        !s ||
        shopName.toLowerCase().includes(s) ||
        ownerName.toLowerCase().includes(s) ||
        workerName.toLowerCase().includes(s) ||
        itemName.toLowerCase().includes(s) ||
        billNumber.toLowerCase().includes(s);

      const matchRetailer = !retailerFilter || tx.retailerId === retailerFilter;
      const matchWorker = !workerFilter || tx.workerId === workerFilter;
      const matchStatus = !statusFilter || (linkedBill ? linkedBill.status === statusFilter : false);

      const txDate = getLocalDateStr(new Date(tx.createdAt));
      const matchFrom = !dateFrom || txDate >= dateFrom;
      const matchTo = !dateTo || txDate <= dateTo;

      return matchSearch && matchRetailer && matchWorker && matchStatus && matchFrom && matchTo;
    });
  }, [rgbTransactions, searchTerm, retailerFilter, workerFilter, statusFilter, dateFrom, dateTo, retailers, bills]);

  // Group RGB transactions by (saleId + rgbItemId) for bills, or keep standalone
  const groupedRgbTransactions = useMemo(() => {
    const groups: GroupedRGBTransaction[] = [];
    const map = new Map<string, GroupedRGBTransaction>();

    filteredRgbTransactions.forEach((tx) => {
      if (tx.saleId) {
        const groupKey = `${tx.saleId}_${tx.rgbItemId}`;
        let group = map.get(groupKey);
        if (!group) {
          group = {
            key: groupKey,
            saleId: tx.saleId,
            retailerId: tx.retailerId,
            retailerName: tx.retailerName || '',
            retailerOwner: tx.retailerOwner || '',
            rgbItemId: tx.rgbItemId,
            itemName: tx.itemName,
            workerId: tx.workerId || undefined,
            workerName: tx.workerName || '',
            cratesGiven: 0,
            cratesReturned: 0,
            createdAt: tx.createdAt,
            transactions: [],
          };
          map.set(groupKey, group);
          groups.push(group);
        }
        group.transactions.push(tx);
        if (tx.type?.toLowerCase() === 'issue') {
          group.cratesGiven += tx.quantity;
        } else if (tx.type?.toLowerCase() === 'return') {
          group.cratesReturned += tx.quantity;
        }
      } else {
        // Standalone RGB transaction (saleId === null)
        groups.push({
          key: tx.id,
          saleId: null,
          retailerId: tx.retailerId,
          retailerName: tx.retailerName || '',
          retailerOwner: tx.retailerOwner || '',
          rgbItemId: tx.rgbItemId,
          itemName: tx.itemName,
          workerId: tx.workerId || undefined,
          workerName: tx.workerName || '',
          cratesGiven: tx.type?.toLowerCase() === 'issue' ? tx.quantity : 0,
          cratesReturned: tx.type?.toLowerCase() === 'return' ? tx.quantity : 0,
          createdAt: tx.createdAt,
          transactions: [tx],
        });
      }
    });

    return groups;
  }, [filteredRgbTransactions]);

  const displayedGroupedRgbTransactions = groupedRgbTransactions;

  const totalRevenue = filteredBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalPaid = filteredBills.reduce((s, b) => s + Number(b.paidAmount || 0), 0);
  const totalPending = filteredBills.reduce((s, b) => s + Number(b.pendingAmount || 0), 0);
  const totalDiscount = filteredBills.reduce((s, b) => s + Number(b.discount || 0), 0);

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Bill History</h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
              {activeBillSection === 'all'
                ? `Showing ${displayedBills.length} of ${bills.length} bills`
                : `Showing ${displayedGroupedRgbTransactions.length} crate exchange records`}
            </p>
          </div>
          <button
            onClick={loadBills}
            disabled={initialLoading}
            className="flex items-center justify-center gap-2 bg-surface-card hover:bg-surface-muted text-ink-muted hover:text-brand-700 border border-border text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-control transition-all self-start sm:self-auto shadow-xs"
          >
            <RefreshCw size={14} className={initialLoading ? 'animate-spin text-brand-700' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* ── Two Single Cards Layout (Sales Period & Financial Summary) ────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
          {/* Card 1: Sales Period (Single Card with 3 Period Lines in 1 Column) */}
          <Card variant="default" className="p-3 sm:p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border">
                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                  Sales Period
                </span>
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    Show All Bills
                  </button>
                )}
              </div>

              <div className="flex flex-col divide-y divide-border">
                {(
                  [
                    ['today', 'Today'],
                    ['week', 'This Week'],
                    ['month', 'This Month'],
                  ] as ['today' | 'week' | 'month', string][]
                ).map(([key, label]) => {
                  const isSelected = period === key;
                  const revenue = presetAggregates.totals[key];
                  const count = presetAggregates.counts[key];

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePeriodClick(key)}
                      className={`py-1.5 px-2 rounded-control text-left transition-all cursor-pointer select-none flex items-center justify-between group ${
                        isSelected
                          ? 'bg-brand-900/10 text-brand-700 font-bold'
                          : 'hover:bg-surface-muted/60 text-ink'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-brand-700' : 'text-ink group-hover:text-brand-700'}`}>
                          {label}
                        </span>
                        <span className={`text-xs sm:text-sm font-extrabold ${isSelected ? 'text-brand-700' : 'text-ink'}`}>
                          ₨<Figure>{revenue.toLocaleString()}</Figure>
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-ink-muted bg-surface-muted px-1.5 py-0.5 rounded-control border border-border">
                        <Figure>{count}</Figure> bill{count !== 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Card 2: Financial Summary (Single Card with 4 Metrics in 1 Column) */}
          <Card variant="default" className="p-3 sm:p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border">
                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                  Financial Summary
                </span>
              </div>

              <div className="flex flex-col divide-y divide-border">
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Sales</span>
                  <span className="text-xs sm:text-sm font-extrabold text-ink">
                    ₨<Figure>{totalRevenue.toLocaleString()}</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Received</span>
                  <span className="text-xs sm:text-sm font-extrabold text-success-500">
                    ₨<Figure>{totalPaid.toLocaleString()}</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Credit Due</span>
                  <span className="text-xs sm:text-sm font-extrabold text-warning-500">
                    ₨<Figure>{totalPending.toLocaleString()}</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Discounts</span>
                  <span className="text-xs sm:text-sm font-extrabold text-brand-600">
                    ₨<Figure>{totalDiscount.toLocaleString()}</Figure>
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Filter Bar (UI ONLY — Behavior Preserved) ────────────────────────── */}
        <Card variant="default" className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Filter size={14} className="text-ink-subtle" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Filters</span>
            {isFilterActive && (
              <button onClick={handleClearFilters} className="ml-auto text-xs text-brand-600 hover:text-brand-700 font-semibold hover:underline">
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {/* Row 1: Search + Shop + Sold By (Worker) + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search bill #, shop, worker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-control focus:border-brand-700 focus:outline-none bg-surface-card text-ink shadow-xs"
                />
              </div>
              {/* Shop / Retailer */}
              <select
                value={retailerFilter}
                onChange={(e) => setRetailerFilter(e.target.value)}
                className="w-full text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-brand-700 focus:outline-none bg-surface-card text-ink shadow-xs"
              >
                <option value="">All Shops</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.shopName}
                  </option>
                ))}
              </select>
              {/* Sold By / Worker */}
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="w-full text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-brand-700 focus:outline-none bg-surface-card text-ink shadow-xs"
              >
                <option value="">All Workers</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-brand-700 focus:outline-none bg-surface-card text-ink shadow-xs"
              >
                <option value="">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>

            {/* Row 2: Date Range */}
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="text-ink-muted font-medium flex-shrink-0">Date range:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPeriod(null);
                }}
                className="text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-brand-700 focus:outline-none bg-surface-card text-ink shadow-xs"
              />
              <span className="text-ink-subtle flex-shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPeriod(null);
                }}
                className="text-xs border border-border rounded-control px-2.5 py-1.5 focus:border-brand-700 focus:outline-none bg-surface-card text-ink shadow-xs"
              />
            </div>
          </div>
        </Card>

        {/* ── Bills & RGB Transactions Section ─────────────────────────────────── */}
        <Card variant="default">
          {/* Section Selector Tabs */}
          <div className="flex border-b border-border mb-4 font-semibold text-xs gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              onClick={() => setActiveBillSection('all')}
              className={`pb-2.5 border-b-2 transition-colors ${activeBillSection === 'all'
                  ? 'border-brand-700 text-brand-700 font-bold'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted'
                }`}
            >
              All Sales Bills ({displayedBills.length})
            </button>
            <button
              onClick={() => setActiveBillSection('rgb')}
              className={`pb-2.5 border-b-2 transition-colors ${activeBillSection === 'rgb'
                  ? 'border-brand-700 text-brand-700 font-bold'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted'
                }`}
            >
              RGB Bills ({displayedGroupedRgbTransactions.length})
            </button>
          </div>

          {initialLoading ? (
            <div className="text-center py-10 text-ink-muted text-sm">Loading bills data...</div>
          ) : activeBillSection === 'all' ? (
            /* ALL SALES BILLS TABLE */
            displayedBills.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-card bg-surface-muted flex items-center justify-center">
                  <FileText size={22} className="text-ink-subtle" />
                </div>
                <p className="text-sm text-ink-muted font-medium">No sales bills found matching the current filters.</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card">
                <table className="w-full text-xs min-w-[680px]">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border">
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Bill #</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Shop</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Sold By</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-2.5 px-3">Total</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-2.5 px-3">Paid</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-2.5 px-3">Pending</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-right py-2.5 px-3">Discount</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-center py-2.5 px-3">Mode</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-center py-2.5 px-3">Status</th>
                      <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Date</th>
                      <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-card">
                    {displayedBills.map((bill: Bill) => (
                      <ExpandableBillRow
                        key={bill.id}
                        bill={bill}
                        showRetailer={true}
                        showWorker={true}
                        colSpan={11}
                        isExpanded={expandedBill === bill.id}
                        onToggleExpand={() => setExpandedBill((prev) => (prev === bill.id ? null : bill.id))}
                        onPaymentSuccess={refreshBillsQuietly}
                        viewMode="admin-bills"
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* RGB TRANSACTION HISTORY TABLE (GROUPED) */
            displayedGroupedRgbTransactions.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-card bg-surface-muted flex items-center justify-center">
                  <RotateCcw size={22} className="text-ink-subtle" />
                </div>
                <p className="text-sm text-ink-muted font-medium">No RGB crate transactions found matching the current filters.</p>
              </div>
            ) : (
              <div>
                <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border">
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Date</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Shop</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">RGB Item</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-2.5 px-3">Crates Exchange Activity</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-left py-2.5 px-3">Sold By</th>
                        <th className="sticky top-0 z-20 bg-surface-muted text-center py-2.5 px-3">Bill Link</th>
                        <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-surface-card">
                      {displayedGroupedRgbTransactions.map((group) => {
                        const linkedBill = group.saleId ? bills.find((b) => b.id === group.saleId) : null;
                        const isExpanded = expandedGroupKey === group.key;
                        const retailer = retailers.find((r) => r.id === group.retailerId);
                        const retailerShop = group.retailerName || retailer?.shopName || '—';
                        const retailerOwner = group.retailerOwner || retailer?.ownerName || '';

                        return (
                          <React.Fragment key={group.key}>
                            <tr className="hover:bg-surface-muted/50 transition-colors">
                              <td className="py-2.5 px-3 text-ink-muted font-mono text-[11px]">
                                {new Date(group.createdAt).toLocaleString('en-PK', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-ink">{retailerShop}</div>
                                {retailerOwner && <div className="text-ink-subtle text-[11px]">{retailerOwner}</div>}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-ink">{group.itemName}</td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                                  {group.cratesGiven > 0 && (
                                    <span className="px-2 py-0.5 rounded-control text-[11px] font-bold bg-warning-50 text-warning-500 border border-warning-500/30">
                                      Given ↓ <Figure>{group.cratesGiven}</Figure>
                                    </span>
                                  )}
                                  {group.cratesReturned > 0 && (
                                    <span className="px-2 py-0.5 rounded-control text-[11px] font-bold bg-success-50 text-success-500 border border-success-500/30">
                                      Returned ↑ <Figure>{group.cratesReturned}</Figure>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-ink-muted">{group.workerName || 'N/A'}</td>
                              <td className="py-2.5 px-3 text-center">
                                {linkedBill ? (
                                  <button
                                    onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                                    className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 font-mono rounded-control text-[11px] border border-brand-200 inline-flex items-center gap-1 font-semibold transition-colors"
                                  >
                                    Bill #<Figure>{linkedBill.billNumber}</Figure>
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                ) : (
                                  <span className="text-ink-subtle font-normal">Standalone</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {linkedBill && (
                                  <button
                                    onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                                    className="text-brand-600 hover:text-brand-700"
                                    title={isExpanded ? 'Hide Bill Details' : 'View Bill Details'}
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && linkedBill && (
                              <tr>
                                <td colSpan={7} className="bg-surface-muted/60 px-4 py-3 border-t border-b border-border">
                                  <RenderBillDetails bill={linkedBill} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </Card>
      </PageContainer>
    </Layout>
  );
};
