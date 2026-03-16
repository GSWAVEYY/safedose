# SafeDose — User Onboarding

**A VRAXON Digital Product**
**Last updated:** March 2026

---

## Onboarding Philosophy

SafeDose has two user types with very different needs:

- **Patients** want to add their medications, check interactions, and set reminders. First-session job: add at least one medication.
- **Caregivers** want to see that their loved one is taking their meds. First-session job: link to a patient's account.

Both share one constraint: SafeDose's core users are often elderly, stressed, or both. The onboarding must be simple enough for a 75-year-old with poor eyesight AND a 45-year-old who's exhausted from caregiving. Large text, minimal choices, zero jargon.

**Design principle:** If your parent can't complete onboarding without calling you, it's too complicated.

## Patient Onboarding

### Screen 1: Welcome
**Purpose:** Establish trust and explain the core value in one breath.

```
[SafeDose logo — clean, calm, warm]

Know before you take.

SafeDose checks your medications for
interactions, reminds you when it's time,
and keeps everything private — right on
your phone.

[Get Started →]
```

**Typography:** Minimum 18pt body text. High contrast. No thin fonts. Elderly users are the primary audience — design for their eyes.

### Screen 2: Role Selection
**Purpose:** Route to the correct path.

```
I am...

[💊 Managing my own medications]

[🤝 Helping someone manage theirs]

[Both — I manage mine AND help
  someone else]
```

**Why "Both" exists:** Many caregivers are also patients. A 55-year-old managing their own blood pressure meds AND their mother's 10 medications is common. Don't force them to choose.

### Screen 3 (Patient): Add First Medication
**Purpose:** Core activation moment — get one medication in the system.

```
Let's add your first medication.

[📷 Scan a pill bottle]
Point your camera at the label — SafeDose
will read it automatically.

[✏️ Type it in]
Search by name or look it up.

You can always add more later.
```

**Why camera first:** OCR scanning is the "wow moment" — it's faster, more accurate, and makes the app feel smart. But the manual option must exist for users who are intimidated by camera features or have bottles that scan poorly.

**OCR flow:**
1. User points camera at pill bottle
2. SafeDose identifies medication name, dosage, and frequency
3. Confirmation screen: "Is this correct?" with editable fields
4. User confirms → medication added

### Screen 4 (Patient): Interaction Check
**Purpose:** Deliver immediate value — show what SafeDose does.

```
[If only 1 medication added:]

Good news — with one medication, there are
no interactions to check. Add more medications
and SafeDose will automatically check them
against each other.

[Add Another Medication]
[Continue →]

[If 2+ medications added:]

[Green checkmark or yellow warning]

SafeDose checked your medications:
✅ No known interactions found.
   OR
⚠️ 1 potential interaction found.
   [Medication A] + [Medication B]
   Tap to learn more.

[Continue →]
```

**Why show this immediately:** The interaction check is the #1 differentiator. Even if no interaction is found, showing that the check happened builds trust in the system. If an interaction IS found on the first check, that's the most powerful onboarding moment possible — "this app just caught something my doctor might have missed."

### Screen 5 (Patient): Reminders
**Purpose:** Set up medication reminders.

```
When do you take your medications?

[Morning ☀️]  Time: [8:00 AM ▼]
[Afternoon 🌤️]  Time: [12:00 PM ▼]
[Evening 🌙]  Time: [6:00 PM ▼]
[Bedtime 🌑]  Time: [10:00 PM ▼]

SafeDose will remind you at these times.
You can customize per medication later.

[Set Reminders →]
[Skip — I'll set these up later]
```

**Why time-of-day buckets:** Elderly patients think in terms of "morning pills" and "evening pills," not specific times. Start with buckets, let them customize later.

### Screen 6 (Patient): Privacy Promise
**Purpose:** Build trust with the privacy story.

```
[Shield icon]

Your medications stay on your phone.

SafeDose checks interactions using a database
stored right on your device — no internet
needed.

Your medication list is never uploaded,
never shared, and never sold.

[Got it →]
```

**Why privacy is screen 6, not screen 2:** For patients, the priority is adding medications and seeing value. Privacy is important but secondary to "does this work?" For the caregiver path, privacy comes earlier because caregivers are more privacy-conscious about their loved one's data.

### Screen 7 (Patient): Done
```
[Checkmark]

You're all set.

SafeDose will remind you when it's time
and check every new medication for interactions.

Want to invite a family member to see when
you've taken your meds?

[Invite a Caregiver]
[Not Now — Go to My Medications →]
```

**Total patient onboarding: 7 screens. Under 3 minutes even for elderly users.**

## Caregiver Onboarding

### Screen 3 (Caregiver): Link to Patient
**Purpose:** Connect to the person they're caring for.

```
Who are you helping?

If they already use SafeDose:
[🔗 Enter their invite code]

If they don't have SafeDose yet:
[📲 Send them a download link]

If you're setting up their phone for them:
[📱 Set up their medications now]
   (You can transfer to their phone later)
```

**Why "set up their phone for them":** Many caregivers set up their parent's phone. Let them add all medications on their own device first, then transfer when they see their parent. Don't require the patient to be present during setup.

### Screen 4 (Caregiver): What You'll See
**Purpose:** Set expectations about visibility.

```
Here's what you'll be able to see:

✅ Whether [Name] took their medications on time
✅ Missed doses and reminders
✅ Medication list and schedules

🔒 What you won't see:
   Personal notes they add to entries
   Interaction check details (their privacy)

Your loved one can adjust these permissions
at any time.

[Sounds Good →]
```

**Why transparency matters:** Caregivers need to understand what they can and can't see. Patients need to feel they still have privacy. This screen manages both expectations.

### Screen 5 (Caregiver): Your Dashboard
```
[Caregiver dashboard preview]

Your caregiver dashboard.

You'll get a notification when [Name]:
• Takes their medications ✅
• Misses a dose ⚠️
• Adds a new medication 💊

No news is good news — if everything's
on track, SafeDose stays quiet.

[Go to Dashboard →]
```

**Total caregiver onboarding: 5 screens. Under 2 minutes.**

## The First 7 Days

### Patient Path

| Day | Action | In-App Prompt |
|-----|--------|--------------|
| 1 | First medication added, reminders set | None — let them settle in |
| 2 | First reminder fires | Confirmation button: "Took it ✅" / "Skipped ❌" / "Snooze 🔔" |
| 3 | Prompt to add remaining medications | "You have 1 medication tracked. Most people take 3-5. Add more to check for interactions." |
| 4 | If 2+ medications: interaction check highlight | "SafeDose is checking [X] medications against each other. All clear." (or show alert) |
| 5 | Introduce emergency card | "Create your emergency info card — a QR code first responders can scan with your medications and allergies." |
| 7 | Weekly adherence summary | "This week: you took [X/Y] doses on time. [Encouragement message]." |

### Caregiver Path

| Day | Action | Notification |
|-----|--------|-------------|
| 1 | Linked to patient | None — let connection establish |
| 2 | First adherence notification | "[Name] took their morning medications ✅" |
| 3 | If patient missed a dose | "[Name] missed their evening dose. You may want to check in." |
| 5 | Weekly summary | "[Name]'s medication adherence this week: [X]%. All interactions checked." |
| 7 | Feature highlight | "Did you know you can set up emergency info for [Name]? Their medications and allergies on one QR code." |

## Activation Metrics

### Patients
| Metric | Definition | Target |
|--------|-----------|--------|
| **Onboarding completion** | Reaches "done" screen | 75%+ |
| **First medication added** | At least 1 medication in system | 85%+ |
| **Camera scan used** | Used OCR for at least 1 medication | 40%+ |
| **Reminder confirmed** | Responded to at least 1 reminder | 60%+ within 3 days |
| **Day 7 return** | Opens app on day 7 | 35%+ |
| **2+ medications added** | Interaction checking becomes relevant | 50%+ within 7 days |

**Activation definition:** Patient is "activated" when they have 2+ medications AND have confirmed at least 3 reminders. This is when SafeDose becomes part of their routine.

### Caregivers
| Metric | Definition | Target |
|--------|-----------|--------|
| **Link completed** | Connected to a patient | 70%+ |
| **Dashboard viewed** | Viewed adherence data at least once | 80%+ of linked caregivers |
| **Day 7 return** | Opens app on day 7 | 40%+ |
| **Notification acted on** | Tapped a notification within 1 hour | 50%+ |

**Activation definition:** Caregiver is "activated" when they've viewed the dashboard 3+ times in 7 days.

## Accessibility Requirements (Non-Negotiable)

SafeDose's primary users are elderly. Accessibility isn't a nice-to-have — it's the product.

| Requirement | Implementation | Why |
|------------|---------------|-----|
| **Minimum 18pt body text** | All onboarding screens | Elderly users increase font size. Design for it natively. |
| **Dynamic Type support** | iOS system font scaling | Users who set large text in Settings must see it in SafeDose |
| **High contrast (WCAG AAA)** | 7:1 contrast ratio on all text | Low vision is common in 65+ population |
| **VoiceOver support** | All interactive elements labeled | Blind and low-vision users manage medications too |
| **Large touch targets** | Minimum 48x48pt, prefer 64x64pt | Arthritis, tremors, and imprecise touch are common |
| **No time-limited interactions** | No auto-advancing screens | Users who read slowly must never be rushed |
| **Color is never the only signal** | Icons + text + color for all states | Color blindness affects 8% of men |

## Error States During Onboarding

### OCR Scan Fails
```
Couldn't read that label clearly.

Try holding your phone steady with the
label fully in view, or:

[📷 Try Again]
[✏️ Type It In Instead]
```
Never make the user feel bad about a failed scan. The camera is hard for shaky hands. Always offer the manual fallback immediately.

### No Medications Found in Search
```
We couldn't find "[search term]" in our database.

Try:
• The generic name (e.g., "acetaminophen"
  instead of "Tylenol")
• Check the spelling on your bottle

[🔍 Search Again]
[✏️ Add Manually — enter name and dosage]
```

## Key Takeaway

SafeDose's onboarding is designed for the least tech-confident user in the room. Large text, minimal choices, camera scanning as the "wow moment," and immediate interaction checking as the proof of value. The first 7 days build the medication reminder habit and progressively introduce features (emergency card, caregiver linking, weekly summaries). Caregivers get a parallel path that's faster and focused on monitoring. Every screen must pass the test: "Could my 75-year-old parent do this without help?"
