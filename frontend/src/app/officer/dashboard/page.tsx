"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, User } from "@/lib/auth";
import {
  getOfficerOverview,
  getOfficerEscalations,
  acknowledgeEscalation,
  resolveEscalation,
  getOfficerPendingDocuments,
  reviewDocument,
  downloadDocument,
  getOfficerInspections,
  submitOfficerInspectionReport,
  getOfficerComplianceFilings,
  verifyOfficerComplianceFiling,
  OfficerEscalationItemUI,
  OfficerOverviewUI,
  OfficerPendingDocumentItemUI,
  JointInspectionItemUI,
  InspectionReportUI,
  ComplianceFilingItemUI,
} from "@/lib/api";
import {
  StatusBadge,
  SLAStatusBadge,
  DocumentStatusBadge,
  RiskCategoryBadge,
  InspectionStatusBadge,
  InspectionOutcomeBadge,
  ComplianceStatusBadge,
} from "@/components/StatusBadge";
import {
  Building2,
  LogOut,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
  FileText,
  Download,
  AlertCircle,
  X,
  FileCheck2,
  HelpCircle,
  XCircle,
  CalendarCheck2,
  Calendar,
  ClipboardList,
  CheckSquare,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfficerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [overview, setOverview] = useState<OfficerOverviewUI | null>(null);
  const [escalations, setEscalations] = useState<OfficerEscalationItemUI[]>([]);
  const [pendingDocs, setPendingDocs] = useState<OfficerPendingDocumentItemUI[]>([]);
  const [inspections, setInspections] = useState<JointInspectionItemUI[]>([]);
  const [complianceFilings, setComplianceFilings] = useState<ComplianceFilingItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"escalations" | "scrutiny" | "inspections" | "compliance">("escalations");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [docFilter, setDocFilter] = useState<string>("ALL");
  const [inspectionFilter, setInspectionFilter] = useState<string>("ALL");
  const [complianceFilter, setComplianceFilter] = useState<string>("ALL");
  const [selectedEscalation, setSelectedEscalation] = useState<OfficerEscalationItemUI | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<OfficerPendingDocumentItemUI | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<JointInspectionItemUI | null>(null);
  const [selectedFiling, setSelectedFiling] = useState<ComplianceFilingItemUI | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [scrutinyDecision, setScrutinyDecision] = useState<string>("ACCEPTED");
  const [scrutinyNote, setScrutinyNote] = useState<string>("");
  const [reportOutcome, setReportOutcome] = useState<"SATISFACTORY" | "DEFICIENCIES_NOTED" | "NON_COMPLIANT">("SATISFACTORY");
  const [deficienciesText, setDeficienciesText] = useState<string>("");
  const [correctiveActions, setCorrectiveActions] = useState<string>("");
  const [reinspectionRequired, setReinspectionRequired] = useState<boolean>(false);
  const [filingDecision, setFilingDecision] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [filingVerificationNotes, setFilingVerificationNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [submittingFiling, setSubmittingFiling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scrutinyError, setScrutinyError] = useState<string | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [filingError, setFilingError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "officer" && session.role !== "admin")) {
      router.push("/login");
      return;
    }
    setUser(session);
    loadDashboardData();
  }, [router, statusFilter, docFilter, inspectionFilter, complianceFilter]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [ov, esc, docs, insp, comp] = await Promise.all([
        getOfficerOverview(),
        getOfficerEscalations({
          status: statusFilter === "ALL" ? undefined : statusFilter,
        }),
        getOfficerPendingDocuments(docFilter === "ALL" ? undefined : docFilter),
        getOfficerInspections(inspectionFilter === "ALL" ? undefined : inspectionFilter).catch(() => []),
        getOfficerComplianceFilings(complianceFilter === "ALL" ? undefined : complianceFilter).catch(() => []),
      ]);
      setOverview(ov);
      setEscalations(esc);
      setPendingDocs(docs);
      setInspections(insp);
      setComplianceFilings(comp);
    } catch (err: any) {
      console.error("Failed to load officer dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyComplianceFiling(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFiling) return;
    if (filingDecision === "REJECTED" && !filingVerificationNotes.trim()) {
      setFilingError("Statutory justification notes are mandatory when rejecting a compliance return.");
      return;
    }
    setSubmittingFiling(true);
    setFilingError(null);
    try {
      await verifyOfficerComplianceFiling(selectedFiling.id, {
        decision: filingDecision,
        verification_notes: filingVerificationNotes.trim() || undefined,
      });
      setSelectedFiling(null);
      setFilingVerificationNotes("");
      await loadDashboardData();
    } catch (err: any) {
      setFilingError(err.response?.data?.detail || "Failed to submit compliance verification decision.");
    } finally {
      setSubmittingFiling(false);
    }
  }

  async function handleInspectionReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInspection) return;
    if ((reportOutcome === "DEFICIENCIES_NOTED" || reportOutcome === "NON_COMPLIANT") && !correctiveActions.trim() && !deficienciesText.trim()) {
      setInspectionError("Deficiencies or corrective actions are mandatory when non-compliances are noted.");
      return;
    }
    setSubmittingInspection(true);
    setInspectionError(null);
    try {
      const defs = deficienciesText.split("\n").map((d) => d.trim()).filter(Boolean);
      const findings: Record<string, { status: string; remarks: string }> = {};
      for (const dept of selectedInspection.participating_departments) {
        findings[dept] = {
          status: reportOutcome === "SATISFACTORY" ? "COMPLIANT" : "NON_COMPLIANT",
          remarks: reportOutcome === "SATISFACTORY" ? "Inspected and verified compliant on site" : (correctiveActions || "Deficiencies noted"),
        };
      }
      await submitOfficerInspectionReport(selectedInspection.id, {
        overall_outcome: reportOutcome,
        department_findings: findings,
        deficiencies: defs,
        corrective_actions: correctiveActions.trim() || undefined,
        reinspection_required: reinspectionRequired,
      });
      setSelectedInspection(null);
      setDeficienciesText("");
      setCorrectiveActions("");
      await loadDashboardData();
    } catch (err: any) {
      setInspectionError(err.response?.data?.detail || "Failed to submit inspection report.");
    } finally {
      setSubmittingInspection(false);
    }
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDoc) return;
    if ((scrutinyDecision === "REJECTED" || scrutinyDecision === "QUERY_RAISED") && !scrutinyNote.trim()) {
      setScrutinyError(`An officer scrutiny note is mandatory when decision is ${scrutinyDecision}.`);
      return;
    }
    setSubmitting(true);
    setScrutinyError(null);
    try {
      await reviewDocument(selectedDoc.id, scrutinyDecision, scrutinyNote.trim() || undefined);
      setSelectedDoc(null);
      setScrutinyNote("");
      await loadDashboardData();
    } catch (err: any) {
      setScrutinyError(err.response?.data?.detail || "Failed to submit scrutiny decision.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadDoc(docId: number, filename: string) {
    try {
      const blob = await downloadDocument(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to download document.");
    }
  }

  async function handleAcknowledge(id: number) {
    setActionError(null);
    setSubmitting(true);
    try {
      await acknowledgeEscalation(id);
      await loadDashboardData();
      if (selectedEscalation && selectedEscalation.id === id) {
        setSelectedEscalation((prev) =>
          prev ? { ...prev, status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString() } : null
        );
      }
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to acknowledge escalation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(id: number) {
    if (!resolutionNote.trim()) {
      setActionError("Please enter a meaningful resolution note.");
      return;
    }
    setActionError(null);
    setSubmitting(true);
    try {
      await resolveEscalation(id, resolutionNote.trim());
      setResolutionNote("");
      setSelectedEscalation(null);
      await loadDashboardData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to resolve escalation");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-700 p-1.5 rounded text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">
                PRAMAN — Industrial Approvals Portal
              </div>
              <div className="text-xs text-gray-500">Officer Operations &amp; Scrutiny Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status="DEMO" />
            <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded">
              <UserIcon className="h-3.5 w-3.5 text-gray-500" />
              <span>{user.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs">
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Officer Operations Console</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Statutory SLA escalations, document scrutiny dossiers, joint site visits, and periodic compliance filings
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading} className="text-xs h-8 border-gray-300">
            Refresh Queues
          </Button>
        </div>

        {/* Operational Overview Metrics */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white p-3.5 rounded border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold text-gray-700">Active Escalations</span>
                <ShieldAlert className="h-4 w-4 text-rose-700" />
              </div>
              <div className="text-xl font-bold text-rose-900 font-mono">{overview.open_escalations}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {overview.triggered_escalations} open, {overview.acknowledged_escalations} acknowledged
              </div>
            </div>

            <div className="bg-white p-3.5 rounded border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold text-gray-700">SLA Warnings (80%)</span>
                <Clock className="h-4 w-4 text-amber-700" />
              </div>
              <div className="text-xl font-bold text-amber-900 font-mono">{overview.warning_steps}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Steps nearing SLA threshold</div>
            </div>

            <div className="bg-white p-3.5 rounded border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold text-gray-700">Overdue Steps</span>
                <AlertTriangle className="h-4 w-4 text-orange-700" />
              </div>
              <div className="text-xl font-bold text-orange-900 font-mono">{overview.overdue_steps}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Steps past statutory deadline</div>
            </div>

            <div className="bg-white p-3.5 rounded border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold text-gray-700">Resolved Escalations</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="text-xl font-bold text-emerald-900 font-mono">{overview.resolved_escalations}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Audited and closed</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs — Crisp Institutional Design System */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab("escalations")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
              activeTab === "escalations"
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            SLA Escalations
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                activeTab === "escalations" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {escalations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("scrutiny")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
              activeTab === "scrutiny"
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Document Scrutiny
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                activeTab === "scrutiny" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {pendingDocs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("inspections")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
              activeTab === "inspections"
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <CalendarCheck2 className="h-3.5 w-3.5" />
            Joint Site Visits
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                activeTab === "inspections" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {inspections.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("compliance")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
              activeTab === "compliance"
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Periodic Compliance
            <span
              className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                activeTab === "compliance" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {complianceFilings.length}
            </span>
          </button>
        </div>

        {activeTab === "escalations" ? (
          /* Escalation Queue Table & Detail Split */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue List */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-600" />
                <h2 className="font-semibold text-gray-900">Department Escalation Queue</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {escalations.length}
                </span>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md text-xs">
                {["ALL", "OPEN", "TRIGGERED", "ACKNOWLEDGED", "RESOLVED"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded transition-colors font-medium ${
                      statusFilter === filter
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm text-gray-500">Loading escalation queue...</div>
            ) : escalations.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2 opacity-80" />
                <div className="font-medium text-gray-900">Queue is Clear</div>
                <div className="text-xs text-gray-400 mt-1">
                  No escalations match the current filter.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                    <tr>
                      <th className="py-3 px-4">Application & Step</th>
                      <th className="py-3 px-4">SLA Breach</th>
                      <th className="py-3 px-4">Escalation</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {escalations.map((esc) => {
                      const isSelected = selectedEscalation?.id === esc.id;
                      return (
                        <tr
                          key={esc.id}
                          onClick={() => {
                            setSelectedEscalation(esc);
                            setActionError(null);
                          }}
                          className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${
                            isSelected ? "bg-blue-50 border-l-4 border-blue-600" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-gray-900">{esc.step_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <span>{esc.application_title}</span>
                              {esc.is_critical_path && (
                                <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                                  CRITICAL PATH
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <SLAStatusBadge status={esc.sla_status} />
                            </div>
                            <div className="text-xs text-red-600 font-medium mt-0.5">
                              +{esc.days_overdue.toFixed(1)}d Overdue
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${
                                esc.status === "TRIGGERED"
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : esc.status === "ACKNOWLEDGED"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-green-100 text-green-700 border border-green-200"
                              }`}
                            >
                              {esc.status}
                            </span>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Tier {esc.level} • {esc.recipient_role}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              Inspect <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Escalation Detail Panel */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col">
            <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-3 mb-4">
              Escalation Resolution Panel
            </h3>

            {selectedEscalation ? (
              <div className="space-y-4 text-sm flex-1">
                <div>
                  <div className="text-xs text-gray-400 uppercase font-medium">Approval Step</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedEscalation.step_name}
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">
                    {selectedEscalation.requirement_id}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 uppercase font-medium">Application</div>
                  <div className="text-gray-800 mt-0.5 font-medium">
                    {selectedEscalation.application_title}
                  </div>
                  <div className="text-xs text-gray-500">ID: #{selectedEscalation.application_id}</div>
                </div>

                <div className="bg-red-50/60 border border-red-200 rounded p-3 text-xs">
                  <div className="font-semibold text-red-800 flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    Breach Justification
                  </div>
                  <p className="text-red-900">{selectedEscalation.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded border border-gray-100">
                  <div>
                    <span className="text-gray-500 block">Triggered At:</span>
                    <span className="font-medium text-gray-800">
                      {new Date(selectedEscalation.triggered_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Status:</span>
                    <span className="font-bold text-gray-900">{selectedEscalation.status}</span>
                  </div>
                  {selectedEscalation.acknowledged_at && (
                    <div className="col-span-2">
                      <span className="text-gray-500 block">Acknowledged:</span>
                      <span className="text-gray-800">
                        {new Date(selectedEscalation.acknowledged_at).toLocaleString()} by{" "}
                        {selectedEscalation.acknowledged_by_email}
                      </span>
                    </div>
                  )}
                  {selectedEscalation.resolved_at && (
                    <div className="col-span-2 bg-green-50 p-2 rounded border border-green-200">
                      <span className="text-green-800 font-semibold block">Resolved:</span>
                      <span className="text-green-900">
                        {new Date(selectedEscalation.resolved_at).toLocaleString()} by{" "}
                        {selectedEscalation.resolved_by_email}
                      </span>
                      <p className="text-green-800 italic mt-1">
                        &quot;{selectedEscalation.resolution_note}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {actionError && (
                  <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded border border-red-200">
                    {actionError}
                  </div>
                )}

                {/* Actions */}
                {selectedEscalation.status !== "RESOLVED" && (
                  <div className="pt-2 border-t border-gray-200 space-y-3">
                    {selectedEscalation.status === "TRIGGERED" && (
                      <Button
                        onClick={() => handleAcknowledge(selectedEscalation.id)}
                        disabled={submitting}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        size="sm"
                      >
                        <Check className="h-4 w-4 mr-1.5" />
                        Acknowledge Escalation
                      </Button>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">
                        Resolution Note (Mandatory)
                      </label>
                      <textarea
                        rows={3}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="State action taken (e.g. Scrutiny completed, site visit verified, or clearance dispatched)..."
                        className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <Button
                      onClick={() => handleResolve(selectedEscalation.id)}
                      disabled={submitting || !resolutionNote.trim()}
                      className="w-full bg-green-700 hover:bg-green-800 text-white"
                      size="sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Resolve &amp; Close Escalation
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs flex-1 flex flex-col justify-center">
                Select an escalation event from the queue on the left to inspect details and record
                official action.
              </div>
            )}
          </div>
        </div>
        ) : activeTab === "scrutiny" ? (
          /* Document Scrutiny Queue Table & Detail Split */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Dossiers Awaiting Scrutiny</h2>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    {pendingDocs.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md text-xs">
                  {["ALL", "UPLOADED", "UNDER_REVIEW", "QUERY_RAISED"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setDocFilter(f)}
                      className={`px-2.5 py-1 rounded transition-colors font-medium ${
                        docFilter === f ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-gray-500">Loading document scrutiny queue...</div>
              ) : pendingDocs.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2 opacity-80" />
                  <div className="font-medium text-gray-900">All Dossiers Scrutinized</div>
                  <div className="text-xs text-gray-400 mt-1">No documents currently pending review under this filter.</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                      <tr>
                        <th className="py-3 px-4">Application & Step</th>
                        <th className="py-3 px-4">Document / Dossier</th>
                        <th className="py-3 px-4">Version & File</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {pendingDocs.map((doc) => {
                        const isSelected = selectedDoc?.id === doc.id;
                        return (
                          <tr
                            key={doc.id}
                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/70 border-l-4 border-blue-600" : ""
                            }`}
                            onClick={() => {
                              setSelectedDoc(doc);
                              setScrutinyDecision("ACCEPTED");
                              setScrutinyNote(doc.review_note || "");
                              setScrutinyError(null);
                            }}
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-gray-900">{doc.application_title}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">{doc.business_name}</div>
                              <div className="text-[10px] text-blue-700 font-mono mt-0.5">{doc.step_name}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-blue-600" />
                                {doc.document_name}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate max-w-[150px]">{doc.original_filename}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                v{doc.version}
                              </span>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {(doc.file_size_bytes / 1024).toFixed(1)} KB
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(doc.uploaded_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <DocumentStatusBadge status={doc.status} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="xs"
                                variant={isSelected ? "default" : "outline"}
                                className="text-[11px] h-7"
                              >
                                Inspect
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Scrutiny Detail & Decision Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col">
              <div className="border-b border-gray-200 pb-3 mb-4">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-blue-600" />
                  Official Scrutiny Panel
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Inspect submitted dossier and record legal review.</p>
              </div>

              {selectedDoc ? (
                <div className="space-y-4 text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-gray-400">Application</div>
                      <div className="font-bold text-gray-900">{selectedDoc.application_title}</div>
                      <div className="text-gray-500">{selectedDoc.business_name}</div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase text-gray-400">Document Dossier</div>
                      <div className="font-bold text-gray-900 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        {selectedDoc.document_name}
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        {selectedDoc.original_filename} (v{selectedDoc.version})
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                        SHA-256: {selectedDoc.checksum_sha256}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <DocumentStatusBadge status={selectedDoc.status} />
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleDownloadDoc(selectedDoc.id, selectedDoc.original_filename)}
                        className="text-gray-700 border-gray-300"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download File
                      </Button>
                    </div>

                    {selectedDoc.review_note && (
                      <div className="p-2.5 rounded bg-gray-50 border border-gray-200 text-gray-700">
                        <div className="text-[10px] font-bold uppercase text-gray-500">Existing Officer Note</div>
                        <div className="mt-0.5">{selectedDoc.review_note}</div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleReviewSubmit} className="space-y-3 pt-3 border-t border-gray-200">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                        Scrutiny Decision
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setScrutinyDecision("ACCEPTED")}
                          className={`p-2 rounded text-left border text-xs font-semibold flex items-center gap-1.5 ${
                            scrutinyDecision === "ACCEPTED"
                              ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                          Accept Dossier
                        </button>

                        <button
                          type="button"
                          onClick={() => setScrutinyDecision("QUERY_RAISED")}
                          className={`p-2 rounded text-left border text-xs font-semibold flex items-center gap-1.5 ${
                            scrutinyDecision === "QUERY_RAISED"
                              ? "bg-purple-50 border-purple-500 text-purple-800 ring-1 ring-purple-500"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <HelpCircle className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                          Raise Query
                        </button>

                        <button
                          type="button"
                          onClick={() => setScrutinyDecision("REJECTED")}
                          className={`p-2 rounded text-left border text-xs font-semibold flex items-center gap-1.5 ${
                            scrutinyDecision === "REJECTED"
                              ? "bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                          Reject Dossier
                        </button>

                        <button
                          type="button"
                          onClick={() => setScrutinyDecision("UNDER_REVIEW")}
                          className={`p-2 rounded text-left border text-xs font-semibold flex items-center gap-1.5 ${
                            scrutinyDecision === "UNDER_REVIEW"
                              ? "bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                          Under Review
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                        Scrutiny Note / Query Explanation
                        {(scrutinyDecision === "REJECTED" || scrutinyDecision === "QUERY_RAISED") && (
                          <span className="text-rose-600 ml-1 font-semibold">*Mandatory</span>
                        )}
                      </label>
                      <textarea
                        rows={3}
                        value={scrutinyNote}
                        onChange={(e) => setScrutinyNote(e.target.value)}
                        placeholder={
                          scrutinyDecision === "QUERY_RAISED"
                            ? "Specify exact discrepancy or missing seal/clarification needed from applicant..."
                            : scrutinyDecision === "REJECTED"
                            ? "Specify statutory reason for document rejection..."
                            : "Optional scrutiny remarks or endorsement details..."
                        }
                        className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {scrutinyError && (
                      <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded border border-red-200">
                        {scrutinyError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={submitting}
                      className={`w-full ${
                        scrutinyDecision === "ACCEPTED"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : scrutinyDecision === "QUERY_RAISED"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : scrutinyDecision === "REJECTED"
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      } text-white`}
                      size="sm"
                    >
                      {submitting ? "Submitting..." : `Confirm ${scrutinyDecision.replace(/_/g, " ")} Decision`}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400 text-xs flex-1 flex flex-col justify-center">
                  Select a document from the queue on the left to inspect file contents and record official scrutiny.
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "inspections" ? (
          /* M8: Joint Inspections Queue Table & Inspection Report Split */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inspections List */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="h-5 w-5 text-indigo-600" />
                  <h2 className="font-semibold text-gray-900">Synchronized Joint Inspections (CIS)</h2>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    {inspections.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Filter:</span>
                  <select
                    value={inspectionFilter}
                    onChange={(e) => setInspectionFilter(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2.5 py-1 text-gray-700 bg-white"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>

              {inspections.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No joint inspections currently scheduled matching this criteria.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {inspections.map((insp) => {
                    const isSelected = selectedInspection?.id === insp.id;
                    return (
                      <div
                        key={insp.id}
                        onClick={() => {
                          setSelectedInspection(insp);
                          setReportOutcome(insp.report?.overall_outcome || "SATISFACTORY");
                          setCorrectiveActions(insp.report?.corrective_actions || "");
                          setDeficienciesText((insp.report?.deficiencies || []).join("\n"));
                          setReinspectionRequired(insp.report?.reinspection_required || false);
                          setInspectionError(null);
                        }}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50/60 border-l-4 border-l-indigo-600" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-xs">
                                Joint Visit #{insp.id}
                              </span>
                              <InspectionStatusBadge status={insp.status} />
                              <RiskCategoryBadge category={insp.risk_category} />
                            </div>
                            <div className="text-xs text-gray-600 mt-1 font-medium">
                              {insp.business_name || `Application #${insp.application_id}`}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-3">
                              <span>
                                <strong>Date:</strong> {new Date(insp.scheduled_date).toLocaleDateString()}
                              </span>
                              <span>
                                <strong>Slot:</strong> {insp.time_slot}
                              </span>
                              <span>
                                <strong>Lead:</strong> {insp.lead_inspector_name || "Assigned Officer"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            {insp.report && (
                              <InspectionOutcomeBadge outcome={insp.report.overall_outcome} />
                            )}
                          </div>
                        </div>

                        {/* Participating Departments */}
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {insp.participating_departments.map((dept, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inspection Details & Report Submission */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
              {selectedInspection ? (
                <div>
                  <div className="border-b border-gray-100 pb-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-gray-500">
                        Joint Inspection #{selectedInspection.id}
                      </span>
                      <InspectionStatusBadge status={selectedInspection.status} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm mt-1">
                      {selectedInspection.business_name || `Application #${selectedInspection.application_id}`}
                    </h3>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(selectedInspection.scheduled_date).toLocaleDateString()} • {selectedInspection.time_slot}
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="mb-4">
                    <span className="text-[11px] font-bold text-gray-700 uppercase block mb-1.5">
                      Unified Inspection Scope ({selectedInspection.checklist_items.length})
                    </span>
                    <ul className="space-y-1 text-xs text-gray-600 max-h-28 overflow-y-auto">
                      {selectedInspection.checklist_items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                          <CheckSquare className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* If Report Already Submitted */}
                  {selectedInspection.report ? (
                    <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950">Official Outcome</span>
                        <InspectionOutcomeBadge outcome={selectedInspection.report.overall_outcome} />
                      </div>
                      <div className="text-[11px] text-gray-600">
                        Submitted by {selectedInspection.report.submitted_by_name || "Officer"} on{" "}
                        {new Date(selectedInspection.report.submitted_at).toLocaleString()}
                      </div>
                      {selectedInspection.report.deficiencies.length > 0 && (
                        <div>
                          <strong className="text-[11px] text-rose-800">Deficiencies Noted:</strong>
                          <ul className="list-disc list-inside text-[11px] text-rose-700 mt-0.5">
                            {selectedInspection.report.deficiencies.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedInspection.report.corrective_actions && (
                        <div className="p-2 bg-white rounded border border-emerald-200 text-[11px] text-gray-800">
                          <strong>Corrective Actions:</strong> {selectedInspection.report.corrective_actions}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Report Submission Form */
                    <form onSubmit={handleInspectionReportSubmit} className="space-y-3.5 pt-2 border-t border-gray-100">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Inspection Outcome Decision
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReportOutcome("SATISFACTORY")}
                            className={`p-2 rounded text-center border text-xs font-semibold ${
                              reportOutcome === "SATISFACTORY"
                                ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Satisfactory
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportOutcome("DEFICIENCIES_NOTED")}
                            className={`p-2 rounded text-center border text-xs font-semibold ${
                              reportOutcome === "DEFICIENCIES_NOTED"
                                ? "bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Deficiencies
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportOutcome("NON_COMPLIANT")}
                            className={`p-2 rounded text-center border text-xs font-semibold ${
                              reportOutcome === "NON_COMPLIANT"
                                ? "bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Non-Compliant
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Deficiencies Observed (One per line)
                        </label>
                        <textarea
                          rows={2}
                          value={deficienciesText}
                          onChange={(e) => setDeficienciesText(e.target.value)}
                          placeholder="e.g. Fire exit blocked by raw materials inventory&#10;Inadequate ventilation in spray booth"
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Corrective Actions & Directives
                          {(reportOutcome === "DEFICIENCIES_NOTED" || reportOutcome === "NON_COMPLIANT") && (
                            <span className="text-rose-600 ml-1 font-semibold">*Mandatory</span>
                          )}
                        </label>
                        <textarea
                          rows={2}
                          value={correctiveActions}
                          onChange={(e) => setCorrectiveActions(e.target.value)}
                          placeholder="Provide statutory directions and required remedial actions..."
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="reinsp"
                          checked={reinspectionRequired}
                          onChange={(e) => setReinspectionRequired(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="reinsp" className="text-xs text-gray-700 font-medium cursor-pointer">
                          Follow-up site reinspection required
                        </label>
                      </div>

                      {inspectionError && (
                        <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded border border-red-200">
                          {inspectionError}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={submittingInspection}
                        className={`w-full ${
                          reportOutcome === "SATISFACTORY"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : reportOutcome === "DEFICIENCIES_NOTED"
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-rose-600 hover:bg-rose-700"
                        } text-white`}
                        size="sm"
                      >
                        {submittingInspection
                          ? "Submitting Report..."
                          : `Confirm ${reportOutcome.replace(/_/g, " ")} Findings`}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400 text-xs flex-1 flex flex-col justify-center">
                  Select a joint inspection from the queue on the left to inspect multi-department scope and submit official inspection findings.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* M9: Periodic Statutory Compliance Filings Queue Table & Verification Split */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filings List */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-semibold text-gray-900">Periodic Compliance Returns Queue</h2>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    {complianceFilings.length}
                  </span>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md text-xs">
                  {["ALL", "SUBMITTED", "OVERDUE", "DUE_SOON", "VERIFIED", "REJECTED"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setComplianceFilter(f)}
                      className={`px-2.5 py-1 rounded transition-colors font-medium ${
                        complianceFilter === f ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-gray-500">Loading compliance returns...</div>
              ) : complianceFilings.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2 opacity-80" />
                  <div className="font-medium text-gray-900">Queue is Clear</div>
                  <div className="text-xs text-gray-400 mt-1">
                    No periodic compliance returns match the selected filter.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                      <tr>
                        <th className="py-3 px-4">Statutory Filing</th>
                        <th className="py-3 px-4">Department & Act</th>
                        <th className="py-3 px-4">Due Date & Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {complianceFilings.map((filing) => {
                        const isSelected = selectedFiling?.id === filing.id;
                        return (
                          <tr
                            key={filing.id}
                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/70 border-l-4 border-blue-600" : ""
                            }`}
                            onClick={() => {
                              setSelectedFiling(filing);
                              setFilingDecision("VERIFIED");
                              setFilingVerificationNotes(filing.verification_notes || "");
                              setFilingError(null);
                            }}
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                <ClipboardCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                {filing.title}
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                App #{filing.application_id} • Period: {filing.period_label}
                              </div>
                              <div className="text-[10px] text-indigo-700 font-mono mt-0.5">
                                Frequency: {filing.frequency.toUpperCase()} {filing.required_form ? `• Form: ${filing.required_form}` : ""}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-medium text-gray-800">{filing.department}</div>
                              <div className="text-[10px] text-gray-500 truncate max-w-[180px] mt-0.5">
                                {filing.statutory_act || "Statutory Rule"}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <ComplianceStatusBadge status={filing.status} />
                              </div>
                              <div className="text-[11px] text-gray-600 mt-1">
                                Due: {new Date(filing.due_date).toLocaleDateString()}
                              </div>
                              {filing.penalty_risk_active && (
                                <div className="text-[10px] font-bold text-rose-600 mt-0.5 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Penalty Risk Active
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <Button
                                size="xs"
                                variant={isSelected ? "default" : "outline"}
                                className="text-[11px] h-7"
                              >
                                Scrutinize
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Filing Scrutiny & Verification Decision Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
              {selectedFiling ? (
                <div className="space-y-4 text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="border-b border-gray-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-gray-500">
                          Filing #{selectedFiling.id} • {selectedFiling.period_label}
                        </span>
                        <ComplianceStatusBadge status={selectedFiling.status} />
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm mt-1">
                        {selectedFiling.title}
                      </h3>
                      <div className="text-gray-500 text-[11px] mt-0.5">
                        Application #{selectedFiling.application_id} • {selectedFiling.department}
                      </div>
                    </div>

                    <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Statutory Basis</span>
                        <span className="font-medium text-gray-800">{selectedFiling.statutory_act || "Applicable Environmental/Industrial Act"}</span>
                      </div>
                      {selectedFiling.penalty_clause_desc && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-rose-600 block">Statutory Penalty Clause</span>
                          <span className="text-rose-700 text-[11px]">{selectedFiling.penalty_clause_desc}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[11px] text-gray-600 pt-1 border-t border-gray-200/60">
                        <span>Due Date: <strong>{new Date(selectedFiling.due_date).toLocaleDateString()}</strong></span>
                        <span>{selectedFiling.days_remaining >= 0 ? `${selectedFiling.days_remaining} days left` : `${Math.abs(selectedFiling.days_remaining)} days overdue`}</span>
                      </div>
                    </div>

                    {/* Submitted Filing Data */}
                    {selectedFiling.status !== "UPCOMING" && selectedFiling.status !== "DUE_SOON" && selectedFiling.status !== "OVERDUE" ? (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-gray-800 uppercase flex items-center justify-between">
                          <span>Applicant Submission Details</span>
                          <span className="text-[10px] font-normal text-gray-500">
                            {selectedFiling.submitted_at ? new Date(selectedFiling.submitted_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600">
                          Submitted by: <strong className="text-gray-800">{selectedFiling.submitted_by_email || "Applicant"}</strong>
                        </div>
                        {selectedFiling.remarks && (
                          <div className="p-2 bg-blue-50/50 rounded border border-blue-100 text-[11px] text-blue-900">
                            <strong>Applicant Remarks:</strong> {selectedFiling.remarks}
                          </div>
                        )}

                        {/* Submitted Metrics */}
                        {selectedFiling.metric_fields && selectedFiling.metric_fields.length > 0 && (
                          <div className="border border-gray-200 rounded overflow-hidden">
                            <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold text-gray-600 uppercase border-b border-gray-200">
                              Logged Metric Records
                            </div>
                            <div className="divide-y divide-gray-100">
                              {selectedFiling.metric_fields.map((field) => {
                                const val = selectedFiling.filing_data?.[field.name];
                                return (
                                  <div key={field.name} className="px-3 py-2 flex items-center justify-between text-[11px]">
                                    <span className="text-gray-600 font-medium">{field.label}</span>
                                    <span className="font-semibold text-gray-900 font-mono">
                                      {val !== undefined && val !== null && val !== "" ? String(val) : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px]">
                        <strong>Pending Applicant Return:</strong> The enterprise has not yet submitted this period&apos;s filing data. Officer verification will be enabled once received.
                      </div>
                    )}

                    {/* Existing Verification Details if already verified/rejected */}
                    {selectedFiling.verified_at && (
                      <div className={`p-3 rounded border text-xs space-y-1 ${
                        selectedFiling.status === "VERIFIED" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>Decision: {selectedFiling.status}</span>
                          <span className="text-[10px] font-normal">{new Date(selectedFiling.verified_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px]">
                          Verified by: <strong>{selectedFiling.verified_by_email || "Officer"}</strong>
                        </div>
                        {selectedFiling.verification_notes && (
                          <div className="text-[11px] italic mt-1 pt-1 border-t border-current/20">
                            &quot;{selectedFiling.verification_notes}&quot;
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Verification Form if SUBMITTED */}
                  {selectedFiling.status === "SUBMITTED" && (
                    <form onSubmit={handleVerifyComplianceFiling} className="space-y-3 pt-3 border-t border-gray-200">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                          Verification Decision
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFilingDecision("VERIFIED")}
                            className={`p-2 rounded text-left border text-xs font-semibold flex items-center gap-1.5 ${
                              filingDecision === "VERIFIED"
                                ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                            Approve &amp; Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilingDecision("REJECTED")}
                            className={`p-2 rounded text-left border text-xs font-semibold flex items-center gap-1.5 ${
                              filingDecision === "REJECTED"
                                ? "bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                            Reject Return
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Officer Statutory Notes
                          {filingDecision === "REJECTED" && (
                            <span className="text-rose-600 ml-1 font-semibold">*Mandatory</span>
                          )}
                        </label>
                        <textarea
                          rows={3}
                          value={filingVerificationNotes}
                          onChange={(e) => setFilingVerificationNotes(e.target.value)}
                          placeholder={
                            filingDecision === "REJECTED"
                              ? "State specific non-compliance reason, calibration failure, or statutory deficiency..."
                              : "Optional verification remarks or statutory audit confirmation..."
                          }
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        />
                      </div>

                      {filingError && (
                        <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded border border-red-200">
                          {filingError}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={submittingFiling}
                        className={`w-full ${
                          filingDecision === "VERIFIED"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-rose-600 hover:bg-rose-700"
                        } text-white`}
                        size="sm"
                      >
                        {submittingFiling ? "Recording Decision..." : `Confirm Return ${filingDecision === "VERIFIED" ? "Verification" : "Rejection"}`}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400 text-xs flex-1 flex flex-col justify-center">
                  Select a periodic compliance filing from the list on the left to inspect submitted metric records and verify statutory compliance.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
