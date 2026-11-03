"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export type HrComboboxPerson = {
  id: number;
  fullName: string;
  department?: string | null;
  jobTitle?: string | null;
};

/** Searchable employee combobox — same interaction pattern as hotel store item name. */
export function HrEmployeeCombobox({
  employees,
  valueIds,
  onChange,
  multiple = false,
  excludeIds = [],
  placeholder = "Select employee…",
  emptyText = "No employees found.",
  searchPlaceholder = "Search by name, department…",
  variant = "outline",
  className,
  triggerClassName,
}: {
  employees: HrComboboxPerson[];
  valueIds: number[];
  onChange: (ids: number[]) => void;
  multiple?: boolean;
  excludeIds?: number[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  /** outline = bordered trigger; plain = flush inside FieldShell */
  variant?: "outline" | "plain";
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);
  const selected = useMemo(() => new Set(valueIds), [valueIds]);

  const options = useMemo(() => {
    return employees.filter((e) => {
      if (exclude.has(e.id) && !selected.has(e.id)) return false;
      return true;
    });
  }, [employees, exclude, selected]);

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((e) => {
      const name = e.fullName.toLowerCase();
      const dept = String(e.department || "").toLowerCase();
      const job = String(e.jobTitle || "").toLowerCase();
      return (
        name.includes(query) || dept.includes(query) || job.includes(query)
      );
    });
  }, [options, query]);

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selected.has(e.id)),
    [employees, selected],
  );

  const toggle = (id: number) => {
    if (multiple) {
      if (selected.has(id)) onChange(valueIds.filter((x) => x !== id));
      else onChange([...valueIds, id]);
      return;
    }
    onChange(selected.has(id) ? [] : [id]);
    setOpen(false);
    setSearch("");
  };

  const triggerLabel = (() => {
    if (selectedEmployees.length === 0) return null;
    if (!multiple) return selectedEmployees[0]?.fullName || null;
    if (selectedEmployees.length === 1) return selectedEmployees[0]!.fullName;
    return `${selectedEmployees.length} employees selected`;
  })();

  return (
    <div className={cn("space-y-2", className)}>
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
            className={cn(
              "w-full min-w-0 justify-between font-normal",
              variant === "plain"
                ? "h-11 rounded-[10px] border-0 bg-transparent px-3 shadow-none hover:bg-background/50"
                : "h-10",
              triggerClassName,
            )}
          >
            <span
              className={cn(
                "min-w-0 truncate text-left",
                triggerLabel ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {triggerLabel || placeholder}
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
                <CommandGroup heading="Employees">
                  {filtered.map((e) => {
                    const isOn = selected.has(e.id);
                    const hint = e.department || e.jobTitle;
                    return (
                      <CommandItem
                        key={e.id}
                        value={`${e.id}-${e.fullName}`}
                        onSelect={() => toggle(e.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            isOn ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {e.fullName}
                          {hint ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {hint}
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

      {multiple && selectedEmployees.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {selectedEmployees.map((e) => (
            <Badge
              key={e.id}
              variant="secondary"
              className="gap-1 border-border/60 bg-muted/50 pr-1 text-foreground"
            >
              <span className="max-w-36 truncate">{e.fullName}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                aria-label={`Remove ${e.fullName}`}
                onClick={() => onChange(valueIds.filter((id) => id !== e.id))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
