/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Portal inbox: HR/Manager send notices to an employee portal account and see
// what the portal has already received, delivered or read.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hrExt, type HrNotification } from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill } from "@/components/volo/kit";
import {
  Field,
  PersonPicker,
  Select,
  SubTabs,
  Switch,
  useRunner,
  type SectionProps,
} from "./ui";

const KINDS = [
  { value: "INFO", label: "General notice" },
  { value: "LEAVE", label: "Leave" },
  { value: "PAYROLL", label: "Payroll" },
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "DOCUMENT", label: "Document" },
  { value: "CHAT", label: "Chat" },
];

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

export default function NotificationsSection({ people, reload }: SectionProps) {
  const [tab, setTab] = useState("outbox");
  const [rows, setRows] = useState<HrNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [form, setForm] = useState({
    employee: "",
    kind: "INFO",
    title: "",
    body: "",
  });

  const load = useCallback(async () => {
    const result = await hrExt.notifications({ unread: unreadOnly });
    setRows(result.data);
  }, [unreadOnly]);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  const unread = rows.filter((row) => !row.read_at).length;

  return (
    <>
      <SubTabs
        value={tab}
        onChange={setTab}
        items={[
          ["outbox", "Inbox"],
          ["send", "Send notice"],
        ]}
      />

      {tab === "send" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Send a portal notice" description="Lands in the employee's volosync-emp inbox.">
            <div className="space-y-3">
              <Field label="Employee">
                <PersonPicker
                  value={form.employee}
                  onChange={(employee) => setForm({ ...form, employee })}
                  rows={people}
                />
              </Field>
              <Field label="Kind">
                <Select
                  value={form.kind}
                  onChange={(kind) => setForm({ ...form, kind })}
                  options={KINDS}
                  placeholder="General notice"
                />
              </Field>
              <Field label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Message">
                <Textarea
                  value={form.body}
                  rows={4}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="What does the employee need to know?"
                />
              </Field>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!form.employee) throw new Error("Pick an employee");
                    if (!form.title.trim()) throw new Error("Title is required");
                    await hrExt.sendNotification({
                      employee: Number(form.employee),
                      kind: form.kind,
                      title: form.title.trim(),
                      body: form.body,
                    });
                    setForm({ ...form, title: "", body: "" });
                  }, "Notice delivered to the portal.")
                }
              >
                <Send className="size-3.5" /> Send notice
              </Button>
            </div>
          </Panel>

          <Panel title="Recent notices" description="Newest first, across the whole tenant.">
            <NoticeList rows={rows.slice(0, 12)} empty="No notices sent yet." />
          </Panel>
        </div>
      )}

      {tab === "outbox" && (
        <Panel
          title="Portal inbox"
          description={`${rows.length} notice${rows.length === 1 ? "" : "s"} · ${unread} unread`}
          actions={
            <div className="flex items-center gap-3">
              <Switch checked={unreadOnly} onChange={setUnreadOnly} label="Unread only" />
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-transparent"
                disabled={busy}
                onClick={() => run(async () => {
                  await Promise.all(
                    rows.filter((row) => !row.read_at).map((row) => hrExt.markNotificationRead(row.id)),
                  );
                }, "Notices marked read.")}
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </Button>
            </div>
          }
        >
          <NoticeList
            rows={rows}
            empty={unreadOnly ? "Nothing unread." : "No notices yet."}
            onRead={(id) => run(() => hrExt.markNotificationRead(id), "Marked read.")}
          />
        </Panel>
      )}
    </>
  );
}

function NoticeList({
  rows,
  empty,
  onRead,
}: {
  rows: HrNotification[];
  empty: string;
  onRead?: (id: number) => void;
}) {
  if (!rows.length) return <EmptyRow>{empty}</EmptyRow>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-zinc-100">
              <Bell className="size-3.5 shrink-0 text-amber-300" />
              {row.title}
              {!row.read_at && (
                <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                  New
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {row.employee_name} · {when(row.created_at)} · {row.kind}
            </p>
            {row.body && <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{row.body}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusPill
              status={row.read_at ? "READ" : "UNREAD"}
              tone={row.read_at ? "slate" : "amber"}
            />
            {!row.read_at && onRead && (
              <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => onRead(row.id)}>
                Mark read
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
