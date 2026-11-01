/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Manager-side chat: HR/Manager open a conversation with an employee portal
// account (or a group) and answer the same ChatThread rows volosync-emp reads.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  hrExt,
  type HrChatMessage,
  type HrChatThread,
} from "@/lib/api/hr";
import { EmptyRow, Panel } from "@/components/volo/kit";
import { Field, PersonPicker, useRunner, type SectionProps } from "./ui";

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

export default function ChatSection({ people, reload }: SectionProps) {
  const [threads, setThreads] = useState<HrChatThread[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<HrChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ employee: "", title: "" });
  const messageEnd = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async () => {
    const result = await hrExt.chatThreads();
    setThreads(result.data);
    setActiveId((current) => current ?? result.data[0]?.id ?? null);
  }, []);

  const loadMessages = useCallback(async (threadId: number) => {
    const result = await hrExt.chatMessages(threadId);
    setMessages(result.data);
  }, []);

  useEffect(() => {
    loadThreads().catch((error) => toast.error(error.message));
  }, [loadThreads]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeId);
    void hrExt.markChatRead(activeId).catch(() => undefined);
    const timer = window.setInterval(() => {
      void loadMessages(activeId).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([loadThreads(), activeId ? loadMessages(activeId) : null, reload()]);
  });

  const active = threads.find((row) => row.id === activeId) ?? null;

  function send() {
    if (!activeId) return;
    return run(async () => {
      const body = draft.trim();
      if (!body) throw new Error("Write a message first");
      await hrExt.sendChatMessage(activeId, { body });
      setDraft("");
    }, "Message sent.");
  }

  function createThread() {
    return run(async () => {
      if (!compose.employee) throw new Error("Pick an employee");
      const created = await hrExt.createChatThread({
        employee_ids: [Number(compose.employee)],
        title: compose.title.trim() || undefined,
      });
      setComposeOpen(false);
      setCompose({ employee: "", title: "" });
      setActiveId(created.data.id);
    }, "Conversation started.");
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Panel
          title="Conversations"
          description="Every employee thread in this tenant."
          actions={
            <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => setComposeOpen(true)}>
              <MessageSquarePlus className="size-3.5" /> New
            </Button>
          }
        >
          <div className="space-y-2">
            {threads.map((thread) => {
              const selected = thread.id === activeId;
              return (
                <button
                  key={thread.id}
                  onClick={() => setActiveId(thread.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-emerald-400/40 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <p className="flex items-center justify-between gap-2 text-sm text-zinc-100">
                    <span className="truncate">{thread.title || "Conversation"}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">{thread.message_count}</span>
                  </p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-zinc-500">
                    {thread.last_message
                      ? `${thread.last_message.sender_is_manager ? "You" : thread.last_message.sender_name}: ${thread.last_message.body}`
                      : "No messages yet"}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {thread.kind === "GROUP" ? "Group" : "Direct"}
                    {thread.last_message_at ? ` · ${when(thread.last_message_at)}` : ""}
                  </p>
                </button>
              );
            })}
            {!threads.length && <EmptyRow>No conversations yet — start one.</EmptyRow>}
          </div>
        </Panel>

        <Panel
          title={active?.title || "Conversation"}
          description={
            active
              ? active.members
                  .filter((member) => !member.is_manager)
                  .map((member) => member.employee_name)
                  .join(", ") || "Group conversation"
              : "Pick a conversation to read and reply."
          }
          actions={
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent"
              disabled={busy || !activeId}
              onClick={() => run(async () => {
                if (!activeId) return;
                await loadMessages(activeId);
              }, "Messages refreshed.")}
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          }
        >
          {!activeId ? (
            <EmptyRow>Select or start a conversation.</EmptyRow>
          ) : (
            <>
              <div className="mb-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm ${
                      message.sender_is_manager
                        ? "ml-auto border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
                        : "border-white/10 bg-white/[0.03] text-zinc-200"
                    }`}
                  >
                    <p className="text-[10px] tracking-wide text-zinc-500 uppercase">
                      {message.sender_is_manager ? message.sender_name || "HR" : message.sender_name || "Employee"}
                      {" · "}
                      {when(message.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
                {!messages.length && <EmptyRow>No messages yet. Say hello.</EmptyRow>}
                <div ref={messageEnd} />
              </div>
              <div className="flex items-end gap-2 border-t border-white/10 pt-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a reply…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button disabled={busy || !draft.trim()} onClick={() => void send()}>
                  <Send className="size-3.5" /> Send
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New conversation</DialogTitle>
            <DialogDescription className="text-zinc-400">
              The employee sees it in the portal chat and gets a notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Employee">
              <PersonPicker
                value={compose.employee}
                onChange={(employee) => setCompose({ ...compose, employee })}
                rows={people}
              />
            </Field>
            <Field label="Topic (optional)">
              <Input
                value={compose.title}
                onChange={(e) => setCompose({ ...compose, title: e.target.value })}
                placeholder="e.g. Shift swap"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15 bg-transparent" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={createThread}>
              Start conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
