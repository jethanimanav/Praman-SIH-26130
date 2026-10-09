"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  getBusinesses,
  getBusinessSchemes,
  BusinessItem,
  SchemesAssessmentResultUI,
  SchemeEvaluationItemUI,
} from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { SchemeEligibilityBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Award,
  IndianRupee,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  FileText,
  Building2,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

function formatCurrency(amount: number): string {
  if (!amount || amount === 0) return "₹0";
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakhs`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ApplicantSchemesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Businesses list & selected business
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<number | null>(null);

  // Schemes assessment data
  const [schemesData, setSchemesData] = useState<SchemesAssessmentResultUI | null>(null);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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
      const bizList = await getBusinesses();
      setBusinesses(bizList);
      if (bizList.length > 0) {
        const activeId = bizList[0].id;
        setSelectedBizId(activeId);
        await loadSchemesForBusiness(activeId);
      } else {
        setSchemesData(null);
      }
    } catch (err: unknown) {
      console.error("Failed to load business profiles:", err);
      setError("Unable to connect to Government Schemes & Subsidies Engine.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchemesForBusiness(bizId: number) {
    try {
      const data = await getBusinessSchemes(bizId);
      setSchemesData(data);
    } catch (err: unknown) {
      console.error(`Failed to load schemes for business ${bizId}:`, err);
      setError("Could not evaluate government incentive schemes for this enterprise profile.");
      setSchemesData(null);
    }
  }

  async function handleRefresh() {
    if (!selectedBizId) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadSchemesForBusiness(selectedBizId);
    } catch {
      setError("Refresh failed. Please check network connection.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleBusinessChange(newBizId: number) {
    setSelectedBizId(newBizId);
    setLoading(true);
    setError(null);
    try {
      await loadSchemesForBusiness(newBizId);
    } finally {
      setLoading(false);
    }
  }

  const allSchemes = schemesData?.schemes || [];

  const filteredSchemes = allSchemes.filter((scheme) => {
    const matchesSearch =
      scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || scheme.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <ApplicantLayout
      title="Government Support Schemes & Incentives"
      subtitle="Automated subsidy eligibility discovery across Maharashtra Industrial Policies, MSME packages, and green incentives"
    >
      {/* Top Business Selector & Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {businesses.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="biz-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Enterprise:
              </Label>
              <select
                id="biz-select"
                value={selectedBizId || ""}
                onChange={(e) => handleBusinessChange(Number(e.target.value))}
                className="text-sm font-medium border border-gray-300 rounded-lg bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                {businesses.map((biz) => (
                  <option key={biz.id} value={biz.id}>
                    {biz.name} (ID: #{biz.id})
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
            disabled={refreshing || loading || !selectedBizId}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Re-evaluate Schemes
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Schemes Discovery Notice</p>
            <p className="mt-0.5 text-xs text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State: No Businesses */}
      {!loading && businesses.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm max-w-xl mx-auto my-12">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No Enterprise Profile Found</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Register your industrial enterprise profile to evaluate subsidy eligibility under Maharashtra Package Scheme of Incentives (PSI 2019) and EV policies.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/applicant/dashboard">
              <Button>Create Enterprise in Dashboard</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && schemesData && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 1. Total Financial Assistance */}
            <div className="bg-gradient-to-br from-emerald-900 to-teal-900 text-white rounded-xl p-5 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
              <div>
                <div className="flex items-center justify-between text-xs text-emerald-200 mb-1">
                  <span className="font-medium">Potential Assistance</span>
                  <IndianRupee className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-white mt-1">
                  {formatCurrency(schemesData.total_potential_benefit_inr)}
                </div>
              </div>
              <div className="text-[11px] text-emerald-200 mt-2">
                Estimated max cumulative subsidies
              </div>
            </div>

            {/* 2. Eligible Schemes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium">Directly Eligible</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {schemesData.eligible_count}
                </div>
              </div>
              <div className="text-[11px] text-emerald-600 mt-2 font-medium">
                All statutory criteria satisfied
              </div>
            </div>

            {/* 3. Potentially Eligible */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium">Action Required</span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {schemesData.potentially_eligible_count}
                </div>
              </div>
              <div className="text-[11px] text-amber-600 mt-2 font-medium">
                Profile field / doc upload needed
              </div>
            </div>

            {/* 4. Total Evaluated */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium">Schemes Scanned</span>
                  <Award className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {schemesData.total_schemes_evaluated}
                </div>
              </div>
              <div className="text-[11px] text-gray-500 mt-2">
                Evaluated against enterprise profile
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search policy name or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                <Filter className="h-3 w-3" /> Status:
              </span>
              {[
                { label: "All Schemes", value: "ALL" },
                { label: "Eligible", value: "ELIGIBLE" },
                { label: "Action Required", value: "POTENTIALLY_ELIGIBLE" },
                { label: "Not Eligible", value: "NOT_ELIGIBLE" },
              ].map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setStatusFilter(pill.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
                    statusFilter === pill.value
                      ? "bg-blue-600 text-white border-blue-600 font-semibold"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scheme Cards Grid */}
          <div className="space-y-4">
            {filteredSchemes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                No incentive schemes match the selected filters.
              </div>
            ) : (
              filteredSchemes.map((scheme) => {
                const isEligible = scheme.status === "ELIGIBLE";
                const isPotential = scheme.status === "POTENTIALLY_ELIGIBLE";

                return (
                  <div
                    key={scheme.scheme_id}
                    className={`bg-white rounded-xl border p-6 shadow-sm transition-all space-y-4 ${
                      isEligible
                        ? "border-emerald-300 hover:border-emerald-400"
                        : isPotential
                        ? "border-amber-300 hover:border-amber-400"
                        : "border-gray-200"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-3 border-b border-gray-100">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base text-gray-900">{scheme.name}</h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                            {scheme.scheme_id}
                          </span>
                          <SchemeEligibilityBadge status={scheme.status} />
                        </div>

                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            {scheme.department}
                          </span>
                          <span>•</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-medium text-gray-700">
                            {scheme.category}
                          </span>
                          <span>•</span>
                          <span>Mode: {scheme.application_mode}</span>
                        </div>
                      </div>

                      {/* Financial Benefit Badge */}
                      <div className="text-left md:text-right shrink-0">
                        <div className="text-xs text-gray-500 font-medium">Estimated Maximum Benefit</div>
                        <div className="text-lg font-bold text-emerald-700 mt-0.5">
                          {formatCurrency(scheme.max_amount_inr)}
                        </div>
                        <div className="text-[11px] text-gray-500 max-w-xs truncate" title={scheme.max_benefit_description}>
                          {scheme.max_benefit_description}
                        </div>
                      </div>
                    </div>

                    {/* Scheme Description */}
                    <p className="text-xs text-gray-600 leading-relaxed">{scheme.description}</p>

                    {/* Conditions Breakdown: Matched vs Unmet */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                      {/* Matched Conditions */}
                      <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-2">
                        <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Satisfied Eligibility Criteria ({scheme.matched_conditions.length})
                        </div>
                        {scheme.matched_conditions.length === 0 ? (
                          <div className="text-[11px] text-gray-500 italic">None satisfied yet</div>
                        ) : (
                          <ul className="space-y-1 text-emerald-800">
                            {scheme.matched_conditions.map((cond, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-emerald-600 font-bold">•</span>
                                <span>{cond}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Unmet Conditions */}
                      <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                        <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          Unmet / Pending Conditions ({scheme.unmet_conditions.length})
                        </div>
                        {scheme.unmet_conditions.length === 0 ? (
                          <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> All criteria fulfilled for this scheme!
                          </div>
                        ) : (
                          <ul className="space-y-1 text-gray-600">
                            {scheme.unmet_conditions.map((cond, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-rose-500 font-bold">•</span>
                                <span>{cond}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Missing Fields Hints (For Potentially Eligible Schemes) */}
                    {isPotential && scheme.missing_fields_hint && scheme.missing_fields_hint.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-900">
                          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                          Unlock Eligibility: Missing Enterprise Profile Data
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Updating your enterprise profile with the following fields will satisfy qualification checks:
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {scheme.missing_fields_hint.map((field, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-white border border-amber-200 text-[11px] font-mono text-amber-900"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                        {scheme.potential_action && (
                          <div className="text-[11px] text-amber-800 font-medium pt-1">
                            Recommended Action: {scheme.potential_action}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Required Documents List */}
                    {scheme.required_documents && scheme.required_documents.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          Required Supporting Documentation
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {scheme.required_documents.map((doc, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-md text-xs bg-gray-50 border border-gray-200 text-gray-700"
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disbursement Note */}
                    {scheme.disbursement_mechanism && (
                      <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-100 flex items-center justify-between">
                        <span>Disbursement Channel: {scheme.disbursement_mechanism}</span>
                        <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                          View Policy GR / Notification <ExternalLink className="h-3 w-3" />
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      )}

      {/* DEMO Disclaimer Footer (Explicitly Required) */}
      <div className="mt-12 p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
        <div className="font-bold flex items-center gap-1.5 text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          Academic Prototype Demo Notice — Government Support Schemes Engine
        </div>
        <p className="text-[11px] text-amber-800 leading-relaxed">
          All scheme eligibility evaluations, benefit computations, and subsidy caps shown above are simulated prototype estimates
          generated by PRAMAN rule matrices. This portal does not issue formal sanction letters. Formal sanction requires application
          via the Government of Maharashtra Industries Department / Directorate of Industries portal and physical scrutiny by the District Industries Centre (DIC).
        </p>
      </div>
    </ApplicantLayout>
  );
}
