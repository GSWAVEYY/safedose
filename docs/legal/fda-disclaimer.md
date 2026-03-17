# SafeDose — FDA Disclaimer Text

**A VRAXON Digital Product**
**Last updated:** March 2026

These are the approved disclaimer strings for use throughout the app and legal documents. Copy from this file directly into the codebase. Do not paraphrase these — exact wording has been reviewed for FDA positioning compliance.

---

## Usage Guide

| Version | Where to Use |
|---|---|
| Short | Interaction alert screens, medication detail screens, onboarding tooltips, Settings footer |
| Medium | Onboarding flow (dedicated disclaimer step), drug database info screen |
| Long | Privacy Policy, Terms of Service, App Store description footer |

---

## Short Version
*(For in-app screens — under interaction alerts, in Settings footer, onboarding tooltip)*

```
SafeDose is not a substitute for medical advice. Always consult your doctor or pharmacist before making any medication changes.
```

Character count: 124

**Where this string appears:**
- Below every drug interaction alert card
- Settings screen footer
- Onboarding step 3 (after explaining interaction checking)
- Medication detail screen (info icon tapped)

---

## Medium Version
*(For onboarding flow, drug database info screen, first interaction alert)*

```
SafeDose provides drug interaction information from public NIH databases (RxNorm, NDF-RT) for reference only. This information may not include every known interaction and does not account for your individual health history.

SafeDose is not a medical device and does not diagnose or treat any condition. Always consult your pharmacist or doctor before making any changes to your medications.
```

Character count: 337

**Where this string appears:**
- Dedicated disclaimer screen during onboarding (shown once, user must tap "I understand" to proceed)
- Drug database info screen (accessible from Settings > About SafeDose's Drug Data)
- First time a drug interaction alert is shown to a new user (shown above the alert, collapsed after first view)

---

## Long Version
*(For legal pages — Privacy Policy, Terms of Service, App Store description footer)*

```
SafeDose is a personal health information tool, not a medical device. It does not diagnose medical conditions, recommend treatment, or replace the judgment of your doctor or pharmacist.

Drug interaction information in SafeDose is sourced from public databases maintained by the National Institutes of Health (RxNorm) and the U.S. Department of Veterans Affairs (NDF-RT). This information is provided for informational and organizational purposes only. SafeDose's database may not include every known drug interaction, may not reflect the most recently discovered interactions, and does not account for your individual health conditions, kidney or liver function, allergies, or other factors that affect how medications interact in your body.

Always consult your doctor or pharmacist before adding a new medication, stopping a medication, or making any changes to your medication regimen. If SafeDose flags a potential interaction, bring it to your pharmacist — they have access to more complete interaction databases and your full medical history.

In a medical emergency, call 911 or your local emergency number immediately. SafeDose is not an emergency notification system.

SafeDose is not affiliated with the NIH, the FDA, or any government health authority.
```

Character count: 992

**Where this string appears:**
- Privacy Policy (Section 14)
- Terms of Service (Section 3)
- App Store description (truncated version in full description footer)

---

## Interaction Alert Disclaimer
*(Specific to drug interaction alert screens — replaces short version in that context)*

```
This interaction information is for reference only. Consult your pharmacist or doctor to understand whether this interaction is clinically significant for you.
```

Character count: 161

**Design note:** This text appears below every drug interaction alert card, in a muted text color (not red — red is reserved for the severity indicator). The goal is for this to feel like helpful guidance, not a legal cover-your-ass disclaimer. Write it to be read, not ignored.

---

## Emergency Card Disclaimer
*(Shown on the Emergency Info Card setup screen and on the card itself)*

```
This card is for informational purposes. In an emergency, call 911. This card does not replace emergency medical services.
```

Character count: 121

---

## Reminder Disclaimer
*(Shown once during reminder setup, in a tooltip — not on every reminder)*

```
SafeDose reminders are organizational tools. Do not rely solely on app reminders for time-critical medications.
```

Character count: 109

---

## Implementation Notes for Pixel/Prism

1. **Short version** is a reusable component — `<MedicalDisclaimer variant="short" />` — used in multiple places. Do not hardcode the string in multiple places.

2. **Interaction alert disclaimer** should be visually distinct from the interaction severity label. Use `text-muted` styling, not `text-destructive`. The disclaimer should not compete with the interaction information itself.

3. **Onboarding disclaimer** requires a confirmed tap ("I understand, continue") before the user can proceed. This is intentional and required for Apple review. It is not a speed bump — design it as a trustworthy information moment, not a modal that users click through.

4. **Do not add these disclaimers to every screen.** Only the screens listed above. Over-warning is as bad as under-warning — it trains users to ignore them.

5. **Localization:** These strings will need translation for future international releases. Mark them with i18n keys from day one: `t('disclaimer.short')`, `t('disclaimer.interactionAlert')`, etc.

---

## Apple Review Compliance Notes

Apple App Store Health App Guidelines (§5.1.3) require:
- Apps that provide health information must include appropriate disclaimers
- Claims must not imply diagnosis, treatment, or prevention of medical conditions
- "Information only" positioning must be clear

The disclaimers in this document satisfy these requirements. The interaction alert disclaimer specifically addresses the scenario where a user might interpret an alert as medical guidance.

**Reviewed language:**
- "provides drug interaction information" — OK (information tool positioning)
- "check for known interactions" — OK (factual, sourced from database)
- "reference only" — OK (standard informational disclaimer)
- "prevents dangerous drug interactions" — NOT OK — do not use this phrase
- "SafeDose caught a dangerous interaction" — NOT OK — do not use this phrase
- "clinically significant" — OK in context of directing user to pharmacist
