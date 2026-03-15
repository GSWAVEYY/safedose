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
  medicationId?: string; // linked to a medication if reported in context
  description: string;
  severity: 1 | 2 | 3 | 4 | 5; // 1=mild, 5=severe
  reportedAt: string; // ISO 8601
  notes?: string;
}
