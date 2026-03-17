/**
 * PDF Export Service — SafeDose
 *
 * Orchestrates data fetching, HTML template rendering, PDF generation
 * (via expo-print), and sharing (via expo-sharing).
 *
 * Public API:
 *   generateDoseHistoryPdf(userId, days)  → fileUri
 *   generateEmergencyCardPdf(userId)       → fileUri
 *   sharePdf(fileUri, filename)
 *   exportDoseHistory(userId, days)        — generate + share
 *   exportEmergencyCard(userId)            — generate + share
 *
 * Feature gating is enforced here so the service is the single source
 * of truth — callers do not need to check independently.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getAllMedications } from '../db/medications';
import { getDoseHistory, getAdherenceRate } from '../db/dose-log';
import { getSymptomFrequency } from '../db/symptoms';
import { getEmergencyCard } from '../db/emergency-card';
import { isFeatureAvailable } from '../subscriptions/features';
import type { SubscriptionTier } from '../subscriptions/features';

import {
  buildDoseHistoryReportHtml,
  buildEmergencyCardHtml,
  type DoseHistoryReportData,
} from './pdf-templates';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ExportError extends Error {
  readonly code: 'NOT_SUPPORTED' | 'FEATURE_LOCKED' | 'NO_DATA' | 'GENERATION_FAILED' | 'SHARING_FAILED';

  constructor(
    code: ExportError['code'],
    message: string
  ) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateRange(days: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatGeneratedAt(): string {
  return new Date().toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

/**
 * Fetch all required data and generate a dose history PDF.
 *
 * Requires pdfExport feature (family tier).
 *
 * @param userId  - User / patient ID
 * @param days    - Number of days of history to include (default 30)
 * @param tier    - User's current subscription tier for feature gating
 * @returns       - Local file URI of the generated PDF
 */
export async function generateDoseHistoryPdf(
  userId: string,
  days: number = 30,
  tier: SubscriptionTier
): Promise<string> {
  // Feature gate — pdfExport is family-tier only per features.ts
  if (!isFeatureAvailable('pdfExport', tier)) {
    throw new ExportError(
      'FEATURE_LOCKED',
      'Dose history PDF export requires a Family plan. Please upgrade to export your history.'
    );
  }

  // Check sharing availability before doing any work
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new ExportError(
      'NOT_SUPPORTED',
      'Sharing is not available on this device.'
    );
  }

  // Fetch all medications for this user
  const allMedications = await getAllMedications(userId);

  if (allMedications.length === 0) {
    throw new ExportError(
      'NO_DATA',
      'No medications found. Add medications before exporting a history report.'
    );
  }

  // Fetch dose history + adherence for each medication in parallel
  const medicationData = await Promise.all(
    allMedications.map(async (medication) => {
      const [history, adherenceRate] = await Promise.all([
        getDoseHistory(medication.id, days),
        getAdherenceRate(medication.id, days),
      ]);
      return { medication, adherenceRate, doseCount: history.length };
    })
  );

  // Collect all dose logs across medications for the timeline
  // getDoseHistory returns per-medication; we need a combined sorted list
  const allDoseLogs = (
    await Promise.all(
      allMedications.map((med) => getDoseHistory(med.id, days))
    )
  )
    .flat()
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  // Symptom frequency for the period
  const symptomFrequency = await getSymptomFrequency(userId, days);

  const reportData: DoseHistoryReportData = {
    patientName: userId, // Caller should pass display name; userId is the fallback
    reportDateRange: formatDateRange(days),
    generatedAt: formatGeneratedAt(),
    medications: medicationData,
    doseTimeline: allDoseLogs,
    symptomFrequency,
  };

  const html = buildDoseHistoryReportHtml(reportData);

  try {
    const result = await Print.printToFileAsync({ html, base64: false });
    return result.uri;
  } catch (error) {
    console.error('[export] generateDoseHistoryPdf printToFileAsync failed:', error);
    throw new ExportError(
      'GENERATION_FAILED',
      'Failed to generate the PDF. Please try again.'
    );
  }
}

/**
 * Fetch emergency card data and generate a wallet card PDF.
 *
 * Available to all subscription tiers — no feature gate.
 *
 * @param userId - User ID
 * @returns      - Local file URI of the generated PDF
 */
export async function generateEmergencyCardPdf(userId: string): Promise<string> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new ExportError(
      'NOT_SUPPORTED',
      'Sharing is not available on this device.'
    );
  }

  const [card, allMedications] = await Promise.all([
    getEmergencyCard(userId),
    getAllMedications(userId),
  ]);

  if (card === null) {
    throw new ExportError(
      'NO_DATA',
      'No emergency card found. Please set up your emergency card before exporting.'
    );
  }

  const activeMedications = allMedications.filter((m) => m.isActive && !m.endedAt);

  const html = buildEmergencyCardHtml({ card, activeMedications });

  try {
    const result = await Print.printToFileAsync({ html, base64: false });
    return result.uri;
  } catch (error) {
    console.error('[export] generateEmergencyCardPdf printToFileAsync failed:', error);
    throw new ExportError(
      'GENERATION_FAILED',
      'Failed to generate the emergency card PDF. Please try again.'
    );
  }
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/**
 * Open the native share sheet for a PDF file.
 *
 * @param fileUri  - Local file URI returned by generateX functions
 * @param filename - Suggested filename shown in the share sheet
 */
export async function sharePdf(fileUri: string, filename: string): Promise<void> {
  try {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('[export] sharePdf failed:', error);
    throw new ExportError(
      'SHARING_FAILED',
      'Failed to open the share sheet. Please try again.'
    );
  }
}

// ---------------------------------------------------------------------------
// Convenience: generate + share in one call
// ---------------------------------------------------------------------------

/**
 * Generate a dose history PDF for `days` days and immediately open the
 * share sheet. Throws `ExportError` on any failure.
 */
export async function exportDoseHistory(
  userId: string,
  days: number = 30,
  tier: SubscriptionTier
): Promise<void> {
  const fileUri = await generateDoseHistoryPdf(userId, days, tier);
  const filename = `SafeDose_History_${new Date().toISOString().slice(0, 10)}.pdf`;
  await sharePdf(fileUri, filename);
}

/**
 * Generate an emergency wallet card PDF and immediately open the share sheet.
 * Available to all tiers.
 */
export async function exportEmergencyCard(userId: string): Promise<void> {
  const fileUri = await generateEmergencyCardPdf(userId);
  const filename = `SafeDose_EmergencyCard_${new Date().toISOString().slice(0, 10)}.pdf`;
  await sharePdf(fileUri, filename);
}
