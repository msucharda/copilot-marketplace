---
name: workshop-e2e-checklist
description: "Turn a short technical change description into exactly three checks: expected behavior, one failure case, and one observable completion check. Use when a workshop participant asks for a small verification checklist for a change."
---

# Workshop end-to-end checklist

1. Read the change description and identify its intended outcome. Use only
   non-sensitive details and synthetic example data. If a necessary detail is
   missing, label a minimal assumption rather than inventing project facts.
   Continue when the intended outcome and any assumption are explicit.
2. Draft exactly three checks in English using the format below. Give each
   check a concrete action or input and an observable pass condition. Choose
   one relevant invalid input or failure condition, and describe the expected
   safe response. Make the completion check identify evidence a participant
   can inspect, not just "it works." Continue when all three are independently
   checkable and tied to the described change.
3. Return only the three-item checklist, with any assumption inside the
   relevant item. These are proposed checks, not executed results; do not mark
   them as passed or claim a test ran. Finish when there are exactly three
   unchecked items and no sensitive data or unsupported integration claims.

## Output format

- [ ] **Expected behavior:** Given <normal input>, <action> produces <expected result>.
- [ ] **Failure case:** Given <one failure condition>, <action> produces <safe response>.
- [ ] **Observable completion:** After <action>, inspect <visible output or artifact> and confirm <specific evidence>.

## Non-sensitive example

Change: "Add a required title to a local practice task form."

- [ ] **Expected behavior:** Enter the synthetic title "Practice task" and submit; the new task appears with that title.
- [ ] **Failure case:** Leave the title empty and submit; a required-title message appears and no task is created.
- [ ] **Observable completion:** After submitting "Practice task," inspect the task list and confirm exactly one new entry with that title.
