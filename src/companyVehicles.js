export function normalizeCompanyVehicle(row = {}, fallback = {}) {
  const rawMpg = Number(row.mpg ?? fallback.mpg ?? 0);
  return {
    id: String(row.id || row.value || fallback.id || fallback.value || ""),
    vehicleName: String(row.vehicle_name || row.vehicleName || row.name || row.label || fallback.vehicleName || fallback.label || ""),
    unitNumber: String(row.unit_number || row.unitNumber || row.unit || fallback.unitNumber || ""),
    licensePlate: String(row.license_plate || row.licensePlate || row.plate || fallback.licensePlate || ""),
    mpg: Number.isFinite(rawMpg) ? Math.max(0, rawMpg) : 0,
    active: row.active !== false && row.active !== "false",
    vehicleType: String(row.vehicle_type || row.vehicleType || row.value || fallback.vehicleType || fallback.value || ""),
  };
}

export function isMissingVehicleTable(error) {
  return ["PGRST205", "42P01"].includes(error?.code) && /company_vehicles/i.test(error?.message || "");
}
