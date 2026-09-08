export const PROPOSAL_REQUEST_FILE_MAX_BYTES = 25 * 1024 * 1024;

export const PROPOSAL_REQUEST_FILE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
].join(",");

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]);

export function validateProposalRequestAttachment(file) {
  if (!file) return "Choose a photo or document to upload.";
  if (Number(file.size || 0) > PROPOSAL_REQUEST_FILE_MAX_BYTES) return `${file.name || "This file"} is larger than 25 MB.`;
  const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  if (!allowedExtensions.has(extension)) return `${file.name || "This file"} is not a supported photo or document.`;
  return "";
}

export function proposalRequestAttachmentCategory(file) {
  return String(file?.type || "").startsWith("image/") ? "photo" : "other";
}

export function buildProposalRequestAttachmentPath(requestId, fileName, uniqueId) {
  const safeName = String(fileName || "attachment").replace(/[^a-z0-9._-]/gi, "_");
  return `${requestId}/${uniqueId}-${safeName}`;
}
