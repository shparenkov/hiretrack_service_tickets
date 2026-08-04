/*
<Params>
ItemRef=ftInteger
BadEqlistId=ftInteger
FaultDescriptionExpr=ftString
EngineerNotesExpr=ftString
ReportedBy=ftString
ReportedByExpr=ftString
</Params>
*/
DECLARE vItemRef INTEGER;
DECLARE vExistingServiceRecordNo INTEGER;
DECLARE vExistingRepairLineRef INTEGER;
DECLARE vRepairLineRef INTEGER;
DECLARE vServiceRecordNo INTEGER;
DECLARE vType INTEGER;
DECLARE vOwnerWarehouseID INTEGER;
DECLARE vRepairingWarehouseID INTEGER;
DECLARE vCurrency INTEGER;

SET vItemRef = CAST(:ItemRef AS INTEGER);

SET vExistingServiceRecordNo = (
  SELECT TOP 1 SD.RecordNo
  FROM ServData SD
  INNER JOIN Sort S ON S.LineRef = SD.xRepairLineRef
  WHERE SD.ItemRef = vItemRef
    AND SD.ServiceType = 1
    AND SD.CompletedDate IS NULL
    AND S.Eqlno = 0
    AND S.Defcon IN (1, 4)
    AND S.ListType = 0
  ORDER BY SD.RecordNo DESC
);

IF vExistingServiceRecordNo IS NOT NULL THEN
BEGIN
  SET vExistingRepairLineRef = (
    SELECT xRepairLineRef FROM ServData WHERE RecordNo = vExistingServiceRecordNo
  );
  SELECT
    'existing' AS Result,
    vExistingServiceRecordNo AS ServiceRecordNo,
    vExistingRepairLineRef AS RepairLineRef
  FROM #dummy;
END;
END IF;

IF vExistingServiceRecordNo IS NULL THEN
BEGIN
  SET vType = (SELECT Type FROM Item WHERE ItemRef = vItemRef);
  SET vOwnerWarehouseID = (
    SELECT COALESCE(Homelocation, Lastservice) FROM Item WHERE ItemRef = vItemRef
  );
  SET vRepairingWarehouseID = (
    SELECT COALESCE(Lastservice, Homelocation) FROM Item WHERE ItemRef = vItemRef
  );
  SET vCurrency = (SELECT COALESCE(Currency, 0) FROM Item WHERE ItemRef = vItemRef);

  SET vRepairLineRef = CreateNewRepair(
    vType,
    vOwnerWarehouseID,
    vRepairingWarehouseID,
    vCurrency,
    vItemRef,
    FALSE
  );

  SET vServiceRecordNo = (
    SELECT TOP 1 RecordNo
    FROM ServData
    WHERE xRepairLineRef = vRepairLineRef
    ORDER BY RecordNo DESC
  );

  IF :FaultDescriptionExpr <> '' THEN
  BEGIN
    EXECUTE IMMEDIATE
      'UPDATE Sort SET Notes = ' + :FaultDescriptionExpr +
      ' WHERE LineRef = ' + CAST(vRepairLineRef AS VARCHAR(10));
  END;
  END IF;

  IF :EngineerNotesExpr <> '' THEN
  BEGIN
    EXECUTE IMMEDIATE
      'UPDATE ServData SET Notes = ' + :EngineerNotesExpr +
      ' WHERE RecordNo = ' + CAST(vServiceRecordNo AS VARCHAR(10));
  END;
  END IF;

  IF COALESCE(:ReportedByExpr, '') <> '' THEN
  BEGIN
    EXECUTE IMMEDIATE
      'UPDATE ServData SET xReportedBy = ' + :ReportedByExpr +
      ' WHERE RecordNo = ' + CAST(vServiceRecordNo AS VARCHAR(10));
  END;
  END IF;

  IF COALESCE(:ReportedByExpr, '') = '' AND COALESCE(:ReportedBy, '') <> '' THEN
  BEGIN
    UPDATE ServData SET xReportedBy = :ReportedBy WHERE RecordNo = vServiceRecordNo;
  END;
  END IF;

  UPDATE ServData
  SET xBadEqlno = CASE
                    WHEN CAST(:BadEqlistId AS INTEGER) > 1 THEN CAST(:BadEqlistId AS INTEGER)
                    ELSE xBadEqlno
                  END
  WHERE RecordNo = vServiceRecordNo;

  SELECT
    'created' AS Result,
    vServiceRecordNo AS ServiceRecordNo,
    vRepairLineRef AS RepairLineRef
  FROM #dummy;
END;
END IF;
