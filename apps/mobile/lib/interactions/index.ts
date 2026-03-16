/**
 * lib/interactions/index.ts
 *
 * Public API for the on-device drug interaction engine.
 *
 * Usage:
 *   import { checkInteractions, useInteractionCheck } from '@/lib/interactions';
 */

// Types
export type {
  InteractionSeverity,
  DrugInteraction,
  InteractionCheckResult,
  DrugSearchResult,
  DrugDatabaseVersion,
} from './types';

// Database access
export {
  openDrugDatabase,
  searchDrugByName,
  getDrugByRxcui,
  getDrugsByRxcuis,
  getDatabaseVersion,
} from './drug-db';

// Interaction engine
export {
  checkInteractions,
  checkNewMedInteractions,
  getInteractionsBetween,
  getAllInteractionsForDrug,
} from './engine';

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { checkInteractions as _checkInteractions } from './engine';
import { checkNewMedInteractions as _checkNewMed } from './engine';
import type { InteractionCheckResult } from './types';

export interface UseInteractionCheckReturn {
  /** Check all pairwise interactions for a full medication list. */
  checkInteractions: (rxcuis: string[]) => Promise<InteractionCheckResult>;
  /** Check a new medication against the existing list. */
  checkNewMed: (
    newRxcui: string,
    existingRxcuis: string[],
  ) => Promise<InteractionCheckResult>;
  /** True while an async check is in flight. */
  isChecking: boolean;
  /** Result of the most recent check, or null before the first check. */
  lastResult: InteractionCheckResult | null;
}

/**
 * React hook wrapping the interaction engine with loading and result state.
 *
 * Example:
 *   const { checkNewMed, isChecking, lastResult } = useInteractionCheck();
 *
 *   const handleAddMed = async (newRxcui: string) => {
 *     const result = await checkNewMed(newRxcui, existingRxcuis);
 *     if (result.hasInteractions) showAlert(result);
 *   };
 */
export function useInteractionCheck(): UseInteractionCheckReturn {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<InteractionCheckResult | null>(null);

  const checkInteractions = useCallback(
    async (rxcuis: string[]): Promise<InteractionCheckResult> => {
      setIsChecking(true);
      try {
        const result = await _checkInteractions(rxcuis);
        setLastResult(result);
        return result;
      } finally {
        setIsChecking(false);
      }
    },
    [],
  );

  const checkNewMed = useCallback(
    async (
      newRxcui: string,
      existingRxcuis: string[],
    ): Promise<InteractionCheckResult> => {
      setIsChecking(true);
      try {
        const result = await _checkNewMed(newRxcui, existingRxcuis);
        setLastResult(result);
        return result;
      } finally {
        setIsChecking(false);
      }
    },
    [],
  );

  return { checkInteractions, checkNewMed, isChecking, lastResult };
}
