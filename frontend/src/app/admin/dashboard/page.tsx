"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, User } from "@/lib/auth";
import {
  api,
  getAdminOverview,
  getAdminBottlenecks,
  getAnalyticsOverview,
  getDepartmentPerformance,
  getAnalyticsTrends,
  AdminOverviewUI,
  AdminBottleneckUI,
  AnalyticsOverviewResponseUI,
  DepartmentPerformanceItemUI,
  AnalyticsTrendsResponseUI,
} from "@/lib/api";
import { StatusBadge, SLAStatusBadge } from "@/components/StatusBadge";
import {
  Building2,
  LogOut,
  User as UserIcon,
  Clock,
  Shield,
  Activity,
  AlertOctagon,
  Flame,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  BarChart3,
  TrendingUp,
  FileCheck2,
  ClipboardList,
  CalendarCheck,
  Building,
  Info,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"insights" | "departments" | "bottlenecks" | "sandbox">("insights");
  const [clockStatus, setClockStatus] = useState<{
    current_time: string;
    is_simulated: boolean;
  } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewUI | null>(null);
  const [bottlenecks, setBottlenecks] = useState<AdminBottleneckUI[]>([]);
  
  // M10 Analytics State
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverviewResponseUI | null>(null);
  const [deptPerformance, setDeptPerformance] = useState<DepartmentPerformanceItemUI[]>([]);
  const [trends, setTrends] = useState<AnalyticsTrendsResponseUI | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "admin") {
      router.push("/login");
      return;
    }
    setUser(session);
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchClockStatus(),
        fetchOperationalMetrics(),
        fetchAnalyticsData(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClockStatus() {
    try {
      const res = await api.get("/api/admin/clock");
      setClockStatus(res.data);
    } catch {
      // ignore
    }
  }

  async function fetchOperationalMetrics() {
    try {
      const [ov, bns] = await Promise.all([getAdminOverview(), getAdminBottlenecks()]);
      setOverview(ov);
      setBottlenecks(bns);
    } catch (err: any) {
      console.error("Failed to load admin metrics:", err);
    }
  }

  async function fetchAnalyticsData() {
    try {
      const [ao, dp, tr] = await Promise.all([
        getAnalyticsOverview(),
        getDepartmentPerformance(),
        getAnalyticsTrends(),
      ]);
      setAnalyticsOverview(ao);
      setDeptPerformance(dp);
      setTrends(tr);
    } catch (err: any) {
      console.error("Failed to load M10 analytics:", err);
    }
  }

  async function advanceClock(days: number) {
    setAdvancing(true);
    try {
      await api.post("/api/admin/clock/advance", { days, hours: 0, minutes: 0 });
      await loadData();
    } finally {
      setAdvancing(false);
    }
  }

  async function resetClock() {
    setAdvancing(true);
    try {
      await api.post("/api/admin/clock/reset");
      await loadData();
    } finally {
      setAdvancing(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  const kpis = analyticsOverview?.kpis;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-700 p-2 rounded text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">
                PRAMAN — Industrial Approvals Portal
              </div>
              <div className="text-xs text-gray-500">Executive Analytics &amp; Admin Console</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status="DEMO" />
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Executive &amp; Operational Analytics Console</h1>
            <p className="text-xs text-gray-500 mt-1">
              Cross-department SLA performance, operational bottleneck diagnostics, and simulated turnaround sandbox
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="text-xs">
            Refresh Analytics
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 space-x-1">
          <button
            onClick={() => setActiveTab("insights")}
            className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === "insights"
                ? "bg-white border-t-2 border-blue-600 text-blue-700 border-x border-gray-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Overview &amp; Executive Insights
          </button>
          <button
            onClick={() => setActiveTab("departments")}
            className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === "departments"
                ? "bg-white border-t-2 border-blue-600 text-blue-700 border-x border-gray-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Building className="h-4 w-4" />
            Department Matrix
          </button>
          <button
            onClick={() => setActiveTab("bottlenecks")}
            className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === "bottlenecks"
                ? "bg-white border-t-2 border-blue-600 text-blue-700 border-x border-gray-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Bottlenecks ({bottlenecks.length})
          </button>
          <button
            onClick={() => setActiveTab("sandbox")}
            className={`px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === "sandbox"
                ? "bg-white border-t-2 border-blue-600 text-blue-700 border-x border-gray-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Clock className="h-4 w-4" />
            Time Travel Sandbox
          </button>
        </div>

        {/* TAB 1: EXECUTIVE INSIGHTS & OVERVIEW */}
        {activeTab === "insights" && (
          <div className="space-y-6">
            {/* Top Executive KPI Strip */}
            {kpis && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-gray-500">Total Applications</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{kpis.total_applications}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{kpis.active_applications} active, {kpis.completed_applications} approved</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-gray-500">Avg Processing Time</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {kpis.mean_processing_days !== null ? `${kpis.mean_processing_days}d` : "NO DATA"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {kpis.median_processing_days !== null ? `Median: ${kpis.median_processing_days}d` : "Insufficient completions"}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-blue-700">SLA Compliance Rate</div>
                  <div className="text-2xl font-bold text-blue-800 mt-1">
                    {kpis.sla_compliance_rate !== null ? `${kpis.sla_compliance_rate}%` : "NO DATA"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {kpis.sla_breach_count > 0 ? `${kpis.sla_breach_count} active breaches` : "0 active breaches"}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-red-600">Active Escalations</div>
                  <div className="text-2xl font-bold text-red-700 mt-1">{kpis.active_escalations}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{kpis.total_escalations} total lifetime</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-amber-700">Document Backlog</div>
                  <div className="text-2xl font-bold text-amber-800 mt-1">{kpis.document_review_backlog}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Pending officer scrutiny</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-orange-700">Compliance Overdue</div>
                  <div className="text-2xl font-bold text-orange-800 mt-1">{kpis.compliance_overdue_count}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Active statutory penalty risk</div>
                </div>
              </div>
            )}

            {/* Deterministic Executive Insights Panel */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-700" />
                  <h2 className="font-semibold text-gray-900">Deterministic Operational Insights</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                    Rule-Derived
                  </span>
                </div>
                <span className="text-xs text-gray-400">Zero AI Hallucination • Verified Aggregations</span>
              </div>

              {!kpis || kpis.total_applications === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <div className="font-semibold text-gray-900">DATA UNAVAILABLE / NO APPLICATIONS</div>
                  <div className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    No regulatory applications have been submitted yet. Operational metrics and bottlenecks will be calculated once applications are registered.
                  </div>
                </div>
              ) : kpis.active_applications === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <div className="font-semibold text-gray-900">ZERO ACTIVE WORKFLOWS</div>
                  <div className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    All registered applications have completed review or remain in draft state. There are currently no active departmental review queues.
                  </div>
                </div>
              ) : analyticsOverview?.insights && analyticsOverview.insights.length > 0 ? (
                <div className="space-y-3">
                  {analyticsOverview.insights.map((ins) => (
                    <div
                      key={ins.id}
                      className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
                        ins.priority === "CRITICAL"
                          ? "bg-red-50/70 border-red-200 text-red-900"
                          : ins.priority === "WARNING"
                          ? "bg-amber-50/70 border-amber-200 text-amber-900"
                          : "bg-blue-50/70 border-blue-200 text-blue-900"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {ins.priority === "CRITICAL" && (
                          <AlertOctagon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        )}
                        {ins.priority === "WARNING" && (
                          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        )}
                        {ins.priority === "INFO" && (
                          <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{ins.title}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/80 border border-current">
                              {ins.priority}
                            </span>
                          </div>
                          <p className="text-xs mt-1 text-gray-700 leading-relaxed">{ins.message}</p>
                        </div>
                      </div>
                      {ins.metric_value && (
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border border-current shadow-xs">
                            {ins.metric_value}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="font-medium text-gray-900">Normal Operational Performance</div>
                  <div className="text-xs text-gray-400 mt-1">Active regulatory workflows are currently progressing within statutory SLA bounds.</div>
                </div>
              )}
            </div>

            {/* SLA Health Distribution & Subsystem Health Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SLA Health */}
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">SLA Distribution (Approval Steps)</h3>
                </div>
                {analyticsOverview?.sla_health && (
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded bg-green-50 border border-green-200 text-green-800">
                      <div className="font-semibold">ON TRACK</div>
                      <div className="text-lg font-bold mt-1">{analyticsOverview.sla_health.on_track}</div>
                    </div>
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                      <div className="font-semibold">WARNING</div>
                      <div className="text-lg font-bold mt-1">{analyticsOverview.sla_health.warning}</div>
                    </div>
                    <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800">
                      <div className="font-semibold">OVERDUE</div>
                      <div className="text-lg font-bold mt-1">{analyticsOverview.sla_health.overdue}</div>
                    </div>
                    <div className="p-2.5 rounded bg-purple-50 border border-purple-200 text-purple-800">
                      <div className="font-semibold">PAUSED</div>
                      <div className="text-lg font-bold mt-1">{analyticsOverview.sla_health.paused}</div>
                    </div>
                    <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                      <div className="font-semibold">COMPLETED</div>
                      <div className="text-lg font-bold mt-1">{analyticsOverview.sla_health.completed}</div>
                    </div>
                    <div className="p-2.5 rounded bg-gray-50 border border-gray-200 text-gray-800">
                      <div className="font-semibold">NOT STARTED</div>
                      <div className="text-lg font-bold mt-1">{analyticsOverview.sla_health.not_started}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document & Inspection Health */}
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck2 className="h-4 w-4 text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">Document &amp; Inspection Health</h3>
                </div>
                {analyticsOverview && (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Active Dossiers Uploaded:</span>
                      <span className="font-bold text-gray-900">{analyticsOverview.document_health.total_uploaded}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Accepted by Officers:</span>
                      <span className="font-bold text-green-700">{analyticsOverview.document_health.accepted}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Avg Document Scrutiny:</span>
                      <span className="font-bold text-gray-900">
                        {analyticsOverview.document_health.average_review_hours !== null
                          ? `${analyticsOverview.document_health.average_review_hours}h`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Scheduled Inspections:</span>
                      <span className="font-bold text-blue-700">{analyticsOverview.inspection_health.scheduled}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">High-Risk Facilities:</span>
                      <span className="font-bold text-red-700">{analyticsOverview.inspection_health.facilities_high_risk}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Compliance Calendar Health */}
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarCheck className="h-4 w-4 text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">Post-Clearance Compliance</h3>
                </div>
                {analyticsOverview?.compliance_health && (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Total Statutory Filings:</span>
                      <span className="font-bold text-gray-900">{analyticsOverview.compliance_health.total_filings}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Verified &amp; Compliant:</span>
                      <span className="font-bold text-green-700">{analyticsOverview.compliance_health.verified}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Submitted (Pending Review):</span>
                      <span className="font-bold text-amber-700">{analyticsOverview.compliance_health.submitted}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-600">Overdue Filings:</span>
                      <span className="font-bold text-red-700">{analyticsOverview.compliance_health.overdue}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">Active Penalty Risk:</span>
                      <span className="font-bold text-red-700">{analyticsOverview.compliance_health.penalty_risk_active}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trends Section */}
            {trends && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-blue-700" />
                  <h3 className="font-semibold text-sm text-gray-900">Monthly Application &amp; Escalation Trends</h3>
                </div>
                {trends.insufficient_data ? (
                  <div className="p-6 text-center text-gray-500 text-xs">
                    {trends.message || "INSUFFICIENT DATA for longitudinal trend analysis (less than 2 active months)."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Month</th>
                          <th className="py-2.5 px-3">Applications Created</th>
                          <th className="py-2.5 px-3">Applications Approved</th>
                          <th className="py-2.5 px-3">Escalations Triggered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {trends.trends.map((t) => (
                          <tr key={t.month} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-semibold text-gray-800">{t.month}</td>
                            <td className="py-2.5 px-3">{t.applications_created}</td>
                            <td className="py-2.5 px-3 text-green-700 font-medium">{t.applications_completed}</td>
                            <td className="py-2.5 px-3 text-red-700 font-medium">{t.escalations_triggered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEPARTMENT PERFORMANCE MATRIX */}
        {activeTab === "departments" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-700" />
                <h3 className="font-semibold text-gray-900">Department Workload &amp; SLA Adherence Matrix</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {deptPerformance.length} Departments
                </span>
              </div>
              <div className="text-xs text-gray-500">Aggregated directly from active approval steps</div>
            </div>

            {deptPerformance.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                No departmental workload recorded in current state.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-medium">
                    <tr>
                      <th className="py-3 px-4">Department / Authority</th>
                      <th className="py-3 px-4">Total Assigned</th>
                      <th className="py-3 px-4">Completed</th>
                      <th className="py-3 px-4">In Progress</th>
                      <th className="py-3 px-4">Overdue</th>
                      <th className="py-3 px-4">Active Escalations</th>
                      <th className="py-3 px-4">On-Time Adherence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deptPerformance.map((dept) => (
                      <tr key={dept.department} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-gray-900">{dept.department}</td>
                        <td className="py-3.5 px-4">{dept.total_steps}</td>
                        <td className="py-3.5 px-4 text-green-700 font-medium">{dept.completed_steps}</td>
                        <td className="py-3.5 px-4 text-blue-700">{dept.in_progress_steps}</td>
                        <td className="py-3.5 px-4 text-red-700 font-semibold">{dept.overdue_steps}</td>
                        <td className="py-3.5 px-4">
                          {dept.active_escalations > 0 ? (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                              {dept.active_escalations}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {dept.on_time_rate !== null ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  dept.on_time_rate >= 80
                                    ? "bg-green-100 text-green-800"
                                    : dept.on_time_rate >= 50
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {dept.on_time_rate}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">INSUFFICIENT DATA</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BOTTLENECKS DIAGNOSTICS */}
        {activeTab === "bottlenecks" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Bottlenecks &amp; At-Risk Steps</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {bottlenecks.length}
                </span>
              </div>
              <div className="text-xs text-gray-500">Sorted by critical path priority &amp; overdue duration</div>
            </div>

            {bottlenecks.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="font-medium text-gray-900">No Operational Bottlenecks Detected</div>
                <div className="text-xs text-gray-400 mt-1">All approval milestones are within safe SLA parameters.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                    <tr>
                      <th className="py-3 px-4">Application &amp; Step</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">SLA State</th>
                      <th className="py-3 px-4">Overdue Days</th>
                      <th className="py-3 px-4">Active Escalation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bottlenecks.map((b) => (
                      <tr key={b.step_id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-gray-900">{b.step_name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span>{b.application_title}</span>
                            {b.is_critical_path && (
                              <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                                CRITICAL PATH
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          {b.department}
                        </td>

                        <td className="py-3.5 px-4">
                          <SLAStatusBadge status={b.sla_status} />
                        </td>

                        <td className="py-3.5 px-4 text-xs font-semibold text-red-600">
                          {b.days_overdue > 0 ? `+${b.days_overdue.toFixed(1)}d` : "0d"}
                        </td>

                        <td className="py-3.5 px-4">
                          {b.escalation_status ? (
                            <div>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                {b.escalation_status}
                              </span>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {b.escalation_level} • {b.recipient_role}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TIME TRAVEL SANDBOX */}
        {activeTab === "sandbox" && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-blue-700" />
              <h2 className="font-semibold text-gray-900">Simulated Clock (Time Travel Control)</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded ml-auto">
                SLA Demo Engine
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Advance the platform simulated clock forward in time to demonstrate SLA warnings, breaches, automatic deterministic escalations, and compliance due dates without waiting real calendar days.
            </p>
            {clockStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Simulated Environment Time:</span>
                  <code className="text-sm font-mono bg-blue-50 text-blue-800 px-2.5 py-1 rounded font-semibold border border-blue-200">
                    {new Date(clockStatus.current_time + "Z").toLocaleString()}
                  </code>
                  {clockStatus.is_simulated ? (
                    <StatusBadge status="SANDBOX" />
                  ) : (
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      REAL UTC TIME
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => advanceClock(1)}
                    disabled={advancing}
                  >
                    +1 Day
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => advanceClock(10)}
                    disabled={advancing}
                  >
                    +10 Days (Warning Test)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => advanceClock(25)}
                    disabled={advancing}
                  >
                    +25 Days (Breach &amp; Escalation)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetClock}
                    disabled={advancing}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Reset Clock to Real UTC
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading clock status...</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
