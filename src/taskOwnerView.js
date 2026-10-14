// UI eligibility only; database SELECT policies verify the authenticated owner.
export function canShowOwnerTaskView(user) {
  return String(user?.email || '').trim().toLowerCase() === 'jorgejr@crtroofing.com'
    && ['admin', 'cfo'].includes(String(user?.role || '').trim().toLowerCase());
}
export function selectOwnerTasks(tasks, assignees, employeeId = '') {
  return employeeId ? tasks.filter(task => assignees.some(a => a.task_id === task.id && a.user_id === employeeId)) : tasks;
}
