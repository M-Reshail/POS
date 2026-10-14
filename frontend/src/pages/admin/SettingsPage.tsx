import React, { useState } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/common';
import { useStore } from '../../store';
import { authService } from '../../services/auth';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { KeyRound, Eye, EyeOff, ChevronDown } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const addNotification = useStore((s) => s.addNotification);

  // Accordion state (collapsed by default)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validation & loading states
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required.';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters.';
    } else if (newPassword === currentPassword) {
      errors.newPassword = 'New password must differ from current password.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your new password.';
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const response = await authService.changePassword(currentPassword, newPassword);

      // On success: clear form, collapse section, display success toast, keep current session intact
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setIsPasswordOpen(false);

      addNotification('success', response.message || 'Password changed successfully.');
    } catch (err: any) {
      const serverMessage =
        err?.response?.data?.message || err?.message || 'Failed to change password.';

      if (serverMessage.toLowerCase().includes('current password is incorrect')) {
        setFieldErrors({ currentPassword: 'Current password is incorrect.' });
      } else if (serverMessage.toLowerCase().includes('common') || serverMessage.toLowerCase().includes('username')) {
        setFieldErrors({ newPassword: serverMessage });
      }

      addNotification('error', serverMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        {/* Settings Container — single Card spanning full width, expandable for future rows */}
        <Card className="w-full p-0 sm:p-0 divide-y divide-border overflow-hidden">
          {/* Row 1: Change Password Accordion Item */}
          <div>
            <button
              type="button"
              onClick={() => setIsPasswordOpen((prev) => !prev)}
              aria-expanded={isPasswordOpen}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left transition-colors hover:bg-surface-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-control bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
                  <KeyRound size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink">Change Password</h2>
                  <p className="text-xs sm:text-sm text-ink-muted truncate">
                    Update your administrator password
                  </p>
                </div>
              </div>
              <ChevronDown
                size={20}
                className={`text-ink-subtle transition-transform duration-200 flex-shrink-0 ml-3 ${
                  isPasswordOpen ? 'rotate-180 text-brand-700' : ''
                }`}
              />
            </button>

            {/* Collapsible Form Section */}
            {isPasswordOpen && (
              <div className="px-4 pb-5 pt-1 sm:px-6 sm:pb-6 border-t border-border/50 bg-surface/30">
                <form onSubmit={handleSubmit} className="max-w-lg space-y-4 pt-3">
                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                      Current Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (fieldErrors.currentPassword) {
                            setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                          }
                        }}
                        placeholder="Enter current password"
                        className={`input-field text-sm pr-10 ${
                          fieldErrors.currentPassword ? 'border-danger-500 ring-1 ring-danger-500/20' : ''
                        }`}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-2.5 text-ink-subtle hover:text-ink-muted transition-colors"
                        aria-label={showCurrent ? 'Hide password' : 'Show password'}
                      >
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.currentPassword && (
                      <p className="text-danger-500 text-xs mt-1 font-medium">
                        {fieldErrors.currentPassword}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                      New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (fieldErrors.newPassword) {
                            setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                          }
                        }}
                        placeholder="Minimum 6 characters"
                        className={`input-field text-sm pr-10 ${
                          fieldErrors.newPassword ? 'border-danger-500 ring-1 ring-danger-500/20' : ''
                        }`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-2.5 text-ink-subtle hover:text-ink-muted transition-colors"
                        aria-label={showNew ? 'Hide password' : 'Show password'}
                      >
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-subtle mt-1.5 leading-normal">
                      Must be at least 6 characters. For a strong password, use a mix of uppercase & lowercase letters, numbers, and symbols (e.g. !@#$).
                    </p>
                    {fieldErrors.newPassword && (
                      <p className="text-danger-500 text-xs mt-1 font-medium">
                        {fieldErrors.newPassword}
                      </p>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (fieldErrors.confirmPassword) {
                            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                          }
                        }}
                        placeholder="Re-enter new password"
                        className={`input-field text-sm pr-10 ${
                          fieldErrors.confirmPassword ? 'border-danger-500 ring-1 ring-danger-500/20' : ''
                        }`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-2.5 text-ink-subtle hover:text-ink-muted transition-colors"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="text-danger-500 text-xs mt-1 font-medium">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6"
                    >
                      Update Password
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Future setting rows can be added here as additional accordion items */}
        </Card>
      </PageContainer>
    </Layout>
  );
};
