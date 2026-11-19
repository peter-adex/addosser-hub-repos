"use client"

import { useState, useRef, useEffect, useId } from "react"
import { Search, X, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value:    string
  label:    string
  sub?:     string
  disabled?: boolean
}

interface SearchableSelectProps {
  options:      SelectOption[]
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  disabled?:    boolean
  loading?:     boolean
  error?:       string
  className?:   string
  emptyMessage?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder   = "Select…",
  disabled      = false,
  loading       = false,
  error,
  className,
  emptyMessage  = "No options found",
}: SearchableSelectProps) {
  const id       = useId()
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState("")
  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : options

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function handleSelect(option: SelectOption) {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    setQuery("")
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange("")
    setQuery("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape")    { setOpen(false); setQuery("") }
    if (e.key === "Enter" && filtered.length === 1) handleSelect(filtered[0])
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled || loading}
        onClick={() => !disabled && !loading && setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-[13px] text-left transition",
          "focus:outline-none focus:ring-2 focus:ring-brand-navy/30",
          error
            ? "border-red-400"
            : open
            ? "border-brand-navy/50 dark:border-brand-gold/50"
            : "border-border",
          (disabled || loading) && "opacity-60 cursor-not-allowed"
        )}
      >
        <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
          {loading
            ? "Loading…"
            : selected
            ? selected.label
            : placeholder
          }
        </span>

        {selected?.sub && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[120px] hidden sm:block">
            {selected.sub}
          </span>
        )}

        {value && !disabled && !loading && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={e => e.key === "Enter" && handleClear(e as any)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-0.5"
            aria-label="Clear selection"
          >
            <X size={12}/>
          </span>
        )}

        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground flex-shrink-0 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {error && (
        <p className="mt-1 text-[11px] text-red-500">{error}</p>
      )}

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[220px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={13} className="text-muted-foreground flex-shrink-0"/>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Search ${placeholder.toLowerCase().replace("select ", "")}…`}
              className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground">
                <X size={12}/>
              </button>
            )}
          </div>

          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[260px] overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                {emptyMessage}
              </li>
            )}

            {filtered.map(option => {
              const isSelected = option.value === value
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                    option.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-muted/50",
                    isSelected && "bg-brand-navy/[0.06] dark:bg-brand-gold/[0.06]"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                    isSelected
                      ? "bg-brand-navy border-brand-navy dark:bg-brand-gold dark:border-brand-gold"
                      : "border-border"
                  )}>
                    {isSelected && <Check size={10} className="text-brand-gold dark:text-brand-navy"/>}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-[13px] truncate",
                      isSelected ? "font-semibold text-foreground" : "text-foreground"
                    )}>
                      {option.label}
                    </p>
                    {option.sub && (
                      <p className="text-[11px] text-muted-foreground truncate">{option.sub}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                {filtered.length} option{filtered.length !== 1 ? "s" : ""}
                {query && ` matching "${query}"`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
