"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  money,
  qty,
  statusTone,
  type Dashboard,
  type Lot,
  type Registration,
  type RegistrationLine,
  type StockOut,
  type Summary,
  type TenantInfo,
} from "@/lib/api";
import { useView } from "@/lib/use-view";
import { useRouter } from "next/navigation";
import { exportExcel, exportPdf } from "@/lib/export";
import { printReceipts, type ReceiptBusiness, type ReceiptDoc } from "@/lib/print";
import {
  buildRegistrationReceipt,
  buildStockOutReceipt,
  tenantBusiness,
} from "@/lib/receipts";
import { storeApi, type SummaryTab, type SummaryTabRow, type TabSummary } from "@/lib/api/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parsePickerDate } from "@/components/date-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  ArrowRight,
  Boxes,
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ClipboardCheck,
  FileDown,
  ImagePlus,
  Loader2,
  Layers3,
  MoreVertical,
  PackagePlus,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  EmptyRow,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  Td,
  Th,
} from "@/components/volo/kit";
import { DateField } from "@/components/volo/controls";
import { PhoneField } from "@/components/volo/phone-field";
import { QtyValueCell } from "@/components/volo/payment-tax";

const today = () => new Date().toISOString().slice(0, 10);
const lineVatRate = (line: RegistrationLine) => Number(line.vat_rate ?? 15);
const lineBase = (line: RegistrationLine) =>
  Number(line.quantity || 0) * Number(line.unit_cost || 0);
const lineTotal = (line: RegistrationLine) =>
  Number(line.quantity || 0) * Number(line.unit_cost || 0) * (1 + lineVatRate(line) / 100);
const lineSalePrice = (line: RegistrationLine) =>
  Number(line.unit_sales || 0);

type LotGroup = {
  key: string;
  itemName: string;
  category: string;
  lots: Lot[];
  quantity: number;
};

/** Lots collapse into one row per item name + category, matching hotcol's hotel store. */
function groupLotsByItem(lots: Lot[]): LotGroup[] {
  const groups = new Map<string, LotGroup>();
  for (const lot of lots) {
    const itemName = lot.item_name.trim();
    const category = lot.category?.trim() || "Uncategorised";
    const key = `${itemName.toLowerCase()}::${category.toLowerCase()}`;
    const group =
      groups.get(key) ??
      { key, itemName, category, lots: [], quantity: 0 };
    group.lots.push(lot);
    group.quantity += Number(lot.remaining_quantity);
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      a.itemName.localeCompare(b.itemName) || a.category.localeCompare(b.category),
  );
}

type TaxItemGroup = {
  key: string;
  itemName: string;
  category: string;
  units: string[];
  rows: SummaryTabRow[];
  registeredQty: number;
  registeredValue: number;
  inStoreQty: number;
  inStoreValue: number;
  stockedOutQty: number;
  stockedOutValue: number;
  baseValue: number;
  vatAmount: number;
  outputVat: number;
  inclusiveAmount: number;
};

/** Payment & tax collapses voucher lots into one row per item + category. */
function groupTaxRows(rows: SummaryTabRow[]): TaxItemGroup[] {
  const groups = new Map<string, TaxItemGroup>();
  for (const row of rows) {
    const itemName = row.item_name.trim();
    const category = row.category?.trim() || "Uncategorised";
    const key = `${itemName.toLowerCase()}::${category.toLowerCase()}`;
    const group =
      groups.get(key) ??
      {
        key,
        itemName,
        category,
        units: [],
        rows: [],
        registeredQty: 0,
        registeredValue: 0,
        inStoreQty: 0,
        inStoreValue: 0,
        stockedOutQty: 0,
        stockedOutValue: 0,
        baseValue: 0,
        vatAmount: 0,
        outputVat: 0,
        inclusiveAmount: 0,
      };
    group.rows.push(row);
    if (row.unit && !group.units.includes(row.unit)) group.units.push(row.unit);
    group.registeredQty += Number(row.registered_qty);
    group.registeredValue += Number(row.registered_value);
    group.inStoreQty += Number(row.in_store_qty);
    group.inStoreValue += Number(row.in_store_value);
    group.stockedOutQty += Number(row.stocked_out_qty);
    group.stockedOutValue += Number(row.stocked_out_value);
    group.baseValue += Number(row.base_value);
    group.vatAmount += Number(row.vat_amount);
    group.outputVat += Number(row.output_vat);
    group.inclusiveAmount += Number(row.inclusive_amount);
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      a.itemName.localeCompare(b.itemName) || a.category.localeCompare(b.category),
  );
}

const lotSupplier = (lot: Lot) => lot.supplier_name?.trim() || "Unnamed supplier";

/** Case-insensitive "contains" over any of the supplied fields. */
function matchesQuery(query: string, ...fields: unknown[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) =>
    String(field ?? "")
      .toLowerCase()
      .includes(needle),
  );
}

const registrationMatches = (doc: Registration, query: string) =>
  matchesQuery(
    query,
    doc.voucher_number,
    doc.supplier_name,
    doc.status,
    doc.lines.map((line) => line.item_name).join(" "),
  );

const stockOutMatches = (doc: StockOut, query: string) =>
  matchesQuery(
    query,
    doc.voucher_number,
    doc.mode,
    doc.status,
    doc.date,
    doc.assignments
      .map(
        (row) =>
          `${row.item_name} ${row.voucher_number} ${row.agent_name ?? ""}`,
      )
      .join(" "),
  );

const blankSupplier = () => ({
  supplier_name: "",
  supplier_phone: "",
  supplier_address: "",
  supplier_tin: "",
  note: "",
});

const REGISTRATION_CATEGORIES = [
  "Daily Groceries and Essentials",
  "Basic Foods",
  "Alcoholic Beverages",
  "Non-Alcoholic Beverages",
  "Building Supplies",
  "Medicine and Health Supplies",
  "Home Electronics",
  "car parts and tools",
  "clothes and shoes",
  "others",
];

const REGISTRATION_UNITS = [
  "Litre",
  "Kilogram",
  "Piece",
  "Packet",
  "Dozen",
  "Box",
  "Other",
];

const emptyLine = (): RegistrationLine => ({
  item_name: "",
  category: REGISTRATION_CATEGORIES[0],
  unit: "Piece",
  quantity: "1",
  unit_cost: "0",
  unit_sales: "0",
  vat_rate: "15.00",
  registration_date: today(),
  expiry_date: "",
  note: "",
});

type SingleRow = {
  lot: string;
  quantity: string;
  changing_amount: string;
  change_reason: string;
  sales_agent: string;
};

type AgentSection = {
  agent: string;
  items: { lot: string; quantity: string; changing_amount: string; change_reason: string }[];
};

const singleRow = (): SingleRow => ({
  lot: "",
  quantity: "",
  changing_amount: "0",
  change_reason: "",
  sales_agent: "",
});

const blankAgent = (): AgentSection => ({
  agent: "",
  items: [{ lot: "", quantity: "", changing_amount: "0", change_reason: "" }],
});

export default function StorePage() {
  const [view] = useView("register");
  const showReviewRegistrations = view === "review" || view === "review-registration";
  const showReviewStockOuts = view === "review" || view === "review-stock";
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stockouts, setStockouts] = useState<StockOut[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tax, setTax] = useState<TabSummary | null>(null);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxDetailKey, setTaxDetailKey] = useState<string | null>(null);

  const [supplier, setSupplier] = useState(blankSupplier);
  const [lines, setLines] = useState<RegistrationLine[]>([emptyLine()]);
  const [uploadingLine, setUploadingLine] = useState<number | null>(null);

  // stock out state
  const [mode, setMode] = useState<"SINGLE" | "BATCH">("SINGLE");
  const [batchTab, setBatchTab] = useState<"SAME" | "DIFFERENT">("SAME");
  const [stockoutDate, setStockoutDate] = useState(today());
  const [singleRows, setSingleRows] = useState<SingleRow[]>([singleRow()]);
  const [selectedLots, setSelectedLots] = useState<number[]>([]);
  const [same, setSame] = useState({
    quantity: "",
    changing_amount: "0",
    change_reason: "",
    sales_agent: "",
  });
  const [sections, setSections] = useState<AgentSection[]>([blankAgent()]);

  // Saved drafts (shared with the backend, status DRAFT)
  const [draftRegistrations, setDraftRegistrations] = useState<Registration[]>([]);
  const [draftStockOuts, setDraftStockOuts] = useState<StockOut[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftAction, setDraftAction] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<
    | { kind: "registration"; doc: Registration }
    | { kind: "stockout"; doc: StockOut }
    | null
  >(null);
  const [deleteDraft, setDeleteDraft] = useState<{
    kind: "registration" | "stockout";
    id: number;
    voucher: string;
  } | null>(null);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [draftsBulkAction, setDraftsBulkAction] = useState<"send" | "delete" | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Inventory batch stock out
  const [checkedLots, setCheckedLots] = useState<number[]>([]);
  const [stockOutRequest, setStockOutRequest] = useState<{
    mode: "SINGLE" | "BATCH";
    lots: Lot[];
  } | null>(null);
  const [supplierFilter, setSupplierFilter] = useState("");

  // Table search (kept per list so filters never leak between views)
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inactiveQuery, setInactiveQuery] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [registrationQuery, setRegistrationQuery] = useState("");
  const [movementQuery, setMovementQuery] = useState("");
  const [receiptRegQuery, setReceiptRegQuery] = useState("");
  const [receiptStockQuery, setReceiptStockQuery] = useState("");
  const [taxQuery, setTaxQuery] = useState("");

  // Payment & tax keeps the same four controls as finance and manager.
  const [taxFrom, setTaxFrom] = useState("");
  const [taxTo, setTaxTo] = useState("");
  const [taxSupplier, setTaxSupplier] = useState("all");
  const [taxVat, setTaxVat] = useState<"all" | "with" | "without">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, lotsResponse, regs, sos, taxResponse, agentOptions, regDrafts, soDrafts, tenant] =
        await Promise.all([
          api.dashboard(),
          api.lots(),
          api.registrations(),
          api.stockouts(),
          api.summary(),
          api.agents(),
          api.registrationDrafts(),
          api.stockoutDrafts(),
          api.tenantMe(),
        ]);
      setDashboard(dash.data);
      setTenantInfo(tenant.data);
      setLots(lotsResponse.data);
      setRegistrations(regs.data);
      setStockouts(sos.data);
      setSummary(taxResponse.data);
      setAgents(agentOptions.data);
      setDraftRegistrations(regDrafts.data);
      setDraftStockOuts(soDrafts.data);
    } finally {
      setDraftsLoading(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const [regs, sos] = await Promise.all([
        api.registrationDrafts(),
        api.stockoutDrafts(),
      ]);
      setDraftRegistrations(regs.data);
      setDraftStockOuts(sos.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load saved drafts.",
      );
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const isTaxView = view === "tax" || view === "tax-with" || view === "tax-without";
  const taxTab: SummaryTab =
    view === "tax-with" ? "with_vat" : view === "tax-without" ? "without_vat" : "all";

  // Payment & tax rows come from the server already sliced per tab; totals
  // follow the filtered rows so the panel reconciles.
  useEffect(() => {
    if (!isTaxView) return;
    let cancelled = false;
    setTaxLoading(true);
    storeApi
      .summaryByTab(taxTab)
      .then((response) => {
        if (!cancelled) setTax(response.data);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load Payment & tax");
        }
      })
      .finally(() => {
        if (!cancelled) setTaxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isTaxView, taxTab]);

  const totals = useMemo(() => {
    const quantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const base = lines.reduce((sum, line) => sum + lineBase(line), 0);
    const paid = lines.reduce((sum, line) => sum + lineTotal(line), 0);
    return { quantity, base, paid, vat: paid - base };
  }, [lines]);

  const approvedStockOuts = useMemo(
    () => stockouts.filter((doc) => doc.status === "APPROVED"),
    [stockouts],
  );

  const activeLots = useMemo(() => {
    const current = today();
    return lots.filter(
      (lot) =>
        Number(lot.remaining_quantity) > 0 &&
        !(lot.expiry_date && lot.expiry_date < current),
    );
  }, [lots]);

  const lotGroups = useMemo(() => groupLotsByItem(activeLots), [activeLots]);

  const supplierOptions = useMemo(() => {
    const names = new Set(activeLots.map(lotSupplier));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [activeLots]);

  const supplierLots = useMemo(
    () =>
      supplierFilter
        ? activeLots.filter((lot) => lotSupplier(lot) === supplierFilter)
        : activeLots,
    [activeLots, supplierFilter],
  );

  const visibleLotGroups = useMemo(
    () =>
      !inventoryQuery.trim()
        ? lotGroups
        : lotGroups.filter(
            (group) =>
              matchesQuery(group.itemName, group.category, inventoryQuery) ||
              group.lots.some((lot) =>
                matchesQuery(lot.voucher_number, lotSupplier(lot), inventoryQuery),
              ),
          ),
    [lotGroups, inventoryQuery],
  );

  const visibleSupplierLots = useMemo(
    () =>
      !supplierQuery.trim()
        ? supplierLots
        : supplierLots.filter((lot) =>
            matchesQuery(
              supplierQuery,
              lot.item_name,
              lot.category,
              lot.voucher_number,
              lot.supplier_name,
            ),
          ),
    [supplierLots, supplierQuery],
  );

  const visibleRegistrations = useMemo(
    () => registrations.filter((doc) => registrationMatches(doc, registrationQuery)),
    [registrations, registrationQuery],
  );

  const visibleStockouts = useMemo(
    () => stockouts.filter((doc) => stockOutMatches(doc, movementQuery)),
    [stockouts, movementQuery],
  );

  const visibleApprovedStockOuts = useMemo(
    () => approvedStockOuts.filter((doc) => stockOutMatches(doc, inactiveQuery)),
    [approvedStockOuts, inactiveQuery],
  );

  const visibleReceiptRegistrations = useMemo(
    () =>
      registrations.filter(
        (doc) =>
          doc.status === "APPROVED" && registrationMatches(doc, receiptRegQuery),
      ),
    [registrations, receiptRegQuery],
  );

  const visibleReceiptStockOuts = useMemo(
    () =>
      approvedStockOuts.filter((doc) => stockOutMatches(doc, receiptStockQuery)),
    [approvedStockOuts, receiptStockQuery],
  );

  const visibleInventoryLots = useMemo(
    () => visibleLotGroups.flatMap((group) => group.lots),
    [visibleLotGroups],
  );

  const checkedLotSet = useMemo(() => new Set(checkedLots), [checkedLots]);
  const allLotsChecked =
    visibleInventoryLots.length > 0 &&
    visibleInventoryLots.every((lot) => checkedLotSet.has(lot.id));
  const someLotsChecked = visibleInventoryLots.some((lot) => checkedLotSet.has(lot.id));
  const selectedLotDocs = activeLots.filter((lot) => checkedLotSet.has(lot.id));

  function toggleCheckedLots(ids: number[], on: boolean) {
    setCheckedLots((current) => {
      if (on) return Array.from(new Set([...current, ...ids]));
      return current.filter((id) => !ids.includes(id));
    });
  }

  function registrationPayload() {
    return {
      ...supplier,
      lines: lines.map(({ image_url: _preview, ...line }) => ({
        ...line,
        vat_rate: line.vat_rate ?? "15.00",
        expiry_date: line.expiry_date || null,
      })),
    };
  }

  function resetRegistrationForm() {
    setLines([emptyLine()]);
    setSupplier(blankSupplier());
  }

  async function saveRegistrationDraft() {
    if (lines.some((line) => !line.item_name.trim())) {
      toast.error("Every line needs an item name.");
      return;
    }
    if (!supplier.supplier_name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    if (!supplier.supplier_address.trim()) {
      toast.error("Supplier address is required.");
      return;
    }
    setBusy(true);
    try {
      const payload = registrationPayload();
      await api.createRegistration(payload);
      toast.success("Draft saved. Review it before sending to Finance.");
      resetRegistrationForm();
      await loadDrafts();
      void load().catch(() => {});
      router.push("/store?view=review");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the draft",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetStockOutForm() {
    setSingleRows([singleRow()]);
    setSelectedLots([]);
    setSame({ quantity: "", changing_amount: "0", change_reason: "", sales_agent: "" });
    setSections([blankAgent()]);
    setStockoutDate(today());
  }

  async function saveStockOutDraft() {
    const assignments = assignmentsForSubmit();
    const problem = validateStockOut(assignments);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const payload = { mode, date: stockoutDate, assignments };
      await api.createStockOut(payload);
      toast.success("Stock out saved as a draft. Review it before sending.");
      resetStockOutForm();
      await loadDrafts();
      void load().catch(() => {});
      router.push("/store?view=review");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the stock out draft",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendDraft(kind: "registration" | "stockout", id: number) {
    setDraftAction(`send-${kind}-${id}`);
    try {
      if (kind === "registration") {
        await api.submitRegistrationDraft(id);
        toast.success("Registration sent to Finance.");
      } else {
        await api.submitStockOutDraft(id);
        toast.success("Stock out sent to Finance.");
      }
      await loadDrafts();
      void load().catch(() => {});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send to Finance",
      );
    } finally {
      setDraftAction(null);
    }
  }

  async function confirmDeleteDraft() {
    if (!deleteDraft) return;
    const target = deleteDraft;
    setDraftAction(`delete-${target.kind}-${target.id}`);
    try {
      if (target.kind === "registration") {
        await api.deleteRegistrationDraft(target.id);
      } else {
        await api.deleteStockOutDraft(target.id);
      }
      toast.success("Draft deleted.");
      setDeleteDraft(null);
      await loadDrafts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the draft",
      );
    } finally {
      setDraftAction(null);
    }
  }

  const allDraftKeys = useMemo(
    () => [
      ...(showReviewRegistrations
        ? draftRegistrations.map((doc) => `registration-${doc.id}`)
        : []),
      ...(showReviewStockOuts
        ? draftStockOuts.map((doc) => `stockout-${doc.id}`)
        : []),
    ],
    [draftRegistrations, draftStockOuts, showReviewRegistrations, showReviewStockOuts],
  );
  const selectedKeys = allDraftKeys.filter((key) => selectedDrafts.includes(key));

  function toggleDraftSelection(key: string) {
    setSelectedDrafts((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );
  }

  function toggleDraftGroup(keys: string[]) {
    if (!keys.length) return;
    const allSelected = keys.every((key) => selectedDrafts.includes(key));
    setSelectedDrafts((current) =>
      allSelected
        ? current.filter((key) => !keys.includes(key))
        : Array.from(new Set([...current, ...keys])),
    );
  }

  async function sendSelectedDrafts() {
    const targets = selectedKeys;
    if (!targets.length) return;
    setDraftsBulkAction("send");
    try {
      for (const key of targets) {
        const [kind, id] = key.split("-");
        if (kind === "registration") {
          await api.submitRegistrationDraft(Number(id));
        } else {
          await api.submitStockOutDraft(Number(id));
        }
      }
      toast.success(
        `${targets.length} draft${targets.length === 1 ? "" : "s"} sent to Finance.`,
      );
      setSelectedDrafts([]);
      await loadDrafts();
      void load().catch(() => {});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send the drafts",
      );
    } finally {
      setDraftsBulkAction(null);
    }
  }

  async function deleteSelectedDrafts() {
    const targets = selectedKeys;
    if (!targets.length) return;
    setDraftsBulkAction("delete");
    try {
      for (const key of targets) {
        const [kind, id] = key.split("-");
        if (kind === "registration") {
          await api.deleteRegistrationDraft(Number(id));
        } else {
          await api.deleteStockOutDraft(Number(id));
        }
      }
      toast.success(
        `${targets.length} draft${targets.length === 1 ? "" : "s"} deleted.`,
      );
      setSelectedDrafts([]);
      setBulkDeleteOpen(false);
      await loadDrafts();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the drafts",
      );
    } finally {
      setDraftsBulkAction(null);
    }
  }

  function assignmentsForSubmit() {
    if (mode === "SINGLE") {
      return singleRows
        .filter((row) => row.lot && Number(row.quantity) > 0)
        .map((row) => ({
          lot: Number(row.lot),
          quantity: row.quantity,
          changing_amount: row.changing_amount || "0",
          change_reason: row.change_reason,
          sales_agent: row.sales_agent ? Number(row.sales_agent) : null,
        }));
    }
    if (batchTab === "SAME") {
      return selectedLots.map((lot) => ({
        lot,
        quantity: same.quantity,
        changing_amount: same.changing_amount || "0",
        change_reason: same.change_reason,
        sales_agent: same.sales_agent ? Number(same.sales_agent) : null,
      }));
    }
    return sections.flatMap((section) =>
      section.items
        .filter((item) => item.lot && Number(item.quantity) > 0)
        .map((item) => ({
          lot: Number(item.lot),
          quantity: item.quantity,
          changing_amount: item.changing_amount || "0",
          change_reason: item.change_reason,
          sales_agent: section.agent ? Number(section.agent) : null,
        })),
    );
  }

  function validateStockOut(assignments: { lot: number; quantity: string }[]) {
    if (!stockoutDate) return "Pick the stock out date.";
    if (!assignments.length) return "Choose an item and a quantity.";
    const perLot = new Map<number, number>();
    for (const row of assignments) {
      perLot.set(row.lot, (perLot.get(row.lot) ?? 0) + Number(row.quantity || 0));
    }
    for (const [lotId, total] of perLot) {
      const lot = lots.find((item) => item.id === lotId);
      if (!lot) return "One of the items is missing.";
      if (total > Number(lot.remaining_quantity)) {
        return `${lot.item_name}: ${qty(total)} exceeds the ${qty(lot.remaining_quantity)} available.`;
      }
    }
    if (mode === "BATCH" && batchTab === "DIFFERENT") {
      const covered = new Set(assignments.map((row) => row.lot));
      const missing = selectedLots.filter((lot) => !covered.has(lot));
      if (missing.length) return "Every checked item must appear in an agent section.";
    }
    return null;
  }

  function receiptBusiness(): ReceiptBusiness {
    return tenantBusiness(tenantInfo, dashboard?.tenant);
  }

  function registrationReceipt(doc: Registration): ReceiptDoc {
    return buildRegistrationReceipt(doc, receiptBusiness());
  }

  function stockOutReceipt(doc: StockOut): ReceiptDoc {
    return buildStockOutReceipt(doc, receiptBusiness());
  }

  const rawTaxRows = useMemo<SummaryTabRow[]>(() => tax?.rows ?? [], [tax]);
  const taxSupplierOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of rawTaxRows) {
      const name = row.supplier_name?.trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [rawTaxRows]);
  const taxFiltersActive =
    Boolean(taxFrom || taxTo) || taxSupplier !== "all" || taxVat !== "all";
  const taxRows = useMemo(
    () =>
      rawTaxRows.filter((row) => {
        const day = row.registration_date ?? "";
        if (taxFrom && day && day < taxFrom) return false;
        if (taxTo && day && day > taxTo) return false;
        if (taxSupplier !== "all" && (row.supplier_name ?? "").trim() !== taxSupplier) {
          return false;
        }
        const inputVat = Number(row.vat_amount || 0);
        if (taxVat === "with" && inputVat <= 0) return false;
        if (taxVat === "without" && inputVat > 0) return false;
        return true;
      }),
    [rawTaxRows, taxFrom, taxTo, taxSupplier, taxVat],
  );
  const taxFilterNote = taxFiltersActive
    ? [
        taxFrom && `from ${taxFrom}`,
        taxTo && `to ${taxTo}`,
        taxSupplier !== "all" && taxSupplier,
        taxVat === "with" && "with VAT",
        taxVat === "without" && "without VAT",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  // The server totals describe the whole slice, so a filtered view re-adds them
  // from the rows actually on screen.
  const taxValueTotals = taxRows.reduce(
    (sum, row) => ({
      registeredValue: sum.registeredValue + Number(row.registered_value),
      inStoreValue: sum.inStoreValue + Number(row.in_store_value),
      stockedOutValue: sum.stockedOutValue + Number(row.stocked_out_value),
      base: sum.base + Number(row.base_value),
      inputVat: sum.inputVat + Number(row.vat_amount),
      outputVat: sum.outputVat + Number(row.output_vat),
      inclusive: sum.inclusive + Number(row.inclusive_amount),
    }),
    {
      registeredValue: 0,
      inStoreValue: 0,
      stockedOutValue: 0,
      base: 0,
      inputVat: 0,
      outputVat: 0,
      inclusive: 0,
    },
  );
  const taxTotals = !tax?.totals
    ? undefined
    : !taxFiltersActive
      ? tax.totals
      : {
          registered_value: String(taxValueTotals.registeredValue),
          in_store_value: String(taxValueTotals.inStoreValue),
          stocked_out_value: String(taxValueTotals.stockedOutValue),
          base_value: String(taxValueTotals.base),
          vat: String(taxValueTotals.inputVat),
          inclusive_amount: String(taxValueTotals.inclusive),
          output_vat: String(taxValueTotals.outputVat),
          total_input_vat: String(taxValueTotals.inputVat),
          total_output_vat: String(taxValueTotals.outputVat),
          net_vat: String(taxValueTotals.outputVat - taxValueTotals.inputVat),
        };
  const sumRows = (pick: (row: SummaryTabRow) => string) =>
    taxRows.reduce((total, row) => total + Number(pick(row) || 0), 0);
  const taxQtyTotals = {
    registered: sumRows((row) => row.registered_qty),
    inStore: sumRows((row) => row.in_store_qty),
    stockedOut: sumRows((row) => row.stocked_out_qty),
    paid: sumRows((row) => row.paid_amount),
  };

  const taxGroups = useMemo(() => groupTaxRows(taxRows), [taxRows]);
  const taxAllItemCount = useMemo(() => groupTaxRows(rawTaxRows).length, [rawTaxRows]);
  const visibleTaxGroups = useMemo(
    () =>
      !taxQuery.trim()
        ? taxGroups
        : taxGroups.filter(
            (group) =>
              matchesQuery(group.itemName, group.category, group.units.join(" "), taxQuery) ||
              group.rows.some((row) => matchesQuery(row.voucher_number, taxQuery)),
          ),
    [taxGroups, taxQuery],
  );
  const taxDetail = taxGroups.find((group) => group.key === taxDetailKey) ?? null;

  const taxTabLabel =
    taxTab === "with_vat" ? "With VAT" : taxTab === "without_vat" ? "Without VAT" : "All lines";
  const taxHeaders = [
    "Voucher",
    "Item",
    "Reg. qty",
    "Reg. value",
    "In store qty",
    "In store value",
    "Stocked out qty",
    "Stocked out value",
    "Unit cost",
    "Paid amount",
    "Base",
    "VAT",
    "Inclusive",
  ];
  const taxMatrix = taxRows.map((row) => [
    row.voucher_number,
    row.item_name,
    Number(row.registered_qty),
    Number(row.registered_value),
    Number(row.in_store_qty),
    Number(row.in_store_value),
    Number(row.stocked_out_qty),
    Number(row.stocked_out_value),
    Number(row.unit_cost),
    Number(row.paid_amount),
    Number(row.base_value),
    Number(row.vat_amount),
    Number(row.inclusive_amount),
  ]);
  const taxExportTotals = taxTotals
    ? ([
        "Totals",
        "",
        taxQtyTotals.registered,
        Number(taxTotals.registered_value),
        taxQtyTotals.inStore,
        Number(taxTotals.in_store_value),
        taxQtyTotals.stockedOut,
        Number(taxTotals.stocked_out_value),
        "",
        taxQtyTotals.paid,
        Number(taxTotals.base_value),
        Number(taxTotals.total_input_vat),
        Number(taxTotals.inclusive_amount),
      ] as (string | number)[])
    : undefined;

  // One table row bundles every voucher that registered the same item, so the
  // per-row PDF prints exactly those vouchers and nothing else.
  function exportItemPdf(group: TaxItemGroup) {
    const rowCells = (row: SummaryTabRow) => [
      row.voucher_number,
      row.item_name,
      Number(row.registered_qty),
      Number(row.registered_value),
      Number(row.in_store_qty),
      Number(row.in_store_value),
      Number(row.stocked_out_qty),
      Number(row.stocked_out_value),
      Number(row.unit_cost),
      Number(row.paid_amount),
      Number(row.base_value),
      Number(row.vat_amount),
      Number(row.inclusive_amount),
    ];
    exportPdf({
      title: `Payment & tax · ${group.itemName}`,
      subtitle: `${dashboard?.tenant.name ?? "Store"} · ${taxTabLabel} · ${group.category} · ${
        group.rows.length
      } voucher${group.rows.length === 1 ? "" : "s"}`,
      headers: taxHeaders,
      rows: group.rows.map(rowCells),
      totals: [
        "Totals",
        group.itemName,
        group.registeredQty,
        group.registeredValue,
        group.inStoreQty,
        group.inStoreValue,
        group.stockedOutQty,
        group.stockedOutValue,
        "",
        group.rows.reduce((sum, row) => sum + Number(row.paid_amount), 0),
        group.baseValue,
        group.vatAmount,
        group.inclusiveAmount,
      ],
      file: `volosync-tax-${(group.itemName || "item")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`,
      business: receiptBusiness(),
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Store workspace"
        title="Item registration & stock control"
        description="Register vouchers, hand stock to sales agents and follow every document through Finance and Manager approval."
        stats={
          <>
            <StatCard
              label="In store"
              value={money(summary?.totals.in_store_value ?? 0)}
              hint="Remaining quantity at cost"
              tone="sky"
              icon={<Boxes className="size-4" />}
            />
            <StatCard
              label="Stocked out"
              value={money(summary?.totals.stocked_out_value ?? 0)}
              hint="Handed to sales agents"
              tone="violet"
              icon={<PackagePlus className="size-4" />}
            />
          </>
        }
      />

      {view === "register" && (
        <Panel
          title="New registration"
          description="Add each item as its own line, then fill the shared supplier details once at the bottom. The draft is saved here and waits in Review until you send it to Finance."
          className="mx-auto max-w-5xl"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveRegistrationDraft();
            }}
            className="space-y-5"
            noValidate
          >
            <div className="space-y-4">
              {lines.map((line, index) => {
                const rate = lineVatRate(line);
                const vatOn = rate > 0;
                const uploading = uploadingLine === index;
                return (
                  <section
                    key={index}
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.02] to-transparent p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-400/60 via-sky-400/35 to-transparent" />
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 font-mono text-[11px] font-semibold text-emerald-200">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {line.item_name.trim() || "Untitled item"}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {money(lineTotal(line))} paid ·{" "}
                            {vatOn ? `VAT ${rate}%` : "No VAT"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={lines.length <= 1}
                        onClick={() =>
                          setLines((current) => current.filter((_, i) => i !== index))
                        }
                        aria-label="Remove line"
                        className="size-8 shrink-0 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                      <Field label="Item name" required className="sm:col-span-2 lg:col-span-6">
                        <Input
                          value={line.item_name}
                          onChange={(event) =>
                            updateLine(index, "item_name", event.target.value)
                          }
                          placeholder="e.g. Sunflower cooking oil 5L"
                        />
                      </Field>
                      <Field label="Line note" optional className="sm:col-span-2 lg:col-span-6">
                        <Input
                          value={line.note ?? ""}
                          onChange={(event) => updateLine(index, "note", event.target.value)}
                          placeholder="Batch, colour, size…"
                        />
                      </Field>
                      <Field label="Category" required className="sm:col-span-2 lg:col-span-4">
                        <StoreCombobox
                          value={line.category}
                          onChange={(value) => updateLine(index, "category", value)}
                          options={REGISTRATION_CATEGORIES}
                          placeholder="Select category"
                        />
                      </Field>
                      <Field label="Unit" required className="lg:col-span-2">
                        <StoreCombobox
                          value={line.unit}
                          onChange={(value) => updateLine(index, "unit", value)}
                          options={REGISTRATION_UNITS}
                          placeholder="Select unit"
                        />
                      </Field>
                      <Field label="Quantity" required className="lg:col-span-2">
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          className="tabular-nums"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(index, "quantity", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Unit cost" required className="lg:col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="tabular-nums"
                          value={line.unit_cost}
                          onChange={(event) =>
                            updateLine(index, "unit_cost", event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Unit sales price"
                        required
                        className="sm:col-span-2 lg:col-span-2"
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="tabular-nums"
                          value={line.unit_sales}
                          onChange={(event) =>
                            updateLine(index, "unit_sales", event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Registration date"
                        required
                        className="sm:col-span-1 lg:col-span-4"
                      >
                        <StoreDatePicker
                          value={line.registration_date}
                          onChange={(value) => updateLine(index, "registration_date", value)}
                          placeholder="Pick date"
                        />
                      </Field>
                      <Field label="Expiry date" optional className="sm:col-span-1 lg:col-span-4">
                        <StoreDatePicker
                          value={line.expiry_date ?? ""}
                          onChange={(value) => updateLine(index, "expiry_date", value)}
                          placeholder="No expiry"
                          clearable
                        />
                      </Field>
                      <Field label="Item image" optional className="sm:col-span-2 lg:col-span-4">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`line-image-${index}`}
                            className={cn(
                              "inline-flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 truncate rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 text-xs font-medium text-zinc-400 transition hover:border-emerald-400/40 hover:bg-emerald-400/5 hover:text-emerald-200",
                              uploading && "pointer-events-none opacity-60",
                            )}
                          >
                            {uploading ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin" />
                            ) : (
                              <ImagePlus className="size-3.5 shrink-0" />
                            )}
                            <span className="truncate">
                              {uploading
                                ? "Uploading…"
                                : line.image_url
                                  ? "Change image"
                                  : "Upload image"}
                            </span>
                          </label>
                          {line.image_url ? (
                            <span className="group relative size-9 shrink-0 overflow-hidden rounded-lg border border-white/10">
                              <img
                                src={line.image_url}
                                alt=""
                                className="size-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setLines((current) =>
                                    current.map((row, i) =>
                                      i === index
                                        ? { ...row, image: null, image_url: null }
                                        : row,
                                    ),
                                  )
                                }
                                aria-label="Remove image"
                                className="absolute inset-0 grid place-items-center bg-black/70 text-rose-300 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </span>
                          ) : null}
                          <input
                            id={`line-image-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void uploadLineImage(index, file, event.currentTarget);
                            }}
                          />
                        </div>
                      </Field>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`line-vat-${index}`}
                          checked={vatOn}
                          onCheckedChange={(checked) =>
                            updateLine(index, "vat_rate", checked ? "15.00" : "0.00")
                          }
                        />
                        <div>
                          <Label
                            htmlFor={`line-vat-${index}`}
                            className="cursor-pointer text-xs font-medium text-zinc-200"
                          >
                            Price includes VAT
                          </Label>
                          <p className="text-[10px] text-zinc-500">
                            {vatOn
                              ? "15% VAT is added to the purchase cost."
                              : "No VAT is added to this line."}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-5 sm:justify-end">
                        <div className="text-right">
                          <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                            Selling price
                          </p>
                          <p className="text-sm font-semibold text-emerald-300 tabular-nums">
                            {money(lineSalePrice(line))}
                          </p>
                        </div>
                        <span className="h-8 w-px bg-white/10" />
                        <div className="text-right">
                          <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                            Paid amount
                          </p>
                          <p className="text-sm font-semibold text-amber-300 tabular-nums">
                            {money(lineTotal(line))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setLines((current) => [...current, emptyLine()])}
              className="h-10 w-full gap-2 border-dashed border-white/15 bg-white/[0.02] text-zinc-300 hover:border-emerald-400/40 hover:bg-emerald-400/5 hover:text-emerald-200"
            >
              <Plus className="size-4" /> Add another line
            </Button>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <div className="flex items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-sky-200">
                  <Truck className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">Supplier</h3>
                  <p className="text-xs text-zinc-500">
                    Shared across every line. Name and address are required — phone and TIN are
                    optional.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Supplier name" required>
                  <Input
                    value={supplier.supplier_name}
                    onChange={(event) =>
                      setSupplier({ ...supplier, supplier_name: event.target.value })
                    }
                    placeholder="Highland Mills"
                  />
                </Field>
                <Field label="Supplier phone" optional>
                  <PhoneField
                    value={supplier.supplier_phone}
                    onChange={(supplier_phone) =>
                      setSupplier((current) => ({ ...current, supplier_phone }))
                    }
                  />
                </Field>
                <Field label="Supplier address" required>
                  <Input
                    value={supplier.supplier_address}
                    onChange={(event) =>
                      setSupplier({ ...supplier, supplier_address: event.target.value })
                    }
                    placeholder="Physical address"
                  />
                </Field>
                <Field label="Supplier TIN" optional>
                  <Input
                    value={supplier.supplier_tin}
                    onChange={(event) =>
                      setSupplier({ ...supplier, supplier_tin: event.target.value })
                    }
                    placeholder="Tax identification number"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Overall note" optional>
                  <Textarea
                    value={supplier.note}
                    onChange={(event) => setSupplier({ ...supplier, note: event.target.value })}
                    placeholder="Delivery window, invoice reference, internal note for Finance and the Manager…"
                    className="min-h-24"
                  />
                </Field>
              </div>
            </section>

            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-400/[0.08] via-white/[0.02] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-zinc-400">
                <span>
                  <strong className="text-zinc-100">{lines.length}</strong> line
                  {lines.length === 1 ? "" : "s"}
                </span>
                <span>
                  <strong className="text-zinc-100">{qty(totals.quantity)}</strong> units
                </span>
                <span className="truncate">
                  Supplier{" "}
                  <strong className="text-zinc-100">
                    {supplier.supplier_name.trim() || "—"}
                  </strong>
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                    Total paid
                  </p>
                  <p className="font-heading text-xl leading-none font-semibold text-white tabular-nums">
                    {money(totals.paid)}
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-10 gap-2 bg-emerald-500 px-5 text-zinc-950 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.7)] hover:bg-emerald-400"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      Save draft &amp; review
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5 text-[11px] text-zinc-500 sm:grid-cols-2">
              <p>· The draft is saved to your account and waits in Review.</p>
              <p>· Nothing reaches Finance until you confirm on the Review page.</p>
              <p>· Stock becomes usable only after Manager approval.</p>
              <p>· Each line becomes its own voucher lot on approval.</p>
            </div>
          </form>
        </Panel>
      )}

      {(view === "review" ||
        view === "review-registration" ||
        view === "review-stock") && (
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.1] via-white/[0.02] to-transparent p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-300/70 via-orange-300/30 to-transparent" />
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200">
                <ClipboardCheck className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Review before sending</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  These drafts are saved to your account — nothing reaches Finance until you
                  press Send to Finance. Edit a draft, delete it, or send it from here.
                </p>
              </div>
              <span className="hidden shrink-0 sm:block">
                <StatusPill status="Draft" tone="amber" />
              </span>
            </div>
          </div>

          {draftsLoading && !draftRegistrations.length && !draftStockOuts.length ? (
            <Panel title="Saved drafts" description="Loading your drafts…">
              <ListSkeleton rows={2} />
            </Panel>
          ) : !allDraftKeys.length ? (
            <Panel
              title="Review before send"
              description={
                view === "review-registration"
                  ? "Item registration drafts you save appear here."
                  : view === "review-stock"
                    ? "Stock movement drafts you save appear here."
                    : "Registrations and stock outs you save appear here."
              }
            >
              <EmptyRow>
                <ClipboardCheck className="mx-auto mb-3 size-9 text-zinc-600" />
                <p className="font-medium text-zinc-300">Nothing waiting for your review</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
                  Save a registration or stock out and it waits here as a draft, even after
                  you sign out. Send it to Finance only when you are sure.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    onClick={() => router.push("/store?view=register")}
                    className="h-9 gap-2 bg-emerald-500 px-4 text-zinc-950 hover:bg-emerald-400"
                  >
                    Start a registration
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/store?view=stockout")}
                    className="h-9 gap-2 border-white/15 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
                  >
                    Start a stock out
                  </Button>
                </div>
              </EmptyRow>
            </Panel>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-zinc-300">
                  <Checkbox
                    checked={
                      allDraftKeys.length > 0 &&
                      allDraftKeys.every((key) => selectedDrafts.includes(key))
                    }
                    onCheckedChange={() => toggleDraftGroup(allDraftKeys)}
                    aria-label="Select all drafts"
                    className="border-white/25 data-checked:border-emerald-400 data-checked:bg-emerald-500 data-checked:text-zinc-950"
                  />
                  Select all drafts
                  <span className="text-[11px] text-zinc-500">
                    {selectedKeys.length} of {allDraftKeys.length} selected
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedKeys.length || draftsBulkAction !== null}
                    onClick={() => void sendSelectedDrafts()}
                    className="h-8 gap-1.5 bg-emerald-500 text-xs text-zinc-950 hover:bg-emerald-400"
                  >
                    {draftsBulkAction === "send" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="size-3.5" />
                    )}
                    Send selected to Finance
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedKeys.length || draftsBulkAction !== null}
                    onClick={() => setBulkDeleteOpen(true)}
                    className="h-8 gap-1.5 border-rose-400/30 bg-rose-400/[0.06] text-xs text-rose-200 hover:bg-rose-400/15"
                  >
                    <Trash2 className="size-3.5" />
                    Delete selected
                  </Button>
                  {selectedKeys.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={draftsBulkAction !== null}
                      onClick={() => setSelectedDrafts([])}
                      className="h-8 text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              {showReviewRegistrations && draftRegistrations.length ? (
                <Panel
                  title="Item registration drafts"
                  description="Saved registrations waiting for your confirmation."
                  actions={
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
                        <Checkbox
                          checked={draftRegistrations.every((doc) =>
                            selectedDrafts.includes(`registration-${doc.id}`),
                          )}
                          onCheckedChange={() =>
                            toggleDraftGroup(
                              draftRegistrations.map((doc) => `registration-${doc.id}`),
                            )
                          }
                          aria-label="Select all registration drafts"
                          className="border-white/25 data-checked:border-emerald-400 data-checked:bg-emerald-500 data-checked:text-zinc-950"
                        />
                        Select all
                      </label>
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-200">
                        {draftRegistrations.length} draft
                        {draftRegistrations.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    {draftRegistrations.map((doc) => (
                      <RegistrationDraftCard
                        key={doc.id}
                        doc={doc}
                        selected={selectedDrafts.includes(`registration-${doc.id}`)}
                        onSelect={() => toggleDraftSelection(`registration-${doc.id}`)}
                        pending={
                          draftAction === `send-registration-${doc.id}` ||
                          draftAction === `delete-registration-${doc.id}`
                        }
                        onEdit={() => setEditDraft({ kind: "registration", doc })}
                        onSend={() => void sendDraft("registration", doc.id)}
                        onDelete={() =>
                          setDeleteDraft({
                            kind: "registration",
                            id: doc.id,
                            voucher: doc.voucher_number,
                          })
                        }
                      />
                    ))}
                  </div>
                </Panel>
              ) : null}

              {showReviewStockOuts && draftStockOuts.length ? (
                <Panel
                  title="Stock out drafts"
                  description="Saved stock movements waiting for your confirmation."
                  actions={
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
                        <Checkbox
                          checked={draftStockOuts.every((doc) =>
                            selectedDrafts.includes(`stockout-${doc.id}`),
                          )}
                          onCheckedChange={() =>
                            toggleDraftGroup(
                              draftStockOuts.map((doc) => `stockout-${doc.id}`),
                            )
                          }
                          aria-label="Select all stock out drafts"
                          className="border-white/25 data-checked:border-emerald-400 data-checked:bg-emerald-500 data-checked:text-zinc-950"
                        />
                        Select all
                      </label>
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-200">
                        {draftStockOuts.length} draft
                        {draftStockOuts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    {draftStockOuts.map((doc) => (
                      <StockOutDraftCard
                        key={doc.id}
                        doc={doc}
                        selected={selectedDrafts.includes(`stockout-${doc.id}`)}
                        onSelect={() => toggleDraftSelection(`stockout-${doc.id}`)}
                        pending={
                          draftAction === `send-stockout-${doc.id}` ||
                          draftAction === `delete-stockout-${doc.id}`
                        }
                        onEdit={() => setEditDraft({ kind: "stockout", doc })}
                        onSend={() => void sendDraft("stockout", doc.id)}
                        onDelete={() =>
                          setDeleteDraft({
                            kind: "stockout",
                            id: doc.id,
                            voucher: doc.voucher_number,
                          })
                        }
                      />
                    ))}
                  </div>
                </Panel>
              ) : null}
            </>
          )}

          <AlertDialog
            open={Boolean(deleteDraft)}
            onOpenChange={(open) => {
              if (!open) setDeleteDraft(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteDraft?.voucher} will be removed permanently. Nothing has been sent
                  to Finance yet, so no approval trail is affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep draft</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void confirmDeleteDraft()}
                  className="bg-rose-600 text-white hover:bg-rose-500"
                >
                  Delete draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {selectedKeys.length} selected draft
                  {selectedKeys.length === 1 ? "" : "s"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedKeys.length} saved draft
                  {selectedKeys.length === 1 ? "" : "s"} will be removed permanently.
                  Nothing has been sent to Finance yet, so no approval trail is affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep drafts</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void deleteSelectedDrafts()}
                  className="bg-rose-600 text-white hover:bg-rose-500"
                >
                  Delete drafts
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {editDraft?.kind === "registration" ? (
            <RegistrationEditDialog
              key={`registration-${editDraft.doc.id}`}
              doc={editDraft.doc}
              open
              onOpenChange={(open) => {
                if (!open) setEditDraft(null);
              }}
              onSaved={loadDrafts}
            />
          ) : editDraft?.kind === "stockout" ? (
            <StockOutEditDialog
              key={`stockout-${editDraft.doc.id}`}
              doc={editDraft.doc}
              agents={agents}
              open
              onOpenChange={(open) => {
                if (!open) setEditDraft(null);
              }}
              onSaved={loadDrafts}
            />
          ) : null}
        </div>
      )}


      {view === "inventory" && (
        <Panel
          title="Inventory"
          description="Stock in hand per item. Check batches to stock out together, or use a batch's menu for a single stock out."
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <TableSearch
              value={inventoryQuery}
              onChange={setInventoryQuery}
              placeholder="Search item, category or voucher"
              className="w-64 sm:w-72"
            />
            <span className="text-xs text-zinc-500">
              {visibleLotGroups.length} item{visibleLotGroups.length === 1 ? "" : "s"} shown
            </span>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <Checkbox
                checked={
                  allLotsChecked ? true : someLotsChecked ? "indeterminate" : false
                }
                onCheckedChange={(value) =>
                  setCheckedLots(
                    value === true ? visibleInventoryLots.map((lot) => lot.id) : [],
                  )
                }
                aria-label="Select all batches"
              />
              Select all
            </label>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-xs text-zinc-500">
                {selectedLotDocs.length} selected
              </span>
              <Button
                size="sm"
                disabled={!selectedLotDocs.length}
                onClick={() =>
                  setStockOutRequest({ mode: "BATCH", lots: selectedLotDocs })
                }
              >
                <PackageSearch className="size-3.5" /> Stock out selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!checkedLots.length}
                onClick={() => setCheckedLots([])}
              >
                Clear
              </Button>
            </div>
          </div>
          <GroupedLotTable
            groups={visibleLotGroups}
            loading={loading}
            selectable
            checked={checkedLots}
            onCheck={toggleCheckedLots}
            onStockOut={(lot) =>
              setStockOutRequest({ mode: "SINGLE", lots: [lot] })
            }
          />
          {!loading && !visibleLotGroups.length && (
            <EmptyRow>
              {inventoryQuery.trim()
                ? `No stock matches “${inventoryQuery.trim()}”.`
                : "No stock in hand."}
            </EmptyRow>
          )}
        </Panel>
      )}

      {view === "inactive" && (
        <Panel
          title="Inactive stock"
          description="Approved stock outs — batches already released from the store."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TableSearch
                value={inactiveQuery}
                onChange={setInactiveQuery}
                placeholder="Search voucher, item or agent"
                className="w-56"
              />
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-zinc-400">
                {approvedStockOuts.length} approved
              </span>
            </div>
          }
        >
          {loading && !stockouts.length ? (
            <ListSkeleton rows={3} />
          ) : visibleApprovedStockOuts.length ? (
            <div className="space-y-3">
              {visibleApprovedStockOuts.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Archive className="size-3.5 text-zinc-500" />
                      <p className="font-mono text-xs text-emerald-300">{doc.voucher_number}</p>
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                        Approved
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                        {doc.mode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>{doc.date}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-white/15 bg-transparent text-[11px]"
                        onClick={() => printReceipts([stockOutReceipt(doc)])}
                      >
                        <Printer className="size-3.5" /> Receipt
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 divide-y divide-white/5 rounded-lg border border-white/5 bg-white/[0.01]">
                    {doc.assignments.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                      >
                        <span className="text-zinc-200">
                          {row.item_name}{" "}
                          <span className="font-mono text-[10px] text-zinc-500">
                            {row.voucher_number}
                          </span>
                        </span>
                        <span className="text-zinc-400">
                          {qty(row.quantity)} · {row.agent_name || "unassigned"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRow>
              <Archive className="mx-auto mb-3 size-9 text-zinc-600" />
              <p className="font-medium text-zinc-300">
                {inactiveQuery.trim()
                  ? `No approved stock outs match “${inactiveQuery.trim()}”`
                  : "No approved stock outs yet"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
                {inactiveQuery.trim()
                  ? "Clear the search to see every released batch."
                  : "Once Finance and the Manager approve a stock out, its batches move here and leave Inventory."}
              </p>
            </EmptyRow>
          )}
        </Panel>
      )}

      {view === "suppliers" && (
        <Panel
          title="Suppliers"
          description="Inventory in hand, listed per batch. Filter to one supplier to see what they brought in."
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TableSearch
              value={supplierQuery}
              onChange={setSupplierQuery}
              placeholder="Search item, voucher or supplier"
              className="w-56 sm:w-64"
            />
            <div className="w-56">
              <StoreCombobox
                value={supplierFilter || "All suppliers"}
                onChange={(value) =>
                  setSupplierFilter(value === "All suppliers" ? "" : value)
                }
                options={["All suppliers", ...supplierOptions]}
                placeholder="All suppliers"
              />
            </div>
          </div>
          <LotTable lots={visibleSupplierLots} loading={loading} />
          {!loading && !visibleSupplierLots.length && (
            <EmptyRow>
              {supplierQuery.trim()
                ? `No stock matches “${supplierQuery.trim()}”.`
                : supplierFilter
                  ? `No stock in hand from ${supplierFilter}.`
                  : "No inventory recorded yet."}
            </EmptyRow>
          )}
        </Panel>
      )}

      {stockOutRequest ? (
        <QuickStockOutDialog
          key={`${stockOutRequest.mode}-${stockOutRequest.lots
            .map((lot) => lot.id)
            .join("-")}`}
          mode={stockOutRequest.mode}
          lots={stockOutRequest.lots}
          available={activeLots}
          agents={agents}
          open
          onOpenChange={(open) => {
            if (!open) setStockOutRequest(null);
          }}
          onSaved={() => {
            setStockOutRequest(null);
            setCheckedLots([]);
            void load().catch(() => {});
            void loadDrafts();
            router.push("/store?view=review");
          }}
        />
      ) : null}

      {view === "stockout" && (
        <Panel
          title="Stock out"
          description="Hand stock to sales agents. Save a draft, review it, then send it to Finance; the Manager approves before inventory moves."
          actions={
            <div className="flex rounded-lg border border-white/10 p-0.5">
              {(["SINGLE", "BATCH"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setMode(option)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    mode === option
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {option === "SINGLE" ? "Single" : "Batch"}
                </button>
              ))}
            </div>
          }
        >
          {mode === "SINGLE" ? (
            <div className="space-y-3">
              <div className="sm:w-52">
                <Field label="Stock out date">
                  <Input
                    type="date"
                    value={stockoutDate}
                    onChange={(event) => setStockoutDate(event.target.value)}
                  />
                </Field>
              </div>
              {singleRows.map((row, index) => {
                const lot = lots.find((item) => item.id === Number(row.lot));
                const sameLotTotal = singleRows
                  .filter((other, i) => i !== index && other.lot === row.lot)
                  .reduce((sum, other) => sum + Number(other.quantity || 0), 0);
                const exhausted =
                  lot && sameLotTotal >= Number(lot.remaining_quantity);
                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-5"
                  >
                    <Field label="Item / voucher">
                      <select
                        value={row.lot}
                        onChange={(event) => {
                          const value = event.target.value;
                          const picked = lots.find((item) => item.id === Number(value));
                          setSingleRows((current) =>
                            current.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    lot: value,
                                    quantity: picked ? picked.remaining_quantity : "",
                                  }
                                : item,
                            ),
                          );
                        }}
                        className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-100"
                      >
                        <option value="">Select…</option>
                        {lots.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_name} · {item.voucher_number} ({qty(item.remaining_quantity)})
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={`Amount${lot ? ` (max ${qty(lot.remaining_quantity)})` : ""}`}>
                      <Input
                        type="number"
                        step="0.001"
                        value={row.quantity}
                        disabled={Boolean(exhausted) && Number(row.quantity) === 0}
                        onChange={(event) => updateSingleRow(index, "quantity", event.target.value)}
                      />
                    </Field>
                    <Field label="Changing amount">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.changing_amount}
                        onChange={(event) =>
                          updateSingleRow(index, "changing_amount", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Reason">
                      <Input
                        value={row.change_reason}
                        onChange={(event) =>
                          updateSingleRow(index, "change_reason", event.target.value)
                        }
                        placeholder="Why the price moves"
                      />
                    </Field>
                    <Field label="Sales agent">
                      <AgentSelect
                        value={row.sales_agent}
                        agents={agents}
                        onChange={(value) => updateSingleRow(index, "sales_agent", value)}
                      />
                    </Field>
                  </div>
                );
              })}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  className="border-white/15 bg-transparent"
                  onClick={() => setSingleRows((current) => [...current, singleRow()])}
                >
                  <Plus className="size-3.5" /> Add config
                </Button>
                <Button onClick={() => void saveStockOutDraft()} disabled={busy}>
                  Save draft &amp; review
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex rounded-lg border border-white/10 p-0.5">
                {(
                  [
                    ["SAME", "Same for all"],
                    ["DIFFERENT", "Different for all"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setBatchTab(key)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                      batchTab === key
                        ? "bg-sky-400/15 text-sky-300"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="sm:w-52">
                <Field label="Stock out date">
                  <Input
                    type="date"
                    value={stockoutDate}
                    onChange={(event) => setStockoutDate(event.target.value)}
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Items in this stock out
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {lots.map((lot) => {
                    const checked = selectedLots.includes(lot.id);
                    return (
                      <label
                        key={lot.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                          checked
                            ? "border-sky-400/40 bg-sky-400/10 text-sky-200"
                            : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedLots((current) =>
                              checked
                                ? current.filter((id) => id !== lot.id)
                                : [...current, lot.id],
                            )
                          }
                          className="size-3.5 accent-sky-400"
                        />
                        <span className="flex-1 truncate">
                          {lot.item_name}
                          <span className="ml-1 text-zinc-500">
                            ({qty(lot.remaining_quantity)})
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {batchTab === "SAME" ? (
                <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-4">
                  <Field label="Amount per item">
                    <Input
                      type="number"
                      step="0.001"
                      value={same.quantity}
                      onChange={(event) => setSame({ ...same, quantity: event.target.value })}
                    />
                  </Field>
                  <Field label="Changing amount">
                    <Input
                      type="number"
                      step="0.01"
                      value={same.changing_amount}
                      onChange={(event) =>
                        setSame({ ...same, changing_amount: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Reason">
                    <Input
                      value={same.change_reason}
                      onChange={(event) =>
                        setSame({ ...same, change_reason: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Sales agent">
                    <AgentSelect
                      value={same.sales_agent}
                      agents={agents}
                      onChange={(value) => setSame({ ...same, sales_agent: value })}
                    />
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((section, sectionIndex) => (
                    <details
                      key={sectionIndex}
                      open
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm text-zinc-200">
                        <span className="inline-flex items-center gap-2">
                          <span className="grid size-6 place-items-center rounded-full bg-violet-400/15 text-[11px] font-bold text-violet-300">
                            {sectionIndex + 1}
                          </span>
                          {agents.find((agent) => agent.id === Number(section.agent))?.name ??
                            "Choose agent"}
                          <span className="text-xs text-zinc-500">
                            {section.items.length} line(s) ·{" "}
                            {qty(section.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0))}{" "}
                            units
                          </span>
                        </span>
                        {sections.length > 1 && (
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              setSections((current) =>
                                current.filter((_, i) => i !== sectionIndex),
                              );
                            }}
                            className="text-xs text-zinc-500 hover:text-rose-300"
                          >
                            Remove section
                          </button>
                        )}
                      </summary>

                      <div className="mt-3 space-y-2">
                        <div className="sm:w-64">
                          <Field label="Sales agent">
                            <AgentSelect
                              value={section.agent}
                              agents={agents}
                              onChange={(value) =>
                                setSections((current) =>
                                  current.map((row, i) =>
                                    i === sectionIndex ? { ...row, agent: value } : row,
                                  ),
                                )
                              }
                            />
                          </Field>
                        </div>
                        {section.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="grid gap-2 sm:grid-cols-4">
                            <Field label="Item">
                              <select
                                value={item.lot}
                                onChange={(event) =>
                                  setSections((current) =>
                                    current.map((row, i) =>
                                      i === sectionIndex
                                        ? {
                                            ...row,
                                            items: row.items.map((line, j) =>
                                              j === itemIndex
                                                ? { ...line, lot: event.target.value }
                                                : line,
                                            ),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                                className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-100"
                              >
                                <option value="">Select…</option>
                                {lots
                                  .filter((lot) => selectedLots.includes(lot.id))
                                  .map((lot) => (
                                    <option key={lot.id} value={lot.id}>
                                      {lot.item_name} ({qty(lot.remaining_quantity)})
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            <Field label="Amount">
                              <Input
                                type="number"
                                step="0.001"
                                value={item.quantity}
                                onChange={(event) =>
                                  setSections((current) =>
                                    current.map((row, i) =>
                                      i === sectionIndex
                                        ? {
                                            ...row,
                                            items: row.items.map((line, j) =>
                                              j === itemIndex
                                                ? { ...line, quantity: event.target.value }
                                                : line,
                                            ),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </Field>
                            <Field label="Changing amount">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.changing_amount}
                                onChange={(event) =>
                                  setSections((current) =>
                                    current.map((row, i) =>
                                      i === sectionIndex
                                        ? {
                                            ...row,
                                            items: row.items.map((line, j) =>
                                              j === itemIndex
                                                ? { ...line, changing_amount: event.target.value }
                                                : line,
                                            ),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </Field>
                            <Field label="Reason">
                              <Input
                                value={item.change_reason}
                                onChange={(event) =>
                                  setSections((current) =>
                                    current.map((row, i) =>
                                      i === sectionIndex
                                        ? {
                                            ...row,
                                            items: row.items.map((line, j) =>
                                              j === itemIndex
                                                ? { ...line, change_reason: event.target.value }
                                                : line,
                                            ),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </Field>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-transparent"
                          onClick={() =>
                            setSections((current) =>
                              current.map((row, i) =>
                                i === sectionIndex
                                  ? {
                                      ...row,
                                      items: [
                                        ...row.items,
                                        { lot: "", quantity: "", changing_amount: "0", change_reason: "" },
                                      ],
                                    }
                                  : row,
                              ),
                            )
                          }
                        >
                          <Plus className="size-3.5" /> Add item
                        </Button>
                      </div>
                    </details>
                  ))}
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      className="border-white/15 bg-transparent"
                      onClick={() => setSections((current) => [...current, blankAgent()])}
                    >
                      <Plus className="size-3.5" /> Add sales agent
                    </Button>
                    <Button onClick={() => void saveStockOutDraft()} disabled={busy}>
                      Save draft &amp; review
                    </Button>
                  </div>
                </div>
              )}

              {batchTab === "SAME" && (
                <div className="flex justify-end">
                  <Button onClick={() => void saveStockOutDraft()} disabled={busy}>
                    Save draft &amp; review
                  </Button>
                </div>
              )}
            </div>
          )}
        </Panel>
      )}

      {view === "requests" && (
        <Panel
          title="Item registrations"
          description="Approval chain: Finance → Manager."
          actions={
            <TableSearch
              value={registrationQuery}
              onChange={setRegistrationQuery}
              placeholder="Search voucher, item, supplier or status"
              className="w-64"
            />
          }
        >
          {loading && !registrations.length ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="space-y-2">
              {visibleRegistrations.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-emerald-300">{doc.voucher_number}</p>
                    <StatusPill status={doc.status} tone={statusTone(doc.status)} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-200">
                    {doc.lines.map((line) => line.item_name).join(", ")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {doc.lines.length} line(s) · {money(doc.total_value)} ·{" "}
                    {doc.supplier_name || "no supplier"}
                  </p>
                </div>
              ))}
              {!visibleRegistrations.length && (
                <EmptyRow>
                  {registrationQuery.trim()
                    ? `No registrations match “${registrationQuery.trim()}”.`
                    : "No registrations yet."}
                </EmptyRow>
              )}
            </div>
          )}
        </Panel>
      )}

      {view === "movements" && (
        <Panel
          title="Stock movements"
          description="Voucher-level stock out documents."
          actions={
            <TableSearch
              value={movementQuery}
              onChange={setMovementQuery}
              placeholder="Search voucher, item, agent or mode"
              className="w-64"
            />
          }
        >
          {loading && !stockouts.length ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="space-y-2">
              {visibleStockouts.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-sky-300">{doc.voucher_number}</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                      {doc.mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={doc.status} tone={statusTone(doc.status)} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/15 bg-transparent"
                      onClick={() => printReceipts([stockOutReceipt(doc)])}
                    >
                      <Printer className="size-3.5" /> Receipt
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-zinc-200">
                  {doc.assignments
                    .map((row) => `${row.item_name} × ${qty(row.quantity)}`)
                    .join(", ")}
                </p>
                <p className="text-xs text-zinc-500">
                  Agents: {doc.assignments.map((row) => row.agent_name || "unassigned").join(", ")}
                </p>
                </div>
              ))}
              {!loading && !visibleStockouts.length && (
                <EmptyRow>
                  {movementQuery.trim()
                    ? `No stock movements match “${movementQuery.trim()}”.`
                    : "No stock movements yet."}
                </EmptyRow>
              )}
            </div>
          )}
        </Panel>
      )}

      {view === "receipts" && (
        <div className="space-y-5">
          <Panel
            title="Item registration receipts"
            description="Printable receipts for approved registrations — Apex footer included."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <TableSearch
                  value={receiptRegQuery}
                  onChange={setReceiptRegQuery}
                  placeholder="Search receipt, item or supplier"
                  className="w-56"
                />
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-zinc-400">
                  {registrations.filter((doc) => doc.status === "APPROVED").length} approved
                </span>
              </div>
            }
          >
            {loading && !registrations.length ? (
              <ListSkeleton rows={3} />
            ) : (
              <div className="space-y-2">
                {visibleReceiptRegistrations.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                    >
                      <div>
                        <p className="font-mono text-xs text-emerald-300">{doc.voucher_number}</p>
                        <p className="text-sm text-zinc-200">
                          {doc.lines.map((line) => line.item_name).join(", ")}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {money(doc.total_value)} · {doc.supplier_name || "no supplier"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/15 bg-transparent"
                        onClick={() => printReceipts([registrationReceipt(doc)])}
                      >
                        <Printer className="size-3.5" /> Print receipt
                      </Button>
                    </div>
                  ))}
                {!visibleReceiptRegistrations.length && (
                  <EmptyRow>
                    {receiptRegQuery.trim()
                      ? `No approved registrations match “${receiptRegQuery.trim()}”.`
                      : "No approved registrations yet."}
                  </EmptyRow>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Stock out receipts"
            description="Printable receipts for approved stock movements handed to sales agents."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <TableSearch
                  value={receiptStockQuery}
                  onChange={setReceiptStockQuery}
                  placeholder="Search receipt, item or agent"
                  className="w-56"
                />
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-zinc-400">
                  {approvedStockOuts.length} approved
                </span>
              </div>
            }
          >
            {loading && !stockouts.length ? (
              <ListSkeleton rows={3} />
            ) : (
              <div className="space-y-2">
                {visibleReceiptStockOuts.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <div>
                      <p className="font-mono text-xs text-sky-300">{doc.voucher_number}</p>
                      <p className="text-sm text-zinc-200">
                        {doc.assignments
                          .map((row) => `${row.item_name} × ${qty(row.quantity)}`)
                          .join(", ")}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {doc.date} ·{" "}
                        {doc.assignments
                          .map((row) => row.agent_name || "unassigned")
                          .join(", ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/15 bg-transparent"
                      onClick={() => printReceipts([stockOutReceipt(doc)])}
                    >
                      <Printer className="size-3.5" /> Print receipt
                    </Button>
                  </div>
                ))}
                {!visibleReceiptStockOuts.length && (
                  <EmptyRow>
                    {receiptStockQuery.trim()
                      ? `No approved stock movements match “${receiptStockQuery.trim()}”.`
                      : "No approved stock movements yet."}
                  </EmptyRow>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      {isTaxView && (
        <Panel
          title={`Payment & tax · ${taxTabLabel}`}
          description="Grouped per item: hover a name for a quick preview, open Detail for the full voucher breakdown. Registered = in store + stocked out; input VAT is paid on purchases and output VAT on the stocked-out portion."
          actions={
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-transparent"
                disabled={taxLoading}
                onClick={() =>
                  exportPdf({
                    title: "Payment & tax",
                    subtitle: `${dashboard?.tenant.name ?? ""} · ${taxTabLabel} · ${taxRows.length} vouchers`,
                    headers: taxHeaders,
                    rows: taxMatrix,
                    file: "volosync-payment-tax",
                    totals: taxExportTotals,
                    business: receiptBusiness(),
                  })
                }
              >
                <FileDown className="size-3.5" /> PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-transparent"
                disabled={taxLoading}
                onClick={() =>
                  exportExcel({
                    title: `Payment & tax · ${taxTabLabel}`,
                    headers: taxHeaders,
                    rows: taxMatrix,
                    totals: taxExportTotals,
                    file: "volosync-payment-tax",
                    sheet: "Payment & tax",
                    business: receiptBusiness(),
                  })
                }
              >
                <FileDown className="size-3.5" /> Excel
              </Button>
            </div>
          }
        >
          <div className="mb-2 flex flex-wrap items-end justify-end gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
            <Field label="From">
              <DateField
                value={taxFrom}
                onChange={setTaxFrom}
                placeholder="Any date"
                clearable
                className="w-36"
              />
            </Field>
            <Field label="To">
              <DateField
                value={taxTo}
                onChange={setTaxTo}
                placeholder="Any date"
                clearable
                className="w-36"
              />
            </Field>
            <Field label="Supplier">
              <div className="w-44">
                <ComboSelect
                  value={taxSupplier}
                  onChange={setTaxSupplier}
                  options={[
                    { value: "all", label: "All suppliers" },
                    ...taxSupplierOptions.map((name) => ({ value: name, label: name })),
                  ]}
                  placeholder="All suppliers"
                />
              </div>
            </Field>
            <Field label="VAT">
              <div className="w-32">
                <ComboSelect
                  value={taxVat}
                  onChange={(value) => setTaxVat(value as "all" | "with" | "without")}
                  options={[
                    { value: "all", label: "Any VAT" },
                    { value: "with", label: "With VAT" },
                    { value: "without", label: "Without VAT" },
                  ]}
                />
              </div>
            </Field>
            {taxFiltersActive && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/15 bg-transparent text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                onClick={() => {
                  setTaxFrom("");
                  setTaxTo("");
                  setTaxSupplier("all");
                  setTaxVat("all");
                  setTaxQuery("");
                }}
              >
                <X className="size-3.5" /> Clear
              </Button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TableSearch
              value={taxQuery}
              onChange={setTaxQuery}
              placeholder="Search item, category or voucher"
              className="w-64 sm:w-72"
            />
            <span className="text-xs text-zinc-500">
              {visibleTaxGroups.length} of {taxAllItemCount} item
              {taxAllItemCount === 1 ? "" : "s"}
              {taxFilterNote && <span className="text-zinc-600"> · {taxFilterNote}</span>}
            </span>
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-md">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <StickyTh>Item</StickyTh>
                  <StickyTh right>Registered</StickyTh>
                  <StickyTh right>VAT</StickyTh>
                  <StickyTh right>Inclusive</StickyTh>
                  <StickyTh right>Actions</StickyTh>
                </tr>
              </thead>
              <tbody>
                {taxLoading && !taxGroups.length ? (
                  <SkeletonRows cols={5} rows={6} />
                ) : (
                  visibleTaxGroups.map((group) => (
                    <tr
                      key={group.key}
                      className="transition-colors hover:bg-white/[0.03]"
                    >
                      <Td>
                        <TaxItemDetailTrigger
                          group={group}
                          onOpenDetail={() => setTaxDetailKey(group.key)}
                        />
                        <p className="mt-0.5 max-w-[18rem] truncate text-[11px] text-violet-300/70">
                          {group.category}
                          {group.units.length > 0 && (
                            <span className="text-zinc-600"> · {group.units.join(" / ")}</span>
                          )}
                        </p>
                      </Td>
                      <Td right>
                        <QtyValueCell
                          tone="registered"
                          quantity={group.registeredQty}
                          value={group.baseValue}
                        />
                      </Td>
                      <Td right className="text-amber-300">{money(group.vatAmount)}</Td>
                      <Td right className="text-emerald-300">
                        {money(group.inclusiveAmount)}
                      </Td>
                      <Td right>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            title={`Export ${group.itemName} to PDF`}
                            className="size-8 border-white/12 bg-transparent p-0 text-cyan-300 hover:bg-white/[0.06]"
                            onClick={() => exportItemPdf(group)}
                          >
                            <FileDown className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/12 bg-transparent text-zinc-300 hover:bg-white/[0.06]"
                            onClick={() => setTaxDetailKey(group.key)}
                          >
                            <Layers3 className="size-3.5" /> Detail
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!taxLoading && !visibleTaxGroups.length && (
            <EmptyRow>
              {taxQuery.trim()
                ? `No items match “${taxQuery.trim()}” in this slice.`
                : taxFiltersActive
                  ? `No voucher matches these filters (${taxFilterNote}).`
                  : "No vouchers in this slice."}
            </EmptyRow>
          )}

          {taxTotals && (
            <div className="mt-4 flex flex-wrap gap-2">
              <TaxTotalPill label="Base value" value={money(taxTotals.base_value)} tone="base" />
              <TaxTotalPill
                label="In store value"
                value={money(taxTotals.in_store_value)}
                tone="inStore"
              />
              <TaxTotalPill
                label="Stocked out value"
                value={money(taxTotals.stocked_out_value)}
                tone="stockedOut"
              />
              <TaxTotalPill
                label="Input VAT"
                value={money(taxTotals.total_input_vat)}
                tone="input"
              />
              <TaxTotalPill
                label="Output VAT"
                value={money(taxTotals.total_output_vat)}
                tone="output"
              />
              <TaxTotalPill label="Net VAT" value={money(taxTotals.net_vat)} tone="net" />
              <TaxTotalPill
                label="Inclusive amount"
                value={money(taxTotals.inclusive_amount)}
                tone="inclusive"
              />
            </div>
          )}

          <Sheet
            open={Boolean(taxDetail)}
            onOpenChange={(open) => {
              if (!open) setTaxDetailKey(null);
            }}
          >
            <SheetContent
              side="right"
              className="w-full! gap-0 overflow-y-auto border-white/10 bg-zinc-950 p-0 sm:max-w-3xl!"
            >
              {taxDetail && (
                <>
                  <SheetHeader className="border-b border-white/10 p-5">
                    <p className="text-[10px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                      {taxDetail.category} · {taxTabLabel}
                    </p>
                    <SheetTitle className="text-lg text-white">
                      {taxDetail.itemName}
                    </SheetTitle>
                    <SheetDescription>
                      {taxDetail.rows.length} voucher line
                      {taxDetail.rows.length === 1 ? "" : "s"}
                      {taxDetail.units.length ? ` · ${taxDetail.units.join(" · ")}` : ""}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="space-y-4 p-5">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <TaxDetailStat
                        label="In store"
                        value={money(taxDetail.inStoreValue)}
                        hint={`${qty(taxDetail.inStoreQty)} units`}
                        tone="inStore"
                      />
                      <TaxDetailStat
                        label="Stocked out"
                        value={money(taxDetail.stockedOutValue)}
                        hint={`${qty(taxDetail.stockedOutQty)} units`}
                        tone="stockedOut"
                      />
                      <TaxDetailStat
                        label="Inclusive"
                        value={money(taxDetail.inclusiveAmount)}
                        hint={`VAT ${money(taxDetail.vatAmount)}`}
                        tone="inclusive"
                      />
                    </div>

                    <div className="overflow-auto rounded-xl border border-white/10">
                      <table className="w-full min-w-[520px]">
                        <thead>
                          <tr>
                            <StickyTh>Voucher</StickyTh>
                            <StickyTh>Supplier</StickyTh>
                            <StickyTh right>Registered</StickyTh>
                            <StickyTh right>VAT</StickyTh>
                            <StickyTh right>Inclusive</StickyTh>
                          </tr>
                        </thead>
                        <tbody>
                          {taxDetail.rows.map((row) => (
                            <tr
                              key={row.id}
                              className="transition-colors hover:bg-white/[0.02]"
                            >
                              <Td className="font-mono text-xs text-emerald-300">
                                {row.voucher_number}
                              </Td>
                              <Td className="text-zinc-200">
                                {row.supplier_name || "—"}
                                <span className="block font-mono text-[11px] text-sky-300/80">
                                  {row.registration_date || "—"}
                                </span>
                              </Td>
                              <Td right>
                                <QtyValueCell
                                  tone="registered"
                                  quantity={row.registered_qty}
                                  value={row.base_value}
                                />
                              </Td>
                              <Td right className="text-amber-300">
                                {money(row.vat_amount)}
                              </Td>
                              <Td right className="text-emerald-300">
                                {money(row.inclusive_amount)}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10 bg-white/[0.03]">
                            <Td className="text-[11px] font-semibold text-zinc-400 uppercase">
                              Item totals
                            </Td>
                            <Td />
                            <Td right>
                              <QtyValueCell
                                tone="registered"
                                quantity={taxDetail.registeredQty}
                                value={taxDetail.baseValue}
                              />
                            </Td>
                            <Td right className="font-semibold text-amber-300">
                              {money(taxDetail.vatAmount)}
                            </Td>
                            <Td right className="font-semibold text-emerald-300">
                              {money(taxDetail.inclusiveAmount)}
                            </Td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <p className="text-[11px] text-zinc-500">
                      Registered = in store + stocked out. Input VAT is paid on the
                      registered purchase; output VAT is charged on the stocked-out
                      portion.
                    </p>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </Panel>
      )}
    </>
  );

  async function uploadLineImage(
    index: number,
    file: File | undefined,
    input?: HTMLInputElement,
  ) {
    if (!file) return;
    setUploadingLine(index);
    try {
      const url = await uploadImageToCloudinary(file, { folder: "volosync/inventory" });
      setLines((current) =>
        current.map((row, i) => (i === index ? { ...row, image: url, image_url: url } : row)),
      );
      toast.success("Image uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingLine((current) => (current === index ? null : current));
      if (input) input.value = "";
    }
  }

  function updateLine(index: number, key: keyof RegistrationLine, value: string) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    );
  }

  function updateSingleRow(index: number, key: string, value: string) {
    setSingleRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }
}

function RegistrationEditDialog({
  doc,
  open,
  onOpenChange,
  onSaved,
}: {
  doc: Registration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [supplier, setSupplier] = useState(() => ({
    supplier_name: doc.supplier_name,
    supplier_phone: doc.supplier_phone,
    supplier_address: doc.supplier_address,
    supplier_tin: doc.supplier_tin,
    note: doc.note,
  }));
  const [lines, setLines] = useState<RegistrationLine[]>(() =>
    doc.lines.map((line) => ({
      item_name: line.item_name,
      category: line.category || REGISTRATION_CATEGORIES[0],
      unit: line.unit || "Piece",
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      unit_sales: line.unit_sales,
      vat_rate: line.vat_rate ?? "15.00",
      registration_date: line.registration_date,
      expiry_date: line.expiry_date ?? "",
      note: line.note ?? "",
      image: line.image ?? null,
    })),
  );
  const [saving, setSaving] = useState(false);

  function updateLine(index: number, key: keyof RegistrationLine, value: string) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    );
  }

  const paid = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  async function save() {
    if (lines.some((line) => !line.item_name.trim())) {
      toast.error("Every line needs an item name.");
      return;
    }
    if (!supplier.supplier_name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    if (!supplier.supplier_address.trim()) {
      toast.error("Supplier address is required.");
      return;
    }
    setSaving(true);
    try {
      await api.updateRegistrationDraft(doc.id, {
        ...supplier,
        lines: lines.map((line) => ({
          ...line,
          vat_rate: line.vat_rate ?? "15.00",
          expiry_date: line.expiry_date || null,
        })),
      });
      toast.success("Draft updated. Review it before sending.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the draft",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit registration draft</DialogTitle>
          <DialogDescription>
            {doc.voucher_number} · {money(paid)} total paid. Changes stay in Review
            until you send them to Finance.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[65vh] space-y-4 overflow-y-auto px-1">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Supplier name" required>
              <Input
                value={supplier.supplier_name}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    supplier_name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Supplier phone" optional>
              <Input
                value={supplier.supplier_phone}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    supplier_phone: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Supplier address" required>
              <Input
                value={supplier.supplier_address}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    supplier_address: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Supplier TIN" optional>
              <Input
                value={supplier.supplier_tin}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    supplier_tin: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Overall note" optional className="sm:col-span-2">
              <Textarea
                value={supplier.note}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Invoice reference, delivery window…"
              />
            </Field>
          </div>

          {lines.map((line, index) => (
            <div
              key={index}
              className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-zinc-300">
                  {line.item_name.trim() || "Untitled item"}
                  <span className="ml-2 text-zinc-500">{money(lineTotal(line))}</span>
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={lines.length <= 1}
                  onClick={() =>
                    setLines((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label="Remove line"
                  className="size-7 shrink-0 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
                <Field label="Item name" required className="lg:col-span-5">
                  <Input
                    value={line.item_name}
                    onChange={(event) =>
                      updateLine(index, "item_name", event.target.value)
                    }
                  />
                </Field>
                <Field label="Category" required className="lg:col-span-4">
                  <StoreCombobox
                    value={line.category}
                    onChange={(value) => updateLine(index, "category", value)}
                    options={REGISTRATION_CATEGORIES}
                  />
                </Field>
                <Field label="Unit" required className="lg:col-span-3">
                  <StoreCombobox
                    value={line.unit}
                    onChange={(value) => updateLine(index, "unit", value)}
                    options={REGISTRATION_UNITS}
                  />
                </Field>
                <Field label="Quantity" required className="lg:col-span-2">
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    className="tabular-nums"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(index, "quantity", event.target.value)
                    }
                  />
                </Field>
                <Field label="Unit cost" required className="lg:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="tabular-nums"
                    value={line.unit_cost}
                    onChange={(event) =>
                      updateLine(index, "unit_cost", event.target.value)
                    }
                  />
                </Field>
                <Field label="Unit sales" required className="lg:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="tabular-nums"
                    value={line.unit_sales}
                    onChange={(event) =>
                      updateLine(index, "unit_sales", event.target.value)
                    }
                  />
                </Field>
                <Field label="Registration date" required className="lg:col-span-3">
                  <StoreDatePicker
                    value={line.registration_date}
                    onChange={(value) =>
                      updateLine(index, "registration_date", value)
                    }
                  />
                </Field>
                <Field label="Expiry date" optional className="lg:col-span-3">
                  <StoreDatePicker
                    value={line.expiry_date ?? ""}
                    onChange={(value) => updateLine(index, "expiry_date", value)}
                    placeholder="No expiry"
                    clearable
                  />
                </Field>
                <Field label="Line note" optional className="lg:col-span-6">
                  <Input
                    value={line.note ?? ""}
                    onChange={(event) => updateLine(index, "note", event.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2 lg:col-span-6">
                  <Switch
                    id={`edit-line-vat-${index}`}
                    checked={lineVatRate(line) > 0}
                    onCheckedChange={(checked) =>
                      updateLine(index, "vat_rate", checked ? "15.00" : "0.00")
                    }
                  />
                  <Label
                    htmlFor={`edit-line-vat-${index}`}
                    className="cursor-pointer text-xs font-medium text-zinc-300"
                  >
                    Price includes VAT
                  </Label>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((current) => [...current, emptyLine()])}
            className="h-9 w-full gap-2 border-dashed border-white/15 bg-white/[0.02] text-xs text-zinc-300 hover:border-emerald-400/40 hover:bg-emerald-400/5 hover:text-emerald-200"
          >
            <Plus className="size-3.5" /> Add another line
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="border-white/15 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockOutEditDialog({
  doc,
  agents,
  open,
  onOpenChange,
  onSaved,
}: {
  doc: StockOut;
  agents: { id: number; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [date, setDate] = useState(doc.date);
  const [rows, setRows] = useState(() =>
    doc.assignments.map((row) => ({
      id: row.id,
      lot: row.lot,
      item_name: row.item_name,
      voucher_number: row.voucher_number,
      quantity: row.quantity,
      changing_amount: row.changing_amount || "0",
      change_reason: row.change_reason || "",
      sales_agent: row.sales_agent ? String(row.sales_agent) : "",
    })),
  );
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, key: "quantity" | "changing_amount" | "change_reason" | "sales_agent", value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  async function save() {
    if (!date) {
      toast.error("Pick the stock out date.");
      return;
    }
    if (rows.some((row) => !Number(row.quantity) || Number(row.quantity) <= 0)) {
      toast.error("Every line needs an amount above zero.");
      return;
    }
    if (
      rows.some(
        (row) => Number(row.changing_amount) !== 0 && !row.change_reason.trim(),
      )
    ) {
      toast.error("Add a reason for every price change.");
      return;
    }
    setSaving(true);
    try {
      await api.updateStockOutDraft(doc.id, {
        mode: doc.mode,
        date,
        assignments: rows.map((row) => ({
          lot: row.lot,
          quantity: row.quantity,
          changing_amount: row.changing_amount || "0",
          change_reason: row.change_reason,
          sales_agent: row.sales_agent ? Number(row.sales_agent) : null,
        })),
      });
      toast.success("Stock out draft updated.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the draft",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit stock out draft</DialogTitle>
          <DialogDescription>
            {doc.voucher_number} · {doc.mode} mode. Changes stay in Review until you
            send them to Finance.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[65vh] space-y-3 overflow-y-auto px-1">
          <div className="sm:w-52">
            <Field label="Stock out date" required>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.id}
              className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-medium text-zinc-200">{row.item_name}</p>
                <span className="font-mono text-[11px] text-zinc-500">
                  {row.voucher_number}
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Amount" required>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    className="tabular-nums"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(index, "quantity", event.target.value)
                    }
                  />
                </Field>
                <Field label="Changing amount">
                  <Input
                    type="number"
                    step="0.01"
                    className="tabular-nums"
                    value={row.changing_amount}
                    onChange={(event) =>
                      updateRow(index, "changing_amount", event.target.value)
                    }
                  />
                </Field>
                <Field label="Sales agent">
                  <AgentSelect
                    value={row.sales_agent}
                    agents={agents}
                    onChange={(value) => updateRow(index, "sales_agent", value)}
                  />
                </Field>
                <Field label="Reason">
                  <Input
                    value={row.change_reason}
                    onChange={(event) =>
                      updateRow(index, "change_reason", event.target.value)
                    }
                    placeholder="Why the price moves"
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="border-white/15 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftActions({
  pending,
  onEdit,
  onSend,
  onDelete,
}: {
  pending: boolean;
  onEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onEdit}
        className="h-8 gap-1.5 border-white/15 bg-white/[0.02] text-xs text-zinc-300 hover:bg-white/[0.06]"
      >
        <Pencil className="size-3.5" />
        Edit
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onDelete}
        className="h-8 gap-1.5 border-rose-400/30 bg-rose-400/[0.06] text-xs text-rose-200 hover:bg-rose-400/15"
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={onSend}
        className="h-8 gap-1.5 bg-emerald-500 text-xs text-zinc-950 hover:bg-emerald-400"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Send to Finance
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}

function RegistrationDraftCard({
  doc,
  pending,
  selected,
  onSelect,
  onEdit,
  onSend,
  onDelete,
}: {
  doc: Registration;
  pending: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const units = doc.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const base = doc.lines.reduce((sum, line) => sum + lineBase(line), 0);
  const paid = doc.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            aria-label={`Select ${doc.voucher_number}`}
            className="mt-0.5 border-white/25 data-checked:border-emerald-400 data-checked:bg-emerald-500 data-checked:text-zinc-950"
          />
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-emerald-300">{doc.voucher_number}</p>
            <StatusPill status="Draft" tone="amber" />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-zinc-100">
            {doc.supplier_name || "No supplier"}
          </p>
          <p className="text-xs text-zinc-500">
            {doc.lines.length} line{doc.lines.length === 1 ? "" : "s"} · {qty(units)} units ·{" "}
            {money(paid)}
          </p>
          </div>
        </div>
        <DraftActions
          pending={pending}
          onEdit={onEdit}
          onSend={onSend}
          onDelete={onDelete}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Category</Th>
              <Th right>Qty</Th>
              <Th right>Unit cost</Th>
              <Th right>Unit sales</Th>
              <Th right>VAT</Th>
              <Th right>Paid</Th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, index) => (
              <tr key={line.id ?? index}>
                <Td>
                  <span className="text-zinc-200">{line.item_name || "—"}</span>
                  <span className="ml-1.5 text-xs text-zinc-500">{line.unit}</span>
                </Td>
                <Td>
                  <span className="text-xs text-zinc-400">{line.category || "—"}</span>
                </Td>
                <Td right>{qty(line.quantity)}</Td>
                <Td right>{money(line.unit_cost)}</Td>
                <Td right>{money(line.unit_sales)}</Td>
                <Td right>{lineVatRate(line)}%</Td>
                <Td right>{money(lineTotal(line))}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-xs text-zinc-500">
        <span>
          Base {money(base)} · VAT {money(paid - base)}
        </span>
        <span className="font-medium text-zinc-300">Total paid {money(paid)}</span>
      </div>
    </div>
  );
}

function StockOutDraftCard({
  doc,
  pending,
  selected,
  onSelect,
  onEdit,
  onSend,
  onDelete,
}: {
  doc: StockOut;
  pending: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const units = doc.assignments.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            aria-label={`Select ${doc.voucher_number}`}
            className="mt-0.5 border-white/25 data-checked:border-emerald-400 data-checked:bg-emerald-500 data-checked:text-zinc-950"
          />
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-sky-300">{doc.voucher_number}</p>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
              {doc.mode}
            </span>
            <StatusPill status="Draft" tone="amber" />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {doc.date} · {doc.assignments.length} line
            {doc.assignments.length === 1 ? "" : "s"} · {qty(units)} units
          </p>
          </div>
        </div>
        <DraftActions
          pending={pending}
          onEdit={onEdit}
          onSend={onSend}
          onDelete={onDelete}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Voucher</Th>
              <Th right>Qty</Th>
              <Th>Agent</Th>
              <Th right>Change</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {doc.assignments.map((row, index) => (
              <tr key={row.id ?? index}>
                <Td>
                  <span className="text-zinc-200">{row.item_name}</span>
                </Td>
                <Td>
                  <span className="font-mono text-xs text-zinc-400">{row.voucher_number}</span>
                </Td>
                <Td right>{qty(row.quantity)}</Td>
                <Td>{row.agent_name || "Unassigned"}</Td>
                <Td right>
                  {Number(row.changing_amount) ? money(row.changing_amount) : "—"}
                </Td>
                <Td>
                  <span className="text-xs text-zinc-400">{row.change_reason || "—"}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className ?? "w-full sm:w-64")}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 rounded-lg border-white/10 bg-white/[0.03] pl-8 text-xs placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:ring-emerald-400/20"
      />
    </div>
  );
}

function LotTable({ lots, loading }: { lots: Lot[]; loading?: boolean }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-md">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr>
            <StickyTh>Voucher</StickyTh>
            <StickyTh>Item</StickyTh>
            <StickyTh right>Quantity</StickyTh>
            <StickyTh right>Unit cost</StickyTh>
            <StickyTh right>Unit sales</StickyTh>
            <StickyTh>Supplier</StickyTh>
          </tr>
        </thead>
        <tbody>
          {loading && !lots.length ? (
            <SkeletonRows cols={6} rows={6} />
          ) : (
            lots.map((lot) => (
              <tr key={lot.id} className="transition-colors hover:bg-white/[0.02]">
                <Td className="font-mono text-xs text-emerald-300">{lot.voucher_number}</Td>
                <Td>
                  {lot.item_name}
                  <span className="ml-2 text-[11px] text-zinc-500">{lot.category}</span>
                </Td>
                <Td right>{qty(lot.remaining_quantity)}</Td>
                <Td right>{money(lot.unit_cost)}</Td>
                <Td right>{money(lot.unit_sales)}</Td>
                <Td className="text-zinc-400">{lot.supplier_name || "—"}</Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupedLotTable({
  groups,
  loading,
  selectable = false,
  checked = [],
  onCheck,
  onStockOut,
}: {
  groups: LotGroup[];
  loading?: boolean;
  selectable?: boolean;
  checked?: number[];
  onCheck?: (ids: number[], on: boolean) => void;
  onStockOut?: (lot: Lot) => void;
}) {
  // Only groups with several batches collapse; a lone batch is a plain row.
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const checkedSet = new Set(checked);

  const toggleGroup = (key: string) =>
    setOpenKeys((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const columns = 4 + (selectable ? 1 : 0) + (onStockOut ? 1 : 0);

  const stockOutMenu = (lot: Lot) =>
    onStockOut ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-zinc-500 hover:bg-white/10 hover:text-white"
            aria-label={`Actions for ${lot.voucher_number}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 border-white/10 bg-zinc-900">
          <DropdownMenuItem
            onSelect={() => onStockOut(lot)}
            className="cursor-pointer"
          >
            <PackageSearch className="size-3.5" /> Stock out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <div className="max-h-[32rem] overflow-auto rounded-md">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr>
            {selectable ? (
              <StickyTh className="w-10">
                <span className="sr-only">Select</span>
              </StickyTh>
            ) : null}
            <StickyTh>Item</StickyTh>
            <StickyTh right>Quantity</StickyTh>
            <StickyTh right>Unit cost</StickyTh>
            <StickyTh right>Unit sales</StickyTh>
            {onStockOut ? (
              <StickyTh className="w-10">
                <span className="sr-only">Actions</span>
              </StickyTh>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {loading && !groups.length ? (
            <SkeletonRows cols={columns} rows={6} />
          ) : (
            groups.map((group) => {
              if (group.lots.length === 1) {
                const lot = group.lots[0];
                return (
                  <tr
                    key={group.key}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                  >
                    {selectable ? (
                      <Td className="w-10">
                        <Checkbox
                          checked={checkedSet.has(lot.id)}
                          onCheckedChange={(value) =>
                            onCheck?.([lot.id], value === true)
                          }
                          aria-label={`Select ${lot.voucher_number}`}
                        />
                      </Td>
                    ) : null}
                    <Td>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">
                          {lot.item_name}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {lot.category}
                        </span>
                        <span className="font-mono text-xs text-emerald-300">
                          {lot.voucher_number}
                        </span>
                      </span>
                    </Td>
                    <Td right>{qty(lot.remaining_quantity)}</Td>
                    <Td right>{money(lot.unit_cost)}</Td>
                    <Td right>{money(lot.unit_sales)}</Td>
                    {onStockOut ? (
                      <Td className="w-10 text-right">{stockOutMenu(lot)}</Td>
                    ) : null}
                  </tr>
                );
              }

              const open = openKeys.includes(group.key);
              const allChecked = group.lots.every((lot) => checkedSet.has(lot.id));
              const someChecked = group.lots.some((lot) => checkedSet.has(lot.id));
              return (
                <Fragment key={group.key}>
                  <tr
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={open}
                    className="cursor-pointer border-b border-white/5 bg-white/[0.03] transition-colors hover:bg-white/[0.05]"
                  >
                    {selectable ? (
                      <Td className="w-10">
                        <span
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex"
                        >
                          <Checkbox
                            checked={
                              allChecked ? true : someChecked ? "indeterminate" : false
                            }
                            onCheckedChange={(value) =>
                              onCheck?.(
                                group.lots.map((lot) => lot.id),
                                value === true,
                              )
                            }
                            aria-label={`Select ${group.itemName}`}
                          />
                        </span>
                      </Td>
                    ) : null}
                    <Td>
                      <span className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-zinc-500" />
                        )}
                        <span className="text-sm font-medium text-zinc-100">
                          {group.itemName}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {group.category}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {group.lots.length} batches
                        </span>
                      </span>
                    </Td>
                    <Td right>{qty(group.quantity)}</Td>
                    <Td right className="text-zinc-600">
                      —
                    </Td>
                    <Td right className="text-zinc-600">
                      —
                    </Td>
                    {onStockOut ? <Td className="w-10">{""}</Td> : null}
                  </tr>
                  {open
                    ? group.lots.map((lot) => (
                        <tr
                          key={lot.id}
                          className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                        >
                          {selectable ? (
                            <Td className="w-10">
                              <Checkbox
                                checked={checkedSet.has(lot.id)}
                                onCheckedChange={(value) =>
                                  onCheck?.([lot.id], value === true)
                                }
                                aria-label={`Select ${lot.voucher_number}`}
                              />
                            </Td>
                          ) : null}
                          <Td>
                            <span className="flex items-center gap-2 pl-6">
                              <span className="font-mono text-xs text-emerald-300">
                                {lot.voucher_number}
                              </span>
                              <span className="text-[11px] text-zinc-600">
                                {lot.unit}
                              </span>
                            </span>
                          </Td>
                          <Td right>{qty(lot.remaining_quantity)}</Td>
                          <Td right>{money(lot.unit_cost)}</Td>
                          <Td right>{money(lot.unit_sales)}</Td>
                          {onStockOut ? (
                            <Td className="w-10 text-right">{stockOutMenu(lot)}</Td>
                          ) : null}
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

type QuickRow = {
  lot: number | "";
  quantity: string;
  changing_amount: string;
  change_reason: string;
  sales_agent: string;
};

const blankStockOutLine = (lot: number | "" = "", quantity = ""): QuickRow => ({
  lot,
  quantity,
  changing_amount: "0",
  change_reason: "",
  sales_agent: "",
});

function StockOutLineFields({
  line,
  agents,
  maxQuantity,
  showAgent,
  onChange,
}: {
  line: QuickRow;
  agents: { id: number; name: string }[];
  maxQuantity?: string;
  showAgent: boolean;
  onChange: (patch: Partial<QuickRow>) => void;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        showAgent ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      <Field label="Amount">
        <Input
          type="number"
          step="0.001"
          min="0"
          max={maxQuantity}
          value={line.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
        />
      </Field>
      <Field label="Changing amount">
        <Input
          type="number"
          step="0.01"
          value={line.changing_amount}
          onChange={(event) => onChange({ changing_amount: event.target.value })}
        />
      </Field>
      <Field label="Reason">
        <Input
          value={line.change_reason}
          onChange={(event) => onChange({ change_reason: event.target.value })}
          placeholder="Why the price moves"
        />
      </Field>
      {showAgent ? (
        <Field label="Sales agent">
          <AgentSelect
            value={line.sales_agent}
            agents={agents}
            onChange={(value) => onChange({ sales_agent: value })}
          />
        </Field>
      ) : null}
    </div>
  );
}

function SingleLotSummary({ lot }: { lot: Lot }) {
  return (
    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{lot.item_name}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {lot.category} · {lot.unit}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          <span>
            Voucher{" "}
            <span className="font-mono text-emerald-300">{lot.voucher_number}</span>
          </span>
          <span>
            In stock{" "}
            <span className="font-medium text-emerald-300">
              {qty(lot.remaining_quantity)}
            </span>
          </span>
          <span>Unit cost {money(lot.unit_cost)}</span>
          <span>Unit sales {money(lot.unit_sales)}</span>
        </div>
      </div>
    </div>
  );
}

function QuickStockOutDialog({
  mode,
  lots,
  available,
  agents,
  open,
  onOpenChange,
  onSaved,
}: {
  mode: "SINGLE" | "BATCH";
  lots: Lot[];
  available: Lot[];
  agents: { id: number; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(today());
  const [batchTab, setBatchTab] = useState<"SAME" | "DIFFERENT">("SAME");
  const [batchAgent, setBatchAgent] = useState("");
  const [singleLines, setSingleLines] = useState<QuickRow[]>(() => [
    blankStockOutLine(lots[0].id, lots[0].remaining_quantity),
  ]);
  const [sameLines, setSameLines] = useState<QuickRow[]>(() =>
    lots.map((lot) => blankStockOutLine(lot.id)),
  );
  const [differentLines, setDifferentLines] = useState<QuickRow[]>(() =>
    lots.map((lot) => blankStockOutLine(lot.id)),
  );
  const [openSections, setOpenSections] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const activeLines =
    mode === "SINGLE"
      ? singleLines
      : batchTab === "SAME"
        ? sameLines
        : differentLines;
  const setActiveLines: React.Dispatch<React.SetStateAction<QuickRow[]>> =
    mode === "SINGLE"
      ? setSingleLines
      : batchTab === "SAME"
        ? setSameLines
        : setDifferentLines;

  function updateLine(index: number, patch: Partial<QuickRow>) {
    setActiveLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine(lot: number | "" = "") {
    setActiveLines((current) => [...current, blankStockOutLine(lot)]);
  }

  function removeLine(index: number) {
    setActiveLines((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    if (!date) {
      toast.error("Pick the stock out date.");
      return;
    }
    if (activeLines.some((line) => line.lot === "" && Number(line.quantity) > 0)) {
      toast.error("Choose an item for every line with an amount.");
      return;
    }
    const assignments = activeLines
      .filter((line) => line.lot !== "" && Number(line.quantity) > 0)
      .map((line) => {
        const agent =
          mode === "BATCH" && batchTab === "SAME" ? batchAgent : line.sales_agent;
        return {
          lot: Number(line.lot),
          quantity: line.quantity,
          changing_amount: line.changing_amount || "0",
          change_reason: line.change_reason,
          sales_agent: agent ? Number(agent) : null,
        };
      });
    if (!assignments.length) {
      toast.error("Enter an amount for at least one item.");
      return;
    }
    // A batch can be split across several lines, so compare the combined
    // amount per item with what is actually in the store.
    const needed = new Map<number, number>();
    for (const row of assignments) {
      needed.set(row.lot, (needed.get(row.lot) ?? 0) + Number(row.quantity));
    }
    for (const [lotId, total] of needed) {
      const lot = available.find((entry) => entry.id === lotId);
      if (lot && total > Number(lot.remaining_quantity)) {
        toast.error(
          `${lot.item_name}: ${qty(total)} exceeds the ${qty(lot.remaining_quantity)} in stock.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      await api.createStockOut({ mode, date, assignments });
      toast.success("Stock out saved as a draft. Review it before sending.");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the stock out draft",
      );
    } finally {
      setSaving(false);
    }
  }

  const toggleSection = (lotId: number, next: boolean) =>
    setOpenSections((current) =>
      next
        ? Array.from(new Set([...current, lotId]))
        : current.filter((id) => id !== lotId),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "BATCH" ? "Batch stock out" : "Single stock out"}
          </DialogTitle>
          <DialogDescription>
            {mode === "BATCH"
              ? `${lots.length} batch${lots.length === 1 ? "" : "es"} selected. Nothing moves until Finance and Manager approve.`
              : `${lots[0].item_name} · ${lots[0].voucher_number} · ${qty(lots[0].remaining_quantity)} in stock`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="sm:w-56">
            <Field label="Stock out date">
              <StoreDatePicker value={date} onChange={setDate} />
            </Field>
          </div>

          {mode === "SINGLE" ? (
            <div className="space-y-3">
              <SingleLotSummary lot={lots[0]} />
              {singleLines.map((line, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                      Config {index + 1}
                    </p>
                    {singleLines.length > 1 ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeLine(index)}
                        aria-label="Remove line"
                        className="size-7 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  <StockOutLineFields
                    line={line}
                    agents={agents}
                    maxQuantity={lots[0].remaining_quantity}
                    showAgent
                    onChange={(patch) => updateLine(index, patch)}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                className="border-white/15 bg-transparent"
                onClick={() => addLine(lots[0].id)}
              >
                <Plus className="size-3.5" /> Add config
              </Button>
            </div>
          ) : (
            <Tabs
              value={batchTab}
              onValueChange={(value) => setBatchTab(value as "SAME" | "DIFFERENT")}
            >
              <TabsList className="mx-auto grid h-11 w-full grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 ring-1 ring-white/5 group-data-horizontal/tabs:h-11 sm:w-[22rem]">
                <TabsTrigger
                  value="SAME"
                  className={cn(
                    "h-9 min-w-0 gap-1.5 rounded-lg border border-transparent px-2 text-[13px] font-medium text-zinc-400 transition-colors sm:px-3.5",
                    "hover:bg-white/[0.04] hover:text-zinc-100",
                    "data-active:border-emerald-400/40 data-active:bg-emerald-400/10 data-active:text-emerald-200",
                    "dark:data-active:border-emerald-400/40 dark:data-active:bg-emerald-400/10 dark:data-active:text-emerald-200",
                    "data-active:shadow-[0_6px_20px_-8px_rgba(52,211,153,0.55)]",
                  )}
                >
                  <Users className="size-3.5" />
                  Same for all
                </TabsTrigger>
                <TabsTrigger
                  value="DIFFERENT"
                  className={cn(
                    "h-9 min-w-0 gap-1.5 rounded-lg border border-transparent px-2 text-[13px] font-medium text-zinc-400 transition-colors sm:px-3.5",
                    "hover:bg-white/[0.04] hover:text-zinc-100",
                    "data-active:border-violet-400/40 data-active:bg-violet-400/10 data-active:text-violet-200",
                    "dark:data-active:border-violet-400/40 dark:data-active:bg-violet-400/10 dark:data-active:text-violet-200",
                    "data-active:shadow-[0_6px_20px_-8px_rgba(167,139,250,0.55)]",
                  )}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Different for all
                </TabsTrigger>
              </TabsList>

              <TabsContent value="SAME" className="space-y-3 pt-2">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-[12px] text-emerald-200/90">
                  <Users className="size-3.5 shrink-0 text-emerald-300" />
                  One sales agent applies to every item in this batch.
                </div>
                <div className="sm:w-64">
                  <Field label="Sales agent">
                    <AgentSelect
                      value={batchAgent}
                      agents={agents}
                      onChange={setBatchAgent}
                    />
                  </Field>
                </div>
                {sameLines.map((line, index) => {
                  const lot =
                    line.lot === ""
                      ? null
                      : available.find((entry) => entry.id === line.lot);
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                          Item {index + 1}
                        </p>
                        {sameLines.length > 1 ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLine(index)}
                            aria-label="Remove line"
                            className="size-7 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="mb-3">
                        <Field label="Item">
                          <ComboSelect
                            value={line.lot === "" ? "" : String(line.lot)}
                            onChange={(value) => {
                              const picked = available.find(
                                (entry) => entry.id === Number(value),
                              );
                              updateLine(index, {
                                lot: Number(value),
                                quantity: picked
                                  ? picked.remaining_quantity
                                  : line.quantity,
                              });
                            }}
                            options={available.map((entry) => ({
                              value: String(entry.id),
                              label: `${entry.item_name} · ${entry.voucher_number} (${qty(entry.remaining_quantity)})`,
                            }))}
                            placeholder="Select an item"
                            searchPlaceholder="Search item or voucher…"
                            emptyText="No item in stock."
                          />
                        </Field>
                      </div>
                      <StockOutLineFields
                        line={line}
                        agents={agents}
                        maxQuantity={lot?.remaining_quantity}
                        showAgent={false}
                        onChange={(patch) => updateLine(index, patch)}
                      />
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="border-white/15 bg-transparent"
                  onClick={() => addLine()}
                >
                  <Plus className="size-3.5" /> Add config
                </Button>
              </TabsContent>

              <TabsContent value="DIFFERENT" className="space-y-2 pt-2">
                <div className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-3 py-2 text-[12px] text-violet-200/90">
                  <SlidersHorizontal className="size-3.5 shrink-0 text-violet-300" />
                  Expand a batch to set its own amount, reason and sales agent.
                </div>
                {lots.map((lot) => {
                  const sectionLines = differentLines
                    .map((line, index) => ({ line, index }))
                    .filter(({ line }) => line.lot === lot.id);
                  const entered = sectionLines.reduce(
                    (sum, { line }) => sum + Number(line.quantity || 0),
                    0,
                  );
                  const full = entered >= Number(lot.remaining_quantity);
                  const open = openSections.includes(lot.id);
                  return (
                    <Collapsible
                      key={lot.id}
                      open={open}
                      onOpenChange={(next) => toggleSection(lot.id, next)}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-violet-400/25 hover:bg-violet-400/[0.05] data-[state=open]:border-violet-400/30 data-[state=open]:bg-violet-400/[0.04]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <ChevronDown
                              className={cn(
                                "size-4 shrink-0 text-zinc-500 transition-transform",
                                !open && "-rotate-90",
                              )}
                            />
                            <span className="truncate text-sm font-medium text-zinc-100">
                              {lot.item_name}
                            </span>
                            <span className="hidden max-w-36 shrink-0 truncate rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline">
                              {lot.category}
                            </span>
                            <span className="shrink-0 font-mono text-xs whitespace-nowrap text-emerald-300">
                              {lot.voucher_number}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[11px] tabular-nums",
                              full ? "text-amber-300" : "text-zinc-500",
                            )}
                          >
                            {qty(entered)} of {qty(lot.remaining_quantity)}
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        {sectionLines.map(({ line, index }) => (
                          <div
                            key={index}
                            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                                Config {index + 1}
                              </p>
                              {sectionLines.length > 1 ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeLine(index)}
                                  aria-label="Remove line"
                                  className="size-7 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                            <StockOutLineFields
                              line={line}
                              agents={agents}
                              maxQuantity={lot.remaining_quantity}
                              showAgent
                              onChange={(patch) => updateLine(index, patch)}
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-transparent"
                          onClick={() => addLine(lot.id)}
                        >
                          <Plus className="size-3.5" /> Add config
                        </Button>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/15 bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save draft &amp; review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Table header that stays pinned while the table body scrolls under it. */
function StickyTh({
  children,
  right,
  className,
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-white/10 bg-zinc-900 px-3 py-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function SkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-3 py-2.5">
              <Skeleton className="h-4 w-full bg-white/5" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <Skeleton className="h-3 w-32 bg-white/5" />
          <Skeleton className="mt-2 h-4 w-2/3 bg-white/5" />
          <Skeleton className="mt-2 h-3 w-1/3 bg-white/5" />
        </div>
      ))}
    </div>
  );
}

type ComboOption = {
  value: string;
  label: string;
};

function ComboSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  emptyText = "Nothing found.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between gap-2 border-white/10 bg-white/[0.03] px-3 font-normal text-zinc-200 hover:bg-white/[0.06]"
        >
          <span
            className={cn(
              "truncate text-left",
              !selected && "text-zinc-500",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) border-white/10 bg-zinc-900 p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AgentSelect({
  value,
  agents,
  onChange,
}: {
  value: string;
  agents: { id: number; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <ComboSelect
      value={value || "none"}
      onChange={(next) => onChange(next === "none" ? "" : next)}
      options={[
        { value: "none", label: "Unassigned" },
        ...agents.map((agent) => ({
          value: String(agent.id),
          label: agent.name,
        })),
      ]}
      searchPlaceholder="Search sales agents…"
      emptyText="No sales agent found."
    />
  );
}

const taxTone = {
  base: "border-white/10 bg-white/[0.03] text-zinc-100",
  inStore: "border-sky-400/25 bg-sky-500/10 text-sky-200",
  stockedOut: "border-violet-400/25 bg-violet-500/10 text-violet-200",
  input: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  output: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  net: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  inclusive: "border-teal-400/25 bg-teal-500/10 text-teal-200",
} as const;

type TaxTone = keyof typeof taxTone;

function TaxTotalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: TaxTone;
}) {
  return (
    <div
      className={cn(
        "min-w-[8.5rem] flex-1 rounded-xl border px-3 py-2",
        taxTone[tone],
      )}
    >
      <p className="text-[9.5px] font-semibold tracking-[0.16em] uppercase opacity-70">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function TaxDetailStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: TaxTone;
}) {
  return (
    <div className={cn("rounded-xl border p-3", taxTone[tone])}>
      <p className="text-[9.5px] font-semibold tracking-[0.18em] uppercase opacity-70">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-semibold">{value}</p>
      <p className="text-[10px] opacity-60">{hint}</p>
    </div>
  );
}

/** Item name with a hover preview; "Open full detail" hands off to the Sheet. */
function TaxItemDetailTrigger({
  group,
  onOpenDetail,
}: {
  group: TaxItemGroup;
  onOpenDetail: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function scheduleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) return;
    openTimer.current = setTimeout(() => setOpen(true), 220);
  }

  function scheduleClose() {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }

  function keepOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={scheduleOpen}
          onBlur={scheduleClose}
          className="group/item flex min-w-0 flex-col text-left"
        >
          <span className="flex items-center gap-1.5 text-sm text-zinc-100 underline-offset-4 group-hover/item:text-emerald-200 group-hover/item:underline">
            {group.itemName}
            <Layers3 className="size-3 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-60" />
          </span>
          <span className="text-[10px] text-zinc-500">
            {group.rows.length} voucher line{group.rows.length === 1 ? "" : "s"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
        className="w-72 border-white/10 bg-zinc-950/95 p-3 shadow-xl backdrop-blur"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{group.itemName}</p>
            <p className="truncate text-[11px] text-zinc-500">{group.category}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">
            {group.units.join(" · ") || "unit"}
          </span>
        </div>

        <div className="mt-3 space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">In store</span>
            <span className="font-medium text-sky-300">
              {qty(group.inStoreQty)} · {money(group.inStoreValue)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Stocked out</span>
            <span className="font-medium text-violet-300">
              {qty(group.stockedOutQty)} · {money(group.stockedOutValue)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Inclusive</span>
            <span className="font-medium text-emerald-300">
              {money(group.inclusiveAmount)}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
          <p className="text-[9.5px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Vouchers
          </p>
          {group.rows.slice(0, 3).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 text-[10px]"
            >
              <span className="font-mono text-emerald-300">{row.voucher_number}</span>
              <span className="text-zinc-400">
                {qty(row.stocked_out_qty)} out · {money(row.inclusive_amount)}
              </span>
            </div>
          ))}
          {group.rows.length > 3 && (
            <p className="text-[10px] text-zinc-500">
              +{group.rows.length - 3} more voucher
              {group.rows.length - 3 === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            setOpen(false);
            onOpenDetail();
          }}
        >
          <Layers3 className="size-3.5" /> Open full detail
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Field({
  label,
  children,
  required,
  optional,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="flex items-center gap-1 text-[11px] tracking-wide text-zinc-400 uppercase">
        {label}
        {required ? <span className="text-rose-400">*</span> : null}
        {optional ? (
          <span className="font-normal tracking-normal text-zinc-600 normal-case">
            (optional)
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

function StoreDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = parsePickerDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 border-white/10 bg-white/[0.03] px-3 text-sm font-normal text-zinc-200 hover:bg-white/[0.06]",
            !date && "text-zinc-500",
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 opacity-60" />
          <span className="truncate">{date ? format(date, "MMM d, yyyy") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-white/10 bg-zinc-900 p-0">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          defaultMonth={date ?? new Date()}
          startMonth={new Date(2020, 0)}
          endMonth={new Date(2035, 11)}
          onSelect={(next) => {
            if (!next) return;
            onChange(format(next, "yyyy-MM-dd"));
            setOpen(false);
          }}
          className="[--cell-size:--spacing(8)]"
        />
        {clearable && date ? (
          <div className="border-t border-white/10 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="h-8 w-full text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-rose-300"
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function StoreCombobox({
  value,
  onChange,
  options,
  placeholder = "Select an option",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between gap-2 border-white/10 bg-white/[0.03] px-3 font-normal text-zinc-200 hover:bg-white/[0.06]"
        >
          <span className={value ? "truncate text-left" : "truncate text-left text-zinc-500"}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) border-white/10 bg-zinc-900 p-0"
      >
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`size-3.5 ${value === option ? "opacity-100" : "opacity-0"}`}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

