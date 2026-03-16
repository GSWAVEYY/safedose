/**
 * Zustand store for caregiver relationships and dose event feed.
 *
 * Wraps the caregiving API endpoints so screens never call apiClient directly.
 * All mutations are optimistic where safe; errors are surfaced via `error`.
 */

import { create } from 'zustand';
import { apiClient, ApiError } from '../lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaregiverPerspective = 'patient' | 'caregiver';
export type RelationshipStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type CaregiverRole = 'primary' | 'observer';
export type DoseEventType =
  | 'scheduled'
  | 'taken'
  | 'missed'
  | 'skipped'
  | 'late'
  | 'caregiver_confirmed';

export interface Relationship {
  id: string;
  perspective: CaregiverPerspective;
  otherUserId: string | null;
  otherUserName: string | null;
  role: CaregiverRole;
  status: RelationshipStatus;
  permissions: Record<string, boolean>;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface DoseFeedEvent {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  eventType: DoseEventType;
  scheduledAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface InviteResult {
  id: string;
  inviteToken: string;
  inviteLink: string;
  role: CaregiverRole;
  status: RelationshipStatus;
  invitedAt: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

interface RelationshipsResponse {
  success: boolean;
  relationships: Relationship[];
}

interface InviteResponse {
  success: boolean;
  id: string;
  inviteToken: string;
  inviteLink: string;
  role: CaregiverRole;
  status: RelationshipStatus;
  invitedAt: string;
}

interface AcceptResponse {
  success: boolean;
  id: string;
  patientId: string;
  caregiverId: string;
  role: CaregiverRole;
  status: RelationshipStatus;
  acceptedAt: string | null;
}

interface FeedResponse {
  success: boolean;
  events: DoseFeedEvent[];
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface CaregivingState {
  relationships: Relationship[];
  feed: DoseFeedEvent[];
  isLoading: boolean;
  error: string | null;

  /** Fetch all relationships (as patient and as caregiver). */
  loadRelationships: () => Promise<void>;

  /**
   * Patient sends an invite. Returns the invite result (with token + link)
   * so the screen can display it immediately.
   */
  sendInvite: (
    email: string | undefined,
    phone: string | undefined,
    role: 'primary' | 'observer' | 'emergency_only'
  ) => Promise<InviteResult>;

  /** Caregiver accepts an invite by token. */
  acceptInvite: (token: string) => Promise<AcceptResponse>;

  /** Revoke a relationship (either party can call this). */
  revokeRelationship: (id: string) => Promise<void>;

  /**
   * Update permissions for a specific relationship. Saves immediately via API
   * and refreshes the relationship in local state on success.
   */
  updatePermissions: (
    relationshipId: string,
    permissions: Record<string, boolean>
  ) => Promise<void>;

  /** Fetch the dose event feed (caregiver view). */
  loadFeed: () => Promise<void>;

  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCaregivingStore = create<CaregivingState>((set) => ({
  relationships: [],
  feed: [],
  isLoading: false,
  error: null,

  loadRelationships: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient<RelationshipsResponse>('/caregiving/relationships');
      set({ relationships: data.relationships, isLoading: false });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load relationships';
      set({ isLoading: false, error: message });
    }
  },

  sendInvite: async (email, phone, role) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient<InviteResponse>('/caregiving/invite', {
        method: 'POST',
        body: { email, phone, role },
      });
      set({ isLoading: false });
      return {
        id: data.id,
        inviteToken: data.inviteToken,
        inviteLink: data.inviteLink,
        role: data.role,
        status: data.status,
        invitedAt: data.invitedAt,
      };
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to send invite';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  acceptInvite: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient<AcceptResponse>('/caregiving/accept', {
        method: 'POST',
        body: { inviteToken: token },
      });
      set({ isLoading: false });
      return data;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to accept invite';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  revokeRelationship: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient<{ success: boolean }>(`/caregiving/relationships/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      // Optimistic removal from store
      set((state) => ({
        relationships: state.relationships.filter((r) => r.id !== id),
        isLoading: false,
      }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to revoke relationship';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  updatePermissions: async (relationshipId, permissions) => {
    try {
      await apiClient<{ success: boolean }>(
        `/caregiving/relationships/${encodeURIComponent(relationshipId)}`,
        {
          method: 'PUT',
          body: { permissions },
        }
      );
      // Refresh the relationship in local state with the new permissions
      set((state) => ({
        relationships: state.relationships.map((r) =>
          r.id === relationshipId ? { ...r, permissions } : r
        ),
      }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to update permissions';
      set({ error: message });
      throw err;
    }
  },

  loadFeed: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient<FeedResponse>('/caregiving/feed');
      set({ feed: data.events, isLoading: false });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load feed';
      set({ isLoading: false, error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
