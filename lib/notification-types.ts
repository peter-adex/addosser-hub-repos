export const NOTIFICATION_TYPES = [
  { key: "wo_submitted",        label: "Work order submitted",         desc: "Notify approver when a WO is submitted for approval",  default: true  },
  { key: "wo_approved",         label: "Work order approved",          desc: "Notify creator when their WO is approved",              default: true  },
  { key: "wo_rejected",         label: "Work order rejected",          desc: "Notify creator when their WO is rejected",              default: true  },
  { key: "wo_recalled",         label: "Work order recalled",          desc: "Notify approver when a WO is recalled by the creator",  default: true  },
  { key: "wo_completed",        label: "Work order completed",         desc: "Notify creator when a work order is marked complete",   default: true  },
  { key: "trip_started",        label: "Trip started",                 desc: "Notify supervisor when a trip begins",                   default: false },
  { key: "trip_completed",      label: "Trip completed",               desc: "Notify supervisor when a trip ends",                     default: false },
  { key: "fuel_logged",         label: "Fuel purchase logged",         desc: "Notify supervisor when fuel is added",                   default: false },
  { key: "license_expiry",      label: "License expiring soon",        desc: "Alert when a driver's license expires within 30 days",  default: true  },
  { key: "reminder_due",        label: "Reminder due",                 desc: "Alert when a maintenance or other reminder is due",      default: true  },
  { key: "appraisal_submitted", label: "Appraisal sent to HR",         desc: "Notify HR when an appraisal is submitted for review",    default: true  },
  { key: "appraisal_reviewed",  label: "Appraisal reviewed by HR",     desc: "Notify supervisor when HR reviews an appraisal",         default: true  },
  { key: "user_invited",        label: "New user invited",             desc: "Notify admin when a new user is created",                default: true  },
  { key: "sub_expiry",          label: "Subscription expiring",        desc: "Alert admin 7 days before subscription expires",         default: true  },
  { key: "login_alert",         label: "Login from new device",        desc: "Alert admin on new device login",                        default: true  },
  { key: "announcement",        label: "New announcement",             desc: "Notify all users when a new announcement is posted",     default: true  },
] as const;

export type NotifKey = typeof NOTIFICATION_TYPES[number]["key"];
