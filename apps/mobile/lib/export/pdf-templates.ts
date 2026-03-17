/**
 * PDF HTML templates for SafeDose export system.
 *
 * All templates return inline-CSS HTML strings suitable for expo-print.
 * User-supplied data is always run through `esc()` before insertion to
 * prevent XSS in the generated HTML.
 *
 * Template dimensions:
 *   - Dose history report: A4 page with 20mm margins
 *   - Emergency wallet card: 3.5" x 2" (252pt x 144pt) — standard CR80
 */

import type { Medication } from '@safedose/shared-types';
import type { DoseLog } from '@safedose/shared-types';
import type { EmergencyCard, EmergencyContact } from '../db/emergency-card';

// ---------------------------------------------------------------------------
// Escaping — prevent XSS in injected user data
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters in a string before injecting into a
 * template literal. Never skip this for user-supplied values.
 */
function esc(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escNum(value: number | null | undefined): string {
  if (value == null) return '';
  return String(value);
}

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const TEAL = '#0d9488';
const DARK = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const RED = '#dc2626';
const WHITE = '#ffffff';

// ---------------------------------------------------------------------------
// Dose history report template
// ---------------------------------------------------------------------------

export interface DoseHistoryReportData {
  patientName: string;
  reportDateRange: string; // e.g. "Jan 1 – Jan 30, 2026"
  generatedAt: string;      // e.g. "March 16, 2026 at 3:00 PM"
  medications: Array<{
    medication: Medication;
    adherenceRate: number | null; // 0–1 or null
    doseCount: number;
  }>;
  doseTimeline: DoseLog[];
  symptomFrequency: Record<string, number>; // tag → count
}

function renderMedicationTableRows(
  meds: DoseHistoryReportData['medications']
): string {
  if (meds.length === 0) {
    return `<tr><td colspan="4" style="text-align:center;color:${MUTED};padding:16px;">No medications recorded in this period.</td></tr>`;
  }

  return meds
    .map(({ medication: m, adherenceRate, doseCount }) => {
      const adherenceText =
        adherenceRate !== null
          ? `${Math.round(adherenceRate * 100)}%`
          : 'N/A';
      const statusColor =
        m.isActive && !m.endedAt
          ? '#15803d'
          : m.endedAt
          ? MUTED
          : '#b45309';
      const statusLabel = m.isActive && !m.endedAt
        ? 'Active'
        : m.endedAt
        ? 'Discontinued'
        : 'Paused';

      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};">
            <strong style="color:${DARK};">${esc(m.name)}</strong>
            ${m.genericName ? `<br><span style="color:${MUTED};font-size:12px;">${esc(m.genericName)}</span>` : ''}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};color:${DARK};">
            ${escNum(m.dosageAmount)} ${esc(m.dosageUnit)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};">
            <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};color:${DARK};">
            ${esc(adherenceText)} <span style="color:${MUTED};font-size:12px;">(${escNum(doseCount)} doses)</span>
          </td>
        </tr>`;
    })
    .join('');
}

function renderDoseTimelineRows(logs: DoseLog[]): string {
  if (logs.length === 0) {
    return `<tr><td colspan="4" style="text-align:center;color:${MUTED};padding:16px;">No dose events recorded in this period.</td></tr>`;
  }

  const EVENT_COLORS: Record<string, string> = {
    taken: '#15803d',
    caregiver_confirmed: '#15803d',
    missed: RED,
    skipped: '#b45309',
    late: '#b45309',
  };

  return logs
    .map((log) => {
      const date = new Date(log.scheduledAt);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const eventColor = EVENT_COLORS[log.eventType] ?? MUTED;
      const eventLabel = log.eventType.replace(/_/g, ' ');

      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${DARK};font-size:13px;">${esc(dateStr)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${MUTED};font-size:13px;">${esc(timeStr)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${DARK};font-size:13px;">${esc(log.medicationName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:13px;">
            <span style="color:${eventColor};font-weight:600;text-transform:capitalize;">${esc(eventLabel)}</span>
          </td>
        </tr>`;
    })
    .join('');
}

function renderSymptomFrequencyRows(freq: Record<string, number>): string {
  const entries = Object.entries(freq).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) {
    return `<tr><td colspan="2" style="text-align:center;color:${MUTED};padding:16px;">No symptoms reported in this period.</td></tr>`;
  }

  return entries
    .map(([tag, count]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${DARK};font-size:13px;text-transform:capitalize;">${esc(tag)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};color:${MUTED};font-size:13px;">${escNum(count)} time${count !== 1 ? 's' : ''}</td>
      </tr>`)
    .join('');
}

/**
 * Build the full HTML string for a dose history PDF report.
 */
export function buildDoseHistoryReportHtml(data: DoseHistoryReportData): string {
  const medicationTableRows = renderMedicationTableRows(data.medications);
  const doseTimelineRows = renderDoseTimelineRows(data.doseTimeline);
  const symptomFrequencyRows = renderSymptomFrequencyRows(data.symptomFrequency);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SafeDose Dose History Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, Arial, sans-serif;
      font-size: 14px;
      color: ${DARK};
      background: ${WHITE};
      padding: 20mm;
    }
    h1, h2 { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #f1f5f9;
      color: ${MUTED};
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid ${BORDER};
    }
    .section { margin-top: 32px; }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: ${MUTED};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid ${BORDER};
    }
    .disclaimer {
      margin-top: 40px;
      padding: 12px 16px;
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 6px;
      font-size: 11px;
      color: #713f12;
      line-height: 1.5;
    }
    @media print {
      body { padding: 15mm; }
      .no-break { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- ── Header ── -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ${TEAL};">
    <div>
      <div style="color:${TEAL};font-size:22px;font-weight:800;letter-spacing:-0.5px;">SafeDose</div>
      <div style="color:${MUTED};font-size:12px;margin-top:2px;">Medication Management</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:700;color:${DARK};">Dose History Report</div>
      <div style="color:${MUTED};font-size:12px;margin-top:4px;">Patient: <strong>${esc(data.patientName)}</strong></div>
      <div style="color:${MUTED};font-size:12px;">Period: ${esc(data.reportDateRange)}</div>
      <div style="color:${MUTED};font-size:11px;margin-top:4px;">Generated: ${esc(data.generatedAt)}</div>
    </div>
  </div>

  <!-- ── Medications Summary ── -->
  <div class="section no-break">
    <div class="section-title">Medications &amp; Adherence Summary</div>
    <table>
      <thead>
        <tr>
          <th>Medication</th>
          <th>Strength</th>
          <th>Status</th>
          <th>Adherence Rate</th>
        </tr>
      </thead>
      <tbody>
        ${medicationTableRows}
      </tbody>
    </table>
  </div>

  <!-- ── Dose Timeline ── -->
  <div class="section">
    <div class="section-title">Dose Timeline</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Time</th>
          <th>Medication</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${doseTimelineRows}
      </tbody>
    </table>
  </div>

  <!-- ── Symptom Summary ── -->
  <div class="section no-break">
    <div class="section-title">Symptom Summary</div>
    <table>
      <thead>
        <tr>
          <th>Symptom</th>
          <th>Frequency in Period</th>
        </tr>
      </thead>
      <tbody>
        ${symptomFrequencyRows}
      </tbody>
    </table>
  </div>

  <!-- ── FDA Disclaimer ── -->
  <div class="disclaimer">
    <strong>Important Medical Disclaimer:</strong> This report is generated from user-entered data and is intended
    for informational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations.
    Consult your healthcare provider before making any changes to your medication regimen. This report has not been
    reviewed by the FDA or any other regulatory authority. In an emergency, call 911 or your local emergency services.
  </div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Emergency wallet card template
// ---------------------------------------------------------------------------

export interface EmergencyCardPdfData {
  card: EmergencyCard;
  activeMedications: Medication[];
}

function renderContactRow(contact: EmergencyContact): string {
  return `
    <div style="margin-bottom:6px;">
      <div style="font-weight:700;font-size:12px;color:${DARK};">${esc(contact.name)} <span style="font-weight:400;color:${MUTED};font-size:11px;">(${esc(contact.relationship)})</span></div>
      <div style="font-size:12px;color:${TEAL};font-weight:600;">${esc(contact.phone)}</div>
    </div>`;
}

function renderMedicationLine(med: Medication): string {
  return `<div style="font-size:11px;color:${DARK};margin-bottom:2px;">&#8226; ${esc(med.name)} ${escNum(med.dosageAmount)} ${esc(med.dosageUnit)}</div>`;
}

/**
 * Build the full HTML string for an emergency wallet card PDF.
 *
 * The card is sized to 3.5" x 2" (252pt x 144pt) — standard CR80 wallet card.
 * We render front and back on separate pages.
 */
export function buildEmergencyCardHtml(data: EmergencyCardPdfData): string {
  const { card, activeMedications } = data;

  const allergiesHtml =
    card.allergies.length > 0
      ? card.allergies
          .map((a) => `<span style="color:${RED};font-weight:700;font-size:12px;">${esc(a)}</span>`)
          .join(' &bull; ')
      : `<span style="color:${MUTED};font-size:12px;">None on file</span>`;

  const medicationsHtml =
    activeMedications.length > 0
      ? activeMedications.map(renderMedicationLine).join('')
      : `<div style="font-size:11px;color:${MUTED};">None on file</div>`;

  const contactsHtml =
    card.emergencyContacts.length > 0
      ? card.emergencyContacts.map(renderContactRow).join('')
      : `<div style="font-size:11px;color:${MUTED};">None on file</div>`;

  const doctorHtml = card.primaryPhysicianName
    ? `<div style="font-weight:700;font-size:12px;color:${DARK};">${esc(card.primaryPhysicianName)}</div>
       ${card.primaryPhysicianPhone ? `<div style="font-size:12px;color:${TEAL};font-weight:600;">${esc(card.primaryPhysicianPhone)}</div>` : ''}`
    : `<div style="font-size:11px;color:${MUTED};">None on file</div>`;

  const dobHtml = card.dateOfBirth
    ? `<span style="font-size:11px;color:${MUTED};">DOB: ${esc(card.dateOfBirth)}</span>`
    : '';

  const bloodTypeDisplay =
    card.bloodType && card.bloodType !== 'unknown' ? card.bloodType : '?';

  const updatedDate = new Date(card.updatedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Wallet card dimensions: 3.5in x 2in = 252pt x 144pt
  // We output each face as a page so they can be printed and cut.
  const CARD_W = '252pt';
  const CARD_H = '144pt';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SafeDose Emergency Card</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, Arial, sans-serif;
      background: #f8fafc;
    }
    .card-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20pt;
    }
    .card {
      width: ${CARD_W};
      min-height: ${CARD_H};
      background: ${WHITE};
      border: 1.5pt solid #cbd5e1;
      border-radius: 8pt;
      overflow: hidden;
      box-shadow: 0 2pt 8pt rgba(0,0,0,0.12);
    }
    @media print {
      body { background: white; }
      .card-page { min-height: unset; padding: 0; page-break-after: always; }
      .card { box-shadow: none; border: 1pt solid #000; }
    }
  </style>
</head>
<body>

  <!-- ─── FRONT ─── -->
  <div class="card-page">
    <div class="card">

      <!-- Red header bar -->
      <div style="background:${RED};padding:6pt 10pt;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="color:${WHITE};font-weight:800;font-size:10pt;letter-spacing:1.5pt;text-transform:uppercase;">Emergency Medical</div>
          <div style="color:#fca5a5;font-size:8pt;margin-top:1pt;">Carry at all times</div>
        </div>
        <div style="background:${WHITE};border-radius:4pt;padding:3pt 7pt;text-align:center;">
          <div style="color:${RED};font-weight:800;font-size:14pt;line-height:1;">${esc(bloodTypeDisplay)}</div>
          <div style="color:${RED};font-size:7pt;font-weight:600;">BLOOD TYPE</div>
        </div>
      </div>

      <!-- Patient name + DOB -->
      <div style="padding:7pt 10pt 5pt;">
        <div style="font-size:14pt;font-weight:800;color:${DARK};line-height:1.1;">${esc(card.displayName)}</div>
        ${dobHtml}
      </div>

      <!-- Divider -->
      <div style="height:1pt;background:${BORDER};margin:0 10pt;"></div>

      <!-- Allergies -->
      <div style="padding:5pt 10pt;">
        <div style="font-size:8pt;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.5pt;margin-bottom:3pt;">Allergies</div>
        <div>${allergiesHtml}</div>
      </div>

      <!-- Medications -->
      <div style="padding:4pt 10pt;">
        <div style="font-size:8pt;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.5pt;margin-bottom:3pt;">Current Medications</div>
        ${medicationsHtml}
      </div>

      <!-- Footer -->
      <div style="background:#f1f5f9;padding:4pt 10pt;display:flex;justify-content:space-between;align-items:center;margin-top:auto;">
        <div style="color:${TEAL};font-weight:700;font-size:9pt;">SafeDose</div>
        <div style="font-size:8pt;color:${MUTED};">Updated: ${esc(updatedDate)}</div>
      </div>

    </div>
  </div>

  <!-- ─── BACK ─── -->
  <div class="card-page">
    <div class="card">

      <!-- Back header -->
      <div style="background:${DARK};padding:5pt 10pt;">
        <div style="color:${WHITE};font-size:8pt;font-weight:700;letter-spacing:1pt;text-transform:uppercase;">Emergency Contacts</div>
      </div>

      <!-- Contacts -->
      <div style="padding:7pt 10pt;">
        ${contactsHtml}
      </div>

      <!-- Divider -->
      <div style="height:1pt;background:${BORDER};margin:0 10pt;"></div>

      <!-- Primary doctor -->
      <div style="padding:6pt 10pt;">
        <div style="font-size:8pt;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.5pt;margin-bottom:3pt;">Primary Physician</div>
        ${doctorHtml}
      </div>

      <!-- QR placeholder + footer -->
      <div style="background:#f1f5f9;padding:5pt 10pt;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="color:${MUTED};font-size:8pt;">Scan for full medical record</div>
          <div style="color:${TEAL};font-weight:700;font-size:9pt;margin-top:1pt;">SafeDose</div>
        </div>
        <!-- QR code placeholder box -->
        <div style="width:36pt;height:36pt;border:1.5pt solid #cbd5e1;border-radius:4pt;display:flex;align-items:center;justify-content:center;background:white;">
          <div style="font-size:7pt;color:${MUTED};text-align:center;line-height:1.3;">QR<br/>Code</div>
        </div>
      </div>

    </div>
  </div>

</body>
</html>`;
}
