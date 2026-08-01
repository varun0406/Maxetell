/** Fire-and-forget ZPL — never block the cutter waiting on print ACK */
export function sendZplImmediate(zpl: string): void {
  void sendZpl(zpl).catch(() => {
    /* operator keeps cutting; ZPL saved in sendZpl fallback */
  });
}

/** Build a simple Code-128-friendly ZPL label for packing stickers */
export function buildPackingZpl(opts: {
  packingId: string;
  shortCode: string;
  meters: number;
  variantCode: string;
  variantName?: string;
  color?: string | null;
  quality?: string | null;
  rollShort?: string;
}): string {
  const variantLine = [opts.variantCode, opts.variantName, opts.color].filter(Boolean).join(" · ");
  const qualityLine = opts.quality ? `Q: ${opts.quality}` : "";
  return `^XA
^CF0,48
^FO30,20^FD${escapeZpl(String(opts.meters))} M^FS
^CF0,32
^FO30,75^FD${escapeZpl(variantLine)}^FS
^CF0,24
^FO30,115^FD${escapeZpl(qualityLine)}^FS
^FO30,145^FD${escapeZpl(opts.shortCode)}^FS
^BY2,2,55
^FO30,175^BCN,55,Y,N,N
^FD${escapeZpl(opts.packingId)}^FS
^XZ
`;
}

export function buildParcelZpl(opts: {
  parcelId: string;
  shortCode: string;
  totalMeters: number;
  lines: { code: string; meters: number }[];
}): string {
  const nested = opts.lines
    .slice(0, 6)
    .map((l, i) => `^FO40,${120 + i * 28}^FD${escapeZpl(`${l.code} ${l.meters}m`)}^FS`)
    .join("\n");
  return `^XA
^CF0,40
^FO40,30^FDPARCEL ${escapeZpl(opts.shortCode)}^FS
^CF0,28
^FO40,80^FDTotal ${opts.totalMeters}m^FS
${nested}
^BY2,2,50
^FO40,300^BCN,50,Y,N,N
^FD${escapeZpl(opts.parcelId)}^FS
^XZ
`;
}

function escapeZpl(s: string) {
  return s.replace(/[\^~]/g, " ");
}

export type PrinterConfig = { host: string; port: number };

const PRINTER_KEY = "mx_printer";

export function getPrinterConfig(): PrinterConfig | null {
  try {
    const raw = localStorage.getItem(PRINTER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrinterConfig;
  } catch {
    return null;
  }
}

export function setPrinterConfig(cfg: PrinterConfig | null) {
  if (!cfg) localStorage.removeItem(PRINTER_KEY);
  else localStorage.setItem(PRINTER_KEY, JSON.stringify(cfg));
}

export async function sendZpl(zpl: string, cfg?: PrinterConfig | null): Promise<{ ok: boolean; error?: string }> {
  const printer = cfg ?? getPrinterConfig();
  if (!printer?.host) {
    localStorage.setItem("mx_last_zpl", zpl);
    return { ok: true };
  }

  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.TcpPrint) {
    try {
      await cap.Plugins.TcpPrint.print({ host: printer.host, port: printer.port || 9100, data: zpl });
      return { ok: true };
    } catch (e: any) {
      localStorage.setItem("mx_last_zpl", zpl);
      return { ok: false, error: e?.message ?? "Native print failed" };
    }
  }

  const bridge = localStorage.getItem("mx_print_bridge") ?? "http://127.0.0.1:9101/print";
  const body = JSON.stringify({ host: printer.host, port: printer.port || 9100, zpl });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(bridge, blob)) return { ok: true };
    }
    const res = await fetch(bridge, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
    if (!res.ok) return { ok: false, error: `Print bridge ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    localStorage.setItem("mx_last_zpl", zpl);
    return { ok: false, error: e?.message ?? "Print failed" };
  }
}
