"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getOfficerInspections,
  submitOfficerInspectionReport,
  JointInspectionItemUI,
} from "@/lib/api";
import { OfficerLayout } from "@/components/layout/OfficerLayout";
import { StatusBadge, RiskCategoryBadge, InspectionStatusBadge } from "@/components/StatusBadge";
import {
  Wrench,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Building2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfficerInspectionsPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<JointInspectionItemUI[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInsp, setSelectedInsp] = useState<JointInspectionItemUI | null>(null);
  const [outcome, setOutcome] = useState<"SATISFACTORY" | "DEFICIENCIES_NOTED" | "NON_COMPLIANT">("SATISFACTORY");
  const [deficiencies, setDeficiencies] = useState("");
  const [correctiveActions, setCorrectiveActions] = useState("");
  const [reinspectionRequired, setReinspectionRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const list = await getOfficerInspections(filter === "ALL" ? undefined : filter);
      setInspections(list);
      setError(null);
    } catch {
      setError("Failed to fetch joint inspections.");
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
  }, [router, filter]);

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInsp) return;
    try {
      setSubmitting(true);
      await submitOfficerInspectionReport(selectedInsp.id, {
        overall_outcome: outcome,
        department_findings: {},
        deficiencies: deficiencies.trim() ? [deficiencies.trim()] : [],
        corrective_actions: correctiveActions.trim() || undefined,
        reinspection_required: reinspectionRequired,
      });
      setSelectedInsp(null);
      setDeficiencies("");
      setCorrectiveActions("");
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit inspection report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OfficerLayout title="Joint Inspection Operations" subtitle="Synchronized Central Inspection System (CIS) pursuant to DPIIT BRAP">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {["ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "RESCHEDULED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                filter === st
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading joint inspections...</div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">No Scheduled Joint Inspections</h3>
          <p className="text-xs text-gray-500 mt-1">No multi-department physical visits match the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((insp) => (
            <div key={insp.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{insp.business_name}</span>
                    <InspectionStatusBadge status={insp.status as any} />
                    <RiskCategoryBadge category={insp.risk_category as any} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Scheduled: {new Date(insp.scheduled_date).toLocaleDateString("en-IN")} ({insp.time_slot}) • Lead: {insp.lead_inspector_name || "Assigned Officer"}
                  </div>
                </div>
                {insp.status !== "COMPLETED" && (
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setSelectedInsp(insp)}>
                    Submit Findings Report
                  </Button>
                )}
              </div>
              <div className="pt-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Participating Departments</div>
                <div className="flex flex-wrap gap-1.5">
                  {insp.participating_departments.map((dept, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                      {dept}
                    </span>
                  ))}
                </div>
              </div>
              {insp.report && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                  <div className="font-semibold text-gray-800">Official Report: {insp.report.overall_outcome}</div>
                  {insp.report.deficiencies && insp.report.deficiencies.length > 0 && <div className="text-gray-600 mt-1">Deficiencies: {insp.report.deficiencies.join(", ")}</div>}
                  {insp.report.corrective_actions && <div className="text-gray-600 mt-1">Corrective Actions: {insp.report.corrective_actions}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedInsp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Submit Joint Inspection Report</h3>
              <button onClick={() => setSelectedInsp(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Inspection Outcome</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["SATISFACTORY", "DEFICIENCIES_NOTED", "NON_COMPLIANT"] as const).map((oc) => (
                    <button
                      key={oc}
                      type="button"
                      onClick={() => setOutcome(oc)}
                      className={`text-xs py-2 px-2 rounded-lg font-semibold border ${
                        outcome === oc
                          ? oc === "SATISFACTORY" ? "bg-green-600 text-white border-green-600"
                            : oc === "DEFICIENCIES_NOTED" ? "bg-amber-600 text-white border-amber-600"
                            : "bg-red-600 text-white border-red-600"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                    >
                      {oc.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Deficiencies Observed (Optional)</label>
                <textarea
                  rows={2}
                  value={deficiencies}
                  onChange={(e) => setDeficiencies(e.target.value)}
                  placeholder="Record any non-compliances, missing fire safety equipment, effluent treatment gaps..."
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Recommended Corrective Actions</label>
                <textarea
                  rows={2}
                  value={correctiveActions}
                  onChange={(e) => setCorrectiveActions(e.target.value)}
                  placeholder="Prescribe remediation steps required from applicant..."
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reinsp"
                  checked={reinspectionRequired}
                  onChange={(e) => setReinspectionRequired(e.target.checked)}
                  className="rounded text-orange-600"
                />
                <label htmlFor="reinsp" className="text-xs text-gray-700 font-medium">Re-inspection required prior to operational clearance</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedInsp(null)}>Cancel</Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Official Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OfficerLayout>
  );
}
