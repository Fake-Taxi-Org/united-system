/**
 * tokenRefresh.ts
 *
 * Sequential lock pattern for concurrent 401 → token refresh.
 * All requests that hit a 401 share a single refresh call.
 * Queued requests replay after successful refresh or all fail together.
 */

import { getApiUrl } from './auth.service';

const AUTH_USER_KEY = 'auth_user_minimal';

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

const subscribeTokenRefresh = (callback: (token: string | null) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string | null) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
  if (token === null) {
    window.dispatchEvent(new CustomEvent('session:expired'));
  }
};

export const refreshAccessToken = async (): Promise<string | null> => {
  // No stored session means the user is definitely anonymous — refreshing is pointless
  // (auth_user_minimal is only written on login and removed on logout/expiry).
  const hasStoredSession = (() => {
    try {
      return localStorage.getItem(AUTH_USER_KEY) !== null;
    } catch {
      return false;
    }
  })();

  if (!hasStoredSession) {
    return null;
  }

  if (isRefreshing) {
    return new Promise(resolve => subscribeTokenRefresh(resolve));
  }

  isRefreshing = true;

  try {
    const response = await fetch(`${getApiUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Required to send HTTP-only cookies
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    // Backend sets new HTTP-only cookies automatically
    onTokenRefreshed('refreshed');
    return 'refreshed';
  } catch {
    onTokenRefreshed(null);
    return null;
  } finally {
    isRefreshing = false;
  }
};
