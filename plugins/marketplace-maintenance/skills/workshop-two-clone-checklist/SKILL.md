---
name: workshop-two-clone-checklist
description: "Turn a short technical change description into exactly three verification checks. Use when a workshop participant wants a small checklist before sharing a change."
---

# Three verification checks

1. Read the supplied change description. If its expected behavior is missing,
   ask for that behavior before producing the checklist.
2. Produce exactly three numbered items:
   - Expected behavior: one concrete successful use.
   - Failure case: one invalid or unavailable input and the expected response.
   - Completion check: an observable result that proves the requested output.
3. Use only non-sensitive examples. Do not invent completed test results.

Done when the three checks describe externally observable behavior and every
unverified result is explicitly marked as unverified.
