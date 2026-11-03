"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarRange,
  Filter,
  History,
  Loader2,
  MessageSquareText,
  Search,
  ShieldOff,
  Trash2,
  UserRound,
  Users,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchHrEmployees, type HrEmployee } from "@/lib/api/hrSource";
import {
  createHrChatBlockApi,
  deleteHrChatBlockApi,
  fetchHrChatBlocks,
  fetchHrChatHistory,
  fetchHrChatMessages,
  type HrChatBlock,
  type HrChatMessage,
  type HrChatThread,
} from "@/lib/api/hrChat";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import { HrPanelShell, HrSectionCard } from "@/components/hr/hrChrome";
import { cn } from "@/lib/utils";

type ControlTab = "blocks" | "history";

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function threadMembersLabel(t: HrChatThread): string {
  return t.members
    .map((m) => (m.isManager ? "Manager" : m.employeeName || `#${m.employeeId}`))
    .join(", ");
}

/** Prefer employee names over a stored "Manager" title (emp-started threads). */
function threadDisplayTitle(t: HrChatThread): string {
  const empNames = t.members
    .filter((m) => !m.isManager)
    .map((m) => m.employeeName)
    .filter((n): n is string => Boolean(n && n.trim() && n !== "Manager"));
  const stored = String(t.title || "").trim();
  const storedIsManager = stored.toLowerCase() === "manager";

  if (t.kind === "group") {
    if (stored && !storedIsManager) return stored;
    if (empNames.length) return empNames.join(", ");
    return `Group #${t.id}`;
  }
  if (empNames.length === 1) return empNames[0];
  if (empNames.length > 1) return empNames.join(", ");
  if (stored && !storedIsManager) return stored;
  return `Thread #${t.id}`;
}

function FieldShell({
  label,
  icon,
  tone = "slate",
  children,
  className,
  hint,
}: {
  label: string;
  icon?: ReactNode;
  tone?: "rose" | "amber" | "emerald" | "violet" | "sky" | "slate";
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  const tones = {
    rose: "border-border/70 bg-background focus-within:ring-rose-400/20",
    amber: "border-border/70 bg-background focus-within:ring-amber-400/20",
    emerald:
      "border-border/70 bg-background focus-within:ring-emerald-400/20",
    violet:
      "border-border/70 bg-background focus-within:ring-primary/20",
    sky: "border-border/70 bg-background focus-within:ring-violet-400/20",
    slate: "border-border/70 bg-background focus-within:ring-primary/15",
  };
  const labelTone = {
    rose: "text-muted-foreground",
    amber: "text-muted-foreground",
    emerald: "text-muted-foreground",
    violet: "text-muted-foreground",
    sky: "text-muted-foreground",
    slate: "text-muted-foreground",
  };
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
            labelTone[tone],
          )}
        >
          {icon}
          {label}
        </Label>
        {hint ? (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <div
        className={cn(
          "rounded-xl border p-0.5 shadow-sm ring-0 transition focus-within:ring-2",
          tones[tone],
        )}
      >
        {children}
      </div>
    </div>
  );
}

function blockAlreadyExists(
  blocks: HrChatBlock[],
  pathType: "emp_emp" | "emp_manager",
  a: number,
  b: number | null,
): boolean {
  return blocks.some((row) => {
    if (row.pathType !== pathType) return false;
    if (pathType === "emp_manager") {
      return Number(row.employeeIdA) === a;
    }
    const x = Number(row.employeeIdA);
    const y = Number(row.employeeIdB);
    return (x === a && y === b) || (x === b && y === a);
  });
}

type BlockDraftLine = {
  key: string;
  employeeIdA: number | null;
  employeeIdB: number | null;
  note: string;
};

function emptyBlockLine(): BlockDraftLine {
  return {
    key: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeIdA: null,
    employeeIdB: null,
    note: "",
  };
}

/** Manager / Café Admin — Blocks + History with read-only message viewer. */
export function HrChatControlPanel() {
  const [tab, setTab] = useState<ControlTab>("blocks");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [blocks, setBlocks] = useState<HrChatBlock[]>([]);
  const [pathType, setPathType] = useState<"emp_emp" | "emp_manager">(
    "emp_manager",
  );
  const [blockLines, setBlockLines] = useState<BlockDraftLine[]>(() => [
    emptyBlockLine(),
  ]);
  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");
  const [filterEmp, setFilterEmp] = useState("all");
  const [kind, setKind] = useState("all");
  const [withManager, setWithManager] = useState("all");
  const [history, setHistory] = useState<HrChatThread[]>([]);
  const [historySearched, setHistorySearched] = useState(false);
  const [viewerThread, setViewerThread] = useState<HrChatThread | null>(null);
  const [viewerMessages, setViewerMessages] = useState<HrChatMessage[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockPendingDelete, setBlockPendingDelete] =
    useState<HrChatBlock | null>(null);
  const viewerEndRef = useRef<HTMLDivElement>(null);

  const updateBlockLine = useCallback(
    (key: string, patch: Partial<BlockDraftLine>) => {
      setBlockLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
      );
    },
    [],
  );

  const addBlockLine = useCallback(() => {
    setBlockLines((prev) => [...prev, emptyBlockLine()]);
  }, []);

  const removeBlockLine = useCallback((key: string) => {
    setBlockLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((l) => l.key !== key),
    );
  }, []);

  const validBlockLines = useMemo(() => {
    return blockLines.filter((l) => {
      if (!(l.employeeIdA != null && l.employeeIdA > 0)) return false;
      if (pathType === "emp_emp") {
        return (
          l.employeeIdB != null &&
          l.employeeIdB > 0 &&
          l.employeeIdB !== l.employeeIdA
        );
      }
      return true;
    });
  }, [blockLines, pathType]);

  const loadEmployees = useCallback(async () => {
    try {
      const emps = await fetchHrEmployees();
      setEmployees(emps.filter((e) => e.status !== "terminated"));
    } catch {
      /* keep */
    }
  }, []);

  const refreshBlocks = useCallback(async () => {
    try {
      setBlocks(await fetchHrChatBlocks());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load blocks");
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
    void refreshBlocks();
  }, [loadEmployees, refreshBlocks]);

  useEffect(() => {
    viewerEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [viewerMessages]);

  const openViewer = async (thread: HrChatThread) => {
    setViewerThread(thread);
    setViewerLoading(true);
    setViewerMessages([]);
    try {
      setViewerMessages(await fetchHrChatMessages(thread.id, 500));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load messages");
      setViewerThread(null);
    } finally {
      setViewerLoading(false);
    }
  };

  const mgrBlocks = blocks.filter((b) => b.pathType === "emp_manager").length;
  const empBlocks = blocks.filter((b) => b.pathType === "emp_emp").length;

  if (viewerThread) {
    return (
      <div className="p-4 md:p-6">
        <HrPanelShell>
          <HrSectionCard
            title={threadDisplayTitle(viewerThread)}
            description={`Read-only · ${viewerThread.kind} · ${threadMembersLabel(viewerThread)}`}
            icon={
              <MessageSquareText className="size-5 text-violet-400 dark:text-violet-400" />
            }
            accent="bg-linear-to-r from-violet-400/70 via-violet-500/60 to-primary/70"
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-border/70 bg-muted/40 text-foreground hover:bg-muted/60"
                onClick={() => {
                  setViewerThread(null);
                  setViewerMessages([]);
                }}
              >
                <ArrowLeft className="size-3.5" />
                Back to history
              </Button>
            }
          >
            <div className="flex max-h-[min(70vh,36rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
                {viewerLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    Loading messages…
                  </div>
                ) : viewerMessages.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    No messages in this thread.
                  </p>
                ) : (
                  viewerMessages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex w-full",
                        m.senderIsManager ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "inline-block max-w-60 space-y-2 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-68",
                          m.senderIsManager
                            ? "bg-primary text-primary-foreground"
                            : "bg-card ring-1 ring-border/50",
                        )}
                      >
                        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] opacity-70">
                          <span className="font-medium">{m.senderName}</span>
                          <span className="whitespace-nowrap">
                            {formatMsgTime(m.createdAt)}
                          </span>
                        </div>
                        {m.imageUrl ? (
                          <a
                            href={m.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg"
                          >
                            <Image
                              src={m.imageUrl}
                              alt="Chat attachment"
                              width={280}
                              height={200}
                              className="max-h-40 w-auto object-contain"
                              unoptimized
                            />
                          </a>
                        ) : null}
                        {m.body ? (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.body}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
                <div ref={viewerEndRef} />
              </div>
              <div className="border-t border-border/50 bg-muted/30 px-4 py-2.5 text-center text-xs text-muted-foreground">
                Audit view only — reply from the Employee chat icon in the
                header.
              </div>
            </div>
          </HrSectionCard>
        </HrPanelShell>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-6">
      <HrPanelShell>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                id: "blocks" as const,
                label: "Blocks",
                icon: ShieldOff,
                hint: "Stop emp↔emp or emp↔Manager paths",
                active:
                  "border-rose-500/30 bg-rose-500/8 ring-1 ring-rose-400/15",
                iconWrap:
                  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
              },
              {
                id: "history" as const,
                label: "History",
                icon: History,
                hint: "Search and review past threads",
                active:
                  "border-primary/30 bg-primary/8 ring-1 ring-primary/15",
                iconWrap:
                  "bg-primary/15 text-primary dark:text-primary",
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition",
                  active
                    ? t.active
                    : "border-border/60 bg-card/80 hover:border-border hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                    active ? t.iconWrap : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold tracking-tight">
                    {t.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {tab === "blocks" ? (
          <HrSectionCard
            title="Chat blocks"
            description="Blocked paths stop employees from starting or continuing those chats. Manager can still message out from the header chat."
            icon={<Ban className="size-5 text-rose-600 dark:text-rose-400" />}
            accent="bg-linear-to-r from-rose-500/50 via-orange-400/40 to-amber-400/40"
          >
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {blocks.length}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
                  ↔ Manager
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {mgrBlocks}
                </p>
              </div>
              <div className="col-span-2 rounded-2xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5 sm:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
                  ↔ Employee
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {empBlocks}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/12 text-rose-700 dark:text-rose-300">
                      <Ban className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-tight">
                        Add a block
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Choose a path, then the people involved
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Path type
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        [
                          {
                            id: "emp_manager" as const,
                            label: "Employee ↔ Manager",
                            hint: "One employee per line ↔ Manager",
                            icon: Building2,
                            active:
                              "border-emerald-500/30 bg-primary/8 ring-1 ring-emerald-400/20",
                            iconCls:
                              "bg-emerald-500/12 text-primary dark:text-primary",
                          },
                          {
                            id: "emp_emp" as const,
                            label: "Employee ↔ Employee",
                            hint: "One pair per line",
                            icon: Users,
                            active:
                              "border-violet-500/30 bg-violet-500/8 ring-1 ring-violet-400/20",
                            iconCls:
                              "bg-violet-500/12 text-violet-700 dark:text-violet-300",
                          },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const on = pathType === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPathType(opt.id);
                              setBlockLines([emptyBlockLine()]);
                            }}
                            className={cn(
                              "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                              on
                                ? opt.active
                                : "border-border/50 bg-background/60 hover:bg-muted/40",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                                on ? opt.iconCls : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <span>
                              <span className="block text-xs font-semibold">
                                {opt.label}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                {opt.hint}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Block lines
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {blockLines.length} line
                        {blockLines.length === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {blockLines.map((line, index) => (
                        <div
                          key={line.key}
                          className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm"
                        >
                          <div className="mb-2.5 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Line {index + 1}
                            </p>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-rose-600"
                              disabled={blockLines.length <= 1}
                              aria-label={`Remove line ${index + 1}`}
                              onClick={() => removeBlockLine(line.key)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>

                          <div className="grid gap-3">
                            <FieldShell
                              label="Employee A"
                              tone="amber"
                              icon={<UserRound className="size-3" />}
                            >
                              <HrEmployeeCombobox
                                employees={employees}
                                valueIds={
                                  line.employeeIdA != null
                                    ? [line.employeeIdA]
                                    : []
                                }
                                onChange={(ids) =>
                                  updateBlockLine(line.key, {
                                    employeeIdA: ids[0] ?? null,
                                  })
                                }
                                excludeIds={
                                  line.employeeIdB != null
                                    ? [line.employeeIdB]
                                    : []
                                }
                                placeholder="Search employee…"
                                variant="plain"
                              />
                            </FieldShell>

                            <FieldShell
                              label={
                                pathType === "emp_manager"
                                  ? "Side B"
                                  : "Employee B"
                              }
                              tone={
                                pathType === "emp_manager" ? "emerald" : "sky"
                              }
                              icon={
                                pathType === "emp_manager" ? (
                                  <Building2 className="size-3" />
                                ) : (
                                  <Users className="size-3" />
                                )
                              }
                            >
                              {pathType === "emp_manager" ? (
                                <Input
                                  value="Manager"
                                  disabled
                                  className="h-11 border-0 bg-transparent font-medium text-emerald-800 shadow-none dark:text-emerald-200"
                                />
                              ) : (
                                <HrEmployeeCombobox
                                  employees={employees}
                                  valueIds={
                                    line.employeeIdB != null
                                      ? [line.employeeIdB]
                                      : []
                                  }
                                  onChange={(ids) =>
                                    updateBlockLine(line.key, {
                                      employeeIdB: ids[0] ?? null,
                                    })
                                  }
                                  excludeIds={
                                    line.employeeIdA != null
                                      ? [line.employeeIdA]
                                      : []
                                  }
                                  placeholder="Search peer…"
                                  variant="plain"
                                />
                              )}
                            </FieldShell>

                            <FieldShell label="Note (optional)" tone="rose">
                              <Input
                                value={line.note}
                                onChange={(e) =>
                                  updateBlockLine(line.key, {
                                    note: e.target.value,
                                  })
                                }
                                placeholder="Reason for this block"
                                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                              />
                            </FieldShell>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 font-medium"
                      onClick={addBlockLine}
                    >
                      <Plus className="h-4 w-4" />
                      Add line
                    </Button>
                  </div>

                  <Button
                    type="button"
                    className="h-11 w-full bg-rose-600/90 text-white hover:bg-rose-600"
                    disabled={busy || validBlockLines.length === 0}
                    onClick={async () => {
                      const targets = validBlockLines.filter((l) => {
                        const a = l.employeeIdA!;
                        const b =
                          pathType === "emp_emp" ? l.employeeIdB : null;
                        return !blockAlreadyExists(blocks, pathType, a, b);
                      });

                      if (targets.length === 0) {
                        toast.info(
                          validBlockLines.length
                            ? "Those blocks already exist"
                            : "Complete at least one line",
                        );
                        return;
                      }

                      setBusy(true);
                      let ok = 0;
                      let failed = 0;
                      try {
                        for (const line of targets) {
                          try {
                            await createHrChatBlockApi({
                              pathType,
                              employeeIdA: line.employeeIdA!,
                              employeeIdB:
                                pathType === "emp_emp"
                                  ? line.employeeIdB
                                  : null,
                              note: line.note,
                            });
                            ok += 1;
                          } catch {
                            failed += 1;
                          }
                        }
                        setBlockLines([emptyBlockLine()]);
                        await refreshBlocks();
                        if (ok > 0 && failed === 0) {
                          toast.success(
                            ok === 1
                              ? "Block added"
                              : `${ok} blocks added`,
                          );
                        } else if (ok > 0) {
                          toast.warning(`${ok} added, ${failed} failed`);
                        } else {
                          toast.error("Could not add blocks");
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Ban className="mr-2 size-4" />
                    )}
                    {validBlockLines.length > 1
                      ? `Add ${validBlockLines.length} blocks`
                      : "Add block"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold tracking-tight">
                    Active blocks
                  </p>
                  <Badge className="border-border/60 bg-muted/50 text-foreground">
                    {blocks.length}
                  </Badge>
                </div>
                <ul className="max-h-112 space-y-2.5 overflow-y-auto pr-1">
                  {blocks.length === 0 ? (
                    <li className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-12 text-center">
                      <ShieldOff className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">No blocks yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Employees can chat freely within policy.
                      </p>
                    </li>
                  ) : (
                    blocks.map((b) => (
                      <li
                        key={b.id}
                        className={cn(
                          "flex min-h-20 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-4 shadow-sm",
                          b.pathType === "emp_manager"
                            ? "border-primary/20"
                            : "border-violet-500/20",
                        )}
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                b.pathType === "emp_manager"
                                  ? "border-primary/25 bg-primary/5 text-emerald-800 dark:text-emerald-200"
                                  : "border-violet-500/25 bg-violet-500/5 text-violet-800 dark:text-violet-200",
                              )}
                            >
                              {b.pathType === "emp_manager"
                                ? "↔ Manager"
                                : "↔ Employee"}
                            </Badge>
                            <p className="truncate text-sm font-semibold">
                              {b.pathType === "emp_manager"
                                ? `${b.employeeAName || b.employeeIdA} ↔ Manager`
                                : `${b.employeeAName || b.employeeIdA} ↔ ${b.employeeBName || b.employeeIdB}`}
                            </p>
                          </div>
                          {b.note ? (
                            <p className="text-xs text-muted-foreground">
                              {b.note}
                            </p>
                          ) : null}
                          <p className="text-[10px] text-muted-foreground">
                            {b.createdBy ? `By ${b.createdBy} · ` : ""}
                            {formatMsgTime(b.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-9 shrink-0 text-rose-600 hover:bg-rose-500/15 hover:text-rose-700"
                          aria-label="Remove block"
                          onClick={() => setBlockPendingDelete(b)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </HrSectionCard>
        ) : (
          <HrSectionCard
            title="Chat history"
            description="Search threads across the property. Open any result to read messages without joining the live chat."
            icon={
              <History className="size-5 text-primary dark:text-primary" />
            }
            accent="bg-linear-to-r from-primary/50 via-fuchsia-400/35 to-rose-400/35"
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary dark:text-primary">
                      <Filter className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-tight">
                        Search filters
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Narrow by date, person, and thread shape
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0 space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <CalendarRange className="size-3" />
                        From
                      </Label>
                      <HotelDayPicker
                        value={fromYmd}
                        onChange={setFromYmd}
                        compact
                        className="min-w-0 w-full"
                        buttonClassName="h-11 w-full min-w-0 rounded-xl border-border/70 bg-background shadow-sm hover:bg-background"
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <CalendarRange className="size-3" />
                        To
                      </Label>
                      <HotelDayPicker
                        value={toYmd}
                        onChange={setToYmd}
                        compact
                        className="min-w-0 w-full"
                        buttonClassName="h-11 w-full min-w-0 rounded-xl border-border/70 bg-background shadow-sm hover:bg-background"
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <UserRound className="size-3" />
                          Employee
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Optional
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background shadow-sm">
                        <HrEmployeeCombobox
                          employees={employees}
                          valueIds={
                            filterEmp !== "all" ? [Number(filterEmp)] : []
                          }
                          onChange={(ids) =>
                            setFilterEmp(
                              ids[0] != null ? String(ids[0]) : "all",
                            )
                          }
                          placeholder="Any employee…"
                          emptyText="No employees match."
                          variant="plain"
                        />
                      </div>
                      {filterEmp !== "all" ? (
                        <button
                          type="button"
                          className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                          onClick={() => setFilterEmp("all")}
                        >
                          Clear employee filter
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Thread type
                      </p>
                      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-background/70 p-1">
                        {(
                          [
                            { id: "all", label: "All" },
                            { id: "direct", label: "Direct" },
                            { id: "group", label: "Group" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setKind(opt.id)}
                            className={cn(
                              "rounded-lg px-2 py-2 text-center text-xs font-semibold transition",
                              kind === opt.id
                                ? "bg-primary/85 text-white shadow-sm"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        With Manager
                      </p>
                      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-background/70 p-1">
                        {(
                          [
                            { id: "all", label: "All" },
                            { id: "includes", label: "Incl. Mgr" },
                            { id: "emp_only", label: "Emp only" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setWithManager(opt.id)}
                            className={cn(
                              "rounded-lg px-1.5 py-2 text-center text-xs font-semibold transition",
                              withManager === opt.id
                                ? opt.id === "includes"
                                  ? "bg-emerald-600/85 text-white shadow-sm"
                                  : opt.id === "emp_only"
                                    ? "bg-violet-600/85 text-white shadow-sm"
                                    : "bg-primary/85 text-white shadow-sm"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={busy}
                    className="h-11 w-full bg-primary/90 text-white shadow-sm hover:bg-primary"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setHistory(
                          await fetchHrChatHistory({
                            fromYmd: fromYmd || undefined,
                            toYmd: toYmd || undefined,
                            employeeId:
                              filterEmp !== "all" ? Number(filterEmp) : null,
                            kind: kind === "all" ? undefined : kind,
                            withManager:
                              withManager === "all" ? undefined : withManager,
                          }),
                        );
                        setHistorySearched(true);
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Search failed",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 size-4" />
                    )}
                    Search history
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold tracking-tight">Results</p>
                {historySearched ? (
                  <Badge className="border-border/60 bg-muted/50 text-foreground">
                    {history.length} thread{history.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>

              <ul className="space-y-2.5">
                {!historySearched ? (
                  <li className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-14 text-center">
                    <Search className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Ready to search</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set filters above, then search to list threads.
                    </p>
                  </li>
                ) : history.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-14 text-center">
                    <History className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No matches</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No threads match these filters.
                    </p>
                  </li>
                ) : (
                  history.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="group flex w-full overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition hover:border-primary/30 hover:bg-muted/20"
                        onClick={() => void openViewer(t)}
                      >
                        <span
                          className={cn(
                            "w-1 shrink-0",
                            t.kind === "group"
                              ? "bg-fuchsia-400/50"
                              : "bg-primary/50",
                          )}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold tracking-tight">
                              {threadDisplayTitle(t)}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {t.kind}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {t.messageCount ?? 0} msgs
                            </Badge>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {threadMembersLabel(t)}
                          </span>
                          {t.lastMessage ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">
                                {t.lastMessage.senderName}:
                              </span>{" "}
                              {t.lastMessage.body ||
                                (t.lastMessage.imageUrl ? "Photo" : "")}
                            </span>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground">
                            Updated {formatMsgTime(t.updatedAt)} · Open to read
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </HrSectionCard>
        )}
      </HrPanelShell>
    </div>

    <AlertDialog
      open={blockPendingDelete != null}
      onOpenChange={(open) => {
        if (!open) setBlockPendingDelete(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this chat block?</AlertDialogTitle>
          <AlertDialogDescription>
            {blockPendingDelete
              ? blockPendingDelete.pathType === "emp_manager"
                ? `This will allow ${blockPendingDelete.employeeAName || `employee #${blockPendingDelete.employeeIdA}`} to chat with Manager again.`
                : `This will allow ${blockPendingDelete.employeeAName || `employee #${blockPendingDelete.employeeIdA}`} and ${blockPendingDelete.employeeBName || `employee #${blockPendingDelete.employeeIdB}`} to chat again.`
              : "This path will no longer be blocked."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              if (!blockPendingDelete) return;
              setBusy(true);
              try {
                await deleteHrChatBlockApi(blockPendingDelete.id);
                setBlockPendingDelete(null);
                toast.success("Block removed");
                await refreshBlocks();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Could not remove",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Remove block
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
