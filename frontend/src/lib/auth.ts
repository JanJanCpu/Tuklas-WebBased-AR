import type { AuthUser } from "../types/domain";

const TOKEN_KEY = "tuklas-token";
const USER_KEY = "tuklas-user";
const SESSION_EVENT = "tuklas-session-change";
let sessionNotice = "";

export function getSessionNotice() { return sessionNotice; }

export function subscribeSession(listener: () => void) {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionNotice = "";
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function cacheAccount(token: string, user: AuthUser) {
  if (getToken() !== token || getStoredUser()?.id !== user.id) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(expired = false) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionNotice = expired ? "Your session expired. Log in again to send your saved work." : "";
  window.dispatchEvent(new Event(SESSION_EVENT));
}
