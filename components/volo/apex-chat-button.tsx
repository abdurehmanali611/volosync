"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apexChatApi, type ApexChatMessage, type ApexChatThread } from "@/lib/api";
import {
  isCloudinaryUploadConfigured,
  uploadImageFileToCloudinary,
} from "@/lib/cloudinaryUploadOptions";
import { cn } from "@/lib/utils";

const CHAT_MAX_IMAGES = 5;
const CHAT_IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/jfif";

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The wholesaler's side of the Apex conversation. One thread per property,
 * shared with the admin console's Messages section.
 */
export function ApexChatButton() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ApexChatThread | null>(null);
  const [messages, setMessages] = useState<ApexChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pickingFileRef = useRef(false);

  async function load() {
    const result = await apexChatApi.load();
    setThread(result.data.thread);
    setMessages(result.data.messages);
    return result.data;
  }

  // Badge: a quiet background poll, the same cadence as the employee channel.
  useEffect(() => {
    if (open) return;
    let cancelled = false;
    async function poll() {
      try {
        const data = await load();
        if (!cancelled) setThread(data.thread);
      } catch {
        // The badge simply stays as it was; opening the panel reports errors.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void poll();
    const timer = window.setInterval(poll, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function refresh() {
      try {
        const data = await load();
        if (cancelled) return;
        if ((data.thread?.unread_for_tenant ?? 0) > 0) {
          await apexChatApi.markRead().catch(() => undefined);
          setThread((current) =>
            current ? { ...current, unread_for_tenant: 0 } : current,
          );
        }
      } catch (cause) {
        if (!cancelled) {
          toast.error(cause instanceof Error ? cause.message : "Could not load the chat.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: "end" });
  }, [messages, pendingImages.length]);

  const unread = thread?.unread_for_tenant ?? 0;
  const atImageLimit = pendingImages.length >= CHAT_MAX_IMAGES;
  const canSend = Boolean(draft.trim() || pendingImages.length) && !busy && !uploading;

  function handleOpenChange(next: boolean) {
    // The native picker blurs the dialog; closing mid-upload would lose the batch.
    if (!next && (uploading || pickingFileRef.current)) return;
    setOpen(next);
  }

  function handlePickImage() {
    if (busy || uploading || atImageLimit) return;
    if (!isCloudinaryUploadConfigured()) {
      toast.error("Image upload is not configured.");
      return;
    }
    pickingFileRef.current = true;
    window.addEventListener(
      "focus",
      () => {
        window.setTimeout(() => {
          pickingFileRef.current = false;
        }, 0);
      },
      { once: true },
    );
    fileInputRef.current?.click();
  }

  function removePendingImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    pickingFileRef.current = false;
    if (!files.length) return;

    const slotsLeft = CHAT_MAX_IMAGES - pendingImages.length;
    if (slotsLeft <= 0) {
      toast.error(`Up to ${CHAT_MAX_IMAGES} images per message`);
      return;
    }
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length !== files.length) {
      toast.error("Only image files can be attached");
    }
    if (images.length > slotsLeft) {
      toast.error(`Only ${slotsLeft} more image${slotsLeft === 1 ? "" : "s"} can be attached`);
    }
    const batch = images.slice(0, slotsLeft);
    if (!batch.length) return;

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < batch.length; i += 1) {
        setUploadProgress(`Uploading ${i + 1}/${batch.length}…`);
        uploaded.push(
          await uploadImageFileToCloudinary(batch[i], { folder: "volosync-apex-chat" }),
        );
      }
      setPendingImages((prev) => [...prev, ...uploaded].slice(0, CHAT_MAX_IMAGES));
    } catch (cause) {
      if (uploaded.length) {
        setPendingImages((prev) => [...prev, ...uploaded].slice(0, CHAT_MAX_IMAGES));
      }
      toast.error(cause instanceof Error ? cause.message : "Image upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  async function send() {
    const text = draft.trim();
    const images = pendingImages;
    if ((!text && !images.length) || busy || uploading) return;
    setBusy(true);
    let sent = 0;
    try {
      if (images.length) {
        // One bubble per image; the caption rides on the first.
        for (let i = 0; i < images.length; i += 1) {
          const result = await apexChatApi.send(i === 0 ? text : "", images[i]);
          sent += 1;
          setThread(result.data.thread);
          setMessages(result.data.messages);
        }
        setPendingImages([]);
      } else {
        const result = await apexChatApi.send(text);
        setThread(result.data.thread);
        setMessages(result.data.messages);
      }
      setDraft("");
    } catch (cause) {
      if (sent) setPendingImages((prev) => prev.slice(sent));
      toast.error(cause instanceof Error ? cause.message : "Could not send the message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Chat with Apex"
        aria-label="Chat with Apex"
        onClick={() => setOpen(true)}
        className="relative size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
      >
        <MessageCircle className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] leading-4 font-semibold text-white ring-2 ring-[#0b0b13]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden border border-white/10 bg-[#0b0b13] p-0 text-white ring-white/10 sm:max-w-xl">
          <DialogHeader className="border-b border-white/10 px-4 py-3 text-left">
            <DialogTitle className="font-heading text-base">Chat with Apex</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              A direct line to the team that runs VoloSync — replies land here.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[240px] flex-1 space-y-2 overflow-y-auto p-4">
            {thread?.status === "CLOSED" && (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400">
                This conversation was closed. Sending a message re-opens it.
              </p>
            )}

            {!loading && !thread && (
              <div className="grid place-items-center px-4 py-10 text-center">
                <span className="role-gradient-bg grid size-11 place-items-center rounded-2xl text-white shadow-[0_16px_34px_-16px_var(--role-1)] ring-1 ring-white/20">
                  <Sparkles className="size-5" />
                </span>
                <p className="mt-4 font-heading text-sm font-semibold text-white">
                  Start the conversation
                </p>
                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-400">
                  Ask about your subscription, a module, a pending approval or
                  anything the Apex team should see. They reply from their
                  console.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                  message.side === "TENANT"
                    ? "ml-auto border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
                    : "border-white/10 bg-white/[0.03] text-zinc-200",
                )}
              >
                <p className="text-[9px] tracking-wide text-zinc-500 uppercase">
                  {message.side === "TENANT" ? "You" : "Apex team"}
                  {" · "}
                  {when(message.created_at)}
                </p>
                {message.body && <p className="mt-1 whitespace-pre-wrap">{message.body}</p>}
                {message.image_url && (
                  <a
                    href={message.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block"
                  >
                    <Image
                      src={message.image_url}
                      alt="Attachment"
                      width={280}
                      height={200}
                      unoptimized
                      className="max-h-48 rounded-lg border border-white/10 object-cover"
                    />
                  </a>
                )}
              </div>
            ))}
            <div ref={messageEnd} />
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 p-3">
            {pendingImages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {pendingImages.map((url, index) => (
                  <div key={url} className="relative">
                    <Image
                      src={url}
                      alt={`Attachment ${index + 1}`}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      disabled={busy}
                      onClick={() => removePendingImage(index)}
                      className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-rose-500 text-white shadow-md transition hover:scale-105 disabled:opacity-50"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                  {pendingImages.length}/{CHAT_MAX_IMAGES}
                </span>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={CHAT_IMAGE_ACCEPT}
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => void handleImageFileChange(event)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={
                  atImageLimit ? `Up to ${CHAT_MAX_IMAGES} images per message` : "Attach images"
                }
                aria-label="Attach images"
                disabled={busy || uploading || atImageLimit}
                onClick={handlePickImage}
                className="size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
              </Button>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message…"
                rows={2}
                disabled={busy}
                className="min-h-9 resize-none border-white/10 bg-white/[0.03] text-sm text-white placeholder:text-zinc-500"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                type="button"
                className="h-9 shrink-0"
                disabled={!canSend}
                onClick={() => void send()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>

            <p className="text-[10px] text-zinc-500">
              {uploading
                ? uploadProgress
                : `Up to ${CHAT_MAX_IMAGES} images · Enter to send · Shift+Enter for new line`}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
