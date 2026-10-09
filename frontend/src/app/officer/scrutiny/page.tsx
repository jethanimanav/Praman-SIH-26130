"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getOfficerPendingDocuments,
  reviewDocument,
  downloadDocument,
  OfficerPendingDocumentItemUI,
} from "@/lib/api";
import { OfficerLayout } from "@/components/layout/OfficerLayout";
import { StatusBadge, DocumentStatusBadge } from "@/components/StatusBadge";
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfficerScrutinyPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<OfficerPendingDocumentItemUI[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<OfficerPendingDocumentItemUI | null>(null);
  const [scrutinyDecision, setScrutinyDecision] = useState<"ACCEPTED" | "REJECTED" | "QUERY_RAISED">("ACCEPTED");
  const [scrutinyNote, setScrutinyNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const docs = await getOfficerPendingDocuments(filter === "ALL" ? undefined : filter);
      setDocuments(docs);
      setError(null);
    } catch {
      setError("Failed to fetch pending documents.");
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

  async function handleDownload(docId: number, filename?: string) {
    try {
      const blob = await downloadDocument(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `document-${docId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download document.");
    }
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDoc) return;
    if ((scrutinyDecision === "REJECTED" || scrutinyDecision === "QUERY_RAISED") && !scrutinyNote.trim()) {
      setError("Notes are mandatory when rejecting or raising queries.");
      return;
    }
    try {
      setSubmitting(true);
      await reviewDocument(selectedDoc.id, scrutinyDecision, scrutinyNote.trim() || undefined);
      setSelectedDoc(null);
      setScrutinyNote("");
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit review determination.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OfficerLayout title="Document Scrutiny Queue" subtitle="Verify applicant dossiers, raise queries, and record determinations">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {["ALL", "UPLOADED", "UNDER_REVIEW", "QUERY_RAISED", "ACCEPTED", "REJECTED"].map((st) => (
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
        <div className="py-16 text-center text-gray-400">Loading scrutiny queue...</div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <FileCheck2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">Scrutiny Queue Clear</h3>
          <p className="text-xs text-gray-500 mt-1">No uploaded compliance documents require scrutiny under the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{doc.document_name}</span>
                    <span className="text-xs text-gray-500 font-mono">v{doc.version}</span>
                    <DocumentStatusBadge status={doc.status as any} />
                  </div>
                  <div className="text-xs text-gray-500">
                    File: <span className="font-mono">{doc.original_filename}</span> • {doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : "N/A"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Requirement: <span className="font-mono">{doc.requirement_id}</span> • Step: {doc.step_name} • App: {doc.application_title}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(doc.id, doc.original_filename)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setSelectedDoc(doc)}>
                    Scrutinize
                  </Button>
                </div>
              </div>
              {doc.review_note && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
                  <span className="font-semibold">Review Note:</span> {doc.review_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Document Scrutiny Determination</h3>
              <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleReview} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Scrutiny Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["ACCEPTED", "QUERY_RAISED", "REJECTED"] as const).map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => setScrutinyDecision(dec)}
                      className={`text-xs py-2 px-3 rounded-lg font-semibold border ${
                        scrutinyDecision === dec
                          ? dec === "ACCEPTED" ? "bg-green-600 text-white border-green-600"
                            : dec === "QUERY_RAISED" ? "bg-amber-600 text-white border-amber-600"
                            : "bg-red-600 text-white border-red-600"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                    >
                      {dec.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Scrutiny Remarks {scrutinyDecision !== "ACCEPTED" ? "(Mandatory)" : "(Optional)"}
                </label>
                <textarea
                  rows={4}
                  required={scrutinyDecision !== "ACCEPTED"}
                  value={scrutinyNote}
                  onChange={(e) => setScrutinyNote(e.target.value)}
                  placeholder="Record legal scrutiny remarks, missing annexures, or approval notes..."
                  className="w-full text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedDoc(null)}>Cancel</Button>
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
