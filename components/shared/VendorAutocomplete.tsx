"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface VendorOption {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  inputClassName: string;
  strict?: boolean;
}

export default function VendorAutocomplete({
  value,
  onChange,
  placeholder,
  required,
  inputClassName,
  strict = false,
}: Props) {
  const [options, setOptions] = useState<VendorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setFetchError(false);
    fetch(`/api/vendors?status=active`, { signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          console.error("[VendorAutocomplete] /api/vendors failed:", r.status, d?.error);
          setFetchError(true);
          setOptions([]);
          return;
        }
        setOptions(Array.isArray(d.vendors) ? d.vendors.map((v: any) => ({ id: v.id, name: v.name })) : []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("[VendorAutocomplete] /api/vendors network error:", err);
        setFetchError(true);
        setOptions([]);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (strict) {
          const exact = options.find((o) => o.name.toLowerCase() === value.toLowerCase());
          if (!exact && value) onChange("");
        }
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [strict, options, value, onChange]);

  const filtered = value
    ? options.filter((o) => o.name.toLowerCase().includes(value.toLowerCase()))
    : options;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? (loading ? "Loading vendors…" : "Search or select a vendor…")}
          className={`${inputClassName} pr-9`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Clear vendor"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          {filtered.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onChange(v.name);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
      {open && !loading && fetchError && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-red-200 dark:border-red-800 bg-card shadow-lg px-4 py-2 text-xs text-red-600 dark:text-red-400 font-medium">
          Couldn't load the vendor list — check your connection and try again.
        </div>
      )}
      {open && !loading && !fetchError && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-lg px-4 py-2 text-xs text-muted-foreground">
          {options.length === 0 ? (
            <>
              No active vendors yet. Ask an admin to add one in Admin → Vendors.
            </>
          ) : strict ? (
            "No matching vendor. Ask an admin to add this vendor first."
          ) : (
            "No matching vendor — you can keep typing a custom supplier name."
          )}
        </div>
      )}
    </div>
  );
}
