import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import { billsService } from '../../services/bills';
import {
  BarChart3, Users, Package, TrendingUp, ShoppingCart, DollarSign,
  Search, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import { Bill } from '../../types';

const ADMIN_SIDEBAR = [
  { label: 'Dashboard', icon: <BarChart3 size={18} />, path: '/admin/dashboard' },
  { label: 'Create Sale', icon: <ShoppingCart size={18} />, path: '/worker/sales' },
  { label: 'Inventory', icon: <Package size={18} />, path: '/admin/inventory' },
  { label: 'Retailers', icon: <Users size={18} />, path: '/admin/retailers' },
  { label: 'Workers', icon: <Users size={18} />, path: '/admin/workers' },
  { label: 'Expenses', icon: <DollarSign size={18} />, path: '/admin/expenses' },
  { label: 'Bills', icon: <ShoppingCart size={18} />, path: '/admin/bills' },
  { label: 'Reports', icon: <TrendingUp size={18} />, path: '/admin/reports' },
];

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-orange-100 text-orange-700',
  partial: 'bg-yellow-100 text-yellow-700',
};

export const AdminBillsPage: React.FC = () => {
  const { retailers, fetchInitialData } = useStore();
  const store = useStore();
  const [bills, setBills] = useState<Bill[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);

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
      const data = await billsService.list();
      setBills(data);
      // Extract unique workers from bills
      const workerMap = new Map<string, string>();
      data.forEach((b) => {
        const workerName = (b as any).worker?.name || b.workerId;
        if (workerName) workerMap.set(b.workerId, workerName);
      });
      setWorkers(Array.from(workerMap.entries()).map(([id, name]) => ({ id, name })));
    } catch {
      store.addNotification('error', 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

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
  }).slice().reverse();

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
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bill History</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={loadBills} disabled={loading}>
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
            <Card key={label} className={`border-l-4 border-${color}-400`}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-xl font-bold mt-0.5 text-${color}-700`}>{value}</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            {/* Search */}
            <div className="relative xl:col-span-2">
              <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                placeholder="Search bill# or retailer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
              />
            </div>
            {/* Retailer */}
            <select
              value={retailerFilter}
              onChange={(e) => setRetailerFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
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
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
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
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </select>
            {/* Date from-to */}
            <div className="flex gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* Bills Table */}
        <Card>
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading bills...</div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No bills found. Try adjusting your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
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
                  {filteredBills.map((bill) => {
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
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Items */}
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
                                      {bill.items.map((item, i) => (
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
                                    </tbody>
                                  </table>
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageContainer>
    </Layout>
  );
};
