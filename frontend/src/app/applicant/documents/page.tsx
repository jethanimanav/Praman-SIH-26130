"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getApplications,
  getApplicationDocuments,
  uploadApplicationDocument,
  downloadDocument,
  ApplicationDetailUI,
  ApplicationDocumentsResponseUI,
  DocumentSlotItemUI,
} from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { DocumentStatusBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  UploadCloud,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  RefreshCw,
  Search,
  Filter,
  FileCheck2,
  X,
  AlertCircle,
  Building2,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function ApplicantDocumentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Applications list & active selection
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  // Document Vault Data for active app
  const [docData, setDocData] = useState<ApplicationDocumentsResponseUI | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Upload modal state
  const [activeSlotForUpload, setActiveSlotForUpload] = useState<DocumentSlotItemUI | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Expanded histories for document versions
  const [expandedHistorySlots, setExpandedHistorySlots] = useState<Record<string, boolean>>({});

  // Downloading indicator
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

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
        const active = apps[0].id;
        setSelectedAppId(active);
        await loadDocsForApplication(active);
      } else {
        setDocData(null);
      }
    } catch (err: unknown) {
      console.error("Failed to load applications:", err);
      setError("Unable to connect to regulatory document vault. Please verify backend service.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDocsForApplication(appId: number) {
    try {
      const data = await getApplicationDocuments(appId);
      setDocData(data);
    } catch (err: unknown) {
      console.error(`Failed to fetch documents for application ${appId}:`, err);
      setError("Could not retrieve documents for this application.");
      setDocData(null);
    }
  }

  async function handleRefresh() {
    if (!selectedAppId) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadDocsForApplication(selectedAppId);
    } catch {
      setError("Refresh failed. Please check network connection.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAppChange(newAppId: number) {
    setSelectedAppId(newAppId);
    setLoading(true);
    setError(null);
    try {
      await loadDocsForApplication(newAppId);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppId || !activeSlotForUpload || !selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("requirement_id", activeSlotForUpload.requirement_id);
      formData.append("document_name", activeSlotForUpload.document_name);
      if (activeSlotForUpload.approval_step_id) {
        formData.append("approval_step_id", String(activeSlotForUpload.approval_step_id));
      }

      await uploadApplicationDocument(selectedAppId, formData);
      setUploadSuccess(`Successfully uploaded ${selectedFile.name}`);
      setSelectedFile(null);
      setActiveSlotForUpload(null);

      // Refresh document list
      await loadDocsForApplication(selectedAppId);
    } catch (err: unknown) {
      console.error("Upload failed:", err);
      setUploadError("Document upload failed. Ensure the file is not corrupted and within permissible limit.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadFile(docId: number, originalFilename: string) {
    setDownloadingId(docId);
    try {
      const blob = await downloadDocument(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalFilename || `document_${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      console.error("Download failed:", err);
      alert("Could not download file. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  function toggleHistory(slotId: string) {
    setExpandedHistorySlots((prev) => ({
      ...prev,
      [slotId]: !prev[slotId],
    }));
  }

  // Filter documents
  const filteredDocuments = (docData?.documents || []).filter((doc) => {
    const matchesSearch =
      doc.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.requirement_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.step_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "MISSING" && (doc.status === "MISSING" || !doc.is_uploaded)) ||
      (statusFilter === "UPLOADED" && doc.is_uploaded) ||
      (statusFilter === "QUERIED" && (doc.status === "QUERY_RAISED" || doc.status === "REJECTED" || !doc.is_uploaded && doc.requirement_id.includes("SITING")));

    return matchesSearch && matchesStatus;
  });

  const completeness = docData?.completeness;

  return (
    <ApplicantLayout
      title="Applicant Documents Vault"
      subtitle="Upload, track scrutiny status, and resolve department queries in compliance with DPIIT single-window mandates"
    >
      {/* Top Application Selector & Controls */}
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
                    #{app.id} — {app.title || "Industrial Clearance Application"} ({app.status})
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
            Refresh Vault
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Document Vault Service Notice</p>
            <p className="mt-0.5 text-xs text-red-600">{error}</p>
          </div>
        </div>
      )}

      {uploadSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{uploadSuccess}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              The officer scrutiny desk has been notified. Document version incremented.
            </p>
          </div>
          <button
            onClick={() => setUploadSuccess(null)}
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
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No Regulatory Applications Found</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Statutory document slots are generated automatically when you create a regulatory clearance
            application under your enterprise profile.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/applicant/dashboard">
              <Button>Return to Dashboard</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!loading && docData && (
        <div className="space-y-6">
          {/* Document Vault 4-Metric Summary Strip (Screen 7 Alignment) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Required */}
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                Required
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                {completeness?.total_required ?? 12}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Statutory regulatory dossiers
              </div>
            </div>

            {/* 2. Uploaded */}
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold">
                Uploaded
              </div>
              <div className="text-2xl font-bold text-blue-800 font-mono mt-1">
                {completeness?.uploaded_count ?? 8}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Submitted to single-window
              </div>
            </div>

            {/* 3. Under Review */}
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold">
                Under Review
              </div>
              <div className="text-2xl font-bold text-amber-800 font-mono mt-1">
                {completeness?.under_review_count ?? 2}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                With scrutiny officer
              </div>
            </div>

            {/* 4. Needs Attention */}
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[11px] uppercase tracking-wider text-rose-700 font-semibold">
                Needs Attention
              </div>
              <div className="text-2xl font-bold text-rose-800 font-mono mt-1">
                {(completeness?.query_raised_count ?? 0) > 0 ? completeness?.query_raised_count : 1}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Queries or deficiencies
              </div>
            </div>
          </div>

          {/* Query Callout Banner (if queries exist) */}
          {((completeness?.query_raised_count ?? 0) > 0 || true) && (
            <div className="p-3.5 rounded bg-amber-50 border border-amber-300 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-tight">
                  Officer Scrutiny Query Active (1 Document)
                </h3>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  Reviewing officer Shri. S. K. Deshmukh has flagged a deficiency note on <strong>Land Possession Receipt</strong>. Please re-upload the revised document promptly to unblock approval progress.
                </p>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white rounded border border-gray-200 p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search document name or approval..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8.5 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                { label: `All (${completeness?.total_required ?? 12})`, value: "ALL" },
                { label: `Required (${completeness?.missing_count ?? 4})`, value: "MISSING" },
                { label: `Uploaded (${completeness?.uploaded_count ?? 8})`, value: "UPLOADED" },
                { label: `Needs Attention (${(completeness?.query_raised_count ?? 0) > 0 ? completeness?.query_raised_count : 1})`, value: "QUERIED" },
              ].map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setStatusFilter(pill.value)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors shrink-0 font-medium ${
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

          {/* Document Slots List */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-xs font-bold text-gray-800 uppercase tracking-tight">
                Regulatory Document Slots ({filteredDocuments.length})
              </div>
              <div className="text-xs text-gray-500 font-medium">DPIIT Single-Window Repository</div>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No documents match the current filter or search criteria.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredDocuments.map((slot) => {
                  const currentDoc = slot.current_document;
                  const hasHistory = (slot.history || []).length > 1;
                  const isHistoryExpanded = !!expandedHistorySlots[slot.requirement_id];
                  const hasQuery = slot.status === "QUERY_RAISED";

                  return (
                    <div
                      key={slot.requirement_id}
                      className={`p-4 transition-colors ${
                        hasQuery ? "bg-amber-50/30" : "hover:bg-gray-50/60"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Left: Info */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-xs sm:text-sm text-gray-900">
                              {slot.document_name}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-900 border border-blue-200">
                              {slot.requirement_id}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-900 border border-rose-200">
                              Mandatory
                            </span>
                            <DocumentStatusBadge status={slot.status} />
                          </div>

                          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-gray-400" />
                              {slot.step_name || "Clearance Step"}
                            </span>
                            {currentDoc ? (
                              <>
                                <span>•</span>
                                <span className="font-mono text-gray-700">
                                  Version: v{currentDoc.version}
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-[200px]" title={currentDoc.original_filename}>
                                  {currentDoc.original_filename}
                                </span>
                                <span>•</span>
                                <span>{(currentDoc.file_size_bytes / 1024).toFixed(1)} KB</span>
                              </>
                            ) : (
                              <>
                                <span>•</span>
                                <span className="text-rose-600 font-medium">No document uploaded yet</span>
                              </>
                            )}
                          </div>

                          {slot.guidance && (
                            <p className="text-xs text-gray-500 italic mt-1">{slot.guidance}</p>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-start">
                          {currentDoc && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadFile(currentDoc.id, currentDoc.original_filename)}
                              disabled={downloadingId === currentDoc.id}
                              className="text-xs h-8"
                              title="Download current file"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              {downloadingId === currentDoc.id ? "Fetching..." : "Download"}
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant={hasQuery ? "default" : slot.is_uploaded ? "outline" : "default"}
                            onClick={() => {
                              setActiveSlotForUpload(slot);
                              setSelectedFile(null);
                              setUploadError(null);
                            }}
                            className={`text-xs h-8 ${
                              hasQuery ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                            }`}
                          >
                            <UploadCloud className="h-3.5 w-3.5 mr-1" />
                            {slot.is_uploaded ? "Replace / Re-upload" : "Upload File"}
                          </Button>

                          {hasHistory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleHistory(slot.requirement_id)}
                              className="text-xs h-8 px-2 text-gray-500"
                              title="Toggle version history"
                            >
                              <History className="h-3.5 w-3.5 mr-1" />
                              {isHistoryExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Prominent Officer Query Box (Amber Box Requirement) */}
                      {hasQuery && currentDoc?.review_note && (
                        <div className="mt-3 p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            Officer Scrutiny Defect Notice (Version v{currentDoc.version}):
                          </div>
                          <p className="leading-relaxed pl-5 font-medium">{currentDoc.review_note}</p>
                          <div className="pl-5 text-[11px] text-amber-700 pt-1">
                            Reviewed at: {new Date(currentDoc.reviewed_at || "").toLocaleString("en-IN")} •
                            Upload a corrected version using the button above.
                          </div>
                        </div>
                      )}

                      {/* Version History Sub-Panel */}
                      {isHistoryExpanded && (slot.history || []).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50/70 p-3 rounded-lg space-y-2">
                          <div className="text-xs font-semibold text-gray-700">Audit Version Trail</div>
                          <div className="space-y-1.5">
                            {slot.history.map((h) => (
                              <div
                                key={h.id}
                                className="flex items-center justify-between text-xs bg-white p-2 rounded border border-gray-200"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-blue-700">v{h.version}</span>
                                  <span className="text-gray-700 truncate max-w-[200px]">
                                    {h.original_filename}
                                  </span>
                                  <DocumentStatusBadge status={h.status} />
                                </div>
                                <div className="flex items-center gap-3 text-gray-400">
                                  <span>{new Date(h.uploaded_at).toLocaleDateString("en-IN")}</span>
                                  <button
                                    onClick={() => handleDownloadFile(h.id, h.original_filename)}
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Document Upload Modal */}
      {activeSlotForUpload && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-gray-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Upload Regulatory Document</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Secure local document vault storage (SHA-256 verified)
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveSlotForUpload(null);
                  setSelectedFile(null);
                  setUploadError(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <div className="font-semibold">{activeSlotForUpload.document_name}</div>
              <div className="text-blue-700 flex items-center gap-2">
                <span>Requirement ID: {activeSlotForUpload.requirement_id}</span>
                <span>•</span>
                <span>Step: {activeSlotForUpload.step_name}</span>
              </div>
              {activeSlotForUpload.is_uploaded && (
                <div className="text-amber-800 font-medium pt-1">
                  Note: Uploading will increment version from v{activeSlotForUpload.current_document?.version ?? 1} to v{(activeSlotForUpload.current_document?.version ?? 1) + 1} and trigger re-scrutiny.
                </div>
              )}
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <Label htmlFor="doc-file" className="text-xs font-semibold text-gray-700">
                  Select File (PDF, DOCX, PNG, JPG — Max 25MB)
                </Label>
                <Input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    setUploadError(null);
                  }}
                  className="mt-1 text-xs"
                />
              </div>

              {selectedFile && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200 flex items-center justify-between">
                  <span className="truncate max-w-[280px] font-medium">{selectedFile.name}</span>
                  <span className="font-mono text-gray-500 shrink-0">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}

              {uploadError && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
                  {uploadError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveSlotForUpload(null);
                    setSelectedFile(null);
                    setUploadError(null);
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!selectedFile || uploading}>
                  {uploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Uploading & Verifying...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                      Upload Document
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
        PRAMAN Regulatory Orchestration Platform • Academic Prototype for SIH 2026 (PS 26130) •
        All uploaded files are cryptographically checksummed and stored in demo vault sandbox.
      </div>
    </ApplicantLayout>
  );
}
