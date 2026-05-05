import { useEffect, useMemo, useState } from "react";
import { useLoadScript } from "@react-google-maps/api";

const AUTH_KEY = "crt_roofing_auth_v1";
const USERS_KEY = "crt_roofing_users_v1";
const DRAFT_KEY = (userKey) => `crt_roofing_draft_v1:${userKey}`;
const SAVED_KEY = (userKey) => `crt_roofing_saved_v1:${userKey}`;

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
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

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

const TEMPLATE_CARDS = [
  { key: "tpo", title: "TPO Estimate", estimateType: "TPO", comingSoon: false },
  { key: "sprayFoam", title: "Spray Foam Estimate", estimateType: "Spray Foam", comingSoon: true },
  { key: "tile", title: "Tile Estimate", estimateType: "Tile", comingSoon: true },
  { key: "shingle", title: "Shingle Estimate", estimateType: "Shingle", comingSoon: true },
  { key: "coating", title: "Coating Estimate", estimateType: "Coating", comingSoon: true },
  { key: "maintenance", title: "Maintenance", estimateType: "Maintenance", comingSoon: true },
  { key: "repair", title: "Repair / Service Estimate", estimateType: "Repair / Service", comingSoon: true },
];

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

  companyHqAddress: "Fontana, CA",
  jobSiteAddress: "",
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
  payrollBurdenPercent: 0,

  overheadOperatingRate: OVERHEAD_OPERATING_RATE,
  scopeAdders: 0,
  travelCost: 0,
  miscCost: 0,
  selectedMarkupPercent: 30,
  ...DEFAULT_MATERIAL_PRICES,

  estimateName: "",
};

const defaultUserState = {
  key: "",
  displayName: "",
  secret: "",
  nextEstimateNumber: 1,
};

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
  font-family: Avenir, "Segoe UI", system-ui, sans-serif;
}
*{box-sizing:border-box}
body{
  margin:0;
  color:var(--ink);
  background:
    radial-gradient(circle at top left, rgba(18,166,245,.16), transparent 26%),
    radial-gradient(circle at top right, rgba(18,166,245,.08), transparent 24%),
    linear-gradient(180deg,#000 0%, #050607 40%, #09111a 100%);
}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
a{color:inherit}
.appShell{width:min(1480px, calc(100% - 24px)); margin:0 auto; padding:20px 0 42px}
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
.sectionHead,.panelHead{display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:16px}
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
.actionRow{display:flex; flex-wrap:wrap; gap:10px}
.primaryButton,.secondaryButton,.dangerButton,.loginButton{
  min-height:44px; padding:0 15px; border-radius:12px; border:1px solid var(--line2);
  color:#e9fbff; background:linear-gradient(180deg, rgba(18,166,245,.22), rgba(18,166,245,.10));
}
.primaryButton{font-weight:800}
.secondaryButton{font-weight:700}
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
.templateGrid{
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
@media (max-width: 1180px){
  .hero,.summaryGrid,.bidGrid,.formGrid,.templateGrid{grid-template-columns:1fr}
  .bidGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width: 760px){
  .appShell{width:min(100% - 14px, 100%); padding-top:14px}
  .choiceRow{grid-template-columns:1fr}
  .bidGrid{grid-template-columns:1fr}
  .panel{padding:16px}
  .dataTable{min-width:820px}
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

function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function toNumber(value, fallback = 0) {
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

function formatHoursMinutes(value) {
  const totalMinutes = Math.max(0, Math.round(toNumber(value, 0) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function clamp(value, min = 0, max = Number.POSITIVE_INFINITY) {
  return Math.min(max, Math.max(min, value));
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
    totalSquares: fieldSquares,
    fieldSquares,
    jobAddress,
    oneWayMiles,
    oneWayDriveTime,
    oneWayDriveTimeHours,
    estimatedDriveTimeMinutes: Math.max(0, toNumber(inputs.estimatedDriveTimeMinutes, oneWayDriveTime * 60)),
    travelDistanceSource: inputs.travelDistanceSource === "google" ? "google" : "manual",
    overheadOperatingRate: OVERHEAD_OPERATING_RATE,
  };
}

function calculateTravelAndOvertime(inputs) {
  const oneWayMiles = Math.max(0, toNumber(inputs.oneWayMiles, 0));
  const averageDrivingSpeedMph = Math.max(0.1, toNumber(inputs.averageDrivingSpeedMph, 60));
  const travelDriverHourlyRate = Math.max(0, toNumber(inputs.travelDriverHourlyRate, 27));
  const workHoursPerDay = Math.max(0, toNumber(inputs.workHoursPerDay, 8));
  const numberOfJobDays = Math.max(0, Math.round(toNumber(inputs.numberOfJobDays, 0)));
  const numberOfDrivers = Math.max(0, Math.round(toNumber(inputs.numberOfDrivers, 0)));
  const oneWayDriveTimeHours = Math.max(
    0,
    toNumber(inputs.oneWayDriveTimeHours, toNumber(inputs.oneWayDriveTime, toNumber(inputs.estimatedDriveTimeMinutes, 0) / 60)),
  );
  const travelDistanceSource = inputs.travelDistanceSource === "google" ? "google" : "manual";
  const companyHqAddress = String(inputs.companyHqAddress || "");
  const jobSiteAddress = String(inputs.jobSiteAddress || "");
  const jobAddress = String(inputs.jobAddress || "");

  const oneWayDriveTime =
    travelDistanceSource === "google" && oneWayDriveTimeHours > 0
      ? oneWayDriveTimeHours
      : oneWayMiles / averageDrivingSpeedMph;
  const roundTripDriveTime = oneWayDriveTime * 2;
  const overtimeHoursPerDay = Math.max(0, roundTripDriveTime);
  const overtimePayPerDay = overtimeHoursPerDay * travelDriverHourlyRate * 1.5 * numberOfDrivers;
  const totalDriverTravelCost = overtimePayPerDay * numberOfJobDays;

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
    oneWayDriveTime,
    roundTripDriveTime,
    overtimeHoursPerDay,
    overtimePayPerDay,
    totalDriverTravelCost,
    totalTravelCost: totalDriverTravelCost,
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function estimateCode(n) {
  return `CRT-${String(Math.max(1, Math.floor(n || 1))).padStart(4, "0")}`;
}

function buildEstimateName(inputs) {
  const sq = num(inputs.totalSquares, 0);
  if (inputs.jobType === "existingRoof" && inputs.existingRoofAction === "tearOff") return `Tear-off ${sq} SQ`;
  if (inputs.jobType === "existingRoof" && inputs.existingRoofAction === "layover") return `Layover ${sq} SQ`;
  if (inputs.jobType === "newConstruction" && inputs.substrateType === "rigidInsulation") return `Rigid insulation ${sq} SQ`;
  if (inputs.jobType === "newConstruction" && inputs.substrateType === "denseDeckOnly") return `Dense deck ${sq} SQ`;
  return `TPO estimate ${sq} SQ`;
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

function DetailRow({ label, value }) {
  return (
    <div className="detailRow">
      <span>{label}</span>
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

  const items = [];
  const push = (key, label, quantity, unit, unitPrice, notes = "") => {
    const amount = quantity * unitPrice;
    items.push({ key, label, quantity, unit, unitPrice, amount, notes });
  };

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
  const payrollBurdenPercent = Math.max(0, toNumber(inputs.payrollBurdenPercent, 0));

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

  const basePayroll = workers * hourlyRate * hoursPerWorker;
  const payrollBurden = basePayroll * (payrollBurdenPercent / 100);
  const totalLaborCost = basePayroll + payrollBurden;

  return {
    laborType,
    subcontractorLicenseStatus,
    subcontractorLaborRatePerSq: 0,
    subcontractorHasAddOns: false,
    subcontractorAddOnItems: normalizeSubcontractorAddOnItems([]),
    workers,
    hourlyRate,
    hoursPerWorker,
    payrollBurdenPercent,
    subLaborBase: 0,
    workersCompRate: 0,
    workersCompCost: 0,
    subcontractorAddOnTotal: 0,
    basePayroll,
    payrollBurden,
    totalLaborCost,
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

function buildMissingScopeChecklist(inputs, prices, calculation) {
  const checklist = [];
  const addItem = (label, detail) => checklist.push({ label, detail });

  if (calculation.scope.totalSquares <= 0) {
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

function calculateTpoEstimate(inputs, prices) {
  const scope = calculateScope(inputs);
  const termination = calculateTermination(inputs, prices);
  const pitchPocket = calculatePitchPocket(inputs, prices);
  const detailMembrane = calculateDetailMembrane(inputs, prices, pitchPocket.pitchPocketDetailMembraneSqft);
  const acHandling = calculateAcHandling(inputs);
  const travelAndOvertime = calculateTravelAndOvertime(inputs);
  const labor = calculateLabor(inputs);

  const materialPricing = calculateMaterialPricing(inputs, prices, scope, termination, pitchPocket, detailMembrane, acHandling);

  const terminationCost = termination.totalTerminationCost;
  const pitchPocketCost = pitchPocket.totalPitchPocketCost;
  const travelCost = travelAndOvertime.totalTravelCost;
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

function App() {
  const [authUser, setAuthUser] = useState(() => {
    const stored = readJson(AUTH_KEY, null);
    return stored && stored.key ? stored : null;
  });
  const [users, setUsers] = useState(() => readJson(USERS_KEY, {}));
  const [loginName, setLoginName] = useState("");
  const [loginSecret, setLoginSecret] = useState("");
  const [loginError, setLoginError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [travelLookupMessage, setTravelLookupMessage] = useState("");
  const [isLookingUpDistance, setIsLookingUpDistance] = useState(false);
  const [googleDebug, setGoogleDebug] = useState({
    apiKeyFound: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
    mapsJsLoaded: false,
    directionsServiceAvailable: false,
    lastGoogleStatus: "Not run",
    lastElementStatus: "Not run",
    lastError: "Not run",
  });

  const [inputs, setInputs] = useState(() => {
    if (!authUser?.key) return DEFAULT_INPUTS;
    const draft = readJson(DRAFT_KEY(authUser.key), null);
    return normalizeDraftInputs(draft?.inputs);
  });

  const [prices, setPrices] = useState(() => {
    if (!authUser?.key) {
      return { ...DEFAULT_MATERIAL_PRICES };
    }

    const draft = readJson(DRAFT_KEY(authUser.key), null);
    return normalizeMaterialPrices(draft?.prices);
  });

  const [estimateName, setEstimateName] = useState(() => {
    if (!authUser?.key) return "";
    const draft = readJson(DRAFT_KEY(authUser.key), null);
    return draft?.estimateName || "";
  });

  const [savedEstimates, setSavedEstimates] = useState(() => {
    if (!authUser?.key) return [];
    return readJson(SAVED_KEY(authUser.key), []);
  });
  const [activeTemplate, setActiveTemplate] = useState("dashboard");

  const [nextEstimateNumber, setNextEstimateNumber] = useState(() => {
    if (!authUser?.key) return 1;
    const userRecord = users[authUser.key];
    const saved = readJson(SAVED_KEY(authUser.key), []);
    const highestSaved = saved.reduce((max, est) => Math.max(max, Number(est.estimateNumber || 0)), 0);
    return Math.max(1, Number(userRecord?.nextEstimateNumber || 1), highestSaved + 1);
  });

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const calculation = useMemo(() => calculateTpoEstimate(inputs, prices), [inputs, prices]);
  const missingScopeChecklist = useMemo(
    () => buildMissingScopeChecklist(inputs, prices, calculation),
    [inputs, prices, calculation],
  );
  const isEstimateComplete = missingScopeChecklist.length === 0;
  const estimateStatusLabel = isEstimateComplete ? "Ready for bid" : "Incomplete";
  const currentEstimateName = estimateName.trim() || buildEstimateName(inputs);
  const activeSavedEstimates = savedEstimates;

  useEffect(() => {
    if (!authUser?.key) return;
    writeJson(AUTH_KEY, authUser);
  }, [authUser]);

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
    writeJson(USERS_KEY, users);
  }, [users, authUser]);

  useEffect(() => {
    if (!isLoaded) return;
    const apiKeyFound = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
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

  if (loadError) {
    return <div>Google Maps failed to load: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div>Loading Google Maps...</div>;
  }

  const setField = (key, value) => {
    setInputs((current) => ({
      ...current,
      ...(key === "fieldSquares" ? { totalSquares: value } : null),
      [key]: value,
    }));
  };

  const setTravelField = (key, value) => {
    setInputs((current) => ({
      ...current,
      [key]: value,
      travelDistanceSource: "manual",
    }));
    setTravelLookupMessage("");
  };

  const handleGoogleTimeout = (label) => {
    setIsLookingUpDistance(false);
    setTravelLookupMessage(
      `${label}: Google callback did not return. Check billing, browser blocker, API restrictions, or Google Cloud billing activation.`,
    );
    setGoogleDebug((current) => ({
      ...current,
      lastGoogleStatus: "TIMEOUT",
      lastElementStatus: "TIMEOUT",
      lastError: "Google callback did not return",
    }));
  };

  const handleTestGoogleGeocoder = async () => {
    if (!window.google?.maps?.Geocoder) {
      setTravelLookupMessage("Google Maps API unavailable for Geocoder.");
      return;
    }

    const hqAddress = String(inputs.companyHqAddress || "").trim();
    if (!hqAddress) {
      setTravelLookupMessage("Enter the HQ address first.");
      return;
    }

    setIsLookingUpDistance(true);
    setTravelLookupMessage("Testing Google Geocoder...");
    setGoogleDebug((current) => ({
      ...current,
      apiKeyFound: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
      mapsJsLoaded: !!window.google?.maps,
      directionsServiceAvailable: !!window.google?.maps?.DirectionsService,
      lastGoogleStatus: "Running",
      lastElementStatus: "Running",
      lastError: "Running",
    }));

    let completed = false;
    let timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      handleGoogleTimeout("Geocoder");
    }, 10000);

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: hqAddress }, (results, status) => {
        console.log("Geocoder status", status);
        console.log("Geocoder results", results);
        if (timeoutId) clearTimeout(timeoutId);
        setIsLookingUpDistance(false);
        if (completed) return;
        completed = true;

        setGoogleDebug((current) => ({
          ...current,
          lastGoogleStatus: status || "UNKNOWN",
          lastElementStatus: results?.[0]?.geometry?.location ? "OK" : "UNKNOWN",
          lastError: status || "UNKNOWN",
        }));

        setTravelLookupMessage(`Geocoder status: ${status}`);
      });
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      setIsLookingUpDistance(false);
      setTravelLookupMessage(error instanceof Error ? `Geocoder failed: ${error.message}` : "Geocoder failed.");
    }
  };

  const handleTestDirections = async () => {
    const companyHqAddress = String(inputs.companyHqAddress || "").trim();
    const jobSiteAddress = String(inputs.jobSiteAddress || "").trim();

    if (!companyHqAddress || !jobSiteAddress) {
      setTravelLookupMessage("Enter both the HQ address and the job site address.");
      return;
    }

    if (!window.google?.maps?.DirectionsService) {
      setTravelLookupMessage("Google Maps API unavailable for DirectionsService.");
      return;
    }

    setIsLookingUpDistance(true);
    setTravelLookupMessage("Testing Directions...");
    setGoogleDebug((current) => ({
      ...current,
      apiKeyFound: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
      mapsJsLoaded: !!window.google?.maps,
      directionsServiceAvailable: !!window.google?.maps?.DirectionsService,
      lastGoogleStatus: "Running",
      lastElementStatus: "Running",
      lastError: "Running",
    }));

    let completed = false;
    let timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      handleGoogleTimeout("Directions");
    }, 10000);

    try {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: companyHqAddress,
          destination: jobSiteAddress,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          console.log("Directions status", status);
          console.log("Directions response", response);
          if (timeoutId) clearTimeout(timeoutId);
          setIsLookingUpDistance(false);
          if (completed) return;
          completed = true;

          setGoogleDebug((current) => ({
            ...current,
            lastGoogleStatus: status || "UNKNOWN",
            lastElementStatus: response?.routes?.[0]?.legs?.[0] ? "OK" : "UNKNOWN",
            lastError: status || "UNKNOWN",
          }));

          setTravelLookupMessage(`Directions status: ${status}`);
        },
      );
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      setIsLookingUpDistance(false);
      setTravelLookupMessage(error instanceof Error ? `Directions failed: ${error.message}` : "Directions failed.");
    }
  };

  const handleCalculateDistance = async () => {
    const companyHqAddress = String(inputs.companyHqAddress || "").trim();
    const jobSiteAddress = String(inputs.jobSiteAddress || "").trim();

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
      apiKeyFound: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
      mapsJsLoaded: !!window.google?.maps,
      directionsServiceAvailable: !!window.google?.maps?.DirectionsService,
      lastGoogleStatus: "Running",
      lastElementStatus: "Running",
      lastError: "Running",
    }));

    try {
      if (!window.google) {
        throw new Error("Google Maps not loaded");
      }
      if (!window.google.maps) {
        throw new Error("Google Maps API unavailable");
      }
      if (!window.google.maps.DirectionsService) {
        throw new Error("DirectionsService unavailable");
      }

      const directionsService = new window.google.maps.DirectionsService();
      let finished = false;

      const timeoutId = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        setIsLookingUpDistance(false);
        setTravelLookupMessage(
          "Google callback did not return. Check billing, browser blocker, API restrictions, or Google Cloud billing activation.",
        );
        setInputs((current) => ({
          ...current,
          travelDistanceSource: "manual",
        }));
        setGoogleDebug((current) => ({
          ...current,
          lastGoogleStatus: "TIMEOUT",
          lastElementStatus: "TIMEOUT",
          lastError: "Google callback did not return",
        }));
      }, 10000);

      directionsService.route(
        {
          origin: companyHqAddress,
          destination: jobSiteAddress,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (timeoutId) clearTimeout(timeoutId);
          setIsLookingUpDistance(false);
          if (finished) return;
          finished = true;

          setGoogleDebug((current) => ({
            ...current,
            lastGoogleStatus: status || "UNKNOWN",
            lastElementStatus: result?.routes?.[0]?.legs?.[0] ? "OK" : "UNKNOWN",
            lastError: status || "UNKNOWN",
          }));

          if (status !== window.google.maps.DirectionsStatus.OK) {
            setTravelLookupMessage(`Google Directions failed: ${status}`);
            setInputs((current) => ({
              ...current,
              travelDistanceSource: "manual",
            }));
            return;
          }

          const leg = result?.routes?.[0]?.legs?.[0];

          if (!leg?.distance?.value || !leg?.duration?.value) {
            setTravelLookupMessage("Google Directions failed: missing route distance or duration.");
            setInputs((current) => ({
              ...current,
              travelDistanceSource: "manual",
            }));
            return;
          }

          const oneWayMiles = leg.distance.value / 1609.344;
          const oneWayDriveTime = leg.duration.value / 3600;

          setInputs((current) => ({
            ...current,
            oneWayMiles: round(oneWayMiles, 2),
            oneWayDriveTime: round(oneWayDriveTime, 2),
            oneWayDriveTimeHours: round(oneWayDriveTime, 2),
            travelDistanceSource: "google",
          }));

          setTravelLookupMessage(`Google Maps loaded: ${leg.distance.text}, ${leg.duration.text}`);
        },
      );
    } catch (error) {
      setIsLookingUpDistance(false);
      setTravelLookupMessage(error instanceof Error ? `Google Maps lookup failed: ${error.message}` : "Unable to calculate distance. Using manual entry.");
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

  const handleLogin = (event) => {
    event.preventDefault();

    const username = String(loginName || "").trim();
    const secret = String(loginSecret || "").trim();
    const key = normalizeUsername(username);

    if (!key || !secret) {
      setLoginError("Enter both a username and access code.");
      return;
    }

    const existing = users[key];
    if (existing && existing.secret !== secret) {
      setLoginError("That access code does not match the saved user.");
      return;
    }

    const nextUser = existing || {
      ...defaultUserState,
      key,
      displayName: username,
      secret,
      nextEstimateNumber: 1,
    };

    const updatedUsers = {
      ...users,
      [key]: {
        ...nextUser,
        displayName: username,
        secret,
      },
    };

    setUsers(updatedUsers);
    setAuthUser({ key, displayName: username, source: "local" });
    setActiveTemplate("dashboard");
    setLoginName("");
    setLoginSecret("");
    setLoginError("");
    setSessionMessage(`Signed in as ${username}.`);
  };

  const handleLogout = () => {
    removeKey(AUTH_KEY);
    setAuthUser(null);
    setInputs(DEFAULT_INPUTS);
    setPrices({ ...DEFAULT_MATERIAL_PRICES });
    setEstimateName("");
    setSavedEstimates([]);
    setNextEstimateNumber(1);
    setActiveTemplate("dashboard");
    setSessionMessage("Signed out.");
  };

  const handleSaveEstimate = () => {
    if (!authUser?.key) return;

    const estimateNumber = nextEstimateNumber;
    const estimateCodeValue = estimateCode(estimateNumber);

    const savedEstimate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      estimateNumber,
      estimateCode: estimateCodeValue,
      estimateType: "TPO",
      name: currentEstimateName,
      savedAt: new Date().toISOString(),
      inputs,
      prices,
      summary: {
        totalSquares: calculation.scope.totalSquares,
        materialPricingCost: calculation.materialPricingCost,
        materialCost: calculation.materialCost,
        laborCost: calculation.laborCost,
        overheadOperatingCost: calculation.overheadOperatingCost,
        totalCostBeforeProfit: calculation.totalCostBeforeProfit,
        totalCost: calculation.totalCost,
        selectedMarkupPercent: calculation.selectedMarkupPercent,
        selectedBidAmount: calculation.selectedBidAmount,
        selectedPricePerSq: calculation.selectedPricePerSq,
        selectedProfitDollars: calculation.selectedProfitDollars,
      },
    };

    const nextSaved = [savedEstimate, ...activeSavedEstimates];
    setSavedEstimates(nextSaved);
    writeJson(SAVED_KEY(authUser.key), nextSaved);

    const updatedUsers = {
      ...users,
      [authUser.key]: {
        ...(users[authUser.key] || {
          key: authUser.key,
          displayName: authUser.displayName,
          secret: "",
          nextEstimateNumber: 1,
        }),
        nextEstimateNumber: estimateNumber + 1,
      },
    };
    setUsers(updatedUsers);
    setNextEstimateNumber(estimateNumber + 1);

    setSessionMessage(`Saved ${estimateCodeValue}.`);
  };

  const handleLoadEstimate = (estimate) => {
    if (!authUser?.key || !estimate) return;
    setInputs(normalizeDraftInputs(estimate.inputs || DEFAULT_INPUTS));
    setPrices(estimate.prices || prices);
    setEstimateName(estimate.name || "");
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

  const handleDeleteEstimate = (estimateId) => {
    if (!authUser?.key) return;
    const next = activeSavedEstimates.filter((item) => item.id !== estimateId);
    setSavedEstimates(next);
    writeJson(SAVED_KEY(authUser.key), next);
    setSessionMessage("Saved estimate deleted.");
  };

  const handleSelectedMarkup = (percent) => {
    setField("selectedMarkupPercent", percent);
  };

  const priceFields = MATERIAL_PRICE_FIELDS;

  const renderTemplateScreen = (title) => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Estimating Platform</p>
              <h1>{title}</h1>
              <p className="intro">Coming Soon</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
          <p>Local mode only</p>
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
          Back to dashboard
        </button>
      </div>

      <Section title={title} subtitle="Coming Soon">
        <p className="intro">This template is not built yet.</p>
      </Section>
    </div>
  );

  const renderMaintenanceScreen = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Estimating Platform</p>
              <h1>Maintenance Estimate</h1>
              <p className="intro">Coming Soon</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
          <p>Local mode only</p>
        </div>
      </header>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
          Back to dashboard
        </button>
      </div>

      <Section title="Maintenance Estimate – Coming Soon" subtitle="Starter fields for future maintenance estimates.">
        <div className="formGrid">
          <Field label="Job name">
            <input
              type="text"
              value={inputs.jobName}
              onChange={(e) => setField("jobName", e.target.value)}
              placeholder="Job name"
            />
          </Field>
          <Field label="Customer name">
            <input
              type="text"
              value={inputs.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
              placeholder="Customer name"
            />
          </Field>
          <Field label="Property address">
            <input
              type="text"
              value={inputs.maintenancePropertyAddress}
              onChange={(e) => setField("maintenancePropertyAddress", e.target.value)}
              placeholder="Property address"
            />
          </Field>
          <Field label="Service type">
            <select
              value={inputs.maintenanceServiceType}
              onChange={(e) => setField("maintenanceServiceType", e.target.value)}
            >
              <option value="inspection">Inspection</option>
              <option value="leakRepair">Leak repair</option>
              <option value="preventativeMaintenance">Preventative maintenance</option>
              <option value="emergencyService">Emergency service</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              rows="4"
              value={inputs.maintenanceNotes}
              onChange={(e) => setField("maintenanceNotes", e.target.value)}
              placeholder="Notes"
            />
          </Field>
        </div>
      </Section>
    </div>
  );

  const renderDashboard = () => (
    <div className="appShell">
      <style>{css}</style>
      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing Estimating Platform</p>
              <h1>Choose an estimate template</h1>
              <p className="intro">Start a new estimate or open a saved one from this browser.</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Signed in</span>
          <strong>{authUser.displayName}</strong>
          <p>Local mode only</p>
        </div>
      </header>

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
        </div>
      </Section>

      <Section title="Saved estimates" subtitle="Recent estimates in this browser.">
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
                    {money(estimate.summary?.selectedBidAmount ?? 0)} bid |{" "}
                    {num(estimate.summary?.selectedMarkupPercent ?? 0, 0)}% markup
                  </p>
                </div>

                <div className="savedActions">
                  <button type="button" className="secondaryButton" onClick={() => handleLoadEstimate(estimate)}>
                    Load
                  </button>
                  <button type="button" className="dangerButton" onClick={() => handleDeleteEstimate(estimate.id)}>
                    Delete
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
              <h1>Sign in to continue</h1>
              <p className="intro">This local mode keeps estimates, drafts, and saved bids on this computer only.</p>
            </div>
          </div>

          <form className="loginForm" onSubmit={handleLogin}>
            <div className="formGrid">
              <Field label="Username">
                <input
                  type="text"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter username"
                />
              </Field>

              <Field label="Access code">
                <input
                  type="password"
                  value={loginSecret}
                  onChange={(e) => setLoginSecret(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Create or enter code"
                />
              </Field>
            </div>

            <div className="actionRow">
              <button className="loginButton" type="submit">
                Enter estimator
              </button>
            </div>

            {loginError ? <p className="statusMessage dangerMessage">{loginError}</p> : null}
          </form>
        </section>
      </div>
    );
  }

  if (activeTemplate === "dashboard") {
    return renderDashboard();
  }

  if (activeTemplate === "sprayFoam") return renderTemplateScreen("Spray Foam Estimate");
  if (activeTemplate === "tile") return renderTemplateScreen("Tile Estimate");
  if (activeTemplate === "shingle") return renderTemplateScreen("Shingle Estimate");
  if (activeTemplate === "coating") return renderTemplateScreen("Coating Estimate");
  if (activeTemplate === "maintenance") return renderMaintenanceScreen();
  if (activeTemplate === "repair") return renderTemplateScreen("Repair / Service Estimate");

  return (
    <div className="appShell">
      <style>{css}</style>

      <div className="actionRow" style={{ marginBottom: 16 }}>
        <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
          Back to dashboard
        </button>
      </div>

      <header className="hero">
        <div>
          <div className="brandRow">
            <div className="brandMark">
              <img src={LOGO_SRC} alt="CRT Roofing logo" />
            </div>
            <div>
              <p className="eyebrow">CRT Roofing TPO Estimator</p>
              <h1>TPO estimate</h1>
              <p className="intro">
                Build the estimate in the same order the job is scoped, priced, and bid.
                Local save/load/delete is enabled right now.
              </p>
            </div>
          </div>

          <div className="heroLine">
            <div className="heroCard">
              <span>Signed in</span>
              <strong>{authUser.displayName}</strong>
              <p>Local mode only</p>
            </div>

            <div className="heroCard">
              <span>Next estimate</span>
              <strong>{estimateCode(nextEstimateNumber)}</strong>
              <p>Assigned on save</p>
            </div>

            <div className="heroCard">
              <span>Total squares</span>
              <strong>{num(calculation.scope.totalSquares, 0)}</strong>
              <p>Used for all per-square math</p>
            </div>
          </div>
        </div>

        <div className="heroCard">
          <span>Current bid</span>
          <strong>{money(calculation.selectedBidAmount)}</strong>
          <p>{num(calculation.selectedMarkupPercent, 0)}% markup</p>
          <div className={`statusPill ${isEstimateComplete ? "" : "bad"}`}>{estimateStatusLabel}</div>
        </div>
      </header>

      <Section title="Job Info" subtitle="Start here so the job record stays aligned with travel and saved estimates.">
        <div className="formGrid">
          <Field label="Job name">
            <input
              type="text"
              value={inputs.jobName}
              onChange={(e) => setField("jobName", e.target.value)}
              placeholder="Job name"
            />
          </Field>
          <Field label="Customer name">
            <input
              type="text"
              value={inputs.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
              placeholder="Customer name"
            />
          </Field>
          <Field label="Job address">
            <input
              type="text"
              value={inputs.jobAddress}
              onChange={(e) => setField("jobAddress", e.target.value)}
              placeholder="Job address"
            />
          </Field>
        </div>
      </Section>

      <Section title="TPO scope flow" subtitle="Answer the scope questions in order.">
        <div className="formStack">
          <div className="inputSection">
            <h3>1. Is this job:</h3>
            <div className="choiceRow">
              {JOB_TYPE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  name="jobType"
                  value={option.value}
                  label={option.label}
                  checked={inputs.jobType === option.value}
                  onChange={(e) =>
                    setInputs((current) => ({
                      ...current,
                      jobType: e.target.value,
                      existingRoofAction: e.target.value === "existingRoof" ? current.existingRoofAction : "",
                      substrateType: e.target.value === "newConstruction" ? current.substrateType : "",
                    }))
                  }
                />
              ))}
            </div>
          </div>

          {inputs.jobType === "existingRoof" ? (
            <div className="inputSection">
              <h3>2. Are we:</h3>
              <div className="choiceRow">
                {EXISTING_ROOF_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="existingRoofAction"
                    value={option.value}
                    label={option.label}
                    checked={inputs.existingRoofAction === option.value}
                    onChange={(e) =>
                      setInputs((current) => ({
                        ...current,
                        existingRoofAction: e.target.value,
                      }))
                    }
                  />
                ))}
              </div>

              {inputs.existingRoofAction === "tearOff" ? (
                <div className="formGrid">
                  <Field label="How many existing roof layers?">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={inputs.tearOffLayers}
                      onChange={(e) => setField("tearOffLayers", e.target.value)}
                    />
                  </Field>
                  <Field label="Is this tear-off a double handle job?">
                    <select
                      value={inputs.isDoubleHandleTearOff ? "yes" : "no"}
                      onChange={(e) => setField("isDoubleHandleTearOff", e.target.value === "yes")}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}

          {inputs.jobType === "newConstruction" ? (
            <div className="inputSection">
              <h3>2. What substrate/system is required?</h3>
              <div className="choiceRow">
                {SUBSTRATE_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="substrateType"
                    value={option.value}
                    label={option.label}
                    checked={inputs.substrateType === option.value}
                    onChange={(e) =>
                      setInputs((current) => ({
                        ...current,
                        substrateType: e.target.value,
                      }))
                    }
                  />
                ))}
              </div>

              {inputs.substrateType === "rigidInsulation" ? (
                <Field label="What R-value is requested?">
                  <select value={inputs.requestedRValue} onChange={(e) => setField("requestedRValue", e.target.value)}>
                    {R_VALUE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        R-{value}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="TPO termination" subtitle="Choose the parapet or edge termination method first.">
        <div className="formStack">
          <div className="inputSection">
            <h3>How will the TPO terminate at parapet or roof edges?</h3>
            <div className="choiceRow">
              {TERMINATION_METHOD_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  name="terminationMethod"
                  value={option.value}
                  label={option.label}
                  checked={inputs.terminationMethod === option.value}
                  onChange={(e) =>
                    setInputs((current) => ({
                      ...current,
                      terminationMethod: e.target.value,
                    }))
                  }
                />
              ))}
            </div>

            {inputs.terminationMethod === "copingMetal" ? (
              <div className="formGrid">
                <Field label="Coping linear feet">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={inputs.copingLinearFeet}
                    onChange={(e) => setField("copingLinearFeet", e.target.value)}
                  />
                </Field>
                <Field label="Is cleat required?">
                  <select
                    value={inputs.copingCleatRequired ? "yes" : "no"}
                    onChange={(e) => setField("copingCleatRequired", e.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
            ) : null}

            {inputs.terminationMethod === "cladDripEdge" ? (
              <Field label="Drip edge linear feet">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={inputs.dripEdgeLinearFeet}
                  onChange={(e) => setField("dripEdgeLinearFeet", e.target.value)}
                />
              </Field>
            ) : null}

            {inputs.terminationMethod === "termBar" ? (
              <Field label="Term bar linear feet">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={inputs.termBarLinearFeet}
                  onChange={(e) => setField("termBarLinearFeet", e.target.value)}
                />
              </Field>
            ) : null}

            {inputs.terminationMethod === "existingMetal" ? (
              <Field label="Strip-in / detail allowance">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.stripInDetailAllowanceCost}
                  onChange={(e) => setField("stripInDetailAllowanceCost", e.target.value)}
                />
              </Field>
            ) : null}

            {inputs.terminationMethod === "otherManual" ? (
              <div className="formGrid">
                <Field label="Notes">
                  <textarea
                    rows="4"
                    value={inputs.terminationNotes}
                    onChange={(e) => setField("terminationNotes", e.target.value)}
                  />
                </Field>
                <Field label="Manual cost">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.manualTerminationCost}
                    onChange={(e) => setField("manualTerminationCost", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Roof Measurements" subtitle="Capture the roof field and parapet dimensions before detail pricing.">
        <div className="formGrid">
          <Field label="Total roof field SQs (no parapet wall measurements)">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.fieldSquares}
              onChange={(e) => setField("fieldSquares", e.target.value)}
            />
          </Field>
          <Field label="Total perimeter linear feet">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.roofPerimeterLf}
              onChange={(e) => setField("roofPerimeterLf", e.target.value)}
            />
          </Field>
          <Field label="Total parapet wall linear feet">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.parapetLinearFeet}
              onChange={(e) => setField("parapetLinearFeet", e.target.value)}
            />
          </Field>
          <Field label="Total parapet wall average height">
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputs.parapetWallHeight}
              onChange={(e) => setField("parapetWallHeight", e.target.value)}
            />
          </Field>
          <Field label="Include parapet walls in the material takeoff?">
            <select
              value={inputs.includeParapetWalls ? "yes" : "no"}
              onChange={(e) => setField("includeParapetWalls", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow
            label="Total parapet square feet"
            value={num(calculation.scope.parapetLinearFeet * calculation.scope.parapetWallHeight, 0)}
          />
        </div>
      </Section>

      <Section title="Material calculators" subtitle="These quantities are calculated from the scope and detail inputs.">
        <div className="formGrid">
          <Field label="Roof jacks">
            <input type="number" min="0" step="1" value={inputs.roofJacks} onChange={(e) => setField("roofJacks", e.target.value)} />
          </Field>
          <Field label="Vents / T-tops">
            <input type="number" min="0" step="1" value={inputs.ventsTtops} onChange={(e) => setField("ventsTtops", e.target.value)} />
          </Field>
          <Field label="Large penetrations around 2 ft">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.largePenetrations2ft}
              onChange={(e) => setField("largePenetrations2ft", e.target.value)}
            />
          </Field>
          <Field label="Very large penetrations around 4 ft">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.veryLargePenetrations4ft}
              onChange={(e) => setField("veryLargePenetrations4ft", e.target.value)}
            />
          </Field>
          <Field label="Drains">
            <input type="number" min="0" step="1" value={inputs.detailDrains} onChange={(e) => setField("detailDrains", e.target.value)} />
          </Field>
          <Field label="Scuppers">
            <input type="number" min="0" step="1" value={inputs.detailScuppers} onChange={(e) => setField("detailScuppers", e.target.value)} />
          </Field>
          <Field label="Pitch pockets">
            <input type="number" min="0" step="1" value={inputs.detailPitchPockets} onChange={(e) => setField("detailPitchPockets", e.target.value)} />
          </Field>
          <Field label="A/C detail units">
            <input type="number" min="0" step="1" value={inputs.detailAcUnits} onChange={(e) => setField("detailAcUnits", e.target.value)} />
          </Field>
          <Field label="A/C detail type">
            <select value={inputs.acDetailType} onChange={(e) => setField("acDetailType", e.target.value)}>
              {AC_DETAIL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Misc irregular details">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.miscIrregularDetails}
              onChange={(e) => setField("miscIrregularDetails", e.target.value)}
            />
          </Field>
          <Field label="Pitch pockets">
            <input type="number" min="0" step="1" value={inputs.pitchPockets} onChange={(e) => setField("pitchPockets", e.target.value)} />
          </Field>
          <Field label="T-joint patches">
            <input type="number" min="0" step="1" value={inputs.tJointPatches} onChange={(e) => setField("tJointPatches", e.target.value)} />
          </Field>
          <Field label="Vent boots">
            <input type="number" min="0" step="1" value={inputs.ventBoots} onChange={(e) => setField("ventBoots", e.target.value)} />
          </Field>
          <Field label="Manual pitch pocket total cost">
            <input
              type="number"
              min="0"
              step="0.01"
              value={inputs.manualPitchPocketTotalCost}
              onChange={(e) => setField("manualPitchPocketTotalCost", e.target.value)}
            />
          </Field>
          <Field label="Manual detail membrane rolls override">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.manualDetailMembraneRolls}
              onChange={(e) => setField("manualDetailMembraneRolls", e.target.value)}
            />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="5ft TPO perimeter rolls" value={num(calculation.scope.starterRolls, 0)} />
          <DetailRow label="10ft field rolls" value={num(calculation.scope.fieldRolls, 0)} />
          <DetailRow label="Parapet rolls" value={num(calculation.scope.parapetRolls, 0)} />
          <DetailRow label="Fanfold bundles" value={num(calculation.scope.fanfoldBundles, 0)} />
          <DetailRow label="Dense deck sheets" value={num(calculation.scope.denseDeckSheets, 0)} />
          <DetailRow label="Rigid insulation sheets" value={num(calculation.scope.rigidInsulationTotalSheets, 0)} />
          <DetailRow label="Parapet adhesive tanks" value={num(calculation.scope.parapetAdhesiveTanks, 0)} />
          <DetailRow label="Pitch pocket detail membrane sqft" value={num(calculation.pitchPocket.pitchPocketDetailMembraneSqft, 0)} />
          <DetailRow label="Detail membrane sqft" value={num(calculation.detailMembrane.totalDetailMembraneSqft, 0)} />
          <DetailRow label="Detail membrane rolls" value={num(calculation.detailMembrane.rollsNeeded, 0)} />
          <DetailRow label="Pitch pocket cost" value={money(calculation.pitchPocket.totalPitchPocketCost)} />
        </div>
      </Section>

      <Section title="A/C handling" subtitle="Count the units before you calculate the roof labor.">
        <div className="formGrid">
          <Field label="Total A/C units on roof">
            <input type="number" min="0" step="1" value={inputs.totalAcUnits} onChange={(e) => setField("totalAcUnits", e.target.value)} />
          </Field>
          <Field label="Units jacked / raised in place">
            <input type="number" min="0" step="1" value={inputs.jackedUnits} onChange={(e) => setField("jackedUnits", e.target.value)} />
          </Field>
          <Field label="Units worked around">
            <input type="number" min="0" step="1" value={inputs.workedAroundUnits} onChange={(e) => setField("workedAroundUnits", e.target.value)} />
          </Field>
          <Field label="Units craned / lifted off roof">
            <input type="number" min="0" step="1" value={inputs.cranedUnits} onChange={(e) => setField("cranedUnits", e.target.value)} />
          </Field>
          <Field label="Units requiring disconnect / reconnect">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.acDisconnectReconnectUnits}
              onChange={(e) => setField("acDisconnectReconnectUnits", e.target.value)}
            />
          </Field>
          <Field label="Is crane needed?">
            <select
              value={inputs.isCraneNeeded ? "yes" : "no"}
              onChange={(e) => setField("isCraneNeeded", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Total crane hours onsite">
            <input type="number" min="0" step="0.1" value={inputs.totalCraneHours} onChange={(e) => setField("totalCraneHours", e.target.value)} />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="A/C units raised cost" value={money(calculation.acHandling.acRaiseCost)} />
          <DetailRow label="A/C worked-around labor allowance" value={money(calculation.acHandling.acWorkedAroundLaborCost)} />
          <DetailRow label="Disconnect / reconnect cost" value={money(calculation.acHandling.acDisconnectReconnectCost)} />
          <DetailRow label="Crane base cost" value={money(calculation.acHandling.craneBaseCost)} />
          <DetailRow label="Extra crane hours" value={num(calculation.acHandling.extraCraneHours, 1)} />
          <DetailRow label="Total crane cost" value={money(calculation.acHandling.craneCost)} />
          <DetailRow label="Total A/C handling cost" value={money(calculation.acHandling.totalAcHandlingCost)} />
          <DetailRow label="A/C counts" value={calculation.acHandling.warning || "Counts match"} />
        </div>
      </Section>

      <Section title="Labor" subtitle="Choose who performs the labor and let the app calculate the labor cost.">
        <div className="inputSection">
          <h3>1. Who is doing the labor?</h3>
          <div className="choiceRow">
            {LABOR_TYPE_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="laborType"
                value={option.value}
                label={option.label}
                checked={inputs.laborType === option.value}
                onChange={(e) =>
                  setInputs((current) => ({
                    ...current,
                    laborType: e.target.value,
                    subcontractorLicenseStatus: e.target.value === "subcontractor" ? current.subcontractorLicenseStatus : "",
                  }))
                }
              />
            ))}
          </div>

          {inputs.laborType === "subcontractor" ? (
            <div className="formGrid" style={{ marginTop: 12 }}>
              <Field label="Is the subcontractor licensed?">
                <select value={inputs.subcontractorLicenseStatus} onChange={(e) => setField("subcontractorLicenseStatus", e.target.value)}>
                  <option value="">Choose one</option>
                  {LICENSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Labor rate per SQ">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputs.subcontractorLaborRatePerSq}
                  onChange={(e) => setField("subcontractorLaborRatePerSq", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {inputs.laborType === "subcontractor" ? (
            <div className="inputSection" style={{ marginTop: 12 }}>
              <h3>2. Is the sub-contractor charging extras for add-ons?</h3>
              <Field label="Extras for add-ons?">
                <select
                  value={inputs.subcontractorHasAddOns ? "yes" : "no"}
                  onChange={(e) => setField("subcontractorHasAddOns", e.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>

              {inputs.subcontractorHasAddOns ? (
                <div style={{ marginTop: 12 }}>
                  <div className="actionRow" style={{ marginBottom: 12 }}>
                    <button type="button" className="secondaryButton" onClick={handleAddSubcontractorLineItem}>
                      Want to include extra line items?
                    </button>
                  </div>

                  <div className="tableWrap">
                    <table className="dataTable">
                      <thead>
                        <tr>
                          <th>Add-on</th>
                          <th>Qty</th>
                          <th>Unit price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculation.labor.subcontractorAddOnItems.map((item, index) => {
                          const total = item.quantity * item.unitPrice;
                          return (
                            <tr key={`${item.description || "add-on"}-${index}`}>
                              <td>
                                <input
                                  className="tableInput"
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => setSubcontractorAddOnItem(index, "description", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className="tableInput"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.quantity}
                                  onChange={(e) => setSubcontractorAddOnItem(index, "quantity", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className="tableInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => setSubcontractorAddOnItem(index, "unitPrice", e.target.value)}
                                />
                              </td>
                              <td>{money(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {inputs.laborType === "inHouse" ? (
            <div className="formGrid" style={{ marginTop: 12 }}>
              <Field label="Number of workers">
                <input type="number" min="0" step="1" value={inputs.laborWorkers} onChange={(e) => setField("laborWorkers", e.target.value)} />
              </Field>
              <Field label="Hourly rate">
                <input type="number" min="0" step="0.01" value={inputs.laborHourlyRate} onChange={(e) => setField("laborHourlyRate", e.target.value)} />
              </Field>
              <Field label="Estimated hours per worker">
                <input type="number" min="0" step="0.1" value={inputs.laborHoursPerWorker} onChange={(e) => setField("laborHoursPerWorker", e.target.value)} />
              </Field>
              <Field label="Payroll burden percentage">
                <input type="number" min="0" step="0.1" value={inputs.payrollBurdenPercent} onChange={(e) => setField("payrollBurdenPercent", e.target.value)} />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Labor type" value={calculation.labor.laborType || "Not selected"} />
          {calculation.labor.laborType === "subcontractor" ? (
            <>
              <DetailRow label="Subcontractor licensed/unlicensed" value={calculation.labor.subcontractorLicenseStatus || "Not selected"} />
              <DetailRow label="Labor rate per SQ" value={money2(calculation.labor.subcontractorLaborRatePerSq)} />
              <DetailRow label="Base labor cost" value={money(calculation.labor.subLaborBase)} />
              {calculation.labor.workersCompCost > 0 ? <DetailRow label="Workers comp cost" value={money(calculation.labor.workersCompCost)} /> : null}
            </>
          ) : null}
          {calculation.labor.laborType === "inHouse" ? (
            <>
              <DetailRow label="Workers" value={num(calculation.labor.workers, 0)} />
              <DetailRow label="Hourly rate" value={money2(calculation.labor.hourlyRate)} />
              <DetailRow label="Hours per worker" value={num(calculation.labor.hoursPerWorker, 1)} />
              <DetailRow label="Payroll burden" value={`${num(calculation.labor.payrollBurdenPercent, 1)}%`} />
              <DetailRow label="Base payroll" value={money(calculation.labor.basePayroll)} />
              <DetailRow label="Payroll burden cost" value={money(calculation.labor.payrollBurden)} />
            </>
          ) : null}
          <DetailRow label="Total labor cost" value={money(calculation.labor.totalLaborCost)} />
          {calculation.labor.laborType === "subcontractor" && calculation.labor.subcontractorHasAddOns ? (
            <DetailRow label="Subcontractor add-on extras" value={money(calculation.labor.subcontractorAddOnTotal)} />
          ) : null}
        </div>
      </Section>

      <Section title="Travel & Overtime Cost" subtitle="Use Google Maps when available, with manual fallback always editable.">
        <div className="formGrid">
          <Field label="Company HQ address" hint="Default: CRT Roofing office in Fontana, CA">
            <input
              type="text"
              value={inputs.companyHqAddress}
              onChange={(e) => setTravelField("companyHqAddress", e.target.value)}
            />
          </Field>
          <Field label="Job site address">
            <input
              type="text"
              value={inputs.jobSiteAddress}
              onChange={(e) => setTravelField("jobSiteAddress", e.target.value)}
            />
          </Field>
          <div className="field" style={{ alignSelf: "end" }}>
            {!isLoaded && !loadError ? <em>Google Maps loading...</em> : null}
            {loadError ? <em>Google Maps failed to load: {loadError.message}</em> : null}
            <button type="button" className="secondaryButton" onClick={handleCalculateDistance} disabled={!isLoaded || isLookingUpDistance}>
              {isLookingUpDistance ? "Calculating..." : "Calculate Distance"}
            </button>
            <button type="button" className="secondaryButton" onClick={handleTestGoogleGeocoder} disabled={!isLoaded || isLookingUpDistance}>
              Test Google Geocoder
            </button>
            <button type="button" className="secondaryButton" onClick={handleTestDirections} disabled={!isLoaded || isLookingUpDistance}>
              Test Directions
            </button>
            {travelLookupMessage ? <em>{travelLookupMessage}</em> : null}
          </div>
          <Field label="One-way distance from HQ/shop to job site in miles">
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputs.oneWayMiles}
              onChange={(e) => setTravelField("oneWayMiles", e.target.value)}
            />
          </Field>
          <Field label="Average driving speed">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.averageDrivingSpeedMph}
              onChange={(e) => setTravelField("averageDrivingSpeedMph", e.target.value)}
            />
          </Field>
          <Field label="Driver hourly rate">
            <input
              type="number"
              min="0"
              step="0.01"
              value={inputs.travelDriverHourlyRate}
              onChange={(e) => setField("travelDriverHourlyRate", e.target.value)}
            />
            <em>Typical range $22-$32/hr</em>
          </Field>
          <Field label="Work hours per day">
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputs.workHoursPerDay}
              onChange={(e) => setField("workHoursPerDay", e.target.value)}
            />
          </Field>
          <Field label="Number of job days">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.numberOfJobDays}
              onChange={(e) => setField("numberOfJobDays", e.target.value)}
            />
          </Field>
          <Field label="Number of drivers">
            <input
              type="number"
              min="0"
              step="1"
              value={inputs.numberOfDrivers}
              onChange={(e) => setField("numberOfDrivers", e.target.value)}
            />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="HQ address" value={calculation.travelAndOvertime.companyHqAddress || "Not entered"} />
          <DetailRow label="Job site address" value={calculation.travelAndOvertime.jobSiteAddress || "Not entered"} />
          <DetailRow label="Source" value={calculation.travelAndOvertime.travelDistanceSource === "google" ? "Google Maps" : "Manual"} />
          <DetailRow label="One-way miles" value={num(calculation.travelAndOvertime.oneWayMiles, 1)} />
          <DetailRow label="Average speed" value={`${num(calculation.travelAndOvertime.averageDrivingSpeedMph, 1)} mph`} />
          <DetailRow label="One-way drive time" value={formatHoursMinutes(calculation.travelAndOvertime.oneWayDriveTimeHours)} />
          <DetailRow label="Round trip drive time" value={formatHoursMinutes(calculation.travelAndOvertime.roundTripDriveTime)} />
          <DetailRow label="Driver hourly rate" value={money2(calculation.travelAndOvertime.travelDriverHourlyRate)} />
          <DetailRow label="Overtime hours per day" value={`${num(calculation.travelAndOvertime.overtimeHoursPerDay, 2)} hrs`} />
          <DetailRow label="Overtime pay per day" value={money(calculation.travelAndOvertime.overtimePayPerDay)} />
          <DetailRow label="Total driver travel cost" value={money(calculation.travelAndOvertime.totalDriverTravelCost)} />
        </div>
        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="API key" value={googleDebug.apiKeyFound ? "Found" : "Missing"} />
          <DetailRow label="Maps JS loaded" value={String(googleDebug.mapsJsLoaded)} />
          <DetailRow label="DirectionsService available" value={String(googleDebug.directionsServiceAvailable)} />
          <DetailRow label="Last Google callback status" value={googleDebug.lastGoogleStatus} />
          <DetailRow label="Last element status" value={googleDebug.lastElementStatus} />
          <DetailRow label="Last Google error" value={googleDebug.lastError} />
        </div>
      </Section>

      <Section title="Overhead/Operating Cost" subtitle="Direct job cost gets loaded with overhead before markup is applied.">
        <div className="formGrid">
          <Field label="Overhead / operating rate">
            <input type="text" value={`${OVERHEAD_OPERATING_RATE}%`} readOnly />
          </Field>
          <Field label="Scope adders">
            <input type="number" min="0" step="0.01" value={inputs.scopeAdders} onChange={(e) => setField("scopeAdders", e.target.value)} />
          </Field>
          <Field label="Misc cost">
            <input type="number" min="0" step="0.01" value={inputs.miscCost} onChange={(e) => setField("miscCost", e.target.value)} />
          </Field>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Direct job cost" value={money(calculation.directJobCost)} />
          <DetailRow label="Overhead / operating cost" value={money(calculation.overheadOperatingCost)} />
          <DetailRow label="Total cost before profit" value={money(calculation.totalCostBeforeProfit)} />
        </div>
      </Section>

      <Section title="Bid options" subtitle="These are markup percentages, not gross margin percentages.">
        <div className="bidGrid">
          {calculation.bidOptions.options.map((option) => (
            <button
              key={option.percent}
              type="button"
              className={`bidCard ${option.percent === calculation.selectedMarkupPercent ? "active" : ""}`}
              onClick={() => handleSelectedMarkup(option.percent)}
            >
              <span className="bidCardTitle">{option.percent}% Markup</span>
              <strong>Bid: {money(option.bidAmount)}</strong>
              <span>$/SQ: {money2(option.pricePerSq)}</span>
              <span>Profit: {money(option.profitDollars)}</span>
            </button>
          ))}
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Selected markup percent" value={`${num(calculation.selectedMarkupPercent, 0)}%`} />
          <DetailRow label="Selected bid amount" value={money(calculation.selectedBidAmount)} />
          <DetailRow label="Selected price per SQ" value={money2(calculation.selectedPricePerSq)} />
          <DetailRow label="Selected profit dollars" value={money(calculation.selectedProfitDollars)} />
        </div>
      </Section>

      <Section title="Saved estimates" subtitle="Load or delete anything you saved in this browser.">
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
                    {money(estimate.summary?.selectedBidAmount ?? 0)} bid |{" "}
                    {num(estimate.summary?.selectedMarkupPercent ?? 0, 0)}% markup
                  </p>
                </div>

                <div className="savedActions">
                  <button type="button" className="secondaryButton" onClick={() => handleLoadEstimate(estimate)}>
                    Load
                  </button>
                  <button type="button" className="dangerButton" onClick={() => handleDeleteEstimate(estimate.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="emptyState">No saved estimates yet.</p>
          )}
        </div>
      </Section>

      <Section title="Material pricing" subtitle="Edit the unit prices. Leave anything at zero if you want to price it manually later.">
        <div className="formGrid">
          {priceFields.map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={prices[key]}
                onChange={(e) => setPriceField(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Calculated outputs" subtitle="These totals update automatically as you work through the estimate.">
        <div className="summaryGrid">
          <div className="summaryCard">
            <span>Material pricing</span>
            <strong>{money(calculation.materialCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Labor cost</span>
            <strong>{money(calculation.laborCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Travel &amp; Overtime cost</span>
            <strong>{money(calculation.totalTravelCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Overhead</span>
            <strong>{money(calculation.overheadOperatingCost)}</strong>
          </div>
          <div className="summaryCard">
            <span>Total cost</span>
            <strong>{money(calculation.totalCost)}</strong>
          </div>
        </div>

        <div className="detailList">
          <DetailRow label="Material cost" value={money(calculation.materialCost)} />
          <DetailRow label="Labor cost" value={money(calculation.laborCost)} />
          <DetailRow label="Tear-off cost" value={money(calculation.scope.totalTearOffCost)} />
          <DetailRow label="A/C handling cost" value={money(calculation.acHandlingCost)} />
          <DetailRow label="Travel & Overtime cost" value={money(calculation.totalTravelCost)} />
          <DetailRow label="Direct job cost" value={money(calculation.directJobCost)} />
          <DetailRow label="Overhead / operating rate" value={`${num(calculation.overheadOperatingRate * 100, 1)}%`} />
          <DetailRow label="Overhead cost" value={money(calculation.overheadOperatingCost)} />
          <DetailRow label="Total cost before profit" value={money(calculation.totalCostBeforeProfit)} />
          <DetailRow label="Total squares" value={num(calculation.scope.totalSquares, 0)} />
          <DetailRow label="Termination cost" value={money(calculation.terminationCost)} />
          <DetailRow label="Pitch pocket cost" value={money(calculation.pitchPocketCost)} />
        </div>
      </Section>

      <Section title="Material Cost Breakdown" subtitle="Each quantity comes from the TPO logic and each unit price is editable.">
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Material</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Unit price</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {calculation.materialPricing.items.map((item) => (
                <tr key={item.key}>
                  <td>
                    <div>
                      <strong>{item.label}</strong>
                      {item.notes ? <div className="smallNote">{item.notes}</div> : null}
                    </div>
                  </td>
                  <td>{num(item.quantity, 0)}</td>
                  <td>{item.unit}</td>
                  <td>{money2(item.unitPrice)}</td>
                  <td>{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="detailList" style={{ marginTop: 14 }}>
          <DetailRow label="Detail membrane sqft" value={num(calculation.detailMembrane.totalDetailMembraneSqft, 0)} />
          <DetailRow label="Detail membrane rolls" value={num(calculation.detailMembrane.rollsNeeded, 0)} />
          <DetailRow label="Detail membrane cost" value={money(calculation.detailMembrane.detailMembraneCost)} />
          <DetailRow label="Pitch pocket total cost" value={money(calculation.pitchPocket.totalPitchPocketCost)} />
          <DetailRow label="Material cost per square" value={money2(calculation.materialPricing.costPerSquare)} />
        </div>
      </Section>

      <Section
        title="Save Estimate"
        subtitle="Local save/load/delete. The current estimate stays in this browser profile."
        right={
          <div className="actionRow">
            <button type="button" className="primaryButton" onClick={handleSaveEstimate}>
              Save estimate
            </button>
            <button type="button" className="secondaryButton" onClick={handleLogout}>
              Log out
            </button>
          </div>
        }
      >
        <div className="formGrid">
          <Field label="Estimate name">
            <input
              type="text"
              value={estimateName}
              onChange={(e) => setEstimateName(e.target.value)}
              placeholder={buildEstimateName(inputs)}
            />
          </Field>

          <div className="summaryCard">
            <span>Estimate status</span>
            <strong>{estimateStatusLabel}</strong>
            <p>{isEstimateComplete ? "Required scope values are filled in." : "Review the checklist before final bid."}</p>
          </div>

          <div className="summaryCard">
            <span>Selected bid</span>
            <strong>{money(calculation.selectedBidAmount)}</strong>
            <p>
              {num(calculation.selectedMarkupPercent, 0)}% markup and {money2(calculation.selectedPricePerSq)} per SQ.
            </p>
          </div>
        </div>

        {sessionMessage ? <p className="statusMessage">{sessionMessage}</p> : null}
      </Section>

      <Section title="Missing Scope Checklist" subtitle="Clear these items before you treat the bid as final.">
        {missingScopeChecklist.length ? (
          <div className="checklistList">
            {missingScopeChecklist.map((item) => (
              <div className="checklistItem" key={item.label}>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="checklistEmpty">All required scope items are filled in. The estimate is ready for bid.</div>
        )}
      </Section>
    </div>
  );
}

export default App;
