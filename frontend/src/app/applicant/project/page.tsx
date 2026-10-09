"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, User } from "@/lib/auth";
import {
  getBusinesses,
  getApplications,
  createBusiness,
  BusinessItem,
  ApplicationDetailUI,
  getRegulatoryDiscovery,
  RegulatoryDiscoveryUIResponse,
} from "@/lib/api";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  FolderOpen,
  Search,
  ArrowRight,
  ArrowLeft,
  Plus,
  RefreshCw,
  CheckCircle2,
  Zap,
  Droplets,
  MapPin,
  Factory,
  FileText,
  AlertCircle,
  Wrench,
  Wind,
  Trash2,
  Boxes,
  Flame,
  Check,
  X,
  FileCheck2,
} from "lucide-react";

type WizardStep = 1 | 2 | 3 | 4;

export default function MyProjectPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [applications, setApplications] = useState<ApplicationDetailUI[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<number | null>(null);
  const [discovery, setDiscovery] = useState<RegulatoryDiscoveryUIResponse | null>(null);

  // Wizard mode state
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Wizard Form fields (Screen 3 & Screen 4)
  const [formBizName, setFormBizName] = useState("Apex Precision Automotive Components Pvt Ltd");
  const [formBizType, setFormBizType] = useState("Manufacturing");
  const [formProjectType, setFormProjectType] = useState("New Setup");

  // Screen 4 Selectable activities
  const [selectedActivities, setSelectedActivities] = useState<string[]>([
    "Metal fabrication",
    "Electroplating",
    "Generate wastewater",
    "Air emissions",
  ]);
  const [otherActivityText, setOtherActivityText] = useState("");

  // Step 3 Location fields
  const [formLocationType, setFormLocationType] = useState("MIDC Industrial Estate");
  const [formDistrict, setFormDistrict] = useState("Pune");
  const [formEstate, setFormEstate] = useState("Chakan MIDC Phase II");
  const [formPowerDemand, setFormPowerDemand] = useState("350");
  const [formWaterDemand, setFormWaterDemand] = useState("20");

  const [savingProject, setSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "applicant" && session.role !== "admin")) {
      router.push("/login");
      return;
    }
    setUser(session);
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const [bizList, appList] = await Promise.all([
        getBusinesses().catch(() => []),
        getApplications().catch(() => []),
      ]);
      setBusinesses(bizList);
      setApplications(appList);

      if (bizList.length > 0) {
        const primaryId = bizList[0].id;
        setSelectedBizId(primaryId);
        loadDiscoveryData(primaryId);
      } else {
        // If no businesses exist, default straight into the 4-step wizard
        setIsWizardMode(true);
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadDiscoveryData(bizId: number) {
    try {
      const disc = await getRegulatoryDiscovery(bizId);
      setDiscovery(disc);
    } catch {
      setDiscovery(null);
    }
  }

  function toggleActivity(activityName: string) {
    setSelectedActivities((prev) =>
      prev.includes(activityName)
        ? prev.filter((a) => a !== activityName)
        : [...prev, activityName]
    );
  }

  async function handleFinalSubmit() {
    setSavingProject(true);
    setSaveError(null);
    try {
      const desc = `${formBizType} facility: ${selectedActivities.join(", ")}. Located at ${formEstate}, ${formDistrict}. Power: ${formPowerDemand}kW, Effluent: ${formWaterDemand}KLD.`;
      const created = await createBusiness(formBizName.trim(), desc);
      await loadData();
      setIsWizardMode(false);
      router.push(`/applicant/approvals`);
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || "Failed to create industrial project.");
    } finally {
      setSavingProject(false);
    }
  }

  if (!user) return null;

  const currentBiz = businesses.find((b) => b.id === selectedBizId) || businesses[0] || null;
  const currentApp = applications.find((a) => a.business_id === currentBiz?.id) || applications[0] || null;

  return (
    <ApplicantLayout
      breadcrumbs={[
        { label: "My Project", href: "/applicant/project" },
        ...(isWizardMode ? [{ label: "Create Project" }] : [{ label: currentBiz?.name || "Project Overview" }]),
      ]}
    >
      {/* ========================================================= */}
      {/* WIZARD MODE: Screen 3 & Screen 4 Guided Setup Flow       */}
      {/* ========================================================= */}
      {isWizardMode ? (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-1 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Tell us about your project
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                This helps PRAMAN identify the statutory approvals that apply to your business.
              </p>
            </div>
            {businesses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsWizardMode(false)}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel Setup
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Step Navigation Sidebar (Screen 3 Reference) */}
            <div className="md:col-span-4 bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">
                Setup Progress
              </div>

              <div className="space-y-1">
                {[
                  { step: 1, label: "Basic Details" },
                  { step: 2, label: "Business Activity" },
                  { step: 3, label: "Location & Load" },
                  { step: 4, label: "Review & Create" },
                ].map(({ step, label }) => {
                  const isActive = currentStep === step;
                  const isDone = currentStep > step;

                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setCurrentStep(step as WizardStep)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                        isActive
                          ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs"
                          : isDone
                          ? "text-gray-900 hover:bg-gray-50"
                          : "text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                          isActive
                            ? "bg-blue-700 text-white"
                            : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : step}
                      </div>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-500 px-2 leading-relaxed">
                <span className="font-semibold text-gray-700">Why we ask this:</span> Information maps directly to central and Maharashtra industrial acts to avoid manual enquiry queues.
              </div>
            </div>

            {/* Form Panels for Each Step */}
            <div className="md:col-span-8 bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
              {/* STEP 1: Basic Details (Screen 3) */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Basic Details</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enter the formal legal name and sector of your proposed enterprise.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="biz-name" className="text-xs font-semibold text-gray-700">
                        Business Name <span className="text-rose-600">*</span>
                      </Label>
                      <Input
                        id="biz-name"
                        value={formBizName}
                        onChange={(e) => setFormBizName(e.target.value)}
                        placeholder="e.g. Apex Precision Automotive Components Pvt Ltd"
                        className="mt-1 text-xs h-9"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="biz-type" className="text-xs font-semibold text-gray-700">
                        Business Type <span className="text-rose-600">*</span>
                      </Label>
                      <select
                        id="biz-type"
                        value={formBizType}
                        onChange={(e) => setFormBizType(e.target.value)}
                        className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Automotive Engineering">Automotive Engineering</option>
                        <option value="Chemical & Petrochemical">Chemical & Petrochemical</option>
                        <option value="Food Processing">Food Processing</option>
                        <option value="IT & Electronics">IT & Electronics</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="project-type" className="text-xs font-semibold text-gray-700">
                        Project Type <span className="text-rose-600">*</span>
                      </Label>
                      <select
                        id="project-type"
                        value={formProjectType}
                        onChange={(e) => setFormProjectType(e.target.value)}
                        className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-blue-600"
                      >
                        <option value="New Setup">New Setup (Greenfield Project)</option>
                        <option value="Expansion">Expansion of Existing Capacity</option>
                        <option value="Modernization">Modernization / Diversification</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsWizardMode(false)}
                      className="text-xs"
                    >
                      Save as Draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
                    >
                      Next: Business Activity →
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: Select Business Activities (Screen 4 Reference) */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-2 border-b border-gray-100">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">What will your facility do?</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Select all activities that apply to your project. This helps us identify the relevant approvals.
                      </p>
                    </div>

                    {/* Selected counter and chips (Screen 4 top right) */}
                    <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 text-xs shrink-0 max-w-xs">
                      <div className="flex items-center justify-between text-blue-900 font-bold mb-1">
                        <span>Selected ({selectedActivities.length})</span>
                        {selectedActivities.length > 0 && (
                          <button
                            onClick={() => setSelectedActivities([])}
                            className="text-[11px] text-blue-700 hover:underline font-normal"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedActivities.map((act) => (
                          <span
                            key={act}
                            className="inline-flex items-center gap-1 bg-white border border-blue-200 text-blue-950 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          >
                            {act}
                            <button
                              onClick={() => toggleActivity(act)}
                              className="text-blue-500 hover:text-rose-600"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Category 1: Manufacturing Processes */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Manufacturing Processes
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { name: "Metal fabrication", icon: Wrench },
                        { name: "Electroplating", icon: Zap },
                        { name: "Surface treatment", icon: Factory },
                        { name: "Plastic molding", icon: Boxes },
                      ].map(({ name, icon: Icon }) => {
                        const isSelected = selectedActivities.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleActivity(name)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all ${
                              isSelected
                                ? "bg-blue-50/70 border-blue-600 text-blue-950 ring-1 ring-blue-600 shadow-2xs"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <Icon className={`h-4 w-4 ${isSelected ? "text-blue-700" : "text-gray-400"}`} />
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSelected ? "bg-blue-700 border-blue-700 text-white" : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                            <span className="text-xs font-semibold leading-tight">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 2: Emissions & Waste */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Emissions & Waste
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { name: "Generate wastewater", icon: Droplets },
                        { name: "Air emissions", icon: Wind },
                        { name: "Hazardous waste", icon: AlertCircle },
                        { name: "Solid waste", icon: Trash2 },
                      ].map(({ name, icon: Icon }) => {
                        const isSelected = selectedActivities.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleActivity(name)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all ${
                              isSelected
                                ? "bg-blue-50/70 border-blue-600 text-blue-950 ring-1 ring-blue-600 shadow-2xs"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <Icon className={`h-4 w-4 ${isSelected ? "text-blue-700" : "text-gray-400"}`} />
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSelected ? "bg-blue-700 border-blue-700 text-white" : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                            <span className="text-xs font-semibold leading-tight">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 3: Materials & Storage */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Materials & Storage
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { name: "Use hazardous materials", icon: AlertCircle },
                        { name: "Chemical storage", icon: Boxes },
                        { name: "Fuel storage", icon: Flame },
                        { name: "Food processing", icon: Factory },
                      ].map(({ name, icon: Icon }) => {
                        const isSelected = selectedActivities.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleActivity(name)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all ${
                              isSelected
                                ? "bg-blue-50/70 border-blue-600 text-blue-950 ring-1 ring-blue-600 shadow-2xs"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <Icon className={`h-4 w-4 ${isSelected ? "text-blue-700" : "text-gray-400"}`} />
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSelected ? "bg-blue-700 border-blue-700 text-white" : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                            <span className="text-xs font-semibold leading-tight">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category 4: Other */}
                  <div className="space-y-1.5">
                    <Label htmlFor="other-activity" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Other Operational Activities
                    </Label>
                    <Input
                      id="other-activity"
                      value={otherActivityText}
                      onChange={(e) => setOtherActivityText(e.target.value)}
                      placeholder="Describe any other specific industrial operations or machinery..."
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Footer Navigation */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCurrentStep(3)}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
                    >
                      Next: Location →
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Location & Operational Load */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Location & Utilities</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Location zoning and utility consumption dictate environmental and siting permissions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="loc-type" className="text-xs font-semibold text-gray-700">
                        Zoning / Estate Type
                      </Label>
                      <select
                        id="loc-type"
                        value={formLocationType}
                        onChange={(e) => setFormLocationType(e.target.value)}
                        className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2.5 bg-white"
                      >
                        <option value="MIDC Industrial Estate">MIDC Industrial Estate</option>
                        <option value="Municipal Corporation">Municipal Corporation Area</option>
                        <option value="Rural Gram Panchayat">Rural / Gram Panchayat</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="district" className="text-xs font-semibold text-gray-700">
                        District (Maharashtra)
                      </Label>
                      <select
                        id="district"
                        value={formDistrict}
                        onChange={(e) => setFormDistrict(e.target.value)}
                        className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2.5 bg-white"
                      >
                        <option value="Pune">Pune</option>
                        <option value="Thane">Thane</option>
                        <option value="Raigad">Raigad</option>
                        <option value="Aurangabad">Aurangabad (Chhatrapati Sambhajinagar)</option>
                        <option value="Nagpur">Nagpur</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="estate" className="text-xs font-semibold text-gray-700">
                        Industrial Area / Taluka
                      </Label>
                      <Input
                        id="estate"
                        value={formEstate}
                        onChange={(e) => setFormEstate(e.target.value)}
                        placeholder="e.g. Chakan MIDC Phase II"
                        className="mt-1 text-xs h-9"
                      />
                    </div>

                    <div>
                      <Label htmlFor="power-demand" className="text-xs font-semibold text-gray-700">
                        Connected Power Demand (kW)
                      </Label>
                      <Input
                        id="power-demand"
                        type="number"
                        value={formPowerDemand}
                        onChange={(e) => setFormPowerDemand(e.target.value)}
                        placeholder="350"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div>
                      <Label htmlFor="water-demand" className="text-xs font-semibold text-gray-700">
                        Daily Water Consumption / Effluent (KLD)
                      </Label>
                      <Input
                        id="water-demand"
                        type="number"
                        value={formWaterDemand}
                        onChange={(e) => setFormWaterDemand(e.target.value)}
                        placeholder="20"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCurrentStep(4)}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
                    >
                      Next: Review & Create →
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Create */}
              {currentStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Review & Create Project</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Confirm project specifications to run deterministic statutory clearance assessment.
                    </p>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                      <div className="font-bold text-gray-900 text-sm flex items-center justify-between">
                        <span>{formBizName}</span>
                        <span className="text-xs font-semibold text-blue-700">{formBizType}</span>
                      </div>
                      <div className="text-gray-600">
                        <MapPin className="h-3.5 w-3.5 inline mr-1 text-gray-400" />
                        {formEstate}, {formDistrict} ({formLocationType})
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1.5">
                      <div className="font-bold text-blue-950">Selected Industrial Activities ({selectedActivities.length}):</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedActivities.map((act) => (
                          <span
                            key={act}
                            className="px-2 py-0.5 rounded bg-white border border-blue-200 text-blue-900 font-medium text-[11px]"
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-gray-200 bg-white">
                        <div className="text-gray-500">Connected Power</div>
                        <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">{formPowerDemand} kW</div>
                      </div>
                      <div className="p-3 rounded-lg border border-gray-200 bg-white">
                        <div className="text-gray-500">Water / Trade Effluent</div>
                        <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">{formWaterDemand} KLD</div>
                      </div>
                    </div>
                  </div>

                  {saveError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {saveError}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(3)}
                      disabled={savingProject}
                      className="text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFinalSubmit}
                      disabled={savingProject || !formBizName.trim()}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-5 h-9 font-semibold"
                    >
                      {savingProject ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Creating & Discovering Clearances...
                        </>
                      ) : (
                        "Create Project & Find Approvals →"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* DEFAULT VIEW: Active Project Overview & Specifications    */
        /* ========================================================= */
        <div className="space-y-6">
          {/* Top Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">
                Active Industrial Establishment
              </span>
              <StatusBadge status="DEMO" />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRefreshing(true);
                  loadData();
                }}
                disabled={refreshing || loading}
                className="text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsWizardMode(true);
                  setCurrentStep(1);
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add New Establishment
              </Button>
            </div>
          </div>

          {currentBiz && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{currentBiz.name}</h2>
                    <StatusBadge status="DEMO" />
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                    {currentBiz.description ||
                      "Automotive precision component machining and electroplating facility."}
                  </p>
                  <div className="text-[11px] text-gray-400 mt-2 font-mono">
                    Project ID: #{currentBiz.id} • Registered under PRAMAN Single-Window
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href="/applicant/approvals">
                    <Button variant="outline" size="sm" className="text-xs border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100">
                      <Search className="h-3.5 w-3.5 mr-1" />
                      Find Approvals
                    </Button>
                  </Link>
                  {currentApp && (
                    <Link href={`/applicant/workflow/${currentApp.id}`}>
                      <Button size="sm" className="text-xs bg-blue-700 hover:bg-blue-800 text-white">
                        <FolderOpen className="h-3.5 w-3.5 mr-1" />
                        View Applications
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Verified Profile Attributes */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Plant Operational Specifications
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Site & Establishment Profile */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-3">
                    <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
                      <Factory className="h-4 w-4 text-blue-700" />
                      Site & Establishment Profile
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">Industry Sector:</span>
                        <span className="font-semibold text-gray-900 text-right">Manufacturing / Automotive Components</span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">Location & Estate:</span>
                        <span className="font-semibold text-gray-900 text-right">Chakan MIDC Industrial Area, Pune</span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">Workforce Size:</span>
                        <span className="font-semibold text-gray-900 text-right">45 Workers (Factories Act Mandated)</span>
                      </div>
                    </div>
                  </div>

                  {/* Utilities & Environmental Load */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-3">
                    <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
                      <Zap className="h-4 w-4 text-amber-700" />
                      Utilities & Environmental Load
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">Connected Power Load:</span>
                        <span className="font-semibold text-gray-900 text-right font-mono">350 kW (MSEDCL Feeder)</span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">Trade Effluent / Water:</span>
                        <span className="font-semibold text-gray-900 text-right font-mono">15 KLD Trade + 5 KLD Domestic</span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-gray-500">Pollution Category:</span>
                        <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                          Orange Siting Category
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Regulatory Discovery Checklist Summary */}
              {discovery && (
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Regulatory Clearances ({discovery.total_requirements} identified)
                    </h3>
                    <Link
                      href="/applicant/approvals"
                      className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
                    >
                      Open Full Directory <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                    {Object.entries(discovery.summary_counts).map(([cat, count]) => (
                      <div key={cat} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="text-xl font-extrabold text-gray-900 font-mono">{count}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 font-medium">{cat}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ApplicantLayout>
  );
}
