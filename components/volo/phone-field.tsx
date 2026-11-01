"use client";

import { PhoneInput } from "@/components/phone-input";
import { cn } from "@/lib/utils";

/** Normalise common Ethiopian entries (0911… / 251911… / +251911…) to E.164. */
function toE164(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("251")) return `+${digits}`;
  if (digits.startsWith("0")) return `+251${digits.slice(1)}`;
  return `+251${digits}`;
}

export function PhoneField({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <PhoneInput
      id={id}
      defaultCountry="ET"
      international
      value={toE164(value)}
      onChange={(next) => onChange(next ?? "")}
      placeholder={placeholder ?? "+251 91 234 5678"}
      className={cn("w-full", className)}
    />
  );
}
