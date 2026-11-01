# VoloSync API additions & changes

Backend contract for the features built in this pass: unified login (R2 guardrails),
sales-role enforcement, agent ranking periods, Manager lot edit, Payment & tax VAT
split, settlement filters + receipt payload, and assets (photo, category, filters).

Envelope convention is unchanged: successes are `{"data": ...}`, errors are
`{"errors": ...}`. The login endpoint is the one exception (JWT-shaped, see below).
All money is a string with 2 decimals (ETB); quantities are strings with up to 3
decimals.

---

## 1. Login (staff + sales agents, unified) — CHANGED

`POST /api/auth/login/`

Request:

```json
{ "username": "sales-apex", "password": "agent123" }
```

One endpoint now serves both staff users and sales agents (spec Q7 + R2):

- Staff are tried first (unchanged behavior).
- If staff auth fails, the backend resolves sales agents by matching the password
  against every **active** agent whose `login_username` matches the username
  (case-insensitive) — **and only when the tenant has `sales_role_enabled` on**.
  All candidates' passwords are verified (no early exit) to avoid timing leaks.
- Failure is always a generic 401; it never reveals whether the username or the
  password was wrong.

Success — 200 (same shape for staff and agents):

```json
{
  "access": "<jwt>",
  "refresh": "<jwt>",
  "user": {
    "id": 7,
    "username": "agent-1-0",
    "name": "Hanna Tesfaye",
    "role": "SALES",
    "tenant": "Apex Wholesale Trading",
    "tenant_id": 1,
    "must_change_password": true
  }
}
```

`role` is `"SALES"` for agents (from the agent profile), one of
`STORE|FINANCE|MANAGER|HR|SALES|OWNER` for staff. `must_change_password` comes
from the agent record for agents, from the user profile for staff.

Failure — 401:

```json
{ "errors": { "message": "Invalid credentials." } }
```

Lockout — 429 (after 5 consecutive failures for the same username within 15
minutes; a successful login clears the counter; the lock expires 15 minutes
after the 5th failure):

```json
{ "errors": { "message": "Too many attempts. Try again later." } }
```

Every login attempt (staff and agent, success and failure) is audited in a
`LoginAttempt` row (`username`, `ip`, `success`, `kind` STAFF|AGENT, agent FK).

The legacy `POST /api/sales/agents/login/` still exists but no longer enforces
the lockout/audit guardrails — new clients should use `/api/auth/login/`.

---

## 2. Sales-role enforcement (403) — CHANGED

When a user with the `SALES` role hits any sales endpoint and the tenant has
`sales_role_enabled = false`, the response is:

```json
{ "errors": { "message": "Sales role is disabled for this tenant." } }
```

Status 403. Applies to:

| Endpoint | Method |
|---|---|
| `/api/sales/settlements/` | GET (agent's own history) |
| `/api/sales/settlements/` | POST (enter sales) |
| `/api/sales/open-assignments/` | GET (my stock) |
| `/api/sales/agents/change-password/` | POST (any agent user) |
| `/api/inventory/stockouts/` | GET (agent's approved docs) |

---

## 3. Agent ranking — CHANGED

`GET /api/sales/agents/ranking/`
Roles: MANAGER, FINANCE, OWNER.

Query params:

| Param | Values | Default | Window (Africa/Addis_Ababa) |
|---|---|---|---|
| `period` | `alltime` \| `weekly` \| `monthly` \| `quarterly` \| `halfyear` \| `yearly` | `alltime` | weekly = last 7 days (rolling); monthly = current calendar month; quarterly = last 3 months (rolling); halfyear = last 6 months (rolling); yearly = current calendar year |

Only `APPROVED` settlements count. Every **active** agent of the tenant appears,
zero-filled. Ordering: penalized agents always rank below non-penalized ones,
then revenue desc, then units sold desc.

Response `data` — array:

```json
[
  {
    "agent_id": 3,
    "name": "Meron Alemu",
    "revenue": "15240.00",
    "units_sold": "14",
    "returned_quantity": "2",
    "penalty_count": 0,
    "has_penalty": false,
    "rank": 1
  }
]
```

`revenue` = Σ `sales_amount`; `units_sold` = Σ `sold_quantity`;
`returned_quantity` = Σ `returned_quantity`; `penalty_count` = number of
settlements with `penalty = true`.

---

## 4. Settlements — CHANGED (filters + receipt payload)

`GET /api/sales/settlements/`
Roles: any authenticated user (agents see only their own rows).

New query params (all optional, combinable; existing `queue=1` still works):

| Param | Meaning |
|---|---|
| `from` | `YYYY-MM-DD`, inclusive start date (entered-at) |
| `to` | `YYYY-MM-DD`, inclusive end date |
| `agent_id` | filter by sales agent id |
| `item_id` | filter by lot id (the "item" of the sales form is a voucher lot) |
| `status` | `PENDING_FINANCE` \| `PENDING_MANAGER` \| `APPROVED` \| `REJECTED` |
| `payment_method` | `TELEBIRR` \| `BANK` \| `RECEIPT` |

Response `data` — array; each row now carries everything a receipt needs:

```json
{
  "id": 12,
  "assignment": 5,
  "lot": 3,
  "voucher_number": "VS-2026-000001-001",
  "item_name": "Cooking Oil 5L",
  "agent_name": "Hanna Tesfaye",
  "assigned_quantity": "16.000",
  "sold_quantity": "14.000",
  "returned_quantity": "2.000",
  "payment_method": "TELEBIRR",
  "sales_amount": "18480.00",
  "expected_amount": "18480.00",
  "variance": "0.00",
  "penalty": false,
  "note": "",
  "status": "APPROVED",
  "entered_by": 4,
  "entered_by_name": "Marta Girma",
  "entered_at": "2026-10-29T14:03:11+03:00",
  "created_at": "2026-10-29T14:03:11+03:00",
  "finance_approval": {
    "decision": "APPROVED",
    "decided_by": "Marta Girma",
    "decided_at": "2026-10-29T15:00:00+03:00",
    "note": ""
  },
  "manager_approval": {
    "decision": "APPROVED",
    "decided_by": "Yohannes Kebede",
    "decided_at": "2026-10-29T16:12:00+03:00",
    "note": ""
  }
}
```

`variance` = `sales_amount − expected_amount` (negative-only by design, Q10).
`finance_approval` / `manager_approval` are `null` while that step has not
decided (stamps come from the generic `Approval` rows).

`POST /api/sales/settlements/` is unchanged in body
(`assignment`, `sold_quantity`, `payment_method`, `sales_amount`, `penalty`,
`note`) and now returns the enriched row above. `entered_by` is read-only (the
server always records the caller). Returns 403 with the sales-disabled message
when a SALES user's tenant has the role off.

---

## 5. Inventory lot edit (Manager) — CHANGED

`PATCH /api/inventory/lots/<id>/`
Roles: MANAGER only (others get 403).

The edit form now covers the full spec §4.2a set. All fields optional (PATCH):

```json
{
  "remaining_quantity": "24.000",
  "unit_sales": "1350.00",
  "unit_cost": "1150.00",
  "item_name": "Cooking Oil 5L",
  "category": "Groceries",
  "unit": "carton",
  "note": "checked by manager",
  "image": "lots/8f3a....jpg",
  "expiry_date": "2027-01-31",
  "supplier_name": "East Africa Foods PLC",
  "supplier_phone": "+251911222333",
  "supplier_address": "Adama",
  "supplier_tin": ""
}
```

- `remaining_quantity` is the inventory screen's single **Quantity** (the
  remaining balance) — a plain overwrite, no ledger entry, no approval.
- `unit_sales` re-derives `price_with_vat = unit_sales × (1 + vat_rate/100)`.
- `unit_cost` re-derives `paid_amount = registered quantity × unit_cost ×
  (1 + vat_rate/100)` (R4: registered quantity, not the edited remaining).
- `item_name` / `category` / `unit` update the linked catalog `Item`.
- `voucher_number` is immutable (ignored if sent).
- `unit_sales` must be > 0; `unit_cost` ≥ 0; `remaining_quantity` ≥ 0.

Response `data` — the full serialized lot (unchanged shape, e.g.
`GET /api/inventory/lots/` rows): includes `price_with_vat` and `paid_amount`
already re-derived.

---

## 6. Payment & tax summary — CHANGED

`GET /api/inventory/summary/`
Roles: any authenticated user (Store + Finance screens).

New query param:

| Param | Values | Meaning |
|---|---|---|
| `tab` | `all` \| `with_vat` \| `without_vat` | `all` = every lot; `with_vat` = lots whose computed input VAT > 0; `without_vat` = lots registered at a 0% rate (empty until such lots exist) |

Registration already accepts a per-line `vat_rate` override (including `0`), so
zero-rated lots appear naturally and the `without_vat` tab fills up as they are
registered. Totals always follow the filtered rows so the panel reconciles.

Each row in `data.rows` (new fields; old fields kept):

```json
{
  "id": 1,
  "voucher_number": "VS-2026-000001-001",
  "item_name": "Cooking Oil 5L",
  "category": "Groceries",
  "unit": "carton",
  "registered_qty": "40.000",
  "registered_value": "46000.00",
  "in_store_qty": "24.000",
  "in_store_value": "27600.00",
  "stocked_out_qty": "16.000",
  "stocked_out_value": "18400.00",
  "unit_cost": "1150.00",
  "paid_amount": "52900.00",
  "base_value": "46000.00",
  "vat_amount": "6900.00",
  "inclusive_amount": "52900.00",
  "output_vat": "3192.00",
  "vat_rate": "15.00",
  "quantity": "40.000",
  "remaining_quantity": "24.000",
  "stocked_out_quantity": "16.000",
  "price_with_vat": "1518.00",
  "registered_value": "46000.00",
  "in_store_value": "27600.00",
  "stocked_out_value": "18400.00",
  "vat": "6900.00"
}
```

Definitions:

- `paid_amount` = `inclusive_amount` = registered qty × unit_cost × (1 + vat)
  — the VAT-inclusive line total (input side).
- `base_value` = registered qty × unit_cost; `vat_amount` = `paid_amount −
  base_value` (input VAT).
- `output_vat` = `stocked_out_qty × unit_sales × vat_rate / 100` — output VAT
  on the sold portion, estimated at the lot's current `unit_sales`.

`data.totals` (all strings):

```json
{
  "registered_value": "112000.00",
  "in_store_value": "66400.00",
  "stocked_out_value": "45600.00",
  "base_value": "112000.00",
  "vat": "16800.00",
  "inclusive_amount": "128800.00",
  "output_vat": "7680.00",
  "total_input_vat": "16800.00",
  "total_output_vat": "7680.00",
  "net_vat": "-9120.00"
}
```

`net_vat` = output − input (negative = reclaimable).

---

## 7. Assets

### 7.1 Photo upload — NEW

`POST /api/assets/uploads/`
Roles: MANAGER. `multipart/form-data` with field `file` (image, ≤ 5 MB).

201 response:

```json
{ "data": { "path": "assets/9c2f....jpg", "url": "http://host/media/assets/9c2f....jpg" } }
```

Send `path` as the `photo` value when creating/patching the asset.

### 7.2 Category enum — CHANGED

Canonical category codes: `IT_EQUIPMENT`, `FURNITURE`, `VEHICLE`, `MACHINERY`,
`TOOL`, `OTHER`. The old `IT` code is migrated to `IT_EQUIPMENT` (existing rows
renamed by migration `assets.0002`). Invalid `category` or
`condition_at_registration` (`NEW` | `GOOD` | `FAIR` | `DAMAGED`) now return a
400 field error instead of being stored blindly.

### 7.3 List with filters — CHANGED

`GET /api/assets/`
Roles: any authenticated user of the tenant.

| Param | Meaning |
|---|---|
| `category` | one of the canonical codes above |
| `status` | `AVAILABLE` \| `ASSIGNED` |
| `branch` | a branch (child) tenant id, or the viewer's own tenant id; anything else returns an empty list |

Response `data` — array (book value and assignee included for the PDF/Excel
report):

```json
{
  "id": 1,
  "asset_tag": "AST-2026-000001",
  "name": "Dell Latitude 5540",
  "category": "IT_EQUIPMENT",
  "serial_number": "",
  "quantity": "1.000",
  "brand_model": "",
  "photo": "assets/9c2f....jpg",
  "unit_cost": "78000.00",
  "condition_at_registration": "NEW",
  "useful_life_years": 5,
  "status": "ASSIGNED",
  "assignee_name": "Client PLC",
  "book_value": "62400.00",
  "created_at": "2026-01-10T09:00:00+03:00",
  "assignments": [
    { "id": 3, "assignee_name": "Client PLC", "assigned_at": "2026-02-01", "is_active": true, "removed_at": null }
  ]
}
```

### 7.4 Create / patch — CHANGED

`POST /api/assets/` (MANAGER) and `PATCH /api/assets/<id>/` (MANAGER) now
validate through a serializer. Accepted body fields: `asset_tag` (optional on
create — auto `AST-YYYY-NNNNNN`), `name`, `category`, `serial_number`,
`quantity`, `brand_model`, `photo` (path string from 7.1), `unit_cost`,
`condition_at_registration`, `useful_life_years`. `status` is **not** writable
— assets move only through the Finance assign/remove endpoints.

Errors follow the envelope, e.g.:

```json
{ "errors": { "category": ["Choose one of: IT_EQUIPMENT, FURNITURE, VEHICLE, MACHINERY, TOOL, OTHER."] } }
```

Assign (`POST /api/assets/<id>/assign/`, FINANCE) and remove
(`POST /api/assets/<id>/remove/`, FINANCE) are unchanged.
