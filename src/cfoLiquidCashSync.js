export const CFO_LIQUID_CASH_SOURCE_RECORD_UID = 'cfo:liquid_cash';
export const CFO_LIQUID_CASH_CARD_KEY = 'liquid_cash';
export const CFO_LIQUID_CASH_RECORD_TYPE = 'liquid_cash';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toNumber(value, fallback = 0) {
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '').replace(/[^\d.-]/g, '');
    if (!cleaned) return fallback;
    const parsedString = Number(cleaned);
    return Number.isFinite(parsedString) ? parsedString : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTimestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCurrencyString(value) {
  const numeric = toNumber(value, 0);
  if (!Number.isFinite(numeric)) return currencyFormatter.format(0);
  return currencyFormatter.format(numeric);
}

function getLatestLiquidCashEntry(entries = []) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) return null;
  return list.reduce((latest, entry) => {
    const latestDate = latest?.lastUpdatedDate || latest?.recordDate || latest?.updatedAt || '';
    const candidateDate = entry?.lastUpdatedDate || entry?.recordDate || entry?.updatedAt || '';
    if (!latestDate || (candidateDate && candidateDate > latestDate)) {
      return entry;
    }
    return latest;
  }, list[0]);
}

export function flattenLiquidCashEntriesToSharedRecord(entries = []) {
  const current = getLatestLiquidCashEntry(entries);
  if (!current) {
    return [];
  }

  const parsedAmount = toNumber(current.currentLiquidBalance ?? current.amount, 0);
  const sharedEntry = {
    source_record_uid: CFO_LIQUID_CASH_SOURCE_RECORD_UID,
    record_type: CFO_LIQUID_CASH_RECORD_TYPE,
    card_key: CFO_LIQUID_CASH_CARD_KEY,
    bank_account_name: current.bankAccountName || current.record_name || '',
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    record_date: current.lastUpdatedDate || current.record_date || null,
    included_in_total: String(current.includedInTotal || 'Yes').toLowerCase() !== 'no',
    note: '',
    status: '',
    record_name: current.bankAccountName || current.record_name || '',
    is_archived: false,
    row_version: Math.max(1, toNumber(current.rowVersion || current.row_version, 1)),
    updated_by: null,
  };

  return [sharedEntry];
}

export function hydrateLiquidCashEntriesFromSupabaseRows(rows = []) {
  const source = Array.isArray(rows) ? rows.filter((row) => !row?.is_archived) : [];
  const matchingRows = source
    .filter((row) => {
      const recordType = String(row?.record_type || '');
      const cardKey = String(row?.card_key || '');
      return recordType === CFO_LIQUID_CASH_RECORD_TYPE && cardKey === CFO_LIQUID_CASH_CARD_KEY;
    })
    .sort((left, right) => {
      const leftTs = Math.max(toTimestamp(left?.updated_at), toTimestamp(left?.record_date));
      const rightTs = Math.max(toTimestamp(right?.updated_at), toTimestamp(right?.record_date));
      return rightTs - leftTs;
    });

  const sharedEntry = matchingRows.find((row) => {
    const recordUid = String(row?.source_record_uid || '').trim();
    return recordUid === CFO_LIQUID_CASH_SOURCE_RECORD_UID;
  }) || matchingRows[0];

  if (!sharedEntry) {
    return [];
  }

  const recordUid = String(sharedEntry?.source_record_uid || '').trim();
  const entryId = recordUid || CFO_LIQUID_CASH_SOURCE_RECORD_UID;
  return [{
    id: entryId,
    bankAccountName: sharedEntry?.bank_account_name || sharedEntry?.record_name || 'Company liquid cash',
    currentLiquidBalance: toCurrencyString(sharedEntry?.amount ?? 0),
    lastUpdatedDate: sharedEntry?.record_date || '',
    includedInTotal: sharedEntry?.included_in_total === false ? 'No' : 'Yes',
    rowVersion: toNumber(sharedEntry?.row_version, 1),
  }];
}
