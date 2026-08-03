"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupEquipmentInHiretrack = lookupEquipmentInHiretrack;
const hiretrack_odbc_read_1 = require("./hiretrack-odbc-read");
function normalizeString(value) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
}
function normalizeInt(value) {
    const numeric = Number(value);
    return value != null && value !== '' && Number.isFinite(numeric) ? numeric : null;
}
async function lookupEquipmentInHiretrack(barcodeRaw, serialNumber) {
    const lookup = normalizeString(barcodeRaw) || normalizeString(serialNumber);
    if (!lookup) {
        return null;
    }
    const row = await (0, hiretrack_odbc_read_1.runHiretrackRead)('equipment', { lookup });
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
