// Medication domain types

export type DosageUnit =
  | 'mg'
  | 'mcg'
  | 'g'
  | 'ml'
  | 'tablet'
  | 'capsule'
  | 'patch'
  | 'drop'
  | 'puff'
  | 'unit';

export type DosageRoute =
  | 'oral'
  | 'sublingual'
  | 'topical'
  | 'inhaled'
  | 'injection'
  | 'nasal'
  | 'ophthalmic'
  | 'otic'
  | 'rectal'
  | 'transdermal';

export interface Medication {
  id: string;
  userId: string;
  name: string;
  genericName?: string;
  rxcui?: string; // RxNorm concept unique identifier
  dosageAmount: number;
  dosageUnit: DosageUnit;
  route: DosageRoute;
  instructions?: string;
  prescriber?: string;
  pharmacy?: string;
  refillsRemaining?: number;
  expiresAt?: string; // ISO 8601
  startedAt?: string; // ISO 8601
  endedAt?: string; // ISO 8601 — null means active
  isActive: boolean;
  imageUri?: string; // local path on device
  // Refill tracking fields (optional — only set when user has entered refill info)
  refillDate?: string; // ISO 8601 — date when refill is needed
  daysSupply?: number; // number of days the current supply covers
  pillCount?: number; // remaining pill/unit count
  createdAt: string;
  updatedAt: string;
}

export interface MedicationCreate
  extends Omit<Medication, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isActive'> {
  isActive?: boolean;
}

export interface MedicationUpdate extends Partial<MedicationCreate> {
  id: string;
}

export interface Symptom {
  id: string;
  userId: string;
  /** Tags from the standard symptom list (e.g. 'headache', 'nausea'). Stored as JSON array. */
  symptoms: string[];
  /** 1 = mild, 10 = severe */
  severity: number;
  reportedAt: string; // ISO 8601
  notes?: string;
  createdAt: string; // ISO 8601
  deletedAt?: string; // ISO 8601 — soft delete
}

export interface SymptomInput {
  symptoms: string[];
  severity: number;
  notes?: string;
}

export type SymptomFrequency = Record<string, number>;
