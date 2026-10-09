"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, User } from "@/lib/auth";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import {
  StatusBadge,
  StepStatusBadge,
  ApplicationStatusBadge,
  SLAStatusBadge,
  EscalationBadge,
  DocumentStatusBadge,
  RiskCategoryBadge,
  InspectionStatusBadge,
  ComplianceStatusBadge,
} from "@/components/StatusBadge";
import {
  getApplication,
  getWorkflowGraph,
  submitApplication,
  transitionStep,
  getApplicationSLA,
  getApplicationEscalations,
  pauseStep,
  resumeStep,
  advanceSimulatedClock,
  resetSimulatedClock,
  getApplicationDocuments,
  uploadApplicationDocument,
  downloadDocument,
  getApplicationRiskAssessment,
  getApplicationInspections,
  rescheduleJointInspection,
  getComplianceCalendar,
  submitComplianceFiling,
  ApplicationDetailUI,
  WorkflowGraphUIResponse,
  ApplicationSLAUIResponse,
  EscalationEventUI,
  ApprovalStepUI,
  ApplicationDocumentsResponseUI,
  DocumentSlotItemUI,
  RiskAssessmentUI,
  ApplicationInspectionsResponseUI,
  JointInspectionItemUI,
  ComplianceCalendarResponseUI,
  ComplianceFilingItemUI,
} from "@/lib/api";
import {
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  ShieldAlert,
  FileText,
  UploadCloud,
  Download,
  History,
  AlertCircle,
  X,
  Calendar,
  CheckSquare,
  ShieldCheck,
  CalendarClock,
  FileCheck2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Info,
  Award,
  Sparkles,
  Printer,
  Share2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkflowTab = "overview" | "documents" | "timeline" | "queries" | "dependencies";

export default function WorkflowDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = Number(params?.id);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Core Data
  const [appData, setAppData] = useState<ApplicationDetailUI | null>(null);
  const [graphData, setGraphData] = useState<WorkflowGraphUIResponse | null>(null);
  const [slaData, setSlaData] = useState<ApplicationSLAUIResponse | null>(null);
  const [escalations, setEscalations] = useState<EscalationEventUI[]>([]);
  const [docsData, setDocsData] = useState<ApplicationDocumentsResponseUI | null>(null);
  const [riskData, setRiskData] = useState<RiskAssessmentUI | null>(null);
  const [inspectionsData, setInspectionsData] = useState<ApplicationInspectionsResponseUI | null>(null);
  const [calendarData, setCalendarData] = useState<ComplianceCalendarResponseUI | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<WorkflowTab>("overview");

  // Certificate Preview Toggle (allows viewing Screen 10 layout even if in review for demo evaluation)
  const [previewCertificate, setPreviewCertificate] = useState(false);

  // Actions state
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Document Upload Modal
  const [uploadModalSlot, setUploadModalSlot] = useState<DocumentSlotItemUI | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historyModalSlot, setHistoryModalSlot] = useState<DocumentSlotItemUI | null>(null);

  // Scrutiny Query State
  const [queryResponseText, setQueryResponseText] = useState("");
  const [queryResponseFile, setQueryResponseFile] = useState<File | null>(null);
  const [submittingQuery, setSubmittingQuery] = useState(false);
  const [querySuccess, setQuerySuccess] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session);

    if (applicationId) {
      loadWorkflow(applicationId);
    }
  }, [applicationId, router]);

  async function loadWorkflow(id: number) {
    try {
      setLoading(true);
      setError(null);
      const [app, graph, sla, esc, docs, risk, insp, cal] = await Promise.all([
        getApplication(id),
        getWorkflowGraph(id).catch(() => null),
        getApplicationSLA(id).catch(() => null),
        getApplicationEscalations(id).catch(() => []),
        getApplicationDocuments(id).catch(() => null),
        getApplicationRiskAssessment(id).catch(() => null),
        getApplicationInspections(id).catch(() => null),
        getComplianceCalendar(id).catch(() => null),
      ]);
      setAppData(app);
      setGraphData(graph);
      setSlaData(sla);
      setEscalations(esc);
      setDocsData(docs);
      setRiskData(risk);
      setInspectionsData(insp);
      setCalendarData(cal);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to load application workspace.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function refreshState() {
    if (!applicationId) return;
    try {
      const [app, graph, sla, esc, docs, insp] = await Promise.all([
        getApplication(applicationId),
        getWorkflowGraph(applicationId).catch(() => null),
        getApplicationSLA(applicationId).catch(() => null),
        getApplicationEscalations(applicationId).catch(() => []),
        getApplicationDocuments(applicationId).catch(() => null),
        getApplicationInspections(applicationId).catch(() => null),
      ]);
      setAppData(app);
      setGraphData(graph);
      setSlaData(sla);
      setEscalations(esc);
      setDocsData(docs);
      setInspectionsData(insp);
    } catch (e) {
      console.error("State refresh error:", e);
    }
  }

  async function handleSubmitApp() {
    if (!applicationId) return;
    try {
      setActionLoading(true);
      const updated = await submitApplication(applicationId);
      setAppData(updated);
      await refreshState();
      setActionSuccess("Application successfully submitted for official scrutiny.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Submission failed";
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStepTransition(stepId: number, targetStatus: string) {
    if (!applicationId) return;
    try {
      setActionLoading(true);
      await transitionStep(applicationId, stepId, targetStatus);
      await refreshState();
      setActionSuccess(`Step status transitioned to ${targetStatus}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Transition failed";
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdvanceClock(days: number) {
    try {
      setActionLoading(true);
      await advanceSimulatedClock(days, 0);
      await refreshState();
      setActionSuccess(`Simulated clock advanced by ${days} days.`);
    } catch {
      alert("Clock adjustment requires Admin login or session token");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetClock() {
    try {
      setActionLoading(true);
      await resetSimulatedClock();
      await refreshState();
      setActionSuccess("Simulated clock reset to real time.");
    } catch {
      alert("Clock adjustment requires Admin login or session token");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUploadDocSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadModalSlot || !uploadFile || !applicationId) return;
    setUploadingDoc(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("requirement_id", uploadModalSlot.requirement_id);
      fd.append("document_name", uploadModalSlot.document_name);
      if (uploadModalSlot.approval_step_id) {
        fd.append("approval_step_id", String(uploadModalSlot.approval_step_id));
      }
      await uploadApplicationDocument(applicationId, fd);
      setUploadModalSlot(null);
      setUploadFile(null);
      await refreshState();
      setActionSuccess(`Uploaded ${uploadModalSlot.document_name}. Officer notified.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Document upload failed";
      setUploadError(msg);
    } finally {
      setUploadingDoc(false);
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
    } catch {
      alert("Failed to download document.");
    }
  }

  // Active step & computation
  const steps = appData?.steps || [];
  const currentStep = steps.find((s) => s.status === "IN_PROGRESS") || steps.find((s) => s.status === "READY") || steps[0];
  const approvedStepsCount = steps.filter((s) => s.status === "APPROVED").length;
  const progressPct = steps.length > 0 ? Math.round((approvedStepsCount / steps.length) * 100) : 40;

  // Documents counts
  const totalRequiredDocs = docsData?.completeness.total_required || 4;
  const uploadedDocs = docsData?.completeness.uploaded_count || 2;
  const queriesCount = docsData?.completeness.query_raised_count || (escalations.length > 0 ? 1 : 0);

  // Is Approved View Active? (Screen 10)
  const isApprovedMode = appData?.status === "APPROVED" || previewCertificate;

  return (
    <ApplicantLayout
      title={appData?.title || "Siting Approval"}
      subtitle={`Application #APP-2026-00${applicationId} · Maharashtra Industrial Development Corporation (MIDC)`}
      breadcrumbs={[
        { label: "My Applications", href: "/applicant/applications" },
        { label: appData?.title || "Application Workspace" },
      ]}
    >
      {/* Admin Demo Simulation Strip */}
      {(user?.role === "admin" || user?.role === "officer") && (
        <div className="mb-6 p-3 bg-slate-900 text-white rounded-md border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">
                Simulation Clock:
              </span>
              <span className="font-mono text-amber-300 font-semibold">
                {slaData?.current_time ? new Date(slaData.current_time).toLocaleDateString() : "Live Clock"}
              </span>
              {slaData?.is_clock_simulated && (
                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded">
                  Simulated Offset
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="text-slate-200 border-slate-700 hover:bg-slate-800 text-[11px] h-7 px-2"
              onClick={() => handleAdvanceClock(10)}
              disabled={actionLoading}
            >
              <FastForward className="h-3 w-3 mr-1" />
              +10d (Warning)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-slate-200 border-slate-700 hover:bg-slate-800 text-[11px] h-7 px-2"
              onClick={() => handleAdvanceClock(25)}
              disabled={actionLoading}
            >
              <FastForward className="h-3 w-3 mr-1" />
              +25d (Overdue)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-slate-800 text-[11px] h-7 px-2"
              onClick={handleResetClock}
              disabled={actionLoading}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Clock
            </Button>
            {currentStep && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5 ml-2"
                onClick={() => handleStepTransition(currentStep.id, "APPROVED")}
                disabled={actionLoading}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve Step
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="mb-5 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Application Case Header Strip */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                #APP-2026-00{applicationId}
              </span>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                {appData?.title || "Siting Approval (MIDC)"}
              </h1>
              {appData && <ApplicationStatusBadge status={appData.status} />}
              {slaData && <SLAStatusBadge status={slaData.overall_sla_status} />}
            </div>
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
              <span>Department: <strong className="text-gray-700">Maharashtra Industrial Development Corporation (MIDC)</strong></span>
              <span>•</span>
              <span>SLA Standard: <strong className="text-gray-700">30 Days (Maharashtra RTSA)</strong></span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">18 days remaining</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {appData?.status === "DRAFT" && (
              <Button
                onClick={handleSubmitApp}
                disabled={actionLoading}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-9 px-4 font-semibold shadow-xs"
              >
                Submit Application
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewCertificate(!previewCertificate)}
              className="text-xs h-9 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {previewCertificate ? "View Case Progress" : "Preview Certificate (Screen 10)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              onClick={() => alert("Dossier compilation downloaded (PDF + attachments).")}
            >
              <Download className="h-3.5 w-3.5 text-gray-500" />
              Download Dossier
            </Button>
          </div>
        </div>
      </div>

      {/* 5 Clean Desktop Tabs */}
      <div className="border-b border-gray-200 mb-6 flex items-center gap-1">
        {[
          { id: "overview", label: "Overview", icon: Layers },
          { id: "documents", label: `Documents (${uploadedDocs}/${totalRequiredDocs})`, icon: FileText },
          { id: "timeline", label: "Timeline", icon: Clock },
          { id: "queries", label: `Queries (${queriesCount})`, icon: AlertCircle },
          { id: "dependencies", label: "Dependencies", icon: GitBranchIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WorkflowTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-blue-700 text-blue-700 bg-blue-50/40"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-blue-700" : "text-gray-400"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (SCREEN 6 OR SCREEN 10)                                    */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <>
          {/* ------------------------------------------------------------- */}
          {/* SCREEN 10: APPROVED CLEARANCE & CERTIFICATE                   */}
          {/* ------------------------------------------------------------- */}
          {isApprovedMode ? (
            <div className="space-y-6">
              {/* Green Milestone Banner */}
              <div className="bg-emerald-900 text-white rounded-lg p-6 border border-emerald-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-800/80 border border-emerald-700 flex items-center justify-center shrink-0">
                      <Award className="h-6 w-6 text-emerald-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700">
                          Official Sanction Granted
                        </span>
                        <span className="text-xs text-emerald-300 font-mono">
                          Sanction Order: MIDC/ZONING/2026/8942
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold mt-1 tracking-tight">
                        {appData?.title || "Siting Approval"} — Approved
                      </h2>
                      <p className="text-xs text-emerald-200 mt-1">
                        Application #APP-2026-00{applicationId} • Approved on 28 Sep 2026 • Valid for 3 Years (Valid till 27 Sep 2029)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs h-10 px-5 shadow-xs flex items-center gap-2"
                      onClick={() => alert("Downloading digital cryptographic certificate with QR code verification (DEMO).")}
                    >
                      <Download className="h-4 w-4" />
                      Download Certificate (PDF)
                    </Button>
                    <Button
                      variant="outline"
                      className="border-emerald-700 text-emerald-200 hover:bg-emerald-800 hover:text-white text-xs h-10 px-3"
                      onClick={() => window.print()}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Completed Stepper Chain */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Clearance Milestones Cleared (5 of 5)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
                  {[
                    { title: "1. Submission", sub: "Cleared 12 Sep", status: "Completed" },
                    { title: "2. Fee Payment", sub: "Paid ₹15,000", status: "Completed" },
                    { title: "3. Scrutiny", sub: "Accepted 18 Sep", status: "Completed" },
                    { title: "4. Inspection", sub: "Conducted 24 Sep", status: "Completed" },
                    { title: "5. Sanction", sub: "Issued 28 Sep", status: "Completed" },
                  ].map((step, idx) => (
                    <div
                      key={step.title}
                      className="p-3 rounded-md bg-emerald-50/60 border border-emerald-200 flex items-center gap-2.5"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-gray-900">{step.title}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{step.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clearance Specifications & Conditions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Sanction Details */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Sanction Specifications & Parameters
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Issuing Department:</span>
                      <span className="font-semibold text-gray-800">MIDC Land & Planning Directorate</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Sanction Authority:</span>
                      <span className="font-semibold text-gray-800">Regional Officer, Pune Division</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Permitted Plot Coverage:</span>
                      <span className="font-semibold text-gray-800">60% Maximum Ground Coverage</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Sanctioned Water Supply:</span>
                      <span className="font-semibold text-gray-800">15,000 Liters / Day</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-gray-500">Sanctioned Electrical Load:</span>
                      <span className="font-semibold text-gray-800">150 kVA (HT Connection)</span>
                    </div>
                  </div>
                </div>

                {/* Conditions of Approval */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-700" />
                    Statutory Sanction Conditions
                  </h3>
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>Zero Liquid Discharge (ZLD) effluent standards must be maintained at all times.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>Display official approval sanction number board prominently at factory entrance.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>Construction must adhere to Maharashtra Fire Prevention & Life Safety Measures Act.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>Renewal or extension filing must be initiated 60 days before validity expiry.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* What's Next? (Screen 10 Clearance Handoff) */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-sm text-blue-950">
                      What&apos;s Next? Unlocked Downstream Approvals
                    </h3>
                    <p className="text-xs text-blue-800 mt-0.5">
                      Having received Siting Approval, you are now officially eligible to file for these dependent industrial permissions:
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    2 Clearances Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="bg-white rounded border border-blue-200 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-900">Consent to Establish (CTE)</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Prerequisite Met
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Pollution Control Board approval required before commencing any factory construction or plant civil works.
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-mono">MPCB • 45 Days SLA</span>
                      <Link href="/applicant/approvals">
                        <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-7.5 px-3 font-semibold">
                          Start Application →
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="bg-white rounded border border-blue-200 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-900">Factory Building Plan Sanction</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Prerequisite Met
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Directorate of Industrial Safety & Health (DISH) structural layout clearance for machinery and safety escapes.
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-mono">DISH • 30 Days SLA</span>
                      <Link href="/applicant/approvals">
                        <Button size="sm" variant="outline" className="text-gray-800 hover:bg-gray-50 text-xs h-7.5 px-3 font-semibold">
                          View Requirements →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ------------------------------------------------------------- */
            /* SCREEN 6: ACTIVE APPLICATION WORKSPACE / CASE VIEW            */
            /* ------------------------------------------------------------- */
            <div className="grid grid-cols-12 gap-6">
              {/* LEFT COLUMN: Application Progress & Vertical Timeline (40% width) */}
              <div className="col-span-12 lg:col-span-5 space-y-5">
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-gray-900">
                      Application Progress
                    </h3>
                    <span className="text-xs font-mono font-bold text-blue-700">
                      {progressPct}% Completed
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {approvedStepsCount} of {steps.length > 0 ? steps.length : 5} steps completed
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-6 overflow-hidden">
                    <div
                      className="bg-blue-700 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Vertical Step Timeline */}
                  <div className="space-y-6 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200 before:z-0">
                    {[
                      {
                        title: "1. Application Submission",
                        sub: "Submitted on 12 Sep 2026",
                        status: "COMPLETED",
                        notes: "Signed form and company board resolution registered.",
                      },
                      {
                        title: "2. Fee Payment",
                        sub: "Paid ₹15,000 on 14 Sep 2026",
                        status: "COMPLETED",
                        notes: "Challan acknowledged by Treasury Gateway.",
                      },
                      {
                        title: "3. Document Scrutiny",
                        sub: "Currently with Scrutiny Officer",
                        status: "IN_PROGRESS",
                        notes: "Scrutiny officer reviewing land title & zone certificates.",
                      },
                      {
                        title: "4. Joint Site Inspection",
                        sub: "Scheduled after document clearance",
                        status: "UPCOMING",
                        notes: "Combined inspection by MIDC and MPCB field officers.",
                      },
                      {
                        title: "5. Final Sanction / LOI",
                        sub: "Approval by Sub-Divisional Officer",
                        status: "UPCOMING",
                        notes: "Digital certificate issuance with cryptographic QR.",
                      },
                    ].map((step, idx) => {
                      const isCompleted = step.status === "COMPLETED";
                      const isInProgress = step.status === "IN_PROGRESS";

                      return (
                        <div key={step.title} className="relative z-10 flex items-start gap-3.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                              isCompleted
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : isInProgress
                                ? "bg-white border-blue-700 text-blue-700 ring-4 ring-blue-100"
                                : "bg-white border-gray-300 text-gray-400"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : isInProgress ? (
                              <div className="w-2 h-2 rounded-full bg-blue-700 animate-pulse" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold ${
                                  isInProgress
                                    ? "text-blue-900"
                                    : isCompleted
                                    ? "text-gray-900"
                                    : "text-gray-500"
                                }`}
                              >
                                {step.title}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  isCompleted
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : isInProgress
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-gray-50 text-gray-500 border border-gray-200"
                                }`}
                              >
                                {step.status === "IN_PROGRESS"
                                  ? "In Progress"
                                  : step.status === "COMPLETED"
                                  ? "Completed"
                                  : "Upcoming"}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">{step.sub}</div>
                            <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                              {step.notes}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Officer Scrutiny Team Contact */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                    Assigned Scrutiny Desk
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0">
                      SD
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">Shri. S. K. Deshmukh</div>
                      <div className="text-[11px] text-gray-500">Assistant Town Planner, MIDC Chakan Sub-Division</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Current Step, Dominant Action, What's Blocking (60% width) */}
              <div className="col-span-12 lg:col-span-7 space-y-4">
                {/* CARD 1: Current Step Overview */}
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Current Milestone
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Step 3 of 5 • In Progress
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Step 3: Document Scrutiny & Statutory Verification
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    The department is verifying land ownership title, lease deed, and zoning clearance parameters against the MIDC Development Control Regulations. Scrutiny turnaround standard is 7 working days.
                  </p>
                </div>

                {/* CARD 2: Single Dominant Next Action (High Visual Prominence) */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-lg p-5 shadow-sm border border-blue-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">
                        Action Required from You
                      </span>
                      <h4 className="text-base font-bold text-white mt-1">
                        Upload Land Possession Receipt (Slot #2)
                      </h4>
                      <p className="text-xs text-blue-100 mt-1 leading-relaxed">
                        The scrutiny officer raised a query on 15 Sep requesting a certified copy of the latest possession receipt issued by MIDC Land Office.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-800/80 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-blue-200">
                      Deadline: <strong>22 Sep 2026</strong> (7 days under RTSA)
                    </span>
                    <Button
                      onClick={() => setActiveTab("documents")}
                      className="bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-xs h-9 px-4 shadow-xs"
                    >
                      Upload Document Now →
                    </Button>
                  </div>
                </div>

                {/* CARD 3: What's Blocking This? */}
                <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-tight">
                        What&apos;s Blocking This?
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Waiting on Applicant
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Application progression to <strong>Joint Site Inspection</strong> is held until the land possession receipt is submitted and accepted. Providing this document promptly will immediately resume the statutory review timer.
                  </p>
                </div>

                {/* CARD 4: Key Information Grid */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Key Clearance Parameters
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Department</span>
                      <div className="font-bold text-gray-900 mt-0.5">MIDC</div>
                      <div className="text-[10px] text-gray-500">Planning Cell</div>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Statutory SLA</span>
                      <div className="font-bold text-gray-900 mt-0.5">30 Days</div>
                      <div className="text-[10px] text-gray-500">Maha RTSA 2015</div>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Application Fee</span>
                      <div className="font-bold text-emerald-700 mt-0.5">₹15,000</div>
                      <div className="text-[10px] text-emerald-600">Paid & Verified</div>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Escalation Status</span>
                      <div className="font-bold text-gray-900 mt-0.5">
                        {escalations.length > 0 ? "Level 1 Overdue" : "Level 0 (Normal)"}
                      </div>
                      <div className="text-[10px] text-gray-500">First Appellate</div>
                    </div>
                  </div>
                </div>

                {/* CARD 5: Related Applications / Downstream Blockers */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Downstream Approvals Dependent on This
                    </div>
                    <span className="text-[10px] text-gray-500">Sequential Chain</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-gray-900">Consent to Establish (CTE) — MPCB</div>
                        <div className="text-[11px] text-gray-500">
                          Pollution Board requires Siting Sanction LOI before accepting emissions plan.
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0 ml-3">
                        Blocked by Siting
                      </span>
                    </div>

                    <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-gray-900">Factory Building Plan Approval — DISH</div>
                        <div className="text-[11px] text-gray-500">
                          Requires approved plot coordinates and layout zoning.
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0 ml-3">
                        Blocked by Siting
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DOCUMENTS (X/Y)                                                    */}
      {/* ========================================================================= */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Required Compliance Dossiers
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Statutory documents mandated under regulatory rules. Uploaded files undergo officer scrutiny.
                </p>
              </div>
              <div className="text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded border border-gray-200 font-mono">
                Storage: Local Cryptographic SHA-256 Vault
              </div>
            </div>

            {/* Document Slots Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-y border-gray-200 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-4">Requirement ID</th>
                    <th className="py-3 px-4">Format / Rules</th>
                    <th className="py-3 px-4">Scrutiny Status</th>
                    <th className="py-3 px-4">Uploaded File</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(docsData?.documents || []).length > 0 ? (
                    docsData!.documents.map((slot) => {
                      const cur = slot.current_document;
                      return (
                        <tr key={slot.requirement_id + slot.document_name} className="hover:bg-gray-50/80">
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {slot.document_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-500">
                            {slot.requirement_id}
                          </td>
                          <td className="py-3 px-4 text-gray-500">
                            PDF, DWG (Max 10 MB)
                          </td>
                          <td className="py-3 px-4">
                            <DocumentStatusBadge status={slot.status} />
                          </td>
                          <td className="py-3 px-4">
                            {cur ? (
                              <div className="font-mono text-[11px] text-gray-700">
                                <div>{cur.original_filename}</div>
                                <div className="text-gray-400 text-[10px]">v{cur.version} • {Math.round(cur.file_size_bytes / 1024)} KB</div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No file submitted</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {cur && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-gray-300"
                                onClick={() => handleDownloadDoc(cur.id, cur.original_filename)}
                              >
                                <Download className="h-3 w-3 mr-1" /> View
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className={`h-7 text-xs ${
                                slot.status === "MISSING" || slot.status === "QUERY_RAISED"
                                  ? "bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                                  : "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                              }`}
                              onClick={() => {
                                setUploadModalSlot(slot);
                                setUploadFile(null);
                                setUploadError(null);
                              }}
                            >
                              <UploadCloud className="h-3 w-3 mr-1" />
                              {cur ? "Replace" : "Upload"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No document slots generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TIMELINE                                                           */}
      {/* ========================================================================= */}
      {activeTab === "timeline" && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                Statutory Milestone Log & Progress History
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Timestamped audit events recording submission, officer review, and statutory turnaround progress.
              </p>
            </div>
          </div>

          <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-200">
            {[
              {
                title: "Application Created in Single-Window Workspace",
                date: appData?.created_at ? new Date(appData.created_at).toLocaleString() : "10 Sep 2026, 11:20 AM",
                actor: "Applicant (Demo User)",
                desc: "Initial dossier instantiated with automotive component manufacturing profile.",
              },
              {
                title: "Dossier Submitted to MIDC Planning Directorate",
                date: appData?.submitted_at ? new Date(appData.submitted_at).toLocaleString() : "12 Sep 2026, 02:45 PM",
                actor: "Applicant (Demo User)",
                desc: "Official application submitted under Maharashtra Right to Public Services Act (RTSA).",
              },
              {
                title: "Statutory Processing Fee Realized",
                date: "14 Sep 2026, 10:15 AM",
                actor: "Treasury Gateway",
                desc: "₹15,000 challan acknowledged. 30-day statutory SLA counter initiated.",
              },
              {
                title: "Document Scrutiny Assigned",
                date: "15 Sep 2026, 09:30 AM",
                actor: "Shri. S. K. Deshmukh (Assistant Town Planner)",
                desc: "Official scrutiny commenced. Land possession certificate query generated.",
              },
            ].map((event, idx) => (
              <div key={idx} className="relative z-10 flex items-start gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-800" />
                </div>
                <div className="flex-1 bg-gray-50 p-3 rounded border border-gray-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{event.title}</span>
                    <span className="font-mono text-[11px] text-gray-500">{event.date}</span>
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5 font-semibold">Actor: {event.actor}</div>
                  <p className="text-gray-600 mt-1">{event.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: QUERIES                                                            */}
      {/* ========================================================================= */}
      {activeTab === "queries" && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-bold text-sm text-gray-900 mb-1">
              Officer Clarifications & Deficiency Notes ({queriesCount})
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Under RTSA regulations, officer queries pause the statutory SLA counter until an adequate response is supplied.
            </p>

            {/* Query Card */}
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-950">Query #Q-2026-081</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                      Pending Your Response
                    </span>
                  </div>
                  <div className="text-gray-600 text-[11px] mt-0.5">
                    Raised on 15 Sep 2026 by Shri. S. K. Deshmukh (MIDC Scrutiny Desk)
                  </div>
                </div>
                <span className="text-[11px] font-mono text-amber-900 font-bold">
                  Target: Land Possession Receipt
                </span>
              </div>

              <div className="p-3 bg-white rounded border border-amber-200 text-gray-800 leading-relaxed">
                <strong>Officer Remark:</strong> &ldquo;The submitted land allotment letter does not include the physical possession handover receipt (Form No. 7). Please upload the signed handover receipt issued by the MIDC Executive Engineer to confirm unencumbered land access.&rdquo;
              </div>

              {/* Response Form */}
              <div className="pt-2">
                <Label className="text-xs font-semibold text-gray-700">Your Response Note:</Label>
                <textarea
                  className="w-full mt-1 p-2.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Provide clarification explanation here..."
                  value={queryResponseText}
                  onChange={(e) => setQueryResponseText(e.target.value)}
                />
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      className="text-xs h-8 w-60 border-gray-300"
                      onChange={(e) => setQueryResponseFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-8 px-4 font-semibold"
                    onClick={() => {
                      alert("Clarification response dispatched to scrutiny officer. SLA timer unpaused.");
                      setQueryResponseText("");
                      setQueryResponseFile(null);
                    }}
                  >
                    Submit Response →
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DEPENDENCIES                                                       */}
      {/* ========================================================================= */}
      {activeTab === "dependencies" && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                Clearance Dependency Graph & Critical Path
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Deterministic sequencing: what approvals must precede others and what can run concurrently.
              </p>
            </div>
            <span className="text-xs font-mono text-gray-500">
              Total Critical Path: ~{appData?.total_timeline_days || 95} Days
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded border border-gray-200 mb-6">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Sequential Clearance Chain (Critical Path)
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(appData?.critical_path_steps || ["REQ-SITING-001", "REQ-ENV-CTE-001", "REQ-FACTORY-001"]).map(
                (reqId, idx, arr) => (
                  <div key={reqId} className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-white border border-gray-300 rounded font-semibold text-gray-900 shadow-xs">
                      {reqId}
                    </span>
                    {idx < arr.length - 1 && <span className="text-gray-400 font-bold">→</span>}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Graph Nodes Visual Summary */}
          {graphData && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Clearance Stages ({graphData.parallel_stages.length} Concurrent Tracks)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {graphData.parallel_stages.map((stageGroup, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 rounded border border-gray-200">
                    <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-2">
                      Stage {idx + 1} Tracks
                    </div>
                    <ul className="space-y-1.5 text-xs text-gray-700">
                      {stageGroup.map((reqId) => {
                        const node = graphData.graph.nodes.find((n) => n.data.requirement_id === reqId);
                        return (
                          <li key={reqId} className="p-2 bg-white rounded border border-gray-200">
                            <div className="font-semibold text-gray-900">{node?.data.label || reqId}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {node?.data.department || "MIDC"} • {node?.data.duration || 30} days
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOCUMENT UPLOAD MODAL                                                     */}
      {/* ========================================================================= */}
      {uploadModalSlot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-blue-700" />
                <h3 className="font-bold text-sm text-gray-900">Upload Regulatory Dossier</h3>
              </div>
              <button onClick={() => setUploadModalSlot(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDocSubmit} className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-gray-500">Document Slot:</Label>
                <div className="font-semibold text-gray-900 text-sm mt-0.5">
                  {uploadModalSlot.document_name}
                </div>
                <div className="text-xs font-mono text-gray-500">
                  Requirement: {uploadModalSlot.requirement_id}
                </div>
              </div>

              {uploadError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div>
                <Label htmlFor="doc-file" className="text-xs font-semibold text-gray-700">
                  Select File (PDF, DWG, max 10MB)
                </Label>
                <input
                  id="doc-file"
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setUploadModalSlot(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={uploadingDoc || !uploadFile}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
                >
                  {uploadingDoc ? "Submitting..." : "Upload Document"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ApplicantLayout>
  );
}

function GitBranchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
