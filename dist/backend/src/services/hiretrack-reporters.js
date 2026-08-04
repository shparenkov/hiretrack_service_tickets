"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupHiretrackReporters = lookupHiretrackReporters;
exports.resolveHiretrackReporter = resolveHiretrackReporter;
const hiretrack_odbc_read_1 = require("./hiretrack-odbc-read");
function isReporter(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const item = value;
    return (typeof item.key === 'string'
        && typeof item.person === 'string'
        && (item.role === 'staff' || item.role === 'crew'));
}
async function lookupHiretrackReporters() {
    const result = await (0, hiretrack_odbc_read_1.runHiretrackRead)('reporters', {});
    return Array.isArray(result) ? result.filter(isReporter) : [];
}
async function resolveHiretrackReporter(key) {
    const reporters = await lookupHiretrackReporters();
    return reporters.find((reporter) => reporter.key === key) || null;
}
