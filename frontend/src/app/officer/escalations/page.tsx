"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getOfficerOverview,
  getOfficerEscalations,
  acknowledgeEscalation,
  resolveEscalation,
  OfficerEscalationItemUI,
  OfficerOverviewUI,
} from "@/lib/api";
import { OfficerLayout } from "@/components/layout/OfficerLayout";
import { StatusBadge, SLAStatusBadge } from "@/components/StatusBadge";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Flame,
  RefreshCw,
  Filter,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfficerEscalationsPage() {
  const router = useRouter();
  const [escalations, setEscalations] = useState<OfficerEscalationItemUI[]>([]);
  const [overview, setOverview] = useState<OfficerOverviewUI | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEsc, setSelectedEsc] = useState<OfficerEscalationItemUI | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [ov, esc] = await Promise.all([
        getOfficerOverview().catch(() => null),
        getOfficerEscalations({
          status: statusFilter === "ALL" ? undefined : statusFilter,
        }).catch(() => []),
      ]);
      setOverview(ov);
      setEscalations(esc);
      setActionError(null);
    } catch {
      setActionError("Failed to fetch escalations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "officer" && session.role !== "admin")) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router, statusFilter]);

  async function handleAcknowledge(id: number) {
    try {
      setSubmitting(true);
      await acknowledgeEscalation(id);
      await loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to acknowledge escalation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEsc || !resolutionNote.trim()) return;
    try {
      setSubmitting(true);
      await resolveEscalation(selectedEsc.id, resolutionNote.trim());
      setSelectedEsc(null);
      setResolutionNote("");
      await loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to resolve escalation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OfficerLayout title="SLA Escalations Queue" subtitle="Active statutory milestones requiring departmental intervention">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {["ALL", "TRIGGERED", "ACKNOWLEDGED", "RESOLVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                statusFilter === st
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); loadData(); }} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading escalations queue...</div>
      ) : escalations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">No Escalations in Queue</h3>
          <p className="text-xs text-gray-500 mt-1">All milestone approvals are either operating within statutory SLA limits or already resolved.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalations.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{item.step_name}</span>
                    <span className="text-xs font-mono text-gray-500">[{item.requirement_id}]</span>
                    {item.is_critical_path && (
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">CRITICAL PATH</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.application_title} • Department: {item.department}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-800">
                    {item.current_days_overdue}d Overdue
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    item.status === "TRIGGERED" ? "bg-amber-100 text-amber-800" :
                    item.status === "ACKNOWLEDGED" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
              <div className="py-3 text-xs text-gray-600 bg-gray-50/50 px-3 rounded-lg my-3">
                <span className="font-semibold text-gray-700">Reason: </span>{item.reason}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div>Triggered: {new Date(item.triggered_at).toLocaleString("en-IN")} • Level: {item.level}</div>
                <div className="flex items-center gap-2">
                  {item.status === "TRIGGERED" && (
                    <Button size="sm" variant="outline" onClick={() => handleAcknowledge(item.id)} disabled={submitting}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Acknowledge
                    </Button>
                  )}
                  {item.status !== "RESOLVED" && (
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setSelectedEsc(item)}>
                      Resolve Escalation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEsc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Resolve Escalation #{selectedEsc.id}</h3>
              <button onClick={() => setSelectedEsc(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleResolve} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Resolution Note / Administrative Action (Mandatory)</label>
                <textarea
                  required
                  rows={4}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Record justification, expedited inspection order, or departmental clearance decision..."
                  className="w-full text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedEsc(null)}>Cancel</Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={submitting || !resolutionNote.trim()}>
                  {submitting ? "Resolving..." : "Confirm Resolution"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OfficerLayout>
  );
}
