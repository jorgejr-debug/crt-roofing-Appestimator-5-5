import { normalizeCompanyVehicle, isMissingVehicleTable } from "./companyVehicles.js";
import { fetchAccessibleFieldLogRows, ownFieldLogsForCache } from "./fieldLogAccess.js";
import ConnectionStatus from "./ConnectionStatus.jsx";
import { toPlainObject } from "./settingsObject.js";
import "./WorkflowMobile.css";
const WorkflowNotifications = React.lazy(() => import("./WorkflowNotifications.jsx"));
import { SERVICE_TEMPLATES, calculateServiceEstimate, validateServiceEstimate } from "./serviceEstimate.js";
const ServiceEstimateWorkspace = React.lazy(() => import("./ServiceEstimateWorkspace.jsx"));
const AdministrationWorkspace = React.lazy(() => import("./AdministrationWorkspace.jsx"));
const ApprovedJobWorkspace = React.lazy(() => import("./ApprovedJobWorkspace.jsx"));
const ApprovedJobsWorkspace = React.lazy(() => import("./ApprovedJobsWorkspace.jsx"));
const FieldOperationsWorkspace = React.lazy(() => import("./FieldOperationsWorkspace.jsx"));
const ActiveJobWorkspace = React.lazy(() => import("./ActiveJobWorkspace.jsx"));
const ActiveJobsWorkspace = React.lazy(() => import("./ActiveJobsWorkspace.jsx"));
const CrmWorkspace = React.lazy(() => import("./CrmWorkspace.jsx"));
const CfoDashboardWorkspace = React.lazy(() => import("./CfoDashboardWorkspace.jsx"));
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { createClient } from "@supabase/supabase-js";
import DashboardTasks from "./DashboardTasks.jsx";
import ActionFeedback from "./ActionFeedback.jsx";
import { getEmployeeAllowedTemplates, getEmployeeDashboardSections, getEmployeeNavigationKeys, getEmployeeWorkspace } from "./employeeWorkspace.js";
import { calculateMiguelKpis } from "./productionKpiWorkflow.js";
import {
  buildInspectionTask,
  calculateDanielaKpis,
  calculateIvanKpis,
  calculateLeadKpis,
  findInspectionAssignee,
  findPotentialDuplicateLead,
  validateQuickLead,
} from "./crmLeadWorkflow.js";
import {
  canManageInvoiceQueue,
  canSubmitJobForInvoice,
  createInvoiceHandoffDraft,
  validateInvoiceHandoffDraft,
} from "./invoiceWorkflow.js";
import {
  CFO_LIQUID_CASH_CARD_KEY,
  CFO_LIQUID_CASH_SOURCE_RECORD_UID,
  flattenLiquidCashEntriesToSharedRecord,
  hydrateLiquidCashEntriesFromSupabaseRows,
} from "./cfoLiquidCashSync.js";
import {
  calculateReceivablePaymentTotals,
  filterReceivablesByPaymentView,
  getReceivablePaymentStatus,
  normalizeReceivablePaymentStatus,
} from "./receivablePaymentStatus.js";
import {
  calculateSupplierPaymentTotals,
  filterSupplierPayablesByPaymentView,
  getSupplierPaymentStatus,
  normalizeSupplierPaymentStatus,
} from "./supplierPaymentStatus.js";
import { getRevealSecondsRemaining, stripLiquidCashRecords } from "./liquidCashReveal.js";
import { prepareEstimateMutationRow } from "./estimatePersistence.js";
import {
  calculateInHouseLaborBurden,
  calculateLoadedHourlyWage,
  normalizeEstimateLaborEmployeeRows,
  PAYROLL_TAX_RATE,
  TOTAL_LABOR_BURDEN_RATE,
  WORKERS_COMP_RATE,
} from "./laborBurden.js";
import { resolveEmployeeDisplayName } from "./employeeDirectory.js";
import {
  APPROVED_JOB_ATTACHMENT_BUCKET,
  buildApprovedJobAttachmentPath,
  createApprovedJobAttachmentRecord,
  formatAttachmentSize,
  validateApprovedJobAttachment,
} from "./approvedJobAttachments.js";
import {
  calculateSprayFoamUsage,
  normalizeSprayFoamThickness,
  resolveSprayFoamTravelInputs,
} from "./sprayFoamEstimateRules.js";
import {
  APPROVED_JOB_OPERATING_OVERHEAD_RATE,
  calculateApprovedJobFullyLoadedProfitability,
  calculateApprovedJobOperatingOverhead,
  calculateDailyEmployeeLaborCost,
  calculateDailyTravelCost,
  calculateSprayFoamMaterialUsage,
  calculateSubcontractorCost,
  getDefaultSalesCommissionRate,
  getDailyProgressDayIds,
  SPRAY_FOAM_GALLONS_PER_KIT,
  SPRAY_FOAM_KIT_COST,
  summarizeApprovedDailyProgress,
  toggleCollapsedDailyProgressDay,
} from "./approvedDailyProgress.js";
import {
  applyActiveJobEditDraft,
  buildActiveJobEditDraft,
  buildCfoApprovedJobSharedJob,
  buildCfoApprovedJobsLedger,
  buildSharedJobSourceId,
  buildSharedJobUpsertRow,
  canCreateApprovedJobs,
  canManageActiveJobs,
  canManageSharedJobs,
  canUpdateDailyJobCosts,
  getActiveJobPreviewDetails,
  moveApprovedJobToActive,
  splitSharedJobsByWorkflow,
} from "./sharedJobWorkflow.js";
import {
  GOOGLE_MAPS_API_KEY,
  buildTravelLookupMessage,
  fetchPlacePredictions,
  routeGoogleDirections,
  routeGoogleDirectionsDirect,
} from "./googleMapsTravelService.js";

const WorkHub = React.lazy(() => import("./WorkHub.jsx"));
const SubcontractorCompliance = React.lazy(() => import("./SubcontractorCompliance.jsx"));
const InvoiceQueue = React.lazy(() => import("./InvoiceQueue.jsx"));
const AccountAccessVault = React.lazy(() => import("./AccountAccessVault.jsx"));
const DeferredGoogleMapsLoader = React.lazy(() => import("./DeferredGoogleMapsLoader.jsx"));
const SprayFoamWorkspace = React.lazy(() => import("./SprayFoamWorkspace.jsx"));
const TpoWorkspace = React.lazy(() => import("./TpoWorkspace.jsx"));
const ShingleWorkspace = React.lazy(() => import("./ShingleWorkspace.jsx"));
const TileWorkspace = React.lazy(() => import("./TileWorkspace.jsx"));
const GOOGLE_MAPS_WORKSPACES = new Set(["tpo", "sprayFoam", "shingle", "tile", "coating", "maintenance", "repair"]);

class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Workspace failed to open:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="panel" role="alert">
        <p className="eyebrow">Connection recovery</p>
        <h2>This workspace could not open</h2>
        <p className="intro">Check your internet connection, then try again. Your saved company records were not changed.</p>
        <div className="actionRow">
          <button type="button" className="primaryButton" onClick={() => window.location.reload()}>Try Again</button>
          <button type="button" className="secondaryButton" onClick={this.props.onReturnDashboard}>Return to Dashboard</button>
        </div>
      </section>
    );
  }
}

let pdfReaderPromise = null;
let jsPdfPromise = null;

async function loadJsPdf() {
  if (!jsPdfPromise) {
    jsPdfPromise = import("jspdf").then((module) => module.jsPDF || module.default);
  }
  return jsPdfPromise;
}

async function loadPdfReader() {
  if (!pdfReaderPromise) {
    pdfReaderPromise = Promise.all([
      import("pdfjs-dist/build/pdf.mjs"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfModule, workerModule]) => {
      pdfModule.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfModule;
    });
  }
  return pdfReaderPromise;
}

const AUTH_KEY = "crt_roofing_auth_v1";
const USERS_KEY = "crt_roofing_users_v1";
const PASSWORD_RESET_REDIRECT_URL = "https://crt-roofing-estimator.vercel.app/";
const DRAFT_KEY = (userKey) => `crt_roofing_draft_v1:${userKey}`;
const SAVED_KEY = (userKey) => `crt_roofing_saved_v1:${userKey}`;
const FIELD_NOTES_DRAFT_KEY = (userKey) => `crt_roofing_field_notes_draft_v1:${userKey}`;
const INSPECTIONS_KEY = (userKey) => `crt_roofing_inspections_v1:${userKey}`;
const FIELD_DAILY_LOG_DRAFT_KEY = (userKey) => `crt_roofing_field_daily_log_draft_v1:${userKey}`;
const FIELD_DAILY_LOGS_KEY = (userKey) => `crt_roofing_field_daily_logs_v1:${userKey}`;
const FIELD_DAILY_LOG_DEVICE_KEY = "crt_roofing_field_daily_log_device_identifier_v1";
const FIELD_DAILY_LOG_PHOTO_BUCKET = "field-daily-log-photos";
const FIELD_OPERATION_EMPLOYEES_KEY = (userKey) => `crt_roofing_field_operation_employees_v1:${userKey}`;
const FIELD_OPERATION_COMPANY_VEHICLES_KEY = (userKey) => `crt_roofing_field_operation_company_vehicles_v1:${userKey}`;
const FIELD_DAILY_LOG_HIGH_MILEAGE_THRESHOLD = 300;
const ADMIN_PRICING_KEY = "crt_roofing_admin_pricing_v1";
const ADMIN_TRAVEL_SETTINGS_KEY = "crt_roofing_admin_travel_settings_v1";
const COMPLETED_JOBS_KEY = (userKey) => `crt_roofing_completed_jobs_v1:${userKey}`;
const PROPOSALS_KEY = (userKey) => `crt_roofing_proposals_v1:${userKey}`;
const PROPOSALS_KEY_PREFIX = "crt_roofing_proposals_v1:";
const PROPOSAL_TEMPLATE_KEY = (userKey) => `crt_roofing_proposal_template_v1:${userKey}`;
const CFO_LIQUID_CASH_KEY = (userKey) => `crt_roofing_cfo_liquid_cash_v1:${userKey}`;
const CFO_SHARED_LIQUID_CASH_RECORD_UID = CFO_LIQUID_CASH_SOURCE_RECORD_UID;
const CFO_SHARED_LIQUID_CASH_CARD_KEY = CFO_LIQUID_CASH_CARD_KEY;
const CRM_LEADS_KEY = (userKey) => `crt_roofing_crm_leads_v1:${userKey}`;
const CRM_CUSTOMERS_KEY = (userKey) => `crt_roofing_crm_customers_v1:${userKey}`;
const CRM_FOLLOWUPS_KEY = (userKey) => `crt_roofing_crm_followups_v1:${userKey}`;
const CRM_CUSTOMERS_MIGRATED_KEY = (userKey) => `crt_roofing_crm_customers_shared_v1:${userKey}`;
const CRM_FOLLOWUPS_MIGRATED_KEY = (userKey) => `crt_roofing_crm_followups_shared_v1:${userKey}`;
const APPEARANCE_PREFERENCE_KEY = "crt_roofing_appearance_preference_v1";
const SIDEBAR_COLLAPSED_KEY = "crt_roofing_sidebar_collapsed_v1";
const COMPANY_ESTIMATOR_SETTINGS_TABLE = "company_estimator_settings";
const COMPANY_FINANCIAL_RECORDS_TABLE = "company_financial_records";
const COMPANY_ACTIVE_JOBS_TABLE = "active_jobs";
const PROFILE_PHOTO_BUCKET = "profile-photos";
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const CFO_MANUAL_CARD_KEYS = [
  "proposalsSent",
  "approvedJobs",
  "customerOverdue",
  "supplierTotalsPayable",
  "supplierOverdue",
  "subcontractorPayables",
  "grossProfit",
  "accountsPayable",
];

const JOB_TYPE_OPTIONS = [
  { value: "existingRoof", label: "Existing Roof" },
  { value: "newConstruction", label: "New Construction" },
];

const EXISTING_ROOF_OPTIONS = [
  { value: "tearOff", label: "Tearing Off" },
  { value: "layover", label: "Doing Layover" },
];

const SUBSTRATE_OPTIONS = [
  { value: "rigidInsulation", label: "Rigid Insulation" },
  { value: "denseDeckOnly", label: "Class-A Fire Rated Dense Deck Only" },
];

const R_VALUE_OPTIONS = [11, 22, 30, 38];

const TERMINATION_METHOD_OPTIONS = [
  { value: "copingMetal", label: "Coping metal install" },
  { value: "cladDripEdge", label: "Clad drip edge metal" },
  { value: "termBar", label: "Term bar termination" },
  { value: "existingMetal", label: "Existing metal to remain" },
  { value: "otherManual", label: "Other / manual" },
];

const AC_DETAIL_OPTIONS = [
  { value: "cornersOnly", label: "Corners only" },
  { value: "fullCurb", label: "Full curb detail" },
];

const LABOR_TYPE_OPTIONS = [
  { value: "inHouse", label: "In-house crew" },
  { value: "subcontractor", label: "Subcontractor" },
];

const LICENSE_OPTIONS = [
  { value: "licensed", label: "Licensed" },
  { value: "unlicensed", label: "Unlicensed" },
];

const MARKUP_OPTIONS = [30, 35, 40, 45, 50, 55, 60];
const OVERHEAD_OPERATING_RATE = 17.5;
const FUEL_COST_PER_GALLON = 6.25;
const DEFAULT_TRAVEL_VEHICLE_KEY = "isuzu2020FoamTruck";
const TRAVEL_VEHICLE_OPTIONS = [
  { value: "isuzu2020FoamTruck", label: "Isuzu 2020 Foam Truck", mpg: 12 },
  { value: "f250ServiceTruck", label: "F-250 Service Truck", mpg: 14 },
  { value: "f150Sales", label: "F-150 Sales", mpg: 17 },
  { value: "silverado2020", label: "Silverado 2020", mpg: 16.5 },
  { value: "f450Flatbed", label: "F-450 Flatbed", mpg: 15 },
  { value: "tacomaSales", label: "Tacoma Sales", mpg: 19 },
  { value: "ford2015FoamTruck", label: "Ford 2015 Foam Truck", mpg: 12 },
];

const EMPLOYEE_DIRECTORY_BY_EMAIL = {
  "ivan@crtroofing.com": {
    displayName: "Ivan",
    title: "Estimator / Technician / Sales",
    canViewAllProposals: false,
    canAccessCfoDashboard: false,
  },
  "chris@crtroofing.com": {
    displayName: "Chris",
    title: "Business Development",
    canViewAllProposals: false,
    canAccessCfoDashboard: false,
  },
  "daniela@crtroofing.com": {
    displayName: "Daniela",
    title: "Proposal Specialist / Estimating",
    canViewAllProposals: true,
    canAccessCfoDashboard: false,
  },
  "natalia@crtroofing.com": {
    displayName: "Natalia",
    title: "Office Manager / Administration",
    canViewAllProposals: true,
    canAccessCfoDashboard: true,
  },
  "jorgejr@crtroofing.com": {
    displayName: "Jorge Jr",
    title: "CFO",
    canViewAllProposals: true,
    canAccessCfoDashboard: true,
  },
  "jorge@crtroofing.com": {
    displayName: "Jorge",
    title: "CEO / Spray Foam Production",
    canViewAllProposals: true,
    canAccessCfoDashboard: true,
  },
  "miguel@crtroofing.com": {
    displayName: "Miguel Figueroa",
    title: "Project Manager / Production",
    canViewAllProposals: false,
    canAccessCfoDashboard: false,
  },
};
const DEFAULT_MATERIAL_PRICES = {
  rigidInsulationSheetCost: 31.95,
  starterRollCost: 360,
  fieldRollCost: 720,
  parapetRollCost: 720,
  fanfoldBundleCost: 49,
  denseDeckSheetCost: 31.95,
  parapetAdhesiveTankCost: 818,
  parnahPlateCost: 0.18,
  twoInFastenerCost: 0.12,
  insulationPlateCost: 0.25,
  insulationFastenerCost: 0.18,
  detailMembraneRollCost: 537,
  tpoStripTapeCost: 45,
  tJointPatchCost: 2,
  ventBootCost: 45,
  pitchPocketUnitCost: 100,
  pourableSealantCostPerPocket: 100,
  pitchPocketLaborCostPerPocket: 125,
  copingMetalCost: 18,
  copingCleatCost: 5,
  copingCleatFastenerCost: 0.25,
  dripEdgeCost: 12,
  dripEdgeFastenerCost: 0.25,
  termBarCost: 30,
  termBarFastenerCost: 0.25,
  termBarSealantCost: 20,
};

const DEFAULT_SUBCONTRACTOR_ADD_ON_ITEMS = [
  { description: "Install new drains", quantity: 0, unitPrice: 500 },
  { description: "Install new skylight", quantity: 0, unitPrice: 150 },
  { description: "Install new vent", quantity: 0, unitPrice: 100 },
];

const DEFAULT_FIELD_NOTES = {
  jobName: "",
  customerName: "",
  jobAddress: "",
  date: "",
  technicianName: "",
  roofTypeObserved: "",
  customerRequestedRoofPreference: "",
  roofConditionNotes: "",
  accessNotes: "",
  safetyConcerns: "",
  existingRoofLayers: "",
  acUnitsCount: "",
  drainsCount: "",
  scuppersCount: "",
  penetrationsCount: "",
  parapetNotes: "",
  photos: [],
  internalNotes: "",
};

const TEMPLATE_CARDS = [
  { key: "tpo", title: "TPO Estimate", estimateType: "TPO", comingSoon: false },
  { key: "sprayFoam", title: "Spray Foam Estimate", estimateType: "Spray Foam", comingSoon: false },
  { key: "tile", title: "Tile Estimate", estimateType: "Tile", comingSoon: false },
  { key: "shingle", title: "Shingle Estimate", estimateType: "Shingle", comingSoon: false },
  { key: "coating", title: "Coating Estimate", estimateType: "Coating" },
  { key: "maintenance", title: "Maintenance", estimateType: "Maintenance" },
  { key: "repair", title: "Repair / Service Estimate", estimateType: "Repair / Service" },
];

const FIELD_NOTE_TEMPLATE_OPTIONS = [
  { key: "tpo", title: "TPO", estimateType: "TPO" },
  { key: "shingle", title: "Shingles", estimateType: "Shingle" },
  { key: "tile", title: "Tile", estimateType: "Tile" },
  { key: "sprayFoam", title: "Spray Foam", estimateType: "Spray Foam" },
  { key: "maintenance", title: "Maintenance", estimateType: "Maintenance" },
];

const FIELD_DAILY_LOG_PHOTO_CATEGORIES = [
  { value: "before", label: "Before-work photos" },
  { value: "progress", label: "Progress photos" },
  { value: "completed", label: "Completed-work photos" },
  { value: "problem", label: "Problem / damage photos" },
];

const ACTIVE_JOB_STATUS_OPTIONS = [
  "Scheduled",
  "Pre-construction",
  "Active",
  "In Progress",
  "Punch list",
  "On hold",
  "Warranty",
  "Completed",
  "Closed",
];

const ACTIVE_JOB_RISK_LEVELS = ["Normal", "Needs attention", "Critical"];

const ACTIVE_JOB_ISSUE_CATEGORIES = [
  "Leak",
  "Overspray",
  "Vehicle damage",
  "Property damage",
  "Noise",
  "Parking",
  "Access",
  "Dust or debris",
  "Scheduling",
  "Safety",
  "Warranty",
  "Billing",
  "Other",
];

const ACTIVE_JOB_ISSUE_PRIORITIES = ["Low", "Normal", "High", "Critical", "Emergency"];

const ACTIVE_JOB_ISSUE_STATUSES = [
  "New",
  "Acknowledged",
  "Assigned",
  "In progress",
  "Waiting on customer",
  "Waiting on third party",
  "Resolved",
  "Closed",
];

const APPROVED_JOB_STATUS_OPTIONS = [
  "Approved",
  "Pre-construction",
  "Permit pending",
  "Materials pending",
  "Subcontractor coordination",
  "Ready to schedule",
  "Scheduled",
  "Mobilizing",
  "Active",
  "On hold",
  "Completed",
  "Closed",
];

const PROPOSAL_STATUS_OPTIONS = [
  "Draft",
  "Needs review",
  "Approved to send",
  "Sent",
  "Viewed",
  "Customer requested revision",
  "Accepted",
  "Declined",
  "Expired",
  "Superseded",
];

const PROPOSAL_ACCEPTANCE_STATUS_OPTIONS = ["Pending", "Viewed", "Accepted", "Declined", "Needs revision", "Expired"];
const PROPOSAL_SIGNATURE_STATUS_OPTIONS = ["Unsigned", "Requested", "Signed", "Declined"];
const PROPOSAL_VIEW_STATUS_OPTIONS = ["Not viewed", "Viewed"];

const DEFAULT_PROPOSAL_TEMPLATE = {
  id: "crt-proposal-baseline-template",
  templateName: "CRT Proposal Baseline",
  brandName: "CRT Roofing",
  coverPageTitle: "CRT Roofing Proposal",
  coverPageSubtitle: "Prepared from the current estimate and linked to the source job until finalized.",
  executiveSummaryTitle: "Executive Summary",
  executiveSummaryBody:
    "This proposal is assembled from the active estimate. Pricing stays linked to the source estimate until the proposal is finalized.",
  scopeOfWorkTitle: "Scope of Work",
  scopeOfWorkIntro: "The estimate scope is summarized below for customer review.",
  photoTitle: "Photo Documentation",
  upgradeOptionsTitle: "Upgrade Options",
  productInformationTitle: "Product Information",
  warrantyComparisonTitle: "Warranty Comparison",
  pricingTitle: "Pricing Summary",
  signatureTitle: "Authorization & Signature",
  legalTitle: "Legal Pages",
  paymentTermsTitle: "Payment Terms",
  paymentTerms:
    "Payment terms follow the current CRT proposal standard and may be updated centrally.",
  contractLanguage:
    "This proposal uses the current CRT Roofing contract language and remains editable from the template manager.",
  signatureLineLabel: "Customer Signature",
  signatureDateLabel: "Date",
  legalNotice:
    "Legal and contract language are centrally managed so future edits can flow into newly generated proposals.",
  footerText: "Generated from the live estimate data.",
  sectionOrder: [
    "coverPage",
    "executiveSummary",
    "scopeOfWork",
    "photos",
    "upgradeOptions",
    "productInformation",
    "warrantyComparison",
    "pricing",
    "signature",
    "legal",
  ],
};

const DEFAULT_PROPOSAL_TEMPLATE_ID = DEFAULT_PROPOSAL_TEMPLATE.id;

const CRM_LEAD_SOURCE_OPTIONS = [
  "Phone Call / Office",
  "Cold Calling",
  "Existing customer",
  "Referral",
  "Google",
  "Website",
  "Yelp",
  "HOA / Property Manager",
  "General Contractor",
  "Manufacturer",
  "Supplier",
  "Walk-in",
  "Repeat customer",
  "Other",
];

const CRM_LEAD_SERVICE_OPTIONS = [
  "Roof inspection",
  "Repair",
  "Maintenance",
  "Leak investigation",
  "TPO",
  "Spray Foam",
  "Shingle",
  "Tile",
  "Coating",
  "New construction",
  "Re-roof",
  "Emergency service",
  "Other",
];

const CRM_VISIT_OUTCOME_OPTIONS = [
  ["no_contact", "No contact"],
  ["not_interested", "Not interested"],
  ["follow_up", "Follow up later"],
  ["qualified", "Qualified opportunity"],
  ["inspection", "Send for inspection"],
];

const CRM_LEAD_STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Inspection Requested",
  "Appointment Scheduled",
  "Inspection Completed",
  "Estimate in Progress",
  "Proposal Sent",
  "Follow-Up",
  "Approved",
  "Lost",
  "Not Qualified",
];

const CRM_PIPELINE_STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Inspection Requested",
  "Appointment Scheduled",
  "Inspection Completed",
  "Estimate in Progress",
  "Proposal Sent",
  "Follow-Up",
  "Approved",
  "Lost",
];

const CRM_PROPERTY_TYPE_OPTIONS = ["Residential", "Commercial", "HOA", "Multi-family", "Industrial", "Other"];
const CRM_URGENCY_OPTIONS = ["Low", "Normal", "High", "Emergency"];
const CRM_FOLLOWUP_STATUS_OPTIONS = ["Open", "Scheduled", "Waiting on customer", "Completed", "Canceled"];
const CRM_FOLLOWUP_TYPE_OPTIONS = ["Call", "Text", "Email", "Site visit", "Office review", "Estimate follow-up", "Other"];
const CRM_TIMELINE_TYPE_OPTIONS = ["Lead", "Call", "Visit", "Estimate", "Follow-up", "Note", "File", "Job", "Customer update"];
const CRM_LEAD_WORK_ORDER_BUCKET = "crm-lead-files";
const CRM_LEAD_WORK_ORDER_MAX_BYTES = 25 * 1024 * 1024;

const ACTIVE_JOBS_KEY = (userKey) => `crt_roofing_active_jobs_v1:${userKey}`;

const ACTIVE_JOB_ACTIVE_STATUSES = new Set(["scheduled", "pre-construction", "active", "punch list", "on hold", "warranty", "in progress"]);

const DEFAULT_ADMIN_PRICING = {
  tpoRollPrice: 360,
  isoSheetPrice: 31.95,
  denseDeckSheetPrice: 31.95,
  fastenerCost: 0.12,
  plateCost: 0.25,
  laborPerSquare: 0,
  tearOffPerSquare: 0,
  wastePercent: 15,
  taxPercent: 0,
  overheadPercent: 17.5,
  profitPercent: 30,
};

const DEFAULT_TRAVEL_ADMIN_SETTINGS = {
  companyHqAddress: "18551 Orange Street, Bloomington, CA 92316",
  travelDriverHourlyRate: 27,
  fuelCostPerGallon: 6.25,
  vehicleMpgByKey: Object.fromEntries(TRAVEL_VEHICLE_OPTIONS.map((option) => [option.value, option.mpg])),
};

const DEFAULT_SPF_RATES = {
  fieldThicknessUnitCost: 3.25,
  wallThicknessUnitCost: 2.75,
  foamKitCost: 2600,
  wallFoamSetCost: 2800,
  wallFoamYieldAtOneInch: 45,
  primerUnitCost: 1165,
  baseCoatUnitCost: 1165,
  intermediateCoat1UnitCost: 1165,
  intermediateCoat2UnitCost: 1165,
  topCoatUnitCost: 1165,
  granulesUnitCost: 15.5,
  detailMaterialsUnitCost: 25,
  laborCostPerLaborerPerDay: 320,
};

const DEFAULT_SPF_LAYER_CONFIG = {
  primer: { applicable: true, coverageRate: 220, unitCost: DEFAULT_SPF_RATES.primerUnitCost },
  baseCoat: { applicable: false, coverageRate: 37, unitCost: DEFAULT_SPF_RATES.baseCoatUnitCost },
  intermediateCoat1: { applicable: false, coverageRate: 37, unitCost: DEFAULT_SPF_RATES.intermediateCoat1UnitCost },
  intermediateCoat2: { applicable: false, coverageRate: 37, unitCost: DEFAULT_SPF_RATES.intermediateCoat2UnitCost },
  topCoat: { applicable: false, coverageRate: 37, unitCost: DEFAULT_SPF_RATES.topCoatUnitCost },
  granules: { applicable: true, coverageRate: 1.75, unitCost: DEFAULT_SPF_RATES.granulesUnitCost },
};

const DEFAULT_SPF_DETAIL_MATERIALS = {
  scuppers: { quantity: 0, unitCost: 65 },
  castIronDrain: { quantity: 0, unitCost: 450 },
  ventedLouveredSkylights: { quantity: 0, unitCost: 800 },
  nonVentedLouveredSkylights: { quantity: 0, unitCost: 635 },
  acCurbs: { quantity: 0, unitCost: 100 },
  acPans: { quantity: 0, unitCost: 165 },
  skylightCurbs: { quantity: 0, unitCost: 100 },
  tTops: { quantity: 0, unitCost: 55 },
  roofHatch: { quantity: 0, unitCost: 1800 },
  whirlyBird16: { quantity: 0, unitCost: 125 },
  corrugatedMetalSheets: { quantity: 0, unitCost: 38 },
  pbrMetalSheets: { quantity: 0, unitCost: 105 },
  secureRockDenseDeck: { quantity: 0, unitCost: 30, useAutoQuantity: false },
};

function createBlankSprayFoamParapetMeasurement() {
  return { label: "", linearFeet: "", height: "" };
}

function createBlankSprayFoamRoofArea() {
  return {
    label: "",
    fieldRoofSquares: "",
    foamThicknessInches: 2,
    hasParapetWalls: false,
    parapetWallSquares: "",
  };
}

function createBlankSprayFoamSubcontractorItem(type = "") {
  return {
    type,
    quantity: 0,
    unitPrice: 0,
    licensed: true,
  };
}

function createBlankSprayFoamAdditionalDetailMaterial() {
  return {
    name: "",
    quantity: 1,
    unitCost: 0,
    unit: "each",
  };
}

function createBlankSprayFoamEquipmentRental() {
  return {
    name: "",
    rateType: "perDay",
    rateAmount: 0,
    quantity: 1,
    days: 0,
    hours: 0,
  };
}

function createBlankShingleTearOffSection(index = 0) {
  return {
    id: `tear-off-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    label: `Section ${index + 1}`,
    squares: "",
    layers: 1,
    tearOffCostPerSquare: "",
    disposalFee: "",
    dryRotAllowance: "",
  };
}

function createBlankShingleSubcontractorItem(type = "") {
  return {
    type,
    unit: "",
    quantity: 0,
    unitPrice: 0,
    licensed: true,
  };
}

function createBlankShingleLaborSection(index = 0) {
  return {
    id: `labor-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    label: `Section ${index + 1}`,
    installSquares: "",
    costPerInstallSq: "",
    licensed: true,
    workersComp: true,
  };
}

function createBlankTileTearOffSection(index = 0) {
  return {
    id: `tile-tear-off-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    label: `Section ${index + 1}`,
    squares: "",
    layers: 1,
    tearOffCostPerSquare: "",
    disposalFee: "",
    dryRotAllowance: "",
  };
}

function createBlankTileLaborSection(index = 0) {
  return {
    id: `tile-labor-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    label: `Section ${index + 1}`,
    installSquares: "",
    costPerInstallSq: "",
    licensed: true,
    workersComp: true,
  };
}

function createSeedActiveJobs() {
  return [
    {
      id: "active-job-11671-sterling",
      jobNumber: "11671",
      projectName: "Sterling",
      address: "11671 Sterling Avenue, Bloomington, CA",
      customer: "Sterling Property Group",
      propertyOwner: "Sterling Property Group",
      propertyManager: "Todd",
      contractAmount: 325000,
      status: "Pre-construction",
      currentPhase: "Pre-construction",
      statusTone: "green",
      riskLevel: "Normal",
      riskTone: "green",
      riskReason: "",
      startDate: "2026-07-24",
      expectedCompletionDate: "2026-08-29",
      percentComplete: 5,
      projectDescription: "Replace and coordinate rooftop work with HVAC and electrical access on an occupied commercial property.",
      projectContact: "Jorge",
      projectManager: "Jorge Rodriguez",
      fieldSupervisor: "Jorge's father",
      foreman: "Jorge's father",
      salesperson: "Chris",
      officeCoordinator: "Natalia",
      openIssuesCount: 0,
      amountBilled: 0,
      amountCollected: 0,
      remainingContractValue: 325000,
      isActive: true,
      issues: [],
      team: [
        { role: "Project contact", name: "Jorge", company: "CRT Roofing", phone: "(555) 101-2001", email: "jorge@crtroofing.com", preferredContactMethod: "Phone" },
        { role: "Field supervisor", name: "Jorge's father", company: "CRT Roofing", phone: "(555) 101-2002", email: "supervisor@crtroofing.com", preferredContactMethod: "Phone" },
      ],
      outsideContacts: [
        { role: "Property manager", name: "Todd", company: "Sterling Property Group", phone: "(555) 101-4001", email: "todd@sterling.com", preferredContactMethod: "Email" },
        { role: "HVAC contractor", name: "HVAC Team", company: "Sterling Mechanical", phone: "(555) 101-4002", email: "hvac@sterlingmechanical.com", preferredContactMethod: "Phone" },
        { role: "Electrical contractor", name: "Electrical Team", company: "Sterling Electric", phone: "(555) 101-4003", email: "electrical@sterlingelectric.com", preferredContactMethod: "Phone" },
      ],
      operations: {
        schedule: "Permit coordination and pre-construction walkthroughs in progress.",
        dailyJobLogs: 0,
        crewHours: 0,
        photos: 0,
        materials: "Pending final takeoff",
        subcontractorCoordination: "HVAC and electrical coordination confirmed.",
        permitStatus: "In progress",
        inspections: "Not yet scheduled",
        punchList: "None",
        changeOrders: "None",
      },
      communication: {
        projectNotes: ["Coordinate access with property manager before mobilization."],
        customerComplaints: [],
        callHistory: ["Initial project handoff completed."],
        emailSummaries: ["Pre-construction notice sent to stakeholders."],
        internalComments: ["Proceed once permit date is confirmed."],
        followUpDeadlines: ["Permit follow-up due next week."],
      },
      actionItems: [
        { id: "sterling-permit", title: "Confirm permit timing", dueDate: "2026-07-21", status: "Open", assignedEmployeeId: "", assignedEmployeeName: "Office" },
      ],
      activityLog: [
        { id: "sterling-activity-1", summary: "Project created and pre-construction started.", changedBy: "Office", createdAt: "2026-07-14T09:00:00-07:00" },
      ],
    },
    {
      id: "active-job-180-fuller-institute",
      jobNumber: "180",
      projectName: "Fuller Institute",
      address: "Fuller Institute, 123 Main Street, Riverside, CA",
      customer: "Fuller Institute",
      propertyOwner: "Fuller Institute",
      propertyManager: "Daniela",
      contractAmount: 180000,
      status: "Scheduled",
      currentPhase: "Permit pending",
      statusTone: "yellow",
      riskLevel: "Needs attention",
      riskTone: "yellow",
      riskReason: "Permit still needs to be pulled in person before mobilization.",
      startDate: "2026-08-04",
      expectedCompletionDate: "2026-09-12",
      percentComplete: 0,
      projectDescription: "Scheduled commercial reroof awaiting permit coordination and subcontractor scheduling.",
      projectContact: "Daniela",
      projectManager: "Maria Lopez",
      fieldSupervisor: "Pending assignment",
      foreman: "TBD",
      salesperson: "Chris",
      officeCoordinator: "Natalia",
      openIssuesCount: 1,
      amountBilled: 0,
      amountCollected: 0,
      remainingContractValue: 180000,
      isActive: true,
      issues: [
        {
          id: "issue-fuller-permit",
          issueNumber: "ISS-0001",
          category: "Scheduling",
          description: "Permit still needs to be pulled in person.",
          priority: "High",
          status: "New",
          callerName: "Daniela",
          callerCompany: "Fuller Institute",
          phone: "(555) 202-3001",
          email: "daniela@fullerinstitute.edu",
          assignedEmployeeName: "Jorge",
          followUpDeadline: "2026-07-18",
          createdAt: "2026-07-14T11:15:00-07:00",
        },
      ],
      team: [
        { role: "Project contact", name: "Daniela", company: "Fuller Institute", phone: "(555) 202-3001", email: "daniela@fullerinstitute.edu", preferredContactMethod: "Email" },
        { role: "Office coordinator", name: "Natalia", company: "CRT Roofing", phone: "(555) 101-2004", email: "natalia@crtroofing.com", preferredContactMethod: "Email" },
      ],
      outsideContacts: [
        { role: "Property manager", name: "Daniela", company: "Fuller Institute", phone: "(555) 202-3001", email: "daniela@fullerinstitute.edu", preferredContactMethod: "Email" },
      ],
      operations: {
        schedule: "Schedule sent to subcontractors and ownership.",
        dailyJobLogs: 0,
        crewHours: 0,
        photos: 0,
        materials: "Permit and access coordination only",
        subcontractorCoordination: "No field work started yet.",
        permitStatus: "Permit pending",
        inspections: "Pending permit issuance",
        punchList: "None",
        changeOrders: "None",
      },
      communication: {
        projectNotes: ["Permit still needs to be pulled in person."],
        customerComplaints: ["No complaints logged yet."],
        callHistory: ["Schedule reviewed with ownership and subcontractors."],
        emailSummaries: ["Schedule sent to subcontractors and ownership."],
        internalComments: ["Escalate if permit is delayed past the start date."],
        followUpDeadlines: ["Permit follow-up due before start date."],
      },
      actionItems: [
        { id: "fuller-permit", title: "Pull permit in person", dueDate: "2026-07-17", status: "Open", assignedEmployeeId: "", assignedEmployeeName: "Office" },
      ],
      activityLog: [
        { id: "fuller-activity-1", summary: "Project scheduled and permit follow-up created.", changedBy: "Office", createdAt: "2026-07-14T10:30:00-07:00" },
      ],
    },
  ];
}

function createSeedApprovedJobs() {
  return [
    {
      id: "approved-job-11671-sterling",
      jobNumber: "11671",
      customerName: "Sterling Property Management",
      projectName: "11671 Sterling Avenue",
      projectAddress: "11671 Sterling Ave., Bloomington, CA",
      contractAmount: 82000,
      approvalDate: "2026-07-11",
      anticipatedStartDate: "2026-07-24",
      projectStatus: "Pre-construction",
      projectContact: "Jorge",
      fieldSupervisor: "Jorge's father",
      permitStatus: "Pending",
      documentsIncomplete: true,
      subcontractorIncomplete: false,
      materialOrderIncomplete: true,
      customerDocumentIncomplete: false,
      warningText: "Permit and material order still need confirmation.",
      salesperson: "Chris",
      estimatedStartDays: 9,
      actionButtonLabel: "Open",
      isActive: true,
    },
    {
      id: "approved-job-180-fuller-institute",
      jobNumber: "180",
      customerName: "Fuller Institute",
      projectName: "Fuller Institute Roof",
      projectAddress: "180 N. Oakland Ave., Pasadena, CA",
      contractAmount: 98000,
      approvalDate: "2026-07-08",
      anticipatedStartDate: "2026-08-04",
      projectStatus: "Permit pending",
      projectContact: "Daniela",
      fieldSupervisor: "TBD",
      permitStatus: "Pending",
      documentsIncomplete: true,
      subcontractorIncomplete: true,
      materialOrderIncomplete: false,
      customerDocumentIncomplete: false,
      warningText: "Permit not yet issued.",
      salesperson: "Natalia",
      estimatedStartDays: 20,
      actionButtonLabel: "Open",
      isActive: true,
    },
    {
      id: "approved-job-217-laguna-hills",
      jobNumber: "217",
      customerName: "Laguna Hills HOA",
      projectName: "Clubhouse Re-roof",
      projectAddress: "217 Palm Blvd., Irvine, CA",
      contractAmount: 154500,
      approvalDate: "2026-07-01",
      anticipatedStartDate: "2026-07-18",
      projectStatus: "Materials pending",
      projectContact: "Megan",
      fieldSupervisor: "Carlos",
      permitStatus: "Issued",
      documentsIncomplete: false,
      subcontractorIncomplete: false,
      materialOrderIncomplete: true,
      customerDocumentIncomplete: false,
      warningText: "Material order still pending.",
      salesperson: "Chris",
      estimatedStartDays: 2,
      actionButtonLabel: "Open",
      isActive: true,
    },
    {
      id: "approved-job-244-riverside-medical",
      jobNumber: "244",
      customerName: "Riverside Medical Center",
      projectName: "ER Wing Roof",
      projectAddress: "244 Hospital Way, Riverside, CA",
      contractAmount: 224000,
      approvalDate: "2026-06-29",
      anticipatedStartDate: "2026-07-17",
      projectStatus: "Ready to schedule",
      projectContact: "Tanya",
      fieldSupervisor: "Jorge",
      permitStatus: "Issued",
      documentsIncomplete: false,
      subcontractorIncomplete: false,
      materialOrderIncomplete: false,
      customerDocumentIncomplete: true,
      warningText: "Customer document signature pending.",
      salesperson: "Natalia",
      estimatedStartDays: 1,
      actionButtonLabel: "Open",
      isActive: true,
    },
    {
      id: "approved-job-301-oak-terrace",
      jobNumber: "301",
      customerName: "Oak Terrace Apartments",
      projectName: "Tower C",
      projectAddress: "301 Oak Terrace Dr., Ontario, CA",
      contractAmount: 132000,
      approvalDate: "2026-06-27",
      anticipatedStartDate: "2026-07-29",
      projectStatus: "Scheduled",
      projectContact: "Ramon",
      fieldSupervisor: "Miguel",
      permitStatus: "Issued",
      documentsIncomplete: false,
      subcontractorIncomplete: false,
      materialOrderIncomplete: false,
      customerDocumentIncomplete: false,
      warningText: "",
      salesperson: "Chris",
      estimatedStartDays: 13,
      actionButtonLabel: "Open",
      isActive: true,
    },
    {
      id: "approved-job-412-sierra-trade-center",
      jobNumber: "412",
      customerName: "Sierra Trade Center",
      projectName: "Building B",
      projectAddress: "412 Sierra Way, Fontana, CA",
      contractAmount: 111500,
      approvalDate: "2026-06-20",
      anticipatedStartDate: "",
      projectStatus: "Start Date Needed",
      projectContact: "Marco",
      fieldSupervisor: "TBD",
      permitStatus: "Waiting",
      documentsIncomplete: true,
      subcontractorIncomplete: true,
      materialOrderIncomplete: true,
      customerDocumentIncomplete: true,
      warningText: "Start date, permit, and order checklist still need attention.",
      salesperson: "Natalia",
      estimatedStartDays: 999,
      actionButtonLabel: "Open",
      isActive: true,
    },
  ];
}

function createBlankProposal() {
  const now = new Date().toISOString();
  return {
    id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    templateId: DEFAULT_PROPOSAL_TEMPLATE_ID,
    proposalNumber: 1,
    version: 1,
    status: "Draft",
    proposalTitle: "",
    customerName: "",
    customerContact: "",
    projectName: "",
    projectAddress: "",
    estimateNumber: "",
    estimateCode: "",
    estimateDate: "",
    roofSystem: "",
    scopeItems: [],
    quantities: [],
    unitPrices: [],
    alternates: [],
    exclusions: [],
    allowances: [],
    taxes: [],
    totalPrice: 0,
    salesperson: "",
    internalJobNotes: "",
    warranty: "",
    paymentSchedule: "",
    estimatedSchedule: "",
    termsAndConditions: "",
    expirationDate: "",
    attachments: [],
    photos: [],
    supportingReports: [],
    approvalRequired: true,
    approvalThreshold: 10000,
    approvalReviewLevel: "Estimator",
    sentAt: "",
    sentBy: "",
    sentTo: "",
    ccRecipients: "",
    message: "",
    customerAcceptance: null,
    acceptanceStatus: "Pending",
    signatureStatus: "Unsigned",
    viewedAt: "",
    finalizedAt: "",
    isFinalized: false,
    pdfArchiveName: "",
    pdfArchiveDataUrl: "",
    pdfArchiveUpdatedAt: "",
    templateSnapshot: { ...DEFAULT_PROPOSAL_TEMPLATE },
    sourceEstimateSnapshot: null,
    proposalSections: [],
    proposalHistory: [],
    sourceEstimateId: "",
    sourceEstimateCode: "",
    createdAt: now,
    updatedAt: now,
  };
}

function createBlankProposalTemplate() {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_PROPOSAL_TEMPLATE,
    id: DEFAULT_PROPOSAL_TEMPLATE_ID,
    templateName: DEFAULT_PROPOSAL_TEMPLATE.templateName,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeProposalTemplate(template = {}) {
  const now = new Date().toISOString();
  const merged = {
    ...createBlankProposalTemplate(),
    ...template,
    sectionOrder: Array.isArray(template.sectionOrder) && template.sectionOrder.length ? template.sectionOrder : [...DEFAULT_PROPOSAL_TEMPLATE.sectionOrder],
  };
  return {
    ...merged,
    id: String(template.id || merged.id || DEFAULT_PROPOSAL_TEMPLATE_ID),
    templateName: String(template.templateName || merged.templateName || "CRT Proposal Baseline"),
    brandName: String(template.brandName || merged.brandName || "CRT Roofing"),
    coverPageTitle: String(template.coverPageTitle || merged.coverPageTitle || DEFAULT_PROPOSAL_TEMPLATE.coverPageTitle),
    coverPageSubtitle: String(template.coverPageSubtitle || merged.coverPageSubtitle || DEFAULT_PROPOSAL_TEMPLATE.coverPageSubtitle),
    executiveSummaryTitle: String(template.executiveSummaryTitle || merged.executiveSummaryTitle || DEFAULT_PROPOSAL_TEMPLATE.executiveSummaryTitle),
    executiveSummaryBody: String(template.executiveSummaryBody || merged.executiveSummaryBody || DEFAULT_PROPOSAL_TEMPLATE.executiveSummaryBody),
    scopeOfWorkTitle: String(template.scopeOfWorkTitle || merged.scopeOfWorkTitle || DEFAULT_PROPOSAL_TEMPLATE.scopeOfWorkTitle),
    scopeOfWorkIntro: String(template.scopeOfWorkIntro || merged.scopeOfWorkIntro || DEFAULT_PROPOSAL_TEMPLATE.scopeOfWorkIntro),
    photoTitle: String(template.photoTitle || merged.photoTitle || DEFAULT_PROPOSAL_TEMPLATE.photoTitle),
    upgradeOptionsTitle: String(template.upgradeOptionsTitle || merged.upgradeOptionsTitle || DEFAULT_PROPOSAL_TEMPLATE.upgradeOptionsTitle),
    productInformationTitle: String(template.productInformationTitle || merged.productInformationTitle || DEFAULT_PROPOSAL_TEMPLATE.productInformationTitle),
    warrantyComparisonTitle: String(template.warrantyComparisonTitle || merged.warrantyComparisonTitle || DEFAULT_PROPOSAL_TEMPLATE.warrantyComparisonTitle),
    pricingTitle: String(template.pricingTitle || merged.pricingTitle || DEFAULT_PROPOSAL_TEMPLATE.pricingTitle),
    signatureTitle: String(template.signatureTitle || merged.signatureTitle || DEFAULT_PROPOSAL_TEMPLATE.signatureTitle),
    legalTitle: String(template.legalTitle || merged.legalTitle || DEFAULT_PROPOSAL_TEMPLATE.legalTitle),
    paymentTermsTitle: String(template.paymentTermsTitle || merged.paymentTermsTitle || DEFAULT_PROPOSAL_TEMPLATE.paymentTermsTitle),
    paymentTerms: String(template.paymentTerms || merged.paymentTerms || DEFAULT_PROPOSAL_TEMPLATE.paymentTerms),
    contractLanguage: String(template.contractLanguage || merged.contractLanguage || DEFAULT_PROPOSAL_TEMPLATE.contractLanguage),
    signatureLineLabel: String(template.signatureLineLabel || merged.signatureLineLabel || DEFAULT_PROPOSAL_TEMPLATE.signatureLineLabel),
    signatureDateLabel: String(template.signatureDateLabel || merged.signatureDateLabel || DEFAULT_PROPOSAL_TEMPLATE.signatureDateLabel),
    legalNotice: String(template.legalNotice || merged.legalNotice || DEFAULT_PROPOSAL_TEMPLATE.legalNotice),
    footerText: String(template.footerText || merged.footerText || DEFAULT_PROPOSAL_TEMPLATE.footerText),
    createdAt: String(template.createdAt || merged.createdAt || now),
    updatedAt: String(template.updatedAt || merged.updatedAt || now),
  };
}

function proposalIsFinalized(proposal = {}) {
  return Boolean(
    proposal.isFinalized ||
      proposal.finalizedAt ||
      [proposal.status, proposal.acceptanceStatus, proposal.signatureStatus].some((value) => ["accepted", "declined", "expired"].includes(String(value || "").toLowerCase())),
  );
}

function buildProposalScopeItemsFromEstimate(estimate = {}) {
  const roofSystem = estimate?.summary?.roofType || buildEstimateRoofType(estimate?.inputs || {});
  return [
    (estimate?.inputs?.serviceScope || estimate?.inputs?.maintenanceNotes) ? { label: "Service scope", value: estimate.inputs.serviceScope || estimate.inputs.maintenanceNotes } : null,
    estimate?.inputs?.jobName ? { label: "Project name", value: estimate.inputs.jobName } : null,
    estimate?.inputs?.jobAddress ? { label: "Project address", value: estimate.inputs.jobAddress } : null,
    estimate?.inputs?.customerName ? { label: "Customer", value: estimate.inputs.customerName } : null,
    estimate?.inputs?.customerContact ? { label: "Customer contact", value: estimate.inputs.customerContact } : null,
    estimate?.inputs?.totalSquares != null ? { label: "Total squares", value: `${num(estimate.inputs.totalSquares, 0)} SQ` } : null,
    roofSystem ? { label: "Roof system", value: roofSystem } : null,
    estimate?.summary?.selectedBidAmount != null ? { label: "Proposal price", value: money(estimate.summary.selectedBidAmount) } : null,
  ].filter(Boolean);
}

function buildProposalSections(proposal = {}, estimate = null, template = DEFAULT_PROPOSAL_TEMPLATE) {
  const activeTemplate = normalizeProposalTemplate(template);
  const sourceEstimate = estimate || proposal?.sourceEstimateSnapshot || null;
  const scopeItems = Array.isArray(proposal.scopeItems) && proposal.scopeItems.length ? proposal.scopeItems : buildProposalScopeItemsFromEstimate(sourceEstimate || {});
  const photoItems = Array.isArray(proposal.photos) ? proposal.photos : [];
  const supportingReports = Array.isArray(proposal.supportingReports) ? proposal.supportingReports : [];
  const alternates = Array.isArray(proposal.alternates) ? proposal.alternates : [];
  const exclusions = Array.isArray(proposal.exclusions) ? proposal.exclusions : [];
  const allowances = Array.isArray(proposal.allowances) ? proposal.allowances : [];
  const taxes = Array.isArray(proposal.taxes) ? proposal.taxes : [];

  const sectionMap = {
    coverPage: {
      key: "coverPage",
      title: activeTemplate.coverPageTitle,
      subtitle: activeTemplate.coverPageSubtitle,
      lines: [
        ["Proposal number", proposal.proposalNumber || "—"],
        ["Version", proposal.version || 1],
        ["Customer", proposal.customerName || sourceEstimate?.inputs?.customerName || "—"],
        ["Project", proposal.projectName || sourceEstimate?.inputs?.jobName || "—"],
        ["Address", proposal.projectAddress || sourceEstimate?.inputs?.jobAddress || "—"],
        ["Estimate code", proposal.estimateCode || sourceEstimate?.estimateCode || "—"],
        ["Salesperson", proposal.salesperson || sourceEstimate?.inputs?.salesperson || "—"],
        ["Status", proposal.status || "Draft"],
      ],
    },
    executiveSummary: {
      key: "executiveSummary",
      title: activeTemplate.executiveSummaryTitle,
      paragraphs: [
        activeTemplate.executiveSummaryBody,
        proposal.message ? `Customer message: ${proposal.message}` : "",
      ].filter(Boolean),
      lines: [
        ["Current total", money(proposal.totalPrice || 0)],
        ["Sent date", proposal.sentAt ? String(proposal.sentAt).slice(0, 10) : "Not sent"],
        ["Viewed date", proposal.viewedAt ? String(proposal.viewedAt).slice(0, 10) : "Not viewed"],
        ["Acceptance", proposal.acceptanceStatus || "Pending"],
        ["Signature", proposal.signatureStatus || "Unsigned"],
      ],
    },
    scopeOfWork: {
      key: "scopeOfWork",
      title: activeTemplate.scopeOfWorkTitle,
      subtitle: activeTemplate.scopeOfWorkIntro,
      items: scopeItems,
    },
    photos: {
      key: "photos",
      title: activeTemplate.photoTitle,
      lines: [
        ["Attached photos", num(photoItems.length, 0)],
        ["Supporting reports", num(supportingReports.length, 0)],
      ],
      items: photoItems.map((photo, index) => ({ label: `Photo ${index + 1}`, value: photo.fileName || photo.name || photo.label || "Attached photo" })),
    },
    upgradeOptions: {
      key: "upgradeOptions",
      title: activeTemplate.upgradeOptionsTitle,
      items: alternates.length ? alternates.map((item, index) => ({ label: `Alternate ${index + 1}`, value: item })) : [{ label: "Alternates", value: "None listed" }],
    },
    productInformation: {
      key: "productInformation",
      title: activeTemplate.productInformationTitle,
      items: supportingReports.length
        ? supportingReports.map((item, index) => ({ label: `Report ${index + 1}`, value: item.fileName || item.name || item.label || "Supporting report" }))
        : [{ label: "Product information", value: "No supporting product information attached" }],
    },
    warrantyComparison: {
      key: "warrantyComparison",
      title: activeTemplate.warrantyComparisonTitle,
      paragraphs: [proposal.warranty || "No warranty language has been entered yet."],
    },
    pricing: {
      key: "pricing",
      title: activeTemplate.pricingTitle,
      lines: [
        ["Proposal price", money(proposal.totalPrice || 0)],
        ["Allowances", num(allowances.length, 0)],
        ["Taxes", num(taxes.length, 0)],
      ],
      items: [
        ...allowances.map((item, index) => ({ label: `Allowance ${index + 1}`, value: item })),
        ...taxes.map((item, index) => ({ label: `Tax ${index + 1}`, value: item })),
      ],
    },
    signature: {
      key: "signature",
      title: activeTemplate.signatureTitle,
      lines: [
        ["Signature line", activeTemplate.signatureLineLabel],
        ["Date line", activeTemplate.signatureDateLabel],
        ["Acceptance status", proposal.acceptanceStatus || "Pending"],
        ["Signature status", proposal.signatureStatus || "Unsigned"],
      ],
      paragraphs: [proposal.paymentSchedule || activeTemplate.paymentTerms || ""].filter(Boolean),
    },
    legal: {
      key: "legal",
      title: activeTemplate.legalTitle,
      paragraphs: [activeTemplate.contractLanguage, activeTemplate.legalNotice, proposal.termsAndConditions || ""].filter(Boolean),
      items: [
        { label: activeTemplate.paymentTermsTitle, value: proposal.paymentSchedule || activeTemplate.paymentTerms || "" },
        { label: "Expiration date", value: proposal.expirationDate || "Not set" },
      ],
    },
  };

  const orderedKeys = Array.isArray(activeTemplate.sectionOrder) && activeTemplate.sectionOrder.length ? activeTemplate.sectionOrder : [...DEFAULT_PROPOSAL_TEMPLATE.sectionOrder];
  const orderedSections = orderedKeys.map((key) => sectionMap[key]).filter(Boolean);
  const remainingSections = Object.keys(sectionMap)
    .filter((key) => !orderedKeys.includes(key))
    .map((key) => sectionMap[key]);

  return [...orderedSections, ...remainingSections];
}

function createProposalPdfFileName(proposal = {}) {
  const baseName = String(proposal.proposalTitle || proposal.projectName || proposal.customerName || proposal.estimateCode || "proposal")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
  const version = num(proposal.version || 1, 0);
  return `${baseName || "proposal"}_v${version}_${Date.now()}.pdf`;
}

function createProposalFromEstimate(estimate, template = DEFAULT_PROPOSAL_TEMPLATE) {
  const now = new Date().toISOString();
  const proposalDate = String(estimate?.savedAt || estimate?.createdAt || now).slice(0, 10);
  const roofSystem = estimate?.summary?.roofType || buildEstimateRoofType(estimate?.inputs || {});
  const normalizedTemplate = normalizeProposalTemplate(template);
  const scopeItems = buildProposalScopeItemsFromEstimate(estimate);
  const sourceEstimateSnapshot = estimate
    ? {
        id: estimate.id || "",
        estimateNumber: estimate.estimateNumber || 0,
        estimateCode: estimate.estimateCode || "",
        estimateType: estimate.estimateType || "",
        name: estimate.name || "",
        savedAt: estimate.savedAt || estimate.createdAt || now,
        inputs: estimate.inputs || {},
        summary: estimate.summary || {},
      }
    : null;

  return {
    ...createBlankProposal(),
    id: `proposal-${estimate?.id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    templateId: normalizedTemplate.id,
    proposalNumber: Number(estimate?.estimateNumber || 1),
    version: 1,
    proposalTitle: `${estimate?.name || estimate?.estimateCode || "Proposal"}`,
    customerName: estimate?.inputs?.customerName || "",
    customerContact: estimate?.inputs?.customerContact || "",
    projectName: estimate?.inputs?.jobName || "",
    projectAddress: estimate?.inputs?.jobAddress || "",
    estimateNumber: estimate?.estimateNumber || "",
    estimateCode: estimate?.estimateCode || "",
    estimateDate: proposalDate,
    roofSystem,
    scopeItems,
    quantities: [],
    unitPrices: [],
    alternates: estimate?.inputs?.proposalAlternates || [],
    exclusions: estimate?.inputs?.proposalExclusions || [],
    allowances: estimate?.inputs?.proposalAllowances || [],
    taxes: estimate?.inputs?.proposalTaxes || [],
    totalPrice: toNumber(estimate?.summary?.selectedBidAmount || 0),
    salesperson: estimate?.inputs?.salesperson || "",
    warranty: estimate?.inputs?.proposalWarranty || "",
    paymentSchedule: estimate?.inputs?.proposalPaymentSchedule || "",
    estimatedSchedule: estimate?.inputs?.proposalSchedule || "",
    termsAndConditions: estimate?.inputs?.proposalTerms || "",
    expirationDate: estimate?.inputs?.proposalExpirationDate || "",
    sourceEstimateId: estimate?.id || "",
    sourceEstimateCode: estimate?.estimateCode || "",
    acceptanceStatus: "Pending",
    signatureStatus: "Unsigned",
    viewedAt: "",
    finalizedAt: "",
    isFinalized: false,
    pdfArchiveName: "",
    pdfArchiveDataUrl: "",
    pdfArchiveUpdatedAt: "",
    templateSnapshot: normalizedTemplate,
    sourceEstimateSnapshot,
    proposalSections: buildProposalSections({}, estimate, normalizedTemplate),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeProposalRecord(proposal = {}) {
  const base = createBlankProposal();
  const templateSnapshot = normalizeProposalTemplate(proposal.templateSnapshot || proposal.template || DEFAULT_PROPOSAL_TEMPLATE);
  const sourceEstimateSnapshot = proposal.sourceEstimateSnapshot && typeof proposal.sourceEstimateSnapshot === "object" ? proposal.sourceEstimateSnapshot : null;
  return {
    ...base,
    ...proposal,
    templateId: String(proposal.templateId || templateSnapshot.id || DEFAULT_PROPOSAL_TEMPLATE_ID),
    templateSnapshot,
    sourceEstimateSnapshot,
    proposalSections: Array.isArray(proposal.proposalSections) ? proposal.proposalSections : [],
    customerAcceptance: proposal.customerAcceptance && typeof proposal.customerAcceptance === "object" ? proposal.customerAcceptance : null,
    acceptanceStatus: String(proposal.acceptanceStatus || proposal.customerAcceptance?.status || "Pending"),
    signatureStatus: String(proposal.signatureStatus || "Unsigned"),
    viewedAt: String(proposal.viewedAt || ""),
    finalizedAt: String(proposal.finalizedAt || ""),
    isFinalized: Boolean(proposal.isFinalized || proposal.finalizedAt),
    pdfArchiveName: String(proposal.pdfArchiveName || ""),
    pdfArchiveDataUrl: String(proposal.pdfArchiveDataUrl || ""),
    pdfArchiveUpdatedAt: String(proposal.pdfArchiveUpdatedAt || ""),
    sentAt: String(proposal.sentAt || ""),
    sentBy: String(proposal.sentBy || ""),
    sentTo: String(proposal.sentTo || ""),
    ccRecipients: String(proposal.ccRecipients || ""),
    updatedAt: String(proposal.updatedAt || proposal.createdAt || new Date().toISOString()),
    createdAt: String(proposal.createdAt || new Date().toISOString()),
  };
}

function syncProposalWithEstimate(proposal = {}, estimate = null, template = DEFAULT_PROPOSAL_TEMPLATE) {
  const normalizedProposal = normalizeProposalRecord(proposal);
  if (proposalIsFinalized(normalizedProposal)) {
    return normalizedProposal;
  }

  const normalizedTemplate = normalizeProposalTemplate(template || normalizedProposal.templateSnapshot || DEFAULT_PROPOSAL_TEMPLATE);
  const sourceEstimate = estimate || normalizedProposal.sourceEstimateSnapshot || null;
  if (!sourceEstimate) {
    return {
      ...normalizedProposal,
      templateId: normalizedTemplate.id,
      templateSnapshot: normalizedTemplate,
      proposalSections: buildProposalSections(normalizedProposal, null, normalizedTemplate),
    };
  }

  const currentScopeItems = buildProposalScopeItemsFromEstimate(sourceEstimate);
  const synced = {
    ...normalizedProposal,
    templateId: normalizedTemplate.id,
    templateSnapshot: normalizedTemplate,
    customerName: sourceEstimate?.inputs?.customerName || normalizedProposal.customerName || "",
    customerContact: sourceEstimate?.inputs?.customerContact || normalizedProposal.customerContact || "",
    projectName: sourceEstimate?.inputs?.jobName || normalizedProposal.projectName || "",
    projectAddress: sourceEstimate?.inputs?.jobAddress || normalizedProposal.projectAddress || "",
    estimateNumber: sourceEstimate?.estimateNumber || normalizedProposal.estimateNumber || "",
    estimateCode: sourceEstimate?.estimateCode || normalizedProposal.estimateCode || "",
    estimateDate: String(sourceEstimate?.savedAt || sourceEstimate?.createdAt || normalizedProposal.estimateDate || new Date().toISOString()).slice(0, 10),
    roofSystem: sourceEstimate?.summary?.roofType || normalizedProposal.roofSystem || "",
    scopeItems: currentScopeItems,
    alternates: sourceEstimate?.inputs?.proposalAlternates || normalizedProposal.alternates || [],
    exclusions: sourceEstimate?.inputs?.proposalExclusions || normalizedProposal.exclusions || [],
    allowances: sourceEstimate?.inputs?.proposalAllowances || normalizedProposal.allowances || [],
    taxes: sourceEstimate?.inputs?.proposalTaxes || normalizedProposal.taxes || [],
    totalPrice: toNumber(sourceEstimate?.summary?.selectedBidAmount ?? normalizedProposal.totalPrice ?? 0),
    salesperson: sourceEstimate?.inputs?.salesperson || normalizedProposal.salesperson || "",
    warranty: sourceEstimate?.inputs?.proposalWarranty || normalizedProposal.warranty || normalizedTemplate.contractLanguage,
    paymentSchedule: sourceEstimate?.inputs?.proposalPaymentSchedule || normalizedProposal.paymentSchedule || normalizedTemplate.paymentTerms,
    estimatedSchedule: sourceEstimate?.inputs?.proposalSchedule || normalizedProposal.estimatedSchedule || "",
    termsAndConditions: sourceEstimate?.inputs?.proposalTerms || normalizedProposal.termsAndConditions || normalizedTemplate.contractLanguage,
    expirationDate: sourceEstimate?.inputs?.proposalExpirationDate || normalizedProposal.expirationDate || "",
    sourceEstimateId: sourceEstimate?.id || normalizedProposal.sourceEstimateId || "",
    sourceEstimateCode: sourceEstimate?.estimateCode || normalizedProposal.sourceEstimateCode || "",
    sourceEstimateSnapshot: {
      id: sourceEstimate?.id || normalizedProposal.sourceEstimateSnapshot?.id || "",
      estimateNumber: sourceEstimate?.estimateNumber || normalizedProposal.sourceEstimateSnapshot?.estimateNumber || 0,
      estimateCode: sourceEstimate?.estimateCode || normalizedProposal.sourceEstimateSnapshot?.estimateCode || "",
      estimateType: sourceEstimate?.estimateType || normalizedProposal.sourceEstimateSnapshot?.estimateType || "",
      name: sourceEstimate?.name || normalizedProposal.sourceEstimateSnapshot?.name || "",
      savedAt: sourceEstimate?.savedAt || sourceEstimate?.createdAt || normalizedProposal.sourceEstimateSnapshot?.savedAt || new Date().toISOString(),
      inputs: sourceEstimate?.inputs || normalizedProposal.sourceEstimateSnapshot?.inputs || {},
      summary: sourceEstimate?.summary || normalizedProposal.sourceEstimateSnapshot?.summary || {},
    },
    proposalSections: buildProposalSections(
      {
        ...normalizedProposal,
        ...proposal,
        scopeItems: currentScopeItems,
      },
      sourceEstimate,
      normalizedTemplate,
    ),
    updatedAt: new Date().toISOString(),
  };

  return synced;
}

function createBlankActiveJobIssue(project = null) {
  return {
    id: createFieldDailyLogId(),
    projectId: project?.id || "",
    projectName: project?.projectName || "",
    jobNumber: project?.jobNumber || "",
    dateTime: new Date().toISOString().slice(0, 16),
    callerName: "",
    callerCompany: "",
    phone: "",
    email: "",
    issueCategory: "Other",
    description: "",
    priority: "Normal",
    assignedEmployeeId: "",
    assignedEmployeeName: "",
    followUpDeadline: "",
    currentStatus: "New",
    reason: "",
    response: "",
  };
}

function isActiveJobStatus(status) {
  return ACTIVE_JOB_ACTIVE_STATUSES.has(String(status || "").toLowerCase());
}

function getActiveJobSearchText(job) {
  return [
    job.jobNumber,
    job.projectName,
    job.customer,
    job.propertyOwner,
    job.propertyManager,
    job.address,
    job.currentPhase,
    job.projectContact,
    job.fieldSupervisor,
    job.salesperson,
    job.officeCoordinator,
    job.riskLevel,
    job.status,
    job.riskReason,
    ...(job.issues || []).flatMap((issue) => [issue.issueNumber, issue.category, issue.description, issue.priority, issue.status]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getActiveJobOpenIssuesCount(job) {
  return (job.issues || []).filter((issue) => !["resolved", "closed"].includes(String(issue.status || "").toLowerCase())).length;
}

function buildActiveJobSuggestedResponse(project) {
  if (!project) {
    return "Thanks for the update. We are reviewing it now and will follow up shortly.";
  }
  return `Thanks for reporting this on ${project.projectName || "the job"}. We received the issue, are reviewing the details, and will follow up with the next step shortly.`;
}

const ADMIN_PRICING_SECTIONS = {
  materials: [
    ["tpoRollPrice", "TPO roll price"],
    ["isoSheetPrice", "ISO sheet price"],
    ["denseDeckSheetPrice", "Dense deck sheet price"],
    ["fastenerCost", "Fastener cost"],
    ["plateCost", "Plate cost"],
  ],
  labor: [
    ["laborPerSquare", "Labor per square"],
    ["tearOffPerSquare", "Tear-off per square"],
  ],
  companyDefaults: [
    ["wastePercent", "Waste %"],
    ["taxPercent", "Tax %"],
    ["overheadPercent", "Overhead %"],
    ["profitPercent", "Profit %"],
  ],
};

function normalizeAdminPricing(values = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_ADMIN_PRICING).map(([key, defaultValue]) => [key, Math.max(0, toNumber(values[key], defaultValue))]),
  );
}

function normalizeTravelAdminSettings(values = {}) {
  const source = values && typeof values === "object" ? values : {};
  const companyHqAddress = String(source.companyHqAddress || DEFAULT_TRAVEL_ADMIN_SETTINGS.companyHqAddress).trim() || DEFAULT_TRAVEL_ADMIN_SETTINGS.companyHqAddress;
  const travelDriverHourlyRate = Math.max(0, toNumber(source.travelDriverHourlyRate, DEFAULT_TRAVEL_ADMIN_SETTINGS.travelDriverHourlyRate));
  const fuelCostPerGallon = Math.max(0, toNumber(source.fuelCostPerGallon, DEFAULT_TRAVEL_ADMIN_SETTINGS.fuelCostPerGallon));
  const vehicleSource = source.vehicleMpgByKey && typeof source.vehicleMpgByKey === "object" ? source.vehicleMpgByKey : {};
  const vehicleMpgByKey = Object.fromEntries(
    TRAVEL_VEHICLE_OPTIONS.map((option) => [option.value, Math.max(0.1, toNumber(vehicleSource[option.value], option.mpg))]),
  );

  return {
    companyHqAddress,
    travelDriverHourlyRate,
    fuelCostPerGallon,
    vehicleMpgByKey,
  };
}

function createBlankSubcontractorAddOnItem() {
  return { description: "", quantity: 0, unitPrice: 0 };
}

const MATERIAL_PRICE_FIELDS = [
  ["starterRollCost", "5ft TPO roll"],
  ["fieldRollCost", "10ft TPO roll"],
  ["parapetRollCost", "Parapet roll unit cost"],
  ["fanfoldBundleCost", "Fanfold bundle"],
  ["denseDeckSheetCost", "Dense deck sheet"],
  ["rigidInsulationSheetCost", "Rigid insulation sheet"],
  ["parapetAdhesiveTankCost", "Parapet adhesive tank"],
  ["detailMembraneRollCost", "Detail membrane roll"],
  ["tpoStripTapeCost", "TPO strip tape (50 LF roll)"],
  ["tJointPatchCost", "T-joint patch"],
  ["ventBootCost", "Vent boot"],
  ["pitchPocketUnitCost", "Pitch pocket unit"],
  ["pourableSealantCostPerPocket", "Pourable sealant per pocket"],
  ["pitchPocketLaborCostPerPocket", "Pitch pocket labor per pocket"],
  ["termBarCost", "Term bar piece"],
  ["termBarFastenerCost", "Term bar fastener"],
  ["termBarSealantCost", "Term bar sealant / waterblock allowance"],
  ["copingMetalCost", "Coping metal per LF"],
  ["copingCleatCost", "Coping cleat per LF"],
  ["copingCleatFastenerCost", "Coping cleat fastener"],
  ["dripEdgeCost", "Drip edge per LF"],
  ["dripEdgeFastenerCost", "Drip edge fastener"],
  ["parnahPlateCost", "Paranah plate"],
  ["twoInFastenerCost", "2 inch fastener"],
  ["insulationPlateCost", "Insulation plate"],
  ["insulationFastenerCost", "Insulation fastener"],
];

const LOGO_SRC = "/crt-logo-white-letters.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_INPUTS = {
  totalSquares: 100,
  fieldSquares: 100,
  roofPerimeterLf: 0,
  parapetLinearFeet: 0,
  parapetWallHeight: 4,
  includeParapetWalls: false,
  jobType: "",
  existingRoofAction: "",
  tearOffLayers: 1,
  isDoubleHandleTearOff: false,
  substrateType: "",
  requestedRValue: 11,
  denseDeckExtraSheets: 0,

  terminationMethod: "",
  multiTerminationRows: [
    // { type: '', linearFeet: 0 }
  ],
  copingLinearFeet: 0,
  copingCleatRequired: false,
  dripEdgeLinearFeet: 0,
  termBarLinearFeet: 0,
  manualTerminationCost: 0,
  terminationNotes: "",
  stripInDetailAllowanceCost: 0,

  roofJacks: 0,
  ventsTtops: 0,
  largePenetrations2ft: 0,
  veryLargePenetrations4ft: 0,
  detailDrains: 0,
  detailScuppers: 0,
  detailPitchPockets: 0,
  detailAcUnits: 0,
  tJointPatches: 0,
  ventBoots: 0,
  acDetailType: "cornersOnly",
  miscIrregularDetails: 0,
  manualDetailMembraneRolls: 0,

  pitchPockets: 0,
  manualPitchPocketTotalCost: 0,

  inspectionJobName: "",
  inspectionCustomerName: "",
  inspectionJobAddress: "",
  inspectionDate: "",
  inspectionTechnicianName: "",
  inspectionRoofTypeObserved: "",
  inspectionCustomerRequestedRoofPreference: "",
  inspectionRoofConditionNotes: "",
  inspectionAccessNotes: "",
  customMaterials: [],
  inspectionSafetyConcerns: "",
  inspectionExistingRoofLayers: "",
  inspectionAcUnitsCount: "",
  inspectionDrainsCount: "",
  inspectionScuppersCount: "",
  inspectionPenetrationsCount: "",
  inspectionParapetNotes: "",
  inspectionInternalNotes: "",

  maintenancePropertyAddress: "",
  maintenanceServiceType: "inspection",
  maintenanceNotes: "",

  totalAcUnits: 0,
  jackedUnits: 0,
  workedAroundUnits: 0,
  cranedUnits: 0,
  acDisconnectReconnectUnits: 0,
  isCraneNeeded: false,
  totalCraneHours: 0,

  jobName: "",
  customerName: "",
  jobAddress: "",
  sprayFoamSalesperson: "",
  sprayFoamEstimateType: "roof",
  wallFoamChargeMethod: "prorated",
  sprayFoamFieldRoofSquares: 0,
  sprayFoamSeparateRoofAreas: false,
  sprayFoamRoofAreas: [createBlankSprayFoamRoofArea()],
  sprayFoamMilesToLocation: 0,
  sprayFoamEstimatedCompletionDays: 0,
  sprayFoamTotalFieldSquares: 0,
  sprayFoamTotalRoofSquares: 0,
  sprayFoamParapetWallSquares: 0,
  sprayFoamUseMultipleParapetMeasurements: false,
  sprayFoamParapetMeasurements: [createBlankSprayFoamParapetMeasurement()],
  sprayFoamParapetLinearFeet: 0,
  sprayFoamParapetAverageHeight: 4,
  sprayFoamIncludeParapetsInProduction: false,
  sprayFoamLinearFeet: 0,
  sprayFoamDripEdgeRequired: false,
  sprayFoamCityPermitFee: 0,
  sprayFoamUrgency: "normal",
  sprayFoamFieldThickness: 2,
  sprayFoamWallThickness: 1,
  sprayFoamLaborersNeededPerDay: 0,
  sprayFoamPrevailingWageJob: false,
  sprayFoamPrevailingWageHourlyRate: 0,
  sprayFoamPrevailingWageCrewSize: 0,
  sprayFoamPrevailingWageHoursPerDay: 0,
  sprayFoamPrevailingWageJobDays: 0,
  sprayFoamTotalLaborers: 0,
  sprayFoamCustomBidAmount: "",
  sprayFoamCustomBidSelected: false,
  sprayFoamSkylightsRoofLoaded: false,
  sprayFoamRooftopDeliveryFee: 750,
  sprayFoamLodgingNeeded: false,
  sprayFoamLodgingName: "",
  sprayFoamNightlyLodgingCost: 0,
  sprayFoamLodgingNights: 0,
  sprayFoamSkylightCurbLumberBoardLengthFt: 16,
  sprayFoamSkylightCurbLumberBoardQuantity: "",
  sprayFoamSkylightCurbLumberBoardUnitCost: 0,
  sprayFoamHasSubcontractors: false,
  sprayFoamSubcontractorItems: [
    { ...createBlankSprayFoamSubcontractorItem("tear-off subcontractor"), quantity: 0, unitPrice: 0 },
    { ...createBlankSprayFoamSubcontractorItem("gravel vacuum subcontractor"), quantity: 0, unitPrice: 0 },
    { ...createBlankSprayFoamSubcontractorItem("hvac subcontractor"), quantity: 0, unitPrice: 0 },
    { ...createBlankSprayFoamSubcontractorItem("other sub-contractor"), quantity: 0, unitPrice: 0 },
  ],
  sprayFoamLayerConfig: DEFAULT_SPF_LAYER_CONFIG,
  sprayFoamDetailMaterials: DEFAULT_SPF_DETAIL_MATERIALS,
  sprayFoamAdditionalDetailMaterials: [],
  sprayFoamEquipmentRentals: [createBlankSprayFoamEquipmentRental()],

  shingleJobName: "",
  shingleCustomerName: "",
  shingleJobAddress: "",
  shingleSalesperson: "",
  shingleCityPermitFee: 0,
  shingleTotalRoofSquares: 0,
  shingleProductionSquares: 0,
  shingleHdzBundlesNeeded: 0,
  shingleStarterQuantity: 0,
  shingleDripEdgePieces: 0,
  shingleRapidRidgeBoxes: 0,
  shingleSyntheticUnderlaymentRolls: 0,
  shingleSyntheticUnderlaymentSuggestedRolls: 0,
  shingleSyntheticUnderlaymentCalculatedRolls: 0,
  shingleCoilNails125Quantity: 0,
  shingleCoilNails78Quantity: 0,
  shingleMarkingPaintQuantity: 0,
  shingleTinShinglesQuantity: 0,
  shingleRoofJack2Quantity: 0,
  shingleRoofJack15Quantity: 0,
  shingleRoofJack3Quantity: 0,
  shingleRoofJack4Quantity: 0,
  shingleAmericapOvalQuantity: 0,
  shingleAmericapRoundQuantity: 0,
  shingleOvalRoofJackQuantity: 0,
  shingleWastePercent: 15,
  shinglePerimeterLinearFeet: 0,
  shingleRidgeLinearFeet: 0,
  shingleHipLinearFeet: 0,
  shingleRidgeHipLinearFeet: 0,
  shingleValleyLinearFeet: 0,
  shingleRakeLinearFeet: 0,
  shingleEaveLinearFeet: 0,
  shingleDripEdgeLinearFeet: 0,
  shingleStarterLinearFeet: 0,
  shingleRidgeLf: 0,
  shingleHipLf: 0,
  shingleValleyLf: 0,
  shingleRakeLf: 0,
  shingleEaveLf: 0,
  shingleStarterLf: 0,
  shingleDripEdgeLf: 0,
  shinglePipeJacksCount: 0,
  shingleVentsCount: 0,
  shingleSkylightsCount: 0,
  shingleChimneyCount: 0,
  shingleShinglesPerSquareCost: 45,
  shingleSyntheticUnderlaymentRollCost: 90,
  shingleSyntheticUnderlaymentRollCoverageSq: 9.6,
  shingleStarterCost: 50,
  shingleStarterRollCoverageLf: 115,
  shingleRidgeCapCost: 80,
  shingleDripEdgeCost: 8,
  shingleCoilNails125Cost: 55,
  shingleCoilNails78Cost: 52,
  shingleMarkingPaintCost: 7,
  shingleTinShinglesCost: 36,
  shingleRoofJack2Cost: 8,
  shingleRoofJack15Cost: 8,
  shingleRoofJack3Cost: 14,
  shingleRoofJack4Cost: 15,
  shingleAmericapOvalCost: 25,
  shingleAmericapRoundCost: 25,
  shingleOvalRoofJackCost: 25,
  shingleValleyMetalCost: 60,
  shingleValleyMetalQuantity: 0,
  shingleOHaginVentCost: 65,
  shingleDormerVentCost: 65,
  shingleCaulkingSealantTubeCost: 12,
  shingleOHaginVentQuantity: 0,
  shingleDormerVentQuantity: 0,
  shingleCaulkingSealantTubeQuantity: 0,
  shingleVentCost: 65,
  shingleNailsCostPerSquare: 55,
  shingleCaulkingSealantCost: 0,
  shinglePlywoodSheets: 0,
  shinglePlywoodSheetCost: 30,
  shingleSprayPaintCost: 7,
  shingleRoofConveyorDeliveryChargeQuantity: 1,
  shingleRoofConveyorDeliveryCharge: 75,
  shingleFuelSurchargeQuantity: 1,
  shingleFuelSurcharge: 75,
  shingleExistingLayers: 1,
  shingleTearOffCostPerSquare: 0,
  shingleDumpTrailerFee: 0,
  shingleDryRotAllowance: 0,
  shingleTearOffPricingUnit: "SQ",
  shingleTearOffSections: [createBlankShingleTearOffSection()],
  shingleSubcontractorItems: [
    { ...createBlankShingleSubcontractorItem("Tear-Off Subcontractor"), quantity: 0, unitPrice: 0 },
  ],
  shingleLaborType: "inHouse",
  shingleLaborersPerDay: 0,
  shingleTotalDaysOnJob: 0,
  shingleLaborHourlyRate: 0,
  shingleHoursPerDay: 0,
  shingleSubcontractorLicensed: true,
  shingleSubcontractorWorkersComp: true,
  shingleSubcontractorSections: [createBlankShingleLaborSection()],
  shingleInstallLaborPerSquare: 0,
  shingleTearOffLaborPerSquare: 0,
  shingleAdditionalLabor: 0,
  shingleJobDays: 0,
  shingleCrewSize: 0,
  shingleCustomBidAmount: "",
  shingleCustomBidSelected: false,
  tileProjectType: "raiseReset",
  tileTotalRoofSquares: 0,
  tileWastePercent: 10,
  tileBrokenTileAllowancePercent: 3,
  tilePalletYieldSqPerPallet: 0,
  tileOrderReplacementTile: false,
  tileOrderingVerifiedPalletYield: false,
  tileOrderingVerifiedRoofLoadCost: false,
  tileOrderingVerifiedMaterialDeliveryCost: false,
  tileOrderingVerifiedColorProfileAvailability: false,
  tileOrderingVerifiedBrokenAllowance: false,
  tileFieldTileQuantityManual: "",
  tileUnderlaymentType: "syntheticTitanium50",
  tileProfile: "flat",
  tileValleyLf: 0,
  tileRidgeLf: 0,
  tileHipLf: 0,
  tileDripEdgeLf: 0,
  tileLeftRakeLf: 0,
  tileRightRakeLf: 0,
  tileBirdStopLf: 0,
  tileTileRaiserLf: 0,
  tilePipeJacksCount: 0,
  tileOneHalfPipePenetrations: 0,
  tileTwoInchPipePenetrations: 0,
  tileThreeInchPipePenetrations: 0,
  tileFourInchPipePenetrations: 0,
  tileOvalPipePenetrations: 0,
  tileAmericapQuantity: 0,
  tileOvalCapQuantity: 0,
  tileOneHalfBaseJackCost: 8,
  tileOneHalfRoofJackCost: 8,
  tileTwoInchBaseJackCost: 8,
  tileTwoInchRoofJackCost: 8,
  tileThreeInchBaseJackCost: 14,
  tileThreeInchRoofJackCost: 14,
  tileFourInchBaseJackCost: 15,
  tileFourInchRoofJackCost: 15,
  tileOvalBaseJackCost: 25,
  tileOvalRoofJackCost: 25,
  tileAmericapCost: 25,
  tileOvalCapCost: 25,
  tileVentsCount: 0,
  tileSkylightsCount: 0,
  tileChimneyCount: 0,
  tileTearOffSections: [createBlankTileTearOffSection()],
  tileLaborType: "inHouse",
  tileLaborersPerDay: 0,
  tileTotalDaysOnJob: 0,
  tileLaborHourlyRate: 50,
  tileHoursPerDay: 0,
  tileSubcontractorLicensed: true,
  tileSubcontractorWorkersComp: true,
  tileSubcontractorSections: [createBlankTileLaborSection()],
  tileCustomBidAmount: "",
  tileCustomBidSelected: false,
  tileCustomMaterials: [],
  tileFieldTileQuantity: 0,
  tileFieldTileCost: 0,
  tileFlatTileNailsQuantityManual: "",
  tileSTileNailsQuantityManual: "",
  tileUnderlaymentQuantity: 0,
  tileUnderlaymentCost: 180,
  tileUnderlaymentQuantityManual: "",
  tileUnderlayment30QuantityManual: "",
  tileUnderlayment30Cost: 30,
  tileBattensLf: 0,
  tileBattensQuantity: 0,
  tileBattensQuantityManual: "",
  tileBattensCost: 6,
  tileFlatTileNailsCost: 85,
  tileSTileNailsCost: 85,
  tileValleyMetalQuantity: 0,
  tileValleyMetalQuantityManual: "",
  tileValleyMetalCost: 70,
  tileFlashingMetalQuantity: 0,
  tileDripEdgeQuantityManual: "",
  tileFlashingMetalCost: 11.5,
  tileRidgeHipQuantity: 0,
  tileRidgeHipCost: 0,
  tileMortarAdhesiveQuantity: 0,
  tileMortarAdhesiveCost: 0,
  tilePipeJacksQuantity: 0,
  tilePipeJacksCost: 0,
  tileOHaginVentsQuantity: 0,
  tileOHaginVentsCost: 55,
  tileDormerVentsQuantity: 0,
  tileDormerVentsCost: 80,
  tileCDXPlywoodQuantity: 0,
  tileCDXPlywoodCost: 27,
  tileMortarMixQuantityManual: "",
  tileMortarMixCost: 12.5,
  tileMaterialDeliveryChargeQuantity: 1,
  tileMaterialDeliveryCharge: 0,
  tileRoofLoadCostQuantity: 1,
  tileRoofLoadCost: 0,
  tileRoofLoadingDeliveryChargeQuantity: 1,
  tileRoofLoadingDeliveryCharge: 0,
  tileFuelSurchargeQuantity: 1,
  tileFuelSurcharge: 0,

  companyHqAddress: "18551 Orange Street, Bloomington, CA 92316",
  jobSiteAddress: "",
  travelVehicle: DEFAULT_TRAVEL_VEHICLE_KEY,
  travelVehicles: [DEFAULT_TRAVEL_VEHICLE_KEY],
  oneWayMiles: 0,
  oneWayDriveTime: 0,
  oneWayDriveTimeHours: 0,
  estimatedDriveTimeMinutes: 0,
  travelDistanceSource: "manual",
  averageDrivingSpeedMph: 60,
  travelDriverHourlyRate: 27,
  workHoursPerDay: 8,
  numberOfJobDays: 0,
  numberOfDrivers: 0,

  laborType: "",
  subcontractorLicenseStatus: "",
  subcontractorLaborRatePerSq: 0,
  subcontractorHasAddOns: false,
  subcontractorAddOnItems: DEFAULT_SUBCONTRACTOR_ADD_ON_ITEMS,
  laborWorkers: 0,
  laborHourlyRate: 0,
  laborHoursPerWorker: 0,
  laborEmployeeRows: [],
  payrollBurdenPercent: TOTAL_LABOR_BURDEN_RATE * 100,

  overheadOperatingRate: OVERHEAD_OPERATING_RATE,
  scopeAdders: 0,
  travelCost: 0,
  miscCost: 0,
  selectedMarkupPercent: 30,
  ...DEFAULT_MATERIAL_PRICES,

  estimateStatus: "draft",
  estimateName: "",
};

function createBlankTerminationRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    terminationType: "",
    type: "",
    linearFeet: "",
  };
}

const css = String.raw`
:root{
  color-scheme: dark;
  --bg:#050607;
  --bg2:#0a0c10;
  --panel:#0d1118;
  --panel2:#10151d;
  --line:rgba(18,166,245,.22);
  --line2:rgba(18,166,245,.58);
  --ink:#ecfbff;
  --muted:#9bc1cf;
  --brand:#12a6f5;
  --brand2:#7ad9ff;
  --good:#52e0ff;
  --bad:#ff7084;
  --shadow:0 24px 70px rgba(0,0,0,.58);
  --radius:18px;
  --page-bg:
    radial-gradient(circle at top left, rgba(18,166,245,.16), transparent 26%),
    radial-gradient(circle at top right, rgba(18,166,245,.08), transparent 24%),
    linear-gradient(180deg,#000 0%, #050607 40%, #09111a 100%);
  font-family: Avenir, "Segoe UI", system-ui, sans-serif;
}
:root[data-appearance="light"]{
  color-scheme: light;
  --bg:#f8fbff;
  --bg2:#eef5fc;
  --panel:#ffffff;
  --panel2:#f5f9ff;
  --line:rgba(18,166,245,.22);
  --line2:rgba(18,166,245,.52);
  --ink:#112433;
  --muted:#35556c;
  --brand:#0a87d1;
  --brand2:#0776bc;
  --good:#028e61;
  --bad:#cf3055;
  --shadow:0 20px 48px rgba(5,42,70,.14);
  --page-bg:
    radial-gradient(circle at top left, rgba(18,166,245,.14), transparent 28%),
    radial-gradient(circle at top right, rgba(18,166,245,.10), transparent 26%),
    linear-gradient(180deg, #f7fbff 0%, #f1f8ff 50%, #eef6ff 100%);
}
*{box-sizing:border-box}
body{
  margin:0;
  color:var(--ink);
  background:var(--page-bg);
}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
a{color:inherit}
.appShell{width:min(1480px, calc(100% - 24px)); margin:0 auto; padding:20px 0 42px}
.portalLayout{
  min-height:100vh;
  display:grid;
  grid-template-columns:260px minmax(0,1fr);
  transition:grid-template-columns .2s ease;
}
.portalLayout.sidebarCollapsed{grid-template-columns:minmax(0,1fr)}
.portalSidebar{
  position:sticky;
  top:0;
  height:100vh;
  z-index:40;
  display:flex;
  flex-direction:column;
  gap:14px;
  padding:16px 12px;
  overflow-y:auto;
  border-right:1px solid var(--line);
  background:linear-gradient(180deg, rgba(8,12,18,.99), rgba(5,9,14,.98));
  box-shadow:14px 0 38px rgba(0,0,0,.2);
}
.portalSidebarBrand{
  display:flex;
  align-items:center;
  gap:10px;
  min-height:54px;
  padding:7px;
  border-radius:14px;
}
.portalSidebarBrand img{
  flex:0 0 42px;
  width:42px;
  height:42px;
  padding:5px;
  object-fit:contain;
  border:1px solid var(--line2);
  border-radius:11px;
  background:rgba(18,166,245,.08);
}
.portalSidebarBrandText{min-width:0; display:grid; gap:2px}
.portalSidebarBrandText strong{font-size:.93rem; white-space:nowrap}
.portalSidebarBrandText span{color:var(--muted); font-size:.72rem; white-space:nowrap}
.portalSidebarToggle{
  min-height:38px;
  border:1px solid var(--line);
  border-radius:11px;
  color:var(--muted);
  background:rgba(18,166,245,.05);
  font-weight:800;
}
.portalSidebarNav{display:grid; gap:5px}
.portalSidebarSectionLabel{
  margin:8px 9px 4px;
  color:var(--muted);
  font-size:.68rem;
  font-weight:900;
  letter-spacing:.14em;
  text-transform:uppercase;
  white-space:nowrap;
}
.portalSidebarButton{
  width:100%;
  min-height:44px;
  display:flex;
  align-items:center;
  gap:11px;
  padding:8px 11px;
  border:1px solid transparent;
  border-radius:12px;
  color:var(--muted);
  background:transparent;
  text-align:left;
  font-weight:800;
  transition:background .15s ease, border-color .15s ease, color .15s ease;
}
.portalSidebarButton:hover{
  color:var(--ink);
  border-color:var(--line);
  background:rgba(18,166,245,.07);
}
.portalSidebarButton.active{
  color:var(--ink);
  border-color:rgba(18,166,245,.38);
  background:linear-gradient(180deg, rgba(18,166,245,.20), rgba(18,166,245,.09));
  box-shadow:inset 3px 0 0 var(--brand);
}
.portalSidebarIcon{
  flex:0 0 24px;
  width:24px;
  height:24px;
  display:grid;
  place-items:center;
  border-radius:8px;
  color:var(--brand2);
  background:rgba(18,166,245,.09);
  font-size:.78rem;
  font-weight:900;
}
.portalSidebarLabel{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.portalSidebarFooter{margin-top:auto; display:grid; gap:5px; padding-top:12px; border-top:1px solid var(--line)}
.portalSidebarAccount{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:5px;
  padding:6px 9px;
  min-width:0;
}
.portalSidebarAvatar{
  flex:0 0 32px;
  width:32px;
  height:32px;
  display:grid;
  place-items:center;
  border-radius:50%;
  color:#02111b;
  background:linear-gradient(180deg, var(--brand2), var(--brand));
  font-size:.78rem;
  font-weight:900;
  overflow:hidden;
}
.portalSidebarAvatar img{width:100%; height:100%; display:block; object-fit:cover}
.portalSidebarAccountText{min-width:0; display:grid; gap:1px}
.portalSidebarAccountText strong,.portalSidebarAccountText span{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.portalSidebarAccountText strong{font-size:.82rem}
.portalSidebarAccountText span{color:var(--muted); font-size:.7rem}
.sidebarCollapsed .portalSidebar{
  position:fixed;
  left:0;
  width:260px;
  transform:translateX(-105%);
  pointer-events:none;
}
.portalMain{min-width:0}
.portalMain .appShell{width:min(1480px, calc(100% - 32px))}
.portalDesktopLauncher{
  position:fixed;
  left:14px;
  top:14px;
  z-index:35;
  display:none;
  place-items:center;
  width:46px;
  height:46px;
  padding:0;
  border:1px solid var(--line2);
  border-radius:12px;
  color:var(--ink);
  background:linear-gradient(180deg, var(--panel2), var(--panel));
  box-shadow:0 10px 28px rgba(0,0,0,.22);
  font-size:1.35rem;
  line-height:1;
  font-weight:900;
}
.portalDesktopLauncher:hover{border-color:var(--brand); color:var(--brand)}
.sidebarCollapsed .portalDesktopLauncher{display:grid}
.profilePhotoManager{
  display:grid;
  grid-template-columns:120px minmax(0,1fr);
  gap:20px;
  align-items:center;
}
.profilePhotoPreview{
  width:112px;
  height:112px;
  display:grid;
  place-items:center;
  overflow:hidden;
  border-radius:50%;
  border:2px solid var(--line2);
  color:#02111b;
  background:linear-gradient(180deg, var(--brand2), var(--brand));
  box-shadow:0 14px 34px rgba(0,0,0,.2);
  font-size:1.8rem;
  font-weight:900;
}
.profilePhotoPreview img{width:100%; height:100%; display:block; object-fit:cover}
.profilePhotoControls{display:grid; gap:10px}
.profilePhotoControls p{color:var(--muted); margin:0; line-height:1.5}
.profilePhotoInput{display:none}
.portalMobileMenu,
.portalSidebarBackdrop{display:none}
:root[data-appearance="light"] .portalSidebar{
  background:linear-gradient(180deg, rgba(255,255,255,.99), rgba(242,248,253,.98));
  box-shadow:14px 0 38px rgba(5,42,70,.08);
}
@media (max-width: 900px){
  .portalLayout,.portalLayout.sidebarCollapsed{display:block}
  .portalSidebar{
    position:fixed;
    left:0;
    transform:translateX(-105%);
    width:min(300px, 86vw);
    transition:transform .2s ease;
  }
  .portalLayout.sidebarMobileOpen .portalSidebar{transform:translateX(0); pointer-events:auto}
  .portalLayout.sidebarCollapsed .portalSidebarBrandText,
  .portalLayout.sidebarCollapsed .portalSidebarLabel,
  .portalLayout.sidebarCollapsed .portalSidebarSectionLabel,
  .portalLayout.sidebarCollapsed .portalSidebarAccountText{display:grid}
  .portalLayout.sidebarCollapsed .portalSidebarBrand,
  .portalLayout.sidebarCollapsed .portalSidebarAccount{justify-content:flex-start; padding-inline:7px}
  .portalLayout.sidebarCollapsed .portalSidebarButton{justify-content:flex-start; padding-inline:11px}
  .portalDesktopLauncher,.sidebarCollapsed .portalDesktopLauncher{display:none}
  .portalMobileMenu{
    position:fixed;
    left:12px;
    bottom:12px;
    z-index:35;
    display:grid;
    place-items:center;
    width:52px;
    height:52px;
    border:1px solid var(--line2);
    border-radius:16px;
    color:#02111b;
    background:linear-gradient(180deg, var(--brand2), var(--brand));
    box-shadow:0 14px 34px rgba(0,0,0,.3);
    font-weight:900;
  }
  .portalSidebarBackdrop{
    position:fixed;
    inset:0;
    z-index:30;
    display:block;
    border:0;
    background:rgba(2,8,14,.72);
  }
  .portalMain .appShell{width:min(100% - 24px, 1480px); padding-bottom:82px}
  .profilePhotoManager{grid-template-columns:1fr; justify-items:start}
}
.hero{
  display:grid;
  grid-template-columns:minmax(0,1fr) 300px;
  gap:18px;
  align-items:end;
  padding:18px 0 16px;
}
.brandRow{display:flex; align-items:center; gap:14px; margin-bottom:14px; flex-wrap:wrap}
.brandMark{
  width:124px; height:88px; padding:10px 12px; border-radius:16px; display:grid; place-items:center;
  background:linear-gradient(180deg, rgba(18,166,245,.2), rgba(18,166,245,.08));
  border:1px solid var(--line2); box-shadow:0 0 0 1px rgba(18,166,245,.08);
  overflow:hidden;
}
.brandMark img{
  display:block;
  width:100%;
  height:100%;
  object-fit:contain;
}
.eyebrow{
  margin:0; color:var(--muted); font-size:.76rem; font-weight:800;
  letter-spacing:.2em; text-transform:uppercase;
}
h1,h2,h3,p{margin-top:0}
h1{
  margin-bottom:14px;
  font-size:clamp(2.5rem, 5.8vw, 5rem);
  line-height:.94;
  text-transform:uppercase;
  letter-spacing:.01em;
  color:var(--ink);
}
.intro{
  max-width:860px;
  margin-bottom:0;
  color:#adc8d4;
  line-height:1.6;
}
.heroCard,.panel{
  background:linear-gradient(180deg, rgba(16,21,29,.98), rgba(11,14,20,.96));
  border:1px solid var(--line);
  border-radius:22px;
  box-shadow:var(--shadow);
}
.heroCard{padding:18px; display:grid; gap:8px; border-color:var(--line2)}
.heroCard strong{font-size:1.4rem; color:var(--brand2)}
.heroCard p,.panel p{margin-bottom:0}
.workspace{display:grid; gap:18px}
.panel{padding:20px; position:relative; overflow:hidden}
.panel::before{
  content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
  background:linear-gradient(135deg, rgba(18,166,245,.10), transparent 28%);
}
.panel > *{position:relative; z-index:1}
.approvedDailyProgressCard{padding:16px 18px}
.approvedDailyProgressHeader{display:flex; align-items:center; justify-content:space-between; gap:18px}
.approvedDailyProgressHeader h3{margin:2px 0 5px; font-size:1.18rem}
.approvedDailyProgressEyebrow{color:var(--brand2); font-size:.72rem; font-weight:800; letter-spacing:.14em; text-transform:uppercase}
.approvedDailyProgressSummary{color:var(--muted); font-size:.9rem; line-height:1.45}
.approvedDailyProgressActions{display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap}
.approvedDailyProgressBody{padding-top:18px; margin-top:16px; border-top:1px solid var(--line)}
.sectionHead,.panelHead{display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:16px}
.sectionHead h2,.panelHead h2{color:#fff; font-weight:800}
.sectionHead p,.panelHead p{color:#a6c8d8; line-height:1.5}
.formStack{display:grid; gap:16px}
.inputSection{
  display:grid; gap:12px; padding:16px; border:1px solid rgba(18,166,245,.16);
  border-radius:18px; background:rgba(255,255,255,.015);
}
.inputSection h3{margin-bottom:0; font-size:1rem}
.choiceRow{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px}
.choiceCard{
  display:grid; gap:8px; padding:12px 13px; border:1px solid rgba(18,166,245,.2);
  border-radius:14px; background:rgba(255,255,255,.015); cursor:pointer;
}
.choiceCard input{accent-color:var(--brand); margin:0}
.choiceCard span{font-weight:700; line-height:1.35}
.choiceCard.active{border-color:var(--brand); background:rgba(18,166,245,.08)}
.formGrid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px}
.field{display:grid; gap:8px}
.field span{
  display:flex; justify-content:space-between; gap:12px; color:#a4c9d7;
  font-size:.84rem; font-weight:700;
}
.field input,.field select,.field textarea{
  width:100%; min-height:48px; padding:0 14px; border-radius:12px;
  border:1px solid rgba(18,166,245,.24); color:var(--ink);
  background:linear-gradient(180deg, #11161d, #0b0f14);
}
.field textarea{padding:12px 14px; min-height:110px; resize:vertical}
.field input:focus,.field select:focus,.field textarea:focus{outline:2px solid rgba(18,166,245,.2); border-color:var(--brand)}
.narrowField{max-width:360px}
.checkboxField{align-content:start}
.checkboxField input[type="checkbox"]{width:20px; height:20px; min-height:20px; accent-color:var(--brand)}
.detailList{display:grid; gap:10px}
.detailRow{
  display:flex; justify-content:space-between; gap:12px; padding:12px 14px;
  border:1px solid rgba(18,166,245,.16); border-radius:14px; background:rgba(255,255,255,.02)
}
.detailRow span{color:var(--muted); font-size:.8rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase}
.detailRow strong{font-size:1rem; color:var(--brand2)}
.detailNote{margin-top:4px; color:var(--muted); font-size:.78rem; text-transform:none; letter-spacing:0; font-weight:600}
.smallNote{color:#9fc0cf; font-size:.92rem}
.sectionTitle{
  display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;
}
.tableWrap{overflow-x:auto}
.dataTable{
  width:100%; border-collapse:collapse; min-width:980px;
}
.dataTable th,.dataTable td{
  padding:10px 8px; border-bottom:1px solid rgba(18,166,245,.15); text-align:left; vertical-align:top;
}
.dataTable th{
  color:var(--muted); font-size:.75rem; letter-spacing:.11em; text-transform:uppercase;
}
.tableInput{
  width:100%; min-width:92px; min-height:40px; padding:0 10px; border-radius:10px;
  border:1px solid rgba(18,166,245,.24); color:var(--ink);
  background:linear-gradient(180deg, #11161d, #0b0f14);
}
.tableInput:focus{outline:2px solid rgba(18,166,245,.2); border-color:var(--brand)}
.bidGrid{display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:12px}
.bidCard{
  display:grid; gap:8px; text-align:left; padding:14px; border-radius:16px;
  border:1px solid rgba(18,166,245,.2); background:rgba(255,255,255,.02); color:var(--ink)
}
.bidCard.active{border-color:var(--brand2); background:rgba(18,166,245,.09); box-shadow:0 0 0 1px rgba(18,166,245,.09)}
.bidCard span{color:var(--muted); font-size:.8rem; font-weight:700}
.bidCard strong{font-size:1rem; color:var(--brand2)}
.bidCardTitle{font-size:.9rem; color:var(--ink)!important}
.markupTableRow{
  cursor:pointer;
  transition:background .15s ease, border-color .15s ease, transform .15s ease;
}
.markupTableRow:hover{background:rgba(18,166,245,.05)}
.markupTableRow.active{
  background:rgba(18,166,245,.12);
}
.markupTableRow.active td{
  color:#e9fbff;
}
.actionRow{display:flex; flex-wrap:wrap; gap:10px}
.primaryButton,.secondaryButton,.successButton,.dangerButton,.loginButton{
  min-height:44px; padding:0 15px; border-radius:12px; border:1px solid var(--line2);
  color:#e9fbff; background:linear-gradient(180deg, rgba(18,166,245,.22), rgba(18,166,245,.10));
}
.primaryButton{font-weight:800}
.secondaryButton{font-weight:700}
.successButton{
  border-color:rgba(79,255,145,.38);
  background:linear-gradient(180deg, rgba(79,255,145,.24), rgba(79,255,145,.11));
  color:#baffc9;
  font-weight:800;
}
.dangerButton{
  border-color:rgba(255,112,132,.34);
  background:linear-gradient(180deg, rgba(255,112,132,.16), rgba(255,112,132,.08));
  color:#ffd4db;
}
.loginButton{
  font-weight:900; letter-spacing:.04em; text-transform:uppercase;
  background:linear-gradient(180deg, #7ad9ff, #12a6f5);
  color:#02111b;
}
.statusMessage{margin:10px 0 0; color:var(--good); font-weight:700}
.statusTag{display:inline-flex; align-items:center; gap:6px; padding:.35em .75em; border-radius:999px; font-size:.76rem; letter-spacing:.08em; text-transform:uppercase; font-weight:800; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); color:var(--ink)}
.statusTag-draft{background:rgba(82,224,255,.12); border-color:rgba(82,224,255,.24); color:#7ad9ff}
.statusTag-sent{background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); color:#adc8d4}
.statusTag-approved{background:rgba(79,255,145,.12); border-color:rgba(79,255,145,.28); color:#9ef8a8}
.statusTag-completed{background:rgba(142,110,255,.14); border-color:rgba(142,110,255,.32); color:#d1b9ff}
.dangerMessage{color:#ff8f9e}
.emptyState{margin:0; color:#9fc0cf}
.savedList{display:grid; gap:12px}
.savedCard{
  display:grid; gap:10px; padding:14px; border-radius:16px;
  border:1px solid rgba(18,166,245,.16); background:rgba(255,255,255,.02)
}
.savedCard strong{display:block; margin-bottom:4px}
.savedCard p{margin-bottom:0; color:#a7c7d6}
.savedActions{display:flex; flex-wrap:wrap; gap:8px}
.activeJobPreviewCard{gap:16px; padding:18px}
.activeJobPreviewNumber{margin-top:2px; font-size:.86rem}
.activeJobPreviewDetails{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
  gap:10px;
  margin-top:14px;
}
.activeJobPreviewDetails > div{
  min-width:0;
  padding:12px;
  border:1px solid rgba(18,166,245,.15);
  border-radius:13px;
  background:rgba(18,166,245,.045);
}
.activeJobPreviewDetails span{
  display:block;
  margin-bottom:5px;
  color:var(--muted);
  font-size:.72rem;
  font-weight:800;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.activeJobPreviewDetails strong{margin:0; overflow-wrap:anywhere; line-height:1.35}
.activeJobPreviewSchedule{margin-top:12px; font-size:.88rem}
.dashboardTabBar{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:10px;
  margin-bottom:12px;
}
.dashboardTabButton{
  min-height:40px;
  padding:0 16px;
  border-radius:999px;
  border:1px solid rgba(18,166,245,.22);
  background:rgba(18,166,245,.08);
  color:#e9fbff;
  font-weight:800;
  cursor:pointer;
}
.dashboardTabButton.active{
  border-color:rgba(18,166,245,.45);
  background:linear-gradient(180deg, rgba(18,166,245,.22), rgba(18,166,245,.10));
}
.dashboardTabHint{color:#9fc0cf; font-size:.92rem}
.crmBoard{
  display:grid;
  gap:14px;
}
.quickLeadCaptureGrid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
}
.quickLeadCaptureGrid > :last-child{grid-column:1/-1}
.crmKanban{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
}
.crmKanbanColumn{
  display:grid;
  gap:10px;
  padding:14px;
  border-radius:16px;
  border:1px solid rgba(18,166,245,.18);
  background:rgba(255,255,255,.02);
  min-height:220px;
}
.crmKanbanColumn h4{margin:0; color:var(--brand2); font-size:.98rem}
.crmKanbanCard{
  display:grid;
  gap:6px;
  padding:12px;
  border-radius:14px;
  border:1px solid rgba(18,166,245,.16);
  background:rgba(11,18,26,.72);
}
.crmKanbanCard strong{font-size:.98rem}
.crmTimelineList{
  display:grid;
  gap:10px;
}
.crmTimelineItem{
  display:grid;
  gap:4px;
  padding:12px 14px;
  border-radius:14px;
  border:1px solid rgba(18,166,245,.16);
  background:rgba(255,255,255,.02);
}
.crmTimelineItem strong{font-size:.96rem}
.crmTimelineItem p{margin:0; color:#a7c7d6}
.crmFileRow{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
}
.crmCustomerSections{
  display:grid;
  gap:14px;
}
.templateGrid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
}
.workflowGroups{
  display:grid;
  gap:14px;
}
.workflowGroupCard{
  display:grid;
  gap:14px;
  padding:18px;
  border-radius:20px;
  border:1px solid rgba(18,166,245,.18);
  background:linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.02));
}
.workflowGroupHeader h3{
  margin:0;
  color:var(--brand2);
  font-size:1.05rem;
}
.workflowGroupHeader p{
  margin:4px 0 0;
  color:#a7c7d6;
  line-height:1.45;
}
.workflowGroupGrid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
}
.templateCard{
  text-align:left;
  padding:16px;
  border-radius:18px;
  border:1px solid rgba(18,166,245,.18);
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
  color:var(--ink);
  box-shadow:none;
  cursor:pointer;
  display:grid;
  gap:8px;
}
.templateCard strong{font-size:1.05rem; display:block}
.templateCard p{margin:0; color:#a7c7d6}
.templateCard:hover{border-color:rgba(18,166,245,.45); transform:translateY(-1px)}
.dashboardQuickActions{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:10px;
}
.collectLeadCard{
  background:linear-gradient(135deg, rgba(18,166,245,.13), rgba(255,255,255,.025));
}
.dashboardQuickActions .templateCard{min-height:118px;padding:14px}
.dashboardQuickActions .templateCard strong{font-size:1rem}
.dashboardQuickActions .templateCard p{font-size:.86rem;line-height:1.4}
@media (max-width: 960px){
  .workflowGroupGrid{grid-template-columns:1fr;}
  .dashboardQuickActions{grid-template-columns:1fr;}
  .quickLeadCaptureGrid{grid-template-columns:1fr;}
  .quickLeadCaptureGrid > :last-child{grid-column:auto}
}
.loginShell{
  min-height:100vh; display:grid; place-items:center; padding:24px 12px;
}
.loginPanel{width:min(760px,100%)}
.loginForm{display:grid; gap:14px}
.heroLine{
  display:flex; flex-wrap:wrap; gap:12px; justify-content:flex-start; align-items:center; margin-top:8px
}
.summaryGrid{
  display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0 18px;
}
.summaryCard{
  padding:14px 16px; border-radius:16px; border:1px solid rgba(18,166,245,.16);
  background:rgba(255,255,255,.02)
}
.summaryCard span{display:block; margin-bottom:6px; color:var(--muted); font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em}
.summaryCard strong{font-size:1.2rem; color:var(--brand2)}
.summaryCard p{margin:8px 0 0; color:#a7c7d6; line-height:1.45}
.dashboardStatusDot{
  display:inline-block;
  width:10px;
  height:10px;
  border-radius:999px;
  background:rgba(255,255,255,.26);
  box-shadow:0 0 0 0 rgba(79,255,145,.4);
  vertical-align:middle;
}
.dashboardStatusDot.active{
  background:#4fff91;
  animation: activePulse 1.8s infinite;
}
@keyframes activePulse{
  0%{box-shadow:0 0 0 0 rgba(79,255,145,.35)}
  70%{box-shadow:0 0 0 12px rgba(79,255,145,0)}
  100%{box-shadow:0 0 0 0 rgba(79,255,145,0)}
}
.cfoKpiCard{
  appearance:none;
  width:100%;
  text-align:left;
  cursor:pointer;
  transition:transform .15s ease, border-color .15s ease, background .15s ease;
}
.cfoKpiCard:hover{
  transform:translateY(-1px);
  border-color:rgba(18,166,245,.35);
  background:rgba(18,166,245,.06);
}
.cfoKpiCard:focus-visible{
  outline:2px solid rgba(122,217,255,.55);
  outline-offset:2px;
}
.cfoDetailOverlay{
  position:fixed;
  inset:0;
  z-index:60;
  display:grid;
  place-items:center;
  padding:20px;
  background:rgba(2,10,18,.82);
  backdrop-filter:blur(10px);
}
.cfoDetailPanel{
  width:min(1180px,100%);
  max-height:min(92vh,980px);
  overflow:auto;
  border-radius:22px;
  border:1px solid rgba(18,166,245,.24);
  background:linear-gradient(180deg, rgba(12,17,24,.98), rgba(8,12,18,.98));
  box-shadow:0 36px 120px rgba(0,0,0,.5);
  padding:22px;
}
.cfoDetailHeader{
  display:flex;
  flex-wrap:wrap;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  margin-bottom:16px;
}
.cfoDetailHeader h2{margin:0; color:#fff}
.cfoDetailHeader p{margin:6px 0 0; color:#a7c7d6; line-height:1.45}
.cfoDetailMeta{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:12px;
}
.cfoDetailChip{
  display:inline-flex;
  align-items:center;
  min-height:30px;
  padding:0 12px;
  border-radius:999px;
  border:1px solid rgba(18,166,245,.18);
  background:rgba(18,166,245,.07);
  color:#dff7ff;
  font-size:.78rem;
  font-weight:700;
}
.cfoDetailGrid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
  gap:12px;
  margin-bottom:16px;
}
.cfoDetailFilters{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
  gap:12px;
  margin-bottom:16px;
}
.cfoDetailBody{
  display:grid;
  gap:16px;
}
.cfoDetailTableWrap{
  overflow-x:auto;
}
.cfoDetailTable{
  width:100%;
  border-collapse:collapse;
  min-width:920px;
}
.cfoDetailTable th,
.cfoDetailTable td{
  padding:10px 8px;
  border-bottom:1px solid rgba(18,166,245,.14);
  text-align:left;
  vertical-align:top;
}
.cfoDetailTable th{
  color:var(--muted);
  font-size:.75rem;
  text-transform:uppercase;
  letter-spacing:.11em;
}
.cfoDetailEmpty{
  padding:16px;
  border-radius:14px;
  border:1px dashed rgba(18,166,245,.22);
  background:rgba(255,255,255,.02);
  color:#a7c7d6;
  line-height:1.45;
}
.activeJobsTableWrap{overflow-x:auto}
.activeJobsTable{
  width:100%;
  border-collapse:collapse;
  min-width:1280px;
}
.activeJobsTable th,
.activeJobsTable td{
  padding:10px 8px;
  border-bottom:1px solid rgba(18,166,245,.14);
  text-align:left;
  vertical-align:top;
}
.activeJobsTable th{
  color:var(--muted);
  font-size:.75rem;
  text-transform:uppercase;
  letter-spacing:.11em;
}
.activeJobsRow{
  cursor:pointer;
}
.activeJobsRow:hover{
  background:rgba(18,166,245,.05);
}
.activeJobsStatusDot{
  display:inline-block;
  width:10px;
  height:10px;
  border-radius:999px;
  margin-right:8px;
  background:#8da2b5;
  vertical-align:middle;
}
.activeJobsStatusDot.green{background:#4fff91}
.activeJobsStatusDot.yellow{background:#ffd76b}
.activeJobsStatusDot.red{background:#ff7e8c}
.activeJobsStatusDot.blue{background:#7ad9ff}
.activeJobHeaderCards{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
  gap:12px;
  margin-bottom:16px;
}
.activeJobEditForm{display:grid; gap:16px}
.activeJobEditRemaining{margin:0}
.estimateLaborCrew{display:grid; gap:14px}
.activeJobOverlay{
  position:fixed;
  inset:0;
  z-index:61;
  display:grid;
  place-items:center;
  padding:20px;
  background:rgba(2,10,18,.78);
  backdrop-filter:blur(10px);
}
.activeJobPanel{
  width:min(1280px,100%);
  max-height:min(92vh,980px);
  overflow:auto;
  border-radius:22px;
  border:1px solid rgba(18,166,245,.24);
  background:linear-gradient(180deg, rgba(12,17,24,.98), rgba(8,12,18,.98));
  box-shadow:0 36px 120px rgba(0,0,0,.5);
  padding:22px;
}
.activeJobModalGrid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
  gap:12px;
}
.statusPill{
  display:inline-flex; align-items:center; justify-content:center; width:fit-content;
  min-height:28px; padding:0 10px; border-radius:999px; border:1px solid rgba(18,166,245,.22);
  background:rgba(18,166,245,.08); color:var(--brand2); font-size:.76rem; font-weight:800;
  letter-spacing:.08em; text-transform:uppercase;
}
.statusPill.bad{
  border-color:rgba(255,112,132,.36);
  background:rgba(255,112,132,.08);
  color:#ffb7c1;
}
.checklistList{display:grid; gap:10px}
.checklistItem{
  display:grid; gap:4px; padding:12px 14px; border-radius:14px; border:1px solid rgba(255,112,132,.25);
  background:rgba(255,112,132,.05);
}
.checklistItem strong{font-size:.98rem; color:#ffd4db}
.checklistItem p{margin:0; color:#f1bcc5; line-height:1.45}
.checklistEmpty{
  padding:14px; border-radius:14px; border:1px solid rgba(82,224,255,.2);
  background:rgba(82,224,255,.06); color:#d7fbff; font-weight:700;
}
.appearanceControl{
  display:grid;
  gap:6px;
  min-width:170px;
}
.appearanceControl label{
  color:var(--muted);
  font-size:.78rem;
  letter-spacing:.08em;
  text-transform:uppercase;
  font-weight:800;
}
.appearanceControl select{
  min-height:40px;
  border-radius:10px;
  border:1px solid rgba(18,166,245,.3);
  color:var(--ink);
  background:linear-gradient(180deg, var(--panel2), var(--panel));
  padding:0 10px;
}
.appearanceControl.compact{
  min-width:148px;
}
.appearanceControl.compact label{
  font-size:.72rem;
}
:root[data-appearance="light"] .heroCard,
:root[data-appearance="light"] .panel,
:root[data-appearance="light"] .inputSection,
:root[data-appearance="light"] .savedCard,
:root[data-appearance="light"] .summaryCard,
:root[data-appearance="light"] .workflowGroupCard,
:root[data-appearance="light"] .templateCard,
:root[data-appearance="light"] .crmKanbanColumn,
:root[data-appearance="light"] .crmKanbanCard,
:root[data-appearance="light"] .crmTimelineItem,
:root[data-appearance="light"] .choiceCard,
:root[data-appearance="light"] .bidCard,
:root[data-appearance="light"] .detailRow,
:root[data-appearance="light"] .cfoDetailPanel,
:root[data-appearance="light"] .activeJobPanel{
  background:linear-gradient(180deg, #ffffff, #f7fbff);
  color:var(--ink);
}
:root[data-appearance="light"] .panel::before{
  background:linear-gradient(135deg, rgba(18,166,245,.07), transparent 32%);
}
:root[data-appearance="light"] .sectionHead h2,
:root[data-appearance="light"] .panelHead h2,
:root[data-appearance="light"] .cfoDetailHeader h2,
:root[data-appearance="light"] h1,
:root[data-appearance="light"] h2,
:root[data-appearance="light"] h3,
:root[data-appearance="light"] strong{
  color:var(--ink);
}
:root[data-appearance="light"] .intro,
:root[data-appearance="light"] .sectionHead p,
:root[data-appearance="light"] .panelHead p,
:root[data-appearance="light"] .heroCard p,
:root[data-appearance="light"] .smallNote,
:root[data-appearance="light"] .emptyState,
:root[data-appearance="light"] .savedCard p,
:root[data-appearance="light"] .workflowGroupHeader p,
:root[data-appearance="light"] .templateCard p,
:root[data-appearance="light"] .dashboardTabHint,
:root[data-appearance="light"] .cfoDetailHeader p,
:root[data-appearance="light"] .cfoDetailEmpty,
:root[data-appearance="light"] .checklistItem p,
:root[data-appearance="light"] .crmTimelineItem p{
  color:var(--muted);
}
:root[data-appearance="light"] .field input,
:root[data-appearance="light"] .field select,
:root[data-appearance="light"] .field textarea,
:root[data-appearance="light"] .tableInput,
:root[data-appearance="light"] input,
:root[data-appearance="light"] select,
:root[data-appearance="light"] textarea{
  color:var(--ink);
  background:linear-gradient(180deg, #ffffff, #f4f9ff);
  border-color:rgba(18,166,245,.35);
}
:root[data-appearance="light"] .dataTable th,
:root[data-appearance="light"] .cfoDetailTable th,
:root[data-appearance="light"] .activeJobsTable th,
:root[data-appearance="light"] .detailRow span,
:root[data-appearance="light"] .summaryCard span,
:root[data-appearance="light"] .field span{
  color:#365a73;
}
:root[data-appearance="light"] .primaryButton,
:root[data-appearance="light"] .secondaryButton,
:root[data-appearance="light"] .successButton,
:root[data-appearance="light"] .loginButton{
  color:#053250;
  border-color:rgba(10,135,209,.46);
  background:linear-gradient(180deg, rgba(18,166,245,.24), rgba(18,166,245,.13));
}
:root[data-appearance="light"] .successButton{
  color:#075f3d;
  border-color:rgba(2,142,97,.48);
  background:linear-gradient(180deg, rgba(45,203,139,.24), rgba(2,142,97,.12));
}
:root[data-appearance="light"] .dangerButton{
  color:#7d0f2f;
  border-color:rgba(207,48,85,.44);
  background:linear-gradient(180deg, rgba(207,48,85,.18), rgba(207,48,85,.10));
}
:root[data-appearance="light"] .dashboardTabButton,
:root[data-appearance="light"] .statusTag,
:root[data-appearance="light"] .cfoDetailChip,
:root[data-appearance="light"] .statusPill,
:root[data-appearance="light"] .checklistEmpty{
  color:var(--ink);
  border-color:rgba(18,166,245,.35);
  background:rgba(18,166,245,.09);
}
:root[data-appearance="light"] .dangerMessage,
:root[data-appearance="light"] .statusPill.bad,
:root[data-appearance="light"] .checklistItem{
  color:#8b1236;
}
:root[data-appearance="light"] .activeJobOverlay,
:root[data-appearance="light"] .cfoDetailOverlay{
  background:rgba(8,27,42,.34);
}
@media (max-width: 1180px){
  .hero,.summaryGrid,.bidGrid,.formGrid,.templateGrid{grid-template-columns:1fr}
  .bidGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width: 760px){
  .appShell{width:min(100% - 14px, 100%); padding-top:14px}
  .choiceRow{grid-template-columns:1fr}
  .bidGrid{grid-template-columns:1fr}
  .panel{padding:16px}
  .approvedDailyProgressHeader{align-items:flex-start; flex-direction:column}
  .approvedDailyProgressActions{justify-content:flex-start; width:100%}
  .dataTable{min-width:820px}
  .appearanceControl{min-width:100%}
}
`;

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function loadVisibleProposalsForUser(authUser) {
  if (!authUser?.key) return [];

  const ownProposals = readJson(PROPOSALS_KEY(authUser.key), []);
  if (!authUser.canViewAllProposals || typeof window === "undefined") {
    return ownProposals.map(normalizeProposalRecord);
  }

  const mergedByKey = new Map();
  const addProposal = (proposal) => {
    const normalized = normalizeProposalRecord(proposal);
    const uniqueKey =
      String(normalized.id || "").trim() ||
      String(normalized.proposalNumber || "").trim() ||
      String(normalized.sourceEstimateId || "").trim() ||
      String(normalized.sourceEstimateCode || "").trim() ||
      JSON.stringify([normalized.customerName || "", normalized.updatedAt || "", normalized.createdAt || ""]);
    mergedByKey.set(uniqueKey, normalized);
  };

  const addCollection = (collection) => {
    if (!Array.isArray(collection)) return;
    collection.forEach(addProposal);
  };

  addCollection(ownProposals);

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey || !storageKey.startsWith(PROPOSALS_KEY_PREFIX)) continue;
      addCollection(readJson(storageKey, []));
    }
  } catch {
    // ignore localStorage enumeration errors
  }

  return Array.from(mergedByKey.values()).sort((a, b) => {
    const left = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const right = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return right - left;
  });
}

function createBlankCfoLiquidCashEntry() {
  return {
    id: createFieldDailyLogId(),
    bankAccountName: "",
    currentLiquidBalance: "",
    lastUpdatedDate: "",
    includedInTotal: "Yes",
  };
}

function buildCfoSourceRecordUid(recordType, cardKey, id) {
  return `${recordType}:${cardKey}:${String(id || "")}`;
}

function flattenCfoStateToSupabaseRecords(liquidCashEntries = [], receivableEntries = [], manualEntriesByCard = {}) {
  const liquid = flattenLiquidCashEntriesToSharedRecord(Array.isArray(liquidCashEntries) ? liquidCashEntries : []).map((record) => ({
    ...record,
    card_key: CFO_SHARED_LIQUID_CASH_CARD_KEY,
    source_record_uid: CFO_SHARED_LIQUID_CASH_RECORD_UID,
  }));

  const receivable = (Array.isArray(receivableEntries) ? receivableEntries : [])
    .map((entry) => normalizeCfoReceivableEntry(entry))
    .map((entry) => ({
      source_record_uid: buildCfoSourceRecordUid("receivable", "waitingOnPayment", entry.id),
      record_type: "receivable",
      card_key: "waitingOnPayment",
      customer_name: entry.customerName,
      record_name: entry.customerName || "",
      amount: toNumber(entry.amountOwed, 0),
      period_from_date: entry.periodFromDate || null,
      period_to_date: entry.periodToDate || null,
      status: entry.paymentStatus || "",
      note: entry.note || "",
      record_date: entry.periodToDate || entry.periodFromDate || null,
      included_in_total: true,
      is_archived: false,
      row_version: Math.max(1, toNumber(entry.rowVersion, 1)),
    }));

  const manual = CFO_MANUAL_CARD_KEYS.flatMap((cardKey) => {
    const entries = Array.isArray(manualEntriesByCard?.[cardKey]) ? manualEntriesByCard[cardKey] : [];
    return entries.map((entry) => normalizeCfoManualEntry(entry, cardKey)).map((entry) => ({
      source_record_uid: buildCfoSourceRecordUid("manual", cardKey, entry.id),
      record_type: "manual",
      card_key: cardKey,
      record_name: entry.recordName || "",
      amount: toNumber(entry.amount, 0),
      count_value: toNumber(entry.count, cardKey === "proposalsSent" ? 1 : 0),
      record_date: entry.recordDate || null,
      status: entry.status || "",
      note: entry.note || "",
      included_in_total: true,
      is_archived: false,
      row_version: Math.max(1, toNumber(entry.rowVersion, 1)),
    }));
  });

  return [...liquid, ...receivable, ...manual];
}

function flattenCfoNonLiquidCashRecords(receivableEntries = [], manualEntriesByCard = {}) {
  return stripLiquidCashRecords(flattenCfoStateToSupabaseRecords([], receivableEntries, manualEntriesByCard));
}

function hydrateCfoStateFromSupabaseRecords(rows = []) {
  const source = Array.isArray(rows) ? rows.filter((row) => !row?.is_archived) : [];

  const liquidCashEntries = hydrateLiquidCashEntriesFromSupabaseRows(source).map((entry) =>
    normalizeCfoLiquidCashEntry({
      ...entry,
      id: String(entry.id || "").split(":").pop() || CFO_SHARED_LIQUID_CASH_RECORD_UID,
      currentLiquidBalance: money2(toNumber(entry.currentLiquidBalance, 0)),
      rowVersion: toNumber(entry.rowVersion, 1),
    }),
  );

  const receivableEntries = source
    .filter((row) => row.record_type === "receivable")
    .map((row) =>
      normalizeCfoReceivableEntry({
        id: String(row.source_record_uid || "").split(":").pop() || createFieldDailyLogId(),
        customerName: row.customer_name || row.record_name || "",
        periodFromDate: row.period_from_date || "",
        periodToDate: row.period_to_date || "",
        amountOwed: money2(toNumber(row.amount, 0)),
        paymentStatus: row.status || "Waiting on Payment",
        note: row.note || "",
        rowVersion: toNumber(row.row_version, 1),
      }),
    );

  const manualEntriesByCard = createBlankCfoManualEntriesByCard();
  source
    .filter((row) => row.record_type === "manual" && CFO_MANUAL_CARD_KEYS.includes(String(row.card_key || "")))
    .forEach((row) => {
      const cardKey = String(row.card_key || "");
      manualEntriesByCard[cardKey].push(
        normalizeCfoManualEntry(
          {
            id: String(row.source_record_uid || "").split(":").pop() || createFieldDailyLogId(),
            recordName: row.record_name || "",
            amount: money2(toNumber(row.amount, 0)),
            count: String(toNumber(row.count_value, cardKey === "proposalsSent" ? 1 : 0)),
            recordDate: row.record_date || "",
            status: row.status || "",
            note: row.note || "",
            rowVersion: toNumber(row.row_version, 1),
            updatedAt: row.updated_at || "",
          },
          cardKey,
        ),
      );
    });

  return {
    liquidCashEntries,
    receivableEntries,
    manualEntriesByCard,
  };
}

function hasActiveLiquidCashRecord(rows = []) {
  return (Array.isArray(rows) ? rows : []).some((row) =>
    !row?.is_archived &&
    String(row?.record_type || "") === "liquid_cash" &&
    String(row?.card_key || "") === CFO_SHARED_LIQUID_CASH_CARD_KEY,
  );
}

function normalizeCfoLiquidCashEntry(entry = {}) {
  return {
    id: String(entry.id || createFieldDailyLogId()),
    bankAccountName: String(entry.bankAccountName || entry.bank_account_name || ""),
    currentLiquidBalance: String(entry.currentLiquidBalance ?? entry.current_liquid_balance ?? ""),
    lastUpdatedDate: String(entry.lastUpdatedDate || entry.last_updated_date || ""),
    includedInTotal: String(entry.includedInTotal || entry.included_in_total || "Yes"),
    rowVersion: Math.max(1, toNumber(entry.rowVersion ?? entry.row_version, 1)),
  };
}

function createBlankCfoReceivableEntry() {
  return {
    id: createFieldDailyLogId(),
    customerName: "",
    periodFromDate: "",
    periodToDate: "",
    amountOwed: "",
    paymentStatus: "Waiting on Payment",
    note: "",
  };
}

function normalizeCfoReceivableEntry(entry = {}) {
  return {
    id: String(entry.id || createFieldDailyLogId()),
    customerName: String(entry.customerName || entry.customer_name || ""),
    periodFromDate: String(entry.periodFromDate || entry.period_from_date || ""),
    periodToDate: String(entry.periodToDate || entry.period_to_date || ""),
    amountOwed: String(entry.amountOwed ?? entry.amount_owed ?? ""),
    paymentStatus: normalizeReceivablePaymentStatus(entry.paymentStatus || entry.payment_status),
    note: String(entry.note || ""),
    rowVersion: Math.max(1, toNumber(entry.rowVersion ?? entry.row_version, 1)),
  };
}

function createBlankApprovedJobQuickDraft() {
  return {
    projectName: "",
    customerName: "",
    projectAddress: "",
    contractAmount: "",
    anticipatedStartDate: "",
    projectContact: "",
    status: "Approved",
  };
}

function createBlankCfoManualEntry(cardKey = "") {
  return {
    id: createFieldDailyLogId(),
    recordName: "",
    amount: "",
    count: cardKey === "proposalsSent" ? "1" : "",
    recordDate: "",
    status: cardKey === "supplierOverdue"
      ? "Overdue"
      : cardKey === "supplierTotalsPayable"
        ? "Waiting on Payment"
        : "",
    note: "",
  };
}

function normalizeCfoManualEntry(entry = {}, cardKey = "") {
  const rawStatus = String(entry.status || entry.paymentStatus || entry.payment_status || "");
  return {
    id: String(entry.id || createFieldDailyLogId()),
    recordName: String(entry.recordName || entry.record_name || entry.label || ""),
    amount: String(entry.amount ?? entry.dollarAmount ?? entry.dollar_amount ?? ""),
    count: cardKey === "proposalsSent" ? String(entry.count ?? entry.proposalCount ?? entry.proposal_count ?? "") : String(entry.count ?? entry.proposalCount ?? entry.proposal_count ?? ""),
    recordDate: String(entry.recordDate || entry.record_date || entry.date || ""),
    status: cardKey === "supplierTotalsPayable" || cardKey === "supplierOverdue"
      ? normalizeSupplierPaymentStatus(rawStatus, cardKey === "supplierOverdue" ? "Overdue" : "Waiting on Payment")
      : rawStatus,
    note: String(entry.note || ""),
    rowVersion: Math.max(1, toNumber(entry.rowVersion ?? entry.row_version, 1)),
    updatedAt: String(entry.updatedAt || entry.updated_at || ""),
  };
}

function formatCfoRecordUpdatedAt(value) {
  if (!value) return "—";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "—";
  return timestamp.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function createBlankSupplierPaymentDraft() {
  return {
    paymentDate: "",
    paymentMethod: "ACH",
    paymentKind: "Full",
    amountPaid: "",
    checkNumber: "",
    note: "",
  };
}

function createBlankCfoManualEntriesByCard() {
  return CFO_MANUAL_CARD_KEYS.reduce((acc, cardKey) => {
    acc[cardKey] = [];
    return acc;
  }, {});
}

function normalizeCfoManualEntriesByCard(entriesByCard = {}) {
  return CFO_MANUAL_CARD_KEYS.reduce((acc, cardKey) => {
    const entries = Array.isArray(entriesByCard?.[cardKey]) ? entriesByCard[cardKey] : [];
    acc[cardKey] = entries.map((entry) => normalizeCfoManualEntry(entry, cardKey));
    return acc;
  }, {});
}

function createBlankCfoManualDraftsByCard() {
  return CFO_MANUAL_CARD_KEYS.reduce((acc, cardKey) => {
    acc[cardKey] = createBlankCfoManualEntry(cardKey);
    return acc;
  }, {});
}

function createBlankCfoManualEditingByCard() {
  return CFO_MANUAL_CARD_KEYS.reduce((acc, cardKey) => {
    acc[cardKey] = "";
    return acc;
  }, {});
}

function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function buildEstimateRoofType(inputs = {}) {
  if (inputs.estimateType && String(inputs.estimateType).trim() && String(inputs.estimateType).trim() !== "TPO") {
    return String(inputs.estimateType);
  }
  if (inputs.substrateType) {
    const option = SUBSTRATE_OPTIONS.find((item) => item.value === inputs.substrateType);
    return option?.label || inputs.substrateType;
  }
  if (inputs.existingRoofAction) {
    const option = EXISTING_ROOF_OPTIONS.find((item) => item.value === inputs.existingRoofAction);
    return option?.label || inputs.existingRoofAction;
  }
  if (inputs.jobType) {
    const option = JOB_TYPE_OPTIONS.find((item) => item.value === inputs.jobType);
    return option?.label || inputs.jobType;
  }
  return "TPO";
}

function mapEstimateRow(row) {
  if (!row) return null;
  const estimateData = row.estimate_data || {};
  return {
    dbId: row.id,
    id: row.local_estimate_id || row.id,
    ownerId: row.owner_id || "",
    ownerDisplayName: row.owner_display_name || "",
    ownerEmail: row.owner_email || "",
    estimateNumber: row.company_estimate_number || row.estimate_number,
    companyEstimateNumber: row.company_estimate_number || row.estimate_number,
    estimateCode: row.estimate_code,
    estimateType: row.estimate_type,
    name: row.name,
    savedAt: row.saved_at,
    status: row.estimate_status || row.status || "draft",
    inputs: estimateData.inputs || row.inputs || {},
    prices: estimateData.prices || row.prices || {},
    summary: estimateData.summary || row.summary || {},
  };
}

function mapCompletedJobRow(row) {
  if (!row) return null;
  return {
    id: row.local_estimate_id || row.id,
    estimateId: row.estimate_id || row.local_estimate_id,
    estimateCode: row.estimate_code,
    customerName: row.customer_name,
    jobAddress: row.job_address,
    roofType: row.roof_type,
    squareCount: row.square_count,
    finalBid: row.final_bid,
    laborCost: row.labor_cost,
    materialsCost: row.materials_cost || row.actual_material_cost,
    profit: row.profit,
    status: row.status,
    savedAt: row.saved_at,
    dailyProgressLog: row.daily_progress_log || [],
    laborLog: row.labor_log || [],
    materialUsageLog: row.material_usage_log || [],
    actualLaborHours: row.actual_labor_hours,
    actualLaborCost: row.actual_labor_cost,
    actualCost: row.actual_cost,
  };
}

function normalizeAppRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "cfo") return "cfo";
  if (normalized === "estimator") return "estimator";
  if (normalized === "project_manager") return "project_manager";
  if (normalized === "salesperson") return "salesperson";
  return "salesperson";
}

function hasExplicitAppRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "cfo" || normalized === "estimator" || normalized === "project_manager" || normalized === "salesperson";
}

function normalizeEmployeeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getEmployeeDirectoryEntry(email) {
  return EMPLOYEE_DIRECTORY_BY_EMAIL[normalizeEmployeeEmail(email)] || null;
}

function deriveBootstrapRoleFromEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (normalized === "natalia@crtroofing.com") return "admin";
  if (normalized === "jorge@crtroofing.com" || normalized === "jorgejr@crtroofing.com") return "cfo";
  if (normalized === "miguel@crtroofing.com") return "project_manager";
  return "salesperson";
}

function mapAuthUserFromSession(user, profile = null) {
  if (!user?.id) return null;
  const email = String(user.email || "");
  const directoryEntry = getEmployeeDirectoryEntry(email);
  const fullName = String(profile?.full_name || profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  const fallbackName = String(email || "User").trim();
  const profileRole = String(profile?.role || "").trim();
  const metadataRole = String(user.app_metadata?.role || user.user_metadata?.role || "").trim();
  const role = hasExplicitAppRole(profileRole)
    ? normalizeAppRole(profileRole)
    : hasExplicitAppRole(metadataRole)
      ? normalizeAppRole(metadataRole)
      : deriveBootstrapRoleFromEmail(email);
  const roleSource = hasExplicitAppRole(profileRole)
    ? "user_profiles"
    : hasExplicitAppRole(metadataRole)
      ? "auth_metadata"
      : "bootstrap_email";
  const canAccessCfoDashboard = role === "admin" || role === "cfo";
  return {
    key: String(user.id),
    displayName: directoryEntry?.displayName || fullName || fallbackName,
    email,
    title: directoryEntry?.title || (role === "admin" ? "Administration" : role === "cfo" ? "Finance" : role === "project_manager" ? "Project Manager / Production" : "Sales"),
    canViewAllProposals: Boolean(directoryEntry?.canViewAllProposals),
    canAccessCfoDashboard,
    role,
    roleSource,
    avatarPath: String(profile?.avatar_path || ""),
    avatarUrl: "",
    source: "supabase",
  };
}

function createFieldDailyLogId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createBlankFieldDailyLogCrewRow() {
  return {
    id: createFieldDailyLogId(),
    employeeLookupId: "",
    employeeName: "",
    employeeId: "",
    startTime: "",
    endTime: "",
    lunchDurationHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    doubleTimeHours: 0,
    role: "",
  };
}

function createBlankFieldDailyLogMaterialRow() {
  return {
    id: createFieldDailyLogId(),
    materialName: "",
    quantity: 0,
    unit: "",
    notes: "",
  };
}

function createBlankFieldDailyLogPhotoRow(category = "progress") {
  return {
    id: createFieldDailyLogId(),
    photoCategory: category,
    fileName: "",
    storagePath: "",
    photoUrl: "",
    uploadedAt: "",
    uploadedBy: "",
    deviceIdentifier: "",
  };
}

function createBlankFieldDailyLogVehicleRow() {
  return {
    id: createFieldDailyLogId(),
    vehicleId: "",
    driverEmployeeId: "",
    driverEmployeeName: "",
    truckName: "",
    unitNumber: "",
    licensePlate: "",
    vehicleType: "",
    startingMileage: 0,
    endingMileage: 0,
    milesDriven: 0,
    mileageFlag: false,
    otherDescription: "",
  };
}

function createBlankFieldDailyLogFuelReceiptRow() {
  return {
    id: createFieldDailyLogId(),
    vehicleRowId: "",
    gallonsPumped: 0,
    totalReceiptAmount: 0,
    pricePerGallon: 0,
    fuelStation: "",
    receiptDateTime: "",
    receiptPhoto: null,
    receiptPhotoUrl: "",
    receiptPhotoPath: "",
    receiptPhotoName: "",
    fuelPurchased: true,
  };
}

function createBlankEmployeeRecord() {
  return {
    id: createFieldDailyLogId(),
    firstName: "",
    lastName: "",
    displayName: "",
    occupation: "",
    department: "Field Operations",
    isActive: true,
    isForeman: false,
    isDriver: false,
    employeeNumber: "",
    phone: "",
    email: "",
    hireDate: "",
    hourlyRate: 0,
    payrollId: "",
    notes: "",
    displayOrder: 0,
  };
}

function createBlankFieldDailyLog(userDisplayName = "") {
  return {
    id: createFieldDailyLogId(),
    jobNumber: "",
    jobName: "",
    jobAddress: "",
    workDate: new Date().toISOString().slice(0, 10),
    foreman: userDisplayName || "",
    weatherConditions: "",
    jobStartTime: "",
    lunchStartTime: "",
    lunchEndTime: "",
    jobEndTime: "",
    fuelPurchased: false,
    crewRows: [createBlankFieldDailyLogCrewRow()],
    workCompleted: "",
    materialsUsedText: "",
    materialsRows: [createBlankFieldDailyLogMaterialRow()],
    equipmentUsed: "",
    delaysOrProblems: "",
    safetyIncidents: false,
    additionalNotes: "",
    vehicleRows: [createBlankFieldDailyLogVehicleRow()],
    fuelReceipts: [],
    photos: [],
    status: "draft",
    submittedAt: "",
    submittedBy: "",
    deviceIdentifier: "",
    correctionOfLogId: "",
    correctionReason: "",
    revisions: [],
  };
}

function normalizeTimeInputValue(value) {
  return String(value || "").trim();
}

function calculateMinutesBetweenTimes(startTime, endTime) {
  const start = normalizeTimeInputValue(startTime);
  const end = normalizeTimeInputValue(endTime);
  if (!start || !end) return 0;
  const [startHours, startMinutes] = start.split(":").map((item) => Number(item));
  const [endHours, endMinutes] = end.split(":").map((item) => Number(item));
  if (![startHours, startMinutes, endHours, endMinutes].every((item) => Number.isFinite(item))) return 0;
  const startTotal = startHours * 60 + startMinutes;
  let endTotal = endHours * 60 + endMinutes;
  if (endTotal < startTotal) endTotal += 24 * 60;
  return Math.max(0, endTotal - startTotal);
}

function calculateHoursBetweenTimes(startTime, endTime) {
  return calculateMinutesBetweenTimes(startTime, endTime) / 60;
}

function normalizeFieldDailyLogCrewRow(row = {}) {
  return {
    id: String(row.id || createFieldDailyLogId()),
    employeeLookupId: String(row.employeeLookupId || row.employee_lookup_id || ""),
    employeeName: String(row.employeeName || row.employee_name || ""),
    employeeId: String(row.employeeId || row.employee_id || ""),
    startTime: normalizeTimeInputValue(row.startTime || row.start_time || ""),
    endTime: normalizeTimeInputValue(row.endTime || row.end_time || ""),
    lunchDurationHours: Math.max(0, toNumber(row.lunchDurationHours ?? row.lunch_duration_hours, 0)),
    regularHours: Math.max(0, toNumber(row.regularHours ?? row.regular_hours, 0)),
    overtimeHours: Math.max(0, toNumber(row.overtimeHours ?? row.overtime_hours, 0)),
    doubleTimeHours: Math.max(0, toNumber(row.doubleTimeHours ?? row.double_time_hours, 0)),
    role: String(row.role || ""),
  };
}

function normalizeFieldDailyLogMaterialRow(row = {}) {
  return {
    id: String(row.id || createFieldDailyLogId()),
    materialName: String(row.materialName || row.material_name || ""),
    quantity: Math.max(0, toNumber(row.quantity, 0)),
    unit: String(row.unit || ""),
    notes: String(row.notes || ""),
  };
}

function normalizeFieldDailyLogPhotoRow(row = {}) {
  return {
    id: String(row.id || createFieldDailyLogId()),
    photoCategory: String(row.photoCategory || row.photo_category || "progress"),
    fileName: String(row.fileName || row.file_name || ""),
    storagePath: String(row.storagePath || row.storage_path || ""),
    photoUrl: String(row.photoUrl || row.photo_url || ""),
    uploadedAt: String(row.uploadedAt || row.uploaded_at || ""),
    uploadedBy: String(row.uploadedBy || row.uploaded_by || ""),
    deviceIdentifier: String(row.deviceIdentifier || row.device_identifier || ""),
  };
}

function normalizeFieldDailyLogVehicleRow(row = {}) {
  return {
    id: String(row.id || createFieldDailyLogId()),
    vehicleId: String(row.vehicleId || row.vehicle_id || ""),
    driverEmployeeId: String(row.driverEmployeeId || row.driver_employee_id || ""),
    driverEmployeeName: String(row.driverEmployeeName || row.driver_employee_name || ""),
    truckName: String(row.truckName || row.truck_name || row.vehicle_name || ""),
    unitNumber: String(row.unitNumber || row.unit_number || ""),
    licensePlate: String(row.licensePlate || row.license_plate || ""),
    vehicleType: String(row.vehicleType || row.vehicle_type || ""),
    startingMileage: Math.max(0, toNumber(row.startingMileage ?? row.starting_mileage, 0)),
    endingMileage: Math.max(0, toNumber(row.endingMileage ?? row.ending_mileage, 0)),
    milesDriven: Math.max(0, toNumber(row.milesDriven ?? row.miles_driven, 0)),
    mileageFlag: Boolean(row.mileageFlag ?? row.mileage_flag ?? false),
    otherDescription: String(row.otherDescription || row.other_description || ""),
  };
}

function normalizeFieldDailyLogFuelReceiptRow(row = {}) {
  return {
    id: String(row.id || createFieldDailyLogId()),
    vehicleRowId: String(row.vehicleRowId || row.vehicle_row_id || ""),
    gallonsPumped: Math.max(0, toNumber(row.gallonsPumped ?? row.gallons_pumped, 0)),
    totalReceiptAmount: Math.max(0, toNumber(row.totalReceiptAmount ?? row.total_receipt_amount, 0)),
    pricePerGallon: Math.max(0, toNumber(row.pricePerGallon ?? row.price_per_gallon, 0)),
    fuelStation: String(row.fuelStation || row.fuel_station || ""),
    receiptDateTime: String(row.receiptDateTime || row.receipt_date_time || ""),
    receiptPhoto: null,
    receiptPhotoUrl: String(row.receiptPhotoUrl || row.receipt_photo_url || ""),
    receiptPhotoPath: String(row.receiptPhotoPath || row.receipt_photo_path || ""),
    receiptPhotoName: String(row.receiptPhotoName || row.receipt_photo_name || ""),
    fuelPurchased: Boolean(row.fuelPurchased ?? row.fuel_purchased ?? true),
  };
}

function normalizeFieldDailyLogRevisionRow(row = {}) {
  return {
    id: String(row.id || createFieldDailyLogId()),
    fieldName: String(row.fieldName || row.field_name || ""),
    originalValue: String(row.originalValue || row.original_value || ""),
    updatedValue: String(row.updatedValue || row.updated_value || ""),
    changedBy: String(row.changedBy || row.changed_by || ""),
    reason: String(row.reason || ""),
    changedAt: String(row.changedAt || row.changed_at || row.changed_at || new Date().toISOString()),
  };
}

function normalizeFieldDailyLogDraft(log = {}, userDisplayName = "") {
  const crewRowsSource = Array.isArray(log.crewRows)
    ? log.crewRows
    : Array.isArray(log.crew_rows)
      ? log.crew_rows
      : [createBlankFieldDailyLogCrewRow()];
  const materialRowsSource = Array.isArray(log.materialsRows)
    ? log.materialsRows
    : Array.isArray(log.material_rows)
      ? log.material_rows
      : [createBlankFieldDailyLogMaterialRow()];
  const photosSource = Array.isArray(log.photos) ? log.photos : Array.isArray(log.photo_rows) ? log.photo_rows : [];
  const vehicleRowsSource = Array.isArray(log.vehicleRows)
    ? log.vehicleRows
    : Array.isArray(log.vehicle_rows)
      ? log.vehicle_rows
      : [createBlankFieldDailyLogVehicleRow()];
  const fuelReceiptsSource = Array.isArray(log.fuelReceipts)
    ? log.fuelReceipts
    : Array.isArray(log.fuel_receipts)
      ? log.fuel_receipts
      : [];
  const revisionsSource = Array.isArray(log.revisions) ? log.revisions : Array.isArray(log.revision_rows) ? log.revision_rows : [];

  return {
    id: String(log.id || createFieldDailyLogId()),
    serverUpdatedAt: log.serverUpdatedAt || null,
    jobNumber: String(log.jobNumber || log.job_number || ""),
    jobName: String(log.jobName || log.job_name || ""),
    jobAddress: String(log.jobAddress || log.job_address || ""),
    workDate: String(log.workDate || log.work_date || new Date().toISOString().slice(0, 10)),
    foreman: String(log.foreman || ""),
    weatherConditions: String(log.weatherConditions || log.weather_conditions || ""),
    jobStartTime: normalizeTimeInputValue(log.jobStartTime || log.job_start_time || ""),
    lunchStartTime: normalizeTimeInputValue(log.lunchStartTime || log.lunch_start_time || ""),
    lunchEndTime: normalizeTimeInputValue(log.lunchEndTime || log.lunch_end_time || ""),
    jobEndTime: normalizeTimeInputValue(log.jobEndTime || log.job_end_time || ""),
    fuelPurchased: Boolean(log.fuelPurchased ?? log.fuel_purchased ?? false),
    crewRows: crewRowsSource.map(normalizeFieldDailyLogCrewRow),
    workCompleted: String(log.workCompleted || log.work_completed || ""),
    materialsUsedText: String(log.materialsUsedText || log.materials_used || ""),
    materialsRows: materialRowsSource.map(normalizeFieldDailyLogMaterialRow),
    equipmentUsed: String(log.equipmentUsed || log.equipment_used || ""),
    delaysOrProblems: String(log.delaysOrProblems || log.delays_or_problems || ""),
    safetyIncidents: Boolean(log.safetyIncidents ?? log.safety_incident ?? log.safety_incidents ?? false),
    additionalNotes: String(log.additionalNotes || log.additional_notes || ""),
    vehicleRows: vehicleRowsSource.map(normalizeFieldDailyLogVehicleRow),
    fuelReceipts: fuelReceiptsSource.map(normalizeFieldDailyLogFuelReceiptRow),
    photos: photosSource.map(normalizeFieldDailyLogPhotoRow),
    status: String(log.status || "draft").toLowerCase() === "submitted" ? "submitted" : "draft",
    submittedAt: String(log.submittedAt || log.submitted_at || ""),
    submittedBy: String(log.submittedBy || log.submitted_by || userDisplayName || ""),
    deviceIdentifier: String(log.deviceIdentifier || log.device_identifier || ""),
    correctionOfLogId: String(log.correctionOfLogId || log.correction_of_log_id || ""),
    correctionReason: String(log.correctionReason || log.correction_reason || ""),
    revisions: revisionsSource.map(normalizeFieldDailyLogRevisionRow),
  };
}

function calculateFieldDailyLogTotals(log = {}) {
  const crewRows = Array.isArray(log.crewRows) ? log.crewRows : [];
  const materialsRows = Array.isArray(log.materialsRows) ? log.materialsRows : [];
  const vehicleRows = Array.isArray(log.vehicleRows) ? log.vehicleRows : [];
  const fuelReceipts = Array.isArray(log.fuelReceipts) ? log.fuelReceipts : [];
  const photos = Array.isArray(log.photos) ? log.photos : [];

  const totalRegularHours = crewRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.regularHours, 0)), 0);
  const totalOvertimeHours = crewRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.overtimeHours, 0)), 0);
  const totalDoubleTimeHours = crewRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.doubleTimeHours, 0)), 0);
  const totalCrewHours = totalRegularHours + totalOvertimeHours + totalDoubleTimeHours;
  const totalMaterialItems = materialsRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.quantity, 0) * 1), 0);
  const vehicleMilesDriven = vehicleRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.milesDriven, 0)), 0);
  const totalFuelReceipts = fuelReceipts.reduce((sum, row) => sum + Math.max(0, toNumber(row.totalReceiptAmount, 0)), 0);
  const totalFuelGallons = fuelReceipts.reduce((sum, row) => sum + Math.max(0, toNumber(row.gallonsPumped, 0)), 0);
  const calculatedLunchDurationHours = Math.max(0, calculateHoursBetweenTimes(log.lunchStartTime, log.lunchEndTime));
  const calculatedTimeOnSiteHours = Math.max(
    0,
    calculateHoursBetweenTimes(log.jobStartTime, log.jobEndTime) - calculatedLunchDurationHours,
  );
  const highMileageCount = vehicleRows.filter((row) => Math.max(0, toNumber(row.milesDriven, 0)) >= FIELD_DAILY_LOG_HIGH_MILEAGE_THRESHOLD).length;
  const photoCount = photos.length;

  return {
    totalRegularHours,
    totalOvertimeHours,
    totalDoubleTimeHours,
    totalCrewHours,
    totalMaterialItems,
    vehicleMilesDriven,
    totalFuelReceipts,
    totalFuelGallons,
    calculatedLunchDurationHours,
    calculatedTimeOnSiteHours,
    highMileageCount,
    photoCount,
  };
}

function fieldDailyLogHasProgressOrCompletedPhoto(log = {}) {
  return Array.isArray(log.photos) && log.photos.some((photo) => {
    const category = String(photo.photoCategory || photo.photo_category || "").toLowerCase();
    return category === "progress" || category === "completed";
  });
}

function mapFieldDailyLogRow(row, crewRows = [], materialsRows = [], vehicleRows = [], fuelReceipts = [], photos = [], revisions = []) {
  if (!row) return null;
  const draft = normalizeFieldDailyLogDraft(
    {
      id: row.id,
      jobNumber: row.job_number,
      jobName: row.job_name,
      jobAddress: row.job_address,
      workDate: row.work_date,
      foreman: row.foreman,
      weatherConditions: row.weather_conditions,
      workCompleted: row.work_completed,
      materialsUsedText: row.materials_used,
      equipmentUsed: row.equipment_used,
      delaysOrProblems: row.delays_or_problems,
      safetyIncidents: row.safety_incidents,
      additionalNotes: row.additional_notes,
      jobStartTime: row.job_start_time,
      lunchStartTime: row.lunch_start_time,
      lunchEndTime: row.lunch_end_time,
      jobEndTime: row.job_end_time,
      fuelPurchased: row.fuel_purchased,
      vehicleRows,
      fuelReceipts,
      photos,
      status: row.status,
      submittedAt: row.submitted_at,
      submittedBy: row.submitted_by,
      deviceIdentifier: row.device_identifier,
      correctionOfLogId: row.correction_of_log_id,
      correctionReason: row.correction_reason,
      revisions,
      crewRows,
      materialsRows,
    },
    row.submitted_by || "",
  );
  const totals = calculateFieldDailyLogTotals(draft);
  return {
    ...draft,
    totalRegularHours: toNumber(row.total_regular_hours, totals.totalRegularHours),
    totalOvertimeHours: toNumber(row.total_overtime_hours, totals.totalOvertimeHours),
    totalDoubleTimeHours: toNumber(row.total_double_time_hours, totals.totalDoubleTimeHours),
    totalCrewHours: toNumber(row.total_crew_hours, totals.totalCrewHours),
    vehicleMilesDriven: toNumber(row.vehicle_miles_driven, totals.vehicleMilesDriven),
    totalFuelReceipts: toNumber(row.total_fuel_receipts, totals.totalFuelReceipts),
    totalFuelGallons: toNumber(row.total_fuel_gallons, totals.totalFuelGallons),
    calculatedLunchDurationHours: toNumber(row.calculated_lunch_duration_hours, totals.calculatedLunchDurationHours),
    calculatedTimeOnSiteHours: toNumber(row.calculated_time_on_site_hours, totals.calculatedTimeOnSiteHours),
    highMileageCount: toNumber(row.high_mileage_count, totals.highMileageCount),
    photoCount: toNumber(row.photo_count, totals.photoCount),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

async function fetchSavedEstimatesFromSupabase(userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  return supabase
    .from("estimates")
    .select("*")
    .eq("owner_id", userKey)
    .order("saved_at", { ascending: false });
}

async function fetchSavedEstimatesForRole(userKey, isAdmin) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  let query = supabase
    .from("estimates")
    .select("*")
    .order("saved_at", { ascending: false });
  if (!isAdmin) {
    query = query.eq("owner_id", userKey);
  }
  return query;
}

async function fetchAuthUserProfile(userId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, role, avatar_path")
    .eq("id", userId)
    .maybeSingle();
  return { data, error };
}

async function ensureAuthUserProfile(user, profile = null) {
  if (!user?.id) return { data: profile, error: null };
  if (profile) return { data: profile, error: null };
  const email = String(user.email || "").trim();
  if (!email) return { data: null, error: null };
  const role = deriveBootstrapRoleFromEmail(email);
  const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || email).trim();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        email,
        full_name: fullName,
        role,
      },
      { onConflict: "id" },
    )
    .select("id, full_name, email, role, avatar_path")
    .maybeSingle();
  return { data, error };
}

async function fetchCompanyUserProfiles() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, role, avatar_path")
    .order("full_name", { ascending: true });
  return { data: Array.isArray(data) ? data : [], error };
}

function mapCrmLeadRow(row = {}) {
  return normalizeCrmLead({
    ...(row.lead_payload && typeof row.lead_payload === "object" ? row.lead_payload : {}),
    ...row,
    id: row.id,
    contactName: row.contact_name,
    assignedStaffId: row.assigned_staff_id,
    roofingServiceNeeded: row.service_needed,
    description: row.quick_note,
    leadStatus: row.status,
    estimatedValue: row.estimated_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

async function fetchCrmLeadsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase.from("crm_leads").select("*").order("updated_at", { ascending: false });
  return { data: Array.isArray(data) ? data.map(mapCrmLeadRow) : [], error };
}

async function fetchCrmLeadDocumentsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase.from("crm_lead_documents").select("*").order("created_at", { ascending: false });
  return { data: Array.isArray(data) ? data : [], error };
}

async function uploadCrmLeadWorkOrder(leadId, file) {
  if (!leadId || !file) return { data: null, error: new Error("Choose a PDF work order to upload.") };
  if (!/\.pdf$/i.test(String(file.name || "")) || String(file.type || "application/pdf") !== "application/pdf") {
    return { data: null, error: new Error("Work orders must be PDF files.") };
  }
  if (Number(file.size || 0) > CRM_LEAD_WORK_ORDER_MAX_BYTES) {
    return { data: null, error: new Error(`${file.name || "The work order"} is larger than 25 MB.`) };
  }
  const safeName = String(file.name || "work-order.pdf").replace(/[^a-z0-9._-]/gi, "_");
  const storagePath = `${leadId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from(CRM_LEAD_WORK_ORDER_BUCKET).upload(storagePath, file, { contentType: "application/pdf", upsert: false });
  if (upload.error) return { data: null, error: upload.error };
  const registration = await supabase.rpc("register_crm_lead_document", {
    p_lead_id: leadId,
    p_category: "work_order",
    p_file_name: file.name,
    p_storage_path: storagePath,
    p_content_type: "application/pdf",
    p_file_size: file.size,
  });
  if (registration.error) {
    await supabase.storage.from(CRM_LEAD_WORK_ORDER_BUCKET).remove([storagePath]);
    return { data: null, error: registration.error };
  }
  return { data: registration.data, error: null };
}

async function upsertCrmLeadToSupabase(lead, actor) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !actor?.key) return { data: null, error: null };
  const normalized = normalizeCrmLead(lead);
  const originatorId = normalized.originatorId || actor.key;
  const row = {
    id: normalized.id,
    created_by: originatorId,
    originator_id: originatorId,
    originator_name: normalized.originatorName || actor.displayName || "",
    originator_email: normalized.originatorEmail || actor.email || "",
    relationship_owner_id: normalized.relationshipOwnerId || originatorId,
    assigned_staff_id: normalized.assignedStaffId,
    contact_name: normalized.contactName,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    company_name: normalized.companyName,
    phone: normalized.phone,
    email: normalized.email,
    property_address: normalized.propertyAddress,
    city: normalized.city,
    zip_code: normalized.zipCode,
    lead_source: normalized.leadSource || "Cold Calling",
    service_needed: normalized.roofingServiceNeeded,
    quick_note: normalized.description,
    status: normalized.leadStatus,
    qualification_status: normalized.qualificationStatus,
    qualified_at: normalized.qualifiedAt || null,
    qualified_by: normalized.qualifiedBy || null,
    accepted_for_inspection_at: normalized.acceptedForInspectionAt || null,
    accepted_for_inspection_by: normalized.acceptedForInspectionBy || null,
    inspection_scheduled_at: normalized.inspectionScheduledAt || null,
    converted_customer_id: normalized.convertedCustomerId,
    estimated_value: Math.max(0, toNumber(normalized.estimatedValue, 0)),
    lead_payload: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    updated_by: actor.key,
  };
  const updateRow = { ...row };
  delete updateRow.created_by;
  delete updateRow.originator_id;
  const updated = await supabase.from("crm_leads").update(updateRow).eq("id", normalized.id).select("*").maybeSingle();
  if (updated.error) return { data: null, error: updated.error };
  if (updated.data) return { data: mapCrmLeadRow(updated.data), error: null };
  const inserted = await supabase.from("crm_leads").insert({ ...row, created_by: actor.key, originator_id: actor.key }).select("*").maybeSingle();
  return { data: inserted.data ? mapCrmLeadRow(inserted.data) : null, error: inserted.error };
}

async function deleteCrmLeadFromSupabase(leadId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !leadId) return { error: null };
  return supabase.from("crm_leads").delete().eq("id", leadId);
}

function mapCrmCustomerRow(row = {}) {
  return normalizeCrmCustomer({
    ...(row.customer_payload && typeof row.customer_payload === "object" ? row.customer_payload : {}),
    ...row,
    id: row.id,
    customerName: row.customer_name,
    sourceLeadId: row.source_lead_id,
    assignedStaffId: row.assigned_staff_id,
    billingAddress: row.billing_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

async function fetchCrmCustomersFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase.from("crm_customers").select("*").order("updated_at", { ascending: false });
  return { data: Array.isArray(data) ? data.map(mapCrmCustomerRow) : [], error };
}

async function upsertCrmCustomerToSupabase(customer, actor) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !actor?.key) return { data: null, error: null };
  const normalized = normalizeCrmCustomer(customer);
  const sourceLeadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized.sourceLeadId)
    ? normalized.sourceLeadId
    : null;
  const sharedPayload = {
    ...normalized,
    files: [],
    proposalArchive: [],
  };
  const row = {
    id: normalized.id,
    source_lead_id: sourceLeadId,
    assigned_staff_id: normalized.assignedStaffId,
    customer_name: normalized.customerName,
    phone: normalized.phone,
    email: normalized.email,
    billing_address: normalized.billingAddress,
    customer_payload: sharedPayload,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    updated_by: actor.key,
  };
  const updated = await supabase.from("crm_customers").update(row).eq("id", normalized.id).select("*").maybeSingle();
  if (updated.error) return { data: null, error: updated.error };
  if (updated.data) return { data: mapCrmCustomerRow(updated.data), error: null };
  const inserted = await supabase.from("crm_customers").insert({ ...row, created_by: actor.key }).select("*").maybeSingle();
  return { data: inserted.data ? mapCrmCustomerRow(inserted.data) : null, error: inserted.error };
}

async function deleteCrmCustomerFromSupabase(customerId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !customerId) return { error: null };
  return supabase.from("crm_customers").delete().eq("id", customerId);
}

function mapCrmFollowupRow(row = {}) {
  return normalizeCrmFollowup({
    ...(row.followup_payload && typeof row.followup_payload === "object" ? row.followup_payload : {}),
    ...row,
    id: row.id,
    relatedType: row.related_type,
    relatedId: row.related_id,
    dueDate: row.due_date,
    assignedStaffId: row.assigned_staff_id,
    followUpType: row.follow_up_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}

async function fetchCrmFollowupsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase.from("crm_followups").select("*").order("due_date", { ascending: true });
  return { data: Array.isArray(data) ? data.map(mapCrmFollowupRow) : [], error };
}

async function upsertCrmFollowupToSupabase(followup, actor) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !actor?.key) return { data: null, error: null };
  const normalized = normalizeCrmFollowup(followup);
  const row = {
    id: normalized.id,
    related_type: normalized.relatedType === "customer" ? "customer" : "lead",
    related_id: normalized.relatedId,
    title: normalized.title,
    due_date: normalized.dueDate || null,
    assigned_staff_id: normalized.assignedStaffId,
    follow_up_type: normalized.followUpType,
    status: normalized.status,
    notes: normalized.notes,
    followup_payload: normalized,
    created_at: normalized.createdAt,
    completed_at: normalized.completedAt || null,
    updated_at: normalized.updatedAt,
    updated_by: actor.key,
  };
  const updated = await supabase.from("crm_followups").update(row).eq("id", normalized.id).select("*").maybeSingle();
  if (updated.error) return { data: null, error: updated.error };
  if (updated.data) return { data: mapCrmFollowupRow(updated.data), error: null };
  const inserted = await supabase.from("crm_followups").insert({ ...row, created_by: actor.key }).select("*").maybeSingle();
  return { data: inserted.data ? mapCrmFollowupRow(inserted.data) : null, error: inserted.error };
}

async function deleteCrmFollowupFromSupabase(followupId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !followupId) return { error: null };
  return supabase.from("crm_followups").delete().eq("id", followupId);
}

async function fetchCrmKpiTargetFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  return supabase.from("crm_kpi_targets").select("*").eq("key", "ivan_weekly_inspection_capacity").maybeSingle();
}

async function fetchCrmProposalRequestsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  return supabase
    .from("proposal_requests")
    .select("id, request_number, customer_name, property_name, source_lead_id, salesperson_id, assigned_estimator_id, status, priority, submitted_at, accepted_at, target_completion_at, sla_paused_at, sla_paused_seconds, missing_information_count, sent_at, updated_at")
    .order("submitted_at", { ascending: false });
}

async function fetchCrmProposalVersionsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  return supabase
    .from("proposal_versions")
    .select("id, proposal_request_id, version_number, finalized_at, source_document_storage_path, final_pdf_storage_path, pdf_storage_path, sent_at")
    .order("created_at", { ascending: false });
}

async function fetchCrmProposalAuditEventsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  return supabase
    .from("proposal_request_audit_events")
    .select("id, proposal_request_id, actor_id, action, created_at")
    .in("action", ["assigned", "information_requested"])
    .order("created_at", { ascending: false });
}

async function fetchIvanProfileFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  const result = await supabase
    .from("user_profiles")
    .select("id, full_name, email, role")
    .order("full_name", { ascending: true });
  return { data: findInspectionAssignee(result.data || []), error: result.error };
}

async function fetchDanielaProfileFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  const result = await supabase
    .from("user_profiles")
    .select("id, full_name, email, role")
    .order("full_name", { ascending: true });
  const profiles = result.data || [];
  const match = profiles.find((profile) => String(profile.email || "").trim().toLowerCase() === "daniela@crtroofing.com")
    || profiles.find((profile) => String(profile.full_name || "").trim().toLowerCase().startsWith("daniela "));
  return { data: match || null, error: result.error };
}

async function saveCrmKpiTargetToSupabase(value, actorId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  return supabase.from("crm_kpi_targets").upsert({
    key: "ivan_weekly_inspection_capacity",
    numeric_value: Math.max(0, Number(value) || 0),
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  }, { onConflict: "key" }).select("*").maybeSingle();
}

async function createProfilePhotoSignedUrl(avatarPath) {
  const path = String(avatarPath || "").trim();
  if (!path || !SUPABASE_URL || !SUPABASE_ANON_KEY) return "";
  const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (error) return "";
  return String(data?.signedUrl || "");
}

async function attachProfilePhotoUrl(mappedUser) {
  if (!mappedUser?.avatarPath) return mappedUser;
  const avatarUrl = await createProfilePhotoSignedUrl(mappedUser.avatarPath);
  return { ...mappedUser, avatarUrl };
}

async function fetchCompanyEstimatorSettingsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  const { data, error } = await supabase
    .from(COMPANY_ESTIMATOR_SETTINGS_TABLE)
    .select("*")
    .eq("id", "primary")
    .maybeSingle();
  return { data, error };
}

async function upsertCompanyEstimatorSettingsToSupabase(payload, updatedBy = "") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  const { data, error } = await supabase
    .from(COMPANY_ESTIMATOR_SETTINGS_TABLE)
    .upsert(
      {
        id: "primary",
        material_price_defaults: payload?.material_price_defaults || {},
        admin_pricing_defaults: payload?.admin_pricing_defaults || {},
        travel_defaults: payload?.travel_defaults || {},
        updated_by: updatedBy || null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();
  return { data, error };
}

async function fetchCompanyFinancialRecordsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase
    .from(COMPANY_FINANCIAL_RECORDS_TABLE)
    .select("*")
    .neq("record_type", "liquid_cash")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  return { data: Array.isArray(data) ? data : [], error };
}

async function fetchSupplierPaymentHistoryFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase
    .from("supplier_payment_history")
    .select("*")
    .order("recorded_at", { ascending: false });
  return { data: Array.isArray(data) ? data : [], error };
}

async function invokeLiquidCashFunction(functionName, body = {}) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (!error) return { data, error: null };
  let message = error?.message || "The secure liquid-cash request failed";
  try {
    const payload = await error.context?.json();
    if (payload?.error) message = payload.error;
    return { data: payload || data, error: new Error(message) };
  } catch {
    return { data, error: new Error(message) };
  }
}

async function upsertCompanyFinancialRecordsToSupabase(records = [], updatedBy = "") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  if (!Array.isArray(records) || records.length === 0) return { data: [], error: null };
  const payload = records.map((record) => ({
    ...record,
    updated_by: updatedBy || null,
    is_archived: false,
  }));
  const { data, error } = await supabase
    .from(COMPANY_FINANCIAL_RECORDS_TABLE)
    .upsert(payload, { onConflict: "source_record_uid" })
    .select("*");
  return { data: Array.isArray(data) ? data : [], error };
}

async function archiveCompanyFinancialRecordsInSupabase(sourceRecordUids = [], updatedBy = "") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  if (!Array.isArray(sourceRecordUids) || sourceRecordUids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from(COMPANY_FINANCIAL_RECORDS_TABLE)
    .update({ is_archived: true, updated_by: updatedBy || null })
    .in("source_record_uid", sourceRecordUids)
    .select("id, source_record_uid");
  return { data: Array.isArray(data) ? data : [], error };
}

async function reserveNextEstimateNumberFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { value: null, error: null };
  const { data, error } = await supabase.rpc("next_company_estimate_number");
  return { value: Number(data) || null, error };
}

async function peekNextEstimateNumberFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { value: null, error: null };
  const { data, error } = await supabase.rpc("peek_company_estimate_number");
  return { value: Number(data) || null, error };
}

async function fetchCompletedJobsFromSupabase(userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  return supabase
    .from("completed_jobs")
    .select("*")
    .eq("user_key", userKey)
    .order("saved_at", { ascending: false });
}

async function fetchSharedJobsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase
    .from(COMPANY_ACTIVE_JOBS_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  return { data: Array.isArray(data) ? data : [], error };
}

async function upsertSharedJobToSupabase(job, userKey = "", updatedBy = "") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const payload = buildSharedJobUpsertRow(job, userKey, updatedBy);
  const { data, error } = await supabase
    .from(COMPANY_ACTIVE_JOBS_TABLE)
    .upsert([payload], { onConflict: "source_record_uid" })
    .select("*");
  return { data: Array.isArray(data) ? data : [], error };
}

async function updateDailyJobCostsForStaffInSupabase(job, updatedBy = "") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const dailyProgressLog = Array.isArray(job.dailyProgressLog) ? job.dailyProgressLog : [];
  if (!dailyProgressLog.length) return { data: [], error: new Error("Add a daily progress day before saving.") };

  let latestData = [];
  for (const day of dailyProgressLog) {
    const { data, error } = await supabase.rpc("save_staff_daily_job_progress_day", {
      p_source_record_uid: buildSharedJobSourceId(job),
      p_day: day,
      p_updated_by: String(updatedBy || ""),
    });
    if (error) return { data: [], error };
    latestData = Array.isArray(data) ? data : [];
  }
  return { data: latestData, error: null };
}

async function createApprovedJobFromStaffDraft(draft = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  const { data, error } = await supabase.rpc("create_staff_approved_job", {
    p_project_name: String(draft.projectName || "").trim(),
    p_customer_name: String(draft.customerName || "").trim(),
    p_project_address: String(draft.projectAddress || "").trim(),
    p_contract_amount: Math.max(0, toNumber(draft.contractAmount, 0)),
    p_anticipated_start_date: draft.anticipatedStartDate || null,
    p_project_contact: String(draft.projectContact || "").trim(),
    p_status: String(draft.status || "Approved").trim(),
  });
  return { data, error };
}

async function refreshFieldLogPhotoUrls(log) {
  const paths = [...(log.photos || []).map(photo => photo.storagePath), ...(log.fuelReceipts || []).map(receipt => receipt.receiptPhotoPath)].filter(Boolean);
  if (!paths.length) return log;
  const { data, error } = await supabase.storage.from(FIELD_DAILY_LOG_PHOTO_BUCKET).createSignedUrls(paths, 86400);
  if (error) return log;
  const urls = new Map((data || []).map(item => [item.path, item.signedUrl]));
  return {...log, photos: (log.photos || []).map(photo => ({...photo, photoUrl:urls.get(photo.storagePath) || photo.photoUrl})), fuelReceipts:(log.fuelReceipts || []).map(receipt => ({...receipt, receiptPhotoUrl:urls.get(receipt.receiptPhotoPath) || receipt.receiptPhotoUrl}))};
}

async function fetchFieldDailyLogsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return {data:[], error:new Error("Supabase not configured")};
  const {data, error} = await fetchAccessibleFieldLogRows(supabase);
  if (error) return {data:[],error};
  const logs = await Promise.all((data || []).map(row => refreshFieldLogPhotoUrls({...row.log_payload, id:row.id, ownerUserKey:row.user_key, status:row.status, serverUpdatedAt:row.updated_at})));
  return {data:logs,error:null};
}

function mapFieldOperationEmployeeRow(row = {}) {
  const firstName = String(row.first_name || row.firstName || "");
  const lastName = String(row.last_name || row.lastName || "");
  const displayName = resolveEmployeeDisplayName({ ...row, firstName, lastName });
  return {
    id: String(row.id || row.employee_id || createFieldDailyLogId()),
    firstName,
    lastName,
    displayName,
    occupation: String(row.occupation || row.role || row.title || ""),
    department: String(row.department || row.dept || row.team || ""),
    isActive: row.is_active !== false && row.is_active !== "false" && row.active !== false && row.active !== "false",
    isForeman: row.is_foreman === true || row.is_foreman === "true" || row.foreman === true || row.foreman === "true",
    isDriver: row.is_driver === true || row.is_driver === "true" || row.driver === true || row.driver === "true",
    employeeNumber: String(row.employee_number || row.employeeNumber || row.employee_code || row.employee_id || ""),
    phone: String(row.phone || ""),
    email: String(row.email || ""),
    hireDate: String(row.hire_date || row.hireDate || ""),
    payrollId: String(row.payroll_id || row.payrollId || ""),
    notes: String(row.notes || ""),
    hourlyRate: Math.max(0, toNumber(row.hourly_rate ?? row.hourlyRate, 0)),
    displayOrder: toNumber(row.display_order, 0),
  };
}

function mapCompanyVehicleRow(row = {}) {
  const fallback = TRAVEL_VEHICLE_OPTIONS.find(vehicle => vehicle.value === row.id) || {};
  return normalizeCompanyVehicle({ ...row, id: row.id || createFieldDailyLogId() }, fallback);
}

function buildEmployeeDisplayName(employee = {}) {
  return resolveEmployeeDisplayName(employee);
}

function normalizeEmployeeRecord(employee = {}) {
  const mapped = mapFieldOperationEmployeeRow(employee);
  return {
    ...mapped,
    firstName: String(employee.firstName || employee.first_name || mapped.firstName || ""),
    lastName: String(employee.lastName || employee.last_name || mapped.lastName || ""),
    displayName: buildEmployeeDisplayName({
      displayName: employee.displayName || employee.display_name || mapped.displayName,
      firstName: employee.firstName || employee.first_name || mapped.firstName,
      lastName: employee.lastName || employee.last_name || mapped.lastName,
      employeeName: employee.employeeName || employee.employee_name || mapped.displayName,
    }),
    occupation: String(employee.occupation || employee.role || mapped.occupation || ""),
    department: String(employee.department || mapped.department || "Field Operations"),
    isActive: employee.isActive ?? employee.is_active ?? mapped.isActive ?? true,
    isForeman: employee.isForeman ?? employee.is_foreman ?? mapped.isForeman ?? false,
    isDriver: employee.isDriver ?? employee.is_driver ?? mapped.isDriver ?? false,
    employeeNumber: String(employee.employeeNumber || employee.employee_number || mapped.employeeNumber || ""),
    phone: String(employee.phone || mapped.phone || ""),
    email: String(employee.email || mapped.email || ""),
    hireDate: String(employee.hireDate || employee.hire_date || mapped.hireDate || ""),
    payrollId: String(employee.payrollId || employee.payroll_id || mapped.payrollId || ""),
    notes: String(employee.notes || mapped.notes || ""),
    hourlyRate: Math.max(0, toNumber(employee.hourlyRate ?? employee.hourly_rate ?? mapped.hourlyRate, 0)),
    displayOrder: toNumber(employee.displayOrder ?? employee.display_order ?? mapped.displayOrder, 0),
  };
}

function createBlankCrmLead() {
  const now = new Date().toISOString();
  return {
    id: createFieldDailyLogId(),
    contactName: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    propertyAddress: "",
    city: "",
    zipCode: "",
    leadSource: "Cold Calling",
    visitOutcome: "no_contact",
    roofingServiceNeeded: "",
    description: "",
    assignedStaffId: "",
    leadStatus: "New",
    companyName: "",
    bestTimeToCall: "",
    secondaryPhone: "",
    propertyType: "",
    roofType: "",
    approximateRoofSize: "",
    urgency: "Normal",
    insuranceClaim: false,
    referredBy: "",
    internalNotes: "",
    estimatedValue: "",
    nextFollowUpDate: "",
    appointmentDate: "",
    lastActivityDate: now,
    convertedCustomerId: "",
    originatorId: "",
    originatorName: "",
    originatorEmail: "",
    relationshipOwnerId: "",
    qualificationStatus: "captured",
    qualifiedAt: "",
    qualifiedBy: "",
    acceptedForInspectionAt: "",
    acceptedForInspectionBy: "",
    inspectionScheduledAt: "",
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCrmLead(lead = {}) {
  const now = new Date().toISOString();
  const historySource = Array.isArray(lead.history) ? lead.history : Array.isArray(lead.leadHistory) ? lead.leadHistory : [];
  return {
    ...createBlankCrmLead(),
    id: String(lead.id || createFieldDailyLogId()),
    contactName: String(lead.contactName || lead.contact_name || ""),
    firstName: String(lead.firstName || lead.first_name || ""),
    lastName: String(lead.lastName || lead.last_name || ""),
    phone: String(lead.phone || ""),
    email: String(lead.email || ""),
    propertyAddress: String(lead.propertyAddress || lead.property_address || ""),
    city: String(lead.city || ""),
    zipCode: String(lead.zipCode || lead.zip_code || ""),
    leadSource: String(lead.leadSource || lead.lead_source || ""),
    visitOutcome: String(lead.visitOutcome || lead.visit_outcome || ""),
    roofingServiceNeeded: String(lead.roofingServiceNeeded || lead.roofing_service_needed || ""),
    description: String(lead.description || lead.requestDescription || lead.notes || ""),
    assignedStaffId: String(lead.assignedStaffId || lead.assigned_staff_id || ""),
    leadStatus: String(lead.leadStatus || lead.lead_status || "New") || "New",
    companyName: String(lead.companyName || lead.company_name || ""),
    bestTimeToCall: String(lead.bestTimeToCall || lead.best_time_to_call || ""),
    secondaryPhone: String(lead.secondaryPhone || lead.secondary_phone || ""),
    propertyType: String(lead.propertyType || lead.property_type || ""),
    roofType: String(lead.roofType || lead.roof_type || ""),
    approximateRoofSize: String(lead.approximateRoofSize || lead.approximate_roof_size || ""),
    urgency: String(lead.urgency || "Normal"),
    insuranceClaim: lead.insuranceClaim ?? lead.insurance_claim ?? false,
    referredBy: String(lead.referredBy || lead.referred_by || ""),
    internalNotes: String(lead.internalNotes || lead.internal_notes || ""),
    estimatedValue: String(lead.estimatedValue ?? lead.estimated_value ?? ""),
    nextFollowUpDate: String(lead.nextFollowUpDate || lead.next_follow_up_date || ""),
    appointmentDate: String(lead.appointmentDate || lead.appointment_date || ""),
    lastActivityDate: String(lead.lastActivityDate || lead.last_activity_date || now),
    convertedCustomerId: String(lead.convertedCustomerId || lead.converted_customer_id || ""),
    originatorId: String(lead.originatorId || lead.originator_id || ""),
    originatorName: String(lead.originatorName || lead.originator_name || ""),
    originatorEmail: String(lead.originatorEmail || lead.originator_email || ""),
    relationshipOwnerId: String(lead.relationshipOwnerId || lead.relationship_owner_id || ""),
    qualificationStatus: String(lead.qualificationStatus || lead.qualification_status || "captured"),
    qualifiedAt: String(lead.qualifiedAt || lead.qualified_at || ""),
    qualifiedBy: String(lead.qualifiedBy || lead.qualified_by || ""),
    acceptedForInspectionAt: String(lead.acceptedForInspectionAt || lead.accepted_for_inspection_at || ""),
    acceptedForInspectionBy: String(lead.acceptedForInspectionBy || lead.accepted_for_inspection_by || ""),
    inspectionScheduledAt: String(lead.inspectionScheduledAt || lead.inspection_scheduled_at || ""),
    history: historySource.map((item) => ({
      id: String(item.id || createFieldDailyLogId()),
      label: String(item.label || item.type || "Activity"),
      note: String(item.note || item.summary || ""),
      createdAt: String(item.createdAt || item.created_at || now),
      createdBy: String(item.createdBy || item.created_by || ""),
    })),
    createdAt: String(lead.createdAt || lead.created_at || now),
    updatedAt: String(lead.updatedAt || lead.updated_at || now),
  };
}

function createBlankCrmProperty() {
  return {
    id: createFieldDailyLogId(),
    propertyName: "",
    propertyAddress: "",
    city: "",
    zipCode: "",
    propertyType: "",
    roofType: "",
    approximateRoofSize: "",
    notes: "",
  };
}

function normalizeCrmProperty(property = {}) {
  return {
    ...createBlankCrmProperty(),
    id: String(property.id || createFieldDailyLogId()),
    propertyName: String(property.propertyName || property.property_name || ""),
    propertyAddress: String(property.propertyAddress || property.property_address || ""),
    city: String(property.city || ""),
    zipCode: String(property.zipCode || property.zip_code || ""),
    propertyType: String(property.propertyType || property.property_type || ""),
    roofType: String(property.roofType || property.roof_type || ""),
    approximateRoofSize: String(property.approximateRoofSize || property.approximate_roof_size || ""),
    notes: String(property.notes || ""),
  };
}

function createBlankCrmContact() {
  return {
    id: createFieldDailyLogId(),
    name: "",
    role: "",
    phone: "",
    email: "",
    isPrimary: false,
    notes: "",
  };
}

function normalizeCrmContact(contact = {}) {
  return {
    ...createBlankCrmContact(),
    id: String(contact.id || createFieldDailyLogId()),
    name: String(contact.name || contact.fullName || ""),
    role: String(contact.role || ""),
    phone: String(contact.phone || ""),
    email: String(contact.email || ""),
    isPrimary: Boolean(contact.isPrimary ?? contact.is_primary ?? false),
    notes: String(contact.notes || ""),
  };
}

function createBlankCrmJob() {
  return {
    id: createFieldDailyLogId(),
    jobNumber: "",
    projectName: "",
    status: "Approved",
    contractAmount: "",
    amountBilled: "",
    amountCollected: "",
    startDate: "",
    completionDate: "",
    notes: "",
  };
}

function normalizeCrmJob(job = {}) {
  return {
    ...createBlankCrmJob(),
    id: String(job.id || createFieldDailyLogId()),
    jobNumber: String(job.jobNumber || job.job_number || ""),
    projectName: String(job.projectName || job.project_name || ""),
    status: String(job.status || "Approved"),
    contractAmount: String(job.contractAmount ?? job.contract_amount ?? ""),
    amountBilled: String(job.amountBilled ?? job.amount_billed ?? ""),
    amountCollected: String(job.amountCollected ?? job.amount_collected ?? ""),
    startDate: String(job.startDate || job.start_date || ""),
    completionDate: String(job.completionDate || job.completion_date || ""),
    notes: String(job.notes || ""),
  };
}

function createBlankCrmTimelineEntry() {
  return {
    id: createFieldDailyLogId(),
    label: "Note",
    summary: "",
    details: "",
    createdAt: new Date().toISOString(),
    createdBy: "",
  };
}

function normalizeCrmTimelineEntry(entry = {}) {
  return {
    ...createBlankCrmTimelineEntry(),
    id: String(entry.id || createFieldDailyLogId()),
    label: String(entry.label || entry.type || "Note"),
    summary: String(entry.summary || entry.note || ""),
    details: String(entry.details || ""),
    createdAt: String(entry.createdAt || entry.created_at || new Date().toISOString()),
    createdBy: String(entry.createdBy || entry.created_by || ""),
  };
}

function createBlankCrmFile() {
  return {
    id: createFieldDailyLogId(),
    fileName: "",
    category: "Other",
    notes: "",
    uploadedAt: "",
    uploadedBy: "",
    storagePath: "",
    fileUrl: "",
  };
}

function normalizeCrmFile(file = {}) {
  return {
    ...createBlankCrmFile(),
    id: String(file.id || createFieldDailyLogId()),
    fileName: String(file.fileName || file.file_name || file.name || ""),
    category: String(file.category || "Other"),
    notes: String(file.notes || ""),
    uploadedAt: String(file.uploadedAt || file.uploaded_at || new Date().toISOString()),
    uploadedBy: String(file.uploadedBy || file.uploaded_by || ""),
    storagePath: String(file.storagePath || file.storage_path || ""),
    fileUrl: String(file.fileUrl || file.file_url || ""),
  };
}

function createBlankCrmCustomer() {
  const now = new Date().toISOString();
  return {
    id: createFieldDailyLogId(),
    customerName: "",
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    email: "",
    secondaryPhone: "",
    billingAddress: "",
    city: "",
    zipCode: "",
    customerType: "",
    propertyType: "",
    sourceLeadId: "",
    assignedStaffId: "",
    assignedStaffName: "",
    nextFollowUpDate: "",
    properties: [],
    contacts: [],
    jobs: [],
    timeline: [],
    files: [],
    notes: "",
    proposalArchive: [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCrmCustomer(customer = {}) {
  const now = new Date().toISOString();
  const propertiesSource = Array.isArray(customer.properties) ? customer.properties : Array.isArray(customer.propertiesList) ? customer.propertiesList : [];
  const contactsSource = Array.isArray(customer.contacts) ? customer.contacts : Array.isArray(customer.contactList) ? customer.contactList : [];
  const jobsSource = Array.isArray(customer.jobs) ? customer.jobs : Array.isArray(customer.jobList) ? customer.jobList : [];
  const timelineSource = Array.isArray(customer.timeline) ? customer.timeline : Array.isArray(customer.history) ? customer.history : [];
  const filesSource = Array.isArray(customer.files) ? customer.files : Array.isArray(customer.documents) ? customer.documents : [];
  const proposalArchiveSource = Array.isArray(customer.proposalArchive)
    ? customer.proposalArchive
    : Array.isArray(customer.proposalArchiveEntries)
      ? customer.proposalArchiveEntries
      : [];
  return {
    ...createBlankCrmCustomer(),
    id: String(customer.id || createFieldDailyLogId()),
    customerName: String(customer.customerName || customer.customer_name || ""),
    firstName: String(customer.firstName || customer.first_name || ""),
    lastName: String(customer.lastName || customer.last_name || ""),
    companyName: String(customer.companyName || customer.company_name || ""),
    phone: String(customer.phone || ""),
    email: String(customer.email || ""),
    secondaryPhone: String(customer.secondaryPhone || customer.secondary_phone || ""),
    billingAddress: String(customer.billingAddress || customer.billing_address || ""),
    city: String(customer.city || ""),
    zipCode: String(customer.zipCode || customer.zip_code || ""),
    customerType: String(customer.customerType || customer.customer_type || ""),
    propertyType: String(customer.propertyType || customer.property_type || ""),
    sourceLeadId: String(customer.sourceLeadId || customer.source_lead_id || ""),
    assignedStaffId: String(customer.assignedStaffId || customer.assigned_staff_id || ""),
    assignedStaffName: String(customer.assignedStaffName || customer.assigned_staff_name || ""),
    nextFollowUpDate: String(customer.nextFollowUpDate || customer.next_follow_up_date || ""),
    properties: propertiesSource.map(normalizeCrmProperty),
    contacts: contactsSource.map(normalizeCrmContact),
    jobs: jobsSource.map(normalizeCrmJob),
    timeline: timelineSource.map(normalizeCrmTimelineEntry),
    files: filesSource.map(normalizeCrmFile),
    notes: String(customer.notes || ""),
    proposalArchive: proposalArchiveSource.map(normalizeProposalArchiveEntry),
    createdAt: String(customer.createdAt || customer.created_at || now),
    updatedAt: String(customer.updatedAt || customer.updated_at || now),
  };
}

function normalizeProposalArchiveEntry(entry = {}) {
  const now = new Date().toISOString();
  return {
    id: String(entry.id || `proposal-archive-${Date.now()}`),
    proposalId: String(entry.proposalId || ""),
    proposalNumber: toNumber(entry.proposalNumber || 0, 0),
    version: toNumber(entry.version || 1, 1),
    proposalTitle: String(entry.proposalTitle || ""),
    estimateCode: String(entry.estimateCode || ""),
    sourceEstimateId: String(entry.sourceEstimateId || ""),
    sourceEstimateCode: String(entry.sourceEstimateCode || ""),
    customerName: String(entry.customerName || ""),
    projectName: String(entry.projectName || ""),
    projectAddress: String(entry.projectAddress || ""),
    status: String(entry.status || "Draft"),
    acceptanceStatus: String(entry.acceptanceStatus || "Pending"),
    signatureStatus: String(entry.signatureStatus || "Unsigned"),
    sentAt: String(entry.sentAt || ""),
    viewedAt: String(entry.viewedAt || ""),
    finalizedAt: String(entry.finalizedAt || ""),
    pdfArchiveName: String(entry.pdfArchiveName || ""),
    pdfArchiveDataUrl: String(entry.pdfArchiveDataUrl || ""),
    pdfArchiveUpdatedAt: String(entry.pdfArchiveUpdatedAt || ""),
    proposalHistory: Array.isArray(entry.proposalHistory) ? entry.proposalHistory : [],
    templateId: String(entry.templateId || ""),
    isFinalized: Boolean(entry.isFinalized),
    archivedAt: String(entry.archivedAt || now),
    updatedAt: String(entry.updatedAt || now),
    createdAt: String(entry.createdAt || now),
  };
}

function buildProposalArchiveEntryFromProposal(proposal = {}, extras = {}) {
  const now = new Date().toISOString();
  return normalizeProposalArchiveEntry({
    ...proposal,
    ...extras,
    id: extras.id || proposal.id || `proposal-archive-${Date.now()}`,
    proposalId: proposal.id || extras.proposalId || "",
    proposalNumber: proposal.proposalNumber || extras.proposalNumber || 0,
    version: proposal.version || extras.version || 1,
    proposalTitle: proposal.proposalTitle || extras.proposalTitle || "",
    estimateCode: proposal.estimateCode || extras.estimateCode || "",
    sourceEstimateId: proposal.sourceEstimateId || extras.sourceEstimateId || "",
    sourceEstimateCode: proposal.sourceEstimateCode || extras.sourceEstimateCode || "",
    customerName: proposal.customerName || extras.customerName || "",
    projectName: proposal.projectName || extras.projectName || "",
    projectAddress: proposal.projectAddress || extras.projectAddress || "",
    status: proposal.status || extras.status || "Draft",
    acceptanceStatus: proposal.acceptanceStatus || extras.acceptanceStatus || "Pending",
    signatureStatus: proposal.signatureStatus || extras.signatureStatus || "Unsigned",
    sentAt: proposal.sentAt || extras.sentAt || "",
    viewedAt: proposal.viewedAt || extras.viewedAt || "",
    finalizedAt: proposal.finalizedAt || extras.finalizedAt || "",
    pdfArchiveName: proposal.pdfArchiveName || extras.pdfArchiveName || "",
    pdfArchiveDataUrl: proposal.pdfArchiveDataUrl || extras.pdfArchiveDataUrl || "",
    pdfArchiveUpdatedAt: proposal.pdfArchiveUpdatedAt || extras.pdfArchiveUpdatedAt || "",
    proposalHistory: Array.isArray(proposal.proposalHistory) ? proposal.proposalHistory : Array.isArray(extras.proposalHistory) ? extras.proposalHistory : [],
    templateId: proposal.templateId || extras.templateId || "",
    isFinalized: Boolean(proposal.isFinalized || extras.isFinalized),
    archivedAt: extras.archivedAt || now,
    updatedAt: extras.updatedAt || proposal.updatedAt || now,
    createdAt: proposal.createdAt || extras.createdAt || now,
  });
}

function findEstimateForProposal(proposal = {}, estimates = []) {
  return (
    estimates.find((estimate) => estimate.id === proposal.sourceEstimateId || estimate.estimateCode === proposal.sourceEstimateCode || estimate.estimateCode === proposal.estimateCode) ||
    proposal.sourceEstimateSnapshot ||
    null
  );
}

function proposalComparableSnapshot(proposal = {}) {
  const normalized = normalizeProposalRecord(proposal);
  return {
    templateId: normalized.templateId,
    proposalNumber: normalized.proposalNumber,
    version: normalized.version,
    proposalTitle: normalized.proposalTitle,
    customerName: normalized.customerName,
    customerContact: normalized.customerContact,
    projectName: normalized.projectName,
    projectAddress: normalized.projectAddress,
    estimateNumber: normalized.estimateNumber,
    estimateCode: normalized.estimateCode,
    estimateDate: normalized.estimateDate,
    roofSystem: normalized.roofSystem,
    scopeItems: normalized.scopeItems,
    alternates: normalized.alternates,
    exclusions: normalized.exclusions,
    allowances: normalized.allowances,
    taxes: normalized.taxes,
    totalPrice: normalized.totalPrice,
    salesperson: normalized.salesperson,
    warranty: normalized.warranty,
    paymentSchedule: normalized.paymentSchedule,
    estimatedSchedule: normalized.estimatedSchedule,
    termsAndConditions: normalized.termsAndConditions,
    expirationDate: normalized.expirationDate,
    sourceEstimateId: normalized.sourceEstimateId,
    sourceEstimateCode: normalized.sourceEstimateCode,
    proposalSections: normalized.proposalSections,
    templateSnapshot: normalized.templateSnapshot,
    customerAcceptance: normalized.customerAcceptance,
    acceptanceStatus: normalized.acceptanceStatus,
    signatureStatus: normalized.signatureStatus,
    viewedAt: normalized.viewedAt,
    finalizedAt: normalized.finalizedAt,
    isFinalized: normalized.isFinalized,
    pdfArchiveName: normalized.pdfArchiveName,
    pdfArchiveDataUrl: normalized.pdfArchiveDataUrl,
    pdfArchiveUpdatedAt: normalized.pdfArchiveUpdatedAt,
    proposalHistory: normalized.proposalHistory,
  };
}

function renderWrappedPdfParagraph(doc, text, x, y, maxWidth, options = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return y;
  const lines = doc.splitTextToSize(cleanText, maxWidth);
  const lineHeight = options.lineHeight || 5;
  doc.setFontSize(options.size || 10);
  doc.setFont(undefined, options.weight || "normal");
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
}

function renderPdfKeyValueLines(doc, rows = [], x = 10, y = 10, labelWidth = 48, valueWidth = 132) {
  const lineHeight = 5.5;
  rows.forEach(([label, value]) => {
    const labelText = String(label || "");
    const valueText = String(value || "—");
    const labelLines = doc.splitTextToSize(labelText, labelWidth);
    const valueLines = doc.splitTextToSize(valueText, valueWidth);
    const rowHeight = Math.max(labelLines.length, valueLines.length) * lineHeight;
    doc.setFont(undefined, "bold");
    doc.text(labelLines, x, y);
    doc.setFont(undefined, "normal");
    doc.text(valueLines, x + labelWidth + 2, y);
    y += rowHeight + 1;
  });
  return y;
}

async function generateProposalPDF(proposal = {}, estimate = null, template = DEFAULT_PROPOSAL_TEMPLATE) {
  const normalizedProposal = normalizeProposalRecord(proposal);
  const activeTemplate = normalizeProposalTemplate(template || normalizedProposal.templateSnapshot || DEFAULT_PROPOSAL_TEMPLATE);
  const sections = buildProposalSections(normalizedProposal, estimate, activeTemplate);
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const footerText = activeTemplate.footerText || "Generated from the live estimate data.";

  const addSectionFooter = () => {
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(footerText, margin, pageHeight - 8);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    }
    doc.setTextColor(0, 0, 0);
  };

  const drawHeader = (title, subtitle = "") => {
    doc.setFillColor(10, 21, 29);
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(activeTemplate.brandName || "CRT Roofing", margin, 10);
    doc.setFontSize(18);
    doc.text(String(title || activeTemplate.coverPageTitle || "Proposal"), margin, 19);
    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      doc.text(String(subtitle), pageWidth - margin, 10, { align: "right" });
    }
    doc.setTextColor(0, 0, 0);
  };

  const drawSectionPage = (section, includeHeader = false) => {
    if (includeHeader) {
      drawHeader(section.title || activeTemplate.coverPageTitle, section.subtitle || "");
    }
    let y = includeHeader ? 36 : 18;
    if (!includeHeader) {
      drawHeader(section.title || activeTemplate.coverPageTitle, section.subtitle || "");
      y = 36;
    }

    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(String(section.title || "Proposal section"), margin, y);
    y += 7;

    if (section.subtitle) {
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      y = renderWrappedPdfParagraph(doc, section.subtitle, margin, y, contentWidth);
      y += 2;
    }

    if (Array.isArray(section.paragraphs)) {
      section.paragraphs.forEach((paragraph) => {
        y = renderWrappedPdfParagraph(doc, paragraph, margin, y, contentWidth);
        y += 3;
      });
    }

    if (Array.isArray(section.lines) && section.lines.length) {
      y = renderPdfKeyValueLines(doc, section.lines, margin, y, 55, contentWidth - 57);
      y += 2;
    }

    if (Array.isArray(section.items) && section.items.length) {
      section.items.forEach((item) => {
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text(String(item.label || "Item"), margin, y);
        doc.setFont(undefined, "normal");
        y = renderWrappedPdfParagraph(doc, item.value || "—", margin + 46, y, contentWidth - 46);
        y += 1;
      });
    }

    return y;
  };

  drawHeader(activeTemplate.coverPageTitle || "CRT Proposal", activeTemplate.coverPageSubtitle || "");

  let y = 36;
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text(activeTemplate.brandName || "CRT Roofing", margin, y);
  y += 7;
  doc.setFontSize(20);
  doc.text(String(normalizedProposal.proposalTitle || normalizedProposal.projectName || "Proposal"), margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  y = renderWrappedPdfParagraph(doc, activeTemplate.coverPageSubtitle, margin, y, contentWidth);
  y += 4;

  const coverRows = [
    ["Proposal number", normalizedProposal.proposalNumber || "—"],
    ["Version", normalizedProposal.version || 1],
    ["Customer", normalizedProposal.customerName || normalizedProposal.sourceEstimateSnapshot?.inputs?.customerName || "—"],
    ["Project", normalizedProposal.projectName || normalizedProposal.sourceEstimateSnapshot?.inputs?.jobName || "—"],
    ["Address", normalizedProposal.projectAddress || normalizedProposal.sourceEstimateSnapshot?.inputs?.jobAddress || "—"],
    ["Estimate code", normalizedProposal.estimateCode || normalizedProposal.sourceEstimateCode || "—"],
    ["Salesperson", normalizedProposal.salesperson || normalizedProposal.sourceEstimateSnapshot?.inputs?.salesperson || "—"],
    ["Proposal price", money(normalizedProposal.totalPrice || 0)],
    ["Acceptance status", normalizedProposal.acceptanceStatus || "Pending"],
    ["Signature status", normalizedProposal.signatureStatus || "Unsigned"],
  ];
  y = renderPdfKeyValueLines(doc, coverRows, margin, y, 55, contentWidth - 57);

  doc.addPage();
  sections.slice(1).forEach((section) => {
    let sectionY = 18;
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(String(section.title || "Proposal section"), margin, sectionY);
    sectionY += 7;
    if (section.subtitle) {
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      sectionY = renderWrappedPdfParagraph(doc, section.subtitle, margin, sectionY, contentWidth);
      sectionY += 2;
    }
    if (Array.isArray(section.paragraphs)) {
      section.paragraphs.forEach((paragraph) => {
        sectionY = renderWrappedPdfParagraph(doc, paragraph, margin, sectionY, contentWidth);
        sectionY += 3;
      });
    }
    if (Array.isArray(section.lines) && section.lines.length) {
      sectionY = renderPdfKeyValueLines(doc, section.lines, margin, sectionY, 55, contentWidth - 57);
      sectionY += 2;
    }
    if (Array.isArray(section.items) && section.items.length) {
      section.items.forEach((item) => {
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text(String(item.label || "Item"), margin, sectionY);
        doc.setFont(undefined, "normal");
        sectionY = renderWrappedPdfParagraph(doc, item.value || "—", margin + 46, sectionY, contentWidth - 46);
        sectionY += 1;
      });
    }
    if (section !== sections[sections.length - 1]) {
      doc.addPage();
    }
  });

  addSectionFooter();

  const pdfDataUrl = doc.output("datauristring");
  const pdfFileName = createProposalPdfFileName(normalizedProposal);
  return {
    pdfFileName,
    pdfDataUrl,
  };
}

function normalizeProposalMatchText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function findCrmCustomerForProposal(customers = [], proposal = {}, estimate = null) {
  const candidateTexts = [
    proposal.customerName,
    proposal.projectName,
    proposal.projectAddress,
    proposal.sourceEstimateSnapshot?.inputs?.customerName,
    proposal.sourceEstimateSnapshot?.inputs?.jobName,
    estimate?.inputs?.customerName,
    estimate?.inputs?.jobName,
    estimate?.inputs?.jobAddress,
  ]
    .map(normalizeProposalMatchText)
    .filter(Boolean);

  return (
    customers.find((customer) => {
      const customerTexts = [
        customer.customerName,
        customer.companyName,
        customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` : "",
        customer.firstName,
        customer.lastName,
        customer.billingAddress,
        ...((Array.isArray(customer.properties) ? customer.properties : []).map((property) => property.propertyAddress || property.propertyName || "")),
      ]
        .map(normalizeProposalMatchText)
        .filter(Boolean);
      return customerTexts.some((text) => candidateTexts.includes(text));
    }) || null
  );
}

function createCustomerFromProposal(proposal = {}, estimate = null, archiveEntry = null) {
  const proposalCustomerName = proposal.customerName || estimate?.inputs?.customerName || proposal.projectName || estimate?.inputs?.jobName || "Proposal customer";
  const proposalProjectName = proposal.projectName || estimate?.inputs?.jobName || proposalCustomerName;
  return normalizeCrmCustomer({
    customerName: proposalCustomerName,
    firstName: estimate?.inputs?.customerFirstName || "",
    lastName: estimate?.inputs?.customerLastName || "",
    companyName: estimate?.inputs?.customerCompanyName || proposalCustomerName,
    phone: estimate?.inputs?.customerPhone || "",
    email: estimate?.inputs?.customerEmail || "",
    billingAddress: proposal.projectAddress || estimate?.inputs?.jobAddress || "",
    city: estimate?.inputs?.customerCity || "",
    zipCode: estimate?.inputs?.customerZip || "",
    notes: "Created automatically from proposal generation.",
    proposalArchive: archiveEntry ? [archiveEntry] : [],
    jobs: [
      {
        id: `proposal-job-${proposal.id || Date.now()}`,
        jobNumber: String(proposal.proposalNumber || estimate?.estimateNumber || ""),
        projectName: proposalProjectName,
        status: proposal.status || "Draft",
        contractAmount: toNumber(proposal.totalPrice || 0),
        amountBilled: 0,
        amountCollected: 0,
        startDate: proposal.estimatedSchedule || "",
        completionDate: "",
        notes: "Created from proposal archive.",
      },
    ],
  });
}

function mergeProposalArchiveEntries(existingEntries = [], nextEntry = {}) {
  const normalizedEntry = normalizeProposalArchiveEntry(nextEntry);
  const sourceEntries = Array.isArray(existingEntries) ? existingEntries : [];
  const filteredEntries = sourceEntries.filter(
    (entry) =>
      !(String(entry.proposalId || entry.id || "") === String(normalizedEntry.proposalId || normalizedEntry.id || "") && Number(entry.version || 0) === Number(normalizedEntry.version || 0)),
  );
  return [normalizedEntry, ...filteredEntries].sort((a, b) => String(b.updatedAt || b.archivedAt || "").localeCompare(String(a.updatedAt || a.archivedAt || "")));
}

function createBlankCrmFollowup() {
  const now = new Date().toISOString();
  return {
    id: createFieldDailyLogId(),
    relatedType: "lead",
    relatedId: "",
    title: "",
    dueDate: "",
    assignedStaffId: "",
    followUpType: "Call",
    status: "Open",
    notes: "",
    createdBy: "",
    createdAt: now,
    updatedAt: now,
    completedAt: "",
  };
}

function normalizeCrmFollowup(followup = {}) {
  return {
    ...createBlankCrmFollowup(),
    id: String(followup.id || createFieldDailyLogId()),
    relatedType: String(followup.relatedType || followup.related_type || "lead"),
    relatedId: String(followup.relatedId || followup.related_id || ""),
    title: String(followup.title || ""),
    dueDate: String(followup.dueDate || followup.due_date || ""),
    assignedStaffId: String(followup.assignedStaffId || followup.assigned_staff_id || ""),
    followUpType: String(followup.followUpType || followup.follow_up_type || "Call"),
    status: String(followup.status || "Open"),
    notes: String(followup.notes || ""),
    createdBy: String(followup.createdBy || followup.created_by || ""),
    createdAt: String(followup.createdAt || followup.created_at || new Date().toISOString()),
    updatedAt: String(followup.updatedAt || followup.updated_at || followup.createdAt || followup.created_at || new Date().toISOString()),
    completedAt: String(followup.completedAt || followup.completed_at || ""),
  };
}

async function fetchFieldOperationEmployeesFromSupabase(userKey, companyWide = false, dailyCostEditor = false) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  if (dailyCostEditor && !companyWide) {
    const { data, error } = await supabase.rpc("list_daily_job_cost_employees");
    return {
      data: Array.isArray(data) ? data.map(mapFieldOperationEmployeeRow) : [],
      error,
    };
  }
  let query = supabase.from("employees").select("*").order("display_order", { ascending: true });
  if (!companyWide) query = query.eq("user_key", userKey);
  const { data, error } = await query;
  return {
    data: Array.isArray(data) ? data.map(mapFieldOperationEmployeeRow) : [],
    error,
  };
}

async function fetchCompanyVehiclesFromSupabase(userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  const { data, error } = await supabase.from("company_vehicles").select("*").eq("user_key", userKey).order("display_order", { ascending: true });
  // This optional directory is absent in older projects; keep their configured list.
  if (isMissingVehicleTable(error)) return { data: [], error: null };
  return {
    data: Array.isArray(data) ? data.map(mapCompanyVehicleRow).filter((row) => row.active) : [],
    error,
  };
}

async function upsertEmployeeToSupabase(employee, userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: null };
  const mapped = normalizeEmployeeRecord(employee);
  const dbRow = {
    id: mapped.id,
    user_key: userKey,
    first_name: mapped.firstName || "",
    last_name: mapped.lastName || "",
    display_name: mapped.displayName || buildEmployeeDisplayName(mapped),
    occupation: mapped.occupation || "",
    department: mapped.department || "",
    is_active: Boolean(mapped.isActive),
    is_foreman: Boolean(mapped.isForeman),
    is_driver: Boolean(mapped.isDriver),
    employee_number: mapped.employeeNumber || "",
    phone: mapped.phone || "",
    email: mapped.email || "",
    hire_date: mapped.hireDate || null,
    hourly_rate: mapped.hourlyRate,
    payroll_id: mapped.payrollId || "",
    notes: mapped.notes || "",
    display_order: mapped.displayOrder,
    updated_at: new Date().toISOString(),
  };
  return supabase.from("employees").upsert([dbRow], { onConflict: "id" }).select("*");
}

function parseSupabaseMissingColumnError(error) {
  if (!error?.message) return [];
  const missing = [];
  const regex1 = /column .*?\.(\w+) does not exist/i;
  const regex2 = /Could not find the '(.+?)' column of '.*?' in the schema cache/i;
  const match1 = regex1.exec(error.message);
  const match2 = regex2.exec(error.message);
  if (match1) missing.push(match1[1]);
  if (match2) missing.push(match2[1]);
  return missing;
}

async function insertOrUpdateEstimate(dbRow, userKey) {
  if (!dbRow.local_estimate_id) return { data: null, error: new Error("Missing local_estimate_id") };
  const mutationRow = prepareEstimateMutationRow(dbRow);
  if (dbRow.id) {
    return supabase.from("estimates").update(mutationRow).eq("id", dbRow.id).select("*");
  }
  const { data: existing, error: queryError } = await supabase
    .from("estimates")
    .select("id")
    .eq("owner_id", dbRow.owner_id || userKey)
    .eq("local_estimate_id", dbRow.local_estimate_id)
    .limit(1);
  if (queryError) return { data: null, error: queryError };
  if (existing && existing.length > 0) {
    const estimateId = existing[0].id;
    return supabase.from("estimates").update(mutationRow).eq("id", estimateId).select("*");
  }
  return supabase.from("estimates").insert([mutationRow]).select("*");
}

async function upsertRowWithMissingColumnFallback(table, row, onConflict) {
  let payload = { ...row };
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from(table).upsert([payload], { onConflict }).select("*");
    if (!error) return { data, error: null };

    lastError = error;
    const missingColumns = parseSupabaseMissingColumnError(error);
    if (!missingColumns.length) return { data: null, error };

    missingColumns.forEach((column) => {
      delete payload[column];
    });
  }

  return { data: null, error: lastError };
}

async function upsertEstimateToSupabase(savedEstimate, inputs, prices, summary, calculation, userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: new Error("Supabase not configured") };
  const totalSquares = calculation?.scope?.totalSquares ?? calculation?.totalSquares ?? 0;
  const ownerId = String(savedEstimate.ownerId || userKey || "");
  const dbRow = {
    id: savedEstimate.dbId || undefined,
    user_key: ownerId,
    owner_id: ownerId,
    owner_display_name: String(savedEstimate.ownerDisplayName || ""),
    owner_email: String(savedEstimate.ownerEmail || ""),
    local_estimate_id: savedEstimate.id,
    estimate_number: savedEstimate.estimateNumber,
    company_estimate_number: savedEstimate.estimateNumber,
    estimate_code: savedEstimate.estimateCode,
    estimate_type: savedEstimate.estimateType,
    name: savedEstimate.name,
    saved_at: savedEstimate.savedAt,
    updated_at: new Date().toISOString(),
    final_bid: calculation.selectedBidAmount,
    selected_bid: calculation.selectedBidAmount,
    material_cost: calculation.materialCost,
    labor_cost: calculation.laborCost,
    travel_cost: calculation.travelCost,
    overhead_cost: calculation.overheadOperatingCost,
    total_squares: totalSquares,
    price_per_square: calculation.selectedPricePerSq,
    roof_type: buildEstimateRoofType(inputs),
    estimate_status: savedEstimate.status,
    estimate_data: { inputs, prices, summary },
  };
  return insertOrUpdateEstimate(dbRow, userKey);
}

async function deleteEstimateFromSupabase(estimateId, userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { error: null };
  if (estimateId && typeof estimateId === "object" && estimateId.dbId) {
    return supabase.from("estimates").delete().eq("id", estimateId.dbId);
  }
  return supabase.from("estimates").delete().eq("owner_id", userKey).eq("local_estimate_id", estimateId);
}

async function reassignEstimateOwnerInSupabase(estimateDbId, newOwnerId) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: new Error("Supabase not configured") };
  if (!estimateDbId || !newOwnerId) return { data: null, error: new Error("Missing estimate ID or new owner ID") };
  return supabase
    .from("estimates")
    .update({ owner_id: newOwnerId, user_key: newOwnerId, updated_at: new Date().toISOString() })
    .eq("id", estimateDbId)
    .select("*");
}

async function fetchCompletedJobMetricsFromSupabase(userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: [], error: null };
  return supabase
    .from("completed_job_metrics")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false });
}

async function upsertCompletedJobMetricsToSupabase(metrics, userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { data: null, error: new Error("Supabase not configured") };
  const dbRow = {
    user_key: userKey,
    estimate_id: metrics.estimateId,
    local_estimate_id: metrics.localEstimateId,
    estimate_code: metrics.estimateCode,
    job_name: metrics.jobName,
    customer_name: metrics.customerName,
    roof_type: metrics.roofType,
    total_squares: metrics.totalSquares,
    estimate_final_bid: metrics.estimateFinalBid,
    estimate_material_cost: metrics.estimateMaterialCost,
    estimate_labor_cost: metrics.estimateLaborCost,
    estimate_travel_cost: metrics.estimateTravelCost,
    actual_material_cost: metrics.actualMaterialCost,
    actual_labor_cost: metrics.actualLaborCost,
    actual_labor_hours: metrics.actualLaborHours,
    actual_travel_cost: metrics.actualTravelCost,
    change_orders: metrics.changeOrders,
    final_invoice_amount: metrics.finalInvoiceAmount,
    actual_profit: metrics.actualProfit,
    actual_margin_percent: metrics.actualMarginPercent,
    material_variance: metrics.actualMaterialCost - metrics.estimateMaterialCost,
    labor_variance: metrics.actualLaborCost - metrics.estimateLaborCost,
    notes: metrics.notes,
    lessons_learned: metrics.lessonsLearned,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: queryError } = await supabase
    .from("completed_job_metrics")
    .select("id")
    .eq("user_key", userKey)
    .eq("estimate_id", metrics.estimateId)
    .limit(1);

  if (queryError) return { data: null, error: queryError };
  if (existing && existing.length > 0) {
    const metricsId = existing[0].id;
    return supabase.from("completed_job_metrics").update(dbRow).eq("id", metricsId).select("*");
  }

  return supabase.from("completed_job_metrics").insert([dbRow]).select("*");
}

async function upsertCompletedJobToSupabase(savedEstimate, inputs, calculation, userKey) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || savedEstimate.status !== "completed") return { data: null, error: null };
  const totalSquares = calculation?.scope?.totalSquares ?? calculation?.totalSquares ?? 0;
  const dbRow = {
    id: savedEstimate.id,
    user_key: userKey,
    estimate_id: savedEstimate.id,
    estimate_code: savedEstimate.estimateCode,
    job_name: inputs.jobName || "",
    customer_name: inputs.customerName || "",
    job_address: inputs.jobAddress || "",
    roof_type: buildEstimateRoofType(inputs),
    square_count: totalSquares,
    final_bid: calculation.selectedBidAmount,
    labor_cost: calculation.laborCost,
    materials_cost: calculation.materialCost,
    profit: calculation.selectedProfitDollars,
    status: savedEstimate.status,
    saved_at: savedEstimate.savedAt,
  };
  return upsertRowWithMissingColumnFallback("completed_jobs", dbRow, "estimate_id");
}

async function uploadFieldDailyLogPhotoToStorage(file, userKey, logId, category, uploadId = crypto.randomUUID()) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !file) throw new Error("Photo storage is not configured");
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("Choose an image under 20 MB");
  const safeName = String(file.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${userKey}/${logId}/${category}/${uploadId}-${safeName}`;
  const { error } = await supabase.storage.from(FIELD_DAILY_LOG_PHOTO_BUCKET).upload(storagePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data, error: urlError } = await supabase.storage.from(FIELD_DAILY_LOG_PHOTO_BUCKET).createSignedUrl(storagePath, 86400);
  if (urlError) throw urlError;
  return { photoUrl: data?.signedUrl || "", storagePath, fileName: file.name || "" };
}

async function uploadApprovedJobAttachmentToStorage(file, userId, jobId, dayId, uploadedBy) {
  const validationError = validateApprovedJobAttachment(file);
  if (validationError) return { attachment: null, error: new Error(validationError) };
  const storagePath = buildApprovedJobAttachmentPath({ userId, jobId, dayId, fileName: file.name });
  const { error } = await supabase.storage.from(APPROVED_JOB_ATTACHMENT_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) return { attachment: null, error };
  return {
    attachment: createApprovedJobAttachmentRecord(file, storagePath, { uploadedBy }),
    error: null,
  };
}

async function upsertFieldDailyLogToSupabase(log, userKey, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return {data:null,error:new Error("Supabase not configured")};
  const normalized = normalizeFieldDailyLogDraft(log, options.submittedBy || "");
  const payload = {...normalized, ...calculateFieldDailyLogTotals(normalized),
    photos:normalized.photos.map(photo => ({...photo,photoUrl:photo.storagePath ? "" : photo.photoUrl})),
    fuelReceipts:normalized.fuelReceipts.map(receipt => ({...receipt,receiptPhotoUrl:receipt.receiptPhotoPath ? "" : receipt.receiptPhotoUrl})),
  };
  const {data,error} = await supabase.rpc("save_field_daily_log",{p_log:payload,p_expected_updated_at:log.serverUpdatedAt || null});
  return {data:Array.isArray(data) ? data[0] : data,error};
}

function toNumber(value, fallback = 0) {
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "").replace(/[^\d.-]/g, "");
    if (!cleaned) return fallback;
    const parsedString = Number(cleaned);
    return Number.isFinite(parsedString) ? parsedString : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function money2(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function num(value, digits = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value, 0) * factor) / factor;
}

function extractQuickMeasureNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const raw = String(match[1] || "").replace(/,/g, "").trim();
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function extractQuickMeasureText(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    return String(match[1] || "").trim();
  }
  return "";
}

function extractQuickMeasureMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    return {
      rawMatch: String(match[0] || "").trim(),
      value: String(match[1] || "").trim(),
      index: typeof match.index === "number" ? match.index : -1,
    };
  }
  return {
    rawMatch: "",
    value: "",
    index: -1,
  };
}

function escapeQuickMeasureRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractQuickMeasureMaterialSuggestion(text, {
  aliases = [],
  mappedField = "",
  quantityMode = "quantity",
  quantityPatterns = [],
}) {
  const rawText = String(text || "");
  const normalized = rawText.replace(/\s+/g, " ").trim();
  const lines = rawText
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const safeAliases = aliases.filter(Boolean);
  const aliasPattern = safeAliases.map(escapeQuickMeasureRegex).join("|");
  if (!aliasPattern) {
    return {
      mappedField,
      matchedProductName: "",
      matchedQuantity: null,
      quantityUnit: "",
      rawMatch: "",
      snippet: "",
    };
  }
  const aliasRegex = new RegExp(aliasPattern, "i");
  const quantityRegexes = quantityPatterns.length
    ? quantityPatterns
    : [
        new RegExp(`(?:${aliasPattern})[^0-9]{0,120}([0-9][0-9,]*(?:\\.[0-9]+)?)`, "i"),
        new RegExp(`([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(?:bundles?|rolls?|boxes?|pieces?|lf|linear\\s+feet|ft|sq|squares?)[^\\n]{0,120}(?:${aliasPattern})`, "i"),
      ];

  const buildResult = (sourceText, match, line, productName) => {
    const rawMatch = String(match[0] || "").trim();
    const quantity = Number(String(match[1] || "").replace(/,/g, ""));
    const unit = String(match[2] || "").trim().toLowerCase();
    let matchedQuantity = Number.isFinite(quantity) ? quantity : null;
    if (quantityMode === "lf-to-boxes" && matchedQuantity !== null) {
      matchedQuantity = unit.includes("lf") || unit.includes("linear") || unit === "ft" || unit === "feet" ? Math.ceil(matchedQuantity / 20) : matchedQuantity;
    }
    const snippetSource = line || sourceText;
    return {
      mappedField,
      matchedProductName: productName || safeAliases[0] || mappedField,
      matchedQuantity,
      quantityUnit: unit,
      rawMatch,
      snippet: snippetSource.slice(0, 220),
    };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!aliasRegex.test(line)) continue;
    const block = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");
    for (const pattern of quantityRegexes) {
      const match = pattern.exec(block);
      if (!match) continue;
      const foundAlias = safeAliases.find((alias) => new RegExp(escapeQuickMeasureRegex(alias), "i").test(line)) || safeAliases[0];
      return buildResult(block, match, block, foundAlias);
    }
    return {
      mappedField,
      matchedProductName: safeAliases.find((alias) => new RegExp(escapeQuickMeasureRegex(alias), "i").test(line)) || safeAliases[0] || mappedField,
      matchedQuantity: null,
      quantityUnit: "",
      rawMatch: line,
      snippet: [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ").slice(0, 220),
    };
  }

  for (const pattern of quantityRegexes) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    const foundAlias = safeAliases.find((alias) => new RegExp(escapeQuickMeasureRegex(alias), "i").test(normalized)) || safeAliases[0];
    return buildResult(normalized, match, normalized.slice(Math.max(0, match.index - 80), Math.min(normalized.length, match.index + 160)), foundAlias);
  }

  return {
    mappedField,
    matchedProductName: "",
    matchedQuantity: null,
    quantityUnit: "",
    rawMatch: "",
    snippet: "",
  };
}

function extractQuickMeasureFields(text = "") {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  const propertyAddress = extractQuickMeasureText(normalized, [
    /property\s+address[^A-Za-z0-9]*([A-Z0-9][A-Za-z0-9#.,\-\s]+(?:\b[A-Z]{2}\b)?\s*\d{5}(?:-\d{4})?)/i,
    /(?:job|project|property)\s+address[^A-Za-z0-9]*([A-Z0-9][A-Za-z0-9#.,\-\s]+(?:\b[A-Z]{2}\b)?\s*\d{5}(?:-\d{4})?)/i,
    /(?:site|roof)\s+address[^A-Za-z0-9]*([A-Z0-9][A-Za-z0-9#.,\-\s]+(?:\b[A-Z]{2}\b)?\s*\d{5}(?:-\d{4})?)/i,
    /([0-9]{1,6}\s+[A-Za-z0-9#.\-\s]+,\s*[A-Za-z0-9.\-\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
  ]);

  const totalRoofArea = extractQuickMeasureNumber(normalized, [
    /total\s+roof\s+area[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /roof\s+area[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
  ]);

  const totalSquares = extractQuickMeasureNumber(normalized, [
    /total\s+squares[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /roof\s+squares[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
  ]);

  const perimeterLinearFeet = extractQuickMeasureNumber(normalized, [
    /perimeter\s+linear\s+feet[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /perimeter[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
  ]);

  const dripEdgeMatch = extractQuickMeasureMatch(normalized, [
    /drip\s+edge(?:\s+linear\s+feet|\s+lf|\s+starter)?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /eave\/?rake\s+metal[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /perimeter\s+metal[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /drip\s+edge[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
    /drip\s+edge[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
  ]);
  const dripEdgeLinearFeet = dripEdgeMatch.value ? Number(dripEdgeMatch.value.replace(/,/g, "")) : null;

  const ridgeHipLinearFeet = extractQuickMeasureNumber(normalized, [
    /ridges?\s*\/\s*hips?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /ridges?\s+hips?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /ridges?\s*and\s*hips?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
  ]);

  const ridgeLinearFeet = extractQuickMeasureNumber(normalized, [
    /ridge\s+linear\s+feet[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /ridge[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
  ]);

  const hipLinearFeet = extractQuickMeasureNumber(normalized, [
    /hip\s+linear\s+feet[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /hip[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
  ]);

  const valleyLinearFeet = extractQuickMeasureNumber(normalized, [
    /valley\s+linear\s+feet[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /valley[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
  ]);

  const eaveLinearFeet = extractQuickMeasureNumber(normalized, [
    /eave\s+linear\s+feet[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /eave[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
  ]);

  const rakeLinearFeet = extractQuickMeasureNumber(normalized, [
    /rake\s+linear\s+feet[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /rake[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)\s*lf/i,
  ]);

  const pitch = extractQuickMeasureText(normalized, [
    /pitch[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?\s*(?:[:\/]\s*[0-9]+)?)/i,
    /([0-9]+(?:\.[0-9]+)?\s*:\s*12)/i,
  ]);

  const roofFacets = extractQuickMeasureNumber(normalized, [
    /roof\s+facets?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /facets?(?:\s*\/\s*sections?)?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    /roof\s+sections?[^0-9]*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
  ]);

  const shingleMaterialSuggestions = [
    extractQuickMeasureMaterialSuggestion(normalized, {
      aliases: ["Timberline HDZ RS+", "HDZ RS+", "Timberline HDZ Reflector", "TL HDZ Reflector", "Timberline UHDZ", "Timberline NS", "Timberline HDZ", "HDZ Reflector"],
      mappedField: "shingleHdzBundlesNeeded",
      quantityPatterns: [
        /(?:Timberline\s+HDZ\s+RS\+|HDZ\s+RS\+|Timberline\s+HDZ\s+Reflector|TL\s+HDZ\s+Reflector|Timberline\s+UHDZ|Timberline\s+NS|Timberline\s+HDZ|HDZ\s+Reflector)[^0-9]{0,120}(?:suggested|recommended|qty|quantity)?[^0-9]{0,20}([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:bundles?|bundle)\b/i,
        /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:bundles?|bundle)\b[^\\n]{0,120}(?:Timberline\s+HDZ\s+RS\+|HDZ\s+RS\+|Timberline\s+HDZ\s+Reflector|TL\s+HDZ\s+Reflector|Timberline\s+UHDZ|Timberline\s+NS|Timberline\s+HDZ|HDZ\s+Reflector)/i,
      ],
    }),
    extractQuickMeasureMaterialSuggestion(normalized, {
      aliases: ["Deck-Armor", "Tiger Paw", "FeltBuster", "FeltBuster 10 SQ"],
      mappedField: "shingleSyntheticUnderlaymentSuggestedRolls",
      quantityPatterns: [
        /(?:Deck-Armor|Tiger Paw|FeltBuster(?:\s+10\s+SQ)?)[^0-9]{0,120}(?:suggested|recommended|qty|quantity)?[^0-9]{0,20}([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:rolls?|roll)\b/i,
        /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:rolls?|roll)\b[^\\n]{0,120}(?:Deck-Armor|Tiger Paw|FeltBuster(?:\s+10\s+SQ)?)/i,
      ],
    }),
    extractQuickMeasureMaterialSuggestion(normalized, {
      aliases: ["Pro-Start", "ProStart", "GAF Pro-Start Starter Strip", "Starter Strip"],
      mappedField: "shingleStarterQuantity",
      quantityPatterns: [
        /(?:Pro-Start|ProStart|GAF\s+Pro-Start\s+Starter\s+Strip|Starter\s+Strip)[^0-9]{0,120}([0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*(?:bundles?|rolls?|pieces?|pcs?|qty|quantity))?/i,
        /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:bundles?|rolls?|pieces?|pcs?|qty|quantity)[^\\n]{0,120}(?:Pro-Start|ProStart|GAF\s+Pro-Start\s+Starter\s+Strip|Starter\s+Strip)/i,
      ],
    }),
    extractQuickMeasureMaterialSuggestion(normalized, {
      aliases: ["Drip Edge 10'", "10' Drip Edge", '2"x2" Drip Edge', "Drip Edge"],
      mappedField: "shingleDripEdgePieces",
      quantityPatterns: [
        /(?:Drip\s+Edge\s+10'|10'\s+Drip\s+Edge|2"x2"\s+Drip\s+Edge|Drip\s+Edge)[^0-9]{0,120}([0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*(?:pieces?|pcs?|piece))?/i,
        /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:pieces?|pcs?|piece)[^\\n]{0,120}(?:Drip\s+Edge\s+10'|10'\s+Drip\s+Edge|2"x2"\s+Drip\s+Edge|Drip\s+Edge)/i,
      ],
    }),
    extractQuickMeasureMaterialSuggestion(normalized, {
      aliases: ["Rapid Ridge", "Ridge Cap", "Timbercrest Hip & Ridge"],
      mappedField: "shingleRapidRidgeBoxes",
      quantityPatterns: [
        /(?:Rapid\s+Ridge|Ridge\s+Cap|Timbercrest\s+Hip\s+&\s+Ridge)[^0-9]{0,120}([0-9][0-9,]*(?:\.[0-9]+)?)\s*(boxes?|box|lf|linear\s+feet|feet|ft)?/i,
        /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(boxes?|box|lf|linear\s+feet|feet|ft)[^\\n]{0,120}(?:Rapid\s+Ridge|Ridge\s+Cap|Timbercrest\s+Hip\s+&\s+Ridge)/i,
      ],
      quantityMode: "lf-to-boxes",
    }),
  ];
  const materialSuggestionByField = Object.fromEntries(shingleMaterialSuggestions.map((item) => [item.mappedField, item]));
  const shingleHdzBundlesNeeded = materialSuggestionByField.shingleHdzBundlesNeeded?.matchedQuantity ?? null;
  const shingleSyntheticUnderlaymentSuggestedRolls = materialSuggestionByField.shingleSyntheticUnderlaymentSuggestedRolls?.matchedQuantity ?? null;
  const shingleStarterQuantity = materialSuggestionByField.shingleStarterQuantity?.matchedQuantity ?? null;
  const shingleDripEdgePieces = materialSuggestionByField.shingleDripEdgePieces?.matchedQuantity ?? null;
  const shingleRapidRidgeBoxesSuggested = materialSuggestionByField.shingleRapidRidgeBoxes?.matchedQuantity ?? null;

  const totalSquaresFromArea = totalRoofArea !== null ? Math.ceil(totalRoofArea / 100) : null;
  const resolvedTotalSquares = totalSquares ?? totalSquaresFromArea;
  const usedAreaFallback = totalSquares === null && totalSquaresFromArea !== null;
  const usedDripEdgeFallback = perimeterLinearFeet === null && dripEdgeLinearFeet !== null;
  const usedPerimeterFallback = perimeterLinearFeet === null && dripEdgeLinearFeet === null && (eaveLinearFeet !== null || rakeLinearFeet !== null);
  const usedEavesOnlyFallback = perimeterLinearFeet === null && dripEdgeLinearFeet === null && eaveLinearFeet !== null && rakeLinearFeet === null;
  const resolvedPerimeterLinearFeet =
    perimeterLinearFeet ?? dripEdgeLinearFeet ?? (eaveLinearFeet !== null && rakeLinearFeet !== null ? eaveLinearFeet + rakeLinearFeet : eaveLinearFeet ?? null);
  const resolvedStarterLinearFeet = dripEdgeLinearFeet ?? eaveLinearFeet ?? null;

  const dripEdgeSnippet =
    dripEdgeMatch.index >= 0
      ? normalized.slice(Math.max(0, dripEdgeMatch.index - 80), Math.min(normalized.length, dripEdgeMatch.index + 120)).trim()
      : "";

  const combinedRidgesHips =
    ridgeHipLinearFeet !== null && ridgeLinearFeet === null && hipLinearFeet === null ? ridgeHipLinearFeet : null;
  const resolvedRidgeLinearFeet = ridgeLinearFeet ?? (ridgeHipLinearFeet !== null && hipLinearFeet === null ? ridgeHipLinearFeet : null);
  const resolvedHipLinearFeet = hipLinearFeet ?? (ridgeHipLinearFeet !== null && ridgeLinearFeet === null ? 0 : null);
  const totalRidgeCapLinearFeet = ridgeHipLinearFeet !== null ? ridgeHipLinearFeet : (ridgeLinearFeet ?? 0) + (hipLinearFeet ?? 0);
  const shingleRapidRidgeBoxesCalculated = totalRidgeCapLinearFeet > 0 ? Math.ceil(totalRidgeCapLinearFeet / 20) : null;
  const shingleRapidRidgeBoxes = shingleRapidRidgeBoxesSuggested ?? shingleRapidRidgeBoxesCalculated;
  const resolvedStarterQuantity = shingleStarterQuantity ?? (dripEdgeLinearFeet !== null ? dripEdgeLinearFeet : null);
  const resolvedDripEdgePieces = shingleDripEdgePieces ?? (dripEdgeLinearFeet !== null ? Math.ceil(dripEdgeLinearFeet / 10) : null);
  const usedCombinedRidgesHips = ridgeHipLinearFeet !== null && ridgeLinearFeet === null && hipLinearFeet === null;
  const perimeterSourceNote = usedDripEdgeFallback
    ? "using drip edge as perimeter fallback"
    : usedPerimeterFallback
      ? usedEavesOnlyFallback
        ? "using eaves as perimeter fallback"
        : "using eaves/rakes as perimeter fallback"
      : "parsed";
  const totalSquaresSourceNote = usedAreaFallback ? "calculated from roof area" : "parsed";
  const shingleMaterialNotes = [
    shingleHdzBundlesNeeded === null ? "Using calculated fallback." : "",
    shingleSyntheticUnderlaymentSuggestedRolls === null ? "Using calculated fallback." : "",
    shingleStarterQuantity === null ? "Using calculated fallback." : "",
    shingleDripEdgePieces === null ? "Using calculated fallback." : "",
    shingleRapidRidgeBoxesSuggested === null ? "Using calculated fallback." : "",
  ].filter(Boolean);
  const starterCoverageLfPerBundle = Math.max(1, toNumber(inputs.shingleStarterRollCoverageLf, 115));
  const starterQuantitySuggested = Math.max(0, toNumber(inputs.shingleStarterQuantity, 0));
  const starterQuantityCalculated = starterQuantitySuggested > 0 ? starterQuantitySuggested : Math.max(0, Math.ceil((toNumber(inputs.shingleStarterLinearFeet, toNumber(inputs.shingleStarterLf, dripEdgeLinearFeet ?? 0)) || 0) / starterCoverageLfPerBundle));
  const starterQuantity = starterQuantitySuggested > 0 ? starterQuantitySuggested : starterQuantityCalculated;

  return {
    propertyAddress,
    totalRoofArea,
    totalSquares: resolvedTotalSquares,
    totalSquaresSource: totalSquaresSourceNote,
    perimeterLinearFeet: resolvedPerimeterLinearFeet,
    perimeterLinearFeetSource: perimeterSourceNote,
    ridgeLinearFeet: resolvedRidgeLinearFeet,
    hipLinearFeet: resolvedHipLinearFeet,
    ridgeHipLinearFeet: combinedRidgesHips,
    valleyLinearFeet,
    eaveLinearFeet,
    rakeLinearFeet,
    starterLinearFeet: resolvedStarterLinearFeet,
    dripEdgeLinearFeet: dripEdgeLinearFeet ?? null,
    shingleStarterQuantity: resolvedStarterQuantity,
    shingleStarterSuggestedQuantity: shingleStarterQuantity,
    shingleStarterCalculatedQuantity: shingleStarterQuantity === null ? resolvedStarterQuantity : shingleStarterQuantity,
    shingleDripEdgePieces: resolvedDripEdgePieces,
    shingleDripEdgeSuggestedPieces: shingleDripEdgePieces,
    shingleDripEdgeCalculatedPieces: shingleDripEdgePieces === null ? resolvedDripEdgePieces : shingleDripEdgePieces,
    shingleRapidRidgeBoxes,
    shingleRapidRidgeBoxesSuggested,
    shingleRapidRidgeBoxesCalculated,
    shingleRapidRidgeLFUsed: totalRidgeCapLinearFeet,
    pitch,
    roofFacets,
    roofSections: roofFacets,
    shingleHdzBundlesNeeded,
    shingleSyntheticUnderlaymentSuggestedRolls,
    shingleSyntheticUnderlaymentRolls: shingleSyntheticUnderlaymentSuggestedRolls,
    shingleSyntheticUnderlaymentCalculatedRolls: null,
    shingleMaterialSuggestions,
    shingleMaterialNotes,
    rawDripEdgeMatch: dripEdgeMatch.rawMatch,
    dripEdgeSnippet,
    notes: [
      usedAreaFallback ? "Total squares calculated from roof area and rounded up." : "",
      usedDripEdgeFallback ? "Starter LF matched to drip edge LF." : "",
      usedDripEdgeFallback ? "Perimeter LF matched to drip edge LF." : usedPerimeterFallback ? (usedEavesOnlyFallback ? "Perimeter LF matched to eaves LF." : "Perimeter LF matched to eaves/rakes LF.") : "",
      usedCombinedRidgesHips ? "Ridges/Hips combined by GAF report." : "",
      usedEavesOnlyFallback ? "Using Eaves as perimeter fallback." : "",
    ].filter(Boolean),
  };
}

function formatHoursMinutes(value) {
  const totalMinutes = Math.max(0, Math.round(toNumber(value, 0) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function normalizeSubcontractorAddOnItems(items) {
  const source = Array.isArray(items) ? items : [];
  const normalized = DEFAULT_SUBCONTRACTOR_ADD_ON_ITEMS.map((defaultItem, index) => {
    const item = source[index] || {};
    return {
      description: String(item.description || defaultItem.description),
      quantity: Math.max(0, toNumber(item.quantity, defaultItem.quantity)),
      unitPrice: Math.max(0, toNumber(item.unitPrice, defaultItem.unitPrice)),
    };
  });

  if (source.length > DEFAULT_SUBCONTRACTOR_ADD_ON_ITEMS.length) {
    for (let index = DEFAULT_SUBCONTRACTOR_ADD_ON_ITEMS.length; index < source.length; index += 1) {
      const item = source[index] || {};
      normalized.push({
        description: String(item.description || ""),
        quantity: Math.max(0, toNumber(item.quantity, 0)),
        unitPrice: Math.max(0, toNumber(item.unitPrice, 0)),
      });
    }
  }

  return normalized;
}

function normalizeMaterialPrices(prices = {}) {
  const normalized = { ...DEFAULT_MATERIAL_PRICES };
  for (const [key, defaultValue] of Object.entries(DEFAULT_MATERIAL_PRICES)) {
    const rawValue = toNumber(prices[key], defaultValue);
    normalized[key] = rawValue > 0 ? rawValue : defaultValue;
  }
  return normalized;
}

function normalizeSprayFoamLayerConfig(config = {}) {
  const legacyCoverageRates = {
    primer: new Set([1000]),
    baseCoat: new Set([250, 33]),
    intermediateCoat1: new Set([850, 33]),
    intermediateCoat2: new Set([850, 33]),
    topCoat: new Set([1200, 33]),
  };
  const legacyUnitCosts = {
    primer: new Set([48]),
    baseCoat: new Set([52]),
    intermediateCoat1: new Set([46]),
    intermediateCoat2: new Set([46]),
    topCoat: new Set([58]),
  };
  return Object.fromEntries(
    Object.entries(DEFAULT_SPF_LAYER_CONFIG).map(([key, defaults]) => {
      const current = config[key] || {};
      const currentCoverageRate = toNumber(current.coverageRate, defaults.coverageRate);
      const currentUnitCost = toNumber(current.unitCost, defaults.unitCost);
      const resolvedCoverageRate =
        !Number.isFinite(currentCoverageRate) || legacyCoverageRates[key]?.has(currentCoverageRate)
          ? defaults.coverageRate
          : currentCoverageRate;
      const resolvedUnitCost =
        !Number.isFinite(currentUnitCost) || legacyUnitCosts[key]?.has(currentUnitCost)
          ? defaults.unitCost
          : currentUnitCost;
      return [
        key,
        {
          applicable: typeof current.applicable === "boolean" ? current.applicable : Boolean(defaults.applicable),
          coverageRate: Math.max(0.1, resolvedCoverageRate),
          unitCost: Math.max(0, resolvedUnitCost),
        },
      ];
    }),
  );
}

function normalizeSprayFoamDetailMaterials(config = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SPF_DETAIL_MATERIALS).map(([key, defaults]) => {
      const current = config[key] || {};
      return [
        key,
        {
          quantity: Math.max(0, toNumber(current.quantity, defaults.quantity)),
          unitCost: Math.max(0, toNumber(current.unitCost, defaults.unitCost)),
          useAutoQuantity: false,
        },
      ];
    }),
  );
}

function normalizeSprayFoamAdditionalDetailMaterials(items = []) {
  return Array.isArray(items)
    ? items.map((item) => ({
        name: String(item?.name || ""),
        quantity: Math.max(0, toNumber(item?.quantity, 1)),
        unitCost: Math.max(0, toNumber(item?.unitCost, 0)),
        unit: String(item?.unit || "each"),
      }))
    : [];
}

function normalizeSprayFoamEquipmentRentals(items = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : [createBlankSprayFoamEquipmentRental()];
  return source.map((item) => ({
    name: String(item?.name || ""),
    rateType: String(item?.rateType || "perDay"),
    rateAmount: Math.max(0, toNumber(item?.rateAmount, 0)),
    quantity: Math.max(0, toNumber(item?.quantity, 1)),
    days: Math.max(0, toNumber(item?.days, 0)),
    hours: Math.max(0, toNumber(item?.hours, 0)),
  }));
}

function normalizeShingleTearOffSections(items = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : [createBlankShingleTearOffSection()];
  return source.map((item, index) => ({
    id: String(item?.id || createBlankShingleTearOffSection(index).id),
    label: String(item?.label || `Section ${index + 1}`),
    squares: Math.max(0, toNumber(item?.squares, 0)),
    layers: Math.max(1, Math.round(toNumber(item?.layers, 1))),
    tearOffCostPerSquare: Math.max(0, toNumber(item?.tearOffCostPerSquare, 0)),
    disposalFee: Math.max(0, toNumber(item?.disposalFee, 0)),
    dryRotAllowance: Math.max(0, toNumber(item?.dryRotAllowance, 0)),
  }));
}

function normalizeShingleLaborSections(items = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : [createBlankShingleLaborSection()];
  return source.map((item, index) => ({
    id: String(item?.id || createBlankShingleLaborSection(index).id),
    label: String(item?.label || `Section ${index + 1}`),
    installSquares: Math.max(0, toNumber(item?.installSquares, 0)),
    costPerInstallSq: Math.max(0, toNumber(item?.costPerInstallSq, 0)),
    licensed: typeof item?.licensed === "boolean" ? item.licensed : true,
    workersComp: typeof item?.workersComp === "boolean" ? item.workersComp : true,
  }));
}

function normalizeShingleSubcontractorItems(items = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : DEFAULT_INPUTS.shingleSubcontractorItems || [];
  return source.map((item, index) => ({
    type: String(item?.type || (index === 0 ? "Tear-Off Subcontractor" : "")),
    unit: String(item?.unit || ""),
    quantity: Math.max(0, toNumber(item?.quantity, 0)),
    unitPrice: Math.max(0, toNumber(item?.unitPrice, 0)),
    licensed: typeof item?.licensed === "boolean" ? item.licensed : true,
  }));
}

function normalizeSprayFoamSubcontractorItems(items = []) {
  const defaults = DEFAULT_INPUTS.sprayFoamSubcontractorItems || [];
  return defaults.map((defaultItem, index) => {
    const current = Array.isArray(items) ? items[index] || {} : {};
    return {
      type: String(current.type || defaultItem.type || ""),
      quantity: Math.max(0, toNumber(current.quantity, defaultItem.quantity || 0)),
      unitPrice: Math.max(0, toNumber(current.unitPrice, defaultItem.unitPrice || 0)),
      licensed: typeof current.licensed === "boolean" ? current.licensed : Boolean(defaultItem.licensed),
    };
  });
}

function normalizeTravelVehicles(value) {
  const fallback = [DEFAULT_TRAVEL_VEHICLE_KEY];
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  const filtered = source.filter((vehicleKey) => TRAVEL_VEHICLE_OPTIONS.some((option) => option.value === vehicleKey));
  return filtered.length > 0 ? filtered : fallback;
}

function normalizeSprayFoamParapetMeasurements(items = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : [createBlankSprayFoamParapetMeasurement()];
  return source.map((item) => ({
    label: String(item?.label || ""),
    height: Math.max(0, toNumber(item?.height, 0)),
    linearFeet: Math.max(0, toNumber(item?.linearFeet ?? item?.length, 0)),
  }));
}

function normalizeSprayFoamRoofAreas(items = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : [createBlankSprayFoamRoofArea()];
  return source.map((item) => ({
    label: String(item?.label || ""),
    fieldRoofSquares: Math.max(0, toNumber(item?.fieldRoofSquares, 0)),
    foamThicknessInches: normalizeSprayFoamThickness(item?.foamThicknessInches, 2),
    hasParapetWalls: Boolean(item?.hasParapetWalls),
    parapetWallSquares: Math.max(0, toNumber(item?.parapetWallSquares, 0)),
  }));
}

function calculateSprayFoamParapetMeasurementTotals(items = []) {
  const rows = normalizeSprayFoamParapetMeasurements(items);
  const rowsWithTotals = rows.map((row) => ({
    ...row,
    sq: (row.linearFeet * row.height) / 100,
  }));
  const totalLinearFeet = rowsWithTotals.reduce((sum, row) => sum + row.linearFeet, 0);
  const totalParapetSquares = rowsWithTotals.reduce((sum, row) => sum + row.sq, 0);
  return {
    rows: rowsWithTotals,
    totalLinearFeet,
    totalParapetSquares,
    totalParapetSquareFeet: totalParapetSquares * 100,
  };
}

function calculateSprayFoamRoofAreaTotalsSafe(items = [], setCost = DEFAULT_SPF_RATES.foamKitCost, yieldPerInch = 26) {
  if (typeof calculateSprayFoamRoofAreaTotals === "function") {
    return calculateSprayFoamRoofAreaTotals(items, setCost, yieldPerInch);
  }

  const rows = normalizeSprayFoamRoofAreas(items);
  const rowsWithTotals = rows.map((row) => {
    const parapetWallSquares = row.hasParapetWalls ? row.parapetWallSquares : 0;
    const totalAreaSquares = row.fieldRoofSquares + parapetWallSquares;
    const usage = calculateSprayFoamUsage(totalAreaSquares, row.foamThicknessInches, yieldPerInch);
    const { yieldPerKit, kitsNeeded } = usage;
    return {
      ...row,
      parapetWallSquares,
      totalAreaSquares,
      yieldPerKit,
      kitsNeeded,
      foamCost: kitsNeeded * setCost,
    };
  });

  const totalFieldSquares = rowsWithTotals.reduce((sum, row) => sum + (Number(row.fieldRoofSquares) || 0), 0);
  const totalParapetWallSquares = rowsWithTotals.reduce((sum, row) => sum + (Number(row.parapetWallSquares) || 0), 0);
  const totalRoofSquares = totalFieldSquares + totalParapetWallSquares;
  const totalFoamKits = rowsWithTotals.reduce((sum, row) => sum + (Number(row.kitsNeeded) || 0), 0);
  const totalFoamCost = totalFoamKits * setCost;

  return {
    rows: rowsWithTotals,
    totalFieldSquares,
    totalParapetWallSquares,
    totalRoofSquares,
    totalFoamKits,
    totalFoamCost,
  };
}

function normalizeFieldNotes(notes = {}) {
  return {
    ...DEFAULT_FIELD_NOTES,
    ...notes,
    photos: Array.isArray(notes.photos)
      ? notes.photos.map((photo) => {
          if (typeof photo === "string") {
            return { name: photo, type: "", dataUrl: "" };
          }
          return {
            name: String(photo?.name || "Photo"),
            type: String(photo?.type || ""),
            dataUrl: String(photo?.dataUrl || ""),
          };
        })
      : [],
  };
}

function buildInspectionTransferInputs(notes = {}) {
  const normalized = normalizeFieldNotes(notes);
  return {
    jobName: String(normalized.jobName || ""),
    customerName: String(normalized.customerName || ""),
    jobAddress: String(normalized.jobAddress || ""),
    jobSiteAddress: String(normalized.jobAddress || ""),
    inspectionJobName: String(normalized.jobName || ""),
    inspectionCustomerName: String(normalized.customerName || ""),
    inspectionJobAddress: String(normalized.jobAddress || ""),
    inspectionDate: String(normalized.date || ""),
    inspectionTechnicianName: String(normalized.technicianName || ""),
    inspectionRoofTypeObserved: String(normalized.roofTypeObserved || ""),
    inspectionCustomerRequestedRoofPreference: String(normalized.customerRequestedRoofPreference || ""),
    inspectionRoofConditionNotes: String(normalized.roofConditionNotes || ""),
    inspectionAccessNotes: String(normalized.accessNotes || ""),
    inspectionSafetyConcerns: String(normalized.safetyConcerns || ""),
    inspectionExistingRoofLayers: String(normalized.existingRoofLayers || ""),
    inspectionAcUnitsCount: String(normalized.acUnitsCount || ""),
    inspectionDrainsCount: String(normalized.drainsCount || ""),
    inspectionScuppersCount: String(normalized.scuppersCount || ""),
    inspectionPenetrationsCount: String(normalized.penetrationsCount || ""),
    inspectionParapetNotes: String(normalized.parapetNotes || ""),
    inspectionInternalNotes: String(normalized.internalNotes || ""),
    maintenancePropertyAddress: String(normalized.jobAddress || ""),
  };
}

function normalizeDraftInputs(inputs = {}) {
  const oneWayMiles = toNumber(inputs.oneWayMiles, toNumber(inputs.jobDistanceOneWayMiles, 0));
  const oneWayDriveTime = Math.max(
    0,
    toNumber(inputs.oneWayDriveTime, toNumber(inputs.estimatedDriveTimeMinutes, 0) / 60),
  );
  const oneWayDriveTimeHours = Math.max(0, toNumber(inputs.oneWayDriveTimeHours, oneWayDriveTime));
  const jobAddress = String(inputs.jobAddress || inputs.jobSiteAddress || "");
  const fieldSquares = Math.max(0, toNumber(inputs.fieldSquares, toNumber(inputs.totalSquares, 0)));
  return {
    ...DEFAULT_INPUTS,
    ...inputs,
    laborEmployeeRows: normalizeEstimateLaborEmployeeRows(inputs.laborEmployeeRows),
    sprayFoamLayerConfig: normalizeSprayFoamLayerConfig(inputs.sprayFoamLayerConfig),
    sprayFoamDetailMaterials: normalizeSprayFoamDetailMaterials(inputs.sprayFoamDetailMaterials),
    sprayFoamAdditionalDetailMaterials: normalizeSprayFoamAdditionalDetailMaterials(inputs.sprayFoamAdditionalDetailMaterials),
    sprayFoamSubcontractorItems: normalizeSprayFoamSubcontractorItems(inputs.sprayFoamSubcontractorItems),
    sprayFoamHasSubcontractors: Boolean(inputs.sprayFoamHasSubcontractors),
    sprayFoamParapetMeasurements: normalizeSprayFoamParapetMeasurements(inputs.sprayFoamParapetMeasurements),
    sprayFoamUseMultipleParapetMeasurements: Boolean(inputs.sprayFoamUseMultipleParapetMeasurements),
    sprayFoamSeparateRoofAreas: Boolean(inputs.sprayFoamSeparateRoofAreas),
    sprayFoamRoofAreas: normalizeSprayFoamRoofAreas(inputs.sprayFoamRoofAreas),
    sprayFoamEstimateType: String(inputs.sprayFoamEstimateType || "roof"),
    sprayFoamEquipmentRentals: normalizeSprayFoamEquipmentRentals(inputs.sprayFoamEquipmentRentals),
    sprayFoamPrevailingWageJob: Boolean(inputs.sprayFoamPrevailingWageJob),
    shingleTearOffSections: normalizeShingleTearOffSections(inputs.shingleTearOffSections),
    shingleLaborType: String(inputs.shingleLaborType || "inHouse"),
    shingleLaborSections: normalizeShingleLaborSections(inputs.shingleLaborSections),
    shingleSubcontractorLicensed: typeof inputs.shingleSubcontractorLicensed === "boolean" ? inputs.shingleSubcontractorLicensed : true,
    shingleSubcontractorWorkersComp: typeof inputs.shingleSubcontractorWorkersComp === "boolean" ? inputs.shingleSubcontractorWorkersComp : true,
    shingleLaborersPerDay: Math.max(0, toNumber(inputs.shingleLaborersPerDay, 0)),
    shingleTotalDaysOnJob: Math.max(0, toNumber(inputs.shingleTotalDaysOnJob, 0)),
    shingleLaborHourlyRate: Math.max(0, toNumber(inputs.shingleLaborHourlyRate, 0)),
    shingleHoursPerDay: Math.max(0, toNumber(inputs.shingleHoursPerDay, 0)),
    tileTearOffSections: normalizeShingleTearOffSections(inputs.tileTearOffSections || [createBlankTileTearOffSection()]),
    tileLaborType: String(inputs.tileLaborType || "inHouse"),
    tileSubcontractorSections: normalizeShingleLaborSections(inputs.tileSubcontractorSections || [createBlankTileLaborSection()]),
    tileSubcontractorLicensed: typeof inputs.tileSubcontractorLicensed === "boolean" ? inputs.tileSubcontractorLicensed : true,
    tileSubcontractorWorkersComp: typeof inputs.tileSubcontractorWorkersComp === "boolean" ? inputs.tileSubcontractorWorkersComp : true,
    tileLaborersPerDay: Math.max(0, toNumber(inputs.tileLaborersPerDay, 0)),
    tileTotalDaysOnJob: Math.max(0, toNumber(inputs.tileTotalDaysOnJob, 0)),
    tileLaborHourlyRate: Math.max(0, toNumber(inputs.tileLaborHourlyRate, 0)),
    tileHoursPerDay: Math.max(0, toNumber(inputs.tileHoursPerDay, 0)),
    tileProjectType: ["raiseReset", "removeInstallNew", "newConstruction"].includes(inputs.tileProjectType)
      ? inputs.tileProjectType
      : "raiseReset",
    tileBrokenTileAllowancePercent: Math.max(0, toNumber(inputs.tileBrokenTileAllowancePercent, 3)),
    tilePalletYieldSqPerPallet: Math.max(0, toNumber(inputs.tilePalletYieldSqPerPallet, 0)),
    tileOrderReplacementTile: typeof inputs.tileOrderReplacementTile === "boolean" ? inputs.tileOrderReplacementTile : false,
    tileOrderingVerifiedPalletYield: Boolean(inputs.tileOrderingVerifiedPalletYield),
    tileOrderingVerifiedRoofLoadCost: Boolean(inputs.tileOrderingVerifiedRoofLoadCost),
    tileOrderingVerifiedMaterialDeliveryCost: Boolean(inputs.tileOrderingVerifiedMaterialDeliveryCost),
    tileOrderingVerifiedColorProfileAvailability: Boolean(inputs.tileOrderingVerifiedColorProfileAvailability),
    tileOrderingVerifiedBrokenAllowance: Boolean(inputs.tileOrderingVerifiedBrokenAllowance),
    tileFieldTileQuantityManual:
      typeof inputs.tileFieldTileQuantityManual === "string" ? inputs.tileFieldTileQuantityManual : String(inputs.tileFieldTileQuantityManual || ""),
    tileUnderlaymentType: ["syntheticTitanium50", "felt30"].includes(inputs.tileUnderlaymentType)
      ? inputs.tileUnderlaymentType
      : "syntheticTitanium50",
    tileProfile: ["flat", "sTile", "lightweight", "claySTile", "custom"].includes(inputs.tileProfile) ? inputs.tileProfile : "flat",
    tileFlatTileNailsQuantityManual:
      typeof inputs.tileFlatTileNailsQuantityManual === "string"
        ? inputs.tileFlatTileNailsQuantityManual
        : String(inputs.tileFlatTileNailsQuantityManual || ""),
    tileSTileNailsQuantityManual:
      typeof inputs.tileSTileNailsQuantityManual === "string" ? inputs.tileSTileNailsQuantityManual : String(inputs.tileSTileNailsQuantityManual || ""),
    tileFlatTileNailsCost: Math.max(0, toNumber(inputs.tileFlatTileNailsCost, 0)),
    tileSTileNailsCost: Math.max(0, toNumber(inputs.tileSTileNailsCost, 0)),
    tileUnderlaymentQuantityManual:
      typeof inputs.tileUnderlaymentQuantityManual === "string" ? inputs.tileUnderlaymentQuantityManual : String(inputs.tileUnderlaymentQuantityManual || ""),
    tileUnderlayment30QuantityManual:
      typeof inputs.tileUnderlayment30QuantityManual === "string"
        ? inputs.tileUnderlayment30QuantityManual
        : String(inputs.tileUnderlayment30QuantityManual || ""),
    tileBattensLf: Math.max(0, toNumber(inputs.tileBattensLf, 0)),
    tileBattensQuantityManual:
      typeof inputs.tileBattensQuantityManual === "string" ? inputs.tileBattensQuantityManual : String(inputs.tileBattensQuantityManual || ""),
    tileValleyMetalQuantityManual:
      typeof inputs.tileValleyMetalQuantityManual === "string" ? inputs.tileValleyMetalQuantityManual : String(inputs.tileValleyMetalQuantityManual || ""),
    tileDripEdgeQuantityManual:
      typeof inputs.tileDripEdgeQuantityManual === "string" ? inputs.tileDripEdgeQuantityManual : String(inputs.tileDripEdgeQuantityManual || ""),
    tileOneHalfPipePenetrations: Math.max(0, Math.round(toNumber(inputs.tileOneHalfPipePenetrations, 0))),
    tileTwoInchPipePenetrations: Math.max(0, Math.round(toNumber(inputs.tileTwoInchPipePenetrations, 0))),
    tileThreeInchPipePenetrations: Math.max(0, Math.round(toNumber(inputs.tileThreeInchPipePenetrations, 0))),
    tileFourInchPipePenetrations: Math.max(0, Math.round(toNumber(inputs.tileFourInchPipePenetrations, 0))),
    tileOvalPipePenetrations: Math.max(0, Math.round(toNumber(inputs.tileOvalPipePenetrations, 0))),
    tileAmericapQuantity: Math.max(0, Math.round(toNumber(inputs.tileAmericapQuantity, 0))),
    tileOvalCapQuantity: Math.max(0, Math.round(toNumber(inputs.tileOvalCapQuantity, 0))),
    tileOneHalfBaseJackCost: Math.max(0, toNumber(inputs.tileOneHalfBaseJackCost, 8)),
    tileOneHalfRoofJackCost: Math.max(0, toNumber(inputs.tileOneHalfRoofJackCost, 8)),
    tileTwoInchBaseJackCost: Math.max(0, toNumber(inputs.tileTwoInchBaseJackCost, 8)),
    tileTwoInchRoofJackCost: Math.max(0, toNumber(inputs.tileTwoInchRoofJackCost, 8)),
    tileThreeInchBaseJackCost: Math.max(0, toNumber(inputs.tileThreeInchBaseJackCost, 14)),
    tileThreeInchRoofJackCost: Math.max(0, toNumber(inputs.tileThreeInchRoofJackCost, 14)),
    tileFourInchBaseJackCost: Math.max(0, toNumber(inputs.tileFourInchBaseJackCost, 15)),
    tileFourInchRoofJackCost: Math.max(0, toNumber(inputs.tileFourInchRoofJackCost, 15)),
    tileOvalBaseJackCost: Math.max(0, toNumber(inputs.tileOvalBaseJackCost, 25)),
    tileOvalRoofJackCost: Math.max(0, toNumber(inputs.tileOvalRoofJackCost, 25)),
    tileAmericapCost: Math.max(0, toNumber(inputs.tileAmericapCost, 25)),
    tileOvalCapCost: Math.max(0, toNumber(inputs.tileOvalCapCost, 25)),
    totalSquares: fieldSquares,
    fieldSquares,
    tileLeftRakeLf: Math.max(0, toNumber(inputs.tileLeftRakeLf, 0)),
    tileRightRakeLf: Math.max(0, toNumber(inputs.tileRightRakeLf, 0)),
    tileBirdStopLf: Math.max(0, toNumber(inputs.tileBirdStopLf, 0)),
    tileTileRaiserLf: Math.max(0, toNumber(inputs.tileTileRaiserLf, 0)),
    tileMortarMixQuantityManual:
      typeof inputs.tileMortarMixQuantityManual === "string"
        ? inputs.tileMortarMixQuantityManual
        : String(inputs.tileMortarMixQuantityManual ?? inputs.tileMortarAdhesiveQuantity ?? ""),
    tileMortarMixCost: Math.max(0, toNumber(inputs.tileMortarMixCost, toNumber(inputs.tileMortarAdhesiveCost, 0))),
    tileCustomMaterials: Array.isArray(inputs.tileCustomMaterials)
      ? inputs.tileCustomMaterials.map((mat, idx) => ({
          id: String(mat?.id || `${Date.now()}-${idx}`),
          name: String(mat?.name || ""),
          quantity: Math.max(0, toNumber(mat?.quantity, 0)),
          unit: String(mat?.unit || "piece"),
          unitPrice: Math.max(0, toNumber(mat?.unitPrice, 0)),
        }))
      : [],
    jobAddress,
    oneWayMiles,
    oneWayDriveTime,
    oneWayDriveTimeHours,
    estimatedDriveTimeMinutes: Math.max(0, toNumber(inputs.estimatedDriveTimeMinutes, oneWayDriveTime * 60)),
    travelDistanceSource: inputs.travelDistanceSource === "google" ? "google" : "manual",
    travelVehicle: TRAVEL_VEHICLE_OPTIONS.some((option) => option.value === inputs.travelVehicle)
      ? inputs.travelVehicle
      : DEFAULT_TRAVEL_VEHICLE_KEY,
    travelVehicles: normalizeTravelVehicles(inputs.travelVehicles || inputs.travelVehicle),
    overheadOperatingRate: OVERHEAD_OPERATING_RATE,
  };
}

function calculateTravelAndOvertime(inputs = {}, travelConfig = DEFAULT_TRAVEL_ADMIN_SETTINGS) {
  const safeInputs = inputs || {};
  const safeTravelConfig = normalizeTravelAdminSettings(travelConfig);
  const oneWayMiles = Math.max(0, toNumber(safeInputs.oneWayMiles, 0));
  const averageDrivingSpeedMph = Math.max(0.1, toNumber(safeInputs.averageDrivingSpeedMph, 60));
  const travelDriverHourlyRate = Math.max(0, toNumber(safeTravelConfig.travelDriverHourlyRate, toNumber(safeInputs.travelDriverHourlyRate, 27)));
  const workHoursPerDay = Math.max(0, toNumber(safeInputs.workHoursPerDay, 8));
  const numberOfJobDays = Math.max(0, Math.round(toNumber(safeInputs.numberOfJobDays, 0)));
  const numberOfDrivers = Math.max(0, Math.round(toNumber(safeInputs.numberOfDrivers, 0)));
  const oneWayDriveTimeHours = Math.max(
    0,
    toNumber(safeInputs.oneWayDriveTimeHours, toNumber(safeInputs.oneWayDriveTime, toNumber(safeInputs.estimatedDriveTimeMinutes, 0) / 60)),
  );
  const travelDistanceSource = safeInputs.travelDistanceSource === "google" ? "google" : "manual";
  const companyHqAddress = String(safeTravelConfig.companyHqAddress || safeInputs.companyHqAddress || "");
  const jobSiteAddress = String(safeInputs.jobSiteAddress || "");
  const jobAddress = String(safeInputs.jobAddress || "");
  const travelVehicles = normalizeTravelVehicles(safeInputs.travelVehicles || safeInputs.travelVehicle);
  const travelVehicleBreakdown = travelVehicles.map((vehicleKey) => {
    const vehicle = TRAVEL_VEHICLE_OPTIONS.find((option) => option.value === vehicleKey) || TRAVEL_VEHICLE_OPTIONS[0];
    const configuredMpg = Math.max(0.1, toNumber(safeTravelConfig.vehicleMpgByKey?.[vehicle.value], vehicle.mpg));
    const fuelGallonsNeeded = (oneWayMiles * 2 * numberOfJobDays) / configuredMpg;
    const fuelCost = fuelGallonsNeeded * safeTravelConfig.fuelCostPerGallon;
    return {
      value: vehicle.value,
      label: vehicle.label,
      mpg: configuredMpg,
      fuelGallonsNeeded,
      fuelCostPerGallon: safeTravelConfig.fuelCostPerGallon,
      fuelCost,
    };
  });
  const fuelGallonsNeeded = travelVehicleBreakdown.reduce((sum, item) => sum + item.fuelGallonsNeeded, 0);
  const fuelCostPerGallon = safeTravelConfig.fuelCostPerGallon;
  const fuelCost = travelVehicleBreakdown.reduce((sum, item) => sum + item.fuelCost, 0);

  const oneWayDriveTime =
    travelDistanceSource === "google" && oneWayDriveTimeHours > 0
      ? oneWayDriveTimeHours
      : oneWayMiles / averageDrivingSpeedMph;
  const roundTripDriveTime = oneWayDriveTime * 2;
  const roundTripMiles = oneWayMiles * 2;
  const regularDriveHoursPerDay = Math.min(roundTripDriveTime, workHoursPerDay);
  const overtimeHoursPerDay = Math.max(0, roundTripDriveTime - workHoursPerDay);
  const regularPayPerDay = regularDriveHoursPerDay * travelDriverHourlyRate * numberOfDrivers;
  const overtimePayPerDay = overtimeHoursPerDay * travelDriverHourlyRate * 1.5 * numberOfDrivers;
  const totalDriverTravelCost = (regularPayPerDay + overtimePayPerDay) * numberOfJobDays;

  return {
    companyHqAddress,
    jobSiteAddress,
    jobAddress,
    oneWayMiles,
    oneWayDriveTimeHours: oneWayDriveTime,
    travelDistanceSource,
    averageDrivingSpeedMph,
    travelDriverHourlyRate,
    workHoursPerDay,
    numberOfJobDays,
    numberOfDrivers,
    travelVehicleKey: travelVehicleBreakdown[0]?.value || DEFAULT_TRAVEL_VEHICLE_KEY,
    travelVehicleLabel: travelVehicleBreakdown.map((item) => item.label).join(", "),
    travelVehicleMpg: travelVehicleBreakdown[0]?.mpg || 0,
    travelVehicles,
    travelVehicleBreakdown,
    fuelCostPerGallon,
    fuelGallonsNeeded,
    fuelCost,
    oneWayDriveTime,
    roundTripDriveTime,
    roundTripMiles,
    regularDriveHoursPerDay,
    regularPayPerDay,
    overtimeHoursPerDay,
    overtimePayPerDay,
    totalDriverTravelCost,
    totalTravelCost: totalDriverTravelCost + fuelCost,
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function estimateCode(n) {
  return `CRT-${String(Math.max(1, Math.floor(n || 1))).padStart(4, "0")}`;
}

function estimateTypeForTemplate(templateKey) {
  switch (templateKey) {
    case "tpo":
      return "TPO";
    case "sprayFoam":
      return "Spray Foam";
    case "tile":
      return "Tile";
    case "shingle":
      return "Shingle";
    case "coating":
      return "Coating";
    case "maintenance":
      return "Maintenance";
    case "repair":
      return "Repair / Service";
    default:
      return "TPO";
  }
}

function buildEstimateName(inputs) {
  const sq = num(inputs.totalSquares, 0);
  if (inputs.jobType === "existingRoof" && inputs.existingRoofAction === "tearOff") return `Tear-off ${sq} SQ`;
  if (inputs.jobType === "existingRoof" && inputs.existingRoofAction === "layover") return `Layover ${sq} SQ`;
  if (inputs.jobType === "newConstruction" && inputs.substrateType === "rigidInsulation") return `Rigid insulation ${sq} SQ`;
  if (inputs.jobType === "newConstruction" && inputs.substrateType === "denseDeckOnly") return `Dense deck ${sq} SQ`;
  return `TPO estimate ${sq} SQ`;
}

function buildEstimateNameForTemplate(templateKey, inputs) {
  if (templateKey === "sprayFoam") {
    const parapetTotals = inputs.sprayFoamUseMultipleParapetMeasurements
      ? calculateSprayFoamParapetMeasurementTotals(inputs.sprayFoamParapetMeasurements)
      : { totalParapetSquares: toNumber(inputs.sprayFoamParapetWallSquares, 0) };
    const fieldRoofSquares = toNumber(inputs.sprayFoamFieldRoofSquares, 0);
    const sq = num(
      fieldRoofSquares + toNumber(parapetTotals.totalParapetSquares, 0),
      0,
    );
    return `SPF estimate ${sq} SQ`;
  }

  if (templateKey === "shingle") {
    const sq = num(toNumber(inputs.shingleTotalRoofSquares, toNumber(inputs.totalSquares, 0)), 0);
    return `Shingle estimate ${sq} SQ`;
  }

  if (templateKey === "tile") {
    const sq = num(toNumber(inputs.tileTotalRoofSquares, toNumber(inputs.totalSquares, 0)), 0);
    return `Tile estimate ${sq} SQ`;
  }

  return buildEstimateName(inputs);
}

function handleNumberInputWheel(event) {
  event.currentTarget.blur();
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

function ChoiceCard({ name, value, checked, onChange, label }) {
  return (
    <label className={`choiceCard ${checked ? "active" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function DetailRow({ label, value, note }) {
  return (
    <div className="detailRow">
      <div>
        <span>{label}</span>
        {note ? <div className="detailNote">{note}</div> : null}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function Section({ title, subtitle, right, children }) {
  return (
    <section className="panel">
      <div className="sectionHead">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

class SafeTileSection extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Section title="Tile Travel / Overtime" subtitle="This section is temporarily hidden while Tile rendering is stabilized.">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            The Tile overhead section remains visible. The remaining Tile section will be restored once the render error is cleared.
          </p>
        </Section>
      );
    }
    return this.props.children;
  }
}

function calculateScope(inputs) {
  const fieldSquares = Math.max(0, toNumber(inputs.fieldSquares, 0));
  const roofPerimeterLf = Math.max(0, toNumber(inputs.roofPerimeterLf, 0));
  const parapetLinearFeet = Math.max(0, toNumber(inputs.parapetLinearFeet, 0));
  const parapetWallHeight = Math.max(0, toNumber(inputs.parapetWallHeight, 4));
  const includeParapetWalls = Boolean(inputs.includeParapetWalls);

  const isExistingRoof = inputs.jobType === "existingRoof";
  const isNewConstruction = inputs.jobType === "newConstruction";
  const isTearOff = isExistingRoof && inputs.existingRoofAction === "tearOff";
  const isLayover = isExistingRoof && inputs.existingRoofAction === "layover";
  const isRigidInsulation = isNewConstruction && inputs.substrateType === "rigidInsulation";
  const isDenseDeckOnly = isNewConstruction && inputs.substrateType === "denseDeckOnly";

  const tearOffLayers = Math.max(1, Math.round(toNumber(inputs.tearOffLayers, 1)));
  const isDoubleHandleTearOff = Boolean(inputs.isDoubleHandleTearOff);
  const requestedRValue = R_VALUE_OPTIONS.includes(toNumber(inputs.requestedRValue, 11))
    ? toNumber(inputs.requestedRValue, 11)
    : 11;

  const tearOffCostPerSq = isTearOff ? 85 + Math.max(tearOffLayers - 1, 0) * 25 + (isDoubleHandleTearOff ? 25 : 0) : 0;

  const parapetAverageHeight = parapetWallHeight;
  const parapetWallSqFt = includeParapetWalls ? parapetLinearFeet * parapetAverageHeight : 0;
  const parapetSquares = parapetWallSqFt / 100;
  const totalSquares = fieldSquares + parapetSquares;

  const totalTearOffCost = tearOffCostPerSq * totalSquares;

  const totalPerimeterLf = roofPerimeterLf;
  const base5ftRolls = Math.ceil((totalPerimeterLf * 2) / 100);
  const extra5ftRolls = Math.ceil(base5ftRolls * 0.15);
  const total5ftRolls = base5ftRolls + extra5ftRolls;
  const fiveFtRollCoverageSqft = total5ftRolls * 450;

  const totalRoofSqft = totalSquares * 100;
  const remainingFlatArea = Math.max(0, totalRoofSqft - fiveFtRollCoverageSqft);
  const base10ftRolls = Math.ceil(remainingFlatArea / 975);
  const extra10ftRolls = Math.ceil(base10ftRolls * 0.15);
  const total10ftFieldRolls = base10ftRolls + extra10ftRolls;

  const baseParapetRolls = Math.ceil(parapetWallSqFt / 975);
  const extraParapetRolls = Math.ceil(baseParapetRolls * 0.05);
  const totalParapetRolls = baseParapetRolls + extraParapetRolls;

  const fanfoldBundles = isLayover ? Math.ceil((fieldSquares / 2) * 1.03) : 0;

  const denseDeckSheets = isDenseDeckOnly ? Math.ceil(fieldSquares * 3.124 + 10) : 0;

  const rigidInsulationLayersNeeded = isRigidInsulation ? Math.ceil(requestedRValue / 11) : 0;
  const rigidInsulationSheetsPerSq = rigidInsulationLayersNeeded * 3;
  const rigidInsulationTotalSheets = rigidInsulationSheetsPerSq * fieldSquares;

  const parapetAdhesiveTanks = includeParapetWalls ? Math.ceil(parapetWallSqFt / 1000) : 0;

  const parnahPlates = (base5ftRolls + base10ftRolls) * 600;
  const twoInFasteners = (base5ftRolls + base10ftRolls) * 600;
  const insulationPlates = denseDeckSheets * 6;
  const insulationFasteners = denseDeckSheets * 6;

  return {
    totalSquares,
    fieldSquares,
    roofPerimeterLf,
    parapetLinearFeet,
    parapetWallHeight,
    includeParapetWalls,
    isExistingRoof,
    isNewConstruction,
    isTearOff,
    isLayover,
    isRigidInsulation,
    isDenseDeckOnly,
    tearOffLayers,
    isDoubleHandleTearOff,
    requestedRValue,
    tearOffCostPerSq,
    totalTearOffCost,
    totalPerimeterLf,
    base5ftRolls,
    extra5ftRolls,
    total5ftRolls,
    fiveFtRollCoverageSqft,
    totalRoofSqft,
    remainingFlatArea,
    base10ftRolls,
    extra10ftRolls,
    total10ftFieldRolls,
    parapetWallSqFt,
    parapetAverageHeight,
    baseParapetRolls,
    extraParapetRolls,
    totalParapetRolls,
    fanfoldBundles,
    starterBaseRolls: base5ftRolls,
    starterRolls: total5ftRolls,
    fieldRoofSqFt: totalRoofSqft,
    remainingFieldSqFt: remainingFlatArea,
    fieldBaseRolls: base10ftRolls,
    fieldRolls: total10ftFieldRolls,
    parapetBaseRolls: baseParapetRolls,
    parapetRolls: totalParapetRolls,
    denseDeckBaseSheets: Math.ceil(fieldSquares * 3.124 + 10),
    denseDeckSheets,
    rigidInsulationLayersNeeded,
    rigidInsulationSheetsPerSq,
    rigidInsulationTotalSheets,
    parapetAdhesiveTanks,
    parnahPlates,
    twoInFasteners,
    insulationPlates,
    insulationFasteners,
  };
}

function calculateTermination(inputs, prices) {
  const method = inputs.terminationMethod || "";
  const copingLinearFeet = Math.max(0, toNumber(inputs.copingLinearFeet, 0));
  const dripEdgeLinearFeet = Math.max(0, toNumber(inputs.dripEdgeLinearFeet, 0));
  const termBarLinearFeet = Math.max(0, toNumber(inputs.termBarLinearFeet, 0));
  const strippingAllowance = Math.max(0, toNumber(inputs.stripInDetailAllowanceCost, 0));
  const manualTerminationCost = Math.max(0, toNumber(inputs.manualTerminationCost, 0));
  const cleatRequired = Boolean(inputs.copingCleatRequired);

  let items = [];
  const push = (key, label, quantity, unit, unitPrice, notes = "") => {
    const amount = quantity * unitPrice;
    items.push({ key, label, quantity, unit, unitPrice, amount, notes });
  };

  // Multi-termination logic
  if (method === "multiTermination" && Array.isArray(inputs.multiTerminationRows)) {
    inputs.multiTerminationRows.forEach((row, idx) => {
      const type = row.terminationType || row.type;
      const linearFeet = Math.max(0, toNumber(row.linearFeet, 0));
      if (!type || linearFeet <= 0) return;
      if (type === "copingMetal") {
        const pieces = Math.ceil(linearFeet / 10);
        push(`copingMetal_${idx}`, "Coping metal", pieces, "piece", toNumber(prices.copingMetalCost, 0), "10 LF pieces");
        if (cleatRequired) {
          push(`copingCleat_${idx}`, "Coping cleat", pieces, "piece", toNumber(prices.copingCleatCost, 0), "10 LF pieces");
          push(`copingCleatFastener_${idx}`, "Coping cleat fasteners", 1, "allowance", toNumber(prices.copingCleatFastenerCost, 0), "Allowance");
        }
      } else if (type === "cladDripEdge") {
        const pieces = Math.ceil(linearFeet / 10);
        push(`dripEdge_${idx}`, "Clad drip edge", pieces, "piece", toNumber(prices.dripEdgeCost, 0), "10 LF pieces");
        const stripTapeRolls = Math.ceil(linearFeet / 50);
        push(`tpoStripTape_${idx}`, "TPO strip tape", stripTapeRolls, "roll", toNumber(prices.tpoStripTapeCost, 0), "50 LF rolls");
        push(`dripEdgeFastener_${idx}`, "Drip edge fasteners", 1, "allowance", toNumber(prices.dripEdgeFastenerCost, 0), "Allowance");
      } else if (type === "termBar") {
        const pieces = Math.ceil(linearFeet / 10);
        push(`termBar_${idx}`, "Term bar", pieces, "piece", toNumber(prices.termBarCost, 0), "10 LF pieces");
        push(`termBarFastener_${idx}`, "Term bar fasteners", 1, "allowance", toNumber(prices.termBarFastenerCost, 0), "Allowance");
        push(`termBarSealant_${idx}`, "Term bar sealant / waterblock", 1, "allowance", toNumber(prices.termBarSealantCost, 0), "Allowance");
      } else if (type === "existingMetal") {
        push(`stripIn_${idx}`, "Strip-in / detail allowance", 1, "allowance", strippingAllowance, "Manual allowance");
      } else if (type === "otherManual") {
        push(`manualTermination_${idx}`, "Manual termination cost", 1, "allowance", manualTerminationCost, "Manual input");
      }
    });
    return {
      items,
      totalTerminationCost: items.reduce((sum, item) => sum + item.amount, 0),
      multiTerminationRows: inputs.multiTerminationRows,
      cleatRequired,
      manualTerminationCost,
    };
  }

  // Single-method logic (unchanged)
  if (method === "copingMetal") {
    const pieces = Math.ceil(copingLinearFeet / 10);
    push("copingMetal", "Coping metal", pieces, "piece", toNumber(prices.copingMetalCost, 0), "10 LF pieces");
    if (cleatRequired) {
      push("copingCleat", "Coping cleat", pieces, "piece", toNumber(prices.copingCleatCost, 0), "10 LF pieces");
      push(
        "copingCleatFastener",
        "Coping cleat fasteners",
        1,
        "allowance",
        toNumber(prices.copingCleatFastenerCost, 0),
        "Allowance",
      );
    }
  }

  if (method === "cladDripEdge") {
    const pieces = Math.ceil(dripEdgeLinearFeet / 10);
    push("dripEdge", "Clad drip edge", pieces, "piece", toNumber(prices.dripEdgeCost, 0), "10 LF pieces");
    const stripTapeRolls = Math.ceil(dripEdgeLinearFeet / 50);
    push(
      "tpoStripTape",
      "TPO strip tape",
      stripTapeRolls,
      "roll",
      toNumber(prices.tpoStripTapeCost, 0),
      "50 LF rolls",
    );
    push("dripEdgeFastener", "Drip edge fasteners", 1, "allowance", toNumber(prices.dripEdgeFastenerCost, 0), "Allowance");
  }

  if (method === "termBar") {
    const pieces = Math.ceil(termBarLinearFeet / 10);
    push("termBar", "Term bar", pieces, "piece", toNumber(prices.termBarCost, 0), "10 LF pieces");
    push("termBarFastener", "Term bar fasteners", 1, "allowance", toNumber(prices.termBarFastenerCost, 0), "Allowance");
    push("termBarSealant", "Term bar sealant / waterblock", 1, "allowance", toNumber(prices.termBarSealantCost, 0), "Allowance");
  }

  if (method === "existingMetal") {
    push("stripIn", "Strip-in / detail allowance", 1, "allowance", strippingAllowance, "Manual allowance");
  }

  if (method === "otherManual") {
    push("manualTermination", "Manual termination cost", 1, "allowance", manualTerminationCost, "Manual input");
  }

  return {
    items,
    totalTerminationCost: items.reduce((sum, item) => sum + item.amount, 0),
    copingLinearFeet,
    dripEdgeLinearFeet,
    termBarLinearFeet,
    cleatRequired,
    manualTerminationCost,
  };
}

function calculateDetailMembrane(inputs, prices, pitchPocketDetailMembraneSqft = 0) {
  const roofJacks = Math.max(0, toNumber(inputs.roofJacks, 0));
  const ventsTtops = Math.max(0, toNumber(inputs.ventsTtops, 0));
  const largePenetrations2ft = Math.max(0, toNumber(inputs.largePenetrations2ft, 0));
  const veryLargePenetrations4ft = Math.max(0, toNumber(inputs.veryLargePenetrations4ft, 0));
  const detailDrains = Math.max(0, toNumber(inputs.detailDrains, 0));
  const detailScuppers = Math.max(0, toNumber(inputs.detailScuppers, 0));
  const detailPitchPockets = Math.max(0, toNumber(inputs.detailPitchPockets, 0));
  const detailAcUnits = Math.max(0, toNumber(inputs.detailAcUnits, 0));
  const tJointPatches = Math.max(0, toNumber(inputs.tJointPatches, 0));
  const ventBoots = Math.max(0, toNumber(inputs.ventBoots, 0));
  const acDetailType = inputs.acDetailType === "fullCurb" ? "fullCurb" : "cornersOnly";
  const miscIrregularDetails = Math.max(0, toNumber(inputs.miscIrregularDetails, 0));
  const manualDetailMembraneRolls = Math.max(0, toNumber(inputs.manualDetailMembraneRolls, 0));
  const detailMembraneRollCost = Math.max(0, toNumber(prices.detailMembraneRollCost, 0));

  const acDetailSqft = acDetailType === "cornersOnly" ? detailAcUnits * 4 * 2 : detailAcUnits * 8;
  const totalDetailMembraneSqft =
    roofJacks * 4 +
    ventsTtops * 4 +
    largePenetrations2ft * 8 +
    veryLargePenetrations4ft * 16 +
    detailDrains * 6 +
    detailScuppers * 8 +
    detailPitchPockets * 4 +
    pitchPocketDetailMembraneSqft +
    acDetailSqft +
    miscIrregularDetails * 6;

  const calculatedRolls = Math.ceil(totalDetailMembraneSqft / 127.5);
  const rollsNeeded = manualDetailMembraneRolls > 0 ? manualDetailMembraneRolls : calculatedRolls;
  const detailMembraneCost = rollsNeeded * detailMembraneRollCost;

  return {
    roofJacks,
    ventsTtops,
    largePenetrations2ft,
    veryLargePenetrations4ft,
    detailDrains,
    detailScuppers,
    detailPitchPockets,
    detailAcUnits,
    tJointPatches,
    ventBoots,
    acDetailType,
    miscIrregularDetails,
    manualDetailMembraneRolls,
    detailMembraneRollCost,
    acDetailSqft,
    totalDetailMembraneSqft,
    calculatedRolls,
    rollsNeeded,
    detailMembraneCost,
  };
}

function calculatePitchPocket(inputs, prices) {
  const pitchPocketQty = Math.max(0, toNumber(inputs.pitchPockets, 0));
  const pitchPocketUnitCost = Math.max(0, toNumber(prices.pitchPocketUnitCost, 100));
  const pourableSealantCostPerPocket = Math.max(0, toNumber(prices.pourableSealantCostPerPocket, 100));
  const laborCostPerPocket = Math.max(0, toNumber(prices.pitchPocketLaborCostPerPocket, 125));
  const manualOverrideTotalCost = Math.max(0, toNumber(inputs.manualPitchPocketTotalCost, 0));

  const pitchPocketMaterialCost = pitchPocketQty * (pitchPocketUnitCost + pourableSealantCostPerPocket);
  const pitchPocketDetailMembraneSqft = pitchPocketQty * 4;
  const pitchPocketLaborCost = pitchPocketQty * laborCostPerPocket;
  const calculatedTotalPitchPocketCost = pitchPocketMaterialCost + pitchPocketLaborCost;
  const totalPitchPocketCost = manualOverrideTotalCost > 0 ? manualOverrideTotalCost : calculatedTotalPitchPocketCost;

  return {
    pitchPocketQty,
    pitchPocketUnitCost,
    pourableSealantCostPerPocket,
    laborCostPerPocket,
    manualOverrideTotalCost,
    pitchPocketMaterialCost,
    pitchPocketDetailMembraneSqft,
    pitchPocketLaborCost,
    calculatedTotalPitchPocketCost,
    totalPitchPocketCost,
  };
}

function calculateAcHandling(inputs) {
  const totalAcUnits = Math.max(0, toNumber(inputs.totalAcUnits, 0));
  const jackedUnits = Math.max(0, toNumber(inputs.jackedUnits, 0));
  const workedAroundUnits = Math.max(0, toNumber(inputs.workedAroundUnits, 0));
  const cranedUnits = Math.max(0, toNumber(inputs.cranedUnits, 0));
  const acDisconnectReconnectUnits = Math.max(0, toNumber(inputs.acDisconnectReconnectUnits, 0));
  const isCraneNeeded = Boolean(inputs.isCraneNeeded);
  const totalCraneHours = Math.max(0, toNumber(inputs.totalCraneHours, 0));

  const countsValid = jackedUnits + workedAroundUnits + cranedUnits === totalAcUnits;
  const warning = countsValid ? "" : "A/C unit counts must equal total A/C units.";

  const acRaiseCost = jackedUnits * 100;
  const acWorkedAroundLaborCost = workedAroundUnits * 150;
  const acDisconnectReconnectCost = acDisconnectReconnectUnits * 550;
  const craneBaseCost = 1200;
  const craneBaseHoursIncluded = 2;
  const additionalCraneHourlyRate = 80;
  const extraCraneHours = isCraneNeeded ? Math.max(totalCraneHours - craneBaseHoursIncluded, 0) : 0;
  const craneCost = isCraneNeeded ? craneBaseCost + extraCraneHours * additionalCraneHourlyRate : 0;
  const totalAcHandlingCost = acRaiseCost + acWorkedAroundLaborCost + acDisconnectReconnectCost + craneCost;

  return {
    totalAcUnits,
    jackedUnits,
    workedAroundUnits,
    cranedUnits,
    acDisconnectReconnectUnits,
    isCraneNeeded,
    totalCraneHours,
    acRaiseCost,
    acWorkedAroundLaborCost,
    acDisconnectReconnectCost,
    craneBaseCost,
    craneBaseHoursIncluded,
    additionalCraneHourlyRate,
    extraCraneHours,
    craneCost,
    totalAcHandlingCost,
    countsValid,
    warning,
  };
}

function calculateLabor(inputs) {
  const totalSquares = Math.max(0, toNumber(inputs.totalSquares, 0));
  const laborType = inputs.laborType === "subcontractor" ? "subcontractor" : inputs.laborType === "inHouse" ? "inHouse" : "";
  const subcontractorLicenseStatus =
    inputs.subcontractorLicenseStatus === "licensed"
      ? "licensed"
      : inputs.subcontractorLicenseStatus === "unlicensed"
      ? "unlicensed"
      : "";
  const subcontractorLaborRatePerSq = Math.max(0, toNumber(inputs.subcontractorLaborRatePerSq, 0));
  const subcontractorHasAddOns = Boolean(inputs.subcontractorHasAddOns);
  const subcontractorAddOnItems = normalizeSubcontractorAddOnItems(inputs.subcontractorAddOnItems);
  const workers = Math.max(0, Math.round(toNumber(inputs.laborWorkers, 0)));
  const hourlyRate = Math.max(0, toNumber(inputs.laborHourlyRate, 0));
  const hoursPerWorker = Math.max(0, toNumber(inputs.laborHoursPerWorker, 0));
  const laborEmployeeRows = normalizeEstimateLaborEmployeeRows(inputs.laborEmployeeRows);
  const payrollBurdenPercent = TOTAL_LABOR_BURDEN_RATE * 100;

  if (laborType === "subcontractor") {
    const subLaborBase = totalSquares * subcontractorLaborRatePerSq;
    const workersCompRate = subcontractorLicenseStatus === "unlicensed" ? 0.198 : 0;
    const workersCompCost = subLaborBase * workersCompRate;
    const subcontractorAddOnTotal = subcontractorHasAddOns
      ? subcontractorAddOnItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      : 0;
    const totalLaborCost = subLaborBase + workersCompCost + subcontractorAddOnTotal;

    return {
      laborType,
      subcontractorLicenseStatus,
      subcontractorLaborRatePerSq,
      subcontractorHasAddOns,
      subcontractorAddOnItems,
      workers,
      hourlyRate,
      hoursPerWorker,
      payrollBurdenPercent,
      subLaborBase,
      workersCompRate,
      workersCompCost,
      subcontractorAddOnTotal,
      basePayroll: 0,
      payrollBurden: 0,
      totalLaborCost,
    };
  }

  const loadedLabor = calculateInHouseLaborBurden({
    employeeRows: laborEmployeeRows,
    workers,
    hourlyRate,
    hoursPerWorker,
  });

  return {
    laborType,
    subcontractorLicenseStatus,
    subcontractorLaborRatePerSq: 0,
    subcontractorHasAddOns: false,
    subcontractorAddOnItems: normalizeSubcontractorAddOnItems([]),
    workers: loadedLabor.workers,
    hourlyRate,
    hoursPerWorker,
    payrollBurdenPercent,
    employeeRows: loadedLabor.employeeRows,
    usesEmployeeWages: loadedLabor.usesEmployeeWages,
    subLaborBase: 0,
    workersCompRate: loadedLabor.workersCompRate,
    workersCompCost: loadedLabor.workersCompCost,
    payrollTaxRate: loadedLabor.payrollTaxRate,
    payrollTaxCost: loadedLabor.payrollTaxCost,
    subcontractorAddOnTotal: 0,
    basePayroll: loadedLabor.basePayroll,
    payrollBurden: loadedLabor.payrollBurden,
    totalLaborCost: loadedLabor.totalLaborCost,
  };
}

function calculateMaterialPricing(inputs, prices, scope, termination, pitchPocket, detailMembrane, acHandling) {
  const items = [];

  const add = (key, label, quantity, unit, unitPrice, notes = "") => {
    const amount = quantity * unitPrice;
    items.push({ key, label, quantity, unit, unitPrice, amount, notes });
  };

  add("starterRoll", "5ft TPO perimeter rolls", scope.total5ftRolls, "roll", toNumber(prices.starterRollCost, 0), "Starter rolls");
  add("fieldRoll", "10ft field rolls", scope.total10ftFieldRolls, "roll", toNumber(prices.fieldRollCost, 0), "Field rolls");
  add("parapetRoll", "Parapet rolls", scope.totalParapetRolls, "roll", toNumber(prices.parapetRollCost, 0), "Parapet walls");
  add("fanfold", "Fanfold bundles", scope.fanfoldBundles, "bundle", toNumber(prices.fanfoldBundleCost, 0), "Layover only");
  add("denseDeck", "Dense deck sheets", scope.denseDeckSheets, "sheet", toNumber(prices.denseDeckSheetCost, 0), "Dense deck only");
  add(
    "rigidInsulation",
    "Rigid insulation sheets",
    scope.rigidInsulationTotalSheets,
    "sheet",
    toNumber(prices.rigidInsulationSheetCost, 31.95),
    "Rigid insulation only",
  );
  add(
    "parapetAdhesive",
    "Parapet adhesive tanks",
    scope.parapetAdhesiveTanks,
    "tank",
    toNumber(prices.parapetAdhesiveTankCost, 0),
    "1 tank / 1000 sqft",
  );
  add("parnahPlates", "Paranah plates", scope.parnahPlates, "plate", toNumber(prices.parnahPlateCost, 0), "Field rolls before waste");
  add("twoInFasteners", "2 inch fasteners", scope.twoInFasteners, "fastener", toNumber(prices.twoInFastenerCost, 0), "Field rolls before waste");
  add(
    "insulationPlates",
    "Insulation plates",
    scope.insulationPlates,
    "plate",
    toNumber(prices.insulationPlateCost, 0),
    "Dense deck based",
  );
  add(
    "insulationFasteners",
    "Insulation fasteners",
    scope.insulationFasteners,
    "fastener",
    toNumber(prices.insulationFastenerCost, 0),
    "Dense deck based",
  );

  termination.items.forEach((item) => {
    items.push(item);
  });

  add(
    "detailMembrane",
    "Detail membrane rolls",
    detailMembrane.rollsNeeded,
    "roll",
    toNumber(prices.detailMembraneRollCost, 0),
    "18in x 100ft roll",
  );
  add("tJointPatch", "T-joint patches", detailMembrane.tJointPatches, "patch", toNumber(prices.tJointPatchCost, 0), "Detail material");
  add("ventBoot", "Vent boots", detailMembrane.ventBoots, "boot", toNumber(prices.ventBootCost, 0), "Detail material");

  items.push({
    key: "pitchPocket",
    label: "Pitch pockets",
    quantity: pitchPocket.pitchPocketQty,
    unit: "pocket",
    unitPrice: pitchPocket.pitchPocketQty > 0 ? pitchPocket.totalPitchPocketCost / pitchPocket.pitchPocketQty : 0,
    amount: pitchPocket.totalPitchPocketCost,
    notes: "Material + sealant + labor",
  });

  items.push({
    key: "acHandling",
    label: "A/C handling",
    quantity: acHandling.totalAcUnits,
    unit: "unit",
    unitPrice: acHandling.totalAcUnits > 0 ? acHandling.totalAcHandlingCost / acHandling.totalAcUnits : 0,
    amount: acHandling.totalAcHandlingCost,
    notes: acHandling.warning || "Jacked, worked around, craned, disconnect/reconnect",
  });

  const totalMaterialCost = items.reduce((sum, item) => sum + item.amount, 0);
  const costPerSquare = scope.totalSquares > 0 ? totalMaterialCost / scope.totalSquares : 0;

  return {
    items,
    totalMaterialCost,
    costPerSquare,
  };
}

// Include custom materials stored in inputs.customMaterials
function mergeCustomMaterialsIntoPricing(inputs, pricing, scope) {
  const custom = Array.isArray(inputs.customMaterials) ? inputs.customMaterials : [];
  if (!custom.length) return pricing;
  const items = [...pricing.items];
  custom.forEach((mat, idx) => {
    const quantity = toNumber(mat.quantity, 0);
    const unitPrice = toNumber(mat.unitPrice, 0);
    const amount = quantity * unitPrice;
    items.push({
      key: `custom-${idx}`,
      label: mat.name || "Custom material",
      quantity,
      unit: mat.unit || "ea",
      unitPrice,
      amount,
      notes: "Custom material",
    });
  });
  const totalMaterialCost = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const costPerSquare = scope && scope.totalSquares > 0 ? totalMaterialCost / scope.totalSquares : pricing.costPerSquare || 0;
  return { items, totalMaterialCost, costPerSquare };
}

function calculateBidOptions(totalCostBeforeProfit, totalSquares, selectedMarkupPercent) {
  const options = MARKUP_OPTIONS.map((percent) => {
    const markup = percent / 100;
    const bidAmount = totalCostBeforeProfit * (1 + markup);
    const pricePerSq = totalSquares > 0 ? bidAmount / totalSquares : 0;
    const profitDollars = bidAmount - totalCostBeforeProfit;
    return { percent, bidAmount, pricePerSq, profitDollars };
  });

  const selected = options.find((item) => item.percent === selectedMarkupPercent) || options[0];

  return {
    options,
    selectedMarkupPercent: selected.percent,
    selectedBidAmount: selected.bidAmount,
    selectedPricePerSq: selected.pricePerSq,
    selectedProfitDollars: selected.profitDollars,
  };
}

async function generateEstimatePDF(inputs, calculation, fieldNotes, estimateName, estimateType = "TPO", previewWindow = null) {
  try {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Page setup
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPosition = margin;
    const totalSquaresForPdf =
      calculation?.scope?.totalSquares ??
      calculation?.totalSquares ??
      calculation?.tileTotalRoofSquares ??
      calculation?.tileAdjustedRoofSquares ??
      calculation?.productionSquares ??
      calculation?.totalRoofSquares ??
      0;

    // Helper function to check if we need a new page
    const checkNewPage = (heightNeeded) => {
      if (yPosition + heightNeeded > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Helper function to add text
    const addText = (text, x, y, options = {}) => {
      doc.setFontSize(options.size || 12);
      doc.setFont(undefined, options.weight || "normal");
      doc.text(text, x, y, options);
      return y;
    };

    // Add Header with CRT Roofing branding
    doc.setFillColor(10, 21, 29);
    doc.rect(0, 0, pageWidth, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, "bold");
    doc.text("CRT ROOFING", margin, 12);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text("Estimate Report", margin, 18);

    doc.setTextColor(0, 0, 0);
    yPosition = 32;

    // Job Information Section
    checkNewPage(30);
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    addText("JOB INFORMATION", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    const jobInfo = [
      ["Job Name:", calculation.jobName || inputs.jobName || "N/A"],
      ["Customer Name:", calculation.customerName || inputs.customerName || "N/A"],
      ["Job Address:", calculation.jobAddress || inputs.jobAddress || "N/A"],
      ["Estimate Type:", estimateType || "TPO"],
      ["Date:", new Date().toLocaleDateString()],
    ];

    jobInfo.forEach(([label, value]) => {
      checkNewPage(5);
      doc.setFont(undefined, "bold");
      doc.text(label, margin, yPosition);
      doc.setFont(undefined, "normal");
      doc.text(value, margin + 50, yPosition);
      yPosition += 6;
    });

    if (["Coating", "Repair / Service", "Maintenance"].includes(estimateType)) {
      const lines = doc.splitTextToSize(String(inputs.serviceScope || inputs.maintenanceNotes || ""), pageWidth - margin * 2);
      for (const line of lines) { checkNewPage(6); doc.text(line, margin, yPosition); yPosition += 6; }
      for (const row of calculation.materialRows || []) {
        const details = doc.splitTextToSize(`${row.description}: ${row.quantity} ${row.unit || "units"} x $${num(row.unitCost, 2)} = $${num(row.total, 2)}`, pageWidth - margin * 2);
        for (const line of details) { checkNewPage(6); doc.text(line, margin, yPosition); yPosition += 6; }
      }
    }

    // Estimate Summary Section
    yPosition += 4;
    checkNewPage(25);
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    addText("ESTIMATE SUMMARY", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    const summaryInfo = [
      ["Total Squares:", `${num(totalSquaresForPdf, 0)} SQ`],
      ["Selected Bid Amount:", `$${num(calculation.selectedBidAmount, 2)}`],
      ["Markup Percentage:", `${num(calculation.selectedMarkupPercent, 0)}%`],
      ["Price Per Square:", `$${num(calculation.selectedPricePerSq, 2)}`],
    ];

    summaryInfo.forEach(([label, value]) => {
      checkNewPage(5);
      doc.setFont(undefined, "bold");
      doc.text(label, margin, yPosition);
      doc.setFont(undefined, "normal");
      doc.text(value, margin + 50, yPosition);
      yPosition += 6;
    });

    if (estimateType === "Spray Foam") {
      yPosition += 4;
      checkNewPage(25);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      addText("SPRAY FOAM FIELD SUMMARY", margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      const sprayFoamFieldSummary = [
        ["Field Squares:", `${num(calculation.fieldSquares ?? calculation.totalFieldSquares ?? calculation.fieldRoofSquares, 2)} SQ`],
        ["Parapet Wall Squares:", `${num(calculation.parapetWallSquares ?? calculation.totalParapetWallSquares ?? calculation.totalParapetSquares, 2)} SQ`],
        ["Total Roof Squares:", `${num(calculation.totalRoofSquares, 2)} SQ`],
        ["SPF Material Used:", `${num(calculation.totalFoamKits ?? calculation.foamKitsNeeded, calculation?.isWallFoamEstimate ? 0 : 3)}`],
        ["SPF Usage Cost:", `$${num(calculation.totalFoamCost ?? calculation.foamMaterialCost, 2)}`],
        ["Estimated Days:", `${num(calculation.estimatedCompletionDays, 0)}`],
        ["Laborers / Day:", `${num(calculation.laborersNeededPerDay, 0)}`],
        ["Total Laborers:", `${num(calculation.totalLaborers, 0)}`],
      ];
      sprayFoamFieldSummary.forEach(([label, value]) => {
        checkNewPage(5);
        doc.setFont(undefined, "bold");
        doc.text(label, margin, yPosition);
        doc.setFont(undefined, "normal");
        doc.text(value, margin + 54, yPosition);
        yPosition += 6;
      });

      if (calculation.separateRoofAreas && calculation.roofAreas?.length) {
        yPosition += 4;
        checkNewPage(22);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        addText("ROOF AREAS", margin, yPosition);
        yPosition += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Area", margin, yPosition);
        doc.text("Field SQ", margin + 48, yPosition);
        doc.text("Parapet SQ", margin + 82, yPosition);
        doc.text("Total SQ", margin + 123, yPosition);
        doc.text("Yield/Kit", margin + 154, yPosition);
        doc.text("SPF used", margin + 186, yPosition);
        yPosition += 5;
        doc.setFont(undefined, "normal");
        calculation.roofAreas.forEach((row) => {
          checkNewPage(5);
          doc.text(String(row.label || "Roof area"), margin, yPosition);
          doc.text(`${num(row.fieldRoofSquares || 0, 2)}`, margin + 48, yPosition);
          doc.text(`${num(row.parapetWallSquares || 0, 2)}`, margin + 82, yPosition);
          doc.text(`${num(row.totalAreaSquares || 0, 2)}`, margin + 123, yPosition);
          doc.text(`${num(row.yieldPerKit || 0, 2)}`, margin + 154, yPosition);
          doc.text(`${num(row.kitsNeeded || 0, 3)}`, margin + 186, yPosition);
          yPosition += 5;
        });
      }

      if (calculation.coatingItems?.length) {
        yPosition += 4;
        checkNewPage(22);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        addText("COATING BREAKDOWN", margin, yPosition);
        yPosition += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Layer", margin, yPosition);
        doc.text("Squares", margin + 38, yPosition);
        doc.text("Coverage", margin + 72, yPosition);
        doc.text("Drums", margin + 118, yPosition);
        doc.text("Unit", margin + 143, yPosition);
        doc.text("Total", margin + 177, yPosition);
        yPosition += 5;
        doc.setFont(undefined, "normal");
        calculation.coatingItems.forEach((item) => {
          checkNewPage(5);
          doc.text(String(item.label || ""), margin, yPosition);
          doc.text(`${num(item.squaresNeeded || 0, 0)} SQ`, margin + 38, yPosition);
          doc.text(`${num(item.coverageRate || 0, 2)} SQ/Drum`, margin + 72, yPosition);
          doc.text(`${num(item.drumsNeeded || 0, 0)}`, margin + 118, yPosition);
          doc.text(`$${num(item.unitPrice || 0, 2)}`, margin + 143, yPosition);
          doc.text(`$${num(item.amount || 0, 2)}`, margin + 177, yPosition);
          yPosition += 5;
  });
}

function calculateSprayFoamRoofAreaTotals(items = [], setCost = DEFAULT_SPF_RATES.foamKitCost, yieldPerInch = 26) {
  const rows = normalizeSprayFoamRoofAreas(items);
  const rowsWithTotals = rows.map((row) => {
    const parapetWallSquares = row.hasParapetWalls ? row.parapetWallSquares : 0;
    const totalAreaSquares = row.fieldRoofSquares + parapetWallSquares;
    const usage = calculateSprayFoamUsage(totalAreaSquares, row.foamThicknessInches, yieldPerInch);
    const { yieldPerKit, kitsNeeded } = usage;
    return {
      ...row,
      parapetWallSquares,
      totalAreaSquares,
      yieldPerKit,
      kitsNeeded,
      foamCost: kitsNeeded * setCost,
    };
  });
  const totalFieldSquares = rowsWithTotals.reduce((sum, row) => sum + row.fieldRoofSquares, 0);
  const totalParapetWallSquares = rowsWithTotals.reduce((sum, row) => sum + row.parapetWallSquares, 0);
  const totalRoofSquares = totalFieldSquares + totalParapetWallSquares;
  const totalFoamKits = rowsWithTotals.reduce((sum, row) => sum + row.kitsNeeded, 0);
  const totalFoamCost = totalFoamKits * setCost;
  return {
    rows: rowsWithTotals,
    totalFieldSquares,
    totalParapetWallSquares,
    totalRoofSquares,
    totalFoamKits,
    totalFoamCost,
  };
}

      if (calculation.sprayFoamMaterialItems?.length) {
        yPosition += 4;
        checkNewPage(22);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        addText("SPF MATERIAL BREAKDOWN", margin, yPosition);
        yPosition += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Item", margin, yPosition);
        doc.text("Qty", margin + 84, yPosition);
        doc.text("Unit", margin + 118, yPosition);
        doc.text("Total", margin + 154, yPosition);
        yPosition += 5;
        doc.setFont(undefined, "normal");
        calculation.sprayFoamMaterialItems.forEach((item) => {
          checkNewPage(5);
          doc.text(String(item.label || ""), margin, yPosition);
          doc.text(`${num(item.quantity || 0, 2)}`, margin + 84, yPosition);
          doc.text(`$${num(item.unitPrice || 0, 2)}`, margin + 118, yPosition);
          doc.text(`$${num(item.amount || 0, 2)}`, margin + 154, yPosition);
          yPosition += 5;
        });
      }

      if (calculation.detailMaterialItems?.length) {
        yPosition += 4;
        checkNewPage(22);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        addText("DETAIL MATERIALS", margin, yPosition);
        yPosition += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Item", margin, yPosition);
        doc.text("Qty", margin + 84, yPosition);
        doc.text("Unit", margin + 118, yPosition);
        doc.text("Total", margin + 154, yPosition);
        yPosition += 5;
        doc.setFont(undefined, "normal");
        calculation.detailMaterialItems.forEach((item) => {
          checkNewPage(5);
          doc.text(String(item.label || ""), margin, yPosition);
          doc.text(`${num(item.quantity || 0, 2)}`, margin + 84, yPosition);
          doc.text(`$${num(item.unitCost || 0, 2)}`, margin + 118, yPosition);
          doc.text(`$${num(item.amount || 0, 2)}`, margin + 154, yPosition);
          yPosition += 5;
        });
      }

    }

    if (estimateType === "Shingle") {
      yPosition += 4;
      checkNewPage(25);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      addText("SHINGLE MEASUREMENT SUMMARY", margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      const shingleFieldSummary = [
        ["Total Roof Squares:", `${num(calculation.totalRoofSquares, 2)} SQ`],
        ["Waste %:", `${num(calculation.wastePercent, 0)}%`],
        ["Production Squares:", `${num(calculation.productionSquares, 2)} SQ`],
        ["Total HDZ RS+ Bundles Needed:", `${num(calculation.shingleHdzBundlesNeeded, 0)}`],
        ["Pro-Start Starter:", `${num(calculation.shingleStarterQuantity, 0)}`],
        ['2"x2" Drip Edge 10 ft Pieces:', `${num(calculation.shingleDripEdgePieces, 0)}`],
        ['Rapid Ridge 8" Ridge Cap:', `${num(calculation.shingleRapidRidgeBoxes, 0)}`],
        ["Ridge/Hip LF used:", `${num(calculation.shingleRapidRidgeLFUsed, 1)} LF`],
        ["Suggested GAF Quantity:", `${num(calculation.shingleSyntheticUnderlaymentSuggestedRolls, 0)}`],
        ["Calculated Fallback Quantity:", `${num(calculation.shingleSyntheticUnderlaymentCalculatedRolls, 0)}`],
        ["Final Underlayment Rolls Used:", `${num(calculation.shingleSyntheticUnderlaymentRolls, 0)}`],
        ["Ridge LF:", `${num(calculation.ridgeLf, 1)}`],
        ["Hip LF:", `${num(calculation.hipLf, 1)}`],
        ["Valley LF:", `${num(calculation.valleyLf, 1)}`],
        ["Rake LF:", `${num(calculation.rakeLf, 1)}`],
        ["Eave LF:", `${num(calculation.eaveLf, 1)}`],
        ["Starter LF:", `${num(calculation.starterLf, 1)}`],
        ["Drip Edge LF:", `${num(calculation.dripEdgeLf, 1)}`],
      ];
      shingleFieldSummary.forEach(([label, value]) => {
        checkNewPage(5);
        doc.setFont(undefined, "bold");
        doc.text(label, margin, yPosition);
        doc.setFont(undefined, "normal");
        doc.text(value, margin + 54, yPosition);
        yPosition += 6;
      });

      if (calculation.shingleTearOffSections?.length) {
        yPosition += 2;
        checkNewPage(14);
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.text("TEAR-OFF SECTIONS", margin, yPosition);
        yPosition += 6;
        doc.setFont(undefined, "normal");
        calculation.shingleTearOffSections.forEach((section, index) => {
          checkNewPage(6);
          const label = section.label || `Section ${index + 1}`;
          doc.text(`${label}:`, margin, yPosition);
          doc.text(
            `${num(section.squares || 0, 1)} SQ x ${num(section.layers || 0, 0)} layers = $${num(section.sectionTearOffTotal || 0, 2)}`,
            margin + 48,
            yPosition,
          );
          yPosition += 5;
        });
        yPosition += 1;
      }

      if (calculation.materialItems?.length) {
        yPosition += 4;
        checkNewPage(22);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        addText("SHINGLE MATERIAL BREAKDOWN", margin, yPosition);
        yPosition += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text("Item", margin, yPosition);
        doc.text("Qty", margin + 84, yPosition);
        doc.text("Unit", margin + 118, yPosition);
        doc.text("Total", margin + 154, yPosition);
        yPosition += 5;
        doc.setFont(undefined, "normal");
        calculation.materialItems.forEach((item) => {
          checkNewPage(5);
          doc.text(String(item.label || ""), margin, yPosition);
          doc.text(`${num(item.quantity || 0, 2)}`, margin + 84, yPosition);
          doc.text(`${item.unit || ""}`, margin + 118, yPosition);
          doc.text(`$${num(item.amount || 0, 2)}`, margin + 154, yPosition);
          yPosition += 5;
        });
      }

      yPosition += 4;
      checkNewPage(20);
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      addText("SHINGLE LABOR / DISPOSAL / TRAVEL", margin, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      const shingleCostRows = [
        ["Subcontractor cost:", `$${num(calculation.shingleSubcontractorCost, 2)}`],
        ["Labor cost:", `$${num(calculation.laborCost, 2)}`],
        ["Travel & overtime:", `$${num(calculation.totalTravelCost, 2)}`],
        ["City permit fee:", `$${num(calculation.cityPermitFee, 2)}`],
        ["Total job cost:", `$${num(calculation.totalJobCost, 2)}`],
      ];
      shingleCostRows.forEach(([label, value]) => {
        checkNewPage(5);
        doc.setFont(undefined, "bold");
        doc.text(label, margin, yPosition);
        doc.setFont(undefined, "normal");
        doc.text(value, margin + 55, yPosition);
        yPosition += 6;
      });
    }

    if (estimateType === "Spray Foam") {
      yPosition += 4;
      checkNewPage(20);
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      addText("LABOR / TRAVEL / OVERTIME", margin, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      const sprayFoamCostRows = [
        ["Estimated labor cost:", `$${num(calculation.estimatedLaborCost, 2)}`],
        ...(calculation.prevailingWageJob
          ? [["Prevailing wage labor:", `$${num(calculation.prevailingWageLaborCost, 2)}`]]
          : []),
        ["Subcontractor cost:", `$${num(calculation.subcontractorCost, 2)}`],
        ["Travel & overtime:", `$${num(calculation.totalTravelCost, 2)}`],
        ...(calculation.lodgingNeeded
          ? [["Lodging total:", `$${num(calculation.lodgingTotal, 2)}`]]
          : []),
        ["Total job cost:", `$${num(calculation.totalJobCost, 2)}`],
      ];
      sprayFoamCostRows.forEach(([label, value]) => {
        checkNewPage(5);
        doc.setFont(undefined, "bold");
        doc.text(label, margin, yPosition);
        doc.setFont(undefined, "normal");
        doc.text(value, margin + 55, yPosition);
        yPosition += 6;
      });
    }

    // Cost Breakdown Section
    yPosition += 4;
    checkNewPage(25);
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    addText("COST BREAKDOWN", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    const costBreakdown = [
      ["Foam Cost:", `$${num(calculation.foamMaterialCost, 2)}`],
      ["Material Cost:", `$${num(calculation.materialCost, 2)}`],
      ["Detail Material Cost:", `$${num(calculation.totalDetailMaterialCost, 2)}`],
      ["Labor Cost:", `$${num(calculation.laborCost, 2)}`],
      ["Travel & Overtime Cost:", `$${num(calculation.totalTravelCost, 2)}`],
      ["Overhead / Operating Cost:", `$${num(calculation.overheadOperatingCost, 2)}`],
      ["Total Cost Before Profit:", `$${num(calculation.totalCostBeforeProfit, 2)}`],
    ];

    costBreakdown.forEach(([label, value]) => {
      checkNewPage(5);
      doc.setFont(undefined, "bold");
      doc.text(label, margin, yPosition);
      doc.setFont(undefined, "normal");
      doc.text(value, margin + 50, yPosition);
      yPosition += 6;
    });

    if (calculation.bidOptions?.options?.length) {
      yPosition += 4;
      checkNewPage(20);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      addText("MARKUP TABLE", margin, yPosition);
      yPosition += 8;

      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      doc.text("Markup %", margin, yPosition);
      doc.text("Bid Amount", margin + 40, yPosition);
      doc.text("Profit", margin + 90, yPosition);
      doc.text("Price/SQ", margin + 130, yPosition);
      yPosition += 5;
      doc.setFont(undefined, "normal");
      calculation.bidOptions.options.forEach((option) => {
        checkNewPage(5);
        const selected = option.percent === calculation.selectedMarkupPercent;
        if (selected) {
          doc.setFont(undefined, "bold");
        }
        doc.text(`${option.percent}%${selected ? " *" : ""}`, margin, yPosition);
        doc.text(`$${num(option.bidAmount, 2)}`, margin + 40, yPosition);
        doc.text(`$${num(option.profitDollars, 2)}`, margin + 90, yPosition);
        doc.text(`$${num(option.pricePerSq, 2)}`, margin + 130, yPosition);
        yPosition += 5;
        if (selected) {
          doc.setFont(undefined, "normal");
        }
      });

      yPosition += 4;
      checkNewPage(12);
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      addText("SELECTED BID", margin, yPosition);
      yPosition += 7;
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      const selectedBidInfo = [
        ["Selected Markup:", calculation.customBidSelected ? "Custom Bid" : `${num(calculation.selectedMarkupPercent, 0)}%`],
        ["Selected Bid:", `$${num(calculation.selectedBidAmount, 2)}`],
        ["Selected Profit:", `$${num(calculation.selectedProfitDollars, 2)}`],
        ["Selected Price / SQ:", `$${num(calculation.selectedPricePerSq, 2)}`],
      ];
      selectedBidInfo.forEach(([label, value]) => {
        checkNewPage(5);
        doc.setFont(undefined, "bold");
        doc.text(label, margin, yPosition);
        doc.setFont(undefined, "normal");
        doc.text(value, margin + 55, yPosition);
        yPosition += 6;
      });

      if (calculation.customTotalCharge > 0) {
        yPosition += 2;
        checkNewPage(18);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        addText("CUSTOM BID SUMMARY", margin, yPosition);
        yPosition += 7;
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        const customBidInfo = [
          ["Custom Bid Amount:", `$${num(calculation.customTotalCharge, 2)}`],
          ["Custom Profit:", `$${num(calculation.customProfitDollars, 2)}`],
          ["Custom Price / SQ:", `$${num(calculation.customPricePerSq, 2)}`],
          ["Custom Margin:", `${num(calculation.customProfitMarginPercent, 1)}%`],
        ];
        customBidInfo.forEach(([label, value]) => {
          checkNewPage(5);
          doc.setFont(undefined, "bold");
          doc.text(label, margin, yPosition);
          doc.setFont(undefined, "normal");
          doc.text(value, margin + 55, yPosition);
          yPosition += 6;
        });
      }
    }

    // Material Cost Details
    if (calculation.materialPricing && calculation.materialPricing.items && calculation.materialPricing.items.length > 0) {
      yPosition += 4;
      checkNewPage(10);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      addText("MATERIAL COST DETAILS", margin, yPosition);
      yPosition += 7;

      doc.setFontSize(9);
      doc.setFont(undefined, "normal");

      calculation.materialPricing.items.forEach((item) => {
        checkNewPage(4);
        const qty = num(item.quantity, 0);
        const unitPrice = num(item.unitPrice, 2);
        const total = num(item.amount, 2);
        const lineText = `${item.label} - Qty: ${qty} @ $${unitPrice} = $${total}`;
        doc.text(lineText, margin, yPosition);
        yPosition += 4;
      });
    }

    // Field Notes / Inspection Notes Section
    if (fieldNotes && (fieldNotes.jobName || fieldNotes.roofConditionNotes || fieldNotes.internalNotes)) {
      yPosition += 4;
      checkNewPage(15);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      addText("FIELD NOTES / INSPECTION NOTES", margin, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");

      if (fieldNotes.roofConditionNotes) {
        doc.setFont(undefined, "bold");
        doc.text("Roof Condition:", margin, yPosition);
        yPosition += 4;
        doc.setFont(undefined, "normal");
        const conditionText = doc.splitTextToSize(fieldNotes.roofConditionNotes, pageWidth - 2 * margin);
        doc.text(conditionText, margin, yPosition);
        yPosition += conditionText.length * 4 + 2;
      }

      if (fieldNotes.internalNotes) {
        checkNewPage(5);
        doc.setFont(undefined, "bold");
        doc.text("Internal Notes:", margin, yPosition);
        yPosition += 4;
        doc.setFont(undefined, "normal");
        const notesText = doc.splitTextToSize(fieldNotes.internalNotes, pageWidth - 2 * margin);
        doc.text(notesText, margin, yPosition);
        yPosition += notesText.length * 4 + 2;
      }
    }

    // Photos Section
    if (fieldNotes && fieldNotes.photos && fieldNotes.photos.length > 0) {
      yPosition += 4;
      checkNewPage(10);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      addText("PHOTOS", margin, yPosition);
      yPosition += 7;

      const photosPerPage = 3;
      const photoWidth = pageWidth - 2 * margin;
      const photoHeight = 45;

      for (let i = 0; i < fieldNotes.photos.length; i++) {
        if (i % photosPerPage === 0 && i > 0) {
          doc.addPage();
          yPosition = margin;
          doc.setFontSize(12);
          doc.setFont(undefined, "bold");
          addText("PHOTOS (continued)", margin, yPosition);
          yPosition += 7;
        }

        checkNewPage(photoHeight + 10);

        try {
          const photoData = fieldNotes.photos[i];
          if (typeof photoData === "string" && photoData.startsWith("data:image")) {
            doc.addImage(photoData, "JPEG", margin, yPosition, photoWidth, photoHeight);
            yPosition += photoHeight + 4;
          }
        } catch (error) {
          console.error("Error adding photo to PDF:", error);
          yPosition += 4;
        }
      }
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }

    // Generate filename
    const safeEstimateName = String(estimateName || "");
    const fileName = `${safeEstimateName.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "estimate"}_${Date.now()}.pdf`;

    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);
    const triggerDownload = () => {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    };

    try {
      if (typeof window.showSaveFilePicker === "function") {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "PDF document",
              accept: { "application/pdf": [".pdf"] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        URL.revokeObjectURL(blobUrl);
        return true;
      }
    } catch (saveError) {
      console.warn("PDF file picker save failed, falling back:", saveError);
    }

    let previewOpened = false;
    if (previewWindow && !previewWindow.closed) {
      try {
        previewWindow.location.href = blobUrl;
        previewOpened = true;
      } catch (previewError) {
        console.warn("PDF preview window update failed:", previewError);
      }
    }

    if (!previewOpened) {
      try {
        triggerDownload();
      } catch (downloadError) {
        console.warn("Primary PDF download path failed, trying direct window open:", downloadError);
        const fallbackWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (!fallbackWindow) {
          throw downloadError;
        }
      }
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return true;
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert(`Failed to generate PDF: ${error?.message || error}`);
    return false;
  }
}

function buildMissingScopeChecklist(inputs, prices, calculation) {
  const checklist = [];
  const addItem = (label, detail) => checklist.push({ label, detail });
  const totalSquares = calculation?.scope?.totalSquares ?? calculation?.totalSquares ?? 0;

  if (totalSquares <= 0) {
    addItem("Total squares", "Enter the roof size before pricing the bid.");
  }

  const zeroPriceLabels = MATERIAL_PRICE_FIELDS.filter(([key]) => toNumber(prices[key], 0) <= 0).map(([, label]) => label);
  if (zeroPriceLabels.length) {
    const preview = zeroPriceLabels.slice(0, 4).join(", ");
    const suffix = zeroPriceLabels.length > 4 ? `, and ${zeroPriceLabels.length - 4} more` : "";
    addItem("Material prices", `Set editable prices for: ${preview}${suffix}.`);
  }

  if (inputs.laborType === "subcontractor") {
    if (calculation.labor.subcontractorLaborRatePerSq <= 0) {
      addItem("Labor rate", "Enter the subcontractor rate per SQ.");
    }
  } else if (inputs.laborType === "inHouse") {
    if (
      calculation.labor.workers <= 0 ||
      calculation.labor.hourlyRate <= 0 ||
      calculation.labor.hoursPerWorker <= 0
    ) {
      addItem("Labor rate", "Enter crew count, hourly rate, and hours per worker.");
    }
  } else {
    addItem("Labor rate", "Choose in-house or subcontractor labor and enter the rate.");
  }

  const terminationMethod = inputs.terminationMethod || "";
  if (!terminationMethod) {
    addItem("Termination linear feet", "Choose a termination method and enter the related linear feet.");
  } else if (terminationMethod === "multiTermination") {
    const validRows = (inputs.multiTerminationRows || []).filter(row => row.type && Number(row.linearFeet) > 0);
    if (validRows.length === 0) {
      addItem("Termination linear feet", "Add at least one termination type and linear feet.");
    }
  } else if (terminationMethod === "copingMetal" && calculation.termination.copingLinearFeet <= 0) {
    addItem("Termination linear feet", "Enter coping linear feet.");
  } else if (terminationMethod === "cladDripEdge" && calculation.termination.dripEdgeLinearFeet <= 0) {
    addItem("Termination linear feet", "Enter drip edge linear feet.");
  } else if (terminationMethod === "termBar" && calculation.termination.termBarLinearFeet <= 0) {
    addItem("Termination linear feet", "Enter term bar linear feet.");
  }

  if (inputs.includeParapetWalls && (calculation.scope.parapetLinearFeet <= 0 || calculation.scope.parapetWallHeight <= 0)) {
    addItem("Parapet LF / height", "Enter parapet linear feet and wall height.");
  }

  if (calculation.acHandling.totalAcUnits <= 0 || !calculation.acHandling.countsValid) {
    addItem("A/C handling counts", "Enter total A/C units and make sure the breakdown matches.");
  }

  const detailCount =
    calculation.detailMembrane.roofJacks +
    calculation.detailMembrane.ventsTtops +
    calculation.detailMembrane.largePenetrations2ft +
    calculation.detailMembrane.veryLargePenetrations4ft +
    calculation.detailMembrane.detailDrains +
    calculation.detailMembrane.detailScuppers;

  if (detailCount <= 0) {
    addItem("Drains / scuppers / penetrations", "Enter drains, scuppers, roof jacks, vents, or penetration counts.");
  }

  if (calculation.overheadOperatingRate <= 0) {
    addItem("Overhead rate", "Set an overhead / operating percentage greater than zero.");
  }

  return checklist;
}

function calculateTpoEstimate(inputs, prices, travelConfig = DEFAULT_TRAVEL_ADMIN_SETTINGS) {
  const scope = calculateScope(inputs);
  const termination = calculateTermination(inputs, prices);
  const pitchPocket = calculatePitchPocket(inputs, prices);
  const detailMembrane = calculateDetailMembrane(inputs, prices, pitchPocket.pitchPocketDetailMembraneSqft);
  const acHandling = calculateAcHandling(inputs);
  const travelAndOvertime = calculateTravelAndOvertime(inputs, travelConfig);
  const labor = calculateLabor(inputs);
  const lodgingNeeded =
    inputs.lodgingNeeded === "Yes" ||
    inputs.lodgingNeeded === true ||
    inputs.travelLodgingNeeded === "Yes" ||
    inputs.travelLodgingNeeded === true;

  let materialPricing = calculateMaterialPricing(inputs, prices, scope, termination, pitchPocket, detailMembrane, acHandling);
  // merge any custom materials from inputs into the computed pricing
  materialPricing = mergeCustomMaterialsIntoPricing(inputs, materialPricing, scope);

  const terminationCost = termination.totalTerminationCost;
  const pitchPocketCost = pitchPocket.totalPitchPocketCost;
  const lodgingName = String(inputs.sprayFoamLodgingName || "");
  const nightlyLodgingCost = Math.max(0, toNumber(inputs.sprayFoamNightlyLodgingCost, 0));
  const lodgingNights = Math.max(0, Math.round(toNumber(inputs.sprayFoamLodgingNights, 0)));
  const lodgingTotal = lodgingNeeded ? nightlyLodgingCost * lodgingNights : 0;
  const travelCost = travelAndOvertime.totalTravelCost + lodgingTotal;
  const tearOffCost = scope.totalTearOffCost;
  const laborCost = labor.totalLaborCost;
  const acHandlingCost = acHandling.totalAcHandlingCost;
  const materialPricingCost = materialPricing.totalMaterialCost;
  const materialCost = materialPricingCost;
  const scopeAddersCost = Math.max(0, toNumber(inputs.scopeAdders, 0));
  const miscCost = Math.max(0, toNumber(inputs.miscCost, 0));

  // materialPricingCost already includes termination, pitch pocket, and A/C handling line items,
  // so keep the direct job stack explicit without double counting those categories.
  const baseMaterialCost = Math.max(materialPricingCost - terminationCost - pitchPocketCost - acHandlingCost, 0);

  const directJobCost =
    baseMaterialCost +
    laborCost +
    tearOffCost +
    acHandlingCost +
    terminationCost +
    pitchPocketCost +
    travelCost +
    scopeAddersCost +
    miscCost;

  const overheadOperatingRate = OVERHEAD_OPERATING_RATE / 100;
  const overheadOperatingCost = directJobCost * overheadOperatingRate;
  const totalCostBeforeProfit = directJobCost + overheadOperatingCost;
  const totalCost = totalCostBeforeProfit;

  const bidOptions = calculateBidOptions(
    totalCostBeforeProfit,
    scope.totalSquares,
    Math.max(30, Math.min(60, toNumber(inputs.selectedMarkupPercent, 30))),
  );

  return {
    scope,
    termination,
    pitchPocket,
    detailMembrane,
    acHandling,
    travelAndOvertime,
    labor,
    materialPricing,
    materialPricingCost,
    materialCost,
    terminationCost,
    pitchPocketCost,
    travelCost,
    totalTravelCost: travelCost,
    laborCost,
    acHandlingCost,
    directJobCost,
    overheadOperatingRate,
    overheadOperatingCost,
    totalCostBeforeProfit,
    totalCost,
    bidOptions,
    selectedMarkupPercent: bidOptions.selectedMarkupPercent,
    selectedBidAmount: bidOptions.selectedBidAmount,
    selectedPricePerSq: bidOptions.selectedPricePerSq,
    selectedProfitDollars: bidOptions.selectedProfitDollars,
    totalJobCost: bidOptions.selectedBidAmount,
  };
}

function calculateSprayFoamEstimate(inputs, travelConfig = DEFAULT_TRAVEL_ADMIN_SETTINGS) {
  const sprayFoamEstimateType = String(inputs.sprayFoamEstimateType || "roof");
  const isWallFoamEstimate = sprayFoamEstimateType === "wall";
  const foamSetYieldAtOneInch = isWallFoamEstimate ? DEFAULT_SPF_RATES.wallFoamYieldAtOneInch : 26;
  const foamSetCost = isWallFoamEstimate ? DEFAULT_SPF_RATES.wallFoamSetCost : DEFAULT_SPF_RATES.foamKitCost;
  const foamSetLabel = isWallFoamEstimate ? "Wall insulation set" : "Spray foam kit";
  const wallFoamChargeMethod = String(inputs.wallFoamChargeMethod || "prorated");
  const lodgingNeeded =
    inputs.lodgingNeeded === "Yes" ||
    inputs.lodgingNeeded === true ||
    inputs.travelLodgingNeeded === "Yes" ||
    inputs.travelLodgingNeeded === true ||
    inputs.sprayFoamLodgingNeeded === "Yes" ||
    inputs.sprayFoamLodgingNeeded === true;
  const separateRoofAreas = Boolean(inputs.sprayFoamSeparateRoofAreas);
  const roofAreaTotals = calculateSprayFoamRoofAreaTotalsSafe(inputs.sprayFoamRoofAreas, foamSetCost, foamSetYieldAtOneInch);
  const fieldSquares = separateRoofAreas
    ? roofAreaTotals.totalFieldSquares
    : Number(inputs.sprayFoamTotalFieldSquares || inputs.sprayFoamFieldRoofSquares || 0);
  const parapetSquares = separateRoofAreas
    ? roofAreaTotals.totalParapetWallSquares
    : Number(inputs.sprayFoamParapetWallSquares || 0);
  const useMultipleParapetMeasurements = Boolean(inputs.sprayFoamUseMultipleParapetMeasurements);
  const parapetMeasurementTotals = calculateSprayFoamParapetMeasurementTotals(inputs.sprayFoamParapetMeasurements);
  const totalParapetSquares = useMultipleParapetMeasurements
    ? parapetMeasurementTotals.totalParapetSquares
    : parapetSquares;
  const totalParapetSquareFeet = totalParapetSquares * 100;
  const totalRoofSquares = fieldSquares + totalParapetSquares;
  const productionSquares = totalRoofSquares;
  const selectedFoamThicknessInches = normalizeSprayFoamThickness(inputs.sprayFoamFieldThickness, 2);
  const foamEnabled = separateRoofAreas ? roofAreaTotals.totalFoamKits > 0 : selectedFoamThicknessInches > 0;
  const yieldPerKitAtSelectedThickness = selectedFoamThicknessInches > 0 ? foamSetYieldAtOneInch / selectedFoamThicknessInches : 0;
  const wallFoamSqFt = productionSquares;
  const wallFoamKitCoverage = yieldPerKitAtSelectedThickness;
  const wallFoamUsageRatio = wallFoamKitCoverage > 0 ? wallFoamSqFt / wallFoamKitCoverage : 0;
  const wallFoamFullKitsNeeded = foamEnabled ? Math.ceil(wallFoamUsageRatio) : 0;
  const wallFoamProratedMaterialCost = foamSetCost * wallFoamUsageRatio;
  const foamKitsNeeded = separateRoofAreas
    ? roofAreaTotals.totalFoamKits
    : isWallFoamEstimate
      ? wallFoamFullKitsNeeded
      : foamEnabled && totalRoofSquares > 0
        ? totalRoofSquares / yieldPerKitAtSelectedThickness
        : 0;
  const foamKitCost = foamSetCost;
  const wallFoamMaterialCost = foamEnabled
    ? wallFoamChargeMethod === "fullKit"
      ? wallFoamFullKitsNeeded * foamKitCost
      : wallFoamProratedMaterialCost
    : 0;
  const linearFeet = Math.max(0, toNumber(inputs.sprayFoamLinearFeet, 0));
  const dripEdgeRequired = Boolean(inputs.sprayFoamDripEdgeRequired);
  const foamStopDripEdgePieces = dripEdgeRequired ? Math.ceil(linearFeet / 10) : 0;
  const foamStopDripEdgeUnitCost = 22;
  const foamStopDripEdgeCost = foamStopDripEdgePieces * foamStopDripEdgeUnitCost;
  const estimatedCompletionDays = Math.max(0, Math.round(toNumber(inputs.sprayFoamEstimatedCompletionDays, 0)));
  const cityPermitFee = Math.max(0, toNumber(inputs.sprayFoamCityPermitFee, 0));
  const urgency = String(inputs.sprayFoamUrgency || "normal");
  const fieldThickness = selectedFoamThicknessInches;
  const wallThickness = Math.max(0.1, toNumber(inputs.sprayFoamWallThickness, 1));
  const laborersNeededPerDay = Math.max(0, Math.round(toNumber(inputs.sprayFoamLaborersNeededPerDay, 0)));
  const prevailingWageJob = Boolean(inputs.sprayFoamPrevailingWageJob);
  const prevailingWageHourlyRate = Math.max(0, toNumber(inputs.sprayFoamPrevailingWageHourlyRate, 0));
  const prevailingWageCrewSize = Math.max(0, Math.round(toNumber(inputs.sprayFoamPrevailingWageCrewSize, 0)));
  const prevailingWageHoursPerDay = Math.max(0, toNumber(inputs.sprayFoamPrevailingWageHoursPerDay, 0));
  const prevailingWageJobDays = Math.max(0, Math.round(toNumber(inputs.sprayFoamPrevailingWageJobDays, estimatedCompletionDays)));
  const prevailingWageLaborCost = prevailingWageJob
    ? prevailingWageHourlyRate * prevailingWageCrewSize * prevailingWageHoursPerDay * prevailingWageJobDays
    : 0;
  const sprayFoamHasSubcontractors = Boolean(inputs.sprayFoamHasSubcontractors);
  const sprayFoamSubcontractorItems = normalizeSprayFoamSubcontractorItems(inputs.sprayFoamSubcontractorItems);
  const subcontractorItems = sprayFoamHasSubcontractors
    ? sprayFoamSubcontractorItems.map((item) => {
        const quantity = Math.max(0, toNumber(item.quantity, 0));
        const unitPrice = Math.max(0, toNumber(item.unitPrice, 0));
        const baseCost = quantity * unitPrice;
        const workersCompRate = item.licensed ? 0 : 0.198;
        const workersCompCost = baseCost * workersCompRate;
        const totalCost = baseCost + workersCompCost;
        return {
          ...item,
          quantity,
          unitPrice,
          baseCost,
          workersCompRate,
          workersCompCost,
          totalCost,
        };
      })
    : [];
  const subcontractorCost = subcontractorItems.reduce((sum, item) => sum + item.totalCost, 0);
  const sprayFoamTravelVehicles = normalizeTravelVehicles(inputs.travelVehicles || inputs.travelVehicle);
  const resolvedSprayFoamTravelInputs = resolveSprayFoamTravelInputs(inputs, sprayFoamTravelVehicles.length);
  const travelAndOvertime = calculateTravelAndOvertime({ ...inputs, ...resolvedSprayFoamTravelInputs }, travelConfig);
  const lodgingName = String(inputs.sprayFoamLodgingName || "");
  const nightlyLodgingCost = Math.max(0, toNumber(inputs.sprayFoamNightlyLodgingCost, 0));
  const lodgingNights = Math.max(0, Math.round(toNumber(inputs.sprayFoamLodgingNights, 0)));
  const lodgingTotal = lodgingNeeded ? nightlyLodgingCost * lodgingNights : 0;

  const urgencyMultiplier =
    urgency === "rush" ? 1.1 : urgency === "emergency" ? 1.2 : 1;

  const layerConfig = {
    ...DEFAULT_SPF_LAYER_CONFIG,
    ...(inputs.sprayFoamLayerConfig || {}),
  };

  const layerItems = [
    {
      key: "primer",
      label: "Primer",
      coverageRate: toNumber(layerConfig.primer.coverageRate, DEFAULT_SPF_LAYER_CONFIG.primer.coverageRate),
      applicable: Boolean(layerConfig.primer.applicable),
      unitPrice: toNumber(layerConfig.primer.unitCost, DEFAULT_SPF_LAYER_CONFIG.primer.unitCost),
      quantityBase: productionSquares,
    },
    {
      key: "baseCoat",
      label: "Base coat",
      coverageRate: toNumber(layerConfig.baseCoat.coverageRate, DEFAULT_SPF_LAYER_CONFIG.baseCoat.coverageRate),
      applicable: Boolean(layerConfig.baseCoat.applicable),
      unitPrice: toNumber(layerConfig.baseCoat.unitCost, DEFAULT_SPF_LAYER_CONFIG.baseCoat.unitCost),
      quantityBase: productionSquares,
    },
    {
      key: "intermediateCoat1",
      label: "Intermediate coat 1",
      coverageRate: toNumber(layerConfig.intermediateCoat1.coverageRate, DEFAULT_SPF_LAYER_CONFIG.intermediateCoat1.coverageRate),
      applicable: Boolean(layerConfig.intermediateCoat1.applicable),
      unitPrice: toNumber(layerConfig.intermediateCoat1.unitCost, DEFAULT_SPF_LAYER_CONFIG.intermediateCoat1.unitCost),
      quantityBase: productionSquares,
    },
    {
      key: "intermediateCoat2",
      label: "Intermediate coat 2",
      coverageRate: toNumber(layerConfig.intermediateCoat2.coverageRate, DEFAULT_SPF_LAYER_CONFIG.intermediateCoat2.coverageRate),
      applicable: Boolean(layerConfig.intermediateCoat2.applicable),
      unitPrice: toNumber(layerConfig.intermediateCoat2.unitCost, DEFAULT_SPF_LAYER_CONFIG.intermediateCoat2.unitCost),
      quantityBase: productionSquares,
    },
    {
      key: "topCoat",
      label: "Top coat",
      coverageRate: toNumber(layerConfig.topCoat.coverageRate, DEFAULT_SPF_LAYER_CONFIG.topCoat.coverageRate),
      applicable: Boolean(layerConfig.topCoat.applicable),
      unitPrice: toNumber(layerConfig.topCoat.unitCost, DEFAULT_SPF_LAYER_CONFIG.topCoat.unitCost),
      quantityBase: productionSquares,
    },
    {
      key: "granules",
      label: "Granules",
      coverageRate: toNumber(layerConfig.granules.coverageRate, DEFAULT_SPF_LAYER_CONFIG.granules.coverageRate),
      applicable: Boolean(layerConfig.granules.applicable),
      unitPrice: toNumber(layerConfig.granules.unitCost, DEFAULT_SPF_LAYER_CONFIG.granules.unitCost),
      quantityBase: productionSquares,
    },
  ].map((item) => {
    const drumsNeeded = item.applicable ? Math.ceil(item.quantityBase / item.coverageRate) : 0;
    const usedSquares = item.applicable ? item.quantityBase : 0;
    const usedCost = item.applicable ? (usedSquares / item.coverageRate) * item.unitPrice : 0;
    return {
      ...item,
      squaresNeeded: usedSquares,
      drumsNeeded,
      amount: usedCost,
    };
  });

  const coatingItems = layerItems;
  const foamMaterialCost = separateRoofAreas
    ? roofAreaTotals.totalFoamCost
    : isWallFoamEstimate
      ? wallFoamMaterialCost
      : foamEnabled && totalRoofSquares > 0
        ? foamKitsNeeded * foamKitCost
        : 0;
  const materialItems = [
    {
      key: "foamKit",
      label: foamSetLabel,
      quantity: foamKitsNeeded,
      unit: isWallFoamEstimate ? "set" : "kit",
      unitPrice: foamKitCost,
      coverageRate: yieldPerKitAtSelectedThickness,
      kitsNeeded: foamKitsNeeded,
      selectedFoamThicknessInches,
      yieldPerKitAtSelectedThickness,
      foamMaterialCost,
    },
    {
      key: "wallThickness",
      label: "Wall thickness",
      quantity: foamEnabled ? linearFeet * wallThickness : 0,
      unit: "lf / inch",
      unitPrice: DEFAULT_SPF_RATES.wallThicknessUnitCost,
    },
    {
      key: "foamStopDripEdge",
      label: "4x4 Foam Stop Edge Metal",
      quantity: foamStopDripEdgePieces,
      unit: "10' piece",
      unitPrice: foamStopDripEdgeUnitCost,
      required: dripEdgeRequired,
    },
  ].map((item) => ({
    ...item,
    amount:
      item.key === "foamKit"
        ? foamMaterialCost
        : item.quantity * item.unitPrice,
  }));

  const detailMaterialConfig = normalizeSprayFoamDetailMaterials(inputs.sprayFoamDetailMaterials);
  const secureRockAutoQuantity = fieldSquares * 3.124;
  const skylightCurbsQuantity = Math.max(0, toNumber(detailMaterialConfig.skylightCurbs.quantity, 0));
  const roofHatchQuantity = Math.max(0, toNumber(detailMaterialConfig.roofHatch.quantity, 0));
  const totalRoofLoadingQuantity =
    Math.max(0, toNumber(detailMaterialConfig.ventedLouveredSkylights.quantity, 0)) +
    Math.max(0, toNumber(detailMaterialConfig.nonVentedLouveredSkylights.quantity, 0)) +
    roofHatchQuantity;
  const skylightCurbLumberBoardQuantity = skylightCurbsQuantity * 2;
  const skylightCurbLumberBoardUnitCost = Math.max(0, toNumber(inputs.sprayFoamSkylightCurbLumberBoardUnitCost, 0));
  const skylightCurbLumberLongPiecesNeeded = skylightCurbsQuantity * 2;
  const skylightCurbLumberShortPiecesNeeded = skylightCurbsQuantity * 2;
  const skylightCurbLumberOutsideLengthInches = 97.5;
  const skylightCurbLumberOutsideWidthInches = 49.5;
  const skylightCurbLumberShortCutInches = 46.5;
  const skylightCurbLumberEstimatedWasteInches = 0;
  const skylightCurbLumberEstimatedTotalLumberLF =
    skylightCurbLumberBoardQuantity * 12 * 2; // 2x8x12 boards
  const skylightCurbLumberOrderItem = skylightCurbsQuantity > 0
    ? {
        key: "skylightCurbLumberOrder",
        label: "Skylight Curb 2x8x12 Lumber Order",
        unit: "board",
        quantity: skylightCurbLumberBoardQuantity,
        unitCost: skylightCurbLumberBoardUnitCost,
        amount: skylightCurbLumberBoardQuantity * skylightCurbLumberBoardUnitCost,
      }
    : null;
  const detailMaterialItems = [
    {
      key: "scuppers",
      label: "Scuppers",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.scuppers.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.scuppers.unitCost, 65)),
    },
    {
      key: "castIronDrain",
      label: "Cast Iron Drain",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.castIronDrain.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.castIronDrain.unitCost, 450)),
    },
    {
      key: "ventedLouveredSkylights",
      label: "Vented Louvered Skylight",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.ventedLouveredSkylights.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.ventedLouveredSkylights.unitCost, 800)),
    },
    {
      key: "nonVentedLouveredSkylights",
      label: "Non-Vented Louvered Skylight",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.nonVentedLouveredSkylights.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.nonVentedLouveredSkylights.unitCost, 635)),
    },
    {
      key: "acCurbs",
      label: "A/C Curbs",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.acCurbs.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.acCurbs.unitCost, 100)),
    },
    {
      key: "acPans",
      label: "A/C Pans",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.acPans.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.acPans.unitCost, 165)),
    },
    {
      key: "skylightCurbs",
      label: "Skylight Curbs",
      unit: "each",
      quantity: skylightCurbsQuantity,
      unitCost: Math.max(0, toNumber(detailMaterialConfig.skylightCurbs.unitCost, 100)),
    },
    ...(skylightCurbLumberOrderItem ? [skylightCurbLumberOrderItem] : []),
    {
      key: "tTops",
      label: "T-Tops",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.tTops.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.tTops.unitCost, 55)),
    },
    {
      key: "roofHatch",
      label: "Roof Hatch",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.roofHatch.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.roofHatch.unitCost, 1800)),
    },
    {
      key: "whirlyBird16",
      label: '16" Whirly Bird',
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.whirlyBird16.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.whirlyBird16.unitCost, 125)),
    },
    {
      key: "corrugatedMetalSheets",
      label: "Corrugated Metal Sheets",
      unit: "sheet",
      quantity: Math.max(0, toNumber(detailMaterialConfig.corrugatedMetalSheets.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.corrugatedMetalSheets.unitCost, 38)),
    },
    {
      key: "pbrMetalSheets",
      label: "PBR Metal 3x12' Sheets",
      unit: "sheet",
      quantity: Math.max(0, toNumber(detailMaterialConfig.pbrMetalSheets.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.pbrMetalSheets.unitCost, 105)),
    },
    {
      key: "secureRockDenseDeck",
      label: "Secure Rock / Dense Deck",
      unit: "each",
      quantity: Math.max(0, toNumber(detailMaterialConfig.secureRockDenseDeck.quantity, 0)),
      unitCost: Math.max(0, toNumber(detailMaterialConfig.secureRockDenseDeck.unitCost, 30)),
      useAutoQuantity: false,
    },
  ].map((item) => ({
    ...item,
    amount: item.quantity * item.unitCost,
  }));

  const additionalDetailMaterialItems = normalizeSprayFoamAdditionalDetailMaterials(inputs.sprayFoamAdditionalDetailMaterials).map(
    (item, index) => {
      const quantity = Math.max(0, toNumber(item.quantity, 1));
      const unitCost = Math.max(0, toNumber(item.unitCost, 0));
      return {
        key: `customDetailMaterial-${index}`,
        label: item.name || `Custom material ${index + 1}`,
        unit: item.unit || "each",
        quantity,
        unitCost,
        amount: quantity * unitCost,
      };
    },
  );

  const equipmentRentalItems = normalizeSprayFoamEquipmentRentals(inputs.sprayFoamEquipmentRentals).map((item, index) => {
    const rateAmount = Math.max(0, toNumber(item.rateAmount, 0));
    const quantity = Math.max(0, toNumber(item.quantity, 1));
    const days = Math.max(0, toNumber(item.days, 0));
    const hours = Math.max(0, toNumber(item.hours, 0));
    const total =
      item.rateType === "perDay"
        ? rateAmount * quantity * days
        : item.rateType === "perHour"
          ? rateAmount * quantity * hours
          : rateAmount * quantity;
    return {
      key: `equipmentRental-${index}`,
      label: item.name || `Equipment / rental ${index + 1}`,
      rateType: item.rateType,
      quantity,
      days,
      hours,
      rateAmount,
      unit: item.rateType === "perDay" ? "day" : item.rateType === "perHour" ? "hour" : "flat",
      amount: total,
      total,
    };
  });

  const allDetailMaterialItems = [...detailMaterialItems, ...additionalDetailMaterialItems, ...equipmentRentalItems];
  const rooftopDeliveryFee = totalRoofLoadingQuantity > 0 && inputs.sprayFoamSkylightsRoofLoaded
    ? Math.max(0, toNumber(inputs.sprayFoamRooftopDeliveryFee, 750))
    : 0;
  const rooftopDeliveryItem = rooftopDeliveryFee > 0
    ? {
        key: "rooftopDeliveryFee",
        label: "Rooftop delivery fee",
        unit: "fee",
        quantity: 1,
        unitCost: rooftopDeliveryFee,
        amount: rooftopDeliveryFee,
      }
    : null;
  const materialCostItems = [...coatingItems, ...materialItems, ...allDetailMaterialItems, ...(rooftopDeliveryItem ? [rooftopDeliveryItem] : [])];
  const totalMaterialCost = materialCostItems.reduce((sum, item) => sum + item.amount, 0);
  const totalDetailMaterialCost = allDetailMaterialItems.reduce((sum, item) => sum + item.amount, 0);
  const equipmentRentalTotal = equipmentRentalItems.reduce((sum, item) => sum + item.amount, 0);

  const effectiveTotalLaborers = laborersNeededPerDay * Math.max(estimatedCompletionDays, 0);
  const estimatedLaborCost = effectiveTotalLaborers * 400 * urgencyMultiplier + prevailingWageLaborCost;

  const travelCost = travelAndOvertime.totalTravelCost + lodgingTotal;
  const directJobCost = totalMaterialCost + estimatedLaborCost + subcontractorCost + travelCost;
  const overheadCost = directJobCost * 0.1;
  const operatingCost = directJobCost * 0.075;
  const permitFee = cityPermitFee;
  const totalJobCost = directJobCost + overheadCost + operatingCost + permitFee;
  const overheadOperatingCost = overheadCost + operatingCost;
  const customTotalCharge = Math.max(0, toNumber(inputs.sprayFoamCustomBidAmount, 0));
  const customPricePerSq = productionSquares > 0 ? customTotalCharge / productionSquares : 0;
  const customProfitDollars = customTotalCharge - totalJobCost;
  const customProfitMarginPercent = totalJobCost > 0 ? (customProfitDollars / totalJobCost) * 100 : 0;
  const useCustomBid = Boolean(customTotalCharge > 0 || inputs.sprayFoamCustomBidSelected);

  const bidOptions = calculateBidOptions(totalJobCost, productionSquares, Math.max(30, Math.min(60, toNumber(inputs.selectedMarkupPercent, 30))));
  const selectedBidAmount = useCustomBid ? customTotalCharge : bidOptions.selectedBidAmount;
  const selectedPricePerSq = useCustomBid ? customPricePerSq : bidOptions.selectedPricePerSq;
  const selectedProfitDollars = useCustomBid ? customProfitDollars : bidOptions.selectedProfitDollars;
  const selectedMarkupPercent = useCustomBid ? (totalJobCost > 0 ? (customProfitDollars / totalJobCost) * 100 : 0) : bidOptions.selectedMarkupPercent;

  return {
    template: "sprayFoam",
    sprayFoamEstimateType,
    isWallFoamEstimate,
    foamSetLabel,
    scope: {
      totalSquares: productionSquares,
    },
    jobName: String(inputs.jobName || ""),
    salesperson: String(inputs.sprayFoamSalesperson || ""),
    customerName: String(inputs.customerName || ""),
    jobAddress: String(inputs.jobAddress || ""),
    companyHqAddress: travelAndOvertime.companyHqAddress,
    jobSiteAddress: travelAndOvertime.jobSiteAddress || String(inputs.jobAddress || ""),
    milesToLocation: travelAndOvertime.oneWayMiles,
    roundTripMiles: travelAndOvertime.oneWayMiles * 2,
    travelTimeHours: travelAndOvertime.oneWayDriveTimeHours,
    travelDistanceSource: travelAndOvertime.travelDistanceSource,
    estimatedCompletionDays,
    totalFieldSquares: fieldSquares,
    fieldSquares,
    fieldRoofSquares: fieldSquares,
    separateRoofAreas,
    roofAreas: roofAreaTotals.rows,
    totalRoofSquares,
    totalFoamKits: foamKitsNeeded,
    totalFoamCost: foamMaterialCost,
    wallFoamChargeMethod,
    wallFoamSqFt,
    wallFoamKitCoverage,
    wallFoamUsageRatio,
    wallFoamFullKitsNeeded,
    wallFoamProratedMaterialCost,
    wallFoamMaterialCost,
    selectedFoamThicknessInches,
    yieldPerKitAtSelectedThickness,
    foamKitsNeeded,
    foamKitCost,
    foamMaterialCost,
    dripEdgeRequired,
    foamStopDripEdgePieces,
    foamStopDripEdgeCost,
    totalParapetSquareFeet,
    totalParapetSquares,
    parapetWallSquares: totalParapetSquares,
    parapetMeasurementTotals,
    useMultipleParapetMeasurements,
    productionSquares,
    linearFeet,
    cityPermitFee,
    urgency,
    fieldThickness,
    wallThickness,
    laborersNeededPerDay,
    totalLaborers: effectiveTotalLaborers,
    prevailingWageJob,
    prevailingWageHourlyRate,
    prevailingWageCrewSize,
    prevailingWageHoursPerDay,
    prevailingWageJobDays,
    prevailingWageLaborCost,
    sprayFoamHasSubcontractors,
    sprayFoamSubcontractorItems: subcontractorItems,
    subcontractorCost,
    coatingItems,
    sprayFoamMaterialItems: materialItems,
    detailMaterialItems: allDetailMaterialItems,
    equipmentRentalItems,
    equipmentRentalTotal,
    materialPricing: {
      items: materialCostItems,
      totalMaterialCost,
    },
    materialPricingCost: totalMaterialCost,
    totalMaterialCost,
    materialCost: totalMaterialCost,
    foamMaterialCost,
    foamKitsNeeded,
    yieldPerKitAtSelectedThickness,
    selectedFoamThicknessInches,
    totalDetailMaterialCost,
    equipmentRentalItems,
    equipmentRentalTotal,
    detailMaterialItems: allDetailMaterialItems,
    additionalDetailMaterialItems,
    sprayFoamEquipmentRentals: equipmentRentalItems,
    skylightCurbsQuantity,
    totalRoofLoadingQuantity,
    skylightCurbLumberOrderItem,
    skylightCurbLumberLongPiecesNeeded,
    skylightCurbLumberShortPiecesNeeded,
    skylightCurbLumberEstimatedWasteInches,
    skylightCurbLumberEstimatedTotalLumberLF,
    skylightCurbLumberOutsideLengthInches,
    skylightCurbLumberOutsideWidthInches,
    skylightCurbLumberShortCutInches,
    rooftopDeliveryFee,
    rooftopDeliveryItem,
    lodgingNeeded,
    lodgingName,
    nightlyLodgingCost,
    lodgingNights,
    lodgingTotal,
    secureRockAutoQuantity,
    estimatedLaborCost,
    laborCost: estimatedLaborCost,
    prevailingWageJob,
    prevailingWageHourlyRate,
    prevailingWageCrewSize,
    prevailingWageHoursPerDay,
    prevailingWageJobDays,
    prevailingWageLaborCost,
    subcontractorCost,
    travelCost,
    totalTravelCost: travelCost,
    travelAndOvertime,
    lodgingNeeded,
    lodgingName,
    nightlyLodgingCost,
    lodgingNights,
    lodgingTotal,
    overheadCost,
    operatingCost,
    permitFee,
    directJobCost,
    overheadOperatingCost,
    totalCostBeforeProfit: totalJobCost,
    totalCost: totalJobCost,
    totalJobCost,
    bidOptions,
    selectedMarkupPercent,
    selectedBidAmount,
    selectedPricePerSq,
    selectedProfitDollars,
    customBidAmount: customTotalCharge,
    customBidSelected: useCustomBid,
    totalSquares: productionSquares,
    customTotalCharge,
    customPricePerSq,
    customProfitDollars,
    customProfitMarginPercent,
  };
}

function calculateShingleEstimate(inputs, travelAndOvertime = calculateTravelAndOvertime(inputs)) {
  const totalRoofSquares = Math.max(0, toNumber(inputs.shingleTotalRoofSquares, toNumber(inputs.totalSquares, 0)));
  const roofSquares = totalRoofSquares;
  const wastePercent = Math.max(0, toNumber(inputs.shingleWastePercent, 15));
  const productionSquares = Math.max(0, toNumber(inputs.shingleProductionSquares, totalRoofSquares * (1 + wastePercent / 100)));
  const adjustedSquares = totalRoofSquares * (1 + wastePercent / 100);
  const ridgeHipLf = Math.max(0, toNumber(inputs.shingleRidgeHipLinearFeet, toNumber(inputs.shingleRidgeHipLf, 0)));
  const ridgeLf = Math.max(0, toNumber(inputs.shingleRidgeLinearFeet, toNumber(inputs.shingleRidgeLf, ridgeHipLf)));
  const hipLf = Math.max(0, toNumber(inputs.shingleHipLinearFeet, toNumber(inputs.shingleHipLf, ridgeHipLf > 0 && ridgeLf === ridgeHipLf ? 0 : 0)));
  const valleyLf = Math.max(0, toNumber(inputs.shingleValleyLinearFeet, toNumber(inputs.shingleValleyLf, 0)));
  const rakeLf = Math.max(0, toNumber(inputs.shingleRakeLinearFeet, toNumber(inputs.shingleRakeLf, 0)));
  const eaveLf = Math.max(0, toNumber(inputs.shingleEaveLinearFeet, toNumber(inputs.shingleEaveLf, 0)));
  const starterLf = Math.max(0, toNumber(inputs.shingleStarterLinearFeet, toNumber(inputs.shingleStarterLf, 0)));
  const dripEdgeLf = Math.max(0, toNumber(inputs.shingleDripEdgeLinearFeet, toNumber(inputs.shingleDripEdgeLf, 0)));
  const hdzBundlesInput = Math.max(0, toNumber(inputs.shingleHdzBundlesNeeded, 0));
  const calculatedHdzBundlesNeeded = Math.max(0, Math.ceil(adjustedSquares * 3));
  const hdzBundlesQuantity = hdzBundlesInput > 0 ? hdzBundlesInput : calculatedHdzBundlesNeeded;
  const syntheticUnderlaymentSuggestedRolls = Math.max(0, toNumber(inputs.shingleSyntheticUnderlaymentSuggestedRolls, 0));
  const syntheticUnderlaymentInput = Math.max(0, toNumber(inputs.shingleSyntheticUnderlaymentRolls, 0));
  const calculatedSyntheticUnderlaymentRolls = Math.max(0, Math.ceil(adjustedSquares / 9.6));
  const syntheticUnderlaymentRollsQuantity =
    syntheticUnderlaymentInput > 0
      ? syntheticUnderlaymentInput
      : calculatedSyntheticUnderlaymentRolls;
  const calculatedStarterBundles = starterLf > 0 ? Math.ceil(starterLf / 115) : 0;
  const calculatedRapidRidgeBoxes = ridgeLf > 0 ? Math.ceil(ridgeLf / 20) : 0;
  const calculatedValleyPieces = valleyLf > 0 ? Math.ceil(valleyLf / 10) : 0;
  const calculatedDripEdgePieces = Math.max(0, Math.ceil(dripEdgeLf / 10));
  const calculatedOhaginVentQuantity = Math.max(0, Math.round(toNumber(inputs.shingleVentsCount, 0)));
  const starterQuantity = Math.max(0, toNumber(inputs.shingleStarterQuantity, 0));
  const rapidRidgeBoxes = Math.max(0, toNumber(inputs.shingleRapidRidgeBoxes, 0));
  const valleyMetalQuantity = Math.max(0, toNumber(inputs.shingleValleyMetalQuantity, 0));
  const dripEdgePiecesQuantity = Math.max(0, toNumber(inputs.shingleDripEdgePieces, 0));
  const ohaginVentQuantity = Math.max(0, toNumber(inputs.shingleOHaginVentQuantity, 0));
  const totalRidgeCapLinearFeet = ridgeHipLf > 0 ? ridgeHipLf : ridgeLf + hipLf;
  const shingleMaterialFallbackNotes = [
    "Manual measurement mode active. Quantities are calculated from entered roof measurements.",
  ].filter(Boolean);
  const perimeterLf = Math.max(0, toNumber(inputs.shinglePerimeterLinearFeet, 0));
  const pipeJacksCount = Math.max(0, Math.round(toNumber(inputs.shinglePipeJacksCount, 0)));
  const ventsCount = calculatedOhaginVentQuantity;
  const skylightsCount = Math.max(0, Math.round(toNumber(inputs.shingleSkylightsCount, 0)));
  const chimneyCount = Math.max(0, Math.round(toNumber(inputs.shingleChimneyCount, 0)));
  const existingLayers = Math.max(0, Math.round(toNumber(inputs.shingleExistingLayers, 1)));
  const shingleTearOffSections = normalizeShingleTearOffSections(inputs.shingleTearOffSections);
  const shingleTearOffSectionTotals = shingleTearOffSections.map((section) => {
    const sectionSquares = Math.max(0, toNumber(section.squares, 0));
    const sectionLayers = Math.max(1, Math.round(toNumber(section.layers, 1)));
    const sectionTearOffCostPerSquare = Math.max(0, toNumber(section.tearOffCostPerSquare, 0));
    const sectionDisposalFee = Math.max(0, toNumber(section.disposalFee, 0));
    const sectionDryRotAllowance = Math.max(0, toNumber(section.dryRotAllowance, 0));
    const sectionTearOffTotal = (sectionSquares * sectionLayers * sectionTearOffCostPerSquare) + sectionDisposalFee + sectionDryRotAllowance;
    return {
      ...section,
      squares: sectionSquares,
      layers: sectionLayers,
      tearOffCostPerSquare: sectionTearOffCostPerSquare,
      disposalFee: sectionDisposalFee,
      dryRotAllowance: sectionDryRotAllowance,
      sectionTearOffTotal,
    };
  });
  const shinglePrices = {
    shinglesPerSquareCost: Math.max(0, toNumber(inputs.shingleShinglesPerSquareCost, 45)),
    syntheticUnderlaymentRollCost: Math.max(0, toNumber(inputs.shingleSyntheticUnderlaymentRollCost, 90)),
    syntheticUnderlaymentRollCoverageSq: Math.max(1, toNumber(inputs.shingleSyntheticUnderlaymentRollCoverageSq, 9.6)),
    starterCost: Math.max(0, toNumber(inputs.shingleStarterCost, 50)),
    ridgeCapCost: Math.max(0, toNumber(inputs.shingleRidgeCapCost, 80)),
    dripEdgeCost: Math.max(0, toNumber(inputs.shingleDripEdgeCost, 8)),
    coilNails125Cost: Math.max(0, toNumber(inputs.shingleCoilNails125Cost, 55)),
    coilNails78Cost: Math.max(0, toNumber(inputs.shingleCoilNails78Cost, 52)),
    markingPaintCost: Math.max(0, toNumber(inputs.shingleMarkingPaintCost, 7)),
    tinShinglesCost: Math.max(0, toNumber(inputs.shingleTinShinglesCost, 36)),
    roofJack2Cost: Math.max(0, toNumber(inputs.shingleRoofJack2Cost, 8)),
    roofJack15Cost: Math.max(0, toNumber(inputs.shingleRoofJack15Cost, 8)),
    roofJack3Cost: Math.max(0, toNumber(inputs.shingleRoofJack3Cost, 14)),
    roofJack4Cost: Math.max(0, toNumber(inputs.shingleRoofJack4Cost, 15)),
    americapOvalCost: Math.max(0, toNumber(inputs.shingleAmericapOvalCost, 25)),
    americapRoundCost: Math.max(0, toNumber(inputs.shingleAmericapRoundCost, 25)),
    ovalRoofJackCost: Math.max(0, toNumber(inputs.shingleOvalRoofJackCost, 25)),
    valleyMetalCost: Math.max(0, toNumber(inputs.shingleValleyMetalCost, 60)),
    ohaginVentCost: Math.max(0, toNumber(inputs.shingleOHaginVentCost, 65)),
    dormerVentCost: Math.max(0, toNumber(inputs.shingleDormerVentCost, 65)),
    caulkingSealantTubeCost: Math.max(0, toNumber(inputs.shingleCaulkingSealantTubeCost, 12)),
    ventCost: Math.max(0, toNumber(inputs.shingleVentCost, 65)),
    nailCostPerSquare: Math.max(0, toNumber(inputs.shingleNailsCostPerSquare, 55)),
    caulkingSealantCost: Math.max(0, toNumber(inputs.shingleCaulkingSealantCost, 0)),
    plywoodSheetCost: Math.max(0, toNumber(inputs.shinglePlywoodSheetCost, 30)),
    sprayPaintCost: Math.max(0, toNumber(inputs.shingleSprayPaintCost, 7)),
    roofConveyorDeliveryChargeQuantity: Math.max(0, toNumber(inputs.shingleRoofConveyorDeliveryChargeQuantity, 1)),
    roofConveyorDeliveryCharge: Math.max(0, toNumber(inputs.shingleRoofConveyorDeliveryCharge, 75)),
    fuelSurchargeQuantity: Math.max(0, toNumber(inputs.shingleFuelSurchargeQuantity, 1)),
    fuelSurcharge: Math.max(0, toNumber(inputs.shingleFuelSurcharge, 75)),
  };
  const shinglePlywoodSheets = Math.max(0, toNumber(inputs.shinglePlywoodSheets, 0));
  const coilNails125Quantity = Math.max(0, toNumber(inputs.shingleCoilNails125Quantity, Math.ceil(productionSquares / 10)));
  const coilNails78Quantity = Math.max(0, toNumber(inputs.shingleCoilNails78Quantity, Math.ceil(productionSquares / 10)));
  const markingPaintQuantity = Math.max(0, toNumber(inputs.shingleMarkingPaintQuantity, pipeJacksCount + ventsCount + skylightsCount + chimneyCount));
  const tinShinglesQuantity = Math.max(0, toNumber(inputs.shingleTinShinglesQuantity, 0));
  const roofJack2Quantity = Math.max(0, toNumber(inputs.shingleRoofJack2Quantity, 0));
  const roofJack15Quantity = Math.max(0, toNumber(inputs.shingleRoofJack15Quantity, 0));
  const roofJack3Quantity = Math.max(0, toNumber(inputs.shingleRoofJack3Quantity, 0));
  const roofJack4Quantity = Math.max(0, toNumber(inputs.shingleRoofJack4Quantity, 0));
  const americapOvalQuantity = Math.max(0, toNumber(inputs.shingleAmericapOvalQuantity, 0));
  const americapRoundQuantity = Math.max(0, toNumber(inputs.shingleAmericapRoundQuantity, 0));
  const ovalRoofJackQuantity = Math.max(0, toNumber(inputs.shingleOvalRoofJackQuantity, 0));
  const dormerVentQuantity = Math.max(0, toNumber(inputs.shingleDormerVentQuantity, 0));
  const caulkingSealantTubeQuantity = Math.max(0, toNumber(inputs.shingleCaulkingSealantTubeQuantity, 0));
  const roofConveyorDeliveryChargeQuantity = Math.max(0, toNumber(inputs.shingleRoofConveyorDeliveryChargeQuantity, 1));
  const fuelSurchargeQuantity = Math.max(0, toNumber(inputs.shingleFuelSurchargeQuantity, 1));
  const shingleMaterialItems = [
    {
      key: "shingles",
      label: "Timberline HDZ RS+ Bundle",
      quantity: hdzBundlesQuantity,
      unit: "bundle",
      unitPrice: shinglePrices.shinglesPerSquareCost,
    },
    {
      key: "underlayment",
      label: "Synthetic Underlayment",
      quantity: syntheticUnderlaymentRollsQuantity,
      unit: "roll",
      unitPrice: shinglePrices.syntheticUnderlaymentRollCost,
    },
    {
      key: "starter",
      label: "Pro-Start Starter",
      quantity: starterQuantity,
      unit: "bundle",
      unitPrice: shinglePrices.starterCost,
      helperText: "115 LF coverage per bundle",
    },
    {
      key: "ridgeCap",
      label: 'Rapid Ridge 8" Ridge Cap',
      quantity: rapidRidgeBoxes,
      unit: "box",
      unitPrice: shinglePrices.ridgeCapCost,
      helperText: "20 LF coverage per box",
    },
    {
      key: "dripEdge",
      label: '2"x2" Drip Edge 10 ft Piece',
      quantity: dripEdgePiecesQuantity,
      unit: "piece",
      unitPrice: shinglePrices.dripEdgeCost,
    },
    {
      key: "coilNails125",
      label: '1-1/4" Coil Nails',
      quantity: coilNails125Quantity,
      unit: "box",
      unitPrice: shinglePrices.coilNails125Cost,
    },
    {
      key: "coilNails78",
      label: '7/8" Coil Nails',
      quantity: coilNails78Quantity,
      unit: "box",
      unitPrice: shinglePrices.coilNails78Cost,
    },
    {
      key: "markingPaint",
      label: "Marking Paint",
      quantity: markingPaintQuantity,
      unit: "can",
      unitPrice: shinglePrices.markingPaintCost,
    },
    {
      key: "tinShingles",
      label: '6"x8" Tin Shingles',
      quantity: tinShinglesQuantity,
      unit: "bundle",
      unitPrice: shinglePrices.tinShinglesCost,
    },
    {
      key: "roofJack2",
      label: '2" Roof Jack',
      quantity: roofJack2Quantity,
      unit: "each",
      unitPrice: shinglePrices.roofJack2Cost,
    },
    {
      key: "roofJack15",
      label: '1-1/2" Roof Jack',
      quantity: roofJack15Quantity,
      unit: "each",
      unitPrice: shinglePrices.roofJack15Cost,
    },
    {
      key: "roofJack3",
      label: '3" Roof Jack',
      quantity: roofJack3Quantity,
      unit: "each",
      unitPrice: shinglePrices.roofJack3Cost,
    },
    {
      key: "roofJack4",
      label: '4" Roof Jack',
      quantity: roofJack4Quantity,
      unit: "each",
      unitPrice: shinglePrices.roofJack4Cost,
    },
    {
      key: "ovalRoofJack",
      label: 'Oval 4" Roof Jack',
      quantity: ovalRoofJackQuantity,
      unit: "each",
      unitPrice: shinglePrices.ovalRoofJackCost,
    },
    {
      key: "americapRound",
      label: 'Americap 4" Round',
      quantity: americapRoundQuantity,
      unit: "each",
      unitPrice: shinglePrices.americapRoundCost,
    },
    {
      key: "americapOval",
      label: 'Americap 4" Oval',
      quantity: americapOvalQuantity,
      unit: "each",
      unitPrice: shinglePrices.americapOvalCost,
    },
    {
      key: "valleyMetal",
      label: "26 Gauge Valley Metal",
      quantity: valleyMetalQuantity,
      unit: "10 ft piece",
      unitPrice: shinglePrices.valleyMetalCost,
    },
    {
      key: "ohaginVent",
      label: "O'Hagin Vent",
      quantity: ohaginVentQuantity,
      unit: "each",
      unitPrice: shinglePrices.ohaginVentCost,
    },
    {
      key: "dormerVent",
      label: "Dormer Vent",
      quantity: dormerVentQuantity,
      unit: "each",
      unitPrice: shinglePrices.dormerVentCost,
    },
    {
      key: "caulkingSealantTube",
      label: "Caulking / Sealant Tube",
      quantity: caulkingSealantTubeQuantity,
      unit: "tube",
      unitPrice: shinglePrices.caulkingSealantTubeCost,
    },
    {
      key: "cdxPlywood",
      label: "CDX Plywood",
      quantity: shinglePlywoodSheets,
      unit: "sheet",
      unitPrice: shinglePrices.plywoodSheetCost,
    },
    {
      key: "roofConveyorDeliveryCharge",
      label: "Roof conveyor delivery charge",
      quantity: roofConveyorDeliveryChargeQuantity,
      unit: "fee",
      unitPrice: shinglePrices.roofConveyorDeliveryCharge,
    },
    {
      key: "fuelSurcharge",
      label: "Fuel surcharge",
      quantity: fuelSurchargeQuantity,
      unit: "fee",
      unitPrice: shinglePrices.fuelSurcharge,
    },
  ].map((item) => ({
    ...item,
    amount: item.quantity * item.unitPrice,
  }));
  const materialCost = shingleMaterialItems.reduce((sum, item) => sum + item.amount, 0);
  const tearOffCostPerSquare = Math.max(0, toNumber(inputs.shingleTearOffCostPerSquare, 0));
  const dumpTrailerFee = Math.max(0, toNumber(inputs.shingleDumpTrailerFee, 0));
  const dryRotAllowance = Math.max(0, toNumber(inputs.shingleDryRotAllowance, 0));
  const tearOffDisposalCost = shingleTearOffSectionTotals.reduce((sum, section) => sum + section.sectionTearOffTotal, 0);
  const shingleLaborType = String(inputs.shingleLaborType || "inHouse");
  const laborersPerDay = Math.max(0, Math.round(toNumber(inputs.shingleLaborersPerDay, 0)));
  const totalDaysOnJob = Math.max(0, Math.round(toNumber(inputs.shingleTotalDaysOnJob, 0)));
  const laborHourlyRate = Math.max(0, toNumber(inputs.shingleLaborHourlyRate, 0));
  const hoursPerDay = Math.max(0, toNumber(inputs.shingleHoursPerDay, 0));
  const inHouseLaborCost = laborersPerDay * totalDaysOnJob * hoursPerDay * laborHourlyRate;
  const shingleSubcontractorLicensed = Boolean(inputs.shingleSubcontractorLicensed);
  const shingleSubcontractorWorkersComp = Boolean(inputs.shingleSubcontractorWorkersComp);
  const shingleTearOffPricingUnit = String(inputs.shingleTearOffPricingUnit || "SQ");
  const shingleSubcontractorSections = normalizeShingleLaborSections(inputs.shingleSubcontractorSections);
  const shingleSubcontractorSectionTotals = shingleSubcontractorSections.map((section) => {
    const installSquares = Math.max(0, toNumber(section.installSquares, 0));
    const installCostPerSq = Math.max(0, toNumber(section.costPerInstallSq, 0));
    const sectionInstallTotal = installSquares * installCostPerSq;
    return {
      ...section,
      installSquares,
      installCostPerSq,
      sectionInstallTotal,
    };
  });
  const shingleSubcontractorRawItems = normalizeShingleSubcontractorItems(inputs.shingleSubcontractorItems);
  const shingleSubcontractorItems = shingleSubcontractorRawItems.map((item, index) => {
    const quantity = Math.max(0, toNumber(item.quantity, 0));
    const unitPrice = Math.max(0, toNumber(item.unitPrice, 0));
    const unit = index === 0 ? shingleTearOffPricingUnit : String(item.unit || "");
    const baseCost = quantity * unitPrice;
    const workersCompRate = item.licensed ? 0 : 0.198;
    const workersCompCost = baseCost * workersCompRate;
    const totalCost = baseCost + workersCompCost;
    return {
      ...item,
      unit,
      quantity,
      unitPrice,
      baseCost,
      workersCompRate,
      workersCompCost,
      totalCost,
    };
  });
  const shingleSubcontractorCost = shingleSubcontractorItems.reduce((sum, item) => sum + item.totalCost, 0);
  const subcontractorInstallSubtotal = shingleSubcontractorSectionTotals.reduce((sum, section) => sum + section.sectionInstallTotal, 0);
  const workersCompRiskAddOn =
    shingleLaborType === "subcontracted" && (!shingleSubcontractorLicensed || !shingleSubcontractorWorkersComp)
      ? subcontractorInstallSubtotal * 0.2
      : 0;
  const totalSubcontractorLaborCost = subcontractorInstallSubtotal + workersCompRiskAddOn;
  const laborCost = shingleLaborType === "subcontracted" ? totalSubcontractorLaborCost : inHouseLaborCost;
  const additionalLabor = 0;
  const jobDays = totalDaysOnJob;
  const crewSize = laborersPerDay;
  const cityPermitFee = Math.max(0, toNumber(inputs.shingleCityPermitFee, 0));
  const travelCost = travelAndOvertime.totalTravelCost;
  const directJobCost = materialCost + laborCost + shingleSubcontractorCost + travelCost;
  const overheadOperatingCost = directJobCost * (OVERHEAD_OPERATING_RATE / 100);
  const totalCostBeforeProfit = directJobCost + overheadOperatingCost + cityPermitFee;
  const totalJobCost = totalCostBeforeProfit;

  const customTotalCharge = Math.max(0, toNumber(inputs.shingleCustomBidAmount, 0));
  const customPricePerSq = totalRoofSquares > 0 ? customTotalCharge / totalRoofSquares : 0;
  const customProfitDollars = customTotalCharge - totalJobCost;
  const customProfitMarginPercent = totalJobCost > 0 ? (customProfitDollars / totalJobCost) * 100 : 0;
  const useCustomBid = Boolean(customTotalCharge > 0 || inputs.shingleCustomBidSelected);
  const bidOptions = calculateBidOptions(totalJobCost, totalRoofSquares, Math.max(30, Math.min(60, toNumber(inputs.selectedMarkupPercent, 30))));
  const selectedBidAmount = useCustomBid ? customTotalCharge : bidOptions.selectedBidAmount;
  const selectedPricePerSq = useCustomBid ? customPricePerSq : bidOptions.selectedPricePerSq;
  const selectedProfitDollars = useCustomBid ? customProfitDollars : bidOptions.selectedProfitDollars;
  const selectedMarkupPercent = useCustomBid ? (totalJobCost > 0 ? (customProfitDollars / totalJobCost) * 100 : 0) : bidOptions.selectedMarkupPercent;

  return {
    template: "shingle",
    estimateType: "Shingle",
    scope: {
      totalSquares: totalRoofSquares,
    },
    jobName: String(inputs.shingleJobName || inputs.jobName || ""),
    customerName: String(inputs.shingleCustomerName || inputs.customerName || ""),
    jobAddress: String(inputs.shingleJobAddress || inputs.jobAddress || ""),
    salesperson: String(inputs.shingleSalesperson || ""),
    cityPermitFee,
    totalRoofSquares,
    totalSquares: totalRoofSquares,
    wastePercent,
    productionSquares,
    ridgeLf,
    hipLf,
    valleyLf,
    rakeLf,
    eaveLf,
    starterLf,
    dripEdgeLf,
    pipeJacksCount,
    ventsCount,
    skylightsCount,
    chimneyCount,
    shinglePrices,
    materialItems: shingleMaterialItems,
    materialCost,
    shingleHdzBundlesNeeded: hdzBundlesQuantity,
    shingleHdzBundlesCalculated: calculatedHdzBundlesNeeded,
    shingleSyntheticUnderlaymentSuggestedRolls: syntheticUnderlaymentSuggestedRolls,
    shingleSyntheticUnderlaymentCalculatedRolls: calculatedSyntheticUnderlaymentRolls,
    shingleSyntheticUnderlaymentRolls: syntheticUnderlaymentRollsQuantity,
    shingleStarterQuantity: starterQuantity,
    shingleStarterSuggestedQuantity: starterLf,
    shingleStarterCalculatedQuantity: calculatedStarterBundles,
    shingleDripEdgePieces: dripEdgePiecesQuantity,
    shingleDripEdgeSuggestedPieces: dripEdgePiecesQuantity,
    shingleDripEdgeCalculatedPieces: calculatedDripEdgePieces,
    shingleRapidRidgeBoxes: rapidRidgeBoxes,
    shingleRapidRidgeBoxesCalculated: calculatedRapidRidgeBoxes,
    shingleRapidRidgeLFUsed: totalRidgeCapLinearFeet,
    shingleValleyMetalQuantity: valleyMetalQuantity,
    shingleValleyMetalCalculatedQuantity: calculatedValleyPieces,
    shingleMaterialFallbackNotes,
    shingleTearOffSectionTotals,
    shingleTearOffSections: shingleTearOffSectionTotals,
    shingleTearOffSectionCount: shingleTearOffSectionTotals.length,
    tearOffCostPerSquare,
    dumpTrailerFee,
    dryRotAllowance,
    tearOffDisposalCost,
    shingleLaborType,
    shingleLaborersPerDay: laborersPerDay,
    shingleTotalDaysOnJob: totalDaysOnJob,
    shingleLaborHourlyRate: laborHourlyRate,
    shingleHoursPerDay: hoursPerDay,
    shingleSubcontractorLicensed,
    shingleSubcontractorWorkersComp,
    shingleTearOffPricingUnit,
    shingleSubcontractorSections: shingleSubcontractorSectionTotals,
    shingleSubcontractorItems,
    shingleSubcontractorCost,
    shingleSubcontractorInstallSubtotal: subcontractorInstallSubtotal,
    shingleWorkersCompRiskAddOn: workersCompRiskAddOn,
    shingleTotalSubcontractorLaborCost: totalSubcontractorLaborCost,
    existingLayers,
    jobDays,
    crewSize,
    laborCost,
    travelCost,
    totalTravelCost: travelCost,
    travelAndOvertime,
    directJobCost,
    overheadOperatingCost,
    totalCostBeforeProfit,
    totalCost: totalJobCost,
    totalJobCost,
    bidOptions,
    selectedMarkupPercent,
    selectedBidAmount,
    selectedPricePerSq,
    selectedProfitDollars,
    customBidAmount: customTotalCharge,
    customBidSelected: useCustomBid,
    customTotalCharge,
    customPricePerSq,
    customProfitDollars,
    customProfitMarginPercent,
    totalMaterialCost: materialCost,
    totalLaborCost: laborCost,
  };
}

function calculateTileEstimate(inputs, travelAndOvertime = calculateTravelAndOvertime(inputs)) {
  const tileProjectType = String(inputs.tileProjectType || "raiseReset");
  const tileTotalRoofSquares = Math.max(0, toNumber(inputs.tileTotalRoofSquares, 0));
  const tileWastePercent = Math.max(0, toNumber(inputs.tileWastePercent, 10));
  const tileBrokenTileAllowancePercent = Math.max(0, toNumber(inputs.tileBrokenTileAllowancePercent, 3));
  const tilePalletYieldSqPerPallet = Math.max(0, toNumber(inputs.tilePalletYieldSqPerPallet, 0));
  const tileValleyLf = Math.max(0, toNumber(inputs.tileValleyLf, 0));
  const tileRidgeLf = Math.max(0, toNumber(inputs.tileRidgeLf, 0));
  const tileHipLf = Math.max(0, toNumber(inputs.tileHipLf, 0));
  const tileDripEdgeLf = Math.max(0, toNumber(inputs.tileDripEdgeLf, 0));
  const tileBattensLf = Math.max(0, toNumber(inputs.tileBattensLf, 0));
  const tileOrderReplacementTile = tileProjectType !== "raiseReset" ? true : Boolean(inputs.tileOrderReplacementTile);
  const adjustedTileSquares = tileOrderReplacementTile
    ? tileTotalRoofSquares * (1 + tileWastePercent / 100) * (1 + tileBrokenTileAllowancePercent / 100)
    : 0;
  const adjustedRoofSquares = tileTotalRoofSquares * (1 + tileWastePercent / 100);
  const tileUnderlaymentType = String(inputs.tileUnderlaymentType || "syntheticTitanium50");
  const tileUnderlaymentCoverageSqPerRoll = tileUnderlaymentType === "felt30" ? 2 : 10;
  const tileUnderlaymentDefaultCost = tileUnderlaymentType === "felt30" ? 30 : 180;
  const tileUnderlaymentRollsCalculated = adjustedRoofSquares > 0 ? Math.ceil(adjustedRoofSquares / tileUnderlaymentCoverageSqPerRoll) : 0;
  const tileUnderlaymentRolls =
    inputs.tileUnderlaymentQuantityManual === "" || inputs.tileUnderlaymentQuantityManual == null
      ? tileUnderlaymentRollsCalculated
      : Math.max(0, toNumber(inputs.tileUnderlaymentQuantityManual, tileUnderlaymentRollsCalculated));
  const tileUnderlayment30CoverageSqPerRoll = 2;
  const tileUnderlayment30RollsCalculated = adjustedRoofSquares > 0 ? Math.ceil(adjustedRoofSquares / tileUnderlayment30CoverageSqPerRoll) : 0;
  const tileUnderlayment30Rolls =
    inputs.tileUnderlayment30QuantityManual === "" || inputs.tileUnderlayment30QuantityManual == null
      ? tileUnderlayment30RollsCalculated
      : Math.max(0, toNumber(inputs.tileUnderlayment30QuantityManual, tileUnderlayment30RollsCalculated));
  const tileBattensQuantityCalculated = tileBattensLf > 0 ? Math.ceil(tileBattensLf / 48) : 0;
  const tileBattensQuantity =
    inputs.tileBattensQuantityManual === "" || inputs.tileBattensQuantityManual == null
      ? tileBattensQuantityCalculated
      : Math.max(0, toNumber(inputs.tileBattensQuantityManual, tileBattensQuantityCalculated));
  const tileValleyMetalQuantityCalculated = tileValleyLf > 0 ? Math.ceil(tileValleyLf / 10) : 0;
  const tileValleyMetalQuantity =
    inputs.tileValleyMetalQuantityManual === "" || inputs.tileValleyMetalQuantityManual == null
      ? tileValleyMetalQuantityCalculated
      : Math.max(0, toNumber(inputs.tileValleyMetalQuantityManual, tileValleyMetalQuantityCalculated));
  const tileDripEdgeQuantityCalculated = tileDripEdgeLf > 0 ? Math.ceil(tileDripEdgeLf / 10) : 0;
  const tileDripEdgeQuantity =
    inputs.tileDripEdgeQuantityManual === "" || inputs.tileDripEdgeQuantityManual == null
      ? tileDripEdgeQuantityCalculated
      : Math.max(0, toNumber(inputs.tileDripEdgeQuantityManual, tileDripEdgeQuantityCalculated));
  const oneHalfPipePenetrations = Math.max(0, Math.round(toNumber(inputs.tileOneHalfPipePenetrations, 0)));
  const twoInchPipePenetrations = Math.max(0, Math.round(toNumber(inputs.tileTwoInchPipePenetrations, 0)));
  const threeInchPipePenetrations = Math.max(0, Math.round(toNumber(inputs.tileThreeInchPipePenetrations, 0)));
  const fourInchPipePenetrations = Math.max(0, Math.round(toNumber(inputs.tileFourInchPipePenetrations, 0)));
  const ovalPipePenetrations = Math.max(0, Math.round(toNumber(inputs.tileOvalPipePenetrations, 0)));
  const americapQuantity = Math.max(0, Math.round(toNumber(inputs.tileAmericapQuantity, 0)));
  const ovalCapQuantity = Math.max(0, Math.round(toNumber(inputs.tileOvalCapQuantity, 0)));
  const oneHalfPipeJackQuantity = oneHalfPipePenetrations;
  const twoInchPipeJackQuantity = twoInchPipePenetrations;
  const threeInchPipeJackQuantity = threeInchPipePenetrations;
  const fourInchPipeJackQuantity = fourInchPipePenetrations;
  const ovalPipeJackQuantity = ovalPipePenetrations;
  const tilePalletsNeeded = tileOrderReplacementTile && tilePalletYieldSqPerPallet > 0 ? Math.ceil(adjustedTileSquares / tilePalletYieldSqPerPallet) : 0;
  const tileOrderingChecklistComplete = Boolean(
    inputs.tileOrderingVerifiedPalletYield &&
      inputs.tileOrderingVerifiedRoofLoadCost &&
      inputs.tileOrderingVerifiedMaterialDeliveryCost &&
      inputs.tileOrderingVerifiedColorProfileAvailability &&
      inputs.tileOrderingVerifiedBrokenAllowance,
  );
  const totalMortarLinearFeet = tileRidgeLf + tileHipLf;
  const mortarBagsCalculated = totalMortarLinearFeet > 0 ? Math.ceil(totalMortarLinearFeet / 22) : 0;
  const mortarBags =
    inputs.tileMortarMixQuantityManual === "" || inputs.tileMortarMixQuantityManual == null
      ? mortarBagsCalculated
      : Math.max(0, toNumber(inputs.tileMortarMixQuantityManual, mortarBagsCalculated));
  const tileProfile = String(inputs.tileProfile || "flat");
  const tileProfileFastenerNameMap = {
    flat: "2-1/2\" Tile Nails",
    lightweight: "2-1/2\" Tile Nails",
    sTile: "3\" Tile Nails",
    claySTile: "3\" Tile Nails",
    custom: String(inputs.tileFastenersName || "Custom Fasteners"),
  };
  const tileProfileRecommendedFastenerSizeMap = {
    flat: "2-1/2\"",
    lightweight: "2-1/2\"",
    sTile: "3\"",
    claySTile: "3\"",
    custom: String(inputs.tileFastenersSize || ""),
  };
  const tileFastenerName = tileProfileFastenerNameMap[tileProfile] || "2-1/2\" Tile Nails";
  const tileFastenerSize = tileProfileRecommendedFastenerSizeMap[tileProfile] || "2-1/2\"";
  const tilesPerSquare = 10;
  const estimatedTileCount = adjustedTileSquares * tilesPerSquare;
  const totalNailsNeededCalculated = estimatedTileCount * Math.max(0, toNumber(inputs.tileFastenersNailsPerTile, 1));
  const fastenerNailsPerBox = Math.max(1, toNumber(inputs.tileFastenersNailsPerBox, 400));
  const fastenerBoxesCalculated = totalNailsNeededCalculated > 0 ? Math.ceil(totalNailsNeededCalculated / fastenerNailsPerBox) : 0;
  const flatTileNailsQuantityCalculated =
    tileProfile === "flat" || tileProfile === "lightweight" ? fastenerBoxesCalculated : 0;
  const sTileNailsQuantityCalculated = tileProfile === "sTile" || tileProfile === "claySTile" ? fastenerBoxesCalculated : 0;
  const flatTileNailsQuantity =
    inputs.tileFlatTileNailsQuantityManual === "" || inputs.tileFlatTileNailsQuantityManual == null
      ? flatTileNailsQuantityCalculated
      : Math.max(0, toNumber(inputs.tileFlatTileNailsQuantityManual, flatTileNailsQuantityCalculated));
  const sTileNailsQuantity =
    inputs.tileSTileNailsQuantityManual === "" || inputs.tileSTileNailsQuantityManual == null
      ? sTileNailsQuantityCalculated
      : Math.max(0, toNumber(inputs.tileSTileNailsQuantityManual, sTileNailsQuantityCalculated));
  const tileFieldTileQuantityManual = inputs.tileFieldTileQuantityManual;
  const fieldTileQuantity = tileOrderReplacementTile
    ? tileFieldTileQuantityManual === "" || tileFieldTileQuantityManual == null
      ? tilePalletsNeeded
      : Math.max(0, toNumber(tileFieldTileQuantityManual, tilePalletsNeeded))
    : 0;
  const productionSquares = tileOrderReplacementTile ? adjustedTileSquares : tileTotalRoofSquares;
  const roofSquareBaseForBidding = productionSquares || tileTotalRoofSquares;
  const tileCustomMaterials = Array.isArray(inputs.tileCustomMaterials) ? inputs.tileCustomMaterials : [];
  const tileCustomMaterialItems = tileCustomMaterials.map((mat, index) => {
    const quantity = Math.max(0, toNumber(mat?.quantity, 0));
    const unitPrice = Math.max(0, toNumber(mat?.unitPrice, 0));
    return {
      key: `tileCustomMaterial-${String(mat?.id || index)}`,
      label: String(mat?.name || `Custom material ${index + 1}`),
      quantity,
      unit: String(mat?.unit || "piece"),
      unitPrice,
      notes: "Custom Tile material order",
    };
  });

  const tileMaterialItems = [
    {
      key: "fieldTile",
      label: "Field Tile",
      quantity: fieldTileQuantity,
      unit: "pallet",
      unitPrice: Math.max(0, toNumber(inputs.tileFieldTileCost, 0)),
      notes: tileOrderReplacementTile
        ? `Adjusted squares: ${num(adjustedTileSquares, 2)} | Verify tile pallet yield before finalizing.`
        : "Replacement tile not included for this project type.",
    },
    {
      key: "tileUnderlayment",
      label: tileUnderlaymentType === "felt30" ? "30# Felt" : "Synthetic Titanium-50 Felt",
      quantity: tileUnderlaymentType === "felt30" ? 0 : tileUnderlaymentRolls,
      unit: "roll",
      unitPrice: Math.max(0, toNumber(inputs.tileUnderlaymentCost, tileUnderlaymentDefaultCost)),
      notes: `Coverage: ${tileUnderlaymentCoverageSqPerRoll} SQ per roll.`,
    },
    {
      key: "tileUnderlayment30",
      label: '30# Underlayment (2 SQ Roll)',
      quantity: tileUnderlaymentType === "felt30" ? tileUnderlayment30Rolls : 0,
      unit: "roll",
      unitPrice: Math.max(0, toNumber(inputs.tileUnderlayment30Cost, 30)),
      notes: "Coverage: 2 SQ per roll.",
    },
    {
      key: "battensLath",
      label: "Batten Strips",
      quantity: tileBattensQuantity,
      unit: "bundle",
      unitPrice: Math.max(0, toNumber(inputs.tileBattensCost, 6)),
      notes: "Yield: 48 LF per bundle.",
    },
    {
      key: "flatTileNails",
      label: '8D 2-1/2" Common Nails',
      quantity: flatTileNailsQuantity,
      unit: "box",
      unitPrice: Math.max(0, toNumber(inputs.tileFlatTileNailsCost, 85)),
      notes: "Nail count: 1,311 nails per box | Profile: Flat Tile | Recommended fastener: 2-1/2\" | Total nails needed: calculated | Boxes needed: calculated",
    },
    {
      key: "sTileNails",
      label: '16D 3-1/2" Common Nails',
      quantity: sTileNailsQuantity,
      unit: "box",
      unitPrice: Math.max(0, toNumber(inputs.tileSTileNailsCost, 85)),
      notes: "Nail count: 1,311 nails per box | Profile: S Tile | Recommended fastener: 3\" | Total nails needed: calculated | Boxes needed: calculated",
    },
    {
      key: "valleyMetal",
      label: "26-Gauge Valley Metal",
      quantity: tileValleyMetalQuantity,
      unit: "10 ft piece",
      unitPrice: Math.max(0, toNumber(inputs.tileValleyMetalCost, 70)),
      notes: "Quantity = ceiling of valley linear feet divided by 10.",
    },
    {
      key: "flashingMetal",
      label: "Drip Edge Galvanized Flashing",
      quantity: tileDripEdgeQuantity,
      unit: "10 ft piece",
      unitPrice: Math.max(0, toNumber(inputs.tileFlashingMetalCost, 11.5)),
      notes: "Quantity = ceiling of drip edge / perimeter linear feet divided by 10.",
    },
    {
      key: "ridgeHipMaterial",
      label: "Ridge / Hip Material",
      quantity: Math.max(0, toNumber(inputs.tileRidgeHipQuantity, 0)),
      unit: "piece",
      unitPrice: Math.max(0, toNumber(inputs.tileRidgeHipCost, 0)),
    },
    {
      key: "mortarMix",
      label: "Mortar Mix (94 lb Bag)",
      quantity: mortarBags,
      unit: "94 lb bag",
      unitPrice: Math.max(0, toNumber(inputs.tileMortarMixCost, 12.5)),
      notes: "Yield: 22 LF per 94 lb bag.",
    },
    {
      key: "tileOneHalfBaseJack",
      label: '1-1/2" Base Jack',
      quantity: oneHalfPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileOneHalfBaseJackCost, 8)),
      notes: '1-1/2" pipe penetrations.',
    },
    {
      key: "tileOneHalfRoofJack",
      label: '1-1/2" Tile Roof Jack',
      quantity: oneHalfPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileOneHalfRoofJackCost, 8)),
      notes: '1-1/2" pipe penetrations.',
    },
    {
      key: "tileTwoInchBaseJack",
      label: '2" Base Jack',
      quantity: twoInchPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileTwoInchBaseJackCost, 8)),
      notes: '2" pipe penetrations.',
    },
    {
      key: "tileTwoInchRoofJack",
      label: '2" Tile Roof Jack',
      quantity: twoInchPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileTwoInchRoofJackCost, 8)),
      notes: '2" pipe penetrations.',
    },
    {
      key: "tileThreeInchBaseJack",
      label: '3" Base Jack',
      quantity: threeInchPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileThreeInchBaseJackCost, 14)),
      notes: '3" pipe penetrations.',
    },
    {
      key: "tileThreeInchRoofJack",
      label: '3" Tile Roof Jack',
      quantity: threeInchPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileThreeInchRoofJackCost, 14)),
      notes: '3" pipe penetrations.',
    },
    {
      key: "tileFourInchBaseJack",
      label: '4" Base Jack',
      quantity: fourInchPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileFourInchBaseJackCost, 15)),
      notes: '4" pipe penetrations.',
    },
    {
      key: "tileFourInchRoofJack",
      label: '4" Tile Roof Jack',
      quantity: fourInchPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileFourInchRoofJackCost, 15)),
      notes: '4" pipe penetrations.',
    },
    {
      key: "tileOvalBaseJack",
      label: "Oval Base Jack",
      quantity: ovalPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileOvalBaseJackCost, 25)),
      notes: "Oval pipe penetrations.",
    },
    {
      key: "tileOvalRoofJack",
      label: "Oval Tile Roof Jack",
      quantity: ovalPipeJackQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileOvalRoofJackCost, 25)),
      notes: "Oval pipe penetrations.",
    },
    {
      key: "tileAmericap",
      label: "Americap",
      quantity: americapQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileAmericapCost, 25)),
    },
    {
      key: "tileOvalCap",
      label: "Oval Cap",
      quantity: ovalCapQuantity,
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileOvalCapCost, 25)),
    },
    {
      key: "ohaginVents",
      label: "O'Hagin Vent",
      quantity: Math.max(0, toNumber(inputs.tileOHaginVentsQuantity, 0)),
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileOHaginVentsCost, 55)),
    },
    {
      key: "dormerVents",
      label: "Dormer Vent",
      quantity: Math.max(0, toNumber(inputs.tileDormerVentsQuantity, 0)),
      unit: "each",
      unitPrice: Math.max(0, toNumber(inputs.tileDormerVentsCost, 80)),
    },
    {
      key: "cdxPlywood",
      label: "CDX 15/32 Plywood",
      quantity: Math.max(0, toNumber(inputs.tileCDXPlywoodQuantity, 0)),
      unit: "sheet",
      unitPrice: Math.max(0, toNumber(inputs.tileCDXPlywoodCost, 27)),
      notes: "Yield: 32 SQFT per sheet.",
    },
    {
      key: "materialDeliveryCharge",
      label: "Material Delivery Charge",
      quantity: Math.max(0, toNumber(inputs.tileMaterialDeliveryChargeQuantity, 1)),
      unit: "job",
      unitPrice: Math.max(0, toNumber(inputs.tileMaterialDeliveryCharge, 0)),
      notes: "Cost to deliver tile and materials to the project site.",
    },
    {
      key: "tileRoofLoadCost",
      label: "Tile Roof Load Cost",
      quantity: Math.max(0, toNumber(inputs.tileRoofLoadCostQuantity, 1)),
      unit: "job",
      unitPrice: Math.max(0, toNumber(inputs.tileRoofLoadCost, 0)),
      notes: "Cost to roof-load tile pallets using forklift, crane, boom truck, conveyor, or supplier roof-loading service.",
    },
    {
      key: "fuelSurcharge",
      label: "Fuel Surcharge",
      quantity: Math.max(0, toNumber(inputs.tileFuelSurchargeQuantity, 1)),
      unit: "fee",
      unitPrice: Math.max(0, toNumber(inputs.tileFuelSurcharge, 0)),
    },
    ...tileCustomMaterialItems,
  ].map((item) => ({
    ...item,
    amount: item.quantity * item.unitPrice,
  }));

  const materialCost = tileMaterialItems.reduce((sum, item) => sum + item.amount, 0);
  const materialDeliveryCharge = tileMaterialItems.find((item) => item.key === "materialDeliveryCharge")?.amount || 0;
  const tileRoofLoadCost = tileMaterialItems.find((item) => item.key === "tileRoofLoadCost")?.amount || 0;

  const tileTearOffSections = normalizeShingleTearOffSections(inputs.tileTearOffSections || [createBlankTileTearOffSection()]);
  const tileTearOffSectionTotals = tileTearOffSections.map((section) => {
    const squares = Math.max(0, toNumber(section.squares, 0));
    const layers = Math.max(1, Math.round(toNumber(section.layers, 1)));
    const tearOffCostPerSquare = Math.max(0, toNumber(section.tearOffCostPerSquare, 0));
    const disposalFee = Math.max(0, toNumber(section.disposalFee, 0));
    const dryRotAllowance = Math.max(0, toNumber(section.dryRotAllowance, 0));
    const sectionTearOffTotal = squares * layers * tearOffCostPerSquare + disposalFee + dryRotAllowance;
    return {
      ...section,
      squares,
      layers,
      tearOffCostPerSquare,
      disposalFee,
      dryRotAllowance,
      sectionTearOffTotal,
    };
  });
  const tearOffDisposalCost = tileTearOffSectionTotals.reduce((sum, section) => sum + section.sectionTearOffTotal, 0);

  const tileLaborType = String(inputs.tileLaborType || "inHouse");
  const laborersPerDay = Math.max(0, Math.round(toNumber(inputs.tileLaborersPerDay, 0)));
  const totalDaysOnJob = Math.max(0, Math.round(toNumber(inputs.tileTotalDaysOnJob, 0)));
  const laborHourlyRate = Math.max(0, toNumber(inputs.tileLaborHourlyRate, 0));
  const hoursPerDay = Math.max(0, toNumber(inputs.tileHoursPerDay, 0));
  const inHouseLaborCost = laborersPerDay * totalDaysOnJob * hoursPerDay * laborHourlyRate;

  const tileSubcontractorLicensed = Boolean(inputs.tileSubcontractorLicensed);
  const tileSubcontractorWorkersComp = Boolean(inputs.tileSubcontractorWorkersComp);
  const tileSubcontractorSections = normalizeShingleLaborSections(inputs.tileSubcontractorSections || [createBlankTileLaborSection()]);
  const tileSubcontractorSectionTotals = tileSubcontractorSections.map((section) => {
    const installSquares = Math.max(0, toNumber(section.installSquares, 0));
    const costPerInstallSq = Math.max(0, toNumber(section.costPerInstallSq, 0));
    const sectionInstallTotal = installSquares * costPerInstallSq;
    return {
      ...section,
      installSquares,
      costPerInstallSq,
      sectionInstallTotal,
    };
  });
  const subcontractorInstallSubtotal = tileSubcontractorSectionTotals.reduce((sum, section) => sum + section.sectionInstallTotal, 0);
  const workersCompRiskAddOn =
    tileLaborType === "subcontracted" && (!tileSubcontractorLicensed || !tileSubcontractorWorkersComp)
      ? subcontractorInstallSubtotal * 0.2
      : 0;
  const totalSubcontractorLaborCost = subcontractorInstallSubtotal + workersCompRiskAddOn;
  const laborCost = tileLaborType === "subcontracted" ? totalSubcontractorLaborCost : inHouseLaborCost;

  const cityPermitFee = Math.max(0, toNumber(inputs.cityPermitFee, 0));
  const overheadPercent = Math.max(0, toNumber(inputs.overheadPercent, 17.5));
  const travelCost = travelAndOvertime.totalTravelCost;
  const directJobCost = materialCost + laborCost + tearOffDisposalCost + travelCost;
  const overheadOperatingRate = overheadPercent / 100;
  const overheadOperatingCost = directJobCost * overheadOperatingRate;
  const totalCostBeforeProfit = directJobCost + overheadOperatingCost + cityPermitFee;
  const totalJobCost = totalCostBeforeProfit;

  const customTotalCharge = Math.max(0, toNumber(inputs.tileCustomBidAmount, 0));
  const customPricePerSq = roofSquareBaseForBidding > 0 ? customTotalCharge / roofSquareBaseForBidding : 0;
  const customProfitDollars = customTotalCharge - totalJobCost;
  const customProfitMarginPercent = totalJobCost > 0 ? (customProfitDollars / totalJobCost) * 100 : 0;
  const useCustomBid = Boolean(customTotalCharge > 0 || inputs.tileCustomBidSelected);
  const bidOptions = calculateBidOptions(
    totalJobCost,
    roofSquareBaseForBidding,
    Math.max(30, Math.min(60, toNumber(inputs.selectedMarkupPercent, 30))),
  );
  const selectedBidAmount = useCustomBid ? customTotalCharge : bidOptions.selectedBidAmount;
  const selectedPricePerSq = useCustomBid ? customPricePerSq : bidOptions.selectedPricePerSq;
  const selectedProfitDollars = useCustomBid ? customProfitDollars : bidOptions.selectedProfitDollars;
  const selectedMarkupPercent = useCustomBid ? (totalJobCost > 0 ? (customProfitDollars / totalJobCost) * 100 : 0) : bidOptions.selectedMarkupPercent;

  return {
    template: "tile",
    estimateType: "Tile",
    jobName: String(inputs.jobName || ""),
    customerName: String(inputs.customerName || ""),
    jobAddress: String(inputs.jobAddress || ""),
    salesperson: String(inputs.salesperson || ""),
    cityPermitFee,
    tileProjectType,
    tileTotalRoofSquares,
    totalSquares: tileTotalRoofSquares,
    tileWastePercent,
    tileBrokenTileAllowancePercent,
    tilePalletYieldSqPerPallet,
    tileOrderReplacementTile,
    tileUnderlaymentType,
    tileAdjustedRoofSquares: adjustedRoofSquares,
    tileUnderlaymentCoverageSqPerRoll,
    tileUnderlaymentRollsCalculated,
    tileUnderlaymentQuantity: tileUnderlaymentRolls,
    tileOrderingVerifiedPalletYield: Boolean(inputs.tileOrderingVerifiedPalletYield),
    tileOrderingVerifiedRoofLoadCost: Boolean(inputs.tileOrderingVerifiedRoofLoadCost),
    tileOrderingVerifiedMaterialDeliveryCost: Boolean(inputs.tileOrderingVerifiedMaterialDeliveryCost),
    tileOrderingVerifiedColorProfileAvailability: Boolean(inputs.tileOrderingVerifiedColorProfileAvailability),
    tileOrderingVerifiedBrokenAllowance: Boolean(inputs.tileOrderingVerifiedBrokenAllowance),
    tileOrderingChecklistComplete,
    tileAdjustedTileSquares: adjustedTileSquares,
    tilePalletsNeeded,
    materialDeliveryCharge,
    tileRoofLoadCost,
    productionSquares,
    materialItems: tileMaterialItems,
    materialCost,
    tileTearOffSections: tileTearOffSectionTotals,
    tileTearOffSectionTotals,
    tearOffDisposalCost,
    tileLaborType,
    tileLaborersPerDay: laborersPerDay,
    tileTotalDaysOnJob: totalDaysOnJob,
    tileLaborHourlyRate: laborHourlyRate,
    tileHoursPerDay: hoursPerDay,
    tileSubcontractorLicensed,
    tileSubcontractorWorkersComp,
    tileSubcontractorSections: tileSubcontractorSectionTotals,
    tileSubcontractorInstallSubtotal: subcontractorInstallSubtotal,
    tileWorkersCompRiskAddOn: workersCompRiskAddOn,
    tileTotalSubcontractorLaborCost: totalSubcontractorLaborCost,
    overheadPercent,
    overheadOperatingRate,
    overheadOperatingCost,
    directJobCost,
    laborCost,
    travelCost,
    totalTravelCost: travelCost,
    travelAndOvertime,
    directJobCost,
    overheadOperatingCost,
    totalCostBeforeProfit,
    totalCost: totalJobCost,
    totalJobCost,
    bidOptions,
    selectedMarkupPercent,
    selectedBidAmount,
    selectedPricePerSq,
    selectedProfitDollars,
    customBidAmount: customTotalCharge,
    customBidSelected: useCustomBid,
    customTotalCharge,
    customPricePerSq,
    customProfitDollars,
    customProfitMarginPercent,
    totalMaterialCost: materialCost,
    totalLaborCost: laborCost,
  };
}

function AddressAutocompleteInput({ value, onChange, isLoaded, loadError, placeholder, hint }) {
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState("");
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (!isLoaded || loadError || !value || String(value).trim().length < 3) {
      setSuggestions([]);
      setSuggestionError("");
      setIsLoadingSuggestions(false);
      return;
    }

    let active = true;
    setIsLoadingSuggestions(true);

    fetchPlacePredictions(String(value).trim())
      .then((items) => {
        if (!active) return;
        setSuggestions(items);
        setSuggestionError("");
      })
      .catch((error) => {
        if (!active) return;
        setSuggestions([]);
        setSuggestionError(error instanceof Error ? error.message : "Unable to load address suggestions.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingSuggestions(false);
      });

    return () => {
      active = false;
    };
  }, [value, isLoaded, loadError]);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input
        type="text"
        placeholder={placeholder || "Type an address"}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {hint ? <em>{hint}</em> : null}
      {isLoadingSuggestions ? <em>Loading suggestions...</em> : null}
      {suggestionError ? <em>{suggestionError}</em> : null}
      {suggestions.length ? (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          {suggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="secondaryButton"
              style={{ textAlign: "left" }}
              onClick={() => onChange?.(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TravelCalculator({
  inputs = {},
  calculation = calculateTravelAndOvertime(inputs),
  isLoaded,
  loadError,
  isLookingUpDistance,
  travelLookupMessage,
  googleDebug,
  onJobSiteAddressChange,
  onOneWayMilesChange,
  onAverageDrivingSpeedChange,
  onWorkHoursPerDayChange,
  onNumberOfJobDaysChange,
  onNumberOfDriversChange,
  onVehicleSelection,
  onAddVehicleSelection,
  onRemoveVehicleSelection,
  onCalculateDistance,
  showLodging = false,
  onLodgingNeededChange,
  onLodgingNameChange,
  onNightlyLodgingCostChange,
  onLodgingNightsChange,
  showGoogleDebug = false,
  oneWayMilesLabel = "One-way miles",
  subtitle = "Use Google Maps when available, with manual fallback always editable.",
}) {
  const safeInputs = inputs || {};
  const lodgingNeeded =
    safeInputs.lodgingNeeded === "Yes" ||
    safeInputs.lodgingNeeded === true ||
    safeInputs.travelLodgingNeeded === "Yes" ||
    safeInputs.travelLodgingNeeded === true ||
    safeInputs.sprayFoamLodgingNeeded === "Yes" ||
    safeInputs.sprayFoamLodgingNeeded === true ||
    calculation.lodgingNeeded;
  const selectedVehicles = normalizeTravelVehicles(safeInputs.travelVehicles || safeInputs.travelVehicle);
  const travelDetails = calculation.travelAndOvertime || {};

  return (
    <Section title="Travel & Overtime Cost" subtitle={subtitle}>
      <p className="emptyState" style={{ marginTop: 0, marginBottom: 12 }}>
        Company HQ, driver rate, fuel cost, and truck MPG are managed in Admin Pricing &gt; Travel Defaults.
      </p>
      <div className="formGrid">
        <Field label="Job site address">
          <AddressAutocompleteInput
            value={safeInputs.jobSiteAddress || ""}
            onChange={onJobSiteAddressChange}
            isLoaded={isLoaded}
            loadError={loadError}
            placeholder="Job site address"
            hint="Enter the finish location or select one of the suggestions."
          />
        </Field>
        {showLodging ? (
          <>
            <Field label="Lodging needed?">
              <select value={lodgingNeeded ? "yes" : "no"} onChange={(e) => onLodgingNeededChange?.(e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            {lodgingNeeded ? (
              <>
                <Field label="Lodging type / name">
                  <input type="text" value={safeInputs.sprayFoamLodgingName || ""} onChange={(e) => onLodgingNameChange?.(e.target.value)} />
                </Field>
                <Field label="Nightly lodging cost">
                  <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={safeInputs.sprayFoamNightlyLodgingCost || 0} onChange={(e) => onNightlyLodgingCostChange?.(e.target.value)} />
                </Field>
                <Field label="Number of nights">
                  <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={safeInputs.sprayFoamLodgingNights || 0} onChange={(e) => onLodgingNightsChange?.(e.target.value)} />
                </Field>
              </>
            ) : null}
          </>
        ) : null}
        <div className="field" style={{ alignSelf: "end" }}>
          {!isLoaded && !loadError ? <em>Google Maps loading...</em> : null}
          {loadError ? <em>Google Maps failed to load: {loadError.message}</em> : null}
          <button type="button" className="secondaryButton" onClick={onCalculateDistance} disabled={!isLoaded || !!loadError || isLookingUpDistance}>
            {isLookingUpDistance ? "Calculating..." : "Calculate Distance"}
          </button>
          {travelLookupMessage ? <em>{travelLookupMessage}</em> : null}
        </div>
        <Field label={`${oneWayMilesLabel} (manual fallback)`}>
          <input
            type="number"
            onWheel={handleNumberInputWheel}
            min="0"
            step="0.1"
            value={safeInputs.oneWayMiles || safeInputs.sprayFoamMilesToLocation || 0}
            onChange={(e) => onOneWayMilesChange?.(e.target.value)}
          />
          <span className="smallNote">Use this when Google Maps is unavailable. Travel cost updates immediately.</span>
        </Field>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Trucks on jobsite</label>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {selectedVehicles.map((selectedVehicle, index) => (
              <div key={`${selectedVehicle}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <select value={selectedVehicle} onChange={(e) => onVehicleSelection?.(index, e.target.value)}>
                  {TRAVEL_VEHICLE_OPTIONS.map((option) => {
                    const otherSelected = selectedVehicles.some((vehicle, vehicleIndex) => vehicle === option.value && vehicleIndex !== index);
                    return (
                      <option key={option.value} value={option.value} disabled={otherSelected}>
                        {option.label} ({option.mpg} mpg)
                      </option>
                    );
                  })}
                </select>
                {selectedVehicles.length > 1 ? (
                  <button type="button" className="secondaryButton" onClick={() => onRemoveVehicleSelection?.(index)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" className="secondaryButton" onClick={onAddVehicleSelection}>
              Add another truck
            </button>
          </div>
        </div>
      </div>

      <div className="detailList" style={{ marginTop: 14 }}>
        <DetailRow label="Job-site address" value={travelDetails.jobSiteAddress || "Not entered"} />
        <DetailRow label="Trucks going to the job" value={travelDetails.travelVehicleLabel || "Not selected"} />
        <DetailRow label="Round-trip distance" value={`${num(travelDetails.roundTripMiles, 1)} miles`} />
        <DetailRow label="Round-trip drive time" value={formatHoursMinutes(travelDetails.roundTripDriveTime)} />
        <DetailRow label="Driver travel cost" value={money2(travelDetails.totalDriverTravelCost)} />
        <DetailRow label="Fuel cost" value={money2(travelDetails.fuelCost)} />
        <DetailRow label="Total travel cost" value={money2(travelDetails.totalTravelCost)} />
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Travel calculation details</summary>
        <div className="formGrid" style={{ marginTop: 12 }}>
          <Field label="Average speed">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={safeInputs.averageDrivingSpeedMph || 0} onChange={(e) => onAverageDrivingSpeedChange?.(e.target.value)} />
          </Field>
          <Field label="Work hours per day">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.1" value={safeInputs.workHoursPerDay || 0} onChange={(e) => onWorkHoursPerDayChange?.(e.target.value)} />
          </Field>
          <Field label="Number of job days">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={safeInputs.numberOfJobDays || 0} onChange={(e) => onNumberOfJobDaysChange?.(e.target.value)} />
          </Field>
          <Field label="Number of drivers">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={safeInputs.numberOfDrivers || 0} onChange={(e) => onNumberOfDriversChange?.(e.target.value)} />
          </Field>
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="HQ address" value={travelDetails.companyHqAddress || "Not entered"} />
          <DetailRow label="One-way miles" value={num(travelDetails.oneWayMiles, 1)} />
          <DetailRow label="Average speed" value={`${num(travelDetails.averageDrivingSpeedMph, 1)} mph`} />
          <DetailRow label="One-way drive time" value={formatHoursMinutes(travelDetails.oneWayDriveTimeHours)} />
          <DetailRow label="Driver hourly rate" value={money2(travelDetails.travelDriverHourlyRate)} />
          {travelDetails.travelVehicleBreakdown?.length ? (
            <DetailRow
              label="Fuel by truck"
              value={travelDetails.travelVehicleBreakdown
                .map((item) => `${item.label}: ${num(item.fuelGallonsNeeded, 2)} gal`)
                .join(" | ")}
            />
          ) : null}
          <DetailRow label="Fuel gallons needed" value={num(travelDetails.fuelGallonsNeeded, 2)} />
          <DetailRow label="Overtime hours per day" value={`${num(travelDetails.overtimeHoursPerDay, 2)} hrs`} />
          <DetailRow label="Overtime pay per day" value={money2(travelDetails.overtimePayPerDay)} />
        </div>
      </details>

      {showGoogleDebug ? (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Developer travel diagnostics</summary>
          <div className="detailList" style={{ marginTop: 10 }}>
            <DetailRow label="Google API key loaded?" value={googleDebug?.apiKeyFound ? "Yes" : "No"} />
            <DetailRow label="Google Maps script loaded?" value={googleDebug?.mapsJsLoaded ? "Yes" : "No"} />
            <DetailRow label="DirectionsService available?" value={googleDebug?.directionsServiceAvailable ? "Yes" : "No"} />
            <DetailRow label="Last Google callback status" value={googleDebug?.lastGoogleStatus || "Unknown"} />
            <DetailRow label="Last element status" value={googleDebug?.lastElementStatus || "Unknown"} />
            <DetailRow label="Last Google error/status" value={googleDebug?.lastError || "None"} />
          </div>
        </details>
      ) : null}

      <div className="detailList" style={{ marginTop: 14 }}>
        {showLodging && lodgingNeeded ? (
          <>
            <DetailRow
              label="Lodging type / name"
              value={calculation.lodgingName || "N/A"}
            />
            <DetailRow label="Nightly lodging cost" value={money2(calculation.nightlyLodgingCost)} />
            <DetailRow label="Lodging nights" value={num(calculation.lodgingNights, 0)} />
            <DetailRow label="Lodging total" value={money2(calculation.lodgingTotal)} />
          </>
        ) : null}
      </div>
    </Section>
  );
}

function OverheadCalculator({
  inputs = {},
  calculation = {},
  onOverheadPercentChange,
  onScopeAddersChange,
  onMiscCostChange,
  title = "Overhead",
  subtitle = "Apply an overhead percentage before markup is calculated.",
}) {
  const overheadPercent = Math.max(0, toNumber(inputs.overheadPercent, 17.5));

  return (
    <Section title={title} subtitle={subtitle}>
      <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 0 }}>
        <div className="summaryCard">
          <span>Direct job cost</span>
          <strong>{money(calculation.directJobCost || 0)}</strong>
        </div>
        <div className="summaryCard">
          <span>Overhead markup</span>
          <strong>{money(calculation.overheadCost || 0)}</strong>
        </div>
        <div className="summaryCard">
          <span>Operating markup</span>
          <strong>{money(calculation.operatingCost || 0)}</strong>
        </div>
        <div className="summaryCard">
          <span>Total before profit</span>
          <strong>{money(calculation.totalCostBeforeProfit || 0)}</strong>
        </div>
      </div>
      <div className="formGrid">
        <Field label="Overhead / operating rate">
          <input
            type="number" onWheel={handleNumberInputWheel}
            min="0"
            step="0.1"
            value={inputs.overheadPercent ?? 17.5}
            onChange={(e) => onOverheadPercentChange?.(e.target.value)}
          />
        </Field>
        <Field label="Scope adders">
          <input
            type="number" onWheel={handleNumberInputWheel}
            min="0"
            step="0.01"
            value={inputs.scopeAdders || 0}
            onChange={(e) => onScopeAddersChange?.(e.target.value)}
          />
        </Field>
        <Field label="Misc cost">
          <input
            type="number" onWheel={handleNumberInputWheel}
            min="0"
            step="0.01"
            value={inputs.miscCost || 0}
            onChange={(e) => onMiscCostChange?.(e.target.value)}
          />
        </Field>
      </div>
    </Section>
  );
}

function App() {
  const getInitialAppearancePreference = () => {
    if (typeof window === "undefined") return "system";
    const stored = String(window.localStorage.getItem(APPEARANCE_PREFERENCE_KEY) || "").toLowerCase();
    return ["light", "dark", "system"].includes(stored) ? stored : "system";
  };

  const [appearancePreference, setAppearancePreference] = useState(getInitialAppearancePreference);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [authUser, setAuthUser] = useState(null);
  const [authRole, setAuthRole] = useState("salesperson");
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] = useState("");
  const [companyUserProfiles, setCompanyUserProfiles] = useState([]);
  const [estimateOwnerAssignments, setEstimateOwnerAssignments] = useState({});
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionMessageType, setSessionMessageType] = useState("");
  const [workHubInitialTab, setWorkHubInitialTab] = useState("tasks");
  const [workHubInitialTaskId, setWorkHubInitialTaskId] = useState("");
  const [workHubInitialCreateTask, setWorkHubInitialCreateTask] = useState(false);
  const [cfoPaymentDiscussionOpeningId, setCfoPaymentDiscussionOpeningId] = useState("");
  const [cfoPaymentDiscussionError, setCfoPaymentDiscussionError] = useState("");
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [profilePhotoMessage, setProfilePhotoMessage] = useState("");
  const [profilePhotoMessageType, setProfilePhotoMessageType] = useState("");
  const profilePhotoInputRef = useRef(null);
  const employeeManagementEditorRef = useRef(null);
  const [travelLookupMessage, setTravelLookupMessage] = useState("");
  const [isLookingUpDistance, setIsLookingUpDistance] = useState(false);
  const [quickMeasureReport, setQuickMeasureReport] = useState(null);
  const [quickMeasureStatus, setQuickMeasureStatus] = useState("");
  const [quickMeasureIsProcessing, setQuickMeasureIsProcessing] = useState(false);
  const quickMeasureFileInputRef = useRef(null);
  const isAdminUser = authRole === "admin";
  const isFinanceUser = authRole === "admin" || authRole === "cfo";
  const isProjectManager = authRole === "project_manager";
  const canManageEmployeeWages = isFinanceUser;
  const canManageSubcontractorCompliance = isFinanceUser || normalizeEmployeeEmail(authUser?.email) === "natalia@crtroofing.com";
  const canManageSharedJobData = canManageSharedJobs(authRole);
  const canManageActiveJobData = canManageActiveJobs(authRole);
  const canUpdateDailyJobCostData = canUpdateDailyJobCosts(authRole, authUser?.email);
  const canCreateApprovedJobData = canCreateApprovedJobs(authRole, authUser?.email);
  const canSubmitInvoiceHandoff = canSubmitJobForInvoice(authRole);
  const canAccessInvoiceQueue = canManageInvoiceQueue(authRole, authUser?.email);
  const canAccessCfoDashboard = isFinanceUser;

  const applySharedJobRows = useCallback((rows = []) => {
    const split = splitSharedJobsByWorkflow(rows);
    setActiveJobs(split.activeJobs);
    setCompletedJobs(split.approvedJobs);
    setPastCompletedJobs(split.completedJobs);
    setArchivedJobs(split.archivedJobs);
  }, []);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setAuthLoading(false);
      setLoginError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    let active = true;
    let sessionAttempt = 0;
    let authSettled = false;

    const finishAuthLoading = () => {
      if (!active) return;
      authSettled = true;
      setAuthLoading(false);
    };

    const startupTimeout = window.setTimeout(() => {
      if (!active || authSettled) return;
      setAuthUser(null);
      setAuthRole("salesperson");
      setLoginError("The sign-in check took too long. Check your internet connection or VPN, then sign in again.");
      finishAuthLoading();
    }, 12000);

    const applySession = async (session) => {
      const attempt = ++sessionAttempt;
      const isCurrentAttempt = () => active && attempt === sessionAttempt;
      if (!isCurrentAttempt()) return;
      if (!session?.user) {
        setAuthUser(null);
        setAuthRole("salesperson");
        setLoginError("");
        finishAuthLoading();
        return;
      }
      const profileTimeout = window.setTimeout(() => {
        if (!isCurrentAttempt() || authSettled) return;
        const fallbackUser = mapAuthUserFromSession(session.user, null);
        setAuthUser(fallbackUser);
        setAuthRole(fallbackUser?.role || "salesperson");
        setSessionMessage("Signed in. Some profile details are still loading.");
        setSessionMessageType("warning");
        finishAuthLoading();
      }, 8000);
      try {
        let { data: profile } = await fetchAuthUserProfile(session.user.id);
        if (!profile) {
          const ensured = await ensureAuthUserProfile(session.user, profile);
          if (!isCurrentAttempt()) return;
          if (ensured?.data) {
            profile = ensured.data;
          } else {
            const refreshed = await fetchAuthUserProfile(session.user.id);
            if (!isCurrentAttempt()) return;
            profile = refreshed.data;
          }
        }
        if (!isCurrentAttempt()) return;
        const mapped = mapAuthUserFromSession(session.user, profile);
        if ((!profile?.role || !String(profile.role).trim()) && mapped?.role) {
          const { data: patchedProfile, error: patchedProfileError } = await supabase
            .from("user_profiles")
            .upsert(
              {
                id: session.user.id,
                email: String(session.user.email || profile?.email || "").trim(),
                full_name: String(profile?.full_name || profile?.display_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || "").trim(),
                role: mapped.role,
              },
              { onConflict: "id" },
            )
            .select("id, full_name, email, role, avatar_path")
            .maybeSingle();
          if (!isCurrentAttempt()) return;
          if (!patchedProfileError && patchedProfile) {
            const patchedMapped = await attachProfilePhotoUrl(mapAuthUserFromSession(session.user, patchedProfile));
            if (!isCurrentAttempt()) return;
            setAuthUser(patchedMapped);
            setAuthRole(patchedMapped?.role || "salesperson");
            setLoginError("");
            finishAuthLoading();
            return;
          }
        }
        const mappedWithPhoto = await attachProfilePhotoUrl(mapped);
        if (!isCurrentAttempt()) return;
        setAuthUser(mappedWithPhoto);
        setAuthRole(mappedWithPhoto?.role || "salesperson");
        setLoginError("");
        finishAuthLoading();
      } catch {
        if (!isCurrentAttempt()) return;
        const fallbackUser = mapAuthUserFromSession(session.user, null);
        setAuthUser(fallbackUser);
        setAuthRole(fallbackUser?.role || "salesperson");
        setSessionMessage("Signed in, but profile details could not be refreshed. Check your connection and reload the page.");
        setSessionMessageType("warning");
        finishAuthLoading();
      } finally {
        window.clearTimeout(profileTimeout);
      }
    };

    supabase.auth.getSession()
      .then(({ data }) => { void applySession(data?.session || null); })
      .catch(() => {
        if (!active) return;
        setAuthUser(null);
        setAuthRole("salesperson");
        setLoginError("The portal could not reach the sign-in service. Check your internet connection or VPN and try again.");
        finishAuthLoading();
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryMode(true);
        setLoginError("");
        setLoginNotice("Enter a new password for your employee account.");
      }
      applySession(session);
    });

    return () => {
      active = false;
      window.clearTimeout(startupTimeout);
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const onFocusIn = (e) => {
      try {
        const t = e.target;
        if (!t || t.tagName !== "INPUT" || t.type !== "number") return;
        const v = String(t.value || "");
        if (/^0+(?:\.0+)?$/.test(v)) {
          t.select();
        }
      } catch (err) {
        // ignore
      }
    };

    const onBlur = (e) => {
      try {
        const t = e.target;
        if (!t || t.tagName !== "INPUT" || t.type !== "number") return;
        if (t.value === "") {
          t.value = "0";
          const ev = new Event("input", { bubbles: true });
          t.dispatchEvent(ev);
        }
      } catch (err) {
        // ignore
      }
    };

    const onWheel = (e) => {
      try {
        const active = document.activeElement;
        if (!active || active.tagName !== "INPUT" || active.type !== "number") return;
        // prevent accidental scroll changes to focused numeric inputs
        active.blur();
        e.preventDefault();
      } catch (err) {
        // ignore
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("wheel", onWheel, { passive: false });
    };
  }, []);
  const [googleDebug, setGoogleDebug] = useState({
    apiKeyFound: Boolean(GOOGLE_MAPS_API_KEY),
    mapsJsLoaded: false,
    directionsServiceAvailable: false,
    lastGoogleStatus: "Not run",
    lastElementStatus: "Not run",
    lastError: "Not run",
  });

  const [inputs, setInputs] = useState(() => DEFAULT_INPUTS);
  const [prices, setPrices] = useState(() => ({ ...DEFAULT_MATERIAL_PRICES }));

  const [estimateName, setEstimateName] = useState(() => "");

  const [savedEstimates, setSavedEstimates] = useState([]);
  const [editingEstimate, setEditingEstimate] = useState(null);
  const [dashboardSavedEstimatesOpen, setDashboardSavedEstimatesOpen] = useState(false);
  const [dashboardSavedEstimateSearch, setDashboardSavedEstimateSearch] = useState("");
  const [templatesSavedEstimatesOpen, setTemplatesSavedEstimatesOpen] = useState(false);
  const [templatesSavedEstimateSearch, setTemplatesSavedEstimateSearch] = useState("");
  const [dashboardApprovedJobsCollapsed, setDashboardApprovedJobsCollapsed] = useState(true);
  const [archivedJobsCollapsed, setArchivedJobsCollapsed] = useState(true);
  const [dashboardCompletedJobsOpen, setDashboardCompletedJobsOpen] = useState(false);
  const [dashboardToolsOpen, setDashboardToolsOpen] = useState(false);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [pastCompletedJobs, setPastCompletedJobs] = useState([]);
  const [completedJobMetrics, setCompletedJobMetrics] = useState([]);
  const [selectedMetricsEstimate, setSelectedMetricsEstimate] = useState(null);
  const [metricsFormData, setMetricsFormData] = useState(null);
  const [selectedApprovedJob, setSelectedApprovedJob] = useState(null);
  const [approvedJobData, setApprovedJobData] = useState(null);
  const [approvedDailyProgressLogs, setApprovedDailyProgressLogs] = useState([]);
  const [approvedAttachmentUploadingDayIds, setApprovedAttachmentUploadingDayIds] = useState([]);
  const [collapsedApprovedDailyProgressDayIds, setCollapsedApprovedDailyProgressDayIds] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [archivedJobs, setArchivedJobs] = useState([]);
  const [activeJobSelectedId, setActiveJobSelectedId] = useState("");
  const [activeJobEditDraft, setActiveJobEditDraft] = useState(null);
  const [activeJobEditMode, setActiveJobEditMode] = useState(false);
  const [activeJobsSearch, setActiveJobsSearch] = useState("");
  const [activeJobsFilters, setActiveJobsFilters] = useState(() => ({
    status: "all",
    contact: "",
    supervisor: "",
    riskLevel: "all",
    startDate: "",
    customer: "",
    openIssues: "all",
    sortBy: "startDate",
    sortDirection: "asc",
  }));
  const [activeJobIssueModalOpen, setActiveJobIssueModalOpen] = useState(false);
  const [activeJobIssueDraft, setActiveJobIssueDraft] = useState(() => createBlankActiveJobIssue());
  const [activeJobIssueResponse, setActiveJobIssueResponse] = useState("");
  const [activeJobIssueSaving, setActiveJobIssueSaving] = useState(false);
  const [fieldUploadBusy, setFieldUploadBusy] = useState(false);
  const [pendingFieldUploads, setPendingFieldUploads] = useState([]);
  const [fieldDailyLogSaving, setFieldDailyLogSaving] = useState(false);
  const [fieldLogsLoading, setFieldLogsLoading] = useState(false);
  const [fieldLogsError, setFieldLogsError] = useState("");
  const [fieldLogsRefresh, setFieldLogsRefresh] = useState(0);
  const fieldUploadLock = useRef(false);
  const fieldDailyLogSaveLock = useRef(false);
  useEffect(() => {
    if (!pendingFieldUploads.length && !fieldUploadBusy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingFieldUploads.length, fieldUploadBusy]);
  const [activeJobIssueHistory, setActiveJobIssueHistory] = useState([]);
  const [activeJobIssueHistoryError, setActiveJobIssueHistoryError] = useState("");
  useEffect(() => {
    if (authUser?.key && activeJobIssueModalOpen) writeJson(`crt_issue_draft:${authUser.key}:${activeJobIssueDraft.projectId}`, { ...activeJobIssueDraft, response: activeJobIssueResponse });
  }, [authUser?.key, activeJobIssueModalOpen, activeJobIssueDraft, activeJobIssueResponse]);
  const [invoiceHandoffJob, setInvoiceHandoffJob] = useState(null);
  const [invoiceHandoffDraft, setInvoiceHandoffDraft] = useState(null);
  const [invoiceHandoffSaving, setInvoiceHandoffSaving] = useState(false);
  const [invoiceHandoffError, setInvoiceHandoffError] = useState("");
  const [approvedJobsSearch, setApprovedJobsSearch] = useState("");
  const [approvedJobsFilters, setApprovedJobsFilters] = useState(() => ({
    customer: "",
    address: "",
    status: "all",
    contact: "",
    startDate: "",
  }));
  const [approvedJobQuickCreateOpen, setApprovedJobQuickCreateOpen] = useState(false);
  const [approvedJobQuickDraft, setApprovedJobQuickDraft] = useState(() => createBlankApprovedJobQuickDraft());
  const [selectedCfoCard, setSelectedCfoCard] = useState("");
  const [cfoDashboardFilters, setCfoDashboardFilters] = useState(() => ({
    search: "",
    dateFrom: "",
    dateTo: "",
    customer: "",
    supplier: "",
    subcontractor: "",
    job: "",
    currentOverdue: "all",
    agingBucket: "all",
    status: "all",
    sortBy: "lastUpdated",
    sortDirection: "desc",
  }));
  const [fieldNotes, setFieldNotes] = useState(() => normalizeFieldNotes(readJson(FIELD_NOTES_DRAFT_KEY(authUser?.key || "guest"), DEFAULT_FIELD_NOTES)));
  const [savedInspections, setSavedInspections] = useState(() => {
    if (!authUser?.key) return [];
    return readJson(INSPECTIONS_KEY(authUser.key), []);
  });
  const [fieldOperationsTab, setFieldOperationsTab] = useState("dailyLog");
  const [fieldDailyLogDraft, setFieldDailyLogDraft] = useState(() => createBlankFieldDailyLog(authUser?.displayName || ""));
  const [fieldDailyLogs, setFieldDailyLogs] = useState([]);
  const [fieldDailyLogSelectedId, setFieldDailyLogSelectedId] = useState("");
  const [fieldDailyLogReviewSearch, setFieldDailyLogReviewSearch] = useState("");
  const [fieldDailyLogFilters, setFieldDailyLogFilters] = useState(() => ({
    dateStart: "",
    dateEnd: "",
    job: "",
    foreman: "",
    employee: "",
    status: "all",
    missingPhotos: false,
    hasOvertime: false,
    hasSafetyIncident: false,
  }));
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
  const [employeeManagementDraft, setEmployeeManagementDraft] = useState(() => createBlankEmployeeRecord());
  const [employeeManagementSearch, setEmployeeManagementSearch] = useState("");
  const [fieldOperationCompanyVehicles, setFieldOperationCompanyVehicles] = useState([]);
  const [fieldOperationsDeviceId, setFieldOperationsDeviceId] = useState(() => readJson(FIELD_DAILY_LOG_DEVICE_KEY, "") || createFieldDailyLogId());
  const [activeTemplate, setActiveTemplate] = useState("dashboard");
  const [adminPricing, setAdminPricing] = useState(() => normalizeAdminPricing(readJson(ADMIN_PRICING_KEY, DEFAULT_ADMIN_PRICING)));
  const [adminTravelSettings, setAdminTravelSettings] = useState(() =>
    normalizeTravelAdminSettings(readJson(ADMIN_TRAVEL_SETTINGS_KEY, DEFAULT_TRAVEL_ADMIN_SETTINGS)),
  );
  const [inspectionTemplateChooserOpen, setInspectionTemplateChooserOpen] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [proposalSelectedId, setProposalSelectedId] = useState("");
  const [proposalSearch, setProposalSearch] = useState("");
  const [proposalFilters, setProposalFilters] = useState(() => ({
    status: "all",
    customer: "",
    address: "",
    salesperson: "",
    sortBy: "updatedAt",
    sortDirection: "desc",
  }));
  const [proposalDraft, setProposalDraft] = useState(() => createBlankProposal());
  const [proposalTemplate, setProposalTemplate] = useState(() => createBlankProposalTemplate());
  const [proposalTemplateDraft, setProposalTemplateDraft] = useState(() => createBlankProposalTemplate());
  const [cfoLiquidCashEntries, setCfoLiquidCashEntries] = useState([]);
  const [cfoLiquidCashDraft, setCfoLiquidCashDraft] = useState(() => createBlankCfoLiquidCashEntry());
  const [cfoLiquidCashEditingId, setCfoLiquidCashEditingId] = useState("");
  const [liquidCashCode, setLiquidCashCode] = useState("");
  const [liquidCashSaving, setLiquidCashSaving] = useState(false);
  const [liquidCashAccess, setLiquidCashAccess] = useState(() => ({
    phase: "hidden",
    challengeId: "",
    challengeExpiresAt: "",
    maskedEmail: "",
    attemptsRemaining: 5,
    revealToken: "",
    revealExpiresAt: "",
    secondsRemaining: 0,
    error: "",
  }));
  const [cfoReceivableEntries, setCfoReceivableEntries] = useState([]);
  const [cfoReceivableDraft, setCfoReceivableDraft] = useState(() => createBlankCfoReceivableEntry());
  const [cfoReceivableEditingId, setCfoReceivableEditingId] = useState("");
  const [cfoReceivablePaymentMessage, setCfoReceivablePaymentMessage] = useState("");
  const [cfoReceivablePaymentMessageType, setCfoReceivablePaymentMessageType] = useState("");
  const [cfoReceivablePaymentSavingId, setCfoReceivablePaymentSavingId] = useState("");
  const [cfoSupplierPaymentMessage, setCfoSupplierPaymentMessage] = useState("");
  const [cfoSupplierPaymentSavingId, setCfoSupplierPaymentSavingId] = useState("");
  const [cfoSupplierPaymentEntry, setCfoSupplierPaymentEntry] = useState(null);
  const [cfoSupplierPaymentDraft, setCfoSupplierPaymentDraft] = useState(() => createBlankSupplierPaymentDraft());
  const [supplierPaymentHistory, setSupplierPaymentHistory] = useState([]);
  const [cfoManualEntriesByCard, setCfoManualEntriesByCard] = useState(() => createBlankCfoManualEntriesByCard());
  const [cfoManualDraftsByCard, setCfoManualDraftsByCard] = useState(() => createBlankCfoManualDraftsByCard());
  const [cfoManualEditingByCard, setCfoManualEditingByCard] = useState(() => createBlankCfoManualEditingByCard());
  const [cfoDeletedSourceRecordUids, setCfoDeletedSourceRecordUids] = useState([]);
  const [estimatorSettingsSyncStatus, setEstimatorSettingsSyncStatus] = useState("idle");
  const [estimatorSettingsSyncError, setEstimatorSettingsSyncError] = useState("");
  const [estimatorSettingsMetadata, setEstimatorSettingsMetadata] = useState(() => ({
    updatedAt: "",
    updatedBy: "",
    rowVersion: 0,
  }));
  const [jobsSyncStatus, setJobsSyncStatus] = useState("idle");
  const [jobsSyncError, setJobsSyncError] = useState("");
  const [activeJobMutationKey, setActiveJobMutationKey] = useState("");
  const [cfoSyncStatus, setCfoSyncStatus] = useState("idle");
  const [cfoSyncError, setCfoSyncError] = useState("");
  const [crmTab, setCrmTab] = useState("quickCapture");
  const [crmLeads, setCrmLeads] = useState([]);
  const [crmLeadSyncStatus, setCrmLeadSyncStatus] = useState("idle");
  const [crmLeadSyncError, setCrmLeadSyncError] = useState("");
  const [crmLeadDeletingId, setCrmLeadDeletingId] = useState("");
  const [crmLeadDocuments, setCrmLeadDocuments] = useState([]);
  const [crmLeadWorkOrderFile, setCrmLeadWorkOrderFile] = useState(null);
  const [crmLeadWorkOrderUploading, setCrmLeadWorkOrderUploading] = useState(false);
  const [crmInspectionSending, setCrmInspectionSending] = useState(false);
  const [crmWeeklyInspectionTarget, setCrmWeeklyInspectionTarget] = useState(6);
  const [crmProposalRequests, setCrmProposalRequests] = useState([]);
  const [crmProposalVersions, setCrmProposalVersions] = useState([]);
  const [crmProposalAuditEvents, setCrmProposalAuditEvents] = useState([]);
  const [crmIvanProfileId, setCrmIvanProfileId] = useState("");
  const [crmDanielaProfileId, setCrmDanielaProfileId] = useState("");
  const [crmLeadDraft, setCrmLeadDraft] = useState(() => createBlankCrmLead());
  const [crmLeadEditingId, setCrmLeadEditingId] = useState("");
  const [crmLeadSearch, setCrmLeadSearch] = useState("");
  const [crmLeadStatusFilter, setCrmLeadStatusFilter] = useState("all");
  const [crmLeadSourceFilter, setCrmLeadSourceFilter] = useState("all");
  const [crmLeadAssigneeFilter, setCrmLeadAssigneeFilter] = useState("all");
  const [crmLeadDateFrom, setCrmLeadDateFrom] = useState("");
  const [crmLeadDateTo, setCrmLeadDateTo] = useState("");
  const [crmLeadSortBy, setCrmLeadSortBy] = useState("createdAt");
  const [crmLeadSortDirection, setCrmLeadSortDirection] = useState("desc");
  const [crmPipelineView, setCrmPipelineView] = useState("table");
  const [crmCustomers, setCrmCustomers] = useState([]);
  const [crmCustomerSaving, setCrmCustomerSaving] = useState(false);
  const [crmCustomerDeletingId, setCrmCustomerDeletingId] = useState("");
  const [crmRecordSyncError, setCrmRecordSyncError] = useState("");
  const [crmCustomerDraft, setCrmCustomerDraft] = useState(() => createBlankCrmCustomer());
  const [crmCustomerEditingId, setCrmCustomerEditingId] = useState("");
  const [crmCustomerSearch, setCrmCustomerSearch] = useState("");
  const [crmSelectedCustomerId, setCrmSelectedCustomerId] = useState("");
  const [crmFollowups, setCrmFollowups] = useState([]);
  const [crmFollowupSaving, setCrmFollowupSaving] = useState(false);
  const [crmFollowupDeletingId, setCrmFollowupDeletingId] = useState("");
  const [crmFollowupDraft, setCrmFollowupDraft] = useState(() => createBlankCrmFollowup());
  const [crmFollowupEditingId, setCrmFollowupEditingId] = useState("");
  const [crmFollowupSearch, setCrmFollowupSearch] = useState("");
  const fieldNotesSyncInitializedRef = useRef(false);
  const fieldOperationsSyncInitializedRef = useRef(false);
  const estimatorSettingsHydratingRef = useRef(false);
  const cfoHydratingRef = useRef(false);
  const estimatorSettingsLastSyncedRef = useRef("");
  const cfoLastSyncedRef = useRef("");
  const cfoLiquidCashEntriesRef = useRef([]);

  const estimatorSettingsCurrentSnapshot = JSON.stringify({ adminPricing, adminTravelSettings });
  const estimatorSettingsHasUnsavedChanges = Boolean(
    estimatorSettingsLastSyncedRef.current
    && estimatorSettingsCurrentSnapshot !== estimatorSettingsLastSyncedRef.current,
  );

  const applyHydratedCfoState = (
    payload,
    {
      preserveLiquidOnEmpty = false,
      resetDrafts = false,
      clearDeleted = false,
    } = {},
  ) => {
    const fallbackManual = createBlankCfoManualEntriesByCard();
    const payloadLiquid = Array.isArray(payload?.liquidCashEntries) ? payload.liquidCashEntries : [];
    const nextLiquid = preserveLiquidOnEmpty && payloadLiquid.length === 0
      ? cfoLiquidCashEntriesRef.current
      : payloadLiquid;
    const nextReceivable = Array.isArray(payload?.receivableEntries) ? payload.receivableEntries : [];
    const nextManual = payload?.manualEntriesByCard || fallbackManual;

    cfoHydratingRef.current = true;
    setCfoLiquidCashEntries(nextLiquid);
    setCfoReceivableEntries(nextReceivable);
    setCfoManualEntriesByCard(nextManual);
    if (resetDrafts) {
      setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
      setCfoLiquidCashEditingId("");
      setCfoReceivableDraft(createBlankCfoReceivableEntry());
      setCfoReceivableEditingId("");
      setCfoManualDraftsByCard(createBlankCfoManualDraftsByCard());
      setCfoManualEditingByCard(createBlankCfoManualEditingByCard());
    }
    if (clearDeleted) {
      setCfoDeletedSourceRecordUids([]);
    }
    cfoLastSyncedRef.current = JSON.stringify(
      flattenCfoNonLiquidCashRecords(nextReceivable, nextManual),
    );
    cfoHydratingRef.current = false;
  };
  const resolvedAppearance = appearancePreference === "system" ? (systemPrefersDark ? "dark" : "light") : appearancePreference;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setSystemPrefersDark(event.matches);
    };
    setSystemPrefersDark(query.matches);
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(APPEARANCE_PREFERENCE_KEY, appearancePreference);
    const root = document.documentElement;
    root.dataset.appearancePreference = appearancePreference;
    root.dataset.appearance = resolvedAppearance;
  }, [appearancePreference, resolvedAppearance]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    cfoLiquidCashEntriesRef.current = cfoLiquidCashEntries;
  }, [cfoLiquidCashEntries]);

  useEffect(() => {
    if (!authUser?.key) return;
    removeKey(CFO_LIQUID_CASH_KEY(authUser.key));
  }, [authUser?.key]);

  useEffect(() => {
    if (liquidCashAccess.phase !== "revealed" || !liquidCashAccess.revealExpiresAt) return undefined;
    let expiryHandled = false;
    const expireReveal = () => {
      if (expiryHandled) return;
      expiryHandled = true;
      const revealToken = liquidCashAccess.revealToken;
      setCfoLiquidCashEntries([]);
      setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
      setCfoLiquidCashEditingId("");
      setLiquidCashCode("");
      setLiquidCashAccess((current) => ({
        ...current,
        phase: "hidden",
        revealToken: "",
        revealExpiresAt: "",
        secondsRemaining: 0,
        error: "",
      }));
      if (revealToken) {
        invokeLiquidCashFunction("liquid-cash-reveal", { action: "hide", revealToken }).catch(() => {});
      }
    };
    const tick = () => {
      const remaining = getRevealSecondsRemaining(liquidCashAccess.revealExpiresAt);
      setLiquidCashAccess((current) => current.phase === "revealed" ? { ...current, secondsRemaining: remaining } : current);
      if (remaining === 0) expireReveal();
    };
    const expiryDelay = Math.max(0, new Date(liquidCashAccess.revealExpiresAt).getTime() - Date.now());
    const interval = window.setInterval(tick, 250);
    const timeout = window.setTimeout(expireReveal, expiryDelay);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [liquidCashAccess.phase, liquidCashAccess.revealExpiresAt, liquidCashAccess.revealToken]);

  useEffect(() => {
    if (!authUser?.key) {
      setActiveJobs([]);
      setArchivedJobs([]);
      setCompletedJobs([]);
      setPastCompletedJobs([]);
      setJobsSyncStatus("idle");
      setJobsSyncError("");
      setProposals([]);
      return;
    }

    let active = true;
    const loadSharedJobData = async (mode = "loading") => {
      setJobsSyncStatus(mode);
      setJobsSyncError("");
      let { data, error } = await fetchSharedJobsFromSupabase();
      if (!active) return;
      if (error) {
        setJobsSyncStatus("error");
        setJobsSyncError(error?.message || String(error));
        console.warn("Shared jobs load failed:", error?.message || error);
        return;
      }

      if ((!data || data.length === 0) && canManageSharedJobData) {
        const localActive = Array.isArray(readJson(ACTIVE_JOBS_KEY(authUser.key), [])) ? readJson(ACTIVE_JOBS_KEY(authUser.key), []) : [];
        const localApproved = Array.isArray(readJson(COMPLETED_JOBS_KEY(authUser.key), [])) ? readJson(COMPLETED_JOBS_KEY(authUser.key), []) : [];
        const migrationCandidates = [...localActive, ...localApproved].filter(Boolean);

        if (migrationCandidates.length) {
          for (const job of migrationCandidates) {
            const payload = {
              ...job,
              workflowStatus: job.workflowStatus || (isActiveJobStatus(job.status) ? "active" : "approved"),
            };
            // eslint-disable-next-line no-await-in-loop
            const migrateRes = await upsertSharedJobToSupabase(payload, authUser.key, authUser.id || authUser.key);
            if (migrateRes.error) {
              console.warn("Shared jobs migration row failed:", migrateRes.error?.message || migrateRes.error);
            }
          }

          ({ data, error } = await fetchSharedJobsFromSupabase());
          if (!error) {
            removeKey(ACTIVE_JOBS_KEY(authUser.key));
            removeKey(COMPLETED_JOBS_KEY(authUser.key));
          }
        }
      }

      if (error) {
        setJobsSyncStatus("error");
        setJobsSyncError(error?.message || String(error));
        return;
      }

      applySharedJobRows(data);
      setJobsSyncStatus("saved");
    };

    loadSharedJobData("loading");
    return () => {
      active = false;
    };
  }, [authUser?.id, authUser?.key, applySharedJobRows, canManageSharedJobData]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(PROPOSALS_KEY(authUser.key), proposals);
  }, [authUser?.key, proposals]);

  useEffect(() => {
    if (!authUser?.key) {
      setCfoLiquidCashEntries([]);
      setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
      setCfoLiquidCashEditingId("");
      setLiquidCashCode("");
      setLiquidCashAccess({
        phase: "hidden",
        challengeId: "",
        challengeExpiresAt: "",
        maskedEmail: "",
        attemptsRemaining: 5,
        revealToken: "",
        revealExpiresAt: "",
        secondsRemaining: 0,
        error: "",
      });
      setCfoReceivableEntries([]);
      setCfoReceivableDraft(createBlankCfoReceivableEntry());
      setCfoReceivableEditingId("");
      setCfoManualEntriesByCard(createBlankCfoManualEntriesByCard());
      setCfoManualDraftsByCard(createBlankCfoManualDraftsByCard());
      setCfoManualEditingByCard(createBlankCfoManualEditingByCard());
      setCfoDeletedSourceRecordUids([]);
      setCfoSyncStatus("idle");
      setCfoSyncError("");
      return;
    }
    let active = true;
    const loadCfoRecords = async () => {
      if (!isFinanceUser) {
        applyHydratedCfoState({
          liquidCashEntries: [],
          receivableEntries: [],
          manualEntriesByCard: createBlankCfoManualEntriesByCard(),
        }, { resetDrafts: true, clearDeleted: true });
        return;
      }
      setCfoSyncStatus("loading");
      setCfoSyncError("");
      const { data, error } = await fetchCompanyFinancialRecordsFromSupabase();
      if (!active) return;
      if (error) {
        setCfoSyncStatus("error");
        setCfoSyncError(error?.message || String(error));
        console.warn("Supabase CFO records load failed:", error?.message || error);
        return;
      }

      if (Array.isArray(data) && data.length) {
        const hydrated = hydrateCfoStateFromSupabaseRecords(data);
        applyHydratedCfoState(hydrated, {
          preserveLiquidOnEmpty: !hasActiveLiquidCashRecord(data),
          resetDrafts: true,
          clearDeleted: true,
        });
        setCfoSyncStatus("saved");
        return;
      }

      applyHydratedCfoState({
        liquidCashEntries: [],
        receivableEntries: cfoReceivableEntries,
        manualEntriesByCard: cfoManualEntriesByCard,
      }, {
        preserveLiquidOnEmpty: true,
        resetDrafts: true,
        clearDeleted: true,
      });
      setCfoSyncStatus("idle");
    };

    loadCfoRecords();
    return () => {
      active = false;
    };
  }, [authUser?.key, isFinanceUser]);

  useEffect(() => {
    if (!authUser?.key || !isFinanceUser) {
      setSupplierPaymentHistory([]);
      return undefined;
    }

    let active = true;
    const loadSupplierPaymentHistory = async () => {
      const { data, error } = await fetchSupplierPaymentHistoryFromSupabase();
      if (!active) return;
      if (error) {
        console.warn("Supplier payment history load failed:", error?.message || error);
        return;
      }
      setSupplierPaymentHistory(data);
    };

    loadSupplierPaymentHistory();
    const channel = supabase
      .channel(`supplier-payment-history-${authUser.key}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "supplier_payment_history" },
        () => loadSupplierPaymentHistory(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [authUser?.key, isFinanceUser]);

  useEffect(() => {
    if (!authUser?.key || !isFinanceUser || cfoHydratingRef.current) return;

    const currentSnapshot = JSON.stringify(
      flattenCfoNonLiquidCashRecords(cfoReceivableEntries, cfoManualEntriesByCard),
    );
    if (currentSnapshot === cfoLastSyncedRef.current && cfoDeletedSourceRecordUids.length === 0) return;

    let active = true;
    const syncCfoRecords = async () => {
      setCfoSyncStatus("saving");
      setCfoSyncError("");
      const records = flattenCfoNonLiquidCashRecords(cfoReceivableEntries, cfoManualEntriesByCard);
      const upsertRes = await upsertCompanyFinancialRecordsToSupabase(records, authUser.id || authUser.key);
      if (!active) return;
      if (upsertRes.error) {
        const errorMessage = upsertRes.error?.message || String(upsertRes.error || "Unknown save error");
        setCfoSyncError(errorMessage);
        setCfoSyncStatus("error");
        console.warn("Supabase CFO records save failed:", errorMessage);
        return;
      }
      if (cfoDeletedSourceRecordUids.length) {
        const archiveRes = await archiveCompanyFinancialRecordsInSupabase(cfoDeletedSourceRecordUids, authUser.id || authUser.key);
        if (!active) return;
        if (archiveRes.error) {
          const errorMessage = archiveRes.error?.message || String(archiveRes.error || "Unknown archive error");
          setCfoSyncError(errorMessage);
          setCfoSyncStatus("error");
          console.warn("Supabase CFO records archive failed:", errorMessage);
          return;
        }
        setCfoDeletedSourceRecordUids([]);
      }

      if (Array.isArray(upsertRes.data) && upsertRes.data.length) {
        const hydratedFromSave = hydrateCfoStateFromSupabaseRecords(upsertRes.data);
        applyHydratedCfoState(hydratedFromSave, {
          preserveLiquidOnEmpty: !hasActiveLiquidCashRecord(upsertRes.data),
        });
      }

      const refetchRes = await fetchCompanyFinancialRecordsFromSupabase();
      if (!active) return;
      if (!refetchRes.error && Array.isArray(refetchRes.data)) {
        const hydrated = hydrateCfoStateFromSupabaseRecords(refetchRes.data);
        applyHydratedCfoState(hydrated, {
          preserveLiquidOnEmpty: !hasActiveLiquidCashRecord(refetchRes.data),
        });
      }

      setCfoSyncError("");
      setCfoSyncStatus("saved");
    };

    syncCfoRecords();
    return () => {
      active = false;
    };
  }, [
    authUser?.id,
    authUser?.key,
    isFinanceUser,
    cfoReceivableEntries,
    cfoManualEntriesByCard,
    cfoDeletedSourceRecordUids,
  ]);

  useEffect(() => {
    if (!authUser?.key) {
      setCrmLeads([]);
      setCrmProposalRequests([]);
      setCrmProposalVersions([]);
      setCrmProposalAuditEvents([]);
      setCrmIvanProfileId("");
      setCrmDanielaProfileId("");
      setCrmLeadDraft(createBlankCrmLead());
      setCrmLeadEditingId("");
      setCrmCustomers([]);
      setCrmCustomerDraft(createBlankCrmCustomer());
      setCrmCustomerEditingId("");
      setCrmSelectedCustomerId("");
      setCrmFollowups([]);
      setCrmFollowupDraft(createBlankCrmFollowup());
      setCrmFollowupEditingId("");
      setCrmRecordSyncError("");
      setCrmLeadSyncStatus("idle");
      setCrmLeadSyncError("");
      return;
    }
    let active = true;
    const localLeads = readJson(CRM_LEADS_KEY(authUser.key), []).map((lead) => normalizeCrmLead({
      ...lead,
      originatorId: lead.originatorId || authUser.key,
      originatorName: lead.originatorName || authUser.displayName || "",
      originatorEmail: lead.originatorEmail || authUser.email || "",
      relationshipOwnerId: lead.relationshipOwnerId || authUser.key,
    }));
    setCrmLeads(localLeads);
    setCrmLeadSyncStatus("loading");
    setCrmLeadSyncError("");
    const localCustomers = readJson(CRM_CUSTOMERS_KEY(authUser.key), []).map(normalizeCrmCustomer);
    const localFollowups = readJson(CRM_FOLLOWUPS_KEY(authUser.key), []).map(normalizeCrmFollowup);
    setCrmCustomers(localCustomers);
    setCrmFollowups(localFollowups);
    setCrmRecordSyncError("");
    setCrmLeadDraft(createBlankCrmLead());
    setCrmLeadEditingId("");
    setCrmCustomerDraft(createBlankCrmCustomer());
    setCrmCustomerEditingId("");
    setCrmSelectedCustomerId("");
    setCrmFollowupDraft(createBlankCrmFollowup());
    setCrmFollowupEditingId("");

    const loadSharedLeads = async () => {
      let remote = await fetchCrmLeadsFromSupabase();
      if (!active) return;
      if (remote.error) {
        setCrmLeadSyncStatus("local");
        setCrmLeadSyncError(remote.error.message || "Shared lead sync is unavailable.");
        return;
      }
      if (!remote.data.length && localLeads.length) {
        const results = await Promise.all(localLeads.map((lead) => upsertCrmLeadToSupabase(lead, authUser)));
        const failed = results.find((result) => result?.error);
        if (failed?.error) {
          if (!active) return;
          setCrmLeadSyncStatus("local");
          setCrmLeadSyncError(failed.error.message || "Legacy leads could not be moved to the shared CRM.");
          return;
        }
        remote = await fetchCrmLeadsFromSupabase();
      }
      if (!active) return;
      if (!remote.error) {
        setCrmLeads(remote.data);
        setCrmLeadSyncStatus("saved");
        setCrmLeadSyncError("");
      }
      let [customerResult, followupResult] = await Promise.all([
        fetchCrmCustomersFromSupabase(),
        fetchCrmFollowupsFromSupabase(),
      ]);
      if (!active) return;
      const recordErrors = [customerResult.error, followupResult.error].filter(Boolean);
      if (recordErrors.length) {
        setCrmRecordSyncError(recordErrors[0].message || "Shared customer records are unavailable.");
      } else {
        const customersMigrated = Boolean(readJson(CRM_CUSTOMERS_MIGRATED_KEY(authUser.key), false));
        if (!customersMigrated) {
          const remoteIds = new Set((customerResult.data || []).map((customer) => customer.id));
          const missingCustomers = localCustomers.filter((customer) => !remoteIds.has(customer.id));
          const results = await Promise.all(missingCustomers.map((customer) => upsertCrmCustomerToSupabase(customer, authUser)));
          const failed = results.find((result) => result?.error);
          if (!failed?.error) {
            writeJson(CRM_CUSTOMERS_MIGRATED_KEY(authUser.key), true);
            customerResult = await fetchCrmCustomersFromSupabase();
          } else {
            setCrmRecordSyncError(failed.error.message || "Existing customer notes could not be moved to the shared CRM.");
          }
        }
        const followupsMigrated = Boolean(readJson(CRM_FOLLOWUPS_MIGRATED_KEY(authUser.key), false));
        if (!followupsMigrated) {
          const remoteIds = new Set((followupResult.data || []).map((followup) => followup.id));
          const missingFollowups = localFollowups.filter((followup) => !remoteIds.has(followup.id));
          const results = await Promise.all(missingFollowups.map((followup) => upsertCrmFollowupToSupabase(followup, authUser)));
          const failed = results.find((result) => result?.error);
          if (!failed?.error) {
            writeJson(CRM_FOLLOWUPS_MIGRATED_KEY(authUser.key), true);
            followupResult = await fetchCrmFollowupsFromSupabase();
          } else {
            setCrmRecordSyncError(failed.error.message || "Existing reminders could not be moved to the shared CRM.");
          }
        }
        if (!customerResult.error) setCrmCustomers(customerResult.data || []);
        if (!followupResult.error) setCrmFollowups(followupResult.data || []);
      }
      const [targetResult, documentResult] = await Promise.all([
        fetchCrmKpiTargetFromSupabase(),
        fetchCrmLeadDocumentsFromSupabase(),
      ]);
      if (!active) return;
      if (!targetResult.error) setCrmWeeklyInspectionTarget(Math.max(1, Number(targetResult.data?.numeric_value) || 6));
      if (!documentResult.error) setCrmLeadDocuments(documentResult.data || []);
      const [proposalResult, versionResult, auditResult, ivanResult, danielaResult] = await Promise.all([
        fetchCrmProposalRequestsFromSupabase(),
        fetchCrmProposalVersionsFromSupabase(),
        fetchCrmProposalAuditEventsFromSupabase(),
        fetchIvanProfileFromSupabase(),
        fetchDanielaProfileFromSupabase(),
      ]);
      if (!active) return;
      if (!proposalResult.error) setCrmProposalRequests(proposalResult.data || []);
      if (!versionResult.error) setCrmProposalVersions(versionResult.data || []);
      if (!auditResult.error) setCrmProposalAuditEvents(auditResult.data || []);
      if (!ivanResult.error) setCrmIvanProfileId(String(ivanResult.data?.id || ""));
      if (!danielaResult.error) setCrmDanielaProfileId(String(danielaResult.data?.id || ""));
    };
    void loadSharedLeads();
    return () => { active = false; };
  }, [authUser?.key]);

  useEffect(() => {
    if (!authUser?.key || !SUPABASE_URL || !SUPABASE_ANON_KEY) return undefined;
    const channel = supabase
      .channel(`crm-proposal-kpis-${authUser.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_requests" }, async () => {
        const result = await fetchCrmProposalRequestsFromSupabase();
        if (!result.error) setCrmProposalRequests(result.data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_versions" }, async () => {
        const result = await fetchCrmProposalVersionsFromSupabase();
        if (!result.error) setCrmProposalVersions(result.data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_request_audit_events" }, async () => {
        const result = await fetchCrmProposalAuditEventsFromSupabase();
        if (!result.error) setCrmProposalAuditEvents(result.data || []);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authUser?.key]);

  useEffect(() => {
    if (!authUser?.key || !SUPABASE_URL || !SUPABASE_ANON_KEY) return undefined;
    const channel = supabase
      .channel(`crm-leads-${authUser.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, async () => {
        const result = await fetchCrmLeadsFromSupabase();
        if (!result.error) {
          setCrmLeads(result.data);
          setCrmLeadSyncStatus("saved");
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_lead_documents" }, async () => {
        const result = await fetchCrmLeadDocumentsFromSupabase();
        if (!result.error) setCrmLeadDocuments(result.data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_customers" }, async () => {
        const result = await fetchCrmCustomersFromSupabase();
        if (!result.error) setCrmCustomers(result.data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_followups" }, async () => {
        const result = await fetchCrmFollowupsFromSupabase();
        if (!result.error) setCrmFollowups(result.data || []);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authUser?.key]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(CRM_LEADS_KEY(authUser.key), crmLeads);
  }, [authUser?.key, crmLeads]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(CRM_CUSTOMERS_KEY(authUser.key), crmCustomers);
  }, [authUser?.key, crmCustomers]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(CRM_FOLLOWUPS_KEY(authUser.key), crmFollowups);
  }, [authUser?.key, crmFollowups]);

  const [nextEstimateNumber, setNextEstimateNumber] = useState(1);

  const [googleMapsStatus, setGoogleMapsStatus] = useState(() => ({
    isLoaded: Boolean(typeof window !== "undefined" && window.google?.maps),
    loadError: null,
  }));
  const shouldLoadGoogleMaps = GOOGLE_MAPS_WORKSPACES.has(activeTemplate);
  const isLoaded = googleMapsStatus.isLoaded || Boolean(typeof window !== "undefined" && window.google?.maps);
  const loadError = googleMapsStatus.loadError;

  const travelPolicy = useMemo(() => normalizeTravelAdminSettings(adminTravelSettings), [adminTravelSettings]);
  const sharedTravelAndOvertime = useMemo(() => calculateTravelAndOvertime(inputs, travelPolicy), [inputs, travelPolicy]);
  const tpoCalculation = useMemo(() => calculateTpoEstimate(inputs, prices, travelPolicy), [inputs, prices, travelPolicy]);
  const sprayFoamCalculation = useMemo(() => calculateSprayFoamEstimate(inputs, travelPolicy), [inputs, travelPolicy]);
  const shingleCalculation = useMemo(() => calculateShingleEstimate(inputs, sharedTravelAndOvertime), [inputs, sharedTravelAndOvertime]);
  const tileCalculation = useMemo(() => calculateTileEstimate(inputs, sharedTravelAndOvertime), [inputs, sharedTravelAndOvertime]);
  const serviceCalculation = useMemo(() => calculateServiceEstimate(inputs, sharedTravelAndOvertime, calculateBidOptions, OVERHEAD_OPERATING_RATE), [inputs, sharedTravelAndOvertime]);
  const calculation = SERVICE_TEMPLATES.includes(activeTemplate) ? serviceCalculation : activeTemplate === "sprayFoam"
    ? sprayFoamCalculation
    : activeTemplate === "shingle"
      ? shingleCalculation
      : activeTemplate === "tile"
        ? tileCalculation
      : tpoCalculation;
  const missingScopeChecklist = useMemo(
    () => (SERVICE_TEMPLATES.includes(activeTemplate) ? [validateServiceEstimate(inputs)].filter(Boolean) : activeTemplate === "sprayFoam" || activeTemplate === "shingle" || activeTemplate === "tile" ? [] : buildMissingScopeChecklist(inputs, prices, tpoCalculation)),
    [activeTemplate, inputs, prices, tpoCalculation],
  );
  const isEstimateComplete = missingScopeChecklist.length === 0;
  const estimateStatusLabel = activeTemplate === "sprayFoam" || activeTemplate === "shingle" || activeTemplate === "tile" ? "Draft" : isEstimateComplete ? "Ready for bid" : "Incomplete";
  const currentEstimateName = estimateName.trim() || buildEstimateNameForTemplate(activeTemplate, inputs);
  const activeSavedEstimates = savedEstimates;
  const filteredDashboardSavedEstimates = useMemo(() => {
    const query = dashboardSavedEstimateSearch.trim().toLowerCase();
    if (!query) return activeSavedEstimates;
    return activeSavedEstimates.filter((estimate) => {
      const haystack = [
        estimate.name,
        estimate.estimateCode,
        estimate.estimateType,
        estimate.inputs?.jobName,
        estimate.inputs?.customerName,
        estimate.inputs?.jobAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeSavedEstimates, dashboardSavedEstimateSearch]);
  const filteredTemplatesSavedEstimates = useMemo(() => {
    const query = templatesSavedEstimateSearch.trim().toLowerCase();
    if (!query) return activeSavedEstimates;
    return activeSavedEstimates.filter((estimate) => {
      const haystack = [
        estimate.name,
        estimate.estimateCode,
        estimate.estimateType,
        estimate.inputs?.jobName,
        estimate.inputs?.customerName,
        estimate.inputs?.jobAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeSavedEstimates, templatesSavedEstimateSearch]);
  const fieldDailyLogSelectedLog = useMemo(
    () => fieldDailyLogs.find((log) => log.id === fieldDailyLogSelectedId) || null,
    [fieldDailyLogs, fieldDailyLogSelectedId],
  );
  const activeFieldOperationEmployees = useMemo(
    () =>
      employeeDirectory.filter((employee) =>
        employee.isActive && String(employee.department || "").toLowerCase() === "field operations",
      ),
    [employeeDirectory],
  );
  const activeFieldOperationForemen = useMemo(
    () =>
      employeeDirectory.filter(
        (employee) =>
          employee.isActive &&
          employee.isForeman &&
          String(employee.department || "").toLowerCase() === "field operations",
      ),
    [employeeDirectory],
  );
  const activeEmployeeDrivers = useMemo(
    () => employeeDirectory.filter((employee) => employee.isActive && employee.isDriver),
    [employeeDirectory],
  );
  const filteredFieldDailyLogs = useMemo(() => {
    const query = fieldDailyLogReviewSearch.trim().toLowerCase();
    return fieldDailyLogs.filter((log) => {
      const totals = calculateFieldDailyLogTotals(log);
      const haystack = [
        log.jobNumber,
        log.jobName,
        log.jobAddress,
        log.foreman,
        log.workCompleted,
        log.materialsUsedText,
        log.equipmentUsed,
        log.delaysOrProblems,
        log.additionalNotes,
        ...(log.crewRows || []).flatMap((row) => [row.employeeName, row.employeeId, row.role]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (fieldDailyLogFilters.dateStart && String(log.workDate || "") < fieldDailyLogFilters.dateStart) return false;
      if (fieldDailyLogFilters.dateEnd && String(log.workDate || "") > fieldDailyLogFilters.dateEnd) return false;
      if (fieldDailyLogFilters.job) {
        const jobQuery = fieldDailyLogFilters.job.trim().toLowerCase();
        if (!`${log.jobNumber || ""} ${log.jobName || ""}`.toLowerCase().includes(jobQuery)) return false;
      }
      if (fieldDailyLogFilters.foreman) {
        const foremanQuery = fieldDailyLogFilters.foreman.trim().toLowerCase();
        if (!String(log.foreman || "").toLowerCase().includes(foremanQuery)) return false;
      }
      if (fieldDailyLogFilters.employee) {
        const employeeQuery = fieldDailyLogFilters.employee.trim().toLowerCase();
        const employeeMatch = (log.crewRows || []).some((row) =>
          `${row.employeeName || ""} ${row.employeeId || ""} ${row.role || ""}`.toLowerCase().includes(employeeQuery),
        );
        if (!employeeMatch) return false;
      }
      if (fieldDailyLogFilters.status !== "all" && String(log.status || "").toLowerCase() !== fieldDailyLogFilters.status) return false;
      if (fieldDailyLogFilters.missingPhotos && fieldDailyLogHasProgressOrCompletedPhoto(log)) return false;
      if (fieldDailyLogFilters.hasOvertime && totals.totalOvertimeHours <= 0) return false;
      if (fieldDailyLogFilters.hasSafetyIncident && !log.safetyIncidents) return false;
      return true;
    });
  }, [fieldDailyLogFilters, fieldDailyLogReviewSearch, fieldDailyLogs]);
  const activeJobsSummary = useMemo(() => {
    const active = activeJobs;
    return {
      totalJobs: activeJobs.length,
      activeCount: active.length,
      criticalCount: activeJobs.filter((job) => String(job.riskLevel || "").toLowerCase() === "critical").length,
      upcoming: [...active]
        .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")))
        .slice(0, 3),
    };
  }, [activeJobs]);
  const filteredActiveJobs = useMemo(() => {
    const query = activeJobsSearch.trim().toLowerCase();
    const filters = activeJobsFilters || {};
    const sortDirection = String(filters.sortDirection || "asc").toLowerCase() === "desc" ? -1 : 1;
    const sortBy = String(filters.sortBy || "startDate");
    return [...activeJobs]
      .filter((job) => {
        if (query && !getActiveJobSearchText(job).includes(query)) return false;
        if (filters.status !== "all" && String(job.status || "") !== filters.status) return false;
        if (filters.riskLevel !== "all" && String(job.riskLevel || "") !== filters.riskLevel) return false;
        if (filters.contact) {
          const contactQuery = filters.contact.trim().toLowerCase();
          const contactHaystack = [
            job.projectContact,
            job.customer,
            job.propertyOwner,
            ...(job.team || []).map((member) => member.name),
            ...(job.outsideContacts || []).map((member) => member.name),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!contactHaystack.includes(contactQuery)) return false;
        }
        if (filters.supervisor) {
          const supervisorQuery = filters.supervisor.trim().toLowerCase();
          if (!String(job.fieldSupervisor || "").toLowerCase().includes(supervisorQuery)) return false;
        }
        if (filters.startDate && String(job.startDate || "") < filters.startDate) return false;
        if (filters.customer) {
          const customerQuery = filters.customer.trim().toLowerCase();
          if (!String(job.customer || job.propertyOwner || "").toLowerCase().includes(customerQuery)) return false;
        }
        if (filters.openIssues !== "all") {
          const openIssues = getActiveJobOpenIssuesCount(job);
          if (filters.openIssues === "yes" && openIssues <= 0) return false;
          if (filters.openIssues === "no" && openIssues > 0) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === "riskLevel") {
          comparison = String(a.riskLevel || "").localeCompare(String(b.riskLevel || ""));
        } else if (sortBy === "status") {
          comparison = String(a.status || "").localeCompare(String(b.status || ""));
        } else if (sortBy === "customer") {
          comparison = String(a.customer || "").localeCompare(String(b.customer || ""));
        } else if (sortBy === "openIssues") {
          comparison = getActiveJobOpenIssuesCount(a) - getActiveJobOpenIssuesCount(b);
        } else {
          comparison = String(a.startDate || "").localeCompare(String(b.startDate || ""));
        }
        return comparison * sortDirection;
      });
  }, [activeJobs, activeJobsFilters, activeJobsSearch]);
  const selectedActiveJob = useMemo(() => activeJobs.find((job) => job.id === activeJobSelectedId) || null, [activeJobs, activeJobSelectedId]);
  const approvedJobsDashboardSource = useMemo(() => completedJobs, [completedJobs]);
  const approvedJobsDashboardSummary = useMemo(() => {
    const active = approvedJobsDashboardSource.filter((job) => !["completed", "closed"].includes(String(job.projectStatus || job.status || "").toLowerCase()));
    const upcoming = [...approvedJobsDashboardSource]
      .sort((a, b) => {
        const aDate = String(a.anticipatedStartDate || "");
        const bDate = String(b.anticipatedStartDate || "");
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      })
      .slice(0, 8);
    return {
      totalJobs: approvedJobsDashboardSource.length,
      activeCount: active.length,
      upcoming,
    };
  }, [approvedJobsDashboardSource]);
  const cfoApprovedJobsLedger = useMemo(
    () => buildCfoApprovedJobsLedger([...completedJobs, ...activeJobs]),
    [activeJobs, completedJobs],
  );
  const filteredApprovedJobs = useMemo(() => {
    const query = approvedJobsSearch.trim().toLowerCase();
    const filters = approvedJobsFilters || {};
    return [...approvedJobsDashboardSource]
      .filter((job) => {
        if (query) {
          const searchText = [
            job.jobNumber,
            job.customerName,
            job.projectName,
            job.projectAddress,
            job.projectStatus,
            job.projectContact,
            job.fieldSupervisor,
            job.permitStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!searchText.includes(query)) return false;
        }
        if (filters.customer) {
          const customerQuery = filters.customer.trim().toLowerCase();
          if (!String(job.customerName || "").toLowerCase().includes(customerQuery)) return false;
        }
        if (filters.address) {
          const addressQuery = filters.address.trim().toLowerCase();
          if (!String(job.projectAddress || "").toLowerCase().includes(addressQuery)) return false;
        }
        if (filters.status !== "all" && String(job.projectStatus || "").toLowerCase() !== String(filters.status).toLowerCase()) return false;
        if (filters.contact) {
          const contactQuery = filters.contact.trim().toLowerCase();
          const contactText = [job.projectContact, job.fieldSupervisor, job.salesperson]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!contactText.includes(contactQuery)) return false;
        }
        if (filters.startDate) {
          const date = String(job.anticipatedStartDate || "");
          if (!date) return false;
          if (date < filters.startDate) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aDate = String(a.anticipatedStartDate || "");
        const bDate = String(b.anticipatedStartDate || "");
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      });
  }, [approvedJobsDashboardSource, approvedJobsFilters, approvedJobsSearch]);
  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === proposalSelectedId) || null,
    [proposalSelectedId, proposals],
  );
  const filteredProposals = useMemo(() => {
    const query = proposalSearch.trim().toLowerCase();
    const filters = proposalFilters || {};
    return [...proposals]
      .filter((proposal) => {
        if (query) {
          const searchText = [
            proposal.proposalNumber,
            proposal.proposalTitle,
            proposal.customerName,
            proposal.projectName,
            proposal.projectAddress,
            proposal.salesperson,
            proposal.status,
            proposal.estimateNumber,
            proposal.estimateCode,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!searchText.includes(query)) return false;
        }
        if (filters.status !== "all" && String(proposal.status || "") !== filters.status) return false;
        if (filters.customer) {
          const customerQuery = filters.customer.trim().toLowerCase();
          if (!String(proposal.customerName || "").toLowerCase().includes(customerQuery)) return false;
        }
        if (filters.address) {
          const addressQuery = filters.address.trim().toLowerCase();
          if (!String(proposal.projectAddress || "").toLowerCase().includes(addressQuery)) return false;
        }
        if (filters.salesperson) {
          const salespersonQuery = filters.salesperson.trim().toLowerCase();
          if (!String(proposal.salesperson || "").toLowerCase().includes(salespersonQuery)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const sortDirection = String(filters.sortDirection || "desc").toLowerCase() === "asc" ? 1 : -1;
        const sortBy = String(filters.sortBy || "updatedAt");
        let comparison = 0;
        if (sortBy === "proposalNumber") {
          comparison = Number(a.proposalNumber || 0) - Number(b.proposalNumber || 0);
        } else if (sortBy === "customer") {
          comparison = String(a.customerName || "").localeCompare(String(b.customerName || ""));
        } else if (sortBy === "status") {
          comparison = String(a.status || "").localeCompare(String(b.status || ""));
        } else {
          comparison = String(a.updatedAt || a.createdAt || "").localeCompare(String(b.updatedAt || b.createdAt || ""));
        }
        return comparison * sortDirection;
      });
  }, [proposalFilters, proposalSearch, proposals]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(DRAFT_KEY(authUser.key), {
      inputs,
      prices,
      estimateName: currentEstimateName,
    });
  }, [authUser, inputs, prices, currentEstimateName]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(FIELD_NOTES_DRAFT_KEY(authUser.key), fieldNotes);
  }, [authUser, fieldNotes]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(INSPECTIONS_KEY(authUser.key), savedInspections);
  }, [authUser, savedInspections]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(FIELD_DAILY_LOG_DEVICE_KEY, fieldOperationsDeviceId);
  }, [authUser, fieldOperationsDeviceId]);

  useEffect(() => {
    if (!authUser?.key) {
      setEmployeeDirectory([]);
      setFieldOperationCompanyVehicles([]);
      return;
    }

    const employeesKey = FIELD_OPERATION_EMPLOYEES_KEY(authUser.key);
    const vehiclesKey = FIELD_OPERATION_COMPANY_VEHICLES_KEY(authUser.key);
    const localEmployees = readJson(employeesKey, []);
    const localVehicles = readJson(vehiclesKey, []);
    const fallbackVehicles = TRAVEL_VEHICLE_OPTIONS.map((vehicle, index) => ({
      id: vehicle.value || `vehicle-${index}`,
      vehicleName: vehicle.label,
      unitNumber: "",
      licensePlate: "",
      mpg: vehicle.mpg || 0,
      active: true,
      vehicleType: vehicle.value,
    }));

    setEmployeeDirectory(Array.isArray(localEmployees) ? localEmployees.map(normalizeEmployeeRecord) : []);
    setFieldOperationCompanyVehicles(
      Array.isArray(localVehicles) && localVehicles.length
        ? localVehicles.map(mapCompanyVehicleRow).filter((row) => row.active)
        : fallbackVehicles,
    );

    let active = true;
    (async () => {
      const [employeeResult, vehicleResult] = await Promise.all([
        fetchFieldOperationEmployeesFromSupabase(authUser.key, canManageEmployeeWages, canUpdateDailyJobCostData),
        fetchCompanyVehiclesFromSupabase(authUser.key),
      ]);
      if (!active) return;
      if (!employeeResult.error && Array.isArray(employeeResult.data) && employeeResult.data.length) {
        setEmployeeDirectory(employeeResult.data.map(normalizeEmployeeRecord));
      } else if (employeeResult.error) {
        console.warn("Field operations employee load failed:", employeeResult.error.message || employeeResult.error);
      }
      if (!vehicleResult.error && Array.isArray(vehicleResult.data) && vehicleResult.data.length) {
        setFieldOperationCompanyVehicles(vehicleResult.data);
      } else if (vehicleResult.error) {
        console.warn("Field operations vehicle load failed:", vehicleResult.error.message || vehicleResult.error);
      }
    })();

    return () => {
      active = false;
    };
  }, [authUser?.key, applySharedJobRows, canManageEmployeeWages, canUpdateDailyJobCostData]);

  useEffect(() => {
    if (!authUser?.key) {
      setFieldDailyLogDraft(createBlankFieldDailyLog(""));
      setFieldDailyLogs([]);
      setFieldDailyLogSelectedId("");
      return;
    }

    const draftKey = FIELD_DAILY_LOG_DRAFT_KEY(authUser.key);
    const logsKey = FIELD_DAILY_LOGS_KEY(authUser.key);
    const draft = normalizeFieldDailyLogDraft(readJson(draftKey, createBlankFieldDailyLog(authUser.displayName || "")), authUser.displayName || "");
    const localLogs = readJson(logsKey, []);

    setFieldDailyLogDraft(draft);
    setFieldDailyLogs(Array.isArray(localLogs) ? localLogs.map((log) => normalizeFieldDailyLogDraft(log, authUser.displayName || "")) : []);
    setFieldDailyLogSelectedId((current) => current || (Array.isArray(localLogs) && localLogs[0]?.id ? localLogs[0].id : ""));
    setFieldOperationsTab("dailyLog");

  }, [authUser?.key, authUser?.displayName]);

  useEffect(() => {
    if (!authUser?.key) return undefined;
    let active = true;
    setFieldLogsLoading(true);
    setFieldLogsError("");
    (async () => {
      try {
        const { data, error } = await fetchFieldDailyLogsFromSupabase();
        if (!active) return;
        if (error) throw error;
        setFieldDailyLogs(data);
        setFieldDailyLogSelectedId(current => data.some(log => log.id === current) ? current : data[0]?.id || "");
      } catch (error) {
        if (!active) return;
        setFieldDailyLogs(current => ownFieldLogsForCache(current, authUser.key));
        setFieldLogsError(error.message || "Unable to refresh daily logs. Try again when connected.");
      } finally {
        if (active) setFieldLogsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [authUser?.key, authRole, fieldOperationsTab, fieldLogsRefresh]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(FIELD_DAILY_LOG_DRAFT_KEY(authUser.key), fieldDailyLogDraft);
  }, [authUser, fieldDailyLogDraft]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(FIELD_DAILY_LOGS_KEY(authUser.key), ownFieldLogsForCache(fieldDailyLogs, authUser.key));
  }, [authUser, fieldDailyLogs]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(FIELD_OPERATION_EMPLOYEES_KEY(authUser.key), employeeDirectory);
  }, [authUser, employeeDirectory]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(FIELD_OPERATION_COMPANY_VEHICLES_KEY(authUser.key), fieldOperationCompanyVehicles);
  }, [authUser, fieldOperationCompanyVehicles]);

  useEffect(() => {
    if (!authUser?.key) {
      setCompanyUserProfiles([]);
      return;
    }
    let active = true;

    const loadRemoteEstimateData = async () => {
      const [{ data: savedData, error: savedError }, { data: nextEstimateValue }] = await Promise.all([
        fetchSavedEstimatesForRole(authUser.key, isAdminUser),
        peekNextEstimateNumberFromSupabase(),
      ]);
      if (!active) return;
      if (!savedError && Array.isArray(savedData)) {
        const estimates = savedData.map(mapEstimateRow).filter(Boolean);
        setSavedEstimates(estimates);
        const highest = Math.max(0, ...estimates.map((estimate) => Number(estimate.estimateNumber) || 0));
        setNextEstimateNumber(Math.max(1, Number(nextEstimateValue) || highest + 1));
      } else {
        const fallback = readJson(SAVED_KEY(authUser.key), []);
        setSavedEstimates(fallback);
        console.warn("Supabase estimates load failed:", savedError?.message || savedError);
      }

      if (isAdminUser) {
        const { data: profiles, error: profilesError } = await fetchCompanyUserProfiles();
        if (!active) return;
        if (!profilesError && Array.isArray(profiles)) {
          setCompanyUserProfiles(profiles);
        } else {
          setCompanyUserProfiles([]);
          if (profilesError) console.warn("Supabase user profile load failed:", profilesError?.message || profilesError);
        }
      } else {
        setCompanyUserProfiles([]);
      }

      const { data: metricsData, error: metricsError } = await fetchCompletedJobMetricsFromSupabase(authUser.key);
      if (!active) return;
      if (!metricsError && Array.isArray(metricsData)) {
        setCompletedJobMetrics(metricsData);
      } else {
        setCompletedJobMetrics([]);
        if (metricsError) console.warn("Supabase metrics load failed:", metricsError?.message || metricsError);
      }
    };

    loadRemoteEstimateData();
    return () => {
      active = false;
    };
  }, [authUser?.key, isAdminUser]);

  useEffect(() => {
    if (!authUser?.key || !SUPABASE_URL || !SUPABASE_ANON_KEY) return undefined;

    const reloadCompanyData = async () => {
      const [settingsRes, cfoRes] = await Promise.all([
        fetchCompanyEstimatorSettingsFromSupabase(),
        isFinanceUser ? fetchCompanyFinancialRecordsFromSupabase() : Promise.resolve({ data: [], error: null }),
      ]);

      if (settingsRes?.data) {
        const mergedPricing = normalizeAdminPricing({
          ...DEFAULT_ADMIN_PRICING,
          ...toPlainObject(settingsRes.data.admin_pricing_defaults, {}),
        });
        const mergedTravel = normalizeTravelAdminSettings({
          ...DEFAULT_TRAVEL_ADMIN_SETTINGS,
          ...toPlainObject(settingsRes.data.travel_defaults, {}),
        });
        estimatorSettingsHydratingRef.current = true;
        setAdminPricing(mergedPricing);
        setAdminTravelSettings(mergedTravel);
        estimatorSettingsHydratingRef.current = false;
        estimatorSettingsLastSyncedRef.current = JSON.stringify({
          adminPricing: mergedPricing,
          adminTravelSettings: mergedTravel,
        });
        writeJson(ADMIN_PRICING_KEY, mergedPricing);
        writeJson(ADMIN_TRAVEL_SETTINGS_KEY, mergedTravel);
        setEstimatorSettingsMetadata({
          updatedAt: String(settingsRes.data.updated_at || ""),
          updatedBy: String(settingsRes.data.updated_by || ""),
          rowVersion: num(settingsRes.data.row_version, 0),
        });
        setEstimatorSettingsSyncError("");
        setEstimatorSettingsSyncStatus("saved");
      }

      if (isFinanceUser && !cfoRes?.error && Array.isArray(cfoRes?.data)) {
        const hydrated = hydrateCfoStateFromSupabaseRecords(cfoRes.data);
        applyHydratedCfoState(hydrated, {
          preserveLiquidOnEmpty: !hasActiveLiquidCashRecord(cfoRes.data),
        });
      } else if (isFinanceUser && cfoRes?.error) {
        setCfoSyncError(cfoRes.error?.message || String(cfoRes.error));
        setCfoSyncStatus("error");
      }
    };

    const settingsChannel = supabase
      .channel(`company-settings-${authUser.key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COMPANY_ESTIMATOR_SETTINGS_TABLE },
        () => reloadCompanyData(),
      )
      .subscribe();

    const financialChannel = supabase
      .channel(`company-financial-${authUser.key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COMPANY_FINANCIAL_RECORDS_TABLE },
        () => reloadCompanyData(),
      )
      .subscribe();

    const handleRefetchTrigger = () => {
      reloadCompanyData();
    };

    window.addEventListener("online", handleRefetchTrigger);
    document.addEventListener("visibilitychange", handleRefetchTrigger);

    return () => {
      window.removeEventListener("online", handleRefetchTrigger);
      document.removeEventListener("visibilitychange", handleRefetchTrigger);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(financialChannel);
    };
  }, [authUser?.key, isFinanceUser]);

  useEffect(() => {
    if (!authUser?.key || !SUPABASE_URL || !SUPABASE_ANON_KEY) return undefined;

    let active = true;
    const reloadSharedJobs = async (status = "refreshing") => {
      setJobsSyncStatus(status);
      const { data, error } = await fetchSharedJobsFromSupabase();
      if (!active) return;
      if (error) {
        setJobsSyncStatus("error");
        setJobsSyncError(error?.message || String(error));
        return;
      }
      applySharedJobRows(data);
      setJobsSyncError("");
      setJobsSyncStatus("saved");
    };

    const jobsChannel = supabase
      .channel(`company-shared-jobs-${authUser.key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: COMPANY_ACTIVE_JOBS_TABLE },
        () => reloadSharedJobs("refreshing"),
      )
      .subscribe();

    const handleOnline = () => {
      reloadSharedJobs("reconnecting");
    };

    const handleOffline = () => {
      setJobsSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleOnline);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleOnline);
      supabase.removeChannel(jobsChannel);
    };
  }, [authUser?.key]);

  useEffect(() => {
    let active = true;

    const loadCompanyEstimatorSettings = async () => {
      if (!authUser?.key) {
        setEstimatorSettingsSyncStatus("idle");
        setEstimatorSettingsSyncError("");
        return;
      }
      setEstimatorSettingsSyncStatus("loading");
      estimatorSettingsHydratingRef.current = true;
      const localPricing = normalizeAdminPricing(readJson(ADMIN_PRICING_KEY, DEFAULT_ADMIN_PRICING));
      const localTravel = normalizeTravelAdminSettings(readJson(ADMIN_TRAVEL_SETTINGS_KEY, DEFAULT_TRAVEL_ADMIN_SETTINGS));
      setAdminPricing(localPricing);
      setAdminTravelSettings(localTravel);

      const { data, error } = await fetchCompanyEstimatorSettingsFromSupabase();
      if (!active) return;
      if (!error && data) {
        const mergedPricing = normalizeAdminPricing({
          ...DEFAULT_ADMIN_PRICING,
          ...toPlainObject(data.admin_pricing_defaults, {}),
        });
        const mergedTravel = normalizeTravelAdminSettings({
          ...DEFAULT_TRAVEL_ADMIN_SETTINGS,
          ...toPlainObject(data.travel_defaults, {}),
        });
        setAdminPricing(mergedPricing);
        setAdminTravelSettings(mergedTravel);
        writeJson(ADMIN_PRICING_KEY, mergedPricing);
        writeJson(ADMIN_TRAVEL_SETTINGS_KEY, mergedTravel);
        estimatorSettingsLastSyncedRef.current = JSON.stringify({
          adminPricing: mergedPricing,
          adminTravelSettings: mergedTravel,
        });
        setEstimatorSettingsMetadata({
          updatedAt: String(data.updated_at || ""),
          updatedBy: String(data.updated_by || ""),
          rowVersion: num(data.row_version, 0),
        });
        setEstimatorSettingsSyncError("");
        setEstimatorSettingsSyncStatus("saved");
      } else {
        estimatorSettingsLastSyncedRef.current = JSON.stringify({
          adminPricing: localPricing,
          adminTravelSettings: localTravel,
        });
        setEstimatorSettingsSyncError(error?.message || "");
        setEstimatorSettingsSyncStatus(error ? "error" : "idle");
      }
      estimatorSettingsHydratingRef.current = false;
    };

    loadCompanyEstimatorSettings();
    return () => {
      active = false;
    };
  }, [authUser?.key]);

  useEffect(() => {
    if (!estimatorSettingsHasUnsavedChanges) return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [estimatorSettingsHasUnsavedChanges]);

  useEffect(() => {
    if (!authUser?.key) {
      setFieldNotes(DEFAULT_FIELD_NOTES);
      setSavedInspections([]);
      setProposals([]);
      setProposalTemplate(createBlankProposalTemplate());
      setProposalTemplateDraft(createBlankProposalTemplate());
      return;
    }

    setFieldNotes(normalizeFieldNotes(readJson(FIELD_NOTES_DRAFT_KEY(authUser.key), DEFAULT_FIELD_NOTES)));
    setSavedInspections(readJson(INSPECTIONS_KEY(authUser.key), []));
    setProposals(loadVisibleProposalsForUser(authUser));
    const savedTemplate = normalizeProposalTemplate(readJson(PROPOSAL_TEMPLATE_KEY(authUser.key), DEFAULT_PROPOSAL_TEMPLATE));
    setProposalTemplate(savedTemplate);
    setProposalTemplateDraft(savedTemplate);
  }, [authUser?.key, authUser?.canViewAllProposals]);

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(PROPOSAL_TEMPLATE_KEY(authUser.key), proposalTemplate);
  }, [authUser?.key, proposalTemplate]);

  useEffect(() => {
    if (!authUser?.key || !proposals.length) return;
    setProposals((current) => {
      let hasChanges = false;
      const nextProposals = current.map((proposal) => {
        if (proposalIsFinalized(proposal)) return proposal;
        const sourceEstimate = findEstimateForProposal(proposal, savedEstimates);
        if (!sourceEstimate) return proposal;
        const syncedProposal = syncProposalWithEstimate(proposal, sourceEstimate, proposalTemplate);
        if (JSON.stringify(proposalComparableSnapshot(proposal)) === JSON.stringify(proposalComparableSnapshot(syncedProposal))) {
          return proposal;
        }
        hasChanges = true;
        return syncedProposal;
      });
      return hasChanges ? nextProposals : current;
    });
  }, [authUser?.key, proposals.length, savedEstimates, proposalTemplate]);

  useEffect(() => {
    if (!fieldNotesSyncInitializedRef.current) {
      fieldNotesSyncInitializedRef.current = true;
      if (!fieldNotes.jobAddress) return;
    }
    setInputs((current) => {
      if ((current.jobAddress || "") === fieldNotes.jobAddress && (current.jobSiteAddress || "") === fieldNotes.jobAddress) {
        return current;
      }
      return {
        ...current,
        jobAddress: fieldNotes.jobAddress,
        jobSiteAddress: fieldNotes.jobAddress,
        travelDistanceSource: "manual",
      };
    });
  }, [fieldNotes.jobAddress]);

  useEffect(() => {
    const defaultHq = String(adminTravelSettings.companyHqAddress || "").trim();
    if (!defaultHq) return;
    setInputs((current) => {
      const currentHq = String(current.companyHqAddress || "").trim();
      if (!currentHq || currentHq === "Fontana, CA" || currentHq === "CRT Roofing office in Fontana, CA") {
        return {
          ...current,
          companyHqAddress: defaultHq,
        };
      }
      return current;
    });
  }, [adminTravelSettings.companyHqAddress]);

  useEffect(() => {
    if (!isLoaded) return;
    const apiKeyFound = Boolean(GOOGLE_MAPS_API_KEY);
    const mapsJsLoaded = !!window.google?.maps;
    const directionsServiceAvailable = !!window.google?.maps?.DirectionsService;
    console.log("Google loaded:", !!window.google);
    console.log("Maps loaded:", mapsJsLoaded);
    console.log("DirectionsService available:", directionsServiceAvailable);
    setGoogleDebug((current) => ({
      ...current,
      apiKeyFound,
      mapsJsLoaded,
      directionsServiceAvailable,
    }));
  }, [isLoaded]);

  useEffect(() => {
    setInputs((current) => {
      if ((current.jobAddress || "") === (current.jobSiteAddress || "")) {
        return current;
      }
      return {
        ...current,
        jobSiteAddress: current.jobAddress || "",
        travelDistanceSource: "manual",
      };
    });
  }, [inputs.jobAddress]);

  const setField = (key, value) => {
    setInputs((current) => ({
      ...current,
      ...(key === "fieldSquares" ? { totalSquares: value } : null),
      ...(key === "jobAddress"
        ? {
            jobSiteAddress: String(value || ""),
            travelDistanceSource: "manual",
          }
        : null),
      [key]: value,
    }));
  };

  const addEstimateLaborEmployee = () => {
    setInputs((current) => ({
      ...current,
      laborEmployeeRows: [
        ...normalizeEstimateLaborEmployeeRows(current.laborEmployeeRows),
        {
          id: createFieldDailyLogId(),
          employeeId: "",
          employeeName: "",
          hourlyRate: 0,
          estimatedHours: 0,
        },
      ],
    }));
  };

  const updateEstimateLaborEmployee = (rowId, key, value) => {
    setInputs((current) => ({
      ...current,
      laborEmployeeRows: normalizeEstimateLaborEmployeeRows(current.laborEmployeeRows).map((row) => {
        if (row.id !== rowId) return row;
        if (key === "employeeId") {
          const employee = employeeDirectory.find((candidate) => candidate.id === value) || null;
          return {
            ...row,
            employeeId: value,
            employeeName: employee?.displayName || buildEmployeeDisplayName(employee || {}) || "",
            hourlyRate: Math.max(0, toNumber(employee?.hourlyRate, 0)),
          };
        }
        return {
          ...row,
          [key]: ["hourlyRate", "estimatedHours"].includes(key) ? Math.max(0, toNumber(value, 0)) : value,
        };
      }),
    }));
  };

  const removeEstimateLaborEmployee = (rowId) => {
    setInputs((current) => ({
      ...current,
      laborEmployeeRows: normalizeEstimateLaborEmployeeRows(current.laborEmployeeRows).filter((row) => row.id !== rowId),
    }));
  };

  const setTravelField = (key, value) => {
    setInputs((current) => ({
      ...current,
      [key]: value,
      travelDistanceSource: "manual",
      ...(key === "numberOfJobDays" ? { sprayFoamEstimatedCompletionDays: value } : {}),
      ...(key === "numberOfJobDays" ? { sprayFoamTotalLaborers: current.sprayFoamTotalLaborers } : {}),
    }));
    setTravelLookupMessage("");
  };

  const setTravelVehicleSelection = (index, vehicleKey) => {
    setInputs((current) => {
      const currentVehicles = normalizeTravelVehicles(current.travelVehicles || current.travelVehicle);
      const sanitizedKey = TRAVEL_VEHICLE_OPTIONS.some((option) => option.value === vehicleKey)
        ? vehicleKey
        : DEFAULT_TRAVEL_VEHICLE_KEY;
      const nextVehicles = currentVehicles.map((value, valueIndex) => (valueIndex === index ? sanitizedKey : value));
      const uniqueVehicles = nextVehicles.filter((value, valueIndex) => nextVehicles.indexOf(value) === valueIndex);
      const finalVehicles = uniqueVehicles.length > 0 ? uniqueVehicles : [DEFAULT_TRAVEL_VEHICLE_KEY];
      return {
        ...current,
        travelVehicles: finalVehicles,
        travelVehicle: finalVehicles[0],
        numberOfDrivers: finalVehicles.length > 1 ? finalVehicles.length : 1,
      };
    });
  };

  const addTravelVehicleSelection = () => {
    setInputs((current) => {
      const currentVehicles = normalizeTravelVehicles(current.travelVehicles || current.travelVehicle);
      const nextVehicles = [...currentVehicles, DEFAULT_TRAVEL_VEHICLE_KEY];
      return {
        ...current,
        travelVehicles: nextVehicles,
        travelVehicle: nextVehicles[0],
        numberOfDrivers: nextVehicles.length > 1 ? nextVehicles.length : 1,
      };
    });
  };

  const removeTravelVehicleSelection = (index) => {
    setInputs((current) => {
      const currentVehicles = normalizeTravelVehicles(current.travelVehicles || current.travelVehicle);
      const nextVehicles = currentVehicles.filter((_, valueIndex) => valueIndex !== index);
      const finalVehicles = nextVehicles.length > 0 ? nextVehicles : [DEFAULT_TRAVEL_VEHICLE_KEY];
      return {
        ...current,
        travelVehicles: finalVehicles,
        travelVehicle: finalVehicles[0],
        numberOfDrivers: finalVehicles.length > 1 ? finalVehicles.length : 1,
      };
    });
  };

  const setSprayFoamLayerConfig = (layerKey, key, value) => {
    setInputs((current) => ({
      ...current,
      sprayFoamLayerConfig: {
        ...normalizeSprayFoamLayerConfig(current.sprayFoamLayerConfig),
        [layerKey]: {
          ...normalizeSprayFoamLayerConfig(current.sprayFoamLayerConfig)[layerKey],
          [key]: value,
        },
      },
    }));
  };

  const setSprayFoamSubcontractorItem = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamSubcontractorItems(current.sprayFoamSubcontractorItems);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "licensed"
                  ? Boolean(value)
                  : key === "quantity" || key === "unitPrice"
                  ? value
                  : value,
            }
          : row,
      );
      return {
        ...current,
        sprayFoamSubcontractorItems: nextRows,
      };
    });
  };

  const setSprayFoamEstimatedDays = (value) => {
    setInputs((current) => ({
      ...current,
      sprayFoamEstimatedCompletionDays: value,
      numberOfJobDays: value,
    }));
  };

  const setSprayFoamDetailMaterial = (itemKey, key, value) => {
    setInputs((current) => ({
      ...current,
      sprayFoamDetailMaterials: {
        ...normalizeSprayFoamDetailMaterials(current.sprayFoamDetailMaterials),
        [itemKey]: {
          ...normalizeSprayFoamDetailMaterials(current.sprayFoamDetailMaterials)[itemKey],
          [key]: value,
        },
      },
    }));
  };

  const addSprayFoamAdditionalDetailMaterial = () => {
    setInputs((current) => ({
      ...current,
      sprayFoamAdditionalDetailMaterials: [
        ...(normalizeSprayFoamAdditionalDetailMaterials(current.sprayFoamAdditionalDetailMaterials) || []),
        createBlankSprayFoamAdditionalDetailMaterial(),
      ],
    }));
  };

  const setSprayFoamAdditionalDetailMaterial = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamAdditionalDetailMaterials(current.sprayFoamAdditionalDetailMaterials);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "quantity" || key === "unitCost"
                  ? value
                  : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        sprayFoamAdditionalDetailMaterials: nextRows,
      };
    });
  };

  const setSprayFoamEquipmentRental = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamEquipmentRentals(current.sprayFoamEquipmentRentals);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "quantity" || key === "days" || key === "hours" || key === "rateAmount"
                  ? value
                  : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        sprayFoamEquipmentRentals: nextRows,
      };
    });
  };

  const addSprayFoamEquipmentRental = () => {
    setInputs((current) => ({
      ...current,
      sprayFoamEquipmentRentals: [
        ...normalizeSprayFoamEquipmentRentals(current.sprayFoamEquipmentRentals),
        createBlankSprayFoamEquipmentRental(),
      ],
    }));
  };

  const setShingleLaborSection = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeShingleLaborSections(current.shingleLaborSections);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "licensed" || key === "workersComp"
                  ? Boolean(value)
                  : key === "installSquares" || key === "costPerInstallSq"
                    ? Math.max(0, toNumber(value, 0))
                    : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        shingleLaborSections: nextRows,
      };
    });
  };

  const addShingleLaborSection = () => {
    setInputs((current) => {
      const rows = normalizeShingleLaborSections(current.shingleLaborSections);
      return {
        ...current,
        shingleLaborSections: [...rows, createBlankShingleLaborSection(rows.length)],
      };
    });
  };

  const setShingleSubcontractorItem = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeShingleSubcontractorItems(current.shingleSubcontractorItems);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: key === "licensed" ? Boolean(value) : value,
            }
          : row,
      );
      return {
        ...current,
        shingleSubcontractorItems: nextRows,
      };
    });
  };

  const addShingleSubcontractorItem = () => {
    setInputs((current) => {
      const rows = normalizeShingleSubcontractorItems(current.shingleSubcontractorItems);
      return {
        ...current,
        shingleSubcontractorItems: [...rows, createBlankShingleSubcontractorItem()],
      };
    });
  };

  const removeShingleSubcontractorItem = (index) => {
    setInputs((current) => {
      const rows = normalizeShingleSubcontractorItems(current.shingleSubcontractorItems);
      const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
      return {
        ...current,
        shingleSubcontractorItems:
          nextRows.length > 0
            ? nextRows
            : [{ ...createBlankShingleSubcontractorItem("Tear-Off Subcontractor") }],
      };
    });
  };

  const removeShingleLaborSection = (index) => {
    setInputs((current) => {
      const rows = normalizeShingleLaborSections(current.shingleLaborSections);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankShingleLaborSection()];
      return {
        ...current,
        shingleLaborSections: nextRows,
      };
    });
  };

  const setShingleTearOffSection = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeShingleTearOffSections(current.shingleTearOffSections);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "layers"
                  ? Math.max(1, Math.round(toNumber(value, 1)))
                  : key === "squares" || key === "tearOffCostPerSquare" || key === "disposalFee" || key === "dryRotAllowance"
                    ? Math.max(0, toNumber(value, 0))
                    : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        shingleTearOffSections: nextRows,
      };
    });
  };

  const addShingleTearOffSection = () => {
    setInputs((current) => {
      const rows = normalizeShingleTearOffSections(current.shingleTearOffSections);
      return {
        ...current,
        shingleTearOffSections: [...rows, createBlankShingleTearOffSection(rows.length)],
      };
    });
  };

  const removeShingleTearOffSection = (index) => {
    setInputs((current) => {
      const rows = normalizeShingleTearOffSections(current.shingleTearOffSections);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankShingleTearOffSection()];
      return {
        ...current,
        shingleTearOffSections: nextRows,
      };
    });
  };

  const setTileTearOffSection = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeShingleTearOffSections(current.tileTearOffSections);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "layers"
                  ? Math.max(1, Math.round(toNumber(value, 1)))
                  : key === "squares" || key === "tearOffCostPerSquare" || key === "disposalFee" || key === "dryRotAllowance"
                    ? Math.max(0, toNumber(value, 0))
                    : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        tileTearOffSections: nextRows,
      };
    });
  };

  const addTileTearOffSection = () => {
    setInputs((current) => {
      const rows = normalizeShingleTearOffSections(current.tileTearOffSections);
      return {
        ...current,
        tileTearOffSections: [...rows, createBlankTileTearOffSection(rows.length)],
      };
    });
  };

  const removeTileTearOffSection = (index) => {
    setInputs((current) => {
      const rows = normalizeShingleTearOffSections(current.tileTearOffSections);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankTileTearOffSection()];
      return {
        ...current,
        tileTearOffSections: nextRows,
      };
    });
  };

  const setTileLaborSection = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeShingleLaborSections(current.tileSubcontractorSections);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "licensed" || key === "workersComp"
                  ? Boolean(value)
                  : key === "installSquares" || key === "costPerInstallSq"
                    ? Math.max(0, toNumber(value, 0))
                    : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        tileSubcontractorSections: nextRows,
      };
    });
  };

  const addTileLaborSection = () => {
    setInputs((current) => {
      const rows = normalizeShingleLaborSections(current.tileSubcontractorSections);
      return {
        ...current,
        tileSubcontractorSections: [...rows, createBlankTileLaborSection(rows.length)],
      };
    });
  };

  const removeTileLaborSection = (index) => {
    setInputs((current) => {
      const rows = normalizeShingleLaborSections(current.tileSubcontractorSections);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankTileLaborSection()];
      return {
        ...current,
        tileSubcontractorSections: nextRows,
      };
    });
  };

  const addTileCustomMaterial = () => {
    setInputs((current) => ({
      ...current,
      tileCustomMaterials: [
        ...(Array.isArray(current.tileCustomMaterials) ? current.tileCustomMaterials : []),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", quantity: 0, unit: "piece", unitPrice: 0 },
      ],
    }));
  };

  const updateTileCustomMaterial = (index, key, value) => {
    setInputs((current) => {
      const list = Array.isArray(current.tileCustomMaterials) ? [...current.tileCustomMaterials] : [];
      list[index] = {
        ...list[index],
        [key]: key === "quantity" || key === "unitPrice" ? Math.max(0, toNumber(value, 0)) : String(value || ""),
      };
      return { ...current, tileCustomMaterials: list };
    });
  };

  const removeTileCustomMaterial = (index) => {
    setInputs((current) => {
      const list = Array.isArray(current.tileCustomMaterials) ? [...current.tileCustomMaterials] : [];
      list.splice(index, 1);
      return { ...current, tileCustomMaterials: list };
    });
  };

  const deleteSprayFoamEquipmentRental = (index) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamEquipmentRentals(current.sprayFoamEquipmentRentals);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankSprayFoamEquipmentRental()];
      return {
        ...current,
        sprayFoamEquipmentRentals: nextRows,
      };
    });
  };

  const deleteSprayFoamAdditionalDetailMaterial = (index) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamAdditionalDetailMaterials(current.sprayFoamAdditionalDetailMaterials);
      rows.splice(index, 1);
      return {
        ...current,
        sprayFoamAdditionalDetailMaterials: rows,
      };
    });
  };

  const setSprayFoamParapetMeasurement = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamParapetMeasurements(current.sprayFoamParapetMeasurements);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      );
      return {
        ...current,
        sprayFoamParapetMeasurements: nextRows,
        sprayFoamParapetWallSquares: calculateSprayFoamParapetMeasurementTotals(nextRows).totalParapetSquares,
      };
    });
  };

  const deleteSprayFoamParapetMeasurement = (index) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamParapetMeasurements(current.sprayFoamParapetMeasurements);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankSprayFoamParapetMeasurement()];
      return {
        ...current,
        sprayFoamParapetMeasurements: nextRows,
        sprayFoamParapetWallSquares: calculateSprayFoamParapetMeasurementTotals(nextRows).totalParapetSquares,
      };
    });
  };

  const addSprayFoamParapetMeasurement = () => {
    setInputs((current) => ({
      ...current,
      sprayFoamParapetMeasurements: (() => {
        const nextRows = [
          ...normalizeSprayFoamParapetMeasurements(current.sprayFoamParapetMeasurements),
          createBlankSprayFoamParapetMeasurement(),
        ];
        return nextRows;
      })(),
      sprayFoamUseMultipleParapetMeasurements: true,
      sprayFoamParapetWallSquares: calculateSprayFoamParapetMeasurementTotals([
        ...normalizeSprayFoamParapetMeasurements(current.sprayFoamParapetMeasurements),
        createBlankSprayFoamParapetMeasurement(),
      ]).totalParapetSquares,
    }));
  };

  const setSprayFoamRoofArea = (index, key, value) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamRoofAreas(current.sprayFoamRoofAreas);
      const nextRows = rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]:
                key === "fieldRoofSquares" || key === "foamThicknessInches" || key === "parapetWallSquares"
                  ? value
                  : key === "hasParapetWalls"
                    ? Boolean(value)
                    : String(value || ""),
            }
          : row,
      );
      return {
        ...current,
        sprayFoamRoofAreas: nextRows,
      };
    });
  };

  const deleteSprayFoamRoofArea = (index) => {
    setInputs((current) => {
      const rows = normalizeSprayFoamRoofAreas(current.sprayFoamRoofAreas);
      const nextRows = rows.length > 1 ? rows.filter((_, rowIndex) => rowIndex !== index) : [createBlankSprayFoamRoofArea()];
      return {
        ...current,
        sprayFoamRoofAreas: nextRows,
      };
    });
  };

  const addSprayFoamRoofArea = () => {
    setInputs((current) => ({
      ...current,
      sprayFoamSeparateRoofAreas: true,
      sprayFoamRoofAreas: [
        ...normalizeSprayFoamRoofAreas(current.sprayFoamRoofAreas),
        createBlankSprayFoamRoofArea(),
      ],
    }));
  };

  const triggerQuickMeasureUpload = () => {
    quickMeasureFileInputRef.current?.click();
  };

  const handleQuickMeasureFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!/pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setQuickMeasureStatus("Please upload a PDF file.");
      return;
    }

    setQuickMeasureIsProcessing(true);
    setQuickMeasureStatus("Reading QuickMeasure PDF...");
    let pdfLoadingTask;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { getDocument } = await loadPdfReader();
      pdfLoadingTask = getDocument({ data: arrayBuffer, isEvalSupported: false });
      const pdf = await pdfLoadingTask.promise;
      let extractedText = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str || "").join(" ");
        extractedText += `${pageText}\n`;
      }

      const fields = extractQuickMeasureFields(extractedText);
      setQuickMeasureReport({
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        pageCount: pdf.numPages,
        extractedText,
        fields,
        appliedTo: "",
      });
      setQuickMeasureStatus(`QuickMeasure report uploaded: ${file.name}. Review before applying.`);
      setSessionMessageType("success");
      setSessionMessage("QuickMeasure report ready for review.");
    } catch (error) {
      console.error("QuickMeasure upload failed:", error);
      setQuickMeasureReport(null);
      setQuickMeasureStatus(`QuickMeasure upload failed: ${error?.message || String(error)}`);
      setSessionMessageType("error");
      setSessionMessage(`QuickMeasure upload failed: ${error?.message || String(error)}`);
    } finally {
      await pdfLoadingTask?.destroy().catch(() => {});
      setQuickMeasureIsProcessing(false);
    }
  };

  const applyQuickMeasureToTemplate = (templateKey) => {
    if (!quickMeasureReport) return;

    const report = quickMeasureReport;
    const fields = report.fields || {};
    const propertyAddress = String(fields.propertyAddress || "").trim();
    const roofSquares =
      toNumber(fields.totalSquares, 0) > 0
        ? toNumber(fields.totalSquares, 0)
        : toNumber(fields.totalRoofArea, 0) > 0
          ? Math.ceil(toNumber(fields.totalRoofArea, 0) / 100)
          : 0;
    const perimeterLf = toNumber(
      fields.perimeterLinearFeet,
      toNumber(fields.dripEdgeLinearFeet, toNumber(fields.eaveLinearFeet, 0) + toNumber(fields.rakeLinearFeet, 0)),
    );
    const ridgeHipLf = toNumber(fields.ridgeHipLinearFeet, 0);
    const ridgeLf = fields.ridgeLinearFeet !== null && fields.ridgeLinearFeet !== undefined ? toNumber(fields.ridgeLinearFeet, 0) : ridgeHipLf;
    const hipLf = fields.hipLinearFeet !== null && fields.hipLinearFeet !== undefined ? toNumber(fields.hipLinearFeet, 0) : ridgeHipLf > 0 && fields.ridgeLinearFeet === null ? 0 : 0;
    const valleyLf = toNumber(fields.valleyLinearFeet, 0);
    const rakeLf = toNumber(fields.rakeLinearFeet, 0);
    const eaveLf = toNumber(fields.eaveLinearFeet, 0);
    const dripEdgeLf = toNumber(fields.dripEdgeLinearFeet, 0);
    const starterLf = toNumber(fields.starterLinearFeet, dripEdgeLf);
    const starterQuantitySuggested = toNumber(fields.shingleStarterQuantity, 0);
    const dripEdgePiecesSuggested = toNumber(fields.shingleDripEdgePieces, 0);
    const rapidRidgeBoxesSuggested = toNumber(fields.shingleRapidRidgeBoxes, 0);
    const hdzBundlesSuggested = toNumber(fields.shingleHdzBundlesNeeded, 0);
    const underlaymentRollsSuggested = toNumber(fields.shingleSyntheticUnderlaymentSuggestedRolls || fields.shingleSyntheticUnderlaymentRolls, 0);
    const currentWastePercent = Math.max(0, toNumber(quickMeasureReport?.appliedValues?.wastePercent ?? fields.wastePercent, 15));
    const nextProductionSquares = roofSquares * (1 + currentWastePercent / 100);
    const underlaymentRollsCalculated = Math.max(0, Math.ceil(nextProductionSquares / 10));
    const underlaymentRollsFinal = underlaymentRollsSuggested > 0 ? underlaymentRollsSuggested : underlaymentRollsCalculated;
    const starterQuantityFallback = dripEdgeLf > 0 ? dripEdgeLf : perimeterLf;
    const starterQuantityFinal = starterQuantitySuggested > 0 ? starterQuantitySuggested : starterQuantityFallback;
    const dripEdgePiecesCalculated = Math.max(0, Math.ceil((dripEdgeLf > 0 ? dripEdgeLf : perimeterLf) / 10));
    const dripEdgePiecesFinal = dripEdgePiecesSuggested > 0 ? dripEdgePiecesSuggested : dripEdgePiecesCalculated;
    const totalRidgeCapLf = ridgeHipLf > 0 ? ridgeHipLf : ridgeLf + hipLf;
    const rapidRidgeBoxesCalculated = totalRidgeCapLf > 0 ? Math.ceil(totalRidgeCapLf / 20) : 0;
    const rapidRidgeBoxesFinal = rapidRidgeBoxesSuggested > 0 ? rapidRidgeBoxesSuggested : rapidRidgeBoxesCalculated;
    const quickMeasureData = {
      address: propertyAddress,
      totalSquares: roofSquares,
      dripEdgePieces: dripEdgePiecesFinal,
      dripEdgeLinearFeet: dripEdgeLf,
      proStartQuantity: starterQuantityFinal,
      rapidRidgeBoxes: rapidRidgeBoxesFinal,
      ridgeHipLinearFeet: ridgeHipLf,
      ridgeLinearFeet: ridgeLf,
      hipLinearFeet: hipLf,
      valleyLinearFeet: valleyLf,
      rakeLinearFeet: rakeLf,
      eaveLinearFeet: eaveLf,
    };
    const appliedFieldPairs = [
      ["shingleHdzBundlesNeeded", hdzBundlesSuggested > 0 ? hdzBundlesSuggested : 0],
      ["shingleStarterQuantity", starterQuantityFinal],
      ["shingleDripEdgePieces", dripEdgePiecesFinal],
      ["shingleRapidRidgeBoxes", rapidRidgeBoxesFinal],
      ["shingleSyntheticUnderlaymentSuggestedRolls", underlaymentRollsSuggested > 0 ? underlaymentRollsSuggested : 0],
      ["shingleSyntheticUnderlaymentCalculatedRolls", underlaymentRollsCalculated],
      ["shingleSyntheticUnderlaymentRolls", underlaymentRollsFinal],
      ["shingleTotalRoofSquares", roofSquares],
      ["shingleProductionSquares", nextProductionSquares],
    ];
    const nextAppliedAt = new Date().toISOString();
    console.log("QuickMeasure extracted values", fields);
    console.log("QuickMeasure material suggestions", shingleMaterialSuggestions);
    console.log("QuickMeasure values being applied", {
      templateKey,
      propertyAddress,
      roofSquares,
      perimeterLf,
      ridgeHipLf,
      ridgeLf,
      hipLf,
      valleyLf,
      rakeLf,
      eaveLf,
      dripEdgeLf,
      starterLf,
      starterQuantitySuggested,
      starterQuantityFallback,
      starterQuantityFinal,
      dripEdgePiecesSuggested,
      dripEdgePiecesCalculated,
      dripEdgePiecesFinal,
      rapidRidgeBoxesSuggested,
      totalRidgeCapLf,
      rapidRidgeBoxesCalculated,
      rapidRidgeBoxesFinal,
      hdzBundlesSuggested,
      underlaymentRollsSuggested,
      underlaymentRollsCalculated,
      underlaymentRollsFinal,
      appliedFieldPairs,
    });

    if (templateKey === "shingle") {
      setInputs((current) => ({
        ...current,
        jobName: quickMeasureData.address || current.jobName,
        jobAddress: quickMeasureData.address || current.jobAddress,
        shingleJobName: quickMeasureData.address || current.shingleJobName || current.jobName,
        shingleJobAddress: quickMeasureData.address || current.shingleJobAddress || current.jobAddress,
        shingleTotalRoofSquares: quickMeasureData.totalSquares || current.shingleTotalRoofSquares,
        shingleProductionSquares: quickMeasureData.totalSquares || current.shingleProductionSquares,
        shingleDripEdgePieces: quickMeasureData.dripEdgePieces || quickMeasureData.dripEdgeLinearFeet || current.shingleDripEdgePieces,
        shingleStarterQuantity: quickMeasureData.proStartQuantity || current.shingleStarterQuantity,
        shingleRapidRidgeBoxes: quickMeasureData.rapidRidgeBoxes || current.shingleRapidRidgeBoxes,
        shingleRidgeHipLinearFeet: quickMeasureData.ridgeHipLinearFeet || current.shingleRidgeHipLinearFeet,
        shingleValleyLinearFeet: quickMeasureData.valleyLinearFeet || current.shingleValleyLinearFeet,
        shingleRakeLinearFeet: quickMeasureData.rakeLinearFeet || current.shingleRakeLinearFeet,
        shingleEaveLinearFeet: quickMeasureData.eaveLinearFeet || current.shingleEaveLinearFeet,
        shingleRidgeLinearFeet: quickMeasureData.ridgeLinearFeet || current.shingleRidgeLinearFeet,
        shingleHipLinearFeet: quickMeasureData.hipLinearFeet || current.shingleHipLinearFeet,
        shinglePerimeterLinearFeet: quickMeasureData.dripEdgeLinearFeet || current.shinglePerimeterLinearFeet,
        shingleDripEdgeLinearFeet: quickMeasureData.dripEdgeLinearFeet || current.shingleDripEdgeLinearFeet,
        shingleHdzBundlesNeeded: hdzBundlesSuggested > 0 ? hdzBundlesSuggested : current.shingleHdzBundlesNeeded,
        shingleSyntheticUnderlaymentSuggestedRolls: underlaymentRollsSuggested > 0 ? underlaymentRollsSuggested : current.shingleSyntheticUnderlaymentSuggestedRolls,
        shingleSyntheticUnderlaymentCalculatedRolls: underlaymentRollsCalculated || current.shingleSyntheticUnderlaymentCalculatedRolls,
        shingleSyntheticUnderlaymentRolls: underlaymentRollsFinal || current.shingleSyntheticUnderlaymentRolls,
      }));

      setQuickMeasureReport((current) =>
        current
          ? {
              ...current,
              appliedTo: templateKey,
              appliedAt: nextAppliedAt,
              appliedValues: {
                ...appliedFieldPairs.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
              },
            }
          : current,
      );

      console.log("Applied QuickMeasure to shingle", quickMeasureData);
      setActiveTemplate("shingle");
      setQuickMeasureStatus("QuickMeasure data applied to Shingle Estimate.");
      setSessionMessageType("success");
      setSessionMessage("QuickMeasure data applied to Shingle Estimate.");
      return;
    }

    setInputs((current) => {
      const next = { ...current };
      const currentWastePercent = Math.max(0, toNumber(current.shingleWastePercent, 15));
      const nextProductionSquares = roofSquares * (1 + currentWastePercent / 100);

      if (templateKey === "tpo") {
        next.fieldSquares = roofSquares;
        next.totalSquares = roofSquares;
        next.roofPerimeterLf = perimeterLf || next.roofPerimeterLf;
      } else if (templateKey === "sprayFoam") {
        next.sprayFoamFieldRoofSquares = roofSquares;
        next.sprayFoamParapetWallSquares = 0;
        next.sprayFoamUseMultipleParapetMeasurements = false;
        next.sprayFoamParapetMeasurements = [createBlankSprayFoamParapetMeasurement()];
        next.sprayFoamTotalFieldSquares = roofSquares;
        next.sprayFoamTotalRoofSquares = roofSquares;
        next.totalSquares = roofSquares;
        next.fieldSquares = roofSquares;
      } else if (templateKey === "tile" || templateKey === "shingle" || templateKey === "coating" || templateKey === "repair") {
        next.totalSquares = roofSquares;
        next.fieldSquares = roofSquares;
      }

      if (templateKey === "shingle") {
        if (propertyAddress) {
          next.jobName = propertyAddress;
          next.shingleJobName = propertyAddress;
          next.jobAddress = propertyAddress;
          next.shingleJobAddress = propertyAddress;
        }
        next.shingleTotalRoofSquares = roofSquares;
        next.shingleProductionSquares = nextProductionSquares;
        next.shingleHdzBundlesNeeded = hdzBundlesSuggested > 0 ? hdzBundlesSuggested : next.shingleHdzBundlesNeeded || 0;
        next.shingleSyntheticUnderlaymentSuggestedRolls = underlaymentRollsSuggested > 0 ? underlaymentRollsSuggested : 0;
        next.shingleSyntheticUnderlaymentCalculatedRolls = underlaymentRollsCalculated;
        next.shingleSyntheticUnderlaymentRolls = underlaymentRollsFinal;
        next.shingleStarterQuantity = starterQuantityFinal;
        next.shingleDripEdgePieces = dripEdgePiecesFinal;
        next.shingleRapidRidgeBoxes = rapidRidgeBoxesFinal;
        next.shinglePerimeterLinearFeet = perimeterLf;
        next.shingleDripEdgeLinearFeet = dripEdgeLf || perimeterLf;
        next.shingleStarterLinearFeet = starterLf || dripEdgeLf || perimeterLf;
        next.shingleRidgeLinearFeet = ridgeLf;
        next.shingleHipLinearFeet = hipLf;
        next.shingleRidgeHipLinearFeet = ridgeHipLf;
        next.shingleValleyLinearFeet = valleyLf;
        next.shingleRakeLinearFeet = rakeLf;
        next.shingleEaveLinearFeet = eaveLf;
        next.shingleDripEdgeLf = dripEdgeLf || perimeterLf;
        next.shingleStarterLf = starterLf || dripEdgeLf || perimeterLf;
        next.shingleRidgeLf = ridgeLf;
        next.shingleHipLf = hipLf;
        next.shingleValleyLf = valleyLf;
        next.shingleRakeLf = rakeLf;
        next.shingleEaveLf = eaveLf;
        next.shingleTotalRoofSquares = roofSquares;

        console.log("Updated shingle input state", {
          jobName: next.jobName,
          jobAddress: next.jobAddress,
          shingleJobName: next.shingleJobName,
          shingleJobAddress: next.shingleJobAddress,
          shingleTotalRoofSquares: next.shingleTotalRoofSquares,
          shingleProductionSquares: next.shingleProductionSquares,
          shingleHdzBundlesNeeded: next.shingleHdzBundlesNeeded,
          shingleSyntheticUnderlaymentSuggestedRolls: next.shingleSyntheticUnderlaymentSuggestedRolls,
          shingleSyntheticUnderlaymentCalculatedRolls: next.shingleSyntheticUnderlaymentCalculatedRolls,
          shingleSyntheticUnderlaymentRolls: next.shingleSyntheticUnderlaymentRolls,
          shingleStarterQuantity: next.shingleStarterQuantity,
          shingleDripEdgePieces: next.shingleDripEdgePieces,
          shingleRapidRidgeBoxes: next.shingleRapidRidgeBoxes,
          shinglePerimeterLinearFeet: next.shinglePerimeterLinearFeet,
          shingleDripEdgeLinearFeet: next.shingleDripEdgeLinearFeet,
          shingleStarterLinearFeet: next.shingleStarterLinearFeet,
          shingleRidgeLinearFeet: next.shingleRidgeLinearFeet,
          shingleHipLinearFeet: next.shingleHipLinearFeet,
          shingleRidgeHipLinearFeet: next.shingleRidgeHipLinearFeet,
          shingleValleyLinearFeet: next.shingleValleyLinearFeet,
          shingleRakeLinearFeet: next.shingleRakeLinearFeet,
          shingleEaveLinearFeet: next.shingleEaveLinearFeet,
        });
      }

      return next;
    });

    setQuickMeasureReport((current) =>
      current
        ? {
            ...current,
            appliedTo: templateKey,
            appliedAt: nextAppliedAt,
            appliedValues: {
              appliedFieldPairs,
              roofSquares,
              perimeterLinearFeet: perimeterLf,
              propertyAddress,
              shingleHdzBundlesNeeded: hdzBundlesSuggested > 0 ? hdzBundlesSuggested : 0,
              shingleSyntheticUnderlaymentRolls: underlaymentRollsSuggested > 0 ? underlaymentRollsSuggested : 0,
              shingleStarterQuantity: starterQuantityFinal,
              shingleDripEdgePieces: dripEdgePiecesFinal,
              shingleRapidRidgeBoxes: rapidRidgeBoxesFinal,
              ridgeLinearFeet: ridgeLf,
              hipLinearFeet: hipLf,
              ridgeHipLinearFeet: ridgeHipLf,
              valleyLinearFeet: valleyLf,
              rakeLinearFeet: rakeLf,
              eaveLinearFeet: eaveLf,
              dripEdgeLinearFeet: dripEdgeLf,
              starterLinearFeet: starterLf,
            },
          }
        : current,
    );

    setActiveTemplate(templateKey);
    setQuickMeasureStatus(
      templateKey === "shingle"
        ? "QuickMeasure data applied to Shingle Estimate."
        : `Applied QuickMeasure report to ${templateKey === "sprayFoam" ? "Spray Foam" : templateKey === "tpo" ? "TPO" : templateKey.charAt(0).toUpperCase() + templateKey.slice(1)} estimate.`,
    );
    setSessionMessageType("success");
    setSessionMessage(templateKey === "shingle" ? "QuickMeasure data applied to Shingle Estimate." : `QuickMeasure applied to ${templateKey}.`);
  };

  const handleSelectZeroOnFocus = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (String(target.value).trim() !== "0") return;
    window.requestAnimationFrame(() => target.select());
  };

  const updateQuickMeasureField = (key, value) => {
    setQuickMeasureReport((current) =>
      current
        ? {
            ...current,
            fields: {
              ...(current.fields || {}),
              [key]: value,
            },
          }
        : current,
    );
  };

  const handleCalculateDistance = async () => {
    const safeInputs = inputs || {};
    const companyHqAddress = String(travelPolicy.companyHqAddress || safeInputs.companyHqAddress || "").trim();
    const jobSiteAddress = String(safeInputs.jobSiteAddress || "").trim();

    if (!isLoaded) {
      setTravelLookupMessage("Google Maps is still loading. Please try again in a moment.");
      setInputs((current) => ({
        ...current,
        travelDistanceSource: "manual",
      }));
      return;
    }

    if (!companyHqAddress || !jobSiteAddress) {
      setTravelLookupMessage("Enter both the HQ address and the job site address.");
      setInputs((current) => ({
        ...current,
        travelDistanceSource: "manual",
      }));
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      setTravelLookupMessage("Google Maps is not configured. Using manual distance entry.");
      setInputs((current) => ({
        ...current,
        travelDistanceSource: "manual",
      }));
      return;
    }

    setIsLookingUpDistance(true);
    setTravelLookupMessage("Looking up Google Maps distance...");

    setGoogleDebug((current) => ({
      ...current,
      apiKeyFound: Boolean(GOOGLE_MAPS_API_KEY),
      mapsJsLoaded: !!window.google?.maps,
      directionsServiceAvailable: !!window.google?.maps?.DirectionsService,
      lastGoogleStatus: "Running",
      lastElementStatus: "Running",
      lastError: "Running",
    }));

    try {
      let response;
      try {
        ({ response } = await routeGoogleDirections(companyHqAddress, jobSiteAddress, "Google Directions"));
      } catch (directError) {
        console.warn("Geocoded directions lookup failed, trying direct fallback:", directError);
        ({ response } = await routeGoogleDirectionsDirect(companyHqAddress, jobSiteAddress, "Google Directions"));
      }

      const leg = response?.routes?.[0]?.legs?.[0];

      if (!leg?.distance?.value || !leg?.duration?.value) {
        throw new Error("Google Directions failed: missing route distance or duration.");
      }

      const oneWayMiles = leg.distance.value / 1609.344;
      const oneWayDriveTime = leg.duration.value / 3600;

      setGoogleDebug((current) => ({
        ...current,
        lastGoogleStatus: "OK",
        lastElementStatus: "OK",
        lastError: "",
      }));

      setInputs((current) => ({
        ...current,
        jobSiteAddress: response.destinationAddress || current.jobSiteAddress,
        oneWayMiles: round(oneWayMiles, 2),
        oneWayDriveTime: round(oneWayDriveTime, 2),
        oneWayDriveTimeHours: round(oneWayDriveTime, 2),
        travelDistanceSource: "google",
      }));

      setIsLookingUpDistance(false);
      setTravelLookupMessage(`Google Maps loaded: ${leg.distance.text}, ${leg.duration.text}`);
    } catch (error) {
      setIsLookingUpDistance(false);
      setTravelLookupMessage(buildTravelLookupMessage({
        apiKeyFound: Boolean(GOOGLE_MAPS_API_KEY),
        isLoaded,
        loadError,
        error,
        originAddress: companyHqAddress,
        destinationAddress: jobSiteAddress,
      }));
      setInputs((current) => ({
        ...current,
        travelDistanceSource: "manual",
      }));
    }
  };

  const setPriceField = (key, value) => {
    setPrices((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const addCustomMaterial = () => {
    setInputs((current) => ({
      ...current,
      customMaterials: [...(current.customMaterials || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", quantity: 0, unit: "ea", unitPrice: 0 }],
    }));
  };

  const updateCustomMaterial = (index, key, value) => {
    setInputs((current) => {
      const list = Array.isArray(current.customMaterials) ? [...current.customMaterials] : [];
      list[index] = { ...list[index], [key]: value };
      return { ...current, customMaterials: list };
    });
  };

  const deleteCustomMaterial = (index) => {
    setInputs((current) => {
      const list = Array.isArray(current.customMaterials) ? [...current.customMaterials] : [];
      list.splice(index, 1);
      return { ...current, customMaterials: list };
    });
  };

  const setAdminPricingField = (key, value) => {
    setAdminPricing((current) => ({
      ...current,
      [key]: toNumber(value, current[key]),
    }));
  };

  const setAdminTravelField = (key, value) => {
    setAdminTravelSettings((current) =>
      normalizeTravelAdminSettings({
        ...current,
        [key]: key === "companyHqAddress" ? String(value || "") : toNumber(value, current[key]),
      }),
    );
  };

  const setAdminTravelVehicleMpg = (vehicleKey, value) => {
    setAdminTravelSettings((current) =>
      normalizeTravelAdminSettings({
        ...current,
        vehicleMpgByKey: {
          ...(current.vehicleMpgByKey || {}),
          [vehicleKey]: toNumber(value, current.vehicleMpgByKey?.[vehicleKey]),
        },
      }),
    );
  };

  const saveCompanyEstimatorSettings = async () => {
    if (!isFinanceUser || !authUser?.key || estimatorSettingsSyncStatus === "saving") return;
    const payload = {
      material_price_defaults: {},
      admin_pricing_defaults: normalizeAdminPricing(adminPricing),
      travel_defaults: normalizeTravelAdminSettings(adminTravelSettings),
    };
    setEstimatorSettingsSyncError("");
    setEstimatorSettingsSyncStatus("saving");
    const { data, error } = await upsertCompanyEstimatorSettingsToSupabase(payload, authUser.id || authUser.key);
    if (error || !data) {
      const message = error?.message || "The company defaults could not be saved.";
      setEstimatorSettingsSyncError(message);
      setEstimatorSettingsSyncStatus("error");
      console.warn("Supabase estimator settings save failed:", message);
      return;
    }

    const savedPricing = normalizeAdminPricing({
      ...DEFAULT_ADMIN_PRICING,
      ...toPlainObject(data.admin_pricing_defaults, payload.admin_pricing_defaults),
    });
    const savedTravel = normalizeTravelAdminSettings({
      ...DEFAULT_TRAVEL_ADMIN_SETTINGS,
      ...toPlainObject(data.travel_defaults, payload.travel_defaults),
    });
    estimatorSettingsHydratingRef.current = true;
    setAdminPricing(savedPricing);
    setAdminTravelSettings(savedTravel);
    estimatorSettingsHydratingRef.current = false;
    estimatorSettingsLastSyncedRef.current = JSON.stringify({
      adminPricing: savedPricing,
      adminTravelSettings: savedTravel,
    });
    writeJson(ADMIN_PRICING_KEY, savedPricing);
    writeJson(ADMIN_TRAVEL_SETTINGS_KEY, savedTravel);
    setEstimatorSettingsMetadata({
      updatedAt: String(data.updated_at || new Date().toISOString()),
      updatedBy: String(data.updated_by || authUser.id || authUser.key),
      rowVersion: num(data.row_version, 0),
    });
    setEstimatorSettingsSyncStatus("saved");
  };

  const discardCompanyEstimatorSettingsChanges = () => {
    if (!estimatorSettingsLastSyncedRef.current) return;
    try {
      const saved = JSON.parse(estimatorSettingsLastSyncedRef.current);
      setAdminPricing(normalizeAdminPricing(saved.adminPricing));
      setAdminTravelSettings(normalizeTravelAdminSettings(saved.adminTravelSettings));
      setEstimatorSettingsSyncError("");
      setEstimatorSettingsSyncStatus("saved");
    } catch (error) {
      console.warn("Unable to restore saved estimator settings:", error);
    }
  };

  const leaveAdminPricingScreen = () => {
    if (estimatorSettingsHasUnsavedChanges && !window.confirm("Discard your unsaved pricing changes and return to the dashboard?")) return;
    if (estimatorSettingsHasUnsavedChanges) discardCompanyEstimatorSettingsChanges();
    setActiveTemplate("dashboard");
  };

  const setSubcontractorAddOnItem = (index, key, value) => {
    setInputs((current) => {
      const items = normalizeSubcontractorAddOnItems(current.subcontractorAddOnItems);
      const nextItems = items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item));
      return {
        ...current,
        subcontractorAddOnItems: nextItems,
      };
    });
  };

  const handleAddSubcontractorLineItem = () => {
    setInputs((current) => ({
      ...current,
      subcontractorHasAddOns: true,
      subcontractorAddOnItems: [...normalizeSubcontractorAddOnItems(current.subcontractorAddOnItems), createBlankSubcontractorAddOnItem()],
    }));
  };

  const getCompanyVehicleChoice = (vehicleId) =>
    fieldOperationCompanyVehicles.find((vehicle) => vehicle.id === vehicleId) ||
    TRAVEL_VEHICLE_OPTIONS.find((vehicle) => vehicle.value === vehicleId) ||
    null;

  const handleAddFieldDailyLogVehicleRow = () => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      vehicleRows: [...(current.vehicleRows || []), createBlankFieldDailyLogVehicleRow()],
    }));
  };

  const handleRemoveFieldDailyLogVehicleRow = (rowId) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      vehicleRows: (current.vehicleRows || []).filter((row) => row.id !== rowId),
    }));
  };

  const handleFieldDailyLogVehicleRowChange = (rowId, key, value) => {
    setFieldDailyLogDraft((current) => {
      const nextRows = (current.vehicleRows || []).map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = { ...row, [key]: value };
        if (key === "vehicleId") {
          const selectedVehicle = getCompanyVehicleChoice(value);
          if (selectedVehicle && value) {
            nextRow.truckName = selectedVehicle.vehicleName || selectedVehicle.label || nextRow.truckName;
            nextRow.unitNumber = selectedVehicle.unitNumber || nextRow.unitNumber;
            nextRow.licensePlate = selectedVehicle.licensePlate || nextRow.licensePlate;
            nextRow.vehicleType = selectedVehicle.value || selectedVehicle.vehicleType || nextRow.vehicleType;
          } else if (value === "__other__") {
            nextRow.truckName = nextRow.truckName || "Other / Rental";
            nextRow.vehicleType = "other";
          } else {
            nextRow.truckName = nextRow.truckName || "";
            nextRow.vehicleType = "";
          }
        }
        if (key === "driverEmployeeId") {
          const matchedDriver = employeeDirectory.find((employee) => employee.id === value) || null;
          nextRow.driverEmployeeId = value;
          nextRow.driverEmployeeName =
            matchedDriver?.displayName ||
            [matchedDriver?.firstName, matchedDriver?.lastName].filter(Boolean).join(" ").trim() ||
            (value ? nextRow.driverEmployeeName : "") ||
            "";
        }
        if (key === "startingMileage" || key === "endingMileage") {
          const startingMileage = key === "startingMileage" ? toNumber(value, 0) : toNumber(row.startingMileage, 0);
          const endingMileage = key === "endingMileage" ? toNumber(value, 0) : toNumber(row.endingMileage, 0);
          nextRow.milesDriven = Math.max(0, endingMileage - startingMileage);
          nextRow.mileageFlag = endingMileage < startingMileage || nextRow.milesDriven >= FIELD_DAILY_LOG_HIGH_MILEAGE_THRESHOLD;
        }
        return nextRow;
      });
      return { ...current, vehicleRows: nextRows };
    });
  };

  const handleAddFieldDailyLogFuelReceiptRow = () => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      fuelPurchased: true,
      fuelReceipts: [...(current.fuelReceipts || []), createBlankFieldDailyLogFuelReceiptRow()],
    }));
  };

  const handleRemoveFieldDailyLogFuelReceiptRow = (rowId) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      fuelReceipts: (current.fuelReceipts || []).filter((row) => row.id !== rowId),
    }));
  };

  const handleFieldDailyLogFuelReceiptRowChange = (rowId, key, value) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      fuelReceipts: (current.fuelReceipts || []).map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = { ...row, [key]: value };
        const gallons = key === "gallonsPumped" ? toNumber(value, 0) : toNumber(row.gallonsPumped, 0);
        const receiptAmount = key === "totalReceiptAmount" ? toNumber(value, 0) : toNumber(row.totalReceiptAmount, 0);
        nextRow.pricePerGallon = gallons > 0 ? round(receiptAmount / gallons, 2) : 0;
        return nextRow;
      }),
    }));
  };

  const handleFieldDailyLogFuelReceiptPhotoUpload = async (rowId, event) => {
    const files = Array.from(event.target.files || []).slice(0,1);
    event.target.value = "";
    await processFieldUploads(files.map(file => ({file, rowId, category:"fuel-receipt", id:crypto.randomUUID(), logId:fieldDailyLogDraft.id})));
  };

  const handleRemoveFuelReceiptPhoto = (rowId) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      fuelReceipts: (current.fuelReceipts || []).map((row) =>
        row.id === rowId
          ? {
              ...row,
              receiptPhoto: null,
              receiptPhotoUrl: "",
              receiptPhotoPath: "",
              receiptPhotoName: "",
            }
          : row,
      ),
    }));
  };

  const totalFuelPurchasedAmount = useMemo(
    () => (fieldDailyLogDraft.fuelReceipts || []).reduce((sum, row) => sum + Math.max(0, toNumber(row.totalReceiptAmount, 0)), 0),
    [fieldDailyLogDraft.fuelReceipts],
  );

  const getFriendlyAuthError = (error, action = "login") => {
    const message = String(error?.message || error || "").trim();
    const normalized = message.toLowerCase();

    if (normalized.includes("email not confirmed")) {
      return "This employee account has not been activated yet. Contact the office to confirm it.";
    }
    if (normalized.includes("invalid login credentials")) {
      return "The email or password is incorrect. Try again or use Forgot password.";
    }
    if (normalized.includes("rate limit")) {
      return "The password email service is temporarily limited. Wait a few minutes and try again, or contact the office.";
    }
    if (normalized.includes("failed to fetch") || normalized.includes("network")) {
      return "The portal could not reach the sign-in service. Check your internet connection and try again.";
    }

    return message ||
      (action === "reset"
        ? "Unable to send the password reset email."
        : "Unable to sign in.");
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loginSubmitting || resetSubmitting) return;

    setLoginError("");
    setLoginNotice("");

    const email = String(loginEmail || "").trim().toLowerCase();
    const password = String(loginPassword || "").trim();

    if (!email || !password) {
      setLoginError("Enter both email and password.");
      return;
    }

    setLoginSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(getFriendlyAuthError(error, "login"));
        return;
      }

      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
      setSessionMessage("Signed in.");
    } catch (error) {
      setLoginError(getFriendlyAuthError(error, "login"));
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loginSubmitting || resetSubmitting) return;

    const email = String(loginEmail || "").trim().toLowerCase();
    setLoginError("");
    setLoginNotice("");

    if (!email) {
      setLoginError("Enter your email address first, then select Forgot password.");
      return;
    }

    setResetSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: PASSWORD_RESET_REDIRECT_URL,
      });
      if (error) {
        setLoginError(error.message || "Unable to send the password reset email.");
        return;
      }

      setLoginNotice(
        `Password reset email sent to ${email}. Check the inbox and spam folder.`,
      );
    } catch (error) {
      setLoginError(error?.message || "Unable to send the password reset email.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handlePasswordRecovery = async (event) => {
    event.preventDefault();
    setLoginError("");
    setLoginNotice("");

    if (recoveryPassword.length < 8) {
      setLoginError("Your new password must be at least 8 characters.");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirmation) {
      setLoginError("The new passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
    if (error) {
      setLoginError(error.message || "Unable to update your password.");
      return;
    }

    setRecoveryPassword("");
    setRecoveryPasswordConfirmation("");
    setPasswordRecoveryMode(false);
    setSessionMessageType("success");
    setSessionMessage("Password updated. Welcome to the Employee Portal.");
  };

  const handleLogout = async () => {
    if (fieldUploadLock.current || fieldDailyLogSaveLock.current) { setSessionMessageType("error"); setSessionMessage("Wait for the current upload or save before signing out."); return; }
    setPendingFieldUploads([]);
    await supabase.auth.signOut();
    setAuthUser(null);
    setAuthRole("salesperson");
    setInputs(DEFAULT_INPUTS);
    setPrices({ ...DEFAULT_MATERIAL_PRICES });
    setEstimateName("");
    setSavedEstimates([]);
    setEditingEstimate(null);
    setFieldNotes(DEFAULT_FIELD_NOTES);
    setSavedInspections([]);
    setFieldDailyLogDraft(createBlankFieldDailyLog(""));
    setFieldDailyLogs([]);
    setFieldDailyLogSelectedId("");
    setFieldDailyLogFilters({
      dateStart: "",
      dateEnd: "",
      job: "",
      foreman: "",
      employee: "",
      status: "all",
      missingPhotos: false,
      hasOvertime: false,
      hasSafetyIncident: false,
    });
    setFieldDailyLogReviewSearch("");
    setFieldOperationsTab("dailyLog");
    setEmployeeDirectory([]);
    setEmployeeManagementDraft(createBlankEmployeeRecord());
    setEmployeeManagementSearch("");
    setFieldOperationCompanyVehicles([]);
    setActiveJobs([]);
    setActiveJobSelectedId("");
    setActiveJobsSearch("");
    setActiveJobsFilters({
      status: "all",
      contact: "",
      supervisor: "",
      riskLevel: "all",
      startDate: "",
      customer: "",
      openIssues: "all",
      sortBy: "startDate",
      sortDirection: "asc",
    });
    setApprovedJobsSearch("");
    setApprovedJobsFilters({
      customer: "",
      address: "",
      status: "all",
      contact: "",
      startDate: "",
    });
    setApprovedJobQuickCreateOpen(false);
    setApprovedJobQuickDraft(createBlankApprovedJobQuickDraft());
    setActiveJobIssueModalOpen(false);
    setActiveJobIssueDraft(createBlankActiveJobIssue());
    setActiveJobIssueResponse("");
    setProposals([]);
    setProposalSelectedId("");
    setProposalSearch("");
    setProposalFilters({
      status: "all",
      customer: "",
      address: "",
      salesperson: "",
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    setProposalDraft(createBlankProposal());
    setCompletedJobs([]);
    setJobsSyncStatus("idle");
    setJobsSyncError("");
    setSelectedCfoCard("");
    setCfoDashboardFilters({
      search: "",
      dateFrom: "",
      dateTo: "",
      customer: "",
      supplier: "",
      subcontractor: "",
      job: "",
      currentOverdue: "all",
      agingBucket: "all",
      status: "all",
      sortBy: "lastUpdated",
      sortDirection: "desc",
    });
    setQuickMeasureReport(null);
    setQuickMeasureStatus("");
    setQuickMeasureIsProcessing(false);
    setCompanyUserProfiles([]);
    setNextEstimateNumber(1);
    setActiveTemplate("dashboard");
    setInspectionTemplateChooserOpen(false);
    setSessionMessage("Signed out.");
  };

  const resetFieldDailyLogDraft = (preserveForeman = true) => {
    setFieldDailyLogDraft((current) =>
      createBlankFieldDailyLog(
        preserveForeman ? current.foreman || authUser?.displayName || "" : authUser?.displayName || "",
      ),
    );
    setFieldOperationsTab("dailyLog");
  };

  const handleFieldDailyLogFieldChange = (key, value) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleAddFieldDailyLogCrewRow = () => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      crewRows: [...(current.crewRows || []), createBlankFieldDailyLogCrewRow()],
    }));
  };

  const handleRemoveFieldDailyLogCrewRow = (rowId) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      crewRows: (current.crewRows || []).filter((row) => row.id !== rowId),
    }));
  };

  const handleFieldDailyLogCrewRowChange = (rowId, key, value) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      crewRows: (current.crewRows || []).map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = { ...row, [key]: value };
        if (key === "employeeLookupId") {
          const matchedEmployee = employeeDirectory.find((employee) => employee.id === value) || null;
          nextRow.employeeLookupId = value;
          nextRow.employeeName =
            matchedEmployee?.displayName ||
            [matchedEmployee?.firstName, matchedEmployee?.lastName].filter(Boolean).join(" ").trim() ||
            (value ? nextRow.employeeName : "") ||
            "";
          nextRow.employeeId = matchedEmployee?.employeeNumber || nextRow.employeeId || "";
          nextRow.role = matchedEmployee?.occupation || nextRow.role || "";
        }
        return nextRow;
      }),
    }));
  };

  const startNewEmployeeDraft = () => {
    setEmployeeManagementDraft(createBlankEmployeeRecord());
  };

  const editEmployeeRecord = (employee) => {
    const normalized = normalizeEmployeeRecord(employee);
    setEmployeeManagementDraft(normalized);
    setSessionMessageType("success");
    setSessionMessage(`Editing ${normalized.displayName || "employee"}. Update the fields, then select Update employee.`);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        employeeManagementEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const updateEmployeeDraftField = (key, value) => {
    setEmployeeManagementDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "firstName" || key === "lastName") {
        next.displayName = [next.firstName, next.lastName].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
      }
      if (key === "displayName") {
        next.displayName = String(value || "");
      }
      return next;
    });
  };

  const saveEmployeeDraft = async () => {
    if (!authUser?.key) return;
    if (!canManageEmployeeWages) {
      setSessionMessageType("error");
      setSessionMessage("Only CFO and admin users can manage employee wages.");
      return;
    }
    const normalized = normalizeEmployeeRecord(employeeManagementDraft);
    if (!normalized.displayName) {
      setSessionMessageType("error");
      setSessionMessage("Enter at least a first name or display name before saving.");
      return;
    }

    const nextEmployees = [...employeeDirectory.filter((employee) => employee.id !== normalized.id), normalized].sort(
      (a, b) => toNumber(a.displayOrder, 0) - toNumber(b.displayOrder, 0),
    );
    setEmployeeDirectory(nextEmployees);
    setEmployeeManagementDraft(normalized);
    setSessionMessageType("success");
    setSessionMessage(`Saved employee: ${normalized.displayName || "Employee"}`);

    const result = await upsertEmployeeToSupabase(normalized, authUser.key);
    if (result?.error) {
      console.warn("Employee save sync failed:", result.error.message || result.error);
      setSessionMessageType("error");
      setSessionMessage(`Saved locally, but Supabase sync failed: ${result.error.message || result.error}`);
    }
  };

  const crmActiveStaffOptions = useMemo(
    () =>
      employeeDirectory
        .filter((employee) => employee.isActive)
        .map((employee) => ({
          value: employee.id,
          label: [
            employee.displayName || buildEmployeeDisplayName(employee) || "Unnamed employee",
            employee.department ? `${employee.department}` : "",
            employee.isForeman ? "Foreman" : "",
          ]
            .filter(Boolean)
            .join(" • "),
        })),
    [employeeDirectory],
  );

  const crmSelectedCustomer = useMemo(
    () => crmCustomers.find((customer) => customer.id === crmSelectedCustomerId) || null,
    [crmCustomers, crmSelectedCustomerId],
  );

  const crmLeadDisplayName = (lead = {}) =>
    lead.contactName ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
    lead.companyName ||
    lead.propertyAddress ||
    "Untitled lead";

  const crmCustomerDisplayName = (customer = {}) =>
    customer.customerName ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    customer.companyName ||
    "Untitled customer";

  const addCrmLeadHistory = (lead, label, note = "", changedBy = authUser?.displayName || "") => {
    const entry = {
      id: createFieldDailyLogId(),
      label,
      note,
      createdAt: new Date().toISOString(),
      createdBy: changedBy,
    };
    return {
      ...lead,
      history: [...(Array.isArray(lead.history) ? lead.history : []), entry],
      lastActivityDate: entry.createdAt,
      updatedAt: entry.createdAt,
    };
  };

  const startNewCrmLeadDraft = (overrides = {}) => {
    setCrmLeadDraft(normalizeCrmLead({
      ...createBlankCrmLead(),
      originatorId: authUser?.key || "",
      originatorName: authUser?.displayName || "",
      originatorEmail: authUser?.email || "",
      relationshipOwnerId: authUser?.key || "",
      ...overrides,
    }));
    setCrmLeadEditingId("");
    setCrmLeadWorkOrderFile(null);
    setCrmTab("quickCapture");
  };

  const openDashboardLeadCapture = () => {
    startNewCrmLeadDraft();
    setActiveTemplate("crm");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const openDashboardInspectionRequest = () => {
    setWorkHubInitialTaskId("");
    setWorkHubInitialCreateTask(false);
    setWorkHubInitialTab("inspections");
    setActiveTemplate("workHub");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editCrmLead = (lead) => {
    const normalized = normalizeCrmLead(lead);
    setCrmLeadDraft(normalized);
    setCrmLeadEditingId(normalized.id);
    setCrmLeadWorkOrderFile(null);
    setCrmTab("newLead");
  };

  const confirmSeparateCrmLead = (candidate) => {
    const duplicate = findPotentialDuplicateLead(crmLeads, candidate);
    if (!duplicate) return true;
    const duplicateName = crmLeadDisplayName(duplicate);
    const createSeparate = window.confirm(
      `A shared lead may already exist for ${duplicateName}.\n\nSelect OK only if this is a separate opportunity. Select Cancel to review the existing lead instead.`,
    );
    if (createSeparate) return true;
    editCrmLead(duplicate);
    setSessionMessageType("info");
    setSessionMessage(`Opened the existing lead for ${duplicateName}. No duplicate was created.`);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    return false;
  };

  const updateCrmLeadDraftField = (key, value) => {
    setCrmLeadDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectCrmLeadWorkOrder = (file) => {
    if (!file) { setCrmLeadWorkOrderFile(null); return; }
    if (!/\.pdf$/i.test(String(file.name || "")) || (file.type && file.type !== "application/pdf")) {
      setCrmLeadWorkOrderFile(null);
      setSessionMessageType("error");
      setSessionMessage("Choose a PDF work order.");
      return;
    }
    if (Number(file.size || 0) > CRM_LEAD_WORK_ORDER_MAX_BYTES) {
      setCrmLeadWorkOrderFile(null);
      setSessionMessageType("error");
      setSessionMessage("The PDF work order must be 25 MB or smaller.");
      return;
    }
    setCrmLeadWorkOrderFile(file);
    setSessionMessageType("");
    setSessionMessage(`${file.name} is ready to upload with the lead.`);
  };

  const openCrmLeadDocument = async (document) => {
    if (!document?.storage_path) return;
    const { data, error } = await supabase.storage.from(CRM_LEAD_WORK_ORDER_BUCKET).createSignedUrl(document.storage_path, 300);
    if (error) {
      setSessionMessageType("error");
      setSessionMessage(`The work order could not be opened: ${error.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const saveCrmLeadDraft = async (statusMessage = "Saved lead.", leadOverride = crmLeadDraft, skipRemoteSync = false) => {
    const normalized = normalizeCrmLead({
      ...leadOverride,
      originatorId: leadOverride.originatorId || authUser?.key || "",
      originatorName: leadOverride.originatorName || authUser?.displayName || "",
      originatorEmail: leadOverride.originatorEmail || authUser?.email || "",
      relationshipOwnerId: leadOverride.relationshipOwnerId || authUser?.key || "",
    });
    if (!normalized.contactName && !normalized.firstName && !normalized.lastName && !normalized.companyName) {
      setSessionMessageType("error");
      setSessionMessage("Enter a lead name or company before saving.");
      return null;
    }

    const assignedStaff = crmActiveStaffOptions.find((item) => item.value === normalized.assignedStaffId);
    const leadWithHistory = addCrmLeadHistory(
      normalized,
      normalized.leadStatus || "Lead updated",
      `${crmLeadDisplayName(normalized)} · ${normalized.propertyAddress || "No address"}`,
    );
    const nextLead = {
      ...leadWithHistory,
      assignedStaffId: assignedStaff?.value || normalized.assignedStaffId || "",
      qualifiedAt: normalized.qualificationStatus === "qualified" ? normalized.qualifiedAt || new Date().toISOString() : normalized.qualifiedAt,
      qualifiedBy: normalized.qualificationStatus === "qualified" ? normalized.qualifiedBy || authUser?.key || "" : normalized.qualifiedBy,
      updatedAt: new Date().toISOString(),
    };

    setCrmLeads((current) => {
      const next = [...current.filter((lead) => lead.id !== nextLead.id), nextLead];
      return next.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    });
    setCrmLeadDraft(nextLead);
    setCrmLeadEditingId(nextLead.id);
    setSessionMessageType("info");
    setSessionMessage("Saving lead to the shared CRM…");
    setCrmLeadSyncStatus("saving");
    if (skipRemoteSync) return nextLead;

    const result = await upsertCrmLeadToSupabase(nextLead, authUser);
    if (result?.error) {
      setCrmLeadSyncStatus("local");
      setCrmLeadSyncError(result.error.message || "Lead saved locally but not to the shared CRM.");
      setSessionMessageType("error");
      setSessionMessage(`Lead saved on this device, but shared sync failed: ${result.error.message || result.error}`);
      return null;
    }
    const sharedLead = normalizeCrmLead(result?.data || nextLead);
    setCrmLeads((current) => [sharedLead, ...current.filter((lead) => lead.id !== sharedLead.id)]
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))));
    setCrmLeadDraft(sharedLead);
    setCrmLeadSyncStatus("saved");
    setCrmLeadSyncError("");
    setSessionMessageType("success");
    setSessionMessage(statusMessage);
    return sharedLead;
  };

  const saveQuickLeadAndAddNext = async () => {
    const validation = validateQuickLead(crmLeadDraft);
    if (!validation.valid) {
      setSessionMessageType("error");
      setSessionMessage(validation.errors.join(" "));
      return;
    }
    if (["qualified", "inspection"].includes(crmLeadDraft.visitOutcome) && !crmLeadDraft.roofingServiceNeeded) {
      setSessionMessageType("error");
      setSessionMessage("Select the roofing opportunity type before marking this visit qualified.");
      return;
    }
    if (crmLeadDraft.visitOutcome === "inspection") {
      await sendCrmLeadForInspection(crmLeadDraft, true);
      return;
    }
    const outcomeUpdates = crmLeadDraft.visitOutcome === "not_interested"
      ? { leadStatus: "Not Qualified", qualificationStatus: "not_qualified" }
      : crmLeadDraft.visitOutcome === "follow_up"
        ? { leadStatus: "Follow-Up", qualificationStatus: "captured" }
        : crmLeadDraft.visitOutcome === "qualified"
          ? { leadStatus: "Contacted", qualificationStatus: "qualified" }
          : { leadStatus: "New", qualificationStatus: "captured" };
    const leadToSave = { ...crmLeadDraft, ...outcomeUpdates };
    if (!confirmSeparateCrmLead(leadToSave)) return;
    const hasWorkOrder = Boolean(crmLeadWorkOrderFile);
    const saved = await saveCrmLeadDraft(
      "Customer visit saved. Ready for the next one.",
      leadToSave,
      hasWorkOrder,
    );
    if (!saved) return;
    if (hasWorkOrder) {
      setCrmLeadWorkOrderUploading(true);
      setCrmLeadSyncStatus("saving");
      const remote = await upsertCrmLeadToSupabase(saved, authUser);
      if (remote.error) {
        setCrmLeadWorkOrderUploading(false);
        setCrmLeadSyncStatus("local");
        setSessionMessageType("error");
        setSessionMessage(`The lead is saved on this device, but the PDF work order was not uploaded: ${remote.error.message || remote.error}`);
        return;
      }
      const upload = await uploadCrmLeadWorkOrder(saved.id, crmLeadWorkOrderFile);
      setCrmLeadWorkOrderUploading(false);
      if (upload.error) {
        setSessionMessageType("error");
        setSessionMessage(`The lead was saved, but the PDF work order could not be uploaded: ${upload.error.message || upload.error}`);
        return;
      }
      setCrmLeadDocuments((current) => [upload.data, ...current.filter((item) => item.id !== upload.data?.id)].filter(Boolean));
      setCrmLeadWorkOrderFile(null);
      setCrmLeadSyncStatus("saved");
      setSessionMessageType("success");
      setSessionMessage("Lead and PDF work order saved. Ready for the next one.");
    }
    const fresh = normalizeCrmLead({
      ...createBlankCrmLead(),
      originatorId: authUser?.key || "",
      originatorName: authUser?.displayName || "",
      originatorEmail: authUser?.email || "",
      relationshipOwnerId: authUser?.key || "",
    });
    setCrmLeadDraft(fresh);
    setCrmLeadEditingId("");
  };

  const sendCrmLeadForInspection = async (leadOverride = crmLeadDraft, resetAfter = false) => {
    if (crmInspectionSending || !authUser?.key) return;
    const validation = validateQuickLead(leadOverride);
    if (!validation.valid) {
      setSessionMessageType("error");
      setSessionMessage(validation.errors.join(" "));
      return;
    }
    if (!confirmSeparateCrmLead(leadOverride)) return;

    setCrmInspectionSending(true);
    try {
    setSessionMessageType("");
    setSessionMessage("Sending inspection request to Ivan...");

    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .order("full_name", { ascending: true });
    const ivan = findInspectionAssignee(profiles || []);
    if (profilesError || !ivan?.id) {
      setCrmInspectionSending(false);
      setSessionMessageType("error");
      setSessionMessage(profilesError?.message || "Ivan's app profile could not be found. Confirm that ivan@crtroofing.com is active.");
      return;
    }

    const now = new Date().toISOString();
    const normalized = normalizeCrmLead({
      ...leadOverride,
      leadSource: leadOverride.leadSource || "Phone Call / Office",
      roofingServiceNeeded: leadOverride.roofingServiceNeeded || "Roof inspection",
      assignedStaffId: ivan.id,
      leadStatus: "Contacted",
      qualificationStatus: "qualified",
      qualifiedAt: leadOverride.qualifiedAt || now,
      qualifiedBy: leadOverride.qualifiedBy || authUser.key,
      originatorId: leadOverride.originatorId || authUser.key,
      originatorName: leadOverride.originatorName || authUser.displayName || "",
      originatorEmail: leadOverride.originatorEmail || authUser.email || "",
      relationshipOwnerId: leadOverride.relationshipOwnerId || authUser.key,
      updatedAt: now,
    });

    const leadResult = await upsertCrmLeadToSupabase(normalized, authUser);
    if (leadResult?.error) {
      setCrmInspectionSending(false);
      setCrmLeadSyncStatus("local");
      setCrmLeadSyncError(leadResult.error.message || "Inspection lead could not sync.");
      setSessionMessageType("error");
      setSessionMessage(`Inspection request was not sent because the lead could not sync: ${leadResult.error.message || leadResult.error}`);
      return;
    }

    const savedLeadBeforeHandoff = normalizeCrmLead(leadResult?.data || normalized);
    let uploadedWorkOrder = null;
    const requestWorkOrderFile = leadOverride.id === crmLeadDraft.id ? crmLeadWorkOrderFile : null;
    if (requestWorkOrderFile) {
      setCrmLeadWorkOrderUploading(true);
      const upload = await uploadCrmLeadWorkOrder(savedLeadBeforeHandoff.id, requestWorkOrderFile);
      setCrmLeadWorkOrderUploading(false);
      if (upload.error) {
        setCrmInspectionSending(false);
        setSessionMessageType("error");
        setSessionMessage(`The lead was saved, but it was not sent to Ivan because the PDF work order failed to upload: ${upload.error.message || upload.error}`);
        return;
      }
      uploadedWorkOrder = upload.data;
      setCrmLeadDocuments((current) => [upload.data, ...current.filter((item) => item.id !== upload.data?.id)].filter(Boolean));
      setCrmLeadWorkOrderFile(null);
    }
    const inspectionWorkOrder = uploadedWorkOrder || crmLeadDocuments.find((document) => document.lead_id === savedLeadBeforeHandoff.id) || null;
    const inspectionTask = buildInspectionTask(savedLeadBeforeHandoff);
    const { data: task, error: taskError } = await supabase.rpc("create_inspection_request_task", {
      p_lead_id: savedLeadBeforeHandoff.id,
      p_title: inspectionTask.title,
      p_description: `${inspectionTask.description}\nCRM lead ID: ${savedLeadBeforeHandoff.id}${inspectionWorkOrder ? `\nPDF work order attached in CRM: ${inspectionWorkOrder.file_name}` : ""}`,
      p_priority: inspectionTask.priority,
      p_assignee_id: ivan.id,
    }).single();

    if (taskError || !task?.id) {
      setCrmInspectionSending(false);
      setSessionMessageType("error");
      setSessionMessage(`The lead was saved, but Ivan's inspection task could not be created: ${taskError?.message || "Unknown task error"}`);
      return;
    }

    const routedLead = addCrmLeadHistory(
      {
        ...savedLeadBeforeHandoff,
        leadStatus: "Inspection Requested",
        acceptedForInspectionAt: savedLeadBeforeHandoff.acceptedForInspectionAt || now,
        acceptedForInspectionBy: savedLeadBeforeHandoff.acceptedForInspectionBy || authUser.key,
        updatedAt: now,
      },
      "Sent for inspection",
      `Assigned to Ivan Solano by ${authUser.displayName || authUser.email || "office staff"}.`,
    );
    const handoffResult = await upsertCrmLeadToSupabase(routedLead, authUser);
    const savedLead = normalizeCrmLead(handoffResult?.data || routedLead);
    if (handoffResult?.error) {
      setCrmLeadSyncStatus("local");
      setCrmLeadSyncError(handoffResult.error.message || "Inspection handoff was created, but its CRM milestone could not sync.");
    }

    setCrmLeads((current) => [
      savedLead,
      ...current.filter((lead) => lead.id !== savedLead.id),
    ].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))));
    if (!handoffResult?.error) {
      setCrmLeadSyncStatus("saved");
      setCrmLeadSyncError("");
    }
    setWorkHubInitialTaskId(task.id);
    setWorkHubInitialCreateTask(false);
    setSessionMessageType(handoffResult?.error ? "error" : "success");
    setSessionMessage(handoffResult?.error
      ? "Ivan received the inspection task, but the CRM milestone did not sync. Open the lead and save it again before relying on the KPI."
      : "Inspection request sent to Ivan. His task and email notification were queued successfully.");

    if (resetAfter) {
      startNewCrmLeadDraft({
        leadSource: leadOverride.leadSource || "Cold Calling",
        roofingServiceNeeded: leadOverride.leadSource === "Phone Call / Office" ? "Roof inspection" : "",
      });
    } else {
      setCrmLeadDraft(savedLead);
      setCrmLeadEditingId(savedLead.id);
    }
    return task;
    } catch (error) {
      setSessionMessageType("error");
      setSessionMessage(`Inspection request could not be confirmed. Your details are preserved; check your connection and retry. ${error.message || ""}`);
      return null;
    } finally {
      setCrmInspectionSending(false);
      setCrmLeadWorkOrderUploading(false);
    }
  };

  const handleCrmLeadAction = async (action) => {
    if (crmLeadSyncStatus === "saving") return;
    const now = new Date().toISOString();
    if (action === "scheduleAppointment") {
      const updated = {
        ...crmLeadDraft,
        leadStatus: "Appointment Scheduled",
        qualificationStatus: "qualified",
        qualifiedAt: crmLeadDraft.qualifiedAt || now,
        qualifiedBy: crmLeadDraft.qualifiedBy || authUser?.key || "",
        acceptedForInspectionAt: crmLeadDraft.acceptedForInspectionAt || now,
        acceptedForInspectionBy: crmLeadDraft.acceptedForInspectionBy || authUser?.key || "",
        inspectionScheduledAt: crmLeadDraft.inspectionScheduledAt || now,
        appointmentDate: crmLeadDraft.appointmentDate || now.slice(0, 10),
      };
      setCrmLeadDraft(updated);
      await saveCrmLeadDraft("Lead qualified and accepted for inspection.", updated);
    } else if (action === "createEstimate") {
      const updated = { ...crmLeadDraft, leadStatus: "Estimate in Progress" };
      setCrmLeadDraft(updated);
      await saveCrmLeadDraft("Lead marked as Estimate in Progress.", updated);
    }
  };

  const deleteCrmLead = async (leadId) => {
    if (!leadId || crmLeadDeletingId) return;
    const lead = crmLeads.find((item) => item.id === leadId);
    const leadName = crmLeadDisplayName(lead || {}) || "this lead";
    if (!window.confirm(`Delete ${leadName} from the shared CRM? This cannot be undone.`)) return;

    setCrmLeadDeletingId(leadId);
    setSessionMessageType("info");
    setSessionMessage(`Deleting ${leadName} from the shared CRM…`);
    const result = await deleteCrmLeadFromSupabase(leadId);
    setCrmLeadDeletingId("");
    if (result?.error) {
      setSessionMessageType("error");
      setSessionMessage(`The lead was not deleted: ${result.error.message || result.error}`);
      return;
    }

    setCrmLeads((current) => current.filter((item) => item.id !== leadId));
    if (crmLeadEditingId === leadId) startNewCrmLeadDraft();
    setSessionMessageType("success");
    setSessionMessage(`${leadName} was deleted from the shared CRM.`);
  };

  const saveCrmWeeklyInspectionTarget = async () => {
    const normalizedTarget = Math.max(1, Number(crmWeeklyInspectionTarget) || 6);
    const result = await saveCrmKpiTargetToSupabase(normalizedTarget, authUser?.key || null);
    if (result?.error) {
      setSessionMessageType("error");
      setSessionMessage(`KPI target could not be saved: ${result.error.message || result.error}`);
      return;
    }
    setCrmWeeklyInspectionTarget(Math.max(1, Number(result.data?.numeric_value) || normalizedTarget));
    setSessionMessageType("success");
    setSessionMessage("Ivan's weekly inspection capacity target was saved.");
  };

  const convertCrmLeadToCustomer = async () => {
    if (crmLeadSyncStatus === "saving") return;
    const savedLead = await saveCrmLeadDraft("Saving customer conversion…", crmLeadDraft, true);
    if (!savedLead) return;
    const customerName = [savedLead.firstName, savedLead.lastName].filter(Boolean).join(" ").trim() || savedLead.companyName || savedLead.propertyAddress || "New customer";
    const convertedAt = new Date().toISOString();
    const customerId = savedLead.convertedCustomerId || createFieldDailyLogId();
    const convertedLead = addCrmLeadHistory(
      {
        ...savedLead,
        convertedCustomerId: customerId,
        leadStatus: "Approved",
        updatedAt: convertedAt,
      },
      "Converted to customer",
      `${customerName} was converted into a customer record.`,
    );
    setCrmLeadSyncStatus("saving");
    const conversionResult = await upsertCrmLeadToSupabase(convertedLead, authUser);
    if (conversionResult?.error) {
      setCrmLeadSyncStatus("local");
      setCrmLeadSyncError(conversionResult.error.message || "Customer conversion could not sync.");
      setSessionMessageType("error");
      setSessionMessage(`The lead was not converted because shared CRM sync failed: ${conversionResult.error.message || conversionResult.error}`);
      return;
    }
    const sharedConvertedLead = normalizeCrmLead(conversionResult?.data || convertedLead);
    const nextCustomer = normalizeCrmCustomer({
      ...createBlankCrmCustomer(),
      id: customerId,
      customerName,
      firstName: savedLead.firstName,
      lastName: savedLead.lastName,
      companyName: savedLead.companyName,
      phone: savedLead.phone,
      email: savedLead.email,
      secondaryPhone: savedLead.secondaryPhone,
      billingAddress: savedLead.propertyAddress,
      city: savedLead.city,
      zipCode: savedLead.zipCode,
      propertyType: savedLead.propertyType,
      sourceLeadId: savedLead.id,
      assignedStaffId: savedLead.assignedStaffId,
      assignedStaffName: crmActiveStaffOptions.find((item) => item.value === savedLead.assignedStaffId)?.label || "",
      nextFollowUpDate: savedLead.nextFollowUpDate,
      properties: [
        normalizeCrmProperty({
          propertyName: savedLead.companyName || customerName,
          propertyAddress: savedLead.propertyAddress,
          city: savedLead.city,
          zipCode: savedLead.zipCode,
          propertyType: savedLead.propertyType,
          roofType: savedLead.roofType,
          approximateRoofSize: savedLead.approximateRoofSize,
          notes: savedLead.description,
        }),
      ],
      contacts: [
        normalizeCrmContact({
          name: customerName,
          role: "Primary contact",
          phone: savedLead.phone,
          email: savedLead.email,
          isPrimary: true,
        }),
      ],
      timeline: [
        normalizeCrmTimelineEntry({
          label: "Lead converted",
          summary: `${customerName} converted from lead`,
          details: savedLead.description || "Converted from CRM / Leads",
          createdBy: authUser?.displayName || "",
        }),
        ...(savedLead.history || []).map((entry) =>
          normalizeCrmTimelineEntry({
            ...entry,
            label: entry.label || "Lead activity",
          }),
        ),
      ],
      files: [],
      notes: savedLead.internalNotes || savedLead.description || "",
    });

    const customerResult = await upsertCrmCustomerToSupabase(nextCustomer, authUser);
    if (customerResult?.error) {
      setCrmLeadSyncStatus("saved");
      setSessionMessageType("error");
      setSessionMessage(`The lead was converted, but its shared customer record could not be created: ${customerResult.error.message || customerResult.error}`);
      return;
    }
    const sharedCustomer = normalizeCrmCustomer(customerResult?.data || nextCustomer);

    setCrmCustomers((current) => {
      const next = [...current.filter((customer) => customer.id !== sharedCustomer.id), sharedCustomer];
      return next.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    });
    setCrmSelectedCustomerId(sharedCustomer.id);
    setCrmCustomerDraft(sharedCustomer);
    setCrmLeadDraft(sharedConvertedLead);
    setCrmLeads((current) =>
      [sharedConvertedLead, ...current.filter((lead) => lead.id !== savedLead.id)]
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))),
    );
    setCrmLeadSyncStatus("saved");
    setCrmLeadSyncError("");
    setCrmTab("customers");
    setSessionMessageType("success");
    setSessionMessage("Lead and customer record saved to the shared CRM.");
  };

  const startNewCrmCustomerDraft = () => {
    setCrmCustomerDraft(createBlankCrmCustomer());
    setCrmCustomerEditingId("");
    setCrmSelectedCustomerId("");
  };

  const editCrmCustomer = (customer) => {
    const normalized = normalizeCrmCustomer(customer);
    setCrmCustomerDraft(normalized);
    setCrmCustomerEditingId(normalized.id);
    setCrmSelectedCustomerId(normalized.id);
  };

  const updateCrmCustomerDraftField = (key, value) => {
    setCrmCustomerDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const saveCrmCustomerDraft = async (statusMessage = "Customer saved to the shared CRM.") => {
    if (crmCustomerSaving) return null;
    const normalized = normalizeCrmCustomer({
      ...crmCustomerDraft,
      customerName:
        crmCustomerDraft.customerName ||
        [crmCustomerDraft.firstName, crmCustomerDraft.lastName].filter(Boolean).join(" ").trim() ||
        crmCustomerDraft.companyName ||
        "",
    });
    if (!normalized.customerName) {
      setSessionMessageType("error");
      setSessionMessage("Enter a customer name before saving.");
      return null;
    }
    const nextCustomer = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };
    setCrmCustomerSaving(true);
    setSessionMessageType("info");
    setSessionMessage("Saving customer to the shared CRM…");
    const result = await upsertCrmCustomerToSupabase(nextCustomer, authUser);
    setCrmCustomerSaving(false);
    if (result?.error) {
      setSessionMessageType("error");
      setSessionMessage(`Customer was not saved: ${result.error.message || result.error}`);
      return null;
    }
    const sharedCustomer = normalizeCrmCustomer(result?.data || nextCustomer);
    setCrmCustomers((current) => {
      const next = [...current.filter((customer) => customer.id !== sharedCustomer.id), sharedCustomer];
      return next.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    });
    setCrmCustomerDraft(sharedCustomer);
    setCrmCustomerEditingId(sharedCustomer.id);
    setCrmSelectedCustomerId(sharedCustomer.id);
    setSessionMessageType("success");
    setSessionMessage(statusMessage);
    return sharedCustomer;
  };

  const deleteCrmCustomer = async (customer) => {
    if (!customer?.id || crmCustomerDeletingId || !isFinanceUser) return;
    const customerName = crmCustomerDisplayName(customer);
    if (!window.confirm(`Delete ${customerName} from the shared CRM? This cannot be undone.`)) return;
    setCrmCustomerDeletingId(customer.id);
    setSessionMessageType("info");
    setSessionMessage(`Deleting ${customerName}…`);
    const result = await deleteCrmCustomerFromSupabase(customer.id);
    setCrmCustomerDeletingId("");
    if (result?.error) {
      setSessionMessageType("error");
      setSessionMessage(`Customer was not deleted: ${result.error.message || result.error}`);
      return;
    }
    setCrmCustomers((current) => current.filter((item) => item.id !== customer.id));
    if (crmCustomerEditingId === customer.id) startNewCrmCustomerDraft();
    setSessionMessageType("success");
    setSessionMessage(`${customerName} was deleted from the shared CRM.`);
  };

  const updateCrmCustomerArrayField = (field, updater) => {
    setCrmCustomerDraft((current) => ({
      ...current,
      [field]: typeof updater === "function" ? updater(current[field] || []) : updater,
      updatedAt: new Date().toISOString(),
    }));
  };

  const addCrmPropertyToCustomer = () => {
    updateCrmCustomerArrayField("properties", (current) => [...current, createBlankCrmProperty()]);
  };

  const updateCrmPropertyField = (propertyId, key, value) => {
    updateCrmCustomerArrayField("properties", (current) =>
      current.map((property) => (property.id === propertyId ? { ...property, [key]: value } : property)),
    );
  };

  const removeCrmProperty = (propertyId) => {
    updateCrmCustomerArrayField("properties", (current) => current.filter((property) => property.id !== propertyId));
  };

  const addCrmContactToCustomer = () => {
    updateCrmCustomerArrayField("contacts", (current) => [...current, createBlankCrmContact()]);
  };

  const updateCrmContactField = (contactId, key, value) => {
    updateCrmCustomerArrayField("contacts", (current) => current.map((contact) => (contact.id === contactId ? { ...contact, [key]: value } : contact)));
  };

  const removeCrmContact = (contactId) => {
    updateCrmCustomerArrayField("contacts", (current) => current.filter((contact) => contact.id !== contactId));
  };

  const addCrmJobToCustomer = () => {
    updateCrmCustomerArrayField("jobs", (current) => [...current, createBlankCrmJob()]);
  };

  const updateCrmJobField = (jobId, key, value) => {
    updateCrmCustomerArrayField("jobs", (current) => current.map((job) => (job.id === jobId ? { ...job, [key]: value } : job)));
  };

  const removeCrmJob = (jobId) => {
    updateCrmCustomerArrayField("jobs", (current) => current.filter((job) => job.id !== jobId));
  };

  const addCrmTimelineEntry = () => {
    const timelineEntry = createBlankCrmTimelineEntry();
    updateCrmCustomerArrayField("timeline", (current) => [...current, timelineEntry]);
  };

  const updateCrmTimelineField = (timelineId, key, value) => {
    updateCrmCustomerArrayField("timeline", (current) =>
      current.map((entry) => (entry.id === timelineId ? { ...entry, [key]: value } : entry)),
    );
  };

  const removeCrmTimelineEntry = (timelineId) => {
    updateCrmCustomerArrayField("timeline", (current) => current.filter((entry) => entry.id !== timelineId));
  };

  const removeCrmFile = (fileId) => {
    updateCrmCustomerArrayField("files", (current) => current.filter((file) => file.id !== fileId));
  };

  const updateCrmFollowupDraftField = (key, value) => {
    setCrmFollowupDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const startNewCrmFollowupDraft = () => {
    setCrmFollowupDraft(createBlankCrmFollowup());
    setCrmFollowupEditingId("");
  };

  const editCrmFollowup = (followup) => {
    const normalized = normalizeCrmFollowup(followup);
    setCrmFollowupDraft(normalized);
    setCrmFollowupEditingId(normalized.id);
  };

  const saveCrmFollowupDraft = async () => {
    if (crmFollowupSaving) return null;
    const normalized = normalizeCrmFollowup(crmFollowupDraft);
    if (!normalized.title.trim() || !normalized.dueDate) {
      setSessionMessageType("error");
      setSessionMessage("Enter a follow-up title and due date.");
      return null;
    }
    const nextFollowup = {
      ...normalized,
      createdBy: normalized.createdBy || authUser?.key || "",
      completedAt: normalized.status === "Completed" ? normalized.completedAt || new Date().toISOString() : "",
      updatedAt: new Date().toISOString(),
    };
    setCrmFollowupSaving(true);
    setSessionMessageType("info");
    setSessionMessage("Saving reminder to the shared CRM…");
    const result = await upsertCrmFollowupToSupabase(nextFollowup, authUser);
    setCrmFollowupSaving(false);
    if (result?.error) {
      setSessionMessageType("error");
      setSessionMessage(`Reminder was not saved: ${result.error.message || result.error}`);
      return null;
    }
    const sharedFollowup = normalizeCrmFollowup(result?.data || nextFollowup);
    setCrmFollowups((current) => {
      const next = [...current.filter((followup) => followup.id !== sharedFollowup.id), sharedFollowup];
      return next.sort((a, b) => String(a.dueDate || a.createdAt || "").localeCompare(String(b.dueDate || b.createdAt || "")));
    });
    setCrmFollowupDraft(sharedFollowup);
    setCrmFollowupEditingId(sharedFollowup.id);
    setSessionMessageType("success");
    setSessionMessage("Reminder saved to the shared CRM.");
    return sharedFollowup;
  };

  const deleteCrmFollowup = async (followup) => {
    if (!followup?.id || crmFollowupDeletingId) return;
    if (!window.confirm(`Delete ${followup.title || "this reminder"} from the shared CRM? This cannot be undone.`)) return;
    setCrmFollowupDeletingId(followup.id);
    setSessionMessageType("info");
    setSessionMessage("Deleting reminder…");
    const result = await deleteCrmFollowupFromSupabase(followup.id);
    setCrmFollowupDeletingId("");
    if (result?.error) {
      setSessionMessageType("error");
      setSessionMessage(`Reminder was not deleted: ${result.error.message || result.error}`);
      return;
    }
    setCrmFollowups((current) => current.filter((item) => item.id !== followup.id));
    if (crmFollowupEditingId === followup.id) startNewCrmFollowupDraft();
    setSessionMessageType("success");
    setSessionMessage("Reminder deleted from the shared CRM.");
  };

  const handleAddFieldDailyLogMaterialRow = () => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      materialsRows: [...(current.materialsRows || []), createBlankFieldDailyLogMaterialRow()],
    }));
  };

  const handleRemoveFieldDailyLogMaterialRow = (rowId) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      materialsRows: (current.materialsRows || []).filter((row) => row.id !== rowId),
    }));
  };

  const handleFieldDailyLogMaterialRowChange = (rowId, key, value) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      materialsRows: (current.materialsRows || []).map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
    }));
  };

  const processFieldUploads = async entries => {
    if (fieldUploadLock.current || fieldDailyLogSaveLock.current) return;
    fieldUploadLock.current = true; setFieldUploadBusy(true);
    const failures = []; let completed = 0;
    try {
      for (const entry of entries) {
        try {
          if (entry.logId !== fieldDailyLogDraft.id) throw new Error("Open the original daily-log draft before retrying");
          const uploaded = await uploadFieldDailyLogPhotoToStorage(entry.file, authUser.key, entry.logId, entry.category, entry.id);
          setFieldDailyLogDraft(current => entry.rowId ? { ...current, fuelReceipts:(current.fuelReceipts || []).map(row => row.id === entry.rowId ? { ...row, receiptPhotoUrl:uploaded.photoUrl, receiptPhotoPath:uploaded.storagePath, receiptPhotoName:uploaded.fileName } : row) } : {
            ...current, photos:[...(current.photos || []), normalizeFieldDailyLogPhotoRow({id:entry.id,photoCategory:entry.category,fileName:uploaded.fileName,storagePath:uploaded.storagePath,photoUrl:uploaded.photoUrl,uploadedAt:new Date().toISOString(),uploadedBy:authUser.displayName,deviceIdentifier:fieldOperationsDeviceId})],
          });
          completed++;
        } catch (error) { failures.push({...entry,error:error.message || String(error)}); }
      }
      setPendingFieldUploads(current => [...current.filter(item => !entries.some(entry => entry.id === item.id)), ...failures]);
      setSessionMessageType(failures.length ? "error" : "success");
      setSessionMessage(failures.length ? `${completed} uploaded; ${failures.length} failed. Keep this page open and retry in Field Operations. ${failures[0].error}` : `${completed} photo(s) uploaded. Save the daily log to attach them.`);
    } finally { fieldUploadLock.current=false;setFieldUploadBusy(false); }
  };
  const retryFieldUploads = () => processFieldUploads(pendingFieldUploads);
  const discardPendingFieldUpload = id => setPendingFieldUploads(current => current.filter(item => item.id !== id));
  const handleFieldDailyLogPhotoUpload = async (category, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if(files.length) await processFieldUploads(files.map(file=>({file,category,id:crypto.randomUUID(),logId:fieldDailyLogDraft.id})));
  };

  const handleRemoveFieldDailyLogPhoto = (photoId) => {
    setFieldDailyLogDraft((current) => ({
      ...current,
      photos: (current.photos || []).filter((photo) => photo.id !== photoId),
    }));
  };

  const persistFieldDailyLog = async (status = "draft") => {
    if (fieldDailyLogSaveLock.current || fieldUploadLock.current) return {ok:false};
    if (pendingFieldUploads.length) { setSessionMessageType("error"); setSessionMessage("Retry failed uploads before saving or submitting this daily log."); return {ok:false}; }
    if (!authUser?.key) {
      setSessionMessageType("error");
      setSessionMessage("Please sign in before saving a daily log.");
      return { ok: false };
    }

    const nextDraft = normalizeFieldDailyLogDraft(
      {
        ...fieldDailyLogDraft,
        status,
        submittedAt: status === "submitted" ? fieldDailyLogDraft.submittedAt || new Date().toISOString() : "",
        submittedBy: status === "submitted" ? fieldDailyLogDraft.submittedBy || authUser.displayName || authUser.key : "",
        deviceIdentifier: fieldOperationsDeviceId,
        crewRows: fieldDailyLogDraft.crewRows && fieldDailyLogDraft.crewRows.length ? fieldDailyLogDraft.crewRows : [createBlankFieldDailyLogCrewRow()],
        materialsRows: fieldDailyLogDraft.materialsRows && fieldDailyLogDraft.materialsRows.length ? fieldDailyLogDraft.materialsRows : [],
        vehicleRows: fieldDailyLogDraft.vehicleRows && fieldDailyLogDraft.vehicleRows.length ? fieldDailyLogDraft.vehicleRows : [createBlankFieldDailyLogVehicleRow()],
        fuelReceipts: fieldDailyLogDraft.fuelReceipts || [],
      },
      authUser.displayName || "",
    );
    const totals = calculateFieldDailyLogTotals(nextDraft);
    const photosHaveRequiredCoverage = fieldDailyLogHasProgressOrCompletedPhoto(nextDraft);
    const invalidMileageRow = (nextDraft.vehicleRows || []).find((row) => toNumber(row.endingMileage, 0) < toNumber(row.startingMileage, 0));
    if (status === "submitted" && !photosHaveRequiredCoverage) {
      setSessionMessageType("error");
      setSessionMessage("Add at least one progress or completed-work photo before submission.");
      return { ok: false };
    }
    if (status === "submitted" && invalidMileageRow) {
      setSessionMessageType("error");
      setSessionMessage("Ending mileage cannot be less than starting mileage.");
      return { ok: false };
    }

    const nextLog = {
      ...nextDraft,
      status,
      submittedAt: status === "submitted" ? nextDraft.submittedAt || new Date().toISOString() : "",
      submittedBy: status === "submitted" ? nextDraft.submittedBy || authUser.displayName || authUser.key : "",
      deviceIdentifier: fieldOperationsDeviceId,
      totalRegularHours: totals.totalRegularHours,
      totalOvertimeHours: totals.totalOvertimeHours,
      totalDoubleTimeHours: totals.totalDoubleTimeHours,
      totalCrewHours: totals.totalCrewHours,
      vehicleMilesDriven: totals.vehicleMilesDriven,
      totalFuelReceipts: totals.totalFuelReceipts,
      totalFuelGallons: totals.totalFuelGallons,
      calculatedLunchDurationHours: totals.calculatedLunchDurationHours,
      calculatedTimeOnSiteHours: totals.calculatedTimeOnSiteHours,
      highMileageCount: totals.highMileageCount,
      photoCount: totals.photoCount,
    };

    setSessionMessageType("");
    setSessionMessage(status === "submitted" ? "Submitting daily log..." : "Saving draft...");

    fieldDailyLogSaveLock.current=true;setFieldDailyLogSaving(true);
    try {
      const { data: savedLog, error } = await upsertFieldDailyLogToSupabase(nextLog, authUser.key, {
        submittedBy: authUser.displayName || authUser.key,
        changedBy: authUser.displayName || authUser.key,
        deviceIdentifier: fieldOperationsDeviceId,
        photoCount: totals.photoCount,
      });

      if (error) {
        throw error;
      }

      const persistedLog = {
        ...nextLog,
        serverUpdatedAt: savedLog.updated_at,
        submittedAt: nextLog.submittedAt || (status === "submitted" ? new Date().toISOString() : ""),
      };

      setFieldDailyLogs((current) => [persistedLog, ...current.filter((item) => item.id !== persistedLog.id)]);
      if (status === "submitted") {
        setFieldDailyLogSelectedId(persistedLog.id);
        resetFieldDailyLogDraft(true);
        setSessionMessageType("success");
        setSessionMessage("Daily log submitted and locked.");
      } else {
        setFieldDailyLogDraft(persistedLog);
        setSessionMessageType("success");
        setSessionMessage("Daily log draft saved.");
      }
      return { ok: true, log: persistedLog };
    } catch (error) {
      console.error("Field daily log save failed:", error);
      setSessionMessageType("error");
      setSessionMessage(`Unable to save daily log: ${error?.message || String(error)}`);
      return { ok: false, error };
    } finally { fieldDailyLogSaveLock.current=false;setFieldDailyLogSaving(false); }
  };

  const handleSaveFieldDailyLogDraft = () => persistFieldDailyLog("draft");

  const handleSubmitDailyLog = () => persistFieldDailyLog("submitted");

  const handleExportPayrollCsv = () => {
  const exportRows = fieldDailyLogs
      .filter((log) => String(log.status || "").toLowerCase() === "submitted")
      .flatMap((log) => {
        const crewRows = Array.isArray(log.crewRows) ? log.crewRows : [];
        return crewRows.map((row) => ({
          workDate: log.workDate || "",
          jobNumber: log.jobNumber || "",
          jobName: log.jobName || "",
          employeeName: row.employeeName || "",
          employeeId: row.employeeId || "",
          startTime: row.startTime || "",
          endTime: row.endTime || "",
          lunchDuration: num(row.lunchDurationHours, 2),
          regularHours: num(row.regularHours, 2),
          overtimeHours: num(row.overtimeHours, 2),
          doubleTimeHours: num(row.doubleTimeHours, 2),
          foreman: log.foreman || "",
          logId: log.id || "",
        }));
      });

    const header = [
      "Work date",
      "Job number",
      "Job name",
      "Employee name",
      "Employee ID",
      "Start time",
      "End time",
      "Lunch duration",
      "Regular hours",
      "Overtime hours",
      "Double-time hours",
      "Foreman",
      "Log ID",
    ];
    const csv = [
      header.join(","),
      ...exportRows.map((row) =>
        [
          row.workDate,
          row.jobNumber,
          row.jobName,
          row.employeeName,
          row.employeeId,
          row.startTime,
          row.endTime,
          row.lunchDuration,
          row.regularHours,
          row.overtimeHours,
          row.doubleTimeHours,
          row.foreman,
          row.logId,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `field-operations-payroll-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setSessionMessageType("success");
    setSessionMessage("Payroll CSV exported.");
  };

  const handleOpenFieldDailyLogReview = (logId) => {
    setFieldOperationsTab("officeReview");
    setFieldDailyLogSelectedId(logId);
  };

  const handleFieldDailyLogFilterChange = (key, value) => {
    setFieldDailyLogFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleClearEstimate = () => {
    setEditingEstimate(null);
    setInputs(DEFAULT_INPUTS);
    setPrices({ ...DEFAULT_MATERIAL_PRICES });
    setEstimateName("");
    setFieldNotes(DEFAULT_FIELD_NOTES);
    setQuickMeasureReport(null);
    setQuickMeasureStatus("");
    setTravelLookupMessage("");
    setSessionMessageType("success");
    setSessionMessage("Estimate cleared.");
  };

  const handleSaveEstimate = async () => {
    if (SERVICE_TEMPLATES.includes(activeTemplate)) {
      const error = validateServiceEstimate(inputs);
      if (error) { setSessionMessageType("error"); setSessionMessage(error); return; }
    }
    if (!authUser?.key) {
      setSessionMessageType("error");
      setSessionMessage("Please sign in before saving an estimate.");
      return;
    }

    setSessionMessageType("");
    setSessionMessage("Saving estimate...");

    let reservedEstimateNumber = null;
    if (!editingEstimate?.estimateNumber) {
      const { value, error: reserveNumberError } = await reserveNextEstimateNumberFromSupabase();
      reservedEstimateNumber = value;
      if (reserveNumberError) {
        console.warn("Estimate number reservation failed:", reserveNumberError.message || reserveNumberError);
      }
    }
    const estimateNumber = editingEstimate?.estimateNumber || Math.max(1, Number(reservedEstimateNumber) || Number(nextEstimateNumber) || 1);
    const estimateCodeValue = editingEstimate?.estimateCode || estimateCode(estimateNumber);
    const status = String(inputs.estimateStatus || "draft").toLowerCase();
    const savedQuickMeasureReport = quickMeasureReport
      ? {
          fileName: quickMeasureReport.fileName || "",
          uploadedAt: quickMeasureReport.uploadedAt || "",
          pageCount: quickMeasureReport.pageCount || 0,
          fields: quickMeasureReport.fields || {},
          appliedTo: quickMeasureReport.appliedTo || "",
          appliedAt: quickMeasureReport.appliedAt || "",
          appliedValues: quickMeasureReport.appliedValues || {},
        }
      : null;
    const savedInputs = {
      ...inputs,
      estimateType: estimateTypeForTemplate(activeTemplate),
      quickMeasureReport: savedQuickMeasureReport,
    };

    const savedEstimate = {
      id: editingEstimate?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      dbId: editingEstimate?.dbId || "",
      ownerId: editingEstimate?.ownerId || authUser.key,
      ownerDisplayName: editingEstimate?.ownerDisplayName || authUser.displayName || "",
      ownerEmail: editingEstimate?.ownerEmail || authUser.email || "",
      estimateNumber,
      estimateCode: estimateCodeValue,
      estimateType: estimateTypeForTemplate(activeTemplate),
      name: currentEstimateName,
      savedAt: new Date().toISOString(),
      status,
      quickMeasureReport: savedQuickMeasureReport,
      inputs: savedInputs,
      prices,
      summary: {
        totalSquares: calculation?.scope?.totalSquares ?? calculation?.totalSquares ?? calculation?.tileTotalRoofSquares ?? calculation?.productionSquares ?? calculation?.totalRoofSquares ?? 0,
        foamMaterialCost: calculation.foamMaterialCost,
        dripEdgeRequired: calculation.dripEdgeRequired,
        foamStopDripEdgeCost: calculation.foamStopDripEdgeCost,
        foamKitsNeeded: calculation.foamKitsNeeded,
        yieldPerKitAtSelectedThickness: calculation.yieldPerKitAtSelectedThickness,
        selectedFoamThicknessInches: calculation.selectedFoamThicknessInches,
        materialPricingCost: calculation.materialPricingCost,
        materialCost: calculation.materialCost,
        totalDetailMaterialCost: calculation.totalDetailMaterialCost,
        detailMaterialItems: calculation.detailMaterialItems,
        equipmentRentalItems: calculation.equipmentRentalItems,
        equipmentRentalTotal: calculation.equipmentRentalTotal,
        rooftopDeliveryFee: calculation.rooftopDeliveryFee,
        skylightCurbLumberOrderItem: calculation.skylightCurbLumberOrderItem,
        skylightCurbLumberBoardQuantity: calculation.skylightCurbLumberBoardQuantity,
        skylightCurbLumberBoardUnitCost: calculation.skylightCurbLumberBoardUnitCost,
        laborCost: calculation.laborCost,
        prevailingWageJob: calculation.prevailingWageJob,
        prevailingWageHourlyRate: calculation.prevailingWageHourlyRate,
        prevailingWageCrewSize: calculation.prevailingWageCrewSize,
        prevailingWageHoursPerDay: calculation.prevailingWageHoursPerDay,
        prevailingWageJobDays: calculation.prevailingWageJobDays,
        prevailingWageLaborCost: calculation.prevailingWageLaborCost,
        lodgingNeeded: calculation.lodgingNeeded,
        lodgingName: calculation.lodgingName,
        nightlyLodgingCost: calculation.nightlyLodgingCost,
        lodgingNights: calculation.lodgingNights,
        lodgingTotal: calculation.lodgingTotal,
        overheadOperatingCost: calculation.overheadOperatingCost,
        totalCostBeforeProfit: calculation.totalCostBeforeProfit,
        totalCost: calculation.totalCost,
        selectedMarkupPercent: calculation.selectedMarkupPercent,
        selectedBidAmount: calculation.selectedBidAmount,
        selectedPricePerSq: calculation.selectedPricePerSq,
        selectedProfitDollars: calculation.selectedProfitDollars,
        quickMeasureReport: savedQuickMeasureReport,
      },
    };

    try {
          const { data, error } = await upsertEstimateToSupabase(
        savedEstimate,
        savedInputs,
        prices,
        savedEstimate.summary,
        calculation,
        authUser.key,
      );

      const savedRow = Array.isArray(data) ? mapEstimateRow(data[0]) : mapEstimateRow(data?.[0]);
      const persistedEstimate = savedRow ?? savedEstimate;
      const persistedId = persistedEstimate.dbId || persistedEstimate.id;
      const nextSaved = [persistedEstimate, ...activeSavedEstimates.filter((item) => (item.dbId || item.id) !== persistedId)];
      setSavedEstimates(nextSaved);
      setEditingEstimate(persistedEstimate);
      writeJson(SAVED_KEY(authUser.key), nextSaved);

      if (error) {
        const cloudErrorMessage = error.message || String(error);
        console.warn("Supabase save failed:", cloudErrorMessage);
        setSessionMessageType("error");
        setSessionMessage(`Save failed: ${cloudErrorMessage}. Saved ${estimateCodeValue} locally.`);
      } else {
        setSessionMessageType("success");
        setSessionMessage(`Saved to cloud: ${estimateCodeValue}.`);
      }

      if (persistedEstimate.status === "completed") {
        const { error: completedError, data: completedData } = await upsertCompletedJobToSupabase(
          persistedEstimate,
          inputs,
          calculation,
          authUser.key,
        );
        if (!completedError && Array.isArray(completedData)) {
          setCompletedJobs(completedData.map(mapCompletedJobRow).filter(Boolean));
        }
        if (completedError) {
          console.warn("Completed job sync failed:", completedError.message || completedError);
        }
      }

      if (!editingEstimate?.estimateNumber) {
        const { value: peekNext } = await peekNextEstimateNumberFromSupabase();
        setNextEstimateNumber(Math.max(estimateNumber + 1, Number(peekNext) || 0));
      }
    } catch (error) {
      console.error("handleSaveEstimate failed:", error);
      setSessionMessage(`Save failed: ${error?.message || String(error)}`);
    }
  };

  const handleLoadEstimate = (estimate) => {
    if (!authUser?.key || !estimate) return;
    setEditingEstimate(estimate);
    setInputs(normalizeDraftInputs(estimate.inputs || DEFAULT_INPUTS));
    setPrices(estimate.prices || prices);
    setEstimateName(estimate.name || "");
    setQuickMeasureReport(estimate.quickMeasureReport || estimate.inputs?.quickMeasureReport || null);
    const typeKey = String(estimate.estimateType || "").trim().toLowerCase();
    const templateKey =
      typeKey === "tpo"
        ? "tpo"
        : typeKey === "spray foam"
          ? "sprayFoam"
          : typeKey === "tile"
            ? "tile"
            : typeKey === "shingle"
              ? "shingle"
              : typeKey === "coating"
                ? "coating"
                : typeKey === "maintenance"
                  ? "maintenance"
                  : typeKey === "repair / service"
                    ? "repair"
                    : "dashboard";
    setActiveTemplate(templateKey);
    setSessionMessage(`Loaded ${estimate.estimateCode || "estimate"}.`);
  };

  const handleFieldNotesChange = (key, value) => {
    setFieldNotes((current) => ({
      ...current,
      [key]: value,
    }));
    if (key === "jobAddress") {
      setInputs((current) => ({
        ...current,
        jobAddress: String(value || ""),
        jobSiteAddress: String(value || ""),
        travelDistanceSource: "manual",
      }));
    }
  };

  const requestPhotoAccessAndOpenPicker = ({ accept = "image/*", multiple = true, onChange }) => {
    if (typeof window === "undefined" || typeof window.confirm !== "function") return;
    const shouldAllow = window.confirm("Would you like to allow CRT Roofing Employee Portal access your photos?");
    if (!shouldAllow) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = "none";
    input.addEventListener(
      "change",
      (event) => {
        if (typeof onChange === "function") {
          onChange(event);
        }
        input.remove();
      },
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  };

  const handleFieldNotesPhotosChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextPhotos = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type,
                dataUrl: String(reader.result || ""),
              });
            reader.onerror = () =>
              resolve({
                name: file.name,
                type: file.type,
                dataUrl: "",
              });
            reader.readAsDataURL(file);
          }),
      ),
    );

    setFieldNotes((current) => ({
      ...current,
      photos: [...current.photos, ...nextPhotos].filter(Boolean),
    }));
    event.target.value = "";
  };

  const handleSaveInspection = () => {
    if (!authUser?.key) return;

    const inspection = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      savedAt: new Date().toISOString(),
      ...normalizeFieldNotes(fieldNotes),
    };

    const nextInspections = [inspection, ...savedInspections];
    setSavedInspections(nextInspections);
    writeJson(INSPECTIONS_KEY(authUser.key), nextInspections);
    setSessionMessage("Inspection saved.");
  };

  const handleLoadInspection = (inspection) => {
    if (!inspection) return;
    setFieldNotes(normalizeFieldNotes(inspection));
    setInspectionTemplateChooserOpen(false);
    setSessionMessage("Inspection loaded.");
  };

  const handleDeleteInspection = (inspectionId) => {
    if (!authUser?.key) return;
    const next = savedInspections.filter((item) => item.id !== inspectionId);
    setSavedInspections(next);
    writeJson(INSPECTIONS_KEY(authUser.key), next);
    setSessionMessage("Inspection deleted.");
  };

  const handleCreateEstimateFromInspection = (templateKey, sourceInspection = fieldNotes) => {
    const transfer = buildInspectionTransferInputs(sourceInspection);
    const nextInputs = normalizeDraftInputs({
      ...DEFAULT_INPUTS,
      ...inputs,
      ...transfer,
    });

    setInputs(nextInputs);
    setEstimateName(String(sourceInspection.jobName || estimateName || ""));
    setActiveTemplate(templateKey);
    setInspectionTemplateChooserOpen(false);
    setSessionMessage(`Created ${templateKey} estimate from inspection.`);
  };

  const handleDeleteEstimate = async (estimateOrId) => {
    if (!authUser?.key) return;
    const estimateId = typeof estimateOrId === "object" ? estimateOrId.id : estimateOrId;
    const dbId = typeof estimateOrId === "object" ? estimateOrId.dbId : "";
    const next = activeSavedEstimates.filter((item) => item.id !== estimateId && item.dbId !== dbId);
    setSavedEstimates(next);
    setEditingEstimate((current) => (current && (current.id === estimateId || current.dbId === dbId) ? null : current));
    setCompletedJobs((current) => current.filter((job) => job.estimateId !== estimateId));

    const { error } = await deleteEstimateFromSupabase(
      typeof estimateOrId === "object" ? estimateOrId : { id: estimateId },
      authUser.key,
    );
    if (error) {
      console.warn("Supabase delete failed:", error.message || error);
    }

    setSessionMessage("Saved estimate deleted.");
  };

  const handleEstimateOwnerSelection = (estimateId, ownerId) => {
    setEstimateOwnerAssignments((current) => ({
      ...current,
      [estimateId]: ownerId,
    }));
  };

  const handleReassignEstimateOwner = async (estimate) => {
    if (!authUser?.key || !isAdminUser || !estimate?.dbId) return;
    const selectedOwnerId = estimateOwnerAssignments[estimate.id] || estimate.ownerId;
    if (!selectedOwnerId || selectedOwnerId === estimate.ownerId) return;

    const selectedOwnerProfile = companyUserProfiles.find((profile) => profile.id === selectedOwnerId) || null;
    const { error } = await reassignEstimateOwnerInSupabase(estimate.dbId, selectedOwnerId);
    if (error) {
      setSessionMessageType("error");
      setSessionMessage(`Owner reassignment failed: ${error.message || String(error)}`);
      return;
    }

    setSavedEstimates((current) =>
      current
        .map((item) =>
          item.dbId === estimate.dbId
            ? {
                ...item,
                ownerId: selectedOwnerId,
                ownerDisplayName: String(selectedOwnerProfile?.full_name || selectedOwnerProfile?.email || ""),
                ownerEmail: String(selectedOwnerProfile?.email || ""),
              }
            : item,
        )
        .filter((item) => isAdminUser || item.ownerId === authUser.key),
    );

    setSessionMessageType("success");
    setSessionMessage("Estimate owner reassigned.");
  };

  const handleCompleteJob = (estimate) => {
    if (!estimate) return;
    setInputs(normalizeDraftInputs(estimate.inputs || DEFAULT_INPUTS));
    setPrices(estimate.prices || prices);
    setEstimateName(estimate.name || "");
    setQuickMeasureReport(estimate.quickMeasureReport || estimate.inputs?.quickMeasureReport || null);
    handleOpenMetricsForm(estimate);
  };

  const handleOpenMetricsForm = (estimate) => {
    if (!estimate) return;
    const existingMetrics = completedJobMetrics.find((m) => m.estimate_id === estimate.id);
    setSelectedMetricsEstimate(estimate);
    setMetricsFormData(
      existingMetrics || {
        estimateId: estimate.id,
        localEstimateId: estimate.id,
        estimateCode: estimate.estimateCode,
        jobName: estimate.inputs?.jobName || "",
        customerName: estimate.inputs?.customerName || "",
        roofType: estimate.inputs?.roofType || estimate.summary?.roofType || estimate.estimateType || buildEstimateRoofType(estimate.inputs || {}),
        totalSquares: estimate.summary?.totalSquares || estimate.inputs?.totalSquares || 0,
        estimateFinalBid: estimate.summary?.selectedBidAmount || 0,
        estimateMaterialCost: estimate.summary?.materialCost || 0,
        estimateLaborCost: estimate.summary?.laborCost || 0,
        estimateTravelCost: estimate.summary?.travelCost || 0,
        actualMaterialCost: existingMetrics?.actual_material_cost || 0,
        actualLaborCost: existingMetrics?.actual_labor_cost || 0,
        actualLaborHours: existingMetrics?.actual_labor_hours || 0,
        actualTravelCost: existingMetrics?.actual_travel_cost || 0,
        changeOrders: existingMetrics?.change_orders || 0,
        finalInvoiceAmount: existingMetrics?.final_invoice_amount || 0,
        actualProfit: existingMetrics?.actual_profit || 0,
        actualMarginPercent: existingMetrics?.actual_margin_percent || 0,
        notes: existingMetrics?.notes || "",
        lessonsLearned: existingMetrics?.lessons_learned || "",
      }
    );
    setActiveTemplate("jobMetrics");
  };

  const handleMetricsFormChange = (key, value) => {
    setMetricsFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveMetrics = async () => {
    if (!authUser?.key || !metricsFormData) {
      setSessionMessageType("error");
      setSessionMessage("Please sign in and select an estimate.");
      return;
    }

    setSessionMessageType("");
    setSessionMessage("Saving job metrics...");

    const profitAmount = toNumber(metricsFormData.finalInvoiceAmount) - toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.actualTravelCost);
    const marginPercent = toNumber(metricsFormData.finalInvoiceAmount) > 0 ? round((profitAmount / toNumber(metricsFormData.finalInvoiceAmount)) * 100, 1) : 0;

    const metricsPayload = {
      ...metricsFormData,
      actualProfit: profitAmount,
      actualMarginPercent: marginPercent,
    };

    try {
      const { error } = await upsertCompletedJobMetricsToSupabase(metricsPayload, authUser.key);

      if (error) {
        const cloudErrorMessage = error.message || String(error);
        console.warn("Metrics save failed:", cloudErrorMessage);
        setSessionMessageType("error");
        setSessionMessage(`Metrics save failed: ${cloudErrorMessage}`);
      } else {
        setSessionMessageType("success");
        setSessionMessage("Completed job saved.");
        const { data: metricsData } = await fetchCompletedJobMetricsFromSupabase(authUser.key);
        if (metricsData) setCompletedJobMetrics(metricsData);
      }
    } catch (error) {
      console.error("handleSaveMetrics failed:", error);
      setSessionMessageType("error");
      setSessionMessage(`Save failed: ${error?.message || String(error)}`);
    }
  };

  const createBlankEmployeeRow = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: "",
    employeeName: "",
    hoursWorked: 0,
    hourlyRate: 0,
  });

  const createBlankMaterialItem = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: "",
    quantity: 0,
    unitCost: 0,
  });

  const createBlankSubcontractorRow = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    company: "",
    squares: 0,
    pricePerSquare: 0,
  });

  const createBlankDailyTravelRow = () => {
    const vehicle = TRAVEL_VEHICLE_OPTIONS[0];
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      vehicleKey: vehicle.value,
      vehicleName: vehicle.label,
      milesDriven: 0,
      mpg: toNumber(adminTravelSettings.vehicleMpgByKey?.[vehicle.value], vehicle.mpg),
      fuelCostPerGallon: toNumber(adminTravelSettings.fuelCostPerGallon, DEFAULT_TRAVEL_ADMIN_SETTINGS.fuelCostPerGallon),
      otherTravelCost: 0,
    };
  };

  const createBlankDailyProgress = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString().slice(0, 10),
    crewSize: 0,
    employeeRows: [createBlankEmployeeRow()],
    subcontractors: [createBlankSubcontractorRow()],
    travelRows: [createBlankDailyTravelRow()],
    sprayFoamGallonsUsed: 0,
    materialsUsed: [createBlankMaterialItem()],
    attachments: [],
    notes: "",
    issues: "",
  });

  const calculateApprovedJobTotals = (logs) => {
    const totals = {
      totalActualLaborHours: 0,
      totalActualBasePayroll: 0,
      totalWorkersCompCost: 0,
      totalPayrollTaxCost: 0,
      totalActualLaborCost: 0,
      totalSubcontractorCost: 0,
      totalTravelMiles: 0,
      totalFuelGallons: 0,
      totalFuelCost: 0,
      totalOtherTravelCost: 0,
      totalTravelCost: 0,
      totalJobDays: logs.length,
      totalSprayFoamGallonsUsed: 0,
      totalSprayFoamEquivalentKits: 0,
      totalSprayFoamCost: 0,
      totalMaterialCost: 0,
      directActualCost: 0,
      operatingOverheadCost: 0,
      runningActualCost: 0,
      laborLog: [],
      subcontractorLog: [],
      travelLog: [],
      materialUsageLog: [],
    };

    logs.forEach((day) => {
      (day.employeeRows || []).forEach((employee) => {
        const laborCost = calculateDailyEmployeeLaborCost(employee);
        totals.totalActualLaborHours += laborCost.hoursWorked;
        totals.totalActualBasePayroll += laborCost.basePayroll;
        totals.totalWorkersCompCost += laborCost.workersCompCost;
        totals.totalPayrollTaxCost += laborCost.payrollTaxCost;
        totals.totalActualLaborCost += laborCost.totalLaborCost;
        totals.laborLog.push({
          dayId: day.id,
          date: day.date,
          employeeId: employee.employeeId || "",
          employeeName: employee.employeeName,
          hoursWorked: laborCost.hoursWorked,
          hourlyRate: laborCost.hourlyRate,
          basePayroll: laborCost.basePayroll,
          workersCompCost: laborCost.workersCompCost,
          payrollTaxCost: laborCost.payrollTaxCost,
          laborCost: laborCost.totalLaborCost,
        });
      });
      (day.subcontractors || []).forEach((subcontractor) => {
        const subcontractorCost = calculateSubcontractorCost(subcontractor);
        totals.totalSubcontractorCost += subcontractorCost.totalCost;
        if (subcontractor.company || subcontractorCost.totalCost > 0) {
          totals.subcontractorLog.push({
            dayId: day.id,
            date: day.date,
            company: subcontractor.company || "",
            squares: subcontractorCost.squares,
            pricePerSquare: subcontractorCost.pricePerSquare,
            totalCost: subcontractorCost.totalCost,
          });
        }
      });
      (day.travelRows || []).forEach((travel) => {
        const travelCost = calculateDailyTravelCost(travel);
        totals.totalTravelMiles += travelCost.milesDriven;
        totals.totalFuelGallons += travelCost.estimatedFuelGallons;
        totals.totalFuelCost += travelCost.fuelCost;
        totals.totalOtherTravelCost += travelCost.otherTravelCost;
        totals.totalTravelCost += travelCost.totalTravelCost;
        if (travel.vehicleKey || travelCost.totalTravelCost > 0) {
          totals.travelLog.push({
            dayId: day.id,
            date: day.date,
            vehicleKey: travel.vehicleKey || "",
            vehicleName: travel.vehicleName || "",
            ...travelCost,
          });
        }
      });
      const sprayFoamUsage = calculateSprayFoamMaterialUsage(day.sprayFoamGallonsUsed);
      totals.totalSprayFoamGallonsUsed += sprayFoamUsage.gallonsUsed;
      totals.totalSprayFoamEquivalentKits += sprayFoamUsage.equivalentKits;
      totals.totalSprayFoamCost += sprayFoamUsage.totalCost;
      totals.totalMaterialCost += sprayFoamUsage.totalCost;
      if (sprayFoamUsage.gallonsUsed > 0) {
        totals.materialUsageLog.push({
          dayId: day.id,
          date: day.date,
          description: "Spray foam",
          quantity: sprayFoamUsage.gallonsUsed,
          unitCost: SPRAY_FOAM_KIT_COST / SPRAY_FOAM_GALLONS_PER_KIT,
          totalCost: sprayFoamUsage.totalCost,
          gallonsUsed: sprayFoamUsage.gallonsUsed,
          equivalentKits: sprayFoamUsage.equivalentKits,
        });
      }
      (day.materialsUsed || []).forEach((material) => {
        const quantity = toNumber(material.quantity);
        const unitCost = toNumber(material.unitCost);
        const cost = quantity * unitCost;
        totals.totalMaterialCost += cost;
        totals.materialUsageLog.push({
          dayId: day.id,
          date: day.date,
          description: material.description,
          quantity,
          unitCost,
          totalCost: cost,
        });
      });
    });

    const costWithOverhead = calculateApprovedJobOperatingOverhead(
      totals.totalActualLaborCost + totals.totalSubcontractorCost + totals.totalMaterialCost + totals.totalTravelCost,
    );
    totals.directActualCost = costWithOverhead.directCost;
    totals.operatingOverheadCost = costWithOverhead.operatingOverheadCost;
    totals.runningActualCost = costWithOverhead.totalCost;
    return totals;
  };

  const handleApproveJob = (estimate) => {
    if (!estimate) return;
    const existingJob = completedJobs.find((job) => job.estimateId === estimate.id || job.id === estimate.id);
    const baseJob = existingJob || {
      estimateId: estimate.id,
      localEstimateId: estimate.id,
      estimateCode: estimate.estimateCode,
      jobName: estimate.inputs?.jobName || "",
      customerName: estimate.inputs?.customerName || "",
      roofType: estimate.inputs?.roofType || estimate.summary?.roofType || buildEstimateRoofType(estimate.inputs),
      totalSquares: estimate.summary?.totalSquares || estimate.inputs?.totalSquares || 0,
      approvedBidAmount: estimate.summary?.selectedBidAmount || 0,
      changeOrders: 0,
      salesperson: estimate.inputs?.salesperson || "",
      salesCommissionRate: getDefaultSalesCommissionRate(estimate.inputs?.salesperson),
      otherJobCosts: 0,
      status: "approved",
    };

    const salesperson = baseJob.salesperson
      || estimate.inputs?.salesperson
      || estimate.inputs?.sprayFoamSalesperson
      || estimate.inputs?.shingleSalesperson
      || "";
    setSelectedApprovedJob(estimate);
    setApprovedJobData({
      ...baseJob,
      salesperson,
      salesCommissionRate: toNumber(baseJob.salesCommissionRate, getDefaultSalesCommissionRate(salesperson)),
      otherJobCosts: toNumber(baseJob.otherJobCosts, 0),
      status: baseJob.status || "approved",
    });
    const existingDailyProgress = existingJob?.dailyProgressLog || [];
    setApprovedDailyProgressLogs(existingDailyProgress);
    setCollapsedApprovedDailyProgressDayIds(getDailyProgressDayIds(existingDailyProgress));
    setActiveTemplate("approvedJob");
  };

  const handleOpenApprovedJob = (job) => {
    if (!job) return;
    const matchingEstimate = savedEstimates.find((estimate) => estimate.id === job.estimateId || estimate.id === job.id);
    const data = {
      estimateId: job.estimateId || job.id,
      localEstimateId: job.localEstimateId || job.id,
      estimateCode: job.estimateCode,
      jobName: job.jobName || matchingEstimate?.inputs?.jobName || "",
      customerName: job.customerName || matchingEstimate?.inputs?.customerName || "",
      roofType: job.roofType || matchingEstimate?.summary?.roofType || buildEstimateRoofType(matchingEstimate?.inputs || {}),
      totalSquares: job.squareCount || matchingEstimate?.summary?.totalSquares || 0,
      approvedBidAmount: job.finalBid || matchingEstimate?.summary?.selectedBidAmount || 0,
      changeOrders: toNumber(job.changeOrders || 0),
      salesperson: job.salesperson
        || matchingEstimate?.inputs?.salesperson
        || matchingEstimate?.inputs?.sprayFoamSalesperson
        || matchingEstimate?.inputs?.shingleSalesperson
        || "",
      salesCommissionRate: toNumber(
        job.salesCommissionRate,
        getDefaultSalesCommissionRate(job.salesperson || matchingEstimate?.inputs?.salesperson),
      ),
      otherJobCosts: toNumber(job.otherJobCosts || 0),
      status: job.status || "approved",
    };
    setSelectedApprovedJob(matchingEstimate || job);
    setApprovedJobData(data);
    const existingDailyProgress = job.dailyProgressLog || [];
    setApprovedDailyProgressLogs(existingDailyProgress);
    setCollapsedApprovedDailyProgressDayIds(getDailyProgressDayIds(existingDailyProgress));
    setActiveTemplate("approvedJob");
  };

  const handleApprovedJobFormChange = (key, value) => {
    setApprovedJobData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleApprovedJobSalespersonChange = (value) => {
    setApprovedJobData((current) => ({
      ...current,
      salesperson: value,
      salesCommissionRate: getDefaultSalesCommissionRate(value),
    }));
  };

  const handleAddDailyProgressDay = () => {
    const newDay = createBlankDailyProgress();
    setApprovedDailyProgressLogs((current) => [...current, newDay]);
    setCollapsedApprovedDailyProgressDayIds((current) => current.filter((dayId) => dayId !== newDay.id));
  };

  const handleDeleteDailyProgressDay = (dayId) => {
    setApprovedDailyProgressLogs((current) => current.filter((day) => day.id !== dayId));
    setCollapsedApprovedDailyProgressDayIds((current) => current.filter((collapsedDayId) => collapsedDayId !== dayId));
  };

  const handleToggleDailyProgressDay = (dayId) => {
    setCollapsedApprovedDailyProgressDayIds((current) => toggleCollapsedDailyProgressDay(current, dayId));
  };

  const handleDailyProgressFieldChange = (dayId, key, value) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => (day.id === dayId ? { ...day, [key]: value } : day)));
  };

  const handleAddEmployeeRow = (dayId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return { ...day, employeeRows: [...(day.employeeRows || []), createBlankEmployeeRow()] };
    }));
  };

  const handleDeleteEmployeeRow = (dayId, rowId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return { ...day, employeeRows: (day.employeeRows || []).filter((row) => row.id !== rowId) };
    }));
  };

  const handleEmployeeRowChange = (dayId, rowId, key, value) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return {
        ...day,
        employeeRows: (day.employeeRows || []).map((row) => {
          if (row.id !== rowId) return row;
          if (key === "employeeId") {
            const selectedEmployee = employeeDirectory.find((employee) => employee.id === value) || null;
            return {
              ...row,
              employeeId: value,
              employeeName: selectedEmployee ? buildEmployeeDisplayName(selectedEmployee) : "",
              hourlyRate: selectedEmployee && toNumber(selectedEmployee.hourlyRate) > 0
                ? toNumber(selectedEmployee.hourlyRate)
                : toNumber(row.hourlyRate),
            };
          }
          return { ...row, [key]: value };
        }),
      };
    }));
  };

  const handleAddSubcontractorRow = (dayId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => (
      day.id === dayId
        ? { ...day, subcontractors: [...(day.subcontractors || []), createBlankSubcontractorRow()] }
        : day
    )));
  };

  const handleRemoveSubcontractorRow = (dayId, rowId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => (
      day.id === dayId
        ? { ...day, subcontractors: (day.subcontractors || []).filter((row) => row.id !== rowId) }
        : day
    )));
  };

  const handleSubcontractorRowChange = (dayId, rowId, key, value) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => (
      day.id === dayId
        ? {
            ...day,
            subcontractors: (day.subcontractors || []).map((row) => (
              row.id === rowId ? { ...row, [key]: value } : row
            )),
          }
        : day
    )));
  };

  const handleAddDailyTravelRow = (dayId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => (
      day.id === dayId
        ? { ...day, travelRows: [...(day.travelRows || []), createBlankDailyTravelRow()] }
        : day
    )));
  };

  const handleRemoveDailyTravelRow = (dayId, rowId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => (
      day.id === dayId
        ? { ...day, travelRows: (day.travelRows || []).filter((row) => row.id !== rowId) }
        : day
    )));
  };

  const handleDailyTravelRowChange = (dayId, rowId, key, value) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return {
        ...day,
        travelRows: (day.travelRows || []).map((row) => {
          if (row.id !== rowId) return row;
          if (key === "vehicleKey") {
            const vehicle = TRAVEL_VEHICLE_OPTIONS.find((option) => option.value === value) || TRAVEL_VEHICLE_OPTIONS[0];
            return {
              ...row,
              vehicleKey: vehicle.value,
              vehicleName: vehicle.label,
              mpg: toNumber(adminTravelSettings.vehicleMpgByKey?.[vehicle.value], vehicle.mpg),
            };
          }
          return { ...row, [key]: value };
        }),
      };
    }));
  };

  const handleAddMaterialItem = (dayId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return { ...day, materialsUsed: [...(day.materialsUsed || []), createBlankMaterialItem()] };
    }));
  };

  const handleRemoveMaterialItem = (dayId, itemId) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return { ...day, materialsUsed: (day.materialsUsed || []).filter((item) => item.id !== itemId) };
    }));
  };

  const handleMaterialItemChange = (dayId, itemId, key, value) => {
    setApprovedDailyProgressLogs((current) => current.map((day) => {
      if (day.id !== dayId) return day;
      return {
        ...day,
        materialsUsed: (day.materialsUsed || []).map((item) => (item.id === itemId ? { ...item, [key]: value } : item)),
      };
    }));
  };

  const handleApprovedProgressAttachmentUpload = async (dayId, event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length || !authUser?.key) return;

    setApprovedAttachmentUploadingDayIds((current) => [...new Set([...current, dayId])]);
    const uploaded = [];
    const errors = [];
    const jobId = selectedApprovedJob?.sourceRecordUid
      || approvedJobData?.estimateId
      || approvedJobData?.localEstimateId
      || "approved-job";
    for (const file of files) {
      const result = await uploadApprovedJobAttachmentToStorage(
        file,
        authUser.key,
        jobId,
        dayId,
        authUser.displayName || authUser.email || authUser.key,
      );
      if (result.error) errors.push(`${file.name}: ${result.error.message || result.error}`);
      else if (result.attachment) uploaded.push(result.attachment);
    }

    if (uploaded.length) {
      setApprovedDailyProgressLogs((current) => current.map((day) => (
        day.id === dayId
          ? { ...day, attachments: [...(day.attachments || []), ...uploaded] }
          : day
      )));
    }
    setApprovedAttachmentUploadingDayIds((current) => current.filter((id) => id !== dayId));
    input.value = "";
    if (errors.length) {
      setSessionMessageType("error");
      setSessionMessage(`Some attachments could not be uploaded: ${errors.join(" ")}`);
    } else {
      setSessionMessageType("success");
      setSessionMessage(`${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} uploaded. Save daily progress to attach them to the job.`);
    }
  };

  const handleOpenApprovedProgressAttachment = async (attachment) => {
    if (!attachment?.storagePath) return;
    const { data, error } = await supabase.storage
      .from(APPROVED_JOB_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storagePath, 60 * 10, { download: attachment.fileName || true });
    if (error || !data?.signedUrl) {
      setSessionMessageType("error");
      setSessionMessage(`Could not open attachment: ${error?.message || "Signed link was unavailable."}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleRemoveApprovedProgressAttachment = async (dayId, attachment) => {
    if (!attachment?.id) return;
    if (attachment.storagePath) {
      const { error } = await supabase.storage.from(APPROVED_JOB_ATTACHMENT_BUCKET).remove([attachment.storagePath]);
      if (error) {
        setSessionMessageType("error");
        setSessionMessage(`Could not remove attachment: ${error.message || error}`);
        return;
      }
    }
    setApprovedDailyProgressLogs((current) => current.map((day) => (
      day.id === dayId
        ? { ...day, attachments: (day.attachments || []).filter((item) => item.id !== attachment.id) }
        : day
    )));
    setSessionMessageType("success");
    setSessionMessage("Attachment removed. Save daily progress to update the job record.");
  };

  const updateActiveJobsFilter = (key, value) => {
    setActiveJobsFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateApprovedJobsFilter = (key, value) => {
    setApprovedJobsFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateProposalFilter = (key, value) => {
    setProposalFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openActiveJobDetail = (jobId) => {
    setActiveJobSelectedId(jobId || "");
    setActiveJobEditDraft(null);
    setActiveJobEditMode(false);
    setActiveTemplate("activeJob");
  };

  const handleStartActiveJobEdit = (job) => {
    if (!job || !canManageActiveJobData) return;
    setActiveJobEditDraft(buildActiveJobEditDraft(job));
    setActiveJobEditMode(true);
  };

  const handleActiveJobEditFieldChange = (key, value) => {
    setActiveJobEditDraft((current) => ({ ...current, [key]: value }));
  };

  const handleCancelActiveJobEdit = () => {
    if (activeJobMutationKey) return;
    setActiveJobEditDraft(null);
    setActiveJobEditMode(false);
  };

  const handleSaveActiveJobEdit = async (job) => {
    if (!job || !activeJobEditDraft || !authUser?.key || activeJobMutationKey) return;
    if (!canManageActiveJobData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to edit shared jobs.");
      return;
    }

    const updatedAt = new Date().toISOString();
    const updatedJob = applyActiveJobEditDraft(job, activeJobEditDraft, {
      updatedAt,
      updatedBy: authUser.displayName || authUser.key,
      activityId: `activity-edit-active-${Date.now()}`,
    });

    setActiveJobMutationKey(`edit:${job.id}`);
    setJobsSyncStatus("saving");
    setSessionMessage("");
    try {
      const { error } = isProjectManager
        ? await supabase.rpc("save_project_manager_active_job", {
            p_source_record_uid: buildSharedJobSourceId(updatedJob),
            p_updates: {
              propertyManager: updatedJob.propertyManager,
              projectContact: updatedJob.projectContact,
              projectManager: updatedJob.projectManager,
              fieldSupervisor: updatedJob.fieldSupervisor,
              foreman: updatedJob.foreman,
              officeCoordinator: updatedJob.officeCoordinator,
              status: updatedJob.status,
              currentPhase: updatedJob.currentPhase,
              riskLevel: updatedJob.riskLevel,
              riskReason: updatedJob.riskReason,
              startDate: updatedJob.startDate,
              expectedCompletionDate: updatedJob.expectedCompletionDate,
              percentComplete: updatedJob.percentComplete,
              activityLog: updatedJob.activityLog,
            },
          })
        : await upsertSharedJobToSupabase(
            updatedJob,
            authUser.key,
            authUser.id || authUser.key,
          );
      if (error) throw error;

      const refreshed = await fetchSharedJobsFromSupabase();
      if (!refreshed.error) applySharedJobRows(refreshed.data);
      setJobsSyncStatus(refreshed.error ? "error" : "saved");
      setJobsSyncError(refreshed.error?.message || "");
      setSessionMessageType(refreshed.error ? "error" : "success");
      setSessionMessage(
        refreshed.error
          ? `Changes saved, but the project could not refresh: ${refreshed.error.message || refreshed.error}`
          : `${updatedJob.projectName || "Active job"} updated.`,
      );
      if (!refreshed.error) {
        setActiveJobEditDraft(null);
        setActiveJobEditMode(false);
      }
    } catch (saveError) {
      const saveMessage = saveError.message || String(saveError);
      setJobsSyncStatus("error");
      setJobsSyncError(saveMessage);
      setSessionMessageType("error");
      setSessionMessage(`Could not save project changes: ${saveMessage}`);
    } finally {
      setActiveJobMutationKey("");
    }
  };

  const handleArchiveActiveJob = async (job) => {
    if (!job || !authUser?.key || activeJobMutationKey) return;
    if (!canManageSharedJobData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to archive shared jobs.");
      return;
    }
    if (!window.confirm(`Archive ${job.projectName || "this job"}? You can restore it later.`)) return;

    const archivedAt = new Date().toISOString();
    const archivedJob = {
      ...job,
      archivedFromWorkflowStatus: job.workflowStatus || "active",
      workflowStatus: "archived",
      isActive: false,
      archivedAt,
      activityLog: [
        {
          id: `activity-archive-${Date.now()}`,
          summary: "Job archived",
          changedBy: authUser.displayName || "Unknown",
          createdAt: archivedAt,
        },
        ...(job.activityLog || []),
      ],
    };

    setActiveJobMutationKey(`archive:${job.id}`);
    setJobsSyncStatus("saving");
    try {
      const { error } = await upsertSharedJobToSupabase(
        archivedJob,
        authUser.key,
        authUser.id || authUser.key,
      );
      if (error) throw error;

      const refreshed = await fetchSharedJobsFromSupabase();
      if (refreshed.error) throw new Error(
        `The job was archived, but the job list could not refresh: ${refreshed.error.message || refreshed.error}`,
      );
      applySharedJobRows(refreshed.data);
      setActiveJobSelectedId((current) => (current === job.id ? "" : current));
      setJobsSyncStatus("saved");
      setJobsSyncError("");
      setSessionMessageType("success");
      setSessionMessage(`${job.projectName || "Job"} moved to the archive.`);
    } catch (archiveError) {
      const archiveMessage = archiveError.message || String(archiveError);
      setJobsSyncStatus("error");
      setJobsSyncError(archiveMessage);
      setSessionMessageType("error");
      setSessionMessage(`Archive failed: ${archiveMessage}`);
    } finally {
      setActiveJobMutationKey("");
    }
  };

  const openInvoiceHandoff = (job) => {
    if (!job || !canSubmitInvoiceHandoff) return;
    setInvoiceHandoffJob(job);
    setInvoiceHandoffDraft(createInvoiceHandoffDraft(job));
    setInvoiceHandoffError("");
  };

  const closeInvoiceHandoff = () => {
    if (invoiceHandoffSaving) return;
    setInvoiceHandoffJob(null);
    setInvoiceHandoffDraft(null);
    setInvoiceHandoffError("");
  };

  const updateInvoiceHandoffDraft = (key, value) => {
    setInvoiceHandoffDraft((current) => ({ ...current, [key]: value }));
  };

  const submitInvoiceHandoff = async () => {
    if (!invoiceHandoffJob || !invoiceHandoffDraft || !authUser?.key || invoiceHandoffSaving) return;
    const errors = validateInvoiceHandoffDraft(invoiceHandoffDraft);
    if (errors.length) {
      setInvoiceHandoffError(errors[0]);
      return;
    }
    setInvoiceHandoffSaving(true);
    setInvoiceHandoffError("");
    setJobsSyncStatus("saving");
    let committedRequest = null;
    try {
      const { data, error } = await supabase.rpc("submit_active_job_for_invoicing", {
        p_source_record_uid: buildSharedJobSourceId(invoiceHandoffJob),
        p_completion_date: invoiceHandoffDraft.completionDate,
        p_invoice_type: invoiceHandoffDraft.invoiceType,
        p_customer_name: invoiceHandoffDraft.customerName,
        p_billing_contact_name: invoiceHandoffDraft.billingContactName,
        p_billing_email: invoiceHandoffDraft.billingEmail,
        p_billing_address: invoiceHandoffDraft.billingAddress,
        p_purchase_order_number: invoiceHandoffDraft.purchaseOrderNumber,
        p_payment_terms: invoiceHandoffDraft.paymentTerms,
        p_contract_amount: Number(invoiceHandoffDraft.contractAmount || 0),
        p_change_orders_amount: Number(invoiceHandoffDraft.changeOrders || 0),
        p_amount_already_billed: Number(invoiceHandoffDraft.amountAlreadyBilled || 0),
        p_amount_to_invoice: Number(invoiceHandoffDraft.amountToInvoice || 0),
        p_retainage_amount: Number(invoiceHandoffDraft.retainageAmount || 0),
        p_notes: invoiceHandoffDraft.notes,
      });
      if (error) throw error;
      committedRequest = Array.isArray(data) ? data[0] : data;
      if (!committedRequest?.id) throw new Error("The invoice request was created, but its confirmation number was not returned.");

      const [refreshed, invoiceConfirmation] = await Promise.all([
        fetchSharedJobsFromSupabase(),
        supabase
          .from("invoice_requests")
          .select("id, status")
          .eq("id", committedRequest.id)
          .maybeSingle(),
      ]);
      if (refreshed.error) throw new Error(`The job was sent to invoicing, but Active Jobs could not refresh: ${refreshed.error.message || refreshed.error}`);
      if (invoiceConfirmation.error || !invoiceConfirmation.data?.id) {
        throw new Error(`The job was sent to invoicing, but the Invoice Requests queue could not be confirmed: ${invoiceConfirmation.error?.message || "request not found"}`);
      }

      applySharedJobRows(refreshed.data);
      setJobsSyncStatus("saved");
      setJobsSyncError("");
      setActiveJobSelectedId("");
      setInvoiceHandoffJob(null);
      setInvoiceHandoffDraft(null);
      setSessionMessageType("success");
      setSessionMessage("Job closed and sent to Natalia's Invoice Requests queue.");
      setActiveTemplate(canAccessInvoiceQueue ? "invoices" : "activeJobs");
    } catch (handoffError) {
      const handoffMessage = handoffError.message || String(handoffError);
      setJobsSyncStatus("error");
      setJobsSyncError(handoffMessage);
      if (committedRequest) {
        setActiveJobSelectedId("");
        setInvoiceHandoffJob(null);
        setInvoiceHandoffDraft(null);
        setSessionMessageType("error");
        setSessionMessage(handoffMessage);
        setActiveTemplate(canAccessInvoiceQueue ? "invoices" : "activeJobs");
      } else {
        setInvoiceHandoffError(handoffMessage || "The job could not be sent to invoicing.");
      }
    } finally {
      setInvoiceHandoffSaving(false);
    }
  };

  const handleMoveApprovedJobToActive = async (job) => {
    if (!job || !authUser?.key || activeJobMutationKey) return;
    if (!canManageSharedJobData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to move shared jobs.");
      return;
    }

    const movedAt = new Date().toISOString();
    const activeJob = moveApprovedJobToActive(job, {
      movedAt,
      movedBy: authUser.displayName || authUser.key,
      activityId: `activity-move-active-${Date.now()}`,
    });

    setActiveJobMutationKey(`activate:${job.id}`);
    setJobsSyncStatus("saving");
    try {
      const { error } = await upsertSharedJobToSupabase(
        activeJob,
        authUser.key,
        authUser.id || authUser.key,
      );
      if (error) throw error;

      const refreshed = await fetchSharedJobsFromSupabase();
      if (refreshed.error) throw new Error(
        `The job was moved, but the job lists could not refresh: ${refreshed.error.message || refreshed.error}`,
      );
      applySharedJobRows(refreshed.data);
      setJobsSyncStatus("saved");
      setJobsSyncError("");
      setSessionMessageType("success");
      setSessionMessage(`${job.projectName || "Job"} moved to Active Jobs.`);
    } catch (moveError) {
      const moveMessage = moveError.message || String(moveError);
      setJobsSyncStatus("error");
      setJobsSyncError(moveMessage);
      setSessionMessageType("error");
      setSessionMessage(`Could not move job: ${moveMessage}`);
    } finally {
      setActiveJobMutationKey("");
    }
  };

  const handleRestoreArchivedJob = async (job) => {
    if (!job || !authUser?.key || activeJobMutationKey) return;
    if (!canManageSharedJobData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to restore shared jobs.");
      return;
    }

    const restoredAt = new Date().toISOString();
    const restoredWorkflowStatus = job.archivedFromWorkflowStatus
      || (isActiveJobStatus(job.projectStatus || job.status) ? "active" : "approved");
    const restoredJob = {
      ...job,
      workflowStatus: restoredWorkflowStatus,
      isActive: true,
      archivedAt: "",
      restoredAt,
      activityLog: [
        {
          id: `activity-restore-${Date.now()}`,
          summary: "Job restored from archive",
          changedBy: authUser.displayName || "Unknown",
          createdAt: restoredAt,
        },
        ...(job.activityLog || []),
      ],
    };

    setActiveJobMutationKey(`restore:${job.id}`);
    setJobsSyncStatus("saving");
    try {
      const { error } = await upsertSharedJobToSupabase(
        restoredJob,
        authUser.key,
        authUser.id || authUser.key,
      );
      if (error) throw error;

      const refreshed = await fetchSharedJobsFromSupabase();
      if (refreshed.error) throw new Error(
        `The job was restored, but the job list could not refresh: ${refreshed.error.message || refreshed.error}`,
      );
      applySharedJobRows(refreshed.data);
      setJobsSyncStatus("saved");
      setJobsSyncError("");
      setSessionMessageType("success");
      setSessionMessage(`${job.projectName || "Job"} restored from the archive.`);
    } catch (restoreError) {
      const restoreMessage = restoreError.message || String(restoreError);
      setJobsSyncStatus("error");
      setJobsSyncError(restoreMessage);
      setSessionMessageType("error");
      setSessionMessage(`Restore failed: ${restoreMessage}`);
    } finally {
      setActiveJobMutationKey("");
    }
  };

  const openApprovedJobDetail = (job) => {
    if (!job) return;
    setSelectedApprovedJob(job);
    setApprovedJobData({
      estimateId: job.estimateId || job.id,
      localEstimateId: job.localEstimateId || job.id,
      estimateCode: job.estimateCode || estimateCode(Number(job.jobNumber || 1)),
      jobName: job.projectName || job.jobName || "",
      customerName: job.customerName || "",
      roofType: job.roofType || "",
      totalSquares: toNumber(job.squareCount || job.totalSquares || 0),
      approvedBidAmount: toNumber(job.contractAmount || job.finalBid || 0),
      changeOrders: toNumber(job.changeOrders || 0),
      status: job.projectStatus || job.status || "Approved",
      jobAddress: job.projectAddress || job.jobAddress || "",
      projectContact: job.projectContact || "",
      fieldSupervisor: job.fieldSupervisor || "",
      permitStatus: job.permitStatus || "",
      materialOrderIncomplete: Boolean(job.materialOrderIncomplete),
      customerDocumentIncomplete: Boolean(job.customerDocumentIncomplete),
      subcontractorIncomplete: Boolean(job.subcontractorIncomplete),
      documentsIncomplete: Boolean(job.documentsIncomplete),
    });
    const existingDailyProgress = job.dailyProgressLog || [];
    setApprovedDailyProgressLogs(existingDailyProgress);
    setCollapsedApprovedDailyProgressDayIds(getDailyProgressDayIds(existingDailyProgress));
    setActiveTemplate("approvedJob");
  };

  const getProposalSourceEstimate = (proposal = {}) => findEstimateForProposal(proposal, savedEstimates);

  const archiveProposalForCustomer = (proposalRecord = {}, estimate = null, pdfArchive = {}) => {
    const archivedAt = new Date().toISOString();
    const archiveEntry = buildProposalArchiveEntryFromProposal(proposalRecord, {
      ...pdfArchive,
      archivedAt,
      updatedAt: proposalRecord.updatedAt || archivedAt,
    });

    const sourceCustomer = findCrmCustomerForProposal(crmCustomers, proposalRecord, estimate);
    const syncedCustomer = sourceCustomer
      ? normalizeCrmCustomer({
          ...sourceCustomer,
          proposalArchive: mergeProposalArchiveEntries(sourceCustomer.proposalArchive, archiveEntry),
          updatedAt: archivedAt,
        })
      : createCustomerFromProposal(proposalRecord, estimate, archiveEntry);
    setCrmCustomers((current) => sourceCustomer
      ? current.map((customer) => (customer.id === sourceCustomer.id ? syncedCustomer : customer))
      : [syncedCustomer, ...current]);

    if (crmSelectedCustomerId === syncedCustomer.id || !crmSelectedCustomerId) {
      setCrmCustomerDraft(syncedCustomer);
      setCrmSelectedCustomerId(syncedCustomer.id);
    }

    return archiveEntry;
  };

  const openProposalBuilder = (proposal) => {
    if (!proposal) return;
    const sourceEstimate = getProposalSourceEstimate(proposal);
    const syncedProposal = proposalIsFinalized(proposal) ? normalizeProposalRecord(proposal) : syncProposalWithEstimate(proposal, sourceEstimate, proposalTemplate);
    setProposalDraft({ ...createBlankProposal(), ...syncedProposal });
    setProposalSelectedId(syncedProposal.id || proposal.id || "");
    setActiveTemplate("proposalBuilder");
  };

  const handleConvertEstimateToProposal = async (estimate) => {
    if (!estimate) return;
    const proposal = createProposalFromEstimate(estimate, proposalTemplate);
    const syncedProposal = syncProposalWithEstimate(proposal, estimate, proposalTemplate);
    setProposals((current) => {
      const next = [syncedProposal, ...current.filter((item) => item.sourceEstimateId !== syncedProposal.sourceEstimateId || item.version !== syncedProposal.version)];
      return next;
    });
    await generateProposalPdfArchive(syncedProposal, { saveToCustomer: true });
    setProposalDraft(syncedProposal);
    setProposalSelectedId(syncedProposal.id);
    setSessionMessageType("success");
    setSessionMessage("Proposal generated from the estimate.");
    setActiveTemplate("proposalBuilder");
  };

  const buildCurrentEstimateSnapshot = () => ({
    id: `draft-estimate-${activeTemplate}-${Date.now()}`,
    estimateNumber: nextEstimateNumber,
    estimateCode: estimateCode(nextEstimateNumber),
    estimateType: estimateTypeForTemplate(activeTemplate),
    name: currentEstimateName,
    savedAt: new Date().toISOString(),
    inputs: { ...inputs, estimateType: estimateTypeForTemplate(activeTemplate) },
    prices,
    summary: {
      totalSquares: calculation?.scope?.totalSquares ?? calculation?.totalSquares ?? calculation?.tileTotalRoofSquares ?? calculation?.productionSquares ?? calculation?.totalRoofSquares ?? 0,
      selectedBidAmount: calculation?.selectedBidAmount ?? 0,
      selectedMarkupPercent: calculation?.selectedMarkupPercent ?? 0,
      roofType: SERVICE_TEMPLATES.includes(activeTemplate) ? estimateTypeForTemplate(activeTemplate) : buildEstimateRoofType(inputs),
    },
  });

  const handleConvertCurrentEstimateToProposal = () => {
    if (SERVICE_TEMPLATES.includes(activeTemplate)) {
      const error = validateServiceEstimate(inputs);
      if (error) { setSessionMessageType("error"); setSessionMessage(error); return; }
    }
    return handleConvertEstimateToProposal(buildCurrentEstimateSnapshot());
  };

  const handleProposalDraftChange = (key, value) => {
    setProposalDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleProposalTemplateDraftChange = (key, value) => {
    setProposalTemplateDraft((current) => ({
      ...current,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const saveProposalTemplateDraft = () => {
    const normalizedTemplate = normalizeProposalTemplate(proposalTemplateDraft);
    setProposalTemplate(normalizedTemplate);
    setProposalTemplateDraft(normalizedTemplate);
    setSessionMessageType("success");
    setSessionMessage("Proposal template saved.");
    return normalizedTemplate;
  };

  const resetProposalTemplateDraft = () => {
    const nextTemplate = createBlankProposalTemplate();
    setProposalTemplate(nextTemplate);
    setProposalTemplateDraft(nextTemplate);
    setSessionMessageType("success");
    setSessionMessage("Proposal template reset to the CRT baseline.");
    return nextTemplate;
  };

  const generateProposalPdfArchive = async (proposalRecord = proposalDraft, { saveToCustomer = true } = {}) => {
    if (!proposalRecord) return null;
    const sourceEstimate = getProposalSourceEstimate(proposalRecord);
    const syncedProposal = proposalIsFinalized(proposalRecord)
      ? normalizeProposalRecord(proposalRecord)
      : syncProposalWithEstimate(proposalRecord, sourceEstimate, proposalTemplate);
    const { pdfFileName, pdfDataUrl } = await generateProposalPDF(syncedProposal, sourceEstimate, proposalTemplate);
    const archivedAt = new Date().toISOString();
    const nextProposal = {
      ...syncedProposal,
      pdfArchiveName: pdfFileName,
      pdfArchiveDataUrl: pdfDataUrl,
      pdfArchiveUpdatedAt: archivedAt,
      updatedAt: archivedAt,
    };

    setProposalDraft(nextProposal);
    setProposals((current) => {
      const index = current.findIndex((item) => item.id === nextProposal.id);
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], ...nextProposal };
        return next;
      }
      return [nextProposal, ...current];
    });
    if (saveToCustomer) {
      archiveProposalForCustomer(nextProposal, sourceEstimate, {
        pdfArchiveName: pdfFileName,
        pdfArchiveDataUrl: pdfDataUrl,
        pdfArchiveUpdatedAt: archivedAt,
      });
    }
    return nextProposal;
  };

  const saveProposalDraft = async (nextStatus = null) => {
    if (!proposalDraft) return;
    const now = new Date().toISOString();
    const status = nextStatus || proposalDraft.status || "Draft";
    const currentVersion = Number(proposalDraft.version || 1);
    const sourceEstimate = getProposalSourceEstimate(proposalDraft);
    const syncedProposal = proposalIsFinalized(proposalDraft)
      ? normalizeProposalRecord(proposalDraft)
      : syncProposalWithEstimate(proposalDraft, sourceEstimate, proposalTemplate);
    const existing = proposals.find((item) => item.id === syncedProposal.id);
    const isLockedVersion = existing && ["sent", "viewed", "accepted", "declined", "expired"].includes(String(existing.status || "").toLowerCase());
    let pdfArchiveName = syncedProposal.pdfArchiveName || "";
    let pdfArchiveDataUrl = syncedProposal.pdfArchiveDataUrl || "";
    let pdfArchiveUpdatedAt = syncedProposal.pdfArchiveUpdatedAt || "";
    try {
      const pdfArchive = await generateProposalPDF(syncedProposal, sourceEstimate, proposalTemplate);
      pdfArchiveName = pdfArchive.pdfFileName;
      pdfArchiveDataUrl = pdfArchive.pdfDataUrl;
      pdfArchiveUpdatedAt = now;
    } catch (error) {
      console.warn("Proposal PDF archive generation failed:", error);
    }
    const savedProposal = {
      ...syncedProposal,
      status,
      sentAt: status.toLowerCase() === "sent" ? syncedProposal.sentAt || now : syncedProposal.sentAt || "",
      sentBy: status.toLowerCase() === "sent" ? syncedProposal.sentBy || authUser.displayName || "" : syncedProposal.sentBy || "",
      updatedAt: now,
      pdfArchiveName,
      pdfArchiveDataUrl,
      pdfArchiveUpdatedAt,
      proposalHistory: [...(syncedProposal.proposalHistory || [])],
    };

    if (isLockedVersion && existing.id === syncedProposal.id) {
      const newVersion = {
        ...savedProposal,
        id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        version: currentVersion + 1,
        proposalNumber: Number(syncedProposal.proposalNumber || 1),
        proposalHistory: [
          ...(existing.proposalHistory || []),
          {
            status: existing.status,
            updatedAt: existing.updatedAt || existing.createdAt || now,
            supersededBy: savedProposal.status,
          },
        ],
      };
      setProposals((current) => [
        newVersion,
        ...current.map((item) => (item.id === existing.id ? { ...item, status: "Superseded", updatedAt: now } : item)),
      ]);
      setProposalDraft(newVersion);
      setProposalSelectedId(newVersion.id);
      archiveProposalForCustomer(newVersion, sourceEstimate, { pdfArchiveName, pdfArchiveDataUrl, pdfArchiveUpdatedAt });
      setSessionMessageType("success");
      setSessionMessage("Proposal version saved and archived.");
      return;
    }

    setProposals((current) => {
      const index = current.findIndex((item) => item.id === savedProposal.id);
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], ...savedProposal };
        return next;
      }
      return [savedProposal, ...current];
    });
    setProposalDraft(savedProposal);
    setProposalSelectedId(savedProposal.id);
    archiveProposalForCustomer(savedProposal, sourceEstimate, { pdfArchiveName, pdfArchiveDataUrl, pdfArchiveUpdatedAt });
    setSessionMessageType("success");
    setSessionMessage("Proposal saved and archived.");
  };

  const handleSendProposal = async () => {
    if (!proposalDraft) return;
    if (!proposalDraft.customerName || !proposalDraft.projectAddress || !proposalDraft.totalPrice) {
      setSessionMessageType("error");
      setSessionMessage("Fill in the proposal basics before sending.");
      return;
    }
    await saveProposalDraft("Sent");
    setSessionMessageType("success");
    setSessionMessage("Proposal marked as sent. Email delivery is coming in the next phase.");
  };

  const openActiveJobIssueModal = (project, existingIssue = null) => {
    if (!project) return;
    setActiveJobSelectedId(project.id);
    const stored = readJson(`crt_issue_draft:${authUser?.key}:${project.id}`, null);
    const draft = existingIssue ? {
      ...createBlankActiveJobIssue(project), ...existingIssue,
      issueCategory: existingIssue.category, currentStatus: existingIssue.status,
      followUpDeadline: existingIssue.followUpDeadline ? new Date(new Date(existingIssue.followUpDeadline).getTime() - new Date(existingIssue.followUpDeadline).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '',
      expectedUpdatedAt: existingIssue.updatedAt || null, resolutionConfirmed: false,
      requestId: crypto.randomUUID(),
    } : stored || { ...createBlankActiveJobIssue(project), requestId: crypto.randomUUID() };
    setActiveJobIssueDraft({ ...draft, projectId: project.id, projectName: project.projectName, jobNumber: project.jobNumber });
    setActiveJobIssueResponse(draft.response || buildActiveJobSuggestedResponse(project));
    setActiveJobIssueHistory([]);
    setActiveJobIssueHistoryError("");
    setActiveJobIssueModalOpen(true);
    const issueId = draft.id;
    void supabase.from("job_issue_audit").select("*").eq("source_record_uid", buildSharedJobSourceId(project)).eq("issue_id", issueId).order("created_at", { ascending: false }).then(({data,error}) => {
      setActiveJobIssueHistory(data || []);
      setActiveJobIssueHistoryError(error ? `History could not load: ${error.message}` : "");
    });
  };

  const closeActiveJobIssueModal = () => {
    if (activeJobIssueSaving) return;
    setActiveJobIssueModalOpen(false);
    setActiveJobIssueDraft(createBlankActiveJobIssue(selectedActiveJob));
    setActiveJobIssueResponse("");
  };

  const saveActiveJobIssue = async () => {
    if (activeJobIssueSaving) return;
    if (!canManageActiveJobData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to update shared jobs.");
      return;
    }

    const projectId = activeJobIssueDraft.projectId || activeJobSelectedId;
    const project = activeJobs.find((job) => job.id === projectId) || null;
    if (!project) {
      setSessionMessageType("error");
      setSessionMessage("Select a project before reporting an issue.");
      return;
    }
    if (!String(activeJobIssueDraft.description || "").trim()) {
      setSessionMessageType("error");
      setSessionMessage("Please enter an issue description before saving.");
      return;
    }

    if (!activeJobIssueDraft.assignedEmployeeId || !activeJobIssueDraft.followUpDeadline) {
      setSessionMessageType("error"); setSessionMessage("Assign an owner and response deadline."); return;
    }
    const issue = {
      ...activeJobIssueDraft,
      category: activeJobIssueDraft.issueCategory,
      status: activeJobIssueDraft.currentStatus,
      followUpDeadline: new Date(activeJobIssueDraft.followUpDeadline).toISOString(),
      response: activeJobIssueResponse,
    };
    setActiveJobIssueSaving(true);
    setJobsSyncStatus("saving");
    setSessionMessage("");
    try {
      const upsertRes = await supabase.rpc("save_active_job_issue", {
        p_source_record_uid: buildSharedJobSourceId(project),
        p_issue: issue,
        p_request_id: activeJobIssueDraft.requestId,
        p_expected_updated_at: activeJobIssueDraft.expectedUpdatedAt || null,
      });
      if (upsertRes.error) throw upsertRes.error;
      const saved = upsertRes.data?.[0];
      if (!saved) throw new Error("The server did not confirm the issue save. Retry using this draft.");
      const nextProject = { ...project, ...saved.job_payload, riskLevel: saved.risk_level };
      const savedIssue = nextProject.issues.find(item => item.id === issue.id);
      issue.issueNumber = savedIssue?.issueNumber || issue.id;
      setActiveJobs((current) => current.map(job => job.id === project.id ? nextProject : job));
      try { window.localStorage.removeItem(`crt_issue_draft:${authUser.key}:${project.id}`); } catch { /* Save already confirmed. */ }
      const refreshed = await fetchSharedJobsFromSupabase();
      if (!refreshed.error) applySharedJobRows(refreshed.data);
      setJobsSyncStatus(refreshed.error ? "error" : "saved");
      setJobsSyncError(refreshed.error?.message || "");
      setSessionMessageType(refreshed.error ? "error" : "success");
      setSessionMessage(refreshed.error
        ? `Issue ${issue.issueNumber} was saved, but the job list could not refresh: ${refreshed.error.message || refreshed.error}`
        : `Issue ${issue.issueNumber} saved to ${project.projectName || "the project"}.`);
      setActiveJobIssueModalOpen(false);
      setActiveJobIssueDraft(createBlankActiveJobIssue(selectedActiveJob));
      setActiveJobIssueResponse("");
    } catch (issueError) {
      const issueMessage = issueError.message || String(issueError);
      setJobsSyncStatus("error");
      setJobsSyncError(issueMessage);
      setSessionMessageType("error");
      setSessionMessage(`Issue was not saved: ${issueMessage}`);
    } finally {
      setActiveJobIssueSaving(false);
    }
  };

  const handleSaveApprovedJob = async () => {
    if (!authUser?.key || !approvedJobData) {
      setSessionMessageType("error");
      setSessionMessage("Please sign in and select a job.");
      return;
    }
    if (!canUpdateDailyJobCostData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to update daily job costs.");
      return;
    }

    setSessionMessageType("");
    setSessionMessage("Saving approved job...");

    const totals = calculateApprovedJobTotals(approvedDailyProgressLogs);
    const financialSummary = calculateApprovedJobFullyLoadedProfitability({
      approvedSalePrice: approvedJobData.approvedBidAmount,
      changeOrders: approvedJobData.changeOrders,
      directJobCost: totals.directActualCost,
      operatingOverheadCost: totals.operatingOverheadCost,
      otherJobCosts: approvedJobData.otherJobCosts,
      salesCommissionRate: approvedJobData.salesCommissionRate,
    });
    const actualProfit = financialSummary.netCompanyProfit;
    const marginPercent = financialSummary.netCompanyMarginPercent;

    const normalizedStatus = String(approvedJobData.status || "approved").toLowerCase();
    const workflowStatus = normalizedStatus === "completed"
      ? "completed"
      : normalizedStatus === "in progress"
        ? "active"
        : "approved";

    const sharedJob = {
      ...(selectedApprovedJob || {}),
      id: approvedJobData.estimateId || approvedJobData.localEstimateId || selectedApprovedJob?.id || createFieldDailyLogId(),
      estimateId: approvedJobData.estimateId,
      localEstimateId: approvedJobData.localEstimateId,
      estimateCode: approvedJobData.estimateCode,
      jobNumber: selectedApprovedJob?.jobNumber || "",
      jobName: approvedJobData.jobName,
      projectName: approvedJobData.jobName,
      customerName: approvedJobData.customerName,
      customer: approvedJobData.customerName,
      roofType: approvedJobData.roofType,
      totalSquares: approvedJobData.totalSquares,
      finalBid: approvedJobData.approvedBidAmount,
      contractAmount: approvedJobData.approvedBidAmount,
      changeOrders: financialSummary.changeOrders,
      totalSalePrice: financialSummary.totalSalePrice,
      salesperson: approvedJobData.salesperson || selectedApprovedJob?.salesperson || "",
      salesCommissionRate: financialSummary.salesCommissionRate,
      salesCommission: financialSummary.salesCommission,
      otherJobCosts: financialSummary.otherJobCosts,
      grossProfitBeforeOverhead: financialSummary.grossProfitBeforeOverhead,
      commissionableGrossProfit: financialSummary.commissionableGrossProfit,
      fullyLoadedCost: financialSummary.fullyLoadedCost,
      netCompanyProfit: financialSummary.netCompanyProfit,
      status: approvedJobData.status,
      projectStatus: approvedJobData.status,
      projectAddress: approvedJobData.jobAddress || selectedApprovedJob?.projectAddress || "",
      jobAddress: approvedJobData.jobAddress || selectedApprovedJob?.projectAddress || "",
      projectContact: approvedJobData.projectContact || selectedApprovedJob?.projectContact || "",
      fieldSupervisor: approvedJobData.fieldSupervisor || selectedApprovedJob?.fieldSupervisor || "",
      permitStatus: approvedJobData.permitStatus || selectedApprovedJob?.permitStatus || "",
      anticipatedStartDate: selectedApprovedJob?.anticipatedStartDate || "",
      dailyProgressLog: approvedDailyProgressLogs,
      laborLog: totals.laborLog,
      subcontractorLog: totals.subcontractorLog,
      materialUsageLog: totals.materialUsageLog,
      travelLog: totals.travelLog,
      actualLaborHours: totals.totalActualLaborHours,
      actualLaborCost: totals.totalActualLaborCost,
      actualSubcontractorCost: totals.totalSubcontractorCost,
      actualTravelCost: totals.totalTravelCost,
      actualCost: financialSummary.fullyLoadedCost,
      actualMaterialCost: totals.totalMaterialCost,
      actualOperatingOverheadCost: totals.operatingOverheadCost,
      actualProfit,
      actualMarginPercent: marginPercent,
      workflowStatus,
      documentsIncomplete: Boolean(approvedJobData.documentsIncomplete),
      subcontractorIncomplete: Boolean(approvedJobData.subcontractorIncomplete),
      materialOrderIncomplete: Boolean(approvedJobData.materialOrderIncomplete),
      customerDocumentIncomplete: Boolean(approvedJobData.customerDocumentIncomplete),
    };

    try {
      const { data, error } = canManageSharedJobData
        ? await upsertSharedJobToSupabase(sharedJob, authUser.key, authUser.id || authUser.key)
        : await updateDailyJobCostsForStaffInSupabase(sharedJob, authUser.displayName || authUser.email || authUser.key);
      if (error) {
        const cloudErrorMessage = error.message || String(error);
        console.warn("Approved job save failed:", cloudErrorMessage);
        setSessionMessageType("error");
        setSessionMessage(`Approved job save failed: ${cloudErrorMessage}`);
        return;
      }

      const persistedJob = Array.isArray(data) ? data[0] : data?.[0] || null;
      const normalizedJob = persistedJob ? splitSharedJobsByWorkflow([persistedJob]).allJobs[0] || sharedJob : sharedJob;

      if (normalizedJob.workflowStatus === "active") {
        setActiveJobs((current) => [
          normalizedJob,
          ...current.filter((item) => item.sourceRecordUid !== normalizedJob.sourceRecordUid && item.id !== normalizedJob.id),
        ]);
        setCompletedJobs((current) => current.filter((item) => item.sourceRecordUid !== normalizedJob.sourceRecordUid && item.id !== normalizedJob.id));
        setActiveJobSelectedId(normalizedJob.id);
      } else {
        setCompletedJobs((current) => [
          normalizedJob,
          ...current.filter((item) => item.sourceRecordUid !== normalizedJob.sourceRecordUid && item.id !== normalizedJob.id),
        ]);
      }

      if (approvedJobData.status === "completed") {
        const metricsPayload = {
          estimateId: approvedJobData.estimateId,
          localEstimateId: approvedJobData.localEstimateId,
          estimateCode: approvedJobData.estimateCode,
          jobName: approvedJobData.jobName,
          customerName: approvedJobData.customerName,
          roofType: approvedJobData.roofType,
          totalSquares: approvedJobData.totalSquares,
          estimateFinalBid: approvedJobData.approvedBidAmount,
          estimateMaterialCost: selectedApprovedJob?.summary?.materialCost || 0,
          estimateLaborCost: selectedApprovedJob?.summary?.laborCost || 0,
          estimateTravelCost: selectedApprovedJob?.summary?.travelCost || 0,
          actualMaterialCost: totals.totalMaterialCost,
          actualLaborCost: totals.totalActualLaborCost,
          actualLaborHours: totals.totalActualLaborHours,
          actualTravelCost: totals.totalTravelCost,
          changeOrders: financialSummary.changeOrders,
          finalInvoiceAmount: financialSummary.totalSalePrice,
          actualProfit,
          actualMarginPercent: marginPercent,
          notes: "Auto-generated from daily progress; edit manually if needed.",
          lessonsLearned: "",
        };
        const { error: metricsError } = await upsertCompletedJobMetricsToSupabase(metricsPayload, authUser.key);
        if (metricsError) {
          console.warn("Completed metrics save failed:", metricsError.message || metricsError);
        } else {
          const { data: metricsData } = await fetchCompletedJobMetricsFromSupabase(authUser.key);
          if (metricsData) setCompletedJobMetrics(metricsData);
        }
      }

      setSessionMessageType("success");
      setSessionMessage("Saved");
      setCollapsedApprovedDailyProgressDayIds(getDailyProgressDayIds(approvedDailyProgressLogs));
    } catch (error) {
      console.error("handleSaveApprovedJob failed:", error);
      setSessionMessageType("error");
      setSessionMessage(`Save failed: ${error?.message || String(error)}`);
    }
  };

  const buildJobInsights = () => {
    if (!completedJobMetrics.length) {
      return {
        totalJobs: 0,
        averagePricePerSq: 0,
        averageMaterialCostPerSq: 0,
        averageLaborCostPerSq: 0,
        averageProfitMargin: 0,
        averageEstimateVariance: 0,
        byRoofType: {},
        jobsBySize: [],
      };
    }

    const metrics = completedJobMetrics.filter((m) => m.total_squares > 0);
    if (!metrics.length) return {};

    const byRoofType = {};
    let totalPricePerSq = 0;
    let totalMaterialPerSq = 0;
    let totalLaborPerSq = 0;
    let totalMargin = 0;
    let totalVariance = 0;

    metrics.forEach((m) => {
      const roofType = m.roof_type || "Unknown";
      if (!byRoofType[roofType]) {
        byRoofType[roofType] = {
          count: 0,
          totalSquares: 0,
          totalBid: 0,
          totalActualMaterial: 0,
          totalActualLabor: 0,
          totalProfit: 0,
        };
      }

      const rt = byRoofType[roofType];
      rt.count += 1;
      rt.totalSquares += toNumber(m.total_squares);
      rt.totalBid += toNumber(m.final_invoice_amount || m.estimate_final_bid);
      rt.totalActualMaterial += toNumber(m.actual_material_cost);
      rt.totalActualLabor += toNumber(m.actual_labor_cost);
      rt.totalProfit += toNumber(m.actual_profit);

      totalPricePerSq += toNumber(m.final_invoice_amount || m.estimate_final_bid) / toNumber(m.total_squares);
      totalMaterialPerSq += toNumber(m.actual_material_cost) / toNumber(m.total_squares);
      totalLaborPerSq += toNumber(m.actual_labor_cost) / toNumber(m.total_squares);
      totalMargin += toNumber(m.actual_margin_percent);
      totalVariance += Math.abs(toNumber(m.material_variance) + toNumber(m.labor_variance));
    });

    const roofTypeStats = Object.entries(byRoofType).map(([type, data]) => ({
      roofType: type,
      count: data.count,
      avgPricePerSq: round(data.totalBid / data.totalSquares, 2),
      avgMaterialPerSq: round(data.totalActualMaterial / data.totalSquares, 2),
      avgLaborPerSq: round(data.totalActualLabor / data.totalSquares, 2),
      avgMargin: round((data.totalProfit / data.totalBid) * 100, 1),
    }));

    return {
      totalJobs: metrics.length,
      averagePricePerSq: round(totalPricePerSq / metrics.length, 2),
      averageMaterialCostPerSq: round(totalMaterialPerSq / metrics.length, 2),
      averageLaborCostPerSq: round(totalLaborPerSq / metrics.length, 2),
      averageProfitMargin: round(totalMargin / metrics.length, 1),
      averageEstimateVariance: round(totalVariance / metrics.length, 2),
      roofTypeStats,
    };
  };

  const handleSelectedMarkup = (percent) => {
    setInputs((current) => ({
      ...current,
      selectedMarkupPercent: percent,
      sprayFoamCustomBidSelected: false,
    }));
  };

  const handleUseCustomBid = () => {
    setInputs((current) => ({
      ...current,
      sprayFoamCustomBidSelected: true,
    }));
  };

  const handleDownloadEstimatePDF = async () => {
    if (SERVICE_TEMPLATES.includes(activeTemplate)) {
      const error = validateServiceEstimate(inputs);
      if (error) { setSessionMessageType("error"); setSessionMessage(error); return; }
    }
    if (!inputs.jobName && !inputs.customerName) {
      setSessionMessageType("error");
      setSessionMessage("Please enter at least a job name or customer name before downloading the PDF.");
      alert("Please enter at least a job name or customer name before downloading the PDF.");
      return;
    }
    setSessionMessageType("");
    setSessionMessage("Preparing PDF...");
    const previewWindow = window.open("", "_blank");
    const pdfOpened = await generateEstimatePDF(
      inputs,
      calculation,
      fieldNotes,
      currentEstimateName,
      estimateTypeForTemplate(activeTemplate),
      previewWindow
    );
    if (pdfOpened) {
      setSessionMessageType("success");
      setSessionMessage("PDF saved successfully. If you were prompted for a file location, choose where to save it.");
    } else {
      setSessionMessageType("error");
      setSessionMessage("PDF generation failed. Please check the console for details.");
    }
  };

  const priceFields = MATERIAL_PRICE_FIELDS;

  const formatQuickMeasureValue = (value, digits = 1, suffix = "") => {
    if (value === null || value === undefined || value === "") return "Not found";
    return `${num(value, digits)}${suffix}`;
  };

  const renderQuickMeasureUploadControl = () => (
    <>
      <button type="button" className="secondaryButton" onClick={triggerQuickMeasureUpload} disabled={quickMeasureIsProcessing}>
        {quickMeasureIsProcessing ? "Uploading..." : "Upload QuickMeasure Report"}
      </button>
      <input
        ref={quickMeasureFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={handleQuickMeasureFileChange}
      />
    </>
  );

  const renderQuickMeasureReviewPanel = () =>
    quickMeasureReport ? (
      <Section
        title="QuickMeasure Review"
        subtitle="Review the extracted measurements before applying them to an estimate."
      >
        <div className="formGrid" style={{ marginBottom: 14 }}>
          <Field label="Property address">
            <input
              type="text"
              value={quickMeasureReport.fields?.propertyAddress || ""}
              onChange={(e) => updateQuickMeasureField("propertyAddress", e.target.value)}
            />
          </Field>
          <Field label="Total roof area">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.totalRoofArea ?? ""}
              onChange={(e) => updateQuickMeasureField("totalRoofArea", e.target.value)}
            />
          </Field>
          <Field label="Total squares">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.totalSquares ?? ""}
              onChange={(e) => updateQuickMeasureField("totalSquares", e.target.value)}
            />
          </Field>
          <Field label="Perimeter linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.perimeterLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("perimeterLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Ridges/Hips linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.ridgeHipLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("ridgeHipLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Ridge linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.ridgeLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("ridgeLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Hip linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.hipLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("hipLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Valley linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.valleyLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("valleyLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Rake linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.rakeLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("rakeLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Eave linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.eaveLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("eaveLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Starter linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.starterLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("starterLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Drip edge linear feet">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.dripEdgeLinearFeet ?? ""}
              onChange={(e) => updateQuickMeasureField("dripEdgeLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Pitch">
            <input type="text" value={quickMeasureReport.fields?.pitch || ""} onChange={(e) => updateQuickMeasureField("pitch", e.target.value)} />
          </Field>
          <Field label="Roof facets / sections">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={quickMeasureReport.fields?.roofFacets ?? ""}
              onChange={(e) => updateQuickMeasureField("roofFacets", e.target.value)}
            />
          </Field>
          <Field label="Pro-Start Starter">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.shingleStarterQuantity ?? ""}
              onChange={(e) => updateQuickMeasureField("shingleStarterQuantity", e.target.value)}
            />
          </Field>
          <Field label='2"x2" Drip Edge 10 ft Pieces'>
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.shingleDripEdgePieces ?? ""}
              onChange={(e) => updateQuickMeasureField("shingleDripEdgePieces", e.target.value)}
            />
          </Field>
          <Field label='Rapid Ridge 8" Ridge Cap'>
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="0.1"
              value={quickMeasureReport.fields?.shingleRapidRidgeBoxes ?? ""}
              onChange={(e) => updateQuickMeasureField("shingleRapidRidgeBoxes", e.target.value)}
            />
          </Field>
        </div>
        <div className="detailList">
          <DetailRow label="File name" value={quickMeasureReport.fileName || "Unknown file"} />
          <DetailRow label="Uploaded" value={new Date(quickMeasureReport.uploadedAt).toLocaleString()} />
          <DetailRow label="Total roof area" value={formatQuickMeasureValue(quickMeasureReport.fields?.totalRoofArea, 0, " SQ FT")} />
          <DetailRow
            label="Total squares"
            value={formatQuickMeasureValue(quickMeasureReport.fields?.totalSquares, 0, " SQ")}
            note={quickMeasureReport.fields?.totalSquaresSource === "calculated from roof area" ? "Calculated from roof area" : ""}
          />
          <DetailRow
            label="Total HDZ RS+ Bundles Needed"
            value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleHdzBundlesNeeded, 0)}
            note={Array.isArray(quickMeasureReport.fields?.notes) && quickMeasureReport.fields.notes.includes("Using calculated fallback.") ? "Using calculated fallback." : ""}
          />
          <DetailRow
            label="Pro-Start Starter"
            value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleStarterQuantity, 0)}
            note={quickMeasureReport.fields?.shingleStarterSuggestedQuantity > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label='2"x2" Drip Edge 10 ft Pieces'
            value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleDripEdgePieces, 0)}
            note={quickMeasureReport.fields?.shingleDripEdgeSuggestedPieces > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label='Rapid Ridge 8" Ridge Cap'
            value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleRapidRidgeBoxes, 0)}
            note={
              quickMeasureReport.fields?.shingleRapidRidgeLFUsed !== null && quickMeasureReport.fields?.shingleRapidRidgeLFUsed !== undefined
                ? `${formatQuickMeasureValue(quickMeasureReport.fields?.shingleRapidRidgeLFUsed, 0, " LF")} used`
                : ""
            }
          />
          <DetailRow
            label="Synthetic Underlayment Rolls"
            value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleSyntheticUnderlaymentRolls, 0)}
            note={Array.isArray(quickMeasureReport.fields?.notes) && quickMeasureReport.fields.notes.includes("Using calculated fallback.") ? "Using calculated fallback." : ""}
          />
          <DetailRow
            label="Calculated fallback quantity"
            value={formatQuickMeasureValue(
              Math.ceil(
                (
                  quickMeasureReport.fields?.totalSquares > 0
                    ? Number(quickMeasureReport.fields.totalSquares)
                    : Math.ceil(Number(quickMeasureReport.fields?.totalRoofArea || 0) / 100)
                ) / 10,
              ),
              0,
            )}
            note={quickMeasureReport.fields?.shingleSyntheticUnderlaymentSuggestedRolls > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label="Final underlayment rolls used"
            value={formatQuickMeasureValue(
              quickMeasureReport.fields?.shingleSyntheticUnderlaymentSuggestedRolls > 0
                ? quickMeasureReport.fields?.shingleSyntheticUnderlaymentSuggestedRolls
                : Math.ceil(
                    (
                      quickMeasureReport.fields?.totalSquares > 0
                        ? Number(quickMeasureReport.fields.totalSquares)
                        : Math.ceil(Number(quickMeasureReport.fields?.totalRoofArea || 0) / 100)
                    ) / 10,
                  ),
              0,
            )}
            note={quickMeasureReport.fields?.shingleSyntheticUnderlaymentSuggestedRolls > 0 ? "" : "Using calculated fallback."}
          />
          <DetailRow
            label="Perimeter linear feet"
            value={formatQuickMeasureValue(quickMeasureReport.fields?.perimeterLinearFeet, 0, " LF")}
            note={
              quickMeasureReport.fields?.perimeterLinearFeetSource === "using drip edge as perimeter fallback"
                ? "Using Drip Edge as perimeter fallback."
                : quickMeasureReport.fields?.perimeterLinearFeetSource === "using eaves as perimeter fallback"
                  ? "Using Eaves as perimeter fallback."
                  : quickMeasureReport.fields?.perimeterLinearFeetSource === "using eaves/rakes as perimeter fallback"
                    ? "Using Eaves + Rakes as perimeter fallback."
                  : ""
            }
          />
          {quickMeasureReport.fields?.ridgeHipLinearFeet !== null && quickMeasureReport.fields?.ridgeHipLinearFeet !== undefined ? (
            <DetailRow label="Ridges/Hips linear feet" value={formatQuickMeasureValue(quickMeasureReport.fields?.ridgeHipLinearFeet, 0, " LF")} />
          ) : null}
          <DetailRow label="Valley linear feet" value={formatQuickMeasureValue(quickMeasureReport.fields?.valleyLinearFeet, 0, " LF")} />
          <DetailRow label="Eave linear feet" value={formatQuickMeasureValue(quickMeasureReport.fields?.eaveLinearFeet, 0, " LF")} />
          <DetailRow label="Rake linear feet" value={formatQuickMeasureValue(quickMeasureReport.fields?.rakeLinearFeet, 0, " LF")} />
          <DetailRow label="Pitch" value={quickMeasureReport.fields?.pitch || "Not found"} />
          <DetailRow label="Roof facets / sections" value={formatQuickMeasureValue(quickMeasureReport.fields?.roofFacets, 0)} />
          {Array.isArray(quickMeasureReport.fields?.notes) && quickMeasureReport.fields.notes.length ? (
            <DetailRow label="Notes" value={quickMeasureReport.fields.notes.join(" • ")} />
          ) : null}
          <DetailRow label="Raw Drip Edge Match" value={quickMeasureReport.fields?.rawDripEdgeMatch || "Not found"} />
          <DetailRow label="Drip Edge Snippet" value={quickMeasureReport.fields?.dripEdgeSnippet || "Not found"} />
          {Array.isArray(quickMeasureReport.fields?.shingleMaterialSuggestions) && quickMeasureReport.fields.shingleMaterialSuggestions.length ? (
            <>
              <DetailRow label="Extracted HDZ bundles" value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleHdzBundlesNeeded, 0)} />
              <DetailRow label="Extracted Pro-Start quantity" value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleStarterQuantity, 0)} />
              <DetailRow label='Extracted Drip Edge 10 ft pieces' value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleDripEdgePieces, 0)} />
              <DetailRow label="Extracted Rapid Ridge boxes" value={formatQuickMeasureValue(quickMeasureReport.fields?.shingleRapidRidgeBoxes, 0)} />
              {quickMeasureReport.fields.shingleMaterialSuggestions.map((item) => (
                <div className="detailRow" key={`${item.mappedField}-${item.matchedProductName || "material"}`} style={{ alignItems: "flex-start", gap: 18 }}>
                  <div>
                    <span>{item.matchedProductName || item.mappedField}</span>
                    <strong style={{ display: "block", marginTop: 2 }}>{item.snippet || "No matching text snippet found"}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block" }}>{item.matchedQuantity !== null && item.matchedQuantity !== undefined ? num(item.matchedQuantity, 0) : "Not found"}</strong>
                    <span>{item.mappedField}</span>
                  </div>
                </div>
              ))}
              {Array.isArray(quickMeasureReport.appliedValues?.appliedFieldPairs) && quickMeasureReport.appliedValues.appliedFieldPairs.length ? (
                <>
                  <DetailRow label="Applied input key/value pairs" value="" />
                  {quickMeasureReport.appliedValues.appliedFieldPairs.map(([key, value]) => (
                    <DetailRow key={key} label={key} value={String(value)} />
                  ))}
                </>
              ) : null}
            </>
          ) : null}
          <DetailRow
            label="Applied to"
            value={
              quickMeasureReport.appliedTo
                ? `${quickMeasureReport.appliedTo}${quickMeasureReport.appliedAt ? ` at ${new Date(quickMeasureReport.appliedAt).toLocaleString()}` : ""}`
                : "Not applied yet"
            }
          />
          {Array.isArray(quickMeasureReport.fields?.shingleMaterialSuggestions) && quickMeasureReport.fields.shingleMaterialSuggestions.length
            ? quickMeasureReport.fields.shingleMaterialSuggestions.map((item) => (
                <div
                  className="detailRow"
                  key={`${item.mappedField}-${item.matchedProductName || "material"}`}
                  style={{ alignItems: "flex-start", gap: 18 }}
                >
                  <div>
                    <span>{item.matchedProductName || item.mappedField}</span>
                    <strong style={{ display: "block", marginTop: 2 }}>{item.snippet || "No matching text snippet found"}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block" }}>{item.matchedQuantity !== null && item.matchedQuantity !== undefined ? num(item.matchedQuantity, 0) : "Not found"}</strong>
                    <span>{item.mappedField}</span>
                  </div>
                </div>
              ))
            : null}
          {quickMeasureStatus ? <DetailRow label="Status" value={quickMeasureStatus} /> : null}
        </div>

        <div className="actionRow" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="primaryButton" onClick={() => applyQuickMeasureToTemplate("tpo")}>
            Apply to TPO estimate
          </button>
          <button type="button" className="primaryButton" onClick={() => applyQuickMeasureToTemplate("sprayFoam")}>
            Apply to Spray Foam estimate
          </button>
          <button
            type="button"
            className="primaryButton"
            onClick={() => {
              if (!quickMeasureReport) return;
              const fields = quickMeasureReport.fields || {};
              const propertyAddress = String(fields.propertyAddress || "").trim();
              const roofSquares =
                toNumber(fields.totalSquares, 0) > 0
                  ? toNumber(fields.totalSquares, 0)
                  : toNumber(fields.totalRoofArea, 0) > 0
                    ? Math.ceil(toNumber(fields.totalRoofArea, 0) / 100)
                    : 0;
              const quickMeasureData = {
                address: propertyAddress,
                totalSquares: roofSquares,
                dripEdgePieces: toNumber(fields.shingleDripEdgePieces, 0),
                dripEdgeLinearFeet: toNumber(fields.dripEdgeLinearFeet, 0),
                proStartQuantity: toNumber(fields.shingleStarterQuantity, 0),
                rapidRidgeBoxes: toNumber(fields.shingleRapidRidgeBoxes, 0),
                hdzBundlesNeeded: toNumber(fields.shingleHdzBundlesNeeded, 0),
                syntheticUnderlaymentRolls: toNumber(fields.shingleSyntheticUnderlaymentRolls, 0),
                ridgeHipLinearFeet: toNumber(fields.ridgeHipLinearFeet, 0),
                valleyLinearFeet: toNumber(fields.valleyLinearFeet, 0),
                rakeLinearFeet: toNumber(fields.rakeLinearFeet, 0),
                eaveLinearFeet: toNumber(fields.eaveLinearFeet, 0),
              };
              console.log("QuickMeasure extracted object", fields);
              console.log("Applied QuickMeasure to shingle", quickMeasureData);
              setInputs((current) => ({
                ...current,
                jobName: quickMeasureData.address || current.jobName,
                jobAddress: quickMeasureData.address || current.jobAddress,
                shingleJobName: quickMeasureData.address || current.shingleJobName || current.jobName,
                shingleJobAddress: quickMeasureData.address || current.shingleJobAddress || current.jobAddress,
                shingleTotalRoofSquares: quickMeasureData.totalSquares || current.shingleTotalRoofSquares,
                shingleProductionSquares: quickMeasureData.totalSquares || current.shingleProductionSquares,
                shingleDripEdgePieces: quickMeasureData.dripEdgePieces || quickMeasureData.dripEdgeLinearFeet || current.shingleDripEdgePieces,
                shingleStarterQuantity:
                  quickMeasureData.proStartQuantity ||
                  Math.ceil((quickMeasureData.dripEdgeLinearFeet || 0) / Math.max(1, toNumber(current.shingleStarterRollCoverageLf, 115))) ||
                  current.shingleStarterQuantity,
                shingleRapidRidgeBoxes: quickMeasureData.rapidRidgeBoxes || current.shingleRapidRidgeBoxes,
                shingleHdzBundlesNeeded: quickMeasureData.hdzBundlesNeeded || current.shingleHdzBundlesNeeded,
                shingleSyntheticUnderlaymentRolls: quickMeasureData.syntheticUnderlaymentRolls || current.shingleSyntheticUnderlaymentRolls,
                shingleRidgeHipLinearFeet: quickMeasureData.ridgeHipLinearFeet || current.shingleRidgeHipLinearFeet,
                shingleValleyLinearFeet: quickMeasureData.valleyLinearFeet || current.shingleValleyLinearFeet,
                shingleRakeLinearFeet: quickMeasureData.rakeLinearFeet || current.shingleRakeLinearFeet,
                shingleEaveLinearFeet: quickMeasureData.eaveLinearFeet || current.shingleEaveLinearFeet,
                shingleRidgeLinearFeet: quickMeasureData.ridgeHipLinearFeet || current.shingleRidgeLinearFeet,
                shingleHipLinearFeet: current.shingleHipLinearFeet,
                shinglePerimeterLinearFeet: quickMeasureData.dripEdgeLinearFeet || current.shinglePerimeterLinearFeet,
                shingleDripEdgeLinearFeet: quickMeasureData.dripEdgeLinearFeet || current.shingleDripEdgeLinearFeet,
              }));
              setActiveTemplate("shingle");
              setQuickMeasureStatus("QuickMeasure data applied to Shingle Estimate.");
              setSessionMessageType("success");
              setSessionMessage("QuickMeasure data applied to Shingle Estimate.");
            }}
          >
            Apply to Shingle estimate
          </button>
          <button type="button" className="primaryButton" onClick={() => applyQuickMeasureToTemplate("tile")}>
            Apply to Tile estimate
          </button>
        </div>
      </Section>
    ) : null;

  const renderAppearanceControl = ({ compact = false } = {}) => {
    const modeLabel = resolvedAppearance === "dark" ? "Dark" : "Light";
    return (
      <div className={`appearanceControl ${compact ? "compact" : ""}`}>
        <label htmlFor="appearance-select">Appearance</label>
        <select
          id="appearance-select"
          value={appearancePreference}
          onChange={(event) => setAppearancePreference(event.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        {appearancePreference === "system" ? <span className="smallNote">Using device setting ({modeLabel})</span> : null}
      </div>
    );
  };

  const renderEstimatorShellHeader = ({
    title,
    intro,
    showClear = true,
    showQuickMeasure = true,
  }) => (
    <>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>{title}</h1>
              <p className="intro">{intro}</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Welcome</span>
          <strong>{authUser.displayName}</strong>
          <p>{authUser.title || (isAdminUser ? "Administration" : "Sales")}</p>
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        {showClear ? (
          <button type="button" className="dangerButton" onClick={handleClearEstimate}>
            Clear estimate
          </button>
        ) : null}
        <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
          Back to dashboard
        </button>
        {showQuickMeasure ? renderQuickMeasureUploadControl() : null}
      </div>
    </>
  );

  const renderServiceScreen = () => <ServiceEstimateWorkspace template={activeTemplate} workspace={{ inputs, calculation, setField, setInputs, Section, Field, TravelCalculator, OverheadCalculator, renderEstimatorShellHeader, css, isLoaded, loadError, isLookingUpDistance, travelLookupMessage, googleDebug, setTravelField, setTravelVehicleSelection, addTravelVehicleSelection, removeTravelVehicleSelection, handleCalculateDistance, handleSaveEstimate, handleConvertCurrentEstimateToProposal, handleDownloadEstimatePDF, money2 }} />;

  const renderSprayFoamScreen = () => (
    <SprayFoamWorkspace
      workspace={{
        DetailRow,
        Field,
        OverheadCalculator,
        Section,
        TravelCalculator,
        addSprayFoamAdditionalDetailMaterial,
        addSprayFoamEquipmentRental,
        addSprayFoamRoofArea,
        addTravelVehicleSelection,
        calculation,
        css,
        deleteSprayFoamAdditionalDetailMaterial,
        deleteSprayFoamEquipmentRental,
        deleteSprayFoamRoofArea,
        googleDebug,
        handleCalculateDistance,
        handleConvertCurrentEstimateToProposal,
        handleDownloadEstimatePDF,
        handleNumberInputWheel,
        handleSaveEstimate,
        handleSelectZeroOnFocus,
        handleSelectedMarkup,
        inputs,
        isLoaded,
        isLookingUpDistance,
        loadError,
        money,
        money2,
        normalizeSprayFoamAdditionalDetailMaterials,
        normalizeSprayFoamEquipmentRentals,
        normalizeSprayFoamLayerConfig,
        num,
        removeTravelVehicleSelection,
        renderEstimatorShellHeader,
        renderQuickMeasureReviewPanel,
        setField,
        setInputs,
        setSprayFoamAdditionalDetailMaterial,
        setSprayFoamDetailMaterial,
        setSprayFoamEquipmentRental,
        setSprayFoamEstimatedDays,
        setSprayFoamLayerConfig,
        setSprayFoamRoofArea,
        setSprayFoamSubcontractorItem,
        setTravelField,
        setTravelVehicleSelection,
        toNumber,
        travelLookupMessage,
      }}
    />
  );

  const renderShingleScreen = () => (
    <ShingleWorkspace
      workspace={{
        DetailRow,
        Field,
        OverheadCalculator,
        Section,
        TravelCalculator,
        addShingleLaborSection,
        addShingleSubcontractorItem,
        addTravelVehicleSelection,
        calculation,
        css,
        googleDebug,
        handleCalculateDistance,
        handleConvertCurrentEstimateToProposal,
        handleDownloadEstimatePDF,
        handleNumberInputWheel,
        handleSaveEstimate,
        handleSelectZeroOnFocus,
        handleSelectedMarkup,
        inputs,
        isLoaded,
        isLookingUpDistance,
        loadError,
        money2,
        normalizeShingleLaborSections,
        num,
        removeShingleLaborSection,
        removeShingleSubcontractorItem,
        removeTravelVehicleSelection,
        renderEstimatorShellHeader,
        renderQuickMeasureReviewPanel,
        setField,
        setInputs,
        setShingleLaborSection,
        setShingleSubcontractorItem,
        setTravelField,
        setTravelVehicleSelection,
        travelLookupMessage,
      }}
    />
  );

  const renderFieldNotesScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>Field Notes / Roof Inspection</h1>
              <p className="intro">Capture the inspection details before you build an estimate.</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
          <p>{getAccountTitle()}</p>
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => {
            setInspectionTemplateChooserOpen(false);
            setActiveTemplate("dashboard");
          }}
        >
          Back to dashboard
        </button>
      </div>

      <div className="actionRow" style={{ marginBottom: 16 }}><button type="button" className="primaryButton" onClick={openDashboardInspectionRequest}>Submit Inspection Request</button></div>
      <Section title="Inspection details" subtitle="Use this to capture the roof walk and field notes.">
        <div className="formGrid">
          <Field label="Job name">
            <input type="text" value={fieldNotes.jobName} onChange={(e) => handleFieldNotesChange("jobName", e.target.value)} />
          </Field>
          <Field label="Customer name">
            <input type="text" value={fieldNotes.customerName} onChange={(e) => handleFieldNotesChange("customerName", e.target.value)} />
          </Field>
          <Field label="Job address">
            <input type="text" value={fieldNotes.jobAddress} onChange={(e) => handleFieldNotesChange("jobAddress", e.target.value)} />
          </Field>
          <Field label="Date">
            <input type="date" value={fieldNotes.date} onChange={(e) => handleFieldNotesChange("date", e.target.value)} />
          </Field>
          <Field label="Technician name">
            <input
              type="text"
              value={fieldNotes.technicianName}
              onChange={(e) => handleFieldNotesChange("technicianName", e.target.value)}
            />
          </Field>
          <Field label="Roof type observed">
            <input
              type="text"
              value={fieldNotes.roofTypeObserved}
              onChange={(e) => handleFieldNotesChange("roofTypeObserved", e.target.value)}
            />
          </Field>
          <Field label="Customer requested roof preference">
            <input
              type="text"
              value={fieldNotes.customerRequestedRoofPreference}
              onChange={(e) => handleFieldNotesChange("customerRequestedRoofPreference", e.target.value)}
            />
          </Field>
          <Field label="Existing roof layers">
            <input
              type="text"
              value={fieldNotes.existingRoofLayers}
              onChange={(e) => handleFieldNotesChange("existingRoofLayers", e.target.value)}
            />
          </Field>
          <Field label="A/C units count">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={fieldNotes.acUnitsCount} onChange={(e) => handleFieldNotesChange("acUnitsCount", e.target.value)} />
          </Field>
          <Field label="Drains count">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={fieldNotes.drainsCount} onChange={(e) => handleFieldNotesChange("drainsCount", e.target.value)} />
          </Field>
          <Field label="Scuppers count">
            <input type="number" onWheel={handleNumberInputWheel} min="0" step="1" value={fieldNotes.scuppersCount} onChange={(e) => handleFieldNotesChange("scuppersCount", e.target.value)} />
          </Field>
          <Field label="Penetrations / vents count">
            <input
              type="number" onWheel={handleNumberInputWheel}
              min="0"
              step="1"
              value={fieldNotes.penetrationsCount}
              onChange={(e) => handleFieldNotesChange("penetrationsCount", e.target.value)}
            />
          </Field>
        </div>

        <div className="formGrid" style={{ marginTop: 12 }}>
          <Field label="Roof condition notes">
            <textarea
              rows="4"
              value={fieldNotes.roofConditionNotes}
              onChange={(e) => handleFieldNotesChange("roofConditionNotes", e.target.value)}
            />
          </Field>
          <Field label="Access notes">
            <textarea
              rows="4"
              value={fieldNotes.accessNotes}
              onChange={(e) => handleFieldNotesChange("accessNotes", e.target.value)}
            />
          </Field>
          <Field label="Safety concerns">
            <textarea
              rows="4"
              value={fieldNotes.safetyConcerns}
              onChange={(e) => handleFieldNotesChange("safetyConcerns", e.target.value)}
            />
          </Field>
          <Field label="Parapet notes">
            <textarea
              rows="4"
              value={fieldNotes.parapetNotes}
              onChange={(e) => handleFieldNotesChange("parapetNotes", e.target.value)}
            />
          </Field>
        </div>

        <div className="formGrid" style={{ marginTop: 12 }}>
          <Field label="Photos upload">
            <button
              type="button"
              className="secondaryButton"
              onClick={() =>
                requestPhotoAccessAndOpenPicker({
                  accept: "image/*",
                  multiple: true,
                  onChange: handleFieldNotesPhotosChange,
                })
              }
            >
              Upload photos from device
            </button>
            <em>{fieldNotes.photos.length ? `${fieldNotes.photos.length} photo(s) attached.` : "Attach inspection photos for the record."}</em>
          </Field>
          <Field label="Internal notes">
            <textarea
              rows="4"
              value={fieldNotes.internalNotes}
              onChange={(e) => handleFieldNotesChange("internalNotes", e.target.value)}
            />
          </Field>
        </div>

        {fieldNotes.photos.length ? (
          <div className="detailList" style={{ marginTop: 14 }}>
            {fieldNotes.photos.map((photo, index) => (
              <div className="detailRow" key={`${photo.name || "photo"}-${index}`}>
                <span>Photo {index + 1}</span>
                <strong>{photo.name || `Image ${index + 1}`}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="primaryButton" onClick={handleSaveInspection}>
            Save Inspection
          </button>
          <button type="button" className="secondaryButton" onClick={() => setInspectionTemplateChooserOpen((current) => !current)}>
            Create Estimate From Inspection
          </button>
        </div>
      </Section>

      {inspectionTemplateChooserOpen ? (
        <Section title="Create estimate from inspection" subtitle="Choose the template to transfer this inspection into.">
          <div className="templateGrid">
            {FIELD_NOTE_TEMPLATE_OPTIONS.map((template) => (
              <button
                type="button"
                key={template.key}
                className="templateCard"
                onClick={() => handleCreateEstimateFromInspection(template.key)}
              >
                <span className="eyebrow">{template.estimateType}</span>
                <strong>{template.title}</strong>
                <p>Transfer the inspection details into this template.</p>
              </button>
            ))}
          </div>
          <div className="actionRow" style={{ marginTop: 16 }}>
            <button type="button" className="secondaryButton" onClick={() => setInspectionTemplateChooserOpen(false)}>
              Cancel
            </button>
          </div>
        </Section>
      ) : null}

      <Section title="Saved inspections" subtitle="Recent inspections saved on this browser.">
        <div className="savedList">
          {savedInspections.length ? (
            savedInspections.map((inspection) => (
              <div className="savedCard" key={inspection.id}>
                <div>
                  <span className="eyebrow">{inspection.date || "No date"}</span>
                  <strong>{inspection.jobName || "Untitled inspection"}</strong>
                  <p>
                    {inspection.customerName ? `${inspection.customerName} | ` : ""}
                    {inspection.jobAddress ? `${inspection.jobAddress} | ` : ""}
                    {inspection.technicianName ? `${inspection.technicianName}` : "No technician"}
                  </p>
                </div>
                <div className="savedActions">
                  <button type="button" className="secondaryButton" onClick={() => handleLoadInspection(inspection)}>
                    Load
                  </button>
                  <button type="button" className="dangerButton" onClick={() => handleDeleteInspection(inspection.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="emptyState">No saved inspections yet.</p>
          )}
        </div>
      </Section>
    </div>
  );

  const renderAdministrationScreen = () => <AdministrationWorkspace workspace={{ DetailRow, Field, LOGO_SRC, Section, SubcontractorCompliance, activeEmployeeDrivers, activeFieldOperationEmployees, activeFieldOperationForemen, authUser, buildEmployeeDisplayName, calculateLoadedHourlyWage, css, editEmployeeRecord, employeeDirectory, employeeManagementDraft, employeeManagementEditorRef, employeeManagementSearch, getAccountTitle, handleNumberInputWheel, isFinanceUser, money2, num, saveEmployeeDraft, setActiveTemplate, setEmployeeManagementSearch, startNewEmployeeDraft, supabase, supplierPaymentHistory, toNumber, updateEmployeeDraftField }} />;

  const renderSubcontractorDirectoryScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div className="brandRow">
          <div className="brandMark"><img src={LOGO_SRC} alt="CRT Roofing logo" /></div>
          <div>
            <p className="eyebrow">Company Directory</p>
            <h1>Approved Vendors &amp; Subcontractors</h1>
            <p className="intro">Find approved company contacts and review current licensing and insurance status.</p>
          </div>
        </div>
      </header>
      <Section title="Approved Vendor Directory" subtitle={canManageSubcontractorCompliance ? "Manage approved vendors and subcontractors, contacts, licensing, workers' compensation, and COIs." : "Read-only approved directory for sales and estimating."}>
        <SubcontractorCompliance supabase={supabase} authUser={authUser} readOnly={!canManageSubcontractorCompliance} />
      </Section>
    </div>
  );

  const getMiguelKpiData = () => {
    const uniqueJobs = new Map();
    [...completedJobs, ...activeJobs, ...pastCompletedJobs].forEach((job) => {
      const key = String(job.sourceRecordUid || job.id || "");
      if (key) uniqueJobs.set(key, job);
    });
    const jobs = [...uniqueJobs.values()];
    const kpis = calculateMiguelKpis(jobs, { periodDays: 30, managerName: "Miguel Figueroa" });
    return {
      kpis,
      attentionJobs: jobs.filter((job) => kpis.attentionJobIds.includes(job.id)),
    };
  };

  const renderMiguelKpiSection = () => {
    const { kpis, attentionJobs } = getMiguelKpiData();
    return (
      <Section title="Miguel · Project Manager / Production KPI" subtitle="Tracks Miguel's 30-day production flow from authorized release through scheduling and completion. Proposal, sales-approval, customer, and accounting delays do not count against him.">
        <div className="summaryGrid">
          <div className="summaryCard">
            <span>On-time production completion · primary KPI</span>
            <strong>{kpis.completionRate === null ? "—" : `${Math.round(kpis.completionRate * 100)}%`}</strong>
            <p>{`Target 90% · Status ${String(kpis.completionStatus || "gray").toUpperCase()} · ${kpis.completedOnTime} of ${kpis.completionEligible} completed or overdue jobs met the promised completion date.`}</p>
          </div>
          <div className="summaryCard">
            <span>Overall operating score</span>
            <strong>{kpis.overallScore === null ? "—" : `${kpis.overallScore}%`}</strong>
            <p>Blends completion, daily logs, scheduling response, and current job updates.</p>
          </div>
          <div className="summaryCard">
            <span>Jobs released to production</span>
            <strong>{num(kpis.releasedCount, 0)}</strong>
            <p>Authorized jobs handed to production during the last 30 days.</p>
          </div>
          <div className="summaryCard">
            <span>Released jobs scheduled</span>
            <strong>{num(kpis.scheduledReleasedCount, 0)}</strong>
            <p>Released jobs with a production schedule established.</p>
          </div>
          <div className="summaryCard">
            <span>Jobs completed</span>
            <strong>{num(kpis.completedThisPeriodCount, 0)}</strong>
            <p>Production jobs completed during the last 30 days.</p>
          </div>
          <div className="summaryCard">
            <span>Active production jobs</span>
            <strong>{num(kpis.activeJobs, 0)}</strong>
            <p>Current jobs under Miguel's production responsibility.</p>
          </div>
          <div className="summaryCard">
            <span>Scheduling response</span>
            <strong>{kpis.schedulingRate === null ? "—" : `${Math.round(kpis.schedulingRate * 100)}%`}</strong>
            <p>{`${kpis.scheduledOnTime} of ${kpis.schedulingEligible} eligible jobs scheduled within 2 business days of production release.`}</p>
          </div>
          <div className="summaryCard">
            <span>Daily job-log coverage</span>
            <strong>{kpis.dailyLogRate === null ? "—" : `${Math.round(kpis.dailyLogRate * 100)}%`}</strong>
            <p>{`${kpis.loggedDays} of ${kpis.expectedLogDays} expected business-day logs recorded.`}</p>
          </div>
          <div className="summaryCard">
            <span>Current job updates</span>
            <strong>{kpis.updateHygieneRate === null ? "—" : `${Math.round(kpis.updateHygieneRate * 100)}%`}</strong>
            <p>{`${kpis.currentUpdates} of ${kpis.hygieneEligible} active jobs updated within 2 business days.`}</p>
          </div>
          <div className="summaryCard">
            <span>Upcoming starts</span>
            <strong>{num(kpis.upcomingCount, 0)}</strong>
            <p>Jobs scheduled to start within the next seven days.</p>
          </div>
          <div className="summaryCard">
            <span>Pre-start blockers</span>
            <strong>{num(kpis.blockedUpcomingCount, 0)}</strong>
            <p>Visible for coordination; department-owned material or document delays are context, not an automatic KPI deduction.</p>
          </div>
        </div>
        {attentionJobs.length ? (
          <div className="savedList" style={{ marginTop: 16 }}>
            {attentionJobs.map((job) => (
              <div className="savedCard" key={job.id}>
                <div>
                  <span className="eyebrow">Production attention</span>
                  <strong>{job.projectName || job.jobName || job.jobNumber || "Production job"}</strong>
                  <p>{job.status || job.projectStatus || "Status not entered"} · Start {job.startDate || job.anticipatedStartDate || "TBD"} · Due {job.expectedCompletionDate || "TBD"}</p>
                </div>
                {activeJobs.some((activeJob) => activeJob.id === job.id) ? (
                  <button type="button" className="secondaryButton" onClick={() => openActiveJobDetail(job.id)}>Open Job</button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="smallNote" style={{ marginTop: 16 }}>No production jobs currently need KPI attention.</p>
        )}
        <div className="notice" style={{ marginTop: 16 }}>
          <strong>Thirty-day production flow</strong>
          <p>{`${kpis.releasedCount} released → ${kpis.scheduledReleasedCount} scheduled → ${kpis.completedThisPeriodCount} completed.`}</p>
          <p>Pre-production delays outside Miguel's control stay visible for coordination but do not lower his score.</p>
        </div>
        <div className="notice" style={{ marginTop: 16 }}>
          <strong>Scoring weights</strong>
          <p style={{ marginBottom: 0 }}>On-time completion 35% · daily job-log coverage 25% · production scheduling response 20% · active-job update hygiene 20%. Categories without enough data are excluded instead of counted against Miguel.</p>
        </div>
      </Section>
    );
  };

  const getTeamKpiOverview = () => {
    const chris = calculateLeadKpis(crmLeads, {
      originatorEmail: "chris@crtroofing.com",
      weeklyInspectionTarget: crmWeeklyInspectionTarget,
    });
    const ivan = calculateIvanKpis(crmLeads, crmProposalRequests, {
      ivanUserId: crmIvanProfileId,
      weeklyInspectionTarget: crmWeeklyInspectionTarget,
    });
    const daniela = calculateDanielaKpis(crmProposalRequests, crmProposalVersions, crmProposalAuditEvents, {
      danielaUserId: crmDanielaProfileId,
      periodDays: 30,
    });
    const miguel = getMiguelKpiData().kpis;
    return { chris, ivan, daniela, miguel };
  };

  const renderTeamKpiOverview = () => {
    const { chris, ivan, daniela, miguel } = getTeamKpiOverview();
    const percent = (value) => value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;
    const statusColor = (status) => ({ green: "#14804a", yellow: "#9a6700", red: "#c62828", gray: "#687682" }[status] || "#687682");
    const cards = [
      {
        name: "Chris",
        role: "Business Development",
        label: "Qualified leads this week",
        value: `${num(chris.qualifiedThisWeek, 0)} / ${num(chris.weeklyQualifiedTarget, 0)}`,
        status: chris.qualifiedStatus,
        context: `${num(chris.customerVisitsThisWeek, 0)} of ${num(chris.weeklyVisitTarget, 0)} visits · ${num(chris.inspectionReadyThisWeek, 0)} of ${num(chris.weeklyChrisInspectionTarget, 0)} inspection handoffs`,
      },
      {
        name: "Ivan",
        role: "Estimator / Technician / Sales",
        label: "On-time proposal handoff",
        value: percent(ivan.handoffRate),
        status: ivan.handoffStatus,
        context: `${num(ivan.assignedThisWeek, 0)} of ${num(ivan.weeklyCapacity, 0)} inspection slots assigned · ${num(ivan.availableCapacity, 0)} open`,
      },
      {
        name: "Daniela",
        role: "Proposals / Estimating",
        label: "Complete on-time Word + PDF handoff",
        value: percent(daniela.turnaroundRate),
        status: daniela.turnaroundStatus,
        context: `${num(daniela.activeQueueCount, 0)} active requests · ${num(daniela.awaitingSalesReviewCount, 0)} awaiting Sales Review`,
      },
      {
        name: "Miguel",
        role: "Project Manager / Production",
        label: "On-time production completion",
        value: percent(miguel.completionRate),
        status: miguel.completionStatus,
        context: `${num(miguel.activeJobs, 0)} active production jobs · ${num(miguel.upcomingCount, 0)} upcoming starts`,
      },
    ];

    return (
      <Section
        title="Team KPIs"
        subtitle="Each person's primary result and current workload at a glance. Open the scorecards for supporting measures and context."
        right={(
          <button type="button" className="secondaryButton" onClick={() => {
            if (isProjectManager) {
              setActiveTemplate("kpis");
              return;
            }
            setCrmTab("reports");
            setActiveTemplate("crm");
          }}>
            Open KPI scorecards
          </button>
        )}
      >
        <div className="summaryGrid teamKpiOverviewGrid">
          {cards.map((card) => (
            <div className="summaryCard" key={card.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ marginBottom: 0 }}>{card.name} · {card.role}</span>
                <small style={{ color: statusColor(card.status), fontWeight: 800 }}>{String(card.status || "gray").toUpperCase()}</small>
              </div>
              <p style={{ marginTop: 12 }}>{card.label}</p>
              <strong>{card.value}</strong>
              <p>{card.context}</p>
            </div>
          ))}
        </div>
        <p className="smallNote" style={{ margin: "12px 0 0" }}>Gray means there is not enough eligible activity to score yet. Capacity context is visible without unfairly lowering another employee's KPI.</p>
      </Section>
    );
  };

  const renderMiguelKpiScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div className="brandRow">
          <div className="brandMark"><img src={LOGO_SRC} alt="CRT Roofing logo" /></div>
          <div>
            <p className="eyebrow">Production Accountability</p>
            <h1>KPI Scorecards</h1>
            <p className="intro">A focused view of production commitments, documentation, and job readiness.</p>
          </div>
        </div>
      </header>
      {renderMiguelKpiSection()}
    </div>
  );

  const renderCrmLeadsScreen = () => <CrmWorkspace workspace={{ CRM_FOLLOWUP_STATUS_OPTIONS, CRM_FOLLOWUP_TYPE_OPTIONS, CRM_LEAD_SERVICE_OPTIONS, CRM_LEAD_SOURCE_OPTIONS, CRM_LEAD_STATUS_OPTIONS, CRM_PIPELINE_STATUS_OPTIONS, CRM_PROPERTY_TYPE_OPTIONS, CRM_TIMELINE_TYPE_OPTIONS, CRM_URGENCY_OPTIONS, CRM_VISIT_OUTCOME_OPTIONS, DetailRow, Field, LOGO_SRC, Section, addCrmContactToCustomer, addCrmJobToCustomer, addCrmPropertyToCustomer, addCrmTimelineEntry, authUser, calculateDanielaKpis, calculateIvanKpis, calculateLeadKpis, completedJobs, convertCrmLeadToCustomer, crmActiveStaffOptions, crmCustomerDeletingId, crmCustomerDisplayName, crmCustomerDraft, crmCustomerSaving, crmCustomerSearch, crmCustomers, crmDanielaProfileId, crmFollowupDeletingId, crmFollowupDraft, crmFollowupSaving, crmFollowupSearch, crmFollowups, crmInspectionSending, crmIvanProfileId, crmLeadAssigneeFilter, crmLeadDateFrom, crmLeadDateTo, crmLeadDeletingId, crmLeadDisplayName, crmLeadDocuments, crmLeadDraft, crmLeadSearch, crmLeadSortBy, crmLeadSortDirection, crmLeadSourceFilter, crmLeadStatusFilter, crmLeadSyncError, crmLeadSyncStatus, crmLeadWorkOrderFile, crmLeadWorkOrderUploading, crmLeads, crmPipelineView, crmProposalAuditEvents, crmProposalRequests, crmProposalVersions, crmRecordSyncError, crmSelectedCustomer, crmTab, crmWeeklyInspectionTarget, css, deleteCrmCustomer, deleteCrmFollowup, deleteCrmLead, editCrmCustomer, editCrmFollowup, editCrmLead, getAccountTitle, handleCrmLeadAction, handleNumberInputWheel, isFinanceUser, money2, num, openCrmLeadDocument, openDashboardLeadCapture, openProposalBuilder, proposals, removeCrmContact, removeCrmFile, removeCrmJob, removeCrmProperty, removeCrmTimelineEntry, renderMiguelKpiSection, saveCrmCustomerDraft, saveCrmFollowupDraft, saveCrmLeadDraft, saveCrmWeeklyInspectionTarget, saveQuickLeadAndAddNext, selectCrmLeadWorkOrder, sendCrmLeadForInspection, setActiveTemplate, setCrmCustomerSearch, setCrmFollowupSearch, setCrmLeadAssigneeFilter, setCrmLeadDateFrom, setCrmLeadDateTo, setCrmLeadSearch, setCrmLeadSortBy, setCrmLeadSortDirection, setCrmLeadSourceFilter, setCrmLeadStatusFilter, setCrmPipelineView, setCrmTab, setCrmWeeklyInspectionTarget, setSessionMessage, setSessionMessageType, startNewCrmCustomerDraft, startNewCrmFollowupDraft, startNewCrmLeadDraft, toNumber, updateCrmContactField, updateCrmCustomerDraftField, updateCrmFollowupDraftField, updateCrmJobField, updateCrmLeadDraftField, updateCrmPropertyField, updateCrmTimelineField }} />;

  const renderAdminPricingScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>Admin Pricing &amp; Defaults</h1>
              <p className="intro">Shared company estimator defaults with realtime sync.</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
          <p>{getAccountTitle()}</p>
          <p className="smallNote" style={{ marginTop: 8 }}>
            {estimatorSettingsSyncStatus === "saving"
              ? "Saving company defaults..."
              : estimatorSettingsHasUnsavedChanges
                ? "Unsaved changes"
                : estimatorSettingsSyncStatus === "saved"
                  ? "Company defaults saved"
                  : estimatorSettingsSyncStatus === "error"
                    ? "Save or sync error"
                    : estimatorSettingsSyncStatus === "loading"
                      ? "Loading company defaults..."
                      : "Company sync idle"}
          </p>
          {estimatorSettingsMetadata.updatedAt ? (
            <p className="smallNote" style={{ marginTop: 4 }}>
              Last saved {new Date(estimatorSettingsMetadata.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button type="button" className="secondaryButton" onClick={leaveAdminPricingScreen}>
          Back to dashboard
        </button>
        <button
          type="button"
          className="primaryButton"
          onClick={saveCompanyEstimatorSettings}
          disabled={!estimatorSettingsHasUnsavedChanges || estimatorSettingsSyncStatus === "saving"}
        >
          {estimatorSettingsSyncStatus === "saving" ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={discardCompanyEstimatorSettingsChanges}
          disabled={!estimatorSettingsHasUnsavedChanges || estimatorSettingsSyncStatus === "saving"}
        >
          Discard Changes
        </button>
      </div>

      <p className="smallNote" style={{ margin: "-4px 0 16px" }}>
        Changes are shared with every authenticated CRT estimator only after you select Save Changes.
      </p>
      {estimatorSettingsSyncError ? <p className="errorText">Save failed: {estimatorSettingsSyncError}</p> : null}

      <Section title="Materials" subtitle="Pricing foundation for material defaults.">
        <div className="formGrid">
          {ADMIN_PRICING_SECTIONS.materials.map(([key, label]) => (
            <Field key={key} label={label}>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={adminPricing[key]} onChange={(e) => setAdminPricingField(key, e.target.value)} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Labor" subtitle="Pricing foundation for labor defaults.">
        <div className="formGrid">
          {ADMIN_PRICING_SECTIONS.labor.map(([key, label]) => (
            <Field key={key} label={label}>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={adminPricing[key]} onChange={(e) => setAdminPricingField(key, e.target.value)} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Company Defaults" subtitle="General defaults for future estimate templates.">
        <div className="formGrid">
          {ADMIN_PRICING_SECTIONS.companyDefaults.map(([key, label]) => (
            <Field key={key} label={label}>
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={adminPricing[key]} onChange={(e) => setAdminPricingField(key, e.target.value)} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Travel Defaults" subtitle="Company-controlled travel settings used by all estimator templates.">
        <div className="formGrid">
          <Field label="Company HQ address">
            <input
              type="text"
              value={adminTravelSettings.companyHqAddress}
              onChange={(e) => setAdminTravelField("companyHqAddress", e.target.value)}
            />
          </Field>
          <Field label="Driver hourly rate">
            <input
              type="number"
              onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={adminTravelSettings.travelDriverHourlyRate}
              onChange={(e) => setAdminTravelField("travelDriverHourlyRate", e.target.value)}
            />
          </Field>
          <Field label="Fuel cost per gallon">
            <input
              type="number"
              onWheel={handleNumberInputWheel}
              min="0"
              step="0.01"
              value={adminTravelSettings.fuelCostPerGallon}
              onChange={(e) => setAdminTravelField("fuelCostPerGallon", e.target.value)}
            />
          </Field>
        </div>
        <div className="formGrid" style={{ marginTop: 10 }}>
          {TRAVEL_VEHICLE_OPTIONS.map((vehicle) => (
            <Field key={vehicle.value} label={`${vehicle.label} MPG`}>
              <input
                type="number"
                onWheel={handleNumberInputWheel}
                min="0.1"
                step="0.1"
                value={adminTravelSettings.vehicleMpgByKey?.[vehicle.value] ?? vehicle.mpg}
                onChange={(e) => setAdminTravelVehicleMpg(vehicle.value, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </Section>
    </div>
  );

  const renderEstimateTemplatesScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>Estimate Templates</h1>
              <p className="intro">Choose the estimate template you want to build.</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
          <p>{getAccountTitle()}</p>
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
          Back to dashboard
        </button>
      </div>

      <Section title="Templates" subtitle="Pick the estimate type you want to build.">
        <div className="templateGrid">
          {TEMPLATE_CARDS.map((card) => (
            <button
              key={card.key}
              type="button"
              className="templateCard"
              onClick={() => setActiveTemplate(card.key)}
            >
              <span className="eyebrow">{card.estimateType}</span>
              <strong>{card.title}</strong>
              <p>{card.comingSoon ? "Coming Soon" : "Open template"}</p>
            </button>
          ))}
          <button
            type="button"
            className="templateCard"
            onClick={() => setTemplatesSavedEstimatesOpen((current) => !current)}
          >
            <span className="eyebrow">Browse</span>
            <strong>Saved estimates</strong>
            <p>{activeSavedEstimates.length ? `${activeSavedEstimates.length} saved` : "No saved estimates yet"}</p>
          </button>
        </div>
        {isFinanceUser ? (
          <div className="actionRow" style={{ marginTop: 16 }}>
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("adminPricing")}>
              Admin Pricing
            </button>
          </div>
        ) : null}
      </Section>

      {templatesSavedEstimatesOpen ? (
        <Section title="Saved estimates" subtitle="Review estimates you already saved.">
          <div style={{ display: "grid", gap: 10, maxWidth: 480 }}>
            <input
              type="search"
              placeholder="Search saved estimates"
              value={templatesSavedEstimateSearch}
              onChange={(e) => setTemplatesSavedEstimateSearch(e.target.value)}
            />
          </div>
          <div className="savedList">
            {filteredTemplatesSavedEstimates.length ? (
              filteredTemplatesSavedEstimates.map((estimate) => (
                <div className="savedCard" key={estimate.id}>
                  <div>
                    <span className="eyebrow">{estimate.estimateCode || estimateCode(estimate.estimateNumber || 1)}</span>
                    <strong>{estimate.name || "Untitled estimate"}</strong>
                    <p>
                      {estimate.estimateType ? `${estimate.estimateType} | ` : ""}
                      {estimate.inputs?.jobName ? `${estimate.inputs.jobName} | ` : ""}
                      {estimate.inputs?.customerName ? `${estimate.inputs.customerName} | ` : ""}
                      {num(estimate.summary?.totalSquares ?? estimate.inputs?.totalSquares ?? 0, 0)} SQ |{" "}
                      {money(estimate.summary?.selectedBidAmount ?? 0)} bid |{" "}
                      {num(estimate.summary?.selectedMarkupPercent ?? 0, 0)}% markup
                    </p>
                    {isAdminUser ? (
                      <p>Owner: {estimate.ownerDisplayName || estimate.ownerEmail || estimate.ownerId || "Unassigned"}</p>
                    ) : null}
                  </div>

                  <div className="savedActions">
                    <button type="button" className="secondaryButton" onClick={() => handleConvertEstimateToProposal(estimate)}>
                      Generate Proposal
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleLoadEstimate(estimate)}>
                      Load
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleApproveJob(estimate)}>
                      Approve Job
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleCompleteJob(estimate)}>
                      Complete Job
                    </button>
                    {isAdminUser ? (
                      <>
                        <select
                          value={estimateOwnerAssignments[estimate.id] || estimate.ownerId || ""}
                          onChange={(e) => handleEstimateOwnerSelection(estimate.id, e.target.value)}
                        >
                          <option value="">Select owner</option>
                          {companyUserProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {(profile.full_name || profile.email || profile.id)} ({normalizeAppRole(profile.role)})
                            </option>
                          ))}
                        </select>
                        <button type="button" className="secondaryButton" onClick={() => handleReassignEstimateOwner(estimate)}>
                          Reassign
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="dangerButton" onClick={() => handleDeleteEstimate(estimate)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyState">
                {templatesSavedEstimateSearch.trim() ? "No saved estimates match your search." : "No saved estimates yet."}
              </p>
            )}
          </div>
        </Section>
      ) : null}

      {isFinanceUser ? (
        <Section title="Admin" subtitle="Pricing and default settings.">
          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("adminPricing")}>
              Admin Pricing
            </button>
          </div>
        </Section>
      ) : null}
    </div>
  );

  const handleApprovedJobQuickDraftChange = (field, value) => {
    setApprovedJobQuickDraft((current) => ({ ...current, [field]: value }));
  };

  const handleCreateApprovedJobQuick = async () => {
    if (!canCreateApprovedJobData) {
      setSessionMessageType("error");
      setSessionMessage("You do not have permission to create approved jobs.");
      return;
    }
    if (!approvedJobQuickDraft.projectName.trim()) {
      setSessionMessageType("error");
      setSessionMessage("Please enter a job number or project name.");
      return;
    }

    setJobsSyncStatus("saving");
    setSessionMessage("");
    const created = await createApprovedJobFromStaffDraft(approvedJobQuickDraft);
    if (created.error) {
      setJobsSyncStatus("error");
      setJobsSyncError(created.error.message || String(created.error));
      setSessionMessageType("error");
      setSessionMessage(`Could not add the approved job: ${created.error.message || created.error}`);
      return;
    }

    const refreshed = await fetchSharedJobsFromSupabase();
    if (!refreshed.error) applySharedJobRows(refreshed.data);
    setJobsSyncStatus(refreshed.error ? "error" : "saved");
    setJobsSyncError(refreshed.error?.message || "");
    setSessionMessageType(refreshed.error ? "error" : "success");
    setSessionMessage(
      refreshed.error
        ? `The job was added, but the list could not refresh: ${refreshed.error.message || refreshed.error}`
        : `${approvedJobQuickDraft.projectName.trim()} added to Approved Jobs.`,
    );
    if (!refreshed.error) {
      setApprovedJobQuickDraft(createBlankApprovedJobQuickDraft());
      setApprovedJobQuickCreateOpen(false);
    }
  };

  const renderApprovedJobsScreen = () => <ApprovedJobsWorkspace workspace={{ APPROVED_JOB_STATUS_OPTIONS, Field, LOGO_SRC, Section, activeJobMutationKey, approvedJobQuickCreateOpen, approvedJobQuickDraft, archivedJobs, archivedJobsCollapsed, authUser, canCreateApprovedJobData, canManageSharedJobData, css, filteredApprovedJobs, handleApprovedJobQuickDraftChange, handleCreateApprovedJobQuick, handleRestoreArchivedJob, jobsSyncError, jobsSyncStatus, renderApprovedJobsTableSection, sessionMessage, sessionMessageType, setActiveTemplate, setApprovedJobQuickCreateOpen, setArchivedJobsCollapsed }} />;

  const renderApprovedJobScreen = () => <ApprovedJobWorkspace workspace={{ APPROVED_JOB_OPERATING_OVERHEAD_RATE, Field, LOGO_SRC, PAYROLL_TAX_RATE, SPRAY_FOAM_GALLONS_PER_KIT, SPRAY_FOAM_KIT_COST, Section, TRAVEL_VEHICLE_OPTIONS, approvedAttachmentUploadingDayIds, approvedDailyProgressLogs, approvedJobData, authUser, buildEmployeeDisplayName, calculateApprovedJobFullyLoadedProfitability, calculateApprovedJobTotals, calculateDailyEmployeeLaborCost, calculateDailyTravelCost, calculateSubcontractorCost, canManageSharedJobData, collapsedApprovedDailyProgressDayIds, css, employeeDirectory, formatAttachmentSize, handleAddDailyProgressDay, handleAddDailyTravelRow, handleAddEmployeeRow, handleAddMaterialItem, handleAddSubcontractorRow, handleApprovedJobFormChange, handleApprovedJobSalespersonChange, handleApprovedProgressAttachmentUpload, handleDailyProgressFieldChange, handleDailyTravelRowChange, handleDeleteDailyProgressDay, handleDeleteEmployeeRow, handleEmployeeRowChange, handleMaterialItemChange, handleNumberInputWheel, handleOpenApprovedProgressAttachment, handleRemoveApprovedProgressAttachment, handleRemoveDailyTravelRow, handleRemoveMaterialItem, handleRemoveSubcontractorRow, handleSaveApprovedJob, handleSubcontractorRowChange, handleToggleDailyProgressDay, isProjectManager, money2, round, selectedApprovedJob, sessionMessage, sessionMessageType, setActiveTemplate, summarizeApprovedDailyProgress, toNumber }} />;

  const renderJobMetricsScreen = () => {
    if (!selectedMetricsEstimate || !metricsFormData) {
      return (
        <div className="appShell">
          <style>{css}</style>
          <header className="hero">
            <div>
              <div className="brandRow">
                <div className="brandMark">
                  <img src={LOGO_SRC} alt="CRT Roofing logo" />
                </div>
                <div>
                  <p className="eyebrow">CRT Roofing Employee Portal</p>
                  <h1>Completed Job Metrics</h1>
                  <p className="intro">Track actual vs estimated costs and performance.</p>
                  <p className="intro">Metrics can be edited manually if daily progress was not fully tracked.</p>
                </div>
              </div>
            </div>

            <div className="heroCard">
              <span>Signed in</span>
              <strong>{authUser.displayName}</strong>
            </div>
          </header>

          <div className="actionRow" style={{ marginBottom: 16 }}>
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
              Back to dashboard
            </button>
          </div>

          <Section title="Completed Jobs" subtitle="Enter metrics for completed jobs to track performance.">
            <div className="savedList">
              {activeSavedEstimates.length ? (
                activeSavedEstimates.map((estimate) => (
                  <div className="savedCard" key={estimate.id}>
                    <div>
                      <span className="eyebrow">{estimate.estimateCode || estimateCode(estimate.estimateNumber || 1)}</span>
                      <strong>{estimate.name || "Untitled estimate"}</strong>
                      <p>
                        {estimate.estimateType ? `${estimate.estimateType} | ` : ""}
                        {estimate.inputs?.jobName ? `${estimate.inputs.jobName} | ` : ""}
                        {estimate.inputs?.customerName ? `${estimate.inputs.customerName} | ` : ""}
                        {num(estimate.summary?.totalSquares ?? estimate.inputs?.totalSquares ?? 0, 0)} SQ |{" "}
                        {money(estimate.summary?.selectedBidAmount ?? 0)} bid
                      </p>
                    </div>

                    <div className="savedActions">
                      <button type="button" className="primaryButton" onClick={() => handleOpenMetricsForm(estimate)}>
                        Enter Metrics
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">No saved estimates yet.</p>
              )}
            </div>
          </Section>
        </div>
      );
    }

    return (
      <div className="appShell">
        <style>{css}</style>
        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Employee Portal</p>
                <h1>Complete Job: {metricsFormData.estimateCode}</h1>
                <p className="intro">Track actual vs estimated costs and performance.</p>
                  <p className="intro">Metrics can be edited manually if daily progress was not fully tracked.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
          </div>
        </header>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setSelectedMetricsEstimate(null);
              setMetricsFormData(null);
              setActiveTemplate("jobMetrics");
            }}
          >
            Back to estimate list
          </button>
        </div>

        {sessionMessage && (
          <div style={{ margin: "0 0 16px 0", padding: 12, borderRadius: 4, backgroundColor: sessionMessageType === "success" ? "#e8f5e9" : "#ffebee", color: sessionMessageType === "success" ? "#2e7d32" : "#c62828" }}>
            {sessionMessage}
          </div>
        )}

        <Section title="Estimated vs Actual" subtitle="Compare your estimates with actual job results.">
          <div className="formGrid">
            <Field label="Job name">
              <input type="text" value={metricsFormData.jobName} disabled />
            </Field>
            <Field label="Customer name">
              <input type="text" value={metricsFormData.customerName} disabled />
            </Field>
            <Field label="Total squares">
              <input type="number" onWheel={handleNumberInputWheel} value={metricsFormData.totalSquares} disabled />
            </Field>
            <Field label="Roof type">
              <input type="text" value={metricsFormData.roofType} disabled />
            </Field>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Estimated final bid">
              <input type="number" onWheel={handleNumberInputWheel} value={money(metricsFormData.estimateFinalBid)} disabled />
            </Field>
            <Field label="Estimated material cost">
              <input type="number" onWheel={handleNumberInputWheel} value={money(metricsFormData.estimateMaterialCost)} disabled />
            </Field>
            <Field label="Estimated labor cost">
              <input type="number" onWheel={handleNumberInputWheel} value={money(metricsFormData.estimateLaborCost)} disabled />
            </Field>
            <Field label="Estimated travel cost">
              <input type="number" onWheel={handleNumberInputWheel} value={money(metricsFormData.estimateTravelCost)} disabled />
            </Field>
          </div>
        </Section>

        <Section title="Actual Results" subtitle="Enter the actual costs and results from the completed job.">
          <div className="formGrid">
            <Field label="Actual material cost">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={metricsFormData.actualMaterialCost}
                onChange={(e) => handleMetricsFormChange("actualMaterialCost", toNumber(e.target.value))}
              />
            </Field>
            <Field label="Actual labor cost">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={metricsFormData.actualLaborCost}
                onChange={(e) => handleMetricsFormChange("actualLaborCost", toNumber(e.target.value))}
              />
            </Field>
            <Field label="Actual labor hours">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.5"
                value={metricsFormData.actualLaborHours}
                onChange={(e) => handleMetricsFormChange("actualLaborHours", toNumber(e.target.value))}
              />
            </Field>
            <Field label="Actual travel cost">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={metricsFormData.actualTravelCost}
                onChange={(e) => handleMetricsFormChange("actualTravelCost", toNumber(e.target.value))}
              />
            </Field>
            <Field label="Change orders">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={metricsFormData.changeOrders}
                onChange={(e) => handleMetricsFormChange("changeOrders", toNumber(e.target.value))}
              />
            </Field>
            <Field label="Final invoice amount">
              <input
                type="number" onWheel={handleNumberInputWheel}
                min="0"
                step="0.01"
                value={metricsFormData.finalInvoiceAmount}
                onChange={(e) => handleMetricsFormChange("finalInvoiceAmount", toNumber(e.target.value))}
              />
            </Field>
          </div>
        </Section>

        <Section title="Performance Summary" subtitle="Your calculated metrics based on actual results.">
          <div className="detailList">
            <div className="detailRow">
              <span>Actual profit</span>
              <strong style={{ color: toNumber(metricsFormData.finalInvoiceAmount) - toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.actualTravelCost) >= 0 ? "green" : "red" }}>
                {money(toNumber(metricsFormData.finalInvoiceAmount) - toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.actualTravelCost))}
              </strong>
            </div>
            <div className="detailRow">
              <span>Actual margin %</span>
              <strong style={{ color: toNumber(metricsFormData.finalInvoiceAmount) > 0 && (toNumber(metricsFormData.finalInvoiceAmount) - toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.actualTravelCost)) / toNumber(metricsFormData.finalInvoiceAmount) * 100 >= 20 ? "green" : "red" }}>
                {round((toNumber(metricsFormData.finalInvoiceAmount) - toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.actualTravelCost)) / Math.max(1, toNumber(metricsFormData.finalInvoiceAmount)) * 100, 1)}%
              </strong>
            </div>
            <div className="detailRow">
              <span>Material variance</span>
              <strong style={{ color: toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.estimateMaterialCost) <= 0 ? "green" : "red" }}>
                {money(toNumber(metricsFormData.actualMaterialCost) - toNumber(metricsFormData.estimateMaterialCost))}
              </strong>
            </div>
            <div className="detailRow">
              <span>Labor variance</span>
              <strong style={{ color: toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.estimateLaborCost) <= 0 ? "green" : "red" }}>
                {money(toNumber(metricsFormData.actualLaborCost) - toNumber(metricsFormData.estimateLaborCost))}
              </strong>
            </div>
          </div>
        </Section>

        <Section title="Lessons Learned" subtitle="Capture notes and improvements for future estimates.">
          <div className="formGrid">
            <Field label="Notes">
              <textarea
                rows="4"
                value={metricsFormData.notes}
                onChange={(e) => handleMetricsFormChange("notes", e.target.value)}
                placeholder="General notes about the job..."
              />
            </Field>
            <Field label="What would we change next time?">
              <textarea
                rows="4"
                value={metricsFormData.lessonsLearned}
                onChange={(e) => handleMetricsFormChange("lessonsLearned", e.target.value)}
                placeholder="Lessons learned and improvements for future estimates..."
              />
            </Field>
          </div>
        </Section>

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="primaryButton" onClick={handleSaveMetrics}>
            Save Completed Job
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setSelectedMetricsEstimate(null);
              setMetricsFormData(null);
              setActiveTemplate("jobMetrics");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const renderPastJobInsightsScreen = () => {
    const insights = buildJobInsights();

    return (
      <div className="appShell">
        <style>{css}</style>
        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Employee Portal</p>
                <h1>Past Job Insights</h1>
                <p className="intro">Performance analytics from completed jobs.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
          </div>
        </header>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
            Back to dashboard
          </button>
        </div>

        {completedJobMetrics.length === 0 ? (
          <Section title="No Data" subtitle="Complete jobs and enter metrics to see insights.">
            <p className="intro">Start entering metrics for completed jobs to see performance analytics here.</p>
          </Section>
        ) : (
          <>
            <Section title="Overall Performance" subtitle={`Analysis of ${insights.totalJobs} completed job(s)`}>
              <div className="detailList">
                <div className="detailRow">
                  <span>Total jobs tracked</span>
                  <strong>{insights.totalJobs}</strong>
                </div>
                <div className="detailRow">
                  <span>Average price per square</span>
                  <strong>{money(insights.averagePricePerSq)}</strong>
                </div>
                <div className="detailRow">
                  <span>Average material cost per square</span>
                  <strong>{money(insights.averageMaterialCostPerSq)}</strong>
                </div>
                <div className="detailRow">
                  <span>Average labor cost per square</span>
                  <strong>{money(insights.averageLaborCostPerSq)}</strong>
                </div>
                <div className="detailRow">
                  <span>Average profit margin</span>
                  <strong style={{ color: insights.averageProfitMargin >= 20 ? "green" : "red" }}>{num(insights.averageProfitMargin, 1)}%</strong>
                </div>
                <div className="detailRow">
                  <span>Average estimate variance</span>
                  <strong>{money(insights.averageEstimateVariance)}</strong>
                </div>
              </div>
            </Section>

            {insights.roofTypeStats && insights.roofTypeStats.length > 0 && (
              <Section title="Performance by Roof Type" subtitle="Metrics grouped by roof type.">
                <div className="tableWrap">
                  <table className="dataTable">
                    <thead>
                      <tr>
                        <th>Roof Type</th>
                        <th>Jobs</th>
                        <th>Avg Price/SQ</th>
                        <th>Avg Material/SQ</th>
                        <th>Avg Labor/SQ</th>
                        <th>Avg Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.roofTypeStats.map((stat, idx) => (
                        <tr key={`${stat.roofType}-${idx}`}>
                          <td>{stat.roofType}</td>
                          <td>{stat.count}</td>
                          <td>{money(stat.avgPricePerSq)}</td>
                          <td>{money(stat.avgMaterialPerSq)}</td>
                          <td>{money(stat.avgLaborPerSq)}</td>
                          <td style={{ color: stat.avgMargin >= 20 ? "green" : "red" }}>{num(stat.avgMargin, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            <Section title="Recent Completed Jobs" subtitle="Most recent jobs with metrics entered.">
              <div className="savedList">
                {completedJobMetrics.map((metric) => (
                  <div className="savedCard" key={metric.id}>
                    <div>
                      <span className="eyebrow">{metric.estimate_code || "No code"}</span>
                      <strong>{metric.job_name || "Untitled job"}</strong>
                      <p>
                        {metric.roof_type ? `${metric.roof_type} | ` : ""}
                        {metric.total_squares ? `${num(metric.total_squares, 0)} SQ | ` : ""}
                        {metric.final_invoice_amount ? `${money(metric.final_invoice_amount)} invoice` : ""}
                      </p>
                      <p style={{ fontSize: "0.9em", marginTop: 4 }}>
                        {metric.actual_margin_percent ? `Margin: ${num(metric.actual_margin_percent, 1)}% | ` : ""}
                        {metric.actual_profit ? `Profit: ${money(metric.actual_profit)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    );
  };

  function renderTileScreen() {
    return (
      <TileWorkspace
        workspace={{
          DetailRow,
          Field,
          OverheadCalculator,
          Section,
          TravelCalculator,
          addTileCustomMaterial,
          addTileLaborSection,
          addTileTearOffSection,
          addTravelVehicleSelection,
          calculation,
          css,
          googleDebug,
          handleCalculateDistance,
          handleConvertCurrentEstimateToProposal,
          handleDownloadEstimatePDF,
          handleNumberInputWheel,
          handleSaveEstimate,
          handleSelectZeroOnFocus,
          handleSelectedMarkup,
          inputs,
          isLoaded,
          isLookingUpDistance,
          loadError,
          money2,
          normalizeShingleLaborSections,
          normalizeShingleTearOffSections,
          num,
          removeTileCustomMaterial,
          removeTileLaborSection,
          removeTileTearOffSection,
          removeTravelVehicleSelection,
          renderEstimatorShellHeader,
          renderQuickMeasureReviewPanel,
          setField,
          setInputs,
          setTileLaborSection,
          setTileTearOffSection,
          setTravelField,
          setTravelVehicleSelection,
          toNumber,
          travelLookupMessage,
          updateTileCustomMaterial,
        }}
      />
    );
  }

  function renderDashboard() {
    const dashboardWelcomeName = (() => {
      const rawName = String(authUser?.displayName || "").trim();
      if (!rawName || rawName.includes("@")) {
        return "Employee";
      }
      return rawName;
    })();

    const dashboardRoleLabel = (() => {
      const title = String(authUser?.title || "").trim();
      if (title) {
        return title === "Sales" ? "Salesperson" : title;
      }
      return isAdminUser ? "Administration" : "Salesperson";
    })();

    const dashboardWorkspace = getEmployeeWorkspace({
      email: authUser?.email,
      role: authRole,
      capabilities: {
        canAccessInvoices: canAccessInvoiceQueue,
        canAccessFinance: canAccessCfoDashboard,
        canViewApprovedJobs: !isProjectManager,
      },
    });
    const dashboardSections = getEmployeeDashboardSections({ email: authUser?.email, role: authRole });
    const openTaskCreator = () => {
      setWorkHubInitialTaskId("");
      setWorkHubInitialTab("tasks");
      setWorkHubInitialCreateTask(true);
      setActiveTemplate("workHub");
    };
    const dashboardActionDefinitions = {
      collectLead: { eyebrow: "Business Development", title: "Collect Lead", description: "Log a new opportunity quickly.", open: openDashboardLeadCapture },
      sendInspection: { eyebrow: "Scheduling", title: "Send for Inspection", description: "Capture the caller and notify Ivan.", open: openDashboardInspectionRequest },
      customers: { eyebrow: "CRM", title: "Customers", description: "Review leads, follow-ups, and customer history.", open: () => setActiveTemplate("crm") },
      tasks: { eyebrow: "Team", title: "New Task", description: "Assign work and start a discussion.", open: openTaskCreator },
      inspections: { eyebrow: "Field", title: "Inspections", description: "Open field notes and roof inspection records.", open: () => setActiveTemplate("fieldNotes") },
      proposalRequests: { eyebrow: "Proposals", title: "Proposal Requests", description: "Submit or process estimating information.", open: () => setActiveTemplate("proposalRequests") },
      estimates: { eyebrow: "Estimating", title: "Estimate Templates", description: "Build pricing from the approved company defaults.", open: () => setActiveTemplate("estimateTemplates") },
      approvedJobs: { eyebrow: "Handoff", title: "Approved Jobs", description: "Review work moving into production.", open: () => setActiveTemplate("approvedJobs") },
      activeJobs: { eyebrow: "Production", title: "Active Jobs", description: activeJobsSummary.activeCount ? `${activeJobsSummary.activeCount} active projects.` : "Open the production workspace.", open: () => setActiveTemplate("activeJobs") },
      fieldOperations: { eyebrow: "Production", title: "Field Operations", description: "Daily logs and production updates.", open: () => setActiveTemplate("fieldOperations") },
      vendors: { eyebrow: "Directory", title: "Approved Vendors", description: "Find contacts and compliance documents.", open: () => setActiveTemplate("subcontractors") },
      invoices: { eyebrow: "Accounting", title: "Invoice Queue", description: "Prepare, send, and follow up on invoices.", open: () => setActiveTemplate("invoices") },
      finance: { eyebrow: "Finance", title: "Finance Dashboard", description: "Review receivables, payables, and profitability.", open: () => setActiveTemplate("cfoDashboard") },
    };

    return (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>Dashboard</h1>
              <p className="intro">Choose how you want to start your work.</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <div style={{ display: "grid", gap: 6 }}>
            <strong>Welcome back</strong>
            <p style={{ margin: 0, color: "var(--ink)", fontSize: "1.05rem", fontWeight: 700 }}>{dashboardWelcomeName}</p>
            <p>{`${dashboardRoleLabel} · ${authUser.email || "No email available"}`}</p>
          </div>
          <button type="button" className="secondaryButton" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {renderQuickMeasureReviewPanel()}

      <DashboardTasks
        supabase={supabase}
        authUser={authUser}
        role={authRole}
        activeJobs={activeJobs}
        canAccessInvoices={canAccessInvoiceQueue}
        canManageCompliance={canManageSubcontractorCompliance}
        onOpenTasks={(taskId = "") => {
          setWorkHubInitialCreateTask(false);
          setWorkHubInitialTab("tasks");
          setWorkHubInitialTaskId(taskId);
          setActiveTemplate("workHub");
        }}
        onOpenProposals={() => setActiveTemplate("proposalRequests")}
        onOpenActiveJobs={() => setActiveTemplate("activeJobs")}
        onOpenInvoices={() => setActiveTemplate("invoices")}
        onOpenVendors={() => setActiveTemplate("subcontractors")}
      />

      {renderTeamKpiOverview()}

      <Section title="My workspace" subtitle={dashboardWorkspace.focus}>
        <div className="dashboardQuickActions">
          {dashboardWorkspace.actions.map((actionKey) => {
            const action = dashboardActionDefinitions[actionKey];
            if (!action) return null;
            return (
              <button type="button" className={`templateCard ${actionKey === "collectLead" ? "collectLeadCard" : ""}`} key={actionKey} onClick={action.open}>
                <span className="eyebrow">{action.eyebrow}</span>
                <strong>{action.title}</strong>
                <p>{action.description}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {isFinanceUser ? <Section
        title="Management tools"
        subtitle="Specialist administration, analytics, and finance tools."
        right={(
          <button type="button" className="secondaryButton" aria-expanded={dashboardToolsOpen} onClick={() => setDashboardToolsOpen((current) => !current)}>
            {dashboardToolsOpen ? "Minimize" : "Show tools"}
          </button>
        )}
      >
        {dashboardToolsOpen ? <div className="workflowGroups">
          <div className="workflowGroupCard">
            <div className="workflowGroupHeader">
              <h3>Field & project workflows</h3>
              <p>Inspection, operations, proposals, templates, and job history in one place.</p>
            </div>
            <div className="workflowGroupGrid">
              {!isProjectManager ? (
                <button type="button" className="templateCard" onClick={() => setActiveTemplate("fieldNotes")}>
                  <span className="eyebrow">Inspection</span>
                  <strong>Field Notes / Roof Inspection</strong>
                  <p>Capture the roof details before bidding.</p>
                </button>
              ) : null}
              <button type="button" className="templateCard" onClick={() => setActiveTemplate("fieldOperations")}>
                <span className="eyebrow">Operations</span>
                <strong>Field Operations</strong>
                <p>Daily job logs and office review for field crews.</p>
              </button>
              {!isProjectManager ? (
                <>
                  <button type="button" className="templateCard" onClick={() => setActiveTemplate("proposalRequests")}>
                    <span className="eyebrow">Sales</span>
                    <strong>Proposal Requests</strong>
                    <p>Submit estimating requests and track Word/PDF proposal documents.</p>
                  </button>
                  <button type="button" className="templateCard" onClick={() => setActiveTemplate("estimateTemplates")}>
                    <span className="eyebrow">Templates</span>
                    <strong>Estimate Templates</strong>
                    <p>Open roofing, coating, repair, and maintenance estimates.</p>
                  </button>
                  <button type="button" className="templateCard" onClick={() => setActiveTemplate("jobMetrics")}>
                    <span className="eyebrow">Tracking</span>
                    <strong>Completed Job Metrics</strong>
                    <p>Track actual vs estimated costs and results.</p>
                  </button>
                  <button type="button" className="templateCard" onClick={() => setActiveTemplate("approvedJobs")}>
                    <span className="eyebrow">Jobs</span>
                    <strong>Approved Jobs</strong>
                    <p>Manage job status, daily logs, and progress tracking.</p>
                  </button>
                  <button type="button" className="templateCard" onClick={() => setActiveTemplate("pastJobInsights")}>
                    <span className="eyebrow">Analytics</span>
                    <strong>Past Job Insights</strong>
                    <p>View performance analytics from completed jobs.</p>
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="workflowGroupCard">
            <div className="workflowGroupHeader">
              <h3>Administration & finance</h3>
              <p>Office setup and the executive financial overview in one spot.</p>
            </div>
            <div className="workflowGroupGrid">
              {canManageEmployeeWages ? (
                <button type="button" className="templateCard" onClick={() => setActiveTemplate("administration")}>
                  <span className="eyebrow">Payroll</span>
                  <strong>Administration</strong>
                  <p>Manage employees, wages, and company setup.</p>
                </button>
              ) : null}
              {canAccessCfoDashboard ? (
                <button type="button" className="templateCard" onClick={() => setActiveTemplate("cfoDashboard")}>
                  <span className="eyebrow">Finance</span>
                  <strong>CFO Dashboard</strong>
                  <p>Executive financial overview for CRT Roofing.</p>
                </button>
              ) : null}
              <button type="button" className="templateCard" onClick={() => setActiveTemplate("activeJobs")}>
                <span className="eyebrow">Projects</span>
                <strong>Active Jobs</strong>
                <p>
                  <span className={`dashboardStatusDot ${activeJobsSummary.activeCount ? "active" : ""}`} aria-hidden="true" />
                  {activeJobsSummary.activeCount ? `${activeJobsSummary.activeCount} active projects` : "No active projects"}
                </p>
              </button>
            </div>
          </div>
        </div> : (
          <p className="emptyState">Specialist tools are tucked away here to keep the dashboard focused.</p>
        )}
      </Section> : null}

      {jobsSyncStatus === "loading" || jobsSyncStatus === "refreshing" || jobsSyncStatus === "reconnecting" || jobsSyncStatus === "offline" || jobsSyncStatus === "error" ? (
        <div className="summaryCard" style={{ marginBottom: 16 }}>
          <strong>
            {jobsSyncStatus === "offline"
              ? "Shared jobs are offline"
              : jobsSyncStatus === "reconnecting"
                ? "Reconnecting shared jobs"
                : jobsSyncStatus === "error"
                  ? "Shared jobs sync error"
                  : "Syncing shared jobs"}
          </strong>
          <p style={{ marginBottom: 0, color: "var(--muted)" }}>
            {jobsSyncStatus === "error" ? (jobsSyncError || "Unable to reach the shared jobs service.") : "All authenticated users read the same live job records."}
          </p>
        </div>
      ) : null}

      {dashboardSections.activeJobs ? <Section title="Active jobs preview" subtitle="A quick look at open work and what starts next.">
        {activeJobsSummary.activeCount ? (
          <div className="savedList">
            {activeJobsSummary.upcoming.map((job) => {
              const previewDetails = getActiveJobPreviewDetails(job);
              return (
              <div className="savedCard activeJobPreviewCard" key={job.id}>
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                    <span className={`statusTag statusTag-${String(job.status || "draft").toLowerCase().replace(/\s+/g, "-")}`}>{job.status}</span>
                    <span className={`statusTag ${String(job.riskLevel || "").toLowerCase() === "critical" ? "statusTag-draft" : ""}`}>{job.riskLevel || "Normal"}</span>
                  </div>
                  <strong>{job.projectName || "Untitled project"}</strong>
                  {job.jobNumber ? <p className="activeJobPreviewNumber">Job {job.jobNumber}</p> : null}
                  <div className="activeJobPreviewDetails">
                    <div>
                      <span>Project address</span>
                      <strong>{previewDetails.address}</strong>
                    </div>
                    <div>
                      <span>Homeowner / customer</span>
                      <strong>{previewDetails.homeowner}</strong>
                    </div>
                    {!isProjectManager ? (
                      <div>
                        <span>Contract amount</span>
                        <strong>{money(previewDetails.contractAmount)}</strong>
                      </div>
                    ) : null}
                    <div>
                      <span>Foreman / superintendent</span>
                      <strong>{previewDetails.fieldLead}</strong>
                    </div>
                  </div>
                  <p className="activeJobPreviewSchedule">
                    Start {job.startDate || job.anticipatedStartDate || "TBD"} · Due {job.expectedCompletionDate || "TBD"}
                  </p>
                </div>
                <div className="savedActions">
                  <button type="button" className="secondaryButton" onClick={() => openActiveJobDetail(job.id)}>
                    Open
                  </button>
                  <button type="button" className="secondaryButton" onClick={() => openActiveJobIssueModal(job)}>
                    Report Issue
                  </button>
                  {canSubmitInvoiceHandoff ? (
                    <button type="button" className="primaryButton" onClick={() => openInvoiceHandoff(job)}>
                      Complete Job &amp; Send to Invoicing
                    </button>
                  ) : null}
                  {canManageSharedJobData ? (
                    <button type="button" className="secondaryButton" disabled={Boolean(activeJobMutationKey)} onClick={() => handleArchiveActiveJob(job)}>
                      {activeJobMutationKey === `archive:${job.id}` ? "Archiving…" : "Archive"}
                    </button>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <p className="emptyState">No active jobs yet.</p>
        )}

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Total active projects" value={num(activeJobsSummary.activeCount, 0)} />
          <DetailRow label="Critical risk projects" value={num(activeJobsSummary.criticalCount, 0)} />
          <DetailRow label="All tracked projects" value={num(activeJobsSummary.totalJobs, 0)} />
        </div>

        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("activeJobs")}>
            Open Active Jobs
          </button>
          {activeJobsSummary.activeCount > activeJobsSummary.upcoming.length ? (
            <span className="dashboardTabHint">
              Showing the next {activeJobsSummary.upcoming.length} of {activeJobsSummary.activeCount} active jobs.
            </span>
          ) : null}
        </div>
      </Section> : null}

      {dashboardSections.completedJobs ? <Section
        title={`Past Completed Jobs (${pastCompletedJobs.length})`}
        subtitle="Completed job history retained with project details and recorded costs."
        right={(
          <button
            type="button"
            className="secondaryButton"
            aria-expanded={dashboardCompletedJobsOpen}
            onClick={() => setDashboardCompletedJobsOpen((current) => !current)}
          >
            {dashboardCompletedJobsOpen ? "Minimize" : "Show completed jobs"}
          </button>
        )}
      >
        {!dashboardCompletedJobsOpen ? (
          <p className="emptyState">Completed jobs are saved here and hidden from the daily workspace.</p>
        ) : pastCompletedJobs.length ? (
          <div className="savedList">
            {pastCompletedJobs.map((job) => {
              const previewDetails = getActiveJobPreviewDetails(job);
              return (
                <div className="savedCard activeJobPreviewCard" key={job.id}>
                  <div>
                    <span className="statusTag">Completed</span>
                    <strong>{job.projectName || "Untitled project"}</strong>
                    <p>
                      {job.jobNumber ? `Job ${job.jobNumber} · ` : ""}
                      {previewDetails.homeowner} · {previewDetails.address} · {money(previewDetails.contractAmount)}
                    </p>
                    <p className="smallNote">
                      Completed {job.completedAt ? new Date(job.completedAt).toLocaleString() : "date not recorded"}
                    </p>
                  </div>
                  <div className="savedActions">
                    <button type="button" className="secondaryButton" onClick={() => openApprovedJobDetail(job)}>
                      View Job History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="emptyState">No completed jobs yet.</p>
        )}
      </Section> : null}

      {dashboardSections.archivedJobs ? <Section
        title={`Archived jobs (${archivedJobs.length})`}
        subtitle="Saved jobs removed from the active preview. Restore a job whenever it becomes active again."
        right={(
          <button
            type="button"
            className="secondaryButton"
            aria-expanded={!archivedJobsCollapsed}
            onClick={() => setArchivedJobsCollapsed((value) => !value)}
          >
            {archivedJobsCollapsed ? "Expand" : "Minimize"}
          </button>
        )}
      >
        {archivedJobsCollapsed ? null : archivedJobs.length ? (
          <div className="savedList">
            {archivedJobs.map((job) => (
              <div className="savedCard" key={job.id}>
                <div>
                  <span className="statusTag">Archived</span>
                  <strong>{job.projectName || "Untitled project"}</strong>
                  <p>
                    {job.jobNumber ? `Job ${job.jobNumber} | ` : ""}
                    {job.customer || job.propertyOwner || "No customer"}
                    {job.archivedAt ? ` | Archived ${new Date(job.archivedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                {canManageSharedJobData ? (
                  <div className="savedActions">
                    <button type="button" className="secondaryButton" disabled={Boolean(activeJobMutationKey)} onClick={() => handleRestoreArchivedJob(job)}>
                      {activeJobMutationKey === `restore:${job.id}` ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="emptyState">No archived jobs yet.</p>
        )}
      </Section> : null}

      {dashboardSections.approvedJobs ? <Section
        title="Approved Jobs / Upcoming Projects"
        subtitle="Track approved work that is starting soon or still needs attention."
        right={
          <div className="actionRow" style={{ gap: 8, margin: 0 }}>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => setDashboardApprovedJobsCollapsed((value) => !value)}
            >
              {dashboardApprovedJobsCollapsed ? "Expand" : "Minimize"}
            </button>
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("approvedJobs")}>
              View All Approved Jobs
            </button>
          </div>
        }
      >
        {dashboardApprovedJobsCollapsed ? (
          <div className="summaryCard" style={{ marginTop: 0 }}>
            <span>Section minimized</span>
            <strong>{approvedJobsDashboardSummary.upcoming.length} upcoming projects hidden</strong>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>
              Click Expand to show the approved jobs preview again.
            </p>
          </div>
        ) : (
          renderApprovedJobsTableSection({
            title: "Approved Jobs / Upcoming Projects",
            subtitle: "The next approved projects to keep an eye on.",
            jobs: approvedJobsDashboardSummary.upcoming,
            showViewAllButton: true,
            onViewAll: () => setActiveTemplate("approvedJobs"),
            limit: 8,
          })
        )}
      </Section> : null}

      {dashboardSections.savedEstimates ? <Section title="Saved estimates" subtitle="Recent estimates in this browser.">
        <div className="dashboardTabBar">
          <button
            type="button"
            className={`dashboardTabButton ${dashboardSavedEstimatesOpen ? "active" : ""}`}
            onClick={() => setDashboardSavedEstimatesOpen((current) => !current)}
          >
            Saved estimates {dashboardSavedEstimatesOpen ? "▲" : "▼"}
          </button>
          <span className="dashboardTabHint">
            Browse, search, load, approve, or delete estimates.
          </span>
        </div>

        {dashboardSavedEstimatesOpen ? (
          <>
            <div className="formGrid" style={{ marginBottom: 12 }}>
              <Field label="Search saved estimates">
                <input
                  type="search"
                  value={dashboardSavedEstimateSearch}
                  onChange={(e) => setDashboardSavedEstimateSearch(e.target.value)}
                  placeholder="Search by estimate, job, customer, or address"
                />
              </Field>
            </div>

            <div className="savedList">
              {filteredDashboardSavedEstimates.length ? (
                filteredDashboardSavedEstimates.map((estimate) => (
                  <div className="savedCard" key={estimate.id}>
                    <div>
                      <span className="eyebrow">{estimate.estimateCode || estimateCode(estimate.estimateNumber || 1)}</span>
                      <strong>{estimate.name || "Untitled estimate"}</strong>
                      <p>
                        {estimate.estimateType ? `${estimate.estimateType} | ` : ""}
                        {estimate.inputs?.jobName ? `${estimate.inputs.jobName} | ` : ""}
                        {estimate.inputs?.customerName ? `${estimate.inputs.customerName} | ` : ""}
                        {num(estimate.summary?.totalSquares ?? estimate.inputs?.totalSquares ?? 0, 0)} SQ |{" "}
                        {money(estimate.summary?.selectedBidAmount ?? 0)} bid |{" "}
                        {num(estimate.summary?.selectedMarkupPercent ?? 0, 0)}% markup
                      </p>
                      {isAdminUser ? (
                        <p>Owner: {estimate.ownerDisplayName || estimate.ownerEmail || estimate.ownerId || "Unassigned"}</p>
                      ) : null}
                    </div>

                  <div className="savedActions">
                    <button type="button" className="secondaryButton" onClick={() => handleConvertEstimateToProposal(estimate)}>
                      Generate Proposal
                    </button>
                    <button type="button" className="secondaryButton" onClick={() => handleLoadEstimate(estimate)}>
                      Load
                    </button>
                      <button type="button" className="secondaryButton" onClick={() => handleApproveJob(estimate)}>
                        Approve Job
                      </button>
                      {isAdminUser ? (
                        <>
                          <select
                            value={estimateOwnerAssignments[estimate.id] || estimate.ownerId || ""}
                            onChange={(e) => handleEstimateOwnerSelection(estimate.id, e.target.value)}
                          >
                            <option value="">Select owner</option>
                            {companyUserProfiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {(profile.full_name || profile.email || profile.id)} ({normalizeAppRole(profile.role)})
                              </option>
                            ))}
                          </select>
                          <button type="button" className="secondaryButton" onClick={() => handleReassignEstimateOwner(estimate)}>
                            Reassign
                          </button>
                        </>
                      ) : null}
                      <button type="button" className="dangerButton" onClick={() => handleDeleteEstimate(estimate)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">
                  {dashboardSavedEstimateSearch.trim()
                    ? "No saved estimates match your search."
                    : "No saved estimates yet."}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="emptyState">Tap Saved estimates to open the list.</p>
        )}
      </Section> : null}
      {renderActiveJobIssueModal()}
      {renderInvoiceHandoffModal()}
    </div>
    );
  }

  const renderActiveJobIssueModal = () => {
    if (!activeJobIssueModalOpen) return null;
    const project = activeJobs.find((job) => job.id === (activeJobIssueDraft.projectId || activeJobSelectedId)) || selectedActiveJob || null;
    const employeeOptions = [
      { value: "", label: "Select employee" },
      ...employeeDirectory
        .filter((employee) => employee.isActive)
        .map((employee) => ({
          value: employee.id,
          label: [
            employee.displayName || [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "Unnamed employee",
            employee.employeeNumber ? `ID ${employee.employeeNumber}` : "",
            employee.department || "",
          ]
            .filter(Boolean)
            .join(" • "),
        })),
    ];

    return (
      <div className="activeJobOverlay" role="presentation" onClick={closeActiveJobIssueModal}>
        <div className="activeJobPanel" role="dialog" aria-modal="true" aria-labelledby="active-job-issue-title" onClick={(e) => e.stopPropagation()}>
          <div className="cfoDetailHeader">
            <div>
              <p className="eyebrow">Active Jobs</p>
              <h2 id="active-job-issue-title">{activeJobIssueDraft.expectedUpdatedAt ? "Update Issue" : "Report Issue"}</h2>
              <p>{project ? `${project.projectName || "Project"} · Job ${project.jobNumber || "—"}` : "Select a project first."}</p>
              <div className="cfoDetailMeta">
                <span className="cfoDetailChip">Assigned owner required</span>
                <span className="cfoDetailChip">Critical: response within 1 hour</span>
                <span className="cfoDetailChip">Office notifications queued on save</span>
              </div>
            </div>
            <div className="actionRow">
              <button type="button" className="secondaryButton" disabled={activeJobIssueSaving} onClick={closeActiveJobIssueModal}>
                Cancel
              </button>
              <button type="button" className="primaryButton" disabled={activeJobIssueSaving} onClick={() => void saveActiveJobIssue()}>
                {activeJobIssueSaving ? "Saving issue…" : "Save issue"}
              </button>
            </div>
          </div>

          <div className="activeJobModalGrid">
            <Field label="Job number">
              <input type="text" value={activeJobIssueDraft.jobNumber || project?.jobNumber || ""} disabled />
            </Field>
            <Field label="Project name">
              <input type="text" value={activeJobIssueDraft.projectName || project?.projectName || ""} disabled />
            </Field>
            <Field label="Date / time">
              <input
                type="datetime-local"
                value={activeJobIssueDraft.dateTime}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, dateTime: e.target.value }))}
              />
            </Field>
            <Field label="Caller name">
              <input
                type="text"
                value={activeJobIssueDraft.callerName}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, callerName: e.target.value }))}
                placeholder="Person reporting"
              />
            </Field>
            <Field label="Caller company">
              <input
                type="text"
                value={activeJobIssueDraft.callerCompany}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, callerCompany: e.target.value }))}
                placeholder="Company or customer"
              />
            </Field>
            <Field label="Phone">
              <input
                type="text"
                value={activeJobIssueDraft.phone}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, phone: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={activeJobIssueDraft.email}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, email: e.target.value }))}
              />
            </Field>
            <Field label="Issue category">
              <select
                value={activeJobIssueDraft.issueCategory}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, issueCategory: e.target.value }))}
              >
                {ACTIVE_JOB_ISSUE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={activeJobIssueDraft.priority}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, priority: e.target.value }))}
              >
                {ACTIVE_JOB_ISSUE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={activeJobIssueDraft.currentStatus}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, currentStatus: e.target.value }))}
              >
                {ACTIVE_JOB_ISSUE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </Field>
            <Field label="Assign to employee">
              <select
                value={activeJobIssueDraft.assignedEmployeeId}
                onChange={(e) => {
                  const assignedEmployee = employeeDirectory.find((employee) => employee.id === e.target.value) || null;
                  setActiveJobIssueDraft((current) => ({
                    ...current,
                    assignedEmployeeId: e.target.value,
                    assignedEmployeeName:
                      assignedEmployee?.displayName ||
                      [assignedEmployee?.firstName, assignedEmployee?.lastName].filter(Boolean).join(" ").trim() ||
                      "",
                  }));
                }}
              >
                {employeeOptions.map((option) => (
                  <option key={option.value || "blank"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Follow-up deadline">
              <input
                type="datetime-local"
                value={activeJobIssueDraft.followUpDeadline}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, followUpDeadline: e.target.value }))}
              />
            </Field>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Description">
              <textarea
                rows="4"
                value={activeJobIssueDraft.description}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, description: e.target.value }))}
                placeholder="Describe what happened or what needs attention."
              />
            </Field>
            <Field label="Office response / suggested copy">
              <textarea
                rows="4"
                value={activeJobIssueResponse}
                onChange={(e) => setActiveJobIssueResponse(e.target.value)}
                placeholder="Suggested response for customer or team follow-up."
              />
              <div className="actionRow" style={{ marginTop: 8 }}>
                <button type="button" className="secondaryButton" onClick={() => setActiveJobIssueResponse(buildActiveJobSuggestedResponse(project))}>
                  Use suggested response
                </button>
              </div>
            </Field>
          </div>

          {["Resolved", "Closed"].includes(activeJobIssueDraft.currentStatus) ? <div className="formGrid">
            <Field label="Resolution / completed correction"><textarea rows={4} value={activeJobIssueDraft.resolutionNote || ""} onChange={e => setActiveJobIssueDraft(current => ({...current,resolutionNote:e.target.value}))} /></Field>
            <label><input type="checkbox" checked={Boolean(activeJobIssueDraft.resolutionConfirmed)} onChange={e => setActiveJobIssueDraft(current => ({...current,resolutionConfirmed:e.target.checked}))} /> I confirm this issue has been resolved.</label>
          </div> : null}
          <details><summary>Audit history ({activeJobIssueHistory.length})</summary>
            {activeJobIssueHistoryError ? <p role="alert">{activeJobIssueHistoryError}</p> : null}
            {!activeJobIssueHistory.length ? <p>No audited changes recorded. Existing historical issue data is preserved; audit tracking starts with this update.</p> : null}
            {activeJobIssueHistory.map(event => <article key={event.id}><strong>{event.action} · {new Date(event.created_at).toLocaleString()}</strong><p>Actor: {event.actor_id}</p><p>{event.after_issue.status} · {event.after_issue.assignedEmployeeName} · {event.after_issue.followUpDeadline}</p><p>{event.after_issue.resolutionNote || event.after_issue.reason}</p><details><summary>Full before / after record</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify({before:event.before_issue,after:event.after_issue},null,2)}</pre></details></article>)}
          </details>
          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Escalation / correction reason">
              <textarea
                rows="3"
                value={activeJobIssueDraft.reason}
                onChange={(e) => setActiveJobIssueDraft((current) => ({ ...current, reason: e.target.value }))}
                placeholder="Optional internal reason for correction or escalation."
              />
            </Field>
            <div className="summaryCard">
              <span>Workflow notes</span>
              <p style={{ margin: 0 }}>
                Changes are audited. Jorge, Natalia, and the owner receive queued notifications. Critical issues require a response within one hour. Unsaved drafts stay on this device; failed saves can be retried.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInvoiceHandoffModal = () => {
    if (!invoiceHandoffJob || !invoiceHandoffDraft) return null;
    const totalSalePrice = Number(invoiceHandoffDraft.contractAmount || 0) + Number(invoiceHandoffDraft.changeOrders || 0);
    return (
      <div className="activeJobOverlay" role="presentation" onClick={closeInvoiceHandoff}>
        <div className="activeJobPanel" role="dialog" aria-modal="true" aria-labelledby="invoice-handoff-title" onClick={(event) => event.stopPropagation()}>
          <div className="cfoDetailHeader">
            <div>
              <p className="eyebrow">Active Jobs → Accounting</p>
              <h2 id="invoice-handoff-title">Complete Job &amp; Send to Invoicing</h2>
              <p>{invoiceHandoffJob.projectName || invoiceHandoffJob.jobNumber || "Active job"}</p>
            </div>
            <button type="button" className="secondaryButton" disabled={invoiceHandoffSaving} onClick={closeInvoiceHandoff}>Cancel</button>
          </div>
          {invoiceHandoffError ? <div className="errorBanner">{invoiceHandoffError}</div> : null}
          <div className="formGrid">
            <Field label="Completion date"><input type="date" value={invoiceHandoffDraft.completionDate} onChange={(event) => updateInvoiceHandoffDraft("completionDate", event.target.value)} /></Field>
            <Field label="Invoice type"><select value={invoiceHandoffDraft.invoiceType} onChange={(event) => updateInvoiceHandoffDraft("invoiceType", event.target.value)}><option>Final</option><option>Progress</option></select></Field>
            <Field label="Customer name"><input value={invoiceHandoffDraft.customerName} onChange={(event) => updateInvoiceHandoffDraft("customerName", event.target.value)} /></Field>
            <Field label="Billing contact"><input value={invoiceHandoffDraft.billingContactName} onChange={(event) => updateInvoiceHandoffDraft("billingContactName", event.target.value)} /></Field>
            <Field label="Billing email"><input type="email" value={invoiceHandoffDraft.billingEmail} onChange={(event) => updateInvoiceHandoffDraft("billingEmail", event.target.value)} /></Field>
            <Field label="Billing address"><input value={invoiceHandoffDraft.billingAddress} onChange={(event) => updateInvoiceHandoffDraft("billingAddress", event.target.value)} /></Field>
            <Field label="PO / customer reference"><input value={invoiceHandoffDraft.purchaseOrderNumber} onChange={(event) => updateInvoiceHandoffDraft("purchaseOrderNumber", event.target.value)} /></Field>
            <Field label="Payment terms"><input value={invoiceHandoffDraft.paymentTerms} onChange={(event) => updateInvoiceHandoffDraft("paymentTerms", event.target.value)} /></Field>
            <Field label="Contract amount"><input type="number" min="0" step="0.01" value={invoiceHandoffDraft.contractAmount} onChange={(event) => updateInvoiceHandoffDraft("contractAmount", event.target.value)} /></Field>
            <Field label="Approved change orders"><input type="number" min="0" step="0.01" value={invoiceHandoffDraft.changeOrders} onChange={(event) => updateInvoiceHandoffDraft("changeOrders", event.target.value)} /></Field>
            <Field label="Amount already billed"><input type="number" min="0" step="0.01" value={invoiceHandoffDraft.amountAlreadyBilled} onChange={(event) => updateInvoiceHandoffDraft("amountAlreadyBilled", event.target.value)} /></Field>
            <Field label="Amount to invoice"><input type="number" min="0.01" step="0.01" value={invoiceHandoffDraft.amountToInvoice} onChange={(event) => updateInvoiceHandoffDraft("amountToInvoice", event.target.value)} /></Field>
            <Field label="Retainage"><input type="number" min="0" step="0.01" value={invoiceHandoffDraft.retainageAmount} onChange={(event) => updateInvoiceHandoffDraft("retainageAmount", event.target.value)} /></Field>
            <Field label="Handoff notes"><textarea rows="3" value={invoiceHandoffDraft.notes} onChange={(event) => updateInvoiceHandoffDraft("notes", event.target.value)} /></Field>
          </div>
          <div className="summaryGrid" style={{ marginTop: 14 }}>
            <div className="summaryCard"><span>Total sale price</span><strong>{money2(totalSalePrice)}</strong></div>
            <div className="summaryCard"><span>Amount requested</span><strong>{money2(invoiceHandoffDraft.amountToInvoice)}</strong></div>
          </div>
          <p className="smallNote">Submitting closes the operational job, places it in Past Completed Jobs, creates Natalia's invoice request, and records the handoff in the audit trail.</p>
          <div className="actionRow">
            <button type="button" className="primaryButton" disabled={invoiceHandoffSaving} onClick={submitInvoiceHandoff}>{invoiceHandoffSaving ? "Sending…" : "Close Job & Send to Natalia"}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderActiveJobsScreen = () => <ActiveJobsWorkspace workspace={{ ACTIVE_JOB_RISK_LEVELS, ACTIVE_JOB_STATUS_OPTIONS, DetailRow, Field, LOGO_SRC, Section, activeJobMutationKey, activeJobs, activeJobsFilters, activeJobsSearch, activeJobsSummary, archivedJobs, archivedJobsCollapsed, authUser, canManageSharedJobData, canSubmitInvoiceHandoff, css, filteredActiveJobs, getAccountTitle, getActiveJobOpenIssuesCount, handleArchiveActiveJob, handleRestoreArchivedJob, isActiveJobStatus, jobsSyncError, jobsSyncStatus, num, openActiveJobDetail, openActiveJobIssueModal, openInvoiceHandoff, renderActiveJobIssueModal, renderInvoiceHandoffModal, selectedActiveJob, setActiveJobsFilters, setActiveJobsSearch, setActiveTemplate, setArchivedJobsCollapsed, updateActiveJobsFilter }} />;

  const renderActiveJobScreen = () => <ActiveJobWorkspace workspace={{ ACTIVE_JOB_RISK_LEVELS, ACTIVE_JOB_STATUS_OPTIONS, DetailRow, Field, LOGO_SRC, Section, activeJobEditDraft, activeJobEditMode, activeJobMutationKey, activeJobs, authUser, canManageActiveJobData, canSubmitInvoiceHandoff, canUpdateDailyJobCostData, css, filteredActiveJobs, getAccountTitle, getActiveJobOpenIssuesCount, handleActiveJobEditFieldChange, handleCancelActiveJobEdit, handleNumberInputWheel, handleSaveActiveJobEdit, handleStartActiveJobEdit, isProjectManager, money2, num, openActiveJobIssueModal, openApprovedJobDetail, openInvoiceHandoff, renderActiveJobIssueModal, renderInvoiceHandoffModal, selectedActiveJob, setActiveTemplate, toNumber }} />;

  const renderFieldOperationsScreen = () => <FieldOperationsWorkspace workspace={{ fieldLogsLoading, fieldLogsError, refreshFieldLogs: () => setFieldLogsRefresh(value => value + 1), isFinanceUser, discardPendingFieldUpload, fieldUploadBusy, pendingFieldUploads, retryFieldUploads, fieldDailyLogSaving, DetailRow, FIELD_DAILY_LOG_HIGH_MILEAGE_THRESHOLD, FIELD_DAILY_LOG_PHOTO_CATEGORIES, Field, LOGO_SRC, Section, activeEmployeeDrivers, activeFieldOperationEmployees, activeFieldOperationForemen, authUser, calculateFieldDailyLogTotals, calculateHoursBetweenTimes, css, fieldDailyLogDraft, fieldDailyLogFilters, fieldDailyLogHasProgressOrCompletedPhoto, fieldDailyLogReviewSearch, fieldDailyLogSelectedId, fieldDailyLogSelectedLog, fieldOperationCompanyVehicles, fieldOperationsTab, filteredFieldDailyLogs, getAccountTitle, handleAddFieldDailyLogCrewRow, handleAddFieldDailyLogFuelReceiptRow, handleAddFieldDailyLogVehicleRow, handleExportPayrollCsv, handleFieldDailyLogCrewRowChange, handleFieldDailyLogFieldChange, handleFieldDailyLogFilterChange, handleFieldDailyLogFuelReceiptPhotoUpload, handleFieldDailyLogFuelReceiptRowChange, handleFieldDailyLogPhotoUpload, handleFieldDailyLogVehicleRowChange, handleNumberInputWheel, handleRemoveFieldDailyLogCrewRow, handleRemoveFieldDailyLogFuelReceiptRow, handleRemoveFieldDailyLogPhoto, handleRemoveFieldDailyLogVehicleRow, handleRemoveFuelReceiptPhoto, handleSaveFieldDailyLogDraft, handleSubmitDailyLog, money2, num, requestPhotoAccessAndOpenPicker, round, setActiveTemplate, setFieldDailyLogReviewSearch, setFieldDailyLogSelectedId, setFieldOperationsTab, toNumber, totalFuelPurchasedAmount }} />;

  const renderCfoDashboardScreen = () => <CfoDashboardWorkspace workspace={{ DetailRow, Field, LOGO_SRC, Section, authUser, buildCfoApprovedJobSharedJob, buildCfoSourceRecordUid, calculateReceivablePaymentTotals, calculateSupplierPaymentTotals, cfoApprovedJobsLedger, cfoDashboardFilters, cfoLastSyncedRef, cfoLiquidCashDraft, cfoLiquidCashEditingId, cfoLiquidCashEntries, cfoManualDraftsByCard, cfoManualEditingByCard, cfoManualEntriesByCard, cfoPaymentDiscussionError, cfoPaymentDiscussionOpeningId, cfoReceivableDraft, cfoReceivableEditingId, cfoReceivableEntries, cfoReceivablePaymentMessage, cfoReceivablePaymentMessageType, cfoReceivablePaymentSavingId, cfoSupplierPaymentDraft, cfoSupplierPaymentEntry, cfoSupplierPaymentMessage, cfoSupplierPaymentSavingId, cfoSyncError, cfoSyncStatus, createBlankCfoLiquidCashEntry, createBlankCfoManualEntry, createBlankCfoReceivableEntry, createBlankSupplierPaymentDraft, createFieldDailyLogId, css, estimatorSettingsSyncStatus, filterReceivablesByPaymentView, filterSupplierPayablesByPaymentView, flattenCfoNonLiquidCashRecords, formatCfoRecordUpdatedAt, getAccountTitle, getReceivablePaymentStatus, getRevealSecondsRemaining, getSupplierPaymentStatus, handleNumberInputWheel, invokeLiquidCashFunction, liquidCashAccess, liquidCashCode, liquidCashSaving, money, money2, normalizeCfoLiquidCashEntry, normalizeCfoManualEntry, normalizeCfoReceivableEntry, num, openApprovedJobDetail, selectedCfoCard, setActiveTemplate, setCfoDashboardFilters, setCfoDeletedSourceRecordUids, setCfoLiquidCashDraft, setCfoLiquidCashEditingId, setCfoLiquidCashEntries, setCfoManualDraftsByCard, setCfoManualEditingByCard, setCfoManualEntriesByCard, setCfoPaymentDiscussionError, setCfoPaymentDiscussionOpeningId, setCfoReceivableDraft, setCfoReceivableEditingId, setCfoReceivableEntries, setCfoReceivablePaymentMessage, setCfoReceivablePaymentMessageType, setCfoReceivablePaymentSavingId, setCfoSupplierPaymentDraft, setCfoSupplierPaymentEntry, setCfoSupplierPaymentMessage, setCfoSupplierPaymentSavingId, setCfoSyncError, setCfoSyncStatus, setCompletedJobs, setLiquidCashAccess, setLiquidCashCode, setLiquidCashSaving, setSelectedCfoCard, setSessionMessage, setSessionMessageType, setSupplierPaymentHistory, setWorkHubInitialCreateTask, setWorkHubInitialTaskId, splitSharedJobsByWorkflow, supabase, supplierPaymentHistory, toNumber, upsertCompanyFinancialRecordsToSupabase, upsertSharedJobToSupabase }} />;

  function getApprovedJobStartDateLabel(job) {
    return String(job?.anticipatedStartDate || "").trim() || "Start Date Needed";
  }

  function getApprovedJobDaysUntilStart(job) {
    if (!String(job?.anticipatedStartDate || "").trim()) return null;
    const start = new Date(job.anticipatedStartDate);
    if (Number.isNaN(start.getTime())) return null;
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const startUtc = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    return Math.round((startUtc.getTime() - todayUtc.getTime()) / 86400000);
  }

  function isApprovedJobStartingSoon(job) {
    const days = getApprovedJobDaysUntilStart(job);
    return days != null && days >= 0 && days <= 14;
  }

  function hasApprovedJobWarnings(job) {
    return Boolean(
      job?.warningText ||
        job?.documentsIncomplete ||
        job?.subcontractorIncomplete ||
        job?.materialOrderIncomplete ||
        job?.customerDocumentIncomplete,
    );
  }

  function renderApprovedJobsTableSection({ title, subtitle, jobs, showViewAllButton = false, onViewAll = null, limit = null }) {
    const visibleJobs = limit ? jobs.slice(0, limit) : jobs;
    const startingSoonCount = jobs.filter((job) => isApprovedJobStartingSoon(job)).length;
    const warningCount = jobs.filter((job) => hasApprovedJobWarnings(job)).length;

    return (
      <Section title={title} subtitle={subtitle}>
        <div className="formGrid" style={{ marginBottom: 12 }}>
          <Field label="Search approved jobs">
            <input
              type="search"
              value={approvedJobsSearch}
              onChange={(e) => updateApprovedJobsFilter("search", e.target.value)}
              placeholder="Search customer, address, contact, or status"
            />
          </Field>
          <Field label="Customer">
            <input
              type="text"
              value={approvedJobsFilters.customer}
              onChange={(e) => updateApprovedJobsFilter("customer", e.target.value)}
              placeholder="Filter customer"
            />
          </Field>
          <Field label="Project address">
            <input
              type="text"
              value={approvedJobsFilters.address}
              onChange={(e) => updateApprovedJobsFilter("address", e.target.value)}
              placeholder="Filter address"
            />
          </Field>
          <Field label="Project status">
            <select value={approvedJobsFilters.status} onChange={(e) => updateApprovedJobsFilter("status", e.target.value)}>
              <option value="all">All statuses</option>
              {APPROVED_JOB_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned project contact">
            <input
              type="text"
              value={approvedJobsFilters.contact}
              onChange={(e) => updateApprovedJobsFilter("contact", e.target.value)}
              placeholder="Filter contact"
            />
          </Field>
          <Field label="Anticipated start date">
            <input
              type="date"
              value={approvedJobsFilters.startDate}
              onChange={(e) => updateApprovedJobsFilter("startDate", e.target.value)}
            />
          </Field>
          <Field label="Sort by">
            <select value={approvedJobsFilters.sortBy} onChange={(e) => updateApprovedJobsFilter("sortBy", e.target.value)}>
              <option value="startDate">Anticipated start date</option>
              <option value="customer">Customer</option>
              <option value="status">Project status</option>
              <option value="contact">Project contact</option>
            </select>
          </Field>
          <Field label="Sort order">
            <select value={approvedJobsFilters.sortDirection} onChange={(e) => updateApprovedJobsFilter("sortDirection", e.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </Field>
        </div>

        <div className="detailList" style={{ marginBottom: 14 }}>
          <DetailRow label="Visible jobs" value={num(visibleJobs.length, 0)} />
          <DetailRow label="Starting within 14 days" value={num(startingSoonCount, 0)} />
          <DetailRow label="Checklist warnings" value={num(warningCount, 0)} />
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Job / project</th>
                <th>Customer / location</th>
                <th>Contract amount</th>
                <th>Schedule</th>
                <th>Status / checklist</th>
                <th>Team / permit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.length ? (
                visibleJobs.map((job) => {
                  const startDays = getApprovedJobDaysUntilStart(job);
                  const startSoon = isApprovedJobStartingSoon(job);
                  const warnings = hasApprovedJobWarnings(job);
                  const rowTone = warnings ? "rgba(245, 158, 11, 0.08)" : startSoon ? "rgba(34, 197, 94, 0.08)" : "transparent";
                  return (
                    <tr
                      key={job.id}
                      style={{ cursor: "pointer", background: rowTone }}
                      onClick={() => openApprovedJobDetail(job)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openApprovedJobDetail(job);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open approved job ${job.jobNumber || job.projectName || "record"}`}
                    >
                      <td>
                        <strong>{job.jobNumber || "—"}</strong>
                        <div className="smallNote">{job.projectName || "Untitled project"}</div>
                      </td>
                      <td>
                        <strong>{job.customerName || job.customer || "—"}</strong>
                        <div className="smallNote">{job.projectAddress || job.jobAddress || "No address"}</div>
                      </td>
                      <td>{money(job.contractAmount || 0)}</td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span>Approved: {job.approvalDate || "—"}</span>
                          <span>Starts: {getApprovedJobStartDateLabel(job)}</span>
                          {startDays != null && startDays >= 0 ? (
                            <span className="smallNote">{startDays === 0 ? "Starts today" : `${startDays} day${startDays === 1 ? "" : "s"} away`}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span className={`statusTag statusTag-${String(job.projectStatus || job.status || "approved").toLowerCase().replace(/\s+/g, "-")}`}>
                            {job.projectStatus || job.status || "Approved"}
                          </span>
                          {warnings ? (
                            <span className="smallNote" style={{ color: "var(--danger)" }}>
                              {job.warningText || "Checklist incomplete"}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span>Contact: {job.projectContact || "—"}</span>
                          <span>Supervisor: {job.fieldSupervisor || "—"}</span>
                          <span>Permit: {job.permitStatus || "—"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="savedActions">
                          <button
                            type="button"
                            className="secondaryButton"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApprovedJobDetail(job);
                            }}
                          >
                            Open
                          </button>
                          {canManageSharedJobData ? (
                            <>
                              <button
                                type="button"
                                className="primaryButton"
                                disabled={Boolean(activeJobMutationKey)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveApprovedJobToActive(job);
                                }}
                              >
                                {activeJobMutationKey === `activate:${job.id}` ? "Moving…" : "Move to Active Jobs"}
                              </button>
                              <button
                                type="button"
                                className="secondaryButton"
                                disabled={Boolean(activeJobMutationKey)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveActiveJob(job);
                                }}
                              >
                                {activeJobMutationKey === `archive:${job.id}` ? "Archiving…" : "Archive"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="cfoDetailEmpty">
                      <strong>No approved jobs match the current filters.</strong>
                      <p style={{ margin: "8px 0 0", color: "#a7c7d6" }}>
                        Adjust the search or filters to see more upcoming work.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showViewAllButton && onViewAll ? (
          <div className="actionRow" style={{ marginTop: 16 }}>
            <button type="button" className="secondaryButton" onClick={onViewAll}>
              View All Approved Jobs
            </button>
          </div>
        ) : null}
      </Section>
    );
  }

  function renderProposalBuilderScreen() {
    const selectedProposalVersionHistory = Array.isArray(proposalDraft?.proposalHistory) ? proposalDraft.proposalHistory : [];
    const currentProposalSelection = selectedProposal || proposalDraft;
    const proposalTemplateSectionOrderText = Array.isArray(proposalTemplateDraft?.sectionOrder)
      ? proposalTemplateDraft.sectionOrder.join(", ")
      : "";

    return (
      <div className="appShell">
        <style>{css}</style>
        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Sales Workflow</p>
                <h1>Proposal Builder</h1>
                <p className="intro">Turn saved estimates into customer-ready proposals without re-entering the scope.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
            <p>{getAccountTitle()}</p>
          </div>
        </header>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
            Back to dashboard
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setProposalDraft(createBlankProposal());
              setProposalSelectedId("");
              setSessionMessageType("success");
              setSessionMessage("Started a blank proposal.");
            }}
          >
            New proposal
          </button>
          <button type="button" className="primaryButton" onClick={() => saveProposalDraft()}>
            Save Draft
          </button>
          <button type="button" className="secondaryButton" onClick={handleSendProposal}>
            Send Proposal
          </button>
          <button type="button" className="secondaryButton" disabled title="Use Proposal Requests → Production Release after signed scope approval">
            Production release requires signed scope
          </button>
        </div>

        {sessionMessage ? (
          <div
            style={{
              margin: "0 0 16px 0",
              padding: 12,
              borderRadius: 4,
              backgroundColor: sessionMessageType === "success" ? "#e8f5e9" : "#ffebee",
              color: sessionMessageType === "success" ? "#2e7d32" : "#c62828",
            }}
          >
            {sessionMessage}
          </div>
        ) : null}

        <Section title="Proposal library" subtitle="Search and open proposals created from saved estimates.">
          <div className="formGrid" style={{ marginBottom: 12 }}>
            <Field label="Search proposals">
              <input
                type="search"
                value={proposalSearch}
                onChange={(e) => setProposalSearch(e.target.value)}
                placeholder="Search by customer, address, proposal number, or estimate code"
              />
            </Field>
            <Field label="Customer">
              <input type="text" value={proposalFilters.customer} onChange={(e) => updateProposalFilter("customer", e.target.value)} />
            </Field>
            <Field label="Project address">
              <input type="text" value={proposalFilters.address} onChange={(e) => updateProposalFilter("address", e.target.value)} />
            </Field>
            <Field label="Salesperson">
              <input type="text" value={proposalFilters.salesperson} onChange={(e) => updateProposalFilter("salesperson", e.target.value)} />
            </Field>
            <Field label="Proposal status">
              <select value={proposalFilters.status} onChange={(e) => updateProposalFilter("status", e.target.value)}>
                <option value="all">All statuses</option>
                {PROPOSAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort by">
              <select value={proposalFilters.sortBy} onChange={(e) => updateProposalFilter("sortBy", e.target.value)}>
                <option value="updatedAt">Updated</option>
                <option value="proposalNumber">Proposal number</option>
                <option value="customer">Customer</option>
                <option value="status">Status</option>
              </select>
            </Field>
            <Field label="Sort order">
              <select value={proposalFilters.sortDirection} onChange={(e) => updateProposalFilter("sortDirection", e.target.value)}>
                <option value="desc">Newest / highest first</option>
                <option value="asc">Oldest / lowest first</option>
              </select>
            </Field>
          </div>

          <div className="detailList" style={{ marginBottom: 14 }}>
            <DetailRow label="Proposal count" value={num(filteredProposals.length, 0)} />
            <DetailRow label="Selected proposal" value={currentProposalSelection?.proposalTitle || currentProposalSelection?.proposalNumber || "New proposal"} />
            <DetailRow label="Source estimate" value={currentProposalSelection?.sourceEstimateCode || currentProposalSelection?.estimateCode || "—"} />
          </div>

          <div className="savedList">
            {filteredProposals.length ? (
              filteredProposals.map((proposal) => (
                <div className="savedCard" key={proposal.id}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span className="eyebrow">Proposal #{num(proposal.proposalNumber || 0, 0)}</span>
                      <span className={`statusTag statusTag-${String(proposal.status || "draft").toLowerCase().replace(/\s+/g, "-")}`}>
                        {String(proposal.status || "Draft").toUpperCase()}
                      </span>
                    </div>
                    <strong>{proposal.proposalTitle || proposal.projectName || proposal.customerName || "Untitled proposal"}</strong>
                    <p>
                      {proposal.customerName ? `${proposal.customerName} | ` : ""}
                      {proposal.projectName ? `${proposal.projectName} | ` : ""}
                      {proposal.projectAddress ? `${proposal.projectAddress} | ` : ""}
                      {money(proposal.totalPrice || 0)} total | Version {num(proposal.version || 1, 0)}
                    </p>
                  </div>
                  <div className="savedActions">
                    <button type="button" className="secondaryButton" onClick={() => openProposalBuilder(proposal)}>
                      Open
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyState">No proposals yet. Convert a saved estimate to start one.</p>
            )}
          </div>
        </Section>

        <Section title="Proposal builder" subtitle="Edit the public-facing proposal and keep internal costs hidden from customers.">
          <div className="formGrid">
            <Field label="Proposal title">
              <input
                type="text"
                value={proposalDraft.proposalTitle}
                onChange={(e) => handleProposalDraftChange("proposalTitle", e.target.value)}
                placeholder="Customer-facing proposal title"
              />
            </Field>
            <Field label="Status">
              <select value={proposalDraft.status} onChange={(e) => handleProposalDraftChange("status", e.target.value)}>
                {PROPOSAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Proposal number">
              <input type="number" onWheel={handleNumberInputWheel} min="1" step="1" value={proposalDraft.proposalNumber} onChange={(e) => handleProposalDraftChange("proposalNumber", toNumber(e.target.value, 1))} />
            </Field>
            <Field label="Version">
              <input type="number" onWheel={handleNumberInputWheel} min="1" step="1" value={proposalDraft.version} onChange={(e) => handleProposalDraftChange("version", toNumber(e.target.value, 1))} />
            </Field>
            <Field label="Customer name">
              <input type="text" value={proposalDraft.customerName} onChange={(e) => handleProposalDraftChange("customerName", e.target.value)} />
            </Field>
            <Field label="Customer contact">
              <input type="text" value={proposalDraft.customerContact} onChange={(e) => handleProposalDraftChange("customerContact", e.target.value)} />
            </Field>
            <Field label="Project name">
              <input type="text" value={proposalDraft.projectName} onChange={(e) => handleProposalDraftChange("projectName", e.target.value)} />
            </Field>
            <Field label="Project address">
              <input type="text" value={proposalDraft.projectAddress} onChange={(e) => handleProposalDraftChange("projectAddress", e.target.value)} />
            </Field>
            <Field label="Estimate code">
              <input type="text" value={proposalDraft.estimateCode} onChange={(e) => handleProposalDraftChange("estimateCode", e.target.value)} />
            </Field>
            <Field label="Roof system">
              <input type="text" value={proposalDraft.roofSystem} onChange={(e) => handleProposalDraftChange("roofSystem", e.target.value)} />
            </Field>
            <Field label="Salesperson">
              <input type="text" value={proposalDraft.salesperson} onChange={(e) => handleProposalDraftChange("salesperson", e.target.value)} />
            </Field>
            <Field label="Total price">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={proposalDraft.totalPrice} onChange={(e) => handleProposalDraftChange("totalPrice", toNumber(e.target.value))} />
            </Field>
            <Field label="Estimate date">
              <input type="date" value={proposalDraft.estimateDate} onChange={(e) => handleProposalDraftChange("estimateDate", e.target.value)} />
            </Field>
            <Field label="Expiration date">
              <input type="date" value={proposalDraft.expirationDate} onChange={(e) => handleProposalDraftChange("expirationDate", e.target.value)} />
            </Field>
            <Field label="Approval required">
              <select
                value={proposalDraft.approvalRequired ? "yes" : "no"}
                onChange={(e) => handleProposalDraftChange("approvalRequired", e.target.value === "yes")}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Approval threshold">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={proposalDraft.approvalThreshold} onChange={(e) => handleProposalDraftChange("approvalThreshold", toNumber(e.target.value))} />
            </Field>
            <Field label="Approval review level">
              <input type="text" value={proposalDraft.approvalReviewLevel} onChange={(e) => handleProposalDraftChange("approvalReviewLevel", e.target.value)} />
            </Field>
            <Field label="Sent at">
              <input type="datetime-local" value={proposalDraft.sentAt ? String(proposalDraft.sentAt).slice(0, 16) : ""} onChange={(e) => handleProposalDraftChange("sentAt", e.target.value)} />
            </Field>
            <Field label="Sent by">
              <input type="text" value={proposalDraft.sentBy} onChange={(e) => handleProposalDraftChange("sentBy", e.target.value)} />
            </Field>
            <Field label="Send to">
              <input type="text" value={proposalDraft.sentTo} onChange={(e) => handleProposalDraftChange("sentTo", e.target.value)} />
            </Field>
            <Field label="CC recipients">
              <input type="text" value={proposalDraft.ccRecipients} onChange={(e) => handleProposalDraftChange("ccRecipients", e.target.value)} />
            </Field>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Message">
              <textarea rows="4" value={proposalDraft.message} onChange={(e) => handleProposalDraftChange("message", e.target.value)} />
            </Field>
            <Field label="Warranty">
              <textarea rows="4" value={proposalDraft.warranty} onChange={(e) => handleProposalDraftChange("warranty", e.target.value)} />
            </Field>
            <Field label="Payment schedule">
              <textarea rows="4" value={proposalDraft.paymentSchedule} onChange={(e) => handleProposalDraftChange("paymentSchedule", e.target.value)} />
            </Field>
            <Field label="Estimated schedule">
              <textarea rows="4" value={proposalDraft.estimatedSchedule} onChange={(e) => handleProposalDraftChange("estimatedSchedule", e.target.value)} />
            </Field>
            <Field label="Terms and conditions">
              <textarea rows="4" value={proposalDraft.termsAndConditions} onChange={(e) => handleProposalDraftChange("termsAndConditions", e.target.value)} />
            </Field>
            <Field label="Internal job notes">
              <textarea rows="4" value={proposalDraft.internalJobNotes} onChange={(e) => handleProposalDraftChange("internalJobNotes", e.target.value)} />
            </Field>
          </div>

          <div className="detailList" style={{ marginTop: 14 }}>
            <DetailRow label="Source estimate" value={proposalDraft.sourceEstimateCode || proposalDraft.estimateCode || "—"} />
            <DetailRow label="Version history entries" value={num(selectedProposalVersionHistory.length, 0)} />
            <DetailRow label="Customer acceptance" value={proposalDraft.customerAcceptance?.status || "Not recorded"} />
            <DetailRow label="Current total" value={money(proposalDraft.totalPrice || 0)} />
          </div>

          {proposalDraft.scopeItems?.length ? (
            <div className="detailList" style={{ marginTop: 14 }}>
              {proposalDraft.scopeItems.map((item) => (
                <DetailRow key={`${item.label}-${item.value}`} label={item.label} value={String(item.value)} />
              ))}
            </div>
          ) : null}
        </Section>

        <Section title="Alternates, exclusions, allowances, and taxes" subtitle="Carry over only the customer-facing items from the estimate.">
          <div className="formGrid">
            <Field label="Alternates">
              <textarea rows="4" value={(proposalDraft.alternates || []).join("\n")} onChange={(e) => handleProposalDraftChange("alternates", String(e.target.value || "").split("\n").filter(Boolean))} />
            </Field>
            <Field label="Exclusions">
              <textarea rows="4" value={(proposalDraft.exclusions || []).join("\n")} onChange={(e) => handleProposalDraftChange("exclusions", String(e.target.value || "").split("\n").filter(Boolean))} />
            </Field>
            <Field label="Allowances">
              <textarea rows="4" value={(proposalDraft.allowances || []).join("\n")} onChange={(e) => handleProposalDraftChange("allowances", String(e.target.value || "").split("\n").filter(Boolean))} />
            </Field>
            <Field label="Taxes">
              <textarea rows="4" value={(proposalDraft.taxes || []).join("\n")} onChange={(e) => handleProposalDraftChange("taxes", String(e.target.value || "").split("\n").filter(Boolean))} />
            </Field>
          </div>
        </Section>

        <Section title="Version history" subtitle="A simple audit trail for proposal updates and resends.">
          {selectedProposalVersionHistory.length ? (
            <div className="savedList">
              {selectedProposalVersionHistory.map((entry, index) => (
                <div className="savedCard" key={`${entry.status || "history"}-${index}`}>
                  <div>
                    <strong>{entry.status || "Update"}</strong>
                    <p>
                      {entry.updatedAt ? `Updated ${entry.updatedAt}` : "Updated time not recorded"}
                      {entry.supersededBy ? ` | Superseded by ${entry.supersededBy}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="emptyState">No proposal history yet.</p>
          )}
        </Section>

        <Section
          title="Template manager"
          subtitle="Edit the CRT proposal baseline from one central place. Newly generated proposals will use these defaults until finalized."
        >
          <div className="actionRow" style={{ marginBottom: 12 }}>
            <button type="button" className="primaryButton" onClick={saveProposalTemplateDraft}>
              Save template
            </button>
            <button type="button" className="secondaryButton" onClick={resetProposalTemplateDraft}>
              Reset to CRT baseline
            </button>
          </div>

          <div className="formGrid">
            <Field label="Template name">
              <input type="text" value={proposalTemplateDraft.templateName} onChange={(e) => handleProposalTemplateDraftChange("templateName", e.target.value)} />
            </Field>
            <Field label="Brand name">
              <input type="text" value={proposalTemplateDraft.brandName} onChange={(e) => handleProposalTemplateDraftChange("brandName", e.target.value)} />
            </Field>
            <Field label="Cover page title">
              <input type="text" value={proposalTemplateDraft.coverPageTitle} onChange={(e) => handleProposalTemplateDraftChange("coverPageTitle", e.target.value)} />
            </Field>
            <Field label="Cover page subtitle">
              <textarea rows="3" value={proposalTemplateDraft.coverPageSubtitle} onChange={(e) => handleProposalTemplateDraftChange("coverPageSubtitle", e.target.value)} />
            </Field>
            <Field label="Executive summary title">
              <input type="text" value={proposalTemplateDraft.executiveSummaryTitle} onChange={(e) => handleProposalTemplateDraftChange("executiveSummaryTitle", e.target.value)} />
            </Field>
            <Field label="Executive summary body">
              <textarea rows="4" value={proposalTemplateDraft.executiveSummaryBody} onChange={(e) => handleProposalTemplateDraftChange("executiveSummaryBody", e.target.value)} />
            </Field>
            <Field label="Scope of work title">
              <input type="text" value={proposalTemplateDraft.scopeOfWorkTitle} onChange={(e) => handleProposalTemplateDraftChange("scopeOfWorkTitle", e.target.value)} />
            </Field>
            <Field label="Scope of work intro">
              <textarea rows="3" value={proposalTemplateDraft.scopeOfWorkIntro} onChange={(e) => handleProposalTemplateDraftChange("scopeOfWorkIntro", e.target.value)} />
            </Field>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Photo title">
              <input type="text" value={proposalTemplateDraft.photoTitle} onChange={(e) => handleProposalTemplateDraftChange("photoTitle", e.target.value)} />
            </Field>
            <Field label="Upgrade options title">
              <input type="text" value={proposalTemplateDraft.upgradeOptionsTitle} onChange={(e) => handleProposalTemplateDraftChange("upgradeOptionsTitle", e.target.value)} />
            </Field>
            <Field label="Product information title">
              <input type="text" value={proposalTemplateDraft.productInformationTitle} onChange={(e) => handleProposalTemplateDraftChange("productInformationTitle", e.target.value)} />
            </Field>
            <Field label="Warranty comparison title">
              <input type="text" value={proposalTemplateDraft.warrantyComparisonTitle} onChange={(e) => handleProposalTemplateDraftChange("warrantyComparisonTitle", e.target.value)} />
            </Field>
            <Field label="Pricing title">
              <input type="text" value={proposalTemplateDraft.pricingTitle} onChange={(e) => handleProposalTemplateDraftChange("pricingTitle", e.target.value)} />
            </Field>
            <Field label="Signature title">
              <input type="text" value={proposalTemplateDraft.signatureTitle} onChange={(e) => handleProposalTemplateDraftChange("signatureTitle", e.target.value)} />
            </Field>
            <Field label="Legal title">
              <input type="text" value={proposalTemplateDraft.legalTitle} onChange={(e) => handleProposalTemplateDraftChange("legalTitle", e.target.value)} />
            </Field>
            <Field label="Payment terms title">
              <input type="text" value={proposalTemplateDraft.paymentTermsTitle} onChange={(e) => handleProposalTemplateDraftChange("paymentTermsTitle", e.target.value)} />
            </Field>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Payment terms">
              <textarea rows="4" value={proposalTemplateDraft.paymentTerms} onChange={(e) => handleProposalTemplateDraftChange("paymentTerms", e.target.value)} />
            </Field>
            <Field label="Contract language">
              <textarea rows="4" value={proposalTemplateDraft.contractLanguage} onChange={(e) => handleProposalTemplateDraftChange("contractLanguage", e.target.value)} />
            </Field>
            <Field label="Legal notice">
              <textarea rows="4" value={proposalTemplateDraft.legalNotice} onChange={(e) => handleProposalTemplateDraftChange("legalNotice", e.target.value)} />
            </Field>
            <Field label="Footer text">
              <textarea rows="4" value={proposalTemplateDraft.footerText} onChange={(e) => handleProposalTemplateDraftChange("footerText", e.target.value)} />
            </Field>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <Field label="Signature line label">
              <input type="text" value={proposalTemplateDraft.signatureLineLabel} onChange={(e) => handleProposalTemplateDraftChange("signatureLineLabel", e.target.value)} />
            </Field>
            <Field label="Signature date label">
              <input type="text" value={proposalTemplateDraft.signatureDateLabel} onChange={(e) => handleProposalTemplateDraftChange("signatureDateLabel", e.target.value)} />
            </Field>
            <Field label="Section order">
              <textarea
                rows="3"
                value={proposalTemplateSectionOrderText}
                onChange={(e) =>
                  handleProposalTemplateDraftChange(
                    "sectionOrder",
                    String(e.target.value || "")
                      .split(/[\n,]+/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="coverPage, executiveSummary, scopeOfWork, photos, upgradeOptions, productInformation, warrantyComparison, pricing, signature, legal"
              />
            </Field>
          </div>
        </Section>
      </div>
    );
  }

  const getAccountDisplayName = () => {
    const displayName = String(authUser?.displayName || "").trim();
    return displayName && !displayName.includes("@") ? displayName : String(authUser?.email || "Employee").split("@")[0];
  };

  const getAccountTitle = () => {
    const title = String(authUser?.title || "").trim();
    if (title && title !== "Sales") return title;
    if (authRole === "admin") return "Administration";
    if (authRole === "cfo") return "CFO";
    if (authRole === "estimator") return "Estimator / Technician / Sales";
    if (authRole === "project_manager") return "Project Manager / Production";
    return "Salesperson";
  };

  const getAccountInitials = () => {
    const words = getAccountDisplayName().split(/\s+/).filter(Boolean);
    if (!words.length) return "CR";
    return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
  };

  const navigateFromSidebar = (destination) => {
    if (destination === "workHub") {
      setWorkHubInitialTab("tasks");
      setWorkHubInitialTaskId("");
      setWorkHubInitialCreateTask(false);
    }
    setActiveTemplate(destination);
    setSidebarMobileOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProfilePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !authUser?.key || profilePhotoUploading) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(String(file.type || "").toLowerCase())) {
      setProfilePhotoMessageType("error");
      setProfilePhotoMessage("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      setProfilePhotoMessageType("error");
      setProfilePhotoMessage("Profile photos must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setProfilePhotoUploading(true);
    setProfilePhotoMessage("");
    setProfilePhotoMessageType("");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const uploadPath = `${authUser.key}/avatar-${Date.now()}.${extension}`;
    const previousPath = String(authUser.avatarPath || "");

    try {
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .upload(uploadPath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: updatedProfile, error: profileError } = await supabase
        .from("user_profiles")
        .update({ avatar_path: uploadPath, updated_at: new Date().toISOString() })
        .eq("id", authUser.key)
        .select("id, full_name, email, role, avatar_path")
        .maybeSingle();
      if (profileError) {
        await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([uploadPath]);
        throw profileError;
      }

      const avatarUrl = await createProfilePhotoSignedUrl(uploadPath);
      setAuthUser((current) => current ? { ...current, avatarPath: uploadPath, avatarUrl } : current);
      setCompanyUserProfiles((current) => current.map((profile) => profile.id === authUser.key ? { ...profile, ...updatedProfile } : profile));
      if (previousPath && previousPath !== uploadPath) {
        await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([previousPath]);
      }
      setProfilePhotoMessageType("success");
      setProfilePhotoMessage("Profile photo updated.");
    } catch (error) {
      setProfilePhotoMessageType("error");
      setProfilePhotoMessage(`Photo upload failed: ${error?.message || error}`);
    } finally {
      setProfilePhotoUploading(false);
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = "";
    }
  };

  const handleRemoveProfilePhoto = async () => {
    const avatarPath = String(authUser?.avatarPath || "");
    if (!avatarPath || !authUser?.key || profilePhotoUploading) return;
    if (typeof window !== "undefined" && !window.confirm("Remove your profile photo?")) return;
    setProfilePhotoUploading(true);
    setProfilePhotoMessage("");
    setProfilePhotoMessageType("");
    try {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ avatar_path: null, updated_at: new Date().toISOString() })
        .eq("id", authUser.key);
      if (profileError) throw profileError;
      const { error: removeError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([avatarPath]);
      if (removeError) console.warn("Profile photo file cleanup failed:", removeError.message || removeError);
      setAuthUser((current) => current ? { ...current, avatarPath: "", avatarUrl: "" } : current);
      setCompanyUserProfiles((current) => current.map((profile) => profile.id === authUser.key ? { ...profile, avatar_path: null } : profile));
      setProfilePhotoMessageType("success");
      setProfilePhotoMessage("Profile photo removed.");
    } catch (error) {
      setProfilePhotoMessageType("error");
      setProfilePhotoMessage(`Unable to remove photo: ${error?.message || error}`);
    } finally {
      setProfilePhotoUploading(false);
    }
  };

  const renderProfileScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div className="brandRow">
          <div className="brandMark"><img src={LOGO_SRC} alt="CRT Roofing logo" /></div>
          <div>
            <p className="eyebrow">Account</p>
            <h1>User Profile</h1>
            <p className="intro">Your CRT Roofing employee account and access level.</p>
          </div>
        </div>
      </header>
      <Section title="Profile photo" subtitle="This photo appears throughout the employee portal.">
        <div className="profilePhotoManager">
          <div className="profilePhotoPreview" aria-label="Profile photo preview">
            {authUser?.avatarUrl ? <img src={authUser.avatarUrl} alt={`${getAccountDisplayName()} profile`} /> : <span>{getAccountInitials()}</span>}
          </div>
          <div className="profilePhotoControls">
            <p>Choose a centered JPG, PNG, or WebP image up to 5 MB. The app displays it as a circular photo.</p>
            <input
              ref={profilePhotoInputRef}
              className="profilePhotoInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleProfilePhotoSelected}
            />
            <div className="actionRow">
              <button type="button" className="primaryButton" disabled={profilePhotoUploading} onClick={() => profilePhotoInputRef.current?.click()}>
                {profilePhotoUploading ? "Saving…" : authUser?.avatarPath ? "Replace Photo" : "Upload Photo"}
              </button>
              {authUser?.avatarPath ? (
                <button type="button" className="dangerButton" disabled={profilePhotoUploading} onClick={handleRemoveProfilePhoto}>Remove Photo</button>
              ) : null}
            </div>
            {profilePhotoMessage ? <p className={`statusMessage ${profilePhotoMessageType === "error" ? "dangerMessage" : ""}`}>{profilePhotoMessage}</p> : null}
          </div>
        </div>
      </Section>
      <Section title="Profile details" subtitle="Account information is managed through your company login.">
        <div className="summaryGrid">
          <div className="summaryCard"><span>Name</span><strong>{getAccountDisplayName()}</strong></div>
          <div className="summaryCard"><span>Email</span><strong>{authUser?.email || "Not available"}</strong></div>
          <div className="summaryCard"><span>Title</span><strong>{getAccountTitle()}</strong></div>
          <div className="summaryCard"><span>Title</span><strong>{authUser?.title || "Employee"}</strong></div>
        </div>
        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => navigateFromSidebar("settings")}>Open Settings</button>
          <button type="button" className="dangerButton" onClick={handleLogout}>Sign Out</button>
        </div>
      </Section>
    </div>
  );

  const renderSettingsScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div className="brandRow">
          <div className="brandMark"><img src={LOGO_SRC} alt="CRT Roofing logo" /></div>
          <div>
            <p className="eyebrow">Account</p>
            <h1>Settings</h1>
            <p className="intro">Personal preferences and company administration tools.</p>
          </div>
        </div>
      </header>
      <Section title="Personal preferences" subtitle="These settings follow this browser.">
        {renderAppearanceControl()}
        <div className="actionRow" style={{ marginTop: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setSidebarCollapsed((current) => !current)}>
            {sidebarCollapsed ? "Keep sidebar expanded" : "Keep sidebar compact"}
          </button>
        </div>
      </Section>
      {isAdminUser || isFinanceUser ? (
        <Section title="Company settings" subtitle="Configuration tools shown according to your role.">
          <div className="templateGrid">
            {canManageEmployeeWages ? (
              <button type="button" className="templateCard" onClick={() => navigateFromSidebar("administration")}>
                <span className="eyebrow">Payroll</span><strong>Team & Wages</strong><p>Manage employees and wage information.</p>
              </button>
            ) : null}
            {isFinanceUser ? (
              <button type="button" className="templateCard" onClick={() => navigateFromSidebar("adminPricing")}>
                <span className="eyebrow">Company</span><strong>Pricing & Defaults</strong><p>Manage estimate pricing and operating defaults.</p>
              </button>
            ) : null}
            <button type="button" className="templateCard" onClick={() => navigateFromSidebar("proposalRequests")}>
              <span className="eyebrow">Proposals</span><strong>Proposal Requests</strong><p>Open the estimating queue and proposal document workspace.</p>
            </button>
            <button type="button" className="templateCard" onClick={() => navigateFromSidebar("accountAccess")}>
              <span className="eyebrow">Security</span><strong>Account Access</strong><p>Request approved access to company websites and logins.</p>
            </button>
          </div>
        </Section>
      ) : null}
    </div>
  );

  const renderArchiveScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div className="brandRow">
          <div className="brandMark"><img src={LOGO_SRC} alt="CRT Roofing logo" /></div>
          <div>
            <p className="eyebrow">Jobs</p>
            <h1>Archive</h1>
            <p className="intro">Completed or inactive jobs saved outside the active workflow.</p>
          </div>
        </div>
      </header>
      <Section title={`Archived jobs (${archivedJobs.length})`} subtitle="Open archived job history or restore work to its previous workflow.">
        {archivedJobs.length ? (
          <div className="savedList">
            {archivedJobs.map((job) => (
              <div className="savedCard" key={job.id}>
                <div>
                  <span className="statusTag">Archived</span>
                  <strong>{job.projectName || "Untitled project"}</strong>
                  <p>
                    {job.jobNumber ? `Job ${job.jobNumber} | ` : ""}
                    {job.customer || job.propertyOwner || "No customer"}
                    {job.archivedAt ? ` | Archived ${new Date(job.archivedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="savedActions">
                  {canManageSharedJobData ? (
                    <button type="button" className="primaryButton" disabled={Boolean(activeJobMutationKey)} onClick={() => handleRestoreArchivedJob(job)}>
                      {activeJobMutationKey === `restore:${job.id}` ? "Restoring…" : "Restore"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="emptyState">No archived jobs yet.</p>}
      </Section>
    </div>
  );

  const renderAuthenticatedLayout = (screen) => {
    const navigationDefinitions = {
      dashboard: { key: "dashboard", label: "Dashboard", icon: "D", matches: ["dashboard"] },
      workHub: { key: "workHub", label: "Tasks & Messages", icon: "T", matches: ["workHub"] },
      kpis: { key: "kpis", label: "KPI Scorecards", icon: "K", matches: ["kpis"] },
      crm: { key: "crm", label: "Customers", icon: "C", matches: ["crm"] },
      fieldNotes: { key: "fieldNotes", label: "Inspections", icon: "I", matches: ["fieldNotes"] },
      estimateTemplates: { key: "estimateTemplates", label: "Estimates", icon: "E", matches: ["estimateTemplates", "sprayFoam", "shingle", "tile", "coating", "maintenance", "repair"] },
      proposalRequests: { key: "proposalRequests", label: "Proposals", icon: "P", matches: ["proposalRequests"] },
      subcontractors: { key: "subcontractors", label: "Approved Vendors", icon: "SC", matches: ["subcontractors"] },
      approvedJobs: { key: "approvedJobs", label: "Approved Jobs", icon: "AJ", matches: ["approvedJobs", "approvedJob", "jobMetrics", "pastJobInsights"] },
      activeJobs: { key: "activeJobs", label: "Active Jobs", icon: "J", matches: ["activeJobs", "activeJob", "fieldOperations"] },
      invoices: { key: "invoices", label: "Invoices", icon: "I$", matches: ["invoices"] },
      archive: { key: "archive", label: "Archive", icon: "A", matches: ["archive"] },
      cfoDashboard: { key: "cfoDashboard", label: "Finance", icon: "$", matches: ["cfoDashboard"] },
    };
    const mainNavigation = getEmployeeNavigationKeys({
      email: authUser?.email,
      role: authRole,
      capabilities: { canAccessInvoices: canAccessInvoiceQueue, canAccessFinance: canAccessCfoDashboard },
    }).map((key) => navigationDefinitions[key]).filter(Boolean);
    const accountNavigation = [
      { key: "profile", label: "User Profile", icon: "U", matches: ["profile"] },
      { key: "accountAccess", label: "Account Access", icon: "K", matches: ["accountAccess"] },
      { key: "settings", label: "Settings", icon: "S", matches: ["settings", "administration", "adminPricing"] },
    ];
    const renderSidebarButton = (item) => (
      <button
        key={item.key}
        type="button"
        className={`portalSidebarButton ${item.matches.includes(activeTemplate) ? "active" : ""}`}
        onClick={() => navigateFromSidebar(item.key)}
        title={sidebarCollapsed ? item.label : undefined}
        aria-current={item.matches.includes(activeTemplate) ? "page" : undefined}
      >
        <span className="portalSidebarIcon" aria-hidden="true">{item.icon}</span>
        <span className="portalSidebarLabel">{item.label}</span>
      </button>
    );

    return (
      <div className={`portalLayout ${sidebarCollapsed ? "sidebarCollapsed" : ""} ${sidebarMobileOpen ? "sidebarMobileOpen" : ""}`}>
        <style>{css}</style>
        {sidebarMobileOpen ? <button type="button" className="portalSidebarBackdrop" aria-label="Close navigation" onClick={() => setSidebarMobileOpen(false)} /> : null}
        <aside className="portalSidebar" aria-label="Main navigation">
          <div className="portalSidebarBrand">
            <img src={LOGO_SRC} alt="CRT Roofing" />
            <div className="portalSidebarBrandText"><strong>CRT Roofing</strong><span>Employee Portal</span></div>
          </div>
          <button type="button" className="portalSidebarToggle" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? "›" : "‹  Collapse"}
          </button>
          <nav className="portalSidebarNav">
            <p className="portalSidebarSectionLabel">Workspace</p>
            {mainNavigation.map(renderSidebarButton)}
          </nav>
          <div className="portalSidebarFooter">
            <div className="portalSidebarAccount">
              <span className="portalSidebarAvatar" aria-hidden="true">
                {authUser?.avatarUrl ? <img src={authUser.avatarUrl} alt="" /> : getAccountInitials()}
              </span>
              <div className="portalSidebarAccountText"><strong>{getAccountDisplayName()}</strong><span>{getAccountTitle()}</span></div>
            </div>
            {accountNavigation.map(renderSidebarButton)}
            <button type="button" className="portalSidebarButton" onClick={handleLogout} title={sidebarCollapsed ? "Sign Out" : undefined}>
              <span className="portalSidebarIcon" aria-hidden="true">↪</span><span className="portalSidebarLabel">Sign Out</span>
            </button>
          </div>
        </aside>
        <button type="button" className="portalDesktopLauncher" onClick={() => setSidebarCollapsed(false)} aria-label="Open sidebar" title="Open sidebar">☰</button>
        <button type="button" className="portalMobileMenu" onClick={() => setSidebarMobileOpen(true)} aria-label="Open navigation">Menu</button>
        <ActionFeedback
          message={sessionMessage}
          tone={sessionMessageType || "info"}
          onDismiss={() => { setSessionMessage(""); setSessionMessageType(""); }}
        />
        {shouldLoadGoogleMaps ? (
          <React.Suspense fallback={null}>
            <DeferredGoogleMapsLoader onStatusChange={setGoogleMapsStatus} />
          </React.Suspense>
        ) : null}
        <main className="portalMain">
          <ConnectionStatus />
          {activeTemplate === "dashboard" ? <React.Suspense fallback={null}><WorkflowNotifications supabase={supabase} userId={authUser?.id || authUser?.key} /></React.Suspense> : null}
          <WorkspaceErrorBoundary key={activeTemplate} onReturnDashboard={() => setActiveTemplate("dashboard")}>
            <React.Suspense fallback={(
              <section className="panel" aria-live="polite" aria-busy="true">
                <p className="intro" style={{ margin: 0 }}>Opening workspace…</p>
              </section>
            )}>
              {screen}
            </React.Suspense>
          </WorkspaceErrorBoundary>
        </main>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="loginShell">
        <style>{css}</style>
        <section className="panel loginPanel">
          <p className="intro" style={{ margin: 0 }}>Authenticating session...</p>
        </section>
      </div>
    );
  }

  if (passwordRecoveryMode) {
    return (
      <div className="loginShell">
        <style>{css}</style>
        <section className="panel loginPanel">
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Employee Portal</p>
              <h1>Create a new password</h1>
              <p className="intro">Choose a new password for your employee account.</p>
            </div>
          </div>

          <form className="loginForm" onSubmit={handlePasswordRecovery}>
            <div className="formGrid">
              <Field label="New password">
                <input
                  type="password"
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  value={recoveryPasswordConfirmation}
                  onChange={(e) => setRecoveryPasswordConfirmation(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Enter the new password again"
                />
              </Field>
            </div>
            <div className="actionRow">
              <button className="loginButton" type="submit">Update password</button>
            </div>
            {loginError ? <p className="statusMessage dangerMessage">{loginError}</p> : null}
            {loginNotice ? <p className="statusMessage">{loginNotice}</p> : null}
          </form>
        </section>
      </div>
    );
  }

  if (!authUser?.key) {
    return (
      <div className="loginShell">
        <style>{css}</style>
        <section className="panel loginPanel">
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing</p>
              <h1>Employee Portal</h1>
              <p className="intro">Sign in with your assigned company account.</p>
            </div>
          </div>

          <form className="loginForm" onSubmit={handleLogin}>
            <div className="formGrid">
              <Field label="Email">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={loginSubmitting || resetSubmitting}
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loginSubmitting || resetSubmitting}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
              </Field>
            </div>

            <div className="actionRow">
              <button className="loginButton" type="submit" disabled={loginSubmitting || resetSubmitting}>
                {loginSubmitting ? "Signing in…" : "Enter"}
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={handleForgotPassword}
                disabled={loginSubmitting || resetSubmitting}
              >
                {resetSubmitting ? "Sending…" : "Forgot password"}
              </button>
            </div>

            {loginError ? <p className="statusMessage dangerMessage">{loginError}</p> : null}
            {loginNotice ? <p className="statusMessage">{loginNotice}</p> : null}
          </form>
        </section>
      </div>
    );
  }

  if (activeTemplate === "dashboard") {
    return renderAuthenticatedLayout(renderDashboard());
  }

  const employeeAllowedTemplates = getEmployeeAllowedTemplates({
    email: authUser?.email,
    role: authRole,
    capabilities: { canAccessInvoices: canAccessInvoiceQueue, canAccessFinance: canAccessCfoDashboard },
  });
  if (employeeAllowedTemplates && !employeeAllowedTemplates.includes(activeTemplate)) {
    return renderAuthenticatedLayout(renderDashboard());
  }

  if ((!isFinanceUser && activeTemplate === "adminPricing") || (!canManageEmployeeWages && activeTemplate === "administration")) {
    return renderAuthenticatedLayout(renderDashboard());
  }

  if (!canAccessCfoDashboard && activeTemplate === "cfoDashboard") {
    return renderAuthenticatedLayout(renderDashboard());
  }

  if (!canAccessInvoiceQueue && activeTemplate === "invoices") {
    return renderAuthenticatedLayout(renderDashboard());
  }

  if (activeTemplate === "cfoDashboard") return renderAuthenticatedLayout(renderCfoDashboardScreen());
  if (activeTemplate === "invoices") return renderAuthenticatedLayout(<InvoiceQueue supabase={supabase} authUser={authUser} onClose={() => setActiveTemplate("dashboard")} />);
  if (activeTemplate === "accountAccess") return renderAuthenticatedLayout(<AccountAccessVault supabase={supabase} onClose={() => setActiveTemplate("dashboard")} />);
  if (activeTemplate === "kpis") return renderAuthenticatedLayout(renderMiguelKpiScreen());
  if (activeTemplate === "administration") return renderAuthenticatedLayout(renderAdministrationScreen());
  if (activeTemplate === "activeJobs") return renderAuthenticatedLayout(renderActiveJobsScreen());
  if (activeTemplate === "activeJob") return renderAuthenticatedLayout(renderActiveJobScreen());
  if (activeTemplate === "fieldOperations") return renderAuthenticatedLayout(renderFieldOperationsScreen());
  if (activeTemplate === "fieldNotes") return renderAuthenticatedLayout(renderFieldNotesScreen());
  if (activeTemplate === "estimateTemplates") return renderAuthenticatedLayout(renderEstimateTemplatesScreen());
  if (activeTemplate === "approvedJobs") return renderAuthenticatedLayout(renderApprovedJobsScreen());
  if (activeTemplate === "approvedJob") return renderAuthenticatedLayout(renderApprovedJobScreen());
  if (activeTemplate === "proposalBuilder") return renderAuthenticatedLayout(<WorkHub key={activeTemplate} onSubmitInspection={["admin", "cfo", "salesperson", "estimator"].includes(authRole) ? sendCrmLeadForInspection : undefined} supabase={supabase} authUser={authUser} initialTab="proposals" />);
  if (activeTemplate === "jobMetrics") return renderAuthenticatedLayout(renderJobMetricsScreen());
  if (activeTemplate === "pastJobInsights") return renderAuthenticatedLayout(renderPastJobInsightsScreen());
  if (activeTemplate === "crm") return renderAuthenticatedLayout(renderCrmLeadsScreen());
  if (activeTemplate === "archive") return renderAuthenticatedLayout(renderArchiveScreen());
  if (activeTemplate === "profile") return renderAuthenticatedLayout(renderProfileScreen());
  if (activeTemplate === "settings") return renderAuthenticatedLayout(renderSettingsScreen());
  if (activeTemplate === "workHub") return renderAuthenticatedLayout(<WorkHub key={activeTemplate} onSubmitInspection={["admin", "cfo", "salesperson", "estimator"].includes(authRole) ? sendCrmLeadForInspection : undefined} supabase={supabase} authUser={authUser} initialTab={workHubInitialTab} initialTaskId={workHubInitialTaskId} initialCreateTask={workHubInitialCreateTask} />);
  if (activeTemplate === "proposalRequests") return renderAuthenticatedLayout(<WorkHub key={activeTemplate} onSubmitInspection={["admin", "cfo", "salesperson", "estimator"].includes(authRole) ? sendCrmLeadForInspection : undefined} supabase={supabase} authUser={authUser} initialTab="proposals" />);
  if (activeTemplate === "subcontractors") return renderAuthenticatedLayout(renderSubcontractorDirectoryScreen());
  if (activeTemplate === "sprayFoam") return renderAuthenticatedLayout(renderSprayFoamScreen());
  if (activeTemplate === "shingle") return renderAuthenticatedLayout(renderShingleScreen());
  if (activeTemplate === "tile") return renderAuthenticatedLayout(renderTileScreen());
  if (activeTemplate === "coating") return renderAuthenticatedLayout(renderServiceScreen());
  if (activeTemplate === "maintenance") return renderAuthenticatedLayout(renderServiceScreen());
  if (activeTemplate === "repair") return renderAuthenticatedLayout(renderServiceScreen());
  if (activeTemplate === "adminPricing") return renderAuthenticatedLayout(renderAdminPricingScreen());

  return renderAuthenticatedLayout((
    <TpoWorkspace
      workspace={{
        AC_DETAIL_OPTIONS,
        ChoiceCard,
        DetailRow,
        EXISTING_ROOF_OPTIONS,
        Field,
        JOB_TYPE_OPTIONS,
        LABOR_TYPE_OPTIONS,
        LICENSE_OPTIONS,
        PAYROLL_TAX_RATE,
        R_VALUE_OPTIONS,
        SUBSTRATE_OPTIONS,
        SafeTileSection,
        Section,
        TERMINATION_METHOD_OPTIONS,
        TOTAL_LABOR_BURDEN_RATE,
        TravelCalculator,
        WORKERS_COMP_RATE,
        activeSavedEstimates,
        addCustomMaterial,
        addEstimateLaborEmployee,
        addTravelVehicleSelection,
        buildEmployeeDisplayName,
        buildEstimateName,
        calculateLoadedHourlyWage,
        calculation,
        canManageEmployeeWages,
        companyUserProfiles,
        completedJobs,
        createBlankTerminationRow,
        css,
        deleteCustomMaterial,
        employeeDirectory,
        estimateCode,
        estimateName,
        estimateOwnerAssignments,
        estimateStatusLabel,
        googleDebug,
        handleAddSubcontractorLineItem,
        handleApproveJob,
        handleCalculateDistance,
        handleCompleteJob,
        handleConvertCurrentEstimateToProposal,
        handleConvertEstimateToProposal,
        handleDeleteEstimate,
        handleDownloadEstimatePDF,
        handleEstimateOwnerSelection,
        handleLoadEstimate,
        handleLogout,
        handleNumberInputWheel,
        handleReassignEstimateOwner,
        handleSaveEstimate,
        handleSelectedMarkup,
        inputs,
        isAdminUser,
        isEstimateComplete,
        isLoaded,
        isLookingUpDistance,
        loadError,
        missingScopeChecklist,
        money,
        money2,
        nextEstimateNumber,
        normalizeAppRole,
        normalizeEstimateLaborEmployeeRows,
        num,
        priceFields,
        prices,
        removeEstimateLaborEmployee,
        removeTravelVehicleSelection,
        renderEstimatorShellHeader,
        renderQuickMeasureReviewPanel,
        sessionMessage,
        sessionMessageType,
        setActiveTemplate,
        setEstimateName,
        setField,
        setInputs,
        setPriceField,
        setSubcontractorAddOnItem,
        setTravelField,
        setTravelVehicleSelection,
        toNumber,
        travelLookupMessage,
        updateCustomMaterial,
        updateEstimateLaborEmployee,
      }}
    />
  ));
}

export default App;
