// Server RLS supplies the permitted set: own logs plus submitted crew logs for
// office reviewers. Do not impose an owner filter that hides those submissions.
export async function fetchAccessibleFieldLogRows(client) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await client.from("field_daily_logs").select("*")
      .order("work_date", { ascending: false }).order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) return { data: [], error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
  return { data: [], error: new Error("Too many daily logs to load. Contact the office for a date-limited review.") };
}

// Shared crew records and signed photo URLs are not persisted as offline copies.
export function ownFieldLogsForCache(logs, userKey) {
  return logs.filter(log => !log.ownerUserKey || log.ownerUserKey === userKey);
}
