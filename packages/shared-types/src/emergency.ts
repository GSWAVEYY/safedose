// Emergency card types

export interface EmergencyMedicationEntry {
  name: string;
  genericName?: string;
  dosage: string; // human readable e.g. "10mg twice daily"
  rxcui?: string;
  allergicTo?: boolean;
}

export interface EmergencyCard {
  userId: string;
  qrToken: string;
  displayName: string;
  dateOfBirth?: string; // ISO 8601 date — optional, user controls
  bloodType?: string;
  allergies: string[];
  medications: EmergencyMedicationEntry[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  primaryPhysician?: string;
  notes?: string;
  updatedAt: string;
}
