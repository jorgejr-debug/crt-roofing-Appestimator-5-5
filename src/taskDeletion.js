export const TASK_DELETE_CONFIRMATION = "Are you sure you want to delete this task? Once deleted, you won't be able to access it again.";

export function canDeleteTask(task, userId) {
  return Boolean(task?.id && userId && task.created_by === userId);
}
