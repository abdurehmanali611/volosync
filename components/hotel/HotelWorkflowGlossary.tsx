"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "costControl" | "finance" | "manager";

/** Manager page topics — pick terms that match the open sidebar section. */
export type ManagerGlossaryTopic =
  | "dashboard"
  | "inventory"
  | "authorize"
  | "station-counts"
  | "payment-tax"
  | "lodging-reports"
  | "lodging-rooms"
  | "laundry"
  | "credentials"
  | "cafe"
  | "credit"
  | "hr"
  | "general";

type GlossarySection = {
  title: string;
  items: { term: string; definition: string }[];
};

const COST_CONTROL: GlossarySection[] = [
  {
    title: "Roles & flow",
    items: [
      {
        term: "Cost control",
        definition:
          "Checks store purchase requests and stock movements before they finalize. Existing-stock changes stop here unless rejected.",
      },
      {
        term: "Finance (next step)",
        definition:
          "After you approve a purchase request, finance authorises payment; the store registers stock when goods are received.",
      },
      {
        term: "Purchase request",
        definition:
          "Store asks to buy something not yet in inventory. Path: store → cost control → finance.",
      },
      {
        term: "Stock movement request",
        definition:
          "Store asks to reduce quantity on an existing line (stock out, wastage, or return to supplier). It applies only after you approve.",
      },
    ],
  },
  {
    title: "Audit & IDs",
    items: [
      {
        term: "Cost controller identity",
        definition:
          "A name your manager registered. Even if several people share one login, pick your name when approving so reports show who acted.",
      },
      {
        term: "Inventory registration ID",
        definition:
          "The internal row number of that item in master inventory (the line the movement will deduct from).",
      },
      {
        term: "Qty",
        definition: "Quantity — how many units of measure are involved.",
      },
    ],
  },
  {
    title: "Movement types",
    items: [
      {
        term: "Stock out",
        definition:
          "Stock leaves the store for use elsewhere (e.g. kitchen or bar), not a café sale in this screen.",
      },
      {
        term: "Wastage",
        definition: "Stock written off as spoiled, damaged, or unusable.",
      },
      {
        term: "Return to supplier",
        definition:
          "Stock sent back to the vendor; reduces on-hand quantity when approved.",
      },
    ],
  },
  {
    title: "Station daily counts (kitchen, bar, etc.)",
    items: [
      {
        term: "Beginning (BB)",
        definition:
          "Physical count when the day starts at the station (kitchen/chef is one station; bar, juicer, cleaning, and other stakeholders match store stock-out labels).",
      },
      {
        term: "Store",
        definition:
          "Total quantity moved from the store to that station on the calendar day, only after you approve the store’s stock-out request — you do not type this on the daily form.",
      },
      {
        term: "Total",
        definition:
          "Beginning (BB) plus Store for that day.",
      },
      {
        term: "Sales",
        definition:
          "Beginning today minus prior On Hand. Does not include Management issues.",
      },
      {
        term: "Management",
        definition:
          "Units taken from station stock by management on that day.",
      },
      {
        term: "On Hand",
        definition:
          "Station quantity still on hand: Total − (Sales + Management).",
      },
      {
        term: "Sync monthly inventory",
        definition:
          "Rolls daily rows into a date range: sums Sales for the range and stores last On Hand for finance and managers.",
      },
    ],
  },
  {
    title: "Money",
    items: [
      {
        term: "ETB",
        definition:
          "Ethiopian Birr — currency used for estimated prices and line totals.",
      },
      {
        term: "Est. price / unit",
        definition:
          "Rough unit price the store entered; finance uses it with quantity to estimate the line before payment.",
      },
    ],
  },
];

const FINANCE: GlossarySection[] = [
  {
    title: "Your role",
    items: [
      {
        term: "Finance approval",
        definition:
          "You confirm payment authorisation after cost control. The store team registers received stock separately when goods arrive.",
      },
      {
        term: "Cost control (before you)",
        definition:
          "Already checked the request; your queue only shows items they approved for payment.",
      },
    ],
  },
  {
    title: "Queue & history",
    items: [
      {
        term: "Payment queue",
        definition:
          "Purchase requests in “awaiting finance” state. Approve to record payment authorisation; the store registers inventory when goods arrive.",
      },
      {
        term: "History",
        definition:
          "Recent finance outcomes (approved or rejected) for your audit trail.",
      },
      {
        term: "Cost control reviewer",
        definition:
          "The registered identity name of the person who approved at the cost-control step (not necessarily their login username).",
      },
    ],
  },
  {
    title: "Amounts & codes",
    items: [
      {
        term: "Est. line total",
        definition:
          "Quantity × estimated unit price in ETB — indicative until you approve; store receipt is separate.",
      },
      {
        term: "ETB",
        definition: "Ethiopian Birr.",
      },
      {
        term: "Status labels",
        definition:
          "“Awaiting finance” means ready for you. “Approved by finance (awaiting store receipt)” means payment is cleared; the store still registers the item when delivered.",
      },
    ],
  },
];

const MANAGER_BY_TOPIC: Record<ManagerGlossaryTopic, GlossarySection[]> = {
  dashboard: [
    {
      title: "Progress overview",
      items: [
        {
          term: "Overall points",
          definition:
            "Average readiness score across the modules this property actually subscribes to (0–100).",
        },
        {
          term: "Module points",
          definition:
            "Per-module health score from setup completeness and open operational work (backlog lowers the score).",
        },
        {
          term: "Subscribed module",
          definition:
            "A product area enabled for this tenant (Rooms, Inventory, Café, Credit, etc.). Cards and charts only appear for modules you pay for.",
        },
      ],
    },
    {
      title: "Charts on this page",
      items: [
        {
          term: "Room status mix",
          definition:
            "Donut of vacant clean, vacant dirty, occupied, and maintenance rooms right now.",
        },
        {
          term: "Inventory pipeline",
          definition:
            "Counts of active items versus purchases and stock movements still waiting approval.",
        },
        {
          term: "Café footprint",
          definition:
            "Menu items, tables, waiters, and live floor orders for the café module.",
        },
      ],
    },
  ],
  inventory: [
    {
      title: "Inventory views",
      items: [
        {
          term: "Inventory items",
          definition:
            "Active stock lines for this property — quantities, units, and catalogue identity.",
        },
        {
          term: "Stock movements",
          definition:
            "History of store stock-outs, wastage, and returns after cost-control decisions.",
        },
        {
          term: "Purchase pipeline",
          definition:
            "Buy requests moving through cost control and finance before the store can receive goods.",
        },
        {
          term: "Item receipts",
          definition:
            "When purchased goods arrive, the store registers them into inventory here or on the store terminal.",
        },
      ],
    },
  ],
  authorize: [
    {
      title: "Manager approvals",
      items: [
        {
          term: "Authorize registrations",
          definition:
            "Manager confirms new inventory item registrations before they become live lines.",
        },
        {
          term: "Authorize purchases",
          definition:
            "Final manager gate on purchase requests that need executive sign-off in your workflow.",
        },
        {
          term: "Authorize stock",
          definition:
            "Manager review of sensitive stock movement requests when your property requires it.",
        },
        {
          term: "Cost controller identity",
          definition:
            "Named person on duty at cost control — used for audit even when several people share one login.",
        },
      ],
    },
  ],
  "station-counts": [
    {
      title: "Daily station counts",
      items: [
        {
          term: "Beginning (BB)",
          definition:
            "Opening count for the day. If the same station item was counted yesterday (name match ignores case), this starts as that day’s On Hand.",
        },
        {
          term: "Store",
          definition:
            "Total approved store-to-station quantity for that item and day.",
        },
        {
          term: "Total",
          definition:
            "Beginning (BB) plus Store for that day.",
        },
        {
          term: "Sales",
          definition:
            "Units sold that day. Entered by Cost Control on create and update.",
        },
        {
          term: "On Hand",
          definition:
            "Total − Sales − Management − Invitation remaining at the station.",
        },
      ],
    },
  ],
  "payment-tax": [
    {
      title: "Inventory payment & tax",
      items: [
        {
          term: "VAT / non-VAT",
          definition:
            "Whether a purchase line is recorded with tax. Categories shape how payment and reporting group those lines.",
        },
        {
          term: "Payment category",
          definition:
            "How the property classifies inventory payments (credit, paid, with/without VAT) for manager reporting.",
        },
        {
          term: "ETB",
          definition: "Ethiopian Birr — amounts on inventory payment views.",
        },
      ],
    },
  ],
  "lodging-reports": [
    {
      title: "Room reports",
      items: [
        {
          term: "Vacant clean",
          definition:
            "Sellable empty room that housekeeping has finished — ready for check-in.",
        },
        {
          term: "Vacant dirty",
          definition:
            "Empty room still waiting for cleaning before it can be sold again.",
        },
        {
          term: "Occupied",
          definition: "Room currently assigned to an active guest stay.",
        },
        {
          term: "On maintenance",
          definition:
            "Room blocked for repair or upkeep; not available until released to vacant clean.",
        },
        {
          term: "Open CM jobs",
          definition:
            "Cleaning or maintenance assignments still open for dirty or blocked rooms.",
        },
      ],
    },
    {
      title: "Stays & guests",
      items: [
        {
          term: "Stay / voucher",
          definition:
            "A guest period with assigned rooms, arrival/departure, and a running bill identified by voucher code.",
        },
        {
          term: "Past guests",
          definition:
            "Guest profiles previously registered at this property — searchable by name, phone, email, or ID documents.",
        },
        {
          term: "Action trail",
          definition:
            "Audit log of lodging actions (check-in, status changes, billing, CM) including what changed in each row.",
        },
      ],
    },
  ],
  "lodging-rooms": [
    {
      title: "Room catalogue",
      items: [
        {
          term: "Room type",
          definition:
            "Category used for pricing and preferred assignment (e.g. standard, suite).",
        },
        {
          term: "Price per night (ETB)",
          definition:
            "Nightly room charge used when building the stay bill at check-in.",
        },
        {
          term: "Room status",
          definition:
            "Operational state: vacant clean, vacant dirty, occupied, or on maintenance.",
        },
      ],
    },
  ],
  laundry: [
    {
      title: "In-room laundry",
      items: [
        {
          term: "Laundry item",
          definition:
            "A priced service guests can order to the room (pressing, wash, etc.), separate from café F&B.",
        },
        {
          term: "Unit price (ETB)",
          definition: "Amount charged per unit when laundry is added to a stay bill.",
        },
        {
          term: "Active item",
          definition:
            "Shown on reception laundry menus; inactive items stay in the catalogue but are hidden from ordering.",
        },
      ],
    },
  ],
  credentials: [
    {
      title: "Staff access",
      items: [
        {
          term: "Grant credential",
          definition:
            "Create a staff login for a role allowed by your subscribed modules (Reception, Store, Café, etc.).",
        },
        {
          term: "Update credential",
          definition:
            "Change password, role, or remove access for an existing staff user on this property.",
        },
        {
          term: "Role",
          definition:
            "Determines which terminal the person may open; must match an enabled module.",
        },
      ],
    },
  ],
  cafe: [
    {
      title: "Café & restaurant",
      items: [
        {
          term: "Menu item",
          definition:
            "Food or drink sold on the café floor or offered for in-room F&B when that module is enabled.",
        },
        {
          term: "Live order",
          definition:
            "Open café order still being prepared or awaiting payment on the floor.",
        },
        {
          term: "Table / waiter",
          definition:
            "Floor seating identity and the staff member assigned to take and close orders.",
        },
      ],
    },
  ],
  hr: [
    {
      title: "Workforce",
      items: [
        {
          term: "Employee master",
          definition:
            "HR employment record for this property — role, pay, and hire details used when filing leave and when payroll is closed.",
        },
        {
          term: "Headcount",
          definition:
            "Active and on-leave employees. Terminated people stay on file but drop out of headcount.",
        },
        {
          term: "Terminate",
          definition:
            "Ends employment from a chosen date. History, leave, and payslips remain.",
        },
      ],
    },
    {
      title: "Leave, time & pay",
      items: [
        {
          term: "Leave types",
          definition:
            "Manager settings for leave categories (hotel). Café Admin configures leave types in the Admin HR group. Default days become the starting balance for new employees. Paid types consume that balance when approved.",
        },
        {
          term: "Leave queue",
          definition:
            "Requests filed by HR on behalf of employees. The manager approves or rejects. Approved paid leave reduces the matching balance.",
        },
        {
          term: "Clock in/out",
          definition:
            "HR records an employee’s start or end of work for today. Staff do not punch themselves in the app. Later, devices such as ZKTeco can feed those punches automatically. Shifts are the planned roster and can run overnight. Manager and HR both review attendance and shift reports.",
        },
        {
          term: "Incident types",
          definition:
            "Manager-defined categories with optional Deduct (salary deduction) and Amount (ETB). The list starts empty. HR records incidents against those types. If Manager has not created a type named Other, HR also gets an Other option to set deduct/amount for one-off cases such as paying for a lost item.",
        },
        {
          term: "Open payroll period",
          definition:
            "A calendar month that HR can still edit. Closing generates payslips from current salaries. Managers review the result as a read-only payroll report.",
        },
        {
          term: "Payslip",
          definition:
            "Period pay line: base, overtime, tips, deductions, and net ETB. Adjust after close if tips or deductions change.",
        },
      ],
    },
    {
      title: "File & incidents",
      items: [
        {
          term: "Document metadata",
          definition:
            "Title, type, and optional file link on the employee file. Binaries stay outside HR Phase 2.",
        },
        {
          term: "Incident",
          definition:
            "Warning, complaint, or commendation kept on the employee record.",
        },
      ],
    },
  ],
  credit: [
    {
      title: "Corporate credit",
      items: [
        {
          term: "Corporate credit tiers",
          definition:
            "Manager-defined credit ceilings and periods that cashiers reuse for company deals.",
        },
        {
          term: "Creditor usage report",
          definition:
            "Posted company consumption over a date range, with filters and Excel export.",
        },
        {
          term: "Company deal",
          definition:
            "Agreement linking a company, allowed menu lines, and credit terms for hotel cashier billing.",
        },
      ],
    },
  ],
  general: [
    {
      title: "Manager cockpit",
      items: [
        {
          term: "Manager terminal",
          definition:
            "Property control panel for inventory, rooms, café setup, credentials, and approval queues based on subscribed modules.",
        },
        {
          term: "ETB",
          definition: "Ethiopian Birr — default currency across hotel and café money fields.",
        },
      ],
    },
  ],
};

const SECTIONS: Record<Variant, GlossarySection[]> = {
  costControl: COST_CONTROL,
  finance: FINANCE,
  manager: MANAGER_BY_TOPIC.general,
};

export function resolveManagerGlossaryTopic(tabId: string): ManagerGlossaryTopic {
  if (tabId === "dashboard") return "dashboard";
  if (tabId.startsWith("hr-")) return "hr";
  if (tabId === "lodging-reports") return "lodging-reports";
  if (tabId === "lodging-rooms") return "lodging-rooms";
  if (
    tabId === "lodging-laundry-add" ||
    tabId === "lodging-laundry-items"
  ) {
    return "laundry";
  }
  if (tabId === "grant-credential" || tabId === "delete-credential") {
    return "credentials";
  }
  if (tabId === "reports-beginnings") return "station-counts";
  if (
    tabId === "authorize-item-registrations" ||
    tabId === "authorize-purchases" ||
    tabId === "authorize-stock" ||
    tabId === "cc-profiles" ||
    tabId === "department-leaders"
  ) {
    return "authorize";
  }
  if (tabId === "inventory-payment-vat" || tabId.startsWith("payment-")) {
    return "payment-tax";
  }
  if (
    tabId === "reports-inventory" ||
    tabId === "reports-movements" ||
    tabId === "reports-purchases" ||
    tabId === "item-receipts"
  ) {
    return "inventory";
  }
  if (
    tabId === "creditor-usage" ||
    tabId === "credit" ||
    tabId.includes("creditor")
  ) {
    return "credit";
  }
  if (
    tabId === "reports" ||
    tabId === "create-item" ||
    tabId === "update-item" ||
    tabId === "waiter-table" ||
    tabId === "station-prep-qty" ||
    tabId.startsWith("cafe-") ||
    tabId.startsWith("menu-")
  ) {
    return "cafe";
  }
  return "general";
}

export function HotelWorkflowGlossary({
  variant,
  topic,
  className,
}: {
  variant: Variant;
  /** When `variant` is manager, scopes definitions to the open sidebar page. */
  topic?: ManagerGlossaryTopic;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const sections =
    variant === "manager"
      ? MANAGER_BY_TOPIC[topic ?? "general"]
      : SECTIONS[variant];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto gap-2 border-dashed text-muted-foreground hover:text-foreground"
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          Terms used on this page
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 rounded-xl border bg-card/80 p-4 sm:p-5 text-sm shadow-inner space-y-5 data-[state=closed]:animate-out">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              {section.title}
            </h3>
            <dl className="space-y-2.5">
              {section.items.map(({ term, definition }) => (
                <div key={term}>
                  <dt className="font-medium text-foreground">{term}</dt>
                  <dd className="text-muted-foreground leading-relaxed pl-0 sm:pl-0 mt-0.5">
                    {definition}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
