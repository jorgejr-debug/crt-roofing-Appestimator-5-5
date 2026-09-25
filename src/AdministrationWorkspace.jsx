export default function AdministrationWorkspace({ workspace }) {
 const { DetailRow, Field, LOGO_SRC, Section, SubcontractorCompliance, activeEmployeeDrivers, activeFieldOperationEmployees, activeFieldOperationForemen, authUser, buildEmployeeDisplayName, calculateLoadedHourlyWage, css, editEmployeeRecord, employeeDirectory, employeeManagementDraft, employeeManagementEditorRef, employeeManagementSearch, getAccountTitle, handleNumberInputWheel, isFinanceUser, money2, num, saveEmployeeDraft, setActiveTemplate, setEmployeeManagementSearch, startNewEmployeeDraft, supabase, supplierPaymentHistory, toNumber, updateEmployeeDraftField } = workspace;

    const query = employeeManagementSearch.trim().toLowerCase();
    const filteredEmployees = employeeDirectory.filter((employee) => {
      if (!query) return true;
      const haystack = [
        employee.firstName,
        employee.lastName,
        employee.displayName,
        employee.occupation,
        employee.department,
        employee.employeeNumber,
        employee.phone,
        employee.email,
        employee.payrollId,
        employee.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    const draftWageBreakdown = calculateLoadedHourlyWage(employeeManagementDraft.hourlyRate);
    const isEditingEmployee = employeeDirectory.some((employee) => employee.id === employeeManagementDraft.id);
    return (
      <div className="appShell">
        <style>{css}</style>
        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Administration</p>
                <h1>Administration</h1>
                <p className="intro">Manage employee records and review supplier payment history.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
            <p>{getAccountTitle()}</p>
          </div>
        </header>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard")}>
            Back to dashboard
          </button>
          {isFinanceUser ? (
            <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("adminPricing")}>
              Open Admin Pricing
            </button>
          ) : null}
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("accountAccess")}>Account Access</button>
        </div>

        <Section title="Supplier Payment History" subtitle="A permanent record of supplier invoices marked paid from the CFO dashboard.">
          {supplierPaymentHistory.length ? (
            <div className="cfoDetailTableWrap">
              <table className="cfoDetailTable">
                <thead>
                  <tr>
                    <th>Supplier / invoice</th>
                    <th>Amount paid</th>
                    <th>Date paid</th>
                    <th>Method / reference</th>
                    <th>Payment</th>
                    <th>Remaining balance</th>
                    <th>Recorded by</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPaymentHistory.map((payment) => {
                    const recordedAt = payment.recorded_at ? new Date(payment.recorded_at) : null;
                    const methodReference = payment.payment_method === "Check"
                      ? `Check #${payment.check_number || "not provided"}`
                      : payment.payment_method || "—";
                    return (
                      <tr key={payment.id}>
                        <td>{payment.supplier_name || "—"}</td>
                        <td>{money2(toNumber(payment.amount_paid, 0))}</td>
                        <td>{payment.payment_date || "—"}</td>
                        <td>{methodReference}</td>
                        <td>{payment.payment_kind || "—"}</td>
                        <td>{money2(toNumber(payment.balance_after, 0))}</td>
                        <td>{payment.recorded_by_name || "Finance user"}{recordedAt && !Number.isNaN(recordedAt.getTime()) ? ` · ${recordedAt.toLocaleString()}` : ""}</td>
                        <td>{payment.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="emptyState">No supplier payments have been recorded yet.</p>
          )}
        </Section>

        <Section title="Employee Management" subtitle="Add, edit, and activate employees used in Field Operations, Office, Sales, and Management.">
          <div className="detailList" style={{ marginBottom: 14 }}>
            <DetailRow label="Active employees" value={num(employeeDirectory.filter((employee) => employee.isActive).length, 0)} />
            <DetailRow label="Field Operations employees" value={num(activeFieldOperationEmployees.length, 0)} />
            <DetailRow label="Foremen" value={num(activeFieldOperationForemen.length, 0)} />
            <DetailRow label="Drivers" value={num(activeEmployeeDrivers.length, 0)} />
          </div>

          <div ref={employeeManagementEditorRef} className="actionRow" style={{ marginBottom: 12, scrollMarginTop: 20 }}>
            <button type="button" className="primaryButton" onClick={startNewEmployeeDraft}>
              + Add employee
            </button>
            <button type="button" className="secondaryButton" onClick={saveEmployeeDraft}>
              {isEditingEmployee ? "Update employee" : "Save employee"}
            </button>
          </div>

          {isEditingEmployee ? (
            <p className="smallNote" style={{ marginTop: 0 }}>
              Editing {buildEmployeeDisplayName(employeeManagementDraft) || "employee"}. Make the changes below, then select Update employee.
            </p>
          ) : null}

          <div className="formGrid">
            <Field label="First Name">
              <input type="text" value={employeeManagementDraft.firstName} onChange={(e) => updateEmployeeDraftField("firstName", e.target.value)} />
            </Field>
            <Field label="Last Name">
              <input type="text" value={employeeManagementDraft.lastName} onChange={(e) => updateEmployeeDraftField("lastName", e.target.value)} />
            </Field>
            <Field label="Occupation">
              <select value={employeeManagementDraft.occupation} onChange={(e) => updateEmployeeDraftField("occupation", e.target.value)}>
                <option value="">Select occupation</option>
                {[
                  "Foreman",
                  "Roofer",
                  "Laborer",
                  "Field Technician",
                  "Project Manager",
                  "Estimator",
                  "Sales",
                  "Office Administrator",
                  "Billing",
                  "Marketing",
                  "Management",
                  "Owner",
                  "Other",
                ].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select value={employeeManagementDraft.department} onChange={(e) => updateEmployeeDraftField("department", e.target.value)}>
                {["Field Operations", "Office", "Sales", "Management"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Active / Inactive">
              <select value={employeeManagementDraft.isActive ? "active" : "inactive"} onChange={(e) => updateEmployeeDraftField("isActive", e.target.value === "active")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Employee ID (optional)">
              <input type="text" value={employeeManagementDraft.employeeNumber} onChange={(e) => updateEmployeeDraftField("employeeNumber", e.target.value)} />
            </Field>
            <Field label="Phone">
              <input type="text" value={employeeManagementDraft.phone} onChange={(e) => updateEmployeeDraftField("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" value={employeeManagementDraft.email} onChange={(e) => updateEmployeeDraftField("email", e.target.value)} />
            </Field>
            <Field label="Hire Date">
              <input type="date" value={employeeManagementDraft.hireDate} onChange={(e) => updateEmployeeDraftField("hireDate", e.target.value)} />
            </Field>
            <Field label="Base Hourly Wage">
              <input type="number" onWheel={handleNumberInputWheel} min="0" step="0.01" value={employeeManagementDraft.hourlyRate} onChange={(e) => updateEmployeeDraftField("hourlyRate", e.target.value)} />
            </Field>
            <Field label="Payroll ID">
              <input type="text" value={employeeManagementDraft.payrollId} onChange={(e) => updateEmployeeDraftField("payrollId", e.target.value)} />
            </Field>
            <Field label="Driver?">
              <select value={employeeManagementDraft.isDriver ? "yes" : "no"} onChange={(e) => updateEmployeeDraftField("isDriver", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            <Field label="Foreman?">
              <select value={employeeManagementDraft.isForeman ? "yes" : "no"} onChange={(e) => updateEmployeeDraftField("isForeman", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows="4" value={employeeManagementDraft.notes} onChange={(e) => updateEmployeeDraftField("notes", e.target.value)} />
            </Field>
          </div>

          <div className="detailList" style={{ marginTop: 14 }}>
            <DetailRow label="Display name" value={buildEmployeeDisplayName(employeeManagementDraft) || "—"} />
            <DetailRow label="Employee record" value={employeeManagementDraft.id || "New employee"} />
            <DetailRow label="Base hourly wage" value={money2(draftWageBreakdown.baseWage)} />
            <DetailRow label="Workers’ compensation (50%)" value={`${money2(draftWageBreakdown.workersCompCost)} per hour`} />
            <DetailRow label="Payroll tax (9.25%)" value={`${money2(draftWageBreakdown.payrollTaxCost)} per hour`} />
            <DetailRow label="Loaded hourly labor cost" value={money2(draftWageBreakdown.loadedHourlyCost)} />
          </div>
        </Section>

        <Section title="Employee Directory" subtitle="Search and review all employees saved for the company.">
          <div className="formGrid" style={{ marginBottom: 14 }}>
            <Field label="Search employees">
              <input
                type="text"
                value={employeeManagementSearch}
                onChange={(e) => setEmployeeManagementSearch(e.target.value)}
                placeholder="Search by name, department, role, or ID"
              />
            </Field>
          </div>
          <div className="savedList">
            {filteredEmployees.length ? (
              filteredEmployees.map((employee) => (
                <div className="savedCard" key={employee.id}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span className="eyebrow">{employee.employeeNumber || employee.id}</span>
                      <span className={`statusTag ${employee.isActive ? "" : "statusTag-draft"}`}>{employee.isActive ? "ACTIVE" : "INACTIVE"}</span>
                      {employee.isForeman ? <span className="statusTag">FOREMAN</span> : null}
                      {employee.isDriver ? <span className="statusTag">DRIVER</span> : null}
                    </div>
                    <strong>{employee.displayName || "Unnamed employee"}</strong>
                    <p>
                      {employee.occupation || "No occupation"} | {employee.department || "No department"} |{" "}
                      {employee.phone || "No phone"} | {employee.email || "No email"}
                    </p>
                    <p>
                      Base wage {money2(employee.hourlyRate || 0)}/hr · Loaded labor cost {money2(calculateLoadedHourlyWage(employee.hourlyRate).loadedHourlyCost)}/hr
                    </p>
                  </div>
                  <div className="savedActions">
                    <button type="button" className="secondaryButton" onClick={() => editEmployeeRecord(employee)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyState">No employees match your search.</p>
            )}
          </div>
      </Section>
        <Section title="Subcontractor Compliance" subtitle="Maintain licensing, workers' compensation, and COI records in one protected company directory.">
          <SubcontractorCompliance supabase={supabase} authUser={authUser} />
        </Section>
    </div>
  );
  
}
