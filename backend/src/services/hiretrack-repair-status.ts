import { runHiretrackRead } from './hiretrack-odbc-read';

interface RepairRow {
  ServiceRecordNo?: unknown;
  CompletedDate?: unknown;
  RepairLineRef?: unknown;
  RepairStatus?: unknown;
  CommissionStatus?: unknown;
}

interface RepairStateRow {
  active?: unknown;
  activeRepair?: RepairRow | null;
  latestRepair?: RepairRow | null;
}

export interface HiretrackRepairRecord {
  serviceRecordNo: number | null;
  completedDate: string | null;
  repairLineRef: number | null;
  repairStatus: number | null;
  commissionStatus: number | null;
}

export interface HiretrackRepairState {
  active: boolean;
  activeRepair: HiretrackRepairRecord | null;
  latestRepair: HiretrackRepairRecord | null;
}

function normalizeInt(value: unknown): number | null {
  const numeric = Number(value);
  return value != null && value !== '' && Number.isFinite(numeric) ? numeric : null;
}

function normalizeString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeRepair(row?: RepairRow | null): HiretrackRepairRecord | null {
  if (!row) {
    return null;
  }
  return {
    serviceRecordNo: normalizeInt(row.ServiceRecordNo),
    completedDate: normalizeString(row.CompletedDate),
    repairLineRef: normalizeInt(row.RepairLineRef),
    repairStatus: normalizeInt(row.RepairStatus),
    commissionStatus: normalizeInt(row.CommissionStatus),
  };
}

export async function lookupRepairStateInHiretrack(
  itemRef: number,
  serviceRecordNo?: number | null,
): Promise<HiretrackRepairState> {
  const result = await runHiretrackRead<RepairStateRow>('repair-state', { itemRef, serviceRecordNo });
  return {
    active: result.active === true,
    activeRepair: normalizeRepair(result.activeRepair),
    latestRepair: normalizeRepair(result.latestRepair),
  };
}
