import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PaymentReminder } from '../../types';
import { remindersService } from '../../services/reminders';
import { useStore } from '../../store';
import { CalendarClock, Store, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';

interface RetailerCollectionSummary {
  retailerId: string;
  shopName: string;
  ownerName: string;
  nearestDueDate: string | Date;
  nearestAmount: number;
  totalOutstanding: number;
}

export const UpcomingCollectionsCard: React.FC = () => {
  const navigate = useNavigate();
  const store = useStore();
  const retailers = store.retailers;
  const bills = store.bills;

  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPendingReminders = useCallback(async () => {
    try {
      const data = await remindersService.getAllReminders({ status: 'PENDING' });
      setReminders(data.reminders || []);
    } catch (err) {
      console.error('Failed to fetch upcoming payment reminders:', err);
    } finally {
      setLoading(false);
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
          totalOutstanding,
        });
      } else {
        const existing = retailerMap.get(rid)!;
        // If this reminder is earlier than the currently stored nearest, update it
        if (new Date(reminder.dueDate) < new Date(existing.nearestDueDate)) {
          existing.nearestDueDate = reminder.dueDate;
          existing.nearestAmount = Number(reminder.amount) || 0;
        }
      }
    }

    // Sort rows so the nearest due date is at the top
    return Array.from(retailerMap.values()).sort(
      (a, b) => new Date(a.nearestDueDate).getTime() - new Date(b.nearestDueDate).getTime()
    );
  }, [reminders, retailers, bills]);

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
            <p className="text-xs text-slate-500">
              Retailer-wise schedule for expected payment settlements
            </p>
          </div>
        </div>

        {groupedCollections.length > 0 && (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/60">
            {groupedCollections.length} {groupedCollections.length === 1 ? 'Retailer' : 'Retailers'}
          </span>
        )}
      </div>

      {/* Body Content */}
      <div className="mt-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
            <Loader2 size={18} className="animate-spin text-indigo-500" />
            Loading upcoming collections...
          </div>
        ) : groupedCollections.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-7 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <CheckCircle2 size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              No upcoming payment reminders
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              All retailer collections are currently settled or up-to-date
            </p>
          </div>
        ) : (
          /* Grouped Retailer Rows */
          <>
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
              {groupedCollections.map((item) => {
                const dueBadge = getDueBadgeInfo(item.nearestDueDate);

                return (
                  <div
                    key={item.retailerId}
                    onClick={() => navigate(`/admin/retailers/${item.retailerId}`)}
                    className="group py-3.5 px-2.5 sm:px-3 -mx-2.5 sm:-mx-3 rounded-xl hover:bg-slate-50/80 cursor-pointer transition-colors flex items-center justify-between gap-3 sm:gap-4"
                  >
                    {/* Left: Retailer Shop & Owner */}
                    <div className="min-w-0 flex-1 flex items-center gap-2.5">
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

                    {/* Right: Amounts (This payment + Total due) */}
                    <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3">
                      <div>
                        <div className="text-xs text-slate-500 font-normal">
                          This payment: <span className="font-semibold text-slate-700">PKR {item.nearestAmount.toLocaleString('en-PK')}</span>
                        </div>
                        <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                          Total due: PKR {item.totalOutstanding.toLocaleString('en-PK')}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all hidden sm:block" />
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
        )}
      </div>
    </div>
  );
};
