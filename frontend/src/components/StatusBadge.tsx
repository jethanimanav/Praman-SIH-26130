import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Lock,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  XCircle,
} from "lucide-react";

export type DataStatus =
  | "VERIFIED"
  | "DEMO"
  | "MOCK"
  | "VERIFICATION_REQUIRED"
  | "CONFIGURATION_REQUIRED"
  | "SANDBOX";

const STATUS_STYLES: Record<DataStatus, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-900 border-emerald-300",
  DEMO: "bg-amber-50 text-amber-900 border-amber-300",
  MOCK: "bg-blue-50 text-blue-900 border-blue-300",
  VERIFICATION_REQUIRED: "bg-orange-50 text-orange-900 border-orange-300",
  CONFIGURATION_REQUIRED: "bg-rose-50 text-rose-900 border-rose-300",
  SANDBOX: "bg-slate-100 text-slate-800 border-slate-300",
};

const STATUS_LABELS: Record<DataStatus, string> = {
  VERIFIED: "Verified Data",
  DEMO: "Demo Data",
  MOCK: "Mock Integration",
  VERIFICATION_REQUIRED: "Verification Required",
  CONFIGURATION_REQUIRED: "Configuration Required",
  SANDBOX: "Sandbox Mode",
};

interface StatusBadgeProps {
  status: DataStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border tracking-tight",
        STATUS_STYLES[status] || "bg-gray-100 text-gray-800 border-gray-300",
        className
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export type RequirementCategory =
  | "Required"
  | "Conditional"
  | "Not Applicable"
  | "Verification Required";

const CATEGORY_STYLES: Record<RequirementCategory, string> = {
  Required: "bg-blue-50 text-blue-900 border-blue-300 font-semibold",
  Conditional: "bg-amber-50 text-amber-900 border-amber-300",
  "Verification Required": "bg-slate-100 text-slate-800 border-slate-300",
  "Not Applicable": "bg-gray-100 text-gray-700 border-gray-300",
};

interface CategoryBadgeProps {
  category: RequirementCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const getIcon = () => {
    switch (category) {
      case "Required":
        return <CheckCircle2 className="h-3 w-3 text-blue-700" />;
      case "Conditional":
        return <AlertTriangle className="h-3 w-3 text-amber-700" />;
      case "Verification Required":
        return <HelpCircle className="h-3 w-3 text-slate-600" />;
      case "Not Applicable":
        return <XCircle className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        CATEGORY_STYLES[category] || "bg-gray-100 text-gray-700 border-gray-300",
        className
      )}
    >
      {getIcon()}
      {category}
    </span>
  );
}

// Step Status Badges
export type StepStatus = "BLOCKED" | "READY" | "IN_PROGRESS" | "APPROVED" | "REJECTED";

const STEP_CONFIG: Record<
  StepStatus,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  BLOCKED: {
    label: "Pending Prerequisites",
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Lock,
  },
  READY: {
    label: "Ready to Apply",
    style: "bg-blue-50 text-blue-800 border-blue-300 font-semibold",
    icon: ArrowRight,
  },
  IN_PROGRESS: {
    label: "Under Review",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Action Required",
    style: "bg-rose-50 text-rose-900 border-rose-300",
    icon: AlertCircle,
  },
};

export function StepStatusBadge({ status, className }: { status: StepStatus; className?: string }) {
  const config = STEP_CONFIG[status] || {
    label: status,
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// Application Status Badges
export type AppStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";

const APP_CONFIG: Record<
  AppStatus,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: {
    label: "Draft",
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  },
  SUBMITTED: {
    label: "Submitted",
    style: "bg-blue-50 text-blue-800 border-blue-300 font-medium",
    icon: CheckCircle2,
  },
  IN_REVIEW: {
    label: "In Review",
    style: "bg-slate-100 text-slate-800 border-slate-300",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Clarification Required",
    style: "bg-rose-50 text-rose-900 border-rose-300",
    icon: AlertCircle,
  },
};

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: AppStatus | string;
  className?: string;
}) {
  const norm = (status || "DRAFT") as AppStatus;
  const config = APP_CONFIG[norm] || {
    label: norm.replace(/_/g, " "),
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// SLA Status Badges
export type SLAStatusType =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "WARNING"
  | "OVERDUE"
  | "PAUSED"
  | "COMPLETED"
  | "SLA_VERIFICATION_REQUIRED";

const SLA_CONFIG: Record<
  SLAStatusType,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  NOT_STARTED: {
    label: "Pending",
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  },
  ON_TRACK: {
    label: "Within SLA",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  WARNING: {
    label: "Approaching SLA",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: Clock,
  },
  OVERDUE: {
    label: "Overdue",
    style: "bg-rose-50 text-rose-900 border-rose-300 font-semibold",
    icon: AlertTriangle,
  },
  PAUSED: {
    label: "Paused",
    style: "bg-slate-100 text-slate-700 border-slate-300",
    icon: Clock,
  },
  COMPLETED: {
    label: "Completed",
    style: "bg-blue-50 text-blue-800 border-blue-300",
    icon: CheckCircle2,
  },
  SLA_VERIFICATION_REQUIRED: {
    label: "SLA Verification Required",
    style: "bg-slate-100 text-slate-700 border-slate-300",
    icon: HelpCircle,
  },
};

export function SLAStatusBadge({ status, className }: { status: SLAStatusType; className?: string }) {
  const config = SLA_CONFIG[status] || {
    label: status.replace(/_/g, " "),
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// Escalation Badges
export function EscalationBadge({
  level,
  recipient,
  className,
}: {
  level: string;
  recipient?: string;
  className?: string;
}) {
  const isUnconfigured = !recipient || recipient === "ESCALATION_CONFIGURATION_REQUIRED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        isUnconfigured
          ? "bg-amber-50 text-amber-900 border-amber-300"
          : "bg-rose-50 text-rose-900 border-rose-300",
        className
      )}
    >
      <ShieldAlert className="h-3 w-3 shrink-0" />
      {level}: {isUnconfigured ? "Escalation Desk (Pending Setup)" : recipient}
    </span>
  );
}

// Document Status Badges
export type DocumentStatusType =
  | "MISSING"
  | "UPLOADED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "QUERY_RAISED";

const DOC_CONFIG: Record<
  DocumentStatusType,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  MISSING: {
    label: "Upload Required",
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: HelpCircle,
  },
  UPLOADED: {
    label: "Uploaded",
    style: "bg-blue-50 text-blue-800 border-blue-300",
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: "Under Scrutiny",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: Clock,
  },
  ACCEPTED: {
    label: "Accepted",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    style: "bg-rose-50 text-rose-900 border-rose-300",
    icon: AlertCircle,
  },
  QUERY_RAISED: {
    label: "Query Raised",
    style: "bg-amber-100 text-amber-900 border-amber-300 font-semibold",
    icon: AlertTriangle,
  },
};

export function DocumentStatusBadge({
  status,
  className,
}: {
  status: DocumentStatusType | string;
  className?: string;
}) {
  const norm = (status || "MISSING") as DocumentStatusType;
  const config = DOC_CONFIG[norm] || {
    label: norm.replace(/_/g, " "),
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: FileCheck2,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// Risk Badges
export type RiskCategoryType = "HIGH" | "MEDIUM" | "LOW";

const RISK_CONFIG: Record<
  RiskCategoryType,
  { label: string; style: string; dot: string }
> = {
  HIGH: {
    label: "High Risk",
    style: "bg-rose-50 text-rose-900 border-rose-300",
    dot: "bg-rose-600",
  },
  MEDIUM: {
    label: "Medium Risk",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    dot: "bg-amber-600",
  },
  LOW: {
    label: "Low Risk",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    dot: "bg-emerald-600",
  },
};

export function RiskCategoryBadge({
  category,
  colorCode,
  className,
}: {
  category: RiskCategoryType | string;
  colorCode?: string;
  className?: string;
}) {
  const norm = (category || "LOW").toUpperCase() as RiskCategoryType;
  const config = RISK_CONFIG[norm] || RISK_CONFIG.LOW;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-sm", config.dot)} />
      {config.label} {colorCode ? `(${colorCode})` : ""}
    </span>
  );
}

// Joint Inspection Status Badges
export type InspectionStatusType =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED";

const INSPECTION_CONFIG: Record<
  InspectionStatusType,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SCHEDULED: {
    label: "Scheduled",
    style: "bg-blue-50 text-blue-800 border-blue-300",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "Visit in Progress",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: Clock,
  },
  COMPLETED: {
    label: "Visit Completed",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelled",
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: XCircle,
  },
  RESCHEDULED: {
    label: "Rescheduled",
    style: "bg-slate-100 text-slate-800 border-slate-300",
    icon: Clock,
  },
};

export function InspectionStatusBadge({
  status,
  className,
}: {
  status: InspectionStatusType | string;
  className?: string;
}) {
  const norm = (status || "SCHEDULED") as InspectionStatusType;
  const config = INSPECTION_CONFIG[norm] || {
    label: norm.replace(/_/g, " "),
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// Inspection Outcome Badges
export type InspectionOutcomeType =
  | "SATISFACTORY"
  | "DEFICIENCIES_NOTED"
  | "NON_COMPLIANT";

const OUTCOME_CONFIG: Record<
  InspectionOutcomeType,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SATISFACTORY: {
    label: "Satisfactory",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  DEFICIENCIES_NOTED: {
    label: "Deficiencies Noted",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: AlertTriangle,
  },
  NON_COMPLIANT: {
    label: "Non-Compliant",
    style: "bg-rose-50 text-rose-900 border-rose-300",
    icon: AlertCircle,
  },
};

export function InspectionOutcomeBadge({
  outcome,
  className,
}: {
  outcome: InspectionOutcomeType | string;
  className?: string;
}) {
  const norm = (outcome || "SATISFACTORY") as InspectionOutcomeType;
  const config = OUTCOME_CONFIG[norm] || {
    label: norm.replace(/_/g, " "),
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: CheckCircle2,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// Compliance Filing Status Badges
export type ComplianceStatusType =
  | "UPCOMING"
  | "DUE_SOON"
  | "OVERDUE"
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED";

const COMPLIANCE_CONFIG: Record<
  ComplianceStatusType,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  UPCOMING: {
    label: "Upcoming",
    style: "bg-blue-50 text-blue-800 border-blue-300",
    icon: Clock,
  },
  DUE_SOON: {
    label: "Due Soon",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: AlertTriangle,
  },
  OVERDUE: {
    label: "Overdue",
    style: "bg-rose-50 text-rose-900 border-rose-300 font-semibold",
    icon: AlertCircle,
  },
  SUBMITTED: {
    label: "Submitted",
    style: "bg-slate-100 text-slate-800 border-slate-300",
    icon: Clock,
  },
  VERIFIED: {
    label: "Verified",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Clarification Needed",
    style: "bg-rose-50 text-rose-900 border-rose-300",
    icon: AlertCircle,
  },
};

export function ComplianceStatusBadge({
  status,
  className,
}: {
  status: ComplianceStatusType | string;
  className?: string;
}) {
  const norm = (status || "UPCOMING") as ComplianceStatusType;
  const config = COMPLIANCE_CONFIG[norm] || {
    label: norm.replace(/_/g, " "),
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}

// Scheme Eligibility Badges
export type SchemeEligibilityType =
  | "ELIGIBLE"
  | "POTENTIALLY_ELIGIBLE"
  | "NOT_ELIGIBLE";

const SCHEME_CONFIG: Record<
  SchemeEligibilityType,
  { label: string; style: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ELIGIBLE: {
    label: "Eligible for Support",
    style: "bg-emerald-50 text-emerald-900 border-emerald-300",
    icon: CheckCircle2,
  },
  POTENTIALLY_ELIGIBLE: {
    label: "Information Needed",
    style: "bg-amber-50 text-amber-900 border-amber-300",
    icon: AlertTriangle,
  },
  NOT_ELIGIBLE: {
    label: "Not Applicable",
    style: "bg-gray-100 text-gray-700 border-gray-300",
    icon: XCircle,
  },
};

export function SchemeEligibilityBadge({
  status,
  className,
}: {
  status: SchemeEligibilityType | string;
  className?: string;
}) {
  const norm = (status || "ELIGIBLE") as SchemeEligibilityType;
  const config = SCHEME_CONFIG[norm] || SCHEME_CONFIG.ELIGIBLE;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
        config.style,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}
    </span>
  );
}
