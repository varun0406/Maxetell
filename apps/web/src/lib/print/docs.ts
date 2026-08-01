/** Open a print window with HTML — user saves as PDF from browser print dialog */

export function openPrintWindow(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!w) {
    alert("Allow pop-ups to print / save PDF");
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111; font-size: 12px; margin: 0; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .muted { color: #666; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .brand { font-weight: 800; font-size: 18px; letter-spacing: -0.02em; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f3f3; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .right { text-align: right; }
  .kpi { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
  .kpi div { border: 1px solid #ddd; padding: 10px 14px; min-width: 120px; }
  .kpi strong { display: block; font-size: 18px; }
  .kpi span { color: #666; font-size: 11px; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; }
  .sticker { border: 2px solid #111; padding: 12px; width: 280px; margin: 8px; display: inline-block; vertical-align: top; page-break-inside: avoid; }
  .sticker .meters { font-size: 28px; font-weight: 800; }
  .sticker .code { font-family: ui-monospace, monospace; font-weight: 700; font-size: 14px; }
  .barcode { font-family: ui-monospace, monospace; font-size: 10px; letter-spacing: 0.12em; margin-top: 8px; border-top: 1px dashed #999; padding-top: 6px; word-break: break-all; }
  @media print { button { display: none !important; } body { padding: 0; } }
</style></head><body>
${bodyHtml}
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function fmt(n: number | null | undefined) {
  return Number(n ?? 0).toFixed(1);
}

function nowLabel() {
  return new Date().toLocaleString();
}

function header(docTitle: string) {
  return `<div class="header">
    <div><div class="brand">Maxwell Trading</div><div class="muted">Cloth stock &amp; dispatch</div></div>
    <div class="right"><strong>${escapeHtml(docTitle)}</strong><div class="muted">${escapeHtml(nowLabel())}</div></div>
  </div>`;
}

export function printStockByVariantReport(rows: any[], totals?: any) {
  const body = `
    ${header("Stock Analysis — By Variant")}
    <div class="kpi">
      <div><span>Available m</span><strong>${fmt(rows.reduce((s, r) => s + Number(r.available_m || 0), 0))}</strong></div>
      <div><span>Available pcs</span><strong>${rows.reduce((s, r) => s + Number(r.available_pcs || 0), 0)}</strong></div>
      <div><span>Roll remaining m</span><strong>${fmt(rows.reduce((s, r) => s + Number(r.roll_remaining_m || 0), 0))}</strong></div>
      <div><span>Dispatched m</span><strong>${fmt(rows.reduce((s, r) => s + Number(r.dispatched_m || 0), 0))}</strong></div>
      ${totals?.open_challans != null ? `<div><span>Open challans</span><strong>${totals.open_challans}</strong></div>` : ""}
    </div>
    <h2>Variant stock position</h2>
    <table>
      <thead><tr>
        <th>Variant</th><th>Item / Quality</th><th class="right">Roll left</th>
        <th class="right">Packed</th><th class="right">Godown</th><th class="right">Parcel</th>
        <th class="right">Available</th><th class="right">Dispatched</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td><strong>${escapeHtml(r.variant_code)}</strong><br/><span class="muted">${escapeHtml(r.variant_name ?? "")} ${escapeHtml(r.color ?? "")}</span></td>
          <td>${escapeHtml(r.item_name ?? "")}<br/><span class="muted">${escapeHtml(r.quality ?? "")}</span></td>
          <td class="right">${fmt(r.roll_remaining_m)}</td>
          <td class="right">${fmt(r.packed_m)} / ${r.packed_pcs}</td>
          <td class="right">${fmt(r.godown_m)} / ${r.godown_pcs}</td>
          <td class="right">${fmt(r.consolidated_m)} / ${r.consolidated_pcs}</td>
          <td class="right"><strong>${fmt(r.available_m)}</strong> / ${r.available_pcs}</td>
          <td class="right">${fmt(r.dispatched_m)} / ${r.dispatched_pcs}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="footer">Maxwell stock PDF · meters &amp; piece counts by stage · print / Save as PDF</div>
  `;
  openPrintWindow("Stock by Variant", body);
}

export function printGodownStockReport(rows: any[]) {
  const body = `
    ${header("Godown Stock Detail")}
    <table>
      <thead><tr>
        <th>Godown</th><th>Location</th><th>Packing</th><th>Variant</th><th class="right">Meters</th><th>Age</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td>${escapeHtml(r.godown_name)} (${escapeHtml(r.godown_code)})</td>
          <td>${escapeHtml(r.location_hint ?? "—")}</td>
          <td>${escapeHtml(r.short_code)}</td>
          <td>${escapeHtml(r.variant_code)} ${escapeHtml(r.variant_name ?? "")}</td>
          <td class="right">${fmt(r.length_meters)}</td>
          <td>${r.age_days}d</td>
          <td>${escapeHtml(r.status)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="footer">Godown location report · Maxwell Trading</div>
  `;
  openPrintWindow("Godown Stock", body);
}

export function printAgingReport(rows: any[]) {
  const body = `
    ${header("Stock Aging Report")}
    <p class="muted">Pieces sitting packed / in godown / consolidated — oldest first</p>
    <table>
      <thead><tr>
        <th>Age</th><th>Packing</th><th>Variant</th><th class="right">m</th><th>Location</th><th>Supplier</th><th>Roll</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td><strong>${r.age_days}d</strong></td>
          <td>${escapeHtml(r.short_code)}</td>
          <td>${escapeHtml(r.variant_code)}</td>
          <td class="right">${fmt(r.length_meters)}</td>
          <td>${escapeHtml(r.godown_name ?? "—")} ${escapeHtml(r.location_hint ?? "")}</td>
          <td>${escapeHtml(r.supplier_name)}</td>
          <td>${escapeHtml(r.roll_short)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
  openPrintWindow("Stock Aging", body);
}

export function printDeliveryChallan(challan: any) {
  const reqs = challan.requirements ?? [];
  const scans = challan.scans ?? [];
  const body = `
    ${header("Delivery Challan")}
    <table style="border:none;margin-bottom:12px">
      <tr style="border:none">
        <td style="border:none;width:50%;vertical-align:top">
          <div class="muted">Challan No</div>
          <div style="font-size:22px;font-weight:800">${escapeHtml(challan.challan_no)}</div>
          <div class="muted">Date: ${escapeHtml(challan.challan_date)} · Status: ${escapeHtml(challan.status)}</div>
        </td>
        <td style="border:none;width:50%;vertical-align:top">
          <div class="muted">Deliver to</div>
          <div style="font-weight:700">${escapeHtml(challan.party_name || challan.addr_party || "—")}</div>
          <div>${escapeHtml(challan.address_line ?? "")}</div>
          <div>${escapeHtml([challan.city, challan.state].filter(Boolean).join(", "))}</div>
        </td>
      </tr>
    </table>
    <h2>Required materials</h2>
    <table>
      <thead><tr><th>Variant</th><th class="right">Required m</th><th class="right">Required pcs</th></tr></thead>
      <tbody>
        ${
          reqs.length
            ? reqs
                .map(
                  (r: any) =>
                    `<tr><td>${escapeHtml(r.variant_code)}</td><td class="right">${fmt(r.required_meters)}</td><td class="right">${r.required_pieces}</td></tr>`,
                )
                .join("")
            : `<tr><td colspan="3" class="muted">No checklist — open stock</td></tr>`
        }
      </tbody>
    </table>
    <h2>Scanned stock</h2>
    <table>
      <thead><tr><th>Type</th><th>Ref</th><th>Scanned at</th></tr></thead>
      <tbody>
        ${
          scans.length
            ? scans
                .map(
                  (s: any) =>
                    `<tr><td>${escapeHtml(s.scan_type)}</td><td>${escapeHtml(s.scanned_ref)}</td><td>${escapeHtml(s.scanned_at)}</td></tr>`,
                )
                .join("")
            : `<tr><td colspan="3" class="muted">No scans yet</td></tr>`
        }
      </tbody>
    </table>
    ${challan.notes ? `<p><strong>Notes:</strong> ${escapeHtml(challan.notes)}</p>` : ""}
    <div style="margin-top:40px;display:flex;justify-content:space-between">
      <div>Prepared by _______________</div>
      <div>Received by _______________</div>
    </div>
    <div class="footer">Maxwell Delivery Challan · Save as PDF from print dialog</div>
  `;
  openPrintWindow(`Challan ${challan.challan_no}`, body);
}

export function printPackingStickers(packings: any[]) {
  const cards = packings
    .map(
      (p) => `
    <div class="sticker">
      <div class="meters">${fmt(p.length_meters)} m</div>
      <div class="code">${escapeHtml(p.variant_code)} · ${escapeHtml(p.variant_name ?? p.color ?? "")}</div>
      <div class="muted">${escapeHtml(p.item_name ?? "")} ${p.quality ? "· " + escapeHtml(p.quality) : ""}</div>
      <div style="margin-top:6px"><strong>${escapeHtml(p.short_code)}</strong></div>
      <div class="muted">Roll ${escapeHtml(p.roll_short ?? "")}</div>
      <div class="barcode">${escapeHtml(p.packing_id)}</div>
    </div>`,
    )
    .join("");
  const body = `
    ${header("Packing Stickers (preview / laser print)")}
    <p class="muted">Thermal ZPL uses Device &amp; Sync printer. This sheet is for A4 preview / PDF backup stickers.</p>
    ${cards}
  `;
  openPrintWindow("Packing Stickers", body);
}

export function printSupplierStockReport(rows: any[]) {
  const body = `
    ${header("Stock by Supplier")}
    <table>
      <thead><tr>
        <th>Supplier</th><th class="right">Rolls</th><th class="right">Original m</th>
        <th class="right">Remaining m</th><th class="right">At mill</th><th class="right">In cutting</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td>${escapeHtml(r.supplier_name)}</td>
          <td class="right">${r.rolls}</td>
          <td class="right">${fmt(r.original_m)}</td>
          <td class="right"><strong>${fmt(r.remaining_m)}</strong></td>
          <td class="right">${fmt(r.at_mill_m)}</td>
          <td class="right">${fmt(r.in_cutting_m)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
  openPrintWindow("Stock by Supplier", body);
}
