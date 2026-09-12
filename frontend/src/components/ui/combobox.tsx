import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";

import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Second line in the list — the company behind a contact name, say. */
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /**
   * Called as the user types. Provide it when the options come from the server
   * so the list is a live query rather than a filtered snapshot; omit it and
   * the component filters `options` itself.
   */
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  "aria-label"?: string;
}

/**
 * A single-select dropdown you can type into (CH-03).
 *
 * The native `<select>` this replaces stops being usable somewhere around
 * thirty options, and the client list is already past that. The input doubles
 * as the search box: closed it shows the selected label, open it holds
 * whatever is being typed.
 *
 * Filtering is local by default. Pass `onSearchChange` to hand the query to the
 * server instead — necessary anywhere the full list is longer than one page.
 */
export function Combobox({
  options,
  value,
  onChange,
  onSearchChange,
  placeholder = "Select…",
  emptyMessage = "No matches",
  id,
  className,
  disabled,
  clearable,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // useId must run unconditionally, so it is called even when `id` is given.
  const generatedId = React.useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const selected = options.find((option) => option.value === value);

  // With a server-side search the list is already the answer to the query;
  // filtering it again locally would hide rows the server deliberately matched
  // on a field that isn't in the label (an email, say).
  const visible = React.useMemo(() => {
    if (onSearchChange || !search) return options;
    const needle = search.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.hint?.toLowerCase().includes(needle),
    );
  }, [options, search, onSearchChange]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [visible.length]);

  const searchRef = React.useRef(onSearchChange);
  searchRef.current = onSearchChange;

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setSearch("");
      searchRef.current?.("");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setSearch("");
    onSearchChange?.("");
  }

  function commit(option: ComboboxOption) {
    onChange(option.value);
    close();
    inputRef.current?.blur();
  }

  function handleSearch(next: string) {
    setSearch(next);
    setOpen(true);
    onSearchChange?.(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => {
        if (visible.length === 0) return 0;
        return (index + delta + visible.length) % visible.length;
      });
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) commit(option);
    } else if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      close();
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        className={cn(fieldClasses, "pr-9")}
        placeholder={selected ? selected.label : placeholder}
        value={open ? search : (selected?.label ?? "")}
        onChange={(event) => handleSearch(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {clearable && selected && !open ? (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : (
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto border border-border bg-card shadow-lg"
        >
          {visible.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{emptyMessage}</li>
          )}
          {visible.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                // pointerdown, not click: the outside-click handler closes the
                // panel on pointerdown, which would unmount this before a click
                // ever lands.
                onPointerDown={(event) => {
                  event.preventDefault();
                  commit(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                  index === activeIndex ? "bg-accent text-foreground" : "text-foreground",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </span>
                {option.value === value && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
