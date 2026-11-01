"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function parsePickerDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

type DatePickerProps = {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromDate?: Date;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  fromDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!value}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {value ? format(value, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          disabled={fromDate ? { before: fromDate } : undefined}
          defaultMonth={value ?? fromDate}
        />
      </PopoverContent>
    </Popover>
  );
}

function toTimeInputValue(date: Date | undefined): string {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function mergeDateAndTime(date: Date, time: string): Date {
  const next = new Date(date);
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number.parseInt(hoursRaw ?? "0", 10);
  const minutes = Number.parseInt(minutesRaw ?? "0", 10);
  next.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return next;
}

type DateTimePickerProps = DatePickerProps;

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date and time",
  disabled,
  className,
  fromDate,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const timeValue = toTimeInputValue(value);

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:flex-row", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!value}
            className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground sm:flex-1"
          >
            <CalendarIcon data-icon="inline-start" />
            {value ? format(value, "PPP") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (!date) {
                onChange(undefined);
                return;
              }
              onChange(value ? mergeDateAndTime(date, timeValue || "00:00") : date);
              setOpen(false);
            }}
            disabled={fromDate ? { before: fromDate } : undefined}
            defaultMonth={value ?? fromDate}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        disabled={disabled || !value}
        value={timeValue}
        onChange={(event) => {
          if (!value) return;
          onChange(mergeDateAndTime(value, event.target.value || "00:00"));
        }}
        className="w-full sm:w-36"
      />
    </div>
  );
}
