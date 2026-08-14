import React, { useState, useEffect, useMemo } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import { billsService } from '../../services/bills';
import { rgbService } from '../../services/rgb';
import { Search, ChevronDown, ChevronUp, Filter, RotateCcw } from 'lucide-react';

import { Bill, RGBTransactionRecord } from '../../types';
import { ADMIN_SIDEBAR } from '../../constants/navigation';

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-orange-100 text-orange-700',
  partial: 'bg-yellow-100 text-yellow-700',
};

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
          <thead>
            <tr className="text-gray-500 border-b border-gray-200">
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

  // Data & Pagination state
  const [bills, setBills] = useState<Bill[]>([]);
  const [totalBills, setTotalBills] = useState<number>(0);
  const [loadingMoreBills, setLoadingMoreBills] = useState<boolean>(false);

  const [rgbTransactions, setRgbTransactions] = useState<RGBTransactionRecord[]>([]);
  const [totalRgbTransactions, setTotalRgbTransactions] = useState<number>(0);
  const [loadingMoreRgb, setLoadingMoreRgb] = useState<boolean>(false);

  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [activeBillSection, setActiveBillSection] = useState<'all' | 'rgb'>('all');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [retailerFilter, setRetailerFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchInitialData();
    loadBills();
  }, []);

  const loadBills = async () => {
    setLoading(true);
    try {
      const [billsRes, rgbRes] = await Promise.all([
        billsService.list({ limit: 50, offset: 0 }),
        rgbService.getTransactions({ limit: 50, offset: 0 }),
      ]);
      setBills(billsRes.bills || []);
      setTotalBills(billsRes.total || 0);

      setRgbTransactions(rgbRes.transactions || []);
      setTotalRgbTransactions(rgbRes.total || 0);

      // Extract unique workers from bills and RGB transactions
      const workerMap = new Map<string, string>();
      (billsRes.bills || []).forEach((b) => {
        const workerName = (b as any).worker?.name || b.workerId;
        if (workerName) workerMap.set(b.workerId, workerName);
      });
      (rgbRes.transactions || []).forEach((tx) => {
        if (tx.workerId && tx.workerName) {
          workerMap.set(tx.workerId, tx.workerName);
        }
      });
      setWorkers(Array.from(workerMap.entries()).map(([id, name]) => ({ id, name })));
    } catch {
      store.addNotification('error', 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreBills = async () => {
    setLoadingMoreBills(true);
    try {
      const res = await billsService.list({ limit: 50, offset: bills.length });
      setBills((prev) => [...prev, ...(res.bills || [])]);
      setTotalBills(res.total || 0);
    } catch {
      store.addNotification('error', 'Failed to load more bills');
    } finally {
      setLoadingMoreBills(false);
    }
  };

  const handleLoadMoreRgb = async () => {
    setLoadingMoreRgb(true);
    try {
      const res = await rgbService.getTransactions({ limit: 50, offset: rgbTransactions.length });
      setRgbTransactions((prev) => [...prev, ...(res.transactions || [])]);
      setTotalRgbTransactions(res.total || 0);
    } catch {
      store.addNotification('error', 'Failed to load more RGB transactions');
    } finally {
      setLoadingMoreRgb(false);
    }
  };

  // FIX BUG 1: Remove .reverse() so bills display in backend's native newest-first order
  const filteredBills = bills.filter((bill) => {
    const retailer = retailers.find((r) => r.id === bill.retailerId);
    const workerName = (bill as any).worker?.name || '';
    const s = searchTerm.toLowerCase();

    const matchSearch = !s ||
      bill.billNumber.toLowerCase().includes(s) ||
      (retailer?.shopName || '').toLowerCase().includes(s) ||
      (retailer?.ownerName || '').toLowerCase().includes(s) ||
      workerName.toLowerCase().includes(s);

    const matchRetailer = !retailerFilter || bill.retailerId === retailerFilter;
    const matchWorker = !workerFilter || bill.workerId === workerFilter;
    const matchStatus = !statusFilter || bill.status === statusFilter;

    const billDate = new Date(bill.createdAt).toISOString().split('T')[0];
    const matchFrom = !dateFrom || billDate >= dateFrom;
    const matchTo = !dateTo || billDate <= dateTo;

    return matchSearch && matchRetailer && matchWorker && matchStatus && matchFrom && matchTo;
  });

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

  // FIX BUG 3: Group RGB transactions by (saleId + rgbItemId) for bills, or keep standalone
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

  const totalRevenue = filteredBills.reduce((s, b) => s + Number(b.total), 0);
  const totalPaid = filteredBills.reduce((s, b) => s + Number(b.paidAmount), 0);
  const totalPending = filteredBills.reduce((s, b) => s + Number(b.pendingAmount), 0);
  const totalDiscount = filteredBills.reduce((s, b) => s + Number(b.discount || 0), 0);

  const clearFilters = () => {
    setSearchTerm('');
    setRetailerFilter('');
    setWorkerFilter('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
  };

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bill History</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {activeBillSection === 'all'
                ? `Showing ${filteredBills.length} of ${totalBills} bill${totalBills !== 1 ? 's' : ''}`
                : `Showing ${groupedRgbTransactions.length} grouped entry (${filteredRgbTransactions.length} of ${totalRgbTransactions} RGB transaction${totalRgbTransactions !== 1 ? 's' : ''})`}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={loadBills} disabled={loading} className="w-full sm:w-auto justify-center">
            Refresh
          </Button>
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
            <button onClick={clearFilters} className="ml-auto text-xs text-blue-600 hover:underline">Clear all</button>
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
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 min-w-[120px] max-w-[180px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              />
              <span className="text-xs text-gray-400 flex-shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
              All Sales Bills ({filteredBills.length})
            </button>
            <button
              onClick={() => setActiveBillSection('rgb')}
              className={`pb-2 border-b-2 transition-colors ${
                activeBillSection === 'rgb'
                  ? 'border-amber-600 text-amber-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              📦 RGB Bills ({groupedRgbTransactions.length})
            </button>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading data...</div>
          ) : activeBillSection === 'all' ? (
            /* ALL SALES BILLS TABLE */
            filteredBills.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No bills found. Try adjusting your filters.</div>
            ) : (
              <div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="text-left py-2 px-2">Bill#</th>
                        <th className="text-left py-2 px-2">Retailer</th>
                        <th className="text-left py-2 px-2">Worker</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-right py-2 px-2">Paid</th>
                        <th className="text-right py-2 px-2">Pending</th>
                        <th className="text-right py-2 px-2">Discount</th>
                        <th className="text-center py-2 px-2">Mode</th>
                        <th className="text-center py-2 px-2">Status</th>
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBills.map((bill: Bill) => {
                        const retailer = retailers.find((r) => r.id === bill.retailerId);
                        const workerName = (bill as any).worker?.name || bill.workerId.slice(0, 8);
                        const isExpanded = expandedBill === bill.id;
                        return (
                          <React.Fragment key={bill.id}>
                            <tr className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 px-2 font-mono text-gray-600">{bill.billNumber}</td>
                              <td className="py-2 px-2">
                                <div className="font-medium text-gray-900">{retailer?.shopName || '—'}</div>
                                <div className="text-gray-400">{retailer?.ownerName}</div>
                              </td>
                              <td className="py-2 px-2 text-gray-700">{workerName}</td>
                              <td className="py-2 px-2 text-right font-bold text-gray-900">₨{Number(bill.total).toFixed(0)}</td>
                              <td className="py-2 px-2 text-right text-green-700">₨{Number(bill.paidAmount).toFixed(0)}</td>
                              <td className="py-2 px-2 text-right text-orange-600">₨{Number(bill.pendingAmount).toFixed(0)}</td>
                              <td className="py-2 px-2 text-right text-purple-600">
                                {Number(bill.discount) > 0 ? `₨${Number(bill.discount).toFixed(0)}` : '—'}
                              </td>
                              <td className="py-2 px-2 text-center capitalize text-gray-500">
                                {bill.paymentMode?.replace('-', ' ') || '—'}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[bill.status]}`}>
                                  {bill.status}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-gray-400">{new Date(bill.createdAt).toLocaleDateString()}</td>
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => setExpandedBill(isExpanded ? null : bill.id)}
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={11} className="bg-blue-50 px-4 py-3">
                                  <RenderBillDetails bill={bill} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Load More Bills Button */}
                {bills.length < totalBills && (
                  <div className="text-center pt-4 mt-2 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleLoadMoreBills}
                      disabled={loadingMoreBills}
                      className="px-6"
                    >
                      {loadingMoreBills ? 'Loading...' : `Load More Bills (Showing ${bills.length} of ${totalBills})`}
                    </Button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* RGB TRANSACTION HISTORY TABLE (GROUPED) */
            groupedRgbTransactions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No RGB transactions found. Try adjusting your filters.</div>
            ) : (
              <div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Retailer</th>
                        <th className="text-left py-2 px-2">RGB Item</th>
                        <th className="text-center py-2 px-2">Crate Exchange Activity</th>
                        <th className="text-left py-2 px-2">Worker</th>
                        <th className="text-center py-2 px-2">Bill Link</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRgbTransactions.map((group) => {
                        const linkedBill = group.saleId ? bills.find((b) => b.id === group.saleId) : null;
                        const isExpanded = expandedGroupKey === group.key;
                        const retailer = retailers.find((r) => r.id === group.retailerId);
                        const retailerShop = group.retailerName || retailer?.shopName || '—';
                        const retailerOwner = group.retailerOwner || retailer?.ownerName || '';

                        return (
                          <React.Fragment key={group.key}>
                            <tr className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 px-2 text-gray-500 font-mono">
                                {new Date(group.createdAt).toLocaleString('en-PK', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-2 px-2">
                                <div className="font-medium text-gray-900">{retailerShop}</div>
                                {retailerOwner && <div className="text-gray-400 text-[11px]">{retailerOwner}</div>}
                              </td>
                              <td className="py-2 px-2 font-bold text-gray-800">{group.itemName}</td>
                              <td className="py-2 px-2 text-center">
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
                              <td className="py-2 px-2 text-gray-600">{group.workerName || 'N/A'}</td>
                              <td className="py-2 px-2 text-center">
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
                              <td className="py-2 px-2 text-center">
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
                                <td colSpan={8} className="bg-blue-50 px-4 py-3">
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

                {/* Load More RGB Transactions Button */}
                {rgbTransactions.length < totalRgbTransactions && (
                  <div className="text-center pt-4 mt-2 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleLoadMoreRgb}
                      disabled={loadingMoreRgb}
                      className="px-6"
                    >
                      {loadingMoreRgb ? 'Loading...' : `Load More RGB Transactions (Showing ${rgbTransactions.length} of ${totalRgbTransactions})`}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </Card>
      </PageContainer>
    </Layout>
  );
};
