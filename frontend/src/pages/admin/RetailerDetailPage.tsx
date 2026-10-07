import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Modal } from '../../components/common';
import { Card, StatIcon, Figure } from '../../components/ui/Card';
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
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Pencil,
  Package,
  Layers,
  Sparkles,
  Printer,
  FileText,
} from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { retailersService } from '../../services/retailers';
import { billsService } from '../../services/bills';
import { Retailer, LedgerEntry, Bill } from '../../types';
import { ExpandableBillRow } from '../../components/bills/ExpandableBillRow';

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

  const [outstanding, setOutstanding] = useState(0);

  const [loadingRetailer, setLoadingRetailer] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [error, setError] = useState('');

  // Record Payment (retailer-level FIFO) state
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [recordPaymentAmount, setRecordPaymentAmount] = useState('');
  const [recordPaymentLoading, setRecordPaymentLoading] = useState(false);

  // Pending Bills (Consolidated) Modal State
  const [isConsolidatedModalOpen, setIsConsolidatedModalOpen] = useState(false);
  const [consolidatedBills, setConsolidatedBills] = useState<Bill[]>([]);
  const [consolidatedLoading, setConsolidatedLoading] = useState(false);
  const [consolidatedFetched, setConsolidatedFetched] = useState(false);

  // Date Range Report Modal State
  const [isDateReportModalOpen, setIsDateReportModalOpen] = useState(false);
  const [dateReportStart, setDateReportStart] = useState('');
  const [dateReportEnd, setDateReportEnd] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'this_month' | 'last_30' | 'all' | null>(null);
  const [dateReportLoading, setDateReportLoading] = useState(false);
  const [dateReportBills, setDateReportBills] = useState<Bill[]>([]);
  const [dateReportFetched, setDateReportFetched] = useState(false);

  // Friendly Grouped View vs Raw Audit Log View
  const [ledgerViewMode, setLedgerViewMode] = useState<'friendly' | 'detailed'>('friendly');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  // Fetch pending & partial bills from the Bill table
  const handleFetchPendingBills = async () => {
    if (!id) return;
    setConsolidatedLoading(true);
    try {
      const [pendingRes, partialRes] = await Promise.all([
        billsService.list({ retailerId: id, status: 'pending' as any, limit: 500, offset: 0 }),
        billsService.list({ retailerId: id, status: 'partial' as any, limit: 500, offset: 0 }),
      ]);
      const combined = [
        ...(pendingRes.bills || []),
        ...(partialRes.bills || []),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setConsolidatedBills(combined);
      setConsolidatedFetched(true);
    } catch {
      store.addNotification('error', 'Failed to load pending bills.');
    } finally {
      setConsolidatedLoading(false);
    }
  };

  // Fetch bills for Date Range Report
  const handleFetchDateReport = async (start = dateReportStart, end = dateReportEnd, isAllTimePreset = false) => {
    if (!id) return;
    setDateReportLoading(true);
    try {
      const isAllTime = isAllTimePreset || (!start && !end);
      const res = await billsService.list({
        retailerId: id,
        limit: 500,
        offset: 0,
        startDate: isAllTime ? undefined : (start || undefined),
        endDate: isAllTime ? undefined : (end || undefined),
      } as any);
      const bills = res.bills || [];
      setDateReportBills(bills);
      setDateReportFetched(true);

      // If All Time was selected or both dates were empty, populate the date inputs with the first and last bill dates
      if (isAllTime && bills.length > 0) {
        const timestamps = bills.map((b) => new Date(b.createdAt).getTime());
        const minDateStr = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
        const maxDateStr = new Date(Math.max(...timestamps)).toISOString().split('T')[0];
        setDateReportStart(minDateStr);
        setDateReportEnd(maxDateStr);
      }
    } catch {
      store.addNotification('error', 'Failed to load bills.');
    } finally {
      setDateReportLoading(false);
    }
  };

  // Select a quick date preset and update/refresh preview
  const handleSelectPreset = (presetKey: 'today' | 'this_month' | 'last_30' | 'all') => {
    setActiveDatePreset(presetKey);
    let start = '';
    let end = '';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (presetKey === 'today') {
      start = todayStr;
      end = todayStr;
      setDateReportStart(start);
      setDateReportEnd(end);
    } else if (presetKey === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      end = todayStr;
      setDateReportStart(start);
      setDateReportEnd(end);
    } else if (presetKey === 'last_30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
      end = todayStr;
      setDateReportStart(start);
      setDateReportEnd(end);
    } else if (presetKey === 'all') {
      start = '';
      end = '';
      setDateReportStart('');
      setDateReportEnd('');
    }

    // Automatically fetch and show the bills for the selected preset
    handleFetchDateReport(start, end, presetKey === 'all');
  };


  // Direct print pending bills (fetches if not already loaded)
  const handleDirectPrintPendingBills = async () => {
    if (consolidatedBills.length > 0) {
      handlePrintConsolidatedBill(consolidatedBills);
      return;
    }
    if (!id) return;
    setConsolidatedLoading(true);
    try {
      const [pendingRes, partialRes] = await Promise.all([
        billsService.list({ retailerId: id, status: 'pending' as any, limit: 500, offset: 0 }),
        billsService.list({ retailerId: id, status: 'partial' as any, limit: 500, offset: 0 }),
      ]);
      const combined = [
        ...(pendingRes.bills || []),
        ...(partialRes.bills || []),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setConsolidatedBills(combined);
      setConsolidatedFetched(true);
      if (combined.length > 0) {
        handlePrintConsolidatedBill(combined);
      } else {
        store.addNotification('info', 'No pending bills found to print.');
      }
    } catch {
      store.addNotification('error', 'Failed to load bills for printing.');
    } finally {
      setConsolidatedLoading(false);
    }
  };

  // Direct print date range report (fetches if not already loaded)
  const handleDirectPrintDateReport = async () => {
    if (dateReportBills.length > 0) {
      handlePrintDateReport(dateReportBills, dateReportStart, dateReportEnd);
      return;
    }
    if (!id) return;
    setDateReportLoading(true);
    try {
      const isAllTime = activeDatePreset === 'all' || (!dateReportStart && !dateReportEnd);
      const res = await billsService.list({
        retailerId: id,
        limit: 500,
        offset: 0,
        startDate: isAllTime ? undefined : (dateReportStart || undefined),
        endDate: isAllTime ? undefined : (dateReportEnd || undefined),
      } as any);
      const bills = res.bills || [];
      setDateReportBills(bills);
      setDateReportFetched(true);
      if (bills.length > 0) {
        if (isAllTime) {
          const timestamps = bills.map((b) => new Date(b.createdAt).getTime());
          const minDateStr = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
          const maxDateStr = new Date(Math.max(...timestamps)).toISOString().split('T')[0];
          setDateReportStart(minDateStr);
          setDateReportEnd(maxDateStr);
          handlePrintDateReport(bills, minDateStr, maxDateStr);
        } else {
          handlePrintDateReport(bills, dateReportStart, dateReportEnd);
        }
      } else {
        store.addNotification('info', 'No bills found in selected date range to print.');
      }
    } catch {
      store.addNotification('error', 'Failed to load bills for printing.');
    } finally {
      setDateReportLoading(false);
    }
  };



  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };


  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fmt = (n: number) => n.toLocaleString('en-PK');
  const fmtDate = (d: Date | string) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
  };
  const LINE = '----------------------------------------';


  // Print Consolidated Bill Thermal Statement — sources from Bill records directly
  const handlePrintConsolidatedBill = (bills: Bill[]) => {
    if (!retailer) return;
    const grandTotal = bills.reduce((s, b) => s + Number(b.pendingAmount), 0);
    const W = 40; // thermal width chars

    const header = [
      LINE,
      '             ABDULHAQ'.padEnd(W),
      LINE,
      `Date: ${new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}`,
      `Retailer: ${retailer.shopName} (${retailer.ownerName})`,
      `Phone: ${retailer.mobileNumber || 'N/A'}`,
      `Address: ${retailer.address}`,
      LINE,
      `PENDING BILLS (${bills.length})`,
      LINE,
      'Bill         Date      Sale    Paid    Due',
    ].join('\n');

    const rows = bills.map((b) => {
      const billShort = `#${b.billNumber.replace(/^BL-\d{8}-/, '')}`.padEnd(13);
      const dateS = fmtDate(b.createdAt).padEnd(10);
      const sale = fmt(Number(b.total)).padStart(6);
      const paid = fmt(Number(b.paidAmount)).padStart(6);
      const due  = fmt(Number(b.pendingAmount)).padStart(6);
      return `${billShort}${dateS}${sale}  ${paid}  ${due}`;
    }).join('\n');

    const footer = [
      LINE,
      `TOTAL OUTSTANDING:${fmt(grandTotal).padStart(W - 18)}`,
      LINE,
      '       Thank you for your business!',
    ].join('\n');

    const content = `${header}\n${rows}\n${footer}`;
    const w = window.open('', '', 'height=600,width=800');
    if (w) {
      w.document.write(
        `<html><head><title>Consolidated Statement - ${retailer.shopName}</title><style>body{font-family:monospace;padding:20px;font-size:12px;}pre{white-space:pre;}</style></head><body><pre>${content}</pre><script>window.print();window.close();<\/script></body></html>`
      );
      w.document.close();
    }
  };

  // Print Date Range Statement — sources from Bill records directly (one row per bill)
  const handlePrintDateReport = (bills: Bill[], startDate?: string, endDate?: string) => {
    if (!retailer) return;
    const W = 40;

    const totalSales = bills.reduce((s, b) => s + Number(b.total), 0);
    const totalPaid  = bills.reduce((s, b) => s + Number(b.paidAmount), 0);
    const totalDue   = bills.reduce((s, b) => s + Number(b.pendingAmount), 0);

    const fmtPeriodDate = (val?: string | Date) => {
      if (!val) return '';
      if (typeof val === 'string' && val.includes('-')) {
        const parts = val.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts;
          return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }
      }
      const dt = new Date(val);
      if (isNaN(dt.getTime())) return String(val);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      return `${day}/${month}/${year}`;
    };

    let startFormatted = fmtPeriodDate(startDate);
    let endFormatted = fmtPeriodDate(endDate);

    // If dates are not set (e.g. All Time), derive from earliest and latest bill in dataset
    if ((!startFormatted || !endFormatted) && bills.length > 0) {
      const timestamps = bills.map((b) => new Date(b.createdAt).getTime());
      const minDate = new Date(Math.min(...timestamps));
      const maxDate = new Date(Math.max(...timestamps));
      if (!startFormatted) startFormatted = fmtPeriodDate(minDate);
      if (!endFormatted) endFormatted = fmtPeriodDate(maxDate);
    }
    if (!startFormatted) startFormatted = fmtPeriodDate(new Date());
    if (!endFormatted) endFormatted = fmtPeriodDate(new Date());

    const header = [
      LINE,
      '             ABDULHAQ'.padEnd(W),
      LINE,
      `Period: ${startFormatted} - ${endFormatted}`,
      `RETAILER: ${retailer.shopName} (${retailer.ownerName})`,
      `Phone: ${retailer.mobileNumber || 'N/A'}`,
      `Address: ${retailer.address}`,
      LINE,
      `BILLS (${bills.length})`,
      LINE,
      'Date       Bill No.      Amount  Status',
    ].join('\n');

    const rows = bills.map((b) => {
      const dateS  = fmtDate(b.createdAt).padEnd(11);
      const billNo = `#${b.billNumber.replace(/^BL-\d{8}-/, '')}`.padEnd(14);
      const amt    = fmt(Number(b.total)).padStart(6);
      const status = (b.status === 'paid' ? 'PAID' : b.status === 'partial' ? 'PARTIAL' : 'UNPAID').padStart(8);
      return `${dateS}${billNo}${amt}${status}`;
    }).join('\n');

    const footer = [
      LINE,
      `TOTAL BILLS: ${bills.length}`,
      `TOTAL SALES: Rs ${fmt(totalSales)}`,
      LINE,
      `Paid:        Rs ${fmt(totalPaid)}`,
      `Outstanding: Rs ${fmt(totalDue)}`,
      LINE,
      '       Thank you for your business!',
    ].join('\n');

    const content = `${header}\n${rows}\n${footer}`;
    const w = window.open('', '', 'height=600,width=800');
    if (w) {
      w.document.write(
        `<html><head><title>Date Range Report - ${retailer.shopName}</title><style>body{font-family:monospace;padding:20px;font-size:12px;}pre{white-space:pre;}</style></head><body><pre>${content}</pre><script>window.print();window.close();<\/script></body></html>`
      );
      w.document.close();
    }
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

  // Load ALL ledger entries in a single request (no pagination — scale is small enough)
  useEffect(() => {
    if (!id) return;
    setLoadingLedger(true);
    retailersService
      .getLedger(id)
      .then((data) => {
        setLedgerEntries(data.entries || []);
        if (typeof data.outstanding === 'number') {
          setOutstanding(data.outstanding);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch ledger:', err);
      })
      .finally(() => setLoadingLedger(false));
  }, [id]);

  const refreshRetailerData = async () => {
    if (!id) return;
    try {
      const [updatedRetailer, ledgerData] = await Promise.all([
        retailersService.getById(id),
        retailersService.getLedger(id),
      ]);
      setRetailer(updatedRetailer);
      if (typeof updatedRetailer.outstanding === 'number') {
        setOutstanding(updatedRetailer.outstanding);
      }
      setLedgerEntries(ledgerData.entries || []);
      if (typeof ledgerData.outstanding === 'number') {
        setOutstanding(ledgerData.outstanding);
      }
      store.fetchRetailers();
    } catch (err) {
      console.error('Failed to refresh retailer data after payment:', err);
    }
  };

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

    const groups: GroupedLedgerTransaction[] = [];
    const processedEntryIds = new Set<string>();

    for (let i = 0; i < ledgerEntries.length; i++) {
      const entry = ledgerEntries[i];
      if (processedEntryIds.has(entry.id)) continue;

      // Always group by the entry's OWN bill (its billId / bill.billNumber).
      // Never use notes-based origin as the grouping key — "Udhaar allocation from BL-XXXX"
      // in notes means BL-XXXX funded this payment, NOT that this entry belongs to BL-XXXX.
      const targetOriginBill = entry.bill?.billNumber;

      if (targetOriginBill) {
        // Cluster ALL ledger entries whose billId directly references this bill.
        // Do NOT use candidateOrigin (notes-based attribution) — a payment entry's notes
        // say "funded by BL-XXXX" but the entry itself belongs to the OLD bill that was paid.
        const cluster = ledgerEntries.filter((candidate) => {
          if (processedEntryIds.has(candidate.id)) return false;
          const candidateBillNum = candidate.bill?.billNumber;
          return candidateBillNum === targetOriginBill;
        });

        if (cluster.length > 0) {
          cluster.forEach((c) => processedEntryIds.add(c.id));

          const saleEntry = cluster.find((c) => c.entryType === 'sale');
          const paymentEntries = cluster.filter((c) => c.entryType === 'payment');

          const saleAmount = saleEntry ? Number(saleEntry.amount) : 0;
          const totalPaid = paymentEntries.reduce((sum, p) => sum + Number(p.amount), 0);

          const newestEntry = [...cluster].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          const oldestEntry = [...cluster].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )[0];

          const originTimestamp = saleEntry
            ? new Date(saleEntry.createdAt)
            : new Date(oldestEntry.createdAt);

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
            id: `group-${targetOriginBill}`,
            createdAt: originTimestamp,
            isGrouped: true,
            type: totalPaid > 0 && saleAmount > 0 ? 'sale_with_allocation' : saleEntry ? 'sale' : 'payment',
            billNumber: targetOriginBill,
            billId: saleEntry?.billId || cluster.find((c) => c.billId)?.billId,
            paymentMode: saleEntry?.paymentMode || paymentEntries[0]?.paymentMode || 'cash',
            saleAmount: saleAmount > 0 ? saleAmount : undefined,
            paidAmount: totalPaid,
            amount: saleAmount > 0 ? saleAmount : totalPaid,
            netChange,
            runningBalance: finalBalance,
            startingBalance,
            notes: saleEntry?.notes || `Payments totaling ₨${totalPaid.toLocaleString('en-PK')} across ${paymentEntries.length} record(s)`,
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
        saleAmount: isSale ? amount : undefined,
        paidAmount: isPayment ? amount : 0,
        amount,
        netChange,
        runningBalance: Number(entry.balance),
        startingBalance: Number(entry.balance) - netChange,
        notes: entry.notes || undefined,
        allocations: [],
        rawEntries: [entry],
      });
    }

    // Sort stably by ORIGINAL bill / transaction date (newest first)
    // PART A: Exclude fully-PAID bills (netChange <= 0) from Friendly View — only show active PENDING / PARTIAL bills
    const activeGroups = groups.filter((g) => g.netChange > 0);

    return activeGroups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ledgerEntries, ledgerViewMode]);

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
          <div className="bg-danger-50 border border-danger-500/30 p-6 rounded-card text-center space-y-3">
            <h2 className="text-lg font-bold text-danger-500">Retailer Not Found</h2>
            <p className="text-sm text-ink-muted">{error || 'Retailer profile does not exist.'}</p>
            <button
              onClick={() => navigate('/admin/retailers')}
              className="px-4 py-2 bg-surface-card border border-border text-ink rounded-control font-semibold hover:bg-surface-muted text-xs transition-colors"
            >
              ← Back to Retailers List
            </button>
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-ink bg-surface-card border border-border rounded-control hover:bg-surface-muted transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Retailers
            </button>
            <span className="text-xs text-ink-muted font-medium">
              Retailer ID: <code className="bg-surface-muted border border-border text-ink px-2 py-0.5 rounded-control font-mono">{retailer.id.slice(0, 8)}</code>
            </span>
          </div>

          {/* Overview Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Shop Profile Details */}
            <Card variant="default" className="md:col-span-1">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-control bg-brand-500/10 border border-brand-500/30 text-brand-600 flex items-center justify-center font-bold">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base">{retailer.shopName}</h3>
                    <p className="text-xs text-ink-muted font-medium">Retailer Profile</p>
                  </div>
                </div>
                <button
                  onClick={openEditModal}
                  className="p-1.5 text-ink-subtle hover:text-brand-600 hover:bg-surface-muted border border-transparent rounded-control transition-colors"
                  title="Edit Retailer Details"
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-ink-muted">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-ink-subtle flex-shrink-0" />
                  <span className="font-medium text-ink-muted">Owner:</span>
                  <span className="text-ink font-medium">{retailer.ownerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-ink-subtle flex-shrink-0" />
                  <span className="font-medium text-ink-muted">Phone:</span>
                  <a href={`tel:${retailer.mobileNumber}`} className="text-brand-600 font-medium hover:underline">
                    {retailer.mobileNumber}
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-ink-subtle flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-ink-muted">Address: </span>
                    <span className="text-ink">{retailer.address}</span>
                    {retailer.deliveryLocation && (
                      <p className="text-ink-subtle italic text-[11px] mt-0.5">
                        Note: {retailer.deliveryLocation}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Calendar size={14} className="text-ink-subtle flex-shrink-0" />
                  <span className="font-medium text-ink-muted">Customer Since:</span>
                  <span className="text-ink">
                    {new Date(retailer.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card variant="stat" className="md:col-span-1">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border">
                <StatIcon icon={<CreditCard size={20} />} tone={outstanding > 0 ? 'danger' : 'success'} />
                <div>
                  <h3 className="font-bold text-ink text-base">Financial Ledger</h3>
                  <p className="text-xs text-ink-muted font-medium">Outstanding Balance</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-surface-muted/60 p-4 rounded-card border border-border text-center">
                  <p className="text-xs font-semibold text-ink-muted mb-1">Net Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${outstanding > 0 ? 'text-danger-500' : 'text-success-500'}`}>
                    ₨<Figure>{Number(outstanding).toFixed(0)}</Figure>
                  </p>
                  <p className="text-[11px] text-ink-muted mt-1 font-medium">
                    {outstanding > 0 ? 'Retailer owes pending balance' : 'No outstanding debt'}
                  </p>
                </div>

                {/* Compact Record Payment */}
                {outstanding > 0 && (
                  <div className="border border-border rounded-control bg-surface-muted/50">
                    {!showRecordPayment ? (
                      <button
                        onClick={() => {
                          setShowRecordPayment(true);
                          setRecordPaymentAmount('');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-brand-700 hover:bg-brand-600 text-white rounded-control transition-colors"
                      >
                        <span className="text-base leading-none">+</span> Record Payment
                      </button>
                    ) : (
                      <form
                        className="p-2.5 space-y-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const amt = parseFloat(recordPaymentAmount);
                          if (isNaN(amt) || amt <= 0) {
                            store.addNotification('error', 'Enter a valid amount > 0');
                            return;
                          }
                          setRecordPaymentLoading(true);
                          try {
                            const { plan } = await retailersService.recordPayment(id!, amt);
                            const billsPaid = plan.entries.filter((e) => e.newStatus === 'paid').length;
                            const billsPartial = plan.entries.filter((e) => e.newStatus === 'partial').length;
                            const parts: string[] = [];
                            if (billsPaid > 0) parts.push(`${billsPaid} bill${billsPaid > 1 ? 's' : ''} paid`);
                            if (billsPartial > 0) parts.push(`${billsPartial} partially paid`);
                            store.addNotification(
                              'success',
                              `₨${plan.totalApplied.toLocaleString('en-PK')} applied — ${parts.join(', ')}${
                                plan.excessAmount > 0 ? ` (₨${plan.excessAmount.toLocaleString('en-PK')} excess)` : ''
                              }`,
                            );
                            setShowRecordPayment(false);
                            setRecordPaymentAmount('');
                            await refreshRetailerData();
                          } catch (err: any) {
                            const msg = err.response?.data?.message || err.message || 'Payment failed.';
                            store.addNotification('error', msg);
                          } finally {
                            setRecordPaymentLoading(false);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-ink">Record Payment (FIFO)</span>
                          <button
                            type="button"
                            onClick={() => setShowRecordPayment(false)}
                            className="text-ink-subtle hover:text-ink text-[10px] font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="any"
                            required
                            value={recordPaymentAmount}
                            onChange={(e) => setRecordPaymentAmount(e.target.value)}
                            placeholder="Amount (₨)"
                            className="input-field text-xs font-bold py-1 flex-1"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setRecordPaymentAmount(String(outstanding))}
                            className="px-2 py-1 bg-surface-muted hover:bg-border/50 text-ink rounded-control font-semibold text-[10px] shrink-0 border border-border"
                          >
                            Full
                          </button>
                          <button
                            type="submit"
                            disabled={recordPaymentLoading}
                            className="bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold px-3 py-1 rounded-control text-[11px] transition-colors shrink-0"
                          >
                            {recordPaymentLoading ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                        <p className="text-[10px] text-ink-muted italic">Oldest bills paid first (FIFO)</p>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* RGB Crate Balances */}
            <Card variant="stat" className="md:col-span-1">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border">
                <StatIcon icon={<Boxes size={20} />} tone="warning" />
                <div>
                  <h3 className="font-bold text-ink text-base">RGB Crates Summary</h3>
                  <p className="text-xs text-ink-muted font-medium"><Figure>{totalCratesOwed}</Figure> Total Crates Pending</p>
                </div>
              </div>

              {retailer.rgbBalances && retailer.rgbBalances.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {retailer.rgbBalances.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2.5 bg-surface-card rounded-control border border-border text-xs shadow-xs"
                    >
                      <span className="font-semibold text-ink capitalize">
                        {b.rgbItem?.name || 'Crate Item'}
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded-control border bg-surface-muted text-ink border-border">
                        <Figure>{b.balance}</Figure> crates
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface-card border border-border p-4 rounded-card text-center text-xs text-ink-subtle italic">
                  No empty crate balances recorded for this retailer.
                </div>
              )}
            </Card>
          </div>

          {/* Ledger Entries Table Card */}
          <Card variant="default">
            {/* Header: Title, Description & Action Controls */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-ink">Ledger Audit Statement</h3>
                    {loadingLedger && (
                      <div className="flex items-center gap-1 text-xs text-brand-600 font-medium">
                        <RefreshCw size={12} className="animate-spin" />
                        <span className="hidden sm:inline">Refreshing…</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {ledgerViewMode === 'friendly'
                      ? 'Simplified transaction history with step-by-step udhaar payment breakdowns.'
                      : 'Double-entry transaction audit log detailing every debit, credit, and running balance.'}
                  </p>
                </div>

                {/* View Switcher Controls & Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {outstanding > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setConsolidatedBills([]);
                        setConsolidatedFetched(false);
                        setIsConsolidatedModalOpen(true);
                      }}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs border border-border bg-surface-muted text-ink hover:bg-border/50 font-semibold py-1.5 px-2.5"
                    >
                      <FileText size={14} className="text-ink-muted shrink-0" />
                      <span>Pending Bills</span>
                    </Button>
                  )}

                  {/* Date Range Report Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsDateReportModalOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs border border-border bg-surface-muted text-ink hover:bg-border/50 font-semibold py-1.5 px-2.5"
                  >
                    <Calendar size={14} className="text-ink-muted shrink-0" />
                    <span>Date Report</span>
                  </Button>

                  <div className="w-full sm:w-auto inline-flex p-0.5 bg-surface-muted border border-border rounded-control text-xs font-semibold">
                    <button
                      onClick={() => setLedgerViewMode('friendly')}
                      className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-control transition-all flex items-center justify-center gap-1 ${
                        ledgerViewMode === 'friendly'
                          ? 'bg-surface-card text-brand-600 shadow-xs font-bold'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <Sparkles size={13} className="text-brand-600 shrink-0" />
                      <span>Friendly View</span>
                    </button>
                    <button
                      onClick={() => setLedgerViewMode('detailed')}
                      className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-control transition-all flex items-center justify-center gap-1 ${
                        ledgerViewMode === 'detailed'
                          ? 'bg-surface-card text-brand-600 shadow-xs font-bold'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <Layers size={13} className="text-ink-subtle shrink-0" />
                      <span>Detailed Audit</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Content Container (Desktop Table + Mobile Card Feed) ── */}
            <div className="border border-border rounded-card overflow-hidden">
              {ledgerViewMode === 'friendly' ? (
                <>
                  {/* ── 1A. DESKTOP FRIENDLY GROUPED VIEW (Table) ── */}
                  <div className="hidden md:block overflow-y-auto max-h-[calc(100vh-270px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 z-20 shadow-xs">
                        <tr className="bg-surface-muted text-ink-subtle uppercase border-b border-border-strong font-bold tracking-wider text-[11px]">
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-3">Date & Time</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5">Type</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5">Bill Ref</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5 text-right">Sale Total</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5 text-right font-bold text-success-500">Paid</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5 text-center">Remaining</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5 text-center">Breakdown & Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-surface-card">
                        {groupedTransactions.length > 0 ? (
                          groupedTransactions.map((group) => {
                            const isExpanded = expandedGroupIds.has(group.id);
                            const badge = ENTRY_TYPE_BADGES[group.type] || {
                              bg: 'bg-surface-muted border-border',
                              text: 'text-ink-muted',
                              label: group.type,
                            };

                            return (
                              <React.Fragment key={group.id}>
                                <tr
                                  className={`transition-colors border-b border-border ${
                                    isExpanded ? 'bg-info-50/30' : 'hover:bg-surface-muted/50'
                                  }`}
                                >
                                  {/* Date & Time (Stacked) */}
                                  <td className="py-2.5 px-3 text-ink-muted font-medium">
                                    <div className="text-ink font-semibold whitespace-nowrap">
                                      {group.createdAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                    <div className="text-[10px] text-ink-subtle">
                                      {group.createdAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </td>

                                  {/* Type Badge */}
                                  <td className="py-2.5 px-2.5">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-control font-bold text-[11px] border ${badge.bg} ${badge.text}`}
                                    >
                                      {badge.label}
                                    </span>
                                    {group.isGrouped && group.allocations.length > 0 && (
                                      <span className="block text-[10px] text-ink-subtle mt-0.5 font-medium">
                                        <Figure>{group.allocations.length}</Figure> alloc
                                      </span>
                                    )}
                                  </td>

                                  {/* Bill Ref */}
                                  <td className="py-2.5 px-2.5 font-mono font-bold text-brand-700 whitespace-nowrap">
                                    {group.billNumber ? `#${group.billNumber}` : '—'}
                                  </td>

                                  {/* Sale Total Amount */}
                                  <td className="py-2.5 px-2.5 text-right font-bold text-ink whitespace-nowrap">
                                    {group.saleAmount !== undefined
                                      ? <>₨<Figure>{group.saleAmount.toFixed(0)}</Figure></>
                                      : group.type === 'sale'
                                      ? <>₨<Figure>{group.amount.toFixed(0)}</Figure></>
                                      : '—'}
                                  </td>

                                  {/* Paid Amount Column */}
                                  <td className="py-2.5 px-2.5 text-right font-bold text-success-500 whitespace-nowrap">
                                    ₨<Figure>{(group.paidAmount || (group.type === 'payment' ? group.amount : 0)).toFixed(0)}</Figure>
                                  </td>

                                  {/* Remaining Badge Column */}
                                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                    {group.netChange < 0 ? (
                                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-control text-[11px] font-bold bg-success-50 text-success-500 border border-success-500/30">
                                        −₨<Figure>{Math.abs(group.netChange).toFixed(0)}</Figure> (Reduced)
                                      </span>
                                    ) : group.netChange > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-control text-[11px] font-bold bg-warning-50 text-warning-500 border border-warning-500/30">
                                        +₨<Figure>{group.netChange.toFixed(0)}</Figure> (Added)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-control text-[11px] font-bold bg-info-50 text-info-500 border border-info-500/30">
                                        ₨<Figure>0</Figure> (Net Cleared)
                                      </span>
                                    )}
                                  </td>

                                  {/* Action / Dropdown Toggle */}
                                  <td className="py-2.5 px-2.5 text-center">
                                    {group.isGrouped ? (
                                      <button
                                        onClick={() => toggleExpandGroup(group.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-bold transition-colors ${
                                          isExpanded
                                            ? 'bg-brand-700 text-white shadow-xs'
                                            : 'bg-surface-muted text-brand-600 hover:bg-border/50 border border-border'
                                        }`}
                                      >
                                        <span>{isExpanded ? 'Hide' : 'Explain'}</span>
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                      </button>
                                    ) : (
                                      <span className="text-ink-subtle text-xs truncate max-w-[120px] inline-block">
                                        {group.notes || '—'}
                                      </span>
                                    )}
                                  </td>
                                </tr>

                                {/* ── EXPANDED BREAKDOWN ACCORDION (Desktop) ── */}
                                {isExpanded && group.isGrouped && (
                                  <tr>
                                    <td colSpan={7} className="p-0 border-b border-border bg-surface-muted/20">
                                      <div className="p-3 space-y-2.5">
                                        {/* Header Banner */}
                                        <div className="flex items-center justify-between border-b border-border pb-2">
                                          <div className="flex items-center gap-2">
                                            <div className="p-1 bg-brand-700 text-white rounded-control">
                                              <Package size={15} />
                                            </div>
                                            <div>
                                              <h4 className="font-bold text-ink text-xs sm:text-sm">
                                                Step-by-Step Breakdown for Bill #{group.billNumber}
                                              </h4>
                                              <p className="text-[11px] text-ink-muted">
                                                Clear breakdown of sale charge, payment distribution, and net balance change.
                                              </p>
                                            </div>
                                          </div>
                                          <span className="text-xs font-bold text-brand-600 bg-surface-card border border-border px-2.5 py-1 rounded-control">
                                            Total Paid: ₨<Figure>{group.paidAmount?.toFixed(0)}</Figure>
                                          </span>
                                        </div>

                                        {/* 3 Step Timeline Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                          {/* Step 1: Sale */}
                                          <div className="bg-surface-card p-2.5 rounded-control border border-border space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 text-brand-600 font-bold text-xs">
                                              <span className="w-4 h-4 rounded-full bg-info-50 text-info-500 flex items-center justify-center text-[10px] font-bold">
                                                1
                                              </span>
                                              <span>New Purchase (Sale)</span>
                                            </div>
                                            <p className="text-ink-muted text-xs">
                                              Bill <span className="font-mono font-bold text-ink">#{group.billNumber}</span> created for{' '}
                                              <span className="font-bold text-ink">
                                                ₨<Figure>{group.saleAmount?.toFixed(0)}</Figure>
                                              </span>.
                                            </p>
                                            <div className="pt-1.5 border-t border-border text-[10px] text-ink-subtle">
                                              Debt temporarily added (+₨<Figure>{group.saleAmount?.toFixed(0)}</Figure>)
                                            </div>
                                          </div>

                                          {/* Step 2: Payment Distribution */}
                                          <div className="bg-surface-card p-2.5 rounded-control border border-border space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 text-success-500 font-bold text-xs">
                                              <span className="w-4 h-4 rounded-full bg-success-50 text-success-500 flex items-center justify-center text-[10px] font-bold">
                                                2
                                              </span>
                                              <span>Payment Distributed</span>
                                            </div>
                                            {group.allocations.length > 0 ? (
                                              <div className="space-y-1 max-h-24 overflow-y-auto">
                                                {group.allocations.map((alloc, idx) => (
                                                  <div
                                                    key={idx}
                                                    className="flex items-start justify-between gap-1 text-[11px] bg-success-50/50 p-1.5 rounded-control border border-success-500/20"
                                                  >
                                                    <div>
                                                      <span className="font-mono font-bold text-ink">
                                                        #{alloc.billNumber}
                                                      </span>{' '}
                                                      <span className="text-ink-subtle text-[10px]">
                                                        ({alloc.isNewBill ? 'This Bill' : 'Old Bill'})
                                                      </span>
                                                    </div>
                                                    <span className="font-bold text-success-500 shrink-0">
                                                      −₨<Figure>{alloc.amount.toFixed(0)}</Figure>
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-[11px] text-ink-subtle italic py-1 bg-surface-muted/30 p-1.5 rounded border border-border/40">
                                                No payments allocated at time of bill. (₨<Figure>{group.saleAmount?.toFixed(0)}</Figure> added to pending udhaar).
                                              </p>
                                            )}
                                            <div className="pt-1.5 border-t border-border text-[10px] text-success-500 font-semibold">
                                              Total Applied: ₨<Figure>{group.paidAmount?.toFixed(0)}</Figure>
                                            </div>
                                          </div>

                                          {/* Step 3: Net Balance Result */}
                                          <div className="bg-surface-card p-2.5 rounded-control border border-border space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 text-brand-600 font-bold text-xs">
                                              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center text-[10px] font-bold">
                                                3
                                              </span>
                                              <span>Final Balance Result</span>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                              <div className="flex items-center justify-between text-ink-muted text-[11px] gap-2">
                                                <span className="shrink-0">Starting Balance:</span>
                                                <span className="font-semibold text-ink truncate">₨<Figure>{group.startingBalance.toFixed(0)}</Figure></span>
                                              </div>
                                              <div className="flex items-center justify-between text-ink-muted text-[11px] gap-2">
                                                <span className="shrink-0">Net Movement:</span>
                                                <span className={`font-bold truncate ${group.netChange <= 0 ? 'text-success-500' : 'text-warning-500'}`}>
                                                  {group.netChange <= 0 ? '−' : '+'}₨<Figure>{Math.abs(group.netChange).toFixed(0)}</Figure>
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between font-bold text-ink border-t border-border pt-1 text-xs gap-2">
                                                <span className="shrink-0">Final Balance:</span>
                                                <span className="text-brand-600 font-bold text-sm truncate">
                                                  ₨<Figure>{group.runningBalance.toFixed(0)}</Figure>
                                                </span>
                                              </div>
                                            </div>
                                            <div className="pt-1.5 border-t border-border text-[10px] text-ink-subtle truncate">
                                              {group.netChange < 0
                                                ? `Net debt decreased by ₨${Math.abs(group.netChange).toFixed(0)} ✅`
                                                : group.netChange === 0
                                                ? 'Bill paid in exact full (₨0 net debt change) ✅'
                                                : `Debt increased by ₨${group.netChange.toFixed(0)}`}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Compact ExpandableBillRow for Products, Crate Exchanges, & Inline Add Payment */}
                                        {group.billId && (
                                          <div className="mt-2.5">
                                            <ExpandableBillRow
                                              bill={{
                                                id: group.billId,
                                                billNumber: group.billNumber || '',
                                                retailerId: id!,
                                                workerId: '',
                                                items: [],
                                                subtotal: group.saleAmount || group.amount,
                                                total: group.saleAmount || group.amount,
                                                paidAmount: group.paidAmount || 0,
                                                pendingAmount: Math.max(0, (group.saleAmount || group.amount) - (group.paidAmount || 0)),
                                                paymentHistory: [],
                                                status: (group.paidAmount || 0) >= (group.saleAmount || group.amount) ? 'paid' : (group.paidAmount || 0) > 0 ? 'partial' : 'pending',
                                                createdAt: group.createdAt,
                                                updatedAt: group.createdAt,
                                              }}
                                              isExpanded={true}
                                              layoutMode="card"
                                              onToggleExpand={() => {}}
                                              onPaymentSuccess={refreshRetailerData}
                                              showRetailer={false}
                                              showWorker={false}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-ink-muted">
                              {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── 1B. MOBILE FRIENDLY VIEW (Native Responsive Card Feed - No Horizontal Scrolling) ── */}
                  <div className="md:hidden divide-y divide-border/60 max-h-[calc(100vh-250px)] overflow-y-auto p-2 space-y-3">
                    {groupedTransactions.length > 0 ? (
                      groupedTransactions.map((group) => {
                        const isExpanded = expandedGroupIds.has(group.id);
                        const badge = ENTRY_TYPE_BADGES[group.type] || {
                          bg: 'bg-surface-muted border-border',
                          text: 'text-ink-muted',
                          label: group.type,
                        };

                        return (
                          <div
                            key={group.id}
                            className={`rounded-card border transition-all overflow-hidden ${
                              isExpanded
                                ? 'bg-surface-card border-brand-500/40 shadow-xs'
                                : 'bg-surface-card border-border hover:border-border-strong'
                            }`}
                          >
                            {/* Card Header & Primary Info */}
                            <div className="p-3 bg-surface-card border-b border-border/60">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-control font-bold text-[11px] border ${badge.bg} ${badge.text}`}>
                                    {badge.label}
                                  </span>
                                  {group.billNumber && (
                                    <span className="font-mono font-bold text-brand-700 text-xs">
                                      #{group.billNumber}
                                    </span>
                                  )}
                                  {group.isGrouped && group.allocations.length > 0 && (
                                    <span className="text-[10px] bg-surface-muted text-ink-muted px-1.5 py-0.5 rounded font-medium border border-border">
                                      <Figure>{group.allocations.length}</Figure> alloc
                                    </span>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="text-[11px] text-ink font-semibold block">
                                    {group.createdAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className="text-[10px] text-ink-subtle block">
                                    {group.createdAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>

                              {/* 3-Column Financial KPI Bar */}
                              <div className="grid grid-cols-3 gap-1.5 mt-2.5 p-2 bg-surface-muted/50 rounded-control border border-border/50 text-center">
                                <div>
                                  <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide">Total Bill</span>
                                  <span className="text-xs font-bold text-ink">
                                    ₨<Figure>{(group.saleAmount ?? group.amount).toFixed(0)}</Figure>
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide">Paid</span>
                                  <span className="text-xs font-bold text-success-500">
                                    ₨<Figure>{(group.paidAmount || (group.type === 'payment' ? group.amount : 0)).toFixed(0)}</Figure>
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide">Udhaar Impact</span>
                                  <span className={`text-[11px] font-bold ${group.netChange <= 0 ? 'text-success-500' : 'text-warning-500'}`}>
                                    {group.netChange < 0 ? (
                                      <>−₨<Figure>{Math.abs(group.netChange).toFixed(0)}</Figure></>
                                    ) : group.netChange > 0 ? (
                                      <>+₨<Figure>{group.netChange.toFixed(0)}</Figure></>
                                    ) : (
                                      '₨0 (Cleared)'
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Card Footer: Running Balance & Expand Action */}
                              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/40 text-xs">
                                <div className="flex items-center gap-1 text-[11px] text-ink-muted">
                                  <span>Udhaar Balance:</span>
                                  <span className="font-bold text-brand-600 text-xs">₨<Figure>{group.runningBalance.toFixed(0)}</Figure></span>
                                </div>

                                {group.isGrouped ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandGroup(group.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-bold transition-colors ${
                                      isExpanded
                                        ? 'bg-brand-700 text-white shadow-xs'
                                        : 'bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 border border-brand-500/20'
                                    }`}
                                  >
                                    <span>{isExpanded ? 'Hide' : 'Breakdown & Pay'}</span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                ) : (
                                  <span className="text-ink-subtle text-[11px] italic truncate max-w-[150px]">
                                    {group.notes || '—'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* ── EXPANDED BREAKDOWN (Mobile) ── */}
                            {isExpanded && group.isGrouped && (
                              <div className="p-2.5 bg-surface-muted/30 border-t border-border space-y-2 text-xs">
                                {/* Step 1: Sale Creation */}
                                <div className="bg-surface-card p-2.5 rounded-control border border-border">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-brand-600 text-xs">
                                      <span className="w-4 h-4 rounded-full bg-info-50 text-info-500 flex items-center justify-center text-[10px] font-bold">1</span>
                                      <span>Sale / Bill #{group.billNumber}</span>
                                    </div>
                                    <span className="font-bold text-ink text-xs">₨<Figure>{group.saleAmount?.toFixed(0)}</Figure></span>
                                  </div>
                                  <p className="text-[11px] text-ink-muted mt-1">
                                    Bill created for ₨<Figure>{group.saleAmount?.toFixed(0)}</Figure>. Added to udhaar ledger.
                                  </p>
                                </div>

                                {/* Step 2: Payment Distribution */}
                                <div className="bg-surface-card p-2.5 rounded-control border border-border">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-success-500 text-xs">
                                      <span className="w-4 h-4 rounded-full bg-success-50 text-success-500 flex items-center justify-center text-[10px] font-bold">2</span>
                                      <span>Payment Distribution</span>
                                    </div>
                                    <span className="font-bold text-success-500 text-xs">₨<Figure>{group.paidAmount?.toFixed(0)}</Figure></span>
                                  </div>

                                  {group.allocations.length > 0 ? (
                                    <div className="space-y-1 mt-1.5">
                                      {group.allocations.map((alloc, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px] bg-success-50/50 p-1.5 rounded border border-success-500/20">
                                          <span>Bill #{alloc.billNumber} ({alloc.isNewBill ? 'This Bill' : 'Old Bill'})</span>
                                          <span className="font-bold text-success-500">−₨<Figure>{alloc.amount.toFixed(0)}</Figure></span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-ink-subtle italic mt-1 bg-surface-muted/40 p-1.5 rounded border border-border/40">
                                      No payments applied yet. Entire bill is currently unpaid.
                                    </p>
                                  )}
                                </div>

                                {/* Step 3: Final Balance Result */}
                                <div className="bg-surface-card p-2.5 rounded-control border border-border">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-brand-600 text-xs">
                                      <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center text-[10px] font-bold">3</span>
                                      <span>Balance Movement</span>
                                    </div>
                                    <span className="font-bold text-brand-600 text-xs">Ending: ₨<Figure>{group.runningBalance.toFixed(0)}</Figure></span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-1 mt-1.5 text-center bg-surface-muted/40 p-1.5 rounded border border-border/40 text-[11px]">
                                    <div>
                                      <span className="text-ink-muted text-[10px] block">Starting</span>
                                      <span className="font-semibold text-ink">₨<Figure>{group.startingBalance.toFixed(0)}</Figure></span>
                                    </div>
                                    <div>
                                      <span className="text-ink-muted text-[10px] block">Net Movement</span>
                                      <span className={`font-bold ${group.netChange <= 0 ? 'text-success-500' : 'text-warning-500'}`}>
                                        {group.netChange <= 0 ? '−' : '+'}₨<Figure>{Math.abs(group.netChange).toFixed(0)}</Figure>
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-ink-muted text-[10px] block">Final Balance</span>
                                      <span className="font-extrabold text-brand-700">₨<Figure>{group.runningBalance.toFixed(0)}</Figure></span>
                                    </div>
                                  </div>
                                </div>

                                {/* Bill Products, Crate Exchanges, Payment History & Inline Add Payment */}
                                {group.billId && (
                                  <ExpandableBillRow
                                    bill={{
                                      id: group.billId,
                                      billNumber: group.billNumber || '',
                                      retailerId: id!,
                                      workerId: '',
                                      items: [],
                                      subtotal: group.saleAmount || group.amount,
                                      total: group.saleAmount || group.amount,
                                      paidAmount: group.paidAmount || 0,
                                      pendingAmount: Math.max(0, (group.saleAmount || group.amount) - (group.paidAmount || 0)),
                                      paymentHistory: [],
                                      status: (group.paidAmount || 0) >= (group.saleAmount || group.amount) ? 'paid' : (group.paidAmount || 0) > 0 ? 'partial' : 'pending',
                                      createdAt: group.createdAt,
                                      updatedAt: group.createdAt,
                                    }}
                                    isExpanded={true}
                                    layoutMode="card"
                                    onToggleExpand={() => {}}
                                    onPaymentSuccess={refreshRetailerData}
                                    showRetailer={false}
                                    showWorker={false}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-10 text-center text-ink-muted text-xs">
                        {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* ── 2A. DETAILED AUDIT LOG (Desktop Table) ── */}
                  <div className="hidden md:block overflow-y-auto max-h-[calc(100vh-270px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 z-20 shadow-xs">
                        <tr className="bg-surface-muted text-ink-subtle uppercase border-b border-border-strong font-bold tracking-wider text-[11px]">
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-3">Date & Time</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5">Type</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5">Bill Ref</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5">Payment Mode</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5 text-right">Amount</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5 text-right">Running Balance</th>
                          <th className="sticky top-0 z-20 bg-surface-muted py-2.5 px-2.5">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-surface-card">
                        {ledgerEntries.length > 0 ? (
                          ledgerEntries.map((entry) => {
                            const badge = ENTRY_TYPE_BADGES[entry.entryType.toLowerCase()] || {
                              bg: 'bg-surface-muted border-border',
                              text: 'text-ink-muted',
                              label: entry.entryType,
                            };

                            return (
                              <tr key={entry.id} className="hover:bg-surface-muted/50 transition-colors border-b border-border">
                                <td className="py-2.5 px-3 text-ink-muted font-medium">
                                  <div className="text-ink font-semibold whitespace-nowrap">
                                    {new Date(entry.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                  <div className="text-[10px] text-ink-subtle">
                                    {new Date(entry.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2.5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-control font-bold text-[11px] border ${badge.bg} ${badge.text}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2.5 font-mono font-bold text-brand-700 whitespace-nowrap">
                                  {entry.bill?.billNumber ? `#${entry.bill.billNumber}` : '—'}
                                </td>
                                <td className="py-2.5 px-2.5 capitalize text-ink-muted font-medium">
                                  {entry.paymentMode ? entry.paymentMode.replace('_', ' ') : '—'}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-bold text-ink whitespace-nowrap">
                                  ₨<Figure>{Number(entry.amount).toFixed(0)}</Figure>
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-extrabold text-brand-700 whitespace-nowrap">
                                  ₨<Figure>{Number(entry.balance).toFixed(0)}</Figure>
                                </td>
                                <td className="py-2.5 px-2.5 text-ink-subtle max-w-[150px] truncate">
                                  {entry.notes || '—'}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-ink-muted">
                              {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── 2B. DETAILED AUDIT LOG (Mobile Card Feed - No Horizontal Scrolling) ── */}
                  <div className="md:hidden divide-y divide-border/60 max-h-[calc(100vh-250px)] overflow-y-auto p-2 space-y-2.5">
                    {ledgerEntries.length > 0 ? (
                      ledgerEntries.map((entry) => {
                        const badge = ENTRY_TYPE_BADGES[entry.entryType.toLowerCase()] || {
                          bg: 'bg-surface-muted border-border',
                          text: 'text-ink-muted',
                          label: entry.entryType,
                        };

                        const isPayment = entry.entryType.toLowerCase() === 'payment';

                        return (
                          <div
                            key={entry.id}
                            className="bg-surface-card p-3 rounded-card border border-border shadow-xs space-y-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-control font-bold text-[11px] border ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                                {entry.bill?.billNumber && (
                                  <span className="font-mono font-bold text-ink text-xs">
                                    #{entry.bill.billNumber}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-ink-subtle">
                                {new Date(entry.createdAt).toLocaleString('en-PK', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-surface-muted/40 rounded-control border border-border/40">
                              <div>
                                <span className="text-[10px] text-ink-muted uppercase block font-semibold">Mode</span>
                                <span className="font-medium text-ink capitalize">
                                  {entry.paymentMode ? entry.paymentMode.replace('_', ' ') : '—'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-ink-muted uppercase block font-semibold">Amount</span>
                                <span className={`font-bold text-xs ${isPayment ? 'text-success-500' : 'text-ink'}`}>
                                  ₨<Figure>{Number(entry.amount).toFixed(0)}</Figure>
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-ink-muted uppercase block font-semibold">Balance</span>
                                <span className="font-extrabold text-brand-700 text-xs">
                                  ₨<Figure>{Number(entry.balance).toFixed(0)}</Figure>
                                </span>
                              </div>
                            </div>

                            {entry.notes && (
                              <p className="text-[11px] text-ink-muted italic bg-surface-muted/20 px-2 py-1 rounded border border-border/30">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-10 text-center text-ink-muted text-xs">
                        {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>

      {/* ── EDIT RETAILER DETAILS MODAL ── */}
      <Modal
        isOpen={isEditModalOpen}
        title="Edit Retailer Details"
        onClose={() => setIsEditModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 bg-surface-muted border border-border text-ink hover:bg-border/50 text-sm font-semibold rounded-control py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={submittingEdit}
              className="flex-1 bg-brand-700 hover:bg-brand-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white text-sm font-semibold rounded-control py-2.5 transition-colors flex items-center justify-center gap-2"
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
            <label className="block text-xs font-semibold text-ink-muted mb-1">
              Shop Name <span className="text-danger-500">*</span>
            </label>
            <input
              className={`input-field text-sm ${
                editFormErrors?.shopName ? 'border-danger-500/50' : ''
              }`}
              value={editForm.shopName}
              onChange={(e) => setEditForm({ ...editForm, shopName: e.target.value })}
              placeholder="e.g. Al-Madina Traders"
            />
            {editFormErrors?.shopName && <p className="text-danger-500 text-xs mt-1">{editFormErrors.shopName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">
              Owner Name <span className="text-danger-500">*</span>
            </label>
            <input
              className={`input-field text-sm ${
                editFormErrors?.ownerName ? 'border-danger-500/50' : ''
              }`}
              value={editForm.ownerName}
              onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
              placeholder="e.g. Muhammad Ali"
            />
            {editFormErrors?.ownerName && <p className="text-danger-500 text-xs mt-1">{editFormErrors.ownerName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">
              Mobile Number <span className="text-danger-500">*</span>
            </label>
            <input
              className={`input-field text-sm ${
                editFormErrors?.mobileNumber ? 'border-danger-500/50' : ''
              }`}
              value={editForm.mobileNumber}
              onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
              placeholder="e.g. 03001234567"
            />
            {editFormErrors?.mobileNumber && <p className="text-danger-500 text-xs mt-1">{editFormErrors.mobileNumber}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">
              Address <span className="text-danger-500">*</span>
            </label>
            <input
              className={`input-field text-sm ${
                editFormErrors?.address ? 'border-danger-500/50' : ''
              }`}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              placeholder="e.g. Shop #12, Main Bazaar, Lahore"
            />
            {editFormErrors?.address && <p className="text-danger-500 text-xs mt-1">{editFormErrors.address}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">
              Delivery Directions / Location <span className="text-ink-subtle font-normal">(optional)</span>
            </label>
            <input
              className="input-field text-sm"
              value={editForm.deliveryLocation}
              onChange={(e) => setEditForm({ ...editForm, deliveryLocation: e.target.value })}
              placeholder="e.g. Near Bus Stop"
            />
          </div>
        </div>
      </Modal>

      {/* ── GENERATE PENDING BILLS MODAL ── */}
      <Modal
        isOpen={isConsolidatedModalOpen}
        title="Generate Pending Bills"
        size="lg"
        onClose={() => {
          setIsConsolidatedModalOpen(false);
          setConsolidatedBills([]);
          setConsolidatedFetched(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsConsolidatedModalOpen(false);
                setConsolidatedBills([]);
                setConsolidatedFetched(false);
              }}
              className="border-border bg-surface-muted text-ink hover:bg-border/50"
            >
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={consolidatedLoading}
              onClick={handleFetchPendingBills}
              className="flex items-center gap-1.5 border border-border bg-surface-muted text-ink hover:bg-border/50 font-semibold"
            >
              <FileText size={14} className="text-ink-muted" />
              Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={consolidatedLoading}
              onClick={handleDirectPrintPendingBills}
              className="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-600 text-white font-bold"
            >
              <Printer size={14} />
              Print Statement
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {/* Retailer Header */}
          <div className="bg-warning-50 p-2.5 rounded-control border border-warning-500/30">
            <div className="flex items-center justify-between font-bold text-warning-500">
              <span>{retailer?.shopName}</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Owner: {retailer?.ownerName} • Contact: {retailer?.mobileNumber || 'N/A'}
            </p>
          </div>

          {/* Body Content */}
          {consolidatedLoading ? (
            <div className="py-8 text-center text-ink-muted text-xs font-medium">Loading pending bills…</div>
          ) : !consolidatedFetched ? (
            <div className="py-6 text-center text-ink-muted text-xs bg-surface-muted/50 rounded-control border border-dashed border-border">
              Click <span className="font-bold text-ink">"Preview Pending Bills"</span> below to review all unpaid &amp; partial bills before printing.
            </div>
          ) : consolidatedBills.length === 0 ? (
            <div className="py-6 text-center text-ink-muted text-xs italic bg-surface-muted rounded-control">No pending bills found for this retailer.</div>
          ) : (
            /* Preview Table — compact scroll container with sticky header & pinned footer */
            <div className="border border-border rounded-card overflow-hidden flex flex-col">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-muted font-bold text-ink-subtle uppercase text-[10px] sticky top-0 z-10 border-b border-border">
                    <tr>
                      <th className="p-2">Bill #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">Sale</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right font-bold text-danger-500">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-card">
                    {consolidatedBills.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="p-2 font-mono font-bold text-ink">
                          #{b.billNumber.replace(/^BL-\d{8}-/, '')}
                        </td>
                        <td className="p-2 text-ink-muted whitespace-nowrap">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-right text-ink">₨<Figure>{Number(b.total).toFixed(0)}</Figure></td>
                        <td className="p-2 text-right text-success-500 font-medium">₨<Figure>{Number(b.paidAmount).toFixed(0)}</Figure></td>
                        <td className="p-2 text-right font-bold text-danger-500">₨<Figure>{Number(b.pendingAmount).toFixed(0)}</Figure></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pinned Totals Row */}
              <div className="bg-surface-muted border-t-2 border-border px-3 py-2 flex items-center justify-between text-xs font-bold">
                <span className="uppercase text-[11px] text-ink-muted">Total Outstanding:</span>
                <span className="text-sm text-danger-500 font-extrabold">
                  ₨<Figure>{consolidatedBills.reduce((s, b) => s + Number(b.pendingAmount), 0).toFixed(0)}</Figure>
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── DATE RANGE REPORT MODAL ── */}
      <Modal
        isOpen={isDateReportModalOpen}
        title="Date Range Bill Report"
        size="lg"
        onClose={() => {
          setIsDateReportModalOpen(false);
          setDateReportBills([]);
          setDateReportFetched(false);
          setActiveDatePreset(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsDateReportModalOpen(false);
                setDateReportBills([]);
                setDateReportFetched(false);
                setActiveDatePreset(null);
              }}
              className="border-border bg-surface-muted text-ink hover:bg-border/50"
            >
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={dateReportLoading}
              onClick={() => handleFetchDateReport()}
              className="flex items-center gap-1.5 border border-border bg-surface-muted text-ink hover:bg-border/50 font-semibold"
            >
              <FileText size={14} className="text-ink-muted" />
              Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={dateReportLoading}
              onClick={handleDirectPrintDateReport}
              className="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-600 text-white font-bold"
            >
              <Printer size={14} />
              Print Report
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="bg-info-50 p-2.5 rounded-control border border-info-500/30">
            <p className="font-bold text-info-500">{retailer?.shopName} — Bill Report Generator</p>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-ink-muted mb-1">Start Date</label>
              <input
                type="date"
                value={dateReportStart}
                onChange={(e) => {
                  setActiveDatePreset(null);
                  setDateReportStart(e.target.value);
                }}
                className="input-field text-xs py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-muted mb-1">End Date</label>
              <input
                type="date"
                value={dateReportEnd}
                onChange={(e) => {
                  setActiveDatePreset(null);
                  setDateReportEnd(e.target.value);
                }}
                className="input-field text-xs py-1.5"
              />
            </div>
          </div>

          {/* Quick Preset Buttons with Active Styling */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-ink-subtle font-bold">Presets:</span>
            {[
              ['Today', 'today'],
              ['This Month', 'this_month'],
              ['Last 30 Days', 'last_30'],
              ['All Time', 'all'],
            ].map(([label, key]) => {
              const isActive = activeDatePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key as any)}
                  className={`px-2.5 py-1 rounded-control text-[11px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-700 text-white font-bold shadow-xs border border-brand-700'
                      : 'bg-surface-muted hover:bg-border/50 text-ink-muted font-semibold border border-border'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Preview Area */}
          {dateReportLoading ? (
            <div className="py-8 text-center text-ink-muted text-xs font-medium">Loading bills…</div>
          ) : !dateReportFetched ? (
            <div className="py-6 text-center text-ink-muted text-xs bg-surface-muted/50 rounded-control border border-dashed border-border">
              Select a date preset or range, then click <span className="font-bold text-ink">"Preview Bills"</span> to review.
            </div>
          ) : dateReportBills.length === 0 ? (
            <div className="py-6 text-center text-ink-muted italic bg-surface-muted rounded-control">No bills found in this date range.</div>
          ) : (
            <div className="border border-border rounded-card overflow-hidden flex flex-col">
              <div className="bg-surface-muted px-3 py-1.5 border-b border-border text-[11px] font-bold text-ink-subtle uppercase flex items-center justify-between">
                <span>Preview</span>
                <span className="text-brand-600 font-bold"><Figure>{dateReportBills.length}</Figure> bill{dateReportBills.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-muted font-bold text-ink-subtle uppercase text-[10px] sticky top-0 z-10 border-b border-border">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Bill #</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface-card">
                    {dateReportBills.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="p-2 text-ink-muted whitespace-nowrap">{new Date(b.createdAt).toLocaleDateString()}</td>
                        <td className="p-2 font-mono font-bold text-ink">#{b.billNumber.replace(/^BL-\d{8}-/, '')}</td>
                        <td className="p-2 text-right font-medium text-ink">₨<Figure>{Number(b.total).toFixed(0)}</Figure></td>
                        <td className="p-2 text-right text-success-500 font-medium">₨<Figure>{Number(b.paidAmount).toFixed(0)}</Figure></td>
                        <td className="p-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-control text-[10px] font-bold border ${
                            b.status === 'paid' ? 'bg-success-50 text-success-500 border-success-500/20' :
                            b.status === 'partial' ? 'bg-warning-50 text-warning-500 border-warning-500/20' :
                            'bg-danger-50 text-danger-500 border-danger-500/20'
                          }`}>
                            {b.status === 'paid' ? 'PAID' : b.status === 'partial' ? 'PARTIAL' : 'UNPAID'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pinned Totals Footer Row */}
              <div className="bg-surface-muted border-t-2 border-border px-3 py-2 grid grid-cols-4 items-center text-xs font-bold gap-2">
                <span className="uppercase text-[11px] text-ink-muted">Totals:</span>
                <span className="text-right text-ink font-extrabold">
                  ₨<Figure>{dateReportBills.reduce((s, b) => s + Number(b.total), 0).toFixed(0)}</Figure>
                </span>
                <span className="text-right text-success-500 font-extrabold">
                  ₨<Figure>{dateReportBills.reduce((s, b) => s + Number(b.paidAmount), 0).toFixed(0)}</Figure>
                </span>
                <span className="text-right text-danger-500 font-extrabold">
                  Due: ₨<Figure>{dateReportBills.reduce((s, b) => s + Number(b.pendingAmount), 0).toFixed(0)}</Figure>
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
};
