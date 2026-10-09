"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  getAdminBottlenecks,
  getAdminOverview,
  AdminBottleneckUI,
  AdminOverviewUI,
} from "@/lib/api";
import { StatusBadge, SLAStatusBadge, SLAStatusType } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Layers,
  ArrowRight,
  Sparkles,
  AlertOctagon,
  FileText,
  UserCheck,
  Zap,
} from "lucide-react";

export default function AdminBottlenecksPage() {
  const [bottlenecks, setBottlenecks] = useState<AdminBottleneckUI[]>([]);
  const [overview, setOverview] = useState<AdminOverviewUI | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [bns, ov] = await Promise.all([
        getAdminBottlenecks(),
        getAdminOverview(),
      ]);
      setBottlenecks(bns);
      setOverview(ov);
    } catch (err: any) {
      console.error("Failed to load bottleneck data:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load bottleneck diagnostics. Backend services may be unreachable."
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

  // Derive unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    bottlenecks.forEach((b) => {
      if (b.department) set.add(b.department);
    });
    return Array.from(set).sort();
  }, [bottlenecks]);

  // Filtered bottlenecks
  const filteredBottlenecks = useMemo(() => {
    return bottlenecks.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.step_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.application_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requirement_id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = selectedDept === "ALL" || item.department === selectedDept;

      const matchesCritical = !criticalOnly || item.is_critical_path;

      return matchesSearch && matchesDept && matchesCritical;
    });
  }, [bottlenecks, searchTerm, selectedDept, criticalOnly]);

  // Diagnostic statistics
  const criticalBottlenecks = useMemo(() => {
    return bottlenecks.filter((b) => b.is_critical_path);
  }, [bottlenecks]);

  const deptDelayCounts = useMemo(() => {
    const map: Record<string, number> = {};
    bottlenecks.forEach((b) => {
      map[b.department] = (map[b.department] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [bottlenecks]);

  return (
    <AdminLayout
      title="Bottleneck Diagnostics"
      subtitle="Live identification of stalled approvals, SLA breaches, and escalation hotspots"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Critical Path Impediment Engine
                </span>
                <StatusBadge status="DEMO" />
              </div>
              <p className="text-xs text-gray-500">
                Continuous root-cause evaluation for Maharashtra RTS statutory clearance workflows
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Diagnostics
          </Button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertOctagon className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-900">Diagnostic Query Failed</h3>
            <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && !overview && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <RefreshCw className="h-8 w-8 text-rose-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Evaluating Active Critical Path Steps...</p>
            <p className="text-xs text-gray-400 mt-1">
              Analyzing statutory SLA timers, departmental queues, and escalation thresholds
            </p>
          </div>
        )}

        {!loading && overview && (
          <>
            {/* 1. HIGH-LEVEL OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Escalations */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-gray-500">Total Escalations</span>
                  <div className="p-1.5 bg-gray-100 rounded text-gray-600">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{overview.total_escalations}</div>
                <div className="text-xs text-gray-400 mt-1">Lifetime statutory breaches triggered</div>
              </div>

              {/* Active Escalations */}
              <div className={`bg-white p-4 rounded-xl border shadow-sm ${
                overview.active_escalations > 0 ? "border-amber-300 bg-amber-50/20" : "border-gray-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase ${
                    overview.active_escalations > 0 ? "text-amber-800" : "text-gray-500"
                  }`}>
                    Active Escalations
                  </span>
                  <div className={`p-1.5 rounded ${
                    overview.active_escalations > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <div className={`text-3xl font-bold mt-2 ${
                  overview.active_escalations > 0 ? "text-amber-700" : "text-gray-900"
                }`}>
                  {overview.active_escalations}
                </div>
                <div className="text-xs text-gray-400 mt-1">Pending officer / apex resolution</div>
              </div>

              {/* Critical Path Overdue Count */}
              <div className={`bg-white p-4 rounded-xl border shadow-sm ${
                overview.critical_path_overdue_count > 0 ? "border-rose-300 bg-rose-50/30" : "border-gray-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase ${
                    overview.critical_path_overdue_count > 0 ? "text-rose-800" : "text-gray-500"
                  }`}>
                    Critical Path Overdue
                  </span>
                  <div className={`p-1.5 rounded ${
                    overview.critical_path_overdue_count > 0 ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className={`text-3xl font-bold mt-2 ${
                  overview.critical_path_overdue_count > 0 ? "text-rose-700" : "text-gray-900"
                }`}>
                  {overview.critical_path_overdue_count}
                </div>
                <div className="text-xs text-gray-400 mt-1">Directly extending total project timeline</div>
              </div>

              {/* Average Resolution Hours */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-gray-500">Avg Resolution Hours</span>
                  <div className="p-1.5 bg-blue-100 rounded text-blue-700">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  {overview.average_resolution_hours !== null
                    ? `${overview.average_resolution_hours}h`
                    : "—"}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {overview.average_resolution_hours !== null
                    ? "Escalation acknowledgement to resolution"
                    : "No resolved escalations yet"}
                </div>
              </div>
            </div>

            {/* 2. DIAGNOSTIC RECOMMENDATIONS PANEL */}
            <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 rounded-xl border border-rose-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-rose-700" />
                <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wide">
                  Autonomous Diagnostic Recommendations
                </h2>
                <span className="text-[10px] font-bold bg-white text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                  Apex Intervention Plan
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Dept delays */}
                <div className="bg-white/85 p-3.5 rounded-lg border border-rose-200/60 shadow-2xs">
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1.5">
                    <Building2 className="h-4 w-4 text-rose-600" />
                    Departments with Repetitive Delays
                  </div>
                  {deptDelayCounts.length > 0 ? (
                    <ul className="space-y-1.5 text-gray-700">
                      {deptDelayCounts.map(([dept, count], idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span className="font-medium truncate max-w-[220px]">{dept}</span>
                          <span className="font-mono text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">
                            {count} delayed {count === 1 ? "step" : "steps"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No departmental delay clusters detected.</p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
                    Recommendation: Trigger inter-departmental clearance sync via District Industries Centre (DIC).
                  </p>
                </div>

                {/* Critical Path Steps */}
                <div className="bg-white/85 p-3.5 rounded-lg border border-amber-200/60 shadow-2xs">
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1.5">
                    <Flame className="h-4 w-4 text-amber-600" />
                    Critical Path Impediments ({criticalBottlenecks.length})
                  </div>
                  {criticalBottlenecks.length > 0 ? (
                    <div className="space-y-1 text-gray-700">
                      <p>
                        <span className="font-bold text-rose-700">{criticalBottlenecks.length}</span> critical step
                        {criticalBottlenecks.length > 1 ? "s are" : " is"} stalled on the topological critical path.
                        Any additional hour spent here pushes industrial commercial operations date (COD).
                      </p>
                      <div className="mt-2 text-[11px] text-gray-600 bg-amber-50/70 p-2 rounded border border-amber-200/50">
                        Top stalled step:{" "}
                        <span className="font-semibold text-gray-900">
                          {criticalBottlenecks[0].step_name}
                        </span>{" "}
                        (+{criticalBottlenecks[0].days_overdue.toFixed(1)}d overdue)
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">All critical-path milestones are on schedule.</p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
                    Recommendation: Exercise statutory deemed approval or priority officer summons under RTS Section 8.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. SEARCH & FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search application, step, requirement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5" /> Dept:
                  </span>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="ALL">All Departments ({departments.length})</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={criticalOnly}
                    onChange={(e) => setCriticalOnly(e.target.checked)}
                    className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                  />
                  <span>Critical Path Only</span>
                </label>

                {(searchTerm || selectedDept !== "ALL" || criticalOnly) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedDept("ALL");
                      setCriticalOnly(false);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>

            {/* 4. STALLED / OVERDUE STEPS TABLE */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Stalled &amp; Overdue Approval Steps ({filteredBottlenecks.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ordered by critical-path priority and total days overdue
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  Showing {filteredBottlenecks.length} of {bottlenecks.length} total bottlenecks
                </div>
              </div>

              {filteredBottlenecks.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">Zero Active Bottlenecks</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    {bottlenecks.length === 0
                      ? "All statutory steps are currently progressing within statutory time limits. No SLA breaches or active escalations detected."
                      : "No bottlenecks match your search and filter criteria."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">Application Title</th>
                        <th className="py-3 px-4">Step Name &amp; Requirement</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4 text-center">Critical Path</th>
                        <th className="py-3 px-4 text-center">SLA Status</th>
                        <th className="py-3 px-4 text-center">Days Overdue</th>
                        <th className="py-3 px-4 text-center">Escalation Level</th>
                        <th className="py-3 px-4">Escalated Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredBottlenecks.map((item) => (
                        <tr
                          key={`${item.application_id}-${item.step_id}`}
                          className={`hover:bg-gray-50/70 transition-colors ${
                            item.is_critical_path ? "bg-rose-50/20" : ""
                          }`}
                        >
                          {/* Application Title */}
                          <td className="py-3.5 px-4 font-medium text-gray-900 max-w-[200px]">
                            <div className="truncate font-semibold" title={item.application_title}>
                              {item.application_title}
                            </div>
                            <div className="text-[10px] text-gray-400">App #{item.application_id}</div>
                          </td>

                          {/* Step Name & Requirement ID */}
                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="font-semibold text-gray-800 truncate" title={item.step_name}>
                              {item.step_name}
                            </div>
                            <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {item.requirement_id}
                            </span>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4 text-gray-700 max-w-[180px]">
                            <div className="truncate font-medium" title={item.department}>
                              {item.department}
                            </div>
                          </td>

                          {/* Critical Path Indicator */}
                          <td className="py-3.5 px-4 text-center">
                            {item.is_critical_path ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <Flame className="h-3 w-3 text-rose-600" />
                                Critical Path
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">Parallel Stage</span>
                            )}
                          </td>

                          {/* SLA Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <SLAStatusBadge status={item.sla_status as SLAStatusType} />
                          </td>

                          {/* Days Overdue */}
                          <td className="py-3.5 px-4 text-center">
                            {item.days_overdue > 0 ? (
                              <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                +{item.days_overdue.toFixed(1)}d
                              </span>
                            ) : (
                              <span className="font-mono text-gray-400">0.0d</span>
                            )}
                          </td>

                          {/* Escalation Level */}
                          <td className="py-3.5 px-4 text-center">
                            {item.escalation_level ? (
                              <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                                {item.escalation_level}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">None</span>
                            )}
                          </td>

                          {/* Escalated Role */}
                          <td className="py-3.5 px-4 text-gray-800">
                            {item.recipient_role ? (
                              <div className="flex items-center gap-1.5 font-medium text-red-900">
                                <UserCheck className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                                <span className="truncate max-w-[180px]">{item.recipient_role}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px]">Unescalated</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
