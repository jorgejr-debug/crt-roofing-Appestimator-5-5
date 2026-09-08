export const APPROVED_JOB_ATTACHMENT_BUCKET = "approved-job-attachments";
export const APPROVED_JOB_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safePathPart(value, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

export function validateApprovedJobAttachment(file) {
  if (!file) return "Choose a file to upload.";
  if (Number(file.size || 0) > APPROVED_JOB_ATTACHMENT_MAX_BYTES) {
    return `${file.name || "File"} is larger than 15 MB.`;
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(String(file.type || "").toLowerCase())) {
    return `${file.name || "File"} must be a JPG, PNG, WebP, HEIC, PDF, DOC, or DOCX file.`;
  }
  return "";
}

export function buildApprovedJobAttachmentPath({ userId, jobId, dayId, fileName, timestamp = Date.now() }) {
  return [
    safePathPart(userId, "user"),
    safePathPart(jobId, "job"),
    safePathPart(dayId, "day"),
    `${timestamp}-${safePathPart(fileName, "attachment")}`,
  ].join("/");
}

export function createApprovedJobAttachmentRecord(file, storagePath, options = {}) {
  return {
    id: String(options.id || `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    fileName: String(file?.name || "Attachment"),
    storagePath: String(storagePath || ""),
    contentType: String(file?.type || "application/octet-stream"),
    fileSize: Math.max(0, Number(file?.size || 0)),
    uploadedAt: String(options.uploadedAt || new Date().toISOString()),
    uploadedBy: String(options.uploadedBy || ""),
  };
}

export function formatAttachmentSize(bytes) {
  const size = Math.max(0, Number(bytes || 0));
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}
