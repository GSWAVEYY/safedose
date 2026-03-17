/**
 * SafeDose feature gate definitions.
 *
 * Maps each product feature to the subscription tiers that unlock it.
 * Free tier gets no entry — absence from a tier list means the feature
 * is locked for that tier.
 *
 * Usage:
 *   isFeatureAvailable('cloudSync', 'premium') // true
 *   isFeatureAvailable('pdfExport', 'premium') // false
 *   isFeatureAvailable('pdfExport', 'family')  // true
 */

export type SubscriptionTier = 'free' | 'premium' | 'family';

export type FeatureKey =
  | 'unlimitedMedications'
  | 'unlimitedCaregivers'
  | 'fullDoseHistory'
  | 'allLanguages'
  | 'symptomTracking'
  | 'cloudSync'
  | 'multipleCareRecipients'
  | 'doctorManagement'
  | 'pdfExport';

// Tiers that unlock each feature.
// Free tier is omitted from all lists — it has no gated features unlocked.
const FEATURE_GATES: Record<FeatureKey, ('premium' | 'family')[]> = {
  unlimitedMedications:    ['premium', 'family'],
  unlimitedCaregivers:     ['premium', 'family'],
  fullDoseHistory:         ['premium', 'family'],
  allLanguages:            ['premium', 'family'],
  symptomTracking:         ['premium', 'family'],
  cloudSync:               ['premium', 'family'],
  multipleCareRecipients:  ['family'],
  doctorManagement:        ['family'],
  pdfExport:               ['family'],
};

/**
 * Returns true if the given subscription tier grants access to the feature.
 *
 * @param feature - The feature key to check
 * @param tier    - The user's current subscription tier
 */
export function isFeatureAvailable(feature: FeatureKey, tier: SubscriptionTier): boolean {
  const allowedTiers = FEATURE_GATES[feature];
  // Cast is safe — SubscriptionTier includes all allowedTiers values
  return (allowedTiers as SubscriptionTier[]).includes(tier);
}

/**
 * Returns all features available for a given tier.
 * Useful for rendering paywall comparison screens.
 */
export function getFeaturesForTier(tier: SubscriptionTier): FeatureKey[] {
  return (Object.entries(FEATURE_GATES) as [FeatureKey, SubscriptionTier[]][])
    .filter(([, tiers]) => tiers.includes(tier))
    .map(([key]) => key);
}
