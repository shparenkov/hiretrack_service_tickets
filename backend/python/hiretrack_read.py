import json
import os
import sys
from datetime import date, datetime

import pyodbc


DSN = os.environ.get("HIRETRACK_ODBC_DSN", "HireTrack DSN")
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

EQUIPMENT_QUERY = """
    SELECT
        I.Barcode AS Barcode,
        I.SerialNo AS SerialNumber,
        I.ItemRef AS ItemRef,
        I.Type AS EquipmentTypeId,
        H.Description AS EquipmentName
    FROM Item I
    LEFT JOIN Hetype H ON H.Type = I.Type
    WHERE I.Barcode = ? OR I.SerialNo = ?
    ORDER BY I.Barcode
"""

CURRENT_EQLIST_QUERY = """
    SELECT
        E.Eql_no AS EqlistId,
        E.Eql_Name AS EqlistName,
        J.JobNo AS JobNo,
        J.Job_Ref AS JobRef,
        J.Name AS ClientName,
        COALESCE(E.DateOut, E.CreatedDate) AS LastSeenAt,
        0 AS OperationType,
        1 AS IsCurrent
    FROM Item I
    INNER JOIN Eqlists E ON I.CurrentJob = E.Eql_no
    LEFT JOIN Jobs J ON E.Job_no = J.JobNo
    WHERE I.ItemRef = ? AND I.CurrentJob NOT IN (0, 1)
"""

EQLIST_HISTORY_QUERY = """
    SELECT
        E.Eql_no AS EqlistId,
        E.Eql_Name AS EqlistName,
        J.JobNo AS JobNo,
        J.Job_Ref AS JobRef,
        J.Name AS ClientName,
        O.ScanDate AS LastSeenAt,
        O.OpsType AS OperationType,
        CASE WHEN I.CurrentJob = E.Eql_no THEN 1 ELSE 0 END AS IsCurrent
    FROM OpScans O
    INNER JOIN Sort S ON O.xEqLineRef = S.LineRef
    INNER JOIN Eqlists E ON S.Eqlno = E.Eql_no
    LEFT JOIN Jobs J ON E.Job_no = J.JobNo
    LEFT JOIN Item I ON I.ItemRef = O.xItemRef
    WHERE O.xItemRef = ?
    ORDER BY O.ScanDate DESC
"""

REPAIR_BY_RECORD_QUERY = """
    SELECT
        SD.RecordNo AS ServiceRecordNo,
        SD.CompletedDate AS CompletedDate,
        SD.xRepairLineRef AS RepairLineRef,
        S.Defcon AS RepairStatus,
        I.CommissionStatus AS CommissionStatus
    FROM ServData SD
    INNER JOIN Sort S ON S.LineRef = SD.xRepairLineRef
    LEFT JOIN Item I ON I.ItemRef = SD.ItemRef
    WHERE SD.RecordNo = ?
        AND SD.ServiceType = 1
        AND S.Eqlno = 0
        AND S.ListType = 0
"""

REPAIR_BY_ITEM_QUERY = REPAIR_BY_RECORD_QUERY.replace(
    "SD.RecordNo = ?", "SD.ItemRef = ?"
) + " ORDER BY SD.RecordNo DESC"

STAFF_REPORTERS_QUERY = """
    SELECT UID AS SourceId, UserName AS Person
    FROM Users
    WHERE Active = TRUE
    ORDER BY UserName
"""

CREW_REPORTERS_QUERY = """
    SELECT NameCounter AS SourceId, FullName AS Person
    FROM Name2
    WHERE CREW = TRUE
        AND (Archived = FALSE OR Archived IS NULL)
    ORDER BY FullName
"""


def serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def rows_as_dicts(cursor):
    columns = [column[0] for column in cursor.description]
    return [
        {column: serialize(value) for column, value in zip(columns, row)}
        for row in cursor.fetchall()
    ]


def normalize_text(value):
    return str(value or "").strip()


def lookup_equipment(cursor, payload):
    lookup = normalize_text(payload.get("lookup"))
    if not lookup:
        return None
    cursor.execute(EQUIPMENT_QUERY, lookup, lookup)
    rows = rows_as_dicts(cursor)
    return rows[0] if rows else None


def lookup_eqlists(cursor, payload):
    item_ref = int(payload.get("itemRef") or 0)
    lookup = normalize_text(payload.get("lookup"))
    if item_ref <= 0 and not lookup:
        return []
    if item_ref <= 0:
        item = lookup_equipment(cursor, {"lookup": lookup})
        item_ref = int(item.get("ItemRef") or 0) if item else 0
    if item_ref <= 0:
        return []

    cursor.execute(CURRENT_EQLIST_QUERY, item_ref)
    rows = rows_as_dicts(cursor)
    cursor.execute(EQLIST_HISTORY_QUERY, item_ref)
    rows.extend(rows_as_dicts(cursor))
    rows.sort(
        key=lambda row: (bool(row.get("IsCurrent")), normalize_text(row.get("LastSeenAt"))),
        reverse=True,
    )
    return rows


def lookup_repair_state(cursor, payload):
    item_ref = int(payload.get("itemRef") or 0)
    service_record_no = int(payload.get("serviceRecordNo") or 0)
    if service_record_no > 0:
        cursor.execute(REPAIR_BY_RECORD_QUERY, service_record_no)
    elif item_ref > 0:
        cursor.execute(REPAIR_BY_ITEM_QUERY, item_ref)
    else:
        return {"active": False, "activeRepair": None, "latestRepair": None}
    rows = rows_as_dicts(cursor)
    active = next(
        (
            row
            for row in rows
            if row.get("CompletedDate") is None and int(row.get("RepairStatus") or 0) in (1, 4)
        ),
        None,
    )
    return {
        "active": active is not None,
        "activeRepair": active,
        "latestRepair": rows[0] if rows else None,
    }


def lookup_reporters(cursor):
    result = []
    cursor.execute(STAFF_REPORTERS_QUERY)
    for row in rows_as_dicts(cursor):
        person = normalize_text(row.get("Person"))
        if person:
            result.append({
                "key": f"staff:{int(row['SourceId'])}",
                "person": person,
                "role": "staff",
            })

    cursor.execute(CREW_REPORTERS_QUERY)
    for row in rows_as_dicts(cursor):
        person = normalize_text(row.get("Person"))
        if person:
            result.append({
                "key": f"crew:{int(row['SourceId'])}",
                "person": person,
                "role": "crew",
            })

    result.sort(key=lambda reporter: (reporter["person"].casefold(), reporter["role"]))
    return result


def main():
    request = json.load(sys.stdin)
    operation = request.get("operation")
    payload = request.get("payload") or {}
    connection = pyodbc.connect(f"DSN={DSN};", timeout=8, autocommit=True)
    try:
        cursor = connection.cursor()
        if operation == "equipment":
            result = lookup_equipment(cursor, payload)
        elif operation == "eqlists":
            result = lookup_eqlists(cursor, payload)
        elif operation == "repair-state":
            result = lookup_repair_state(cursor, payload)
        elif operation == "reporters":
            result = lookup_reporters(cursor)
        else:
            raise ValueError("Unsupported HireTrack read operation")
        json.dump({"ok": True, "result": result}, sys.stdout, ensure_ascii=False)
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        json.dump({"ok": False, "error": str(error)}, sys.stdout, ensure_ascii=False)
        sys.exit(1)
