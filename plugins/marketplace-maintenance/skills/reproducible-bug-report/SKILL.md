---
name: reproducible-bug-report
description: "Turn supplied bug notes into a reproducible report. Use when preparing a bug report from observations or rough notes."
---

# Reproducible bug report

## When to use
Use when supplied bug notes need clear reproduction steps and a report
another person can follow.

## Required inputs
Collect the bug notes, affected product and version, environment,
preconditions, actions taken, expected behavior, and actual behavior.
Include frequency and supporting evidence when available.
For missing details, ask focused questions when interaction is possible;
otherwise mark them `Unknown` and list the questions in the report.

## Steps
1. Extract supplied observations and keep hypotheses labeled separately.
   Preserve exact error messages and relevant commands.
2. Arrange supplied actions into numbered reproduction steps, including
   known setup and inputs. Mark gaps instead of inventing actions.
3. Separate expected behavior from actual observations. Record supplied
   frequency and evidence without inferring either.
4. Check every factual claim against the notes. Claim successful
   reproduction only when supplied evidence confirms it.
5. Return the report below. If gaps prevent reproduction, label it
   `Needs information` and identify the missing details.

## Expected output
Return a Markdown report with:
- Title
- Status: `Ready to reproduce` or `Needs information`
- Product/version and environment
- Preconditions and inputs
- Numbered reproduction steps
- Expected behavior
- Actual behavior
- Frequency and evidence
- Unknowns and focused follow-up questions

Use `Ready to reproduce` only when setup, steps, and the expected and
actual results are specified; this does not mean reproduction was verified.
The report is complete when each field contains supplied information or
`Unknown`, and every reproduction-blocking gap has a follow-up question.
