---
name: accessibility-review
description: Provides independent accessibility review for user-facing UI changes at epic triage, plan signoff, and pre-merge review.
---

# Accessibility Review

Use an independent accessibility reviewer whenever an epic or plan changes a user-facing interface. This skill adds governance to the existing QA and code-review workflows; it does not replace usability testing or automated accessibility checks.

1. **Epic triage:** Set `accessibility.ui` explicitly and record the rationale. For UI work, define WCAG 2.2 AA coverage: semantic HTML, keyboard-only operation, visible focus, appropriate ARIA, labels and error recovery, contrast, screen-reader behavior, and zoom/reflow. Record independent reviewer evidence in `approvals.accessibility`.
2. **Plan signoff:** After Principal approval—and AppSec signoff when applicable—move the plan to `awaiting-accessibility-signoff`. Confirm every UI acceptance criterion has a verifiable accessibility check, then record independent approval. No UI plan may start without it.
3. **Final review:** After the mandatory AppSec review, review the exact `review_commit`. Verify automated checks plus representative keyboard and assistive-technology behavior. Record `accessibility_review` with `by`, `date`, `notes`, `revision`, and `commit`. Unresolved blockers prevent PR eligibility.

Do not mark `ui: false` merely because a change is visually small. Components, forms, navigation, content structure, interactions, client-side validation, and responsive layouts are UI changes. If scope is uncertain, keep the plan awaiting review.
