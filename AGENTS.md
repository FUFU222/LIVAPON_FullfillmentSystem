# Repository Guidelines

## Project Structure & Module Organization
- `app/` — Next.js app router pages. `/orders`, `/import`, `/admin` house vendor and admin flows; `(public)/apply` is the vendor application form.
- `components/` — Shared UI and feature components (e.g., `admin/vendor-application-card.tsx`).
- `lib/` — Supabase clients, auth helpers, and data access layers (service-role usage lives in `lib/data/*`).
- `supabase/` — CLI configuration and SQL migrations (`migrations/` and `seed.sql`). Keep schema changes here first, then mirror them into `schema.sql` and generated types.
- Documentation lives in numbered markdown files (`00_context.md`, `10_requirements_app.md`, …) plus this guide.

## Build, Test, and Development Commands
- `npm run dev` — Launch local Next.js dev server.
- `npm run lint` — Run Next.js ESLint config (must pass before commit).
- `npx tsc --noEmit` — Type-check without emitting JS.
- `npm run build` — Production build; also triggers lint & type check.
- `npx supabase db push` — Apply staged migrations to the linked Supabase project (requires `SUPABASE_ACCESS_TOKEN`).

## Coding Style & Naming Conventions
- TypeScript + React with functional components; prefer hooks over class components.
- Use 2-space indentation, ESLint + Prettier defaults from Next.js.
- Follow Tailwind utility-first styling; shared patterns belong in `components/ui/`.
- Vendor codes are 4-digit zero-padded strings (e.g., `0007`); SKU format is `CCCC-NNN-VV`.

## Testing Guidelines
- Automated tests are not yet defined. At minimum run `npm run lint`, `npx tsc --noEmit`, and `npm run build` before push.
- When adding tests, colocate under `__tests__/` or alongside the module and document the command here.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes observed in history (`feat:`, `fix:`, `docs:`, `chore:`, `db:`). Keep messages in the imperative mood.
- Each PR should describe the change, reference related issues, and include screenshots or logs for UI/data updates.
- Stage related files together (`git add path1 path2`) and avoid unrelated changes in a single commit.

## Security & Configuration Tips
- Store secrets in environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Never commit `node_modules/`, generated `.tsbuildinfo`, or Supabase tokens. `.gitignore` already covers common cases.
- For remote DB actions, export `SUPABASE_ACCESS_TOKEN` per session rather than storing it in plain text.
