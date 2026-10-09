"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, clearSession, User } from "@/lib/auth";
import { StatusBadge, CategoryBadge } from "@/components/StatusBadge";
import {
  getRegulatoryDiscovery,
  RegulatoryDiscoveryUIResponse,
  DiscoveryItemUI,
} from "@/lib/api";
import {
  Building2,
  LogOut,
  User as UserIcon,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  FileText,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RegulatoryDiscoveryPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = Number(params?.id);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<RegulatoryDiscoveryUIResponse | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "applicant") {
      router.push("/login");
      return;
    }
    setUser(session);

    if (businessId) {
      loadDiscovery(businessId);
    }
  }, [businessId, router]);

  async function loadDiscovery(id: number) {
    try {
      setLoading(true);
      setError(null);
      const data = await getRegulatoryDiscovery(id);
      setDiscovery(data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to load regulatory discovery.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  const filteredRequirements = discovery?.requirements.filter((item) => {
    if (filterCategory === "ALL") return true;
    return item.category === filterCategory;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Building2 className="h-6 w-6 text-blue-700" />
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Regulatory Orchestration Platform
            </div>
            <div className="text-xs text-gray-500">
              Regulatory Discovery & Explainable Checklist (M3)
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <StatusBadge status="DEMO" />
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserIcon className="h-4 w-4" />
              {user.full_name}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/applicant/dashboard")}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Regulatory Discovery: {discovery?.business_name || "Project Assessment"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Explainable regulatory requirements evaluated deterministically by the M1 engine from your confirmed profile.
              </p>
            </div>
            {discovery && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2"
                onClick={async () => {
                  try {
                    const { createApplication } = await import("@/lib/api");
                    const app = await createApplication(businessId, `Regulatory Workflow — ${discovery.business_name}`);
                    router.push(`/applicant/workflow/${app.id}`);
                  } catch (e: any) {
                    alert(e.response?.data?.detail || "Failed to initialize workflow application.");
                  }
                }}
              >
                <ShieldCheck className="h-4 w-4" />
                Initialize Approval Workflow
              </Button>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Evaluating regulatory rules and generating checklist...</div>
          </div>
        )}

        {error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-800 mb-6">
            <h3 className="font-semibold mb-1">Assessment Notice</h3>
            <p className="text-sm">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/applicant/dashboard")}
              className="mt-4"
            >
              Return to Project Overview
            </Button>
          </div>
        )}

        {discovery && !loading && (
          <>
            {/* Category Metric Badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                {
                  cat: "Required",
                  count: discovery.summary_counts["Required"] || 0,
                  icon: CheckCircle2,
                  bg: "bg-red-50 border-red-200 text-red-900",
                  text: "Mandatory Approvals",
                },
                {
                  cat: "Conditional",
                  count: discovery.summary_counts["Conditional"] || 0,
                  icon: AlertCircle,
                  bg: "bg-amber-50 border-amber-200 text-amber-900",
                  text: "Threshold Dependent",
                },
                {
                  cat: "Verification Required",
                  count: discovery.summary_counts["Verification Required"] || 0,
                  icon: HelpCircle,
                  bg: "bg-purple-50 border-purple-200 text-purple-900",
                  text: "Missing Information",
                },
                {
                  cat: "Not Applicable",
                  count: discovery.summary_counts["Not Applicable"] || 0,
                  icon: XCircle,
                  bg: "bg-gray-100 border-gray-200 text-gray-700",
                  text: "Exempt or Inactive",
                },
              ].map((card) => {
                const Icon = card.icon;
                const isSelected = filterCategory === card.cat;
                return (
                  <button
                    key={card.cat}
                    onClick={() => setFilterCategory(isSelected ? "ALL" : card.cat)}
                    className={`p-4 rounded-lg border text-left transition-all ${card.bg} ${
                      isSelected ? "ring-2 ring-blue-600 shadow-sm" : "hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {card.cat}
                      </span>
                      <Icon className="h-4 w-4 opacity-75" />
                    </div>
                    <div className="text-3xl font-extrabold">{card.count}</div>
                    <div className="text-xs opacity-75 mt-1">{card.text}</div>
                  </button>
                );
              })}
            </div>

            {/* Missing Critical Information Alert if any */}
            {discovery.missing_critical_fields.length > 0 && (
              <div className="mb-8 p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-900">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">
                      Verification Required for Complete Applicability
                    </h4>
                    <p className="text-xs text-purple-700 mt-0.5">
                      The following attributes are unverified or omitted from your business profile:{" "}
                      <span className="font-semibold">
                        {discovery.missing_critical_fields
                          .map((f) => f.replace(/\./g, " ").replace(/_/g, " "))
                          .join(", ")}
                      </span>
                      . Deterministic rules cannot safely resolve these requirements without verification.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Pill Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {filterCategory === "ALL" ? "All Identified Requirements" : `${filterCategory} Requirements`}{" "}
                ({filteredRequirements.length})
              </h2>
              {filterCategory !== "ALL" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterCategory("ALL")}
                  className="text-xs text-blue-600"
                >
                  Clear Filter
                </Button>
              )}
            </div>

            {/* Requirement Cards */}
            <div className="space-y-4">
              {filteredRequirements.map((item: DiscoveryItemUI) => (
                <div
                  key={item.requirement_id}
                  className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryBadge category={item.category} />
                        <StatusBadge status={item.data_status} />
                        <span className="text-xs text-gray-400 font-mono">
                          {item.requirement_id}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {item.requirement_name}
                      </h3>
                      {item.department && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Authority: {item.department}
                        </div>
                      )}
                    </div>

                    {item.estimated_timeline_days && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded">
                        <Clock className="h-3.5 w-3.5 text-gray-500" />
                        <span>Est. SLA: {item.estimated_timeline_days} Days</span>
                      </div>
                    )}
                  </div>

                  {/* Why it applies (Explainability) */}
                  <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-100 text-sm">
                    <div className="font-semibold text-xs text-gray-700 uppercase tracking-wider mb-1">
                      Why this applies:
                    </div>
                    <p className="text-gray-800 text-sm leading-relaxed">
                      {item.reason}
                    </p>

                    {/* Relevant Profile Information */}
                    {Object.keys(item.relevant_profile_fields).length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-200">
                        <span className="text-xs font-semibold text-gray-600">
                          Based on profile facts:{" "}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(item.relevant_profile_fields).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700"
                            >
                              <span className="font-medium mr-1 text-gray-500">
                                {k.replace(".", " ")}:
                              </span>{" "}
                              {String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing information if Verification Required */}
                    {item.missing_information.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-200 text-xs text-purple-800">
                        <span className="font-semibold">Missing Information: </span>
                        <span>{item.missing_information.join(", ")}</span>
                      </div>
                    )}
                  </div>

                  {/* Required Documents Checklist */}
                  {item.documents.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Required Documents:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.documents.map((doc, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded"
                          >
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safe Next Action */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-700">Next Action: </span>
                      {item.next_action}
                    </div>
                    <span className="text-xs text-gray-400 font-mono">
                      Rule: {item.rule_id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
