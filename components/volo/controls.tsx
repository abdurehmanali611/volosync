"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Landmark,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parsePickerDate } from "@/components/date-picker";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string };

/** The three settlement channels, shared by the Sales and Finance sale forms. */
export const PAYMENT_METHOD_CHOICES = [
  {
    value: "TELEBIRR",
    label: "Telebirr",
    hint: "Mobile wallet",
    icon: Smartphone,
    on: "border-violet-400/50 bg-violet-500/15 text-violet-200 shadow-[0_0_24px_-10px_rgba(167,139,250,0.9)]",
    off: "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-violet-400/30 hover:text-violet-200",
  },
  {
    value: "BANK",
    label: "Bank transfer",
    hint: "Account transfer",
    icon: Landmark,
    on: "border-sky-400/50 bg-sky-500/15 text-sky-200 shadow-[0_0_24px_-10px_rgba(56,189,248,0.9)]",
    off: "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-sky-400/30 hover:text-sky-200",
  },
  {
    value: "RECEIPT",
    label: "Cash receipt",
    hint: "Counter cash",
    icon: Banknote,
    on: "border-amber-400/50 bg-amber-500/15 text-amber-200 shadow-[0_0_24px_-10px_rgba(251,191,36,0.9)]",
    off: "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-400/30 hover:text-amber-200",
  },
] as const;

/** Radio group over the payment channels — `name` must be unique per sale line. */
export function PaymentMethodPicker({
  value,
  onChange,
  name,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  name: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Payment method"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {PAYMENT_METHOD_CHOICES.map((option) => {
        const Icon = option.icon;
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
              checked ? option.on : option.off,
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{option.label}</span>
            <span className="hidden text-[10px] opacity-70 sm:inline">{option.hint}</span>
            <span
              className={cn(
                "grid size-3.5 shrink-0 place-items-center rounded-full border",
                checked ? "border-current" : "border-white/25",
              )}
            >
              {checked ? <span className="size-1.5 rounded-full bg-current" /> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function ComboSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  emptyText = "Nothing found.",
  className,
  contentClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between gap-2 border-white/10 bg-white/[0.03] px-3 font-normal text-zinc-200 hover:bg-white/[0.06]",
            className,
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-zinc-500")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-(--radix-popover-trigger-width) border-white/10 bg-zinc-900 p-0",
          contentClassName,
        )}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value || option.label}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = parsePickerDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 border-white/10 bg-white/[0.03] px-3 text-sm font-normal text-zinc-200 hover:bg-white/[0.06]",
            !date && "text-zinc-500",
            className,
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 opacity-60" />
          <span className="truncate">{date ? format(date, "MMM d, yyyy") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-white/10 bg-zinc-900 p-0">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          defaultMonth={date ?? new Date()}
          startMonth={new Date(2020, 0)}
          endMonth={new Date(2035, 11)}
          onSelect={(next) => {
            if (!next) return;
            onChange(format(next, "yyyy-MM-dd"));
            setOpen(false);
          }}
          className="[--cell-size:--spacing(8)]"
        />
        {clearable && date ? (
          <div className="border-t border-white/10 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="h-8 w-full text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-rose-300"
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
