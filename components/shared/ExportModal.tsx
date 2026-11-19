"use client"

import { useState } from "react"
import { X, Download, Check, FileDown } from "lucide-react"

export interface ExportField {
  key:      string
  label:    string
  selected: boolean
  format?:  (value: any, row: any) => string
}

interface ExportModalProps {
  open:     boolean
  onClose:  () => void
  title:    string
  fields:   ExportField[]
  data:     Record<string, any>[]
  filename: string
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportModal({ open, onClose, title, fields: init, data, filename }: ExportModalProps) {
  const [fields, setFields] = useState<ExportField[]>(init)

  if (!open) return null

  const toggleField = (key: string) =>
    setFields(p => p.map(f => f.key === key ? { ...f, selected: !f.selected } : f))

  function handleExport() {
    const active = fields.filter(f => f.selected)
    const header = active.map(f => `"${f.label}"`).join(",")
    const rows   = data.map(row =>
      active.map(f => {
        const raw = f.format ? f.format(row[f.key], row) : (row[f.key] ?? "")
        return `"${String(raw).replace(/"/g, '""')}"`
      }).join(",")
    )
    downloadCSV("\uFEFF" + [header, ...rows].join("\n"), filename)
    onClose()
  }

  const n = fields.filter(f => f.selected).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center">
              <FileDown size={15} className="text-brand-navy dark:text-brand-gold"/>
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
              <p className="text-[11px] text-muted-foreground">{n} of {fields.length} fields · {data.length.toLocaleString()} rows</p>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <X size={14}/>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-foreground">Select fields to export:</p>
            <div className="flex gap-2 text-[11px]">
              <button onClick={() => setFields(p=>p.map(f=>({...f,selected:true})))} className="text-brand-navy dark:text-brand-gold hover:underline">All</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => setFields(p=>p.map(f=>({...f,selected:false})))} className="text-brand-navy dark:text-brand-gold hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {fields.map(f => (
              <button key={f.key} type="button" onClick={() => toggleField(f.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors text-[12px] ${f.selected?"border-brand-navy/40 bg-brand-navy/[0.05] dark:border-brand-gold/40 dark:bg-brand-gold/[0.05]":"border-border hover:border-brand-navy/30"}`}>
                <div className={`h-4 w-4 rounded flex-shrink-0 flex items-center justify-center ${f.selected?"bg-brand-navy dark:bg-brand-gold":"border border-border"}`}>
                  {f.selected && <Check size={9} className="text-brand-gold dark:text-brand-navy"/>}
                </div>
                <span className="truncate text-foreground">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleExport} disabled={n === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-50 transition-colors">
            <Download size={14}/> Download CSV
          </button>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}
