import fs from 'node:fs';
const source=fs.readFileSync('src/App.jsx','utf8');
// Isolated fixture support: real render/calculation helpers, no app or database.
const support=source.slice(0,source.indexOf('function App()')).replace('const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);','const supabase = null;');
fs.writeFileSync('src/.mobilePreviewSupport.jsx',support+'\nexport { css, Field, Section, TravelCalculator, OverheadCalculator, calculateTravelAndOvertime, calculateBidOptions, DEFAULT_INPUTS, money2 };\n');
const modalStart=source.indexOf('  const renderActiveJobIssueModal = () => {');
const modalEnd=source.indexOf('\n  const renderInvoiceHandoffModal',modalStart);
let modal=source.slice(modalStart,modalEnd).replace('  const renderActiveJobIssueModal = () => {','export default function IssueModalPreview({workspace}) {\n const {activeJobIssueModalOpen,activeJobs,activeJobIssueDraft,activeJobSelectedId,selectedActiveJob,employeeDirectory,closeActiveJobIssueModal,activeJobIssueSaving,saveActiveJobIssue,Field,setActiveJobIssueDraft,ACTIVE_JOB_ISSUE_CATEGORIES,ACTIVE_JOB_ISSUE_PRIORITIES,ACTIVE_JOB_ISSUE_STATUSES,activeJobIssueResponse,setActiveJobIssueResponse,buildActiveJobSuggestedResponse,activeJobIssueHistory,activeJobIssueHistoryError} = workspace;');
fs.writeFileSync('src/.mobileIssuePreview.jsx',modal);
fs.appendFileSync('src/.mobilePreviewSupport.jsx','\nexport { ACTIVE_JOB_ISSUE_CATEGORIES, ACTIVE_JOB_ISSUE_PRIORITIES, ACTIVE_JOB_ISSUE_STATUSES };\n');
