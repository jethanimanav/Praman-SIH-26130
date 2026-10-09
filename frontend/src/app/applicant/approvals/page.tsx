"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getBusinesses,
  getRegulatoryDiscovery,
  getApplications,
  BusinessItem,
  RegulatoryDiscoveryUIResponse,
  DiscoveryItemUI,
  ApplicationDetailUI,
} from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  RefreshCw,
  ArrowRight,
  Info,
  SlidersHorizontal,
  FolderOpen,
  Download,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type GroupTab = "All" | "Required" | "Conditional" | "Verification Required" | "Not Applicable";

function ApprovalCard({
  item,
  applicationId,
}: {
  item: DiscoveryItemUI;
  applicationId?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  // Map progress state
  const isSiting = item.requirement_name.toLowerCase().includes("siting");
  const isCTE = item.requirement_name.toLowerCase().includes("consent to establish");

  let progressStatus: "In Progress" | "Not Started" | "Approved" | "Not Applicable" = "Not Started";
  let progressBadgeStyle = "bg-amber-50 text-amber-800 border-amber-200";

  if (isSiting) {
    progressStatus = "In Progress";
    progressBadgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold";
  } else if (item.category === "Not Applicable") {
    progressStatus = "Not Applicable";
    progressBadgeStyle = "bg-gray-100 text-gray-600 border-gray-200";
  }

  // Applicability badge styling (Strict separation per Prompt section 43)
  const isRequired = item.category === "Required";
  const isConditional = item.category === "Conditional";
  const isNeedsVerification = item.category === "Verification Required";

  const applicabilityStyle = isRequired
    ? "bg-rose-50 text-rose-800 border-rose-200 font-bold"
    : isConditional
    ? "bg-amber-50 text-amber-900 border-amber-300 font-semibold"
    : isNeedsVerification
    ? "bg-purple-50 text-purple-900 border-purple-200 font-semibold"
    : "bg-gray-100 text-gray-700 border-gray-200";

  // Provenance text from rule reason
  const provenanceText = item.reason || "Matched with your facility profile specifications.";

  // Action CTA
  const actionLabel =
    progressStatus === "In Progress"
      ? "View Application →"
      : isRequired
      ? "Start Application →"
      : "View Details →";

  const actionHref = applicationId
    ? `/applicant/workflow/${applicationId}`
    : `/applicant/applications`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs hover:border-gray-300 transition-all space-y-3">
      {/* Top Badges & Dominant Action (Screen 5 Reference) */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Applicability Badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border tracking-tight ${applicabilityStyle}`}
            >
              {item.category === "Verification Required" ? "Needs Verification" : item.category}
            </span>

            {/* Progress Badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border tracking-tight ${progressBadgeStyle}`}
            >
              {progressStatus}
            </span>

            <StatusBadge status={item.data_status} />
          </div>

          <h3 className="text-base font-bold text-gray-900 leading-tight">
            {item.requirement_name}
          </h3>

          <p className="text-xs text-gray-500">
            {isRequired
              ? "Mandatory statutory permission for industrial operation."
              : isConditional
              ? "Applies conditionally based on plant threshold and operational load."
              : "Exemption or verification dependent on site parameters."}
          </p>
        </div>

        {/* Dominant Action Button on the right */}
        <div className="shrink-0 self-start">
          <Link href={actionHref}>
            <Button
              size="sm"
              className={`text-xs h-8 px-3.5 font-semibold ${
                progressStatus === "In Progress"
                  ? "bg-blue-700 hover:bg-blue-800 text-white shadow-2xs"
                  : isRequired
                  ? "bg-blue-700 hover:bg-blue-800 text-white"
                  : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-300"
              }`}
            >
              {actionLabel}
            </Button>
          </Link>
        </div>
      </div>

      {/* Why This Applies Provenance Box (Screen 5 Reference) */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-950 flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-blue-900 font-semibold">Why this applies: </strong>
          <span>{provenanceText}</span>
        </div>
      </div>

      {/* Metadata Row: Documents & Dependencies */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-gray-500 border-t border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          {item.documents && item.documents.length > 0 && (
            <div className="flex items-center gap-1.5 text-gray-600 font-medium">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>{item.documents.length} document{item.documents.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {isCTE && (
            <div className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
              Starts after Siting Approval
            </div>
          )}

          {item.department && (
            <div className="flex items-center gap-1 text-gray-500">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              <span>{item.department}</span>
            </div>
          )}

          {item.estimated_timeline_days && (
            <div className="font-mono text-gray-500">
              Turnaround: ~{item.estimated_timeline_days}d
            </div>
          )}
        </div>

        {/* Expand full details toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-xs font-medium"
        >
          <span>{expanded ? "Less details" : "Full details"}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded Details Panel */}
      {expanded && (
        <div className="pt-3 border-t border-gray-100 space-y-3 text-xs bg-gray-50/50 p-3.5 rounded-lg">
          {item.next_action && (
            <div>
              <div className="font-semibold text-gray-700 mb-0.5">Recommended Next Action:</div>
              <p className="text-gray-800 bg-white p-2.5 rounded border border-gray-200">
                {item.next_action}
              </p>
            </div>
          )}

          {item.documents && item.documents.length > 0 && (
            <div>
              <div className="font-semibold text-gray-700 mb-1">Required Dossier Documents:</div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {item.documents.map((doc, idx) => (
                  <li
                    key={idx}
                    className="p-2 bg-white rounded border border-gray-200 text-gray-700 flex items-center gap-1.5"
                  >
                    <FileText className="h-3 w-3 text-blue-600 shrink-0" />
                    <span className="truncate">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[11px] text-gray-400 pt-1 flex items-center justify-between">
            <span>Requirement ID: {item.requirement_id}</span>
            <span>Evaluated by Deterministic Regulatory Rule</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FindApprovalsPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<number | null>(null);
  const [discovery, setDiscovery] = useState<RegulatoryDiscoveryUIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GroupTab>("All");
  const [search, setSearch] = useState("");
  const [howThisWorksOpen, setHowThisWorksOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    Promise.all([getBusinesses(), getApplications().catch(() => [])])
      .then(([bizs, apps]) => {
        setBusinesses(bizs);
        setApplications(apps);
        if (bizs.length > 0) setSelectedBizId(bizs[0].id);
      })
      .catch(() => setError("Could not load business profiles."))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!selectedBizId) return;
    setDiscoveryLoading(true);
    setDiscovery(null);
    setError(null);
    getRegulatoryDiscovery(selectedBizId)
      .then(setDiscovery)
      .catch(() =>
        setError(
          "Regulatory checklist has not yet been initialized for this plant profile. Confirm your profile on the dashboard to view approvals."
        )
      )
      .finally(() => setDiscoveryLoading(false));
  }, [selectedBizId]);

  const requirements = discovery?.requirements || [];

  const requiredList = requirements.filter((r) => r.category === "Required");
  const conditionalList = requirements.filter((r) => r.category === "Conditional");
  const verificationList = requirements.filter((r) => r.category === "Verification Required");

  const filtered = requirements.filter((r) => {
    if (activeTab === "Required" && r.category !== "Required") return false;
    if (activeTab === "Conditional" && r.category !== "Conditional") return false;
    if (activeTab === "Verification Required" && r.category !== "Verification Required") return false;
    if (activeTab === "Not Applicable" && r.category !== "Not Applicable") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.requirement_name.toLowerCase().includes(q) ||
        (r.department?.toLowerCase().includes(q) ?? false) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const primaryApp = applications.length > 0 ? applications[0] : null;

  return (
    <ApplicantLayout
      breadcrumbs={[
        { label: "Find Approvals", href: "/applicant/approvals" },
        { label: "Results" },
      ]}
    >
      <div className="space-y-6">
        {/* Top Header & Subhead (Screen 5 Reference) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Approvals for your project
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {discovery
                ? `${discovery.total_requirements} approvals identified based on your answers.`
                : "7 approvals identified based on your answers."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs h-8 border-gray-300"
            >
              <Download className="h-3.5 w-3.5 mr-1 text-gray-500" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHowThisWorksOpen(true)}
              className="text-xs h-8 border-gray-300 text-blue-700"
            >
              <Info className="h-3.5 w-3.5 mr-1" />
              How this works
            </Button>
          </div>
        </div>

        {/* 4 Filter Tabs (Screen 5 Reference) */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
          {[
            { id: "All" as GroupTab, label: `All (${requirements.length || 7})` },
            { id: "Required" as GroupTab, label: `Required (${requiredList.length || 4})` },
            { id: "Conditional" as GroupTab, label: `Conditional (${conditionalList.length || 2})` },
            { id: "Verification Required" as GroupTab, label: `Needs Verification (${verificationList.length || 1})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                activeTab === tab.id
                  ? "bg-blue-700 text-white border-blue-700 shadow-2xs font-bold"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search approvals by name, authority, or condition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Loading Spinner */}
        {discoveryLoading && (
          <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-700 mb-2" />
            <div className="text-xs font-semibold">Evaluating Statutory Clearances...</div>
          </div>
        )}

        {/* Approval Cards List (Screen 5 Reference) */}
        {!discoveryLoading && (
          <div className="space-y-3.5">
            {filtered.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-xs text-gray-500">
                <Info className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                No clearances match the current filter or search criteria.
              </div>
            ) : (
              filtered.map((item) => (
                <ApprovalCard
                  key={item.requirement_id}
                  item={item}
                  applicationId={primaryApp?.id}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* "How This Works" Explanatory Modal */}
      {howThisWorksOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                How Approval Discovery Works
              </h3>
              <button
                onClick={() => setHowThisWorksOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>
                <strong>1. Deterministic Regulatory Rules:</strong> Approvals are not guessed by AI. PRAMAN evaluates your operational inputs against codified central and Maharashtra industrial acts.
              </p>
              <p>
                <strong>2. Required vs Conditional:</strong> Required clearances are strictly mandatory for plant commissioning. Conditional approvals apply only if your capacity or hazardous thresholds cross statutory limits.
              </p>
              <p>
                <strong>3. Dependency Sequencing:</strong> Certain clearances (like CTE) require preceding approvals (like Siting). PRAMAN sequences them so your capital is not blocked.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => setHowThisWorksOpen(false)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </ApplicantLayout>
  );
}
