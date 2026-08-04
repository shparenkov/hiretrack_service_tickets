import { FormEvent, Suspense, lazy, useEffect, useState } from 'react';
import {
  CreateTicketPayload,
  HiretrackEqlistLookupRecord,
  HiretrackReporterRecord,
  HiretrackStockCheckRecord,
  TicketRecord,
} from '../types';
import { DuplicateTicketError, lookupHiretrackReporters, lookupHiretrackStockCheck } from '../api';

const BarcodeScanner = lazy(async () => {
  const module = await import('./BarcodeScanner');
  return { default: module.BarcodeScanner };
});

interface TicketFormProps {
  onCreate: (payload: CreateTicketPayload) => Promise<TicketRecord>;
}

function buildStockCheckLabel(
  stockCheck: HiretrackStockCheckRecord | null,
  isResolvingEquipment: boolean,
  hasLookupCandidate: boolean,
) {
  if (isResolvingEquipment) {
    return 'Checking HireTrack NX stock...';
  }

  if (!hasLookupCandidate) {
    return 'Enter barcode or serial number to run stock check';
  }

  if (!stockCheck) {
    return 'Stock check not run yet';
  }

  if (stockCheck.status === 'not_found') {
    return 'No HireTrack item found for this code';
  }

  if (stockCheck.status === 'on_eqlist') {
    const jobLabel = stockCheck.currentJobRef || (stockCheck.currentJobNo ? `job ${stockCheck.currentJobNo}` : 'current job');
    const eqlistLabel = stockCheck.currentEqlistName || (stockCheck.currentEqlistId ? `eqlist ${stockCheck.currentEqlistId}` : 'current eqlist');
    return `Out on ${jobLabel} / ${eqlistLabel}`;
  }

  return 'In stock / no current eqlist';
}

function buildCurrentJobLabel(stockCheck: HiretrackStockCheckRecord | null) {
  if (!stockCheck || stockCheck.status !== 'on_eqlist') {
    return 'No current HireTrack job/list';
  }

  const parts = [
    stockCheck.currentJobRef || (stockCheck.currentJobNo ? `Job ${stockCheck.currentJobNo}` : null),
    stockCheck.currentEqlistName || (stockCheck.currentEqlistId ? `Eqlist ${stockCheck.currentEqlistId}` : null),
    stockCheck.currentClientName,
  ].filter(Boolean);

  return parts.join(' / ');
}

export function TicketForm({ onCreate }: TicketFormProps) {
  const [form, setForm] = useState<CreateTicketPayload>({
    equipmentName: '',
    serialNumber: '',
    faultDescription: '',
    clientName: '',
    hiretrackItemRef: null,
    hiretrackEquipmentTypeId: null,
    createdBy: '',
    hiretrackReporterKey: '',
  });
  const [reporters, setReporters] = useState<HiretrackReporterRecord[]>([]);
  const [reporterInput, setReporterInput] = useState('');
  const [reportersError, setReportersError] = useState<string | null>(null);
  const [lookupCode, setLookupCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isResolvingEquipment, setIsResolvingEquipment] = useState(false);
  const [eqlistOptions, setEqlistOptions] = useState<HiretrackEqlistLookupRecord[]>([]);
  const [stockCheck, setStockCheck] = useState<HiretrackStockCheckRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLookupCandidate = Boolean(lookupCode.trim());
  const hasMatchedHiretrackItem = Boolean(form.hiretrackItemRef);
  const shouldWarnLookupMissing = hasLookupCandidate && !hasMatchedHiretrackItem && !isResolvingEquipment;

  useEffect(() => {
    let cancelled = false;
    lookupHiretrackReporters()
      .then((items) => {
        if (!cancelled) {
          setReporters(items);
          setReportersError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setReportersError(caught instanceof Error ? caught.message : 'HireTrack reporter lookup failed.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function reporterLabel(reporter: HiretrackReporterRecord) {
    return `${reporter.person} [${reporter.role === 'staff' ? 'Staff' : 'Crew'}]`;
  }

  function clearHiretrackMatch(nextStockCheck: HiretrackStockCheckRecord | null = null) {
    setForm((current) => ({
      ...current,
      hiretrackItemRef: null,
      hiretrackEquipmentTypeId: null,
      hiretrackEqlistId: null,
      hiretrackEqlistName: null,
      hiretrackJobNo: null,
      hiretrackJobRef: null,
    }));
    setEqlistOptions([]);
    setStockCheck(nextStockCheck);
  }

  async function runStockCheck(next: { barcodeRaw?: string | null; serialNumber?: string | null }) {
    setIsResolvingEquipment(true);
    try {
      const result = await lookupHiretrackStockCheck(next);
      if (result.item?.equipmentName) {
        setStockCheck(result);
        setEqlistOptions(result.eqlists);
        setForm((current) => ({
          ...current,
          equipmentName: result.item?.equipmentName || current.equipmentName,
          serialNumber: result.item?.serialNumber || current.serialNumber,
          barcodeRaw: result.item?.barcode || next.barcodeRaw || current.barcodeRaw,
          hiretrackItemRef: result.item?.itemRef ?? null,
          hiretrackEquipmentTypeId: result.item?.equipmentTypeId ?? null,
          hiretrackEqlistId: result.currentEqlistId,
          hiretrackEqlistName: result.currentEqlistName,
          hiretrackJobNo: result.currentJobNo,
          hiretrackJobRef: result.currentJobRef,
        }));
        setMessage(
          result.status === 'on_eqlist'
            ? `HireTrack: ${result.item.equipmentName} / ${result.currentJobRef || `job ${result.currentJobNo ?? '?'}`}`
            : `HireTrack: ${result.item.equipmentName} / in stock`
        );
        setError(null);
      } else {
        clearHiretrackMatch(result);
        setMessage('HireTrack did not find equipment for this code.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'HireTrack equipment lookup failed.');
    } finally {
      setIsResolvingEquipment(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.hiretrackReporterKey || !form.createdBy) {
      setError('Выберите сотрудника из справочника HireTrack Staff/Crew.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const created = await onCreate(form);
      setMessage(`Created ${created.ticketNumber}`);
      setForm({
        equipmentName: '',
        serialNumber: '',
        faultDescription: '',
        clientName: '',
        hiretrackItemRef: null,
        hiretrackEquipmentTypeId: null,
        hiretrackEqlistId: null,
        hiretrackEqlistName: null,
        hiretrackJobNo: null,
        hiretrackJobRef: null,
        createdBy: '',
        hiretrackReporterKey: '',
      });
      setReporterInput('');
      setLookupCode('');
      setEqlistOptions([]);
      setStockCheck(null);
    } catch (caught) {
      if (caught instanceof DuplicateTicketError) {
        const ticket = caught.ticket;
        setError(
          `Тикет ${ticket.ticketNumber} уже активен: статус ${ticket.status}, создан ${new Date(ticket.createdAt).toLocaleString('ru-RU')} пользователем ${ticket.createdBy}. Он выделен в списке тикетов.`
        );
      } else {
        setError(caught instanceof Error ? caught.message : 'Failed to create ticket.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      {isScannerOpen ? (
        <Suspense fallback={<div className="scanner-loading">Loading scanner...</div>}>
          <BarcodeScanner
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onUse={(scanResult) => {
              const next = {
                barcodeRaw: scanResult.raw,
                barcodeType: scanResult.barcodeType,
              };
              setForm((current) => ({
                ...current,
                ...next,
                hiretrackItemRef: null,
                hiretrackEquipmentTypeId: null,
                hiretrackEqlistId: null,
                hiretrackEqlistName: null,
                hiretrackJobNo: null,
                hiretrackJobRef: null,
              }));
              setLookupCode(scanResult.raw);
              setEqlistOptions([]);
              setMessage(`Scanned ${scanResult.barcodeType}`);
              setError(null);
              setIsScannerOpen(false);
              void runStockCheck({ barcodeRaw: next.barcodeRaw, serialNumber: null });
            }}
          />
        </Suspense>
      ) : null}

      <div className="form-header">
        <h2>New Ticket</h2>
        <p>Введите баркод или серийный номер либо откройте сканер одной кнопкой.</p>
      </div>

      {shouldWarnLookupMissing ? (
        <div className="warning-banner">
          Оборудование еще не найдено в HireTrack. Выполните поиск перед созданием ремонта.
        </div>
      ) : null}

      <div className="form-grid">
        <label className="full">
          Баркод или серийный номер
          <div className="serial-input-row">
            <input
              value={lookupCode}
              onChange={(event) => {
                const value = event.target.value;
                clearHiretrackMatch();
                setLookupCode(value);
                setForm((current) => ({
                  ...current,
                  barcodeRaw: value || null,
                  serialNumber: value,
                }));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && lookupCode.trim()) {
                  event.preventDefault();
                  void runStockCheck({ barcodeRaw: lookupCode.trim(), serialNumber: null });
                }
              }}
              placeholder="Введите код или оставьте пустым для камеры"
              autoComplete="off"
            />
            <button
              type="button"
              className="scanner-trigger"
              onClick={() => {
                const code = lookupCode.trim();
                if (code) {
                  void runStockCheck({ barcodeRaw: code, serialNumber: null });
                } else {
                  setIsScannerOpen(true);
                }
              }}
              disabled={isResolvingEquipment}
            >
              {isResolvingEquipment ? 'Поиск...' : lookupCode.trim() ? 'Найти' : 'Сканировать'}
            </button>
          </div>
        </label>

        <label>
          Equipment Name
          <input
            value={form.equipmentName || ''}
            onChange={(event) => setForm((current) => ({ ...current, equipmentName: event.target.value }))}
            required
          />
        </label>

        <label>
          Serial Number
          <input value={form.serialNumber || ''} readOnly required />
        </label>

        <label>
          Barcode
          <input value={form.barcodeRaw || ''} readOnly />
        </label>

        <label>
          HT ItemRef
          <input value={form.hiretrackItemRef ?? ''} readOnly placeholder="Resolved from HireTrack" />
        </label>

        <label className="full">
          Кто сообщил о поломке
          <input
            value={reporterInput}
            onChange={(event) => {
              const value = event.target.value;
              const selected = reporters.find((reporter) => reporterLabel(reporter) === value) || null;
              setReporterInput(value);
              setForm((current) => ({
                ...current,
                createdBy: selected?.person || '',
                hiretrackReporterKey: selected?.key || '',
              }));
            }}
            list="hiretrack-reporters"
            placeholder="Начните вводить имя"
            autoComplete="off"
            required
          />
          <datalist id="hiretrack-reporters">
            {reporters.map((reporter) => (
              <option key={reporter.key} value={reporterLabel(reporter)} />
            ))}
          </datalist>
          {reportersError ? <small className="field-error">{reportersError}</small> : null}
        </label>

        <label className="full">
          Related Eqlist
          <select
            value={form.hiretrackEqlistId ?? ''}
            onChange={(event) => {
              const nextId = event.target.value ? Number(event.target.value) : null;
              const selected = eqlistOptions.find((item) => item.eqlistId === nextId) || null;
              setForm((current) => ({
                ...current,
                hiretrackEqlistId: nextId,
                hiretrackEqlistName: selected?.eqlistName ?? null,
                hiretrackJobNo: selected?.jobNo ?? null,
                hiretrackJobRef: selected?.jobRef ?? null,
              }));
            }}
            disabled={eqlistOptions.length === 0}
          >
            <option value="">No linked eqlist</option>
            {eqlistOptions.map((item) => (
              <option key={item.eqlistId} value={item.eqlistId}>
                {item.isCurrent ? '[Current] ' : ''}
                {item.jobRef ? `${item.jobRef} - ` : ''}
                {item.eqlistName || `Eqlist ${item.eqlistId}`}
              </option>
            ))}
          </select>
        </label>

        <label className="full">
          Stock Check
          <input
            value={buildStockCheckLabel(stockCheck, isResolvingEquipment, hasLookupCandidate)}
            readOnly
          />
        </label>

        <label className="full">
          Current HireTrack Job
          <input value={buildCurrentJobLabel(stockCheck)} readOnly />
        </label>

        <label className="full">
          Match Status
          <input
            value={
              form.hiretrackItemRef
                ? `Matched HT item ${form.hiretrackItemRef}${form.hiretrackEquipmentTypeId ? ` / type ${form.hiretrackEquipmentTypeId}` : ''}`
                : 'No HireTrack item matched yet'
            }
            readOnly
          />
        </label>

        <label className="full">
          Fault Description
          <textarea
            value={form.faultDescription || ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, faultDescription: event.target.value }))
            }
            required
            rows={4}
          />
        </label>
      </div>

      <div className="form-footer">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Ticket'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
        {error ? <span className="error-text">{error}</span> : null}
      </div>
    </form>
  );
}
