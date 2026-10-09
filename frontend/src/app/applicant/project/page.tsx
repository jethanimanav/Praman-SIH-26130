"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, User } from "@/lib/auth";
import {
  getBusinesses,
  updateBusiness,
  createBusiness,
  getProjects,
  createProject,
  updateProject,
  getBusinessSchemes,
  getProjectSchemes,
  interactiveSchemeAssessment,
  SchemesAssessmentUI,
  SchemeItemUI,
  getProjectRadarImpacts,
  RadarImpactDashboardUI,
  ProjectImpactAssessmentUI,
  BusinessItem,
  ProjectItem,
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
  Edit3,
  ShieldCheck,
  Mail,
  Phone,
  Layers,
  ChevronRight,
  Users,
  Compass,
  Award,
  Radio,
  Sparkles,
  HelpCircle,
  Info,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

type WizardStep = 1 | 2 | 3 | 4;

export default function MyProjectPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Phase 4: Government Scheme Assistant State
  const [schemesData, setSchemesData] = useState<SchemesAssessmentUI | null>(null);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [schemeFilter, setSchemeFilter] = useState<"ALL" | "POTENTIALLY_ELIGIBLE" | "NEEDS_MORE_INFO" | "NOT_MATCHED">("ALL");
  const [schemeAnswers, setSchemeAnswers] = useState<Record<string, any>>({
    captive_solar_kw: 0,
    has_zld: false,
    women_or_sc_st_promoter: false,
    export_oriented_unit: false,
    msme_category: "Small",
  });

  // Phase 4: Regulatory Change Impact Radar State
  const [radarData, setRadarData] = useState<RadarImpactDashboardUI | null>(null);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [radarFilter, setRadarFilter] = useState<"ALL" | "AFFECTED" | "NEEDS_REVIEW" | "NO_MATCH">("ALL");

  // Success message banners
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Modal states
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [isEditingFacility, setIsEditingFacility] = useState(false);
  const [savingFacility, setSavingFacility] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);

  // Company Edit Form State
  const [companyForm, setCompanyForm] = useState({
    name: "",
    entity_type: "Private Limited Company",
    registration_number: "",
    pan_number: "",
    gstin: "",
    contact_email: "",
    contact_phone: "",
    registered_office_address: "",
  });

  // Facility Edit Form State
  const [facilityForm, setFacilityForm] = useState({
    name: "",
    project_type: "New Setup",
    district: "Pune",
    taluka: "Khed",
    industrial_zone: "Chakan MIDC Phase II",
    location_type: "MIDC Industrial Estate",
    site_address: "",
    survey_plot_number: "Plot No. E-42",
    total_area_sqm: 10000,
    built_up_area_sqm: 5000,
    power_load_kw: 350,
    water_consumption_kld: 20,
    effluent_discharge_kld: 15,
    pollution_category: "Orange",
    workforce_count: 45,
    hazardous_waste: true,
    air_emissions: true,
  });

  // Wizard mode state for adding new facility
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Wizard Form fields
  const [wizardFacilityName, setWizardFacilityName] = useState("Chakan Industrial Plant - Unit 2");
  const [wizardProjectType, setWizardProjectType] = useState("New Setup");
  const [wizardSector, setWizardSector] = useState("Manufacturing / Automotive Components");
  const [wizardCompanyName, setWizardCompanyName] = useState("Apex Precision Automotive Components Pvt Ltd");
  const [wizardEntityType, setWizardEntityType] = useState("Private Limited Company");

  // Wizard Selectable activities
  const [selectedActivities, setSelectedActivities] = useState<string[]>([
    "Metal fabrication",
    "Electroplating",
    "Generate wastewater",
    "Air emissions",
  ]);
  const [otherActivityText, setOtherActivityText] = useState("");

  // Wizard Step 3 Location fields
  const [wizardLocationType, setWizardLocationType] = useState("MIDC Industrial Estate");
  const [wizardDistrict, setWizardDistrict] = useState("Pune");
  const [wizardTaluka, setWizardTaluka] = useState("Khed");
  const [wizardEstate, setWizardEstate] = useState("Chakan MIDC Phase II");
  const [wizardPlotNumber, setWizardPlotNumber] = useState("Plot No. E-42");
  const [wizardTotalArea, setWizardTotalArea] = useState("12000");
  const [wizardBuiltUpArea, setWizardBuiltUpArea] = useState("6500");
  const [wizardPowerDemand, setWizardPowerDemand] = useState("350");
  const [wizardWaterDemand, setWizardWaterDemand] = useState("20");
  const [wizardEffluentDischarge, setWizardEffluentDischarge] = useState("15");
  const [wizardPollutionCategory, setWizardPollutionCategory] = useState("Orange");
  const [wizardWorkforce, setWizardWorkforce] = useState("45");
  const [wizardHazardousWaste, setWizardHazardousWaste] = useState(true);
  const [wizardAirEmissions, setWizardAirEmissions] = useState(true);

  const [savingWizard, setSavingWizard] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

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
      const [bizList, projList] = await Promise.all([
        getBusinesses().catch(() => []),
        getProjects().catch(() => []),
      ]);
      setBusinesses(bizList);
      setProjects(projList);

      if (bizList.length > 0) {
        setSelectedBizId(bizList[0].id);
      }

      if (projList.length > 0) {
        const storedId = typeof window !== "undefined" ? localStorage.getItem("rop_active_project_id") : null;
        const matched = storedId ? projList.find((p) => p.id === Number(storedId)) : null;
        const chosen = matched || projList[0];
        setSelectedProjectId(chosen.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("rop_active_project_id", String(chosen.id));
        }
      } else if (bizList.length === 0) {
        setIsWizardMode(true);
      }
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Active records
  const currentBiz = businesses.find((b) => b.id === selectedBizId) || businesses[0] || null;
  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0] || null;

  // Sync selected project with external events (e.g. header switcher)
  useEffect(() => {
    function handleProjectSwitched(e: any) {
      if (e.detail?.projectId) {
        setSelectedProjectId(e.detail.projectId);
      }
    }
    window.addEventListener("project-switched", handleProjectSwitched);
    return () => {
      window.removeEventListener("project-switched", handleProjectSwitched);
    };
  }, []);

  function handleSelectFacility(proj: ProjectItem) {
    setSelectedProjectId(proj.id);
    if (typeof window !== "undefined") {
      localStorage.setItem("rop_active_project_id", String(proj.id));
      window.dispatchEvent(
        new CustomEvent("project-switched", { detail: { project: proj, projectId: proj.id } })
      );
    }
  }

  // --- Phase 4: Scheme & Radar Helpers ---
  useEffect(() => {
    if (currentBiz?.id) {
      loadSchemes(currentBiz.id);
    }
  }, [currentBiz?.id]);

  useEffect(() => {
    if (currentProject?.id) {
      loadRadar(currentProject.id);
    }
  }, [currentProject?.id]);

  async function loadSchemes(bizId: number) {
    setLoadingSchemes(true);
    try {
      const data = await getBusinessSchemes(bizId);
      setSchemesData(data);
    } catch {
      // ignore
    } finally {
      setLoadingSchemes(false);
    }
  }

  async function loadRadar(projId: number) {
    setLoadingRadar(true);
    try {
      const data = await getProjectRadarImpacts(projId);
      setRadarData(data);
    } catch {
      // ignore
    } finally {
      setLoadingRadar(false);
    }
  }

  async function handleToggleSchemeQuestion(key: string, value: any) {
    const newAnswers = { ...schemeAnswers, [key]: value };
    setSchemeAnswers(newAnswers);
    if (!currentBiz?.id) return;
    try {
      const updated = await interactiveSchemeAssessment(currentBiz.id, newAnswers);
      setSchemesData(updated);
    } catch (e) {
      console.error("Interactive assessment error:", e);
    }
  }


  // --- Company Modal Handlers ---
  function openCompanyEditModal() {
    if (!currentBiz) return;
    setCompanyForm({
      name: currentBiz.name || "",
      entity_type: currentBiz.entity_type || "Private Limited Company",
      registration_number: currentBiz.registration_number || "",
      pan_number: currentBiz.pan_number || "",
      gstin: currentBiz.gstin || "",
      contact_email: currentBiz.contact_email || "",
      contact_phone: currentBiz.contact_phone || "",
      registered_office_address: currentBiz.registered_office_address || "",
    });
    setCompanyError(null);
    setIsEditingCompany(true);
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!currentBiz) return;
    setSavingCompany(true);
    setCompanyError(null);
    try {
      const updated = await updateBusiness(currentBiz.id, companyForm);
      setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setIsEditingCompany(false);
      setFeedbackMessage("Company Master Information updated successfully.");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setCompanyError(err.response?.data?.detail || "Failed to update company master.");
    } finally {
      setSavingCompany(false);
    }
  }

  // --- Facility Modal Handlers ---
  function openFacilityEditModal() {
    if (!currentProject) return;
    setFacilityForm({
      name: currentProject.name || "",
      project_type: currentProject.project_type || "New Setup",
      district: currentProject.district || "Pune",
      taluka: currentProject.taluka || "Khed",
      industrial_zone: currentProject.industrial_zone || "Chakan MIDC Phase II",
      location_type: currentProject.location_type || "MIDC Industrial Estate",
      site_address: currentProject.site_address || "",
      survey_plot_number: currentProject.survey_plot_number || "Plot No. E-42",
      total_area_sqm: currentProject.total_area_sqm || 10000,
      built_up_area_sqm: currentProject.built_up_area_sqm || 5000,
      power_load_kw: currentProject.power_load_kw || 350,
      water_consumption_kld: currentProject.water_consumption_kld || 20,
      effluent_discharge_kld: currentProject.effluent_discharge_kld || 15,
      pollution_category: currentProject.pollution_category || "Orange",
      workforce_count: currentProject.workforce_count || 45,
      hazardous_waste: currentProject.hazardous_waste ?? true,
      air_emissions: currentProject.air_emissions ?? true,
    });
    setFacilityError(null);
    setIsEditingFacility(true);
  }

  async function handleSaveFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProject) return;
    setSavingFacility(true);
    setFacilityError(null);
    try {
      const updated = await updateProject(currentProject.id, facilityForm);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setIsEditingFacility(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("project-updated", { detail: { project: updated, projectId: updated.id } })
        );
      }
      setFeedbackMessage("Facility specifications updated successfully.");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFacilityError(err.response?.data?.detail || "Failed to update facility specifications.");
    } finally {
      setSavingFacility(false);
    }
  }

  // --- Wizard Activity Toggling ---
  function toggleActivity(activityName: string) {
    setSelectedActivities((prev) =>
      prev.includes(activityName)
        ? prev.filter((a) => a !== activityName)
        : [...prev, activityName]
    );
  }

  // --- Wizard Submit (Add Facility / Create Business) ---
  async function handleWizardSubmit() {
    setSavingWizard(true);
    setWizardError(null);
    try {
      let bizId = selectedBizId;

      // If no business exists, create business first
      if (!bizId) {
        const createdBiz = await createBusiness(
          wizardCompanyName.trim(),
          `Industrial enterprise: ${wizardSector}. Legal form: ${wizardEntityType}.`,
          {
            entity_type: wizardEntityType,
            registered_office_address: "Maharashtra, India",
          }
        );
        bizId = createdBiz.id;
        setSelectedBizId(bizId);
      }

      // Create new project facility under this business
      const allActivities = [...selectedActivities];
      if (otherActivityText.trim() && !allActivities.includes(otherActivityText.trim())) {
        allActivities.push(otherActivityText.trim());
      }

      const desc = `${wizardProjectType} industrial facility: ${allActivities.join(", ")}. Located at ${wizardEstate}, ${wizardDistrict}.`;

      const newProj = await createProject({
        business_id: bizId,
        name: wizardFacilityName.trim(),
        description: desc,
        project_type: wizardProjectType,
        sector: wizardSector,
        district: wizardDistrict,
        taluka: wizardTaluka,
        industrial_zone: wizardEstate,
        location_type: wizardLocationType,
        survey_plot_number: wizardPlotNumber,
        total_area_sqm: Number(wizardTotalArea) || 10000,
        built_up_area_sqm: Number(wizardBuiltUpArea) || 5000,
        power_load_kw: Number(wizardPowerDemand) || 350,
        water_consumption_kld: Number(wizardWaterDemand) || 20,
        effluent_discharge_kld: Number(wizardEffluentDischarge) || 15,
        pollution_category: wizardPollutionCategory,
        workforce_count: Number(wizardWorkforce) || 45,
        hazardous_waste: wizardHazardousWaste,
        air_emissions: wizardAirEmissions,
        activities: allActivities,
      });

      await loadData();
      handleSelectFacility(newProj);
      setIsWizardMode(false);
      setFeedbackMessage(`Establishment "${newProj.name}" created successfully.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setWizardError(err.response?.data?.detail || "Failed to create new establishment.");
    } finally {
      setSavingWizard(false);
    }
  }

  if (!user) return null;

  return (
    <ApplicantLayout
      title="Business Profile & Workspace"
      subtitle="Corporate entity master record and individual industrial establishment profiles"
      breadcrumbs={[
        { label: "Home", href: "/applicant/dashboard" },
        { label: "My Project", href: "/applicant/project" },
        ...(isWizardMode ? [{ label: "Add Facility" }] : [{ label: currentProject?.name || "Workspace" }]),
      ]}
    >
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* WIZARD MODE: Add Facility / Create Establishment Flow     */}
      {/* ========================================================= */}
      {isWizardMode ? (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Add New Industrial Establishment
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Register facility specifications to identify applicable Maharashtra statutory approvals.
              </p>
            </div>
            {projects.length > 0 && (
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
            {/* Step Navigation Sidebar */}
            <div className="md:col-span-4 bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">
                Setup Progress
              </div>

              <div className="space-y-1">
                {[
                  { step: 1, label: "Basic Details" },
                  { step: 2, label: "Industrial Activities" },
                  { step: 3, label: "Location & Operational Load" },
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
                <span className="font-semibold text-gray-700">Deterministic Engine:</span> Data maps directly to state acts and clearances without manual ambiguity.
              </div>
            </div>

            {/* Form Panels for Each Step */}
            <div className="md:col-span-8 bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
              {/* STEP 1: Basic Details */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Establishment Overview</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enter facility identifier and primary industrial sector.
                    </p>
                  </div>

                  {/* If no company exists yet, prompt for company details as well */}
                  {businesses.length === 0 && (
                    <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-3">
                      <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-blue-700" />
                        Company Master Info (Legal Parent Entity)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">Legal Company Name *</Label>
                          <Input
                            value={wizardCompanyName}
                            onChange={(e) => setWizardCompanyName(e.target.value)}
                            placeholder="Apex Precision Automotive Components Pvt Ltd"
                            className="mt-1 text-xs h-9 bg-white"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">Entity Type *</Label>
                          <select
                            value={wizardEntityType}
                            onChange={(e) => setWizardEntityType(e.target.value)}
                            className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                          >
                            <option value="Private Limited Company">Private Limited Company</option>
                            <option value="Public Limited Company">Public Limited Company</option>
                            <option value="Limited Liability Partnership (LLP)">LLP</option>
                            <option value="Partnership Firm">Partnership Firm</option>
                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="facility-name" className="text-xs font-semibold text-gray-700">
                        Establishment / Facility Name <span className="text-rose-600">*</span>
                      </Label>
                      <Input
                        id="facility-name"
                        value={wizardFacilityName}
                        onChange={(e) => setWizardFacilityName(e.target.value)}
                        placeholder="e.g. Chakan Industrial Plant - Unit 2"
                        className="mt-1 text-xs h-9"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="wizard-project-type" className="text-xs font-semibold text-gray-700">
                          Project Nature <span className="text-rose-600">*</span>
                        </Label>
                        <select
                          id="wizard-project-type"
                          value={wizardProjectType}
                          onChange={(e) => setWizardProjectType(e.target.value)}
                          className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                        >
                          <option value="New Setup">New Setup (Greenfield Project)</option>
                          <option value="Expansion">Expansion of Existing Capacity</option>
                          <option value="Modernization">Modernization / Diversification</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="wizard-sector" className="text-xs font-semibold text-gray-700">
                          Industry Sector <span className="text-rose-600">*</span>
                        </Label>
                        <select
                          id="wizard-sector"
                          value={wizardSector}
                          onChange={(e) => setWizardSector(e.target.value)}
                          className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                        >
                          <option value="Manufacturing / Automotive Components">Automotive Components</option>
                          <option value="General Manufacturing">General Manufacturing</option>
                          <option value="Chemical & Petrochemical">Chemical & Petrochemical</option>
                          <option value="Electronics & IT Hardware">Electronics & IT Hardware</option>
                          <option value="Food Processing">Food Processing</option>
                          <option value="Pharmaceuticals">Pharmaceuticals</option>
                          <option value="Textiles">Textiles & Garments</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    {projects.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsWizardMode(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    ) : <div />}
                    <Button
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      disabled={!wizardFacilityName.trim()}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
                    >
                      Next: Industrial Activities →
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: Activities */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-2 border-b border-gray-100">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">What will this facility do?</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Select operational activities to determine MPCB and Factory Inspectorate requirements.
                      </p>
                    </div>

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

                  {/* Manufacturing Processes */}
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

                  {/* Emissions & Waste */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Emissions & Effluent
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

                  {/* Materials & Storage */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Materials & Storage
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { name: "Chemical storage", icon: Boxes },
                        { name: "Fuel storage", icon: Flame },
                        { name: "Boiler operations", icon: Zap },
                        { name: "Heavy machinery machining", icon: Wrench },
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
                      Next: Location & Load →
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Location & Load */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Location, Plot & Environmental Load</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Specify site coordinates and resource demands for MPCB siting criteria.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-gray-700">District (Maharashtra)</Label>
                      <select
                        value={wizardDistrict}
                        onChange={(e) => setWizardDistrict(e.target.value)}
                        className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                      >
                        <option value="Pune">Pune</option>
                        <option value="Thane">Thane</option>
                        <option value="Raigad">Raigad</option>
                        <option value="Aurangabad">Aurangabad (Chhatrapati Sambhajinagar)</option>
                        <option value="Nagpur">Nagpur</option>
                        <option value="Nashik">Nashik</option>
                        <option value="Kolhapur">Kolhapur</option>
                        <option value="Solapur">Solapur</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Taluka / Sub-division</Label>
                      <Input
                        value={wizardTaluka}
                        onChange={(e) => setWizardTaluka(e.target.value)}
                        placeholder="e.g. Khed"
                        className="mt-1 text-xs h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Industrial Zone / Estate</Label>
                      <Input
                        value={wizardEstate}
                        onChange={(e) => setWizardEstate(e.target.value)}
                        placeholder="e.g. Chakan MIDC Phase II"
                        className="mt-1 text-xs h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Plot / Survey Number</Label>
                      <Input
                        value={wizardPlotNumber}
                        onChange={(e) => setWizardPlotNumber(e.target.value)}
                        placeholder="e.g. Plot No. E-42"
                        className="mt-1 text-xs h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Total Land Area (sq.m)</Label>
                      <Input
                        type="number"
                        value={wizardTotalArea}
                        onChange={(e) => setWizardTotalArea(e.target.value)}
                        placeholder="12000"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Built-up Area (sq.m)</Label>
                      <Input
                        type="number"
                        value={wizardBuiltUpArea}
                        onChange={(e) => setWizardBuiltUpArea(e.target.value)}
                        placeholder="6500"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Connected Power Demand (kW)</Label>
                      <Input
                        type="number"
                        value={wizardPowerDemand}
                        onChange={(e) => setWizardPowerDemand(e.target.value)}
                        placeholder="350"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Daily Water Demand (KLD)</Label>
                      <Input
                        type="number"
                        value={wizardWaterDemand}
                        onChange={(e) => setWizardWaterDemand(e.target.value)}
                        placeholder="20"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Trade Effluent (KLD)</Label>
                      <Input
                        type="number"
                        value={wizardEffluentDischarge}
                        onChange={(e) => setWizardEffluentDischarge(e.target.value)}
                        placeholder="15"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Pollution Category (MPCB)</Label>
                      <select
                        value={wizardPollutionCategory}
                        onChange={(e) => setWizardPollutionCategory(e.target.value)}
                        className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                      >
                        <option value="Red">Red Category (Heavily Polluting)</option>
                        <option value="Orange">Orange Category (Moderately Polluting)</option>
                        <option value="Green">Green Category (Low Polluting)</option>
                        <option value="White">White Category (Non-Polluting)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-700">Proposed Workforce (Workers)</Label>
                      <Input
                        type="number"
                        value={wizardWorkforce}
                        onChange={(e) => setWizardWorkforce(e.target.value)}
                        placeholder="45"
                        className="mt-1 text-xs h-9 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-4 pt-5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizardHazardousWaste}
                          onChange={(e) => setWizardHazardousWaste(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Hazardous Waste
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizardAirEmissions}
                          onChange={(e) => setWizardAirEmissions(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Chimney Stacks / Emissions
                      </label>
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
                    <h2 className="text-base font-bold text-gray-900">Review & Confirm Establishment</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Verify parameters before provisioning into your multi-facility workspace.
                    </p>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                      <div className="font-bold text-gray-900 text-sm flex items-center justify-between">
                        <span>{wizardFacilityName}</span>
                        <span className="text-xs font-semibold text-blue-700">{wizardProjectType}</span>
                      </div>
                      <div className="text-gray-600">
                        <MapPin className="h-3.5 w-3.5 inline mr-1 text-gray-400" />
                        {wizardPlotNumber}, {wizardEstate}, {wizardTaluka}, {wizardDistrict}
                      </div>
                      <div className="text-gray-500 text-[11px]">
                        Parent Company: <span className="font-semibold text-gray-800">{currentBiz ? currentBiz.name : wizardCompanyName}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1.5">
                      <div className="font-bold text-blue-950">Industrial Activities ({selectedActivities.length}):</div>
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-lg border border-gray-200 bg-white">
                        <div className="text-gray-500 text-[11px]">Connected Power</div>
                        <div className="text-xs font-bold text-gray-900 font-mono mt-0.5">{wizardPowerDemand} kW</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-gray-200 bg-white">
                        <div className="text-gray-500 text-[11px]">Water / Effluent</div>
                        <div className="text-xs font-bold text-gray-900 font-mono mt-0.5">{wizardWaterDemand} / {wizardEffluentDischarge} KLD</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-gray-200 bg-white">
                        <div className="text-gray-500 text-[11px]">Pollution Siting</div>
                        <div className="text-xs font-bold text-amber-700 font-mono mt-0.5">{wizardPollutionCategory} Category</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-gray-200 bg-white">
                        <div className="text-gray-500 text-[11px]">Workforce Size</div>
                        <div className="text-xs font-bold text-gray-900 font-mono mt-0.5">{wizardWorkforce} Staff</div>
                      </div>
                    </div>
                  </div>

                  {wizardError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {wizardError}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(3)}
                      disabled={savingWizard}
                      className="text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleWizardSubmit}
                      disabled={savingWizard || !wizardFacilityName.trim()}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-5 h-9 font-semibold"
                    >
                      {savingWizard ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Creating Establishment...
                        </>
                      ) : (
                        "Confirm & Create Establishment →"
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
        /* DEFAULT VIEW: Multi-Facility Workspace & Master Record   */
        /* ========================================================= */
        <div className="space-y-6">
          {/* Top Actions & Multi-Facility Tab Switcher */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  Industrial Establishment Workspace
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select a facility to inspect site specifications and track departmental clearances.
                </p>
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
                  Add Facility
                </Button>
              </div>
            </div>

            {/* Facility Selector Tabs */}
            {projects.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                {projects.map((proj) => {
                  const isSelected = proj.id === selectedProjectId;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectFacility(proj)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-600 text-blue-950 ring-1 ring-blue-600 shadow-2xs font-semibold"
                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <Factory className={`h-3.5 w-3.5 ${isSelected ? "text-blue-700" : "text-gray-400"}`} />
                      <span>{proj.name}</span>
                      <span className="text-[10px] text-gray-400">({proj.district || "MH"})</span>
                      {proj.pollution_category && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            proj.pollution_category === "Red"
                              ? "bg-rose-100 text-rose-800"
                              : proj.pollution_category === "Orange"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {proj.pollution_category}
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setIsWizardMode(true);
                    setCurrentStep(1);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/40 transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Facility
                </button>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 1: Company Master Information (Shared Corporate)  */}
          {/* ========================================================= */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">
                    Company Master Information
                  </h2>
                  <StatusBadge status="VERIFIED" />
                </div>
                <p className="text-xs text-gray-500">
                  Shared legal entity master record applicable to all industrial facilities and statutory applications.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={openCompanyEditModal}
                className="text-xs border-gray-300 text-gray-700 hover:bg-gray-50 shrink-0"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                Edit Company Master
              </Button>
            </div>

            {currentBiz ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">Legal Entity Name</span>
                  <span className="font-bold text-gray-900 block truncate" title={currentBiz.name}>
                    {currentBiz.name}
                  </span>
                  <span className="text-[10px] text-blue-700 font-medium">
                    {currentBiz.entity_type || "Private Limited Company"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">CIN / Registration No.</span>
                  <span className="font-mono font-bold text-gray-900 block truncate">
                    {currentBiz.registration_number || "U29253PN2021PTC198421"}
                  </span>
                  <span className="text-[10px] text-gray-500">MCA Registered</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">Permanent Account No. (PAN)</span>
                  <span className="font-mono font-bold text-gray-900 block">
                    {currentBiz.pan_number || "AAACB1234F"}
                  </span>
                  <span className="text-[10px] text-gray-500">Income Tax Dept</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">GST Identification (GSTIN)</span>
                  <span className="font-mono font-bold text-gray-900 block truncate">
                    {currentBiz.gstin || "27AAACB1234F1Z5"}
                  </span>
                  <span className="text-[10px] text-gray-500">Maharashtra State (27)</span>
                </div>

                <div className="sm:col-span-2 p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">Registered Corporate Office</span>
                  <span className="text-gray-800 font-medium block">
                    {currentBiz.registered_office_address || "Plot No. 12, Senapati Bapat Road, Shivaji Nagar, Pune, Maharashtra 411016"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">Official Contact Email</span>
                  <span className="text-gray-800 font-medium block truncate">
                    {currentBiz.contact_email || "compliance@apexprecision.com"}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50/60 border border-gray-100 space-y-1">
                  <span className="text-gray-400 text-[11px] block">Corporate Phone</span>
                  <span className="font-mono text-gray-800 font-medium block">
                    {currentBiz.contact_phone || "+91 20 2567 8900"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No corporate master information recorded.</p>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: Facility & Site Specifications                 */}
          {/* ========================================================= */}
          {currentProject ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
              {/* Facility Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      <Factory className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900">{currentProject.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {currentProject.project_type || "Greenfield Setup"}
                    </span>
                    <StatusBadge status="DEMO" />
                  </div>
                  <p className="text-xs text-gray-600 max-w-2xl leading-relaxed">
                    {currentProject.description || "Operational manufacturing facility specifications and statutory siting parameters."}
                  </p>
                  <div className="text-[11px] text-gray-400 font-mono">
                    Facility ID: #{currentProject.id} • Attached to Business #{currentProject.business_id}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openFacilityEditModal}
                    className="text-xs border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                    Edit Specifications
                  </Button>

                  <Link href="/applicant/approvals">
                    <Button size="sm" className="text-xs bg-blue-700 hover:bg-blue-800 text-white">
                      <Search className="h-3.5 w-3.5 mr-1.5" />
                      Find Approvals
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Three Specification Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Column 1: Site & Location Details */}
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-3">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
                    <MapPin className="h-4 w-4 text-blue-700" />
                    Location & Land Specifications
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">District:</span>
                      <span className="font-semibold text-gray-900 text-right">{currentProject.district || "Pune"}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Taluka:</span>
                      <span className="font-semibold text-gray-900 text-right">{currentProject.taluka || "Khed"}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Industrial Zone:</span>
                      <span className="font-semibold text-gray-900 text-right">{currentProject.industrial_zone || "Chakan MIDC Phase II"}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Zoning Classification:</span>
                      <span className="font-semibold text-gray-900 text-right">{currentProject.location_type || "MIDC Industrial Estate"}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Survey / Plot No:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">{currentProject.survey_plot_number || "Plot No. E-42"}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Total Land Area:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">
                        {(currentProject.total_area_sqm || 10000).toLocaleString()} sq.m
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Built-up Floor Area:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">
                        {(currentProject.built_up_area_sqm || 5000).toLocaleString()} sq.m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Utility & Environmental Load */}
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-3">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
                    <Zap className="h-4 w-4 text-amber-700" />
                    Utilities & Environmental Load
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Connected Power Demand:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">
                        {currentProject.power_load_kw || 350} kW (MSEDCL Feeder)
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Water Consumption:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">
                        {currentProject.water_consumption_kld || 20} KLD
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Trade Effluent Discharge:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">
                        {currentProject.effluent_discharge_kld || 15} KLD (CETP Connected)
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Pollution Category (MPCB):</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          currentProject.pollution_category === "Red"
                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                            : currentProject.pollution_category === "Orange"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {currentProject.pollution_category || "Orange"} Category Siting
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Hazardous Waste Generation:</span>
                      <span className="font-semibold text-gray-900">
                        {currentProject.hazardous_waste ? "Yes (Schedule I)" : "No"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Air Emissions / Stacks:</span>
                      <span className="font-semibold text-gray-900">
                        {currentProject.air_emissions ? "Yes (DG Set & Process)" : "None"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Proposed Workforce:</span>
                      <span className="font-mono font-semibold text-gray-900 text-right">
                        {currentProject.workforce_count || 45} Workers (DISHL Mandated)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Industrial Activities */}
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 space-y-3">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
                    <Layers className="h-4 w-4 text-purple-700" />
                    Industrial Activities & Processes
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed">
                    Mapped operations evaluated against Maharashtra pollution classification lists:
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(currentProject.activities && currentProject.activities.length > 0
                      ? currentProject.activities
                      : ["Metal fabrication", "Electroplating", "Generate wastewater", "Air emissions"]
                    ).map((act) => (
                      <span
                        key={act}
                        className="px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-800 text-xs font-medium shadow-2xs"
                      >
                        {act}
                      </span>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-gray-200/60 mt-3 text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">Clearances Triggered:</span> MPCB Consent to Establish (CTE), DISHL Factory License, MIDC Water & Drainage, MSEDCL HT Connection.
                  </div>
                </div>
              </div>

              {/* Action Quick Bar */}
              <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-gray-500">
                  Ready to proceed with statutory permissions for <span className="font-semibold text-gray-800">{currentProject.name}</span>?
                </div>

                <div className="flex items-center gap-2">
                  <Link href="/applicant/dashboard">
                    <Button variant="outline" size="sm" className="text-xs">
                      View Facility Dashboard
                    </Button>
                  </Link>
                  <Link href="/applicant/approvals">
                    <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs">
                      Run Statutory Discovery <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 3: Government Scheme & Incentive Assistant (PSI)   */}
            {/* ========================================================= */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      <Award className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900">
                      Government Scheme & Incentive Eligibility Assistant
                    </h2>
                    <StatusBadge status="DEMO" />
                  </div>
                  <p className="text-xs text-gray-500">
                    Automated matching against Maharashtra Package Scheme of Incentives (PSI 2019) and state industrial subsidies.
                  </p>
                </div>

                <div className="text-right sm:text-right shrink-0">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Total Potential Benefit</div>
                  <div className="text-base font-mono font-extrabold text-emerald-700">
                    ₹{(schemesData?.total_potential_benefit_inr || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* Interactive Questionnaire Controls */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Interactive Scenario Modeler (In-Memory Assessment)
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Changes re-evaluate eligibility without modifying verified master data
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Captive Solar */}
                  <div className="p-2.5 rounded-lg bg-white border border-gray-200 space-y-1.5">
                    <Label className="text-[11px] font-semibold text-gray-700">Captive Solar Plant</Label>
                    <select
                      value={schemeAnswers.captive_solar_kw || 0}
                      onChange={(e) => handleToggleSchemeQuestion("captive_solar_kw", Number(e.target.value))}
                      className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white"
                    >
                      <option value={0}>None (0 kW)</option>
                      <option value={50}>50 kW Rooftop</option>
                      <option value={100}>100 kW Rooftop</option>
                      <option value={250}>250 kW Ground-mounted</option>
                    </select>
                  </div>

                  {/* Zero Liquid Discharge */}
                  <div className="p-2.5 rounded-lg bg-white border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-gray-700">ZLD System</div>
                      <div className="text-[10px] text-gray-400">Zero Liquid Discharge</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!schemeAnswers.has_zld}
                      onChange={(e) => handleToggleSchemeQuestion("has_zld", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* Women / SC / ST Equity */}
                  <div className="p-2.5 rounded-lg bg-white border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-gray-700">Special Category</div>
                      <div className="text-[10px] text-gray-400">&gt;51% Women/SC/ST</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!schemeAnswers.women_or_sc_st_promoter}
                      onChange={(e) => handleToggleSchemeQuestion("women_or_sc_st_promoter", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* MSME Category */}
                  <div className="p-2.5 rounded-lg bg-white border border-gray-200 space-y-1.5">
                    <Label className="text-[11px] font-semibold text-gray-700">Enterprise Scale</Label>
                    <select
                      value={schemeAnswers.msme_category || "Small"}
                      onChange={(e) => handleToggleSchemeQuestion("msme_category", e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white"
                    >
                      <option value="Micro">Micro Enterprise</option>
                      <option value="Small">Small Enterprise</option>
                      <option value="Medium">Medium Enterprise</option>
                      <option value="Large">Large Unit</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scheme Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2">
                {[
                  { id: "ALL", label: `All Schemes (${schemesData?.schemes.length || 0})` },
                  {
                    id: "POTENTIALLY_ELIGIBLE",
                    label: `Potentially Eligible (${schemesData?.schemes.filter(s => s.eligibility_bucket === "POTENTIALLY_ELIGIBLE").length || 0})`,
                  },
                  {
                    id: "NEEDS_MORE_INFO",
                    label: `Needs More Info (${schemesData?.schemes.filter(s => s.eligibility_bucket === "NEEDS_MORE_INFO").length || 0})`,
                  },
                  {
                    id: "NOT_MATCHED",
                    label: `Not Matched (${schemesData?.schemes.filter(s => s.eligibility_bucket === "NOT_MATCHED").length || 0})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSchemeFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      schemeFilter === tab.id
                        ? "bg-blue-700 text-white shadow-2xs"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Schemes Cards Grid */}
              {loadingSchemes ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-blue-600" />
                  Evaluating scheme rules...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(schemesData?.schemes || [])
                    .filter((s) => schemeFilter === "ALL" || s.eligibility_bucket === schemeFilter)
                    .map((scheme) => {
                      const isEligible = scheme.eligibility_bucket === "POTENTIALLY_ELIGIBLE";
                      const isNeedsInfo = scheme.eligibility_bucket === "NEEDS_MORE_INFO";

                      return (
                        <div
                          key={scheme.scheme_id}
                          className={`p-4 rounded-xl border text-xs space-y-3 transition-shadow hover:shadow-xs ${
                            isEligible
                              ? "bg-emerald-50/20 border-emerald-300"
                              : isNeedsInfo
                              ? "bg-amber-50/20 border-amber-300"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="font-bold text-gray-900 text-sm">{scheme.name}</div>
                              <div className="text-[10px] text-gray-500">
                                {scheme.department} • <span className="font-mono">{scheme.scheme_id}</span>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 border ${
                                isEligible
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : isNeedsInfo
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {scheme.eligibility_bucket.replace(/_/g, " ")}
                            </span>
                          </div>

                          <p className="text-gray-600 leading-relaxed text-[11px]">
                            {scheme.description}
                          </p>

                          <div className="p-2.5 rounded-lg bg-white border border-gray-200 flex items-center justify-between">
                            <span className="text-gray-500 text-[11px]">Maximum Benefit:</span>
                            <span className="font-mono font-bold text-emerald-700 text-xs">
                              {scheme.max_benefit_description}
                            </span>
                          </div>

                          {/* Criteria Breakdown */}
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-gray-800">Criteria Evaluation Breakdown:</div>
                            <div className="space-y-1">
                              {scheme.criteria_breakdown?.matched.map((m, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-emerald-800 text-[11px]">
                                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{m}</span>
                                </div>
                              ))}
                              {scheme.criteria_breakdown?.failed.map((f, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-rose-700 text-[11px]">
                                  <X className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                                  <span>{f}</span>
                                </div>
                              ))}
                              {scheme.criteria_breakdown?.unknown.map((u, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-amber-800 text-[11px]">
                                  <HelpCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{u}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Missing Evidence & Next Steps */}
                          {scheme.missing_evidence && scheme.missing_evidence.length > 0 && (
                            <div className="pt-2 border-t border-gray-100 text-[11px]">
                              <span className="font-semibold text-gray-700">Required Proof: </span>
                              <span className="text-gray-500">{scheme.missing_evidence.join(", ")}</span>
                            </div>
                          )}

                          {scheme.suggested_next_steps && scheme.suggested_next_steps.length > 0 && (
                            <div className="text-[11px] text-blue-800 bg-blue-50/60 p-2 rounded border border-blue-100">
                              <span className="font-bold">Next Step: </span>
                              {scheme.suggested_next_steps[0]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Statutory Subsidy Disclaimer:</strong> {schemesData?.disclaimer || "All incentive calculations are DEMO models for demonstration only. Actual disbursements require formal sanction under Maharashtra PSI guidelines."}
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: Regulatory Change Impact Radar                  */}
            {/* ========================================================= */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                      <Radio className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900">
                      Regulatory Change Impact Radar
                    </h2>
                    <StatusBadge status="DEMO" />
                  </div>
                  <p className="text-xs text-gray-500">
                    Continuous surveillance of state environmental notifications, DISH factory rules, and industrial policy amendments.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-bold text-xs">
                    {radarData?.potentially_affected_count || 0} Affected
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs">
                    {radarData?.needs_review_count || 0} Needs Review
                  </span>
                </div>
              </div>

              {/* Radar Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2">
                {[
                  { id: "ALL", label: `All Changes (${radarData?.total_changes_evaluated || 0})` },
                  { id: "AFFECTED", label: `Potentially Affected (${radarData?.potentially_affected_count || 0})` },
                  { id: "NEEDS_REVIEW", label: `Needs Review (${radarData?.needs_review_count || 0})` },
                  { id: "NO_MATCH", label: `No Match (${radarData?.no_match_count || 0})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRadarFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      radarFilter === tab.id
                        ? "bg-blue-700 text-white shadow-2xs"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Change Impact Cards */}
              {loadingRadar ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-blue-600" />
                  Scanning regulatory registry...
                </div>
              ) : (
                <div className="space-y-3.5">
                  {[
                    ...(radarData?.potentially_affected || []),
                    ...(radarData?.needs_review || []),
                    ...(radarData?.no_match || []),
                  ]
                    .filter((impact) => {
                      if (radarFilter === "ALL") return true;
                      if (radarFilter === "AFFECTED") return impact.impact_level === "POTENTIALLY_AFFECTED";
                      if (radarFilter === "NEEDS_REVIEW") return impact.impact_level === "NEEDS_REVIEW";
                      if (radarFilter === "NO_MATCH") return impact.impact_level === "NO_MATCH";
                      return true;
                    })
                    .map((impact) => {
                      const isAffected = impact.impact_level === "POTENTIALLY_AFFECTED";
                      const isNeedsReview = impact.impact_level === "NEEDS_REVIEW";

                      return (
                        <div
                          key={impact.id}
                          className={`p-4 rounded-xl border text-xs space-y-2.5 transition-colors ${
                            isAffected
                              ? "bg-rose-50/20 border-rose-300"
                              : isNeedsReview
                              ? "bg-amber-50/20 border-amber-300"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200">
                                  {impact.change_code}
                                </span>
                                <span className="font-bold text-gray-900 text-sm">
                                  {impact.change_title}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Issuing Authority: <strong className="text-gray-700">{impact.issuing_authority}</strong> • Status: {impact.verification_status}
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 border ${
                                isAffected
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : isNeedsReview
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {impact.impact_level.replace(/_/g, " ")}
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-white/90 border border-gray-200 space-y-1.5">
                            <div className="font-bold text-gray-800 text-[11px] flex items-center gap-1.5">
                              <Info className="h-3.5 w-3.5 text-blue-600" />
                              Facility Matching Explanation:
                            </div>
                            <p className="text-gray-600 leading-relaxed text-[11px]">
                              {impact.explanation}
                            </p>
                          </div>

                          {impact.recommended_action && (
                            <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-200 text-blue-950 text-[11px] font-medium flex items-start gap-1.5">
                              <span className="font-bold shrink-0">Recommended Operational Action:</span>
                              <span>{impact.recommended_action}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                            <div>
                              Officer Scrutiny Status:{" "}
                              <span className="font-bold text-gray-700 uppercase">
                                {impact.review_status}
                              </span>
                              {impact.review_notes && (
                                <span className="italic text-gray-500 ml-1">
                                  (&ldquo;{impact.review_notes}&rdquo;)
                                </span>
                              )}
                            </div>
                            <span>DEMO Regulatory Record</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <strong>Official Gazette Notice:</strong> {radarData?.disclaimer || "Regulatory change notifications are simulated demo models. Departmental directives must be cross-checked on the Maharashtra Government portal."}
              </div>
            </div>
          </>
        ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
              <Factory className="h-8 w-8 text-gray-400 mx-auto" />
              <div className="text-sm font-bold text-gray-900">No Industrial Establishment Configured</div>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Create your first manufacturing plant or site establishment to determine necessary statutory approvals.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setIsWizardMode(true);
                  setCurrentStep(1);
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Establishment
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Edit Company Master Information                    */}
      {/* ========================================================= */}
      {isEditingCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveCompany}>
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Edit Company Master Profile
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Update permanent legal entity details shared across all industrial projects.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingCompany(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {companyError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {companyError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-gray-700">Legal Company Name *</Label>
                    <Input
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      required
                      className="mt-1 text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Entity Type</Label>
                    <select
                      value={companyForm.entity_type}
                      onChange={(e) => setCompanyForm({ ...companyForm, entity_type: e.target.value })}
                      className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      <option value="Private Limited Company">Private Limited Company</option>
                      <option value="Public Limited Company">Public Limited Company</option>
                      <option value="Limited Liability Partnership (LLP)">LLP</option>
                      <option value="Partnership Firm">Partnership Firm</option>
                      <option value="Sole Proprietorship">Sole Proprietorship</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">CIN / Registration No.</Label>
                    <Input
                      value={companyForm.registration_number}
                      onChange={(e) => setCompanyForm({ ...companyForm, registration_number: e.target.value })}
                      placeholder="e.g. U29253PN2021PTC198421"
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">PAN Number</Label>
                    <Input
                      value={companyForm.pan_number}
                      onChange={(e) => setCompanyForm({ ...companyForm, pan_number: e.target.value })}
                      placeholder="e.g. AAACB1234F"
                      className="mt-1 text-xs h-9 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">GSTIN</Label>
                    <Input
                      value={companyForm.gstin}
                      onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                      placeholder="e.g. 27AAACB1234F1Z5"
                      className="mt-1 text-xs h-9 font-mono uppercase"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-gray-700">Registered Office Address</Label>
                    <Input
                      value={companyForm.registered_office_address}
                      onChange={(e) => setCompanyForm({ ...companyForm, registered_office_address: e.target.value })}
                      placeholder="Corporate headquarters registered address"
                      className="mt-1 text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Contact Email</Label>
                    <Input
                      type="email"
                      value={companyForm.contact_email}
                      onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })}
                      placeholder="compliance@company.com"
                      className="mt-1 text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Contact Phone</Label>
                    <Input
                      value={companyForm.contact_phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, contact_phone: e.target.value })}
                      placeholder="+91 20 2567 8900"
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingCompany(false)}
                  disabled={savingCompany}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingCompany || !companyForm.name.trim()}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
                >
                  {savingCompany ? "Saving Changes..." : "Save Master Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Edit Facility Specifications                       */}
      {/* ========================================================= */}
      {isEditingFacility && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveFacility}>
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Edit Facility Specifications
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Modify site, zoning, and environmental parameters for {currentProject?.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingFacility(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {facilityError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {facilityError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-gray-700">Facility / Establishment Name *</Label>
                    <Input
                      value={facilityForm.name}
                      onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                      required
                      className="mt-1 text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Project Nature</Label>
                    <select
                      value={facilityForm.project_type}
                      onChange={(e) => setFacilityForm({ ...facilityForm, project_type: e.target.value })}
                      className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      <option value="New Setup">New Setup (Greenfield)</option>
                      <option value="Expansion">Expansion</option>
                      <option value="Modernization">Modernization</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">District</Label>
                    <select
                      value={facilityForm.district}
                      onChange={(e) => setFacilityForm({ ...facilityForm, district: e.target.value })}
                      className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      <option value="Pune">Pune</option>
                      <option value="Thane">Thane</option>
                      <option value="Raigad">Raigad</option>
                      <option value="Aurangabad">Aurangabad (Chhatrapati Sambhajinagar)</option>
                      <option value="Nagpur">Nagpur</option>
                      <option value="Nashik">Nashik</option>
                      <option value="Kolhapur">Kolhapur</option>
                      <option value="Solapur">Solapur</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Taluka</Label>
                    <Input
                      value={facilityForm.taluka}
                      onChange={(e) => setFacilityForm({ ...facilityForm, taluka: e.target.value })}
                      className="mt-1 text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Industrial Zone / Estate</Label>
                    <Input
                      value={facilityForm.industrial_zone}
                      onChange={(e) => setFacilityForm({ ...facilityForm, industrial_zone: e.target.value })}
                      className="mt-1 text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Survey / Plot Number</Label>
                    <Input
                      value={facilityForm.survey_plot_number}
                      onChange={(e) => setFacilityForm({ ...facilityForm, survey_plot_number: e.target.value })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Total Land Area (sq.m)</Label>
                    <Input
                      type="number"
                      value={facilityForm.total_area_sqm}
                      onChange={(e) => setFacilityForm({ ...facilityForm, total_area_sqm: Number(e.target.value) })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Built-up Area (sq.m)</Label>
                    <Input
                      type="number"
                      value={facilityForm.built_up_area_sqm}
                      onChange={(e) => setFacilityForm({ ...facilityForm, built_up_area_sqm: Number(e.target.value) })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Connected Power Demand (kW)</Label>
                    <Input
                      type="number"
                      value={facilityForm.power_load_kw}
                      onChange={(e) => setFacilityForm({ ...facilityForm, power_load_kw: Number(e.target.value) })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Water Consumption (KLD)</Label>
                    <Input
                      type="number"
                      value={facilityForm.water_consumption_kld}
                      onChange={(e) => setFacilityForm({ ...facilityForm, water_consumption_kld: Number(e.target.value) })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Trade Effluent Discharge (KLD)</Label>
                    <Input
                      type="number"
                      value={facilityForm.effluent_discharge_kld}
                      onChange={(e) => setFacilityForm({ ...facilityForm, effluent_discharge_kld: Number(e.target.value) })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Pollution Category (MPCB)</Label>
                    <select
                      value={facilityForm.pollution_category}
                      onChange={(e) => setFacilityForm({ ...facilityForm, pollution_category: e.target.value })}
                      className="w-full mt-1 text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      <option value="Red">Red Category</option>
                      <option value="Orange">Orange Category</option>
                      <option value="Green">Green Category</option>
                      <option value="White">White Category</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-gray-700">Workforce (Persons)</Label>
                    <Input
                      type="number"
                      value={facilityForm.workforce_count}
                      onChange={(e) => setFacilityForm({ ...facilityForm, workforce_count: Number(e.target.value) })}
                      className="mt-1 text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={facilityForm.hazardous_waste}
                        onChange={(e) => setFacilityForm({ ...facilityForm, hazardous_waste: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Hazardous Waste
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={facilityForm.air_emissions}
                        onChange={(e) => setFacilityForm({ ...facilityForm, air_emissions: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Chimney Stacks / Emissions
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingFacility(false)}
                  disabled={savingFacility}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingFacility || !facilityForm.name.trim()}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4"
                >
                  {savingFacility ? "Saving..." : "Save Specifications"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ApplicantLayout>
  );
}
