import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { Card, Button, Modal } from '../../components/common';
import { useStore } from '../../store';
import {
  ArrowLeft,
  Store,
  User,
  Phone,
  MapPin,
  CreditCard,
  Boxes,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Pencil,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { retailersService } from '../../services/retailers';
import { Retailer, LedgerEntry } from '../../types';

const ENTRY_TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  sale: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Sale' },
  payment: { bg: 'bg-green-100', text: 'text-green-800', label: 'Payment' },
  return: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Return' },
  adjustment: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Adjustment' },
  sale_with_allocation: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Sale + Udhaar Paid' },
};

interface AllocationDetail {
  billNumber?: string;
  billId?: string;
  amount: number;
  notes?: string;
  balance: number;
  isNewBill?: boolean;
}

interface GroupedLedgerTransaction {
  id: string;
  createdAt: Date;
  isGrouped: boolean;
  type: 'sale_with_allocation' | 'sale' | 'payment' | 'return' | 'adjustment';
  billNumber?: string;
  billId?: string;
  paymentMode?: string;
  saleAmount?: number;
  paidAmount?: number;
  amount: number;
  netChange: number;
  runningBalance: number;
  startingBalance: number;
  notes?: string;
  allocations: AllocationDetail[];
  rawEntries: LedgerEntry[];
}

const PAGE_SIZE = 15;

interface RetailerEditForm {
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation: string;
}

export const RetailerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();

  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [outstanding, setOutstanding] = useState(0);

  const [loadingRetailer, setLoadingRetailer] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Friendly Grouped View vs Raw Audit Log View
  const [ledgerViewMode, setLedgerViewMode] = useState<'friendly' | 'detailed'>('friendly');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Edit Retailer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<RetailerEditForm>({
    shopName: '',
    ownerName: '',
    mobileNumber: '',
    address: '',
    deliveryLocation: '',
  });
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof RetailerEditForm, string>>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Load retailer profile details
  useEffect(() => {
    if (!id) return;
    setLoadingRetailer(true);
    retailersService
      .getById(id)
      .then((data) => {
        setRetailer(data);
        if (typeof data.outstanding === 'number') {
          setOutstanding(data.outstanding);
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.message || err.message || 'Failed to load retailer profile.';
        setError(msg);
      })
      .finally(() => setLoadingRetailer(false));
  }, [id]);

  // Load paginated ledger entries
  useEffect(() => {
    if (!id) return;
    setLoadingLedger(true);
    const offset = (page - 1) * PAGE_SIZE;
    retailersService
      .getLedger(id, PAGE_SIZE, offset)
      .then((data) => {
        setLedgerEntries(data.entries || []);
        setTotalEntries(data.pagination?.total || 0);
        if (typeof data.outstanding === 'number') {
          setOutstanding(data.outstanding);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch ledger:', err);
      })
      .finally(() => setLoadingLedger(false));
  }, [id, page]);

  const openEditModal = () => {
    if (!retailer) return;
    setEditForm({
      shopName: retailer.shopName || '',
      ownerName: retailer.ownerName || '',
      mobileNumber: retailer.mobileNumber || '',
      address: retailer.address || '',
      deliveryLocation: retailer.deliveryLocation || '',
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!retailer) return;
    const errors: Partial<Record<keyof RetailerEditForm, string>> = {};
    if (!editForm.shopName.trim()) errors.shopName = 'Shop name is required.';
    if (!editForm.ownerName.trim()) errors.ownerName = 'Owner name is required.';
    if (!editForm.mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required.';
    if (!editForm.address.trim()) errors.address = 'Address is required.';

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    setSubmittingEdit(true);
    try {
      const updated = await retailersService.update(retailer.id, {
        shopName: editForm.shopName.trim(),
        ownerName: editForm.ownerName.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        address: editForm.address.trim(),
        deliveryLocation: editForm.deliveryLocation.trim() || undefined,
      });

      setRetailer((prev) => (prev ? { ...prev, ...updated } : updated));
      store.addNotification('success', 'Retailer profile updated successfully');
      store.fetchRetailers();
      setIsEditModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update retailer.';
      store.addNotification('error', msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // ── Smart Grouping of Ledger Transactions (Friendly View) ──────────────────
  const groupedTransactions = useMemo(() => {
    if (ledgerViewMode === 'detailed') return [];

    const extractOriginBill = (notes?: string | null): string | null => {
      if (!notes) return null;
      const match = notes.match(/Udhaar allocation from bill (BL-[^\s,]+)/i);
      return match ? match[1] : null;
    };

    const groups: GroupedLedgerTransaction[] = [];
    const processedEntryIds = new Set<string>();

    for (let i = 0; i < ledgerEntries.length; i++) {
      const entry = ledgerEntries[i];
      if (processedEntryIds.has(entry.id)) continue;

      const originFromNotes = extractOriginBill(entry.notes);
      let targetOriginBill = originFromNotes;

      if (!targetOriginBill && entry.entryType === 'sale' && entry.bill?.billNumber) {
        const hasLinkedPayments = ledgerEntries.some(
          (other) =>
            other.id !== entry.id &&
            extractOriginBill(other.notes) === entry.bill?.billNumber
        );
        if (hasLinkedPayments) {
          targetOriginBill = entry.bill.billNumber;
        }
      }

      if (targetOriginBill) {
        const entryTime = new Date(entry.createdAt).getTime();
        const cluster = ledgerEntries.filter((candidate) => {
          if (processedEntryIds.has(candidate.id)) return false;
          const candTime = new Date(candidate.createdAt).getTime();
          if (Math.abs(candTime - entryTime) > 120000) return false;

          const candidateOrigin = extractOriginBill(candidate.notes);
          const isOriginSale =
            candidate.entryType === 'sale' &&
            candidate.bill?.billNumber === targetOriginBill;
          const isOriginPayment = candidateOrigin === targetOriginBill;

          return isOriginSale || isOriginPayment;
        });

        if (cluster.length > 1) {
          cluster.forEach((c) => processedEntryIds.add(c.id));

          const saleEntry = cluster.find((c) => c.entryType === 'sale');
          const paymentEntries = cluster.filter((c) => c.entryType === 'payment');

          const saleAmount = saleEntry ? Number(saleEntry.amount) : 0;
          const totalPaid = paymentEntries.reduce((sum, p) => sum + Number(p.amount), 0);

          const newestEntry = [...cluster].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          const finalBalance = Number(newestEntry.balance);

          const netChange = saleAmount - totalPaid;
          const startingBalance = finalBalance - netChange;

          const allocations: AllocationDetail[] = paymentEntries.map((p) => {
            const billNum = p.bill?.billNumber || '—';
            const isNewBill = billNum === targetOriginBill;
            return {
              billNumber: billNum,
              billId: p.billId || undefined,
              amount: Number(p.amount),
              notes: p.notes || undefined,
              balance: Number(p.balance),
              isNewBill,
            };
          });

          groups.push({
            id: `group-${targetOriginBill}-${newestEntry.id}`,
            createdAt: new Date(newestEntry.createdAt),
            isGrouped: true,
            type: 'sale_with_allocation',
            billNumber: targetOriginBill,
            billId: saleEntry?.billId || undefined,
            paymentMode: saleEntry?.paymentMode || paymentEntries[0]?.paymentMode || 'cash',
            saleAmount: saleAmount > 0 ? saleAmount : undefined,
            paidAmount: totalPaid,
            amount: saleAmount > 0 ? saleAmount : totalPaid,
            netChange,
            runningBalance: finalBalance,
            startingBalance,
            notes: saleEntry?.notes || `Udhaar allocation across ${paymentEntries.length} bills`,
            allocations,
            rawEntries: cluster,
          });
          continue;
        }
      }

      // Standalone single entry
      processedEntryIds.add(entry.id);
      const isSale = entry.entryType === 'sale';
      const isPayment = entry.entryType === 'payment';
      const amount = Number(entry.amount);
      const netChange = isSale ? amount : isPayment ? -amount : 0;

      groups.push({
        id: entry.id,
        createdAt: new Date(entry.createdAt),
        isGrouped: false,
        type: entry.entryType as any,
        billNumber: entry.bill?.billNumber,
        billId: entry.billId || undefined,
        paymentMode: entry.paymentMode || undefined,
        amount,
        netChange,
        runningBalance: Number(entry.balance),
        startingBalance: Number(entry.balance) - netChange,
        notes: entry.notes || undefined,
        allocations: [],
        rawEntries: [entry],
      });
    }

    return groups;
  }, [ledgerEntries, ledgerViewMode]);

  const totalPages = Math.ceil(totalEntries / PAGE_SIZE) || 1;

  if (loadingRetailer) {
    return (
      <Layout sidebarItems={ADMIN_SIDEBAR}>
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Loading retailer details…</p>
            </div>
          </div>
        </PageContainer>
      </Layout>
    );
  }

  if (error || !retailer) {
    return (
      <Layout sidebarItems={ADMIN_SIDEBAR}>
        <PageContainer>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto my-8">
            <p className="text-red-700 font-semibold mb-2">Error Loading Retailer</p>
            <p className="text-sm text-red-500 mb-4">{error || 'Retailer not found.'}</p>
            <Button onClick={() => navigate('/admin/retailers')} variant="secondary">
              Back to Retailers List
            </Button>
          </div>
        </PageContainer>
      </Layout>
    );
  }

  const totalCratesOwed = retailer.rgbBalances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/admin/retailers')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg shadow-2xs hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Retailers
            </button>
            <span className="text-xs text-gray-500 font-medium">
              Retailer ID: <code className="bg-gray-100 border border-gray-300 text-gray-700 px-2 py-0.5 rounded font-mono">{retailer.id.slice(0, 8)}</code>
            </span>
          </div>

          {/* Overview Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Shop Profile Details */}
            <Card className="md:col-span-1">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{retailer.shopName}</h3>
                    <p className="text-xs text-gray-500 font-medium">Retailer Profile</p>
                  </div>
                </div>
                <button
                  onClick={openEditModal}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg transition-colors"
                  title="Edit Retailer Details"
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Owner:</span>
                  <span className="text-gray-900 font-medium">{retailer.ownerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Phone:</span>
                  <a href={`tel:${retailer.mobileNumber}`} className="text-blue-600 font-medium hover:underline">
                    {retailer.mobileNumber}
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-700">Address: </span>
                    <span className="text-gray-900">{retailer.address}</span>
                    {retailer.deliveryLocation && (
                      <p className="text-gray-500 italic text-[11px] mt-0.5">
                        Note: {retailer.deliveryLocation}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Customer Since:</span>
                  <span className="text-gray-600">
                    {new Date(retailer.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card className="md:col-span-1">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Financial Ledger</h3>
                  <p className="text-xs text-gray-500 font-medium">Outstanding Balance</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-300 text-center shadow-2xs">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Net Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₨{Number(outstanding).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 font-medium">
                    {outstanding > 0 ? 'Retailer owes pending balance' : 'No outstanding debt'}
                  </p>
                </div>
              </div>
            </Card>

            {/* RGB Crate Balances */}
            <Card className="md:col-span-1">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">RGB Crates Summary</h3>
                  <p className="text-xs text-gray-500 font-medium">{totalCratesOwed} Total Crates Pending</p>
                </div>
              </div>

              {retailer.rgbBalances && retailer.rgbBalances.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {retailer.rgbBalances.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-300 text-xs shadow-2xs"
                    >
                      <span className="font-semibold text-gray-800 capitalize">
                        {b.rgbItem?.name || 'Crate Item'}
                      </span>
                      <span className={`font-bold px-2 py-0.5 rounded-md border ${b.balance > 0 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                        {b.balance} crates
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-300 p-4 rounded-xl text-center text-xs text-gray-500 italic">
                  No empty crate balances recorded for this retailer.
                </div>
              )}
            </Card>
          </div>

          {/* Ledger Entries Table Card */}
          <Card title="Ledger Audit Statement">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-500">
                  {ledgerViewMode === 'friendly'
                    ? 'Simplified transaction history with step-by-step udhaar payment breakdowns.'
                    : 'Double-entry transaction audit log detailing every debit, credit, and running balance.'}
                </p>
              </div>

              {/* View Switcher Controls */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {loadingLedger && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 font-medium mr-2">
                    <RefreshCw size={12} className="animate-spin" />
                    <span className="hidden sm:inline">Refreshing…</span>
                  </div>
                )}
                <div className="inline-flex p-0.5 bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setLedgerViewMode('friendly')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      ledgerViewMode === 'friendly'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Sparkles size={13} className="text-blue-600" />
                    Friendly View
                  </button>
                  <button
                    onClick={() => setLedgerViewMode('detailed')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      ledgerViewMode === 'detailed'
                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Layers size={13} className="text-gray-500" />
                    Detailed Audit Log
                  </button>
                </div>
              </div>
            </div>

            {/* ── Table Container ── */}
            <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-2xs">
              {ledgerViewMode === 'friendly' ? (
                /* ── 1. FRIENDLY GROUPED VIEW ── */
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 uppercase border-b-2 border-gray-300 font-bold tracking-wider text-[11px]">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Transaction Type</th>
                      <th className="py-3 px-4">Bill Ref</th>
                      <th className="py-3 px-4 text-right">Sale / Paid</th>
                      <th className="py-3 px-4 text-center">Debt Impact</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                      <th className="py-3 px-4 text-center">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {groupedTransactions.length > 0 ? (
                      groupedTransactions.map((group) => {
                        const isExpanded = expandedGroupIds.has(group.id);
                        const badge = ENTRY_TYPE_BADGES[group.type] || {
                          bg: 'bg-gray-100',
                          text: 'text-gray-700',
                          label: group.type,
                        };

                        return (
                          <React.Fragment key={group.id}>
                            <tr
                              className={`transition-colors border-b border-gray-200 ${
                                isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50/80'
                              }`}
                            >
                              {/* Date & Time */}
                              <td className="py-3 px-4 text-gray-700 font-medium whitespace-nowrap">
                                {group.createdAt.toLocaleString('en-PK', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </td>

                              {/* Type Badge */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-bold text-[11px] border border-gray-200 ${badge.bg} ${badge.text}`}
                                >
                                  {badge.label}
                                </span>
                                {group.isGrouped && (
                                  <span className="block text-[10px] text-gray-500 mt-0.5 font-medium">
                                    {group.allocations.length} bill allocations
                                  </span>
                                )}
                              </td>

                              {/* Bill Ref */}
                              <td className="py-3 px-4 font-mono font-bold text-gray-800">
                                {group.billNumber ? `#${group.billNumber}` : '—'}
                              </td>

                              {/* Sale / Paid Amounts */}
                              <td className="py-3 px-4 text-right">
                                {group.isGrouped ? (
                                  <div className="space-y-0.5">
                                    {group.saleAmount !== undefined && (
                                      <div className="text-gray-900 font-bold">
                                        Sale: ₨{group.saleAmount.toLocaleString('en-PK')}
                                      </div>
                                    )}
                                    {group.paidAmount !== undefined && group.paidAmount > 0 && (
                                      <div className="text-emerald-700 font-semibold text-[11px]">
                                        Paid: ₨{group.paidAmount.toLocaleString('en-PK')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="font-bold text-gray-900">
                                    ₨{group.amount.toLocaleString('en-PK')}
                                  </span>
                                )}
                              </td>

                              {/* Debt Impact Badge */}
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {group.netChange < 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    −₨{Math.abs(group.netChange).toLocaleString('en-PK')} (Reduced)
                                  </span>
                                ) : group.netChange > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    +₨{group.netChange.toLocaleString('en-PK')} (Added)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    ₨0 (Net Cleared)
                                  </span>
                                )}
                              </td>

                              {/* Running Balance */}
                              <td className="py-3 px-4 text-right font-extrabold text-gray-900">
                                ₨{group.runningBalance.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                              </td>

                              {/* Action / Dropdown Toggle */}
                              <td className="py-3 px-4 text-center">
                                {group.isGrouped ? (
                                  <button
                                    onClick={() => toggleExpandGroup(group.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                                      isExpanded
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                    }`}
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Explain'}</span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-xs truncate max-w-[120px] inline-block">
                                    {group.notes || '—'}
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* ── EXPANDED BREAKDOWN ACCORDION ── */}
                            {isExpanded && group.isGrouped && (
                              <tr>
                                <td colSpan={7} className="p-0 border-b border-blue-200 bg-blue-50/40">
                                  <div className="p-4 sm:p-5 space-y-4">
                                    {/* Header Banner */}
                                    <div className="flex items-center justify-between border-b border-blue-200/80 pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                                          <Package size={16} />
                                        </div>
                                        <div>
                                          <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                                            Step-by-Step Breakdown for Bill #{group.billNumber}
                                          </h4>
                                          <p className="text-[11px] text-gray-500">
                                            Clear breakdown of sale charge, payment distribution, and net balance change.
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-[11px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md">
                                        Total Paid: ₨{group.paidAmount?.toLocaleString('en-PK')}
                                      </span>
                                    </div>

                                    {/* 3 Step Timeline Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                      {/* Step 1: Sale */}
                                      <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs flex flex-col justify-between">
                                        <div>
                                          <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs mb-1.5">
                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">
                                              1
                                            </span>
                                            New Purchase (Sale)
                                          </div>
                                          <p className="text-gray-700 text-xs">
                                            Bill <span className="font-mono font-bold">#{group.billNumber}</span> was created for{' '}
                                            <span className="font-bold text-gray-900">
                                              ₨{group.saleAmount?.toLocaleString('en-PK')}
                                            </span>.
                                          </p>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                                          Debt temporarily added (+₨{group.saleAmount?.toLocaleString('en-PK')})
                                        </div>
                                      </div>

                                      {/* Step 2: Payment Distribution */}
                                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
                                        <div>
                                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1.5">
                                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                                              2
                                            </span>
                                            Payment Distributed
                                          </div>
                                          <div className="space-y-1.5 mt-1">
                                            {group.allocations.map((alloc, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-start justify-between gap-1 text-[11px] bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-100"
                                              >
                                                <div>
                                                  <span className="font-mono font-bold text-emerald-950">
                                                    #{alloc.billNumber}
                                                  </span>{' '}
                                                  <span className="text-gray-500 text-[10px]">
                                                    ({alloc.isNewBill ? 'This Bill' : 'Old Bill'})
                                                  </span>
                                                </div>
                                                <span className="font-bold text-emerald-700 shrink-0">
                                                  −₨{alloc.amount.toLocaleString('en-PK')}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-emerald-700 font-semibold">
                                          Total Applied: ₨{group.paidAmount?.toLocaleString('en-PK')}
                                        </div>
                                      </div>

                                      {/* Step 3: Net Balance Result */}
                                      <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs flex flex-col justify-between">
                                        <div>
                                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs mb-1.5">
                                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px]">
                                              3
                                            </span>
                                            Final Balance Result
                                          </div>
                                          <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-600 text-[11px]">
                                              <span>Starting Balance:</span>
                                              <span className="font-medium">₨{group.startingBalance.toLocaleString('en-PK')}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600 text-[11px]">
                                              <span>Net Movement:</span>
                                              <span className={group.netChange <= 0 ? 'text-emerald-600 font-bold' : 'text-amber-700 font-bold'}>
                                                {group.netChange <= 0 ? '−' : '+'}₨{Math.abs(group.netChange).toLocaleString('en-PK')}
                                              </span>
                                            </div>
                                            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1 text-xs">
                                              <span>Final Balance:</span>
                                              <span className="text-blue-700 font-extrabold text-sm">
                                                ₨{group.runningBalance.toLocaleString('en-PK')}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                                          {group.netChange < 0
                                            ? `Net debt decreased by ₨${Math.abs(group.netChange).toLocaleString('en-PK')} ✅`
                                            : group.netChange === 0
                                            ? 'Bill paid in exact full (₨0 net debt change) ✅'
                                            : `Debt increased by ₨${group.netChange.toLocaleString('en-PK')}`}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                          {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* ── 2. DETAILED AUDIT LOG (Raw Single Entries) ── */
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 uppercase border-b-2 border-gray-300 font-bold tracking-wider text-[11px]">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Bill Ref</th>
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {ledgerEntries.length > 0 ? (
                      ledgerEntries.map((entry) => {
                        const badge = ENTRY_TYPE_BADGES[entry.entryType.toLowerCase()] || {
                          bg: 'bg-gray-100',
                          text: 'text-gray-700',
                          label: entry.entryType,
                        };

                        return (
                          <tr key={entry.id} className="hover:bg-blue-50/40 transition-colors border-b border-gray-200">
                            <td className="py-3 px-4 text-gray-700 font-medium whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleString('en-PK', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-bold text-[11px] border border-gray-200 ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-gray-800">
                              {entry.bill?.billNumber ? `#${entry.bill.billNumber}` : '—'}
                            </td>
                            <td className="py-3 px-4 capitalize text-gray-700 font-medium">
                              {entry.paymentMode ? entry.paymentMode.replace('_', ' ') : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">
                              ₨{Number(entry.amount).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-gray-900">
                              ₨{Number(entry.balance).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                            </td>
                            <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                              {entry.notes || '—'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                          {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {totalEntries > 0 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-300 text-xs">
                <p className="text-gray-600 font-medium">
                  Showing <span className="font-bold text-gray-800">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                  <span className="font-bold text-gray-800">{Math.min(page * PAGE_SIZE, totalEntries)}</span> of{' '}
                  <span className="font-bold text-gray-800">{totalEntries}</span> entries
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1 || loadingLedger}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-gray-700 shadow-2xs"
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>

                  <span className="px-2 font-bold text-gray-700">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages || loadingLedger}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-gray-700 shadow-2xs"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </PageContainer>

      {/* Edit Retailer Details Modal */}
      <Modal
        isOpen={isEditModalOpen}
        title="Edit Retailer Details"
        onClose={() => setIsEditModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={submittingEdit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {submittingEdit ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Shop Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.shopName ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.shopName}
              onChange={(e) => setEditForm({ ...editForm, shopName: e.target.value })}
              placeholder="e.g. Al-Madina Traders"
            />
            {editFormErrors.shopName && <p className="text-red-500 text-xs mt-1">{editFormErrors.shopName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Owner Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.ownerName ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.ownerName}
              onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
              placeholder="e.g. Muhammad Ali"
            />
            {editFormErrors.ownerName && <p className="text-red-500 text-xs mt-1">{editFormErrors.ownerName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.mobileNumber ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.mobileNumber}
              onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
              placeholder="e.g. 03001234567"
            />
            {editFormErrors.mobileNumber && <p className="text-red-500 text-xs mt-1">{editFormErrors.mobileNumber}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.address ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              placeholder="e.g. Shop #12, Main Bazaar, Lahore"
            />
            {editFormErrors.address && <p className="text-red-500 text-xs mt-1">{editFormErrors.address}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Delivery Directions / Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              value={editForm.deliveryLocation}
              onChange={(e) => setEditForm({ ...editForm, deliveryLocation: e.target.value })}
              placeholder="e.g. Near Bus Stop"
            />
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
