import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { useStore } from '../../store';
import {
  BarChart3, Users, Package, TrendingUp, AlertTriangle, Boxes,
  CreditCard, DollarSign, Clock, Plus, FileText,
  CheckCircle2, Layers, ArrowRight, ShieldAlert, Sparkles, RefreshCw, Activity, BellRing
} from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { DueRemindersWidget } from '../../components/reminders/DueRemindersWidget';
import { AddReminderModal } from '../../components/reminders/AddReminderModal';
import { UpcomingCollectionsCard } from '../../components/reminders/UpcomingCollectionsCard';
import { PushNotificationToggle } from '../../components/reminders/PushNotificationToggle';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState(false);
  const bills = useStore((state) => state.bills);
  const products = useStore((state) => state.products);
  const retailers = useStore((state) => state.retailers);
  const stockBatches = useStore((state) => state.stockBatches);
  const rgbItems = useStore((state) => state.rgbItems);
  const fetchInitialData = useStore((state) => state.fetchInitialData);
  const isLoading = useStore((state) => state.isLoading);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Real-time calculated metrics
  const totalSales = useMemo(() => bills.reduce((sum, b) => sum + Number(b.total), 0), [bills]);
  const totalPaid = useMemo(() => bills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0), [bills]);
  const totalPending = useMemo(() => bills.reduce((sum, b) => sum + Number(b.pendingAmount || 0), 0), [bills]);

  const todayStr = new Date().toDateString();
  const todaysBills = useMemo(() => bills.filter(b => new Date(b.createdAt).toDateString() === todayStr), [bills, todayStr]);
  const todaysSalesAmount = useMemo(() => todaysBills.reduce((sum, b) => sum + Number(b.total), 0), [todaysBills]);

  const totalStockQuantity = useMemo(() => stockBatches.reduce((s, b) => s + b.quantity, 0), [stockBatches]);
  const totalRgbCrates = useMemo(() => rgbItems.reduce((s, item) => s + item.stockQuantity, 0), [rgbItems]);

  // Computed smart alerts from store data
  const lowStockBatches = useMemo(() => stockBatches.filter(b => b.quantity < 25), [stockBatches]);
  const nearExpiryBatches = useMemo(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return stockBatches.filter(b => b.expiryDate && new Date(b.expiryDate) <= thirtyDaysFromNow && b.quantity > 0);
  }, [stockBatches]);

  // Product categories breakdown
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([cat, count]) => ({
      category: cat.replace('-', ' ').toUpperCase(),
      count,
      percentage: Math.round((count / (products.length || 1)) * 100),
    }));
  }, [products]);

  // Recent 6 bills (newest first)
  const recentBills = useMemo(
    () => [...bills].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [bills]
  );

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Due Payment Reminders Alert Banner (Always visible at the top when reminders are due) */}
        <DueRemindersWidget />

        {/* Welcome Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 md:p-8 text-white shadow-xl mb-6 sm:mb-8 border border-slate-800">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1.5 sm:mb-2">
                <Sparkles size={14} className="text-indigo-400" /> Executive Overview
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                Beverage Distribution Dashboard
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
                Real-time monitoring for inventory, sales operations, retailer ledgers, and empty crates tracking.
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => navigate('/sales')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs md:text-sm font-bold px-3.5 sm:px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus size={16} /> New Sale
              </button>
              <button
                onClick={() => setIsAddReminderModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs md:text-sm font-semibold px-3.5 sm:px-4 py-2.5 rounded-xl transition-all hover:bg-slate-700"
              >
                <BellRing size={16} className="text-red-400" /> Add Reminder
              </button>
              <button
                onClick={() => navigate('/admin/inventory')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs md:text-sm font-semibold px-3.5 sm:px-4 py-2.5 rounded-xl transition-all"
              >
                <Boxes size={16} className="text-indigo-400" /> Inventory
              </button>
              <button
                onClick={() => fetchInitialData()}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 transition-all flex-shrink-0"
                title="Refresh Data"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin text-indigo-400' : ''} />
              </button>
              {/* Push notification toggle — sits naturally beside reminder controls */}
              <PushNotificationToggle />
            </div>
          </div>
        </div>

        <AddReminderModal
          isOpen={isAddReminderModalOpen}
          onClose={() => setIsAddReminderModalOpen(false)}
          onSuccess={() => fetchInitialData()}
        />

        {/* ── Upcoming Collections Summary Card ─────────────────────────────────── */}
        <UpcomingCollectionsCard />

        {/* ── Key Business Performance Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 mb-6 sm:mb-8">

          {/* Card 1: Today's Sales */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Revenue</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <DollarSign size={18} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900">
                ₨{todaysSalesAmount.toLocaleString()}
              </h3>
            </div>
            <div className="flex items-center justify-between mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>{todaysBills.length} bill{todaysBills.length !== 1 ? 's' : ''} today</span>
              <span className="font-semibold text-indigo-600 flex items-center gap-0.5">
                Live <Activity size={12} className="animate-pulse" />
              </span>
            </div>
          </div>

          {/* Card 2: Total Sales & Revenue */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">All-Time Revenue</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <TrendingUp size={18} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900">
                ₨{totalSales.toLocaleString()}
              </h3>
            </div>
            <div className="flex items-center justify-between mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>Paid: <strong className="text-emerald-700">₨{totalPaid.toLocaleString()}</strong></span>
              {totalPending > 0 && (
                <span className="text-amber-700 font-semibold">Pending: ₨{totalPending.toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Card 3: Retailers & Accounts */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Retailer Accounts</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <Users size={18} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900">
                {retailers.length}
              </h3>
              <span className="text-xs text-slate-500">Shops</span>
            </div>
            <div className="flex items-center justify-between mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>Catalog: <strong>{products.length} Products</strong></span>
              <button onClick={() => navigate('/admin/retailers')} className="text-purple-600 hover:text-purple-700 font-bold flex items-center gap-0.5">
                View <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Card 4: Inventory & RGB Crates */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory & RGB Crates</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                <Boxes size={18} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900">
                {totalStockQuantity.toLocaleString()}
              </h3>
              <span className="text-xs text-slate-500">PET Units</span>
            </div>
            <div className="flex items-center justify-between mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>RGB Stock: <strong className="text-cyan-700">{totalRgbCrates} Crates</strong></span>
              <button onClick={() => navigate('/admin/inventory')} className="text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-0.5">
                RGB Panel <ArrowRight size={12} />
              </button>
            </div>
          </div>

        </div>

        {/* ── Main Content Split Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-8">

          {/* Left Column (2 spans): Operations & Recent Bills */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">

            {/* Quick Action Navigation Modules */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3.5 sm:mb-4 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" /> Quick Operations Modules
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <button
                  onClick={() => navigate('/sales')}
                  className="flex flex-col items-center p-3 sm:p-3.5 bg-gradient-to-b from-indigo-50/50 to-blue-50/50 hover:from-indigo-100/50 hover:to-blue-100/50 border border-indigo-100 rounded-xl text-center transition-all group"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Plus size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-xs">Create Sale</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Worker checkout</span>
                </button>

                <button
                  onClick={() => navigate('/admin/inventory')}
                  className="flex flex-col items-center p-3 sm:p-3.5 bg-gradient-to-b from-emerald-50/50 to-teal-50/50 hover:from-emerald-100/50 hover:to-teal-100/50 border border-emerald-100 rounded-xl text-center transition-all group"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Package size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-xs">Inventory Catalog</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Stock & brands</span>
                </button>

                <button
                  onClick={() => navigate('/admin/retailers')}
                  className="flex flex-col items-center p-3 sm:p-3.5 bg-gradient-to-b from-purple-50/50 to-pink-50/50 hover:from-purple-100/50 hover:to-pink-100/50 border border-purple-100 rounded-xl text-center transition-all group"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Users size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-xs">Retailers CRM</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Accounts & Debt</span>
                </button>

                <button
                  onClick={() => navigate('/admin/expenses')}
                  className="flex flex-col items-center p-3 sm:p-3.5 bg-gradient-to-b from-amber-50/50 to-orange-50/50 hover:from-amber-100/50 hover:to-orange-100/50 border border-amber-100 rounded-xl text-center transition-all group"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <CreditCard size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-xs">Expenses Log</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Daily cash outflows</span>
                </button>

                <button
                  onClick={() => navigate('/admin/reports')}
                  className="flex flex-col items-center p-3 sm:p-3.5 bg-gradient-to-b from-cyan-50/50 to-blue-50/50 hover:from-cyan-100/50 hover:to-blue-100/50 border border-cyan-100 rounded-xl text-center transition-all group"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-600 text-white flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <BarChart3 size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-xs">Reports & Analytics</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Audit & variance</span>
                </button>

                <button
                  onClick={() => navigate('/admin/bills')}
                  className="flex flex-col items-center p-3 sm:p-3.5 bg-gradient-to-b from-slate-100 to-slate-200/60 hover:from-slate-200/80 hover:to-slate-300/80 border border-slate-200 rounded-xl text-center transition-all group"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 text-white flex items-center justify-center mb-1.5 sm:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <FileText size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-xs">Bill Statements</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">History & Voiding</span>
                </button>
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-600" /> Recent Invoices & Sales
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Latest transactions generated by workers</p>
                </div>
                <button
                  onClick={() => navigate('/admin/bills')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 flex-shrink-0"
                >
                  View All <ArrowRight size={14} />
                </button>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-left border-collapse min-w-[480px]">
                  <thead className="sticky top-0 z-10 bg-white shadow-xs">
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 tracking-wider bg-slate-50">
                      <th className="py-2.5 px-3">Bill #</th>
                      <th className="py-2.5 px-3">Retailer</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {recentBills.map((bill) => {
                      const retailer = retailers.find(r => r.id === bill.retailerId);
                      const shopName = retailer?.shopName || bill.retailer?.shopName || bill.retailerId.substring(0, 8);
                      return (
                        <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                            {bill.billNumber}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {shopName}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {new Date(bill.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            ₨{Number(bill.total).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              bill.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bill.status === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {bill.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {recentBills.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No transactions generated yet.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column (1 span): Smart Alerts & Analytics Summary */}
          <div className="space-y-8">

            {/* Live Inventory & Risk Alerts */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-500" /> Operational Insights & Risk Alerts
              </h3>
              <div className="space-y-3">
                {lowStockBatches.length > 0 ? (
                  <div className="flex items-start gap-3 p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900">Low Inventory Threshold ({lowStockBatches.length} batch{lowStockBatches.length !== 1 ? 'es' : ''})</p>
                      <p className="text-amber-700 mt-0.5">Batches running under 25 PET units.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    <span>All stock levels healthy</span>
                  </div>
                )}

                {nearExpiryBatches.length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-xs">
                    <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-900">Expiry Risk ({nearExpiryBatches.length} batch{nearExpiryBatches.length !== 1 ? 'es' : ''})</p>
                      <p className="text-rose-700 mt-0.5">Batches expiring within 30 days.</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs">
                  <Boxes size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-indigo-900">RGB Warehouse Stock</p>
                    <p className="text-indigo-700 mt-0.5">{totalRgbCrates} total empty crates available in warehouse.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Distribution Visual Bar Breakdown */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-600" /> Catalog Category Breakdown
              </h3>
              <div className="space-y-4">
                {categoryStats.map((item, idx) => {
                  const colors = ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
                  const barColor = colors[idx % colors.length];
                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{item.category}</span>
                        <span className="text-slate-500">{item.count} items ({item.percentage}%)</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.max(5, item.percentage)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {categoryStats.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-4">No categories configured</p>
                )}
              </div>
            </div>

          </div>

        </div>
      </PageContainer>
    </Layout>
  );
};
