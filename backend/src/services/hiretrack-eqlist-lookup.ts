import { HiretrackEqlistLookupRecord } from '../types';
import { runHiretrackRead } from './hiretrack-odbc-read';

interface EqlistRow {
  EqlistId?: unknown;
  EqlistName?: unknown;
  JobNo?: unknown;
  JobRef?: unknown;
  ClientName?: unknown;
  LastSeenAt?: unknown;
  OperationType?: unknown;
  IsCurrent?: unknown;
}

function normalizeString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeInt(value: unknown): number | null {
  const numeric = Number(value);
  return value != null && value !== '' && Number.isFinite(numeric) ? numeric : null;
}

function normalizeBool(value: unknown): boolean {
  return value === true || value === 1 || String(value ?? '').trim().toLowerCase() === 'true';
}

export async function lookupEquipmentEqlistsInHiretrack(input: {
  itemRef?: number | null;
  barcodeRaw?: string | null;
  serialNumber?: string | null;
}): Promise<HiretrackEqlistLookupRecord[]> {
  const lookup = normalizeString(input.barcodeRaw) || normalizeString(input.serialNumber);
  const itemRef = normalizeInt(input.itemRef) || 0;
  if (!itemRef && !lookup) {
    return [];
  }

  const rows = await runHiretrackRead<EqlistRow[]>('eqlists', { itemRef, lookup });
  return rows.flatMap((row) => {
    const eqlistId = normalizeInt(row.EqlistId);
    if (!eqlistId) {
      return [];
    }
    return [{
      eqlistId,
      eqlistName: normalizeString(row.EqlistName),
      jobNo: normalizeInt(row.JobNo),
      jobRef: normalizeString(row.JobRef),
      clientName: normalizeString(row.ClientName),
      lastSeenAt: normalizeString(row.LastSeenAt),
      operationType: normalizeInt(row.OperationType),
      isCurrent: normalizeBool(row.IsCurrent),
    } satisfies HiretrackEqlistLookupRecord];
  });
}
