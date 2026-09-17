Business Requirements Document — v2
Maxwell Cloth Trading ERP
Role-First Operational Design
Change from v1: v1 described the system as a chain of data flows. That is how the database sees it, not how the business runs. v2 is organised around the people who use it and the accounts they open. Folding has been removed as a stage — for Maxwell, cutting and packing are one operation.

0. The Core Design Principle
There are two ways to build this ERP:

Transaction-first (what exists today): screens are named after events — "Create Challan," "Log Inward," "Assign Job Work." A user must already know what they want to do, and must assemble context in their head from multiple screens.

Entity-first (what this document proposes): screens are named after things the business has relationships with — a job worker, a supplier, a buyer, a godown rack, an item. You open the account, and everything about that relationship is already on the page: what's outstanding, what's overdue, what's owed, what's pending your action, and what you can do about it right now.

The test for every screen in this system:

Can the person who opens this answer their three most common daily questions without opening a second screen and without calling anyone?

Transactions still exist — but they are launched from inside the account page where the context already lives, not from a separate menu where the user has to re-enter what the system already knows.

1. Corrected Process Flow
PURCHASE            →  Buy material from supplier (often interstate), against a Purchase Bill
    ↓
INWARD              →  Physical rolls received, Lineage ID assigned, supplier's name recorded as alias
    ↓
JOB WORK OUT        →  Roll(s) sent to job worker against a copy of the purchase bill
    ↓                   Job work bill/challan ref recorded as alias (e.g. 2332/33/59)
JOB WORK RETURN     →  Material returned, validated against meterage sent,
    ↓                   shortage/quality logged, job work closed, job worker ledger updated
CUTTING / PACKING   →  Single operation. Roll cut into packings, ZPL label printed.
    ↓                   Commercial name assigned (e.g. "Carens", "Kia")
GODOWN              →  Packings stored on racks
    ↓
PARCEL              →  Packings consolidated and sealed (optional stage)
    ↓
CHALLAN / DISPATCH  →  Goods loaded and shipped to buyer against a delivery challan
    ↓
DELIVERED           →  Challan closed
The Lineage ID concept from v1 stands: one permanent internal ID created at inward, inherited silently by every child record, with an additive alias layer so the supplier's name, job work reference, and commercial name all coexist and all search back to the same lot. That is the plumbing. The rest of this document is about what people see.

2. The Owner / Management Workspace
Who: the proprietor/partners. Not on the floor. Opens the system a few times a day, usually on a phone, usually to check one thing.

Their three questions:

Is money stuck anywhere it shouldn't be?
Is anyone sitting on my material longer than they should be?
Did we make money on what we sold this week?
Home screen — "Where is my money and my material right now?"
A single page of live tiles, each clickable straight into the underlying list:

Tile	Shows	Why the owner cares
Material out at job work	Total meterage + value currently with job workers, split by job worker	This is unsold, uninvoiced capital sitting in someone else's factory
Aging alert	Any lot with a job worker beyond X days (threshold configurable)	Material forgotten at a job worker is the single most common silent loss
Stock in godown	Meterage + value, by item, by godown	Dead stock detection
Dispatched but unbilled	Challans dispatched, invoice not yet raised	Revenue leakage
Job worker payables	Total outstanding across all job workers, with aging buckets	Cash planning
Supplier payables	Same, by supplier	Cash planning
Buyer receivables	Same, by party, with overdue flags	Collections
This month: purchased vs. dispatched	Meterage in vs. meterage out	Is the business converting or accumulating?
Shortage this month	Total meterage lost at job work, by job worker	Direct margin leak, and a supplier/job-worker performance signal
Owner-specific reports
Margin per lot — purchase cost + job work cost + shortage write-off vs. realised sale value. This is the report that tells the owner whether a given supplier/job worker combination is actually profitable.
Job worker scorecard — turnaround time, shortage %, rejection %, ranked. Answers "who should I stop giving work to?"
Supplier scorecard — quality rejection rate, delivery delay, price trend per item.
Dead stock — anything in godown older than X days, by value.
Design note: the owner's screens are read-only by default with a single "drill down" action. No owner should ever have to be the one who fixes a data entry error.

3. The Job Worker Account Page (the one you asked for)
This is the flagship screen. A user opens "Rajesh Dyeing & Printing" and sees everything, on one page.

Header block
Name, contact, GSTIN, address, default transport
Rate card — what we pay per meter for each process (dyeing / printing / finishing), per item type. So nobody guesses rates at billing time.
Declared capacity — meters/day this worker can process, and current utilisation against it
Current ledger balance — outstanding payable, one number, large
Trust indicators — average shortage %, average turnaround days, rejection %, computed from history
Tab 1 — "With Them Now" (the default landing tab)
A live list of every lot currently sitting with this job worker:

Job Work Ref	Lot / Lineage	Item & Shade	Sent Meters	Sent On	Days Out	Expected Back	Status	Purchase Bill
2332/33/59	LIN-000123 (Dominos)	Cotton 60s / BLK	1,200 m	02 Sep	15 days 🔴	09 Sep	Overdue	YY Co. / B-4471
2340/11/02	LIN-000131	Rayon / RED	800 m	11 Sep	6 days	20 Sep	On time	YY Co. / B-4488
Total meterage with them and total value, at the top of the tab
Days Out auto-colours: green / amber / red against agreed turnaround
Row action: Record Return — opens the return screen with everything pre-filled; the coordinator only enters meters returned and quality result
Tab 2 — "Capacity & Load"
Declared capacity (m/day) vs. meterage currently with them
"Can they take more?" — a plain-language answer: "Currently holding 2,000 m against a stated 500 m/day capacity ≈ 4 days of work queued. Yes, can accept new work."
Historical throughput chart — what they actually deliver per week vs. what they claim
This directly answers "what's its capacity and things like that" — and more usefully, it answers it as a decision ("can I send this lot here?") rather than as a raw number the user has to interpret.

Tab 3 — "Ledger / Account"
Running statement: job work charges raised, payments made, shortage deductions, balance
Every line links back to the job work transaction and the originating purchase bill
Aging buckets (0–30 / 31–60 / 60+)
Actions: Record Payment, Raise Debit Note (for shortage/damage), Download Statement PDF (to share with the job worker for reconciliation)
Tab 4 — "History"
Every closed job work transaction, searchable
Shortage and quality outcome on each
Filterable by item, by date, by purchase bill
Tab 5 — "Documents"
Copies of purchase bills sent to them, job work challans, their bills, signed delivery receipts
This matters practically: the business physically sends a copy of the purchase bill to the job worker, so the system should hold that trail
Alerts surfaced on this page
Material out beyond agreed turnaround
Ledger balance above credit threshold
Shortage % trending above their own historical average
4. The Dispatcher Workspace
Who: the person who turns an order into goods on a truck. Works standing up, on a phone or tablet, in a godown.

Hard design rules for this role — these override everything else:

No money. Ever. No rates, no order value, no party ledger, no margin. The dispatcher does not need it and should not see it.
No decisions. The dispatcher does not choose what to send, negotiate substitutions, or interpret status codes. They execute a list.
Barcode is the primary input. Typing is the exception, not the rule.
The whole job fits on one screen: these variants, these places, this much — go.
Screen 1 — "Today"
A plain list of what must go out today. Nothing else on the screen.

┌─────────────────────────────────────────────────┐
│  TODAY — 17 Sep                                 │
├─────────────────────────────────────────────────┤
│  ▸ KIA TEXTILES — Surat            5 variants   │
│    1,500 m            10 locations    ○ Not started │
├─────────────────────────────────────────────────┤
│  ▸ SHREE FABRICS — Ahmedabad       2 variants   │
│    600 m               3 locations    ◐ 4 of 9 done │
├─────────────────────────────────────────────────┤
│  ▸ CARENS ENTERPRISE — Mumbai      1 variant    │
│    400 m               2 locations    ● Ready to send │
└─────────────────────────────────────────────────┘
Per row: buyer name, delivery city, how many variants, total meterage, how many locations to walk to, and progress. That's the dispatcher's entire mental model — no status vocabulary to learn, no value column.

Screen 2 — The Pick List (open an order)
┌─────────────────────────────────────────────────┐
│  KIA TEXTILES — Surat              0 / 1,500 m  │
│  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
├─────────────────────────────────────────────────┤
│  GODOWN 1                                       │
│                                                 │
│  RACK B-04                                      │
│   Cotton 60s · BLACK · "Carens"      500 m      │
│   ░░░░░░░░░░░░░░░░░░░░  0 / 500 m               │
│                                                 │
│  RACK B-07                                      │
│   Cotton 60s · WHITE · "Carens"      300 m      │
│   ░░░░░░░░░░░░░░░░░░░░  0 / 300 m               │
├─────────────────────────────────────────────────┤
│  GODOWN 2                                       │
│                                                 │
│  RACK A-11                                      │
│   Rayon · RED · "Kia"                400 m      │
│   ░░░░░░░░░░░░░░░░░░░░  0 / 400 m               │
│  ...                                            │
├─────────────────────────────────────────────────┤
│            [  📷  SCAN  ]                        │
└─────────────────────────────────────────────────┘
Grouped by godown, then by rack, in walking order. The dispatcher works top to bottom and never crosses the floor twice.
Each line is: variant (item + shade + commercial name), how much is needed, progress bar.
No packing IDs listed up front. The dispatcher doesn't need to find specific packings — they need that much of that variant from that rack. The system matches whatever they scan against the requirement.
One big button: SCAN.
Screen 3 — Scanning
Scan a packing barcode → one of three things happens, immediately, unmistakably:

Result	Feedback
✅ Correct	Green flash + short beep. Progress bar advances. Meterage added automatically from the packing record — nothing typed.
⚠️ Right variant, order already full	Amber. "This variant is complete — 500/500 m." Scan not counted.
🔴 Wrong item	Red flash + long buzz. "This is Rayon RED. Not needed for this order." Cannot be overridden by the dispatcher.
Additional rules:

Quality-flagged stock is blocked at scan, with a plain message: "Shade mismatch flagged — do not load. Call supervisor." The dispatcher isn't asked to judge it.
Loose packings dispatch directly. There is no requirement to build a parcel first. The dispatcher scans individual packings straight onto the truck. If a sealed parcel exists, scanning the parcel's master barcode adds every packing inside it in one scan — that's the only difference between the two.
Over-scan protection: once a variant's requirement is met, further scans of it are refused rather than silently accepted.
Undo last scan — one tap, no password, no admin.
Works fully offline. Scans queue locally with a visible unsynced counter; nothing blocks on the network.
Screen 4 — Close out
When every variant hits its target, a single DISPATCH button appears. Tapping it:

Captures vehicle number and transporter (dropdown of known transporters + free text)
Prints the delivery challan and packing list to the connected printer
Marks every scanned packing/parcel as dispatched
Closes the row on the Today screen
LR/GR number, freight amount, and delivery confirmation are entered by admin afterwards — not by the dispatcher, because those carry financial data.

Short stock
If a rack doesn't yield enough, the dispatcher taps "Can't find / short" on that line and moves on. That's the full extent of their involvement. The shortfall is raised as an alert to Sales and Admin, who decide whether to wait, substitute, or part-dispatch. The dispatcher is never asked to make that call, and is never shown why it's short.

Partial dispatch
Admin can authorise sending what's available. The order then reappears on the dispatcher's Today screen the next day with only the remaining balance — the already-loaded portion is gone from their view entirely.

Returns
Goods coming back from a buyer are scanned in through a separate Return Intake screen: scan packing → select reason from a fixed list (damaged / wrong shade / excess / buyer rejected) → the packing re-enters stock with its original lineage intact. No values, no credit notes — Accounts handles the financial side separately.

5. The Purchase / Procurement Workspace
Their three questions: What have I ordered that hasn't arrived? What did I last pay this supplier for this item? What do I need to reorder?

Supplier Account Page (same 360 pattern as job worker)
Header: contact, GSTIN, state (drives interstate GST treatment), payment terms, credit limit
Tab: Open POs / Pending Inward — ordered but not yet received, with expected dates and overdue flags
Tab: Purchase History — every bill, every item, rate trend chart per item (so nobody overpays because they forgot last month's rate)
Tab: Ledger — payables, aging, payments, debit notes
Tab: Quality Record — rejection rate, shortage on receipt, complaint history
Tab: Documents — bills, e-way bills, transport receipts
Purchase-specific screens
Inward register — a day-book of what physically arrived, who received it, and whether it matched the bill
Bill vs. Received reconciliation — flag any purchase bill where received meterage ≠ billed meterage
Reorder suggestion — items below threshold, factoring in what's currently out at job work (i.e. don't reorder something that's coming back next week)
6. The Job Work Coordinator Workspace
Who: the person who decides what goes where, and chases it back. Arguably the most operationally important user in a trading business.

Their three questions: What's ready to send out? Who has capacity? What's overdue coming back?

Home screen — "Job Work Control Board"
Three panels side by side:

Panel 1 — Ready to Send Inwarded rolls with no job work assigned. Each row offers "Send to Job Work" with a suggested worker based on rate, current load, and past quality for that item.

Panel 2 — Currently Out (across all job workers) Sorted by days-out descending, so the most overdue is always at the top of the screen. Grouped by job worker, with a one-tap call/WhatsApp action to chase.

Panel 3 — Awaiting Validation Returned but not yet checked and closed. This is where material silently disappears in most trading businesses — it's back in the building but nobody reconciled it, so it's neither in stock nor at job work.

Send-to-job-work screen
Pre-fills purchase bill link (mandatory, non-editable — the lineage cannot be broken)
Captures job work bill/challan ref as an alias
Supports one job work challan covering multiple purchase lots (real-world batching — the system must allow many-to-many here)
Auto-calculates expected return date from the worker's agreed turnaround
Prints the job work outward challan and attaches the purchase bill copy
Return & validation screen
Sent meters (pre-filled) vs. Returned meters (entered) → shortage auto-calculated and shown immediately
Quality result: Accepted / Accepted with defect / Rejected, with reason codes and optional photo
Shortage beyond tolerance % requires supervisor sign-off — no silent closing of mismatched transactions
On close: job worker ledger is credited with the job work charge, and debited for any shortage liability
7. The Floor Worker Workspace (Cutting / Packing)
Who: workers on the shop floor, on a phone or tablet, possibly with bad Wi-Fi, possibly with gloves on.

Design constraints that override everything else here: big touch targets, minimum typing, scan-first, works offline, never blocks on a server round-trip.

Cutting & Packing Station (one combined operation)
Scan parent roll barcode
Screen shows, large and unmissable: item, shade, remaining meterage, commercial name to apply, any quality flag from job work
Worker enters cut length (number pad, not a text field)
System creates the packing, decrements parent roll, prints ZPL label to the LAN thermal printer immediately
Parent roll auto-marked depleted at zero
Additions needed:

Quality flag propagation — if the job work return was flagged "shade mismatch," that flag must appear on this screen in red, so the worker doesn't cut compromised material into a premium order
Reprint label — labels get torn, smudged, or stuck to the wrong roll. There must be a reprint action that doesn't create a duplicate packing record.
Undo last cut — a time-boxed correction window (e.g. 15 minutes) instead of forcing an admin to fix it later
Wastage capture — cutting produces unusable remnants; if this isn't recorded, meterage never reconciles and everyone stops trusting the stock figures
Offline queue indicator — a visible count of unsynced actions, so the worker knows the work is captured even with no signal
Godown Receive / Put-away
Scan packing → scan rack → done. Two scans, no typing.
Suggested rack based on where the same item is already stored
Rack occupancy view — what's on this rack, and how full it is
Stock transfer between racks and between godowns, as a first-class action (not an admin-only edit)
Parcel Consolidation — optional stage
Parcels exist only as a convenience for bulk shipping. Loose packings can be dispatched directly without ever being parcelled, and that is expected to be the common case. A parcel is simply a scan shortcut: one master barcode that stands for the packings inside it.

Scan multiple packings → seal → master ZPL label
Mixed-lineage warning — if packings from different purchase bills/suppliers go into one parcel, the operator is warned and the composition is recorded, not silently merged
Parcel contents list must remain viewable after sealing, without breaking the seal
Floor Challan Picking
Pick list sorted by physical walking route
Scan-to-load with live progress ("8 of 12 scanned")
Wrong-item alert — if a scanned packing isn't on this challan, immediate loud rejection, before it's on the truck
Works fully offline; syncs on reconnect
8. The Sales / Order Desk Workspace
Their three questions: What can I promise this buyer? What has this buyer bought before? Where is their pending order?

Party (Buyer) Account Page
Header: billing details, GSTIN, multiple delivery addresses, linked agent, payment terms
Tab: Outstanding — receivables with aging (credit limits are out of scope for this phase — no blocking or warning on challan creation)
Tab: Order History — what they buy, how often, at what rate, under which commercial names
Tab: Live Orders — pending challans and their fulfilment status
Tab: Returns / Complaints — with a link back to the originating lineage, so a recurring complaint can be traced to a specific supplier or job worker
Tab: Rate History — what we last quoted them per item, so quoting isn't from memory
Commercial naming
Assign the market name ("Carens", "Kia") to a packing or a batch of packings in one action
The same lineage carrying different commercial names across different packings is expected and allowed, not an error
Searching any name — supplier's, job work ref, or commercial — resolves to the same lot
Availability check
Before promising a delivery date, sales sees: in godown now / at job work with expected return date / not available. One screen, three numbers.

9. The Accounts Workspace
Their three questions: Who do we owe, who owes us, and does the material movement match the paperwork?

Payables: supplier bills and job worker bills, in one aging view, with payment scheduling
Receivables: party-wise, with agent commission calculated on realised (not invoiced) value
Three-way match: purchase bill ↔ material actually inwarded ↔ payment made. Any mismatch flagged for review.
Cost roll-up per lot: material + job work + shortage write-off = true landed cost, which feeds the owner's margin report
Agent commission ledger: per agent, per challan, with payout status
GST data readiness: interstate flag, HSN, e-way bill threshold check — data capture to support filing, not filing itself
Debit/credit notes: against suppliers (quality), job workers (shortage), and parties (returns)
10. Cross-Cutting: The Universal Search
One search box, present on every screen. Type anything — "Dominos", "2332/33/59", "Carens", a packing barcode, a challan number, a party name — and get the resolved lot with its full journey, its current physical location, and its current status.

This single feature is what makes the naming problem disappear in daily practice. Nobody needs to know which name is the "real" one, because all of them work.

10A. Barcode Architecture
Barcodes are the spine of every floor and dispatch operation. The rule: if a worker is holding a physical object, they should be able to scan it instead of typing anything about it.

What carries a barcode
Object	Barcode created when	Printed on	Encodes
Roll (inward)	Material received against a purchase bill	A4 or label sticker on the roll	Roll short code → resolves to Lineage ID
Packing	Cut at the cutting/packing station	ZPL thermal label, printed instantly	Packing short code
Parcel (optional)	Packings sealed together	ZPL master label	Parcel code → expands to all packings inside
Rack / Location	Godown setup	Printed label fixed to the rack	Godown + rack code
Job work challan	Sending material out	Printed on the outward challan	Job work reference
What the packing label shows
The label is for humans on the floor and for the scanner, so it carries both:

┌──────────────────────────────┐
│  ▌▌▌▎▌▎▌▌▎▌▌▎▌▌▌▎▌▎▌▌▎▌▌     │
│         PK-8841              │
│                              │
│  COTTON 60s · BLACK          │
│  "CARENS"                    │
│  42.5 m                      │
│  17/09/26                    │
└──────────────────────────────┘
Deliberately not on the label: rate, value, supplier name, purchase bill number, or job worker name. The label goes out of the building on the goods — it should not carry commercial information to a buyer. All of that is retrievable internally by scanning the same code.

Scan-driven operations
Operation	Scan sequence	Typing required
Godown put-away	Scan packing → scan rack	None
Stock transfer	Scan packing → scan new rack	None
Cutting	Scan parent roll → enter cut length	One number
Parcel build	Scan packings → tap Seal	None
Dispatch picking	Scan packing (or parcel)	None
Return intake	Scan packing → tap reason	None
Stock check / audit	Scan rack → scan everything on it	None
"What is this?" lookup	Scan anything	None
Universal scan-to-lookup
Scanning any barcode anywhere in the app — with no operation in progress — opens that object's detail. What the person sees depends on their role:

Floor worker / dispatcher: item, shade, commercial name, meterage, current location, quality flag. Nothing else.
Coordinator: the above plus job work history and lineage.
Admin / Owner / Accounts: the full journey including supplier, purchase bill, job worker, and cost.
Practical requirements
Reprint any label without creating a duplicate record — labels tear, smudge, and fall off
Damaged barcode fallback — manual short-code entry, permitted but logged, so it can be audited if overused
Offline scanning — every scan works with no network; the queue syncs later with a visible unsynced count
Duplicate-scan protection — the same packing scanned twice in one operation is rejected, not double-counted
Scanner hardware: phone camera must work acceptably; Bluetooth ring/handheld scanners supported for high-volume stations
11. Alerts & Exception Engine
The system should push exceptions to the right person rather than waiting to be asked:

Exception	Goes to
Material at job worker beyond agreed turnaround	Job Work Coordinator + Owner
Returned material not validated within 24h	Job Work Coordinator
Shortage above tolerance %	Coordinator + Accounts + Owner
Order short on stock at picking	Sales + Admin (not the dispatcher)
Dispatched but unbilled beyond X days	Accounts
Stock in godown beyond X days	Owner
Offline sync conflict	Admin
12. Non-Functional Requirements
Any account page loads fully in under 2 seconds, including all tabs' summary figures
Floor screens function fully offline and sync without data loss; conflicts surface to an admin queue rather than failing silently
Value visibility is restricted to Owner, Accounts, Purchase, and Sales. Floor workers, the job work coordinator, and the dispatcher see quantity and meterage only — never rates, order value, ledger balances, or margin. This is a hard rule enforced at the API layer, not just hidden in the UI.
Complete audit trail: every status change and every alias assignment is timestamped and attributed; records are superseded, never overwritten
Mobile-first for floor, owner, and dispatcher; desktop-optimised for accounts and purchase
Multilingual labels (English / Gujarati / Hindi) on floor screens
13. Open Decisions
Settled in this revision:

Is parcel consolidation mandatory? → No. Loose packings dispatch directly; parcels are an optional scan shortcut.
Credit limits? → Out of scope for this phase.
Value visibility for coordinator and dispatcher? → No values. Meterage and quantity only.
Still open:

Agreed turnaround per job worker — fixed per worker, or per process type?
Shortage tolerance % — single company-wide figure, or negotiated per job worker?
Should wastage at cutting be attributed to a cost centre, or simply written off?
When an order is short, who decides between wait / substitute / part-dispatch — Sales or the owner?
Scanner hardware — phone cameras only, or budget for Bluetooth ring scanners at the cutting and dispatch stations?
Does the dispatcher pick against a fixed rack the system chose, or take the variant from any rack that has it? (affects whether allocation is reserved up front or resolved at scan time)
14. Phased Rollout
Phase	Delivers	Why this order
1	Purchase Bill entity, Lineage ID, alias layer, universal search	Nothing else is trustworthy until traceability exists
2	Job Worker Account Page (all tabs), coordinator control board, return validation with shortage	This is where the most money currently leaks
3	Dispatcher board, pick lists with location hints, shortfall pre-warning	Biggest daily time saving for floor + dispatch
4	Supplier and Party account pages, accounts workspace, ledgers	Finance catches up to operations
5	Owner dashboard, scorecards, margin and cost roll-up, alert engine	Management layer sits on top of clean data, not before it
v2 restructures around users and accounts. Section 13 should be settled with the owner and the job work coordinator before schema work begins — those six answers change table design.