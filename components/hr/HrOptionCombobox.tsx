"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

export type HrComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

/** Searchable single-select combobox used across HR forms. */
export function HrOptionCombobox({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyText = "No matches.",
  searchPlaceholder = "Search…",
  disabled = false,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: HrComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.hint || ""} ${o.value}`.toLowerCase();
      return hay.includes(query);
    });
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            hrFieldClass,
            "justify-between font-normal",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
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
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          on ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {o.label}
                        {o.hint ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {o.hint}
                          </span>
                        ) : null}
                      </span>
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
