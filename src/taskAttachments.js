import { PROPOSAL_REQUEST_FILE_ACCEPT, validateProposalRequestAttachment } from './proposalRequestAttachments.js';
export const TASK_ATTACHMENT_BUCKET = 'task-attachments';
export const TASK_ATTACHMENT_ACCEPT = PROPOSAL_REQUEST_FILE_ACCEPT;
export const validateTaskAttachment = validateProposalRequestAttachment;
export function createTaskUpload(taskId, userId, file, id = crypto.randomUUID()) {
  const extension = String(file.name).split('.').pop().toLowerCase();
  return { id, file, path: `${taskId}/${userId}/${id}.${extension}`, uploaded: false, error: '' };
}
export async function saveTaskAttachment(supabase, taskId, upload) {
  const invalid = validateTaskAttachment(upload.file); if (invalid) throw new Error(invalid);
  if (!upload.uploaded) {
    const { error } = await supabase.storage.from(TASK_ATTACHMENT_BUCKET).upload(upload.path, upload.file, { upsert: false });
    // A retry may find the object uploaded before a lost response. Registration
    // verifies the owner, exact path and real object metadata server-side.
    if (error && !['409', 'Duplicate'].includes(String(error.statusCode || error.error))) throw error;
    upload.uploaded = true;
  }
  const { data, error } = await supabase.rpc('register_task_attachment', {
    p_task_id: taskId, p_id: upload.id, p_storage_path: upload.path,
    p_file_name: upload.file.name, p_file_size: upload.file.size,
  });
  if (error) throw error;
  return data;
}
