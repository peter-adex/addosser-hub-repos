"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface UseApiResult<T> {
  data:    T | null
  loading: boolean
  error:   string | null
  refetch: () => void
  isRefreshing: boolean
}

function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, v)
  })
  return url.toString()
}

function useApi<T>(
  url: string | null,
  params: Record<string, string | undefined> = {},
  options: { pollMs?: number } = {}
): UseApiResult<T> {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [tick,    setTick]    = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])
  const hasLoadedRef = useRef(false)
  const inFlightRef = useRef(false)
  const { pollMs } = options

  useEffect(() => {
    if (!url) { setLoading(false); return }
    if (inFlightRef.current) return

    let cancelled = false
    const isBackgroundPoll = hasLoadedRef.current
    if (isBackgroundPoll) setIsRefreshing(true)
    else setLoading(true)

    const fullUrl = Object.keys(params).length > 0 ? buildUrl(url, params) : url
    inFlightRef.current = true

    fetch(fullUrl, { credentials: "include" })
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Request failed (${res.status})`)
        }
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setData(json.data ?? json)
          setError(null)
          hasLoadedRef.current = true
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? "Unknown error")
      })
      .finally(() => {
        inFlightRef.current = false
        if (!cancelled) {
          setLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => { cancelled = true }
  }, [url, tick, JSON.stringify(params)])

  useEffect(() => {
    if (!url || !pollMs) return
    const id = setInterval(() => {
      if (document.hidden) return
      if (inFlightRef.current) return
      setTick(t => t + 1)
    }, pollMs)
    return () => clearInterval(id)
  }, [url, pollMs])

  return { data, loading, error, refetch, isRefreshing }
}

export function useDashboardStats() {
  return useApi<Record<string, number>>("/api/fleet/dashboard")
}

export interface ApiVehicleDocumentType {
  id: string; name: string; description?: string | null
  isActive: boolean; sortOrder: number
  createdAt: string; updatedAt: string
  _count?: { documents: number }
}

export function useVehicleDocumentTypes(params: { includeInactive?: boolean; search?: string } = {}) {
  return useApi<{ items: ApiVehicleDocumentType[] }>(
    "/api/fleet/vehicle-document-types",
    {
      includeInactive: params.includeInactive ? "true" : undefined,
      search: params.search
    }
  )
}

export interface ApiVehicleDocument {
  id: string; vehicleId: string; name: string; type: string
  documentTypeId?: string | null
  documentType?: { id: string; name: string; isActive: boolean } | null
  url?: string | null; fileSize?: number; mimeType?: string
  expiryDate?: string | null; uploadedAt: string
  uploadedBy?: { name: string }
}

export interface ApiVehicle {
  id: string; plateNumber: string; make: string; model: string; year: number
  category: string; vehicleUse: string; status: string; colour?: string
  mileage: number; purchaseDate?: string; acquisitionValueNgn?: number
  usefulLifeYears: number; allocationStatus: string
  statusStaffName?: string; statusStaffDept?: string; statusStaffRole?: string; statusStaffEmail?: string
  entityId?: string; locationId?: string; assignedDriverId?: string
  entity?: { id:string; name:string; code:string }
  assignedDriver?: { id:string; user: { name:string; email:string } }
  images?: { id:string; url:string; isPrimary:boolean }[]
  documents?: ApiVehicleDocument[]
  fuelEntitlement?: { type: 'litres' | 'naira'; amount: number; durationDays: number } | null
}

export function useVehicles(params: {
  search?:string; status?:string; entityId?:string; page?:string; limit?:string
  includeDocuments?: boolean; pollMs?: number
} = {}) {
  const { includeDocuments, pollMs, ...rest } = params
  return useApi<{ items: ApiVehicle[]; pagination: any }>("/api/fleet/vehicles", {
    ...(rest as any),
    includeDocuments: includeDocuments ? "true" : undefined
  }, { pollMs })
}

export function useVehicle(id: string | null) {
  return useApi<ApiVehicle>(id ? `/api/fleet/vehicles/${id}` : null)
}

export interface ApiDriver {
  id: string; userId: string; photoUrl?: string; status: string
  assignedVehicleId?: string; entityId?: string
  user: { id:string; name:string; email:string; phone?:string }
  entity?: { id:string; name:string; code:string }
  licenses: { id:string; type:string; licenseNumber:string; issuingAuthority:string; expiryDate:string; isPrimary:boolean }[]
  assignedVehicle?: { id:string; plateNumber:string; make:string; model:string }
}

export function useDrivers(params: { search?:string; status?:string; page?:string; limit?:string } = {}) {
  return useApi<{ items: ApiDriver[]; pagination: any }>("/api/fleet/drivers", params as any)
}

export function useDriver(id: string | null) {
  return useApi<ApiDriver>(id ? `/api/fleet/drivers/${id}` : null)
}

export interface ApiTrip {
  id: string; vehicleId: string; driverId: string; status: string
  startLocation: string; endLocation: string; startTime: string
  endTime?: string; startOdometer: number; endOdometer?: number
  distanceKm?: number; passengerCount: number; passengerNames?: string
  purpose?: string; isLocked: boolean; createdById: string
  vehicle?: { id:string; plateNumber:string; make:string; model:string }
  driver?:  { id:string; user: { name:string } }
}

export function useTrips(params: {
  search?:string; status?:string; dateFrom?:string; dateTo?:string; page?:string; limit?:string
} = {}) {
  return useApi<{ items: ApiTrip[]; pagination: any }>("/api/fleet/trips", params as any)
}

export interface ApiFuelLog {
  id: string; vehicleId: string; driverId: string; entityId?: string
  date: string; litres: number; costPerLitre: number; totalCost: number
  odometerKm: number; station?: string
  vehicle?: { plateNumber:string; make:string; model:string }
  driver?:  { user: { name:string } }
}

export function useFuelLogs(params: {
  search?:string; entityId?:string; dateFrom?:string; dateTo?:string; page?:string
} = {}) {
  return useApi<{ items: ApiFuelLog[]; pagination: any }>("/api/fleet/fuel", params as any)
}

export interface ApiMaintenance {
  id: string; vehicleId: string; vendorId?: string; type: string
  description?: string; date: string; costNgn: number
  nextDueDate?: string; nextDueKm?: number
  vehicle?: { plateNumber:string; make:string; model:string }
  vendor?:  { name:string }
}

export function useMaintenance(params: { search?:string; dateFrom?:string; dateTo?:string; page?:string } = {}) {
  return useApi<{ items: ApiMaintenance[]; pagination: any }>("/api/fleet/maintenance", params as any)
}

export interface ApiWorkOrder {
  id: string; workOrderNumber: string; vehicleId: string; vendorId: string
  type: string; totalCostNgn: number; description?: string; priority: string
  status: string; createdById: string; createdByName: string
  approverId: string; approverName: string; approverLimitNgn: number
  approvedAt?: string; approvalNote?: string; rejectedAt?: string; rejectionReason?: string
  createdAt: string; updatedAt: string
  vehicle?:     { plateNumber:string; make:string; model:string }
  vendor?:      { name:string }
  items?:       { id:string; description:string; quantity:number; unitCostNgn:number; totalCostNgn:number }[]
  attachments?: { id:string; fileName:string; fileSize:number; fileType:string; url:string; description?:string; uploadedByName:string }[]
}

export function useWorkOrders(params: { status?:string; page?:string } = {}) {
  return useApi<{ items: ApiWorkOrder[]; pagination: any }>("/api/work-orders", params as any)
}

export function useWorkOrder(id: string | null) {
  return useApi<ApiWorkOrder>(id ? `/api/work-orders/${id}` : null)
}

export interface ApiAppraisal {
  id: string; driverId: string; driverName: string; supervisorName: string
  period: string; periodMonth: number; periodYear: number; status: string
  overallScore: number; grade: string; scoresJson: string
  supervisorComments?: string; hrNotes?: string; hrReviewerName?: string; hrReviewedAt?: string
  submittedAt?: string; createdAt: string
}

export function useAppraisals(params: { search?:string; status?:string; page?:string } = {}) {
  return useApi<{ items: ApiAppraisal[]; pagination: any }>("/api/fleet/appraisals", params as any)
}

export interface ApiNotification {
  id: string; type: string; title: string; message: string; status: string
  actionLabel?: string; actionUrl?: string; recipientId: string
  relatedId?: string; createdAt: string; readAt?: string
}

export function useNotifications() {
  return useApi<{ items: ApiNotification[]; pagination: any }>("/api/notifications")
}

export interface ApiVendor {
  id: string; name: string; address: string; city: string; state: string
  classifications: string; isActive: boolean
  email?: string
  contacts?: { name:string; phone:string; email?:string; designation?:string }[]
}

export function useVendors(params: { search?:string; status?:string } = {}) {
  return useApi<{ items: ApiVendor[]; pagination: any }>("/api/fleet/vendors", params as any)
}

export interface ApiEntity {
  id: string; name: string; shortName?: string; code: string
  annualMaintenanceBudgetNgn: number; status: string
  locations?: { id:string; name:string; city:string; isHeadOffice:boolean }[]
}

export function useEntities() {
  return useApi<{ items: ApiEntity[]; pagination: any }>("/api/fleet/entities")
}

export interface ApiReminder {
  id: string; vehicleId: string; type: string; documentType?: string
  title: string; dueDate: string; dueMileageKm?: number; notifyDaysBefore: number
  status: string; notes?: string; createdAt: string
  vehicle?: { plateNumber:string; make:string; model:string }
}

export function useReminders(params: { status?:string; dateFrom?:string; dateTo?:string } = {}) {
  return useApi<{ items: ApiReminder[]; pagination: any }>("/api/fleet/reminders", params as any)
}

export function useMutation() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function mutate<T = any>(
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    url:    string,
    body?:  Record<string, any>
  ): Promise<{ data: T | null; error: string | null }> {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body:    body ? JSON.stringify(body) : undefined,
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = json.error ?? `Request failed (${res.status})`
        setError(msg)
        return { data: null, error: msg }
      }

      setError(null)
      return { data: json.data ?? json, error: null }
    } catch (err: any) {
      const msg = err.message ?? "Network error"
      setError(msg)
      return { data: null, error: msg }
    } finally {
      setLoading(false)
    }
  }

  return { mutate, loading, error }
}
