"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  assetsApi,
  money,
  promoApi,
  qty,
  salesApi,
  statusTone,
  type Dashboard,
  type Lot,
  type Movement,
  type OpenAssignment,
  type OpenAssignmentItem,
  type Promotion,
  type Registration,
  type StockOut,
  type TenantInfo,
} from "@/lib/api";
import {
  ASSET_CATEGORIES,
  financeApi,
  type ApprovalStamp,
  type FinanceAsset,
  type SettlementRow,
  type SummaryPayload,
  type SummaryTab,
} from "@/lib/api/finance";
import { useView } from "@/lib/use-view";
import {
  printReceipts,
  printSettlementReceipts,
  type ReceiptBusiness,
  type ReceiptDoc,
  type SettlementReceiptDoc,
} from "@/lib/print";
import {
  buildPromotionReceipt,
  buildRegistrationReceipt,
  buildSettlementReceipt,
  buildStockOutReceipt,
  tenantBusiness,
} from "@/lib/receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  PackageMinus,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  EmptyRow,
  Field,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  Td,
} from "@/components/volo/kit";
import { PaymentTaxPanel, TableSearch } from "@/components/volo/payment-tax";
import {
  AgentPerformanceReport,
  CategoryItemReport,
  InventoryReportingCard,
  PenaltyMark,
  PenaltyReport,
  CollectionMethodsReport,
  PromotionReport,
  ReportExportButtons,
  ReportKpiStrip,
  ReportLensBar,
  ReportingRangeBar,
  SalesAgentsCard,
  StockPositionReport,
  type ReportLens,
} from "@/components/volo/reports";
import {
  PAYMENT_METHODS,
  dailySales,
  dayOf,
  inRange,
  reportRange,
  summariseByAgent,
  summariseByCategory,
  summariseByItem,
  ymd,
  type ReportPeriod,
  type SaleLikeRow,
} from "@/lib/reports";
import { FinancePayrollSection } from "@/components/finance/finance-payroll";
import { cn } from "@/lib/utils";
import { groupLotsByItem, matchesQuery } from "@/components/volo/lots";
import { ComboSelect, DateField, PaymentMethodPicker } from "@/components/volo/controls";
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

const today = () => new Date().toISOString().slice(0, 10);
const SETTLEMENT_STATUSES = [
  { value: "PENDING_FINANCE", label: "Pending finance" },
  { value: "PENDING_MANAGER", label: "Pending manager" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const EMPTY_SETTLEMENT_FILTERS = {
  from: "",
  to: "",
  agent: "",
  item: "",
  status: "",
  method: "",
};

type SettlementFilterState = typeof EMPTY_SETTLEMENT_FILTERS;

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : "—");
const fmtDateTime = (iso?: string | null) =>
  iso ? iso.replace("T", " ").slice(0, 16) : "—";
const methodLabel = (value: string) =>
  PAYMENT_METHODS.find((option) => option.value === value)?.label ?? value;
const categoryLabel = (code: string) =>
  ASSET_CATEGORIES.find((option) => option.value === code)?.label ??
  code.toLowerCase();
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const registrationDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

type SaleLine = {
  key: number;
  item: string;
  assignment: string;
  sold_quantity: string;
  method: string;
  penalty: boolean;
  penalty_amount: string;
  penalty_reason: string;
};

function blankSaleLine(key: number): SaleLine {
  return {
    key,
    item: "",
    assignment: "",
    sold_quantity: "",
    method: "TELEBIRR",
    penalty: false,
    penalty_amount: "",
    penalty_reason: "",
  };
}

/** Finance requires both figures whenever a penalty is raised. */
function penaltyLineError(line: SaleLine, expected = 0): string | null {
  if (!line.penalty) return null;
  const value = Number(line.penalty_amount.replace(",", ""));
  if (!Number.isFinite(value) || value <= 0) {
    return "A penalty needs an amount greater than zero.";
  }
  if (value > expected) {
    return "A penalty cannot be more than what this sale should have brought in.";
  }
  if (!line.penalty_reason.trim()) {
    return "A penalty needs a reason.";
  }
  return null;
}

const SALE_LINE_ACCENTS = [
  { bar: "from-emerald-400 to-teal-300", chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  { bar: "from-violet-400 to-fuchsia-300", chip: "border-violet-400/30 bg-violet-400/10 text-violet-200" },
  { bar: "from-sky-400 to-cyan-300", chip: "border-sky-400/30 bg-sky-400/10 text-sky-200" },
];

export default function FinancePage() {
  const [view] = useView("sales");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stockouts, setStockouts] = useState<StockOut[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [openItems, setOpenItems] = useState<OpenAssignmentItem[]>([]);
  const [assignments, setAssignments] = useState<OpenAssignment[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [busy, setBusy] = useState(false);
  const [decidingKey, setDecidingKey] = useState<string | null>(null);
  // "Approve with penalty" dialog — amount and reason are both mandatory.
  const [penaltyTarget, setPenaltyTarget] = useState<SettlementRow | null>(null);
  const [penaltyForm, setPenaltyForm] = useState({ amount: "", reason: "" });
  const [penaltySaving, setPenaltySaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // payment & tax (server-side tab slice)
  const isTaxView = view === "tax" || view === "tax-with" || view === "tax-without";
  const taxTab: SummaryTab =
    view === "tax-with" ? "with_vat" : view === "tax-without" ? "without_vat" : "all";
  const [taxSummary, setTaxSummary] = useState<SummaryPayload | null>(null);
  const [taxLoading, setTaxLoading] = useState(true);

  // inventory report search / expanded batches
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryOpenKeys, setInventoryOpenKeys] = useState<string[]>([]);

  // settlement report filters
  const [settlementFilters, setSettlementFilters] = useState<SettlementFilterState>(
    EMPTY_SETTLEMENT_FILTERS,
  );
  const [settlementFiltering, setSettlementFiltering] = useState(false);
  const [agentList, setAgentList] = useState<{ id: number; name: string }[]>([]);
  const [settlementQuery, setSettlementQuery] = useState("");
  const [queueRegQuery, setQueueRegQuery] = useState("");
  const [queueStockQuery, setQueueStockQuery] = useState("");

  // sales approval form — independent lines posted as one batch
  const nextSaleLineKey = useRef(2);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([blankSaleLine(1)]);

  // promotion form
  const [promoDate, setPromoDate] = useState(today());
  const [promoLines, setPromoLines] = useState([
    { lot: "", quantity: "", changing_amount: "0", change_reason: "" },
  ]);
  const [promoFrom, setPromoFrom] = useState("");
  const [promoTo, setPromoTo] = useState("");
  const [promoReceipts, setPromoReceipts] = useState<Promotion[]>([]);
  const [promoQuery, setPromoQuery] = useState("");

  // receipts
  const [promoReceiptQuery, setPromoReceiptQuery] = useState("");
  const [registrationReceiptQuery, setRegistrationReceiptQuery] = useState("");
  const [stockoutReceiptQuery, setStockoutReceiptQuery] = useState("");

  // reports
  const [recentRegQuery, setRecentRegQuery] = useState("");
  const [recentMovementQuery, setRecentMovementQuery] = useState("");
  const [recentPromoQuery, setRecentPromoQuery] = useState("");

  // Reporting window — the strip under the hero drives every card, chart and
  // export on the reports page. Always built from the unfiltered ledger.
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("monthly");
  const [reportAnchor, setReportAnchor] = useState(() => ymd(new Date()));
  const [reportRows, setReportRows] = useState<SettlementRow[]>([]);
  const [reportLens, setReportLens] = useState<ReportLens>("category");

  // assets
  const [assets, setAssets] = useState<FinanceAsset[]>([]);
  const [assetLoading, setAssetLoading] = useState(true);
  const [assetTab, setAssetTab] = useState<"available" | "assigned" | "all">("all");
  const [assetCategory, setAssetCategory] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assignTarget, setAssignTarget] = useState<FinanceAsset | null>(null);
  const [assigneeName, setAssigneeName] = useState("");
  const [assignReturnDate, setAssignReturnDate] = useState("");

  // keeps the settlement fetch in sync with the filters without stale closures
  const settlementFiltersRef = useRef<SettlementFilterState>(EMPTY_SETTLEMENT_FILTERS);

  const load = useCallback(async () => {
    const [
      dash,
      regs,
      sos,
      lotRows,
      tax,
      open,
      settlementRows,
      ledgerRows,
      promotionRows,
      movementRows,
      agentRows,
      tenant,
    ] = await Promise.all([
      api.dashboard(),
      api.registrations(),
      api.stockouts(),
      api.lots(),
      financeApi.summary("all"),
      salesApi.openAssignments(),
      financeApi.settlements(settlementFiltersRef.current),
      financeApi.settlements(),
      promoApi.list(),
      api.movements(),
      salesApi.agents().catch(() => ({ data: [] })),
      api.tenantMe().catch(() => ({ data: null })),
    ]);
    setDashboard(dash.data);
    setTenantInfo(tenant.data);
    setRegistrations(regs.data);
    setStockouts(sos.data);
    setLots(lotRows.data);
    setSummary(tax.data);
    setOpenItems(open.data.items);
    setAssignments(open.data.assignments);
    setSettlements(settlementRows.data);
    setReportRows(ledgerRows.data);
    setPromotions(promotionRows.data);
    setMovements(movementRows.data);
    setAgentList(agentRows.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      toast.error(errorMessage(error, "Could not load the finance workspace"));
    });
  }, [load]);

  // Payment & tax: totals always follow the server-side slice.
  useEffect(() => {
    if (!isTaxView) return;
    let cancelled = false;
    setTaxLoading(true);
    financeApi
      .summary(taxTab)
      .then((res) => {
        if (!cancelled) setTaxSummary(res.data);
      })
      .catch((error) => toast.error(errorMessage(error, "Could not load the tax slice")))
      .finally(() => {
        if (!cancelled) setTaxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isTaxView, taxTab]);

  // Assets: category / status are server-side filters.
  const fetchAssets = useCallback(async () => {
    setAssetLoading(true);
    try {
      const res = await financeApi.assets({
        category: assetCategory || undefined,
        status: assetTab === "all" ? undefined : assetTab.toUpperCase(),
      });
      setAssets(res.data);
    } catch (error) {
      toast.error(errorMessage(error, "Could not load assets"));
    } finally {
      setAssetLoading(false);
    }
  }, [assetTab, assetCategory]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Promotion receipts re-query as soon as either date changes — no Apply step.
  useEffect(() => {
    if (view !== "promotion-receipts") return;
    let cancelled = false;
    async function loadReceipts() {
      try {
        const rows = await promoApi.list({
          from: promoFrom || undefined,
          to: promoTo || undefined,
        });
        if (!cancelled) setPromoReceipts(rows.data);
      } catch (error) {
        if (!cancelled) {
          toast.error(errorMessage(error, "Could not filter promotions"));
        }
      }
    }
    loadReceipts();
    return () => {
      cancelled = true;
    };
  }, [view, promoFrom, promoTo]);

  const settlementFilterActive = Object.values(settlementFilters).some(Boolean);

  async function reloadSettlements(filters: SettlementFilterState) {
    setSettlementFiltering(true);
    try {
      const res = await financeApi.settlements({
        from: filters.from || undefined,
        to: filters.to || undefined,
        agent_id: filters.agent || undefined,
        item_id: filters.item || undefined,
        status: filters.status || undefined,
        payment_method: filters.method || undefined,
      });
      setSettlements(res.data);
    } catch (error) {
      toast.error(errorMessage(error, "Could not filter settlements"));
    } finally {
      setSettlementFiltering(false);
    }
  }

  function setSettlementFilter(patch: Partial<SettlementFilterState>) {
    const next = { ...settlementFiltersRef.current, ...patch };
    settlementFiltersRef.current = next;
    setSettlementFilters(next);
    reloadSettlements(next);
  }

  function patchSaleLine(key: number, patch: Partial<SaleLine>) {
    setSaleLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addSaleLine() {
    setSaleLines((current) => [
      ...current,
      blankSaleLine(nextSaleLineKey.current++),
    ]);
  }

  function removeSaleLine(key: number) {
    setSaleLines((current) =>
      current.length === 1
        ? [blankSaleLine(nextSaleLineKey.current++)]
        : current.filter((line) => line.key !== key),
    );
  }

  // With the Sales role on, agents raise their own approvals and Finance only
  // verifies them — the manual entry form would collide with their submissions.
  const salesEnabled = Boolean(dashboard?.tenant.sales_role_enabled);

  const lineAgents = (line: SaleLine) =>
    assignments.filter((row) => String(row.lot) === line.item);
  const lineChosen = (line: SaleLine) =>
    assignments.find((row) => String(row.assignment) === line.assignment);
  const lineAmount = (line: SaleLine) => {
    const picked = lineChosen(line);
    return picked ? Number(picked.unit_price) * Number(line.sold_quantity || 0) : 0;
  };
  // A line is ready once an agent is picked and a sold figure is typed. Zero is
  // a real answer — the agent took stock and sold none of it.
  const saleLineFilled = (line: SaleLine) =>
    Boolean(line.assignment) && line.sold_quantity.trim() !== "";
  const readySaleLines = saleLines.filter(saleLineFilled);
  const stagedTotal = readySaleLines.reduce(
    (sum, line) => sum + lineAmount(line),
    0,
  );

  async function submitStaged() {
    if (!readySaleLines.length) {
      toast.error("Add at least one sale line first.");
      return;
    }
    const invalid = saleLines.find((line) => {
      if (!line.assignment && !line.sold_quantity.trim()) return false;
      const picked = lineChosen(line);
      const sold = Number(line.sold_quantity);
      return (
        !picked ||
        line.sold_quantity.trim() === "" ||
        !Number.isFinite(sold) ||
        sold < 0 ||
        sold > Number(picked.assigned_quantity)
      );
    });
    if (invalid) {
      toast.error(
        "Each filled line needs a sales agent and a sold quantity within the assignment.",
      );
      return;
    }
    const duplicate = readySaleLines.find(
      (line, index) =>
        readySaleLines.findIndex((other) => other.assignment === line.assignment) !==
        index,
    );
    if (duplicate) {
      toast.error("Each assignment can appear only once per batch.");
      return;
    }
    const badPenalty = readySaleLines.find(
      (line) => penaltyLineError(line, lineAmount(line)) !== null,
    );
    if (badPenalty) {
      toast.error(penaltyLineError(badPenalty, lineAmount(badPenalty)) ?? "Penalty details are incomplete.");
      return;
    }
    setBusy(true);
    try {
      for (const line of readySaleLines) {
        await salesApi.createSettlement({
          assignment: Number(line.assignment),
          sold_quantity: line.sold_quantity,
          payment_method: line.method,
          sales_amount: lineAmount(line).toFixed(2),
          penalty: line.penalty,
          penalty_amount: line.penalty
            ? Number(line.penalty_amount.replace(",", "")).toFixed(2)
            : undefined,
          penalty_reason: line.penalty ? line.penalty_reason.trim() : undefined,
        });
      }
      toast.success(`${readySaleLines.length} sales line(s) sent for approval.`);
      setSaleLines([blankSaleLine(nextSaleLineKey.current++)]);
      settlementFiltersRef.current = EMPTY_SETTLEMENT_FILTERS;
      setSettlementFilters(EMPTY_SETTLEMENT_FILTERS);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Could not submit sales"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Finance's verdict on one settlement. A penalty is its own dialog because
   * both the amount and the reason are required, and every approval hands the
   * document to the Manager, who releases the remainings back to the store.
   */
  async function settleDecision(id: number, verdict: "approve" | "decline") {
    setDecidingKey(`settlement-${id}-${verdict}`);
    try {
      if (verdict === "decline") {
        await salesApi.decideSettlement(id, "REJECTED");
      } else {
        await salesApi.decideSettlement(id, "APPROVED");
      }
      toast.success(
        verdict === "approve" ? "Verified — sent to the Manager." : "Settlement declined.",
      );
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Decision failed"));
    } finally {
      setDecidingKey(null);
    }
  }

  function openPenaltyDialog(row: SettlementRow) {
    setPenaltyTarget(row);
    setPenaltyForm({ amount: "", reason: "" });
  }

  // Live expected → penalty → collected arithmetic for the verdict dialog.
  const penaltyExpected = Number(penaltyTarget?.expected_amount || 0);
  const penaltyValue = Number(penaltyForm.amount.replace(",", "")) || 0;
  const penaltyOver = penaltyValue > penaltyExpected;
  const penaltyCollected = Math.max(penaltyExpected - penaltyValue, 0);
  const penaltyShare =
    penaltyExpected > 0 ? Math.round((penaltyCollected / penaltyExpected) * 100) : 0;

  async function confirmPenalty() {
    if (!penaltyTarget) return;
    const value = Number(penaltyForm.amount.replace(",", ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("A penalty needs an amount greater than zero.");
      return;
    }
    const expected = Number(penaltyTarget.expected_amount || 0);
    if (value > expected) {
      toast.error(
        `A penalty cannot exceed the ${money(expected)} this sale should have brought in.`,
      );
      return;
    }
    if (!penaltyForm.reason.trim()) {
      toast.error("A penalty needs a reason.");
      return;
    }
    setPenaltySaving(true);
    try {
      await salesApi.decideSettlement(
        penaltyTarget.id,
        "APPROVED",
        "",
        true,
        value.toFixed(2),
        penaltyForm.reason.trim(),
      );
      toast.success("Approved with penalty — sent to the Manager.");
      setPenaltyTarget(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Decision failed"));
    } finally {
      setPenaltySaving(false);
    }
  }

  async function decideRegistration(id: number, decision: "APPROVED" | "REJECTED") {
    setDecidingKey(`registration-${id}-${decision}`);
    try {
      await api.decideRegistration(id, decision);
      toast.success(`Registration ${decision.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Decision failed"));
    } finally {
      setDecidingKey(null);
    }
  }

  async function decideStockOut(id: number, decision: "APPROVED" | "REJECTED") {
    setDecidingKey(`stockout-${id}-${decision}`);
    try {
      await api.decideStockOut(id, decision);
      toast.success(`Stock out ${decision.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Decision failed"));
    } finally {
      setDecidingKey(null);
    }
  }

  async function submitPromotion() {
    const rows = promoLines.filter((line) => line.lot && Number(line.quantity) > 0);
    if (!rows.length) {
      toast.error("Add at least one promotion line.");
      return;
    }
    setBusy(true);
    try {
      await promoApi.create({
        mode: "BATCH",
        date: promoDate,
        lines: rows.map((row) => ({
          lot: Number(row.lot),
          quantity: row.quantity,
          changing_amount: row.changing_amount || "0",
          change_reason: row.change_reason,
        })),
      });
      toast.success("Promotion sent to the Manager.");
      setPromoLines([{ lot: "", quantity: "", changing_amount: "0", change_reason: "" }]);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save promotion"));
    } finally {
      setBusy(false);
    }
  }

  async function assignAsset() {
    if (!assignTarget) return;
    if (!assigneeName.trim()) {
      toast.error("Type the assignee name.");
      return;
    }
    setAssigning(true);
    try {
      await assetsApi.assign(assignTarget.id, {
        assignee_name: assigneeName.trim(),
        expected_return_date: assignReturnDate || undefined,
      });
      toast.success(`Assigned to ${assigneeName.trim()}.`);
      setAssignTarget(null);
      setAssigneeName("");
      setAssignReturnDate("");
      await fetchAssets();
    } catch (error) {
      toast.error(errorMessage(error, "Could not assign"));
    } finally {
      setAssigning(false);
    }
  }

  async function removeAsset(assetId: number) {
    setRemovingId(assetId);
    try {
      await assetsApi.remove(assetId);
      toast.success("Assignment released.");
      await fetchAssets();
    } catch (error) {
      toast.error(errorMessage(error, "Could not remove"));
    } finally {
      setRemovingId(null);
    }
  }

  function receiptBusiness(): ReceiptBusiness {
    return tenantBusiness(tenantInfo, dashboard?.tenant);
  }

  function promotionReceipt(doc: Promotion): ReceiptDoc {
    return buildPromotionReceipt(doc, receiptBusiness());
  }

  function settlementReceipt(row: SettlementRow): SettlementReceiptDoc {
    return buildSettlementReceipt(row, receiptBusiness());
  }

  function registrationReceipt(doc: Registration): ReceiptDoc {
    return buildRegistrationReceipt(doc, receiptBusiness());
  }

  function stockOutReceipt(doc: StockOut): ReceiptDoc {
    return buildStockOutReceipt(doc, receiptBusiness());
  }

  const taxRows = taxSummary?.rows ?? [];
  const taxTotals = taxSummary?.totals;

  const visibleInventoryLots = useMemo(
    () =>
      lots.filter((lot) =>
        matchesQuery(
          inventoryQuery,
          lot.voucher_number,
          lot.item_name,
          lot.category,
          lot.supplier_name,
        ),
      ),
    [lots, inventoryQuery],
  );
  const inventoryGroups = useMemo(
    () => groupLotsByItem(visibleInventoryLots),
    [visibleInventoryLots],
  );
  const toggleInventoryGroup = (key: string) =>
    setInventoryOpenKeys((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const visibleSettlements = useMemo(
    () =>
      settlements.filter((row) =>
        matchesQuery(
          settlementQuery,
          row.item_name,
          row.voucher_number,
          row.agent_name,
          row.payment_method,
          methodLabel(row.payment_method),
          row.status,
          row.entered_by_name,
        ),
      ),
    [settlements, settlementQuery],
  );

  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) =>
        matchesQuery(
          assetQuery,
          asset.asset_tag,
          asset.name,
          asset.category,
          categoryLabel(asset.category),
          asset.serial_number,
          asset.assignee_name,
          asset.status,
        ),
      ),
    [assets, assetQuery],
  );

  const visiblePromotions = useMemo(
    () =>
      promotions.filter((doc) =>
        matchesQuery(
          promoQuery,
          doc.voucher_number,
          doc.status,
          doc.mode,
          doc.manufacturers.join(" "),
          doc.lines.map((line) => line.item_name).join(" "),
        ),
      ),
    [promotions, promoQuery],
  );

  const visiblePromoReceipts = useMemo(
    () =>
      promoReceipts.filter((doc) =>
        matchesQuery(
          promoReceiptQuery,
          doc.voucher_number,
          doc.status,
          doc.manufacturers.join(" "),
          doc.lines.map((line) => line.item_name).join(" "),
        ),
      ),
    [promoReceipts, promoReceiptQuery],
  );

  const visibleRegistrationReceipts = useMemo(
    () =>
      [...registrations]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .filter((doc) => doc.status === "APPROVED")
        .filter((doc) =>
          matchesQuery(
            registrationReceiptQuery,
            doc.voucher_number,
            doc.supplier_name,
            doc.status,
            doc.lines.map((line) => line.item_name).join(" "),
          ),
        ),
    [registrations, registrationReceiptQuery],
  );

  const visibleStockoutReceipts = useMemo(
    () =>
      [...stockouts]
        .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
        .filter((doc) => doc.status === "APPROVED")
        .filter((doc) =>
          matchesQuery(
            stockoutReceiptQuery,
            doc.voucher_number,
            doc.status,
            doc.mode,
            doc.assignments.map((row) => row.item_name).join(" "),
            doc.assignments.map((row) => row.agent_name).join(" "),
          ),
        ),
    [stockouts, stockoutReceiptQuery],
  );

  const recentRegistrations = useMemo(
    () =>
      [...registrations]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .filter((doc) =>
          matchesQuery(
            recentRegQuery,
            doc.voucher_number,
            doc.supplier_name,
            doc.status,
            doc.lines.map((line) => line.item_name).join(" "),
          ),
        )
        .slice(0, 10),
    [registrations, recentRegQuery],
  );

  const recentMovements = useMemo(
    () =>
      [...movements]
        .filter((row) => row.type === "STOCKOUT")
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .filter((row) =>
          matchesQuery(
            recentMovementQuery,
            row.item_name,
            row.voucher_number,
            row.role,
            row.note,
          ),
        )
        .slice(0, 10),
    [movements, recentMovementQuery],
  );

  const recentPromotions = useMemo(
    () =>
      [...promotions]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .filter((doc) =>
          matchesQuery(
            recentPromoQuery,
            doc.voucher_number,
            doc.status,
            doc.manufacturers.join(" "),
            doc.lines.map((line) => line.item_name).join(" "),
          ),
        )
        .slice(0, 10),
    [promotions, recentPromoQuery],
  );

  const settlementHeaders = [
    "Item",
    "Voucher",
    "Agent",
    "Assigned",
    "Sold",
    "Returned",
    "Method",
    "Expected",
    "Collected",
    "Penalty amount",
    "Penalty reason",
    "Status",
    "Entered by",
    "Entered at",
  ];
  const settlementMatrix = visibleSettlements.map((row) => [
    row.item_name,
    row.voucher_number,
    row.agent_name,
    Number(row.assigned_quantity),
    Number(row.sold_quantity),
    Number(row.returned_quantity),
    methodLabel(row.payment_method),
    Number(row.expected_amount),
    Number(row.collected_amount || row.expected_amount),
    row.penalty ? Number(row.penalty_amount || 0) : 0,
    row.penalty ? row.penalty_reason : "",
    row.status,
    row.entered_by_name,
    fmtDate(row.entered_at),
  ]);

  const assetHeaders = [
    "Tag",
    "Name",
    "Category",
    "Serial",
    "Qty",
    "Status",
    "Assignee",
    "Condition",
    "Total cost",
  ];
  const assetMatrix = visibleAssets.map((asset) => [
    asset.asset_tag,
    asset.name,
    categoryLabel(asset.category),
    asset.serial_number,
    Number(asset.quantity),
    asset.status,
    asset.assignee_name ?? "",
    asset.condition_at_registration.toLowerCase(),
    Number(asset.unit_cost) * Number(asset.quantity),
  ]);

  const awaitingFinance = {
    registrations: registrations.filter((doc) => doc.status === "PENDING_FINANCE"),
    stockouts: stockouts.filter((doc) => doc.status === "PENDING_FINANCE"),
    settlements: settlements.filter((row) => row.status === "PENDING_FINANCE"),
  };
  const visibleQueueRegistrations = awaitingFinance.registrations.filter((doc) =>
    matchesQuery(
      queueRegQuery,
      doc.voucher_number,
      doc.supplier_name,
      doc.lines.map((line) => line.item_name).join(" "),
    ),
  );
  const visibleQueueStockouts = awaitingFinance.stockouts.filter((doc) =>
    matchesQuery(
      queueStockQuery,
      doc.voucher_number,
      doc.mode,
      doc.assignments.map((row) => row.item_name).join(" "),
      doc.assignments.map((row) => row.agent_name).join(" "),
    ),
  );

  // ------------------------------------------------------------- reporting
  const reportWindow = useMemo(
    () => reportRange(reportPeriod, reportAnchor),
    [reportPeriod, reportAnchor],
  );
  const ledger: SaleLikeRow[] = reportRows;
  const categoryReport = useMemo(
    () => summariseByCategory(ledger, reportWindow),
    [ledger, reportWindow],
  );
  const itemReport = useMemo(
    () => summariseByItem(ledger, reportWindow),
    [ledger, reportWindow],
  );
  const agentReport = useMemo(
    () => summariseByAgent(ledger, reportWindow, agentList),
    [ledger, reportWindow, agentList],
  );
  const todaySales = useMemo(() => dailySales(reportRows), [reportRows]);
  const raisedToday = useMemo(() => {
    const day = ymd(new Date());
    const rows = reportRows.filter((row) => dayOf(row.created_at) === day);
    return {
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + Number(row.sales_amount), 0),
      awaiting: rows.filter((row) => row.status === "PENDING_FINANCE").length,
    };
  }, [reportRows]);
  const reportingBusiness = receiptBusiness();

  return (
    <>
      <PageHeader
        eyebrow="Finance workspace"
        title="Sales approval, promotions & tax"
        description="Verify agent sales, raise promotions for the manufacturer and keep the VAT picture straight."
        stats={
          <>
            <StatCard
              label="Approved today"
              value={money(todaySales.revenue)}
              hint={`${todaySales.lines} line${todaySales.lines === 1 ? "" : "s"} · ${qty(
                todaySales.units,
              )} units · ${money(todaySales.profit)} profit`}
              tone="violet"
              icon={<Banknote className="size-4" />}
            />
            <StatCard
              label="Raised today"
              value={money(raisedToday.amount)}
              hint={`${raisedToday.count} submitted · ${raisedToday.awaiting} awaiting finance`}
              tone="amber"
              icon={<Receipt className="size-4" />}
            />
          </>
        }
      />

      {view === "sales" && (
        <div className="space-y-4">
          <Panel
            title="Sales approvals"
            description="Finance's decision on every agent handover. Approving forwards it to the Manager, and the Manager's approval puts any unsold remainings back into the store."
            actions={
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] text-amber-300">
                {awaitingFinance.settlements.length} awaiting finance
              </span>
            }
          >
            {awaitingFinance.settlements.length ? (
              <div className="space-y-2">
                {awaitingFinance.settlements.map((row) => {
                  const penalised = Number(row.penalty_amount || 0) > 0;
                  const penaltyable = Number(row.expected_amount) > 0;
                  const busyHere = decidingKey !== null;
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-emerald-300">{row.voucher_number}</p>
                        <p className="text-sm text-zinc-200">
                          {row.item_name}
                          <span className="text-zinc-500">
                            {" · "}
                            {row.agent_name || "unassigned agent"}
                          </span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                          <span>Sold {qty(row.sold_quantity)}</span>
                          <span className="text-zinc-700">·</span>
                          <span className={penalised ? "text-rose-300" : "text-sky-300"}>
                            {money(row.collected_amount || row.expected_amount)} collected
                          </span>
                          <span className="text-zinc-700">of</span>
                          <span className="text-emerald-300">
                            {money(row.expected_amount)} expected
                          </span>
                          <span className="text-zinc-700">·</span>
                          <span>Unsold {qty(row.returned_quantity)}</span>
                          {row.penalty && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                              <AlertTriangle className="size-3" />
                              Penalty {money(row.penalty_amount)}
                              {row.penalty_reason ? ` · ${row.penalty_reason}` : ""}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200"
                          disabled={busyHere}
                          onClick={() => settleDecision(row.id, "approve")}
                        >
                          {decidingKey === `settlement-${row.id}-approve` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-amber-400/30 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
                          disabled={busyHere || !penaltyable}
                          title={
                            penaltyable
                              ? "Approve and record the cash this agent did not bring in"
                              : "Nothing was sold, so there is no expected revenue to penalise"
                          }
                          onClick={() => openPenaltyDialog(row)}
                        >
                          <AlertTriangle className="size-3.5" />
                          Approve with penalty
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
                          disabled={busyHere}
                          onClick={() => settleDecision(row.id, "decline")}
                        >
                          {decidingKey === `settlement-${row.id}-decline` ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                          Decline
                        </Button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyRow>No handover is waiting on finance.</EmptyRow>
            )}
          </Panel>

          {!salesEnabled && (
            <Panel
              title="Sales approval"
              description="Add as many sale lines as needed — each amount is the item's selling price × sold quantity. Posting sends the whole batch at once."
              actions={
                <Button
                  size="sm"
                  onClick={submitStaged}
                  disabled={busy || !readySaleLines.length}
                  className="gap-2 bg-emerald-600 text-white shadow-[0_12px_30px_-16px_rgba(16,185,129,0.9)] hover:bg-emerald-500"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Post {readySaleLines.length || ""} sale{readySaleLines.length === 1 ? "" : "s"}
                </Button>
              }
            >
              <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/[0.08] via-[#0b0b13] to-violet-500/[0.07] p-4">
                <div className="pointer-events-none absolute -top-20 -right-12 size-48 rounded-full bg-emerald-400/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 size-48 rounded-full bg-violet-400/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-emerald-300 uppercase">
                      <Sparkles className="size-3.5" /> Batch sale lines
                    </p>
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                      <span>
                        {saleLines.length} line{saleLines.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-zinc-700">·</span>
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-emerald-200">
                        {money(stagedTotal)}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    {saleLines.map((line, index) => {
                      const accent = SALE_LINE_ACCENTS[index % SALE_LINE_ACCENTS.length];
                      const picked = lineChosen(line);
                      return (
                        <div
                          key={line.key}
                          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3 pl-4 sm:p-4 sm:pl-5"
                        >
                          <span
                            className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${accent.bar}`}
                          />
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${accent.chip}`}
                            >
                              Line {String(index + 1).padStart(2, "0")}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSaleLine(line.key)}
                              aria-label={`Remove sale line ${index + 1}`}
                              className="rounded-md p-1 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                            >
                              <X className="size-4" />
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Field label="Item (open stock)">
                              <ComboSelect
                                value={line.item}
                                onChange={(value) =>
                                  patchSaleLine(line.key, {
                                    item: value,
                                    assignment: "",
                                    sold_quantity: "",
                                  })
                                }
                                options={openItems.map((row) => ({
                                  value: String(row.lot),
                                  label: `${row.item_name} · ${row.voucher_number} (${qty(row.assigned_quantity)} out)`,
                                }))}
                                placeholder="Choose open stock…"
                                searchPlaceholder="Search item or voucher…"
                                emptyText="No open stock found."
                              />
                            </Field>
                            <Field label="Sales agent">
                              <ComboSelect
                                value={line.assignment}
                                onChange={(value) => {
                                  const pickedAgent = lineAgents(line).find(
                                    (row) => String(row.assignment) === value,
                                  );
                                  patchSaleLine(line.key, {
                                    assignment: value,
                                    sold_quantity: pickedAgent?.assigned_quantity ?? "",
                                  });
                                }}
                                options={lineAgents(line).map((row) => ({
                                  value: String(row.assignment),
                                  label: `${row.agent_name || "Unassigned"} · ${qty(row.assigned_quantity)} @ ${money(row.unit_price)}`,
                                }))}
                                placeholder="Choose the agent…"
                                searchPlaceholder="Search sales agents…"
                                emptyText="No agent holds this voucher."
                              />
                            </Field>
                            <Field
                              label={`Sold quantity${picked ? ` (max ${qty(picked.assigned_quantity)})` : ""}`}
                            >
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                max={picked?.assigned_quantity}
                                value={line.sold_quantity}
                                onChange={(event) =>
                                  patchSaleLine(line.key, {
                                    sold_quantity: event.target.value,
                                  })
                                }
                                placeholder="0.000"
                                className="border-white/10 bg-white/[0.03]"
                              />
                            </Field>
                            <Field label="Expected gross">
                              <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3">
                                <span className="text-sm font-semibold text-emerald-200">
                                  {money(lineAmount(line))}
                                </span>
                                <span className="truncate text-[10px] text-emerald-300/70">
                                  {picked
                                    ? `${money(picked.unit_price)} × ${qty(line.sold_quantity || 0)}`
                                    : "price × sold units"}
                                </span>
                              </div>
                            </Field>
                          </div>

                          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                            <PaymentMethodPicker
                              name={`finance-method-${line.key}`}
                              value={line.method}
                              onChange={(value) =>
                                patchSaleLine(line.key, { method: value })
                              }
                            />
                            <label
                              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                                line.penalty
                                  ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-rose-400/30 hover:text-rose-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={line.penalty}
                                onChange={(event) =>
                                  patchSaleLine(line.key, { penalty: event.target.checked })
                                }
                                className="size-3.5 accent-rose-400"
                              />
                              Penalty
                              <span className="text-[10px] opacity-70">
                                affects agent ranking
                              </span>
                            </label>
                          </div>

                          {line.penalty && (
                            <div className="mt-3 grid gap-3 rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-3 sm:grid-cols-[9rem_10rem_minmax(0,1fr)]">
                              <Field label="Penalty · not brought">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  max={lineAmount(line) || undefined}
                                  value={line.penalty_amount}
                                  onChange={(event) =>
                                    patchSaleLine(line.key, {
                                      penalty_amount: event.target.value,
                                    })
                                  }
                                  placeholder={`0.00 – ${money(lineAmount(line))}`}
                                  className="border-rose-400/30 bg-white/[0.04] text-rose-100"
                                />
                              </Field>
                              <Field label="Collected gross">
                                <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-sky-400/25 bg-sky-400/10 px-3">
                                  <span className="text-sm font-semibold text-sky-200">
                                    {money(
                                      Math.max(
                                        lineAmount(line) -
                                          (Number(line.penalty_amount.replace(",", "")) || 0),
                                        0,
                                      ),
                                    )}
                                  </span>
                                  <span className="text-[10px] text-sky-300/60">
                                    expected − penalty
                                  </span>
                                </div>
                              </Field>
                              <Field label="Reason · required">
                                <Input
                                  value={line.penalty_reason}
                                  onChange={(event) =>
                                    patchSaleLine(line.key, {
                                      penalty_reason: event.target.value,
                                    })
                                  }
                                  placeholder="Why the agent is penalised on this sale"
                                  className="border-rose-400/30 bg-white/[0.04] text-rose-100"
                                />
                              </Field>
                              {penaltyLineError(line, lineAmount(line)) && (
                                <p className="text-[11px] text-rose-300 sm:col-span-3">
                                  <AlertTriangle className="mr-1 inline size-3" />
                                  {penaltyLineError(line, lineAmount(line))}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSaleLine}
                    className="mt-3 w-full gap-2 border-dashed border-white/20 bg-transparent text-zinc-300 hover:border-violet-400/40 hover:bg-violet-400/5 hover:text-violet-200"
                  >
                    <Plus className="size-4" /> Add line
                  </Button>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-300 uppercase">
                        {readySaleLines.length} ready line
                        {readySaleLines.length === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Expected gross = selling price × sold quantity. A penalty is the
                        slice of it the agent did not hand over.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-300/70 uppercase">
                        Expected gross
                      </p>
                      <span className="text-lg font-semibold text-emerald-200">
                        {money(stagedTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          <Panel
            title="Settlement report"
            description="Assigned − sold returns to the voucher at final approval; variance is negative-only."
            actions={
              <ReportExportButtons
                title="Sales settlements"
                headers={settlementHeaders}
                rows={settlementMatrix}
                file="volosync-settlements"
                business={reportingBusiness}
              />
            }
          >
            <div className="mb-4 ml-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
              <Field label="From">
                <DateField
                  value={settlementFilters.from}
                  onChange={(value) => setSettlementFilter({ from: value })}
                  placeholder="Any date"
                  clearable
                />
              </Field>
              <Field label="To">
                <DateField
                  value={settlementFilters.to}
                  onChange={(value) => setSettlementFilter({ to: value })}
                  placeholder="Any date"
                  clearable
                />
              </Field>
              <Field label="Sales agent">
                <ComboSelect
                  value={settlementFilters.agent}
                  onChange={(value) => setSettlementFilter({ agent: value })}
                  options={[
                    { value: "", label: "All agents" },
                    ...agentList.map((agent) => ({
                      value: String(agent.id),
                      label: agent.name,
                    })),
                  ]}
                  placeholder="All agents"
                  searchPlaceholder="Search sales agents…"
                  emptyText="No sales agent found."
                />
              </Field>
              <Field label="Item">
                <ComboSelect
                  value={settlementFilters.item}
                  onChange={(value) => setSettlementFilter({ item: value })}
                  options={[
                    { value: "", label: "All items" },
                    ...lots.map((lot) => ({
                      value: String(lot.id),
                      label: `${lot.item_name} · ${lot.voucher_number}`,
                    })),
                  ]}
                  placeholder="All items"
                  searchPlaceholder="Search item or voucher…"
                  emptyText="No item found."
                />
              </Field>
              <Field label="Status">
                <ComboSelect
                  value={settlementFilters.status}
                  onChange={(value) => setSettlementFilter({ status: value })}
                  options={[{ value: "", label: "All statuses" }, ...SETTLEMENT_STATUSES]}
                  placeholder="All statuses"
                  searchPlaceholder="Search statuses…"
                  emptyText="No status found."
                />
              </Field>
              <Field label="Payment method">
                <ComboSelect
                  value={settlementFilters.method}
                  onChange={(value) => setSettlementFilter({ method: value })}
                  options={[{ value: "", label: "All methods" }, ...PAYMENT_METHODS]}
                  placeholder="All methods"
                  searchPlaceholder="Search methods…"
                  emptyText="No method found."
                />
              </Field>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <TableSearch
                value={settlementQuery}
                onChange={setSettlementQuery}
                placeholder="Search item, voucher, agent…"
                className="w-64 sm:w-72"
              />
              <p className="flex items-center gap-2 text-xs text-zinc-500">
                {settlementFiltering && (
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Loader2 className="size-3.5 animate-spin" /> Filtering
                  </span>
                )}
                <span>
                  <span className="font-semibold text-zinc-300">{visibleSettlements.length}</span>{" "}
                  of {settlements.length} settlement{settlements.length === 1 ? "" : "s"}
                </span>
              </p>
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/10">
              <table className="w-full [&_td]:px-2 [&_th]:px-2">
                <thead>
                  <tr>
                    <StickyTh>Item</StickyTh>
                    <StickyTh>Agent</StickyTh>
                    <StickyTh right>Assigned</StickyTh>
                    <StickyTh right>Sold</StickyTh>
                    <StickyTh right>Returned</StickyTh>
                    <StickyTh>Method</StickyTh>
                    <StickyTh right>Expected</StickyTh>
                    <StickyTh right>Collected</StickyTh>
                    <StickyTh>Penalty</StickyTh>
                    <StickyTh>Status</StickyTh>
                    <StickyTh>Approvals</StickyTh>
                    <StickyTh right>Action</StickyTh>
                  </tr>
                </thead>
                <tbody>
                  {visibleSettlements.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <Td>{row.item_name}</Td>
                      <Td className="font-mono text-xs text-emerald-300">{row.voucher_number}</Td>
                      <Td>
                        <span className="block text-zinc-100">
                          {row.agent_name || "—"}
                        </span>
                        <span className="block text-[11px] text-zinc-500">
                          {row.entered_by_name || "—"} · {fmtDate(row.entered_at)}
                        </span>
                      </Td>
                      <Td right>{qty(row.assigned_quantity)}</Td>
                      <Td right>{qty(row.sold_quantity)}</Td>
                      <Td right className="text-amber-300">{qty(row.returned_quantity)}</Td>
                      <Td>{methodLabel(row.payment_method)}</Td>
                      <Td right className="text-emerald-300">
                        {money(row.expected_amount)}
                      </Td>
                      <Td
                        right
                        className={
                          Number(row.penalty_amount || 0) > 0 ? "text-rose-300" : "text-sky-300"
                        }
                      >
                        {money(row.collected_amount || row.expected_amount)}
                      </Td>
                      <Td>
                        <PenaltyMark
                          amountValue={Number(row.penalty_amount || 0)}
                          penalties={
                            row.penalty
                              ? [
                                  {
                                    amount: Number(row.penalty_amount || 0),
                                    reason: row.penalty_reason || "No reason recorded",
                                    item: row.item_name,
                                    voucher: row.voucher_number,
                                    day: fmtDate(row.entered_at || row.created_at),
                                  },
                                ]
                              : []
                          }
                          compact
                        />
                      </Td>
                      <Td>
                        <StatusPill status={row.status} tone={statusTone(row.status)} />
                      </Td>
                      <Td>
                        <ApprovalStamps
                          finance={row.finance_approval}
                          manager={row.manager_approval}
                        />
                      </Td>
                      <Td right>
                        <span className="inline-flex items-center gap-1">
                          <button
                            title="Print settlement receipt"
                            onClick={() => printSettlementReceipts([settlementReceipt(row)])}
                            className="rounded-lg border border-white/15 p-1.5 text-zinc-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300"
                          >
                            <Printer className="size-3.5" />
                          </button>
                          {row.status === "PENDING_FINANCE" ? (
                            <span className="inline-flex gap-1">
                              <IconButton
                                label="Approve"
                                tone="emerald"
                                pending={decidingKey === `settlement-${row.id}-approve`}
                                disabled={decidingKey !== null}
                                onClick={() => settleDecision(row.id, "approve")}
                              />
                              <IconButton
                                label={
                                  Number(row.expected_amount) > 0
                                    ? "Approve with penalty"
                                    : "Approve with penalty — nothing was sold, so there is no revenue to penalise"
                                }
                                tone="amber"
                                disabled={
                                  decidingKey !== null || Number(row.expected_amount) <= 0
                                }
                                onClick={() => openPenaltyDialog(row)}
                              />
                              <IconButton
                                label="Decline"
                                tone="rose"
                                pending={decidingKey === `settlement-${row.id}-decline`}
                                disabled={decidingKey !== null}
                                onClick={() => settleDecision(row.id, "decline")}
                              />
                            </span>
                          ) : (
                            <span className="ml-1 text-xs text-zinc-600">—</span>
                          )}
                        </span>
                      </Td>
                    </tr>
                  ))}
                  {loading &&
                    Array.from({ length: 4 }).map((_, index) => (
                      <tr key={`sk-${index}`}>
                        <Td>
                          <Skeleton className="h-4 w-28" />
                        </Td>
                        <Td>
                          <Skeleton className="h-4 w-24" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-12" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-12" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-12" />
                        </Td>
                        <Td>
                          <Skeleton className="h-4 w-16" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-20" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-20" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-16" />
                        </Td>
                        <Td>
                          <Skeleton className="h-4 w-14" />
                        </Td>
                        <Td>
                          <Skeleton className="h-4 w-24" />
                        </Td>
                        <Td right>
                          <Skeleton className="ml-auto h-4 w-16" />
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!visibleSettlements.length && !loading && (
              <div className="mt-3">
                <EmptyRow>
                  {settlementQuery.trim()
                    ? `No settlements match “${settlementQuery.trim()}”.`
                    : settlementFilterActive
                      ? "No settlements match these filters."
                      : "No settlements yet."}
                </EmptyRow>
              </div>
            )}
          </Panel>
        </div>
      )}

      {view === "promotion" && (
        <div className="space-y-4">
          <Panel
            title="New promotion stock out"
            description="Promotion stock leaves without an agent. Manager approval deducts it from inventory."
            actions={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-amber-200 uppercase">
                <Sparkles className="size-3" /> Batch promotion
              </span>
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,320px)]">
              <Field label="Promotion date">
                <DateField
                  value={promoDate}
                  onChange={setPromoDate}
                  placeholder="Choose the promotion date"
                />
              </Field>
            </div>

            <div className="space-y-2">
              {promoLines.map((line, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-xl border border-amber-400/15 bg-linear-to-r from-amber-500/[0.06] via-white/[0.02] to-transparent p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-amber-300">
                      LINE {String(index + 1).padStart(2, "0")}
                    </span>
                    {promoLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPromoLines((current) => current.filter((_, i) => i !== index))
                        }
                        aria-label={`Remove promotion line ${index + 1}`}
                        className="rounded-md border border-rose-400/20 p-1 text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Field label="Item / voucher">
                      <ComboSelect
                        value={line.lot}
                        onChange={(value) =>
                          setPromoLines((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, lot: value } : row,
                            ),
                          )
                        }
                        options={lots.map((lot) => ({
                          value: String(lot.id),
                          label: `${lot.item_name} · ${lot.voucher_number} (${qty(lot.remaining_quantity)} left)`,
                        }))}
                        placeholder="Choose stock…"
                        searchPlaceholder="Search item or voucher…"
                        emptyText="No stock found."
                      />
                    </Field>
                    <Field label="Quantity">
                      <Input
                        type="number"
                        step="0.001"
                        value={line.quantity}
                        onChange={(event) =>
                          setPromoLines((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, quantity: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Changing amount">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.changing_amount}
                        onChange={(event) =>
                          setPromoLines((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, changing_amount: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Reason">
                      <Input
                        value={line.change_reason}
                        onChange={(event) =>
                          setPromoLines((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, change_reason: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Button
                variant="outline"
                className="border-white/15 bg-transparent"
                onClick={() =>
                  setPromoLines((current) => [
                    ...current,
                    { lot: "", quantity: "", changing_amount: "0", change_reason: "" },
                  ])
                }
              >
                <Plus className="size-3.5" /> Add config
              </Button>
              <Button
                onClick={submitPromotion}
                disabled={busy}
                className="gap-2 bg-amber-500 text-black hover:bg-amber-400"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <PackageMinus className="size-3.5" />
                )}
                Send to Manager
              </Button>
            </div>
          </Panel>

          <Panel
            title="Promotions"
            description="Every promotion raised here with its live approval status."
            actions={
              <TableSearch
                value={promoQuery}
                onChange={setPromoQuery}
                placeholder="Search voucher, item or status"
                className="w-64"
              />
            }
          >
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10">
              <table className="w-full [&_td]:px-2 [&_th]:px-2">
                <thead>
                  <tr>
                    <StickyTh>Voucher</StickyTh>
                    <StickyTh>Date</StickyTh>
                    <StickyTh>Items</StickyTh>
                    <StickyTh>Manufacturers</StickyTh>
                    <StickyTh>Status</StickyTh>
                    <StickyTh right>Total</StickyTh>
                    <StickyTh right>Action</StickyTh>
                  </tr>
                </thead>
                <tbody>
                  {visiblePromotions.map((doc) => (
                    <tr key={doc.id} className="transition hover:bg-white/[0.03]">
                      <Td className="font-mono text-xs text-amber-300">{doc.voucher_number}</Td>
                      <Td className="text-zinc-400">{doc.date}</Td>
                      <Td>
                        {doc.lines
                          .map((line) => `${line.item_name} × ${qty(line.quantity)}`)
                          .join(", ")}
                      </Td>
                      <Td className="text-zinc-400">
                        {doc.manufacturers.join(", ") || "—"}
                      </Td>
                      <Td>
                        <StatusPill status={doc.status} tone={statusTone(doc.status)} />
                      </Td>
                      <Td right className="text-emerald-300">{money(doc.total)}</Td>
                      <Td right>
                        <button
                          title="Print promotion receipt"
                          onClick={() => printReceipts([promotionReceipt(doc)])}
                          className="rounded-lg border border-white/15 p-1.5 text-zinc-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-300"
                        >
                          <Printer className="size-3.5" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visiblePromotions.length && (
              <div className="mt-3">
                <EmptyRow>
                  {promoQuery.trim()
                    ? `No promotions match “${promoQuery.trim()}”.`
                    : "No promotions yet."}
                </EmptyRow>
              </div>
            )}
          </Panel>
        </div>
      )}

      {view === "promotion-receipts" && (
        <Panel
          title="Promotion receipts"
          description="The list re-filters as soon as you pick a date. Print one promotion or every approved promotion in the range."
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <DateField
                value={promoFrom}
                onChange={setPromoFrom}
                placeholder="From date"
                clearable
                className="w-36"
              />
              <DateField
                value={promoTo}
                onChange={setPromoTo}
                placeholder="To date"
                clearable
                className="w-36"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                const docs = visiblePromoReceipts.filter(
                  (doc) => doc.status === "APPROVED",
                );
                if (!docs.length) {
                  toast.error("No approved promotions in this range.");
                  return;
                }
                printReceipts(docs.map(promotionReceipt));
              }}
            >
              <Printer className="size-3.5" /> Print all filtered
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TableSearch
              value={promoReceiptQuery}
              onChange={setPromoReceiptQuery}
              placeholder="Search voucher, item or manufacturer"
              className="w-64"
            />
            <p className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-300">{visiblePromoReceipts.length}</span>{" "}
              of {promoReceipts.length} promotion{promoReceipts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="space-y-2">
            {visiblePromoReceipts.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div>
                  <p className="flex items-center gap-2 font-mono text-xs text-amber-300">
                    {doc.voucher_number}
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                      {doc.mode}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-200">
                    {doc.lines.map((line) => `${line.item_name} × ${qty(line.quantity)}`).join(", ")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {doc.date} · {doc.manufacturers.join(", ") || "no manufacturer"} ·{" "}
                    {money(doc.total)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={doc.status} tone={statusTone(doc.status)} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-transparent"
                    onClick={() => printReceipts([promotionReceipt(doc)])}
                  >
                    <Printer className="size-3.5" /> Print
                  </Button>
                </div>
              </div>
            ))}
            {!visiblePromoReceipts.length && (
              <EmptyRow>
                {promoReceiptQuery.trim()
                  ? `No promotions match “${promoReceiptQuery.trim()}”.`
                  : "No promotions in this range."}
              </EmptyRow>
            )}
          </div>
        </Panel>
      )}

      {view === "registration-receipts" && (
        <Panel
          title="Item registration receipts"
          description="Printable receipts for approved registrations, branded for the business."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TableSearch
                value={registrationReceiptQuery}
                onChange={setRegistrationReceiptQuery}
                placeholder="Search receipt, item or supplier"
                className="w-56"
              />
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-zinc-400">
                {
                  registrations.filter((doc) => doc.status === "APPROVED").length
                }{" "}
                approved
              </span>
            </div>
          }
        >
          <div className="space-y-2">
            {visibleRegistrationReceipts.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
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
            {!visibleRegistrationReceipts.length && (
              <EmptyRow>
                {registrationReceiptQuery.trim()
                  ? `No approved registrations match “${registrationReceiptQuery.trim()}”.`
                  : "No approved registrations yet."}
              </EmptyRow>
            )}
          </div>
        </Panel>
      )}

      {view === "stockout-receipts" && (
        <Panel
          title="Stock movement receipts"
          description="Printable receipts for approved stock handed to sales agents."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TableSearch
                value={stockoutReceiptQuery}
                onChange={setStockoutReceiptQuery}
                placeholder="Search receipt, item or agent"
                className="w-56"
              />
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-zinc-400">
                {stockouts.filter((doc) => doc.status === "APPROVED").length} approved
              </span>
            </div>
          }
        >
          <div className="space-y-2">
            {visibleStockoutReceipts.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
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
            {!visibleStockoutReceipts.length && (
              <EmptyRow>
                {stockoutReceiptQuery.trim()
                  ? `No approved stock movements match “${stockoutReceiptQuery.trim()}”.`
                  : "No approved stock movements yet."}
              </EmptyRow>
            )}
          </div>
        </Panel>
      )}

      {isTaxView && (
        <PaymentTaxPanel
          tab={taxTab}
          rows={taxRows}
          totals={taxTotals}
          loading={taxLoading}
          business={{
            name: dashboard?.tenant.name,
            tin: dashboard?.tenant.tin,
          }}
          tenantName={dashboard?.tenant.name}
          emptyMessage={
            taxTab === "without_vat"
              ? "Every registration now carries VAT — only vouchers already booked at a 0% rate land here."
              : "No vouchers in this slice."
          }
        />
      )}

      {view === "inventory-reports" && (
        <Panel
          title="Inventory reports"
          description="Collapse per item: each batch keeps its own voucher, unit cost and remaining value."
          actions={
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <TableSearch
                value={inventoryQuery}
                onChange={setInventoryQuery}
                placeholder="Search voucher, item or category"
                className="w-56"
              />
              <ReportExportButtons
                title="Inventory report"
                headers={[
                  "Voucher",
                  "Item",
                  "Category",
                  "In store",
                  "Unit cost",
                  "Unit sales",
                  "Remaining value",
                  "Registration date",
                ]}
                rows={visibleInventoryLots.map((lot) => [
                  lot.voucher_number,
                  lot.item_name,
                  lot.category,
                  Number(lot.remaining_quantity),
                  Number(lot.unit_cost),
                  Number(lot.unit_sales),
                  Number(lot.remaining_quantity) * Number(lot.unit_cost),
                  registrationDate(lot.registration_date),
                ])}
                file="volosync-inventory"
                business={reportingBusiness}
              />
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">
              {visibleInventoryLots.length} of {lots.length} batches · {inventoryGroups.length} item
              {inventoryGroups.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[1020px]">
              <thead>
                <tr>
                  <StickyTh>Voucher</StickyTh>
                  <StickyTh>Item</StickyTh>
                  <StickyTh right>In store</StickyTh>
                  <StickyTh right>Unit cost</StickyTh>
                  <StickyTh right>Unit sales</StickyTh>
                  <StickyTh right>Remaining value</StickyTh>
                  <StickyTh>Registration date</StickyTh>
                </tr>
              </thead>
              <tbody>
                {inventoryGroups.map((group) => {
                  if (group.lots.length === 1) {
                    const lot = group.lots[0];
                    return (
                      <tr key={group.key} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <Td className="font-mono text-xs text-emerald-300">{lot.voucher_number}</Td>
                        <Td>
                          {lot.item_name}
                          <span className="ml-2 text-[11px] text-zinc-500">{lot.category}</span>
                        </Td>
                        <Td right>{qty(lot.remaining_quantity)}</Td>
                        <Td right>{money(lot.unit_cost)}</Td>
                        <Td right>{money(lot.unit_sales)}</Td>
                        <Td right className="text-emerald-300">
                          {money(Number(lot.remaining_quantity) * Number(lot.unit_cost))}
                        </Td>
                        <Td>
                          <span className="font-mono text-xs text-zinc-300">
                            {registrationDate(lot.registration_date)}
                          </span>
                        </Td>
                      </tr>
                    );
                  }

                  const open = inventoryOpenKeys.includes(group.key);
                  const remainingValue = group.lots.reduce(
                    (sum, lot) => sum + Number(lot.remaining_quantity) * Number(lot.unit_cost),
                    0,
                  );
                  return (
                    <Fragment key={group.key}>
                      <tr
                        onClick={() => toggleInventoryGroup(group.key)}
                        aria-expanded={open}
                        className="cursor-pointer border-b border-white/5 bg-white/[0.03] transition hover:bg-white/[0.05]"
                      >
                        <Td className="text-zinc-500">—</Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            {open ? (
                              <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                            ) : (
                              <ChevronRight className="size-4 shrink-0 text-zinc-500" />
                            )}
                            <span className="text-sm font-medium text-zinc-100">{group.itemName}</span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
                              {group.category}
                            </span>
                            <span className="text-[11px] text-zinc-500">{group.lots.length} batches</span>
                          </span>
                        </Td>
                        <Td right>{qty(group.quantity)}</Td>
                        <Td right className="text-zinc-600">—</Td>
                        <Td right className="text-zinc-600">—</Td>
                        <Td right className="font-semibold text-emerald-300">{money(remainingValue)}</Td>
                        <Td className="text-zinc-600">—</Td>
                      </tr>
                      {open &&
                        group.lots.map((lot) => (
                          <tr key={lot.id} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                            <Td className="pl-6 font-mono text-xs text-emerald-300">{lot.voucher_number}</Td>
                            <Td>
                              <span className="pl-6 text-zinc-300">{lot.item_name}</span>
                              <span className="ml-2 text-[11px] text-zinc-500">{lot.unit}</span>
                            </Td>
                            <Td right>{qty(lot.remaining_quantity)}</Td>
                            <Td right>{money(lot.unit_cost)}</Td>
                            <Td right>{money(lot.unit_sales)}</Td>
                            <Td right className="text-emerald-300">
                              {money(Number(lot.remaining_quantity) * Number(lot.unit_cost))}
                            </Td>
                            <Td>
                              <span className="font-mono text-xs text-zinc-300">
                                {registrationDate(lot.registration_date)}
                              </span>
                            </Td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visibleInventoryLots.length && (
            <EmptyRow>
              {inventoryQuery.trim()
                ? `No batches match “${inventoryQuery.trim()}”.`
                : "No stock yet."}
            </EmptyRow>
          )}
        </Panel>
      )}

      {view === "reports" && (
        <div className="space-y-4">
          <ReportingRangeBar
            period={reportPeriod}
            anchor={reportAnchor}
            range={reportWindow}
            onPeriod={setReportPeriod}
            onAnchor={setReportAnchor}
            description="Filters every card, chart and export on this page."
          />

          <ReportKpiStrip
            groups={itemReport}
            agents={agentReport}
            inventory={summary?.rows ?? []}
            promotions={promotions}
            range={reportWindow}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <InventoryReportingCard
              rows={summary?.rows ?? []}
              range={reportWindow}
              business={reportingBusiness}
              tenantName={dashboard?.tenant.name}
            />
            <SalesAgentsCard
              items={itemReport}
              agents={agentReport}
              range={reportWindow}
              business={reportingBusiness}
              tenantName={dashboard?.tenant.name}
            />
          </div>

          <ReportLensBar
            mode={reportLens}
            onMode={setReportLens}
            categories={categoryReport.length}
            items={itemReport.length}
            range={reportWindow}
          />

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <CategoryItemReport
              mode={reportLens}
              categories={categoryReport}
              items={itemReport}
              range={reportWindow}
              business={reportingBusiness}
              tenantName={dashboard?.tenant.name}
            />
            <AgentPerformanceReport
              agents={agentReport}
              agentOptions={agentList.map((agent) => ({
                value: String(agent.id),
                label: agent.name,
              }))}
              range={reportWindow}
              business={reportingBusiness}
              tenantName={dashboard?.tenant.name}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <CollectionMethodsReport
              rows={ledger}
              range={reportWindow}
              methods={PAYMENT_METHODS}
              vat={{
                input: Number(summary?.totals.total_input_vat ?? 0),
                output: Number(summary?.totals.total_output_vat ?? 0),
                net: Number(summary?.totals.net_vat ?? 0),
              }}
              promotions={promotions}
            />
            <PenaltyReport
              groups={agentReport}
              range={reportWindow}
              business={reportingBusiness}
              tenantName={dashboard?.tenant.name}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PromotionReport promotions={promotions} range={reportWindow} />
            <StockPositionReport
              totals={{
                registered_value: Number(summary?.totals.registered_value ?? 0),
                in_store_value: Number(summary?.totals.in_store_value ?? 0),
                stocked_out_value: Number(summary?.totals.stocked_out_value ?? 0),
                base_value: Number(summary?.totals.base_value ?? 0),
                vat: Number(summary?.totals.total_input_vat ?? 0),
                inclusive_amount: Number(summary?.totals.inclusive_amount ?? 0),
                output_vat: Number(summary?.totals.total_output_vat ?? 0),
                net_vat: Number(summary?.totals.net_vat ?? 0),
              }}
              agents={agentReport}
            />
          </div>

          <div className="space-y-4">
            <Panel
              title="Recent registrations"
              description="The last 10 item registration requests."
              actions={
                <TableSearch
                  value={recentRegQuery}
                  onChange={setRecentRegQuery}
                  placeholder="Search voucher, item or supplier"
                  className="w-64"
                />
              }
            >
              {recentRegistrations.length ? (
                <div className="overflow-auto">
                  <table className="w-full [&_td]:px-2 [&_th]:px-2">
                    <thead>
                      <tr>
                        <StickyTh>Voucher</StickyTh>
                        <StickyTh>Items</StickyTh>
                        <StickyTh>Supplier</StickyTh>
                        <StickyTh>Requested</StickyTh>
                        <StickyTh>Status</StickyTh>
                        <StickyTh right>Total</StickyTh>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRegistrations.map((row) => (
                        <tr key={row.id} className="transition hover:bg-white/[0.03]">
                          <Td className="font-mono text-xs text-cyan-300">
                            {row.voucher_number}
                          </Td>
                          <Td>
                            {row.lines.map((line) => line.item_name).join(", ") || "—"}
                          </Td>
                          <Td className="text-zinc-400">{row.supplier_name || "—"}</Td>
                          <Td className="text-zinc-400">{fmtDateTime(row.created_at)}</Td>
                          <Td>
                            <StatusPill status={row.status} tone={statusTone(row.status)} />
                          </Td>
                          <Td right className="text-emerald-300">
                            {money(row.total_value)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyRow>
                  {recentRegQuery.trim()
                    ? `No registrations match “${recentRegQuery.trim()}”.`
                    : "No registrations yet."}
                </EmptyRow>
              )}
            </Panel>

            <Panel
              title="Recent stock movements"
              description="The last 10 stock-outs handed to sales agents."
              actions={
                <TableSearch
                  value={recentMovementQuery}
                  onChange={setRecentMovementQuery}
                  placeholder="Search item, voucher or agent"
                  className="w-64"
                />
              }
            >
              {recentMovements.length ? (
                <div className="overflow-auto">
                  <table className="w-full [&_td]:px-2 [&_th]:px-2">
                    <thead>
                      <tr>
                        <StickyTh>When</StickyTh>
                        <StickyTh>Item</StickyTh>
                        <StickyTh>Voucher</StickyTh>
                        <StickyTh>Recorded by</StickyTh>
                        <StickyTh right>Change</StickyTh>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMovements.map((row) => {
                        const delta = Number(row.quantity_delta);
                        return (
                          <tr key={row.id} className="transition hover:bg-white/[0.03]">
                            <Td className="text-zinc-400">{fmtDateTime(row.at)}</Td>
                            <Td>{row.item_name}</Td>
                            <Td className="font-mono text-xs text-zinc-400">
                              {row.voucher_number}
                            </Td>
                            <Td className="text-zinc-400">{row.role}</Td>
                            <Td
                              right
                              className={delta < 0 ? "text-rose-300" : "text-emerald-300"}
                            >
                              {delta > 0 ? "+" : ""}
                              {qty(row.quantity_delta)}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyRow>
                  {recentMovementQuery.trim()
                    ? `No stock movements match “${recentMovementQuery.trim()}”.`
                    : "No stock movements yet."}
                </EmptyRow>
              )}
            </Panel>

            <Panel
              title="Recent promotions"
              description="The last 10 pricing change requests."
              actions={
                <TableSearch
                  value={recentPromoQuery}
                  onChange={setRecentPromoQuery}
                  placeholder="Search voucher, item or status"
                  className="w-64"
                />
              }
            >
              {recentPromotions.length ? (
                <div className="overflow-auto">
                  <table className="w-full [&_td]:px-2 [&_th]:px-2">
                    <thead>
                      <tr>
                        <StickyTh>Voucher</StickyTh>
                        <StickyTh>Items</StickyTh>
                        <StickyTh>Manufacturers</StickyTh>
                        <StickyTh>Requested</StickyTh>
                        <StickyTh>Status</StickyTh>
                        <StickyTh right>Total</StickyTh>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPromotions.map((row) => (
                        <tr key={row.id} className="transition hover:bg-white/[0.03]">
                          <Td className="font-mono text-xs text-violet-300">
                            {row.voucher_number}
                          </Td>
                          <Td>
                            {row.lines.map((line) => line.item_name).join(", ") || "—"}
                          </Td>
                          <Td className="text-zinc-400">
                            {row.manufacturers.join(", ") || "—"}
                          </Td>
                          <Td className="text-zinc-400">{fmtDateTime(row.created_at)}</Td>
                          <Td>
                            <StatusPill status={row.status} tone={statusTone(row.status)} />
                          </Td>
                          <Td right className="text-emerald-300">
                            {money(row.total)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyRow>
                  {recentPromoQuery.trim()
                    ? `No promotions match “${recentPromoQuery.trim()}”.`
                    : "No promotions yet."}
                </EmptyRow>
              )}
            </Panel>
          </div>
        </div>
      )}

      {view === "requests" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Registrations awaiting finance"
            description="Store → Finance → Manager."
            actions={
              <TableSearch
                value={queueRegQuery}
                onChange={setQueueRegQuery}
                placeholder="Search voucher, item or supplier"
                className="w-60"
              />
            }
          >
            <div className="space-y-2">
              {visibleQueueRegistrations.map((doc) => (
                <QueueRow
                  key={doc.id}
                  reference={doc.voucher_number}
                  title={doc.lines.map((line) => line.item_name).join(", ")}
                  detail={`${money(doc.total_value)} · ${doc.supplier_name || "no supplier"}`}
                  onApprove={() => decideRegistration(doc.id, "APPROVED")}
                  onReject={() => decideRegistration(doc.id, "REJECTED")}
                  pending={
                    decidingKey === `registration-${doc.id}-APPROVED`
                      ? "approve"
                      : decidingKey === `registration-${doc.id}-REJECTED`
                        ? "reject"
                        : null
                  }
                  busy={decidingKey !== null}
                />
              ))}
              {!visibleQueueRegistrations.length && (
                <EmptyRow>
                  {queueRegQuery.trim()
                    ? `No registrations match “${queueRegQuery.trim()}”.`
                    : "Queue is clear."}
                </EmptyRow>
              )}
            </div>
          </Panel>
          <Panel
            title="Stock outs awaiting finance"
            description="Handover to sales agents."
            actions={
              <TableSearch
                value={queueStockQuery}
                onChange={setQueueStockQuery}
                placeholder="Search voucher, item or agent"
                className="w-60"
              />
            }
          >
            <div className="space-y-2">
              {visibleQueueStockouts.map((doc) => (
                <QueueRow
                  key={doc.id}
                  reference={doc.voucher_number}
                  title={doc.assignments
                    .map((row) => `${row.item_name} × ${qty(row.quantity)}`)
                    .join(", ")}
                  detail={`${doc.mode} · ${doc.assignments.map((row) => row.agent_name || "unassigned").join(", ")}`}
                  onApprove={() => decideStockOut(doc.id, "APPROVED")}
                  onReject={() => decideStockOut(doc.id, "REJECTED")}
                  pending={
                    decidingKey === `stockout-${doc.id}-APPROVED`
                      ? "approve"
                      : decidingKey === `stockout-${doc.id}-REJECTED`
                        ? "reject"
                        : null
                  }
                  busy={decidingKey !== null}
                />
              ))}
              {!visibleQueueStockouts.length && (
                <EmptyRow>
                  {queueStockQuery.trim()
                    ? `No stock outs match “${queueStockQuery.trim()}”.`
                    : "Queue is clear."}
                </EmptyRow>
              )}
            </div>
          </Panel>
        </div>
      )}

      {view === "assets" && (
        <div className="space-y-4">
        <Panel
          title="Assets"
          description="Finance is the only role that moves company property — assign by name, remove to release."
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TableSearch
              value={assetQuery}
              onChange={setAssetQuery}
              placeholder="Search tag, asset, serial or assignee"
              className="w-64 sm:w-72"
            />
            <ReportExportButtons
              title="Asset register"
              headers={assetHeaders}
              rows={assetMatrix}
              file="volosync-assets"
              business={reportingBusiness}
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <ComboSelect
              value={assetTab}
              onChange={(value) => setAssetTab(value as "available" | "assigned" | "all")}
              options={[
                { value: "all", label: "All assets" },
                { value: "assigned", label: "Assigned" },
                { value: "available", label: "Available" },
              ]}
              placeholder="All assets"
              searchPlaceholder="Filter status…"
              emptyText="No status found."
              className="w-40"
            />
            <ComboSelect
              value={assetCategory}
              onChange={setAssetCategory}
              options={[
                { value: "", label: "All categories" },
                ...ASSET_CATEGORIES.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
              placeholder="All categories"
              searchPlaceholder="Search categories…"
              emptyText="No category found."
              className="w-44"
            />
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/10">
            <table className="w-full [&_td]:px-2 [&_th]:px-2">
              <thead>
                <tr>
                  <StickyTh>Tag</StickyTh>
                  <StickyTh>Photo</StickyTh>
                  <StickyTh>Name</StickyTh>
                  <StickyTh>Serial</StickyTh>
                  <StickyTh right>Qty</StickyTh>
                  <StickyTh>Status</StickyTh>
                  <StickyTh>Assignee</StickyTh>
                  <StickyTh>Condition</StickyTh>
                  <StickyTh right>Total cost</StickyTh>
                  <StickyTh right>Action</StickyTh>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.map((asset) => (
                  <tr key={asset.id} className="transition hover:bg-white/[0.03]">
                    <Td className="font-mono text-xs text-amber-300">{asset.asset_tag}</Td>
                    <Td>
                      {asset.photo ? (
                        <img
                          src={financeApi.mediaUrl(asset.photo)}
                          alt={asset.name}
                          loading="lazy"
                          className="size-8 rounded-md border border-white/10 object-cover"
                        />
                      ) : (
                        <span className="grid size-8 place-items-center rounded-md border border-dashed border-white/10 text-zinc-600">
                          <ImageIcon className="size-3.5" />
                        </span>
                      )}
                    </Td>
                    <Td>
                      {asset.name}
                      {asset.brand_model && (
                        <span className="block text-[11px] text-zinc-500">
                          {asset.brand_model}
                        </span>
                      )}
                      <span className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {categoryLabel(asset.category)}
                      </span>
                    </Td>
                    <Td className="text-zinc-400">{asset.serial_number || "—"}</Td>
                    <Td right>{qty(asset.quantity)}</Td>
                    <Td>
                      <StatusPill
                        status={asset.status}
                        tone={asset.status === "ASSIGNED" ? "violet" : "emerald"}
                      />
                    </Td>
                    <Td className="text-zinc-300">
                      {asset.assignee_name || "—"}
                      {(() => {
                        const active = asset.assignments.find((row) => row.is_active);
                        return active?.expected_return_date ? (
                          <span className="block text-[11px] text-zinc-500">
                            back {fmtDate(active.expected_return_date)}
                          </span>
                        ) : null;
                      })()}
                    </Td>
                    <Td className="capitalize text-zinc-400">
                      {asset.condition_at_registration.toLowerCase()}
                    </Td>
                    <Td right className="text-emerald-300">
                      {money(Number(asset.unit_cost) * Number(asset.quantity))}
                      <span className="block text-[10px] font-normal text-zinc-500">
                        {money(asset.unit_cost)} each
                      </span>
                    </Td>
                    <Td right>
                      {asset.status === "ASSIGNED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-400/30 bg-transparent text-rose-300"
                          disabled={removingId !== null}
                          onClick={() => removeAsset(asset.id)}
                        >
                          {removingId === asset.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          {removingId === asset.id ? "Removing…" : "Remove"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 hover:bg-emerald-400/15"
                          onClick={() => {
                            setAssignTarget(asset);
                            setAssigneeName("");
                            setAssignReturnDate("");
                          }}
                        >
                          <Wallet className="size-3.5" /> Assign
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
                {assetLoading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`sk-${index}`}>
                      <Td>
                        <Skeleton className="h-4 w-28" />
                      </Td>
                      <Td>
                        <Skeleton className="size-8 rounded-md" />
                      </Td>
                      <Td>
                        <Skeleton className="h-4 w-40" />
                      </Td>
                      <Td>
                        <Skeleton className="h-4 w-24" />
                      </Td>
                      <Td right>
                        <Skeleton className="ml-auto h-4 w-10" />
                      </Td>
                      <Td>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </Td>
                      <Td>
                        <Skeleton className="h-4 w-24" />
                      </Td>
                      <Td>
                        <Skeleton className="h-4 w-16" />
                      </Td>
                      <Td right>
                        <Skeleton className="ml-auto h-4 w-20" />
                      </Td>
                      <Td right>
                        <Skeleton className="ml-auto h-8 w-24" />
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              <span className="font-semibold text-zinc-300">{visibleAssets.length}</span> of{" "}
              {assets.length} asset{assets.length === 1 ? "" : "s"} shown
            </span>
            {assetLoading && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" /> Loading assets…
              </span>
            )}
          </div>
          {!visibleAssets.length && !assetLoading && (
            <div className="mt-3">
              <EmptyRow>
                {assetQuery.trim()
                  ? `No assets match “${assetQuery.trim()}”.`
                  : assetCategory || assetTab !== "all"
                    ? "No assets match these filters."
                    : "No assets yet."}
              </EmptyRow>
            </div>
          )}
        </Panel>

        <AlertDialog
          open={!!assignTarget}
          onOpenChange={(open) => {
            if (!open && !assigning) {
              setAssignTarget(null);
              setAssigneeName("");
              setAssignReturnDate("");
            }
          }}
        >
          <AlertDialogContent className="border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Assign {assignTarget?.name ?? "asset"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tag {assignTarget?.asset_tag ?? "—"} · record who holds it and when it should
                come back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <Field label="Assignee name">
                <Input
                  value={assigneeName}
                  onChange={(event) => setAssigneeName(event.target.value)}
                  placeholder="Type the assignee name"
                  autoFocus
                />
              </Field>
              <Field label="Expected return date">
                <DateField
                  value={assignReturnDate}
                  onChange={setAssignReturnDate}
                  placeholder="Choose a return date"
                  clearable
                />
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={assigning}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={assigning}
                onClick={(event) => {
                  event.preventDefault();
                  void assignAsset();
                }}
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {assigning && <Loader2 className="size-3.5 animate-spin" />}
                {assigning ? "Assigning…" : "Assign asset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      )}

      {view === "payroll" && <FinancePayrollSection />}

      {view === "password" && (
        <FinanceChangePasswordPanel />
      )}

      <AlertDialog
        open={Boolean(penaltyTarget)}
        onOpenChange={(open) => {
          if (!open && !penaltySaving) setPenaltyTarget(null);
        }}
      >
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-300" />
              Approve with penalty
            </AlertDialogTitle>
            <AlertDialogDescription>
              {penaltyTarget
                ? `${penaltyTarget.item_name} · ${penaltyTarget.voucher_number} · ${
                    penaltyTarget.agent_name || "unassigned agent"
                  }. The penalty is the cash the agent did not bring in, so it can never
                  exceed what this sale should have produced.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2.5">
                <p className="text-[9.5px] font-semibold tracking-[0.18em] text-emerald-200/70 uppercase">
                  Expected gross
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-emerald-200">
                  {money(penaltyTarget?.expected_amount ?? 0)}
                </p>
                <p className="text-[10px] text-emerald-200/50">
                  {qty(penaltyTarget?.sold_quantity ?? 0)} sold ×{" "}
                  {money(penaltyTarget?.unit_price ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-2.5">
                <p className="text-[9.5px] font-semibold tracking-[0.18em] text-rose-200/70 uppercase">
                  Penalty
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-rose-200">
                  {money(Number(penaltyForm.amount.replace(",", "")) || 0)}
                </p>
                <p className="text-[10px] text-rose-200/50">not brought in</p>
              </div>
              <div
                className={cn(
                  "rounded-xl border p-2.5",
                  penaltyOver
                    ? "border-amber-400/30 bg-amber-400/10"
                    : "border-sky-400/25 bg-sky-400/10",
                )}
              >
                <p
                  className={cn(
                    "text-[9.5px] font-semibold tracking-[0.18em] uppercase",
                    penaltyOver ? "text-amber-200/70" : "text-sky-200/70",
                  )}
                >
                  Collected gross
                </p>
                <p
                  className={cn(
                    "mt-1 truncate text-sm font-semibold",
                    penaltyOver ? "text-amber-200" : "text-sky-200",
                  )}
                >
                  {money(penaltyCollected)}
                </p>
                <p
                  className={cn(
                    "text-[10px]",
                    penaltyOver ? "text-amber-200/60" : "text-sky-200/50",
                  )}
                >
                  {penaltyOver
                    ? "Over the expected gross"
                    : `${penaltyShare}% of expected`}
                </p>
              </div>
            </div>
            <Field label="Penalty amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                max={penaltyExpected || undefined}
                value={penaltyForm.amount}
                onChange={(event) =>
                  setPenaltyForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder={`0.00 – ${money(penaltyExpected)}`}
                autoFocus
                className="border-rose-400/30 bg-white/[0.04] text-rose-100"
              />
            </Field>
            <Field label="Reason">
              <Input
                value={penaltyForm.reason}
                onChange={(event) =>
                  setPenaltyForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Why the agent is penalised on this sale"
                className="border-rose-400/30 bg-white/[0.04] text-rose-100"
              />
            </Field>
            <p className="text-[11px] text-zinc-500">
              Sold {qty(penaltyTarget?.sold_quantity ?? 0)} · unsold remainings{" "}
              <span className="text-amber-300">
                {qty(penaltyTarget?.returned_quantity ?? 0)}
              </span>
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={penaltySaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={penaltySaving || penaltyOver}
              className="gap-2 bg-rose-600 text-white hover:bg-rose-500"
              onClick={(event) => {
                event.preventDefault();
                void confirmPenalty();
              }}
            >
              {penaltySaving && <Loader2 className="size-3.5 animate-spin" />}
              {penaltySaving ? "Recording…" : "Approve with penalty"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Th with a sticky header treatment — matches kit's Th but stays pinned on scroll. */
function StickyTh({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`sticky top-0 z-10 border-b border-white/10 bg-zinc-900/95 px-3 py-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase backdrop-blur ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded-md bg-white/[0.06] ${className ?? ""}`}
      aria-hidden
    />
  );
}

const STAMP_TONES: Record<string, string> = {
  APPROVED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  REJECTED: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  pending: "border-white/10 bg-white/5 text-zinc-500",
};

function ApprovalStamps({
  finance,
  manager,
}: {
  finance: ApprovalStamp;
  manager: ApprovalStamp;
}) {
  const chip = (label: string, stamp: ApprovalStamp) => (
    <span
      title={
        stamp
          ? `${label}: ${stamp.decision.replaceAll("_", " ")} by ${stamp.decided_by} on ${fmtDateTime(stamp.decided_at)}`
          : `${label}: pending`
      }
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        STAMP_TONES[stamp?.decision ?? "pending"] ?? STAMP_TONES.pending
      }`}
    >
      {label}
      {stamp
        ? stamp.decision === "APPROVED"
          ? "✓"
          : stamp.decision === "REJECTED"
            ? "✕"
            : stamp.decision.replaceAll("_", " ")
        : "·"}
    </span>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {chip("Finance", finance)}
      {chip("Manager", manager)}
    </span>
  );
}

function IconButton({
  label,
  tone,
  onClick,
  pending = false,
  disabled = false,
}: {
  label: string;
  tone: "emerald" | "amber" | "rose";
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  const Icon = tone === "emerald" ? Check : tone === "amber" ? AlertTriangle : X;
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled || pending}
      className={`rounded-lg border p-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "emerald"
          ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10"
          : tone === "amber"
            ? "border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
            : "border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
      }`}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Icon className="size-3.5" />
      )}
    </button>
  );
}

function QueueRow({
  reference,
  title,
  detail,
  onApprove,
  onReject,
  pending,
  busy = false,
}: {
  reference: string;
  title: string;
  detail: string;
  onApprove: () => void;
  onReject: () => void;
  pending?: "approve" | "reject" | null;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]">
      <div>
        <p className="font-mono text-xs text-emerald-300">{reference}</p>
        <p className="text-sm text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500">{detail}</p>
      </div>
      <span className="flex gap-1">
        <IconButton
          label="Approve"
          tone="emerald"
          onClick={onApprove}
          pending={pending === "approve"}
          disabled={busy}
        />
        <IconButton
          label="Reject"
          tone="rose"
          onClick={onReject}
          pending={pending === "reject"}
          disabled={busy}
        />
      </span>
    </div>
  );
}

function FinanceChangePasswordPanel() {
  const [form, setForm] = useState({ old: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.next !== form.confirm) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      await api.changePassword({ old_password: form.old, new_password: form.next });
      toast.success("Password updated.");
      setForm({ old: "", next: "", confirm: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Change password" description="Update your login credentials whenever you like.">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">Current password</Label>
          <Input type="password" value={form.old} onChange={(e) => setForm({ ...form, old: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">New password</Label>
          <Input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} minLength={6} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">Confirm</Label>
          <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} minLength={6} required />
        </div>
        <div className="sm:col-span-3">
          <Button
            type="submit"
            disabled={busy}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
