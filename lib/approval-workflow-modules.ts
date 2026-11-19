export interface ModuleOption {
  value: string;
  label: string;
}

export interface ActionOption {
  value: string;
  label: string;
}

export const MODULE_OPTIONS: ModuleOption[] = [
  { value: "invoice", label: "Invoice" },
  { value: "assets", label: "Asset" },
  { value: "finance", label: "Finance / GL" },
  { value: "budgeting", label: "Budgeting" },
  { value: "payment", label: "Payment" },
  { value: "facility", label: "Facility" },
  { value: "fleet", label: "Fleet" },
  { value: "procurement", label: "Procurement" },
];

export const MODULE_ACTIONS: Record<string, ActionOption[]> = {
  invoice: [{ value: "SUBMIT", label: "Submit for Approval" }],
  assets: [
    { value: "REGISTER", label: "Register / Edit Asset Details" },
    { value: "MOVE", label: "Movement Request" },
    { value: "DISPOSE", label: "Dispose Asset" },
    { value: "SPLIT", label: "Split Asset" },
  ],
  finance: [
    { value: "JOURNAL", label: "GL Journal Entry" },
    { value: "CREDIT", label: "GL Credit Entry" },
  ],
  budgeting: [{ value: "SUBMIT", label: "Submit Budget" }],
  payment: [{ value: "PROCESS", label: "Process Payment" }],
  facility: [{ value: "REQUEST", label: "Facility Request" }],
  fleet: [{ value: "GENERAL", label: "General" }],
  procurement: [{ value: "PURCHASE", label: "Purchase Request" }],
};

export const MODULES_NOT_YET_WIRED = new Set(["fleet", "procurement", "payment", "facility"]);
