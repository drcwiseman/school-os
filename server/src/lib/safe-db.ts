/** Run a DB query; on failure log and return fallback (VPS schema lag). */
export async function safeDb<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[safeDb:${label}]`, (err as Error).message?.slice(0, 160));
    return fallback;
  }
}
