"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getOfficerComplianceFilings,
  verifyOfficerComplianceFiling,
  ComplianceFilingItemUI,
} from "@/lib/api";
import { OfficerLayout } from "@/components/layout/OfficerLayout";
import { StatusBadge, ComplianceStatusBadge } from "@/components/StatusBadge";
import {
  CalendarCheck2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfficerCompliancePage() {
  const router = useRouter();
  const [filings, setFilings] = useState<ComplianceFilingItemUI[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFiling, setSelectedFiling] = useState<ComplianceFilingItemUI | null>(null);
  const [decision, setDecision] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const list = await getOfficerComplianceFilings(filter === "ALL" ? undefined : filter);
      setFilings(list);
      setError(null);
    } catch {
      setError("Failed to fetch compliance filings.");
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFiling) return;
    if (decision === "REJECTED" && !notes.trim()) {
      setError("Rejection notes are mandatory.");
      return;
    }
    try {
      setSubmitting(true);
      await verifyOfficerComplianceFiling(selectedFiling.id, {
        decision: decision,
        verification_notes: notes.trim() || undefined,
      });
      setSelectedFiling(null);
      setNotes("");
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit verification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OfficerLayout title="Compliance Filings Queue" subtitle="Verify ongoing statutory returns and post-commissioning filings">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {["ALL", "SUBMITTED", "VERIFIED", "REJECTED", "OVERDUE"].map((st) => (
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
        <div className="py-16 text-center text-gray-400">Loading compliance returns...</div>
      ) : filings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <CalendarCheck2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">No Filings in Queue</h3>
          <p className="text-xs text-gray-500 mt-1">No ongoing returns require verification under the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filings.map((filing) => (
            <div key={filing.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{filing.title}</span>
                    <span className="text-xs text-gray-500 font-mono">[{filing.period_label}]</span>
                    <ComplianceStatusBadge status={filing.status as any} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Application: #{filing.application_id} • Department: {filing.department} • Frequency: {filing.frequency}
                  </div>
                  <div className="text-xs text-gray-400">
                    Statutory Due Date: {new Date(filing.due_date).toLocaleDateString("en-IN")}
                    {filing.submitted_at && ` • Submitted: ${new Date(filing.submitted_at).toLocaleDateString("en-IN")}`}
                  </div>
                </div>
                {filing.status === "SUBMITTED" && (
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setSelectedFiling(filing)}>
                    Verify Return
                  </Button>
                )}
              </div>
              {filing.filing_data && Object.keys(filing.filing_data).length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs">
                  <span className="font-semibold text-gray-700 block mb-1">Self-Reported Operational Metrics:</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-gray-600">
                    {Object.entries(filing.filing_data).map(([k, v]) => (
                      <div key={k}>{k}: <span className="font-bold text-gray-800">{String(v)}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedFiling && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Verify Statutory Compliance Return</h3>
              <button onClick={() => setSelectedFiling(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleVerify} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Verification Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["VERIFIED", "REJECTED"] as const).map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => setDecision(dec)}
                      className={`text-xs py-2 px-3 rounded-lg font-semibold border ${
                        decision === dec
                          ? dec === "VERIFIED" ? "bg-green-600 text-white border-green-600" : "bg-red-600 text-white border-red-600"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                    >
                      {dec}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Verification Notes {decision === "REJECTED" ? "(Mandatory)" : "(Optional)"}
                </label>
                <textarea
                  rows={3}
                  required={decision === "REJECTED"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record verification comments or rejection deficiencies..."
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedFiling(null)}>Cancel</Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={submitting}>
                  {submitting ? "Saving..." : "Submit Determination"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OfficerLayout>
  );
}
