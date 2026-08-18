/**
 * PushNotificationToggle
 *
 * A self-contained button that manages the full browser push subscription lifecycle:
 *
 *  • On mount: checks if a push subscription already exists (so the toggle
 *    reflects the actual state, even across page reloads).
 *  • On click (when not subscribed):
 *      1. Requests Notification.permission — if denied, shows an info tooltip
 *         and leaves the button in the disabled state.
 *      2. On "granted": subscribes via the Push API + saves to DB.
 *  • On click (when subscribed): unsubscribes from push + removes from DB.
 *
 * Placement: near the "Add Reminder" button in the dashboard header — consistent
 * with the existing UI pattern for reminder-related controls.
 */

import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from '../../services/pushService';

type PermissionState = 'default' | 'granted' | 'denied';

export const PushNotificationToggle: React.FC = () => {
  const [isSubscribed,    setIsSubscribed]    = useState(false);
  const [permission,      setPermission]      = useState<PermissionState>('default');
  const [loading,         setLoading]         = useState(true); // checking initial state
  const [actionLoading,   setActionLoading]   = useState(false);
  const [showDeniedTip,   setShowDeniedTip]   = useState(false);

  // ── Check existing subscription on mount ─────────────────────────────────────
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Register SW early so PushManager is available
        await registerServiceWorker();

        const currentPerm = Notification.permission as PermissionState;
        setPermission(currentPerm);

        if (currentPerm === 'granted') {
          const sub = await getCurrentSubscription();
          setIsSubscribed(!!sub);
        }
      } catch {
        // Browser doesn't support push — stay in default state
      } finally {
        setLoading(false);
      }
    };

    // Notifications API is only available in secure contexts
    if ('Notification' in window) {
      checkStatus();
    } else {
      setLoading(false);
    }
  }, []);

  // ── Toggle handler ────────────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!('Notification' in window)) return;

    if (isSubscribed) {
      // — Unsubscribe —
      setActionLoading(true);
      try {
        const ok = await unsubscribeFromPush();
        if (ok) {
          setIsSubscribed(false);
          setPermission('default');
        }
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // — Subscribe: first request permission if not yet granted —
    if (permission !== 'granted') {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result === 'denied') {
        setShowDeniedTip(true);
        setTimeout(() => setShowDeniedTip(false), 4000);
        return;
      }
      if (result !== 'granted') return; // 'default' = dismissed
    }

    setActionLoading(true);
    try {
      const sub = await subscribeToPush();
      setIsSubscribed(!!sub);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  // Don't render if browser doesn't support push at all
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  const isDenied   = permission === 'denied';
  const isDisabled = isDenied || loading || actionLoading;

  const buttonLabel = isDenied
    ? 'Notifications Blocked'
    : isSubscribed
    ? 'Disable Notifications'
    : 'Enable Notifications';

  const Icon = actionLoading
    ? Loader2
    : isSubscribed
    ? BellRing
    : isDenied
    ? BellOff
    : Bell;

  return (
    <div className="relative inline-block">
      <button
        id="push-notification-toggle"
        onClick={handleToggle}
        disabled={isDisabled}
        title={
          isDenied
            ? 'Notifications are blocked. Enable them in your browser settings.'
            : isSubscribed
            ? 'Click to disable push notifications'
            : 'Click to enable push notifications for due payment reminders'
        }
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          border transition-all duration-200 select-none
          ${loading ? 'opacity-50 cursor-wait' : ''}
          ${isDenied
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isSubscribed
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300'
          }
        `}
      >
        <Icon
          size={13}
          className={actionLoading ? 'animate-spin' : isSubscribed ? 'animate-pulse' : ''}
        />
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>

      {/* Denied tooltip */}
      {showDeniedTip && (
        <div className="absolute top-full mt-2 right-0 z-50 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl">
          <p className="font-semibold mb-1">Notifications are blocked</p>
          <p className="text-slate-300 leading-snug">
            Open your browser's site settings and allow notifications for this site, then try again.
          </p>
          {/* Arrow */}
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-800 rotate-45" />
        </div>
      )}
    </div>
  );
};
