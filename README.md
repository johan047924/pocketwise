# Pocketwise — personal budgeting app

A light, mobile-friendly budgeting dashboard focused on fast transaction entry, biweekly income, safe-to-spend estimates, recurring bills, monthly category budgets, savings goals, and an AI financial coach.

## Current project status

This repository is a **starter implementation**. The interactive React interface and local demo storage work after running the app. Cloud database tables and a secure AI Edge Function are included, but cloud authentication/data synchronization still need to be wired into the client before treating this as a production app. The AI Edge Function requires a signed-in Supabase user and server-side secrets.

The initial screen contains fictional demo transactions and goals. Replace them with your own data; do not interpret them as real financial information.

## Stack

- React + TypeScript + Vite
- Recharts + Lucide
- Supabase Auth/Postgres (cloud architecture)
- Supabase Edge Function calling the OpenAI Responses API
- GitHub Pages for the static frontend

## 1. Run locally

Install Node.js 20+ and Git. Then:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL Vite prints.

## 2. Create cloud storage

1. Create a project at https://supabase.com/.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the project URL and anon/public key into `.env.local`.
4. Configure Supabase Auth and choose the sign-in method you want.
5. Implement client sign-in and repository methods for each table before using cloud storage for real data. The current UI saves locally and does not yet sync its state to Postgres.

Never put a Supabase service-role key in the frontend. The anon key is intended for browser use with Auth and correctly configured RLS.

## 3. Configure the AI coach securely

1. Install and sign in to the Supabase CLI.
2. Set secrets in the Supabase project (never in `.env.local` or committed files):

```bash
supabase secrets set OPENAI_API_KEY=your_server_side_key
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
supabase secrets set APP_ORIGIN=https://YOUR_GITHUB_USERNAME.github.io
```

3. Deploy the Edge Function:

```bash
supabase functions deploy financial-coach
```

4. Add the deployed function URL to `.env.local`:

```bash
VITE_AI_FUNCTION_URL=https://YOUR_PROJECT.supabase.co/functions/v1/financial-coach
```

5. **Important:** the AI function requires a valid Supabase access token. Before production use, wire Supabase sign-in in the React client and send `Authorization: Bearer <access_token>` on requests. The current UI intentionally does not claim the AI endpoint is live; it falls back to local insights if not configured.

Restrict `APP_ORIGIN` to the exact published app origin. The function authenticates requests and never exposes the OpenAI key to the browser. Add rate limiting and spending caps before inviting other users.

## 4. Publish on GitHub Pages

1. Create a new GitHub repository, for example `pocketwise-budget`.
2. Upload the project files (all files and folders, not just `src`).
3. In the repo, open **Settings → Pages** and select **GitHub Actions** as the source.
4. Add `.github/workflows/deploy.yml` below. GitHub Pages will build and publish the app on pushes to `main`.
5. If using GitHub Actions, the workflow uses the repository name as Vite's base path. Supabase public URL/key can be added as repository Actions variables if you want them injected at build time. Never add AI secrets as `VITE_` variables.

For a project URL such as `https://YOUR_USERNAME.github.io/pocketwise-budget/`, the deployed address will be that URL after the workflow succeeds.

## 5. Data and financial assumptions

- All amounts are CAD by default.
- The sample safe-to-spend formula subtracts recurring bills due within 14 days and an estimated near-term savings contribution from the current modeled balance. It is a starter estimate, **not a guarantee** and not a complete future cash-flow forecast.
- Income cycle entries support actual amounts; the database supports frequency and optional employment end date.
- The annual income helper assumes 26 cycles per year and should only be used for biweekly income.
- Recurring rules forecast obligations; they should not be treated as proof a payment cleared.
- Transfers, debt balances, credit accounts, and bank sync are not yet implemented in the UI.

## Next implementation tasks

- [ ] Supabase sign-in, session restore, and sign-out
- [ ] Data repository with user-scoped CRUD and sync state
- [ ] Move demo data behind an explicit sample-data toggle
- [ ] Secure AI request with access token + rate limiting
- [ ] Improve safe-to-spend with confirmed next payday and cash-flow timeline
- [ ] Full income-cycle form with biweekly dates and employment end date
- [ ] Accessible custom forms in place of browser prompts
- [ ] Automated tests for money calculations and recurrence edge cases
- [ ] Add PWA manifest/service worker if installability is desired

## Security notes

Personal financial data is sensitive. Keep RLS enabled, scope every row to `auth.uid()`, do not commit `.env.local`, and never expose service-role or OpenAI keys in browser code. Export backups carefully because they contain financial data.
