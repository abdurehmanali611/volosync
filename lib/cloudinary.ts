/** Image unsigned preset — photos only (`…/image/upload`). */
export function isCloudinaryImageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME,
  );
}

/** File/doc unsigned preset — PDFs etc. (`…/raw/upload`). */
export function isCloudinaryFileConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_FILE_PRESET_NAME,
  );
}

/** @deprecated Prefer isCloudinaryImageConfigured / isCloudinaryFileConfigured. */
export function isCloudinaryConfigured(): boolean {
  return isCloudinaryImageConfigured();
}

export async function uploadImageToCloudinary(
  file: File,
  opts?: { folder?: string },
) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const presetName = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME;

  if (!cloudName || !presetName) {
    throw new Error("Cloudinary image environment variables are missing.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", presetName);
  if (opts?.folder) {
    formData.append("folder", opts.folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Image upload failed.");
  }

  return data.secure_url;
}

const DOC_ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export type CloudinaryFileUploadResult = {
  secureUrl: string;
  publicId: string;
  bytes: number;
  format: string;
  originalFilename: string;
};

/**
 * Upload a document with `NEXT_PUBLIC_CLOUDINARY_FILE_PRESET_NAME` (raw upload).
 * Same helper pattern as hotcol-ats CV upload.
 */
export async function uploadFileToCloudinary(
  file: File,
  opts?: { folder?: string },
): Promise<CloudinaryFileUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const presetName = process.env.NEXT_PUBLIC_CLOUDINARY_FILE_PRESET_NAME;

  if (!cloudName || !presetName) {
    throw new Error(
      "Cloudinary file environment variables are missing (NEXT_PUBLIC_CLOUDINARY_FILE_PRESET_NAME).",
    );
  }

  const ext = fileExtension(file.name);
  if (ext && !DOC_ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Only PDF, DOC, or DOCX files are allowed.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", presetName);
  if (opts?.folder) {
    formData.append("folder", opts.folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    bytes?: number;
    format?: string;
    original_filename?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "File upload failed.");
  }

  return {
    secureUrl: data.secure_url,
    publicId: String(data.public_id || ""),
    bytes: Number(data.bytes) || file.size,
    format: String(data.format || ext || "raw"),
    originalFilename: String(data.original_filename || file.name),
  };
}
