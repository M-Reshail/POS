import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, InfiniteScrollTrigger } from '../../components/common';
import { useStore } from '../../store';
import { billsService } from '../../services/bills';
import { rgbService } from '../../services/rgb';
import { Search, ChevronDown, ChevronUp, Filter, RotateCcw } from 'lucide-react';

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
        <p className="text-xs font-bold text-gray-700 mb-2">Line Items</p>
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-gray-500 border-b border-gray-200 bg-white">
              <th className="text-left pb-1">Product</th>
              <th className="text-center pb-1">Qty</th>
              <th className="text-right pb-1">Price</th>
              <th className="text-right pb-1">Disc</th>
              <th className="text-right pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-0.5 text-gray-700">
                  {item.product
                    ? `${item.product.brand} ${item.product.variant}`
                    : item.productId.slice(0, 12)}
                </td>
                <td className="py-0.5 text-center">{item.quantity}</td>
                <td className="py-0.5 text-right">₨{Number(item.price).toFixed(0)}</td>
                <td className="py-0.5 text-right text-purple-600">
                  {Number(item.discount) > 0 ? `₨${Number(item.discount).toFixed(0)}` : '—'}
                </td>
                <td className="py-0.5 text-right font-semibold">₨{Number(item.total).toFixed(0)}</td>
              </tr>
            ))}
            {bill.items.length === 0 && !(bill as any).rgbExchanges?.length && (
              <tr><td colSpan={5} className="py-1 text-gray-400 italic">No product items</td></tr>
            )}
          </tbody>
        </table>
        {/* RGB Exchange Entries */}
        {(bill as any).rgbExchanges?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-teal-100">
            <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <RotateCcw size={10} /> Crate Exchanges
            </p>
            {(bill as any).rgbExchanges.map((ex: any) => {
              const isIssue = ex.type?.toLowerCase() === 'issue';
              return (
                <div key={ex.id} className="flex items-center justify-between text-xs py-0.5">
                  <span className={`flex items-center gap-1 font-medium ${
                    isIssue ? 'text-amber-700' : 'text-teal-700'
                  }`}>
                    <span className="text-[10px]">{isIssue ? '📦↓' : '📦↑'}</span>
                    {ex.itemName} — {isIssue ? 'Given' : 'Returned'}
                  </span>
                  <span className={`font-bold ${
                    isIssue ? 'text-amber-700' : 'text-teal-700'
                  }`}>{ex.quantity} crates</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Info */}
      <div>
        <p className="text-xs font-bold text-gray-700 mb-2">Payment Details</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₨{Number(bill.subtotal).toFixed(0)}</span></div>
          {Number(bill.discount) > 0 && <div className="flex justify-between text-purple-600"><span>Discount</span><span>−₨{Number(bill.discount).toFixed(0)}</span></div>}
          {Number(bill.previousPendingAdded) > 0 && <div className="flex justify-between text-orange-600"><span>Prev. Pending</span><span>+₨{Number(bill.previousPendingAdded).toFixed(0)}</span></div>}
          <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>Total</span><span>₨{Number(bill.total).toFixed(0)}</span></div>
          <div className="flex justify-between text-green-700"><span>Paid</span><span>₨{Number(bill.paidAmount).toFixed(0)}</span></div>
          {Number(bill.pendingAmount) > 0 && <div className="flex justify-between text-orange-600"><span>Udhari</span><span>₨{Number(bill.pendingAmount).toFixed(0)}</span></div>}
          <div className="flex justify-between text-gray-500 pt-1"><span>Worker</span><span>{workerName}</span></div>
          <div className="flex justify-between text-gray-500"><span>Created</span><span>{new Date(bill.createdAt).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
};

export const AdminBillsPage: React.FC = () => {
  const { retailers, fetchInitialData } = useStore();
  const store = useStore();

  // Server-side paginated bills and RGB transactions
  const [bills, setBills] = useState<Bill[]>([]);
  const [totalBills, setTotalBills] = useState(0);
  const [rgbTransactions, setRgbTransactions] = useState<RGBTransactionRecord[]>([]);
  const [totalRgb, setTotalRgb] = useState(0);

  const [loadingMoreBills, setLoadingMoreBills] = useState(false);
  const [loadingMoreRgb, setLoadingMoreRgb] = useState(false);

  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Active server-side filter params — stored in ref so handleLoadMoreBills closure always reads the latest
  const activeServerFilters = useRef<{ status?: string; retailerId?: string }>({});

  /** Fetch bills from offset=0 with given server-side filters — resets the bill list */
  const fetchBillsServerSide = useCallback(async (filters: { status?: string; retailerId?: string }) => {
    activeServerFilters.current = filters;
    setLoading(true);
    try {
      const [billsRes, rgbRes] = await Promise.all([
        billsService.list({
          limit: 10,
          offset: 0,
          status: filters.status || undefined,
          retailerId: filters.retailerId || undefined,
        }),
        rgbService.getTransactions({ limit: 10, offset: 0 }),
      ]);
      setBills(billsRes.bills || []);
      setTotalBills(billsRes.total || 0);
      setRgbTransactions(rgbRes.transactions || []);
      setTotalRgb(rgbRes.total || 0);

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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    fetchBillsServerSide({});
  }, []);

  const loadBills = () => fetchBillsServerSide(activeServerFilters.current);

  // Refresh bills without setting loading=true (keeps scroll position & expanded bill state intact)
  const refreshBillsQuietly = async () => {
    try {
      const currentLoadedCount = Math.max(10, bills.length);
      const filters = activeServerFilters.current;
      const res = await billsService.list({
        limit: currentLoadedCount,
        offset: 0,
        status: filters.status || undefined,
        retailerId: filters.retailerId || undefined,
      });
      if (res.bills?.length) {
        setBills(res.bills);
        setTotalBills(res.total || 0);
      }
      await store.fetchRetailers();
    } catch {
      // ignore
    }
  };

  const handleLoadMoreBills = async () => {
    if (loadingMoreBills || bills.length >= totalBills) return;
    setLoadingMoreBills(true);
    try {
      const nextOffset = bills.length;
      const filters = activeServerFilters.current;
      const res = await billsService.list({
        limit: 10,
        offset: nextOffset,
        status: filters.status || undefined,
        retailerId: filters.retailerId || undefined,
      });
      if (res.bills?.length) {
        setBills((prev) => [...prev, ...res.bills]);
        setTotalBills(res.total || totalBills);
      }
    } catch {
      store.addNotification('error', 'Failed to load more bills');
    } finally {
      setLoadingMoreBills(false);
    }
  };

  const handleLoadMoreRgb = async () => {
    if (loadingMoreRgb || rgbTransactions.length >= totalRgb) return;
    setLoadingMoreRgb(true);
    try {
      const nextOffset = rgbTransactions.length;
      const res = await rgbService.getTransactions({ limit: 10, offset: nextOffset });
      if (res.transactions?.length) {
        setRgbTransactions((prev) => [...prev, ...res.transactions]);
        setTotalRgb(res.total || totalRgb);
      }
    } catch {
      store.addNotification('error', 'Failed to load more RGB transactions');
    } finally {
      setLoadingMoreRgb(false);
    }
  };

  const getPresetRanges = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - 6);
    const weekStr = weekDate.toISOString().split('T')[0];

    const monthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    return { todayStr, weekStr, monthStr };
  };

  // Calculate revenue totals across ALL bills for Today, This Week, and This Month immediately on page load
  const presetTotals = useMemo(() => {
    const { todayStr, weekStr, monthStr } = getPresetRanges();
    let today = 0;
    let week = 0;
    let month = 0;

    bills.forEach((b) => {
      const bDate = new Date(b.createdAt).toISOString().split('T')[0];
      const val = Number(b.total) || 0;

      if (bDate === todayStr) {
        today += val;
      }
      if (bDate >= weekStr && bDate <= todayStr) {
        week += val;
      }
      if (bDate >= monthStr && bDate <= todayStr) {
        month += val;
      }
    });

    return { today, week, month };
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
    // Reset server-side filters and re-fetch from scratch
    setStatusFilter('');
    setRetailerFilter('');
    // fetchBillsServerSide will be triggered by the useEffects below
  };

  const isFilterActive =
    period !== null ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(searchTerm) ||
    Boolean(retailerFilter) ||
    Boolean(workerFilter) ||
    Boolean(statusFilter);

  // Server-side filter triggers: when status or retailer changes, fetch fresh from offset=0.
  // Skip the first render (handled by the initial fetchBillsServerSide({}) in the mount effect).
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    fetchBillsServerSide({
      status: statusFilter || undefined,
      retailerId: retailerFilter || undefined,
    });
  }, [statusFilter, retailerFilter]);


  // Newest-first order matching backend
  // Note: searchTerm, workerFilter, and date range remain client-side filters
  // applied on top of the server-filtered page. Status & retailer are server-side.
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      const retailer = retailers.find((r) => r.id === bill.retailerId);
      const workerName = (bill as any).worker?.name || '';
      const s = searchTerm.toLowerCase();

      const matchSearch = !s ||
        bill.billNumber.toLowerCase().includes(s) ||
        (retailer?.shopName || '').toLowerCase().includes(s) ||
        (retailer?.ownerName || '').toLowerCase().includes(s) ||
        workerName.toLowerCase().includes(s);

      const matchWorker = !workerFilter || bill.workerId === workerFilter;

      const billDate = new Date(bill.createdAt).toISOString().split('T')[0];
      const matchFrom = !dateFrom || billDate >= dateFrom;
      const matchTo = !dateTo || billDate <= dateTo;

      return matchSearch && matchWorker && matchFrom && matchTo;
    });
  }, [bills, retailers, searchTerm, workerFilter, dateFrom, dateTo]);

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

      const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
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

  const totalRevenue = filteredBills.reduce((s, b) => s + Number(b.total), 0);
  const totalPaid = filteredBills.reduce((s, b) => s + Number(b.paidAmount), 0);
  const totalPending = filteredBills.reduce((s, b) => s + Number(b.pendingAmount), 0);
  const totalDiscount = filteredBills.reduce((s, b) => s + Number(b.discount || 0), 0);

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bill History</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {activeBillSection === 'all'
                ? `Showing ${displayedBills.length} of ${filteredBills.length} bill${filteredBills.length !== 1 ? 's' : ''}`
                : `Showing ${displayedGroupedRgbTransactions.length} grouped entry (${filteredRgbTransactions.length} RGB transaction${filteredRgbTransactions.length !== 1 ? 's' : ''})`}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={loadBills} disabled={loading} className="w-full sm:w-auto justify-center">
            Refresh
          </Button>
        </div>

        {/* Quick Period Presets Header */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quick Period Presets</p>
          {isFilterActive && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              Show All Bills
            </button>
          )}
        </div>

        {/* Quick Period Preset Cards (Today / This Week / This Month) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
          {(
            [
              ['today', 'Today', 'blue'],
              ['week', 'This Week', 'purple'],
              ['month', 'This Month', 'green'],
            ] as ['today' | 'week' | 'month', string, string][]
          ).map(([key, label, color]) => (
            <button
              key={key}
              onClick={() => handlePeriodClick(key)}
              className={`p-2.5 sm:p-4 rounded-xl border-2 text-left transition-all cursor-pointer select-none ${
                period === key
                  ? `border-${color}-500 bg-${color}-50 ring-2 ring-${color}-200 scale-[1.02] shadow-sm`
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm hover:scale-[1.01]'
              }`}
              title={period === key ? 'Click again to deselect & show all bills' : `Filter table & expand all for ${label}`}
            >
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{label}</p>
              <p className={`text-base sm:text-2xl font-bold mt-0.5 sm:mt-1 ${
                period === key ? `text-${color}-700` : 'text-gray-900'
              }`}>
                ₨{presetTotals[key].toFixed(0)}
              </p>
              {period === key ? (
                <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-semibold text-blue-600 flex items-center gap-1">
                  ● Filtered & Expanded (click to reset)
                </p>
              ) : (
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Click to filter & expand all</p>
              )}
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Revenue', value: `₨${(totalRevenue / 1000).toFixed(1)}K`, color: 'blue' },
            { label: 'Paid', value: `₨${(totalPaid / 1000).toFixed(1)}K`, color: 'green' },
            { label: 'Outstanding', value: `₨${(totalPending / 1000).toFixed(1)}K`, color: 'orange' },
            { label: 'Discounts Given', value: `₨${(totalDiscount / 1000).toFixed(1)}K`, color: 'purple' },
          ].map(({ label, value, color }) => (
            <Card key={label} className={`border-l-4 border-${color}-400 p-3 sm:p-4`}>
              <p className="text-[11px] sm:text-xs text-gray-500">{label}</p>
              <p className={`text-lg sm:text-xl font-bold mt-0.5 text-${color}-700`}>{value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Filters</span>
            <button onClick={handleClearFilters} className="ml-auto text-xs text-blue-600 hover:underline">Clear all</button>
          </div>
          <div className="flex flex-col gap-2">
            {/* Row 1: Search + Retailer + Worker + Status */}
            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[140px]">
                <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bill#, retailer, or RGB item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                />
              </div>
              {/* Retailer */}
              <select
                value={retailerFilter}
                onChange={(e) => setRetailerFilter(e.target.value)}
                className="flex-1 min-w-[120px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Retailers</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>{r.shopName}</option>
                ))}
              </select>
              {/* Worker */}
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="flex-1 min-w-[110px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Workers</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 min-w-[100px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            {/* Row 2: Date Range */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 flex-shrink-0">Date range:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPeriod(null); }}
                className="flex-1 min-w-[120px] max-w-[180px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              />
              <span className="text-xs text-gray-400 flex-shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPeriod(null); }}
                className="flex-1 min-w-[120px] max-w-[180px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* Bills / RGB Transactions Table */}
        <Card>
          <div className="flex border-b border-gray-100 mb-4 font-semibold text-xs gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              onClick={() => setActiveBillSection('all')}
              className={`pb-2 border-b-2 transition-colors ${
                activeBillSection === 'all'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              All Sales Bills ({displayedBills.length})
            </button>
            <button
              onClick={() => setActiveBillSection('rgb')}
              className={`pb-2 border-b-2 transition-colors ${
                activeBillSection === 'rgb'
                  ? 'border-amber-600 text-amber-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              📦 RGB Bills ({displayedGroupedRgbTransactions.length})
            </button>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading data...</div>
          ) : activeBillSection === 'all' ? (
            /* ALL SALES BILLS TABLE */
            displayedBills.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No bills found. Try adjusting your filters.</div>
            ) : (
              <div>
                <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px] border border-gray-200 rounded-xl shadow-2xs">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead className="sticky top-0 z-20 shadow-xs">
                      <tr className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[11px] border-b border-gray-300">
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Bill#</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Retailer</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Worker</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-right py-3 px-3">Total</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-right py-3 px-3">Paid</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-right py-3 px-3">Pending</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-right py-3 px-3">Discount</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-center py-3 px-3">Mode</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-center py-3 px-3">Status</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Date</th>
                        <th className="sticky top-0 z-20 bg-gray-100 py-3 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
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

                  {/* Reliable Infinite Scroll Trigger */}
                  <InfiniteScrollTrigger
                    onLoadMore={handleLoadMoreBills}
                    hasMore={bills.length < totalBills}
                  />
                </div>
              </div>
            )
          ) : (
            /* RGB TRANSACTION HISTORY TABLE (GROUPED) */
            displayedGroupedRgbTransactions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No RGB transactions found. Try adjusting your filters.</div>
            ) : (
              <div>
                <div className="overflow-auto max-h-[calc(100vh-270px)] min-h-[350px] border border-gray-200 rounded-xl shadow-2xs">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead className="sticky top-0 z-20 shadow-xs">
                      <tr className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[11px] border-b border-gray-300">
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Date</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Retailer</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">RGB Item</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-center py-3 px-3">Crate Exchange Activity</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-left py-3 px-3">Worker</th>
                        <th className="sticky top-0 z-20 bg-gray-100 text-center py-3 px-3">Bill Link</th>
                        <th className="sticky top-0 z-20 bg-gray-100 py-3 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedGroupedRgbTransactions.map((group) => {
                        const linkedBill = group.saleId ? bills.find((b) => b.id === group.saleId) : null;
                        const isExpanded = expandedGroupKey === group.key;
                        const retailer = retailers.find((r) => r.id === group.retailerId);
                        const retailerShop = group.retailerName || retailer?.shopName || '—';
                        const retailerOwner = group.retailerOwner || retailer?.ownerName || '';

                        return (
                          <React.Fragment key={group.key}>
                            <tr className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2.5 px-3 text-gray-500 font-mono">
                                {new Date(group.createdAt).toLocaleString('en-PK', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-gray-900">{retailerShop}</div>
                                {retailerOwner && <div className="text-gray-400 text-[11px]">{retailerOwner}</div>}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-gray-800">{group.itemName}</td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                                  {group.cratesGiven > 0 && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Given ↓ {group.cratesGiven}
                                    </span>
                                  )}
                                  {group.cratesReturned > 0 && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Returned ↑ {group.cratesReturned}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">{group.workerName || 'N/A'}</td>
                              <td className="py-2.5 px-3 text-center">
                                {linkedBill ? (
                                  <button
                                    onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono rounded text-[11px] border border-blue-200 inline-flex items-center gap-1 font-semibold transition-colors"
                                  >
                                    Bill #{linkedBill.billNumber}
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                ) : (
                                  <span className="text-gray-400 font-normal">Standalone</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {linkedBill && (
                                  <button
                                    onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                                    className="text-blue-500 hover:text-blue-700"
                                    title={isExpanded ? 'Hide Bill Details' : 'View Bill Details'}
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && linkedBill && (
                              <tr>
                                <td colSpan={7} className="bg-blue-50 px-4 py-3">
                                  <RenderBillDetails bill={linkedBill} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Reliable Infinite Scroll Trigger for RGB */}
                  <InfiniteScrollTrigger
                    onLoadMore={handleLoadMoreRgb}
                    hasMore={rgbTransactions.length < totalRgb}
                    color="text-teal-600"
                  />
                </div>
              </div>
            )
          )}
        </Card>
      </PageContainer>
    </Layout>
  );
};
