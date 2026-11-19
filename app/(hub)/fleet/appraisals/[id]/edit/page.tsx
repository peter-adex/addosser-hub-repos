"use client"
import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter }          from "next/navigation"
import { ChevronLeft, Save, Loader2, Star, AlertTriangle } from "lucide-react"
import {
  PERSONAL_ATTRIBUTES_TEMPLATE, KPA_TEMPLATE,
  calcAppraisalScores, getAppraisalGrade, APPRAISAL_GRADE_LABELS,
  APPRAISAL_RATING_LABELS,
  type PersonalAttribute, type AppraisalKPA, type AppraisalRating,
} from "@/types/fleet"

const GRADE_COLORS: Record<string, string> = {
  A:"bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  B:"bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  C:"bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  D:"bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  E:"bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-brand-navy dark:bg-brand-gold transition-all" style={{ width: `${pct}%` }}/>
      </div>
      <span className="text-[11px] font-semibold text-foreground w-10 text-right">{value.toFixed(1)}%</span>
    </div>
  )
}

export default function EditAppraisalPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [loading,   setLoading]   = useState(true)
  const [appraisal, setAppraisal] = useState<any>(null)
  const [attrs,     setAttrs]     = useState<PersonalAttribute[]>([])
  const [kpas,      setKpas]      = useState<AppraisalKPA[]>([])
  const [comments,  setComments]  = useState("")
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    fetch(`/api/fleet/appraisals/${id}`, { credentials: "include" })
      .then(r => r.json()).then(d => {
        const a = d.data; if (!a) { setLoading(false); return }
        setAppraisal(a)
        setComments(a.supervisorComments ?? "")
        try {
          const parsed = JSON.parse(a.scoresJson ?? "{}")
          setAttrs(parsed.personalAttributes?.length
            ? parsed.personalAttributes
            : PERSONAL_ATTRIBUTES_TEMPLATE.map((t: any) => ({ ...t, rating: null }))
          )
          setKpas(parsed.kpas?.length
            ? parsed.kpas
            : KPA_TEMPLATE.map((kpa: any) => ({ ...kpa, kpis: kpa.kpis.map((k: any) => ({ ...k, achievement: null })) }))
          )
        } catch {
          setAttrs(PERSONAL_ATTRIBUTES_TEMPLATE.map((t: any) => ({ ...t, rating: null })))
          setKpas(KPA_TEMPLATE.map((kpa: any) => ({ ...kpa, kpis: kpa.kpis.map((k: any) => ({ ...k, achievement: null })) })))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  function setRating(key: string, rating: AppraisalRating | null) {
    setAttrs(prev => prev.map(a => a.key === key ? { ...a, rating } : a))
  }

  function setAchievement(kpaKey: string, kpiKey: string, value: number | null) {
    setKpas(prev => prev.map(kpa =>
      kpa.key !== kpaKey ? kpa : {
        ...kpa,
        kpis: kpa.kpis.map(kpi =>
          kpi.key !== kpiKey ? kpi : { ...kpi, achievement: value }
        ),
      }
    ))
  }

  const scores = useMemo(() => calcAppraisalScores({ personalAttributes: attrs, kpas }), [attrs, kpas])

  function validate(): boolean {
    const e: Record<string, string> = {}
    kpas.forEach(kpa => {
      kpa.kpis.forEach(kpi => {
        if (kpi.achievement !== null && kpi.achievement > kpi.maxWeight) {
          e[`kpi_${kpa.key}_${kpi.key}`] = `Cannot exceed max of ${kpi.maxWeight}`
        }
        if (kpi.achievement !== null && kpi.achievement < 0) {
          e[`kpi_${kpa.key}_${kpi.key}`] = `Must be 0 or greater`
        }
      })
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setSaveError("")
    const res = await fetch(`/api/fleet/appraisals/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        personalAttributes:   scores.personalAttributes,
        kpas:                 scores.kpas,
        supervisorComments:   comments || undefined,
        section1Score:        scores.section1Score,
        section1Contribution: scores.section1Contribution,
        vehicleMaintScore:    scores.vehicleMaintScore,
        safetyScore:          scores.safetyScore,
        processScore:         scores.processScore,
        section2Contribution: scores.section2Contribution,
        overallScore:         scores.overallScore,
        grade:                scores.grade,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(json.error ?? "Save failed"); return }
    setSaved(true)
    setTimeout(() => router.push(`/fleet/appraisals/${id}`), 900)
  }

  if (loading) return <div className="max-w-2xl space-y-4">{[100, 300].map((h, i) => <div key={i} className="bg-card border border-border rounded-xl animate-pulse" style={{ height: h }}/>)}</div>
  if (!appraisal || appraisal.status !== "draft") return (
    <div className="text-center py-16">
      <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3"/>
      <p className="text-[14px] font-semibold text-foreground mb-1">Cannot edit this appraisal</p>
      <p className="text-[12.5px] text-muted-foreground">Only draft appraisals can be edited.</p>
      <button onClick={() => router.push("/fleet/appraisals")} className="text-brand-navy hover:underline mt-3 text-[12.5px]">← Back to Appraisals</button>
    </div>
  )

  const grade = scores.grade

  return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => router.push(`/fleet/appraisals/${id}`)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Appraisal
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center">
          <Star size={20} className="text-brand-navy dark:text-brand-gold"/>
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-foreground">Edit Appraisal</h2>
          <p className="text-[12px] text-muted-foreground">{appraisal.driverName} · {appraisal.period}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-foreground">Live Score</p>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${GRADE_COLORS[grade]}`}>
              Grade {grade} — {APPRAISAL_GRADE_LABELS[grade]}
            </span>
            <span className="text-[20px] font-bold text-foreground">{scores.overallScore.toFixed(1)}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[11px] text-muted-foreground mb-1">Sec 1 — Attributes (20%)</p><ScoreBar value={scores.section1Contribution}/></div>
          <div><p className="text-[11px] text-muted-foreground mb-1">Sec 2 — KPAs (80%)</p><ScoreBar value={scores.section2Contribution}/></div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4 pb-2 border-b border-border">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Section 1 — Personal Attributes</p>
              <p className="text-[11.5px] text-muted-foreground">Rating scale: 2 = Needs Improvement · 3 = Meets · 4 = Exceeds · 5 = Outstanding</p>
            </div>
            <p className="text-[16px] font-bold text-foreground">{scores.section1Score.toFixed(1)}%</p>
          </div>
          <div className="space-y-3">
            {attrs.map(attr => (
              <div key={attr.key} className="rounded-lg border border-border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{attr.label}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{attr.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {([2, 3, 4, 5] as AppraisalRating[]).map(r => (
                      <button key={r} type="button" title={APPRAISAL_RATING_LABELS[r]}
                        onClick={() => setRating(attr.key, attr.rating === r ? null : r)}
                        className={`h-8 w-8 rounded-lg text-[12.5px] font-bold border transition-colors ${
                          attr.rating === r
                            ? "bg-brand-navy text-brand-gold border-brand-navy dark:bg-brand-gold dark:text-brand-navy dark:border-brand-gold"
                            : "border-border text-muted-foreground hover:border-brand-navy/50 hover:text-foreground"
                        }`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {attr.rating !== null && (
                  <p className="mt-2 text-[11px] text-brand-navy dark:text-brand-gold font-medium">
                    ✓ {APPRAISAL_RATING_LABELS[attr.rating as AppraisalRating]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4 pb-2 border-b border-border">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Section 2 — Performance KPAs</p>
              <p className="text-[11.5px] text-muted-foreground">Enter actual achievement. Cannot exceed the maximum score for each KPI.</p>
            </div>
            <p className="text-[16px] font-bold text-foreground">{scores.section2Contribution.toFixed(1)}%</p>
          </div>
          <div className="space-y-5">
            {kpas.map(kpa => {
              const kpaAch = kpa.kpis.reduce((s, k) => s + (k.achievement ?? 0), 0)
              const kpaMax = kpa.kpis.reduce((s, k) => s + k.maxWeight, 0)
              return (
                <div key={kpa.key} className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[12.5px] font-semibold text-foreground">{kpa.label}</p>
                      <p className="text-[11px] text-muted-foreground">Weight: {kpa.sectionWeight}%</p>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">{kpaAch}/{kpaMax}</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {kpa.kpis.map(kpi => {
                      const err = errors[`kpi_${kpa.key}_${kpi.key}`]
                      return (
                        <div key={kpi.key} className="flex items-center gap-4 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] text-foreground leading-snug">{kpi.description}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Max: {kpi.maxWeight} pts</p>
                            {err && <p className="text-[11px] text-red-500 mt-0.5 flex items-center gap-1"><AlertTriangle size={10}/>{err}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input type="number" min={0} max={kpi.maxWeight} step={0.5} placeholder="0"
                              value={kpi.achievement ?? ""}
                              onChange={e => {
                                const v = e.target.value === "" ? null : parseFloat(e.target.value)
                                setAchievement(kpa.key, kpi.key, v)
                                if (err) setErrors(prev => { const n = { ...prev }; delete n[`kpi_${kpa.key}_${kpi.key}`]; return n })
                              }}
                              className={`w-20 rounded-lg border text-center text-[13px] font-semibold px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition ${err ? "border-red-400" : "border-border"}`}
                            />
                            <span className="text-[11.5px] text-muted-foreground">/{kpi.maxWeight}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-3">Supervisor Comments</p>
          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
            rows={4} value={comments} onChange={e => setComments(e.target.value)}
            placeholder="Overall comments on driver's performance…"/>
        </div>

        {saveError && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{saveError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
          <button type="button" onClick={() => router.push(`/fleet/appraisals/${id}`)}
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
