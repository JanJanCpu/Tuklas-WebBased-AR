// Last-loaded copies of teacher lists, so screens show instantly while a fresh copy loads
// (the serverless backend and database can take a few seconds to wake up).
// Scoped by user for shared devices, and cleared on logout.
const PREFIX = "tuklas-cache:";
const key = (userId: string, name: string) => `${PREFIX}${userId}:${name}`;

export function readCache<T>(userId: string, name: string): T | null {
  try {
    const raw = localStorage.getItem(key(userId, name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(userId: string, name: string, value: unknown) {
  try {
    localStorage.setItem(key(userId, name), JSON.stringify(value));
  } catch {
    // Storage full or blocked: the screen still works, just without the instant copy.
  }
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Nothing to clear.
  }
}
