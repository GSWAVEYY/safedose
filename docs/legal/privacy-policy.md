# SafeDose Privacy Policy

**Effective Date:** March 2026
**Last Updated:** March 2026

**SafeDose is a product of VRAXON Digital.**
Contact: privacy@safedoseapp.com

---

## The Short Version

Your medication data is yours. SafeDose is built so we cannot read your medications even if we wanted to. Here is what that means in plain language:

- Your medications, dosages, and schedules stay on your phone unless you choose to sync
- When you sync (Premium/Family), your data is encrypted on your device before it ever reaches our server — we store scrambled data we cannot read
- We never sell your data. We never share it with advertisers. We never use it to build profiles about you.
- You can delete everything at any time

The rest of this policy explains the details. We have tried to write it in plain English.

---

## 1. Who We Are

SafeDose is operated by VRAXON Digital, a software company based in the United States.

- **App:** SafeDose (iOS)
- **Website:** [safedoseapp.com]
- **Contact:** privacy@safedoseapp.com
- **Mailing address:** [VRAXON Digital address to be added at launch]

---

## 2. What Kind of App SafeDose Is

SafeDose is a personal health information tool. It helps you organize your medications, check for known drug interactions using public database information, set reminders, and share your adherence with a caregiver you choose.

SafeDose is not a medical device. It does not diagnose any condition, recommend treatment, or replace advice from your doctor or pharmacist. See Section 14 for the full medical disclaimer.

---

## 3. Data We Collect

### 3a. Data That Stays on Your Device (Free Tier — All Users)

The following information is created and stored exclusively on your phone. It is never transmitted to our servers unless you choose to enable sync (Premium or Family tier):

- Medication names, dosages, and schedules you enter
- Drug interaction check results (processed entirely on-device)
- Medication confirmation history (whether you marked a dose as taken)
- Personal notes you attach to medications
- Emergency info card contents (medications, allergies, emergency contacts)
- Photos of pill bottle labels captured for OCR scanning (processed on-device; not stored after scan completes)

**This data never leaves your device unless you explicitly enable sync.**

### 3b. Account Data (Required to Create an Account)

When you create a SafeDose account, we collect:

- Your email address
- A password (stored as a one-way hash — we cannot recover your original password)

We use your email address to:
- Send you account-related notifications (password reset, caregiver invitations)
- Communicate important updates about the service

We do not use your email for advertising or share it with third parties for their marketing.

### 3c. Encrypted Sync Data (Premium and Family Tiers Only)

When you enable sync, your medication data is encrypted on your device using AES-256-GCM encryption before transmission. Our server receives and stores ciphertext only.

**Zero-knowledge architecture:** This means our server stores encrypted data that we cannot read. The decryption keys exist only on your devices. A SafeDose employee cannot look up your medication list. A court order served on SafeDose cannot compel us to produce readable medication data, because we do not have it.

What our server stores:
- Your encrypted medication data (ciphertext only)
- Your account email and hashed password
- Caregiver relationship metadata: who is linked to whom, not what medications
- Subscription status

What our server never stores:
- Plaintext medication names, dosages, or schedules
- Drug interaction check results
- Personal notes
- Location data
- Contact lists
- Health insurance information
- Diagnosis or condition information

### 3d. Caregiver Linking Data (Premium and Family Tiers)

If you invite a caregiver, they can see:
- Whether you confirmed each dose (taken / missed / snoozed)
- Your overall adherence percentage
- The time you confirmed or missed a dose

Caregivers cannot see:
- Your medication names or dosages
- Your personal notes
- Your drug interaction alerts
- Your emergency card contents

Adherence data shared with caregivers is encrypted in transit using TLS 1.3.

### 3e. Usage Analytics (All Users)

We collect anonymized usage data to understand how the app is being used and improve it. This data does not include any medication information. Examples: "the add medication screen was opened 500 times today," "3 users encountered an error on the sync screen."

We use Plausible Analytics, which is a privacy-first analytics tool that does not use cookies, does not build user profiles, and does not share data with advertising networks.

### 3f. Crash Reports (All Users)

If SafeDose crashes, we collect an anonymized crash report that tells us what happened technically (which code failed, what the app state was). Crash reports do not contain medication data. We use Sentry for crash monitoring.

### 3g. Payment Information

Subscription payments are processed by Apple (via in-app purchase). SafeDose does not collect, store, or have access to your payment card information. Apple's privacy policy governs payment processing.

---

## 4. Data We Do Not Collect

We want to be explicit:

- We do not collect your location at any time
- We do not access your contacts
- We do not read your camera roll (OCR scanning processes one photo at a time, on-device, and does not store images)
- We do not access your health app (Apple Health integration is not available in v1.0)
- We do not collect data about other apps on your device
- We do not collect your browsing history
- We do not build advertising profiles
- We do not sell data to pharmaceutical companies, insurers, data brokers, or anyone else

---

## 5. Push Notifications

SafeDose uses Expo Push Notifications to send medication reminders to your device. These are not push-based marketing messages — they are reminders you set yourself.

What our notification system knows: your device push token (a technical identifier for your device, not linked to your identity beyond your account) and the scheduled time for each reminder.

**What push notifications do not contain:** Medication names are intentionally excluded from push notification content. Your notification shows "Time to take your medications" — not "Time to take Lisinopril 10mg." This is a deliberate privacy protection. Someone who glances at your lock screen cannot read your medication names.

You can disable notifications entirely in iOS Settings at any time. SafeDose will continue working; you simply will not receive reminders.

---

## 6. On-Device Processing

SafeDose uses on-device processing for the features most sensitive to privacy:

**Drug interaction checking:** The drug database (NIH RxNorm and NDF-RT data) is bundled with the app. Interaction checks happen entirely on your device. No query about your medications is sent to any server. This works without an internet connection.

**Pill bottle OCR scanning:** When you photograph a pill bottle to add a medication, image processing happens on your device. The image is analyzed and discarded after the medication name is extracted. We do not store photos of your pill bottles.

---

## 7. Third-Party Services

SafeDose uses a small number of third-party services. We have selected these specifically because they align with our privacy standards.

| Service | Purpose | Data Shared |
|---|---|---|
| Apple In-App Purchase | Subscription billing | Apple processes payment; we receive confirmation only |
| Expo Push Notifications | Medication reminders | Device push token, scheduled reminder times |
| Neon (PostgreSQL) | Encrypted data storage (Premium/Family) | Encrypted ciphertext only — no readable medication data |
| Plausible Analytics | Anonymous usage analytics | Anonymized usage events — no medication data |
| Sentry | Crash monitoring | Anonymized crash reports — no medication data |

We do not use Google Analytics, Meta Pixel, or any advertising SDK.

---

## 8. Data Retention

**Free tier:** Your data lives on your device. If you delete the app, your data is gone. We have no copy of it.

**Premium/Family tier:**
- Encrypted sync data is retained on our servers until you delete your account
- After account deletion, we permanently delete your encrypted data within 30 days
- Server logs are retained for 30 days and contain no medication data
- Crash reports are retained for 90 days and are anonymized

**After account deletion:** We may retain your email address for up to 90 days to process any final subscription-related communications (such as refund requests), then we delete it permanently.

---

## 9. Your Rights and Controls

Regardless of where you live, you have these rights with SafeDose:

**Right to access:** Email privacy@safedoseapp.com to request a summary of what data we hold about you.

**Right to deletion:** You can delete your account from within the app (Settings > Account > Delete Account). This permanently deletes your encrypted data from our servers within 30 days. Free-tier users can delete all data by deleting the app.

**Right to export:** You can export your medication data from within the app at any time (Settings > Export Data). Export is available in PDF and CSV formats.

**Right to correct:** You can edit any of your information directly within the app at any time.

**Right to opt out of analytics:** Contact privacy@safedoseapp.com to request exclusion from anonymized analytics.

**California residents (CCPA/CPRA):** Your medication data qualifies as "sensitive personal information" under CPRA. SafeDose does not sell this data. You have the right to know, delete, correct, and limit the use of your sensitive personal information. Exercise these rights by contacting privacy@safedoseapp.com.

**European residents (GDPR):** If you are located in the European Economic Area or United Kingdom, you have rights under GDPR including access, erasure, portability, and objection. Our lawful basis for processing your account data is contract performance. Contact privacy@safedoseapp.com to exercise GDPR rights or to file a complaint.

---

## 10. Security

We take security seriously because the data involved — medications, schedules, health patterns — is deeply personal.

**Encryption standards:**

| Layer | Method |
|---|---|
| Data at rest on device | AES-256-GCM |
| Data in transit | TLS 1.3 |
| Data at rest on server (Premium sync) | AES-256-GCM ciphertext (zero-knowledge) |
| Passwords | bcrypt / argon2id — one-way hash, not recoverable |
| API authentication | RS256 JWT with short expiry + refresh token rotation |

**What this means in practice:** Even if our server were breached, attackers would obtain only encrypted data they cannot read without your device's decryption key.

**Reporting a security issue:** If you discover a security vulnerability, please report it responsibly to security@safedoseapp.com before public disclosure. We will respond within 72 hours.

---

## 11. Children's Privacy

SafeDose is not intended for use by children under 13. We do not knowingly collect personal information from children under 13.

Caregivers may manage medication profiles for children within a parent's or guardian's account. The child does not directly create an account or interact with data collection.

If you believe a child under 13 has created a SafeDose account, please contact us at privacy@safedoseapp.com and we will promptly delete the account.

---

## 12. HIPAA Positioning

SafeDose is a consumer personal health information tool. As a consumer app where users manage their own medications, SafeDose is not currently a "covered entity" under HIPAA (Health Insurance Portability and Accountability Act), nor a "business associate" of any covered entity.

However, SafeDose's security architecture — zero-knowledge encryption, TLS 1.3 transit encryption, no plaintext health data on servers — meets or exceeds HIPAA technical safeguard requirements. We built this way because your medications are sensitive, not because the law currently requires it.

This may change: if SafeDose integrates with healthcare providers or receives data from covered entities in the future, we will enter the required Business Associate Agreements and update this policy.

---

## 13. Changes to This Policy

We will notify you of material changes to this privacy policy by:
- In-app notification when you open SafeDose after a policy update
- Email to the address on your account
- Updated "Last Updated" date at the top of this document

Continued use of SafeDose after a policy change constitutes acceptance of the updated policy. If you disagree with a change, you may delete your account at any time.

---

## 14. Medical Disclaimer

SafeDose is a personal health information tool, not a medical device.

SafeDose does not diagnose medical conditions, recommend treatment, or replace professional medical advice. Drug interaction information is sourced from public NIH databases (RxNorm, NDF-RT) and is provided for informational and organizational purposes only. This database may not include every known drug interaction.

Always consult your doctor or pharmacist before making any changes to your medications, adding a new medication, or acting on any interaction information provided by SafeDose.

In a medical emergency, call 911 (US) or your local emergency number immediately.

---

## 15. Contact Us

Questions about this privacy policy or your data:

**Email:** privacy@safedoseapp.com
**Response time:** Within 5 business days

**Mailing address:**
VRAXON Digital
[Address to be added at launch]
United States

---

*SafeDose Privacy Policy v1.0 — Effective March 2026*
*Built by VRAXON Digital. Privacy-first. No compromise.*
