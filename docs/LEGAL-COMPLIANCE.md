# SafeDose — Legal & Compliance

**A VRAXON Digital Product**
**Last updated:** March 2026

---

## Why This Matters

SafeDose handles medication data — one of the most sensitive categories of personal health information. A data breach exposes what someone takes, when, and why. Legal compliance here isn't about checking boxes — it's about protecting vulnerable people.

## Data Architecture: Zero-Knowledge Sync

### What stays on the user's device (always)
- Medication names, dosages, schedules
- Drug interaction check results
- Medication adherence history
- Local drug database (RxNorm + NDF-RT bundled SQLite)
- Personal notes on medications

### What syncs to server (Premium/Family tiers only)
- **Encrypted medication data** — AES-256-GCM, encrypted on-device before sync
- Server stores ciphertext only — zero-knowledge architecture
- Decryption keys never leave the user's device
- Caregiver access: encrypted data re-encrypted with caregiver's key

### What the server can see
- User account (email, hashed password)
- Caregiver relationship metadata (who is linked to whom — not what medications)
- Subscription status
- Anonymous usage analytics (no medication data)

### What we never collect
- Plaintext medication data on the server
- Location data
- Contact lists
- Health insurance information
- Diagnosis or condition information
- Data for advertising or sale to third parties

## Regulatory Landscape

### HIPAA (Health Insurance Portability and Accountability Act)

**Is SafeDose a "covered entity"?** No — currently.

HIPAA applies to: healthcare providers, health plans, healthcare clearinghouses, and their "business associates." SafeDose is a consumer app. Users manage their own medications. No healthcare provider is involved in the data flow.

**When this changes:**
- If SafeDose integrates with telehealth providers → business associate agreement (BAA) required
- If SafeDose receives data from a pharmacy or hospital → HIPAA applies
- If SafeDose is sold to healthcare facilities → HIPAA compliance mandatory

**Current position:** Build as if HIPAA applies. Zero-knowledge architecture already exceeds HIPAA encryption requirements. This is future-proofing, not over-engineering.

### FDA Regulation

**Is SafeDose a "medical device"?**

The FDA regulates Software as a Medical Device (SaMD) under 21 CFR Part 820. SafeDose is NOT a medical device because it:
- Does not diagnose, treat, or prevent disease
- Does not recommend dosage changes
- Does not replace pharmacist judgment
- Provides information only — user makes all decisions

**Safe language:**
- "Checks for known drug interactions" — OK
- "Alerts you to potential interactions" — OK
- "Prevents dangerous drug interactions" — NOT OK (implies medical device)
- "Medication management tool" — OK
- "Drug safety system" — risky

**FDA Digital Health Policy (2023):** The FDA explicitly does not regulate "wellness" apps or medication reminder apps. SafeDose falls into this category as long as it doesn't make clinical recommendations.

### CCPA/CPRA (California)
- Medication data is "sensitive personal information" under CPRA
- Even below revenue/user thresholds, SafeDose should:
  - Allow users to view all stored data
  - Allow users to delete all data
  - Allow users to export their data
  - Never sell or share medication data
- **Current decision:** Implement full CCPA rights from day one. It's the right thing to do, and it's easier than retrofitting.

### COPPA (Children's Privacy)
- SafeDose is not targeted at children under 13
- However, caregivers may manage medications for children
- **Current position:** Caregiver manages the child's profile — the child does not have their own account
- No COPPA compliance needed if children don't directly interact with the app

### International (Future)
- **GDPR (EU):** If expanding to Europe — explicit consent, data portability, right to erasure, DPO appointment. Zero-knowledge architecture simplifies compliance significantly.
- **UK Data Protection Act:** Similar to GDPR post-Brexit
- **PIPEDA (Canada):** Similar privacy requirements for health data

## Drug Interaction Database Legal

### Data Sources
- **RxNorm** — Public domain (NIH/NLM). Free to use. No licensing required.
- **NDF-RT** — Public domain (VA/NLM). Free to use. Being replaced by MED-RT.
- **Future: DrugBank** — Requires commercial license ($). Switch post-revenue.

### Liability
- SafeDose provides information from public FDA databases
- **Disclaimer required:** "Drug interaction information is provided for reference only. Always consult your pharmacist or doctor before making medication changes."
- The interaction database will have gaps — no database is complete
- False negatives (missing a real interaction) are the highest-risk failure mode
- **Mitigation:** Clear disclaimers + encourage pharmacist verification + regular database updates

## App Store Compliance

### Apple Health App Guidelines (§5.1.3)
- Must not make medical claims
- Must include appropriate disclaimers
- Crisis/emergency features must work reliably
- Privacy nutrition label must be 100% accurate
- Health data must be handled with appropriate security

### Google Play Health App Policy
- Similar requirements to Apple
- Data Safety section must accurately reflect data handling
- Health apps subject to additional review

## Entity & Insurance

SafeDose is a VRAXON Digital product:

- **Entity:** Delaware LLC (planned)
- **Insurance needed:**
  - Tech E&O (errors and omissions) — covers software defects
  - Cyber Liability — covers data breaches
  - **Product Liability** — covers harm from incorrect interaction data
  - Professional Liability — may be needed if SafeDose is ever used in clinical settings

**Insurance note:** A medication management app carries more liability risk than a typical SaaS product. The drug interaction feature means incorrect information could lead to physical harm. Discuss with insurance broker specifically about health app coverage before launch.

## Data Handling Practices

### Encryption Standards
| Layer | Method | Notes |
|-------|--------|-------|
| Data at rest (device) | expo-sqlite + AES-256-GCM | All medication data encrypted before local storage |
| Data in transit | TLS 1.3 | All API communication |
| Data at rest (server) | AES-256-GCM ciphertext | Server stores only encrypted blobs |
| Passwords | bcrypt (migrating to argon2id) | Server-side hashing |
| JWT tokens | RS256 + refresh rotation | Short-lived access tokens |

### Data Retention
- Free tier: data lives only on device. User deletes app = data gone.
- Premium/Family: encrypted data on server retained until user deletes account
- Server logs: 30-day retention, no medication data in logs
- Crash reports: anonymized, 90-day retention

### Breach Response Plan
1. Identify scope of breach
2. Notify affected users within 72 hours (GDPR standard, even if not legally required)
3. Notify relevant authorities if required
4. Publish transparency report
5. Remediate vulnerability
6. Post-incident review

**Key advantage:** Zero-knowledge architecture means even a full server breach exposes only ciphertext. Attackers cannot read medication data without individual device keys.

## Key Takeaway

SafeDose's zero-knowledge architecture is both a privacy feature and a legal shield. By ensuring the server never sees plaintext medication data, most regulatory risks are dramatically reduced. The main legal risks are: (1) making medical claims (don't), (2) drug interaction database accuracy (disclaim and update regularly), and (3) product liability if incorrect information causes harm (insurance + disclaimers). Build conservatively, disclaim clearly, and update the database regularly.
