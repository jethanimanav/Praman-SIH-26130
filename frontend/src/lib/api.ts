import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("rop_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path !== "/login") {
        localStorage.removeItem("rop_token");
        localStorage.removeItem("rop_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  full_name: string;
  email: string;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);
  const response = await api.post<LoginResponse>("/api/auth/token", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

export async function getMe() {
  const response = await api.get("/api/auth/me");
  return response.data;
}

export interface BusinessItem {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  created_at: string;
}

export async function getBusinesses(): Promise<BusinessItem[]> {
  const response = await api.get<BusinessItem[]>("/api/business");
  return response.data;
}

export async function createBusiness(name: string, description?: string): Promise<BusinessItem> {
  const response = await api.post<BusinessItem>("/api/business", { name, description });
  return response.data;
}

export async function describeBusiness(businessId: number, description: string) {
  const response = await api.post(`/api/business/${businessId}/describe`, { description });
  return response.data;
}

export async function answerQuestions(businessId: number, answers: Record<string, any>) {
  const response = await api.post(`/api/business/${businessId}/answer-questions`, { answers });
  return response.data;
}

export async function confirmProfile(businessId: number, profileData: Record<string, any>) {
  const response = await api.post(`/api/business/${businessId}/confirm`, { profile_data: profileData });
  return response.data;
}

export interface DiscoveryItemUI {
  requirement_id: string;
  requirement_name: string;
  category: "Required" | "Conditional" | "Not Applicable" | "Verification Required";
  reason: string;
  rule_id: string;
  data_status: "VERIFIED" | "DEMO" | "MOCK" | "VERIFICATION_REQUIRED" | "CONFIGURATION_REQUIRED";
  department?: string;
  estimated_timeline_days?: number;
  documents: string[];
  tags: string[];
  relevant_profile_fields: Record<string, any>;
  missing_information: string[];
  next_action: string;
}

export interface RegulatoryDiscoveryUIResponse {
  business_id: number;
  business_name: string;
  total_requirements: number;
  summary_counts: Record<string, number>;
  requirements: DiscoveryItemUI[];
  missing_critical_fields: string[];
}

export async function getRegulatoryDiscovery(businessId: number): Promise<RegulatoryDiscoveryUIResponse> {
  const response = await api.get<RegulatoryDiscoveryUIResponse>(`/api/business/${businessId}/regulatory-discovery`);
  return response.data;
}

// --- M4 Workflow Interfaces & APIs ---

export interface ApprovalStepUI {
  id: number;
  application_id: number;
  requirement_id: string;
  step_name: string;
  department?: string;
  estimated_timeline_days: number;
  status: "BLOCKED" | "READY" | "IN_PROGRESS" | "APPROVED" | "REJECTED";
  data_status: "VERIFIED" | "DEMO" | "MOCK" | "VERIFICATION_REQUIRED" | "CONFIGURATION_REQUIRED";
  prerequisites: string[];
  is_critical_path: boolean;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface ApplicationDetailUI {
  id: number;
  business_id: number;
  applicant_id: number;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  total_timeline_days: number;
  critical_path_steps: string[];
  submitted_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
  steps: ApprovalStepUI[];
}

export interface WorkflowGraphUIResponse {
  application_id: number;
  application_title: string;
  application_status: string;
  total_timeline_days: number;
  critical_path_steps: string[];
  parallel_stages: string[][];
  graph: {
    nodes: Array<{
      id: string;
      position: { x: number; y: number };
      data: {
        requirement_id: string;
        label: string;
        department: string;
        duration: number;
        data_status: string;
        status: string;
        is_critical_path: boolean;
        stage: number;
        prerequisites: string[];
        dependents: string[];
      };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      animated?: boolean;
      style?: Record<string, any>;
    }>;
    parallel_stages: number;
    total_nodes: number;
  };
}

export async function createApplication(businessId: number, title?: string): Promise<ApplicationDetailUI> {
  const response = await api.post<ApplicationDetailUI>("/api/workflow/applications", {
    business_id: businessId,
    title,
  });
  return response.data;
}

export async function getApplication(applicationId: number): Promise<ApplicationDetailUI> {
  const response = await api.get<ApplicationDetailUI>(`/api/workflow/applications/${applicationId}`);
  return response.data;
}

export async function getApplications(businessId?: number): Promise<ApplicationDetailUI[]> {
  const url = businessId ? `/api/workflow/applications?business_id=${businessId}` : "/api/workflow/applications";
  const response = await api.get<ApplicationDetailUI[]>(url);
  return response.data;
}

export async function submitApplication(applicationId: number): Promise<ApplicationDetailUI> {
  const response = await api.post<ApplicationDetailUI>(`/api/workflow/applications/${applicationId}/submit`);
  return response.data;
}

export async function transitionStep(
  applicationId: number,
  stepId: number,
  targetStatus: string,
  notes?: string,
): Promise<ApprovalStepUI> {
  const response = await api.post<ApprovalStepUI>(
    `/api/workflow/applications/${applicationId}/steps/${stepId}/transition`,
    { target_status: targetStatus, notes },
  );
  return response.data;
}

export async function getWorkflowGraph(applicationId: number): Promise<WorkflowGraphUIResponse> {
  const response = await api.get<WorkflowGraphUIResponse>(`/api/workflow/applications/${applicationId}/graph`);
  return response.data;
}

// --- M5 SLA & Escalation Interfaces & APIs ---

export type SLAStatusType =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "WARNING"
  | "OVERDUE"
  | "PAUSED"
  | "COMPLETED"
  | "SLA_VERIFICATION_REQUIRED";

export interface SLACalculationUIResult {
  requirement_id: string;
  sla_id?: string;
  status: SLAStatusType;
  duration_days?: number;
  started_at?: string;
  completed_at?: string;
  deadline?: string;
  elapsed_days: number;
  remaining_days: number;
  days_overdue: number;
  warning_threshold_pct: number;
  is_warning: boolean;
  is_overdue: boolean;
  is_paused: boolean;
  paused_seconds: number;
  data_status: string;
  calendar_note: string;
  escalation_triggered: boolean;
  escalation_level?: string;
  escalation_recipient?: string;
}

export interface StepSLAResponseUI {
  step_id: number;
  requirement_id: string;
  step_name: string;
  department?: string;
  status: string;
  is_critical_path: boolean;
  sla: SLACalculationUIResult;
}

export interface ApplicationSLAUIResponse {
  application_id: number;
  application_title: string;
  application_status: string;
  overall_sla_status: SLAStatusType;
  current_time: string;
  is_clock_simulated: boolean;
  total_steps: number;
  critical_path_steps_count: number;
  critical_path_sla_status: SLAStatusType;
  active_escalations_count: number;
  steps: StepSLAResponseUI[];
}

export interface EscalationEventUI {
  id: number;
  application_id: number;
  approval_step_id: number;
  requirement_id: string;
  sla_id?: string;
  trigger_type: string;
  level: string;
  recipient_role: string;
  days_overdue: number;
  reason: string;
  status: "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";
  triggered_at: string;
  resolved_at?: string;
  notes?: string;
}

export async function getApplicationSLA(applicationId: number): Promise<ApplicationSLAUIResponse> {
  const response = await api.get<ApplicationSLAUIResponse>(`/api/workflow/applications/${applicationId}/sla`);
  return response.data;
}

export async function getApplicationEscalations(applicationId: number): Promise<EscalationEventUI[]> {
  const response = await api.get<EscalationEventUI[]>(`/api/workflow/applications/${applicationId}/escalations`);
  return response.data;
}

export async function pauseStep(applicationId: number, stepId: number): Promise<StepSLAResponseUI> {
  const response = await api.post<StepSLAResponseUI>(`/api/workflow/applications/${applicationId}/steps/${stepId}/pause`);
  return response.data;
}

export async function resumeStep(applicationId: number, stepId: number): Promise<StepSLAResponseUI> {
  const response = await api.post<StepSLAResponseUI>(`/api/workflow/applications/${applicationId}/steps/${stepId}/resume`);
  return response.data;
}

export async function advanceSimulatedClock(days: number = 0, hours: number = 0): Promise<any> {
  const response = await api.post("/api/admin/clock/advance", { days, hours, minutes: 0 });
  return response.data;
}

export async function resetSimulatedClock(): Promise<any> {
  const response = await api.post("/api/admin/clock/reset");
  return response.data;
}

// --- M6 Officer & Admin Operational Interfaces & APIs ---

export interface OfficerEscalationItemUI {
  id: number;
  application_id: number;
  application_title: string;
  approval_step_id: number;
  step_name: string;
  department: string;
  requirement_id: string;
  sla_id?: string;
  trigger_type: string;
  level: string;
  recipient_role: string;
  days_overdue: number;
  reason: string;
  status: "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";
  triggered_at: string;
  acknowledged_at?: string;
  acknowledged_by_email?: string;
  resolved_at?: string;
  resolved_by_email?: string;
  resolution_note?: string;
  is_critical_path: boolean;
  sla_status: SLAStatusType;
  days_remaining: number;
  current_days_overdue: number;
  data_status: string;
}

export interface OfficerOverviewUI {
  open_escalations: number;
  triggered_escalations: number;
  acknowledged_escalations: number;
  resolved_escalations: number;
  in_progress_steps: number;
  warning_steps: number;
  overdue_steps: number;
  data_status: string;
}

export interface AdminOverviewUI {
  total_applications: number;
  applications_by_status: Record<string, number>;
  total_steps: number;
  steps_by_status: Record<string, number>;
  total_escalations: number;
  escalations_by_status: Record<string, number>;
  active_escalations: number;
  sla_health: Record<string, number>;
  critical_path_overdue_count: number;
  average_resolution_hours: number | null;
  data_status: string;
}

export interface AdminBottleneckUI {
  step_id: number;
  application_id: number;
  application_title: string;
  requirement_id: string;
  step_name: string;
  department: string;
  is_critical_path: boolean;
  status: string;
  sla_status: "NOT_STARTED" | "ON_TRACK" | "WARNING" | "OVERDUE" | "PAUSED" | "COMPLETED" | "SLA_VERIFICATION_REQUIRED";
  days_overdue: number;
  escalation_status?: string | null;
  escalation_level?: string | null;
  recipient_role?: string | null;
  data_status: string;
}

export async function getOfficerOverview(): Promise<OfficerOverviewUI> {
  const response = await api.get<OfficerOverviewUI>("/api/officer/overview");
  return response.data;
}

export async function getOfficerEscalations(params?: {
  status?: string;
  sla_status?: string;
  critical_path?: boolean;
}): Promise<OfficerEscalationItemUI[]> {
  const response = await api.get<OfficerEscalationItemUI[]>("/api/officer/escalations", { params });
  return response.data;
}

export async function getOfficerEscalationDetail(id: number): Promise<OfficerEscalationItemUI> {
  const response = await api.get<OfficerEscalationItemUI>(`/api/officer/escalations/${id}`);
  return response.data;
}

export async function acknowledgeEscalation(id: number): Promise<OfficerEscalationItemUI> {
  const response = await api.post<OfficerEscalationItemUI>(`/api/officer/escalations/${id}/acknowledge`);
  return response.data;
}

export async function resolveEscalation(id: number, resolutionNote: string): Promise<OfficerEscalationItemUI> {
  const response = await api.post<OfficerEscalationItemUI>(`/api/officer/escalations/${id}/resolve`, {
    resolution_note: resolutionNote,
  });
  return response.data;
}

export async function getAdminOverview(): Promise<AdminOverviewUI> {
  const response = await api.get<AdminOverviewUI>("/api/admin/overview");
  return response.data;
}

export async function getAdminBottlenecks(): Promise<AdminBottleneckUI[]> {
  const response = await api.get<AdminBottleneckUI[]>("/api/admin/bottlenecks");
  return response.data;
}

// ==========================================
// M7: Document Management & Officer Scrutiny
// ==========================================

export interface DocumentVersionInfoUI {
  id: number;
  version: number;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  status: "UPLOADED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "QUERY_RAISED";
  uploaded_at: string;
  uploaded_by_email?: string | null;
  reviewed_at?: string | null;
  reviewed_by_email?: string | null;
  review_decision?: string | null;
  review_note?: string | null;
  data_status: string;
}

export interface DocumentSlotItemUI {
  requirement_id: string;
  step_name: string;
  approval_step_id?: number | null;
  document_name: string;
  status: "MISSING" | "UPLOADED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "QUERY_RAISED";
  is_uploaded: boolean;
  data_status: string;
  current_document?: DocumentVersionInfoUI | null;
  history: DocumentVersionInfoUI[];
  guidance?: string | null;
}

export interface DocumentCompletenessSummaryUI {
  total_required: number;
  uploaded_count: number;
  accepted_count: number;
  under_review_count: number;
  query_raised_count: number;
  rejected_count: number;
  missing_count: number;
  upload_completeness_pct: number;
  scrutiny_acceptance_pct: number;
  is_complete: boolean;
  data_status: string;
}

export interface ApplicationDocumentsResponseUI {
  application_id: number;
  application_title: string;
  business_id: number;
  business_name: string;
  completeness: DocumentCompletenessSummaryUI;
  documents: DocumentSlotItemUI[];
  data_status: string;
}

export interface OfficerPendingDocumentItemUI {
  id: number;
  application_id: number;
  application_title: string;
  business_id: number;
  business_name: string;
  approval_step_id?: number | null;
  step_name: string;
  requirement_id: string;
  document_name: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  version: number;
  status: "UPLOADED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "QUERY_RAISED";
  uploaded_at: string;
  uploaded_by_email?: string | null;
  reviewed_at?: string | null;
  reviewed_by_email?: string | null;
  review_decision?: string | null;
  review_note?: string | null;
  data_status: string;
}

export async function getApplicationDocuments(applicationId: number): Promise<ApplicationDocumentsResponseUI> {
  const response = await api.get<ApplicationDocumentsResponseUI>(`/api/workflow/applications/${applicationId}/documents`);
  return response.data;
}

export async function uploadApplicationDocument(
  applicationId: number,
  formData: FormData
): Promise<DocumentVersionInfoUI> {
  const response = await api.post<DocumentVersionInfoUI>(
    `/api/workflow/applications/${applicationId}/documents/upload`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return response.data;
}

export async function downloadDocument(documentId: number): Promise<Blob> {
  const response = await api.get(`/api/documents/${documentId}/download`, {
    responseType: "blob",
  });
  return response.data;
}

export async function getOfficerPendingDocuments(status?: string): Promise<OfficerPendingDocumentItemUI[]> {
  const response = await api.get<OfficerPendingDocumentItemUI[]>("/api/officer/documents/pending", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function reviewDocument(
  documentId: number,
  decision: string,
  note?: string
): Promise<DocumentVersionInfoUI> {
  const response = await api.post<DocumentVersionInfoUI>(`/api/officer/documents/${documentId}/review`, {
    decision,
    note,
  });
  return response.data;
}

// ==========================================
// M8: Risk Assessment & Joint Inspections
// ==========================================

export interface RiskFactorDetailUI {
  factor_key: string;
  description: string;
  field: string;
  actual_value: any;
  score_awarded: number;
  max_weight: number;
  triggered: boolean;
  department?: string | null;
  inspection_item?: string | null;
  data_status: string;
}

export interface RiskAssessmentUI {
  composite_score: number;
  risk_category: "HIGH" | "MEDIUM" | "LOW";
  color_code: "RED" | "ORANGE" | "GREEN";
  category_description: string;
  joint_inspection_mandatory: boolean;
  inspection_frequency_months: number;
  inspection_protocol: string;
  factors: RiskFactorDetailUI[];
  mandated_departments: string[];
  inspection_checklist: string[];
  missing_critical_fields: string[];
  is_complete: boolean;
  data_status: string;
}

export interface InspectionReportUI {
  id: number;
  joint_inspection_id: number;
  submitted_by_id: number;
  submitted_by_name?: string | null;
  submitted_at: string;
  overall_outcome: "SATISFACTORY" | "DEFICIENCIES_NOTED" | "NON_COMPLIANT";
  department_findings: Record<string, { status: string; remarks: string }>;
  deficiencies: string[];
  corrective_actions?: string | null;
  reinspection_required: boolean;
  compliance_deadline?: string | null;
}

export interface JointInspectionItemUI {
  id: number;
  application_id: number;
  business_id: number;
  business_name?: string | null;
  scheduled_date: string;
  time_slot: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  risk_category: string;
  lead_inspector_id: number;
  lead_inspector_name?: string | null;
  participating_departments: string[];
  checklist_items: string[];
  notes?: string | null;
  data_status: string;
  created_at: string;
  report?: InspectionReportUI | null;
}

export interface ApplicationInspectionsResponseUI {
  application_id: number;
  business_name: string;
  risk_category: string;
  composite_score: number;
  joint_inspection_mandatory: boolean;
  inspections: JointInspectionItemUI[];
}

export interface ScheduleInspectionPayload {
  scheduled_date: string;
  time_slot?: string;
  notes?: string;
  custom_checklist?: string[];
}

export interface RescheduleInspectionPayload {
  scheduled_date: string;
  time_slot: string;
  reason: string;
}

export interface SubmitInspectionReportPayload {
  overall_outcome: "SATISFACTORY" | "DEFICIENCIES_NOTED" | "NON_COMPLIANT";
  department_findings: Record<string, { status: string; remarks: string }>;
  deficiencies?: string[];
  corrective_actions?: string;
  reinspection_required?: boolean;
  compliance_deadline?: string;
}

export async function getApplicationRiskAssessment(applicationId: number): Promise<RiskAssessmentUI> {
  const response = await api.get<RiskAssessmentUI>(`/api/workflow/applications/${applicationId}/risk-assessment`);
  return response.data;
}

export async function getApplicationInspections(applicationId: number): Promise<ApplicationInspectionsResponseUI> {
  const response = await api.get<ApplicationInspectionsResponseUI>(`/api/workflow/applications/${applicationId}/inspections`);
  return response.data;
}

export async function scheduleJointInspection(
  applicationId: number,
  payload: ScheduleInspectionPayload
): Promise<JointInspectionItemUI> {
  const response = await api.post<JointInspectionItemUI>(
    `/api/workflow/applications/${applicationId}/inspections/schedule`,
    payload
  );
  return response.data;
}

export async function rescheduleJointInspection(
  applicationId: number,
  inspectionId: number,
  payload: RescheduleInspectionPayload
): Promise<JointInspectionItemUI> {
  const response = await api.post<JointInspectionItemUI>(
    `/api/workflow/applications/${applicationId}/inspections/${inspectionId}/reschedule`,
    payload
  );
  return response.data;
}

export async function getOfficerInspections(status?: string): Promise<JointInspectionItemUI[]> {
  const response = await api.get<JointInspectionItemUI[]>("/api/officer/inspections", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function getOfficerInspectionDetail(inspectionId: number): Promise<JointInspectionItemUI> {
  const response = await api.get<JointInspectionItemUI>(`/api/officer/inspections/${inspectionId}`);
  return response.data;
}

export async function submitOfficerInspectionReport(
  inspectionId: number,
  payload: SubmitInspectionReportPayload
): Promise<InspectionReportUI> {
  const response = await api.post<InspectionReportUI>(
    `/api/officer/inspections/${inspectionId}/report`,
    payload
  );
  return response.data;
}

// ==========================================
// M9 Schemes & Subsidies Discovery Interfaces
// ==========================================

export interface SchemeEvaluationItemUI {
  scheme_id: string;
  name: string;
  department: string;
  category: string;
  description: string;
  status: "ELIGIBLE" | "POTENTIALLY_ELIGIBLE" | "NOT_ELIGIBLE";
  max_benefit_description: string;
  max_amount_inr: number;
  disbursement_mechanism?: string | null;
  application_mode: string;
  matched_conditions: string[];
  unmet_conditions: string[];
  potential_action?: string | null;
  missing_fields_hint: string[];
  required_documents: string[];
  data_status: string;
}

export interface SchemesAssessmentResultUI {
  business_id: number;
  business_name: string;
  total_schemes_evaluated: number;
  eligible_count: number;
  potentially_eligible_count: number;
  not_eligible_count: number;
  total_potential_benefit_inr: number;
  schemes: SchemeEvaluationItemUI[];
  assessed_at: string;
  data_status: string;
}

export async function getBusinessSchemes(businessId: number): Promise<SchemesAssessmentResultUI> {
  const response = await api.get<SchemesAssessmentResultUI>(`/api/business/${businessId}/schemes`);
  return response.data;
}

// ========================================================
// M9 Post-Approval Periodic Compliance Calendar Interfaces
// ========================================================

export interface ComplianceMetricFieldUI {
  name: string;
  label: string;
  field_type: string;
  required: boolean;
}

export interface ComplianceFilingItemUI {
  id: number;
  application_id: number;
  compliance_id: string;
  title: string;
  department: string;
  frequency: string;
  period_label: string;
  due_date: string;
  lead_notice_days: number;
  statutory_act?: string | null;
  penalty_clause_desc?: string | null;
  status: "UPCOMING" | "DUE_SOON" | "OVERDUE" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  penalty_risk_active: boolean;
  days_remaining: number;
  submitted_at?: string | null;
  submitted_by_email?: string | null;
  filing_data: Record<string, any>;
  document_id?: number | null;
  remarks?: string | null;
  verified_at?: string | null;
  verified_by_email?: string | null;
  verification_notes?: string | null;
  required_form?: string | null;
  metric_fields: ComplianceMetricFieldUI[];
  data_status: string;
}

export interface ComplianceCalendarResponseUI {
  application_id: number;
  business_name: string;
  total_filings: number;
  upcoming_count: number;
  due_soon_count: number;
  overdue_count: number;
  submitted_count: number;
  verified_count: number;
  filings: ComplianceFilingItemUI[];
  current_simulated_time: string;
  data_status: string;
}

export interface SubmitComplianceFilingPayload {
  filing_data: Record<string, any>;
  document_id?: number | null;
  remarks?: string | null;
}

export interface VerifyComplianceFilingPayload {
  decision: "VERIFIED" | "REJECTED";
  verification_notes?: string | null;
}

export async function getComplianceCalendar(applicationId: number): Promise<ComplianceCalendarResponseUI> {
  const response = await api.get<ComplianceCalendarResponseUI>(
    `/api/workflow/applications/${applicationId}/compliance-calendar`
  );
  return response.data;
}

export async function submitComplianceFiling(
  applicationId: number,
  filingId: number,
  payload: SubmitComplianceFilingPayload
): Promise<ComplianceFilingItemUI> {
  const response = await api.post<ComplianceFilingItemUI>(
    `/api/workflow/applications/${applicationId}/compliance-filings/${filingId}/submit`,
    payload
  );
  return response.data;
}

export async function getOfficerComplianceFilings(status?: string): Promise<ComplianceFilingItemUI[]> {
  const response = await api.get<ComplianceFilingItemUI[]>("/api/officer/compliance-filings", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function verifyOfficerComplianceFiling(
  filingId: number,
  payload: VerifyComplianceFilingPayload
): Promise<ComplianceFilingItemUI> {
  const response = await api.post<ComplianceFilingItemUI>(
    `/api/officer/compliance-filings/${filingId}/verify`,
    payload
  );
  return response.data;
}

// ==========================================
// M10: Analytics & Executive Insights
// ==========================================

export interface ExecutiveKPIsUI {
  total_applications: number;
  active_applications: number;
  completed_applications: number;
  rejected_applications: number;
  mean_processing_days: number | null;
  median_processing_days: number | null;
  sla_breach_count: number;
  critical_path_overdue_count: number;
  sla_compliance_rate: number | null;
  total_escalations: number;
  active_escalations: number;
  resolved_escalations: number;
  escalation_rate: number | null;
  mean_escalation_resolution_hours: number | null;
  median_escalation_resolution_hours: number | null;
  document_review_backlog: number;
  inspection_backlog: number;
  compliance_overdue_count: number;
}

export interface ExecutiveInsightItemUI {
  id: string;
  priority: "CRITICAL" | "WARNING" | "INFO";
  category: "SLA" | "ESCALATION" | "DOCUMENTS" | "INSPECTIONS" | "COMPLIANCE" | "GENERAL";
  title: string;
  message: string;
  metric_value?: string | null;
}

export interface DepartmentPerformanceItemUI {
  department: string;
  total_steps: number;
  completed_steps: number;
  in_progress_steps: number;
  overdue_steps: number;
  active_escalations: number;
  on_time_rate: number | null;
}

export interface SLAHealthDistributionUI {
  on_track: number;
  warning: number;
  overdue: number;
  paused: number;
  completed: number;
  not_started: number;
  sla_verification_required: number;
}

export interface DocumentAnalyticsSummaryUI {
  total_uploaded: number;
  accepted: number;
  under_review: number;
  rejected: number;
  query_raised: number;
  backlog: number;
  average_review_hours: number | null;
}

export interface InspectionAnalyticsSummaryUI {
  total_inspections: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
  backlog: number;
  satisfactory_count: number;
  deficiencies_noted_count: number;
  non_compliant_count: number;
  facilities_high_risk: number;
  facilities_medium_risk: number;
  facilities_low_risk: number;
}

export interface ComplianceAnalyticsSummaryUI {
  total_filings: number;
  upcoming: number;
  due_soon: number;
  overdue: number;
  submitted: number;
  verified: number;
  rejected: number;
  penalty_risk_active: number;
  verification_backlog: number;
}

export interface AnalyticsOverviewResponseUI {
  kpis: ExecutiveKPIsUI;
  insights: ExecutiveInsightItemUI[];
  sla_health: SLAHealthDistributionUI;
  document_health: DocumentAnalyticsSummaryUI;
  inspection_health: InspectionAnalyticsSummaryUI;
  compliance_health: ComplianceAnalyticsSummaryUI;
  data_status: string;
  generated_at: string;
}

export interface AnalyticsTrendItemUI {
  month: string;
  applications_created: number;
  applications_completed: number;
  escalations_triggered: number;
}

export interface AnalyticsTrendsResponseUI {
  trends: AnalyticsTrendItemUI[];
  insufficient_data: boolean;
  message?: string | null;
  data_status: string;
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverviewResponseUI> {
  const response = await api.get<AnalyticsOverviewResponseUI>("/api/admin/analytics/overview");
  return response.data;
}

export async function getDepartmentPerformance(): Promise<DepartmentPerformanceItemUI[]> {
  const response = await api.get<DepartmentPerformanceItemUI[]>("/api/admin/analytics/departments");
  return response.data;
}

export async function getAnalyticsTrends(): Promise<AnalyticsTrendsResponseUI> {
  const response = await api.get<AnalyticsTrendsResponseUI>("/api/admin/analytics/trends");
  return response.data;
}







