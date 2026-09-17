# Maxwell v1 → BRD v2 Gap Analysis
## Current Implementation vs. Role-First Operational Design

---

## 0. Core Design Principle — Transaction-First vs. Entity-First

| BRD v2 Asks | Current State |
|---|---|
| **Entity-first** screens: open a Job Worker / Supplier / Party and see _everything_ about that relationship in one place | **Transaction-first** screens: sidebar menu is event-driven — "Suppliers & Inward", "Job Work", "Parties & Ship-to", "Delivery Challans" |
| Transactions launched _from inside_ the account page where context already lives | Transactions are standalone forms. E.g. sending to job work requires manually selecting roll + worker from dropdowns, with no pre-filled context |
| "Can the person answer their three daily questions without opening a second screen?" | No. A user wanting to know "what's with Rajesh Dyeing right now?" must open Job Work → filter mentally → open Analytics → cross-reference. Multiple screens required. |

> [!IMPORTANT]
> **The entire current UI architecture is v1 (transaction-first).** The BRD v2's central thesis — entity-first account pages — has not been started. This is the single largest structural gap.

---

## 1. Process Flow

| Step | BRD v2 | Current Implementation | Gap |
|---|---|---|---|
| **Purchase** | Buy against a Purchase Bill | ❌ No `mx_purchase_bills` table or entity. Stock is inwarded directly against a supplier. | **Missing entirely** |
| **Inward** | Lineage ID assigned, supplier alias recorded | ✅ `mx_rolls` created with UUID `roll_id`, `short_code`, `lot_no`. Linked to `supplier_id`. | Lineage ID exists as `roll_id`. But no alias layer — there's no mechanism for multiple searchable names per lot. |
| **Job Work Out** | Roll sent against purchase bill copy; job work ref recorded as alias | ✅ `POST /mx/job-work/out` — roll assigned to worker, meterage deducted, status → `at_job_work`. | No purchase bill linkage. No alias/ref capture (e.g. "2332/33/59"). No challan print. |
| **Job Work Return** | Validated vs. sent, shortage logged, quality recorded, ledger updated | ✅ `POST /mx/job-work/:id/return` — `meter_returned`, `shortage_meters` auto-calculated, `received_confirmed_at` tracked. | No quality result field (accepted/defect/rejected). No reason codes. No supervisor sign-off on excess shortage. No ledger integration. |
| **Cutting / Packing** | Single operation. ZPL label printed. Commercial name assigned. | ✅ `CuttingStationPage` + `POST /mx/packings/cut`. Scan roll → numpad cut length → ZPL label prints. Parent roll decremented; auto-depleted at zero. | No commercial name assignment (no "Carens"/"Kia" field on packing). No quality flag propagation from job work. |
| **Godown** | Packings stored on racks | ✅ `GodownReceivePage` — scan packing, select godown, enter rack hint. Status → `in_godown`. | Works but no rack barcode scanning (manual select). No suggested rack. No occupancy view. No rack-to-rack transfer. |
| **Parcel** | Optional consolidation | ✅ `ParcelPage` — scan packings, seal, print master ZPL label. | No mixed-lineage warning. No "view contents after sealing." |
| **Challan / Dispatch** | Goods loaded and shipped via pick list + scan | ✅ `FloorChallanPage` — open challan, scan packings/parcels, dispatch. `AdminChallanCreatePage` for creation. | No pick list grouped by godown/rack. No "Today" screen. No walking-order routing. No progress bars. No wrong-item audio alerts. No over-scan protection. |
| **Delivered** | Challan closed | ⚠️ Partial — challan status enum includes `delivered`, but no UI to mark delivery. | Admin must manually change status. |

---

## 2. Owner / Management Workspace

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **Home screen with live tiles** (material at job work, aging alerts, stock in godown, dispatched-but-unbilled, payables, receivables, in-vs-out this month, shortage this month) | `AnalyticsDashboard` has KPI tiles for: available packing, rolls remaining, mill WIP, dispatched meters. Has a "Mill WIP" table by worker. | ⚠️ **Partial** — only 4 of 9 tiles exist. No financial tiles (payables, receivables). No aging alerts. No in-vs-out comparison. No shortage summary. |
| **Margin per lot report** | ❌ No cost/price data in schema at all. No `purchase_price`, no `job_work_rate`, no `sale_price`. | **Missing entirely** |
| **Job worker scorecard** (turnaround, shortage %, rejection %) | ❌ Dashboard shows meters outstanding and oldest outward, but no computed scorecard with rankings. | **Missing entirely** |
| **Supplier scorecard** | `stock-by-supplier` analytics endpoint shows rolls, original/remaining meterage. | ⚠️ **Partial** — meterage only. No quality/rejection data. No price trend. |
| **Dead stock report** | `aging` endpoint returns packings sorted by age. | ⚠️ **Partial** — data exists but no threshold-based alert or value computation. |
| **Read-only by default** | No role-based UI restriction. All screens show all actions. | ❌ **Missing** |

---

## 3. Job Worker Account Page (Flagship Screen)

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **360° account page** — open "Rajesh Dyeing" and see everything | `JobWorkModule` has 3 tabs: Send Out / Receive Returns / Workers List. Workers are a flat list of cards (name + contact + type). Clicking a worker does nothing. | ❌ **No entity page.** Workers are a CRUD list, not an account page. |
| **Header**: name, GSTIN, rate card, capacity, ledger balance, trust indicators | Only `name`, `contact`, `job_work_type` stored in `mx_job_workers`. | ❌ Missing: GSTIN, address, rate card, capacity, ledger balance, trust scores. |
| **Tab 1 — "With Them Now"**: live list of lots at this worker with days-out colouring | The data exists in `mx_job_work` (can be filtered by `job_worker_id` where `processed_state='outward'`). But no per-worker view in the UI. | ❌ **Not surfaced.** Data is queryable but no dedicated UI. |
| **Tab 2 — Capacity & Load** | No capacity fields on `mx_job_workers`. | ❌ **Missing entirely** |
| **Tab 3 — Ledger / Account** | No financial tables (payments, charges, debit notes). | ❌ **Missing entirely** |
| **Tab 4 — History** | Closed job work records exist in DB. No per-worker filtered history view. | ❌ **Not surfaced** |
| **Tab 5 — Documents** | No document storage. | ❌ **Missing entirely** |
| **Alerts on page** (overdue, ledger threshold, shortage trend) | No alert engine. | ❌ **Missing entirely** |

---

## 4. Dispatcher Workspace

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **Screen 1 — "Today"**: plain list of orders to ship today, with progress | `FloorChallanPage` shows a list of non-delivered challans, each showing challan_no, party name, status, scan count. | ⚠️ **Partial** — exists as a flat list but no date filtering ("today"), no meterage totals, no "how many locations to walk to", no progress indicator. |
| **Screen 2 — Pick List**: grouped by godown → rack, in walking order | `location_hints` data exists on the challan detail (packings with godown + rack). Shown as a list. | ⚠️ **Partial** — hints shown but not grouped by godown/rack, not sorted by walking order. |
| **Screen 3 — Scanning**: ✅/⚠️/🔴 feedback, progress bar, audio | Scanning works (packing or parcel scan → `POST /mx/challans/:id/scan`). Error plays a 440Hz beep via `AudioContext`. | ⚠️ **Partial** — scan works, basic audio exists. But no green/amber/red visual flash, no progress bar, no over-scan protection, no "wrong variant" explanation text. |
| **No money visible** | Floor pages show no financial data. | ✅ **Met.** |
| **Barcode as primary input** | Floor screens use text inputs that accept scanned codes. | ✅ **Met** (functionally, though not camera-scan). |
| **Vehicle number, transporter at dispatch** | `POST /mx/challans/:id/dispatch` exists but captures no vehicle/transporter data. | ❌ **Missing** |
| **Returns intake** | No return intake screen. | ❌ **Missing entirely** |
| **Undo last scan** | No undo functionality. | ❌ **Missing** |
| **Offline dispatch** | Offline sync infrastructure exists (`localDb.ts`, `syncWorker.ts`, `mx_sync_conflicts`). Floor scanning does not explicitly use it for challan scans. | ⚠️ **Partial** — infrastructure exists but dispatch scanning is online-only. |

---

## 5. Purchase / Procurement Workspace

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **Supplier Account Page** (360° with tabs: Open POs, Purchase History, Ledger, Quality, Documents) | `SuppliersModule` is a flat CRUD list (name + contact) + roll inward form + lots history. | ❌ **No entity page.** Suppliers are managed as a simple list. |
| **Purchase Bill entity** | No `mx_purchase_bills` table. | ❌ **Missing entirely** |
| **Inward register / Bill reconciliation** | Lots are logged directly. No bill-vs-received check. | ❌ **Missing** |
| **Reorder suggestion** | No reorder logic. | ❌ **Missing** |
| **Price/rate tracking per item** | No price columns anywhere in schema. | ❌ **Missing** |

---

## 6. Job Work Coordinator Workspace

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **"Job Work Control Board"** with 3 panels: Ready to Send / Currently Out / Awaiting Validation | `job-work-pendency` analytics endpoint returns: `open` (currently out), `awaiting_confirm` (returned but unconfirmed), `by_worker` (summary). This is rendered in the Analytics dashboard under the "Job work" tab. | ⚠️ **Data exists, but not as a dedicated workspace.** It's buried inside the analytics dashboard as one of eight tabs. No "Ready to Send" panel (inwarded rolls with no job work). |
| **Send-to-job-work screen** with purchase bill pre-fill, alias capture, expected return auto-calc, challan print | `JobWorkModule` Tab 1 has Autocomplete dropdowns for Roll + Worker + meters + date. | ⚠️ **Partial** — form exists but no purchase bill link, no alias capture, no expected return date, no challan print. |
| **Return & validation screen** with shortage auto-calc, quality result, supervisor sign-off | `JobWorkModule` Tab 2 shows open jobs with a "Record Return" panel (meters + date). `POST /mx/job-work/:id/return` calculates shortage. | ⚠️ **Partial** — shortage calculation works. No quality result dropdown. No tolerance %. No supervisor sign-off. |

---

## 7. Floor Worker Workspace (Cutting / Packing)

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **Cutting & Packing Station** | ✅ `CuttingStationPage` — pick variant → pick/scan roll → numpad → cut → ZPL print. Large touch targets, mobile-friendly. | ✅ **Core flow works.** |
| **Quality flag propagation** from job work | No quality data on job work return. Nothing propagated to cutting screen. | ❌ **Missing** |
| **Reprint label** | No reprint action without creating a new packing. | ❌ **Missing** |
| **Undo last cut** (time-boxed) | No undo mechanism. | ❌ **Missing** |
| **Wastage capture** | No wastage field or flow. | ❌ **Missing** |
| **Offline queue indicator** | Cutting page uses `localCutPacking` for offline cuts. No visible unsynced count shown to the worker. | ⚠️ **Partial** — offline cutting works, but no visible indicator. |
| **Godown: scan packing → scan rack** | `GodownReceivePage` — scan packing, select godown dropdown, type rack hint. | ⚠️ **Partial** — godown is a dropdown not a scan. Rack is typed not scanned. |
| **Suggested rack / occupancy view** | Not implemented. | ❌ **Missing** |
| **Stock transfer between racks** | Not implemented. | ❌ **Missing** |
| **Parcel: mixed-lineage warning** | Not implemented. | ❌ **Missing** |
| **Parcel: view contents after sealing** | Not implemented. | ❌ **Missing** |

---

## 8. Sales / Order Desk Workspace

| BRD v2 Feature | Current State | Status |
|---|---|---|
| **Party (Buyer) Account Page** with tabs: Outstanding, Order History, Live Orders, Returns, Rate History | `PartiesModule` has 2 tabs: "Parties Directory" (CRUD list) and "All Ship-to Addresses." Clicking a party shows its linked addresses only. | ❌ **No entity page.** No order history, no outstanding, no returns, no rates. |
| **Commercial naming** ("Carens", "Kia") on packings | No `commercial_name` field on `mx_packings` or any table. | ❌ **Missing entirely** |
| **Availability check** (in godown / at job work / not available) | `stock-by-variant` analytics gives this data in aggregate. Not surfaced as a per-party query. | ⚠️ **Data exists** but not accessible from a sales context. |

---

## 9. Accounts Workspace

| BRD v2 Feature | Current State | Status |
|---|---|---|
| Payables / Receivables / Three-way match / Cost roll-up / Agent commission / GST / Debit-credit notes | **Nothing implemented.** No financial tables, no payment tracking, no ledger, no commission, no GST fields beyond party GSTIN. | ❌ **Missing entirely** |

---

## 10. Universal Search

| BRD v2 Feature | Current State | Status |
|---|---|---|
| One search box on every screen. Type any name/code/barcode → resolve to full journey. | `GET /mx/analytics/lineage/:ref` API exists — resolves packing, parcel, or roll by ID/short_code. Returns full journey with job work history, challan scans, sibling packings. UI: a "Trace" tab in the Analytics dashboard with a text input. | ⚠️ **Partial** — lineage trace API is solid. But it's buried in the analytics dashboard, not present on every screen. Does not search by supplier name, party name, or commercial name — only by ID/code. No alias resolution. |

---

## 10A. Barcode Architecture

| BRD v2 Feature | Current State | Status |
|---|---|---|
| Roll barcode at inward | `mx_rolls.short_code` / `lot_no` exist. No barcode generated or printed at inward. | ⚠️ **Partial** — code exists, no print. |
| Packing barcode (ZPL) at cutting | ✅ ZPL label printed immediately via `buildPackingZpl` + `sendZplImmediate` over LAN. | ✅ **Working** |
| Parcel master barcode (ZPL) | ✅ `buildParcelZpl` prints on seal. | ✅ **Working** |
| Rack barcode | No rack barcoding. | ❌ **Missing** |
| Job work challan barcode | No job work challan print. | ❌ **Missing** |
| **Label content**: item, shade, commercial name, meters, date. No rate/value/supplier. | Label shows: short_code, variant_code, meters, date. No commercial name. | ⚠️ **Partial** — correct fields excluded, but commercial name not included because it doesn't exist. |
| Reprint without duplicate | Not implemented. | ❌ **Missing** |
| Duplicate-scan protection | Challan scans have a `UNIQUE(challan_id, scan_type, scanned_ref)` constraint. | ✅ **Working** at DB level. |
| Manual short-code fallback | Floor inputs accept typed codes. Not logged/audited. | ⚠️ **Partial** |

---

## 11. Alerts & Exception Engine

| BRD v2 Feature | Current State | Status |
|---|---|---|
| Material at job worker beyond turnaround → Coordinator + Owner | ❌ No alert system. | ❌ **Missing entirely** |
| Returned material not validated within 24h | `awaiting_confirm` data exists in analytics API. No push alert. | ❌ **Missing** |
| Shortage above tolerance % | No tolerance config. | ❌ **Missing** |
| Order short on stock | No shortfall pre-warning. | ❌ **Missing** |
| Dispatched but unbilled | No invoice tracking. | ❌ **Missing** |
| Dead stock alert | Aging data exists. No threshold trigger. | ❌ **Missing** |
| Offline sync conflict | `mx_sync_conflicts` table exists. Shown on Settings page. | ⚠️ **Partial** — visible but not pushed as notifications. |

---

## 12. Non-Functional Requirements

| Requirement | Current State | Status |
|---|---|---|
| Account page loads < 2s | No account pages exist yet. Analytics dashboard loads 8 API calls in parallel. | N/A |
| Floor screens offline + sync | ✅ `localDb.ts` (IndexedDB), `syncWorker.ts` (15s interval), `mx_sync_conflicts`. Cutting works offline. | ✅ for cutting. ⚠️ Other floor ops are online-only. |
| **Value visibility restricted** by role at API layer | No role-based data filtering. Auth checks token validity, not role-specific data access. All API endpoints return all data to all authenticated users. | ❌ **Missing** |
| Audit trail (every status change timestamped) | `updated_at` + `version` columns exist on transactional tables. Soft-deletes via `deleted_at`. | ⚠️ **Partial** — timestamps exist but no separate audit log table. Overwrite-in-place, not append-only. |
| Mobile-first for floor/owner/dispatcher | Floor pages use large touch targets + custom CSS. Admin pages use MUI (responsive but desktop-optimised). | ⚠️ **Partial** |
| Multilingual labels | Not implemented. | ❌ **Missing** |

---

## 13. Open Decisions (from BRD)

These remain unresolved and must be settled before the v2 schema redesign:

1. Agreed turnaround per job worker — fixed per worker, or per process type?
2. Shortage tolerance % — single company-wide figure, or negotiated per job worker?
3. Wastage at cutting — cost centre attribution, or write-off?
4. Short orders — who decides? Sales or owner?
5. Scanner hardware — phone cameras only, or Bluetooth ring scanners?
6. Dispatch rack allocation — system-assigned or scan-from-anywhere?

---

## 14. Phased Rollout — Current Readiness

| Phase | Delivers | Current Readiness |
|---|---|---|
| **1** | Purchase Bill, Lineage ID, alias layer, universal search | ⚠️ Lineage ID exists (`roll_id`). No Purchase Bill entity. No alias layer. Universal search is partial (code lookup only, no name/alias resolution). |
| **2** | Job Worker Account Page, coordinator control board, return validation with shortage | ⚠️ Return validation + shortage works. No Job Worker Account Page. Coordinator board data exists in analytics API but not as a dedicated screen. |
| **3** | Dispatcher board, pick lists with location hints, shortfall pre-warning | ⚠️ Basic challan dispatch works. No "Today" board, no pick list by rack, no shortfall warning. |
| **4** | Supplier and Party account pages, accounts workspace, ledgers | ❌ Nothing. No account pages, no ledgers, no financial tracking. |
| **5** | Owner dashboard, scorecards, margin, alert engine | ⚠️ Analytics dashboard exists with partial KPIs. No scorecards, no margin, no alerts. |

---

## Summary Scorecard

| Category | ✅ Done | ⚠️ Partial | ❌ Missing |
|---|---|---|---|
| §0 Architecture (entity-first) | 0 | 0 | 1 |
| §1 Process Flow (8 steps) | 3 | 3 | 2 |
| §2 Owner Workspace | 0 | 3 | 4 |
| §3 Job Worker Account Page | 0 | 0 | 7 |
| §4 Dispatcher Workspace | 2 | 3 | 4 |
| §5 Purchase Workspace | 0 | 0 | 5 |
| §6 Coordinator Workspace | 0 | 2 | 1 |
| §7 Floor Worker (Cutting) | 1 | 3 | 6 |
| §8 Sales Workspace | 0 | 1 | 2 |
| §9 Accounts Workspace | 0 | 0 | 1 |
| §10 Universal Search | 0 | 1 | 0 |
| §10A Barcode Architecture | 3 | 3 | 3 |
| §11 Alerts Engine | 0 | 1 | 6 |
| §12 Non-Functional | 1 | 3 | 2 |
| **TOTAL** | **10** | **23** | **44** |

> [!CAUTION]
> The current system covers roughly **13%** of the BRD v2 requirements fully, **30%** partially, and **57%** is entirely missing. The most critical structural gap is the absence of entity-first account pages (§0) and the Purchase Bill entity (Phase 1) — without which the lineage-and-alias foundation that the entire v2 design rests on cannot be built.
