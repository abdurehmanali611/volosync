"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Plus, Send } from "lucide-react";
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
import {
  hrExt,
  type HrChatMessage,
  type HrChatPeer,
  type HrChatThread,
} from "@/lib/api/hr";
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

function isUnread(thread: HrChatThread) {
  const last = thread.last_message;
  if (!last || last.sender_is_manager) return false;
  const me = thread.members.find((member) => member.is_manager);
  if (!me || !me.last_read_at) return true;
  return new Date(last.created_at) > new Date(me.last_read_at);
}

/** Manager-only direct line to the tenant's employees. */
export function ManagerMessagesButton() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<HrChatThread[]>([]);
  const [peers, setPeers] = useState<HrChatPeer[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<HrChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [newPeer, setNewPeer] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const messageEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const result = await hrExt.chatThreads();
        if (!cancelled) setThreads(result.data);
      } catch {
        // The badge simply stays as it was; the panel reports its own errors.
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
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const [threadResult, peerResult] = await Promise.all([
          hrExt.chatThreads(),
          hrExt.chatPeers(),
        ]);
        if (cancelled) return;
        setThreads(threadResult.data);
        setPeers(peerResult.data);
        setActiveId((current) =>
          current && threadResult.data.some((thread) => thread.id === current)
            ? current
            : (threadResult.data[0]?.id ?? null),
        );
      } catch (cause) {
        if (!cancelled) {
          toast.error(cause instanceof Error ? cause.message : "Could not open messages.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    async function fetchMessages() {
      try {
        const result = await hrExt.chatMessages(activeId!);
        if (!cancelled) setMessages(result.data);
      } catch {
        // Keep the last good transcript; the send action surfaces errors.
      }
    }
    void fetchMessages();
    void hrExt.markChatRead(activeId).catch(() => undefined);
    const timer = window.setInterval(fetchMessages, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, activeId]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const active = threads.find((thread) => thread.id === activeId) ?? null;
  const unread = threads.filter(isUnread).length;
  const memberNames =
    active?.members
      .filter((member) => !member.is_manager)
      .map((member) => member.employee_name)
      .join(", ") || "Group conversation";

  const refreshThreads = useCallback(async () => {
    const result = await hrExt.chatThreads();
    setThreads(result.data);
  }, []);

  async function send() {
    if (!activeId || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await hrExt.sendChatMessage(activeId, { body: draft.trim() });
      setDraft("");
      const [messageResult, threadResult] = await Promise.all([
        hrExt.chatMessages(activeId),
        hrExt.chatThreads(),
      ]);
      setMessages(messageResult.data);
      setThreads(threadResult.data);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not send the message.");
    } finally {
      setBusy(false);
    }
  }

  async function startConversation() {
    if (!newPeer || busy) return;
    setBusy(true);
    try {
      const created = await hrExt.createChatThread({
        employee_ids: [Number(newPeer)],
      });
      setNewPeer("");
      await refreshThreads();
      setActiveId(created.data.id);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not start the conversation.");
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
        title="Message employees"
        aria-label="Message employees"
        onClick={() => setOpen(true)}
        className="relative size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
      >
        <MessageSquare className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] leading-4 font-semibold text-white ring-2 ring-[#0b0b13]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden border border-white/10 bg-[#0b0b13] p-0 text-white ring-white/10 sm:max-w-3xl">
          <DialogHeader className="border-b border-white/10 px-4 py-3 text-left">
            <DialogTitle className="font-heading text-base">Messages</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Talk to employees from your HR roster.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 sm:grid-cols-[220px_1fr]">
            <aside className="flex min-h-0 flex-col border-b border-white/10 sm:border-b-0 sm:border-r">
              <div className="border-b border-white/10 p-2.5">
                <div className="flex items-center gap-1.5">
                  <select
                    value={newPeer}
                    onChange={(event) => setNewPeer(event.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f0f18] px-2 text-xs text-zinc-200 outline-none focus:border-white/25"
                    aria-label="Choose an employee"
                  >
                    <option value="">New conversation…</option>
                    {peers.map((peer) => (
                      <option key={peer.id} value={peer.id}>
                        {peer.full_name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={!newPeer || busy}
                    onClick={() => void startConversation()}
                    title="Start conversation"
                    aria-label="Start conversation"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {loading && !threads.length ? (
                  <div className="flex items-center justify-center gap-2 px-2 py-8 text-[11px] text-zinc-500">
                    <Loader2 className="size-3.5 animate-spin" /> Loading threads…
                  </div>
                ) : threads.length ? (
                  threads.map((thread) => {
                    const selected = thread.id === activeId;
                    const preview = thread.last_message
                      ? `${thread.last_message.sender_is_manager ? "You: " : ""}${thread.last_message.body}`
                      : "No messages yet";
                    return (
                      <button
                        type="button"
                        key={thread.id}
                        onClick={() => setActiveId(thread.id)}
                        className={cn(
                          "w-full rounded-lg border px-2.5 py-2 text-left transition",
                          selected
                            ? "border-emerald-400/35 bg-emerald-400/10"
                            : "border-transparent hover:bg-white/[0.04]",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-zinc-100">
                            {thread.title || "Conversation"}
                          </span>
                          {isUnread(thread) && (
                            <span className="size-1.5 shrink-0 rounded-full bg-rose-400" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
                          {preview}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-8 text-center text-[11px] text-zinc-500">
                    No conversations yet — start one above.
                  </p>
                )}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="border-b border-white/10 px-3 py-2.5">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {active?.title || "Conversation"}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {active ? memberNames : "Pick a thread to read and reply."}
                </p>
              </div>

              <div className="min-h-[220px] flex-1 space-y-2 overflow-y-auto p-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                      message.sender_is_manager
                        ? "ml-auto border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
                        : "border-white/10 bg-white/[0.03] text-zinc-200",
                    )}
                  >
                    <p className="text-[9px] tracking-wide text-zinc-500 uppercase">
                      {message.sender_is_manager ? "You" : message.sender_name || "Employee"}
                      {" · "}
                      {when(message.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
                {!activeId && (
                  <div className="grid place-items-center px-4 py-12 text-center">
                    <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500">
                      <MessageSquare className="size-4" />
                    </span>
                    <p className="mt-3 text-xs font-medium text-zinc-300">
                      Start a conversation
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Choose an employee on the left.
                    </p>
                  </div>
                )}
                {activeId && !messages.length && (
                  <p className="py-10 text-center text-[11px] text-zinc-500">
                    No messages yet. Say hello.
                  </p>
                )}
                <div ref={messageEnd} />
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 p-3">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message…"
                  disabled={!activeId || busy}
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
                  disabled={!activeId || !draft.trim() || busy}
                  onClick={() => void send()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
