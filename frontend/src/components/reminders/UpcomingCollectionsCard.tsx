import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PaymentReminder } from '../../types';
import { remindersService } from '../../services/reminders';
import { retailersService } from '../../services/retailers';
import { useStore } from '../../store';
import { CalendarClock, Store, ChevronRight, Loader2, CheckCircle2, X } from 'lucide-react';

interface RetailerCollectionSummary {
  retailerId: string;
  shopName: string;
  ownerName: string;
  nearestDueDate: string | Date;
  nearestAmount: number;
  nearestReminderId: string;
  totalOutstanding: number;
}

/** Inline confirmation state for a single row */
interface ConfirmingRow {
  retailerId: string;
  reminderId: string;
  shopName: string;
  amount: number;
}

export const UpcomingCollectionsCard: React.FC = () => {
  const navigate = useNavigate();
  const store = useStore();
  const retailers = store.retailers;
  const bills = store.bills;

  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /** ID of the reminder currently being submitted */
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  /** Row currently showing the inline "Mark received?" confirmation */
  const [confirming, setConfirming] = useState<ConfirmingRow | null>(null);

  const fetchPendingReminders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await remindersService.getAllReminders({ status: 'PENDING' });
      setReminders(data.reminders || []);
    } catch (err) {
      console.error('Failed to fetch upcoming payment reminders:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingReminders();
  }, [fetchPendingReminders]);

  // Group pending reminders by retailer and find the nearest upcoming reminder per retailer
  const groupedCollections = useMemo(() => {
    const retailerMap = new Map<string, RetailerCollectionSummary>();

    for (const reminder of reminders) {
      const rid = reminder.retailerId;
      if (!rid) continue;

      const retailerObj = retailers.find((r) => r.id === rid) || reminder.retailer;
      const shopName = retailerObj?.shopName || 'Retailer Shop';
      const ownerName = retailerObj?.ownerName || '';

      // Compute total outstanding balance across retailer bills / ledger
      const matchedStoreRetailer = retailers.find((r) => r.id === rid);
      const billsPending = bills
        .filter((b) => b.retailerId === rid)
        .reduce((sum, b) => sum + (Number(b.pendingAmount) || 0), 0);
      const totalOutstanding =
        typeof matchedStoreRetailer?.outstanding === 'number' && matchedStoreRetailer.outstanding > 0
          ? matchedStoreRetailer.outstanding
          : billsPending;

      if (!retailerMap.has(rid)) {
        retailerMap.set(rid, {
          retailerId: rid,
          shopName,
          ownerName,
          nearestDueDate: reminder.dueDate,
          nearestAmount: Number(reminder.amount) || 0,
          nearestReminderId: reminder.id,
          totalOutstanding,
        });
      } else {
        const existing = retailerMap.get(rid)!;
        // If this reminder is earlier than the currently stored nearest, update it
        if (new Date(reminder.dueDate) < new Date(existing.nearestDueDate)) {
          existing.nearestDueDate = reminder.dueDate;
          existing.nearestAmount = Number(reminder.amount) || 0;
          existing.nearestReminderId = reminder.id;
        }
      }
    }

    // Sort rows so the nearest due date is at the top
    return Array.from(retailerMap.values()).sort(
      (a, b) => new Date(a.nearestDueDate).getTime() - new Date(b.nearestDueDate).getTime()
    );
  }, [reminders, retailers, bills]);

  // Total due across the rows actually shown
  const totalDue = useMemo(
    () => groupedCollections.reduce((sum, c) => sum + c.totalOutstanding, 0),
    [groupedCollections]
  );

  const getDueBadgeInfo = (dueDateStr: string | Date) => {
    const due = new Date(dueDateStr);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const formattedMonthDay = new Date(dueDateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    if (diffDays < 0) {
      const daysOverdue = Math.abs(diffDays);
      return {
        text: `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`,
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
      };
    } else if (diffDays === 0) {
      return {
        text: 'Due today',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    } else if (diffDays >= 1 && diffDays <= 3) {
      return {
        text: diffDays === 1 ? 'Due tomorrow' : `Due ${formattedMonthDay}`,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    } else {
      return {
        text: `Due ${formattedMonthDay}`,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
  };

  /** Submit: mark reminder paid via the FIFO payment endpoint */
  const handleConfirmPayment = async () => {
    if (!confirming) return;
    const { retailerId, reminderId, shopName, amount } = confirming;
    setUpdatingId(reminderId);
    setConfirming(null);
    try {
      await retailersService.recordPayment(retailerId, amount, reminderId);
      store.addNotification('success', `Payment from ${shopName} marked as received`);
      // Refresh all related data
      await Promise.all([
        store.fetchRetailers(),
        store.fetchBills(),
        fetchPendingReminders(true),
      ]);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to mark payment as received.';
      store.addNotification('error', errMsg);
      fetchPendingReminders(true);
    } finally {
      setUpdatingId(null);
    }
  };

  // Don't render at all while loading or when there are no collections
  if (loading || groupedCollections.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6 mb-6 sm:mb-8 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CalendarClock size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Upcoming Collections
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalDue > 0 && (
            <span className="text-xs font-bold text-slate-700">
              PKR {totalDue.toLocaleString('en-PK')}
            </span>
          )}
          {groupedCollections.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/60">
              {groupedCollections.length} {groupedCollections.length === 1 ? 'Retailer' : 'Retailers'}
            </span>
          )}
        </div>
      </div>

      {/* Inline confirmation banner */}
      {confirming && (
        <div className="mt-3 mb-1 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-surface-muted border border-border text-sm">
          <span className="text-ink font-medium">
            Mark <span className="font-bold text-ink">{confirming.shopName}</span> –{' '}
            <span className="font-bold text-success-600">
              PKR {confirming.amount.toLocaleString('en-PK')}
            </span>{' '}
            as received?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors"
            >
              <CheckCircle2 size={13} /> Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-ink-subtle hover:text-ink bg-surface-card border border-border rounded-lg transition-colors"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className="mt-2">
        {/* Grouped Retailer Rows */}
        <>
          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
            {groupedCollections.map((item) => {
              const dueBadge = getDueBadgeInfo(item.nearestDueDate);
              const isUpdating = updatingId === item.nearestReminderId;
              const isConfirming = confirming?.reminderId === item.nearestReminderId;

              return (
                <div
                  key={item.retailerId}
                  className="group py-3.5 px-2.5 sm:px-3 -mx-2.5 sm:-mx-3 rounded-xl hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 sm:gap-4"
                >
                  {/* Left: Retailer Shop & Owner — clicking navigates */}
                  <div
                    className="min-w-0 flex-1 flex items-center gap-2.5 cursor-pointer"
                    onClick={() => navigate(`/admin/retailers/${item.retailerId}`)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <Store size={15} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                        {item.shopName}
                      </h4>
                      {item.ownerName && (
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {item.ownerName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle: Due Date Badge */}
                  <div className="shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${dueBadge.badgeClass}`}
                    >
                      {dueBadge.text}
                    </span>
                  </div>

                  {/* Right: Amounts + action button */}
                  <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3">
                    <div>
                      <div className="text-xs text-slate-500 font-normal">
                        This payment:{' '}
                        <span className="font-semibold text-slate-700">
                          PKR {item.nearestAmount.toLocaleString('en-PK')}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                        Total due: PKR {item.totalOutstanding.toLocaleString('en-PK')}
                      </div>
                    </div>

                    {/* Mark received action button */}
                    <button
                      type="button"
                      disabled={isUpdating || !!updatingId}
                      title="Mark payment received"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isConfirming) {
                          setConfirming(null);
                        } else {
                          setConfirming({
                            retailerId: item.retailerId,
                            reminderId: item.nearestReminderId,
                            shopName: item.shopName,
                            amount: item.nearestAmount,
                          });
                        }
                      }}
                      className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors shrink-0
                        ${isConfirming
                          ? 'bg-success-50 border-success-300 text-success-600'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-success-50 hover:border-success-300 hover:text-success-600'
                        } disabled:opacity-40`}
                    >
                      {isUpdating ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                    </button>

                    <ChevronRight
                      size={16}
                      className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all hidden sm:block cursor-pointer"
                      onClick={() => navigate(`/admin/retailers/${item.retailerId}`)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll truncation indicator if > 5 items */}
          {groupedCollections.length > 5 && (
            <div className="pt-3 text-center border-t border-slate-100">
              <span className="text-xs font-medium text-slate-400">
                +{groupedCollections.length - 5} more retailers scrollable above
              </span>
            </div>
          )}
        </>
      </div>
    </div>
  );
};
