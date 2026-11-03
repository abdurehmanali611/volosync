import type { CloudinaryUploadWidgetOptions } from "next-cloudinary";

/** Unsigned upload preset from `.env.local` (`NEXT_PUBLIC_CLOUDINARY_PRESET_NAME`). */
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME ?? "";

export function isCloudinaryUploadConfigured(): boolean {
  return Boolean(
    CLOUDINARY_UPLOAD_PRESET &&
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  );
}

/** Cloudinary widget: local file, URL, or camera only — one asset per upload. */
export const ITEM_REGISTRATION_IMAGE_UPLOAD_OPTIONS: CloudinaryUploadWidgetOptions =
  {
    sources: ["local", "url", "camera"],
    multiple: false,
    maxFiles: 1,
    clientAllowedFormats: ["png", "jpeg", "jpg", "webp", "jfif"],
  };

/** Feedback chat attachments — images only. */
export const FEEDBACK_IMAGE_UPLOAD_OPTIONS: CloudinaryUploadWidgetOptions = {
  sources: ["local", "url", "camera"],
  multiple: false,
  maxFiles: 1,
  clientAllowedFormats: ["png", "jpeg", "jpg", "webp", "jfif"],
  folder: "hotcol-feedback",
};

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

/** Direct upload (e.g. feedback sheet) — avoids the Cloudinary modal inside Radix dialogs. */
export async function uploadImageFileToCloudinary(
  file: File,
  opts?: { folder?: string },
): Promise<string> {
  if (!isCloudinaryUploadConfigured()) {
    throw new Error("Image upload is not configured.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (opts?.folder) {
    formData.append("folder", opts.folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
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

export function cloudinarySecureUrlFromResult(result: unknown): string | null {
  if (
    typeof result === "object" &&
    result !== null &&
    "event" in result &&
    (result as { event: string }).event === "success" &&
    "info" in result &&
    typeof (result as { info: unknown }).info === "object" &&
    (result as { info: object | null }).info !== null &&
    "secure_url" in (result as { info: { secure_url?: string } }).info
  ) {
    return (result as { info: { secure_url: string } }).info.secure_url;
  }
  return null;
}

/** Single-item form also allows short video attachments when needed. */
export const ITEM_REGISTRATION_MEDIA_UPLOAD_OPTIONS: CloudinaryUploadWidgetOptions =
  {
    sources: ["local", "url", "camera"],
    multiple: false,
    maxFiles: 1,
    clientAllowedFormats: [
      "png",
      "jpeg",
      "jpg",
      "webp",
      "jfif",
      "mp4",
      "webm",
      "ogg",
      "mov",
      "avi",
    ],
  };
