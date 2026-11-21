// Subscription churn is short-lived transport traffic, not an hourly game action.
// Share the budget across an identity's sockets; rejected attempts never extend it.
export function createWatchLimit(now = Date.now) {
  const windows = new Map<string, { expiresAt: number; attempts: number }>();
  return (identity: string) => {
    const time = now();
    for (const [key, window] of windows) if (window.expiresAt <= time) windows.delete(key);
    let window = windows.get(identity);
    if (!window) {
      window = { expiresAt: time + 60000, attempts: 0 };
      windows.set(identity, window);
    }
    return ++window.attempts <= 120;
  };
}
