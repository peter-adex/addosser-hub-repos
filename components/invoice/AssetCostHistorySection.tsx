'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/shared/Badge'
import type { AssetCostHistoryRow, AssetCostHistorySummary } from '@/lib/asset-cost-history'

const WINDOWS: { key: string; label: string; days: number }[] = [
  { key: '30', label: 'Last 30 Days', days: 30 },
  { key: '120', label: 'Last 4 Months', days: 120 },
  { key: '180', label: 'Last 6 Months', days: 180 },
  { key: '365', label: 'Last 12 Months', days: 365 },
  { key: 'all', label: 'All Time', days: Infinity }
]

const fmt = (n: number) => `₦${Math.round(n).toLocaleString()}`

export default function AssetCostHistorySection ({
  assetName,
  summary,
  rows
}: {
  assetName: string
  summary: AssetCostHistorySummary
  rows: AssetCostHistoryRow[]
}) {
  const [activeWindow, setActiveWindow] = useState('all')

  const filteredRows = useMemo(() => {
    const w = WINDOWS.find((x) => x.key === activeWindow)
    if (!w || w.days === Infinity) return rows
    const cutoff = new Date(Date.now() - w.days * 24 * 60 * 60 * 1000)
    return rows.filter((r) => new Date(r.transactionDate) >= cutoff)
  }, [rows, activeWindow])

  const windowExpenditure =
    activeWindow === 'all'
      ? summary.totalAllTime
      : summary.byWindow[activeWindow] ?? 0

  return (
    <div className='bg-card border border-border rounded-2xl overflow-hidden'>
      <div className='px-6 py-4 border-b border-border'>
        <h2 className='font-bold text-foreground'>Asset Expense History</h2>
        <p className='text-xs text-muted-foreground mt-0.5'>{assetName}</p>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 border-b border-border'>
        {[
          ['Total Historical Expenditure', fmt(summary.totalAllTime)],
          ['Current-Year Expenditure', fmt(summary.currentYear)],
          ['Maintenance Transactions', String(summary.maintenanceCount)],
          ['Repair Transactions', String(summary.repairCount)]
        ].map(([label, val]) => (
          <div key={label} className='p-3 rounded-xl bg-muted/30 border border-border'>
            <div className='text-lg font-extrabold text-foreground'>{val}</div>
            <div className='text-xs text-muted-foreground'>{label}</div>
          </div>
        ))}
      </div>

      <div className='flex items-center gap-1 px-6 pt-4 flex-wrap'>
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            onClick={() => setActiveWindow(w.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeWindow === w.key
                ? 'bg-[#1B2A8A] text-white'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {w.label}
          </button>
        ))}
        <span className='ml-auto text-xs text-muted-foreground pr-2'>
          Net for period: <strong className='text-foreground'>{fmt(windowExpenditure)}</strong>
        </span>
      </div>

      <div className='overflow-x-auto mt-2'>
        {filteredRows.length === 0 ? (
          <div className='py-10 text-center text-sm text-muted-foreground'>No transactions in this period.</div>
        ) : (
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='bg-muted/40'>
                {['Date', 'Type', 'Description', 'Amount', 'Vendor', 'GL Account', 'Entity', 'Invoice', 'Status', ''].map((h) => (
                  <th key={h} className='px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className='border-t border-border hover:bg-accent/20'>
                  <td className='px-4 py-2.5 text-muted-foreground'>{new Date(r.transactionDate).toLocaleDateString('en-NG')}</td>
                  <td className='px-4 py-2.5'>
                    <Badge variant={r.entryType === 'DEBIT' ? 'gray' : 'green'}>{r.entryType === 'DEBIT' ? 'Expense' : 'Credit'}</Badge>
                  </td>
                  <td className='px-4 py-2.5 text-foreground max-w-[220px] truncate'>{r.description ?? '—'}</td>
                  <td className='px-4 py-2.5 font-semibold text-foreground'>{fmt(r.amount)}</td>
                  <td className='px-4 py-2.5 text-muted-foreground'>{r.vendorName ?? '—'}</td>
                  <td className='px-4 py-2.5 text-muted-foreground'>{r.glCode} — {r.glName}</td>
                  <td className='px-4 py-2.5 text-muted-foreground'>{r.entityCode}</td>
                  <td className='px-4 py-2.5 font-mono text-xs text-muted-foreground'>{r.invoiceNo ?? '—'}</td>
                  <td className='px-4 py-2.5'><Badge variant={r.status === 'POSTED' ? 'green' : 'gray'}>{r.status}</Badge></td>
                  <td className='px-4 py-2.5'>
                    {r.invoiceId && (
                      <Link href={`/invoice/${r.invoiceId}`} className='inline-flex items-center gap-1 text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'>
                        <ExternalLink size={12} /> View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
