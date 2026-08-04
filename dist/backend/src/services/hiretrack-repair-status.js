"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupRepairStateInHiretrack = lookupRepairStateInHiretrack;
const hiretrack_odbc_read_1 = require("./hiretrack-odbc-read");
function normalizeInt(value) {
    const numeric = Number(value);
    return value != null && value !== '' && Number.isFinite(numeric) ? numeric : null;
}
function normalizeString(value) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
}
function normalizeRepair(row) {
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
async function lookupRepairStateInHiretrack(itemRef, serviceRecordNo) {
    const result = await (0, hiretrack_odbc_read_1.runHiretrackRead)('repair-state', { itemRef, serviceRecordNo });
    return {
        active: result.active === true,
        activeRepair: normalizeRepair(result.activeRepair),
        latestRepair: normalizeRepair(result.latestRepair),
    };
}
