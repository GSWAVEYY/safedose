/**
 * pdf-templates.test.ts
 *
 * Unit tests for the SafeDose PDF HTML template builders.
 *
 * Strategy:
 * - Templates are pure functions (string in → HTML string out), so no mocks needed.
 * - Tests verify: correct data injection, XSS escaping, structural HTML landmarks,
 *   and edge cases (empty medications, missing optional fields).
 */

import { describe, it, expect } from 'vitest';
import {
  buildDoseHistoryReportHtml,
  buildEmergencyCardHtml,
  type DoseHistoryReportData,
} from '../pdf-templates';
import type { Medication } from '@safedose/shared-types';
import type { EmergencyCard } from '../../db/emergency-card';

// ---------------------------------------------------------------------------
// Helpers — minimal valid fixtures
// ---------------------------------------------------------------------------

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'med-1',
    userId: 'user-1',
    name: 'Lisinopril',
    dosageAmount: 10,
    dosageUnit: 'mg',
    route: 'oral',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeHistoryData(
  overrides: Partial<DoseHistoryReportData> = {}
): DoseHistoryReportData {
  return {
    patientName: 'Jane Doe',
    reportDateRange: 'Jan 1 – Jan 30, 2026',
    generatedAt: 'March 16, 2026 at 3:00 PM',
    medications: [
      {
        medication: makeMedication(),
        adherenceRate: 0.87,
        doseCount: 28,
      },
    ],
    doseTimeline: [],
    symptomFrequency: { headache: 3, nausea: 1 },
    ...overrides,
  };
}

function makeEmergencyCard(overrides: Partial<EmergencyCard> = {}): EmergencyCard {
  return {
    id: 'card-1',
    userId: 'user-1',
    qrToken: 'token-abc',
    isLocalOnlyToken: false,
    displayName: 'Jane Doe',
    dateOfBirth: '1985-06-15',
    bloodType: 'A+',
    allergies: ['Penicillin', 'Sulfa drugs'],
    medicationIds: ['med-1'],
    emergencyContacts: [
      { id: 'ec-1', name: 'John Doe', phone: '555-1234', relationship: 'Spouse' },
    ],
    primaryPhysicianName: 'Dr. Smith',
    primaryPhysicianPhone: '555-9999',
    medicalConditions: ['Hypertension'],
    notes: null,
    updatedAt: new Date('2026-03-01').getTime(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildDoseHistoryReportHtml — happy path
// ---------------------------------------------------------------------------

describe('buildDoseHistoryReportHtml', () => {
  it('renders patient name in the report', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('Jane Doe');
  });

  it('renders date range', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('Jan 1 – Jan 30, 2026');
  });

  it('renders generated-at timestamp', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('March 16, 2026 at 3:00 PM');
  });

  it('renders medication name in medication table', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('Lisinopril');
  });

  it('renders adherence rate as percentage', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('87%');
  });

  it('renders dose count', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('28 doses');
  });

  it('renders symptom tags in frequency table', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('headache');
    expect(html).toContain('nausea');
  });

  it('renders symptom frequency counts', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('3 times');
    expect(html).toContain('1 time');
  });

  it('includes the FDA disclaimer', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('Important Medical Disclaimer');
    expect(html).toContain('healthcare provider');
  });

  it('includes SafeDose branding', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toContain('SafeDose');
  });

  it('produces valid HTML structure (doctype + html)', () => {
    const html = buildDoseHistoryReportHtml(makeHistoryData());
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('shows empty state when medications list is empty', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({ medications: [] })
    );
    expect(html).toContain('No medications recorded in this period');
  });

  it('shows empty state when dose timeline is empty', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({ doseTimeline: [] })
    );
    expect(html).toContain('No dose events recorded in this period');
  });

  it('shows empty state when symptom frequency is empty', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({ symptomFrequency: {} })
    );
    expect(html).toContain('No symptoms reported in this period');
  });

  it('renders null adherence rate as N/A', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({
        medications: [
          { medication: makeMedication(), adherenceRate: null, doseCount: 0 },
        ],
      })
    );
    expect(html).toContain('N/A');
  });

  // ── XSS escaping ──────────────────────────────────────────────────────────

  it('escapes <script> in patient name', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({ patientName: '<script>alert("xss")</script>' })
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes <img onerror> in medication name', () => {
    const med = makeMedication({ name: '<img onerror="alert(1)" src=x>' });
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({
        medications: [{ medication: med, adherenceRate: 0.5, doseCount: 5 }],
      })
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes double-quotes in patient name', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({ patientName: 'O"Reilly' })
    );
    expect(html).toContain('O&quot;Reilly');
  });

  it('escapes ampersand in symptom tag', () => {
    const html = buildDoseHistoryReportHtml(
      makeHistoryData({ symptomFrequency: { 'pain & nausea': 2 } })
    );
    expect(html).toContain('pain &amp; nausea');
  });
});

// ---------------------------------------------------------------------------
// buildEmergencyCardHtml — happy path
// ---------------------------------------------------------------------------

describe('buildEmergencyCardHtml', () => {
  const activeMeds = [
    makeMedication({ name: 'Lisinopril', dosageAmount: 10, dosageUnit: 'mg' }),
  ];

  it('renders patient display name', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('Jane Doe');
  });

  it('renders blood type prominently', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('A+');
    expect(html).toContain('BLOOD TYPE');
  });

  it('renders allergies', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('Penicillin');
    expect(html).toContain('Sulfa drugs');
  });

  it('renders active medications', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('Lisinopril');
    expect(html).toContain('10');
    expect(html).toContain('mg');
  });

  it('renders emergency contact name and phone', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('John Doe');
    expect(html).toContain('555-1234');
  });

  it('renders primary physician', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('Dr. Smith');
    expect(html).toContain('555-9999');
  });

  it('renders Emergency Medical header', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html.toUpperCase()).toContain('EMERGENCY MEDICAL');
  });

  it('renders QR placeholder on back face', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('QR');
    expect(html).toContain('Scan for full medical record');
  });

  it('includes SafeDose branding', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toContain('SafeDose');
  });

  it('produces valid HTML (doctype + html)', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: activeMeds,
    });
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('</html>');
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('shows no allergies message when allergies list is empty', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ allergies: [] }),
      activeMedications: activeMeds,
    });
    expect(html).toContain('None on file');
  });

  it('shows no medications message when activeMedications is empty', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard(),
      activeMedications: [],
    });
    expect(html).toContain('None on file');
  });

  it('shows no contacts message when emergencyContacts is empty', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ emergencyContacts: [] }),
      activeMedications: activeMeds,
    });
    expect(html).toContain('None on file');
  });

  it('shows ? for unknown blood type', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ bloodType: 'unknown' }),
      activeMedications: activeMeds,
    });
    expect(html).toContain('>?<');
  });

  it('shows ? when blood type is null', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ bloodType: null }),
      activeMedications: activeMeds,
    });
    expect(html).toContain('>?<');
  });

  it('does not render physician section content when physician is null', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ primaryPhysicianName: null, primaryPhysicianPhone: null }),
      activeMedications: activeMeds,
    });
    expect(html).toContain('None on file');
    expect(html).not.toContain('Dr. Smith');
  });

  // ── XSS escaping ──────────────────────────────────────────────────────────

  it('escapes <script> in display name', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ displayName: '<script>xss()</script>' }),
      activeMedications: activeMeds,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes <img> in allergy', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({ allergies: ['<img src=x onerror=alert(1)>'] }),
      activeMedications: activeMeds,
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('escapes ampersand in contact name', () => {
    const html = buildEmergencyCardHtml({
      card: makeEmergencyCard({
        emergencyContacts: [
          { id: 'ec-1', name: 'Mom & Dad', phone: '555-0000', relationship: 'Family' },
        ],
      }),
      activeMedications: activeMeds,
    });
    expect(html).toContain('Mom &amp; Dad');
  });
});
