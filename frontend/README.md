# Cedar Construction frontend

A Next.js App Router frontend implementing the supplied Stitch designs as React components. Uses TypeScript, Tailwind CSS, local Inter fonts, Lucide icons, React Hook Form, and Zod. Design exports are not runtime inputs.

## Run

```sh
npm run dev
```

Open http://localhost:3000. Use `localhost` for development; Next.js restricts development resources from other origins.

```sh
npm run lint
npm run typecheck
npm run test:validation
npm run build
npm run start
```

With a server running, run `npm run test:runtime`. The browser suite uses installed Chrome by default. Set `BROWSER_CHANNEL=msedge` to use Edge and `BASE_URL` to test another port. It logs each route and interaction, emits a heartbeat during longer operations, and exits nonzero with a screenshot/report on failure. Results and screenshots are written to `verification/`.

## Application areas

- Public: `/`, `/projects`, `/projects/[id]`, `/apartments`, `/apartments/[id]`, and enquiry.
- Authentication: `/sign-in`, `/register`, `/company-setup`, `/workspace-ready`.
- Company workspace: `/app/dashboard` and role views, projects and structure, apartments, construction stages, tasks and updates, parties, payments/categories, leads, documents, assistant, and company/team/profile settings.
- Platform: `/platform`, `/platform/companies`, company detail, and `/platform/users`.

The complete verified route list is recorded in `verification/runtime-results.json` after a successful browser run.

## Structure

- `src/app`: routes and shared public, auth, company, and platform layouts.
- `src/components/layout`: shared navigation and shells.
- `src/components/forms`: explicitly authored forms and accessible field primitives.
- `src/components/features`: interactive screens and the session workspace store.
- `src/lib/validations`: reusable Zod schemas connected through `zodResolver`.
- `src/lib/mock-data` and `src/lib/types`: typed domain records.
- `public/images` and `public/fonts`: local assets, with no runtime Stitch requests.
- `scripts`: schema and browser verification.

React Compiler is disabled because automatic memoization interfered with React Hook Form's mutable form-state subscriptions. Edit forms react to restored session records, including after reload.

## Frontend-only behavior

No backend, API endpoints, credential storage, real authentication, or external AI service is provided. Sign-in accepts any valid email and password of at least eight characters. Company and platform areas are demo layouts, not authorization boundaries. The assistant responds from local demo data.

Changes persist in `sessionStorage` for the current browser tab. Clear the `cedar-workspace-v1` session-storage key and reload to reset demo records. Uploaded files use browser object URLs and are available only for the current document lifetime; they must be selected again after a full reload. No files are uploaded to a service.
