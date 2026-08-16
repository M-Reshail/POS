import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import { useStore } from '../../store';
import { remindersService } from '../../services/reminders';
import { Calendar, DollarSign, Store, FileText } from 'lucide-react';

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddReminderModal: React.FC<AddReminderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const store = useStore();
  const retailers = store.retailers;
  const fetchRetailers = store.fetchRetailers;

  const todayStr = new Date().toISOString().split('T')[0];

  const [retailerId, setRetailerId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayStr);
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    retailerId?: string;
    amount?: string;
    dueDate?: string;
    form?: string;
  }>({});

  useEffect(() => {
    if (isOpen && retailers.length === 0) {
      fetchRetailers();
    }
  }, [isOpen, retailers.length, fetchRetailers]);

  useEffect(() => {
    if (isOpen) {
      setRetailerId('');
      setAmount('');
      setDueDate(new Date().toISOString().split('T')[0]);
      setNote('');
      setErrors({});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};

    if (!retailerId) {
      newErrors.retailerId = 'Please select a retailer.';
    }

    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0.';
    }

    if (!dueDate) {
      newErrors.dueDate = 'Due date is required.';
    } else if (new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
      newErrors.dueDate = 'Due date cannot be in the past.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      await remindersService.createReminder({
        retailerId,
        amount: numericAmount,
        dueDate,
        note: note.trim() || undefined,
      });

      store.addNotification('success', 'Payment reminder created successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to create payment reminder.';
      setErrors({ form: errMsg });
      store.addNotification('error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const retailerOptions = retailers.map((r) => ({
    value: r.id,
    label: `${r.shopName} (${r.ownerName})`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Payment Reminder"
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="secondary" onClick={onClose} type="button" disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting} type="submit">
            Save Reminder
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {errors.form}
          </div>
        )}

        {/* Retailer Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <Store size={15} className="text-blue-600" />
            Retailer <span className="text-red-500">*</span>
          </label>
          <select
            value={retailerId}
            onChange={(e) => {
              setRetailerId(e.target.value);
              if (errors.retailerId) setErrors((prev) => ({ ...prev, retailerId: undefined }));
            }}
            className={`input-field ${errors.retailerId ? 'border-red-500' : ''}`}
          >
            <option value="">Select retailer...</option>
            {retailerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.retailerId && (
            <p className="text-red-500 text-xs mt-1">{errors.retailerId}</p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <DollarSign size={15} className="text-green-600" />
            Amount (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            step="any"
            placeholder="e.g. 15000"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            className={`input-field ${errors.amount ? 'border-red-500' : ''}`}
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <Calendar size={15} className="text-indigo-600" />
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            min={todayStr}
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: undefined }));
            }}
            className={`input-field ${errors.dueDate ? 'border-red-500' : ''}`}
          />
          {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
        </div>

        {/* Note / Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <FileText size={15} className="text-gray-500" />
            Note / Description <span className="text-xs text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Weekly settlement or cheque payment expected"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input-field resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};
