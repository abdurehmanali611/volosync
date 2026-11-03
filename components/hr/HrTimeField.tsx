"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { hrFieldClass } from "@/components/hr/hrChrome";
import { cn } from "@/lib/utils";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = String(hm || "09:00")
    .split(":")
    .map((x) => Number(x));
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

export function formatHm(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function TimePartCombobox({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.value}`.toLowerCase();
      return hay.includes(query);
    });
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(hrFieldClass, "justify-between font-normal tabular-nums")}
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-28 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-52">
            {filtered.length === 0 ? (
              <CommandEmpty>No match.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((o) => {
                  const on = o.value === value;
                  return (
                    <CommandItem
                      key={o.value}
                      value={`${o.value}-${o.label}`}
                      onSelect={() => {
                        onChange(o.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="tabular-nums"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5 shrink-0",
                          on ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {o.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * HR time field — visible clock + HH:mm, with searchable hour/minute dropdowns.
 * Stores 24-hour "HH:mm".
 */
export function HrTimeField({
  value,
  onChange,
  minuteStep = 1,
  className,
  id,
}: {
  value: string;
  onChange: (hm: string) => void;
  /** Minute increment (1–30). Default 1. */
  minuteStep?: number;
  className?: string;
  id?: string;
}) {
  const step = Math.min(30, Math.max(1, Math.floor(minuteStep) || 1));
  const { hour, minute } = parseHm(value);
  const snapped =
    Math.round(minute / step) * step >= 60
      ? 60 - step
      : Math.round(minute / step) * step;

  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        value: String(i),
        label: pad2(i),
      })),
    [],
  );
  const minutes = useMemo(
    () =>
      Array.from({ length: Math.floor(60 / step) }, (_, i) => {
        const m = i * step;
        return { value: String(m), label: pad2(m) };
      }),
    [step],
  );

  return (
    <div
      id={id}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border/70 bg-background/90 px-2.5 py-2 shadow-sm ring-1 ring-black/3 dark:ring-white/5",
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 text-primary dark:text-primary">
        <Clock className="h-4 w-4" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <TimePartCombobox
          value={String(hour)}
          options={hours}
          placeholder="HH"
          searchPlaceholder="Hour…"
          onChange={(h) => onChange(formatHm(Number(h), snapped))}
        />
        <span className="text-sm font-semibold text-muted-foreground">:</span>
        <TimePartCombobox
          value={String(snapped)}
          options={minutes}
          placeholder="MM"
          searchPlaceholder="Min…"
          onChange={(m) => onChange(formatHm(hour, Number(m)))}
        />
      </div>
    </div>
  );
}
