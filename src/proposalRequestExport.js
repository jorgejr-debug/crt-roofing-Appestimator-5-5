import jsPdfModule from "jspdf";
import JSZip from "jszip";

const JsPDF = jsPdfModule.jsPDF || jsPdfModule.default?.jsPDF || jsPdfModule.default || jsPdfModule;

const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

export function safeExportName(value, fallback = "Proposal-Request") {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[^a-z0-9._ -]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
  return cleaned || fallback;
}

export function proposalRequestExportBase(request = {}) {
  const number = request.request_number ? `PR-${request.request_number}` : "Proposal-Request";
  const job = request.property_name || request.customer_name || request.service_address || "Job";
  return safeExportName(`${number}-${job}`);
}

function printable(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value ?? "").trim();
  return (text || "Not provided")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function addWrapped(doc, state, text, options = {}) {
  const fontSize = options.fontSize || 10;
  const lineHeight = options.lineHeight || 5;
  const width = options.width || CONTENT_WIDTH;
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...(options.color || [16, 37, 54]));
  const lines = doc.splitTextToSize(printable(text), width);
  const needed = Math.max(lineHeight, lines.length * lineHeight);
  if (state.y + needed > PAGE_HEIGHT - 18) {
    doc.addPage();
    state.y = 18;
  }
  doc.text(lines, options.x || MARGIN, state.y);
  state.y += needed + (options.after ?? 1.5);
}

function addSectionHeading(doc, state, title) {
  if (state.y > PAGE_HEIGHT - 32) { doc.addPage(); state.y = 18; }
  doc.setFillColor(229, 244, 253);
  doc.roundedRect(MARGIN, state.y - 5, CONTENT_WIDTH, 10, 2, 2, "F");
  addWrapped(doc, state, title, { bold: true, fontSize: 11, lineHeight: 5, x: MARGIN + 3, width: CONTENT_WIDTH - 6, after: 3 });
}

function addField(doc, state, label, value) {
  addWrapped(doc, state, label.toUpperCase(), { bold: true, fontSize: 7.5, lineHeight: 4, color: [54, 91, 116], after: 0 });
  addWrapped(doc, state, printable(value), { fontSize: 9.5, lineHeight: 4.8, after: 2.5 });
}

export function createProposalRequestPdf({ request = {}, salespersonName = "", fieldGroups = [], attachments = [] } = {}) {
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: true });
  const state = { y: 18 };
  doc.setFillColor(4, 126, 196);
  doc.rect(0, 0, PAGE_WIDTH, 11, "F");
  addWrapped(doc, state, "CRT ROOFING - PROPOSAL REQUEST", { bold: true, fontSize: 16, lineHeight: 7, after: 1 });
  addWrapped(doc, state, `${request.request_number ? `PR-${request.request_number}` : "Proposal Request"} | ${printable(request.property_name || request.customer_name)}`, { bold: true, fontSize: 12, lineHeight: 6, color: [4, 126, 196], after: 1 });
  addWrapped(doc, state, `Prepared from the sales intake submitted ${request.submitted_at ? new Date(request.submitted_at).toLocaleString() : "date not available"}.`, { fontSize: 8.5, lineHeight: 4.5, color: [82, 111, 131], after: 4 });

  addSectionHeading(doc, state, "Request Setup");
  const setup = [
    ["Assigned salesperson", salespersonName || "Not assigned"],
    ["Job type", String(request.job_type || "").replaceAll("_", " ")],
    ["Priority", request.priority],
    ["Customer deadline", request.customer_deadline],
    ["Estimated crew size", request.estimated_crew_size],
    ["Estimated working days", request.estimated_working_days],
    ["Target price", request.target_price === null || request.target_price === "" ? "Not provided" : `$${Number(request.target_price || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ["Deposit required", Boolean(request.deposit_required)],
  ];
  setup.forEach(([label, value]) => addField(doc, state, label, value));

  fieldGroups.forEach(([title, fields]) => {
    addSectionHeading(doc, state, title);
    fields.forEach(([key, label]) => addField(doc, state, label, request[key]));
  });

  addSectionHeading(doc, state, `Attachments (${attachments.length})`);
  if (attachments.length) attachments.forEach((item, index) => addField(doc, state, `File ${index + 1}`, item.file_name || "Unnamed attachment"));
  else addWrapped(doc, state, "No attachments were included with this request.", { fontSize: 9.5 });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(185, 220, 245);
    doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(82, 111, 131);
    doc.text(`CRT Roofing Proposal Request | Page ${page} of ${pages}`, MARGIN, PAGE_HEIGHT - 7);
  }
  return doc.output("arraybuffer");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadProposalRequestPdf(options) {
  const base = proposalRequestExportBase(options.request);
  const pdf = createProposalRequestPdf(options);
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `${base}-Proposal-Request.pdf`);
}

export async function createProposalRequestZip({ supabase, request, salespersonName, fieldGroups, attachments = [] }) {
  const base = proposalRequestExportBase(request);
  const zip = new JSZip();
  const folder = zip.folder(base);
  folder.file(`${base}-Proposal-Request.pdf`, createProposalRequestPdf({ request, salespersonName, fieldGroups, attachments }));
  const attachmentFolder = folder.folder("Attachments");
  const usedNames = new Set();
  for (const [index, item] of attachments.entries()) {
    const { data, error } = await supabase.storage.from("proposal-request-files").createSignedUrl(item.storage_path, 300);
    if (error || !data?.signedUrl) throw error || new Error(`Unable to access ${item.file_name || "an attachment"}.`);
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error(`Unable to download ${item.file_name || "an attachment"}.`);
    let name = safeExportName(item.file_name, `Attachment-${index + 1}`);
    if (usedNames.has(name.toLowerCase())) name = `${index + 1}-${name}`;
    usedNames.add(name.toLowerCase());
    attachmentFolder.file(name, await response.arrayBuffer());
  }
  folder.file("README.txt", `CRT Roofing Proposal Request ${request.request_number || ""}\nJob: ${printable(request.property_name || request.customer_name)}\nAttachments included: ${attachments.length}\n`);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function downloadProposalRequestZip(options) {
  const base = proposalRequestExportBase(options.request);
  const blob = await createProposalRequestZip(options);
  downloadBlob(blob, `${base}-Complete-Package.zip`);
}
