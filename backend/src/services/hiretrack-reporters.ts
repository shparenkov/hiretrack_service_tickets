import { runHiretrackRead } from './hiretrack-odbc-read';

export type HiretrackReporterRole = 'staff' | 'crew';

export interface HiretrackReporter {
  key: string;
  person: string;
  role: HiretrackReporterRole;
}

function isReporter(value: unknown): value is HiretrackReporter {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.key === 'string'
    && typeof item.person === 'string'
    && (item.role === 'staff' || item.role === 'crew')
  );
}

export async function lookupHiretrackReporters(): Promise<HiretrackReporter[]> {
  const result = await runHiretrackRead<unknown[]>('reporters', {});
  return Array.isArray(result) ? result.filter(isReporter) : [];
}

export async function resolveHiretrackReporter(key: string): Promise<HiretrackReporter | null> {
  const reporters = await lookupHiretrackReporters();
  return reporters.find((reporter) => reporter.key === key) || null;
}
