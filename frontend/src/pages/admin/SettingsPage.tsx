import React, { useState } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/common';
import { useStore } from '../../store';
import { authService } from '../../services/auth';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { KeyRound, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'password',
    label: 'Change Password',
    icon: <KeyRound size={18} />,
    description: 'Update your administrator password',
  },
  // Future settings sections (e.g. general, backup, shop details) can be added here without refactoring
];

export const SettingsPage: React.FC = () => {
  const addNotification = useStore((s) => s.addNotification);
  const currentUser = useStore((s) => s.currentUser);

  // Active section for extensible settings layout
  const [activeSection, setActiveSection] = useState<string>('password');

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

      // On success: clear form, display success toast, keep current session intact
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);

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
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Settings</h1>
          <p className="text-sm text-ink-muted mt-1">
            Manage your admin account credentials and system preferences.
          </p>
        </div>

        {/* Settings Layout: Left Nav + Right Content (extensible for future sections) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Section Navigation */}
          <div className="md:col-span-1 space-y-1">
            <div className="bg-surface-card border border-border rounded-card p-2 shadow-xs">
              {SETTINGS_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm font-medium transition-colors text-left ${
                    activeSection === sec.id
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <span className={activeSection === sec.id ? 'text-brand-700' : 'text-ink-subtle'}>
                    {sec.icon}
                  </span>
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Info Box */}
            <div className="p-4 bg-surface-muted border border-border rounded-card text-xs text-ink-muted space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <ShieldCheck size={14} className="text-success-600" />
                <span>Account Security</span>
              </div>
              <p>Logged in as: <span className="font-mono text-ink">{currentUser?.username || currentUser?.email || 'admin'}</span></p>
              <p className="text-[11px] text-ink-subtle pt-1">
                Passwords must be at least 6 characters to meet distribution center security standards.
              </p>
            </div>
          </div>

          {/* Section Panel */}
          <div className="md:col-span-3">
            {activeSection === 'password' && (
              <Card variant="default" className="max-w-xl">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <div className="w-10 h-10 rounded-control bg-brand-50 text-brand-700 flex items-center justify-center">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink">Change Password</h2>
                    <p className="text-xs text-ink-muted">
                      Enter your current password followed by your new password.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
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
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
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
                    <p className="text-[11px] text-ink-subtle mt-1">
                      Must be at least 6 characters, differ from your current password, and not match common terms or your username.
                    </p>
                    {fieldErrors.newPassword && (
                      <p className="text-danger-500 text-xs mt-1 font-medium">
                        {fieldErrors.newPassword}
                      </p>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
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

                  {/* Submit Button (standard primary button, no gold accent per rule) */}
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
              </Card>
            )}
          </div>
        </div>
      </PageContainer>
    </Layout>
  );
};
