"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apexChatApi, type ApexChatMessage, type ApexChatThread } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const messageEnd = useRef<HTMLDivElement | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [messages]);

  const unread = thread?.unread_for_tenant ?? 0;

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const result = await apexChatApi.send(body);
      setThread(result.data.thread);
      setMessages(result.data.messages);
      setDraft("");
    } catch (cause) {
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

      <Dialog open={open} onOpenChange={setOpen}>
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
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                {message.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.image_url}
                    alt="Attachment"
                    className="mt-2 max-h-48 rounded-lg border border-white/10 object-cover"
                  />
                )}
              </div>
            ))}
            <div ref={messageEnd} />
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message…"
              disabled={busy}
              className="h-9"
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
              disabled={!draft.trim() || busy}
              onClick={() => void send()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
