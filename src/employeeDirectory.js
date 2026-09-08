export function resolveEmployeeDisplayName(employee = {}) {
  const firstName = String(employee.firstName || employee.first_name || "").trim();
  const lastName = String(employee.lastName || employee.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    fullName ||
    String(employee.displayName || employee.display_name || "").trim() ||
    String(employee.employeeName || employee.employee_name || employee.name || "").trim() ||
    ""
  );
}
