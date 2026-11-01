# VoloSync — Product Specification (v2 — Approved Baseline)

> Status: **baseline approved — Q1–Q16 and R1–R5 all resolved**. Nothing blocking remains (§11).
> Sources: founder brief + Q&A round 1, inspection of `hotcol-user`, `hotcol`, `hotcol-owner`,
> `hotcol-ats`, `hotcol-emp`, `mediflow_admin`, and `pharmacy/BackEnd` (backend template).
> Supersedes `volosync-product-spec-v1.md`.

---

## 1. Product

Multi-tenant SaaS for **wholesale distributors** (Apex Solution). Same architecture and design language as
HotCol, different domain logic. No credit business anywhere, no purchase pipeline, no cost controller.

| Repo | Audience | Platform | Backend | Mirrors |
|---|---|---|---|---|
| `volosync` | Store, Finance, Manager, HR, Sales | Next.js web | Django (DRF) | `hotcol-user` |
| `volosync-admin` | Apex — tenants, billing, monitoring | Next.js web | Django (DRF) | `hotcol` |
| `volosync-owner` | Wholesaler owner | **Expo mobile only** | Django (DRF) | `hotcol-owner` |
| `volosync-ats` | Hiring | Next.js web | Django (DRF) | `hotcol-ats` |
| `volosync-emp` | Employee self-service | Next.js web | Django (DRF) | `hotcol-emp` |

**Current state:** five empty scaffolds (Next.js + shadcn; Expo + NativeWind). No domain code.

### 1.1 Modules

| Module | Contains |
|---|---|
| **Inventory** | Store, Finance (sales approvals, promotions), Manager (approvals, reports, agents), Sales |
| **HR Module** | HR role, Manager HR features, `volosync-emp`, `volosync-ats` |

**HR is delivered in full in v1** (decision Q14) — not deferred to a later phase.

### 1.2 Roles

`Owner` · `Manager` · `Finance` · `Store` · `Sales` · `HR`

Owner is **mobile only** (Q12) — no web seat. Owner does not appear in `volosync` navigation.

---

## 2. Tenancy, branches, settings

### 2.1 Tenant

A wholesaler company, identified by **TIN** (HotCol convention). Fields: company profile, logo, modules,
subscription state, branches, staff, sales agents, catalog pricing, `vatRate`.

No tenant subdomain or per-tenant URL — tenants are records inside the system, not sites (Q16).

### 2.2 Branches = child tenants (decision Q8)

A branch is **another tenant**, not a label on documents (this is more than Mediflow's model):

- `Tenant.parent` (nullable) links a branch tenant to the owning company tenant.
- A branch has its own users, inventory, vouchers, stockouts, sales, promotions and reports.
- The **owner account is linked at the parent level** and can switch between branches in the mobile app,
  plus see an **all-branch roll-up**.
- Owner creates branches from the mobile app (Mediflow's create-with-manager-credentials flow). Apex can
  also create/inspect them from `volosync-admin`.
- Branch TIN must differ from the parent TIN (Mediflow rule). Exactly one **main** branch per group.

Operational data is **never** shared across branch tenants. Only the owner-level aggregation queries span
siblings, and they are read-only.

### 2.3 Settings

| Setting | Where | Effect |
|---|---|---|
| `modules` | admin tenant detail | Inventory / HR Module; hides menus and blocks APIs |
| `salesRoleEnabled` | admin tenant detail (switch, HotCol `waiterOrderingEnabled` pattern) | Enables the Sales role and its logins |
| `vatRate` | tenant, default **15%** | VAT math, VAT-separated reporting |
| `subscription` | admin billing | **Yearly only** — no quarterly concept exists |

---

## 3. Stack & backend architecture  *(decision A1)*

Each repo gets its **own `BackEnd/` Django project**, built independently (models, serializers, views,
urls — no API gateway), mimicking `pharmacy/BackEnd` exactly:

- Django ≥5.1, DRF, SimpleJWT (+ token blacklist), `django-cors-headers`, `PyMySQL`, `python-decouple`,
  `Pillow`, `openpyxl`.
- App-per-domain (`user`, `tenants`, `<domain>`…), each with `models.py`, `serializers.py`, `views.py`,
  `urls.py`, `admin.py`, `migrations/`.
- `config/settings.py` reads env via `config(...)`; `DATABASES` = MySQL over PyMySQL with
  `STRICT_TRANS_TABLES`, `DB_NAME/USER/PASSWORD/HOST/PORT` from `.env` (Aiven now, real DB swapped later
  in `.env` only).
- `config/urls.py` mounts `api/auth/login/`, `api/auth/token/refresh/`, then `api/<domain>/`.
- `tenants` app carries platform concerns: models, `billing.py`, `pricing.py`, `sales_agents.py`,
  `services.py`, `tenant_ops_views.py`.

**Shared envelopes:** `{ data }` / `{ errors }`, cursor-less page/limit pagination, ISO timestamps,
Decimal-as-string money, 401 on expired token with silent refresh.

**One shared MySQL database** (Aiven) behind all five Django projects (R1). Each `BackEnd/` declares its
**own** models, serializers, views and urls **for the tables it owns** — no API gateway, no service-to-service
HTTP, no data mirroring. Cross-service data (tenant/subscription truth, `salesRoleEnabled`, owner roll-ups)
is read straight from the shared schema through each project's own ORM layer.

Ownership rule: a table is created and migrated by exactly one project; every other project treats it as
read-only and exposes it through its own serializers. Never let two apps declare the same `db_table`.

---

## 4. Domain model

Inventory is **voucher-lot based**, not aggregate-only. This is what makes returns hit the exact item and
lets promotions print per line.

### 4.1 `Item`
Catalog entity: name, category, unit, optional image, note. Holds **no stock**.

### 4.2 `StockLot` — one registered line = one voucher
| Field | Notes |
|---|---|
| `voucherNumber` | unique per tenant, sequential (`VS-2026-000123`) |
| `item`, `quantity`, `remainingQuantity` | `quantity` = registered amount (kept for reporting); `remainingQuantity` = live balance, and it is what the inventory screen displays as **Quantity** |
| `unitCost` | purchase cost per unit |
| `paidAmount` | **read-only, derived** (Q6 + R4): `quantity × unitCost + 15% vatRate`. Never posted by the client |
| `unitSales` | selling price per unit, **VAT exclusive** |
| `priceWithVat` | `unitSales × (1 + vatRate)` — **VAT is added on top** (Q6) |
| `vatRateAtRegistration` | stored per lot so historical tax never re-derives at a new rate |
| `registrationDate`, `expiryDate` | |
| `supplierName/Phone/Address/Tin` | supplier **is the manufacturer** (Q9) |
| `note`, `image` | |

`receivedBy` stays excluded (your instruction).

Inventory screens show item-level aggregates with lot drill-down; every mutation addresses a lot.

Money: `Decimal(18,2)`, ETB, `en-GB` formatting.
**Quantities are decimal (DOUBLE / `FloatField`), 3 decimal places** (R3) — kg, litre, carton fractions all
work. Rejected if ≤ 0; prices > 0. Never compare quantities with `==`; compare with a 0.0005 tolerance.

### 4.2a Inventory edit  *(Manager only — R5 revised)*

Every row in **Inventory** carries its own **edit icon**, opening the lot's detail form. **Only the Manager
can open it** — the icon is hidden for Store, Finance and Sales, and the API rejects those roles.

**Inventory shows one quantity column — labelled `Quantity`, and it *is* the remaining balance.** There is no
separate "registered quantity" and "remaining quantity" in the inventory UI; the operator sees the stock
that is actually theirs today.

Editable by the Manager:

- **`Quantity`** — a plain field edit, exactly like editing the name. Type the new number, save, done: **no
  adjustment record, no old → new history, no reason field, no ledger entry**. The saved number simply becomes
  the quantity, and every later stockout is validated against it (requesting more than it is rejected).
- `unitSales`, `priceWithVat` (re-derived as `unitSales × (1 + vatRate)`), `unitCost` and its derived
  `paidAmount`
- name, category, unit, note, image, expiry date, supplier block

`voucherNumber` is immutable. All of it applies immediately — no approval chain. Open assignments and settled
sales keep their own snapshots and are unaffected.

**No unit-price revision feature:** no revision requests, no pending-revision queue, no chained approval for a
price change. (HotCol's `InventoryUnitPriceRevisions` is explicitly not carried over.)

### 4.3 `StockMovement` (append-only ledger)
`type: REGISTRATION | STOCKOUT | SALE | SALE_RETURN | PROMOTION | PRICE_CHANGE`,
`lot, quantityDelta, actor, role, at, refType, refId, note`.
`StockLot.remainingQuantity` is a materialized balance and the ledger records every approved document. The one
exception: the Manager's inventory `Quantity` edit is a direct field write (A3), so the balance is whatever
that field currently says — the ledger explains *how stock moved*, the edited field is *how much is there*.

### 4.4 Registration document
`RegistrationRequest` (header: supplier block, branch, status) + `RegistrationLine` (one per lot).
Single or batch; one voucher and one receipt per document. Status per §4.8.

**No inventory effect until Manager approval** (Q1/Q2).

### 4.5 `StockOutRequest` + `StockAssignment`
Header: `voucherNumber` (`SO-...`), `date`, branch, status, created by.
Line (`StockAssignment`): `lot`, `item`, `quantity`, `salesAgent`, `changingAmount`, `changeReason`, status.

- `changingAmount` = **per-unit price delta** on `unitSales` (Q3). Negative = discount.
  Effective unit price = `unitSales + changingAmount`, must stay **> 0**.
- **`changeReason` is required whenever `changingAmount ≠ 0`** (new requirement) — stored on the line,
  shown in the approval timeline and variance reports. Not printed on the manufacturer-facing promotion
  receipt unless you ask for it.
- Stock leaves inventory **at Manager approval** (Q2).
- **`changingAmount` never changes the lot's price** (R5 revised). It is a per-assignment delta only: it
  sets what this agent is held to (`unitSales + changingAmount`) and what this document reports. The lot
  keeps its own `unitSales`, which is edited separately from the inventory row (§4.2a). Each line snapshots
  `unitSalesAtAssignment`, so settled history is never re-priced.
- Same date/config/agent rules apply to single and batch (see 5.1.2).

### 4.6 `SalesSettlement`
| Field | Notes |
|---|---|
| `assignment` | exactly one assignment |
| `soldQuantity` | derived from `salesAmount ÷ (unitSales + changingAmount)`; **must be ≤ assigned** (Q10: overselling is impossible — the agent never received more than assigned) |
| `returnedQuantity` | `assigned − sold`, always ≥ 0; non-zero variance can only be **negative** |
| `paymentMethod` | `TELEBIRR \| BANK \| RECEIPT` (receipt = agent hands in the bank/cash slip) |
| `salesAmount` | money collected |
| `expectedAmount` | `sold × (unitSales + changingAmount)` |
| `penalty` | **new checkbox, default off** (Q11) — a penalty demotes the agent in ranking |
| `note`, `enteredBy`, `enteredAt`, finance/manager approval stamps, `status` |

On final approval: `SALE` movements for sold units and `SALE_RETURN` movements **back onto the same lot**,
which simply raises that lot's `remainingQuantity` (Q4 — "like editing": the number goes up, no reversal
document, but Payment & tax keeps the truth of what actually happened). Executed inside a transaction with
row locks so two approvals cannot double-return.

### 4.7 `Promotion`
Stockout without agent or money: `voucherNumber` (`PR-...`), batch-level `date`, lines
(`lot`, `quantity`, `changingAmount`, `changeReason`), `manufacturer` = the lot's supplier (Q9),
status. Printed unit price = `unitSales + changingAmount`. Deduction at **Manager approval**.

### 4.8 Approval chains (Q1, Q2, A2)

```
Store-initiated      → PENDING_FINANCE → PENDING_MANAGER → APPROVED
Finance-initiated    → PENDING_MANAGER → APPROVED            (promotions)
Manager-initiated    → APPROVED immediately (no chain)
Rejected anywhere    → REJECTED — terminal, reason required
```

**Rejection is final.** A rejected document is not returned to the creator as a draft, cannot be reopened,
edited or resubmitted; it stays in `Request status` as `REJECTED` with the rejecting actor, role, timestamp
and reason, as a permanent record. To redo it the creator raises a **new** document.

One consequence worth stating: a **rejected sales settlement** makes no inventory movement at all — the
assignment simply stays open (still "assigned stock"), so Finance can raise a fresh settlement against the
same assignment. Rejected registrations, stockouts and promotions likewise leave stock untouched.

**There is no VOID state and no void action** — those three chains are the whole machine, and `APPROVED`
is the end of the line. Nothing consumes an approved document afterwards, so there is nothing to undo.

Deduction, stock addition and sale effects all happen **only at APPROVED**. Pending documents do not
reserve stock; a second stockout can target the same lot and is validated again at approval time.

One generic `Approval` row per step (`entityType, entityId, step, decision, actor, role, decidedAt, note`),
so every screen shows one timeline and one "my queue". Chains are config data, not code.

### 4.9 Assets  *(new)*

Company property that is **not sellable stock** and is **assigned to clients, not employees** — so it is not
part of HR's people flow, and it is always available (not gated by the HR module). Separate from `Item`: assets are never stocked out to sales agents and never priced
for sale. The **Manager registers** and may see the same report as Finance; **Finance assigns, removes and
monitors**. Manager-registered, so **no approval chain** (A2), and no approval on assignment either — Finance is
the decision point.

#### `Asset` — registration fields (Manager)

| Group | Field | Required | Notes |
|---|---|---|---|
| Identity | `assetTag` | auto | `AST-2026-000123`, unique per tenant, immutable |
| | `name` | yes | |
| | `category` | yes | managed list: IT equipment · Furniture · Vehicle · Machinery · Tool · Other |
| | `serialNumber` | no | unique per tenant when present |
| | `quantity` | yes | default 1 — one record for a set of 20 chairs |
| | `brandModel` | no | optional |
| | `photo` | no | single image |
| Acquisition | `unitCost` | yes | ETB |
| Custody | `conditionAtRegistration` | yes | New · Good · Fair · Damaged |
| | `usefulLifeYears` | yes | straight-line life; drives book value |

That is the whole form — no vendor/purchase block, no attachments, no warranty, insurance or location fields.

**Derived:** `bookValue = max(0, unitCost − (unitCost ÷ usefulLifeYears × yearsElapsed))`. Shown in the asset
report, never typed.

`status`: `AVAILABLE · ASSIGNED`.

#### `AssetAssignment`
Created by **Finance** from its Assets section. Fields: `asset`, **`assigneeName`** (free text — the asset goes
to a **client**, so there is no employee picker), `assignedAt`, `assignedBy`.

- **Assign** → asset becomes `ASSIGNED`. Only available assets can be assigned.
- **Remove** → **Finance only**, and it is the only way back. The assignment is released immediately and the
  asset returns to `AVAILABLE`. **No approval chain and no return request** — nothing to ask for approval of.

Every assignment and removal is kept on the asset, so its history shows who held it and when.

**Reports:** one asset report (register with cost, book value, status, assignee; filter by branch/category/
status; PDF + Excel) visible to **both Finance and Manager** — Finance as operator, Manager read-only.

---

## 5. Roles in `volosync`

### 5.1 Store

Sidebar = HotCol **hotel store** sidebar minus `Purchase pipeline`, minus `Purchase requests`, minus all
credit:

| Group | Items |
|---|---|
| Top | Register · Inventory · Inactive · Suppliers · Review before send · Item receipts |
| Request status | Stock movements · Item registrations |
| Payment & tax | All lines · With VAT · Without VAT |

`Paid receiving` and `Credit vouchers` are **removed** (Q5).

Each **Inventory** row carries an **edit icon** — **Manager only** (§4.2a) — for item details, prices and the
**Quantity** figure (the current remaining balance, edited as a plain field). The full in-store vs stocked-out
split lives under **Payment & tax**, not here.

#### 5.1.1 Item registration
Fields exactly as hotel store, but **`receivedBy` removed** and **`paidAmount` kept** as a **read-only
derived value** (Q6 + R4), rendered live as `quantity × unitCost + 15%`.

Per line: item name · note (optional) · category · quantity · unit · unit cost · unit sales ·
registration date · expiry date · price with VAT · paid amount · item image (optional).
Header: supplier name · supplier phone (optional) · supplier address · supplier TIN (optional).
Each line carries its own note.

Single and batch both supported. Submit → Finance → Manager. Stock becomes usable only on Manager approval.
`Review before send` holds local drafts. Receipt printable after approval, Apex footer.

#### 5.1.2 Stockout
Both modes: `date`; `changing amount` + **reason** per config; sales-agent combobox fed by agents
registered by the Manager.

**Single** confirmation dialog:
1. Item summary on top (voucher, available quantity, unit sales).
2. One row: `amount` (pre-filled with the lot's available quantity, editable), `changing amount`, `reason`,
   `sales agent`.
3. `Add config` appends another row of the same four fields.
4. When the sum of `amount` inputs equals the available quantity, the additional `amount` input is
   **disabled**; otherwise it stays enabled. Server re-validates the total regardless.

**Batch** confirmation dialog, two tabs:
- **Same for all** — one `amount`, `changing amount`, `reason`, `sales agent` applied to all selected items.
- **Different for all** —
  - Top-level `sales agent` selection, then per agent: item combobox limited to the checked items,
    `amount`, `changing amount`, `reason`, `Add item` (another item row for the same agent).
  - `Add sales agent` adds another agent section; sections are **collapsible** with header
    (agent · lines · total qty) so many agents stay readable.
- Validation: every checked item covered at least once; per-lot totals within availability; agents active.

Submit → Finance → Manager; deduction on Manager approval. Receipt from `Request status → Stock movements`.

### 5.2 Finance

Sidebar: Sales approval · Promotion · Promotion receipts · Payment & tax · Inventory reports ·
Finance reports · Request status · **Assets** · HR payroll (when HR module).

#### Sales approval
Top form, bottom table.

- `items` combobox — items with open (unsettled) assignments.
- `sales agent` combobox — agents assigned to the chosen item.
- `payment approval method` — radio: **Telebirr / Bank / Receipt**.
- `sales amount` input.
- **`penalty` checkbox, default off** (Q11).
- `Add sales` stages the line; the staged list posts as one batch.

Table: item, voucher, agent, assigned qty, sold qty, returned qty, method, amount, expected, variance,
penalty, status, entered-by, dates. Filter by date/agent/item/status. PDF + Excel.

Return path: `assigned − sold` goes back to that exact voucher lot at final approval. Variance is
negative-only (Q10); returns are **not** a ranking penalty — only the penalty checkbox is.

**`salesRoleEnabled` ON:** Sales enters lines → Finance verifies → Manager approves.
**OFF:** Finance enters lines → Manager approves (Finance cannot self-approve).

#### Promotion
- Initiated by Finance as a stockout without agent: dialog has `amount`, `changing amount`, `reason`, `date`.
- **Single**: one amount pair + date. **Batch**: one date, many amount pairs via `Add config`.
- Submits to **Manager** only. Deduction on approval.
- **Receipt**: item, voucher, quantity, unit price (`unitSales + changingAmount`), line total, grand total,
  date, manufacturer, wholesaler, **Apex footer**, and a **signature block for both the manufacturer and
  the wholesale representative**.
- **Promotion list**: from/to filter above the table, per-row print, and `Print all filtered` — batch
  promotions print as **one combined receipt**.

#### Assets
Monitor and control company property — **Finance is the only role that moves it**.

Tabs: **Available · Assigned · All**. Table: tag, name, category, serial, quantity, status, assignee,
assigned date, condition at registration, unit cost, book value.

- **Assign** — pick an available asset and **type the assignee name** (the client), plus the date. Saves as
  `ASSIGNED`.
- **Remove** — the only way back, Finance only. Releases the assignment immediately; the asset is `AVAILABLE`
  again. No approval, no return request.
- **Asset report** — register with cost, book value, status and assignee; filter by category/status; PDF +
  Excel. The **Manager sees this same report read-only**.
- No approval chain on any asset action.

#### Payment & tax
`All lines · With VAT · Without VAT` only. PDF export. No credit anywhere.

Each row is a **voucher lot**, and the panel reports the **whole registered line, not just what is left** —
exactly the HotCol `hotelInventoryPayment` shape:

| Column | Meaning |
|---|---|
| Registered qty / value | as registered (`quantity`) |
| **In store** | `remainingQuantity` and its value |
| **Stocked out** | `quantity − remainingQuantity` and its value |
| Unit cost · paid amount | per unit and line total, VAT inclusive |
| Base · VAT · Inclusive | `unitCost` base, 15% VAT, and the sum |

Group headers summarise the same split (`n in store · n stocked out`), and a line that is fully out is
classified **Stocked out** while a partially or fully available one shows under **In store** with its
stocked-out remainder still visible — so the panel always reconciles: **registered = in store + stocked out**,
using the current `Quantity` as the in-store figure.

VAT columns additionally split **input VAT** (registration `paidAmount`) from **output VAT** (sales) so the
tenant can see what is reclaimable versus what is owed.

### 5.3 Manager
- Overall reports (inventory value, movements, sales performance, tax/VAT, branch-vs-branch where the
  viewer is owner-level), PDF + Excel.
- **Sales agent registration**: first name · last name · phone · sex · years of experience (+ active,
  branch). **Manager owns agent creation** (Q7).
- **Agent performance & ranking** (Q11): ordered by **revenue first, then units sold**; periods
  **all-time / weekly / monthly / quarterly / half-year / yearly**; penalties displayed and demoting.
- **Asset registration** (§4.9): tag auto-assigned, then name, category, serial, quantity, optional
  brand/model and photo, unit cost, condition at registration and useful life years. Saves immediately — no
  chain. Assignment, removal and the register belong to Finance; the Manager sees the same report read-only.
- Approvals queue: registrations, stockouts, promotions, sales settlements (after Finance), HR approvals.
- **Inventory edit** (§4.2a) — the only role with it: item details, prices, and the inventory `Quantity`
  (remaining balance), edited as a plain field like any other.

### 5.4 Sales  *(only when `salesRoleEnabled`)*
- Sidebar: My stock · Enter sales · My history.
- **Strictly own assignments** (Q15): sees only its own open assignments and its own history. No stock
  levels, no other agents' numbers.
- Open assignments = approved, not yet settled. Settled ones move to history.
- Enters results like the Finance form; submits to Finance → Manager.

**Login identity (Q7 + R2):** one **shared username per tenant**, **unique password per agent**, generated
by the system when the Manager registers the agent. The login screen asks only for **username + password**
— no agent picker. The backend identifies the agent by verifying the submitted password against that
tenant's active agents and issues the JWT for the match, so "who sold this" is provable from the token.

Guardrails this requires: per-username attempt throttling plus lockout, constant-time hash comparison over
the candidate set, and an audit row for every failed and successful agent login. The initial password is
shown to the Manager once, is **never retrievable after the agent's first login**, and **must be changed at
first login** before anything else.

### 5.5 HR
Full HotCol HR parity in v1 (Q14): Overview · Employees · OTP resets · Workflows · Leave (+ types) ·
Attendance · Shift templates · Checklists · Compensation · People ops · Documents · Incidents (+ types) ·
Departments, plus the Manager approval queue for leave, attendance corrections, payroll, documents,
incidents. Companions `volosync-emp` (ESS) and `volosync-ats` (hiring) are in scope.

---

## 6. `volosync-admin`

Port of `hotcol` **minus** crystal names, order-mode requests, quarterly payments. Kept: dashboard,
tenants, signups, payments (setup + yearly + verification queue), pricing, modules catalog, reports,
platform sales agents (Apex's own sellers — **not** tenant agents), users, audit, feedback.

### 6.1 Tenant detail
Tabs: **Reports · Payments · Access · Billing · Branches · Staff · Modules**.

- **Modules**: Inventory / HR checkboxes + `salesRoleEnabled` switch + fee recalculation.
- **Billing**: yearly fee, next renewal, manual override. Yearly only.
- **Payments**: owner-submitted references (channel + transaction ref + amount) approve/reject; history.
- **Branches**: child tenants of this company, shown grouped (main flag, TIN, status).
- **Staff / Access**: users by role; credential reset. Sales agents are created by the tenant's Manager,
  not by Apex.

---

## 7. `volosync-owner` (Expo, mobile only)

Tabs: Portfolio · Sales · Inventory · Staff · More.

- **Portfolio** — switch between branches (each a child tenant) and an all-branch roll-up: stock value,
  sales, returns, promotions, pending approvals, subscription status. **VAT shown separately**
  (base / VAT / inclusive) on every money figure.
- **Sales** — revenue, units, agent ranking, payment-method mix, trends, penalties.
- **Inventory** — stock value, low/expiring stock, recent movements, promotion impact.
- **Staff** — headcount, HR snapshot, sales agents.
- **More** — subscription payment submission (channel + transaction ref, yearly), **branch creation**
  (child tenant + manager credentials), password change, notifications, sign out.

Owner is read-only on operations. Writes limited to subscription submission, branch creation,
profile/password.

Subscription flow: app shows amount due for the year → owner submits channel + reference → appears in
`volosync-admin → Payments` as pending → Apex approves → tenant extended one year. No card processing.

---

## 8. Cross-cutting

- **Receipts**: registration, stockout, promotion (single + combined batch), sales approval. Apex branding
  footer (`branding.ts`). Browser print-to-PDF with print stylesheet (Q13 — no server renderer).
  A4, page-break safe, repeated header on overflow.
- **Exports**: every report → PDF **and** Excel; Payment & tax → PDF at minimum. One shared row model so
  screen, PDF and Excel cannot drift.
- **Money/tax**: ETB, `Africa/Addis_Ababa`, `en-GB`. `vatRate` 15% default, stored per lot at registration.
- **Notifications/audit**: inventory notification center + the single approval timeline (§4.8).
- **Conventions**: HotCol combobox pattern, approval queue cards, pending badges, filter-bar + sticky
  header tables, phone input, date picker, batch movement bar, empty states, skeletons.

---

## 9. Non-goals (v1)

No purchase pipeline · no purchase requests · no cost controller · **no credit of any kind** · no quarterly
billing · no crystal naming · no order mode · no POS/waiter/room/guest · no payment gateway processing ·
no multi-currency · no customer-level returns · no tenant subdomains.

---

## 10. Decision log (answers on record)

| # | Decision |
|---|---|
| 1 | Registration **and** stockout require **both** Finance and Manager approval to affect inventory |
| 2 | Inventory effect at **Manager approval** |
| 3 | `changingAmount` = per-unit price delta (negative = discount) **+ required reason input** |
| 4 | No overselling; Finance/Manager decline bad entries; returns add quantity back to the same lot; Payment & tax keeps the true record |
| 5 | Payment & tax = All lines / With VAT / Without VAT only |
| 6 | **VAT added on top** (15%); `paidAmount` kept = `unitCost + VAT` per unit |
| 7 | **Shared username, per-agent unique password**, forced change at first login, initial password never retrievable afterwards |
| 8 | **Branch = separate tenant**; owner mobile app switches between branches |
| 9 | Registration supplier **is** the manufacturer; no separate registry |
| 10 | Variance non-zero can only be **negative** |
| 11 | Ranking by **revenue then units**; all-time/weekly/monthly/quarterly/half-year/yearly; returns not penalised, **penalty checkbox** in sales approval demotes |
| 12 | Owner is **mobile only** |
| 13 | HotCol-style browser print-to-PDF is enough |
| 14 | **Full HR in v1** |
| 15 | Sales sees **strictly own** assignments |
| 16 | No tenant domain/URL |
| 17 | **Rejection is terminal** — no draft return, no reopen, no resubmit; the document stays in Request status as `REJECTED` with its reason. **VOID removed**; the three chains are the whole machine |
| 18 | **One shared database**; each `BackEnd/` (all five repos, incl. `volosync-ats` and `volosync-emp`) declares its own models/views for the tables it owns |
| 19 | Sales login = **shared username + agent password**, identity resolved from the password — no picker |
| 20 | Quantities are **decimal (DOUBLE)**, 3 dp |
| 21 | `paidAmount` is **read-only**, derived from `quantity × unitCost + 15%` |
| 22 | **Inventory edit is Manager-only** — details, prices and the `Quantity` (remaining) figure, edited as a **plain field update** with no adjustment record; no unit-price revision feature |
| 23 | **Assets** are a separate registry (not stock): **Manager registers**, **Finance assigns by typed assignee name (a client) and is the only role that can Remove**; no approval chain; Manager sees the same report read-only |

### Assumptions confirmed
A1. Each repo ships its own `BackEnd/` Django API on one shared DB, mimicking `pharmacy/BackEnd` (DRF,
SimpleJWT, PyMySQL, MySQL/Aiven, env-driven DB). A2. Cost controller removed; Store→Finance→Manager,
Finance→Manager, Manager→none. A3. No direct balance edits except the Manager's plain inventory `Quantity` edit
(§4.2a). A4. Sales agents are first-class users with own credentials and
own assigned stock. A5. Yearly billing with Apex approving references. A6. Browser-print receipts.

---

## 11. Resolved open items — no blockers left

| # | Question | Resolution |
|---|---|---|
| **R1** | Database topology | **One shared MySQL (Aiven), one schema** for all five backends. Each `BackEnd/` builds its own models, serializers, views and urls for the tables it owns; no gateway, no cross-service calls. A table is migrated by exactly one project — others read it. |
| **R2** | Sales login identifier | **No picker**: username + the agent's own password. The backend resolves the agent by matching the password against that tenant's active agents and issues that agent's token. Requires attempt throttling, lockout and login audit. |
| **R3** | Quantity precision | **Decimal (DOUBLE), 3 dp**, across registration, stockout, promotion, sales and returns. `soldQuantity = salesAmount ÷ effective unit price` rounded to 3 dp; the residual cent stays in `salesAmount`. |
| **R4** | `paidAmount` | **Read-only derived**: `quantity × unitCost + 15% vatRate`. Recomputed for display and on the receipt; never accepted from the client. |
| **R5** | Inventory edit & selling price | **Manager only**, via the inventory row's edit icon: item details, prices, and the single **`Quantity`** figure (the remaining balance) — edited **like the name**, no adjustment record, no history, no reason. No registered/remaining pair in the UI; Payment & tax carries the in-store vs stocked-out split. No approval chain, no unit-price revision feature. `changingAmount` remains assignment-local. |

Two implementation notes carried from these answers, not open questions:

- Shared-username login means the password hash is the identity — the agent list is small per tenant, but
  the endpoint must be rate-limited and must not leak *which* field failed.
- The Manager's `Quantity` edit is a direct field write, so it is **not** in the ledger and leaves no old →
  new trace. That is the accepted trade-off: stockout validation always uses the current value, so nothing can
  oversell, but "who changed the quantity and why" is only answerable from the edit itself, not a report.

---

## 12. Build sequence

| Phase | Scope |
|---|---|
| **0** | Foundations: Django scaffold per repo (pharmacy parity), shared auth/roles, tenant + child-tenant scoping, approval engine, design shell, branding/receipt primitives |
| **1** | Store: registration (single + batch) → Finance → Manager, inventory lists, item receipts, request status |
| **2** | Sales core: agent registry + credentials, stockout (single/batch, multi-agent), sales approval with returns and penalty, agent history |
| **3** | Promotions: initiate, approve, receipts, date-filtered portal, bulk print |
| **4** | Finance/Manager reporting, PDF/Excel, VAT split |
| **4b** | **Assets**: Manager registry, Finance assign/remove, shared asset register report (PDF + Excel) |
| **5** | HR module (full), `volosync-emp`, `volosync-ats` |
| **6** | `volosync-admin` (tenants, billing, branches) and `volosync-owner` mobile |
| **7** | Hardening, notifications, audit polish |

Phase 0 + 1 is the first demo: it proves the approval model end to end before sales and promotions build on it.
