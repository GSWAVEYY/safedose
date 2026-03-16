# SafeDose — Launch Checklist

**A VRAXON Digital Product**
**Last updated:** March 2026

---

## Pre-Launch (Before App Store Submission)

### Code & Quality
- [ ] All Sprint 0-4 features working and tested
- [ ] Shield quality gate PASSED
- [ ] Sentinel security review on encryption, caregiver linking, emergency card
- [ ] Specter red team audit on medication data handling + auth flows
- [ ] Zero TypeScript errors across monorepo (`tsc --noEmit` clean)
- [ ] Drug interaction database validated against known interaction pairs
- [ ] OCR scanning tested on 20+ real pill bottles (various brands, conditions)
- [ ] Offline mode tested — interaction checking works with zero connectivity
- [ ] Caregiver invite flow tested end-to-end (invite → accept → monitor)
- [ ] Emergency card QR code tested with multiple QR readers
- [ ] Performance profiled on mid-range Android + iPhone

### Security (Non-Negotiable for Health Data)
- [ ] AES-256-GCM encryption verified on all medication data
- [ ] Zero-knowledge sync confirmed — server receives only ciphertext
- [ ] JWT + refresh token rotation working correctly
- [ ] Invite token expiry (48h TTL) implemented
- [ ] Sync queue payload encryption (encrypt before SQLite write)
- [ ] Emergency QR token authority resolved (client vs server)
- [ ] PHI-safe push notifications confirmed (no drug names in visible content)
- [ ] Biometric auth tested on devices with/without biometric hardware

### Privacy & Legal
- [ ] Privacy Policy written and hosted at public URL
- [ ] Terms of Service written and hosted at public URL
- [ ] HIPAA assessment documented (currently not required — consumer app, no provider integration)
- [ ] CCPA data rights flow working (view, delete, export)
- [ ] No analytics SDK sending medication data or PII
- [ ] App Store privacy nutrition label filled out accurately
- [ ] FDA disclaimer present: "SafeDose is not a substitute for professional medical advice"
- [ ] Drug interaction data sourced from public FDA databases (RxNorm, NDF-RT) — no licensing issues

### App Store Assets (iOS)
- [ ] App icon (1024x1024 + all required sizes)
- [ ] App Store screenshots (6.7", 6.5", 5.5" — minimum 3 per size)
- [ ] App Store title: "SafeDose" (+ subtitle optimized for ASO)
- [ ] Promotional text (max 170 chars)
- [ ] Full description (max 4000 chars)
- [ ] Keywords field populated
- [ ] Category: Health & Fitness (primary), Medical (secondary)
- [ ] Age rating: 4+ (medication management is not age-restricted)
- [ ] "What's New" text for v1.0

### Brand & Web
- [ ] Landing page live (safedose.app or similar)
- [ ] Landing page includes: what it does, privacy promise, download link, caregiver story
- [ ] Support email configured
- [ ] Social media presence (at minimum: Twitter/X, Facebook for caregiver communities)

### Testing
- [ ] TestFlight beta with 10+ real users (mix of patients and caregivers)
- [ ] Beta feedback incorporated
- [ ] Accessibility tested (VoiceOver, Dynamic Type, contrast — elderly users need this)
- [ ] Tested on oldest supported iOS version
- [ ] Large text / zoom tested (elderly users increase text size)
- [ ] Tested with 15+ medications (stress test for interaction checking performance)

---

## Launch Day

### Submission
- [ ] Archive build in Xcode (or EAS Build for Expo)
- [ ] Upload to App Store Connect
- [ ] Submit for review (allow 24-72 hours, health apps may take longer)
- [ ] Prepare for potential reviewer questions about health claims

### Announce
- [ ] Reddit posts in caregiver communities
- [ ] Facebook caregiver group posts
- [ ] Product Hunt listing
- [ ] VRAXON Digital social media announcement
- [ ] Direct outreach to caregiver influencers/bloggers
- [ ] Personal network outreach

### Monitor
- [ ] Crash reporting active (Sentry)
- [ ] Support email monitored — health app users expect fast responses
- [ ] Drug interaction false positive/negative reports tracked
- [ ] App Store Connect analytics dashboard bookmarked

---

## Post-Launch (First 30 Days)

### Week 1
- [ ] Monitor crash reports daily
- [ ] Respond to all App Store reviews within 24 hours
- [ ] Track: downloads, retention, interaction checks performed, caregiver links created
- [ ] Hot-fix any drug interaction database issues immediately (safety-critical)
- [ ] Monitor for any medication data handling bugs

### Week 2-4
- [ ] Collect user feedback themes (what's missing, what's confusing)
- [ ] Prioritize: safety bugs > usability > features
- [ ] Reach out to active caregivers for testimonials
- [ ] Submit App Store feature request to Apple editorial team
- [ ] Write case study for VRAXON Digital portfolio
- [ ] Plan Sprint 5 based on real user feedback

### Ongoing
- [ ] Drug interaction database updates (FDA publishes new data quarterly)
- [ ] Monthly app updates (bug fixes + small improvements)
- [ ] Quarterly security review (health data = high-value target)
- [ ] Monitor competitor launches and feature changes

---

## App Store Rejection Prevention

| Risk | Prevention |
|------|-----------|
| **Medical device claims** | Never claim SafeDose is a "medical device." It's a "medication management tool." FDA 21 CFR Part 820 applies to devices, not management apps. |
| **Health claims** | "Helps you track medications" = OK. "Prevents drug interactions" = risky. "Checks for known interactions" = OK. |
| **Privacy accuracy** | Nutrition label must exactly match reality. Health apps get extra scrutiny. |
| **Camera permission** | NSCameraUsageDescription must explain: "to scan pill bottle labels for medication identification" |
| **Notification permission** | Must explain: "to remind you when it's time to take your medications" |
| **Background refresh** | If used for reminders: explain clearly in review notes |

## Key Takeaway

SafeDose is a health app — App Store review will be stricter than average, and users will be more sensitive to bugs. The drug interaction database is the most safety-critical component: a false negative (missing a real interaction) is worse than a false positive (flagging a safe combination). Test the database thoroughly, and err on the side of caution.
