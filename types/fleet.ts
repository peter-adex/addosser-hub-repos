export type UserRole =
  | "admin"
  | "supervisor"
  | "driver"
  | "hr_advisor"
  | "custom_user";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  driver: "Driver",
  hr_advisor: "HR Advisor",
  custom_user: "Custom User",
};

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  approvalLimitNgn?: number;
  entityId?: string;
}

export interface EntityLocation {
  id: string;
  entityId: string;
  name: string;
  address: string;
  city: string;
  isHeadOffice: boolean;
}
export interface Entity {
  id: string;
  name: string;
  shortName: string;
  code: string;
  annualMaintenanceBudgetNgn: number;
  locations: EntityLocation[];
  status: "active" | "inactive";
  createdAt: Date;
}

export type LicenseType =
  | "federal_road_safety"
  | "state_drivers_license"
  | "vehicle_inspection"
  | "commercial"
  | "heavy_duty"
  | "motorcycle"
  | "other";

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  federal_road_safety: "Federal Road Safety (FRSC)",
  state_drivers_license: "State Driver's License",
  vehicle_inspection: "Vehicle Inspection License",
  commercial: "Commercial / Hiring License",
  heavy_duty: "Heavy Duty / Truck License",
  motorcycle: "Motorcycle License",
  other: "Other Certificate",
};

export interface DriverLicense {
  id: string;
  type: LicenseType;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate?: Date;
  expiryDate: Date;
  isPrimary: boolean;
}

export interface StatusStaffDetails {
  staffName: string;
  department: string;
  jobRole: string;
  staffId?: string;
  phone?: string;
  email?: string;
}

export type AllocationStatus =
  | "available"
  | "allocated_driver"
  | "allocated_status";

export type VehicleCategory =
  | "saloon"
  | "suv"
  | "jeep"
  | "truck"
  | "motorcycle";
export type VehicleStatus = "active" | "idle" | "maintenance" | "retired";
export type VehicleUse = "pool" | "status";

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  saloon: "Saloon",
  suv: "SUV",
  jeep: "Jeep",
  truck: "Truck",
  motorcycle: "Motorcycle",
};
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  active: "Active",
  idle: "Idle",
  maintenance: "In Maintenance",
  retired: "Retired",
};
export const VEHICLE_USE_LABELS: Record<VehicleUse, string> = {
  pool: "Pool Vehicle",
  status: "Status Vehicle",
};

export interface VehicleImage {
  id: string;
  vehicleId: string;
  url: string;
  isPrimary: boolean;
  uploadedAt: Date;
}
export interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  category: VehicleCategory;
  vehicleUse: VehicleUse;
  status: VehicleStatus;
  colour?: string;
  chassisNumber: string;
  engineNumber?: string;
  mileage: number;
  purchaseDate?: Date;
  acquisitionValueNgn?: number;
  usefulLifeYears: number;
  entityId?: string;
  locationId?: string;
  purchaseVendorId?: string;
  assignedDriverId?: string;
  statusStaffDetails?: StatusStaffDetails;
  allocationStatus: AllocationStatus;
  images?: VehicleImage[];
  createdAt: Date;
}

export interface VehicleFinancials {
  ageYears: number;
  ageMonths: number;
  ageTotalMonths: number;
  acquisitionValueNgn: number;
  depreciationPerMonth: number;
  depreciationPerYear: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  usefulLifeYears: number;
  isDueForReplacement: boolean;
  residualValueNgn: number;
}
export function calcVehicleFinancials(
  vehicle: Partial<Vehicle> & {
    acquisitionValueNgn?: number;
    usefulLifeYears?: number;
    purchaseDate?: Date;
  },
): VehicleFinancials {
  const acquisitionValueNgn = vehicle.acquisitionValueNgn ?? 0;
  const usefulLifeYears = vehicle.usefulLifeYears ?? 5;
  const purchaseDate = vehicle.purchaseDate ?? new Date();
  const now = new Date();
  const ageTotalMonths = Math.max(
    0,
    (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375),
  );
  const ageYears = Math.floor(ageTotalMonths / 12);
  const ageMonths = Math.floor(ageTotalMonths % 12);
  const usefulLifeMonths = usefulLifeYears * 12;
  const depreciationPerMonth =
    usefulLifeMonths > 0 ? acquisitionValueNgn / usefulLifeMonths : 0;
  const depreciationPerYear =
    usefulLifeYears > 0 ? acquisitionValueNgn / usefulLifeYears : 0;
  const accumulatedDepreciation = Math.min(
    depreciationPerMonth * ageTotalMonths,
    acquisitionValueNgn,
  );
  const netBookValue = Math.max(
    0,
    acquisitionValueNgn - accumulatedDepreciation,
  );
  return {
    ageYears,
    ageMonths,
    ageTotalMonths: Math.floor(ageTotalMonths),
    acquisitionValueNgn,
    depreciationPerMonth,
    depreciationPerYear,
    accumulatedDepreciation,
    netBookValue,
    usefulLifeYears,
    isDueForReplacement: ageTotalMonths >= usefulLifeYears * 12,
    residualValueNgn: 0,
  };
}

export interface Driver {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  licenses: DriverLicense[];
  assignedVehicleId?: string;
  status: "active" | "inactive";
  supervisorId?: string;
  entityId?: string;
}
export function getPrimaryLicense(driver: Driver): DriverLicense | undefined {
  return driver.licenses.find((l) => l.isPrimary) ?? driver.licenses[0];
}

export type TripStatus = "ongoing" | "completed" | "cancelled";
export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  purpose?: string;
  passengerCount?: number;
  passengerNames?: string;
  startOdometer: number;
  endOdometer?: number;
  distanceKm?: number;
  startLocation: string;
  endLocation: string;
  startTime: Date;
  endTime?: Date;
  status: TripStatus;
  isLocked: boolean;
  createdById: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId: string;
  date: Date;
  litres: number;
  costPerLitre: number;
  totalCost: number;
  odometerKm: number;
  station?: string;
  entityId?: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vendorId?: string;
  type: string;
  description?: string;
  date: Date;
  costNgn: number;
  nextDueDate?: Date;
  nextDueKm?: number;
}

export type VendorClassification =
  | "service_repair"
  | "fuel"
  | "parts_accessories"
  | "vehicle_purchase";
export const VENDOR_CLASSIFICATION_LABELS: Record<
  VendorClassification,
  string
> = {
  service_repair: "Service & Repair",
  fuel: "Fuel",
  parts_accessories: "Parts & Accessories",
  vehicle_purchase: "Vehicle Purchase",
};
export interface VendorContact {
  name: string;
  phone: string;
  email?: string;
  designation?: string;
}
export interface Vendor {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  classifications: VendorClassification[];
  contacts: VendorContact[];
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  status: "active" | "inactive";
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export type ReminderType = "service" | "document_renewal";
export type DocumentRenewalType =
  | "insurance"
  | "road_worthiness"
  | "vehicle_license"
  | "hackney_permit"
  | "fire_extinguisher"
  | "other";
export type ReminderStatus =
  | "pending"
  | "acknowledged"
  | "completed"
  | "overdue";
export const DOCUMENT_RENEWAL_LABELS: Record<DocumentRenewalType, string> = {
  insurance: "Insurance",
  road_worthiness: "Road Worthiness",
  vehicle_license: "Vehicle License",
  hackney_permit: "Hackney Permit",
  fire_extinguisher: "Fire Extinguisher",
  other: "Other",
};
export interface Reminder {
  id: string;
  vehicleId: string;
  type: ReminderType;
  documentType?: DocumentRenewalType;
  title: string;
  dueDate: Date;
  dueMileageKm?: number;
  notifyDaysBefore: number;
  status: ReminderStatus;
  notes?: string;
  createdBy: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export type WorkOrderType = "service" | "repair" | "parts_accessories";
export type WorkOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
export interface WorkOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitCostNgn: number;
  totalCostNgn: number;
}
export interface WorkOrderAttachment {
  id: string;
  workOrderId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
  description?: string;
  uploadedById: string;
  uploadedByName: string;
  uploadedAt: Date;
}
export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  vehicleId: string;
  type: WorkOrderType;
  vendorId: string;
  items: WorkOrderItem[];
  totalCostNgn: number;
  description?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  attachments?: WorkOrderAttachment[];
  createdById: string;
  createdByName: string;
  approverId: string;
  approverName: string;
  approverLimitNgn: number;
  approvedAt?: Date;
  approvalNote?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  actualCostNgn?: number;
  completedAt?: Date;
  invoiceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ApprovalLimit {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  maxAmountNgn: number;
}

export type AppraisalRating = 5 | 4 | 3 | 2;
export const APPRAISAL_RATING_LABELS: Record<AppraisalRating, string> = {
  5: "Outstanding",
  4: "Exceeds Expectation",
  3: "Meets Expectation",
  2: "Needs Improvement",
};
export interface PersonalAttribute {
  key: string;
  label: string;
  description: string;
  rating: AppraisalRating | null;
}
export const PERSONAL_ATTRIBUTES_TEMPLATE: Omit<PersonalAttribute, "rating">[] =
  [
    {
      key: "innovation",
      label: "Innovation",
      description:
        "Develop new ideas and approaches; taking initiatives when required",
    },
    {
      key: "transparency",
      label: "Transparency",
      description:
        "Accountable to all engagements with stakeholders; upfront with all details",
    },
    {
      key: "discipline",
      label: "Discipline",
      description: "Doing what is expected without any sense of entitlement",
    },
    {
      key: "integrity",
      label: "Integrity",
      description: "Zero tolerance for dishonest behaviour and hidden agendas",
    },
    {
      key: "simplicity",
      label: "Simplicity",
      description: "Strive for simplicity in all things",
    },
    {
      key: "appearance",
      label: "Appearance & Hygiene",
      description:
        "Conforms to dress code policy; maintains personal hygiene at all times",
    },
    {
      key: "punctuality",
      label: "Punctuality/Attendance",
      description:
        "Reports to duty on time; maintains consistent attendance record",
    },
  ];
export interface AppraisalKPI {
  key: string;
  description: string;
  maxWeight: number;
  achievement: number | null;
}
export interface AppraisalKPA {
  key: string;
  label: string;
  sectionWeight: number;
  kpis: AppraisalKPI[];
}

export const KPA_TEMPLATE: (Omit<AppraisalKPA, "kpis"> & {
  kpis: Omit<AppraisalKPI, "achievement">[];
})[] = [
  {
    key: "vehicle_maintenance",
    label: "Vehicle Maintenance",
    sectionWeight: 40,
    kpis: [
      {
        key: "cleanliness",
        description: "Cleanliness and tidiness of assigned vehicle",
        maxWeight: 15,
      },
      {
        key: "serviced",
        description: "Ensure assigned vehicle is regularly serviced when due",
        maxWeight: 5,
      },
      {
        key: "daily_check",
        description: "Carry out daily routine check of the vehicle",
        maxWeight: 10,
      },
      {
        key: "repairs",
        description: "Number of repairs carried out in a month above budget",
        maxWeight: 10,
      },
    ],
  },
  {
    key: "safety_standards",
    label: "Maintenance of Safety Standards",
    sectionWeight: 10,
    kpis: [
      {
        key: "accident_free",
        description: "Ensure all trips made are accident free",
        maxWeight: 10,
      },
    ],
  },
  {
    key: "process_controls",
    label: "Process, Controls & Operational Performance",
    sectionWeight: 30,
    kpis: [
      {
        key: "traffic_rules",
        description: "Ensure all traffic rules and regulations are observed",
        maxWeight: 15,
      },
      {
        key: "license_renewal",
        description: "Timely renewal of driver's license",
        maxWeight: 5,
      },
      {
        key: "logbook",
        description: "Maintain accurate log book record",
        maxWeight: 5,
      },
      {
        key: "conduct",
        description: "Professional conduct while on duty",
        maxWeight: 5,
      },
    ],
  },
];

export type AppraisalStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  | "acknowledged";
export interface AppraisalScore {
  personalAttributes: PersonalAttribute[];
  section1Score: number;
  section1Contribution: number;
  kpas: AppraisalKPA[];
  vehicleMaintScore: number;
  safetyScore: number;
  processScore: number;
  section2Contribution: number;
  overallScore: number;
  grade: string;
}
export interface DriverAppraisal {
  id: string;
  driverId: string;
  driverName: string;
  supervisorId: string;
  supervisorName: string;
  entityId: string;
  period: string;
  periodMonth: number;
  periodYear: number;
  status: AppraisalStatus;
  scores: AppraisalScore;
  supervisorComments?: string;
  driverComments?: string;
  hrReviewedAt?: Date;
  hrReviewerId?: string;
  hrReviewerName?: string;
  hrNotes?: string;
  createdAt: Date;
  submittedAt?: Date;
  acknowledgedAt?: Date;
}

export function getAppraisalGrade(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}
export const APPRAISAL_GRADE_LABELS: Record<string, string> = {
  A: "Exceptional",
  B: "Good",
  C: "Satisfactory",
  D: "Below Expectation",
  E: "Unsatisfactory",
};
export function calcAppraisalScores(
  scores: Omit<
    AppraisalScore,
    | "section1Score"
    | "section1Contribution"
    | "vehicleMaintScore"
    | "safetyScore"
    | "processScore"
    | "section2Contribution"
    | "overallScore"
    | "grade"
  >,
): AppraisalScore {
  const ratedAttrs = scores.personalAttributes.filter((a) => a.rating !== null);
  const maxS1 = scores.personalAttributes.length * 5;
  const sumS1 = ratedAttrs.reduce((s, a) => s + (a.rating ?? 0), 0);
  const section1Score = maxS1 > 0 ? (sumS1 / maxS1) * 100 : 0;
  const section1Contribution = section1Score * 0.2;
  const findKPA = (key: string) => scores.kpas.find((k) => k.key === key);
  function kpaScore(kpaKey: string): number {
    const kpa = findKPA(kpaKey);
    if (!kpa) return 0;
    const maxTotal = kpa.kpis.reduce((s, k) => s + k.maxWeight, 0);
    const achTotal = kpa.kpis.reduce((s, k) => s + (k.achievement ?? 0), 0);
    return maxTotal > 0 ? (achTotal / maxTotal) * 100 : 0;
  }
  const vehicleMaintScore = kpaScore("vehicle_maintenance");
  const safetyScore = kpaScore("safety_standards");
  const processScore = kpaScore("process_controls");
  const section2Contribution =
    vehicleMaintScore * 0.4 + safetyScore * 0.1 + processScore * 0.3;
  const overallScore = section1Contribution + section2Contribution;
  const grade = getAppraisalGrade(overallScore);
  return {
    ...scores,
    section1Score,
    section1Contribution,
    vehicleMaintScore,
    safetyScore,
    processScore,
    section2Contribution,
    overallScore,
    grade,
  };
}

export type NotificationType =
  | "work_order_pending"
  | "work_order_approved"
  | "work_order_rejected"
  | "reminder_due"
  | "reminder_overdue"
  | "vehicle_replacement"
  | "license_expiring"
  | "trip_ended"
  | "user_invited"
  | "appraisal_submitted"
  | "appraisal_reviewed"
  | "system";
export type NotificationStatus = "unread" | "read" | "actioned";
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  actionLabel?: string;
  actionUrl?: string;
  recipientId: string;
  relatedId?: string;
  createdAt: Date;
  readAt?: Date;
}

export interface InviteUserPayload {
  name: string;
  email: string;
  phone?: string;
  systemRole: UserRole;
  entityId?: string;
  approvalLimitNgn?: number;
}
export interface InvitedUser extends InviteUserPayload {
  id: string;
  mustChangePassword: boolean;
  isActive: boolean;
  invitedById: string;
  invitedAt: Date;
  lastLoginAt?: Date;
}

export const APP_MODULES = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "vehicles", label: "Vehicles", icon: "Truck" },
  { key: "drivers", label: "Drivers", icon: "Users" },
  { key: "trips", label: "Trips", icon: "MapPin" },
  { key: "fuel", label: "Fuel Logs", icon: "Fuel" },
  { key: "maintenance", label: "Maintenance", icon: "Wrench" },
  { key: "work_orders", label: "Work Orders", icon: "ClipboardList" },
  { key: "vendors", label: "Vendors", icon: "Building2" },
  { key: "reminders", label: "Reminders", icon: "BellRing" },
  { key: "appraisals", label: "Appraisals", icon: "Star" },
  { key: "entities", label: "Entity Setup", icon: "Landmark" },
  { key: "reports", label: "Reports", icon: "BarChart2" },
  { key: "announcements", label: "Announcements", icon: "Megaphone" },
  { key: "subscription", label: "Subscription", icon: "Key" },
  { key: "audit", label: "Audit Trail", icon: "ScrollText" },
  { key: "settings", label: "Settings", icon: "Settings" },
] as const;

export type AppModule = (typeof APP_MODULES)[number]["key"];

export interface ModulePermission {
  module: AppModule;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  permissions: ModulePermission[];
  createdAt: Date;
}

export interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  phone?: string;
  systemRole: UserRole;
  approvalLimitNgn?: number;
  entityId?: string;
  isActive: boolean;
  customRoles: CustomRole[];
  moduleOverrides?: ModulePermission[];
  lastLoginAt?: Date;
}

export interface ResolvedPermission {
  module: AppModule;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
}

export function normalizeModuleKey(key: string): string {
  return key.toLowerCase().replace(/-/g, "_");
}

export function resolvePermissions(
  systemRole: string,
  customRoles: CustomRole[],
  overrides: ModulePermission[] = [],
): ResolvedPermission[] {
  if (systemRole === "admin") {
    return APP_MODULES.map((m) => ({
      module: m.key,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canExport: true,
      canApprove: true,
    }));
  }

  if (systemRole === "hr_advisor") {
    return APP_MODULES.map((m) => ({
      module: m.key,
      canView: ["dashboard", "drivers", "appraisals", "reports"].includes(
        m.key,
      ),
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canExport: m.key === "appraisals" || m.key === "reports",
      canApprove: false,
    }));
  }

  return APP_MODULES.map((mod) => {
    const override = overrides.find(
      (o) => normalizeModuleKey(o.module) === normalizeModuleKey(mod.key),
    );
    if (override) return { ...override, module: mod.key };

    const normKey = normalizeModuleKey(mod.key);
    const rolePerms = customRoles.flatMap((r) =>
      r.permissions.filter((p) => normalizeModuleKey(p.module) === normKey),
    );

    if (rolePerms.length > 0) {
      return {
        module: mod.key,
        canView: rolePerms.some((p) => p.canView),
        canCreate: rolePerms.some((p) => p.canCreate),
        canEdit: rolePerms.some((p) => p.canEdit),
        canDelete: rolePerms.some((p) => p.canDelete),
        canExport: rolePerms.some((p) => p.canExport),
        canApprove: rolePerms.some((p) => p.canApprove),
      };
    }

    if (systemRole === "custom_user") {
      return {
        module: mod.key,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
        canApprove: false,
      };
    }

    const isSup = systemRole === "supervisor";
    return {
      module: mod.key,
      canView: isSup && !["settings", "entities"].includes(mod.key),
      canCreate:
        isSup && !["settings", "entities", "reports"].includes(mod.key),
      canEdit:
        isSup &&
        !["settings", "entities", "reports", "vehicles"].includes(mod.key),
      canDelete: false,
      canExport: isSup,
      canApprove: isSup && mod.key === "work_orders",
    };
  });
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
  roles: UserRole[];
}
