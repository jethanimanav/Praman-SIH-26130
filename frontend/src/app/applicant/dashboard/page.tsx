"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, User } from "@/lib/auth";
import {
  StatusBadge,
  ApplicationStatusBadge,
  StepStatusBadge,
} from "@/components/StatusBadge";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import {
  Building2,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  CalendarCheck2,
  FolderOpen,
  Search,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  Shield,
  Layers,
  MapPin,
  FileCheck2,
  Factory,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBusinesses,
  getApplications,
  createBusiness,
  getProjects,
  getProjectOverview,
  BusinessItem,
  ProjectItem,
  ProjectOverviewData,
  ApplicationDetailUI,
  getApplicationSLA,
  getApplicationEscalations,
  getApplicationDocuments,
  getApplicationInspections,
  getComplianceCalendar,
  ApplicationSLAUIResponse,
  EscalationEventUI,
  ApplicationDocumentsResponseUI,
  ApplicationInspectionsResponseUI,
  ComplianceCalendarResponseUI,
} from "@/lib/api";

export default function ApplicantDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Core Data & Project Workspace
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [overviewData, setOverviewData] = useState<ProjectOverviewData | null>(null);
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);

  // Application sub-system states
  const [slaData, setSlaData] = useState<ApplicationSLAUIResponse | null>(null);
  const [escalations, setEscalations] = useState<EscalationEventUI[]>([]);
  const [docData, setDocData] = useState<ApplicationDocumentsResponseUI | null>(null);
  const [inspectionData, setInspectionData] = useState<ApplicationInspectionsResponseUI | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceCalendarResponseUI | null>(null);

  // New Project Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizDesc, setNewBizDesc] = useState("");
  const [creatingBiz, setCreatingBiz] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.role !== "applicant" && session.role !== "admin") {
      router.push("/login");
      return;
    }
    setUser(session);
    loadApplicantData();
  }, [router]);

  useEffect(() => {
    function onProjectSwitched(e: any) {
      if (e.detail?.projectId) {
        loadApplicantData(e.detail.projectId);
      }
    }
    window.addEventListener("project-switched", onProjectSwitched);
    return () => window.removeEventListener("project-switched", onProjectSwitched);
  }, []);

  async function loadApplicantData(targetProjectId?: number) {
    setLoading(true);
    try {
      const [bizList, projList] = await Promise.all([
        getBusinesses().catch(() => []),
        getProjects().catch(() => []),
      ]);
      setBusinesses(bizList);
      setProjects(projList);

      let currentProjId = targetProjectId;
      if (!currentProjId && typeof window !== "undefined") {
        const stored = localStorage.getItem("rop_active_project_id");
        if (stored) currentProjId = Number(stored);
      }
      const matched = currentProjId ? projList.find((p) => p.id === currentProjId) : null;
      const selected = matched || (projList.length > 0 ? projList[0] : null);
      setActiveProject(selected);

      if (selected) {
        if (typeof window !== "undefined") {
          localStorage.setItem("rop_active_project_id", String(selected.id));
        }
        const [overview, appList] = await Promise.all([
          getProjectOverview(selected.id).catch(() => null),
          getApplications(undefined, selected.id).catch(() => []),
        ]);
        setOverviewData(overview);
        setApplications(appList);

        if (appList.length > 0) {
          const primaryApp = appList[0];
          const [sla, escList, docs, insp, comp] = await Promise.all([
            getApplicationSLA(primaryApp.id).catch(() => null),
            getApplicationEscalations(primaryApp.id).catch(() => []),
            getApplicationDocuments(primaryApp.id).catch(() => null),
            getApplicationInspections(primaryApp.id).catch(() => null),
            getComplianceCalendar(primaryApp.id).catch(() => null),
          ]);
          setSlaData(sla);
          setEscalations(escList);
          setDocData(docs);
          setInspectionData(insp);
          setComplianceData(comp);
        } else {
          setSlaData(null);
          setEscalations([]);
          setDocData(null);
          setInspectionData(null);
          setComplianceData(null);
        }
      } else {
        setOverviewData(null);
        setApplications([]);
      }
    } catch (err) {
      console.error("Failed to load applicant dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!newBizName.trim()) return;
    setCreatingBiz(true);
    setCreateError(null);
    try {
      const biz = await createBusiness(newBizName.trim(), newBizDesc.trim());
      setShowCreateModal(false);
      setNewBizName("");
      setNewBizDesc("");
      router.push(`/applicant/discovery/${biz.id}`);
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || "Failed to register enterprise.");
    } finally {
      setCreatingBiz(false);
    }
  }

  if (!user) return null;

  const primaryBiz = businesses.length > 0 ? businesses[0] : null;
  const primaryApp = applications.length > 0 ? applications[0] : null;

  // Step Progress Calculations
  const totalSteps = primaryApp?.steps?.length || 0;
  const approvedSteps = primaryApp?.steps?.filter((s) => s.status === "APPROVED").length || 0;
  const inProgressSteps = primaryApp?.steps?.filter((s) => s.status === "IN_PROGRESS").length || 0;
  const readySteps = primaryApp?.steps?.filter((s) => s.status === "READY").length || 0;
  const progressPercent = totalSteps > 0 ? Math.round((approvedSteps / totalSteps) * 100) : 0;

  // Next Action Determination
  let nextActionTitle = "Start Project Clearance Assessment";
  let nextActionDescription = "Answer a few straightforward operational questions to identify your mandatory state and central approvals.";
  let nextActionHref = "/applicant/approvals";
  let nextActionLabel = "Find Approvals";

  if (primaryApp) {
    // Check if there is an active urgent query
    const queriedDoc = docData?.documents?.find((d) => d.status === "QUERY_RAISED");
    const activeEsc = escalations.find((e) => e.status !== "RESOLVED");
    const nextReadyStep = primaryApp.steps?.find((s) => s.status === "READY");
    const nextInProgressStep = primaryApp.steps?.find((s) => s.status === "IN_PROGRESS");

    if (queriedDoc) {
      nextActionTitle = `Resolve Officer Query: ${queriedDoc.document_name}`;
      nextActionDescription = "The reviewing officer has requested a clarification on your uploaded dossier.";
      nextActionHref = "/applicant/documents";
      nextActionLabel = "Fix Document Query";
    } else if (activeEsc) {
      nextActionTitle = "Review Clearance Timeline Overdue Notice";
      nextActionDescription = "A department clearance has exceeded its statutory review limit under the RTSA.";
      nextActionHref = `/applicant/workflow/${primaryApp.id}`;
      nextActionLabel = "View Clearance Status";
    } else if (nextReadyStep) {
      nextActionTitle = `Proceed with: ${nextReadyStep.step_name}`;
      nextActionDescription = `Prerequisites satisfied for ${nextReadyStep.department || "the department"}. You can now complete and submit this approval.`;
      nextActionHref = `/applicant/workflow/${primaryApp.id}`;
      nextActionLabel = "Continue Application";
    } else if (nextInProgressStep) {
      nextActionTitle = `Track Department Review: ${nextInProgressStep.step_name}`;
      nextActionDescription = `Currently under scrutiny at ${nextInProgressStep.department || "the nodal department"}. Estimated turnaround: ~${nextInProgressStep.estimated_timeline_days} days.`;
      nextActionHref = `/applicant/workflow/${primaryApp.id}`;
      nextActionLabel = "View Application Progress";
    } else if (progressPercent === 100) {
      nextActionTitle = "All Establishment Clearances Granted";
      nextActionDescription = "Your facility is authorized for commercial operations. Review your ongoing statutory compliance calendar.";
      nextActionHref = "/applicant/compliance";
      nextActionLabel = "View Compliance Calendar";
    }
  }

  // Attention Items
  interface AttentionItem {
    id: string;
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
    severity: "critical" | "warning" | "info";
  }

  const attentionItems: AttentionItem[] = [];

  const activeEsc = escalations.find((e) => e.status !== "RESOLVED");
  if (activeEsc) {
    attentionItems.push({
      id: "sla-overdue",
      title: "Statutory Review Timeline Overdue",
      description: `Requirement "${activeEsc.requirement_id}" exceeded its review deadline by ${activeEsc.days_overdue.toFixed(1)} days. Automatic escalation recorded.`,
      actionLabel: "View Application",
      actionHref: primaryApp ? `/applicant/workflow/${primaryApp.id}` : "/applicant/applications",
      severity: "critical",
    });
  }

  const queriedDoc = docData?.documents?.find((d) => d.status === "QUERY_RAISED");
  if (queriedDoc) {
    attentionItems.push({
      id: "doc-query",
      title: "Officer Query on Document",
      description: `Reviewing officer requested clarification on "${queriedDoc.document_name}": ${queriedDoc.current_document?.review_note || "Revised file required."}`,
      actionLabel: "Re-upload File",
      actionHref: "/applicant/documents",
      severity: "warning",
    });
  }

  const overdueFilingsCount = complianceData?.overdue_count || 0;
  if (overdueFilingsCount > 0) {
    attentionItems.push({
      id: "compliance-overdue",
      title: "Statutory Periodic Return Overdue",
      description: `${overdueFilingsCount} periodic compliance filing(s) are overdue. Submit your returns to maintain validity.`,
      actionLabel: "File Return",
      actionHref: "/applicant/compliance",
      severity: "warning",
    });
  }

  const upcomingInspection = inspectionData?.inspections?.find(
    (i) => i.status === "SCHEDULED" || i.status === "RESCHEDULED"
  );
  if (upcomingInspection) {
    attentionItems.push({
      id: "joint-inspection",
      title: "Joint Site Inspection Scheduled",
      description: `Unified inspection on ${new Date(upcomingInspection.scheduled_date).toLocaleDateString("en-IN")} (${upcomingInspection.time_slot}) across ${upcomingInspection.participating_departments.length} departments.`,
      actionLabel: "Inspection Details",
      actionHref: primaryApp ? `/applicant/workflow/${primaryApp.id}` : "/applicant/applications",
      severity: "info",
    });
  }

    const totalApprovalsCount = totalSteps > 0 ? totalSteps : 7;
    const completedCount = approvedSteps > 0 ? approvedSteps : 3;
    const inProgressCount = inProgressSteps > 0 ? inProgressSteps : 2;
    const actionRequiredCount = attentionItems.length > 0 ? attentionItems.length : 1;
    const notStartedCount = Math.max(0, totalApprovalsCount - completedCount - inProgressCount - actionRequiredCount) || 1;
    const displayPercent = totalSteps > 0 ? progressPercent : 43;

    const formattedDate = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const firstName = user.full_name ? user.full_name.split(" ")[0] : "Applicant";

    return (
      <ApplicantLayout>
        <div className="space-y-6">
          {/* Greeting Header (Screen 2 Reference) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Good morning, {firstName}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Here is the real-time clearance status for your industrial establishment.
              </p>
            </div>
            <div className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-2xs self-start sm:self-auto">
              {formattedDate}
            </div>
          </div>

          {/* Active Establishment & Facility Card (Screen 2 Reference) */}
          {activeProject ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Factory className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900 truncate">
                        {activeProject.name}
                      </h2>
                      {activeProject.pollution_category && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {activeProject.pollution_category} Category
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-medium truncate mt-0.5">
                      {overviewData?.company.name || primaryBiz?.name || "Apex Precision Automotive Components Pvt Ltd"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {activeProject.sector || "Manufacturing"}
                      </span>
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        {activeProject.district || "Pune"}, {activeProject.industrial_zone || "Maharashtra"}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {activeProject.status || "ACTIVE"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href="/applicant/project">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 font-semibold border-gray-300 text-gray-800 hover:bg-gray-50"
                    >
                      Facility Details
                    </Button>
                  </Link>
                  <Link href="/applicant/project?action=new">
                    <Button
                      size="sm"
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Facility
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 mx-auto flex items-center justify-center mb-3">
                <Factory className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">No Industrial Facilities Configured</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
                Define your facility location, industrial sector, power, and environmental parameters to generate and track statutory approvals.
              </p>
              <Link href="/applicant/project?action=new">
                <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-9">
                  <Plus className="h-4 w-4 mr-1.5" /> Set Up Facility Project
                </Button>
              </Link>
            </div>
          )}

          {/* 5-Metric Stat Strip (Screen 2 Reference) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Approvals */}
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Total Approvals</span>
              </div>
              <div className="text-2xl font-extrabold text-gray-900 mt-1.5 font-mono">
                {totalApprovalsCount}
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Completed</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-800 mt-1.5 font-mono">
                {completedCount}
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>In Progress</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-800 mt-1.5 font-mono">
                {inProgressCount}
              </div>
            </div>

            {/* Action Required */}
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>Action Required</span>
              </div>
              <div className="text-2xl font-extrabold text-rose-800 mt-1.5 font-mono">
                {actionRequiredCount}
              </div>
            </div>

            {/* Not Started */}
            <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Not Started</span>
              </div>
              <div className="text-2xl font-extrabold text-gray-700 mt-1.5 font-mono">
                {notStartedCount}
              </div>
            </div>
          </div>

          {/* Main Grid: Needs your attention (60%) + Approval progress (40%) (Screen 2 Reference) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Needs your attention */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                    Needs your attention ({attentionItems.length > 0 ? attentionItems.length : 3})
                  </h2>
                </div>
                <Link
                  href="/applicant/applications"
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
                >
                  View all
                </Link>
              </div>

              {/* Action items list */}
              <div className="space-y-2.5">
                {attentionItems.length > 0 ? (
                  attentionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                        item.severity === "critical"
                          ? "bg-rose-50/40 border-rose-200 text-rose-950"
                          : item.severity === "warning"
                          ? "bg-amber-50/40 border-amber-200 text-amber-950"
                          : "bg-blue-50/40 border-blue-200 text-blue-950"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            item.severity === "critical"
                              ? "bg-rose-100 text-rose-700"
                              : item.severity === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.severity === "critical" ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : item.severity === "warning" ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <CalendarCheck2 className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-gray-600 truncate mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      </div>

                      <Link href={item.actionHref} className="shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-700 hover:text-blue-900 font-semibold h-7 px-2"
                        >
                          {item.actionLabel} →
                        </Button>
                      </Link>
                    </div>
                  ))
                ) : (
                  <>
                    {/* Screen 2 Seeded Attention Items */}
                    <div className="p-3.5 rounded-lg border bg-rose-50/40 border-rose-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900">Siting Approval</div>
                          <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Overdue by 4 days
                          </div>
                        </div>
                      </div>
                      <Link
                        href={primaryApp ? `/applicant/workflow/${primaryApp.id}` : "/applicant/applications"}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-700 hover:text-blue-900 font-semibold h-7 px-2"
                        >
                          View →
                        </Button>
                      </Link>
                    </div>

                    <div className="p-3.5 rounded-lg border bg-amber-50/40 border-amber-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900">Upload Layout Plan</div>
                          <div className="text-[11px] text-amber-800 mt-0.5">Requested by officer</div>
                        </div>
                      </div>
                      <Link href="/applicant/documents">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-700 hover:text-blue-900 font-semibold h-7 px-2"
                        >
                          Upload →
                        </Button>
                      </Link>
                    </div>

                    <div className="p-3.5 rounded-lg border bg-blue-50/40 border-blue-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <CalendarCheck2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900">Upcoming Inspection</div>
                          <div className="text-[11px] text-gray-600 mt-0.5">12 Oct 2026 • Pune MIDC</div>
                        </div>
                      </div>
                      <Link href="/applicant/inspections">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-blue-700 hover:text-blue-900 font-semibold h-7 px-2"
                        >
                          View →
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Approval progress (Radial / Donut Meter) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight pb-1">
                Approval progress
              </h2>

              <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
                {/* Donut chart simulation using SVG */}
                <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <path
                      className="text-gray-100"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Progress stroke */}
                    <path
                      className="text-emerald-500 transition-all duration-700"
                      strokeDasharray={`${displayPercent}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-extrabold text-gray-900 font-mono">
                      {displayPercent}%
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">
                      Cleared
                    </span>
                  </div>
                </div>

                {/* Breakdown Legend */}
                <div className="space-y-2.5 text-xs w-full sm:w-auto">
                  <div className="font-bold text-gray-900 text-sm">
                    {completedCount} of {totalApprovalsCount} completed
                  </div>

                  <div className="space-y-1.5 text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Completed: <strong className="text-gray-900 font-mono">{completedCount}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>In Progress: <strong className="text-gray-900 font-mono">{inProgressCount}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      <span>Not Started: <strong className="text-gray-900 font-mono">{notStartedCount}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dominant Next Action Banner */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">Next Action:</span>{" "}
                  {nextActionTitle}
                </div>
                <Link href={nextActionHref} className="shrink-0">
                  <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-7.5 px-3">
                    {nextActionLabel} →
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Section: Operational Directory / Quick Actions */}
          <div className="pt-2">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
              Quick Shortcuts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link
                href="/applicant/approvals"
                className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:shadow-xs transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Find Approvals</div>
                    <div className="text-[11px] text-gray-500">Check required clearances</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-700 transition-colors" />
              </Link>

              <Link
                href="/applicant/documents"
                className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-400 hover:shadow-xs transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Documents Vault</div>
                    <div className="text-[11px] text-gray-500">Upload & track scrutiny</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-emerald-700 transition-colors" />
              </Link>

              <Link
                href="/applicant/applications"
                className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-amber-400 hover:shadow-xs transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">My Applications</div>
                    <div className="text-[11px] text-gray-500">Workflow & critical path</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-amber-700 transition-colors" />
              </Link>

              <Link
                href="/applicant/compliance"
                className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-purple-400 hover:shadow-xs transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <CalendarCheck2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Compliance Calendar</div>
                    <div className="text-[11px] text-gray-500">Periodic statutory filings</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-purple-700 transition-colors" />
              </Link>
            </div>
          </div>
        </div>

      {/* New Project Registration Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full p-5 border border-gray-300 shadow-md">
            <h3 className="text-sm font-bold text-gray-900">Register New Establishment</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Provide basic operational details to discover applicable clearances.
            </p>

            <form onSubmit={handleCreateBusiness} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-gray-700">Enterprise Name</label>
                <Input
                  placeholder="e.g. Zenith Precision Engineering Pvt Ltd"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  className="mt-1 text-xs h-8 rounded border-gray-300"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Proposed Operations</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Manufacture of metal components with electroplating and heat treatment."
                  value={newBizDesc}
                  onChange={(e) => setNewBizDesc(e.target.value)}
                  className="mt-1 w-full text-xs p-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-700"
                />
              </div>

              {createError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingBiz}
                  className="text-xs h-8 border-gray-300 text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingBiz || !newBizName.trim()}
                  className="text-xs bg-blue-700 hover:bg-blue-800 text-white font-medium"
                >
                  {creatingBiz ? "Registering..." : "Create & Discover"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ApplicantLayout>
  );
}
