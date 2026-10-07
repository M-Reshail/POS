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

  const tooltipText = isDenied
    ? 'Notifications: BLOCKED in browser'
    : isSubscribed
    ? 'Notifications: ON (Click to disable)'
    : 'Notifications: OFF (Click to enable)';

  const Icon = actionLoading
    ? Loader2
    : isSubscribed
    ? BellRing
    : isDenied
    ? BellOff
    : Bell;

  return (
    <div className="relative inline-block group">
      <button
        id="push-notification-toggle"
        onClick={handleToggle}
        disabled={isDisabled}
        aria-label={tooltipText}
        className={`
          p-1.5 rounded-control transition-all duration-200 flex-shrink-0 flex items-center justify-center
          ${loading ? 'opacity-50 cursor-wait' : ''}
          ${isDenied
            ? 'text-danger-400 hover:text-danger-300 cursor-not-allowed'
            : isSubscribed
            ? 'text-accent-400 hover:text-accent-300 hover:bg-white/10'
            : 'text-white/70 hover:text-white hover:bg-white/10'
          }
        `}
      >
        <Icon
          size={18}
          className={actionLoading ? 'animate-spin text-accent-400' : isSubscribed ? 'animate-pulse text-accent-400' : ''}
        />
      </button>

      {/* Hover Status Popup / Tooltip */}
      <div className="group-hover:opacity-100 group-hover:visible opacity-0 invisible transition-all duration-150 absolute top-full mt-2 right-0 z-50 whitespace-nowrap bg-brand-900 text-white text-xs font-medium px-3 py-1.5 rounded-control border border-brand-700 shadow-xl pointer-events-none flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isDenied ? 'bg-danger-500' : isSubscribed ? 'bg-success-500 animate-ping' : 'bg-ink-subtle'}`} />
        <span>{tooltipText}</span>
      </div>

      {/* Denied details tooltip banner */}
      {showDeniedTip && (
        <div className="absolute top-full mt-2 right-0 z-50 w-64 p-3 bg-brand-900 text-white text-xs rounded-card border border-brand-700 shadow-xl">
          <p className="font-bold text-accent-400 mb-1">Notifications Blocked</p>
          <p className="text-white/80 leading-snug">
            Open site settings in your browser address bar and allow Notifications, then click again.
          </p>
        </div>
      )}
    </div>
  );
};
