export default function CfoDashboardWorkspace({ workspace }) {
 const { DetailRow, Field, LOGO_SRC, Section, authUser, buildCfoApprovedJobSharedJob, buildCfoSourceRecordUid, calculateReceivablePaymentTotals, calculateSupplierPaymentTotals, cfoApprovedJobsLedger, cfoDashboardFilters, cfoLastSyncedRef, cfoLiquidCashDraft, cfoLiquidCashEditingId, cfoLiquidCashEntries, cfoManualDraftsByCard, cfoManualEditingByCard, cfoManualEntriesByCard, cfoPaymentDiscussionError, cfoPaymentDiscussionOpeningId, cfoReceivableDraft, cfoReceivableEditingId, cfoReceivableEntries, cfoReceivablePaymentMessage, cfoReceivablePaymentMessageType, cfoReceivablePaymentSavingId, cfoSupplierPaymentDraft, cfoSupplierPaymentEntry, cfoSupplierPaymentMessage, cfoSupplierPaymentSavingId, cfoSyncError, cfoSyncStatus, createBlankCfoLiquidCashEntry, createBlankCfoManualEntry, createBlankCfoReceivableEntry, createBlankSupplierPaymentDraft, createFieldDailyLogId, css, estimatorSettingsSyncStatus, filterReceivablesByPaymentView, filterSupplierPayablesByPaymentView, flattenCfoNonLiquidCashRecords, formatCfoRecordUpdatedAt, getAccountTitle, getReceivablePaymentStatus, getRevealSecondsRemaining, getSupplierPaymentStatus, handleNumberInputWheel, invokeLiquidCashFunction, liquidCashAccess, liquidCashCode, liquidCashSaving, money, money2, normalizeCfoLiquidCashEntry, normalizeCfoManualEntry, normalizeCfoReceivableEntry, num, openApprovedJobDetail, selectedCfoCard, setActiveTemplate, setCfoDashboardFilters, setCfoDeletedSourceRecordUids, setCfoLiquidCashDraft, setCfoLiquidCashEditingId, setCfoLiquidCashEntries, setCfoManualDraftsByCard, setCfoManualEditingByCard, setCfoManualEntriesByCard, setCfoPaymentDiscussionError, setCfoPaymentDiscussionOpeningId, setCfoReceivableDraft, setCfoReceivableEditingId, setCfoReceivableEntries, setCfoReceivablePaymentMessage, setCfoReceivablePaymentMessageType, setCfoReceivablePaymentSavingId, setCfoSupplierPaymentDraft, setCfoSupplierPaymentEntry, setCfoSupplierPaymentMessage, setCfoSupplierPaymentSavingId, setCfoSyncError, setCfoSyncStatus, setCompletedJobs, setLiquidCashAccess, setLiquidCashCode, setLiquidCashSaving, setSelectedCfoCard, setSessionMessage, setSessionMessageType, setSupplierPaymentHistory, setWorkHubInitialCreateTask, setWorkHubInitialTaskId, splitSharedJobsByWorkflow, supabase, supplierPaymentHistory, toNumber, upsertCompanyFinancialRecordsToSupabase, upsertSharedJobToSupabase } = workspace;

    const liquidCashIsRevealed = liquidCashAccess.phase === "revealed" && liquidCashAccess.secondsRemaining > 0;
    const liquidCashCountdown = `${Math.floor(liquidCashAccess.secondsRemaining / 60)}:${String(liquidCashAccess.secondsRemaining % 60).padStart(2, "0")}`;
    const liquidCashEntries = cfoLiquidCashEntries.filter((entry) => String(entry.bankAccountName || "").trim());
    const liquidCashTotal = liquidCashEntries.reduce((sum, entry) => {
      if (String(entry.includedInTotal || "Yes").toLowerCase() === "no") return sum;
      return sum + Math.max(0, toNumber(entry.currentLiquidBalance, 0));
    }, 0);
    const receivableEntries = cfoReceivableEntries.filter((entry) => String(entry.customerName || "").trim());
    const receivablePaymentTotals = calculateReceivablePaymentTotals(receivableEntries);
    const receivableTotal = receivablePaymentTotals.accountsReceivable;
    const receivablePastDueTotal = receivablePaymentTotals.pastDue;
    const receivablePaidTotal = receivablePaymentTotals.amountPaid;
    const visibleReceivableEntries = filterReceivablesByPaymentView(receivableEntries, cfoDashboardFilters.currentOverdue);
    const manualCardConfigs = {
      proposalsSent: {
        nameLabel: "Proposal / job number",
        amountLabel: "Proposal amount",
        countLabel: "Proposals sent out",
        showCount: true,
        helperText: "Enter the proposal dollar amount and how many proposals were sent.",
      },
      approvedJobs: {
        nameLabel: "Job number / project",
        amountLabel: "Approved contract amount",
        showCount: false,
        helperText: "Enter the approved job dollar amount.",
      },
      customerOverdue: {
        nameLabel: "Customer / invoice",
        amountLabel: "Amount overdue",
        showCount: false,
        helperText: "Enter the customer balance that is overdue.",
      },
      supplierTotalsPayable: {
        nameLabel: "Supplier / invoice",
        amountLabel: "Amount payable",
        showCount: false,
        helperText: "Enter the supplier payable amount.",
      },
      supplierOverdue: {
        nameLabel: "Supplier / invoice",
        amountLabel: "Amount overdue",
        showCount: false,
        helperText: "Enter the overdue supplier amount.",
      },
      subcontractorPayables: {
        nameLabel: "Subcontractor / job",
        amountLabel: "Amount payable",
        showCount: false,
        helperText: "Enter the subcontractor payable amount.",
      },
      accountsPayable: {
        nameLabel: "Payee / reference",
        amountLabel: "Amount payable",
        showCount: false,
        helperText: "Enter the payable amount owed to this payee.",
      },
    };
    const getManualCardEntries = (cardKey) => cardKey === "approvedJobs"
      ? cfoApprovedJobsLedger.entries
      : (Array.isArray(cfoManualEntriesByCard[cardKey]) ? cfoManualEntriesByCard[cardKey] : []);
    const getManualCardTotal = (cardKey) =>
      getManualCardEntries(cardKey).reduce((sum, entry) => sum + Math.max(0, toNumber(entry.amount, 0)), 0);
    const getManualCardCount = (cardKey) =>
      getManualCardEntries(cardKey).reduce((sum, entry) => {
        if (cardKey === "proposalsSent") return sum + Math.max(0, toNumber(entry.count, 1));
        return sum + 1;
      }, 0);
    const getManualCardLastUpdated = (cardKey) => {
      const entries = getManualCardEntries(cardKey);
      if (!entries.length) return "No records";
      if (cfoSyncStatus === "saving") return "Saving to company data";
      if (cfoSyncStatus === "saved") return "Synced to company data";
      if (cfoSyncStatus === "error") return "Sync error";
      return "Draft";
    };
    const supplierPayableEntries = [
      ...getManualCardEntries("supplierTotalsPayable").map((entry) => ({ ...entry, sourceCardKey: "supplierTotalsPayable" })),
      ...getManualCardEntries("supplierOverdue").map((entry) => ({ ...entry, sourceCardKey: "supplierOverdue" })),
    ];
    const supplierPaymentTotals = calculateSupplierPaymentTotals(supplierPayableEntries);
    const supplierAmountPaidTotal = supplierPaymentTotals.amountPaid + supplierPaymentHistory.reduce(
      (sum, payment) => sum + Math.max(0, toNumber(payment.amount_paid, 0)),
      0,
    );
    const visibleSupplierPayableEntries = filterSupplierPayablesByPaymentView(supplierPayableEntries, cfoDashboardFilters.currentOverdue);
    const supplierPayableLastUpdated =
      supplierPayableEntries.length
        ? cfoSyncStatus === "saved"
          ? "Synced to company data"
          : cfoSyncStatus === "saving"
            ? "Saving to company data"
            : cfoSyncStatus === "error"
              ? "Sync error"
              : "Draft"
        : "No records";
    const hideLiquidCashNow = async () => {
      const revealToken = liquidCashAccess.revealToken;
      setCfoLiquidCashEntries([]);
      setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
      setCfoLiquidCashEditingId("");
      setLiquidCashCode("");
      setLiquidCashAccess((current) => ({ ...current, phase: "hidden", revealToken: "", revealExpiresAt: "", secondsRemaining: 0, error: "" }));
      if (revealToken) await invokeLiquidCashFunction("liquid-cash-reveal", { action: "hide", revealToken });
    };
    const requestLiquidCashCode = async () => {
      setLiquidCashAccess((current) => ({ ...current, phase: "requesting", error: "" }));
      const { data, error } = await invokeLiquidCashFunction("request-liquid-cash-code");
      if (error) {
        setLiquidCashAccess((current) => ({ ...current, phase: "hidden", error: error.message }));
        return;
      }
      setLiquidCashCode("");
      setLiquidCashAccess((current) => ({ ...current, phase: "code_sent", challengeId: data.challengeId, challengeExpiresAt: data.expiresAt, maskedEmail: data.email, attemptsRemaining: Number(data.attemptsAllowed || 5), error: "" }));
    };
    const verifyLiquidCashCode = async () => {
      if (!/^[0-9]{4}$/.test(liquidCashCode)) {
        setLiquidCashAccess((current) => ({ ...current, error: "Enter the 4-digit code from your email." }));
        return;
      }
      setLiquidCashAccess((current) => ({ ...current, phase: "verifying", error: "" }));
      const verification = await invokeLiquidCashFunction("verify-liquid-cash-code", { challengeId: liquidCashAccess.challengeId, code: liquidCashCode });
      if (verification.error) {
        const attemptsRemaining = Number(verification.data?.attemptsRemaining ?? liquidCashAccess.attemptsRemaining);
        const terminal = ["expired", "exhausted", "already_used", "superseded", "email_failed"].includes(String(verification.data?.outcome || ""));
        setLiquidCashAccess((current) => ({ ...current, phase: terminal ? "hidden" : "code_sent", attemptsRemaining, error: verification.error.message }));
        return;
      }
      const revealed = await invokeLiquidCashFunction("liquid-cash-reveal", { action: "reveal", revealToken: verification.data.revealToken });
      if (revealed.error) {
        setLiquidCashAccess((current) => ({ ...current, phase: "hidden", error: revealed.error.message }));
        return;
      }
      const revealExpiresAt = revealed.data.expiresAt || verification.data.expiresAt;
      setCfoLiquidCashEntries((revealed.data.entries || []).map((entry) => normalizeCfoLiquidCashEntry({ ...entry, currentLiquidBalance: money2(toNumber(entry.currentLiquidBalance, 0)) })));
      setLiquidCashCode("");
      setLiquidCashAccess((current) => ({ ...current, phase: "revealed", revealToken: verification.data.revealToken, revealExpiresAt, secondsRemaining: getRevealSecondsRemaining(revealExpiresAt), error: "" }));
    };
    const deleteLiquidCashEntry = async (entryId) => {
      if (!liquidCashIsRevealed || !liquidCashAccess.revealToken) return;
      setLiquidCashSaving(true);
      const result = await invokeLiquidCashFunction("liquid-cash-reveal", { action: "archive", revealToken: liquidCashAccess.revealToken });
      setLiquidCashSaving(false);
      if (result.error) {
        setSessionMessageType("error");
        setSessionMessage(result.error.message);
        return;
      }
      setCfoLiquidCashEntries((current) => current.filter((entry) => entry.id !== entryId));
      if (cfoLiquidCashEditingId === entryId) {
        setCfoLiquidCashEditingId("");
        setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
      }
    };
    const editLiquidCashEntry = (entry) => {
      setCfoLiquidCashDraft({
        ...createBlankCfoLiquidCashEntry(),
        ...normalizeCfoLiquidCashEntry(entry),
      });
      setCfoLiquidCashEditingId(String(entry.id));
    };
    const deleteReceivableEntry = (entryId) => {
      setCfoDeletedSourceRecordUids((current) => [
        ...current,
        buildCfoSourceRecordUid("receivable", "waitingOnPayment", entryId),
      ]);
      setCfoReceivableEntries((current) => current.filter((entry) => entry.id !== entryId));
      if (cfoReceivableEditingId === entryId) {
        setCfoReceivableEditingId("");
        setCfoReceivableDraft(createBlankCfoReceivableEntry());
      }
    };
    const editReceivableEntry = (entry) => {
      setCfoReceivableDraft({
        ...createBlankCfoReceivableEntry(),
        ...normalizeCfoReceivableEntry(entry),
      });
      setCfoReceivableEditingId(String(entry.id));
    };
    const markReceivableEntryPaid = async (entry) => {
      if (!entry?.id || cfoReceivablePaymentSavingId) return;
      const customerName = String(entry?.customerName || "this customer").trim() || "this customer";
      if (!window.confirm(`Mark ${customerName} as paid and move this payment to Paid history?`)) return;

      const paidEntry = normalizeCfoReceivableEntry({
        ...entry,
        paymentStatus: "Paid",
        rowVersion: Math.max(1, toNumber(entry.rowVersion, 1)) + 1,
      });
      const nextReceivableEntries = cfoReceivableEntries.map((item) => (
        item.id === entry.id
          ? paidEntry
          : item
      ));
      setCfoReceivablePaymentSavingId(String(entry.id));
      setCfoReceivablePaymentMessage("");
      setCfoReceivablePaymentMessageType("");
      setCfoSyncStatus("saving");
      setCfoSyncError("");
      const saveResult = await upsertCompanyFinancialRecordsToSupabase(
        flattenCfoNonLiquidCashRecords([paidEntry], {}),
        authUser.id || authUser.key,
      );
      setCfoReceivablePaymentSavingId("");
      if (saveResult.error) {
        const saveMessage = saveResult.error.message || "The payment could not be saved to company data.";
        setCfoSyncStatus("error");
        setCfoSyncError(saveMessage);
        setCfoReceivablePaymentMessageType("error");
        setCfoReceivablePaymentMessage(`Payment not recorded: ${saveMessage}`);
        setSessionMessageType("error");
        setSessionMessage(`Payment not recorded for ${customerName}.`);
        return;
      }

      cfoLastSyncedRef.current = JSON.stringify(
        flattenCfoNonLiquidCashRecords(nextReceivableEntries, cfoManualEntriesByCard),
      );
      setCfoReceivableEntries(nextReceivableEntries);
      if (cfoReceivableEditingId === entry.id) {
        setCfoReceivableEditingId("");
        setCfoReceivableDraft(createBlankCfoReceivableEntry());
      }
      setCfoSyncStatus("saved");
      setCfoSyncError("");
      setCfoReceivablePaymentMessageType("success");
      setCfoReceivablePaymentMessage(`${customerName} was marked paid and moved to Paid history.`);
      setSessionMessageType("success");
      setSessionMessage(`${customerName} was marked paid.`);
    };
    const openSupplierPaymentDialog = (entry) => {
      setCfoSupplierPaymentEntry(entry);
      setCfoSupplierPaymentMessage("");
      setCfoSupplierPaymentDraft({
        ...createBlankSupplierPaymentDraft(),
        paymentDate: new Date().toISOString().slice(0, 10),
        amountPaid: money2(toNumber(entry.amount, 0)),
      });
    };
    const recordSupplierPayment = async () => {
      const entry = cfoSupplierPaymentEntry;
      if (!entry) return;
      const supplierName = String(entry.recordName || "this supplier invoice").trim() || "this supplier invoice";
      const outstandingBalance = Math.max(0, toNumber(entry.amount, 0));
      const paymentAmount = cfoSupplierPaymentDraft.paymentKind === "Full"
        ? outstandingBalance
        : toNumber(cfoSupplierPaymentDraft.amountPaid, 0);
      if (!cfoSupplierPaymentDraft.paymentDate) {
        setCfoSupplierPaymentMessage("Please enter the date the payment was made.");
        return;
      }
      if (cfoSupplierPaymentDraft.paymentMethod === "Check" && !cfoSupplierPaymentDraft.checkNumber.trim()) {
        setCfoSupplierPaymentMessage("Please enter the check number.");
        return;
      }
      if (paymentAmount <= 0 || paymentAmount > outstandingBalance) {
        setCfoSupplierPaymentMessage("Enter a payment amount greater than zero and no more than the outstanding balance.");
        return;
      }
      if (cfoSupplierPaymentDraft.paymentKind === "Partial" && paymentAmount >= outstandingBalance) {
        setCfoSupplierPaymentMessage("Choose Full payment when paying the entire outstanding balance.");
        return;
      }

      setCfoSupplierPaymentSavingId(String(entry.id));
      setCfoSupplierPaymentMessage("");
      const cardKey = entry.sourceCardKey === "supplierOverdue" ? "supplierOverdue" : "supplierTotalsPayable";
      const sourceRecordUid = buildCfoSourceRecordUid("manual", cardKey, entry.id);
      const { data, error } = await supabase
        .rpc("record_supplier_payment", {
          p_source_record_uid: sourceRecordUid,
          p_payment_date: cfoSupplierPaymentDraft.paymentDate,
          p_payment_method: cfoSupplierPaymentDraft.paymentMethod,
          p_payment_kind: cfoSupplierPaymentDraft.paymentKind,
          p_amount_paid: paymentAmount,
          p_check_number: cfoSupplierPaymentDraft.checkNumber.trim(),
          p_note: cfoSupplierPaymentDraft.note.trim(),
        });
      setCfoSupplierPaymentSavingId("");

      if (error || !data?.payable || !data?.payment) {
        const message = error?.message || "Unable to apply the supplier payment.";
        setCfoSupplierPaymentMessage(message);
        setSessionMessageType("error");
        setSessionMessage(message);
        return;
      }

      setCfoManualEntriesByCard((current) => ({
        ...current,
        [cardKey]: (current[cardKey] || []).map((item) => (
          item.id === entry.id
            ? normalizeCfoManualEntry({
                ...item,
                amount: money2(toNumber(data.payable.amount, 0)),
                status: data.payable.status,
                rowVersion: data.payable.row_version,
                updatedAt: data.payable.updated_at,
              }, cardKey)
            : item
        )),
      }));
      setSupplierPaymentHistory((current) => [data.payment, ...current.filter((payment) => payment.id !== data.payment.id)]);
      setCfoSupplierPaymentEntry(null);
      setCfoSupplierPaymentDraft(createBlankSupplierPaymentDraft());
      const paymentDescription = cfoSupplierPaymentDraft.paymentKind === "Partial"
        ? `${money2(paymentAmount)} partial payment applied; ${money2(toNumber(data.payable.amount, 0))} remains.`
        : `${money2(paymentAmount)} paid in full.`;
      setCfoSupplierPaymentMessage(`${supplierName}: ${paymentDescription} The payment was logged in Administration.`);
      setSessionMessageType("success");
      setSessionMessage(`${supplierName}: ${paymentDescription}`);
    };
    const getManualCardDetailSummary = (cardKey) => {
      const total = getManualCardTotal(cardKey);
      const count = getManualCardCount(cardKey);
      if (cardKey === "proposalsSent") {
        return [
          { label: "Proposal total", value: money(total) },
          { label: "Proposals sent", value: num(count, 0) },
        ];
      }
      return [
        { label: "Total amount", value: money(total) },
        { label: "Records added", value: num(count, 0) },
      ];
    };
    const updateManualCardDraft = (cardKey, field, value) => {
      setCfoManualDraftsByCard((current) => ({
        ...current,
        [cardKey]: {
          ...(current[cardKey] || createBlankCfoManualEntry(cardKey)),
          [field]: value,
        },
      }));
    };
    const deleteManualCardEntry = async (cardKey, entryId) => {
      if (cardKey === "approvedJobs") {
        const entry = (cfoManualEntriesByCard[cardKey] || []).find((item) => item.id === entryId);
        if (entry) {
          const archivedJob = { ...buildCfoApprovedJobSharedJob(entry), workflowStatus: "archived" };
          const archived = await upsertSharedJobToSupabase(archivedJob, authUser.key, authUser.id || authUser.key);
          if (archived.error) {
            setSessionMessageType("error");
            setSessionMessage(`Could not remove the approved job from the dashboard: ${archived.error.message || archived.error}`);
            return;
          }
          setCompletedJobs((current) => current.filter((job) => job.sourceRecordUid !== archivedJob.sourceRecordUid));
        }
      }
      setCfoDeletedSourceRecordUids((current) => [...current, buildCfoSourceRecordUid("manual", cardKey, entryId)]);
      setCfoManualEntriesByCard((current) => ({
        ...current,
        [cardKey]: (current[cardKey] || []).filter((entry) => entry.id !== entryId),
      }));
      setCfoManualEditingByCard((current) => ({
        ...current,
        [cardKey]: current[cardKey] === entryId ? "" : current[cardKey],
      }));
      if (cfoManualEditingByCard[cardKey] === entryId) {
        setCfoManualDraftsByCard((current) => ({
          ...current,
          [cardKey]: createBlankCfoManualEntry(cardKey),
        }));
      }
    };
    const editManualCardEntry = (cardKey, entry) => {
      setCfoManualDraftsByCard((current) => ({
        ...current,
        [cardKey]: {
          ...createBlankCfoManualEntry(cardKey),
          ...normalizeCfoManualEntry(entry, cardKey),
        },
      }));
      setCfoManualEditingByCard((current) => ({
        ...current,
        [cardKey]: String(entry.id),
      }));
    };
    const editSupplierPayableEntry = (entry) => {
      const cardKey = entry.sourceCardKey === "supplierOverdue" ? "supplierOverdue" : "supplierTotalsPayable";
      setCfoManualDraftsByCard((current) => ({
        ...current,
        supplierTotalsPayable: createBlankCfoManualEntry("supplierTotalsPayable"),
        supplierOverdue: createBlankCfoManualEntry("supplierOverdue"),
        [cardKey]: {
          ...createBlankCfoManualEntry(cardKey),
          ...normalizeCfoManualEntry(entry, cardKey),
        },
      }));
      setCfoManualEditingByCard((current) => ({
        ...current,
        supplierTotalsPayable: "",
        supplierOverdue: "",
        [cardKey]: String(entry.id),
      }));
    };
    const addManualCardEntry = async (cardKey) => {
      const config = manualCardConfigs[cardKey];
      const draft = cfoManualDraftsByCard[cardKey] || createBlankCfoManualEntry(cardKey);
      const recordName = String(draft.recordName || "").trim();
      if (!recordName) {
        setSessionMessageType("error");
        setSessionMessage("Please enter a record name.");
        return;
      }
      const amountValue = toNumber(draft.amount, 0);
      if (!Number.isFinite(amountValue)) {
        setSessionMessageType("error");
        setSessionMessage("Please enter a valid dollar amount.");
        return;
      }
      const editId = cfoManualEditingByCard[cardKey] || "";
      const nextEntry = normalizeCfoManualEntry(
        {
          ...draft,
          id: editId || createFieldDailyLogId(),
          recordName,
          amount: money2(amountValue),
          count: cardKey === "proposalsSent" ? Math.max(1, toNumber(draft.count, 1)) : draft.count,
          recordDate: draft.recordDate || new Date().toISOString().slice(0, 10),
          status: draft.status || "",
          note: draft.note || "",
          updatedAt: new Date().toISOString(),
        },
        cardKey,
      );
      if (cardKey === "approvedJobs") {
        const sharedJob = buildCfoApprovedJobSharedJob(nextEntry);
        const sharedResult = await upsertSharedJobToSupabase(sharedJob, authUser.key, authUser.id || authUser.key);
        if (sharedResult.error) {
          setSessionMessageType("error");
          setSessionMessage(`Could not update the dashboard approved jobs: ${sharedResult.error.message || sharedResult.error}`);
          return;
        }
        const persistedRow = Array.isArray(sharedResult.data) ? sharedResult.data[0] : null;
        const normalizedSharedJob = persistedRow
          ? splitSharedJobsByWorkflow([persistedRow]).approvedJobs[0] || sharedJob
          : sharedJob;
        setCompletedJobs((current) => [
          normalizedSharedJob,
          ...current.filter((job) => job.sourceRecordUid !== sharedJob.sourceRecordUid),
        ]);
      }
      setCfoManualEntriesByCard((current) => {
        const existing = current[cardKey] || [];
        if (editId) {
          return {
            ...current,
            [cardKey]: existing.map((entry) => (entry.id === editId ? nextEntry : entry)),
          };
        }
        return {
          ...current,
          [cardKey]: [...existing, nextEntry],
        };
      });
      setCfoManualDraftsByCard((current) => ({
        ...current,
        [cardKey]: createBlankCfoManualEntry(cardKey),
      }));
      setCfoManualEditingByCard((current) => ({
        ...current,
        [cardKey]: "",
      }));
      setSessionMessageType("success");
      setSessionMessage(`${editId ? "Updated" : "Added"} ${recordName} in ${config?.amountLabel || "CFO dashboard"}.`);
    };
    const renderManualCardRow = (entry, cardKey) => (
      <tr key={entry.id}>
        <td>{entry.recordName || "—"}</td>
        <td>{entry.recordDate || "—"}</td>
        <td>{money2(toNumber(entry.amount, 0))}</td>
        <td>{cardKey === "proposalsSent" ? num(Math.max(0, toNumber(entry.count, 0)), 0) : "—"}</td>
        <td>{entry.status || "—"}</td>
        <td>{entry.note || "—"}</td>
        <td>
          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={() => editManualCardEntry(cardKey, entry)}>
              Edit
            </button>
            <button type="button" className="dangerButton" onClick={() => deleteManualCardEntry(cardKey, entry.id)}>
              Delete
            </button>
          </div>
        </td>
      </tr>
    );
    const renderApprovedJobLedgerRow = (entry) => (
      <tr key={entry.id}>
        <td>{entry.recordName || "—"}</td>
        <td>{entry.recordDate || "—"}</td>
        <td>{money2(toNumber(entry.amount, 0))}</td>
        <td>—</td>
        <td>{entry.status || "—"}</td>
        <td>{entry.note || "—"}</td>
        <td>
          <button type="button" className="secondaryButton" onClick={() => openApprovedJobDetail(entry.sharedJob)}>
            Open Job
          </button>
        </td>
      </tr>
    );
    const cfoCards = [
      {
        key: "liquidCash",
        label: "Liquid Cash",
        primaryValue: liquidCashIsRevealed ? (liquidCashEntries.length ? money(liquidCashTotal) : "$0.00") : "••••••",
        secondaryValue: liquidCashIsRevealed ? `${liquidCashCountdown} remaining` : "Email verification required",
        lastUpdated: liquidCashIsRevealed ? `Automatically hides in ${liquidCashCountdown}` : "Protected server-side",
        detailTitle: "Liquid Cash",
        detailSubtitle: liquidCashIsRevealed
          ? "Bank and operating cash only. This reveal automatically hides at the server expiry."
          : "The balance stays on the server until a CFO or admin verifies the emailed code.",
        detailSummary: [
          { label: "Total liquid cash", value: liquidCashIsRevealed ? (liquidCashEntries.length ? money(liquidCashTotal) : "$0.00") : "Hidden" },
          { label: "Reveal status", value: liquidCashIsRevealed ? liquidCashCountdown : "Locked" },
        ],
        columns: ["Bank/account name", "Current liquid balance", "Last updated date", "Included in total?", "Total liquid cash", "Actions"],
        emptyState: liquidCashIsRevealed ? "No company bank accounts are connected yet." : "Liquid cash is hidden and was not included in this client payload.",
      },
      {
        key: "approvedJobs",
        label: "Approved Jobs",
        primaryValue: money(getManualCardTotal("approvedJobs")),
        secondaryValue: `${num(getManualCardCount("approvedJobs"), 0)} active job${getManualCardCount("approvedJobs") === 1 ? "" : "s"}`,
        lastUpdated: getManualCardLastUpdated("approvedJobs"),
        detailTitle: "Approved Jobs",
        detailSubtitle: "Approved and signed jobs that are not fully closed out.",
        detailSummary: getManualCardDetailSummary("approvedJobs"),
        columns: ["Job / project", "Record date", "Amount", "Count", "Status", "Note", "Actions"],
        emptyState: getManualCardEntries("approvedJobs").length ? "" : "No approved jobs are connected yet.",
        entryKey: "approvedJobs",
      },
      {
        key: "waitingOnPayment",
        label: "Waiting on Payment",
        primaryValue: money(receivableTotal),
        secondaryValue: receivableEntries.length ? `${money(receivablePastDueTotal)} overdue` : "$0 overdue",
        lastUpdated: receivableEntries.length
          ? cfoSyncStatus === "saved"
            ? "Synced to company data"
            : cfoSyncStatus === "saving"
              ? "Saving to company data"
              : cfoSyncStatus === "error"
                ? "Sync error"
                : "Draft"
          : "No records",
        detailTitle: "Waiting on Payment",
        detailSubtitle: "Open customer balances currently unpaid.",
        detailSummary: [
          { label: "Accounts receivable", value: money(receivableTotal) },
          { label: "Past due", value: money(receivablePastDueTotal) },
          { label: "Amount paid", value: money(receivablePaidTotal) },
        ],
        columns: ["Customer", "Date from", "Date to", "Amount owed", "Payment status", "Note", "Actions"],
        emptyState: receivableEntries.length ? "" : "No accounts receivable records are connected yet.",
      },
      {
        key: "subcontractorPayables",
        label: "Subcontractor Payables",
        primaryValue: money(getManualCardTotal("subcontractorPayables")),
        secondaryValue: `${num(getManualCardCount("subcontractorPayables"), 0)} open item${getManualCardCount("subcontractorPayables") === 1 ? "" : "s"}`,
        lastUpdated: getManualCardLastUpdated("subcontractorPayables"),
        detailTitle: "Subcontractor Payables",
        detailSubtitle: "Approved subcontractor amounts not yet paid.",
        detailSummary: getManualCardDetailSummary("subcontractorPayables"),
        columns: ["Subcontractor / job", "Record date", "Amount payable", "Count", "Status", "Note", "Actions"],
        emptyState: getManualCardEntries("subcontractorPayables").length ? "" : "No subcontractor payables are connected yet.",
        entryKey: "subcontractorPayables",
      },
      {
        key: "supplierTotalsPayable",
        label: "Supplier Totals Payable",
        primaryValue: money(supplierPaymentTotals.totalPayable),
        secondaryValue: `${money(supplierPaymentTotals.overdue)} overdue`,
        lastUpdated: supplierPayableLastUpdated,
        detailTitle: "Supplier Totals Payable",
        detailSubtitle: "Waiting, overdue, and paid supplier invoices shown in one place.",
        detailSummary: [
          { label: "Total payable", value: money(supplierPaymentTotals.totalPayable) },
          { label: "Overdue total", value: money(supplierPaymentTotals.overdue) },
          { label: "Amount paid", value: money(supplierAmountPaidTotal) },
        ],
        columns: ["Supplier / invoice", "Record date", "Last updated", "Amount payable", "Status", "Note", "Actions"],
        emptyState:
          supplierPayableEntries.length ? "" : "No supplier payable records are connected yet.",
        entryKey: "supplierTotalsPayable",
      },
      {
        key: "accountsPayable",
        label: "Accounts Payable",
        primaryValue: money(getManualCardTotal("accountsPayable")),
        secondaryValue: `${num(getManualCardCount("accountsPayable"), 0)} open payable${getManualCardCount("accountsPayable") === 1 ? "" : "s"}`,
        lastUpdated: getManualCardLastUpdated("accountsPayable"),
        detailTitle: "Accounts Payable",
        detailSubtitle: "All approved company payables by payee type.",
        detailSummary: getManualCardDetailSummary("accountsPayable"),
        columns: ["Payee / reference", "Record date", "Amount payable", "Count", "Status", "Note", "Actions"],
        emptyState: getManualCardEntries("accountsPayable").length ? "" : "No accounts payable records are connected yet.",
        entryKey: "accountsPayable",
      },
    ];

    const selectedCard = cfoCards.find((card) => card.key === selectedCfoCard) || null;
    const cfoSyncStatusLabel =
      cfoSyncStatus === "saving"
        ? "Saving"
        : cfoSyncStatus === "saved"
          ? "Saved"
          : cfoSyncStatus === "error"
            ? "Error"
            : cfoSyncStatus === "loading"
              ? "Loading"
              : "Idle";
    const cfoSyncStatusDetail = cfoSyncStatus === "error" && cfoSyncError ? cfoSyncError : cfoSyncStatusLabel;
    const estimatorSettingsStatusLabel =
      estimatorSettingsSyncStatus === "saving"
        ? "Saving"
        : estimatorSettingsSyncStatus === "saved"
          ? "Saved"
          : estimatorSettingsSyncStatus === "error"
            ? "Error"
            : estimatorSettingsSyncStatus === "loading"
              ? "Loading"
              : "Idle";
    const supplierPayablesCardKey = cfoManualEditingByCard.supplierOverdue ? "supplierOverdue" : "supplierTotalsPayable";
    const selectedSupplierPayablesConfig = manualCardConfigs.supplierTotalsPayable;
    const selectedCardRecordCount = selectedCard
      ? selectedCard.key === "liquidCash"
        ? liquidCashEntries.length
        : selectedCard.key === "waitingOnPayment"
          ? visibleReceivableEntries.length
          : selectedCard.key === "supplierTotalsPayable"
            ? visibleSupplierPayableEntries.length
            : getManualCardEntries(selectedCard.key).length
      : 0;

    const updateCfoFilter = (key, value) => {
      setCfoDashboardFilters((current) => ({
        ...current,
        [key]: value,
      }));
    };

    const openReceivablePaymentDiscussion = async (entry) => {
      if (!entry?.id || cfoPaymentDiscussionOpeningId) return;
      setCfoPaymentDiscussionOpeningId(entry.id);
      setCfoPaymentDiscussionError("");
      const sourceRecordUid = buildCfoSourceRecordUid("receivable", "waitingOnPayment", entry.id);
      const { data, error } = await supabase
        .rpc("get_or_create_receivable_payment_followup", { p_source_record_uid: sourceRecordUid })
        .single();

      if (error || !data?.id) {
        setCfoPaymentDiscussionError(error?.message || "Unable to open the payment discussion.");
        setCfoPaymentDiscussionOpeningId("");
        return;
      }

      setWorkHubInitialTaskId(data.id);
      setWorkHubInitialCreateTask(false);
      setCfoPaymentDiscussionOpeningId("");
      setSelectedCfoCard("");
      setActiveTemplate("workHub");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const renderCfoDetailModal = () => {
      if (!selectedCard) {
        return null;
      }

      return (
        <div className="cfoDetailOverlay" role="presentation" onClick={() => setSelectedCfoCard("")}>
          <div className="cfoDetailPanel" role="dialog" aria-modal="true" aria-labelledby="cfo-detail-title" onClick={(e) => e.stopPropagation()}>
            <div className="cfoDetailHeader">
              <div>
                <p className="eyebrow">CFO Dashboard</p>
                <h2 id="cfo-detail-title">{selectedCard.detailTitle}</h2>
                <p>{selectedCard.detailSubtitle}</p>
                <div className="cfoDetailMeta">
                  <span className="cfoDetailChip">Last updated: {selectedCard.lastUpdated}</span>
                  <span className="cfoDetailChip">Records connected: {selectedCardRecordCount}</span>
                  <span className="cfoDetailChip">Company finance sync: {cfoSyncStatusDetail}</span>
                  {cfoSyncStatus === "error" && cfoSyncError ? (
                    <span className="cfoDetailChip">Save error: {cfoSyncError}</span>
                  ) : null}
                </div>
              </div>
              <div className="actionRow">
                <button type="button" className="secondaryButton" onClick={() => setSelectedCfoCard("")}>
                  Close
                </button>
              </div>
            </div>

            <div className="cfoDetailGrid">
              {selectedCard.detailSummary.map((item) => (
                <div className="summaryCard" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            {selectedCard.key === "liquidCash" && !liquidCashIsRevealed ? (
              <Section title="Liquid cash is locked" subtitle="The amount has not been downloaded to this browser.">
                <div className="detailList">
                  <DetailRow label="Access" value="CFO / admin only" note="Your signed-in role is checked again on the server." />
                  <DetailRow label="Code lifetime" value="5 minutes" note="A maximum of five verification attempts is allowed." />
                  <DetailRow label="Reveal lifetime" value="60 seconds" note="The server rejects the reveal token at expiry and the screen automatically hides it." />
                </div>
                {liquidCashAccess.phase === "code_sent" || liquidCashAccess.phase === "verifying" ? (
                  <div className="formGrid" style={{ marginTop: 16 }}>
                    <Field label={`4-digit code sent to ${liquidCashAccess.maskedEmail || "your email"}`}>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={4}
                        value={liquidCashCode}
                        onChange={(event) => setLiquidCashCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") verifyLiquidCashCode();
                        }}
                        placeholder="0000"
                      />
                    </Field>
                    <div className="actionRow" style={{ alignItems: "end" }}>
                      <button type="button" className="primaryButton" onClick={verifyLiquidCashCode} disabled={liquidCashAccess.phase === "verifying"}>
                        {liquidCashAccess.phase === "verifying" ? "Verifying…" : "Verify and reveal"}
                      </button>
                      <button type="button" className="secondaryButton" onClick={requestLiquidCashCode} disabled={liquidCashAccess.phase === "verifying"}>
                        Send a new code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="actionRow" style={{ marginTop: 16 }}>
                    <button type="button" className="primaryButton" onClick={requestLiquidCashCode} disabled={liquidCashAccess.phase === "requesting"}>
                      {liquidCashAccess.phase === "requesting" ? "Sending code…" : "Email me a 4-digit code"}
                    </button>
                  </div>
                )}
                {liquidCashAccess.phase === "code_sent" ? (
                  <p className="smallNote" style={{ marginTop: 10 }}>{liquidCashAccess.attemptsRemaining} verification attempt{liquidCashAccess.attemptsRemaining === 1 ? "" : "s"} remaining.</p>
                ) : null}
                {liquidCashAccess.error ? <p className="smallNote" style={{ marginTop: 10, color: "var(--bad)" }}>{liquidCashAccess.error}</p> : null}
              </Section>
            ) : selectedCard.key === "liquidCash" ? (
              <>
              <Section title={`Liquid cash visible for ${liquidCashCountdown}`} subtitle="This countdown uses the server-issued expiry time.">
                <div className="actionRow"><button type="button" className="secondaryButton" onClick={hideLiquidCashNow}>Hide now</button></div>
              </Section>
              <Section
                title="Add bank account"
                subtitle="Type dollar amounts directly here. Dollar signs and commas are allowed."
              >
                <div className="formGrid">
                  <Field label="Bank/account name">
                    <input
                      type="text"
                      value={cfoLiquidCashDraft.bankAccountName}
                      onChange={(e) =>
                        setCfoLiquidCashDraft((current) => ({
                          ...current,
                          bankAccountName: e.target.value,
                        }))
                      }
                      placeholder="Bank of America operating"
                    />
                  </Field>
                  <Field label="Current liquid balance">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cfoLiquidCashDraft.currentLiquidBalance}
                      onChange={(e) =>
                        setCfoLiquidCashDraft((current) => ({
                          ...current,
                          currentLiquidBalance: e.target.value,
                        }))
                      }
                      placeholder="$0.00"
                    />
                  </Field>
                  <Field label="Last updated date">
                    <input
                      type="date"
                      value={cfoLiquidCashDraft.lastUpdatedDate}
                      onChange={(e) =>
                        setCfoLiquidCashDraft((current) => ({
                          ...current,
                          lastUpdatedDate: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Included in total?">
                    <select
                      value={cfoLiquidCashDraft.includedInTotal}
                      onChange={(e) =>
                        setCfoLiquidCashDraft((current) => ({
                          ...current,
                          includedInTotal: e.target.value,
                        }))
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </Field>
                </div>
                <div className="actionRow" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="primaryButton"
                    disabled={liquidCashSaving}
                    onClick={async () => {
                      const bankAccountName = cfoLiquidCashDraft.bankAccountName.trim();
                      if (!bankAccountName) {
                        setSessionMessageType("error");
                        setSessionMessage("Please enter a bank or account name.");
                        return;
                      }
                      const nextEntry = normalizeCfoLiquidCashEntry({
                        ...cfoLiquidCashDraft,
                        id: cfoLiquidCashEditingId || createFieldDailyLogId(),
                        currentLiquidBalance: money2(toNumber(cfoLiquidCashDraft.currentLiquidBalance, 0)),
                        lastUpdatedDate: cfoLiquidCashDraft.lastUpdatedDate || new Date().toISOString().slice(0, 10),
                      });
                      setLiquidCashSaving(true);
                      const saved = await invokeLiquidCashFunction("liquid-cash-reveal", {
                        action: "save",
                        revealToken: liquidCashAccess.revealToken,
                        entry: nextEntry,
                      });
                      setLiquidCashSaving(false);
                      if (saved.error) {
                        setSessionMessageType("error");
                        setSessionMessage(saved.error.message);
                        return;
                      }
                      setCfoLiquidCashEntries((saved.data.entries || []).map((entry) => normalizeCfoLiquidCashEntry({ ...entry, currentLiquidBalance: money2(toNumber(entry.currentLiquidBalance, 0)) })));
                      setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
                      setCfoLiquidCashEditingId("");
                      setSessionMessageType("success");
                      setSessionMessage(`${cfoLiquidCashEditingId ? "Updated" : "Added"} ${bankAccountName} in Liquid Cash.`);
                    }}
                  >
                    {liquidCashSaving ? "Saving…" : cfoLiquidCashEditingId ? "Update bank account" : "Add bank account"}
                  </button>
                  {cfoLiquidCashEditingId ? (
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => {
                        setCfoLiquidCashEditingId("");
                        setCfoLiquidCashDraft(createBlankCfoLiquidCashEntry());
                      }}
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </Section>
              </>
            ) : selectedCard.key === "waitingOnPayment" ? (
              <Section
                title="Add amount owed"
                subtitle="Enter the period this money is owed for and the dollar amount due."
              >
                <div className="formGrid">
                  <Field label="Customer">
                    <input
                      type="text"
                      value={cfoReceivableDraft.customerName}
                      onChange={(e) =>
                        setCfoReceivableDraft((current) => ({
                          ...current,
                          customerName: e.target.value,
                        }))
                      }
                      placeholder="Customer or account name"
                    />
                  </Field>
                  <Field label="Date from">
                    <input
                      type="date"
                      value={cfoReceivableDraft.periodFromDate}
                      onChange={(e) =>
                        setCfoReceivableDraft((current) => ({
                          ...current,
                          periodFromDate: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Date to">
                    <input
                      type="date"
                      value={cfoReceivableDraft.periodToDate}
                      onChange={(e) =>
                        setCfoReceivableDraft((current) => ({
                          ...current,
                          periodToDate: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Amount owed">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cfoReceivableDraft.amountOwed}
                      onChange={(e) =>
                        setCfoReceivableDraft((current) => ({
                          ...current,
                          amountOwed: e.target.value,
                        }))
                      }
                      placeholder="$0.00"
                    />
                  </Field>
                  <Field label="Payment status">
                    <select
                      value={cfoReceivableDraft.paymentStatus}
                      onChange={(e) =>
                        setCfoReceivableDraft((current) => ({
                          ...current,
                          paymentStatus: e.target.value,
                        }))
                      }
                    >
                      <option value="Waiting on Payment">Waiting on Payment</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </Field>
                  <Field label="Note">
                    <input
                      type="text"
                      value={cfoReceivableDraft.note}
                      onChange={(e) =>
                        setCfoReceivableDraft((current) => ({
                          ...current,
                          note: e.target.value,
                        }))
                      }
                      placeholder="Optional note"
                    />
                  </Field>
                </div>
                <div className="actionRow" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="primaryButton"
                    onClick={() => {
                      const customerName = cfoReceivableDraft.customerName.trim();
                      if (!customerName) {
                        setSessionMessageType("error");
                        setSessionMessage("Please enter a customer name.");
                        return;
                      }
                      const nextEntry = normalizeCfoReceivableEntry({
                        ...cfoReceivableDraft,
                        id: cfoReceivableEditingId || createFieldDailyLogId(),
                        amountOwed: money2(toNumber(cfoReceivableDraft.amountOwed, 0)),
                      });
                      setCfoReceivableEntries((current) => {
                        if (cfoReceivableEditingId) {
                          return current.map((entry) => (entry.id === cfoReceivableEditingId ? nextEntry : entry));
                        }
                        return [...current, nextEntry];
                      });
                      setCfoReceivableDraft(createBlankCfoReceivableEntry());
                      setCfoReceivableEditingId("");
                      setSessionMessageType("success");
                      setSessionMessage(`${cfoReceivableEditingId ? "Updated" : "Added"} ${customerName} in Waiting on Payment.`);
                    }}
                  >
                    {cfoReceivableEditingId ? "Update amount owed" : "Add amount owed"}
                  </button>
                  {cfoReceivableEditingId ? (
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => {
                        setCfoReceivableEditingId("");
                        setCfoReceivableDraft(createBlankCfoReceivableEntry());
                      }}
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </Section>
            ) : selectedCard.key === "supplierTotalsPayable" ? (
              <Section
                title="Add supplier payable"
                subtitle="Add or update outstanding supplier invoices. Use the green payment button below to record payments."
              >
                <div className="formGrid">
                  <Field label={selectedSupplierPayablesConfig.nameLabel}>
                    <input
                      type="text"
                      value={cfoManualDraftsByCard[supplierPayablesCardKey]?.recordName || ""}
                      onChange={(e) => updateManualCardDraft(supplierPayablesCardKey, "recordName", e.target.value)}
                      placeholder={selectedSupplierPayablesConfig.nameLabel}
                    />
                  </Field>
                  <Field label={selectedSupplierPayablesConfig.amountLabel}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cfoManualDraftsByCard[supplierPayablesCardKey]?.amount || ""}
                      onChange={(e) => updateManualCardDraft(supplierPayablesCardKey, "amount", e.target.value)}
                      placeholder="$0.00"
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      value={cfoManualDraftsByCard[supplierPayablesCardKey]?.recordDate || ""}
                      onChange={(e) => updateManualCardDraft(supplierPayablesCardKey, "recordDate", e.target.value)}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={cfoManualDraftsByCard[supplierPayablesCardKey]?.status || ""}
                      onChange={(e) => updateManualCardDraft(supplierPayablesCardKey, "status", e.target.value)}
                    >
                      <option value="Waiting on Payment">Waiting on Payment</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </Field>
                  <Field label="Note">
                    <input
                      type="text"
                      value={cfoManualDraftsByCard[supplierPayablesCardKey]?.note || ""}
                      onChange={(e) => updateManualCardDraft(supplierPayablesCardKey, "note", e.target.value)}
                      placeholder="Optional note"
                    />
                  </Field>
                </div>
                <div className="actionRow" style={{ marginTop: 14 }}>
                  <button type="button" className="primaryButton" onClick={() => addManualCardEntry(supplierPayablesCardKey)}>
                    {cfoManualEditingByCard[supplierPayablesCardKey] ? "Update entry" : "Add entry"}
                  </button>
                  {cfoManualEditingByCard[supplierPayablesCardKey] ? (
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => {
                        setCfoManualEditingByCard((current) => ({
                          ...current,
                          supplierTotalsPayable: "",
                          supplierOverdue: "",
                        }));
                        setCfoManualDraftsByCard((current) => ({
                          ...current,
                          supplierTotalsPayable: createBlankCfoManualEntry("supplierTotalsPayable"),
                          supplierOverdue: createBlankCfoManualEntry("supplierOverdue"),
                        }));
                      }}
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </Section>
            ) : manualCardConfigs[selectedCard.key] ? (
              <Section
                title={`Add ${selectedCard.detailTitle} entry`}
                subtitle={manualCardConfigs[selectedCard.key].helperText}
              >
                <div className="formGrid">
                  <Field label={manualCardConfigs[selectedCard.key].nameLabel}>
                    <input
                      type="text"
                      value={cfoManualDraftsByCard[selectedCard.key]?.recordName || ""}
                      onChange={(e) => updateManualCardDraft(selectedCard.key, "recordName", e.target.value)}
                      placeholder={manualCardConfigs[selectedCard.key].nameLabel}
                    />
                  </Field>
                  {manualCardConfigs[selectedCard.key].showCount ? (
                    <Field label={manualCardConfigs[selectedCard.key].countLabel}>
                      <input
                        type="number" onWheel={handleNumberInputWheel}
                        min="0"
                        step="1"
                        value={cfoManualDraftsByCard[selectedCard.key]?.count || "1"}
                        onChange={(e) => updateManualCardDraft(selectedCard.key, "count", e.target.value)}
                        placeholder="1"
                      />
                    </Field>
                  ) : null}
                  <Field label={manualCardConfigs[selectedCard.key].amountLabel}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cfoManualDraftsByCard[selectedCard.key]?.amount || ""}
                      onChange={(e) => updateManualCardDraft(selectedCard.key, "amount", e.target.value)}
                      placeholder="$0.00"
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      value={cfoManualDraftsByCard[selectedCard.key]?.recordDate || ""}
                      onChange={(e) => updateManualCardDraft(selectedCard.key, "recordDate", e.target.value)}
                    />
                  </Field>
                  <Field label="Status">
                    <input
                      type="text"
                      value={cfoManualDraftsByCard[selectedCard.key]?.status || ""}
                      onChange={(e) => updateManualCardDraft(selectedCard.key, "status", e.target.value)}
                      placeholder="Optional status"
                    />
                  </Field>
                  <Field label="Note">
                    <input
                      type="text"
                      value={cfoManualDraftsByCard[selectedCard.key]?.note || ""}
                      onChange={(e) => updateManualCardDraft(selectedCard.key, "note", e.target.value)}
                      placeholder="Optional note"
                    />
                  </Field>
                </div>
                <div className="actionRow" style={{ marginTop: 14 }}>
                  <button type="button" className="primaryButton" onClick={() => addManualCardEntry(selectedCard.key)}>
                    {cfoManualEditingByCard[selectedCard.key] ? "Update entry" : "Add entry"}
                  </button>
                  {cfoManualEditingByCard[selectedCard.key] ? (
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => {
                        setCfoManualEditingByCard((current) => ({
                          ...current,
                          [selectedCard.key]: "",
                        }));
                        setCfoManualDraftsByCard((current) => ({
                          ...current,
                          [selectedCard.key]: createBlankCfoManualEntry(selectedCard.key),
                        }));
                      }}
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </Section>
            ) : null}

            <div className="cfoDetailFilters">
              <Field label="Search">
                <input
                  type="search"
                  value={cfoDashboardFilters.search}
                  onChange={(e) => updateCfoFilter("search", e.target.value)}
                  placeholder="Search records"
                />
              </Field>
              <Field label="Date range from">
                <input
                  type="date"
                  value={cfoDashboardFilters.dateFrom}
                  onChange={(e) => updateCfoFilter("dateFrom", e.target.value)}
                />
              </Field>
              <Field label="Date range to">
                <input
                  type="date"
                  value={cfoDashboardFilters.dateTo}
                  onChange={(e) => updateCfoFilter("dateTo", e.target.value)}
                />
              </Field>
              <Field label="Customer">
                <input
                  type="text"
                  value={cfoDashboardFilters.customer}
                  onChange={(e) => updateCfoFilter("customer", e.target.value)}
                  placeholder="Filter customer"
                />
              </Field>
              <Field label="Supplier">
                <input
                  type="text"
                  value={cfoDashboardFilters.supplier}
                  onChange={(e) => updateCfoFilter("supplier", e.target.value)}
                  placeholder="Filter supplier"
                />
              </Field>
              <Field label="Subcontractor">
                <input
                  type="text"
                  value={cfoDashboardFilters.subcontractor}
                  onChange={(e) => updateCfoFilter("subcontractor", e.target.value)}
                  placeholder="Filter subcontractor"
                />
              </Field>
              <Field label="Job">
                <input
                  type="text"
                  value={cfoDashboardFilters.job}
                  onChange={(e) => updateCfoFilter("job", e.target.value)}
                  placeholder="Filter job"
                />
              </Field>
              <Field label="Payment status">
                <select
                  value={cfoDashboardFilters.currentOverdue}
                  onChange={(e) => updateCfoFilter("currentOverdue", e.target.value)}
                >
                  <option value="all">{["waitingOnPayment", "supplierTotalsPayable"].includes(selectedCard.key) ? "Outstanding only" : "All"}</option>
                  <option value="waiting-on-payment">Waiting on Payment</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">{["waitingOnPayment", "supplierTotalsPayable"].includes(selectedCard.key) ? "Paid history" : "Paid"}</option>
                </select>
              </Field>
              <Field label="Aging bucket">
                <select value={cfoDashboardFilters.agingBucket} onChange={(e) => updateCfoFilter("agingBucket", e.target.value)}>
                  <option value="all">All</option>
                  <option value="1-30">1-30 days</option>
                  <option value="31-60">31-60 days</option>
                  <option value="61-90">61-90 days</option>
                  <option value="90+">90+ days</option>
                </select>
              </Field>
              <Field label="Status">
                <input
                  type="text"
                  value={cfoDashboardFilters.status}
                  onChange={(e) => updateCfoFilter("status", e.target.value)}
                  placeholder="Status"
                />
              </Field>
              <Field label="Sort by">
                <select value={cfoDashboardFilters.sortBy} onChange={(e) => updateCfoFilter("sortBy", e.target.value)}>
                  <option value="lastUpdated">Last updated</option>
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="customer">Customer</option>
                </select>
              </Field>
              <Field label="Sort order">
                <select value={cfoDashboardFilters.sortDirection} onChange={(e) => updateCfoFilter("sortDirection", e.target.value)}>
                  <option value="desc">Newest / highest first</option>
                  <option value="asc">Oldest / lowest first</option>
                </select>
              </Field>
            </div>

            <div className="cfoDetailBody">
              {selectedCard.key === "waitingOnPayment" && cfoReceivablePaymentMessage ? (
                <p className={`statusMessage ${cfoReceivablePaymentMessageType === "error" ? "dangerMessage" : "proposalSuccess"}`}>{cfoReceivablePaymentMessage}</p>
              ) : null}
              {selectedCard.key === "supplierTotalsPayable" && cfoSupplierPaymentMessage ? (
                <p className="statusMessage">{cfoSupplierPaymentMessage}</p>
              ) : null}
              {selectedCard.key === "waitingOnPayment" && cfoPaymentDiscussionError ? (
                <p className="statusMessage dangerMessage">{cfoPaymentDiscussionError}</p>
              ) : null}
              <div className="cfoDetailTableWrap">
                <table className="cfoDetailTable">
                  <thead>
                    <tr>
                      {selectedCard.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCard.key === "waitingOnPayment" && visibleReceivableEntries.length ? (
                      visibleReceivableEntries.map((entry) => {
                        const paymentStatus = getReceivablePaymentStatus(entry);
                        return (
                          <tr key={entry.id}>
                            <td>{entry.customerName || "—"}</td>
                            <td>{entry.periodFromDate || "—"}</td>
                            <td>{entry.periodToDate || "—"}</td>
                            <td>{money2(toNumber(entry.amountOwed, 0))}</td>
                            <td>{paymentStatus}</td>
                            <td>{entry.note || "—"}</td>
                            <td>
                              <div className="actionRow">
                                <button type="button" className="secondaryButton" onClick={() => editReceivableEntry(entry)}>
                                  Edit
                                </button>
                                {paymentStatus !== "Paid" ? (
                                  <button type="button" className="successButton" disabled={Boolean(cfoReceivablePaymentSavingId)} onClick={() => void markReceivableEntryPaid(entry)}>
                                    {cfoReceivablePaymentSavingId === String(entry.id) ? "Saving payment…" : "Mark Paid"}
                                  </button>
                                ) : null}
                                {paymentStatus === "Overdue" ? (
                                  <button
                                    type="button"
                                    className="secondaryButton"
                                    disabled={Boolean(cfoPaymentDiscussionOpeningId)}
                                    onClick={() => openReceivablePaymentDiscussion(entry)}
                                  >
                                    {cfoPaymentDiscussionOpeningId === entry.id ? "Opening…" : "Ask Natalia / Discussion"}
                                  </button>
                                ) : null}
                                <button type="button" className="dangerButton" onClick={() => deleteReceivableEntry(entry.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : selectedCard.key === "supplierTotalsPayable" && visibleSupplierPayableEntries.length ? (
                      visibleSupplierPayableEntries.map((entry) => {
                        const paymentStatus = getSupplierPaymentStatus(entry);
                        return (
                        <tr key={`${entry.sourceCardKey}:${entry.id}`}>
                          <td>{entry.recordName || "—"}</td>
                          <td>{entry.recordDate || "—"}</td>
                          <td>{formatCfoRecordUpdatedAt(entry.updatedAt)}</td>
                          <td>{money2(toNumber(entry.amount, 0))}</td>
                          <td>{paymentStatus}</td>
                          <td>{entry.note || "—"}</td>
                          <td>
                            <div className="actionRow">
                              {paymentStatus !== "Paid" ? (
                                <button type="button" className="secondaryButton" onClick={() => editSupplierPayableEntry(entry)}>
                                  Edit
                                </button>
                              ) : null}
                              {paymentStatus !== "Paid" ? (
                                <button
                                  type="button"
                                  className="successButton"
                                  disabled={Boolean(cfoSupplierPaymentSavingId)}
                                  onClick={() => openSupplierPaymentDialog(entry)}
                                >
                                  {cfoSupplierPaymentSavingId === entry.id ? "Applying…" : "Apply Payment"}
                                </button>
                              ) : null}
                              {paymentStatus !== "Paid" ? (
                                <button type="button" className="dangerButton" onClick={() => deleteManualCardEntry(entry.sourceCardKey, entry.id)}>
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    ) : selectedCard.key === "approvedJobs" && getManualCardEntries("approvedJobs").length ? (
                      getManualCardEntries("approvedJobs").map(renderApprovedJobLedgerRow)
                    ) : selectedCard.key !== "supplierTotalsPayable" && manualCardConfigs[selectedCard.key] && getManualCardEntries(selectedCard.key).length ? (
                      getManualCardEntries(selectedCard.key).map((entry) => renderManualCardRow(entry, selectedCard.key))
                    ) : selectedCard.key === "liquidCash" && liquidCashEntries.length ? (
                      liquidCashEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.bankAccountName || "—"}</td>
                          <td>{money2(toNumber(entry.currentLiquidBalance, 0))}</td>
                          <td>{entry.lastUpdatedDate || "—"}</td>
                          <td>{String(entry.includedInTotal || "Yes").toLowerCase() === "no" ? "No" : "Yes"}</td>
                          <td>{money2(String(entry.includedInTotal || "Yes").toLowerCase() === "no" ? 0 : toNumber(entry.currentLiquidBalance, 0))}</td>
                          <td>
                            <div className="actionRow">
                              <button type="button" className="secondaryButton" onClick={() => editLiquidCashEntry(entry)}>
                                Edit
                              </button>
                              <button type="button" className="dangerButton" onClick={() => deleteLiquidCashEntry(entry.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={selectedCard.columns.length}>
                          <div className="cfoDetailEmpty">
                            <strong>{selectedCard.emptyState || "No records match the current filters."}</strong>
                            <p style={{ margin: "8px 0 0", color: "#a7c7d6" }}>
                              No records match this view yet. Add entries and they will sync to shared company data.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="detailList">
                <DetailRow
                  label="Filtered records"
                  value={num(selectedCardRecordCount, 0)}
                  note="Search, filters, and sorting are ready for shared finance records."
                />
                <DetailRow
                  label="Primary total"
                  value={selectedCard.primaryValue}
                  note="This total is calculated from the connected detail records."
                />
                <DetailRow
                  label="Secondary summary"
                  value={selectedCard.secondaryValue}
                  note="Helpful context shown on the dashboard card."
                />
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="appShell">
        <style>{css}</style>

        <div className="actionRow" style={{ marginBottom: 16 }}>
          <button type="button" className="secondaryButton" onClick={() => setActiveTemplate("dashboard") }>
            Back to dashboard
          </button>
        </div>

        <header className="hero">
          <div>
            <div className="brandRow">
              <div className="brandMark">
                <img src={LOGO_SRC} alt="CRT Roofing logo" />
              </div>
              <div>
                <p className="eyebrow">CRT Roofing Employee Portal</p>
                <h1>CFO Dashboard</h1>
                <p className="intro">Executive financial overview for CRT Roofing.</p>
              </div>
            </div>
          </div>

          <div className="heroCard">
            <span>Signed in</span>
            <strong>{authUser.displayName}</strong>
            <p>{getAccountTitle()}</p>
            <p className="smallNote" style={{ marginTop: 8 }}>CFO sync: {cfoSyncStatusLabel}</p>
            <p className="smallNote" style={{ marginTop: 4 }}>Estimator settings sync: {estimatorSettingsStatusLabel}</p>
          </div>
        </header>

        <Section title="Financial overview" subtitle="Shared company financial cards with realtime synchronization.">
          <div className="summaryGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 0 }}>
            {cfoCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className="summaryCard cfoKpiCard"
                onClick={() => {
                  if (card.key === "waitingOnPayment") { setCfoReceivablePaymentMessage(""); setCfoReceivablePaymentMessageType(""); }
                  if (card.key === "supplierTotalsPayable") setCfoSupplierPaymentMessage("");
                  if (["waitingOnPayment", "supplierTotalsPayable"].includes(card.key)) {
                    setCfoDashboardFilters((current) => ({ ...current, currentOverdue: "all" }));
                  }
                  setSelectedCfoCard(card.key);
                }}
              >
                <span>{card.label}</span>
                <strong>{card.primaryValue}</strong>
                <p>{card.secondaryValue}</p>
                <p className="smallNote" style={{ marginTop: 8 }}>Last updated: {card.lastUpdated}</p>
              </button>
            ))}
          </div>
          <p className="smallNote" style={{ marginTop: 14 }}>
            Company records refresh on realtime events, browser focus, and reconnect.
          </p>
        </Section>

        {renderCfoDetailModal()}
        {cfoSupplierPaymentEntry ? (
          <div className="activeJobOverlay" role="presentation">
            <div className="activeJobPanel" role="dialog" aria-modal="true" aria-labelledby="supplier-payment-title">
              <div className="activeJobPanelHeader">
                <div>
                  <p className="eyebrow">Supplier payment</p>
                  <h2 id="supplier-payment-title">Record payment</h2>
                  <p>{cfoSupplierPaymentEntry.recordName || "Supplier invoice"}</p>
                </div>
                <button
                  type="button"
                  className="secondaryButton"
                  disabled={Boolean(cfoSupplierPaymentSavingId)}
                  onClick={() => {
                    setCfoSupplierPaymentEntry(null);
                    setCfoSupplierPaymentDraft(createBlankSupplierPaymentDraft());
                    setCfoSupplierPaymentMessage("");
                  }}
                >
                  Cancel
                </button>
              </div>

              <div className="detailList" style={{ marginBottom: 16 }}>
                <DetailRow label="Outstanding balance" value={money2(toNumber(cfoSupplierPaymentEntry.amount, 0))} />
                <DetailRow label="Last updated" value={formatCfoRecordUpdatedAt(cfoSupplierPaymentEntry.updatedAt)} />
                {cfoSupplierPaymentDraft.paymentKind === "Partial" ? (
                  <DetailRow
                    label="Remaining after this payment"
                    value={money2(Math.max(
                      0,
                      toNumber(cfoSupplierPaymentEntry.amount, 0) - toNumber(cfoSupplierPaymentDraft.amountPaid, 0),
                    ))}
                  />
                ) : null}
              </div>

              <div className="formGrid">
                <Field label="When was it paid?">
                  <input
                    type="date"
                    value={cfoSupplierPaymentDraft.paymentDate}
                    onChange={(event) => setCfoSupplierPaymentDraft((current) => ({ ...current, paymentDate: event.target.value }))}
                  />
                </Field>
                <Field label="How was it paid?">
                  <select
                    value={cfoSupplierPaymentDraft.paymentMethod}
                    onChange={(event) => setCfoSupplierPaymentDraft((current) => ({
                      ...current,
                      paymentMethod: event.target.value,
                      checkNumber: event.target.value === "Check" ? current.checkNumber : "",
                    }))}
                  >
                    {['ACH', 'Check', 'Credit Card', 'Cash', 'Wire', 'Other'].map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </Field>
                {cfoSupplierPaymentDraft.paymentMethod === "Check" ? (
                  <Field label="Check number">
                    <input
                      type="text"
                      value={cfoSupplierPaymentDraft.checkNumber}
                      onChange={(event) => setCfoSupplierPaymentDraft((current) => ({ ...current, checkNumber: event.target.value }))}
                      placeholder="Enter check number"
                    />
                  </Field>
                ) : null}
                <Field label="Was it fully or partially paid?">
                  <select
                    value={cfoSupplierPaymentDraft.paymentKind}
                    onChange={(event) => setCfoSupplierPaymentDraft((current) => ({
                      ...current,
                      paymentKind: event.target.value,
                      amountPaid: event.target.value === "Full" ? money2(toNumber(cfoSupplierPaymentEntry.amount, 0)) : "",
                    }))}
                  >
                    <option value="Full">Paid in full</option>
                    <option value="Partial">Partially paid</option>
                  </select>
                </Field>
                {cfoSupplierPaymentDraft.paymentKind === "Partial" ? (
                  <Field label="Partial payment amount">
                    <input
                      type="number"
                      onWheel={handleNumberInputWheel}
                      min="0.01"
                      max={toNumber(cfoSupplierPaymentEntry.amount, 0)}
                      step="0.01"
                      value={cfoSupplierPaymentDraft.amountPaid}
                      onChange={(event) => setCfoSupplierPaymentDraft((current) => ({ ...current, amountPaid: event.target.value }))}
                      placeholder="$0.00"
                    />
                  </Field>
                ) : null}
                <Field label="Payment note (optional)">
                  <textarea
                    rows="3"
                    value={cfoSupplierPaymentDraft.note}
                    onChange={(event) => setCfoSupplierPaymentDraft((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Confirmation number or other details"
                  />
                </Field>
              </div>

              {cfoSupplierPaymentMessage ? <p className="statusMessage dangerMessage">{cfoSupplierPaymentMessage}</p> : null}
              <div className="actionRow" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="successButton"
                  disabled={Boolean(cfoSupplierPaymentSavingId)}
                  onClick={recordSupplierPayment}
                >
                  {cfoSupplierPaymentSavingId ? "Applying payment…" : "Apply Payment"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  
}
