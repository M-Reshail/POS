import React, { useState, useEffect, useCallback } from 'react';
import { PaymentReminder } from '../../types';
import { remindersService } from '../../services/reminders';
import { useStore } from '../../store';
import { AddReminderModal } from './AddReminderModal';
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
  Store,
  Phone,
  Plus,
  DollarSign,
  Loader2,
} from 'lucide-react';

export const DueRemindersWidget: React.FC = () => {
  const store = useStore();
  const [dueReminders, setDueReminders] = useState<PaymentReminder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(true);

  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const fetchDueReminders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await remindersService.getDueReminders();
      setDueReminders(data.reminders || []);
      setTotalCount(data.total || (data.reminders ? data.reminders.length : 0));
    } catch (err) {
      console.error('Failed to fetch due payment reminders:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Poll every 60 seconds (clean up interval on unmount)
  useEffect(() => {
    fetchDueReminders(false);

    const interval = setInterval(() => {
      fetchDueReminders(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchDueReminders]);

  const handleMarkAsPaid = async (id: string, shopName?: string) => {
    setUpdatingIds((prev) => [...prev, id]);
    try {
      await remindersService.updateReminder(id, { status: 'PAID' });
      store.addNotification(
        'success',
        `Payment for ${shopName || 'retailer'} marked as PAID`
      );
      // Optimistically remove from due list
      setDueReminders((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      fetchDueReminders(true);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to mark payment as paid.';
      store.addNotification('error', errMsg);
    } finally {
      setUpdatingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const formatDueDate = (dateStr: string | Date) => {
    const due = new Date(dateStr);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return {
        label: `${days} day${days > 1 ? 's' : ''} overdue`,
        badgeClass: 'bg-red-100 text-red-800 border-red-300 font-semibold',
        dateText: formattedDate,
      };
    } else if (diffDays === 0) {
      return {
        label: 'Due today',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
        dateText: formattedDate,
      };
    } else {
      return {
        label: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        dateText: formattedDate,
      };
    }
  };

  // The banner must NOT render anything while loading or when there are 0 due reminders.
  if (loading || totalCount === 0 || dueReminders.length === 0) {
    return (
      <AddReminderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchDueReminders(false)}
      />
    );
  }

  return (
    <>
      <div className="mb-6 animate-page-fade">
        {/* Banner Container with glowing pulse animation */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border-2 border-red-500 rounded-2xl shadow-lg animate-reminder-pulse transition-all">
          {/* Header Bar */}
          <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-red-500/10 border-b border-red-200">
            <div
              className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-[240px]"
              onClick={() => setExpanded(!expanded)}
            >
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-600 text-white shadow-md shadow-red-500/30">
                <BellRing size={20} className="animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-red-950 tracking-tight">
                    Payment Reminders Due
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm">
                    {totalCount} {totalCount === 1 ? 'Payment' : 'Payments'} Due
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-red-800 font-medium mt-0.5">
                  Overdue or due-today retailer credit settlements requiring collection
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus size={16} /> Add Reminder
              </button>

              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 text-red-700 hover:text-red-900 hover:bg-red-200/50 rounded-lg transition-colors"
                title={expanded ? 'Collapse list' : 'Expand list'}
              >
                {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
          </div>

          {/* Expandable List */}
          {expanded && (
            <div className="p-4 sm:p-5 space-y-3 bg-white/60">
              {dueReminders.map((reminder) => {
                const isUpdating = updatingIds.includes(reminder.id);
                const dueInfo = formatDueDate(reminder.dueDate);

                  return (
                    <div
                      key={reminder.id}
                      className="bg-white border border-red-200 hover:border-red-300 rounded-xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Left Details */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-1.5">
                            <Store size={16} className="text-indigo-600 shrink-0" />
                            {reminder.retailer?.shopName || 'Retailer Shop'}
                          </span>
                          {reminder.retailer?.ownerName && (
                            <span className="text-xs text-gray-600 font-medium">
                              ({reminder.retailer.ownerName})
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 text-xs rounded-full border ${dueInfo.badgeClass}`}
                          >
                            {dueInfo.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                          <div className="flex items-center gap-1 font-semibold text-gray-900">
                            <DollarSign size={14} className="text-green-600 shrink-0" />
                            <span className="text-sm font-extrabold text-green-700">
                              PKR {Number(reminder.amount).toLocaleString('en-PK')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Calendar size={14} className="text-gray-400 shrink-0" />
                            <span>{dueInfo.dateText}</span>
                          </div>

                          {reminder.retailer?.mobileNumber && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Phone size={13} className="text-gray-400 shrink-0" />
                              <span>{reminder.retailer.mobileNumber}</span>
                            </div>
                          )}
                        </div>

                        {reminder.note && (
                          <p className="text-xs text-gray-700 bg-amber-50/80 border border-amber-200/80 rounded-md p-1.5 px-2 font-medium">
                            <strong className="text-amber-900">Note:</strong> {reminder.note}
                          </p>
                        )}
                      </div>

                      {/* Right Action */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            handleMarkAsPaid(reminder.id, reminder.retailer?.shopName)
                          }
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={15} /> Mark as Paid
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <AddReminderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchDueReminders(false)}
      />
    </>
  );
};
