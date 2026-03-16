# SafeDose — Business Plan

**A VRAXON Digital Product**
**Last updated:** March 2026

---

## Business Model

Freemium — generous free tier for individual medication management, paid tiers for families and advanced features. The free tier must be genuinely useful, not a crippled demo.

## Pricing Tiers

### Free
Core medication safety for individuals:

- Add medications manually or via camera OCR scan
- On-device drug interaction checking (FDA RxNorm + NDF-RT database)
- Medication reminders with confirmation tracking
- Basic medication history
- Emergency info card (QR code with meds, allergies, contacts)
- Single-user — no caregiver features

### Premium — $4.99/month
Everything in Free, plus:

- Caregiver linking (invite family members to monitor adherence)
- Medication adherence reports (weekly/monthly)
- Symptom tracking + medication correlation
- Pharmacy price comparison (GoodRx API — future)
- Multi-device sync (encrypted)
- Priority support

### Family — $9.99/month
Everything in Premium, plus:

- Manage medications for up to 5 family members
- Care team coordination (multiple caregivers per patient)
- Shared medication calendars
- Doctor/appointment management
- Caregiver wellness check-ins
- Export reports for doctor visits (PDF)

## Revenue Projections

**Year 1:**
- Target: 5,000 free users → 5% Premium + 2% Family
- Premium: 250 × $4.99 = $1,247/month
- Family: 100 × $9.99 = $999/month
- Total: ~$2,250/month

**Year 2:**
- Target: 25,000 free users → 7% Premium + 3% Family
- Premium: 1,750 × $4.99 = $8,732/month
- Family: 750 × $9.99 = $7,492/month
- Total: ~$16,200/month

**Year 3:**
- Enterprise/institutional licensing adds B2B revenue
- Home health agencies, assisted living facilities: $15-30/seat/month
- Target: 20 facilities × 50 seats × $20 = $20,000/month additional

## Competitive Landscape

| App | Model | Why SafeDose Wins |
|-----|-------|-------------------|
| **Medisafe** | Freemium ($4.99/mo) | Popular but cloud-dependent. Data shared with pharma partners. No privacy. |
| **MyMedSchedule** | Free | Basic reminders only. No interaction checking. No caregiver features. |
| **CareZone** | Free (acquired by Walmart) | Became Walmart health tool. Privacy concerns. |
| **Drugs.com app** | Free (ad-supported) | Interaction checker only. No management. Ads. |
| **Pill Reminder apps** | Various | Dozens exist. All reminders-only. None do interaction checking + caregiver coordination. |

**SafeDose's moat:** On-device interaction checking + caregiver coordination + zero-knowledge sync. No competitor offers privacy-first medication management with family coordination.

## Go-to-Market Strategy

### Phase 1: Caregiver Communities (Months 1-6)
- Reddit: r/CaregiverSupport, r/AgingParents, r/eldercare
- Facebook groups for caregivers (massive, active communities)
- AARP forums and publications
- Caregiver blogs and influencers
- Product Hunt launch

### Phase 2: Healthcare Adjacent (Months 6-12)
- Home health agency partnerships (they recommend apps to families)
- Pharmacist recommendations (in-store QR codes)
- Senior center presentations and demos
- Alzheimer's Association, Parkinson's Foundation outreach

### Phase 3: Institutional (Year 2+)
- Assisted living facility pilots
- Hospital discharge process integration (send patients home with SafeDose)
- Insurance company wellness program inclusion
- VA hospital caregiver support programs

## Cost Structure

| Item | Monthly Cost |
|------|-------------|
| App Store developer accounts | $8.25 (Apple $99/yr) |
| Neon PostgreSQL (free tier) | $0 |
| Backend hosting (Fly.io) | $5-15 |
| Domain + landing page | $0-10 |
| GoodRx API (future) | Usage-based |
| Total burn (pre-scale) | ~$25/month |

## Tech Stack Decisions

| Choice | Why |
|--------|-----|
| React Native + Expo | Matches VRAXON's TypeScript/React stack. Cross-platform from day one. |
| Fastify (not Express) | Faster, built-in validation, better TypeScript support |
| On-device SQLite (drug DB) | Interaction checking works offline. No server dependency. |
| sql.js (not better-sqlite3) | Avoids node-gyp/native compilation issues on Windows dev machine |
| RxNorm + NDF-RT (not DrugBank) | Free FDA sources. DrugBank requires licensing. Switch post-revenue. |
| AES-256-GCM client-side | Zero-knowledge sync — server never sees plaintext medication data |
| pnpm monorepo | Shared types between mobile and API. One repo, clean structure. |

## VRAXON Digital Value

1. **Portfolio powerhouse** — Healthcare + privacy + AI + mobile. Demonstrates serious technical capability.
2. **Case study** — "We built a medication safety app used by X families" sells enterprise clients
3. **Technical proof** — Encryption, HIPAA-adjacent architecture, FDA data integration
4. **Revenue stream** — Unlike InnerVox, SafeDose is designed to generate real revenue from month 1
5. **B2B potential** — Healthcare facility licensing is high-value, recurring revenue

## Key Takeaway

SafeDose is VRAXON's strongest revenue candidate in the app portfolio. The caregiver market (53M Americans) is large, underserved, and willing to pay for tools that reduce anxiety about their loved ones' medication safety. Free core earns trust, Premium/Family earns revenue, Enterprise earns serious money.
