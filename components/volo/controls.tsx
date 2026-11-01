"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";

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
