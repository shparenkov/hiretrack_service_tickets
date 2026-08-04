import {
  CreateTicketPayload,
  EquipmentLookupRecord,
  HiretrackEqlistLookupRecord,
  HiretrackReporterRecord,
  HiretrackStockCheckRecord,
  TicketActivityRecord,
  TicketRecord,
} from './types';

function getApiUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured;
  }
  const basePath = window.location.pathname.startsWith('/service-tickets-test')
    ? '/service-tickets-test'
    : '/service-tickets';
  return `${basePath}/api`;
}

const API_URL = getApiUrl();

export class DuplicateTicketError extends Error {
  constructor(public readonly ticket: TicketRecord) {
    super(`Active ticket ${ticket.ticketNumber} already exists for this equipment.`);
    this.name = 'DuplicateTicketError';
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getTickets(): Promise<TicketRecord[]> {
  const response = await fetchJson<{ items: TicketRecord[] }>(`${API_URL}/tickets`);
  return response.items;
}

export async function createTicket(payload: CreateTicketPayload): Promise<TicketRecord> {
  const response = await fetch(`${API_URL}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json() as { ok?: boolean; error?: string; ticket?: TicketRecord };
  if (response.status === 409 && body.ticket) {
    throw new DuplicateTicketError(body.ticket);
  }
  if (!response.ok || !body.ticket) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body.ticket;
}

export async function getTicketActivity(ticketId: string): Promise<TicketActivityRecord[]> {
  const response = await fetchJson<{ ok: boolean; items: TicketActivityRecord[] }>(
    `${API_URL}/tickets/${ticketId}/activity`
  );
  return response.items;
}

export async function lookupEquipment(payload: {
  barcodeRaw?: string | null;
  serialNumber?: string | null;
}): Promise<EquipmentLookupRecord | null> {
  const search = new URLSearchParams();
  if (payload.barcodeRaw) {
    search.set('barcodeRaw', payload.barcodeRaw);
  }
  if (payload.serialNumber) {
    search.set('serialNumber', payload.serialNumber);
  }

  const response = await fetchJson<{ ok: boolean; item: EquipmentLookupRecord | null }>(
    `${API_URL}/tickets/lookups/equipment?${search.toString()}`
  );
  return response.item;
}

export async function lookupHiretrackReporters(): Promise<HiretrackReporterRecord[]> {
  const response = await fetchJson<{ ok: boolean; items: HiretrackReporterRecord[] }>(
    `${API_URL}/tickets/lookups/reporters`
  );
  return response.items;
}

export async function lookupHiretrackStockCheck(payload: {
  barcodeRaw?: string | null;
  serialNumber?: string | null;
}): Promise<HiretrackStockCheckRecord> {
  const search = new URLSearchParams();
  if (payload.barcodeRaw) {
    search.set('barcodeRaw', payload.barcodeRaw);
  }
  if (payload.serialNumber) {
    search.set('serialNumber', payload.serialNumber);
  }

  const response = await fetchJson<{ ok: boolean; result: HiretrackStockCheckRecord }>(
    `${API_URL}/tickets/lookups/stock-check?${search.toString()}`
  );
  return response.result;
}

export async function lookupEquipmentEqlists(payload: {
  itemRef?: number | null;
  barcodeRaw?: string | null;
  serialNumber?: string | null;
}): Promise<HiretrackEqlistLookupRecord[]> {
  const search = new URLSearchParams();
  if (payload.itemRef) {
    search.set('itemRef', String(payload.itemRef));
  }
  if (payload.barcodeRaw) {
    search.set('barcodeRaw', payload.barcodeRaw);
  }
  if (payload.serialNumber) {
    search.set('serialNumber', payload.serialNumber);
  }

  const response = await fetchJson<{ ok: boolean; items: HiretrackEqlistLookupRecord[] }>(
    `${API_URL}/tickets/lookups/eqlists?${search.toString()}`
  );
  return response.items;
}
