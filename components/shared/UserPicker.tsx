"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface Props {
  value: string;
  onChange: (userId: string, user: UserOption | null) => void;
  placeholder?: string;
  inputClassName: string;
}

export default function UserPicker({ value, onChange, placeholder, inputClassName }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    if (selected) return;
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/users-lookup?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setOptions(Array.isArray(d.users) ? d.users : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, selected]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={selected ? `${selected.name} (${selected.email})` : query}
          onChange={(e) => {
            if (selected) return;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (selected) {
              setSelected(null);
              onChange("", null);
              setQuery("");
            }
            setOpen(true);
          }}
          placeholder={placeholder ?? (loading ? "Loading users…" : "Search by name or email…")}
          className={`${inputClassName} pr-9`}
        />
        {(selected || query) && (
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
              onChange("", null);
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}
        {loading && !selected && (
          <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={14} />
        )}
      </div>

      {open && !selected && options.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          {options.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setSelected(u);
                setOpen(false);
                onChange(u.id, u);
              }}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </button>
          ))}
        </div>
      )}
      {open && !selected && !loading && options.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-lg px-4 py-2 text-xs text-muted-foreground">
          No matching user found.
        </div>
      )}
    </div>
  );
}
