"use client";

import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  RefreshCw,
  Shield,
  ShieldCheck,
  AlertOctagon,
  Clock,
  User as UserIcon,
  FileText,
  Key,
  Flame,
  CheckCircle2,
  ExternalLink,
  Layers,
  Database,
  Hash,
} from "lucide-react";

export interface AuditLogItemUI {
  id: number;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  reason: string | null;
  source: string | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogItemUI[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedActionGroup, setSelectedActionGroup] = useState<string>("ALL");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  async function fetchAuditLogs() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<AuditLogItemUI[]>("/api/admin/audit-logs", {
        params: { limit: 200 },
      });
      setLogs(response.data || []);
    } catch (err: any) {
      console.error("Failed to load audit logs:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to retrieve audit ledger from server."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchAuditLogs();
  }

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === "" ||
        log.action.toLowerCase().includes(search) ||
        (log.user_email && log.user_email.toLowerCase().includes(search)) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(search)) ||
        (log.entity_type && log.entity_type.toLowerCase().includes(search)) ||
        (log.reason && log.reason.toLowerCase().includes(search));

      const matchesRole =
        selectedRole === "ALL" ||
        (log.user_role && log.user_role.toLowerCase() === selectedRole.toLowerCase());

      const matchesActionGroup =
        selectedActionGroup === "ALL" ||
        log.action.toLowerCase().startsWith(selectedActionGroup.toLowerCase());

      return matchesSearch && matchesRole && matchesActionGroup;
    });
  }, [logs, searchTerm, selectedRole, selectedActionGroup]);

  // Export handlers
  function exportAsJSON() {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `praman_audit_ledger_${new Date().toISOString().split("T")[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  function exportAsCSV() {
    const headers = [
      "ID",
      "Timestamp",
      "Action",
      "User Email",
      "User Role",
      "Entity Type",
      "Entity ID",
      "Source",
      "Reason",
    ];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.created_at}"`,
      `"${l.action}"`,
      `"${l.user_email || ""}"`,
      `"${l.user_role || ""}"`,
      `"${l.entity_type || ""}"`,
      `"${l.entity_id || ""}"`,
      `"${l.source || ""}"`,
      `"${(l.reason || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute(
      "download",
      `praman_audit_ledger_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Action badge formatting
  function getActionBadge(action: string) {
    if (action.startsWith("auth.")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Key className="h-3 w-3 text-emerald-600" />
          {action}
        </span>
      );
    }
    if (action.startsWith("sla.") || action.startsWith("escalation.")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <Flame className="h-3 w-3 text-rose-600" />
          {action}
        </span>
      );
    }
    if (action.startsWith("document.")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <FileText className="h-3 w-3 text-amber-600" />
          {action}
        </span>
      );
    }
    if (action.startsWith("inspection.")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
          <CheckCircle2 className="h-3 w-3 text-indigo-600" />
          {action}
        </span>
      );
    }
    if (action.startsWith("clock.")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          <Clock className="h-3 w-3 text-purple-600" />
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-gray-100 text-gray-800 border border-gray-200">
        <Hash className="h-3 w-3 text-gray-500" />
        {action}
      </span>
    );
  }

  function getRoleBadge(role: string | null) {
    if (!role) return <span className="text-gray-400 text-xs">—</span>;
    const r = role.toLowerCase();
    if (r === "admin") {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-100 text-violet-800 border border-violet-200">
          Admin
        </span>
      );
    }
    if (r === "officer") {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
          Officer
        </span>
      );
    }
    if (r === "applicant") {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
          Applicant
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-200">
        {role}
      </span>
    );
  }

  function getSourceBadge(source: string | null) {
    if (!source) return <span className="text-gray-400 text-xs">—</span>;
    const s = source.toLowerCase();
    if (s === "clock") {
      return (
        <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
          Simulated Clock
        </span>
      );
    }
    if (s === "api") {
      return (
        <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
          REST API
        </span>
      );
    }
    if (s === "system") {
      return (
        <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200">
          System Cron
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
        {source}
      </span>
    );
  }

  return (
    <AdminLayout
      title="Audit Trail & Provenance Ledger"
      subtitle="Immutable tamper-evident record of all regulatory actions, logins, and overrides"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Regulatory Compliance &amp; Non-Repudiation Ledger
                </span>
                <StatusBadge status="VERIFIED" />
              </div>
              <p className="text-xs text-gray-500">
                Meets statutory record-keeping mandates under Maharashtra Right to Public Services Act 2015
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsCSV}
              disabled={loading || filteredLogs.length === 0}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsJSON}
              disabled={loading || filteredLogs.length === 0}
              className="gap-1.5 text-xs"
            >
              <Database className="h-3.5 w-3.5" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Security Ledger Architecture Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-start gap-3 shadow-2xs">
          <Shield className="h-5 w-5 text-slate-800 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              Statutory Non-Repudiation Architecture
              <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-mono">
                APPEND-ONLY
              </span>
            </div>
            <p className="leading-relaxed text-slate-600">
              Every critical lifecycle event—including officer scrutiny determinations, SLA pause intervals,
              clock adjustments, and document acceptance—is cryptographically recorded with author identity, timestamp,
              and execution context. Records cannot be overwritten or purged via administrative interfaces.
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertOctagon className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-900">Failed to Retrieve Audit Ledger</h3>
            <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAuditLogs}
              className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && logs.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <RefreshCw className="h-8 w-8 text-slate-700 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Loading Immutable Audit Ledger...</p>
            <p className="text-xs text-gray-400 mt-1">
              Synchronizing cryptographically anchored regulatory activity records
            </p>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search email, action, entity, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Action:
              </span>
              <select
                value={selectedActionGroup}
                onChange={(e) => setSelectedActionGroup(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="ALL">All Actions</option>
                <option value="auth">Authentication (auth.*)</option>
                <option value="sla">SLA &amp; Escalation (sla.*)</option>
                <option value="document">Documents (document.*)</option>
                <option value="inspection">Inspections (inspection.*)</option>
                <option value="clock">Clock Simulation (clock.*)</option>
                <option value="workflow">Workflow (workflow.*)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" /> Role:
              </span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="ALL">All Roles</option>
                <option value="admin">Admin</option>
                <option value="officer">Officer</option>
                <option value="applicant">Applicant</option>
              </select>
            </div>

            {(searchTerm || selectedRole !== "ALL" || selectedActionGroup !== "ALL") && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedRole("ALL");
                  setSelectedActionGroup("ALL");
                }}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-700" />
                Ledger Entries ({filteredLogs.length})
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Timestamped in chronological order (most recent first)
              </p>
            </div>
            <div className="text-xs text-gray-400">
              Showing {filteredLogs.length} of {logs.length} entries
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ClipboardList className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-800">No Audit Records Found</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                {logs.length === 0
                  ? "Audit ledger currently has no entries recorded. As regulatory activities occur, they will appear here automatically."
                  : "No audit events match your selected filters and search query."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp (IST)</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">User Email</th>
                    <th className="py-3 px-4 text-center">Role</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4 text-center">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map((log) => {
                    const formattedDate = new Date(log.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 font-mono text-gray-600 whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* Action Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getActionBadge(log.action)}
                        </td>

                        {/* User Email */}
                        <td className="py-3.5 px-4 font-medium text-gray-900 max-w-[200px] truncate">
                          {log.user_email || <span className="text-gray-400 italic">System Auto</span>}
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getRoleBadge(log.user_role)}
                        </td>

                        {/* Entity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {log.entity_type ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-gray-500 uppercase">{log.entity_type}</span>
                              {log.entity_id && (
                                <span className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded border border-gray-200">
                                  #{log.entity_id}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Reason / Notes */}
                        <td className="py-3.5 px-4 text-gray-700 max-w-[260px]">
                          {log.reason ? (
                            <div className="truncate" title={log.reason}>
                              {log.reason}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Source */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getSourceBadge(log.source)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
