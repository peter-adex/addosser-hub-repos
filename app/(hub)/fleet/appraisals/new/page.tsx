"use client"

import { useState, useMemo } from "react"
import { useRouter }         from "next/navigation"
import { ChevronLeft, Save, Loader2, Star, TrendingUp, CheckCircle2, Info } from "lucide-react"
import { SearchableSelect }  from "@/components/shared/SearchableSelect"
import { useDrivers, useEntities, useMutation } from "@/lib/hooks/useApi"
import {
  PERSONAL_ATTRIBUTES_TEMPLATE,
  KPA_TEMPLATE,
  calcAppraisalScores,
  getAppraisalGrade,
  APPRAISAL_GRADE_LABELS,
  APPRAISAL_RATING_LABELS,
  type PersonalAttribute,
  type AppraisalKPA,
  type AppraisalRating,
} from "@/types/fleet"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const YEARS  = Array.from({length:5},(_,i)=>new Date().getFullYear()-i)

const GRADE_COLORS: Record<string,string> = {
  A:"bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  B:"bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  C:"bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  D:"bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  E:"bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
}

function ScoreBar({ value, max=100, color="bg-brand-navy dark:bg-brand-gold" }: { value:number; max?:number; color?:string }) {
  const pct = Math.min(100, Math.max(0, (value/max)*100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{width:`${pct}%`}}/>
      </div>
      <span className="text-[11.5px] font-semibold text-foreground w-12 text-right">{value.toFixed(1)}%</span>
    </div>
  )
}

export default function NewAppraisalPage() {
  const router   = useRouter()
  const { mutate, loading:saving, error:saveError } = useMutation()
  const { data: drvRes } = useDrivers({ status:"active" })
  const { data: entRes } = useEntities()

  const now          = new Date()
  const [driverId,   setDriverId]   = useState("")
  const [entityId,   setEntityId]   = useState("")
  const [month,      setMonth]      = useState(now.getMonth())
  const [year,       setYear]       = useState(now.getFullYear())
  const [comments,   setComments]   = useState("")
  const [errors,     setErrors]     = useState<Record<string,string>>({})

  const [attrs, setAttrs] = useState<PersonalAttribute[]>(
    PERSONAL_ATTRIBUTES_TEMPLATE.map(a => ({ ...a, rating: null }))
  )

  function setRating(key:string, rating:AppraisalRating|null) {
    setAttrs(prev => prev.map(a => a.key === key ? { ...a, rating } : a))
  }

  const [kpas, setKpas] = useState<AppraisalKPA[]>(
    KPA_TEMPLATE.map(kpa => ({
      ...kpa,
      kpis: kpa.kpis.map(kpi => ({ ...kpi, achievement: null })),
    }))
  )

  function setAchievement(kpaKey:string, kpiKey:string, value:number|null) {
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

  function validate() {
    const e:Record<string,string> = {}
    if (!driverId)  e.driverId  = "Select a driver"
    if (!entityId)  e.entityId  = "Select an entity"
    const unratedAttrs = attrs.filter(a => a.rating === null).length
    if (unratedAttrs > 0) e.attrs = `${unratedAttrs} attribute${unratedAttrs!==1?"s":""} not yet rated`
    kpas.forEach(kpa => {
      kpa.kpis.forEach(kpi => {
        if (kpi.achievement === null) e[`kpi_${kpa.key}_${kpi.key}`] = "Score required"
        else if (kpi.achievement < 0 || kpi.achievement > kpi.maxWeight) {
          e[`kpi_${kpa.key}_${kpi.key}`] = `Must be 0 – ${kpi.maxWeight}`
        }
      })
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(asDraft: boolean) {
    if (!asDraft && !validate()) return
    if (asDraft && !driverId) { setErrors({driverId:"Select a driver first"}); return }

    const driver     = drvRes?.items?.find(d => d.id === driverId)
    const periodMonth= month + 1
    const period     = `${MONTHS[month]} ${year}`

    const { data, error } = await mutate("POST", "/api/fleet/appraisals", {
      driverId,
      period,
      periodMonth,
      periodYear:           year,
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
    })

    if (!error) router.push("/fleet/appraisals")
  }

  const driverOptions  = (drvRes?.items ?? []).map(d => ({ value:d.id, label:d.user.name, sub:d.user.email }))
  const entityOptions  = (entRes?.items ?? []).map(e => ({ value:e.id, label:e.name, sub:e.code }))
  const monthOptions   = MONTHS.map((m,i) => ({ value:String(i), label:m }))
  const yearOptions    = YEARS.map(y => ({ value:String(y), label:String(y) }))

  const grade = scores.grade

  return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => router.push("/fleet/appraisals")}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Appraisals
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center">
          <Star size={20} className="text-brand-navy dark:text-brand-gold"/>
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-foreground">New Driver Appraisal</h2>
          <p className="text-[12px] text-muted-foreground">Monthly performance evaluation form</p>
        </div>
      </div>

      <div className="space-y-5">

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-navy dark:text-brand-gold"/>
              <p className="text-[13px] font-semibold text-foreground">Live Score</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${GRADE_COLORS[grade]}`}>
                Grade {grade} — {APPRAISAL_GRADE_LABELS[grade]}
              </span>
              <span className="text-[20px] font-bold text-foreground">{scores.overallScore.toFixed(1)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Section 1 — Personal Attributes (20%)</p>
              <ScoreBar value={scores.section1Contribution} color="bg-blue-500"/>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Section 2 — Performance Assessment (80%)</p>
              <ScoreBar value={scores.section2Contribution} color="bg-emerald-500"/>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Vehicle Maintenance KPA (40%)</p>
              <ScoreBar value={scores.vehicleMaintScore * 0.4} color="bg-amber-500"/>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Overall Score</p>
              <ScoreBar value={scores.overallScore}/>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Driver & Period</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Driver <span className="text-red-500">*</span></label>
              <SearchableSelect
                options={driverOptions}
                value={driverId}
                onChange={setDriverId}
                placeholder="Select driver to appraise"
                error={errors.driverId}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Entity <span className="text-red-500">*</span></label>
              <SearchableSelect options={entityOptions} value={entityId} onChange={setEntityId} placeholder="Select entity" error={errors.entityId}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Appraisal Month</label>
              <SearchableSelect
                options={monthOptions}
                value={String(month)}
                onChange={v => setMonth(parseInt(v))}
                placeholder="Month"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Year</label>
              <SearchableSelect
                options={yearOptions}
                value={String(year)}
                onChange={v => setYear(parseInt(v))}
                placeholder="Year"
              />
            </div>
          </div>
          {driverId && (
            <div className="mt-3 rounded-lg bg-muted/30 border border-border px-3 py-2 text-[12px] text-muted-foreground">
              Appraisal period: <strong className="text-foreground">{MONTHS[month]} {year}</strong>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4 pb-2 border-b border-border">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Section 1 — Personal &amp; Professional Attributes</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Weight: 20% of total score</p>
            </div>
            <div className="text-right">
              <p className="text-[18px] font-bold text-foreground">{scores.section1Score.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground">Section score</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11px] text-muted-foreground">
            {([5,4,3,2] as AppraisalRating[]).map(r => (
              <span key={r}><strong className="text-foreground">{r}</strong> = {APPRAISAL_RATING_LABELS[r]}</span>
            ))}
          </div>

          {errors.attrs && (
            <div className="mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Info size={13} className="flex-shrink-0"/> {errors.attrs}
            </div>
          )}

          <div className="space-y-3">
            {attrs.map(attr => (
              <div key={attr.key} className="rounded-lg border border-border p-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{attr.label}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{attr.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {([2,3,4,5] as AppraisalRating[]).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRating(attr.key, attr.rating === r ? null : r)}
                        title={APPRAISAL_RATING_LABELS[r]}
                        className={`h-8 w-8 rounded-lg text-[12.5px] font-bold border transition-colors ${
                          attr.rating === r
                            ? "bg-brand-navy text-brand-gold border-brand-navy dark:bg-brand-gold dark:text-brand-navy dark:border-brand-gold"
                            : "border-border text-muted-foreground hover:border-brand-navy/50 hover:text-foreground"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {attr.rating !== null && (
                  <p className="mt-2 text-[11px] text-brand-navy dark:text-brand-gold font-medium">
                    ✓ {APPRAISAL_RATING_LABELS[attr.rating]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-4 pb-2 border-b border-border">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Section 2 — Performance Assessment (KPAs)</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Weight: 80% of total score. Enter actual achievement for each KPI.</p>
            </div>
            <div className="text-right">
              <p className="text-[18px] font-bold text-foreground">{scores.section2Contribution.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground">Section contribution</p>
            </div>
          </div>

          <div className="space-y-5">
            {kpas.map(kpa => {
              const kpaScoreRaw = kpa.kpis.reduce((s,k) => s+(k.achievement??0), 0)
              const kpaMax      = kpa.kpis.reduce((s,k) => s+k.maxWeight, 0)
              const kpaPct      = kpaMax > 0 ? (kpaScoreRaw/kpaMax)*100 : 0

              return (
                <div key={kpa.key} className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[12.5px] font-semibold text-foreground">{kpa.label}</p>
                      <p className="text-[11px] text-muted-foreground">Weight: {kpa.sectionWeight}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-bold text-foreground">{kpaPct.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">{kpaScoreRaw}/{kpaMax} pts</p>
                    </div>
                  </div>

                  <div className="divide-y divide-border/50">
                    {kpa.kpis.map(kpi => {
                      const err = errors[`kpi_${kpa.key}_${kpi.key}`]
                      return (
                        <div key={kpi.key} className="px-4 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] text-foreground leading-snug">{kpi.description}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Max score: {kpi.maxWeight}</p>
                            {err && <p className="text-[11px] text-red-500 mt-0.5">{err}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={kpi.maxWeight}
                              step={0.5}
                              placeholder="0"
                              value={kpi.achievement ?? ""}
                              onChange={e => {
                                const v = e.target.value === "" ? null : parseFloat(e.target.value)
                                setAchievement(kpa.key, kpi.key, v)
                              }}
                              className={`w-20 rounded-lg border text-center text-[13px] font-semibold px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition ${
                                err ? "border-red-400" : "border-border"
                              }`}
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
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
            rows={4}
            placeholder="Overall comments on driver's performance, areas of strength, areas for improvement…"
            value={comments}
            onChange={e => setComments(e.target.value)}
          />
        </div>

        <div className="bg-muted/30 border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-3">Score Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:"Section 1 (20%)",  value:`${scores.section1Contribution.toFixed(1)}%` },
              { label:"Section 2 (80%)",  value:`${scores.section2Contribution.toFixed(1)}%` },
              { label:"Overall Score",    value:`${scores.overallScore.toFixed(1)}%`, highlight:true },
              { label:"Grade",            value:grade, grade:true },
            ].map(s => (
              <div key={s.label} className={`rounded-lg border p-3 text-center ${s.highlight?"border-brand-navy/30 dark:border-brand-gold/30 bg-brand-navy/[0.04]":"border-border bg-card"}`}>
                <p className="text-[10.5px] text-muted-foreground mb-1">{s.label}</p>
                {s.grade
                  ? <span className={`inline-block rounded-full px-3 py-0.5 text-[14px] font-bold ${GRADE_COLORS[s.value]}`}>{s.value}</span>
                  : <p className={`text-[17px] font-bold ${s.highlight?"text-brand-navy dark:text-brand-gold":"text-foreground"}`}>{s.value}</p>
                }
              </div>
            ))}
          </div>
        </div>

        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-[12.5px] text-red-700 dark:text-red-300">
            {saveError}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
            {saving ? "Saving…" : "Save Appraisal"}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors"
          >
            Save as Draft (skip validation)
          </button>
          <button
            type="button"
            onClick={() => router.push("/fleet/appraisals")}
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
