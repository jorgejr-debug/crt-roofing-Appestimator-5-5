const lower = value => String(value || '').trim().toLowerCase();
const closed = value => ['completed','closed','archived','deleted'].includes(lower(value));
const dateTime = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
/**
 * @param {{jobs?: Array<Record<string, any>>, logs?: Array<Record<string, any>>, estimates?: Array<Record<string, any>>, proposals?: Array<Record<string, any>>, invoices?: Array<Record<string, any>>, receivables?: Array<Record<string, any>>}} data
 * @param {Date} now
 * @param {{timezone?: string, dailyLogHour?: number, proposalWaitingDays?: number, dailyLogsAvailable?: boolean}} options
 */
export function collectWorkflowAlerts({ jobs = [], logs = [], estimates = [], proposals = [], invoices = [], receivables = [] }, now = new Date(), options = {}) {
  const timezone = options.timezone || 'America/Los_Angeles';
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const currentHour = Number(new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'numeric',hourCycle:'h23'}).format(now));
  const tomorrow = new Date(Date.parse(today+'T12:00:00Z') + 86400000).toISOString().slice(0,10);
  const weekday = new Date(today+'T12:00:00Z').getUTCDay();
  const alerts = [];
  const add = (source, kind, message, audience='operations', recipients=[], discriminator='') => alerts.push({ event_key:`${kind}:${source}:${discriminator}:${today}`, source_record_uid:source, kind, message, audience, recipients });
  for (const row of jobs) {
    const job = {...row.job_payload};
    if (row.workflow_status !== 'active' || closed(row.status) || row.is_active === false) continue;
    const source = row.source_record_uid;
    const name = row.project_name || row.job_name || row.job_number || source;
    for (const issue of Array.isArray(job.issues) ? job.issues : []) {
      if (['resolved','closed'].includes(lower(issue.status))) continue;
      const deadline = dateTime(issue.followUpDeadline);
      if (deadline !== null && deadline < now.getTime()) add(source,'issue_overdue',`Issue ${issue.issueNumber || issue.id} on ${name} is overdue. Owner: ${issue.assignedEmployeeName || 'Unassigned'}.`,'issue',[{employeeId:issue.assignedEmployeeId}],issue.id);
      else if (['critical','emergency','high'].includes(lower(issue.priority))) add(source,'serious_issue',`Serious issue ${issue.issueNumber || issue.id} on ${name} remains open.`,'issue',[{employeeId:issue.assignedEmployeeId}],issue.id);
    }
    const start = String(job.startDate || job.anticipatedStartDate || row.start_date || row.anticipated_start_date || '').slice(0,10);
    const jobLogs = logs.filter(log => row.job_number && log.job_number === row.job_number && lower(log.status) === 'submitted');
    const progress = Array.isArray(job.dailyProgressLog) ? job.dailyProgressLog : Array.isArray(row.daily_progress_log) ? row.daily_progress_log : [];
    const started = jobLogs.length > 0 || progress.length > 0 || positive(job.percentComplete ?? row.percent_complete)>0 || ['active','in progress'].includes(lower(row.status));
    const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start) && dateTime(start) !== null;
    if (validStart && !started && start >= today && start <= tomorrow) add(source,'start_approaching',`Production starts ${start} for ${name}. Confirm crew and readiness.`);
    if (validStart && !started && start < today) add(source,'start_missed',`Production start ${start} was missed for ${name}. Confirm the schedule.`);
    if (options.dailyLogsAvailable !== false && started && validStart && start <= today && weekday>0 && weekday<6 && currentHour >= (options.dailyLogHour ?? 18) && !jobLogs.some(log => log.work_date === today) && !progress.some(day => day.date === today)) add(source,'daily_log_missing',`No submitted daily log for ${name} on ${today}.`);
    const estimate = estimates.find(item => [row.estimate_id,row.local_estimate_id,job.estimateId,job.localEstimateId].filter(Boolean).some(id => id === item.id || id === item.local_estimate_id) || (row.estimate_code && row.estimate_code === item.estimate_code));
    const inputs = estimate?.estimate_data?.inputs || estimate?.inputs || {};
    const summary = estimate?.estimate_data?.summary || estimate?.summary || {};
    const estimatedDays = positive(inputs.numberOfJobDays || inputs.sprayFoamEstimatedCompletionDays || inputs.shingleTotalDaysOnJob || inputs.tileTotalDaysOnJob);
    const actualDays = new Set([...jobLogs.map(log => log.work_date),...progress.map(day => day.date)].filter(Boolean)).size;
    if (estimatedDays && actualDays > estimatedDays) add(source,'days_exceeded',`${name} has ${actualDays} logged days against ${estimatedDays} estimated days.`);
    const estimatedCost = positive(summary.totalCostBeforeProfit);
    const actualCost = positive(job.actualCost ?? row.actual_cost);
    if (estimatedCost && actualCost>estimatedCost) add(source,'cost_exceeded',`${name} is above its estimated cost. Review the job cost report.`,'finance');
  }
  for (const proposal of proposals) {
    if (lower(proposal.status) === 'sent') {
      const sentAt = dateTime(proposal.sent_at);
      if (sentAt !== null && now.getTime() >= sentAt + 3 * 86400000 && proposal.salesperson_id) {
        add(proposal.id,'sales_follow_up',`Follow up with ${proposal.customer_name || proposal.property_name || 'the customer'} about proposal ${proposal.request_number || proposal.id}. It was sent at ${proposal.sent_at} and is awaiting a decision.`,'sales',[{userId:proposal.salesperson_id}]);
      }
      continue;
    }
    if (['draft','signed','declined','closed'].includes(lower(proposal.status))) continue;
    const due = dateTime(proposal.manual_target_at || proposal.target_completion_at);
    const since = dateTime(proposal.updated_at || proposal.submitted_at);
    if (proposal.sla_paused_at) continue;
    const overdue = due !== null ? due < now.getTime() : since !== null && now.getTime()-since > (options.proposalWaitingDays ?? 3)*86400000;
    if(overdue) add(proposal.id,'proposal_waiting',`Proposal request ${proposal.request_number || proposal.id} is waiting for action (${proposal.status}).`,'proposal',[{userId:proposal.assigned_estimator_id},{userId:proposal.salesperson_id}]);
  }
  for(const invoice of invoices) if (['sent','partially paid'].includes(lower(invoice.status)) && invoice.due_date && invoice.due_date < today) add(invoice.source_record_uid || invoice.id,'invoice_overdue',`Invoice ${invoice.invoice_number || invoice.id} is overdue (${invoice.due_date}).`,'finance');
  for(const entry of receivables) if (!entry.is_archived && lower(entry.status)!=='paid' && positive(entry.amount) && lower(entry.status)==='overdue') add(entry.source_record_uid || entry.id,'receivable_overdue',`Receivable for ${entry.customer_name || entry.record_name || 'customer'} is overdue.`,'finance');
  return alerts;
}
/** @returns {string[]} */
export function notificationRecipients(alert, profiles, employees=[]) {
  const explicit = new Set((alert.recipients || []).flatMap(recipient => recipient.userId ? [recipient.userId] : profiles.filter(profile => lower(profile.email) === lower(employees.find(employee => employee.id === recipient.employeeId)?.email) && profile.email).map(profile => profile.id)));
  return profiles.filter(profile => {
    const role = lower(profile.role);
    if(alert.audience === 'sales') return explicit.has(profile.id);
    const office = ['jorgejr@crtroofing.com','natalia@crtroofing.com'].includes(lower(profile.email));
    if(alert.audience === 'finance') return office || ['admin','cfo'].includes(role);
    return office || explicit.has(profile.id) || (alert.audience === 'operations' && ['admin','cfo','project_manager'].includes(role)) || (alert.audience === 'proposal' && ['admin','cfo'].includes(role));
  }).map(profile => profile.id);
}
