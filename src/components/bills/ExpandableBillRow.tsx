import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { Bill, PaymentRecord } from '../../types';
import { billsService } from '../../services/bills';
import { useStore } from '../../store';

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-orange-100 text-orange-700 border-orange-200',
  partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

export interface ExpandableBillRowProps {
  bill: Bill;
  showRetailer?: boolean;
  showWorker?: boolean;
  showRunningBalance?: boolean;
  runningBalance?: number;
  netChange?: number;
  colSpan?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onPaymentSuccess?: (updatedBill?: Bill) => void | Promise<void>;
  viewMode?: 'admin-bills' | 'ledger-friendly' | 'ledger-detailed';
}

export const ExpandableBillRow: React.FC<ExpandableBillRowProps> = ({
  bill: initialBill,
  showRetailer = false,
  showWorker = true,
  showRunningBalance = false,
  runningBalance,
  netChange,
  colSpan = 11,
  isExpanded: propIsExpanded,
  onToggleExpand: propOnToggleExpand,
  onPaymentSuccess,
  viewMode = 'admin-bills',
}) => {
  const store = useStore();
  const [currentBill, setCurrentBill] = useState<Bill>(initialBill);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Inline Payment Form State
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;

  const toggleExpand = () => {
    if (propOnToggleExpand) {
      propOnToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  useEffect(() => {
    setCurrentBill(initialBill);
  }, [initialBill]);

  // Fetch complete bill details when expanded
  useEffect(() => {
    if (isExpanded && currentBill?.id) {
      const needsFetch = !currentBill.paymentHistory || !currentBill.items;
      if (needsFetch) {
        setLoadingDetails(true);
        billsService
          .getById(currentBill.id)
          .then((fullBill) => {
            if (fullBill) setCurrentBill(fullBill);
          })
          .catch((err) => {
            console.error('Failed to load bill details:', err);
          })
          .finally(() => setLoadingDetails(false));
      }
    }
  }, [isExpanded, currentBill?.id]);

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    const amt = parseFloat(paymentAmount);
    const pending = Number(currentBill.pendingAmount);

    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Enter amount > 0');
      return;
    }
    if (amt > pending + 0.01) {
      setPaymentError(`Max ₨${pending.toFixed(0)}`);
      return;
    }

    setSubmittingPayment(true);
    try {
      await billsService.addPayment(currentBill.id, {
        amount: amt,
        paymentMode: 'cash',
        notes: paymentNotes.trim() || undefined,
      });

      const updated = await billsService.getById(currentBill.id);
      setCurrentBill(updated || {
        ...currentBill,
        paidAmount: Number(currentBill.paidAmount) + amt,
        pendingAmount: Math.max(0, pending - amt),
        status: pending - amt <= 0 ? 'paid' : 'partial',
      });

      store.addNotification(
        'success',
        `Payment of ₨${amt.toLocaleString('en-PK')} added to Bill #${currentBill.billNumber}`
      );

      setPaymentAmount('');
      setPaymentNotes('');
      setShowPaymentForm(false);

      if (onPaymentSuccess) {
        await onPaymentSuccess(updated);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to record payment.';
      setPaymentError(msg);
      store.addNotification('error', msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const retailer = currentBill.retailer || store.retailers.find((r) => r.id === currentBill.retailerId);
  const workerName = (currentBill as any).worker?.name || currentBill.workerId?.slice(0, 8) || 'N/A';
  const totalVal = Number(currentBill.total) || 0;
  const paidVal = Number(currentBill.paidAmount) || 0;
  const pendingVal = Number(currentBill.pendingAmount) || 0;
  const discountVal = Number(currentBill.discount) || 0;

  const hasItems = currentBill.items && currentBill.items.length > 0;
  const hasRgb = (currentBill as any).rgbExchanges && (currentBill as any).rgbExchanges.length > 0;

  const renderMainRow = () => {
    if (viewMode === 'ledger-friendly') {
      return (
        <tr className="hover:bg-blue-50/40 transition-colors border-b border-gray-100">
          <td className="py-2.5 px-3 text-gray-600 font-mono text-xs whitespace-nowrap">
            {new Date(currentBill.createdAt).toLocaleString('en-PK', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </td>
          <td className="py-2.5 px-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Sale
            </span>
          </td>
          <td className="py-2.5 px-3 font-mono font-bold text-blue-700 text-xs">
            #{currentBill.billNumber}
          </td>
          <td className="py-2.5 px-3 text-right">
            <span className="font-bold text-gray-900 text-xs">₨{totalVal.toLocaleString('en-PK')}</span>
          </td>
          <td className="py-2.5 px-3 text-center whitespace-nowrap">
            {netChange !== undefined && (
              <span className={`font-bold text-xs px-2 py-0.5 rounded ${
                netChange <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {netChange <= 0 ? '−' : '+'}₨{Math.abs(netChange).toLocaleString('en-PK')}
              </span>
            )}
          </td>
          {/* Explicit Paid Amount Column (after Debt Impact per user request) */}
          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 text-xs">
            ₨{paidVal.toLocaleString('en-PK')}
          </td>
          {showRunningBalance && (
            <td className="py-2.5 px-3 text-right font-extrabold text-gray-900 text-xs">
              ₨{Number(runningBalance ?? 0).toLocaleString('en-PK')}
            </td>
          )}
          <td className="py-2.5 px-3 text-center">
            <button
              onClick={toggleExpand}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                isExpanded
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <span>{isExpanded ? 'Hide' : 'Details'}</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </td>
        </tr>
      );
    }

    // Default: 'admin-bills'
    return (
      <tr className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
        <td className="py-2.5 px-3 font-mono text-xs font-semibold text-gray-700">{currentBill.billNumber}</td>
        {showRetailer && (
          <td className="py-2.5 px-3">
            <div className="font-semibold text-gray-900 text-xs">{retailer?.shopName || '—'}</div>
            {retailer?.ownerName && <div className="text-gray-400 text-[11px]">{retailer.ownerName}</div>}
          </td>
        )}
        {showWorker && <td className="py-2.5 px-3 text-xs text-gray-600">{workerName}</td>}
        <td className="py-2.5 px-3 text-right font-bold text-gray-900 text-xs">₨{totalVal.toFixed(0)}</td>
        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 text-xs">
          ₨{paidVal.toFixed(0)}
        </td>
        <td className="py-2.5 px-3 text-right font-bold text-orange-600 text-xs">₨{pendingVal.toFixed(0)}</td>
        <td className="py-2.5 px-3 text-right text-purple-600 text-xs">
          {discountVal > 0 ? `₨${discountVal.toFixed(0)}` : '—'}
        </td>
        <td className="py-2.5 px-3 text-center capitalize text-gray-500 text-xs">
          {currentBill.paymentMode?.replace('-', ' ') || '—'}
        </td>
        <td className="py-2.5 px-3 text-center">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_COLORS[currentBill.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {currentBill.status}
          </span>
        </td>
        <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
          {new Date(currentBill.createdAt).toLocaleDateString()}
        </td>
        <td className="py-2.5 px-3 text-center">
          <button
            onClick={toggleExpand}
            className={`p-1.5 rounded text-xs font-semibold transition-colors ${
              isExpanded ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50'
            }`}
            title={isExpanded ? 'Collapse' : 'Expand Details & Payments'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <>
      {renderMainRow()}

      {/* COMPACT EXPANDED ACCORDION */}
      {isExpanded && (
        <tr>
          <td colSpan={colSpan} className="bg-blue-50/30 p-2.5 border-b border-blue-200">
            {loadingDetails ? (
              <div className="text-center py-3 text-xs text-gray-500 flex items-center justify-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Loading details…
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {/* Ultra-Compact Header Summary Banner */}
                <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700">#{currentBill.billNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_COLORS[currentBill.status]}`}>
                      {currentBill.status}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(currentBill.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <div>
                      <span className="text-gray-400 mr-1">Total:</span>
                      <span className="font-bold text-gray-900">₨{totalVal.toLocaleString('en-PK')}</span>
                    </div>
                    <div>
                      <span className="text-emerald-600 font-semibold mr-1">Paid:</span>
                      <span className="font-bold text-emerald-700">₨{paidVal.toLocaleString('en-PK')}</span>
                    </div>
                    <div>
                      <span className="text-orange-600 font-semibold mr-1">Udhari:</span>
                      <span className="font-bold text-orange-700">₨{pendingVal.toLocaleString('en-PK')}</span>
                    </div>
                  </div>
                </div>

                {/* Compact Content Area */}
                <div className={`grid ${hasItems || hasRgb ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {/* Line Items & RGB (Rendered ONLY if product items or RGB exchanges exist) */}
                  {(hasItems || hasRgb) && (
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-1.5">
                      {hasItems && (
                        <>
                          <div className="font-bold text-gray-700 text-[11px] border-b border-gray-100 pb-1 flex justify-between">
                            <span>Products ({currentBill.items.length})</span>
                          </div>
                          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5">
                            {currentBill.items.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-[11px] text-gray-600 py-0.5 border-b border-gray-50 last:border-0">
                                <span className="truncate mr-2 font-medium text-gray-800">
                                  {item.product ? `${item.product.brand} ${item.product.variant}` : item.productId?.slice(0, 12)} ×{item.quantity}
                                </span>
                                <span className="font-semibold text-gray-900 shrink-0">₨{Number(item.total).toFixed(0)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* RGB Exchanges */}
                      {hasRgb && (
                        <div className="pt-1 border-t border-teal-100 space-y-0.5">
                          <span className="text-[10px] font-bold text-teal-800 uppercase block">Crate Exchanges</span>
                          {(currentBill as any).rgbExchanges.map((ex: any) => (
                            <div key={ex.id} className="flex justify-between text-[11px] py-0.5 px-1 bg-teal-50/50 rounded">
                              <span className="text-teal-900">
                                {ex.type?.toLowerCase() === 'issue' ? '📦↓ Given' : '📦↑ Returned'}: {ex.itemName}
                              </span>
                              <span className="font-bold text-teal-800">{ex.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment History Records & Inline Add Payment Form */}
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold text-gray-800 text-[11px] flex items-center gap-1">
                          <Clock size={12} className="text-emerald-600" />
                          Payment History ({(currentBill.paymentHistory || []).length})
                        </span>
                      </div>

                      {/* Compact Payment History List */}
                      <div className="mt-1 space-y-1 max-h-36 overflow-y-auto pr-0.5">
                        {(currentBill.paymentHistory || []).map((record: PaymentRecord, idx: number) => (
                          <div
                            key={record.id || idx}
                            className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 px-2 py-1 rounded text-[11px]"
                          >
                            <div>
                              <span className="font-bold text-emerald-950 mr-2">
                                ₨{Number(record.amount).toLocaleString('en-PK')}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(record.date || (record as any).createdAt).toLocaleDateString()}
                              </span>
                              {record.notes && <span className="text-[10px] text-gray-500 italic ml-1 font-normal">({record.notes})</span>}
                            </div>
                            <span className="text-[9px] font-bold bg-white text-emerald-700 px-1 py-0.5 rounded border border-emerald-200">
                              {record.paymentMode}
                            </span>
                          </div>
                        ))}

                        {(!currentBill.paymentHistory || currentBill.paymentHistory.length === 0) && (
                          <p className="text-center py-1.5 text-gray-400 italic text-[11px]">No payment history logged yet</p>
                        )}
                      </div>
                    </div>

                    {/* Compact Inline Add Payment Section */}
                    {pendingVal > 0 ? (
                      <div className="pt-1.5 border-t border-gray-100">
                        {!showPaymentForm ? (
                          <button
                            onClick={() => {
                              setShowPaymentForm(true);
                              setPaymentAmount(pendingVal.toString());
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2 rounded text-[11px] flex items-center justify-center gap-1 transition-colors"
                          >
                            <Plus size={12} />
                            Add Payment (Pending ₨{pendingVal.toLocaleString('en-PK')})
                          </button>
                        ) : (
                          <form onSubmit={handleAddPaymentSubmit} className="bg-emerald-50/80 border border-emerald-200 p-2 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-900 text-[11px] flex items-center gap-1">
                                <DollarSign size={12} /> Record Payment
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowPaymentForm(false)}
                                className="text-gray-400 hover:text-gray-600 text-[10px] font-semibold"
                              >
                                Cancel
                              </button>
                            </div>

                            {paymentError && (
                              <p className="text-red-600 text-[10px] font-semibold">⚠ {paymentError}</p>
                            )}

                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                step="any"
                                required
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="Amount (₨)"
                                className="flex-1 text-[11px] font-bold border border-emerald-300 rounded px-2 py-1 focus:outline-none bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setPaymentAmount(pendingVal.toString())}
                                className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-semibold text-[10px] shrink-0"
                              >
                                Full
                              </button>
                            </div>

                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                placeholder="Notes (optional)"
                                className="flex-1 text-[11px] border border-emerald-300 rounded px-2 py-1 focus:outline-none bg-white"
                              />
                              <button
                                type="submit"
                                disabled={submittingPayment}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold px-3 py-1 rounded text-[11px] transition-colors shrink-0 flex items-center gap-1"
                              >
                                {submittingPayment ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1 py-1">
                        <CheckCircle2 size={12} /> Fully Paid (₨0 Pending)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};
