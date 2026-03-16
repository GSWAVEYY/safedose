// Doctor and Appointment domain types

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialty?: string;
  phone?: string;
  address?: string;
  npiNumber?: string;
  notes?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface DoctorCreate {
  name: string;
  specialty?: string;
  phone?: string;
  address?: string;
  npiNumber?: string;
  notes?: string;
}

export interface DoctorUpdate extends Partial<DoctorCreate> {
  id: string;
}

export interface Appointment {
  id: string;
  userId: string;
  doctorId?: string;
  /** Doctor name joined from doctors table — available when doctorId is set. */
  doctorName?: string;
  title: string;
  scheduledAt: string; // ISO 8601
  durationMinutes: number;
  location?: string;
  notes?: string;
  /** JSON-serialised string[] of checklist items. */
  preVisitChecklist: string[];
  postVisitNotes?: string;
  status: AppointmentStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface AppointmentCreate {
  doctorId?: string;
  title: string;
  scheduledAt: string; // ISO 8601
  durationMinutes?: number;
  location?: string;
  notes?: string;
  preVisitChecklist?: string[];
}

export interface AppointmentUpdate extends Partial<AppointmentCreate> {
  id: string;
  postVisitNotes?: string;
  status?: AppointmentStatus;
}
