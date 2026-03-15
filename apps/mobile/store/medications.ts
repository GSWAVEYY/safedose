import { create } from 'zustand';
import type { Medication } from '@safedose/shared-types';

interface MedicationsState {
  medications: Medication[];
  isLoading: boolean;
  addMedication: (medication: Medication) => void;
  removeMedication: (id: string) => void;
  updateMedication: (id: string, updates: Partial<Medication>) => void;
  setMedications: (medications: Medication[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useMedicationsStore = create<MedicationsState>((set) => ({
  medications: [],
  isLoading: false,
  addMedication: (medication) =>
    set((state) => ({ medications: [...state.medications, medication] })),
  removeMedication: (id) =>
    set((state) => ({
      medications: state.medications.filter((m) => m.id !== id),
    })),
  updateMedication: (id, updates) =>
    set((state) => ({
      medications: state.medications.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  setMedications: (medications) => set({ medications }),
  setLoading: (isLoading) => set({ isLoading }),
}));
