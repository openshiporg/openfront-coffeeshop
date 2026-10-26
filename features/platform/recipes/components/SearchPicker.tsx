"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Server-searched single choice. Results load on open and as the operator types. */
export function SearchPicker<T extends { id: string; name: string | null }>({
  id,
  selected,
  onSelect,
  search,
  describe,
  placeholder,
  emptyLabel,
  clearable = false,
  invalid = false,
  disabled = false,
}: {
  id: string;
  selected: T | null;
  onSelect: (option: T | null) => void;
  search: (term: string) => Promise<T[]>;
  describe?: (option: T) => string | null;
  placeholder: string;
  emptyLabel: string;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(!selected);
  const [term, setTerm] = React.useState("");
  const [options, setOptions] = React.useState<T[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const request = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    const current = ++request.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      search(term)
        .then((result) => { if (current === request.current) setOptions(result); })
        .catch(() => { if (current === request.current) setOptions([]); })
        .finally(() => { if (current === request.current) setLoading(false); });
    }, term ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [open, term, search]);

  if (selected && !open) {
    const detail = describe?.(selected);
    return (
      <div className={cn("flex min-h-10 items-center justify-between gap-2 rounded-[6px] border bg-background px-3 py-1.5", invalid && "border-destructive")}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected.name || "Untitled"}</p>
          {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!disabled ? <Button type="button" size="sm" variant="ghost" className="rounded-[6px]" onClick={() => setOpen(true)}>Change</Button> : null}
          {clearable && !disabled ? (
            <Button type="button" size="icon" variant="ghost" className="size-8 rounded-[6px]" aria-label="Clear" onClick={() => { onSelect(null); setOpen(true); }}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          type="search"
          value={term}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          autoComplete="off"
          className="pl-9"
          onChange={(event) => setTerm(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
        />
      </div>
      <div role="listbox" aria-label={placeholder} className="max-h-56 overflow-y-auto rounded-[6px] border">
        {options === null || (loading && !options.length) ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : options.length ? (
          options.map((option) => {
            const detail = describe?.(option);
            const active = option.id === selected?.id;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={active}
                className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => { onSelect(option); setOpen(false); setTerm(""); }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{option.name || "Untitled"}</span>
                  {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
                </span>
                {active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </div>
      {selected ? <Button type="button" size="sm" variant="ghost" className="rounded-[6px]" onClick={() => setOpen(false)}>Keep {selected.name || "current"}</Button> : null}
    </div>
  );
}
