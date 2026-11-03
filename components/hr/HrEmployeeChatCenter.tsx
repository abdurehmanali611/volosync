"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ImagePlus, MessageSquare, Send, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fetchHrEmployees, type HrEmployee } from "@/lib/api/hrSource";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import {
  createHrChatDirectApi,
  createHrChatGroupApi,
  fetchHrChatMessages,
  fetchHrChatThreads,
  fetchHrChatUnreadCount,
  markHrChatThreadReadApi,
  sendHrChatMessageApi,
  type HrChatMessage,
  type HrChatThread,
} from "@/lib/api/hrChat";
import {
  isCloudinaryUploadConfigured,
  uploadImageFileToCloudinary,
} from "@/lib/cloudinaryUploadOptions";
import { cn } from "@/lib/utils";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";

const POLL_MS = 10000;
const CHAT_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,image/jfif";
const CHAT_MAX_IMAGES = 5;

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewForLastMessage(t: HrChatThread): string {
  const last = t.lastMessage;
  if (!last) return t.kind;
  if (last.body?.trim()) return last.body;
  if (last.imageUrl?.trim()) return "Photo";
  return t.kind;
}

/** Manager-facing label: never show bare "Manager" — use employee member names. */
function threadListTitle(
  t: HrChatThread,
  employeeNameById: Map<number, string>,
): string {
  const empNames = t.members
    .filter((m) => !m.isManager)
    .map((m) => {
      const id = m.employeeId != null ? Number(m.employeeId) : null;
      return (
        (m.employeeName && m.employeeName !== "Manager"
          ? m.employeeName
          : null) ||
        (id != null ? employeeNameById.get(id) : null) ||
        null
      );
    })
    .filter((n): n is string => Boolean(n && n.trim()));

  const stored = String(t.title || "").trim();
  const storedIsManagerLabel = stored.toLowerCase() === "manager";

  if (t.kind === "group") {
    if (stored && !storedIsManagerLabel) return stored;
    if (empNames.length) return empNames.join(", ");
    return `Group #${t.id}`;
  }

  if (empNames.length === 1) return empNames[0];
  if (empNames.length > 1) return empNames.join(", ");
  if (stored && !storedIsManagerLabel) return stored;
  return `Chat #${t.id}`;
}

/** Manager (hotel) / Admin (café) live employee chat. Control lives under HR → Chat control. */
export function HrEmployeeChatCenter({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<HrChatThread[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<HrChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [pickEmpIds, setPickEmpIds] = useState<number[]>([]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickingFileRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [t, u, emps] = await Promise.all([
        fetchHrChatThreads(),
        fetchHrChatUnreadCount(),
        fetchHrEmployees(),
      ]);
      setThreads(t);
      setUnread(u);
      setEmployees(emps.filter((e) => e.status !== "terminated"));
    } catch {
      /* keep */
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibleInterval(() => {
    if (enabled) void load();
  }, POLL_MS);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) || null,
    [threads, activeId],
  );

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees) map.set(e.id, e.fullName);
    return map;
  }, [employees]);

  const labelForMessage = (m: HrChatMessage) => {
    if (m.senderEmployeeId != null && m.senderEmployeeId > 0) {
      return (
        employeeNameById.get(m.senderEmployeeId) ||
        (m.senderName !== "Manager" ? m.senderName : null) ||
        "Employee"
      );
    }
    if (m.senderIsManager) return "Manager";
    return m.senderName || "Employee";
  };

  const isManagerBubble = (m: HrChatMessage) =>
    Boolean(m.senderIsManager) &&
    !(m.senderEmployeeId != null && m.senderEmployeeId > 0);

  const loadMessages = useCallback(
    async (threadId: number, opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setMsgsLoading(true);
      try {
        const rows = await fetchHrChatMessages(threadId);
        setMessages(rows);
        await markHrChatThreadReadApi(threadId);
        void load();
      } catch (e) {
        if (!opts?.quiet) {
          toast.error(
            e instanceof Error ? e.message : "Could not load messages",
          );
        }
      } finally {
        if (!opts?.quiet) setMsgsLoading(false);
      }
    },
    [load],
  );

  useEffect(() => {
    if (activeId && open) void loadMessages(activeId);
  }, [activeId, open, loadMessages]);

  useVisibleInterval(() => {
    if (enabled && open && activeId) void loadMessages(activeId, { quiet: true });
  }, POLL_MS);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  const canSend =
    Boolean(draft.trim() || pendingImageUrls.length) &&
    !busy &&
    !uploadingImage;
  const atImageLimit = pendingImageUrls.length >= CHAT_MAX_IMAGES;

  const handlePickImage = () => {
    if (busy || uploadingImage || atImageLimit) return;
    pickingFileRef.current = true;
    const onWindowFocus = () => {
      window.setTimeout(() => {
        pickingFileRef.current = false;
      }, 0);
    };
    window.addEventListener("focus", onWindowFocus, { once: true });
    fileInputRef.current?.click();
  };

  const removePendingImage = (index: number) => {
    setPendingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    pickingFileRef.current = false;
    if (files.length === 0) return;

    const slotsLeft = CHAT_MAX_IMAGES - pendingImageUrls.length;
    if (slotsLeft <= 0) {
      toast.error(`You can attach up to ${CHAT_MAX_IMAGES} images at a time.`);
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Please choose image files (PNG, JPEG, or WebP).");
      return;
    }
    if (imageFiles.length < files.length) {
      toast.error("Some files were skipped because they are not images.");
    }

    const toUpload = imageFiles.slice(0, slotsLeft);
    if (imageFiles.length > slotsLeft) {
      toast.info(
        `Only ${slotsLeft} more image${slotsLeft === 1 ? "" : "s"} added (max ${CHAT_MAX_IMAGES}).`,
      );
    }

    setUploadingImage(true);
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        setUploadProgress(`Uploading ${i + 1}/${toUpload.length}…`);
        const url = await uploadImageFileToCloudinary(toUpload[i], {
          folder: "hotcol-hr-chat",
        });
        uploaded.push(url);
      }
      setPendingImageUrls((prev) =>
        [...prev, ...uploaded].slice(0, CHAT_MAX_IMAGES),
      );
    } catch (err) {
      if (uploaded.length > 0) {
        setPendingImageUrls((prev) =>
          [...prev, ...uploaded].slice(0, CHAT_MAX_IMAGES),
        );
      }
      toast.error(
        err instanceof Error ? err.message : "Image upload failed. Try again.",
      );
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const handleSend = async () => {
    if (!active || !canSend) return;
    const text = draft.trim();
    const images = pendingImageUrls.map((url) => url.trim()).filter(Boolean);
    setBusy(true);
    try {
      if (images.length === 0) {
        await sendHrChatMessageApi(active.id, text);
      } else {
        for (let i = 0; i < images.length; i++) {
          await sendHrChatMessageApi(
            active.id,
            i === 0 ? text : "",
            images[i],
          );
        }
      }
      setDraft("");
      setPendingImageUrls([]);
      await loadMessages(active.id, { quiet: true });
      draftRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSheetOpenChange = (next: boolean) => {
    if (!next && (uploadingImage || pickingFileRef.current)) return;
    setOpen(next);
  };

  if (!enabled) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label="Employee chat"
        >
          <MessageSquare className="h-4 w-4" />
          {unread > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1.5 -top-1.5 h-5 min-w-5 px-1 text-[10px]"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full max-w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Employee chat</SheetTitle>
          <SheetDescription>
            Message staff anytime. Blocks &amp; history live under HR → Chat
            control. Apex support stays on the other chat icon.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-start gap-2 border-b p-3">
            <div className="min-w-0 flex-1 basis-48">
              <HrEmployeeCombobox
                employees={employees}
                valueIds={pickEmpIds}
                onChange={setPickEmpIds}
                placeholder="Start chat with…"
                emptyText="No employees found."
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-10"
              disabled={pickEmpIds.length === 0 || busy}
              onClick={async () => {
                const employeeId = pickEmpIds[0];
                if (employeeId == null) return;
                setBusy(true);
                try {
                  const t = await createHrChatDirectApi({
                    employeeId,
                    includeManager: true,
                  });
                  setPickEmpIds([]);
                  await load();
                  setActiveId(t.id);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Could not start chat",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Open
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 gap-1.5"
              disabled={busy || employees.length === 0}
              onClick={() => setGroupOpen(true)}
            >
              <Users className="size-3.5" />
              Group
            </Button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[11rem_1fr] md:grid-cols-[12.5rem_1fr]">
            <ul className="max-h-40 space-y-0.5 overflow-y-auto border-b p-2 sm:max-h-none sm:border-b-0 sm:border-r">
              {threads.length === 0 ? (
                <li className="px-2 py-8 text-center text-xs text-muted-foreground">
                  No threads yet. Pick an employee above.
                </li>
              ) : (
                threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg px-2 py-2 text-left text-xs transition hover:bg-muted/70",
                        activeId === t.id && "bg-muted ring-1 ring-border",
                      )}
                      onClick={() => setActiveId(t.id)}
                    >
                      <p className="truncate font-medium">
                        {threadListTitle(t, employeeNameById)}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {previewForLastMessage(t)}
                      </p>
                      {t.lastMessage?.createdAt ? (
                        <p className="mt-0.5 text-[9px] text-muted-foreground/80">
                          {formatMsgTime(t.lastMessage.createdAt)}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="flex min-h-0 flex-col">
              <div className="min-h-48 flex-1 space-y-2 overflow-y-auto p-3">
                {!active ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <MessageSquare className="size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Select or start a conversation
                    </p>
                  </div>
                ) : msgsLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading…
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-14 text-center text-sm text-muted-foreground">
                    No messages yet — say hello.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex w-full",
                        isManagerBubble(m) ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "inline-block max-w-60 space-y-2 rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-68",
                          isManagerBubble(m)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] opacity-70">
                          <span className="font-medium">{labelForMessage(m)}</span>
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
                <div ref={endRef} />
              </div>
              {active ? (
                <div className="space-y-2 border-t p-3">
                  {pendingImageUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pendingImageUrls.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="relative inline-block"
                        >
                          <Image
                            src={url}
                            alt={`Attachment preview ${index + 1}`}
                            width={80}
                            height={80}
                            className="h-16 w-16 rounded-lg border object-cover"
                            unoptimized
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute -right-2 -top-2 h-5 w-5 rounded-full shadow-sm"
                            aria-label={`Remove image ${index + 1}`}
                            disabled={busy || uploadingImage}
                            onClick={() => removePendingImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={CHAT_IMAGE_ACCEPT}
                      multiple
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden
                      onChange={(e) => void handleImageFileChange(e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      disabled={busy || uploadingImage || atImageLimit}
                      aria-label="Attach images"
                      title={
                        !isCloudinaryUploadConfigured()
                          ? "Image upload not configured"
                          : atImageLimit
                            ? `Maximum ${CHAT_MAX_IMAGES} images`
                            : `Attach images (up to ${CHAT_MAX_IMAGES})`
                      }
                      onClick={() => {
                        if (!isCloudinaryUploadConfigured()) {
                          toast.error(
                            "Image upload is not configured. Add NEXT_PUBLIC_CLOUDINARY_PRESET_NAME and NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME to .env.local.",
                          );
                          return;
                        }
                        handlePickImage();
                      }}
                    >
                      {uploadingImage ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ImagePlus className="size-4" />
                      )}
                    </Button>
                    <Textarea
                      ref={draftRef}
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder={
                        uploadProgress ||
                        "Message… (Enter to send)"
                      }
                      className="min-h-10 resize-none"
                      disabled={busy || uploadingImage}
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      disabled={!canSend}
                      onClick={() => void handleSend()}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {uploadProgress ??
                      (atImageLimit
                        ? `${CHAT_MAX_IMAGES}/${CHAT_MAX_IMAGES} images · Enter to send`
                        : `Up to ${CHAT_MAX_IMAGES} images · Enter to send · Shift+Enter for new line`)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mgr-group-title">Title</Label>
            <Input
              id="mgr-group-title"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Optional group name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Members</Label>
            <HrEmployeeCombobox
              employees={employees}
              valueIds={groupMemberIds}
              onChange={setGroupMemberIds}
              multiple
              placeholder="Search & pick employees…"
              emptyText="No employees found."
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            You are included as Manager in the group automatically.
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              if (groupMemberIds.length < 1) {
                toast.error("Pick at least one employee");
                return;
              }
              setBusy(true);
              try {
                const t = await createHrChatGroupApi({
                  title: groupTitle.trim() || undefined,
                  employeeIds: groupMemberIds,
                  includeManager: true,
                });
                setGroupOpen(false);
                setGroupTitle("");
                setGroupMemberIds([]);
                await load();
                setActiveId(t.id);
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Could not create group",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
