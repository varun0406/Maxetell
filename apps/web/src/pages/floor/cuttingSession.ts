export type CuttingFlow = "normal" | "direct_dispatch";

export type CuttingSession = {
  roll_id: string;
  roll_short: string;
  variant_code: string;
  variant_name: string;
  color: string | null;
  quality: string | null;
  item_name: string | null;
  item_code: string | null;
  remaining_meterage: number;
  flow: CuttingFlow;
};

const KEY = "mx_cutting_session";

export function loadCuttingSession(): CuttingSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CuttingSession;
  } catch {
    return null;
  }
}

export function saveCuttingSession(s: CuttingSession | null) {
  if (!s) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function patchSessionRoll(remaining_meterage: number) {
  const s = loadCuttingSession();
  if (!s) return;
  saveCuttingSession({ ...s, remaining_meterage });
}
