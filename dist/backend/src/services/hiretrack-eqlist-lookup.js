"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupEquipmentEqlistsInHiretrack = lookupEquipmentEqlistsInHiretrack;
const hiretrack_odbc_read_1 = require("./hiretrack-odbc-read");
function normalizeString(value) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
}
function normalizeInt(value) {
    const numeric = Number(value);
    return value != null && value !== '' && Number.isFinite(numeric) ? numeric : null;
}
function normalizeBool(value) {
    return value === true || value === 1 || String(value ?? '').trim().toLowerCase() === 'true';
}
async function lookupEquipmentEqlistsInHiretrack(input) {
    const lookup = normalizeString(input.barcodeRaw) || normalizeString(input.serialNumber);
    const itemRef = normalizeInt(input.itemRef) || 0;
    if (!itemRef && !lookup) {
        return [];
    }
    const rows = await (0, hiretrack_odbc_read_1.runHiretrackRead)('eqlists', { itemRef, lookup });
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
            }];
    });
}
