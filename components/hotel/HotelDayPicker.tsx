"use client";

import type * as React from "react";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseYmdToDate, toYmdLocal } from "@/lib/hotelDateYmd";

const DEFAULT_TIME = "14:00";

function parseDateTimeLocal(value: string): {
  ymd: string;
  hm: string;
  date?: Date;
} {
  const raw = String(value || "").trim();
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/.exec(raw);
  if (!m) return { ymd: "", hm: DEFAULT_TIME };
  const ymd = m[1]!;
  const hm = m[2] || DEFAULT_TIME;
  const base = parseYmdToDate(ymd);
  if (!base) return { ymd, hm };
  const [h, min] = hm.split(":").map((n) => Number(n));
  base.setHours(h || 0, min || 0, 0, 0);
  return { ymd, hm, date: base };
}

function toDateTimeLocal(ymd: string, hm: string): string {
  if (!ymd) return "";
  return `${ymd}T${hm || DEFAULT_TIME}`;
}

export function HotelDayPicker({
  label,
  id,
  value,
  onChange,
  className,
  buttonClassName,
  placeholder = "Pick a date",
  disabled,
  disabledDays,
  popoverAlign = "start",
  compact = false,
  withTime = false,
}: {
  label?: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledDays?: React.ComponentProps<typeof Calendar>["disabled"];
  popoverAlign?: React.ComponentProps<typeof PopoverContent>["align"];
  /** Shorter label + date text for dense inline form grids. */
  compact?: boolean;
  /** Show a time input under the calendar in the same popover. Value becomes `YYYY-MM-DDTHH:mm`. */
  withTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = withTime
    ? parseDateTimeLocal(value)
    : {
        ymd: value,
        hm: DEFAULT_TIME,
        date: parseYmdToDate(value),
      };
  const selected = parsed.date;
  const dateFormat = compact ? "MMM d, yyyy" : "PPP";
  const display = selected
    ? withTime
      ? `${format(selected, dateFormat)} · ${format(selected, "h:mm a")}`
      : format(selected, dateFormat)
    : placeholder;

  const emit = (ymd: string, hm: string) => {
    if (!ymd) {
      onChange("");
      return;
    }
    onChange(withTime ? toDateTimeLocal(ymd, hm) : ymd);
  };

  return (
    <div className={cn(label && "space-y-1.5 min-w-0", className)}>
      {label ? (
        id ? (
          <Label htmlFor={id} className={compact ? "text-sm" : undefined}>
            {label}
          </Label>
        ) : (
          <Label className={compact ? "text-sm" : undefined}>{label}</Label>
        )
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start border-border/80 px-3 text-left font-normal shadow-sm",
              compact ? "min-w-0 truncate text-sm" : "min-w-42.5",
              buttonClassName,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{display}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={popoverAlign}>
          <Calendar
            mode="single"
            selected={selected}
            captionLayout="dropdown"
            disabled={disabledDays}
            onSelect={(d) => {
              if (!d) return;
              emit(toYmdLocal(d), parsed.hm || DEFAULT_TIME);
            }}
          />
          {withTime ? (
            <div className="space-y-1.5 border-t border-border/70 px-3 py-3">
              <Label
                htmlFor={id ? `${id}-time` : undefined}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <Clock className="h-3.5 w-3.5" />
                Time
              </Label>
              <Input
                id={id ? `${id}-time` : undefined}
                type="time"
                className="h-10 bg-background"
                value={parsed.hm || DEFAULT_TIME}
                onChange={(e) => {
                  const hm = e.target.value || DEFAULT_TIME;
                  const ymd =
                    parsed.ymd ||
                    (selected ? toYmdLocal(selected) : toYmdLocal(new Date()));
                  emit(ymd, hm);
                }}
              />
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
