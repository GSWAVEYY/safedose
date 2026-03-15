// Schedule and dose logging types

export type FrequencyUnit = 'hours' | 'days' | 'weeks' | 'months';

export type DoseEventType =
  | 'scheduled'
  | 'taken'
  | 'missed'
  | 'skipped'
  | 'late'
  | 'caregiver_confirmed';

export interface Schedule {
  id: string;
  medicationId: string;
  userId: string;
  times: string[]; // Array of HH:mm strings e.g. ["08:00", "20:00"]
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  startDate: string; // ISO 8601 date only
  endDate?: string; // ISO 8601 date only — null = indefinite
  withFood: boolean;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoseLog {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string; // denormalized for audit history
  eventType: DoseEventType;
  scheduledAt: string; // ISO 8601
  confirmedAt?: string; // ISO 8601 — when patient/caregiver confirmed
  confirmedBy?: string; // userId
  notes?: string;
  createdAt: string;
}
