/**
 * Wellness repository — caregiver burnout prevention.
 *
 * Stores PHQ-2 screener results and additional wellness signals locally.
 * Mental health data is NEVER synced to the server — it stays on device only.
 *
 * PHQ-2 scoring reference (validated clinical instrument):
 *   0-2  — Minimal/no symptoms
 *   3-4  — Mild symptoms; suggest PHQ-9 full screening
 *   5-6  — Moderate-severe; display crisis resources (988 Lifeline)
 *
 * Burnout risk score formula (0-100):
 *   PHQ-2 contribution (0-40):  (phq2_score / 6) * 40
 *   Sleep contribution   (0-25): ((5 - sleep_quality) / 4) * 25  — lower sleep = higher risk
 *   Stress contribution  (0-25): ((stress_level - 1) / 4) * 25  — higher stress = higher risk
 *   Respite contribution (0-10): missed respite weeks / total weeks * 10
 *   Total is averaged over recent weeks, then bucketed into risk levels.
 */

import { getDatabase } from './index';
import { generateId, now } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WellnessCheckinInput {
  phq2Q1: number;       // 0-3: little interest or pleasure
  phq2Q2: number;       // 0-3: feeling down, depressed, hopeless
  sleepQuality?: number; // 1-5
  stressLevel?: number;  // 1-5
  hadRespiteThisWeek: boolean;
  notes?: string;
}

export interface WellnessCheckin {
  id: string;
  userId: string;
  phq2Q1: number;
  phq2Q2: number;
  phq2Score: number;
  sleepQuality: number | null;
  stressLevel: number | null;
  hadRespiteThisWeek: boolean;
  notes: string | null;
  checkedInAt: string; // ISO 8601
  createdAt: string;   // ISO 8601
}

export type BurnoutRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface BurnoutRiskResult {
  score: number;           // 0-100
  level: BurnoutRiskLevel; // bucketed from score
  phq2Score: number | null; // most recent PHQ-2 score, null if no check-ins
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

// ---------------------------------------------------------------------------
// Internal row type
// ---------------------------------------------------------------------------

interface WellnessCheckinRow {
  id: string;
  user_id: string;
  phq2_q1: number;
  phq2_q2: number;
  phq2_score: number;
  sleep_quality: number | null;
  stress_level: number | null;
  had_respite_this_week: number;
  notes: string | null;
  checked_in_at: number;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function rowToCheckin(row: WellnessCheckinRow): WellnessCheckin {
  return {
    id: row.id,
    userId: row.user_id,
    phq2Q1: row.phq2_q1,
    phq2Q2: row.phq2_q2,
    phq2Score: row.phq2_score,
    sleepQuality: row.sleep_quality,
    stressLevel: row.stress_level,
    hadRespiteThisWeek: row.had_respite_this_week === 1,
    notes: row.notes,
    checkedInAt: new Date(row.checked_in_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Risk score helpers
// ---------------------------------------------------------------------------

/**
 * Compute a per-check-in risk score from 0-100.
 * Each component is weighted and summed.
 */
function computeCheckinScore(row: WellnessCheckinRow): number {
  // PHQ-2 component: 0-40 points (most heavily weighted — validated clinical signal)
  const phq2Component = (row.phq2_score / 6) * 40;

  // Sleep component: 0-25 points — lower quality = more risk
  // Default to midpoint (3) if not provided to avoid artificially inflating score.
  const sleep = row.sleep_quality ?? 3;
  const sleepComponent = ((5 - sleep) / 4) * 25;

  // Stress component: 0-25 points — higher stress = more risk
  const stress = row.stress_level ?? 3;
  const stressComponent = ((stress - 1) / 4) * 25;

  // Respite component: 0-10 points — no break this week adds risk
  const respiteComponent = row.had_respite_this_week === 0 ? 10 : 0;

  return Math.min(100, Math.round(phq2Component + sleepComponent + stressComponent + respiteComponent));
}

function scoreToLevel(score: number): BurnoutRiskLevel {
  if (score <= 30) return 'low';
  if (score <= 60) return 'moderate';
  if (score <= 80) return 'high';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a wellness check-in record.
 * This data NEVER goes into the sync queue — it stays on device only.
 */
export async function logCheckin(
  userId: string,
  data: WellnessCheckinInput
): Promise<WellnessCheckin> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();
  const phq2Score = data.phq2Q1 + data.phq2Q2;

  try {
    await db.runAsync(
      `INSERT INTO wellness_checkins
         (id, user_id, phq2_q1, phq2_q2, phq2_score,
          sleep_quality, stress_level, had_respite_this_week,
          notes, checked_in_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        userId,
        data.phq2Q1,
        data.phq2Q2,
        phq2Score,
        data.sleepQuality ?? null,
        data.stressLevel ?? null,
        data.hadRespiteThisWeek ? 1 : 0,
        data.notes ?? null,
        ts,
        ts,
      ]
    );

    return {
      id,
      userId,
      phq2Q1: data.phq2Q1,
      phq2Q2: data.phq2Q2,
      phq2Score,
      sleepQuality: data.sleepQuality ?? null,
      stressLevel: data.stressLevel ?? null,
      hadRespiteThisWeek: data.hadRespiteThisWeek,
      notes: data.notes ?? null,
      checkedInAt: new Date(ts).toISOString(),
      createdAt: new Date(ts).toISOString(),
    };
  } catch (error) {
    console.error('[wellness] logCheckin failed:', error);
    throw error;
  }
}

/**
 * Return the last N weeks of check-ins for a user, newest first.
 * One check-in per week is expected but not enforced.
 */
export async function getRecentCheckins(
  userId: string,
  weeks: number
): Promise<WellnessCheckin[]> {
  const db = getDatabase();
  const since = now() - weeks * 7 * 24 * 60 * 60 * 1000;

  try {
    const rows = await db.getAllAsync<WellnessCheckinRow>(
      `SELECT * FROM wellness_checkins
       WHERE user_id = ? AND checked_in_at >= ?
       ORDER BY checked_in_at DESC`,
      [userId, since]
    );
    return rows.map(rowToCheckin);
  } catch (error) {
    console.error('[wellness] getRecentCheckins failed:', error);
    throw error;
  }
}

/**
 * Calculate a burnout risk score based on recent check-ins.
 *
 * Averages per-check-in scores from the last 4 weeks.
 * Trend is determined by comparing the most recent check-in's score to the
 * prior check-in's score (requires >= 2 check-ins for a trend signal).
 *
 * Returns `score: 0, level: 'low'` if no check-ins exist — the caregiver
 * should be prompted to complete their first check-in rather than alarmed.
 */
export async function getBurnoutRiskScore(userId: string): Promise<BurnoutRiskResult> {
  const db = getDatabase();
  const since = now() - 4 * 7 * 24 * 60 * 60 * 1000;

  try {
    const rows = await db.getAllAsync<WellnessCheckinRow>(
      `SELECT * FROM wellness_checkins
       WHERE user_id = ? AND checked_in_at >= ?
       ORDER BY checked_in_at DESC`,
      [userId, since]
    );

    if (rows.length === 0) {
      return { score: 0, level: 'low', phq2Score: null, trend: 'unknown' };
    }

    // Compute per-row scores
    const scores = rows.map(computeCheckinScore);
    const avgScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

    // Trend: compare newest vs previous (scores array is newest-first)
    let trend: BurnoutRiskResult['trend'] = 'stable';
    if (scores.length >= 2) {
      const delta = scores[0] - scores[1];
      if (delta <= -5) trend = 'improving';
      else if (delta >= 5) trend = 'declining';
      else trend = 'stable';
    } else {
      trend = 'unknown';
    }

    return {
      score: avgScore,
      level: scoreToLevel(avgScore),
      phq2Score: rows[0].phq2_score,
      trend,
    };
  } catch (error) {
    console.error('[wellness] getBurnoutRiskScore failed:', error);
    throw error;
  }
}

/**
 * Return the Unix millisecond timestamp of the user's most recent check-in,
 * or null if they have never checked in.
 */
export async function getLastCheckinDate(userId: string): Promise<number | null> {
  const db = getDatabase();

  try {
    const row = await db.getFirstAsync<{ checked_in_at: number }>(
      `SELECT checked_in_at FROM wellness_checkins
       WHERE user_id = ?
       ORDER BY checked_in_at DESC
       LIMIT 1`,
      [userId]
    );
    return row?.checked_in_at ?? null;
  } catch (error) {
    console.error('[wellness] getLastCheckinDate failed:', error);
    throw error;
  }
}
