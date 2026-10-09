"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getApplications,
  getApplicationInspections,
  rescheduleJointInspection,
  ApplicationDetailUI,
  ApplicationInspectionsResponseUI,
  JointInspectionItemUI,
  RescheduleInspectionPayload,
} from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import {
  RiskCategoryBadge,
  InspectionStatusBadge,
  InspectionOutcomeBadge,
  StatusBadge,
} from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wrench,
  Calendar,
  Clock,
  Shield,
  Building2,
  UserCheck,
  Mail,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  Check,
  X,
  FileCheck2,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

export default function ApplicantInspectionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Applications
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  // Inspections data
  const [inspectionData, setInspectionData] = useState<ApplicationInspectionsResponseUI | null>(null);

  // Reschedule Modal
  const [rescheduleTarget, setRescheduleTarget] = useState<JointInspectionItemUI | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTimeSlot, setNewTimeSlot] = useState("10:00 AM - 01:00 PM");
  const [reason, setReason] = useState("");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "applicant") {
      router.push("/login");
      return;
    }
    loadInitialData();
  }, [router]);

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const apps = await getApplications();
      setApplications(apps);
      if (apps.length > 0) {
        const activeId = apps[0].id;
        setSelectedAppId(activeId);
        await loadInspectionsForApp(activeId);
      } else {
        setInspectionData(null);
      }
    } catch (err: unknown) {
      console.error("Failed to load applications:", err);
      setError("Unable to load Central Inspection System status. Ensure backend is active.");
    } finally {
      setLoading(false);
    }
  }

  async function loadInspectionsForApp(appId: number) {
    try {
      const data = await getApplicationInspections(appId);
      setInspectionData(data);
    } catch (err: unknown) {
      console.error(`Failed to load inspections for app ${appId}:`, err);
      setError("Could not retrieve inspections for selected application.");
      setInspectionData(null);
    }
  }

  async function handleRefresh() {
    if (!selectedAppId) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadInspectionsForApp(selectedAppId);
    } catch {
      setError("Refresh failed. Check network connection.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAppChange(newAppId: number) {
    setSelectedAppId(newAppId);
    setLoading(true);
    setError(null);
    try {
      await loadInspectionsForApp(newAppId);
    } finally {
      setLoading(false);
    }
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppId || !rescheduleTarget) return;

    if (!newDate) {
      setRescheduleError("Please select a preferred reschedule date.");
      return;
    }
    if (!reason.trim()) {
      setRescheduleError("Please provide a legitimate justification for rescheduling.");
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError(null);
    setRescheduleSuccess(null);

    try {
      // Ensure ISO string formatting for FastAPI Pydantic datetime parser
      const dateIso = new Date(`${newDate}T10:00:00`).toISOString();
      const payload: RescheduleInspectionPayload = {
        scheduled_date: dateIso,
        time_slot: newTimeSlot,
        reason: reason.trim(),
      };

      await rescheduleJointInspection(selectedAppId, rescheduleTarget.id, payload);
      setRescheduleSuccess("Reschedule request submitted successfully. Participating departments will review your requested slot.");
      setRescheduleTarget(null);
      setNewDate("");
      setReason("");

      // Refresh list
      await loadInspectionsForApp(selectedAppId);
    } catch (err: unknown) {
      console.error("Reschedule failed:", err);
      setRescheduleError("Could not submit reschedule request. Please ensure valid date and note.");
    } finally {
      setSubmittingReschedule(false);
    }
  }

  const inspectionsList = inspectionData?.inspections || [];
  const activeScheduled = inspectionsList.find(
    (i) => i.status === "SCHEDULED" || i.status === "IN_PROGRESS" || i.status === "RESCHEDULED"
  );
  const completedInspections = inspectionsList.filter((i) => i.status === "COMPLETED");

  return (
    <ApplicantLayout
      title="Central Inspection System (CIS)"
      subtitle="Unified joint physical inspections synchronized under DPIIT Business Reforms Action Plan (BRAP)"
    >
      {/* Top Application Switcher & Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {applications.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="app-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Application:
              </Label>
              <select
                id="app-select"
                value={selectedAppId || ""}
                onChange={(e) => handleAppChange(Number(e.target.value))}
                className="text-sm font-medium border border-gray-300 rounded-lg bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    #{app.id} — {app.title || "Clearance Application"} ({app.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          <StatusBadge status="DEMO" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading || !selectedAppId}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Inspections
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">CIS Service Notice</p>
            <p className="mt-0.5 text-xs text-red-600">{error}</p>
          </div>
        </div>
      )}

      {rescheduleSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{rescheduleSuccess}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Notification dispatched to Lead Inspector & participating department officers.
            </p>
          </div>
          <button
            onClick={() => setRescheduleSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Empty State: No Applications */}
      {!loading && applications.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm max-w-xl mx-auto my-12">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wrench className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No Active Regulatory Applications</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Central Inspection System site visits are coordinated automatically once an industrial clearance application is submitted.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/applicant/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!loading && inspectionData && (
        <div className="space-y-6">
          {/* DPIIT Harmonized Central Inspection System Banner */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    DPIIT BRAP Mandate
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    Maharashtra Central Inspection System (CIS)
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-1">
                  Synchronized Multi-Department Site Visit
                </h2>
                <p className="text-xs text-gray-600 mt-1 max-w-3xl leading-relaxed">
                  Under Ease of Doing Business guidelines, physical inspections from MPCB (Pollution Control), DISH (Factory Safety), State Fire Services, and MIDC are synchronized into one scheduled joint site visit.
                </p>
              </div>
            </div>
          </div>

          {/* Risk Profile & Composite Score Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Enterprise Regulatory Risk Level</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <RiskCategoryBadge category={inspectionData.risk_category} />
                    <span className="text-xs text-gray-400 font-mono">
                      (Score: {inspectionData.composite_score}/100)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {inspectionData.joint_inspection_mandatory ? (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Joint Inspection Mandatory
                      </span>
                    ) : (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Desk Scrutiny / Discretionary
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 text-[11px] mt-0.5">
                    Assessed under CPCB / BRAP Risk Categorization
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 block font-medium">Enterprise</span>
                <span className="font-semibold text-gray-900 mt-0.5 block truncate">
                  {inspectionData.business_name}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 block font-medium">Clearance Application</span>
                <span className="font-semibold text-gray-900 mt-0.5 block">
                  Application #{inspectionData.application_id}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 block font-medium">Total Recorded Inspections</span>
                <span className="font-semibold text-gray-900 mt-0.5 block font-mono">
                  {inspectionsList.length} Joint Visit Record(s)
                </span>
              </div>
            </div>
          </div>

          {/* Active Scheduled Inspection Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Active Scheduled Joint Site Visit
              </h3>
              {activeScheduled && (
                <InspectionStatusBadge status={activeScheduled.status} />
              )}
            </div>

            {activeScheduled ? (
              <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-6">
                {/* Header row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                      Joint Inspection #{activeScheduled.id}
                    </div>
                    <div className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-3">
                      <span>{new Date(activeScheduled.scheduled_date).toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</span>
                      <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {activeScheduled.time_slot}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRescheduleTarget(activeScheduled);
                        setRescheduleError(null);
                        setReason("");
                      }}
                      className="text-xs"
                    >
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      Request Reschedule
                    </Button>
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Lead Inspector */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                    <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-blue-600" /> Lead Inspector
                    </div>
                    <div className="font-semibold text-sm text-gray-900">
                      {activeScheduled.lead_inspector_name || `Nodal Inspector #${activeScheduled.lead_inspector_id}`}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="h-3 w-3 text-gray-400" />
                      inspector@rop.gov.in
                    </div>
                  </div>

                  {/* Participating Departments */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 col-span-1 md:col-span-2">
                    <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-blue-600" /> Participating Regulatory Departments
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {(activeScheduled.participating_departments || ["MPCB", "DISH", "FIRE", "MIDC"]).map((dept) => (
                        <span
                          key={dept}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-gray-200 text-gray-800 shadow-2xs"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Synchronized joint visit: inspectors verify plant layout and safety concurrently.
                    </div>
                  </div>

                  {/* Status & Risk */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                    <div className="text-xs text-gray-500 font-medium">Risk Protocol</div>
                    <div className="font-semibold text-sm text-gray-900">
                      {activeScheduled.risk_category} Risk Protocol
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Requires on-site machinery & ETP inspection
                    </div>
                  </div>
                </div>

                {/* Joint Checklist items */}
                {activeScheduled.checklist_items && activeScheduled.checklist_items.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Joint Inspection Focus Checklist
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeScheduled.checklist_items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeScheduled.notes && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <span className="font-semibold">Inspector Note:</span> {activeScheduled.notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 shadow-sm">
                <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-gray-800">No Joint Visit Scheduled Currently</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                  {inspectionData.joint_inspection_mandatory
                    ? "Your facility is marked for joint physical inspection. The Nodal Lead Inspector from MIDC/MPCB will allocate a synchronized date slot shortly."
                    : "Joint physical inspection is not mandatory for this low-risk category. Clearance will proceed via online document scrutiny unless flagged by a reviewing officer."}
                </p>
              </div>
            )}
          </div>

          {/* Completed Inspection Reports / Historical Outcomes */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              Inspection Reports & Outcomes ({completedInspections.length})
            </h3>

            {completedInspections.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 shadow-sm text-xs">
                No finalized joint inspection reports recorded yet. Reports will appear here once the Lead Inspector files findings.
              </div>
            ) : (
              <div className="space-y-4">
                {completedInspections.map((insp) => {
                  const rep = insp.report;
                  return (
                    <div
                      key={insp.id}
                      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900">
                              Joint Inspection Report #{insp.id}
                            </span>
                            <InspectionStatusBadge status={insp.status} />
                            {rep && <InspectionOutcomeBadge outcome={rep.overall_outcome} />}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Conducted on {new Date(insp.scheduled_date).toLocaleDateString("en-IN")} • Lead Inspector: {insp.lead_inspector_name || `Inspector #${insp.lead_inspector_id}`}
                          </div>
                        </div>

                        {rep?.compliance_deadline && (
                          <div className="text-xs bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-800 font-medium">
                            Corrective Action Deadline: {new Date(rep.compliance_deadline).toLocaleDateString("en-IN")}
                          </div>
                        )}
                      </div>

                      {rep && (
                        <div className="space-y-4 text-xs">
                          {/* Department findings grid */}
                          <div>
                            <div className="font-semibold text-gray-700 mb-2">Departmental Findings</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {Object.entries(rep.department_findings || {}).map(([dept, finding]: [string, any]) => (
                                <div
                                  key={dept}
                                  className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-gray-900">{dept}</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        finding.status === "COMPLIANT"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {finding.status}
                                    </span>
                                  </div>
                                  <p className="text-gray-600 text-[11px] leading-relaxed">
                                    {finding.remarks || "No specific observations noted."}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Deficiencies */}
                          {rep.deficiencies && rep.deficiencies.length > 0 && (
                            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5 text-rose-900">
                              <div className="font-semibold flex items-center gap-1.5 text-rose-800">
                                <AlertTriangle className="h-4 w-4" /> Deficiencies Noted by Inspection Team
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 pl-2 text-rose-700">
                                {rep.deficiencies.map((d, i) => (
                                  <li key={i}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Corrective actions */}
                          {rep.corrective_actions && (
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                              <span className="font-semibold">Mandated Corrective Actions:</span>{" "}
                              {rep.corrective_actions}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 py-8">
          <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-gray-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Request Inspection Reschedule</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Synchronized multi-department joint visit adjustment
                </p>
              </div>
              <button
                onClick={() => {
                  setRescheduleTarget(null);
                  setRescheduleError(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <span className="font-semibold">Current Scheduled Date:</span>{" "}
              {new Date(rescheduleTarget.scheduled_date).toLocaleDateString("en-IN")} (
              {rescheduleTarget.time_slot})
              <p className="text-amber-800 text-[11px] mt-1">
                Note: Under BRAP mandates, rescheduling requires co-ordinating inspectors across{" "}
                {rescheduleTarget.participating_departments.join(", ")}. Please allow 3 working days notice.
              </p>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="reschedule-date" className="text-xs font-semibold text-gray-700">
                  Preferred New Date
                </Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label htmlFor="reschedule-slot" className="text-xs font-semibold text-gray-700">
                  Preferred Time Slot
                </Label>
                <select
                  id="reschedule-slot"
                  value={newTimeSlot}
                  onChange={(e) => setNewTimeSlot(e.target.value)}
                  className="w-full mt-1 text-xs border border-gray-300 rounded-md p-2 bg-white"
                >
                  <option value="10:00 AM - 01:00 PM">Morning Slot (10:00 AM - 01:00 PM)</option>
                  <option value="02:00 PM - 05:00 PM">Afternoon Slot (02:00 PM - 05:00 PM)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="reschedule-reason" className="text-xs font-semibold text-gray-700">
                  Justification Note (Mandatory)
                </Label>
                <textarea
                  id="reschedule-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Plant maintenance shutdown or key technical director unavailable on current date..."
                  className="w-full mt-1 text-xs border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {rescheduleError && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
                  {rescheduleError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRescheduleTarget(null);
                    setRescheduleError(null);
                  }}
                  disabled={submittingReschedule}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submittingReschedule}>
                  {submittingReschedule ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Submitting Request...
                    </>
                  ) : (
                    "Submit Reschedule Request"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demonstration Notice Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
        PRAMAN Central Inspection System • Academic Prototype for SIH 2026 (PS 26130) •
        Joint physical inspections synchronized under DPIIT BRAP. All officer contacts and dates are simulated.
      </div>
    </ApplicantLayout>
  );
}
