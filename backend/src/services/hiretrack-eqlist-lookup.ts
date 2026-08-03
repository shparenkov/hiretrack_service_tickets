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
  const normalized = rows.flatMap((row) => {
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

  const byEqlist = new Map<number, HiretrackEqlistLookupRecord>();
  for (const row of normalized) {
    const existing = byEqlist.get(row.eqlistId);
    if (!existing) {
      byEqlist.set(row.eqlistId, row);
      continue;
    }
    byEqlist.set(row.eqlistId, {
      ...(String(row.lastSeenAt || '') > String(existing.lastSeenAt || '') ? row : existing),
      isCurrent: existing.isCurrent || row.isCurrent,
    });
  }
  return [...byEqlist.values()].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }
    return String(right.lastSeenAt || '').localeCompare(String(left.lastSeenAt || ''));
  });
}
