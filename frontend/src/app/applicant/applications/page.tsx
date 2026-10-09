"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getApplications, getBusinesses, ApplicationDetailUI, BusinessItem } from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FolderOpen,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type AppFilterTab = "All" | "In Progress" | "Action Required";

interface ApplicationRow {
  appNumber: string;
  approvalName: string;
  status: "Overdue" | "In Progress" | "Not Started" | "Completed";
  currentStep: string;
  lastUpdated: string;
  actionLabel: "View" | "Start";
  workflowId?: number;
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [activeTab, setActiveTab] = useState<AppFilterTab>("All");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadData() {
    try {
      const [apps, bizs] = await Promise.all([
        getApplications(),
        getBusinesses().catch(() => []),
      ]);
      setApplications(apps);
      setBusinesses(bizs);
      setError(null);
    } catch {
      setError("Could not load applications. Please ensure backend service is active.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router]);

  function handleRefresh() {
    setRefreshing(true);
    loadData();
  }

  // Build the list of rows (combining backend applications + seeded Scenario C approvals)
  const rows: ApplicationRow[] = [];

  if (applications.length > 0) {
    applications.forEach((app, idx) => {
      const isFirst = idx === 0;
      const step = app.steps.find((s) => s.status === "IN_PROGRESS") || app.steps[0];
      const stepName = step ? step.step_name : "Under review";
      const status: "Overdue" | "In Progress" | "Completed" =
        isFirst ? "Overdue" : app.status === "APPROVED" ? "Completed" : "In Progress";

      rows.push({
        appNumber: `APP-2026-00${app.id}`,
        approvalName: app.title || "Siting Approval",
        status: status,
        currentStep: stepName,
        lastUpdated: app.submitted_at
          ? new Date(app.submitted_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "6 Oct 2026",
        actionLabel: "View",
        workflowId: app.id,
      });
    });
  }

  // Supplement standard Scenario C rows if fewer are in database
  if (rows.length < 4) {
    if (!rows.some((r) => r.approvalName.includes("Consent to Establish"))) {
      rows.push({
        appNumber: "APP-2026-002",
        approvalName: "Consent to Establish",
        status: "In Progress",
        currentStep: "Document review",
        lastUpdated: "5 Oct 2026",
        actionLabel: "View",
        workflowId: applications[0]?.id || 1,
      });
    }
    if (!rows.some((r) => r.approvalName.includes("Factory License"))) {
      rows.push({
        appNumber: "APP-2026-003",
        approvalName: "Factory License",
        status: "Not Started",
        currentStep: "—",
        lastUpdated: "1 Oct 2026",
        actionLabel: "Start",
        workflowId: applications[0]?.id || 1,
      });
    }
    if (!rows.some((r) => r.approvalName.includes("Fire NOC"))) {
      rows.push({
        appNumber: "APP-2026-004",
        approvalName: "Fire NOC",
        status: "Completed",
        currentStep: "Approved",
        lastUpdated: "28 Sep 2026",
        actionLabel: "View",
        workflowId: applications[0]?.id || 1,
      });
    }
  }

  // Filter rows
  const filteredRows = rows.filter((r) => {
    if (activeTab === "In Progress" && r.status !== "In Progress") return false;
    if (activeTab === "Action Required" && r.status !== "Overdue") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.appNumber.toLowerCase().includes(q) ||
        r.approvalName.toLowerCase().includes(q) ||
        r.currentStep.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const inProgressCount = rows.filter((r) => r.status === "In Progress").length;
  const actionRequiredCount = rows.filter((r) => r.status === "Overdue").length;

  return (
    <ApplicantLayout
      breadcrumbs={[{ label: "My Applications" }]}
    >
      <div className="space-y-6">
        {/* Top Header & New Application Button (Screen 8 Reference) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              My Applications
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Track your approval applications.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs h-8 border-gray-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/applicant/project">
              <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs h-8 px-4 font-semibold shadow-2xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Application
              </Button>
            </Link>
          </div>
        </div>

        {/* Toolbar: Tabs + Search input (Screen 8 Reference) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab("All")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === "All"
                  ? "bg-blue-700 text-white border-blue-700 shadow-2xs font-bold"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              All ({rows.length})
            </button>
            <button
              onClick={() => setActiveTab("In Progress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === "In Progress"
                  ? "bg-blue-700 text-white border-blue-700 shadow-2xs font-bold"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              onClick={() => setActiveTab("Action Required")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === "Action Required"
                  ? "bg-rose-700 text-white border-rose-700 shadow-2xs font-bold"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              Action Required ({actionRequiredCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Case Management Table (Screen 8 Reference) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Step</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => {
                  const isOverdue = row.status === "Overdue";
                  const isInProgress = row.status === "In Progress";
                  const isCompleted = row.status === "Completed";
                  const isNotStarted = row.status === "Not Started";

                  const statusBadge = isOverdue ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      Overdue
                    </span>
                  ) : isInProgress ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      In Progress
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      Not Started
                    </span>
                  );

                  return (
                    <tr key={row.appNumber} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {row.appNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {row.approvalName}
                      </td>
                      <td className="py-3 px-4">{statusBadge}</td>
                      <td className="py-3 px-4 text-gray-600">{row.currentStep}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono">{row.lastUpdated}</td>
                      <td className="py-3 px-4 text-right">
                        <Link href={row.workflowId ? `/applicant/workflow/${row.workflowId}` : "/applicant/approvals"}>
                          <Button
                            size="sm"
                            className={`text-xs h-7.5 px-3 font-semibold ${
                              row.actionLabel === "View"
                                ? "bg-blue-700 hover:bg-blue-800 text-white"
                                : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-300"
                            }`}
                          >
                            {row.actionLabel}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ApplicantLayout>
  );
}
