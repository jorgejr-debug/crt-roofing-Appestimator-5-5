import { PROPOSAL_REQUEST_FILE_ACCEPT, validateProposalRequestAttachment } from './proposalRequestAttachments.js';
export const TASK_ATTACHMENT_BUCKET = 'task-attachments';
export const TASK_ATTACHMENT_ACCEPT = PROPOSAL_REQUEST_FILE_ACCEPT;
export const TASK_FILE_OPTIONS = {bucket:TASK_ATTACHMENT_BUCKET,table:'company_task_attachments',foreignKey:'task_id',rpc:'register_task_attachment',parameter:'p_task_id'};
export const INSPECTION_FILE_OPTIONS = {bucket:'inspection-attachments',table:'inspection_request_attachments',foreignKey:'inspection_request_id',rpc:'register_inspection_attachment',parameter:'p_inspection_request_id'};
export const validateTaskAttachment = validateProposalRequestAttachment;
export function createTaskUpload(taskId, userId, file, id = crypto.randomUUID()) {
  const extension = String(file.name).split('.').pop().toLowerCase();
  return { id, file, path: `${taskId}/${userId}/${id}.${extension}`, uploaded: false, error: '' };
}
export async function saveTaskAttachment(supabase, taskId, upload, options = TASK_FILE_OPTIONS) {
  const invalid = validateTaskAttachment(upload.file); if (invalid) throw new Error(invalid);
  if (!upload.uploaded) {
    const { error } = await supabase.storage.from(options.bucket).upload(upload.path, upload.file, { upsert: false });
    // A retry may find the object uploaded before a lost response. Registration
    // verifies the owner, exact path and real object metadata server-side.
    if (error && !['409', 'Duplicate'].includes(String(error.statusCode || error.error))) throw error;
    upload.uploaded = true;
  }
  const { data, error } = await supabase.rpc(options.rpc, {
    [options.parameter]: taskId, p_id: upload.id, p_storage_path: upload.path,
    p_file_name: upload.file.name, p_file_size: upload.file.size,
  });
  if (error) throw error;
  return data;
}
