/** Notify kitchen/bar terminals that the cashier changed today's order queue. */
const CHANNEL = "hotcol-cafe-orders";
const STORAGE_KEY = "hotcol_cafe_orders_bump";

export function notifyCafeOrdersChanged(): void {
  if (typeof window === "undefined") return;
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ at: Date.now() });
    bc.close();
  } catch {
    /* Safari private mode / old browsers */
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function subscribeCafeOrdersChanged(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => onChange();
  } catch {
    /* ignore */
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    bc?.close();
    window.removeEventListener("storage", onStorage);
  };
}

export function bumpCafeOrdersFeed(): void {
  notifyCafeOrdersChanged();
}
