// Caregiver relationship domain types

export type CaregiverRole = 'primary' | 'secondary' | 'observer';

export type CaregiverStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface CaregiverPermissions {
  viewMedications: boolean;
  viewSchedule: boolean;
  viewDoseHistory: boolean;
  receiveMissedDoseAlerts: boolean;
  receiveRefillAlerts: boolean;
  receiveEmergencyAlerts: boolean;
  editMedications: boolean; // only for primary caregivers typically
}

export interface CaregiverRelationship {
  id: string;
  patientId: string;
  caregiverId: string;
  role: CaregiverRole;
  status: CaregiverStatus;
  permissions: CaregiverPermissions;
  invitedAt: string;
  acceptedAt?: string;
}

export interface CaregiverInvite {
  patientId: string;
  caregiverEmail?: string;
  caregiverPhone?: string;
  role: CaregiverRole;
  permissions: Partial<CaregiverPermissions>;
}
