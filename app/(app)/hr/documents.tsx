"use client";

// Documents: real multipart upload (≤ 10 MB, stored under media/hr/documents/)
// with PENDING → APPROVED/REJECTED lifecycle handled in the Manager queue.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrExt, type HrDocumentFull } from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill } from "@/components/volo/kit";
import { Field, IconButton, PersonPicker, RowCard, Select, toneForStatus, useRunner, type SectionProps } from "./ui";

const KINDS = ["Contract", "Certificate", "Letter", "ID", "Other"];

export default function DocumentsSection({ people, reload }: SectionProps) {
  const [documents, setDocuments] = useState<HrDocumentFull[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [doc, setDoc] = useState({ employee: "", title: "", kind: "Contract", file_url: "" });
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.documents(statusFilter);
    setDocuments(rows.data);
  }, [statusFilter]);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  function attach() {
    return run(async () => {
      if (!doc.title.trim()) throw new Error("Title is required");
      if (!file && !doc.file_url.trim()) throw new Error("Attach a file or paste a URL");
      // Direct multipart create (views.py accepts `file` on POST /documents/).
      await hrExt.createDocument(
        {
          employee: doc.employee ? Number(doc.employee) : null,
          title: doc.title.trim(),
          kind: doc.kind.trim() || "Contract",
          file_url: file ? "" : doc.file_url.trim(),
        },
        file ?? undefined,
      );
      setDoc({ ...doc, title: "", file_url: "" });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    }, "Document uploaded — waiting on the manager.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel title="Attach a document" description="PDF, image or office file up to 10 MB.">
        <div className="space-y-3">
          <Field label="Employee">
            <PersonPicker
              value={doc.employee}
              onChange={(employee) => setDoc({ ...doc, employee })}
              rows={people}
              allowEmpty
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            </Field>
            <Field label="Kind">
              <Select
                value={KINDS.includes(doc.kind) ? doc.kind : "Other"}
                onChange={(kind) => setDoc({ ...doc, kind })}
                options={KINDS.map((kind) => ({ value: kind, label: kind }))}
              />
            </Field>
          </div>
          <Field label="File">
            <input
              ref={fileInput}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="flex h-9 w-full cursor-pointer items-center rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-zinc-200 hover:border-emerald-400/40"
            />
          </Field>
          {file && (
            <p className="text-xs text-emerald-300">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}
          <Field label="…or paste a file URL">
            <Input
              value={doc.file_url}
              placeholder="https://…"
              onChange={(e) => setDoc({ ...doc, file_url: e.target.value })}
            />
          </Field>
          <Button className="w-full" disabled={busy} onClick={attach}>
            <Upload className="size-3.5" /> Attach document
          </Button>
        </div>
      </Panel>

      <Panel
        title="Document library"
        description="Every upload lands as PENDING until the manager decides."
        actions={
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            allowEmpty
            className="h-8 w-40"
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
        }
      >
        <div className="space-y-2">
          {documents.map((row) => (
            <RowCard key={row.id}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">
                    {row.title}
                    <span className="ml-2 text-[11px] text-zinc-500">{row.kind}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {row.employee_name || "company"} · by {row.uploaded_by || "HR"} ·{" "}
                    {String(row.uploaded_at).slice(0, 10)}
                    {row.decided_by ? ` · decided by ${row.decided_by}` : ""}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill status={row.status} tone={toneForStatus(row.status)} />
                {row.file_url && (
                  <a
                    href={row.file_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open file"
                    className="rounded-lg border border-sky-400/30 p-1.5 text-sky-300 transition hover:bg-sky-400/10"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                <IconButton
                  title="Delete"
                  tone="rose"
                  onClick={() => {
                    if (!window.confirm(`Delete document "${row.title}"?`)) return;
                    run(() => hrExt.deleteDocument(row.id), "Document deleted.");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </span>
            </RowCard>
          ))}
          {!documents.length && <EmptyRow>No documents yet.</EmptyRow>}
        </div>
      </Panel>
    </div>
  );
}
