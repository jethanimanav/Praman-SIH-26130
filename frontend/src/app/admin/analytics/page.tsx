"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  getAnalyticsOverview,
  getDepartmentPerformance,
  getAnalyticsTrends,
  AnalyticsOverviewResponseUI,
  DepartmentPerformanceItemUI,
  AnalyticsTrendsResponseUI,
} from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Activity,
  AlertOctagon,
  FileCheck2,
  Layers,
  RefreshCw,
  Building2,
  CalendarCheck,
  Info,
  ChevronRight,
  TrendingDown,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverviewResponseUI | null>(null);
  const [deptPerformance, setDeptPerformance] = useState<DepartmentPerformanceItemUI[]>([]);
  const [trends, setTrends] = useState<AnalyticsTrendsResponseUI | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [ao, dp, tr] = await Promise.all([
        getAnalyticsOverview(),
        getDepartmentPerformance(),
        getAnalyticsTrends(),
      ]);
      setOverview(ao);
      setDeptPerformance(dp);
      setTrends(tr);
    } catch (err: any) {
      console.error("Failed to load analytics data:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Unable to load analytics metrics. Please ensure backend services are running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  const kpis = overview?.kpis;
  const insights = overview?.insights || [];
  const slaHealth = overview?.sla_health;

  return (
    <AdminLayout
      title="Executive Analytics"
      subtitle="Statutory SLA adherence, longitudinal trends, and department efficiency"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header Strip with Status and Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 text-violet-700 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Business Reform Action Plan (BRAP) Compliance Engine
                </span>
                <StatusBadge status="DEMO" />
              </div>
              <p className="text-xs text-gray-500">
                Data generated at:{" "}
                {overview?.generated_at
                  ? new Date(overview.generated_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })
                  : "Live"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Analytics
            </Button>
          </div>
        </div>

        {/* Demo Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Statutory Demonstration Notice:</span> All clearance timelines,
            department adherence rates, and longitudinal metrics represent deterministic test-bed data modeled on
            the Maharashtra Right to Public Services Act (RTS 2015) and DIPP BRAP mandates.
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertOctagon className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-900">Failed to Load Executive Analytics</h3>
            <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && !overview && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <RefreshCw className="h-8 w-8 text-violet-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aggregating Cross-Milestone Analytics...</p>
            <p className="text-xs text-gray-400 mt-1">
              Calculating statutory SLAs, department throughput, and critical path states
            </p>
          </div>
        )}

        {/* Main Content */}
        {!loading && overview && (
          <>
            {/* 1. EXECUTIVE KPIS GRID (12 Cards) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Statutory Key Performance Indicators (BRAP 2024)
                </h2>
                <span className="text-xs text-gray-400">Strictly deterministic calculations</span>
              </div>

              {kpis ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {/* Total Applications */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase text-gray-500">Total Applications</span>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{kpis.total_applications}</div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Lifetime filed</span>
                  </div>

                  {/* Active Applications */}
                  <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
                    <span className="text-[11px] font-semibold uppercase text-blue-700">Active</span>
                    <div className="text-2xl font-bold text-blue-900 mt-1">{kpis.active_applications}</div>
                    <span className="text-[11px] text-blue-600 mt-0.5 block">In review / scrutiny</span>
                  </div>

                  {/* Completed Applications */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
                    <span className="text-[11px] font-semibold uppercase text-emerald-700">Completed</span>
                    <div className="text-2xl font-bold text-emerald-900 mt-1">{kpis.completed_applications}</div>
                    <span className="text-[11px] text-emerald-600 mt-0.5 block">Fully approved</span>
                  </div>

                  {/* Mean Processing Days */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase text-gray-500">Mean Processing Days</span>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      {kpis.mean_processing_days !== null ? `${kpis.mean_processing_days}d` : "—"}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      {kpis.mean_processing_days !== null ? "Average turnaround" : "No completions yet"}
                    </span>
                  </div>

                  {/* Median Processing Days */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase text-gray-500">Median Processing Days</span>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      {kpis.median_processing_days !== null ? `${kpis.median_processing_days}d` : "—"}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">50th percentile</span>
                  </div>

                  {/* SLA Breach Count */}
                  <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${
                    kpis.sla_breach_count > 0 ? "border-rose-300 bg-rose-50/20" : "border-gray-200"
                  }`}>
                    <span className={`text-[11px] font-semibold uppercase ${
                      kpis.sla_breach_count > 0 ? "text-rose-700" : "text-gray-500"
                    }`}>
                      SLA Breach Count
                    </span>
                    <div className={`text-2xl font-bold mt-1 ${
                      kpis.sla_breach_count > 0 ? "text-rose-700" : "text-gray-900"
                    }`}>
                      {kpis.sla_breach_count}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Overdue statutory steps</span>
                  </div>

                  {/* Critical Path Overdue */}
                  <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${
                    kpis.critical_path_overdue_count > 0 ? "border-red-300 bg-red-50/30" : "border-gray-200"
                  }`}>
                    <span className={`text-[11px] font-semibold uppercase ${
                      kpis.critical_path_overdue_count > 0 ? "text-red-700" : "text-gray-500"
                    }`}>
                      Critical Path Overdue
                    </span>
                    <div className={`text-2xl font-bold mt-1 ${
                      kpis.critical_path_overdue_count > 0 ? "text-red-700" : "text-gray-900"
                    }`}>
                      {kpis.critical_path_overdue_count}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Direct project blocker</span>
                  </div>

                  {/* SLA Compliance Rate % */}
                  <div className="bg-white p-3.5 rounded-xl border border-violet-200 shadow-sm bg-gradient-to-br from-white to-violet-50/30">
                    <span className="text-[11px] font-semibold uppercase text-violet-700">SLA Compliance Rate</span>
                    <div className="text-2xl font-bold text-violet-900 mt-1">
                      {kpis.sla_compliance_rate !== null ? `${kpis.sla_compliance_rate}%` : "—"}
                    </div>
                    <span className="text-[11px] text-violet-600 mt-0.5 block">On-time adherence</span>
                  </div>

                  {/* Active Escalations */}
                  <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${
                    kpis.active_escalations > 0 ? "border-amber-300 bg-amber-50/20" : "border-gray-200"
                  }`}>
                    <span className={`text-[11px] font-semibold uppercase ${
                      kpis.active_escalations > 0 ? "text-amber-700" : "text-gray-500"
                    }`}>
                      Active Escalations
                    </span>
                    <div className={`text-2xl font-bold mt-1 ${
                      kpis.active_escalations > 0 ? "text-amber-700" : "text-gray-900"
                    }`}>
                      {kpis.active_escalations}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      {kpis.total_escalations} lifetime total
                    </span>
                  </div>

                  {/* Document Backlog */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase text-gray-500">Document Backlog</span>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{kpis.document_review_backlog}</div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Pending scrutiny</span>
                  </div>

                  {/* Inspection Backlog */}
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase text-gray-500">Inspection Backlog</span>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{kpis.inspection_backlog}</div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Awaiting CIS report</span>
                  </div>

                  {/* Compliance Overdue */}
                  <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${
                    kpis.compliance_overdue_count > 0 ? "border-orange-300 bg-orange-50/20" : "border-gray-200"
                  }`}>
                    <span className={`text-[11px] font-semibold uppercase ${
                      kpis.compliance_overdue_count > 0 ? "text-orange-700" : "text-gray-500"
                    }`}>
                      Compliance Overdue
                    </span>
                    <div className={`text-2xl font-bold mt-1 ${
                      kpis.compliance_overdue_count > 0 ? "text-orange-700" : "text-gray-900"
                    }`}>
                      {kpis.compliance_overdue_count}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Penalty risk active</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 2. RULE-DERIVED EXECUTIVE INSIGHTS */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-violet-700" />
                  <h2 className="font-semibold text-gray-900">Deterministic Operational Insights</h2>
                  <span className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-medium">
                    Rule-Engine Derived
                  </span>
                </div>
                <span className="text-xs text-gray-400">Zero AI Hallucination • Verified Aggregations</span>
              </div>

              {/* If total_applications === 0, display honest INSUFFICIENT DATA notice */}
              {kpis?.total_applications === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <Layers className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">INSUFFICIENT DATA</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Operational analytics require active applications and clearance workflows to derive deterministic
                    insights. No applications have been registered in the system yet.
                  </p>
                </div>
              ) : insights.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">All Clearance Systems Healthy</p>
                  <p className="text-xs text-gray-500 mt-1">
                    No active SLA breaches, scrutiny backlogs, or compliance risks detected across registered units.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.map((insight) => {
                    const isCritical = insight.priority === "CRITICAL";
                    const isWarning = insight.priority === "WARNING";

                    return (
                      <div
                        key={insight.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isCritical
                            ? "border-red-200 bg-red-50/40 text-red-900"
                            : isWarning
                            ? "border-amber-200 bg-amber-50/40 text-amber-900"
                            : "border-blue-100 bg-blue-50/30 text-blue-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            {isCritical ? (
                              <AlertOctagon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            ) : isWarning ? (
                              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-gray-900">{insight.title}</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    isCritical
                                      ? "bg-red-200 text-red-800"
                                      : isWarning
                                      ? "bg-amber-200 text-amber-800"
                                      : "bg-blue-200 text-blue-800"
                                  }`}
                                >
                                  {insight.priority}
                                </span>
                                <span className="text-[10px] font-medium bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200">
                                  {insight.category}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{insight.message}</p>
                            </div>
                          </div>
                          {insight.metric_value && (
                            <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded border border-gray-200 text-gray-800 shadow-2xs whitespace-nowrap">
                              {insight.metric_value}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. DEPARTMENT PERFORMANCE TABLE */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-violet-700" />
                    Department Efficiency Matrix (Maharashtra RTS)
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Live tracking of statutory clearance steps, bottlenecks, and on-time adherence
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  Total departments tracked: {deptPerformance.length}
                </div>
              </div>

              {deptPerformance.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No active department workflow data available.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-medium uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">Department / Authority</th>
                        <th className="py-3 px-4 text-center">Total Steps</th>
                        <th className="py-3 px-4 text-center">In Progress</th>
                        <th className="py-3 px-4 text-center">Overdue</th>
                        <th className="py-3 px-4 text-center">Active Escalations</th>
                        <th className="py-3 px-4 text-right">On-Time Adherence Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deptPerformance.map((dept, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                            {dept.department}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-gray-700">
                            {dept.total_steps}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-blue-700 font-semibold">
                            {dept.in_progress_steps}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            {dept.overdue_steps > 0 ? (
                              <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {dept.overdue_steps}
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            {dept.active_escalations > 0 ? (
                              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {dept.active_escalations}
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {dept.on_time_rate !== null ? (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      dept.on_time_rate >= 90
                                        ? "bg-emerald-500"
                                        : dept.on_time_rate >= 70
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                    }`}
                                    style={{ width: `${dept.on_time_rate}%` }}
                                  />
                                </div>
                                <span
                                  className={`font-mono font-bold ${
                                    dept.on_time_rate >= 90
                                      ? "text-emerald-700"
                                      : dept.on_time_rate >= 70
                                      ? "text-amber-700"
                                      : "text-rose-700"
                                  }`}
                                >
                                  {dept.on_time_rate}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No completed steps</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. LONGITUDINAL 6-MONTH CLEARANCE TRENDS */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-violet-700" />
                    Longitudinal Clearance Trends
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Rolling historical analysis of industrial clearance inflow, approvals, and SLA breaches
                  </p>
                </div>
                {trends?.insufficient_data && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium border border-amber-200">
                    INSUFFICIENT LONGITUDINAL DATA
                  </span>
                )}
              </div>

              {trends?.insufficient_data && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 flex items-center gap-2">
                  <Info className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>
                    {trends.message ||
                      "At least 2 calendar cycles required for longitudinal projection. Displaying current monthly telemetry."}
                  </span>
                </div>
              )}

              {/* Monthly Trend Cards & Table */}
              {trends?.trends && trends.trends.length > 0 ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
                    {trends.trends.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50/70 p-3.5 rounded-lg border border-gray-200 flex flex-col justify-between"
                      >
                        <div className="text-xs font-bold text-gray-900 border-b border-gray-200 pb-1 mb-2">
                          {item.month}
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">New Applications:</span>
                            <span className="font-semibold text-gray-900">{item.applications_created}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Approvals:</span>
                            <span className="font-semibold text-emerald-700">{item.applications_completed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">SLA Breaches:</span>
                            <span
                              className={`font-semibold ${
                                item.escalations_triggered > 0 ? "text-rose-700" : "text-gray-400"
                              }`}
                            >
                              {item.escalations_triggered}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Trends Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-4">Reporting Period</th>
                          <th className="py-2.5 px-4 text-center">Applications Created</th>
                          <th className="py-2.5 px-4 text-center">Approvals Completed</th>
                          <th className="py-2.5 px-4 text-center">SLA Breaches Triggered</th>
                          <th className="py-2.5 px-4 text-right">Throughput Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {trends.trends.map((row, i) => {
                          const ratio =
                            row.applications_created > 0
                              ? Math.round((row.applications_completed / row.applications_created) * 100)
                              : null;
                          return (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-4 font-semibold text-gray-900">{row.month}</td>
                              <td className="py-2.5 px-4 text-center font-mono">{row.applications_created}</td>
                              <td className="py-2.5 px-4 text-center font-mono text-emerald-700 font-semibold">
                                {row.applications_completed}
                              </td>
                              <td className="py-2.5 px-4 text-center font-mono">
                                {row.escalations_triggered > 0 ? (
                                  <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    {row.escalations_triggered}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                                {ratio !== null ? `${ratio}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg">
                  No historical trend cycles recorded yet.
                </div>
              )}
            </div>

            {/* 5. SLA HEALTH BREAKDOWN SUMMARY */}
            {slaHealth && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-violet-600" />
                  Statutory SLA Health Breakdown (All Active Steps)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 text-center">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase">On Track</span>
                    <div className="text-xl font-bold text-emerald-900 mt-1">{slaHealth.on_track}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-center">
                    <span className="text-[11px] font-semibold text-amber-800 uppercase">Warning (&gt;75%)</span>
                    <div className="text-xl font-bold text-amber-900 mt-1">{slaHealth.warning}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/40 text-center">
                    <span className="text-[11px] font-semibold text-rose-800 uppercase">Overdue</span>
                    <div className="text-xl font-bold text-rose-900 mt-1">{slaHealth.overdue}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/40 text-center">
                    <span className="text-[11px] font-semibold text-blue-800 uppercase">Completed</span>
                    <div className="text-xl font-bold text-blue-900 mt-1">{slaHealth.completed}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-center">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase">Paused</span>
                    <div className="text-xl font-bold text-slate-900 mt-1">{slaHealth.paused}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/60 text-center">
                    <span className="text-[11px] font-semibold text-gray-600 uppercase">Not Started</span>
                    <div className="text-xl font-bold text-gray-800 mt-1">{slaHealth.not_started}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/40 text-center">
                    <span className="text-[11px] font-semibold text-purple-800 uppercase">Verification Req</span>
                    <div className="text-xl font-bold text-purple-900 mt-1">{slaHealth.sla_verification_required}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
