"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getApplications,
  getComplianceCalendar,
  submitComplianceFiling,
  ApplicationDetailUI,
  ComplianceCalendarResponseUI,
  ComplianceFilingItemUI,
  SubmitComplianceFilingPayload,
} from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { ComplianceStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileCheck2,
  Building2,
  Calendar,
  Send,
  RefreshCw,
  AlertCircle,
  X,
  FileText,
  Scale,
  ShieldAlert,
  Search,
  Filter,
} from "lucide-react";

export default function ApplicantCompliancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Applications
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  // Compliance calendar data
  const [calendarData, setCalendarData] = useState<ComplianceCalendarResponseUI | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Filing Return Modal
  const [activeFiling, setActiveFiling] = useState<ComplianceFilingItemUI | null>(null);
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

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
        await loadCalendarForApp(activeId);
      } else {
        setCalendarData(null);
      }
    } catch (err: unknown) {
      console.error("Failed to load applications:", err);
      setError("Unable to load statutory compliance calendar. Please verify backend connectivity.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarForApp(appId: number) {
    try {
      const data = await getComplianceCalendar(appId);
      setCalendarData(data);
    } catch (err: unknown) {
      console.error(`Failed to load calendar for app ${appId}:`, err);
      setError("Could not retrieve compliance calendar for the selected application.");
      setCalendarData(null);
    }
  }

  async function handleRefresh() {
    if (!selectedAppId) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadCalendarForApp(selectedAppId);
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
      await loadCalendarForApp(newAppId);
    } finally {
      setLoading(false);
    }
  }

  function openFilingModal(filing: ComplianceFilingItemUI) {
    setActiveFiling(filing);
    setRemarks(filing.remarks || "");
    const initialInputs: Record<string, string> = {};
    (filing.metric_fields || []).forEach((field) => {
      initialInputs[field.name] = filing.filing_data?.[field.name] !== undefined
        ? String(filing.filing_data[field.name])
        : "";
    });
    setMetricInputs(initialInputs);
    setSubmitError(null);
  }

  async function handleFilingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppId || !activeFiling) return;

    // Validate required fields
    for (const field of activeFiling.metric_fields || []) {
      if (field.required && !metricInputs[field.name]?.trim()) {
        setSubmitError(`Please fill in required metric: ${field.label}`);
        return;
      }
    }

    setSubmittingReturn(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      // Parse numbers if applicable
      const processedData: Record<string, any> = {};
      for (const [k, v] of Object.entries(metricInputs)) {
        const num = Number(v);
        processedData[k] = isNaN(num) || v.trim() === "" ? v : num;
      }

      const payload: SubmitComplianceFilingPayload = {
        filing_data: processedData,
        remarks: remarks.trim() || undefined,
      };

      await submitComplianceFiling(selectedAppId, activeFiling.id, payload);
      setSubmitSuccess(`Statutory return for "${activeFiling.title}" (${activeFiling.period_label}) submitted successfully.`);
      setActiveFiling(null);

      // Refresh calendar
      await loadCalendarForApp(selectedAppId);
    } catch (err: unknown) {
      console.error("Filing submission failed:", err);
      setSubmitError("Failed to submit statutory return. Please verify form values.");
    } finally {
      setSubmittingReturn(false);
    }
  }

  const filings = calendarData?.filings || [];

  // Filter & Search
  const filteredFilings = filings.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.compliance_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.period_label.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      f.status === statusFilter ||
      (statusFilter === "PENDING" && (f.status === "OVERDUE" || f.status === "DUE_SOON" || f.status === "UPCOMING"));

    return matchesSearch && matchesStatus;
  });

  const hasOverdueOrPenalty =
    (calendarData?.overdue_count ?? 0) > 0 || filings.some((f) => f.penalty_risk_active);

  return (
    <ApplicantLayout
      title="12-Month Ongoing Statutory Compliance Calendar"
      subtitle="Post-clearance periodic filings, environmental returns, and statutory reporting under Maharashtra industrial regulations"
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
            Refresh Calendar
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Compliance Calendar Service Notice</p>
            <p className="mt-0.5 text-xs text-red-600">{error}</p>
          </div>
        </div>
      )}

      {submitSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{submitSuccess}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Department officer queue updated for verification. Digital filing receipt logged.
            </p>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
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
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No Active Regulatory Applications</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Statutory compliance schedules are activated upon approval or submission of regulatory clearance applications.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/applicant/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && calendarData && (
        <div className="space-y-6">
          {/* Statutory Penalty Risk Alert (When Overdue Returns Exist) */}
          {hasOverdueOrPenalty && (
            <div className="p-3.5 rounded bg-rose-50 border border-rose-300 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-rose-950 uppercase tracking-tight">
                    Statutory Compliance Notice: Overdue Returns Pending
                  </h3>
                  <span className="text-[10px] font-semibold bg-rose-100 text-rose-900 px-1.5 py-0.2 rounded border border-rose-200">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-rose-900 mt-1 leading-relaxed">
                  One or more periodic returns are past their statutory filing dates. Under state and central environmental and labor regulations, timely submission is required to prevent consent revocation or penalties.
                </p>
              </div>
            </div>
          )}

          {/* Consolidated Compliance Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Schedule Overview */}
            <div className="bg-white p-4 rounded border border-gray-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-semibold text-gray-700">12-Month Calendar Schedule</span>
                <CalendarCheck2 className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 font-mono">
                  {calendarData.total_filings ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Total statutory periodic returns projected</div>
              </div>
            </div>

            {/* 2. Verified & Compliant */}
            <div className="bg-white p-4 rounded border border-gray-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-semibold text-gray-700">Verified & Submitted</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Officer Verified:</span>
                  <span className="font-bold text-emerald-900 font-mono">{calendarData.verified_count ?? 0} returns</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Under Review:</span>
                  <span className="font-bold text-slate-800 font-mono">{calendarData.submitted_count ?? 0} returns</span>
                </div>
              </div>
            </div>

            {/* 3. Action Required */}
            <div className="bg-white p-4 rounded border border-gray-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-semibold text-gray-700">Attention Required</span>
                <Clock className="h-4 w-4 text-amber-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Overdue Returns:</span>
                  <span className="font-bold text-rose-900 font-mono">{calendarData.overdue_count ?? 0} overdue</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Due Soon (30 Days):</span>
                  <span className="font-bold text-amber-900 font-mono">{calendarData.due_soon_count ?? 0} returns</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded border border-gray-200 p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search return or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8.5 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0 mr-1">
                <Filter className="h-3 w-3" /> Filter:
              </span>
              {[
                { label: "All Returns", value: "ALL" },
                { label: "Pending / Due", value: "PENDING" },
                { label: "Overdue", value: "OVERDUE" },
                { label: "Submitted", value: "SUBMITTED" },
                { label: "Verified", value: "VERIFIED" },
              ].map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setStatusFilter(pill.value)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors shrink-0 ${
                    statusFilter === pill.value
                      ? "bg-blue-700 text-white border-blue-700 font-semibold"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filings Table / List */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-xs font-bold text-gray-800 uppercase tracking-tight">
                Mandatory Periodic Filings Schedule ({filteredFilings.length})
              </div>
              <div className="text-xs text-gray-500 font-medium">Maharashtra Regulatory Portal Synced</div>
            </div>

            {filteredFilings.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No statutory returns match the selected filter.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredFilings.map((filing) => {
                  const isOverdue = filing.status === "OVERDUE";
                  const isDueSoon = filing.status === "DUE_SOON";
                  const canFile =
                    filing.status === "UPCOMING" ||
                    filing.status === "DUE_SOON" ||
                    filing.status === "OVERDUE" ||
                    filing.status === "REJECTED";

                  return (
                    <div
                      key={filing.id}
                      className={`p-5 transition-colors ${
                        isOverdue ? "bg-rose-50/30" : isDueSoon ? "bg-amber-50/20" : "hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Left Details */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900">
                              {filing.title}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                              {filing.compliance_id}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {filing.frequency}
                            </span>
                            <ComplianceStatusBadge status={filing.status} />
                          </div>

                          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-gray-400" />
                              {filing.department}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-gray-700">
                              Period: {filing.period_label}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              Due: {new Date(filing.due_date).toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span>•</span>
                            <span
                              className={`font-semibold ${
                                isOverdue
                                  ? "text-rose-600"
                                  : isDueSoon
                                  ? "text-amber-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {filing.days_remaining < 0
                                ? `Overdue by ${Math.abs(filing.days_remaining)} days`
                                : `${filing.days_remaining} days remaining`}
                            </span>
                          </div>

                          {/* Statutory Act & Penalty Clause Reference */}
                          {(filing.statutory_act || filing.penalty_clause_desc) && (
                            <div className="mt-2 text-xs bg-gray-50 p-2.5 rounded border border-gray-200 space-y-1 text-gray-700">
                              {filing.statutory_act && (
                                <div className="flex items-center gap-1.5 font-medium text-gray-900">
                                  <Scale className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                  Statutory Authority: {filing.statutory_act}
                                </div>
                              )}
                              {filing.penalty_clause_desc && (
                                <p className="text-[11px] text-gray-600 leading-relaxed pl-5">
                                  <span className="font-semibold text-rose-700">Penalty Clause: </span>
                                  {filing.penalty_clause_desc}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Officer Verification Notes if verified or rejected */}
                          {filing.verification_notes && (
                            <div className="text-xs p-2 rounded bg-blue-50 border border-blue-200 text-blue-900">
                              <span className="font-semibold">Verification Note:</span>{" "}
                              {filing.verification_notes}
                            </div>
                          )}
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-start">
                          {canFile ? (
                            <Button
                              size="sm"
                              onClick={() => openFilingModal(filing)}
                              className={`text-xs h-8 ${
                                isOverdue
                                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                                  : isDueSoon
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : ""
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              {filing.status === "REJECTED" ? "Re-File Return" : "File Return"}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400 px-3 py-1 bg-gray-50 rounded border border-gray-200">
                              {filing.status === "VERIFIED" ? "Filing Cleared" : "Under Scrutiny"}
                            </span>
                          )}
                        </div>
                      </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Return Filing Modal */}
      {activeFiling && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-gray-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">File Statutory Compliance Return</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Periodic submission to {activeFiling.department}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveFiling(null);
                  setSubmitError(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <div className="font-semibold text-sm">{activeFiling.title}</div>
              <div className="text-blue-700 flex flex-wrap items-center gap-2">
                <span>Period: {activeFiling.period_label}</span>
                <span>•</span>
                <span>Due Date: {new Date(activeFiling.due_date).toLocaleDateString("en-IN")}</span>
              </div>
              {activeFiling.required_form && (
                <div className="text-[11px] text-blue-800 font-mono pt-1">
                  Prescribed Form: {activeFiling.required_form}
                </div>
              )}
            </div>

            <form onSubmit={handleFilingSubmit} className="space-y-4">
              {/* Dynamic Metric Fields */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Mandatory Return Metrics
                </div>

                {(activeFiling.metric_fields || []).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    No specific numeric metrics defined for this filing. Submit confirmation remarks below.
                  </p>
                ) : (
                  activeFiling.metric_fields.map((field) => (
                    <div key={field.name}>
                      <Label
                        htmlFor={`metric-${field.name}`}
                        className="text-xs font-medium text-gray-700 flex items-center justify-between"
                      >
                        <span>{field.label}</span>
                        {field.required && (
                          <span className="text-[10px] text-rose-500 uppercase font-bold">Required</span>
                        )}
                      </Label>
                      <Input
                        id={`metric-${field.name}`}
                        type={field.field_type === "number" ? "number" : "text"}
                        step={field.field_type === "number" ? "any" : undefined}
                        value={metricInputs[field.name] || ""}
                        onChange={(e) =>
                          setMetricInputs({ ...metricInputs, [field.name]: e.target.value })
                        }
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="mt-1 text-xs"
                        required={field.required}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Remarks / Verification notes */}
              <div>
                <Label htmlFor="filing-remarks" className="text-xs font-medium text-gray-700">
                  Compliance Remarks & Self-Declaration
                </Label>
                <textarea
                  id="filing-remarks"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Declare equipment operational status, continuous emission monitoring summary, or relevant disclosures..."
                  className="w-full mt-1 text-xs border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {submitError && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveFiling(null);
                    setSubmitError(null);
                  }}
                  disabled={submittingReturn}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submittingReturn}>
                  {submittingReturn ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Submitting Return...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Submit Statutory Return
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demonstration Notice Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
        PRAMAN Statutory Compliance Calendar • Academic Prototype for SIH 2026 (PS 26130) •
        Automated calendar computed from industrial regulatory rules. All returns submitted in demo environment.
      </div>
    </ApplicantLayout>
  );
}
