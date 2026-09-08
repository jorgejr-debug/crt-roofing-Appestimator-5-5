import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CFO_LIQUID_CASH_CARD_KEY,
  CFO_LIQUID_CASH_SOURCE_RECORD_UID,
  flattenLiquidCashEntriesToSharedRecord,
  hydrateLiquidCashEntriesFromSupabaseRows,
} from './cfoLiquidCashSync.js';

test('liquid cash is flattened into one shared company record', () => {
  const rows = flattenLiquidCashEntriesToSharedRecord([
    { id: 'a1', bankAccountName: 'Bank of America', currentLiquidBalance: '$125,000.00', lastUpdatedDate: '2026-08-17', includedInTotal: 'Yes' },
    { id: 'a2', bankAccountName: 'Chase', currentLiquidBalance: '$32,000.00', lastUpdatedDate: '2026-08-16', includedInTotal: 'Yes' },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_record_uid, CFO_LIQUID_CASH_SOURCE_RECORD_UID);
  assert.equal(rows[0].card_key, CFO_LIQUID_CASH_CARD_KEY);
  assert.equal(rows[0].record_type, 'liquid_cash');
  assert.equal(rows[0].amount, 125000);
  assert.equal(rows[0].updated_by, null);
});

test('liquid cash hydrates from the shared company record', () => {
  const entries = hydrateLiquidCashEntriesFromSupabaseRows([
    {
      source_record_uid: CFO_LIQUID_CASH_SOURCE_RECORD_UID,
      record_type: 'liquid_cash',
      card_key: CFO_LIQUID_CASH_CARD_KEY,
      bank_account_name: 'Bank of America',
      amount: 125000,
      record_date: '2026-08-17',
      included_in_total: true,
      row_version: 1,
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].bankAccountName, 'Bank of America');
  assert.equal(entries[0].currentLiquidBalance, '$125,000.00');
  assert.equal(entries[0].lastUpdatedDate, '2026-08-17');
});

test('saved nonzero liquid cash does not revert to zero after hydrate', () => {
  const savedRows = flattenLiquidCashEntriesToSharedRecord([
    {
      id: 'cash-1',
      bankAccountName: 'Operating',
      currentLiquidBalance: '$98,450.75',
      lastUpdatedDate: '2026-08-18',
      includedInTotal: 'Yes',
      rowVersion: 3,
    },
  ]);

  assert.equal(savedRows.length, 1);
  assert.equal(savedRows[0].amount, 98450.75);

  const hydrated = hydrateLiquidCashEntriesFromSupabaseRows([
    {
      ...savedRows[0],
      updated_at: '2026-08-18T20:10:00.000Z',
      is_archived: false,
    },
  ]);

  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0].currentLiquidBalance, '$98,450.75');
});

test('hydrate picks newest active liquid cash record by updated_at', () => {
  const hydrated = hydrateLiquidCashEntriesFromSupabaseRows([
    {
      source_record_uid: CFO_LIQUID_CASH_SOURCE_RECORD_UID,
      record_type: 'liquid_cash',
      card_key: CFO_LIQUID_CASH_CARD_KEY,
      bank_account_name: 'Operating - Old',
      amount: 0,
      record_date: '2026-08-15',
      updated_at: '2026-08-15T09:00:00.000Z',
      is_archived: false,
      row_version: 1,
    },
    {
      source_record_uid: CFO_LIQUID_CASH_SOURCE_RECORD_UID,
      record_type: 'liquid_cash',
      card_key: CFO_LIQUID_CASH_CARD_KEY,
      bank_account_name: 'Operating - New',
      amount: 75600,
      record_date: '2026-08-18',
      updated_at: '2026-08-18T12:30:00.000Z',
      is_archived: false,
      row_version: 2,
    },
  ]);

  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0].bankAccountName, 'Operating - New');
  assert.equal(hydrated[0].currentLiquidBalance, '$75,600.00');
});
