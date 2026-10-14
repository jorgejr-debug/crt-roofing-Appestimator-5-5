export async function validSignature(raw, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || "")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g), x => parseInt(x, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(raw));
}

export function leadEvents(payload, pageId, formId) {
  if (payload?.object !== "page") return [];
  return (payload.entry || []).flatMap(entry => String(entry.id) !== pageId ? [] :
    (entry.changes || []).filter(c => c.field === "leadgen" && String(c.value?.form_id) === formId)
      .map(c => c.value).filter(v => /^\d+$/.test(String(v.leadgen_id))));
}

export function mapMetaLead(lead, propertyField) {
  const fields = Object.fromEntries((lead.field_data || []).map(f => [f.name, (f.values || []).join(", ")]));
  const propertyType = fields[propertyField] || "";
  return {
    contact_name: fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(" "),
    phone: fields.phone_number || "", email: fields.email || "",
    quick_note: `Meta inquiry — review before assigning an inspection.\nProperty type: ${propertyType || "Not supplied"}`,
    lead_payload: { propertyType, internalNotes: `Meta lead ID: ${lead.id}\nForm ID: ${lead.form_id || ""}\nAd ID: ${lead.ad_id || ""}` },
  };
}
