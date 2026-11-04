"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  money,
  promoApi,
  qty,
  salesApi,
  statusTone,
  type Dashboard,
  type Lot,
  type Movement,
  type Promotion,
  type Registration,
  type SalesAgentRow,
  type Settlement,
  type StockOut,
  type Summary,
  type TenantInfo,
} from "@/lib/api";
import {
  managerApi,
  type AssetRow,
  type LotDetail,
  type LotPatch,
  type RankRow,
  type RankingPeriod,
  type SummaryTotals,
} from "@/lib/api/manager";
import { storeApi, type SummaryTab, type TabSummary } from "@/lib/api/store";
import { useView } from "@/lib/use-view";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { printReceipts, type ReceiptDoc } from "@/lib/print";
import { buildPromotionReceipt, tenantBusiness } from "@/lib/receipts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ImageIcon,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  EmptyRow,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  Td,
  Th,
} from "@/components/volo/kit";
import { PhoneField } from "@/components/volo/phone-field";
import { PaymentTaxPanel, TableSearch } from "@/components/volo/payment-tax";
import {
  AgentPerformanceReport,
  CategoryItemReport,
  CollectionMethodsReport,
  InventoryReportingCard,
  PenaltyMark,
  PenaltyReport,
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
  reportRange,
  summariseByAgent,
  summariseByCategory,
  summariseByItem,
  ymd,
  type ReportPeriod,
  type SaleLikeRow,
} from "@/lib/reports";
import { groupLotsByItem, matchesQuery } from "@/components/volo/lots";
import ManagerHrSection from "./hr";

type AgentDraft = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  sex: "M" | "F";
  years_experience: string;
};

let agentDraftSeq = 0;

function blankAgent(): AgentDraft {
  agentDraftSeq += 1;
  return {
    id: agentDraftSeq,
    first_name: "",
    last_name: "",
    phone: "",
    sex: "M",
    years_experience: "0",
  };
}

type AssetDraft = {
  id: number;
  name: string;
  category: string;
  serial_number: string;
  quantity: string;
  brand_model: string;
  unit_cost: string;
  condition_at_registration: string;
  useful_life_years: string;
  photo: string;
  photo_url: string;
  photo_name: string;
  uploading: boolean;
};

let assetDraftSeq = 0;

function blankAsset(): AssetDraft {
  assetDraftSeq += 1;
  return {
    id: assetDraftSeq,
    name: "",
    category: "IT_EQUIPMENT",
    serial_number: "",
    quantity: "1",
    brand_model: "",
    unit_cost: "0",
    condition_at_registration: "NEW",
    useful_life_years: "5",
    photo: "",
    photo_url: "",
    photo_name: "",
    uploading: false,
  };
}

const stamp = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const registrationDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ManagerPage() {
  const [view] = useView("approvals");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stockouts, setStockouts] = useState<StockOut[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [agents, setAgents] = useState<SalesAgentRow[]>([]);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("alltime");
  const [rankingLoading, setRankingLoading] = useState(true);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assetFilters, setAssetFilters] = useState({
    category: "",
    status: "",
    condition: "",
  });
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deletingLotId, setDeletingLotId] = useState<number | null>(null);
  const [lotDeleteTarget, setLotDeleteTarget] = useState<Lot | null>(null);
  const [lotDeleting, setLotDeleting] = useState(false);
  const [decidingKey, setDecidingKey] = useState<string | null>(null);

  // Payment & tax (server-side tab slice)
  const taxView = view === "tax" || view === "tax-with" || view === "tax-without";
  const taxTab: SummaryTab =
    view === "tax-with" ? "with_vat" : view === "tax-without" ? "without_vat" : "all";
  const [taxSummary, setTaxSummary] = useState<TabSummary | null>(null);
  const [taxLoading, setTaxLoading] = useState(true);

  // inventory search / expanded batches
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryOpenKeys, setInventoryOpenKeys] = useState<string[]>([]);

  // table searches
  const [rankingQuery, setRankingQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [recentRegQuery, setRecentRegQuery] = useState("");
  const [recentMovementQuery, setRecentMovementQuery] = useState("");
  const [recentPromoQuery, setRecentPromoQuery] = useState("");

  // Reporting window — the strip under the hero drives every card, chart and
  // export on the reports page.
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("monthly");
  const [reportAnchor, setReportAnchor] = useState(() => ymd(new Date()));
  const [reportSummary, setReportSummary] = useState<TabSummary | null>(null);
  const [reportLens, setReportLens] = useState<ReportLens>("category");

  // keeps the callback-style loaders free of render deps
  const periodRef = useRef<RankingPeriod>("alltime");
  const assetFiltersRef = useRef({ category: "", status: "", condition: "" });

  // batch agent registration
  const [agentRows, setAgentRows] = useState<AgentDraft[]>(() => [blankAgent()]);
  const [salesUsername, setSalesUsername] = useState("");

  // batch asset registration
  const [assetRows, setAssetRows] = useState<AssetDraft[]>(() => [blankAsset()]);

  // asset edit / delete dialogs
  const [assetEdit, setAssetEdit] = useState<AssetRow | null>(null);
  const [assetEditForm, setAssetEditForm] = useState({
    name: "",
    category: "OTHER",
    brand_model: "",
    serial_number: "",
    quantity: "1",
    unit_cost: "0",
    condition_at_registration: "GOOD",
    useful_life_years: "5",
    photo: "",
  });
  const [assetEditUploading, setAssetEditUploading] = useState(false);
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetDeleteTarget, setAssetDeleteTarget] = useState<AssetRow | null>(null);
  const [assetDeleting, setAssetDeleting] = useState(false);

  // inventory edit (spec §4.2a / R5 — the full Manager edit set)
  const [editing, setEditing] = useState<LotDetail | null>(null);
  const [editForm, setEditForm] = useState({
    remaining_quantity: "",
    unit_sales: "",
    unit_cost: "",
    item_name: "",
    category: "",
    unit: "",
    note: "",
    expiry_date: "",
    image: "",
    image_url: "",
    supplier_name: "",
    supplier_phone: "",
    supplier_address: "",
    supplier_tin: "",
  });
  const [supplierOpen, setSupplierOpen] = useState(true);

  const load = useCallback(async () => {
    const [
      dash,
      regs,
      sos,
      lotRows,
      tax,
      movementRows,
      settlementRows,
      promotionRows,
      agentRows,
      assetRows,
      rankingRows,
      tabSummary,
      tenant,
    ] = await Promise.all([
      api.dashboard(),
      api.registrations(),
      api.stockouts(),
      api.lots(),
      api.summary(),
      api.movements(),
      salesApi.settlements(),
      promoApi.list(),
      salesApi.agents(),
      managerApi.listAssets(assetFiltersRef.current),
      managerApi.ranking(periodRef.current).catch(() => ({ data: [] as RankRow[] })),
      storeApi.summaryByTab("all"),
      api.tenantMe().catch(() => ({ data: null })),
    ]);
    setDashboard(dash.data);
    setTenantInfo(tenant.data);
    setRegistrations(regs.data);
    setStockouts(sos.data);
    setLots(lotRows.data);
    setSummary(tax.data);
    setMovements(movementRows.data);
    setSettlements(settlementRows.data);
    setPromotions(promotionRows.data);
    setAgents(agentRows.data);
    setSalesUsername(agentRows.sales_username ?? "");
    setAssets(assetRows.data);
    setRanking(rankingRows.data);
    setReportSummary(tabSummary.data);
  }, []);

  useEffect(() => {
    load()
      .catch((error) => toast.error(error.message))
      .finally(() => setBooting(false));
  }, [load]);

  // Payment & tax rows come from the server already sliced per tab.
  useEffect(() => {
    if (!taxView) return;
    let cancelled = false;

    async function loadTax() {
      setTaxLoading(true);
      try {
        const response = await storeApi.summaryByTab(taxTab);
        if (!cancelled) setTaxSummary(response.data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not load the tax slice",
        );
      } finally {
        if (!cancelled) setTaxLoading(false);
      }
    }

    void loadTax();
    return () => {
      cancelled = true;
    };
  }, [taxView, taxTab]);

  // The Sales login may be created in Access (or the admin console) after this
  // page mounted, so refresh its username whenever the Agents view opens.
  useEffect(() => {
    if (view !== "agents") return;
    let alive = true;
    salesApi
      .agents()
      .then((response) => {
        if (alive) setSalesUsername(response.sales_username ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [view]);

  // period switch only refetches the ranking
  useEffect(() => {
    periodRef.current = rankingPeriod;
    let alive = true;
    setRankingLoading(true);
    managerApi
      .ranking(rankingPeriod)
      .then((response) => {
        if (alive) setRanking(response.data);
      })
      .catch((error) => {
        if (alive) toast.error(error instanceof Error ? error.message : "Ranking failed");
      })
      .finally(() => {
        if (alive) setRankingLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [rankingPeriod]);

  const queues = useMemo(
    () => ({
      registrations: registrations.filter((doc) => doc.status === "PENDING_MANAGER"),
      stockouts: stockouts.filter((doc) => doc.status === "PENDING_MANAGER"),
      settlements: settlements.filter((doc) => doc.status === "PENDING_MANAGER"),
      promotions: promotions.filter((doc) => doc.status === "PENDING_MANAGER"),
    }),
    [registrations, stockouts, settlements, promotions],
  );

  async function decideRegistration(id: number, decision: "APPROVED" | "REJECTED") {
    setDecidingKey(`registration-${id}-${decision}`);
    try {
      await api.decideRegistration(id, decision);
      toast.success(`Registration ${decision.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decision failed");
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
      toast.error(error instanceof Error ? error.message : "Decision failed");
    } finally {
      setDecidingKey(null);
    }
  }

  async function decideSettlement(id: number, decision: "APPROVED" | "REJECTED") {
    setDecidingKey(`settlement-${id}-${decision}`);
    try {
      await salesApi.decideSettlement(id, decision);
      toast.success(`Settlement ${decision.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decision failed");
    } finally {
      setDecidingKey(null);
    }
  }

  async function decidePromotion(id: number, decision: "APPROVED" | "REJECTED") {
    setDecidingKey(`promotion-${id}-${decision}`);
    try {
      await promoApi.decide(id, decision);
      toast.success(`Promotion ${decision.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decision failed");
    } finally {
      setDecidingKey(null);
    }
  }

  async function applyAssetFilters(patch: {
    category?: string;
    status?: string;
    condition?: string;
  }) {
    const next = { ...assetFilters, ...patch };
    assetFiltersRef.current = next;
    setAssetFilters(next);
    try {
      const response = await managerApi.listAssets({
        category: next.category || undefined,
        status: next.status || undefined,
        condition: next.condition || undefined,
      });
      setAssets(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not filter assets");
    }
  }

  function updateAgentRow(id: number, patch: Partial<AgentDraft>) {
    setAgentRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function createAgents() {
    if (!salesUsername) {
      toast.error("Create the Sales account in Access first — agents belong to that login.");
      return;
    }
    for (const [index, row] of agentRows.entries()) {
      if (!row.first_name.trim()) {
        toast.error(`Agent ${index + 1}: first name is required.`);
        return;
      }
    }
    setBusy(true);
    try {
      for (const row of agentRows) {
        await salesApi.createAgent({
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          phone: row.phone.trim(),
          sex: row.sex,
          years_experience: Number(row.years_experience) || 0,
        });
      }
      toast.success(
        agentRows.length === 1
          ? "Agent registered."
          : `${agentRows.length} agents registered.`,
      );
      setAgentRows([blankAgent()]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register agents");
    } finally {
      setBusy(false);
    }
  }

  function updateAssetRow(id: number, patch: Partial<AssetDraft>) {
    setAssetRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function uploadAssetRowPhoto(id: number, file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Keep the image under 5 MB.");
      return;
    }
    updateAssetRow(id, { uploading: true });
    try {
      const url = await uploadImageToCloudinary(file, { folder: "volosync/assets" });
      updateAssetRow(id, {
        photo: url,
        photo_url: url,
        photo_name: file.name,
        uploading: false,
      });
      toast.success("Photo uploaded to Cloudinary.");
    } catch (error) {
      updateAssetRow(id, { uploading: false });
      toast.error(error instanceof Error ? error.message : "Could not upload the photo");
    }
  }

  async function createAssets() {
    for (const [index, row] of assetRows.entries()) {
      if (!row.name.trim()) {
        toast.error(`Asset ${index + 1}: name is required.`);
        return;
      }
      if (!Number.isFinite(Number(row.unit_cost)) || Number(row.unit_cost) < 0) {
        toast.error(`Asset ${index + 1}: unit cost must be zero or more.`);
        return;
      }
      if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) {
        toast.error(`Asset ${index + 1}: quantity must be greater than zero.`);
        return;
      }
    }
    setBusy(true);
    try {
      for (const row of assetRows) {
        await managerApi.createAsset({
          name: row.name.trim(),
          category: row.category,
          serial_number: row.serial_number.trim(),
          quantity: row.quantity,
          brand_model: row.brand_model.trim(),
          photo: row.photo || undefined,
          unit_cost: row.unit_cost,
          condition_at_registration: row.condition_at_registration,
          useful_life_years: Number(row.useful_life_years) || 1,
        });
      }
      toast.success(
        assetRows.length === 1
          ? "Asset registered — Finance can assign it now."
          : `${assetRows.length} assets registered — Finance can assign them now.`,
      );
      setAssetRows([blankAsset()]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register assets");
    } finally {
      setBusy(false);
    }
  }

  function openAssetEditor(asset: AssetRow) {
    setAssetEdit(asset);
    setAssetEditForm({
      name: asset.name,
      category: asset.category,
      brand_model: asset.brand_model,
      serial_number: asset.serial_number,
      quantity: asset.quantity,
      unit_cost: asset.unit_cost,
      condition_at_registration: asset.condition_at_registration,
      useful_life_years: String(asset.useful_life_years),
      photo: asset.photo ?? "",
    });
  }

  async function uploadAssetEditPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Keep the image under 5 MB.");
      return;
    }
    setAssetEditUploading(true);
    try {
      const url = await uploadImageToCloudinary(file, { folder: "volosync/assets" });
      setAssetEditForm((form) => ({ ...form, photo: url }));
      toast.success("Photo uploaded to Cloudinary.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the photo");
    } finally {
      setAssetEditUploading(false);
    }
  }

  async function saveAssetEdit() {
    if (!assetEdit) return;
    const name = assetEditForm.name.trim();
    if (!name) {
      toast.error("Asset name is required.");
      return;
    }
    if (
      !Number.isFinite(Number(assetEditForm.unit_cost)) ||
      Number(assetEditForm.unit_cost) < 0
    ) {
      toast.error("Unit cost must be zero or more.");
      return;
    }
    if (
      !Number.isFinite(Number(assetEditForm.quantity)) ||
      Number(assetEditForm.quantity) <= 0
    ) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    setAssetSaving(true);
    try {
      const response = await managerApi.updateAsset(assetEdit.id, {
        name,
        category: assetEditForm.category,
        brand_model: assetEditForm.brand_model.trim(),
        serial_number: assetEditForm.serial_number.trim(),
        quantity: assetEditForm.quantity,
        unit_cost: assetEditForm.unit_cost,
        condition_at_registration: assetEditForm.condition_at_registration,
        useful_life_years: Math.max(1, Number(assetEditForm.useful_life_years) || 1),
        photo: assetEditForm.photo,
      });
      setAssets((rows) =>
        rows.map((row) => (row.id === response.data.id ? response.data : row)),
      );
      toast.success("Asset updated.");
      setAssetEdit(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the asset");
    } finally {
      setAssetSaving(false);
    }
  }

  async function deleteAsset() {
    if (!assetDeleteTarget) return;
    setAssetDeleting(true);
    try {
      await managerApi.deleteAsset(assetDeleteTarget.id);
      setAssets((rows) => rows.filter((row) => row.id !== assetDeleteTarget.id));
      toast.success("Asset deleted.");
      setAssetDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the asset");
    } finally {
      setAssetDeleting(false);
    }
  }

  async function confirmDeleteLot() {
    if (!lotDeleteTarget) return;
    setLotDeleting(true);
    setBusy(true);
    setDeletingLotId(lotDeleteTarget.id);
    try {
      await managerApi.deleteLot(lotDeleteTarget.id);
      toast.success("Lot deleted from inventory.");
      if (editing?.id === lotDeleteTarget.id) setEditing(null);
      setLotDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this lot");
    } finally {
      setBusy(false);
      setLotDeleting(false);
      setDeletingLotId(null);
    }
  }

  async function attachLotImage(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Keep the image under 5 MB.");
      return;
    }
    try {
      const url = await uploadImageToCloudinary(file, { folder: "volosync/inventory" });
      setEditForm((current) => ({ ...current, image: url, image_url: url }));
      toast.success("Image uploaded to Cloudinary.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the image");
    }
  }

  function openLotEditor(lot: Lot) {
    const detail = lot as LotDetail;
    setEditing(detail);
    setEditForm({
      remaining_quantity: detail.remaining_quantity,
      unit_sales: detail.unit_sales,
      unit_cost: detail.unit_cost,
      item_name: detail.item_name,
      category: detail.category,
      unit: detail.unit,
      note: detail.note ?? "",
      expiry_date: detail.expiry_date ?? "",
      image: detail.image ?? "",
      image_url: "",
      supplier_name: detail.supplier_name ?? "",
      supplier_phone: detail.supplier_phone ?? "",
      supplier_address: detail.supplier_address ?? "",
      supplier_tin: detail.supplier_tin ?? "",
    });
    setSupplierOpen(true);
  }

  async function saveLot() {
    if (!editing) return;
    const remaining = Number(editForm.remaining_quantity);
    const sales = Number(editForm.unit_sales);
    const cost = Number(editForm.unit_cost);
    if (editForm.remaining_quantity.trim() === "" || !Number.isFinite(remaining) || remaining < 0) {
      toast.error("Quantity must be zero or more.");
      return;
    }
    if (editForm.unit_sales.trim() === "" || !Number.isFinite(sales) || sales <= 0) {
      toast.error("Unit sales must be greater than zero.");
      return;
    }
    if (editForm.unit_cost.trim() === "" || !Number.isFinite(cost) || cost < 0) {
      toast.error("Unit cost cannot be negative.");
      return;
    }
    const payload: LotPatch = {
      remaining_quantity: editForm.remaining_quantity,
      unit_sales: editForm.unit_sales,
      unit_cost: editForm.unit_cost,
      note: editForm.note,
      expiry_date: editForm.expiry_date || null,
      supplier_name: editForm.supplier_name,
      supplier_phone: editForm.supplier_phone,
      supplier_address: editForm.supplier_address,
      supplier_tin: editForm.supplier_tin,
    };
    if (editForm.item_name.trim()) payload.item_name = editForm.item_name.trim();
    if (editForm.category.trim()) payload.category = editForm.category.trim();
    if (editForm.unit.trim()) payload.unit = editForm.unit.trim();
    if (editForm.image) payload.image = editForm.image;

    setBusy(true);
    try {
      await managerApi.patchLot(editing.id, payload);
      toast.success("Inventory updated.");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function promotionReceipt(doc: Promotion): ReceiptDoc {
    return buildPromotionReceipt(doc, reportingBusiness);
  }

  const assetMatrix = assets.map((asset) => [
    asset.asset_tag,
    asset.name,
    asset.category,
    asset.serial_number,
    Number(asset.quantity),
    asset.status,
    asset.assignee_name ?? "",
    asset.unit_cost,
    Number(asset.unit_cost) * Number(asset.quantity),
    asset.condition_at_registration,
  ]);

  const assetBatchUnits = assetRows.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0,
  );
  const assetBatchValue = assetRows.reduce(
    (sum, row) => sum + Number(row.unit_cost || 0) * Number(row.quantity || 0),
    0,
  );
  const assetBatchDepreciation = assetRows.reduce(
    (sum, row) =>
      sum +
      Number(row.unit_cost || 0) / Math.max(1, Number(row.useful_life_years) || 1),
    0,
  );

  // live derivations for the lot editor (price with VAT, paid amount)
  const vatRate = Number(editing?.vat_rate ?? 0);
  const previewPriceWithVat = Number(editForm.unit_sales || 0) * (1 + vatRate / 100);
  const previewPaidAmount =
    Number(editing?.quantity ?? 0) * Number(editForm.unit_cost || 0) * (1 + vatRate / 100);

  const phoneFor = (row: RankRow) =>
    agents.find((agent) => agent.id === row.agent_id)?.phone ?? "";

  const rankHeaders = [
    "Rank",
    "Agent",
    "Phone",
    "Expected gross",
    "Collected gross",
    "Units sold",
    "Returned",
    "Penalty amount",
    "Penalty reasons",
    "Standing",
  ];
  const rankRows = ranking.map((row) => [
    row.rank,
    row.name,
    phoneFor(row),
    Number(row.revenue),
    Math.max(Number(row.revenue) - Number(row.penalty_amount || 0), 0),
    Number(row.units_sold),
    Number(row.returned_quantity),
    Number(row.penalty_amount),
    row.penalty_reasons
      .map((mark) => `${mark.reason} (${mark.amount} ETB · ${mark.item})`)
      .join(" | "),
    row.has_penalty ? "Penalized (ranks below clean)" : "Clean",
  ]);

  const summaryTotals = summary?.totals as Partial<SummaryTotals> | undefined;
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
  // ------------------------------------------------------------- reporting
  const reportWindow = useMemo(
    () => reportRange(reportPeriod, reportAnchor),
    [reportPeriod, reportAnchor],
  );
  const ledger: SaleLikeRow[] = settlements;
  const categoryReport = useMemo(
    () => summariseByCategory(ledger, reportWindow),
    [ledger, reportWindow],
  );
  const itemReport = useMemo(
    () => summariseByItem(ledger, reportWindow),
    [ledger, reportWindow],
  );
  const agentReport = useMemo(
    () =>
      summariseByAgent(
        ledger,
        reportWindow,
        agents.map((agent) => ({ id: agent.id, name: agent.name })),
      ),
    [ledger, reportWindow, agents],
  );
  const todaySales = useMemo(() => dailySales(settlements), [settlements]);
  const stockOutToday = useMemo(() => {
    const day = ymd(new Date());
    const rows = movements.filter(
      (row) => row.type === "STOCKOUT" && dayOf(row.at) === day,
    );
    return {
      count: rows.length,
      units: rows.reduce((sum, row) => sum + Math.abs(Number(row.quantity_delta)), 0),
    };
  }, [movements]);
  const reportingBusiness = tenantBusiness(tenantInfo, dashboard?.tenant);

  // Search happens across the whole history, then the list narrows to ten — a
  // query that only matches an older voucher still finds it.
  const recentRegistrations = useMemo(
    () =>
      [...registrations]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .filter((row) =>
          matchesQuery(
            recentRegQuery,
            row.voucher_number,
            row.supplier_name,
            row.status,
            row.lines.map((line) => line.item_name).join(" "),
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
          matchesQuery(recentMovementQuery, row.item_name, row.voucher_number, row.role, row.note),
        )
        .slice(0, 10),
    [movements, recentMovementQuery],
  );
  const recentPromotions = useMemo(
    () =>
      [...promotions]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .filter((row) =>
          matchesQuery(
            recentPromoQuery,
            row.voucher_number,
            row.status,
            row.manufacturers.join(" "),
            row.lines.map((line) => line.item_name).join(" "),
          ),
        )
        .slice(0, 10),
    [promotions, recentPromoQuery],
  );

  const visibleRanking = ranking.filter((row) =>
    matchesQuery(rankingQuery, row.name, phoneFor(row)),
  );
  const visibleAssets = assets.filter((asset) =>
    matchesQuery(
      assetQuery,
      asset.asset_tag,
      asset.name,
      asset.category,
      assetCategoryLabel(asset.category),
      asset.serial_number,
      asset.assignee_name,
      asset.status,
      asset.condition_at_registration,
    ),
  );
  const visibleRecentRegistrations = recentRegistrations.filter((row) =>
    matchesQuery(
      recentRegQuery,
      row.voucher_number,
      row.supplier_name,
      row.status,
      row.lines.map((line) => line.item_name).join(" "),
    ),
  );
  const visibleRecentMovements = recentMovements.filter((row) =>
    matchesQuery(
      recentMovementQuery,
      row.item_name,
      row.voucher_number,
      row.role,
      row.note,
    ),
  );
  const visibleRecentPromotions = recentPromotions.filter((row) =>
    matchesQuery(
      recentPromoQuery,
      row.voucher_number,
      row.status,
      row.manufacturers.join(" "),
      row.lines.map((line) => line.item_name).join(" "),
    ),
  );

  // HR control views carry their own hero and stat strip, so the generic
  // Manager header would only add noise above them.
  const hrControl = view === "hr" || view.startsWith("hr-");

  return (
    <>
      {!hrControl && (
        <>
          <PageHeader
            eyebrow="Manager workspace"
            title="Final approvals, people and property"
            description="You are the last step in every chain, the only role that edits inventory and the one who registers assets."
            stats={
              <>
                <StatCard
                  label="Approved today"
                  value={money(todaySales.revenue)}
                  hint={`${todaySales.lines} line${todaySales.lines === 1 ? "" : "s"} · ${qty(
                    todaySales.units,
                  )} units · ${money(todaySales.profit)} profit`}
                  tone="emerald"
                  icon={<Wallet className="size-4" />}
                />
                <StatCard
                  label="Stock out today"
                  value={qty(stockOutToday.units)}
                  hint={`${stockOutToday.count} movement${
                    stockOutToday.count === 1 ? "" : "s"
                  } handed to agents`}
                  tone="violet"
                  icon={<Warehouse className="size-4" />}
                />
              </>
            }
          />
        </>
      )}

      {view === "approvals" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <QueuePanel
            title="Registrations"
            description="Store → Finance → Manager."
            empty="Nothing to approve."
            rows={queues.registrations.map((doc) => ({
              id: doc.id,
              reference: doc.voucher_number,
              title: doc.lines.map((line) => line.item_name).join(", "),
              detail: `${money(doc.total_value)} · ${doc.supplier_name || "no supplier"}`,
              approve: () => decideRegistration(doc.id, "APPROVED"),
              reject: () => decideRegistration(doc.id, "REJECTED"),
              pending:
                decidingKey === `registration-${doc.id}-APPROVED`
                  ? "approve"
                  : decidingKey === `registration-${doc.id}-REJECTED`
                    ? "reject"
                    : null,
              busy: decidingKey !== null,
            }))}
          />
          <QueuePanel
            title="Stock outs"
            description="Deduction happens only here."
            empty="Nothing to approve."
            rows={queues.stockouts.map((doc) => ({
              id: doc.id,
              reference: doc.voucher_number,
              title: doc.assignments
                .map((row) => `${row.item_name} × ${qty(row.quantity)}`)
                .join(", "),
              detail: doc.assignments
                .map((row) => `${row.agent_name || "unassigned"} · change ${money(row.changing_amount)}`)
                .join(" | "),
              approve: () => decideStockOut(doc.id, "APPROVED"),
              reject: () => decideStockOut(doc.id, "REJECTED"),
              pending:
                decidingKey === `stockout-${doc.id}-APPROVED`
                  ? "approve"
                  : decidingKey === `stockout-${doc.id}-REJECTED`
                    ? "reject"
                    : null,
              busy: decidingKey !== null,
            }))}
          />
          <QueuePanel
            title="Sales settlements"
            description="Approval returns unsold stock to the voucher."
            empty="No settlements waiting."
            rows={queues.settlements.map((doc) => ({
              id: doc.id,
              reference: doc.voucher_number,
              title: `${doc.item_name} · ${doc.agent_name || "unassigned"}`,
              detail: `sold ${qty(doc.sold_quantity)} · returns ${qty(
                doc.returned_quantity,
              )} · ${money(doc.sales_amount)}`,
              note: doc.penalty ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300">
                    <AlertTriangle className="size-3" />
                    Penalty {money(doc.penalty_amount)}
                  </span>
                  <span className="max-w-[22rem] text-zinc-400">
                    {doc.penalty_reason || "No reason recorded"}
                  </span>
                </p>
              ) : undefined,
              approve: () => decideSettlement(doc.id, "APPROVED"),
              reject: () => decideSettlement(doc.id, "REJECTED"),
              pending:
                decidingKey === `settlement-${doc.id}-APPROVED`
                  ? "approve"
                  : decidingKey === `settlement-${doc.id}-REJECTED`
                    ? "reject"
                    : null,
              busy: decidingKey !== null,
            }))}
          />
          <QueuePanel
            title="Promotions"
            description="Manufacturer promotions deduct on approval."
            empty="No promotions waiting."
            rows={queues.promotions.map((doc) => ({
              id: doc.id,
              reference: doc.voucher_number,
              title: doc.lines.map((line) => line.item_name).join(", "),
              detail: `${doc.mode} · ${money(doc.total)} · ${doc.manufacturers.join(", ") || "no manufacturer"}`,
              approve: () => decidePromotion(doc.id, "APPROVED"),
              reject: () => decidePromotion(doc.id, "REJECTED"),
              pending:
                decidingKey === `promotion-${doc.id}-APPROVED`
                  ? "approve"
                  : decidingKey === `promotion-${doc.id}-REJECTED`
                    ? "reject"
                    : null,
              busy: decidingKey !== null,
            }))}
          />
        </div>
      )}

      {(view === "hr" || view.startsWith("hr-")) && (
        <div>
          <ManagerHrSection view={view} />
        </div>
      )}

      {view === "inventory" && (
        <Panel
          title="Inventory"
          description="Collapse per item to see each batch. You are the only role with the edit icon — details, prices and the Quantity field."
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <TableSearch
              value={inventoryQuery}
              onChange={setInventoryQuery}
              placeholder="Search voucher, item or category"
              className="w-64 sm:w-72"
            />
            <ReportExportButtons
              title="Inventory report"
              subtitle={dashboard?.tenant.name ?? ""}
              headers={["Voucher", "Item", "Category", "Quantity", "Unit cost", "Unit sales", "Price + VAT", "Registration date"]}
              rows={visibleInventoryLots.map((lot) => [
                lot.voucher_number,
                lot.item_name,
                lot.category,
                Number(lot.remaining_quantity),
                Number(lot.unit_cost),
                Number(lot.unit_sales),
                Number(lot.price_with_vat),
                registrationDate(lot.registration_date),
              ])}
              file="volosync-inventory"
              business={reportingBusiness}
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">
              {visibleInventoryLots.length} of {lots.length} batches · {inventoryGroups.length} item
              {inventoryGroups.length === 1 ? "" : "s"}
            </span>
          </div>
          {booting && !lots.length ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <SkeletonRow key={index} />
              ))}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr>
                    <ThSt>Voucher</ThSt>
                    <ThSt>Item</ThSt>
                    <ThSt right>Quantity</ThSt>
                    <ThSt right>Unit cost</ThSt>
                    <ThSt right>Unit sales</ThSt>
                    <ThSt right>Price + VAT</ThSt>
                    <ThSt>Registration date</ThSt>
                    <ThSt right>Actions</ThSt>
                  </tr>
                </thead>
                <tbody>
                  {inventoryGroups.map((group) => {
                    if (group.lots.length === 1) {
                      const lot = group.lots[0];
                      return (
                        <tr key={group.key} className="hover:bg-white/[0.02]">
                          <Td className="font-mono text-xs text-violet-300">{lot.voucher_number}</Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              {lot.image ? (
                                <img
                                  src={lot.image}
                                  alt={lot.item_name}
                                  className="size-9 shrink-0 rounded-md border border-white/10 object-cover"
                                />
                              ) : (
                                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-white/5 bg-white/[0.03] text-zinc-600">
                                  <ImageIcon className="size-3.5" />
                                </span>
                              )}
                              <span className="min-w-0 truncate">{lot.item_name}</span>
                            </div>
                          </Td>
                          <Td right>{qty(lot.remaining_quantity)}</Td>
                          <Td right>{money(lot.unit_cost)}</Td>
                          <Td right>{money(lot.unit_sales)}</Td>
                          <Td right className="text-emerald-300">{money(lot.price_with_vat)}</Td>
                          <Td>
                            <span className="font-mono text-xs text-zinc-300">
                              {registrationDate(lot.registration_date)}
                            </span>
                          </Td>
                          <Td right>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openLotEditor(lot)}
                                aria-label={`Edit ${lot.item_name}`}
                                className="rounded-md border border-white/15 p-1.5 text-zinc-300 transition hover:border-white/30 hover:text-white"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setLotDeleteTarget(lot)}
                                disabled={busy}
                                aria-label={`Delete ${lot.item_name}`}
                                className="rounded-md border border-rose-400/20 p-1.5 text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 disabled:opacity-50"
                              >
                                {deletingLotId === lot.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </Td>
                        </tr>
                      );
                    }

                    const open = inventoryOpenKeys.includes(group.key);
                    return (
                      <React.Fragment key={group.key}>
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
                          <Td right className="text-zinc-600">—</Td>
                          <Td className="text-zinc-600">—</Td>
                          <Td right className="text-zinc-600">—</Td>
                        </tr>
                        {open &&
                          group.lots.map((lot) => (
                            <tr key={lot.id} className="hover:bg-white/[0.02]">
                              <Td className="pl-6 font-mono text-xs text-violet-300">{lot.voucher_number}</Td>
                              <Td>
                                <div className="flex items-center gap-2 pl-6">
                                  {lot.image ? (
                                    <img
                                      src={lot.image}
                                      alt={lot.item_name}
                                      className="size-8 shrink-0 rounded-md border border-white/10 object-cover"
                                    />
                                  ) : (
                                    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-white/5 bg-white/[0.03] text-zinc-600">
                                      <ImageIcon className="size-3" />
                                    </span>
                                  )}
                                  <span className="min-w-0 truncate">{lot.item_name}</span>
                                </div>
                              </Td>
                              <Td right>{qty(lot.remaining_quantity)}</Td>
                              <Td right>{money(lot.unit_cost)}</Td>
                              <Td right>{money(lot.unit_sales)}</Td>
                              <Td right className="text-emerald-300">{money(lot.price_with_vat)}</Td>
                              <Td>
                                <span className="font-mono text-xs text-zinc-300">
                                  {registrationDate(lot.registration_date)}
                                </span>
                              </Td>
                              <Td right>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openLotEditor(lot)}
                                    aria-label={`Edit ${lot.item_name}`}
                                    className="rounded-md border border-white/15 p-1.5 text-zinc-300 transition hover:border-white/30 hover:text-white"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setLotDeleteTarget(lot)}
                                    disabled={busy}
                                    aria-label={`Delete ${lot.item_name}`}
                                    className="rounded-md border border-rose-400/20 p-1.5 text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 disabled:opacity-50"
                                  >
                                    {deletingLotId === lot.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                              </Td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!booting && !visibleInventoryLots.length && (
            <EmptyRow>
              {inventoryQuery.trim()
                ? `No lots match “${inventoryQuery.trim()}”.`
                : "No lots yet."}
            </EmptyRow>
          )}

          <Dialog
            open={Boolean(editing)}
            onOpenChange={(open) => {
              if (!open && !busy) setEditing(null);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto border border-violet-400/25 bg-[#0b0b13] text-white ring-white/10 sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Pencil className="size-4 text-violet-300" />
                  Editing {editForm.item_name || editing?.item_name || "lot"}
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  {editing?.voucher_number} · the batch you are about to change.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Voucher number (read-only)">
                  <Input
                    value={editing?.voucher_number ?? ""}
                    readOnly
                    className="font-mono text-xs text-violet-300 opacity-70"
                  />
                </Field>
                <Field label="Quantity (remaining balance)">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={editForm.remaining_quantity}
                    onChange={(event) =>
                      setEditForm({ ...editForm, remaining_quantity: event.target.value })
                    }
                  />
                </Field>
                <Field label="Unit sales">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.unit_sales}
                    onChange={(event) => setEditForm({ ...editForm, unit_sales: event.target.value })}
                  />
                </Field>
                <Field label="Unit cost">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.unit_cost}
                    onChange={(event) => setEditForm({ ...editForm, unit_cost: event.target.value })}
                  />
                </Field>
                <Field label="Name">
                  <Input
                    value={editForm.item_name}
                    onChange={(event) => setEditForm({ ...editForm, item_name: event.target.value })}
                  />
                </Field>
                <Field label="Category">
                  <Input
                    value={editForm.category}
                    onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    value={editForm.unit}
                    onChange={(event) => setEditForm({ ...editForm, unit: event.target.value })}
                  />
                </Field>
                <Field label="Expiry date">
                  <Input
                    type="date"
                    value={editForm.expiry_date}
                    onChange={(event) => setEditForm({ ...editForm, expiry_date: event.target.value })}
                  />
                </Field>
                <Field label="Item image">
                  <div className="flex items-center gap-2">
                    {editForm.image_url ? (
                      <>
                        <img
                          src={editForm.image_url}
                          alt="Item"
                          className="size-9 rounded-md border border-white/10 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, image: "", image_url: "" })}
                          className="text-[11px] text-rose-300 hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => attachLotImage(event.target.files?.[0])}
                        className="w-full text-[11px] text-zinc-400 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-[11px] file:text-zinc-200"
                      />
                    )}
                  </div>
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Note">
                    <Input
                      value={editForm.note}
                      onChange={(event) => setEditForm({ ...editForm, note: event.target.value })}
                      placeholder="Internal note"
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                <span>
                  Price with VAT{" "}
                  <strong className="text-emerald-300">{money(previewPriceWithVat)}</strong>
                </span>
                <span>
                  Paid amount (registered qty){" "}
                  <strong className="text-amber-300">{money(previewPaidAmount)}</strong>
                </span>
                <span>
                  VAT rate <strong className="text-zinc-200">{vatRate.toFixed(2)}%</strong>
                </span>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setSupplierOpen((open) => !open)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white"
                >
                  <span>Supplier</span>
                  <ChevronDown
                    className={`size-3.5 transition ${supplierOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {supplierOpen && (
                  <div className="grid gap-3 border-t border-white/10 p-3 sm:grid-cols-2">
                    <Field label="Supplier name">
                      <Input
                        value={editForm.supplier_name}
                        onChange={(event) =>
                          setEditForm({ ...editForm, supplier_name: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Supplier phone">
                      <PhoneField
                        value={editForm.supplier_phone}
                        onChange={(supplier_phone) =>
                          setEditForm((current) => ({ ...current, supplier_phone }))
                        }
                      />
                    </Field>
                    <Field label="Supplier address">
                      <Input
                        value={editForm.supplier_address}
                        onChange={(event) =>
                          setEditForm({ ...editForm, supplier_address: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Supplier TIN">
                      <Input
                        value={editForm.supplier_tin}
                        onChange={(event) =>
                          setEditForm({ ...editForm, supplier_tin: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-zinc-500">
                Quantity replaces the remaining balance exactly. Unit sales re-derives price with VAT
                and unit cost re-derives the paid amount from the registered quantity — no approval
                chain, no ledger entry.
              </p>

              <DialogFooter className="mb-0 gap-2 border-white/10 bg-transparent p-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/15 bg-transparent"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={saveLot} disabled={busy} className="gap-2">
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  {busy ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={lotDeleteTarget !== null}
            onOpenChange={(open) => {
              if (!open && !lotDeleting) setLotDeleteTarget(null);
            }}
          >
            <AlertDialogContent className="border border-white/10 bg-[#0b0b13] text-white ring-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Delete this lot?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  {lotDeleteTarget && (
                    <>
                      <span className="font-medium text-zinc-200">
                        {lotDeleteTarget.item_name}
                      </span>{" "}
                      ({lotDeleteTarget.voucher_number}) leaves the inventory for good. This
                      cannot be undone.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="border-white/10 bg-transparent">
                <AlertDialogCancel
                  disabled={lotDeleting}
                  className="border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={lotDeleting}
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmDeleteLot();
                  }}
                  className="gap-2 bg-rose-500/90 text-white hover:bg-rose-500"
                >
                  {lotDeleting && <Loader2 className="size-3.5 animate-spin" />}
                  Delete lot
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Panel>
      )}

      {taxView && (
        <PaymentTaxPanel
          tab={taxTab}
          rows={taxRows}
          totals={taxTotals}
          loading={taxLoading}
          business={reportingBusiness}
          tenantName={dashboard?.tenant.name}
          emptyMessage={
            taxTab === "without_vat"
              ? "No zero-rated vouchers yet — register a line with a 0% VAT rate and it lands here."
              : "No vouchers in this slice."
          }
        />
      )}

      {view === "agents" && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Sales agent registration"
            description="Agents belong to the tenant's one Sales login. Add rows to register a batch."
          >
            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-3 text-xs leading-relaxed text-zinc-300">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>
                <span className="block font-medium text-zinc-200">
                  {salesUsername ? `Shared Sales login @${salesUsername}` : "Shared Sales login"}
                </span>
                {salesUsername
                  ? "The Sales account created in Access owns the login. Agents added here are records for assignments, settlements and ranking — they get no password of their own."
                  : "Create the Sales account in Access first — agents added here belong to that shared login."}
              </span>
            </div>
            <div className="space-y-3">
              {agentRows.map((row, index) => (
                <div
                  key={row.id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/[0.05] via-white/[0.015] to-transparent p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                      Agent {String(index + 1).padStart(2, "0")}
                    </p>
                    {agentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAgentRows((rows) => rows.filter((item) => item.id !== row.id))
                        }
                        aria-label={`Remove agent ${index + 1}`}
                        className="rounded-md border border-rose-400/20 p-1 text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="First name">
                      <Input
                        value={row.first_name}
                        onChange={(event) =>
                          updateAgentRow(row.id, { first_name: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Last name">
                      <Input
                        value={row.last_name}
                        onChange={(event) =>
                          updateAgentRow(row.id, { last_name: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Phone number">
                      <PhoneField
                        value={row.phone}
                        onChange={(phone) => updateAgentRow(row.id, { phone })}
                      />
                    </Field>
                    <Field label="Years of experience">
                      <Input
                        type="number"
                        min="0"
                        value={row.years_experience}
                        onChange={(event) =>
                          updateAgentRow(row.id, { years_experience: event.target.value })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Sex">
                        <RadioGroup
                          value={row.sex}
                          onValueChange={(value) =>
                            updateAgentRow(row.id, { sex: value as "M" | "F" })
                          }
                          className="grid grid-cols-2 gap-2"
                        >
                          {[
                            ["M", "Male"],
                            ["F", "Female"],
                          ].map(([code, text]) => {
                            const active = row.sex === code;
                            return (
                              <label
                                key={code}
                                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                                  active
                                    ? "border-role-1/50 bg-role-1/10 text-white"
                                    : "border-white/10 text-zinc-300 hover:border-white/20"
                                }`}
                              >
                                <RadioGroupItem value={code} />
                                {text}
                              </label>
                            );
                          })}
                        </RadioGroup>
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-dashed border-white/15 bg-white/[0.02] text-xs text-zinc-300 hover:text-white"
                onClick={() => setAgentRows((rows) => [...rows, blankAgent()])}
              >
                <Plus className="size-3.5" /> Add another agent
              </Button>
              <Button
                onClick={createAgents}
                disabled={busy}
                className="flex-1 gap-2 role-gradient-bg border-0 text-white shadow-[0_14px_30px_-16px_var(--role-1)] hover:opacity-90"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Users className="size-3.5" />
                )}
                {busy
                  ? "Registering…"
                  : agentRows.length > 1
                    ? `Register ${agentRows.length} agents`
                    : "Register agent"}
              </Button>
            </div>
          </Panel>

          <Panel title="Registered agents" description="Records under the shared Sales login — no individual passwords.">
            <div className="space-y-2">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="text-zinc-200">
                    {agent.name}
                    <span className="ml-2 text-xs text-zinc-500">
                      {agent.phone || "no phone"} · {agent.years_experience}y exp
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-sky-300">{agent.login_username}</span>
                </div>
              ))}
              {!agents.length && <EmptyRow>No agents registered.</EmptyRow>}
            </div>
          </Panel>
          </div>

            <Panel
              title="Agent performance & ranking"
              description="Approved settlements only. Penalized agents always rank below clean ones on the same revenue."
              actions={
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <TableSearch
                    value={rankingQuery}
                    onChange={setRankingQuery}
                    placeholder="Search agent or phone"
                    className="w-56"
                  />
                  <ReportExportButtons
                    title={`Agent ranking · ${RANKING_PERIOD_LABELS[rankingPeriod]}`}
                    headers={rankHeaders}
                    rows={rankRows}
                    file="volosync-agent-ranking"
                    business={reportingBusiness}
                  />
                </div>
              }
            >
              <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                <span className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                  Period
                </span>
                <OptionCombobox
                  value={rankingPeriod}
                  onChange={(value) => setRankingPeriod(value as RankingPeriod)}
                  options={RANKING_PERIODS}
                  className="h-8 w-40 text-xs"
                />
              </div>

              {rankingLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((index) => (
                    <SkeletonRow key={index} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="max-h-[440px] overflow-auto">
                    <table className="w-full min-w-[860px]">
                      <thead>
                        <tr>
                          <ThSt>Rank</ThSt>
                          <ThSt>Agent</ThSt>
                          <ThSt>Phone</ThSt>
                          <ThSt right>Expected / collected</ThSt>
                          <ThSt right>Units sold</ThSt>
                          <ThSt right>Returned</ThSt>
                          <ThSt right>Penalty</ThSt>
                          <ThSt>Standing</ThSt>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanking.map((row) => (
                          <tr key={row.agent_id} className="hover:bg-white/[0.02]">
                            <Td>
                              <RankMedal rank={row.rank} />
                            </Td>
                            <Td className="text-zinc-100">{row.name}</Td>
                            <Td className="font-mono text-xs text-zinc-400">
                              {phoneFor(row) || "—"}
                            </Td>
                            <Td right>
                              {(() => {
                                const expected = Number(row.revenue);
                                const collected = Math.max(
                                  expected - Number(row.penalty_amount || 0),
                                  0,
                                );
                                return (
                                  <span className="block">
                                    <span className="block font-semibold text-emerald-300">
                                      {money(expected)}
                                    </span>
                                    <span
                                      className={
                                        collected < expected
                                          ? "block text-[11px] text-rose-300"
                                          : "block text-[11px] text-sky-300/70"
                                      }
                                    >
                                      {money(collected)} in
                                    </span>
                                  </span>
                                );
                              })()}
                            </Td>
                            <Td right>{qty(row.units_sold)}</Td>
                            <Td right>{qty(row.returned_quantity)}</Td>
                            <Td right>
                              <PenaltyMark
                                amountValue={Number(row.penalty_amount)}
                                penalties={row.penalty_reasons.map((mark) => ({
                                  reason: mark.reason,
                                  item: mark.item,
                                  voucher: mark.voucher,
                                  day: mark.at.slice(0, 10),
                                  amount: Number(mark.amount),
                                }))}
                              />
                            </Td>
                            <Td>
                              {row.has_penalty ? (
                                <span
                                  title="Penalized agents rank below clean agents at the same revenue and units."
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                                >
                                  <span aria-hidden>↓</span> Penalized
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-300">Clean</span>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!visibleRanking.length && (
                    <EmptyRow>No approved settlements in this period.</EmptyRow>
                  )}
                </>
              )}
            </Panel>
          </div>
      )}

      {view === "access" && (
        <AccessPanel salesEnabled={Boolean(dashboard?.tenant.sales_role_enabled)} />
      )}
      {view === "promotions" && (
        <Panel title="Promotions" description="Approve, then print the receipt for the manufacturer.">
          <div className="space-y-2">
            {promotions.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div>
                  <p className="font-mono text-xs text-amber-300">{doc.voucher_number}</p>
                  <p className="text-sm text-zinc-200">
                    {doc.lines.map((line) => `${line.item_name} × ${qty(line.quantity)}`).join(", ")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {doc.date} · {money(doc.total)} · {doc.manufacturers.join(", ") || "no manufacturer"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={doc.status} tone={statusTone(doc.status)} />
                  {doc.status === "PENDING_MANAGER" && (
                    <>
                      <IconAction
                        tone="emerald"
                        onClick={() => decidePromotion(doc.id, "APPROVED")}
                        pending={decidingKey === `promotion-${doc.id}-APPROVED`}
                        disabled={decidingKey !== null}
                      />
                      <IconAction
                        tone="rose"
                        onClick={() => decidePromotion(doc.id, "REJECTED")}
                        pending={decidingKey === `promotion-${doc.id}-REJECTED`}
                        disabled={decidingKey !== null}
                      />
                    </>
                  )}
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
            {!promotions.length && <EmptyRow>No promotions raised yet.</EmptyRow>}
          </div>
        </Panel>
      )}

      {view === "assets" && (
        <div className="space-y-4">
          <Panel
            title="Register assets"
            description="Batch entry with Cloudinary photos, live condition and straight-line depreciation. Finance assigns custody after registration."
            actions={
              <span className="hidden items-center gap-1.5 rounded-full border border-role-1/30 bg-role-1/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-role-1 uppercase sm:inline-flex">
                <Sparkles className="size-3" /> Batch mode
              </span>
            }
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-role-1/25 bg-linear-to-r from-role-1/[0.12] via-role-1/[0.04] to-transparent px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="role-gradient-bg grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-[0_10px_24px_-12px_var(--role-1)]">
                  <Warehouse className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">New asset batch</p>
                  <p className="text-[10px] tabular-nums text-zinc-400">
                    {assetRows.length} {assetRows.length === 1 ? "row" : "rows"} ·{" "}
                    {qty(assetBatchUnits)} units · {money(assetBatchValue)}
                  </p>
                </div>
              </div>
              {assetRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAssetRows([blankAsset()])}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-white/20 hover:text-white"
                >
                  Reset batch
                </button>
              )}
            </div>
            <div className="space-y-3">
              {assetRows.map((row, index) => {
                const lineTotal =
                  Number(row.unit_cost || 0) * Number(row.quantity || 0);
                const annualDepreciation =
                  Number(row.unit_cost || 0) /
                  Math.max(1, Number(row.useful_life_years) || 1);
                return (
                <div
                  key={row.id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b13]/60 transition hover:border-white/15"
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-role-1/60 to-transparent" />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="role-gradient-bg flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-[0_8px_18px_-10px_var(--role-1)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                          Asset row
                        </p>
                        <p className="truncate text-xs font-medium text-zinc-200">
                          {row.name.trim() || "Untitled asset"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] tabular-nums text-zinc-400">
                        {money(lineTotal)}
                      </span>
                      {assetRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAssetRows((rows) => rows.filter((item) => item.id !== row.id))
                          }
                          aria-label={`Remove asset ${index + 1}`}
                          className="rounded-md border border-rose-400/20 p-1 text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 p-3 lg:grid-cols-[210px_minmax(0,1fr)]">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                          <Camera className="size-3" /> Photo
                        </span>
                        <span className="text-[9px] text-sky-300/80">Cloudinary</span>
                      </div>
                      <label
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          void uploadAssetRowPhoto(row.id, event.dataTransfer.files?.[0]);
                        }}
                        className={`group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed text-center transition ${
                          row.photo_url
                            ? "border-transparent bg-black/40 ring-1 ring-role-1/30"
                            : row.uploading
                              ? "border-role-1/50 bg-role-1/5"
                              : "border-white/15 bg-black/20 hover:border-role-1/40 hover:bg-white/[0.04]"
                        }`}
                      >
                        {row.photo_url ? (
                          <>
                            <img
                              src={row.photo_url}
                              alt={row.name || "Asset"}
                              className="absolute inset-0 size-full object-cover"
                            />
                            <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-md bg-black/70 px-2 py-1 text-[10px] text-zinc-300 backdrop-blur">
                              <span className="truncate">
                                {row.photo_name || "Cloudinary photo"}
                              </span>
                              <span className="shrink-0 text-sky-300">Replace</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300 transition group-hover:scale-105 group-hover:text-white">
                              {row.uploading ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Camera className="size-4" />
                              )}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-300">
                              {row.uploading ? "Uploading to Cloudinary…" : "Drop or browse"}
                            </span>
                            <span className="text-[9px] text-zinc-500">PNG / JPG · max 5 MB</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={row.uploading || busy}
                          onChange={(event) => {
                            void uploadAssetRowPhoto(row.id, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {row.photo_url && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAssetRow(row.id, {
                              photo: "",
                              photo_url: "",
                              photo_name: "",
                            })
                          }
                          className="mt-1.5 w-full text-[10px] text-rose-300/80 transition hover:text-rose-200"
                        >
                          Remove photo
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <section>
                        <div className="mb-2 flex items-center gap-1.5">
                          <ScanLine className="size-3 text-role-1" />
                          <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                            Identity
                          </span>
                          <span className="h-px flex-1 bg-white/5" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Field label="Asset name">
                              <Input
                                value={row.name}
                                placeholder="e.g. MacBook Pro 14″"
                                className="h-10 bg-white/[0.04] text-[13px] font-medium"
                                onChange={(event) =>
                                  updateAssetRow(row.id, { name: event.target.value })
                                }
                              />
                            </Field>
                          </div>
                          <Field label="Category">
                            <CategoryCombobox
                              value={row.category}
                              onChange={(category) =>
                                updateAssetRow(row.id, { category })
                              }
                              className="h-10 w-full text-xs"
                            />
                          </Field>
                          <Field label="Brand / model">
                            <Input
                              value={row.brand_model}
                              placeholder="Optional"
                              className="h-10"
                              onChange={(event) =>
                                updateAssetRow(row.id, {
                                  brand_model: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <div className="sm:col-span-2">
                            <Field label="Serial number">
                              <Input
                                value={row.serial_number}
                                placeholder="e.g. C02X-8842"
                                className="h-10 font-mono text-[12px] tracking-wide"
                                onChange={(event) =>
                                  updateAssetRow(row.id, {
                                    serial_number: event.target.value,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        </div>
                      </section>

                      <section>
                        <div className="mb-2 flex items-center gap-1.5">
                          <Wallet className="size-3 text-role-1" />
                          <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                            Acquisition & value
                          </span>
                          <span className="h-px flex-1 bg-white/5" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Quantity">
                            <Input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(event) =>
                                updateAssetRow(row.id, { quantity: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Unit cost">
                            <Input
                              type="number"
                              step="0.01"
                              value={row.unit_cost}
                              onChange={(event) =>
                                updateAssetRow(row.id, { unit_cost: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Useful life (years)">
                            <Input
                              type="number"
                              min="1"
                              value={row.useful_life_years}
                              onChange={(event) =>
                                updateAssetRow(row.id, {
                                  useful_life_years: event.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-[10px] text-zinc-400">
                          <span>
                            Line total{" "}
                            <strong className="font-medium tabular-nums text-zinc-200">
                              {money(lineTotal)}
                            </strong>
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span>
                            Depreciates{" "}
                            <strong className="font-medium tabular-nums text-amber-300">
                              {money(annualDepreciation)}
                            </strong>{" "}
                            / year
                          </span>
                        </div>
                      </section>

                      <section>
                        <div className="mb-2 flex items-center gap-1.5">
                          <ShieldCheck className="size-3 text-role-1" />
                          <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                            Condition at registration
                          </span>
                          <span className="h-px flex-1 bg-white/5" />
                        </div>
                        <RadioGroup
                          value={row.condition_at_registration}
                          onValueChange={(value) =>
                            updateAssetRow(row.id, { condition_at_registration: value })
                          }
                          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        >
                          {ASSET_CONDITIONS.map(([code, text]) => {
                            const active = row.condition_at_registration === code;
                            return (
                              <label
                                key={code}
                                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-2.5 py-2 transition ${
                                  active
                                    ? `${ASSET_CONDITION_TONES[code]} shadow-[0_10px_24px_-18px_currentColor]`
                                    : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                                }`}
                              >
                                <span className="flex items-center gap-1.5 text-[11px] font-medium">
                                  <RadioGroupItem value={code} />
                                  {text}
                                </span>
                                <span className="pl-5 text-[9px] opacity-70">
                                  {ASSET_CONDITION_HINTS[code]}
                                </span>
                              </label>
                            );
                          })}
                        </RadioGroup>
                      </section>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">Rows</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {assetRows.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">Total units</p>
                <p className="text-sm font-semibold tabular-nums text-zinc-100">
                  {qty(assetBatchUnits)}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">Batch value</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-300">
                  {money(assetBatchValue)}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                  Depreciation / yr
                </p>
                <p className="text-sm font-semibold tabular-nums text-amber-300">
                  {money(assetBatchDepreciation)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-dashed border-white/15 bg-white/[0.02] text-xs text-zinc-300 hover:text-white"
                onClick={() => setAssetRows((rows) => [...rows, blankAsset()])}
              >
                <Plus className="size-3.5" /> Add another asset
              </Button>
              <Button
                onClick={createAssets}
                disabled={busy}
                className="flex-1 gap-2 role-gradient-bg border-0 text-white shadow-[0_14px_30px_-16px_var(--role-1)] hover:opacity-90"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Warehouse className="size-3.5" />
                )}
                {busy
                  ? "Registering…"
                  : assetRows.length > 1
                    ? `Register ${assetRows.length} assets`
                    : "Register asset"}
              </Button>
            </div>
          </Panel>

          <Panel
            title="Asset register"
            description="Read-only here — Finance assigns and releases."
            actions={
              <ReportExportButtons
                title="Asset register"
                headers={[
                  "Tag",
                  "Name",
                  "Category",
                  "Serial",
                  "Qty",
                  "Status",
                  "Assignee",
                  "Unit cost",
                  "Total cost",
                  "Condition",
                ]}
                rows={assetMatrix}
                file="volosync-assets"
                business={reportingBusiness}
              />
            }
          >
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
              <CategoryCombobox
                value={assetFilters.category}
                onChange={(category) => applyAssetFilters({ category })}
                allLabel="All categories"
                className="h-8 w-40 text-xs"
              />
              <OptionCombobox
                value={assetFilters.condition}
                onChange={(condition) => applyAssetFilters({ condition })}
                options={[["", "All conditions"], ...ASSET_CONDITIONS]}
                placeholder="All conditions"
                className="h-8 w-40 text-xs"
              />
              <OptionCombobox
                value={assetFilters.status}
                onChange={(status) => applyAssetFilters({ status })}
                options={[
                  ["", "All statuses"],
                  ["AVAILABLE", "Available"],
                  ["ASSIGNED", "Assigned"],
                ]}
                placeholder="All statuses"
                className="h-8 w-36 text-xs"
              />
              {(assetFilters.category || assetFilters.status || assetFilters.condition) && (
                <button
                  type="button"
                  onClick={() =>
                    applyAssetFilters({ category: "", status: "", condition: "" })
                  }
                  className="text-[11px] text-zinc-400 hover:text-white"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <TableSearch
                value={assetQuery}
                onChange={setAssetQuery}
                placeholder="Search tag, name or assignee"
                className="w-64 sm:w-72"
              />
              <span className="text-xs text-zinc-500">
                <span className="font-semibold text-zinc-300">{visibleAssets.length}</span> of{" "}
                {assets.length} asset{assets.length === 1 ? "" : "s"}
              </span>
            </div>

            {booting && !assets.length ? (
              <div className="space-y-2">
                {[0, 1, 2].map((index) => (
                  <SkeletonRow key={index} />
                ))}
              </div>
            ) : (
              <div className="max-h-[460px] overflow-auto">
                <table className="w-full min-w-[880px]">
                  <thead>
                    <tr>
                      <ThSt>Tag</ThSt>
                      <ThSt>Asset</ThSt>
                      <ThSt>Condition</ThSt>
                      <ThSt>Status</ThSt>
                      <ThSt>Assignee</ThSt>
                      <ThSt right>Unit cost</ThSt>
                      <ThSt right>Total cost</ThSt>
                      <ThSt right>Actions</ThSt>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-white/[0.02]">
                        <Td className="font-mono text-xs text-amber-300">{asset.asset_tag}</Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            {asset.photo ? (
                              <img
                                src={asset.photo}
                                alt={asset.name}
                                className="size-8 shrink-0 rounded-lg border border-white/10 object-cover"
                              />
                            ) : (
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500">
                                <ImageIcon className="size-3.5" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-zinc-200">{asset.name}</span>
                              <span className="block truncate text-[11px] text-zinc-500">
                                {asset.serial_number || "no serial"}
                              </span>
                            </span>
                          </span>
                        </Td>
                        <Td>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                              ASSET_CONDITION_TONES[asset.condition_at_registration] ??
                              "border-white/10 bg-white/[0.04] text-zinc-300"
                            }`}
                          >
                            {ASSET_CONDITIONS.find(
                              ([code]) => code === asset.condition_at_registration,
                            )?.[1] ?? asset.condition_at_registration}
                          </span>
                        </Td>
                        <Td>
                          <StatusPill
                            status={asset.status}
                            tone={asset.status === "ASSIGNED" ? "violet" : "emerald"}
                          />
                        </Td>
                        <Td className="text-zinc-400">{asset.assignee_name || "—"}</Td>
                        <Td right>{money(asset.unit_cost)}</Td>
                        <Td right className="text-emerald-300">
                          {money(Number(asset.unit_cost) * Number(asset.quantity))}
                        </Td>
                        <Td right>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openAssetEditor(asset)}
                              aria-label={`Edit ${asset.name}`}
                              className="rounded-md border border-white/15 p-1.5 text-zinc-300 transition hover:border-white/30 hover:text-white"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAssetDeleteTarget(asset)}
                              aria-label={`Delete ${asset.name}`}
                              className="rounded-md border border-rose-400/20 p-1.5 text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!booting && !visibleAssets.length && (
              <EmptyRow>No assets match these filters.</EmptyRow>
            )}
          </Panel>

          <Dialog
            open={assetEdit !== null}
            onOpenChange={(open) => {
              if (!open && !assetSaving) setAssetEdit(null);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/10 bg-[#0b0b13] text-white ring-white/10 sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Pencil className="size-4 text-role-1" />
                  Edit {assetEdit?.asset_tag ?? "asset"}
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Update the registration details. The tag, custody and status stay with
                  Finance.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Camera className="size-3 text-role-1" />
                    <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                      Photo
                    </span>
                    <span className="h-px flex-1 bg-white/5" />
                    <span className="text-[9px] text-sky-300/80">Cloudinary</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2">
                    {assetEditForm.photo ? (
                      <img
                        src={assetEditForm.photo}
                        alt={assetEditForm.name || "Asset"}
                        className="size-16 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <span className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed border-white/15 text-zinc-600">
                        <Camera className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-zinc-300">
                        {assetEditForm.photo ? "Cloudinary photo attached" : "No photo yet"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <label
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/15 px-2 py-1 text-[10px] text-zinc-300 transition hover:border-white/30 hover:text-white ${
                            assetEditUploading ? "pointer-events-none opacity-60" : ""
                          }`}
                        >
                          {assetEditUploading ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Camera className="size-3" />
                          )}
                          {assetEditForm.photo ? "Replace" : "Add photo"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              void uploadAssetEditPhoto(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        {assetEditForm.photo && (
                          <button
                            type="button"
                            onClick={() => setAssetEditForm((form) => ({ ...form, photo: "" }))}
                            className="rounded-md border border-rose-400/20 px-2 py-1 text-[10px] text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/10"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Warehouse className="size-3 text-role-1" />
                    <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                      Identity
                    </span>
                    <span className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Asset name">
                        <Input
                          value={assetEditForm.name}
                          placeholder="e.g. MacBook Pro 14″"
                          className="h-10 bg-white/[0.04] text-[13px] font-medium"
                          onChange={(event) =>
                            setAssetEditForm((form) => ({ ...form, name: event.target.value }))
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Category">
                      <CategoryCombobox
                        value={assetEditForm.category}
                        onChange={(category) =>
                          setAssetEditForm((form) => ({ ...form, category }))
                        }
                        className="h-10 w-full text-xs"
                      />
                    </Field>
                    <Field label="Brand / model">
                      <Input
                        value={assetEditForm.brand_model}
                        placeholder="Optional"
                        className="h-10"
                        onChange={(event) =>
                          setAssetEditForm((form) => ({
                            ...form,
                            brand_model: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Serial number">
                        <Input
                          value={assetEditForm.serial_number}
                          placeholder="e.g. C02X-8842"
                          className="h-10 font-mono text-[12px] tracking-wide"
                          onChange={(event) =>
                            setAssetEditForm((form) => ({
                              ...form,
                              serial_number: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Wallet className="size-3 text-role-1" />
                    <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                      Acquisition & value
                    </span>
                    <span className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Quantity">
                      <Input
                        type="number"
                        min="1"
                        value={assetEditForm.quantity}
                        onChange={(event) =>
                          setAssetEditForm((form) => ({
                            ...form,
                            quantity: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Unit cost">
                      <Input
                        type="number"
                        step="0.01"
                        value={assetEditForm.unit_cost}
                        onChange={(event) =>
                          setAssetEditForm((form) => ({
                            ...form,
                            unit_cost: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Useful life (years)">
                      <Input
                        type="number"
                        min="1"
                        value={assetEditForm.useful_life_years}
                        onChange={(event) =>
                          setAssetEditForm((form) => ({
                            ...form,
                            useful_life_years: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="size-3 text-role-1" />
                    <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                      Condition at registration
                    </span>
                    <span className="h-px flex-1 bg-white/5" />
                  </div>
                  <RadioGroup
                    value={assetEditForm.condition_at_registration}
                    onValueChange={(value) =>
                      setAssetEditForm((form) => ({
                        ...form,
                        condition_at_registration: value,
                      }))
                    }
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    {ASSET_CONDITIONS.map(([code, text]) => {
                      const active = assetEditForm.condition_at_registration === code;
                      return (
                        <label
                          key={code}
                          className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-2.5 py-2 transition ${
                            active
                              ? `${ASSET_CONDITION_TONES[code]} shadow-[0_10px_24px_-18px_currentColor]`
                              : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-[11px] font-medium">
                            <RadioGroupItem value={code} />
                            {text}
                          </span>
                          <span className="pl-5 text-[9px] opacity-70">
                            {ASSET_CONDITION_HINTS[code]}
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </section>
              </div>

              <DialogFooter className="mt-1 mb-0 gap-2 border-white/10 bg-transparent p-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssetEdit(null)}
                  disabled={assetSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveAssetEdit}
                  disabled={assetSaving || assetEditUploading}
                  className="gap-2"
                >
                  {assetSaving && <Loader2 className="size-3.5 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={assetDeleteTarget !== null}
            onOpenChange={(open) => {
              if (!open && !assetDeleting) setAssetDeleteTarget(null);
            }}
          >
            <AlertDialogContent className="border border-white/10 bg-[#0b0b13] text-white ring-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Delete this asset?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  {assetDeleteTarget && (
                    <>
                      <span className="font-medium text-zinc-200">
                        {assetDeleteTarget.name}
                      </span>{" "}
                      ({assetDeleteTarget.asset_tag}) will be removed permanently, along
                      with its custody history. This cannot be undone.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="border-white/10 bg-transparent">
                <AlertDialogCancel
                  disabled={assetDeleting}
                  className="border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={assetDeleting}
                  onClick={(event) => {
                    event.preventDefault();
                    void deleteAsset();
                  }}
                  className="gap-2 bg-rose-500/90 text-white hover:bg-rose-500"
                >
                  {assetDeleting && <Loader2 className="size-3.5 animate-spin" />}
                  Delete asset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
            inventory={reportSummary?.rows ?? []}
            promotions={promotions}
            range={reportWindow}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <InventoryReportingCard
              rows={reportSummary?.rows ?? []}
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
              agentOptions={agents.map((agent) => ({
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
                input: Number(summaryTotals?.total_input_vat ?? summaryTotals?.vat ?? 0),
                output: Number(summaryTotals?.total_output_vat ?? summaryTotals?.output_vat ?? 0),
                net: Number(summaryTotals?.net_vat ?? 0),
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
                registered_value: Number(summaryTotals?.registered_value ?? 0),
                in_store_value: Number(summaryTotals?.in_store_value ?? 0),
                stocked_out_value: Number(summaryTotals?.stocked_out_value ?? 0),
                base_value: Number(summaryTotals?.base_value ?? 0),
                vat: Number(summaryTotals?.total_input_vat ?? summaryTotals?.vat ?? 0),
                inclusive_amount: Number(summaryTotals?.inclusive_amount ?? 0),
                output_vat: Number(summaryTotals?.total_output_vat ?? summaryTotals?.output_vat ?? 0),
                net_vat: Number(summaryTotals?.net_vat ?? 0),
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
                  className="w-60"
                />
              }
            >
              {visibleRecentRegistrations.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr>
                        <Th>Voucher</Th>
                        <Th>Items</Th>
                        <Th>Supplier</Th>
                        <Th>Requested</Th>
                        <Th>Status</Th>
                        <Th right>Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecentRegistrations.map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02]">
                          <Td className="font-mono text-xs text-cyan-300">
                            {row.voucher_number}
                          </Td>
                          <Td>{row.lines.map((line) => line.item_name).join(", ") || "—"}</Td>
                          <Td className="text-zinc-400">{row.supplier_name || "—"}</Td>
                          <Td className="text-zinc-400">{stamp(row.created_at)}</Td>
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
                  className="w-60"
                />
              }
            >
              {visibleRecentMovements.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr>
                        <Th>When</Th>
                        <Th>Item</Th>
                        <Th>Voucher</Th>
                        <Th>Recorded by</Th>
                        <Th right>Change</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecentMovements.map((row) => {
                        const delta = Number(row.quantity_delta);
                        return (
                          <tr key={row.id} className="hover:bg-white/[0.02]">
                            <Td className="text-zinc-400">{stamp(row.at)}</Td>
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
                  className="w-60"
                />
              }
            >
              {visibleRecentPromotions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr>
                        <Th>Voucher</Th>
                        <Th>Items</Th>
                        <Th>Mode</Th>
                        <Th>Requested</Th>
                        <Th>Status</Th>
                        <Th right>Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecentPromotions.map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02]">
                          <Td className="font-mono text-xs text-violet-300">
                            {row.voucher_number}
                          </Td>
                          <Td>
                            {row.manufacturers.join(", ") ||
                              row.lines.map((line) => line.item_name).join(", ") ||
                              "—"}
                          </Td>
                          <Td className="text-zinc-400">{row.mode.toLowerCase()}</Td>
                          <Td className="text-zinc-400">{stamp(row.created_at)}</Td>
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
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">{label}</Label>
      {children}
    </div>
  );
}

function IconAction({
  tone,
  onClick,
  pending = false,
  disabled = false,
}: {
  tone: "emerald" | "rose";
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || pending}
      className={`rounded-md border p-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "emerald"
          ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10"
          : "border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
      }`}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : tone === "emerald" ? (
        <Check className="size-3.5" />
      ) : (
        <X className="size-3.5" />
      )}
    </button>
  );
}

function QueuePanel({
  title,
  description,
  empty,
  rows,
}: {
  title: string;
  description: string;
  empty: string;
  rows: {
    id: number;
    reference: string;
    title: string;
    detail: string;
    note?: React.ReactNode;
    approve: () => void;
    reject: () => void;
    pending?: "approve" | "reject" | null;
    busy?: boolean;
  }[];
}) {
  return (
    <Panel title={title} description={description}>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={`${title}-${row.id}-${row.reference}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
          >
            <div>
              <p className="font-mono text-xs text-violet-300">{row.reference}</p>
              <p className="text-sm text-zinc-200">{row.title}</p>
              <p className="text-xs text-zinc-500">{row.detail}</p>
              {row.note}
            </div>
            <span className="flex gap-1">
              <IconAction
                tone="emerald"
                onClick={row.approve}
                pending={row.pending === "approve"}
                disabled={row.busy}
              />
              <IconAction
                tone="rose"
                onClick={row.reject}
                pending={row.pending === "reject"}
                disabled={row.busy}
              />
            </span>
          </div>
        ))}
        {!rows.length && <EmptyRow>{empty}</EmptyRow>}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ constants

const RANKING_PERIODS: [RankingPeriod, string][] = [
  ["alltime", "All-time"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["halfyear", "Half-year"],
  ["yearly", "Yearly"],
];

const RANKING_PERIOD_LABELS: Record<RankingPeriod, string> = {
  alltime: "All-time",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  halfyear: "Half-year",
  yearly: "Yearly",
};

// Canonical backend codes (assets.models.Asset.CATEGORIES).
const ASSET_CATEGORIES: [string, string][] = [
  ["IT_EQUIPMENT", "IT equipment"],
  ["FURNITURE", "Furniture"],
  ["VEHICLE", "Vehicle"],
  ["MACHINERY", "Machinery"],
  ["TOOL", "Tool"],
  ["OTHER", "Other"],
];

const assetCategoryLabel = (code: string) =>
  ASSET_CATEGORIES.find(([value]) => value === code)?.[1] ?? code;

// Canonical backend codes (assets.models.Asset.CONDITIONS).
const ASSET_CONDITIONS: [string, string][] = [
  ["NEW", "New"],
  ["GOOD", "Good"],
  ["FAIR", "Fair"],
  ["DAMAGED", "Damaged"],
];

const ASSET_CONDITION_TONES: Record<string, string> = {
  NEW: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  GOOD: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  FAIR: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  DAMAGED: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const ASSET_CONDITION_HINTS: Record<string, string> = {
  NEW: "Sealed / unused",
  GOOD: "Minor wear",
  FAIR: "Visible wear",
  DAMAGED: "Needs repair",
};

function OptionCombobox({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(([option]) => option === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between border-white/10 bg-white/[0.03] font-normal text-zinc-200 hover:bg-white/[0.06] ${className ?? "h-9"}`}
        >
          <span className={`truncate ${selected ? "" : "text-zinc-500"}`}>
            {selected?.[1] ?? placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) border-white/10 bg-zinc-900 p-0"
      >
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {options.map(([option, label]) => (
                <CommandItem
                  key={`${option}-${label}`}
                  value={label}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`size-3.5 ${value === option ? "opacity-100" : "opacity-0"}`}
                  />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CategoryCombobox({
  value,
  onChange,
  allLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  className?: string;
}) {
  const options: [string, string][] = allLabel
    ? [["", allLabel], ...ASSET_CATEGORIES]
    : ASSET_CATEGORIES;
  return (
    <OptionCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select category"
      className={className}
    />
  );
}

// ------------------------------------------------------------------ widgets

function ThSt({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`sticky top-0 z-10 border-b border-white/10 bg-zinc-900 px-3 py-2 text-[11px] font-semibold tracking-wider whitespace-nowrap text-zinc-500 uppercase ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="size-7 shrink-0 animate-pulse rounded-full bg-white/10" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/5" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
      : rank === 2
        ? "bg-zinc-300/15 text-zinc-100 ring-1 ring-zinc-300/40"
        : rank === 3
          ? "bg-orange-400/15 text-orange-300 ring-1 ring-orange-400/40"
          : "bg-white/5 text-zinc-500";
  return (
    <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${tone}`}>
      {rank}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Access — managers create/remove staff logins for their own tenant.  */
/* Owners are not manageable here: they sign in on the mobile app.     */
/* ------------------------------------------------------------------ */

const ACCESS_ROLES = ["STORE", "FINANCE", "HR", "SALES"] as const;

type StaffRow = {
  id: number;
  profile_id: number;
  username: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
};

function AccessPanel({ salesEnabled }: { salesEnabled: boolean }) {
  const [rows, setRows] = React.useState<StaffRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({
    username: "",
    password: "",
    role: "STORE" as (typeof ACCESS_ROLES)[number],
  });
  const [busy, setBusy] = React.useState(false);
  const [rowAction, setRowAction] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .staff()
      .then((res) => {
        setRows(res.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const takenRoles = new Set(rows.map((row) => row.role));
  // The Sales role only exists while the tenant has it switched on.
  const roles = React.useMemo(
    () => ACCESS_ROLES.filter((role) => role !== "SALES" || salesEnabled),
    [salesEnabled],
  );

  React.useEffect(() => {
    setForm((current) => {
      const used = new Set(rows.map((row) => row.role));
      if (roles.includes(current.role) && !used.has(current.role)) return current;
      const next = roles.find((role) => !used.has(role));
      return next ? { ...current, role: next } : current;
    });
  }, [rows, roles]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (form.role === "SALES" && !salesEnabled) {
      toast.error("Sales is switched off for this tenant.");
      return;
    }
    if (takenRoles.has(form.role)) {
      toast.error("That role already has an account. Delete it first.");
      return;
    }
    setBusy(true);
    try {
      await api.createStaff(form);
      toast.success(`${form.username} added — they must change the password at first login.`);
      setForm({ username: "", password: "", role: "STORE" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create this account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: StaffRow) {
    setRowAction(`${row.profile_id}:toggle`);
    try {
      await api.updateStaff(row.profile_id, { is_active: !row.is_active });
      toast.success(row.is_active ? `${row.username} suspended` : `${row.username} reactivated`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this account.");
    } finally {
      setRowAction(null);
    }
  }

  async function remove(row: StaffRow) {
    if (typeof window !== "undefined" && !window.confirm(`Delete ${row.username}? This cannot be undone.`)) {
      return;
    }
    setRowAction(`${row.profile_id}:delete`);
    try {
      await api.deleteStaff(row.profile_id);
      toast.success(`${row.username} removed`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete this account.");
    } finally {
      setRowAction(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
      <Panel
        title="Add a staff login"
        description={
          salesEnabled
            ? "Store, finance, HR and sales accounts for your tenant."
            : "Store, finance and HR accounts for your tenant."
        }
      >
        <form onSubmit={create} className="grid gap-3">
          <Field label="Username">
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="e.g. store-2"
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Temporary password">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Role">
            <RadioGroup
              value={form.role}
              onValueChange={(value) =>
                setForm({ ...form, role: value as (typeof ACCESS_ROLES)[number] })
              }
              className="grid grid-cols-2 gap-2"
            >
              {roles.map((role) => {
                const taken = takenRoles.has(role);
                return (
                  <label
                    key={role}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      taken
                        ? "cursor-not-allowed border-white/5 text-zinc-600"
                        : "cursor-pointer border-white/10 text-zinc-200"
                    }`}
                  >
                    <RadioGroupItem value={role} disabled={taken} />
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                    {taken && (
                      <span className="ml-auto text-[10px] tracking-wide text-zinc-600 uppercase">
                        In use
                      </span>
                    )}
                  </label>
                );
              })}
            </RadioGroup>
          </Field>
          {form.role === "SALES" && (
            <p className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-sky-200/90">
              This username becomes the tenant&apos;s one Sales login. Agents added in
              Agents are records under it — they get no separate passwords.
            </p>
          )}
          {!salesEnabled && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
              Sales is switched off for this tenant, so no Sales login can be created.
              Turn it on in VoloSync Admin first.
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Managers and owners are not created here — owners use the VoloSync Owner app.
          </p>
          <Button
            type="submit"
            disabled={
              busy || !roles.includes(form.role) || takenRoles.has(form.role)
            }
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
      </Panel>

      <Panel title="Staff access" description="Suspend or remove accounts in your tenant.">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading staff…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No staff accounts yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((row) => (
              <div key={row.profile_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {row.name}
                    <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">
                      {row.role}
                    </span>
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    @{row.username}
                    {row.is_active ? "" : " · suspended"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(row)}
                    disabled={rowAction !== null}
                    className="gap-1.5 border-white/10 text-xs text-zinc-300"
                  >
                    {rowAction === `${row.profile_id}:toggle` && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    {row.is_active ? "Suspend" : "Reactivate"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(row)}
                    disabled={rowAction !== null}
                    className="gap-1.5 border-rose-500/30 text-xs text-rose-300 hover:bg-rose-500/10"
                  >
                    {rowAction === `${row.profile_id}:delete` && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
