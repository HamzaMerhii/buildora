# Final QA report

Completed 2026-09-19. Continued the existing implementation without reinitializing Next.js or reinstalling dependencies.

## Fixes

- Required numeric schemas reject blank and whitespace values instead of coercing them to zero; explicit progress/floor zero remains valid.
- Optional email/text values normalize consistently. Apartment hierarchy validation lives in the reusable schema factory.
- Disabled React Compiler after reproducing stale React Hook Form error rendering; invalid submissions now show inline errors and corrected forms submit.
- Edit forms synchronize restored session records, including after reload.
- Task/building/settings and nested public routes show the correct active navigation state. Public apartment detail uses the shared container.
- Runtime verification uses localhost for Next development-origin compatibility and logs routes, phases, heartbeats, failures, screenshots, and a nonzero failure exit.
- Removed temporary Stitch references and generation/debug scripts. Updated README with run instructions and demo limits.

## Results

| Check | Result |
| --- | --- |
| npm run lint | Passed |
| npm run typecheck | Passed: Next route type generation and tsc --noEmit |
| npm run build | Passed: optimized production build, 38 prerendered pages |
| scripts/validation-check.ts | 54 assertions passed |
| Development browser verification | 63 routes and 9 interaction flows passed |
| Production browser verification | 63 routes and 9 interaction flows passed |
| Responsive checks | Passed at 390, 820, and 1440 pixels |
| Browser console/page errors | Zero |
| Missing image/font assets | Zero observed |
| Runtime Stitch requests | Zero; no Stitch references in application source |
| Form integration audit | All 23 useForm instances use zodResolver |
| git diff --check | Passed |

Validation covers required/whitespace input, email, passwords and confirmation, terms, numeric conversion and bounds, progress 0-100, enums, dates, apartment hierarchy, optional-value normalization, contact alternatives, and file constraints.

Browser flows cover invalid and valid project submissions, edit values after reload, phone-only and email-only enquiries, lead creation/status, task progress updates, search/filter, mobile navigation, auth validation/onboarding, public/auth/company/platform transitions, and active sidebar states. Invalid forms remain on their current route and errors clear after correction.

Public, company, auth, and platform screenshots were visually inspected, including form error styling. Both browser runs used installed Chrome. Complete route lists are in development-results.json and runtime-results.json; screenshots are alongside this report.

## Remaining limits

This is intentionally frontend-only. Authentication, platform permissions, and AI responses are demonstrations. Data persists in the current tab's sessionStorage. Uploaded object URLs do not survive full reloads; there is no upload service. Automated browser coverage was Chromium-based, not Safari or Firefox.
