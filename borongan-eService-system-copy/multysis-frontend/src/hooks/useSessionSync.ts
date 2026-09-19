/**
 * useSessionSync.ts
 *
 * Polls /api/auth/session-status every 60 seconds and fires callbacks
 * when the server-side Redis session is expiring.
 *
 * This keeps frontend toasts in sync with actual server session state,
 * replacing the blind independent timers in useIdleTimeout/useAbsoluteTimeout.
 *
 * Falls back gracefully if the endpoint returns null/unavailable.
 */

import { useEffect, useRef } from 'react';
import api from '../services/api/auth.service';

const SESSION_POLL_INTERVAL_MS = 60_000; // poll every 60 seconds
const SERVER_DRIFT_BUFFER_MS = 5_000; // treat server TTL as 5s shorter to avoid races
const AUTH_USER_KEY = 'auth_user_minimal'; // written on login, removed on logout/expiry

const hasStoredSession = (): boolean => {
  try {
    return localStorage.getItem(AUTH_USER_KEY) !== null;
  } catch {
    return false;
  }
};

interface SessionStatus {
  idleRemainingMs: number | null;
  absoluteRemainingMs: number | null;
  error?: string;
}

interface UseSessionSyncOptions {
  onIdleWarning: () => void;
  onAbsoluteWarning: () => void;
  onIdleTimeout: () => void;
  onAbsoluteTimeout: () => void;
  enabled?: boolean; // default true
}

export const useSessionSync = (options: UseSessionSyncOptions) => {
  const { enabled = true } = options;

  // Store callbacks in a ref so fetchSessionStatus identity is stable
  // (avoids React re-creating it on every render and triggering effect churn)
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // Refs to track which callbacks have already fired (prevent double-fire)
  const idleWarningFired = useRef(false);
  const absoluteWarningFired = useRef(false);
  const idleTimeoutFired = useRef(false);
  const absoluteTimeoutFired = useRef(false);
  const isActive = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetFlags = () => {
    idleWarningFired.current = false;
    absoluteWarningFired.current = false;
    idleTimeoutFired.current = false;
    absoluteTimeoutFired.current = false;
  };

  const fetchSessionStatus = async () => {
    // Anonymous users have no session to check — skip the poll entirely
    if (!enabled || !hasStoredSession()) return;

    const { onIdleWarning, onAbsoluteWarning, onIdleTimeout, onAbsoluteTimeout } = callbacksRef.current;

    try {
      const response = await api.get('/auth/session-status');
      const data: SessionStatus = response.data.data;

      // Endpoint unavailable — skip this cycle, don't fire anything
      if (data.error === 'session_status_unavailable') {
        return;
      }

      const idleRemaining = data.idleRemainingMs ?? null;
      const absoluteRemaining = data.absoluteRemainingMs ?? null;

      // Idle warning: 2 minutes (120s) before idle expiry
      if (idleRemaining !== null && idleRemaining <= 2 * 60 * 1000 + SERVER_DRIFT_BUFFER_MS) {
        if (!idleWarningFired.current) {
          idleWarningFired.current = true;
          onIdleWarning();
        }
      }

      // Absolute warning: 5 minutes (300s) before absolute expiry
      if (absoluteRemaining !== null && absoluteRemaining <= 5 * 60 * 1000 + SERVER_DRIFT_BUFFER_MS) {
        if (!absoluteWarningFired.current) {
          absoluteWarningFired.current = true;
          onAbsoluteWarning();
        }
      }

      // Idle timeout: session expired (idleRemaining = 0)
      if (idleRemaining !== null && idleRemaining <= 0) {
        if (!idleTimeoutFired.current) {
          idleTimeoutFired.current = true;
          onIdleTimeout();
        }
      }

      // Absolute timeout: session expired (absoluteRemaining = 0)
      if (absoluteRemaining !== null && absoluteRemaining <= 0) {
        if (!absoluteTimeoutFired.current) {
          absoluteTimeoutFired.current = true;
          onAbsoluteTimeout();
        }
      }
    } catch {
      // Network/server error — skip silently, don't fire any callbacks
      // The independent timers in useIdleTimeout/useAbsoluteTimeout act as fallback
    }
  };

  useEffect(() => {
    if (!enabled) return;
    isActive.current = true;
    resetFlags();

    // Immediate first fetch
    fetchSessionStatus();

    // Clear any existing interval before setting a new one (defensive)
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      if (isActive.current) {
        fetchSessionStatus();
      }
    }, SESSION_POLL_INTERVAL_MS);

    return () => {
      isActive.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]); // Only re-run when `enabled` changes — fetchSessionStatus is always stable
};
