"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ExternalLink,
  FileText,
  ImageIcon,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PendingButton } from "@/components/ui/pending-button";
import { HrConfirmAction } from "@/components/hr/HrConfirmAction";
import {
  HrEmptyState,
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { cn } from "@/lib/utils";
import { notifyApiFailure } from "@/lib/actions";
import {
  createHrLibraryDocumentApi,
  deleteHrLibraryDocumentApi,
  updateHrLibraryDocumentApi,
  type HrLibraryDocument,
} from "@/lib/api/hrSource";
import {
  isCloudinaryFileConfigured,
  isCloudinaryImageConfigured,
  uploadFileToCloudinary,
  uploadImageToCloudinary,
} from "@/lib/cloudinary";

const FILE_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
const IMAGE_FORMATS = new Set(["png", "jpg", "jpeg", "webp", "gif", "jfif"]);

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isImageDoc(doc: HrLibraryDocument) {
  const fmt = String(doc.fileFormat || "").toLowerCase();
  if (IMAGE_FORMATS.has(fmt)) return true;
  const name = String(doc.fileOriginalName || "").toLowerCase();
  return IMAGE_FORMATS.has(fileExtension(name));
}

export function HrDocumentsPanel({
  documents,
  canUpload,
  onRefresh,
}: {
  documents: HrLibraryDocument[];
  canUpload: boolean;
  onRefresh: () => Promise<void>;
}) {
  const pickId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadAsFile, setUploadAsFile] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingPreviewUrl, setExistingPreviewUrl] = useState<string | null>(
    null,
  );
  const [existingFileName, setExistingFileName] = useState("");

  const clearSelection = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", description: "" });
    setUploadAsFile(false);
    setExistingPreviewUrl(null);
    setExistingFileName("");
    clearSelection();
  };

  const startEdit = (doc: HrLibraryDocument) => {
    clearSelection();
    const asFile = !isImageDoc(doc);
    setEditingId(doc.id);
    setForm({
      title: doc.title || "",
      description: doc.description || "",
    });
    setUploadAsFile(asFile);
    setExistingFileName(doc.fileOriginalName || "");
    setExistingPreviewUrl(
      !asFile && doc.fileSecureUrl ? doc.fileSecureUrl : null,
    );
  };

  const onPickFile = (next: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (!next) {
      setFile(null);
      return;
    }

    if (uploadAsFile) {
      const ext = fileExtension(next.name);
      if (!["pdf", "doc", "docx"].includes(ext)) {
        toast.error("Choose a PDF, DOC, or DOCX file");
        return;
      }
      setFile(next);
      setExistingPreviewUrl(null);
      return;
    }

    if (!next.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setFile(next);
    setExistingPreviewUrl(null);
    setImagePreview(URL.createObjectURL(next));
  };

  const submit = async () => {
    if (!canUpload) {
      toast.error("Only HR can upload or edit documents");
      return;
    }
    const title = form.title.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    if (!editingId && !file) {
      toast.error(
        uploadAsFile
          ? "Choose a PDF or Word file"
          : "Choose an image to upload",
      );
      return;
    }

    setPending(true);
    try {
      let fileMeta:
        | {
            fileSecureUrl: string;
            filePublicId?: string;
            fileBytes?: number;
            fileFormat?: string;
            fileOriginalName?: string;
          }
        | undefined;

      if (file) {
        if (uploadAsFile) {
          if (!isCloudinaryFileConfigured()) {
            toast.error("Cloudinary file preset is not configured");
            return;
          }
          const uploaded = await uploadFileToCloudinary(file, {
            folder: "hotcol-hr-library",
          });
          fileMeta = {
            fileSecureUrl: uploaded.secureUrl,
            filePublicId: uploaded.publicId,
            fileBytes: uploaded.bytes,
            fileFormat: uploaded.format,
            fileOriginalName: uploaded.originalFilename,
          };
        } else {
          if (!isCloudinaryImageConfigured()) {
            toast.error("Cloudinary image preset is not configured");
            return;
          }
          const secureUrl = await uploadImageToCloudinary(file, {
            folder: "hotcol-hr-library",
          });
          const ext = fileExtension(file.name) || "jpg";
          fileMeta = {
            fileSecureUrl: secureUrl,
            fileBytes: file.size,
            fileFormat: ext,
            fileOriginalName: file.name,
          };
        }
      }

      if (editingId) {
        await updateHrLibraryDocumentApi({
          id: editingId,
          title,
          description: form.description.trim(),
          ...fileMeta,
        });
        toast.success("Document updated");
      } else {
        if (!fileMeta) {
          toast.error("Choose a file or image to upload");
          return;
        }
        await createHrLibraryDocumentApi({
          title,
          description: form.description.trim(),
          ...fileMeta,
        });
        toast.success(uploadAsFile ? "Document uploaded" : "Image uploaded");
      }
      resetForm();
      await onRefresh();
    } catch (e) {
      notifyApiFailure(
        e,
        editingId ? "Could not update document" : "Could not upload document",
      );
    } finally {
      setPending(false);
    }
  };

  const previewSrc = imagePreview || existingPreviewUrl;

  return (
    <HrPanelShell>
      <HrSectionCard
        title="HR documentation"
        description="Tenant document library — title, description, and a file or image. HR uploads and edits; HR and Manager can open and delete."
        icon={<FileText className="h-5 w-5" />}
        accent="bg-linear-to-r from-violet-500 via-violet-400 to-primary/80"
      >
        <div
          className={cn(
            "grid items-stretch gap-4",
            canUpload ? "lg:grid-cols-2" : "grid-cols-1",
          )}
        >
          {canUpload ? (
            <HrFormSection
              className="h-full"
              title={editingId ? "Edit document" : "Upload document"}
              description={
                editingId
                  ? "Update title or description. Optionally replace the file or image."
                  : "Add a policy, handbook, form, or image for the property library."
              }
            >
              <div className="space-y-4">
                {editingId ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-500/25 bg-violet-500/6 px-3 py-2">
                    <p className="text-xs font-medium text-violet-900 dark:text-violet-200">
                      Editing library entry
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={resetForm}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    className={hrFieldClass}
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="e.g. Staff handbook 2026"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    className={cn(hrFieldClass, "min-h-24")}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Short note for Managers reviewing the file"
                  />
                </div>

                <div className="space-y-3">
                  <label
                    htmlFor={pickId}
                    className="flex cursor-pointer items-center gap-2.5 text-sm font-medium"
                  >
                    <Checkbox
                      id={pickId}
                      checked={uploadAsFile}
                      onCheckedChange={(checked) => {
                        setUploadAsFile(checked === true);
                        clearSelection();
                        if (editingId) {
                          setExistingPreviewUrl(null);
                          setExistingFileName("");
                        }
                      }}
                    />
                    Upload file
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {editingId
                      ? uploadAsFile
                        ? "Optional — choose a new PDF, DOC, or DOCX to replace the current file."
                        : "Optional — choose a new image to replace the current one."
                      : uploadAsFile
                        ? "Checked — choose a PDF, DOC, or DOCX."
                        : "Unchecked — choose an image instead."}
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={uploadAsFile ? FILE_ACCEPT : IMAGE_ACCEPT}
                    className="sr-only"
                    aria-hidden
                    onChange={(e) => {
                      onPickFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full gap-2 font-medium"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadAsFile ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    {editingId
                      ? uploadAsFile
                        ? "Replace PDF / Word file"
                        : "Replace image"
                      : uploadAsFile
                        ? "Choose PDF / Word file"
                        : "Choose image"}
                  </Button>

                  {file || existingFileName || previewSrc ? (
                    <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5">
                      {!uploadAsFile && previewSrc ? (
                        <div className="mb-2 overflow-hidden rounded-lg border border-border/60">
                          <Image
                            src={previewSrc}
                            alt={file?.name || existingFileName || "Preview"}
                            width={320}
                            height={180}
                            unoptimized
                            className="h-36 w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <p className="truncate text-xs text-muted-foreground">
                        {file ? "Selected: " : "Current: "}
                        <span className="font-medium text-foreground">
                          {file?.name || existingFileName || "Saved attachment"}
                        </span>
                      </p>
                      {file ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                          onClick={clearSelection}
                        >
                          Clear new selection
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <PendingButton
                  type="button"
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={() => void submit()}
                >
                  {editingId ? (
                    <>Save changes</>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {uploadAsFile ? "Upload document" : "Upload image"}
                    </>
                  )}
                </PendingButton>
              </div>
            </HrFormSection>
          ) : null}

          <HrFormSection
            className="h-full"
            title="Library"
            description={
              canUpload
                ? "Saved files and images — edit or delete as needed."
                : "Open or delete library files. Uploads and edits are limited to HR."
            }
          >
            {documents.length === 0 ? (
              <HrEmptyState
                title="No documents yet"
                description={
                  canUpload
                    ? "Fill the form on the left and upload the first file or image."
                    : "Ask HR to upload the first policy or handbook."
                }
              />
            ) : (
              <div className="max-h-[min(32rem,70vh)] space-y-2 overflow-y-auto pr-1">
                {documents.map((doc) => {
                  const image = isImageDoc(doc);
                  const isEditing = editingId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-xl border bg-background/80 px-3 py-3 transition-colors",
                        isEditing
                          ? "border-violet-500/40 ring-1 ring-violet-500/20"
                          : "border-border/70 hover:border-violet-500/25 hover:bg-violet-500/3",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 gap-3">
                        {image && doc.fileSecureUrl ? (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted/30">
                            <Image
                              src={doc.fileSecureUrl}
                              alt={doc.title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0 space-y-1.5">
                          <p className="truncate font-medium tracking-tight">
                            {doc.title}
                          </p>
                          {doc.description ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {doc.description}
                            </p>
                          ) : null}
                          <p className="text-[11px] text-muted-foreground">
                            {doc.fileOriginalName || (image ? "Image" : "File")}
                            {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                          </p>
                          {doc.fileSecureUrl ? (
                            <a
                              href={doc.fileSecureUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {image ? "Open image" : "Open file"}
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {canUpload ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={isEditing ? "default" : "outline"}
                            className="shrink-0"
                            onClick={() =>
                              isEditing ? resetForm() : startEdit(doc)
                            }
                          >
                            {isEditing ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </Button>
                        ) : null}
                        <HrConfirmAction
                          destructive
                          title="Delete document?"
                          description="This removes the library entry. The Cloudinary file is not deleted."
                          confirmLabel="Delete"
                          trigger={
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="shrink-0 text-destructive"
                            >
                              Delete
                            </Button>
                          }
                          onConfirm={async () => {
                            try {
                              await deleteHrLibraryDocumentApi(doc.id);
                              if (editingId === doc.id) resetForm();
                              toast.success("Document deleted");
                              await onRefresh();
                            } catch (e) {
                              notifyApiFailure(e, "Could not delete document");
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </HrFormSection>
        </div>
      </HrSectionCard>
    </HrPanelShell>
  );
}
