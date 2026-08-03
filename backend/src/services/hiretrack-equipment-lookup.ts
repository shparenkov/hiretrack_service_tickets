import { runHiretrackRead } from './hiretrack-odbc-read';

export interface EquipmentLookupResult {
  barcode: string | null;
  serialNumber: string | null;
  itemRef: number | null;
  equipmentTypeId: number | null;
  equipmentName: string | null;
}

interface EquipmentRow {
  Barcode?: unknown;
  SerialNumber?: unknown;
  ItemRef?: unknown;
  EquipmentTypeId?: unknown;
  EquipmentName?: unknown;
}

function normalizeString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeInt(value: unknown): number | null {
  const numeric = Number(value);
  return value != null && value !== '' && Number.isFinite(numeric) ? numeric : null;
}

export async function lookupEquipmentInHiretrack(
  barcodeRaw?: string | null,
  serialNumber?: string | null,
): Promise<EquipmentLookupResult | null> {
  const lookup = normalizeString(barcodeRaw) || normalizeString(serialNumber);
  if (!lookup) {
    return null;
  }

  const row = await runHiretrackRead<EquipmentRow | null>('equipment', { lookup });
  if (!row) {
    return null;
  }
  return {
    barcode: normalizeString(row.Barcode),
    serialNumber: normalizeString(row.SerialNumber),
    itemRef: normalizeInt(row.ItemRef),
    equipmentTypeId: normalizeInt(row.EquipmentTypeId),
    equipmentName: normalizeString(row.EquipmentName),
  };
}
