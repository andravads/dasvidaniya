# Homies OS

A mobile-first personal command center built with Expo Router, React Native and TypeScript. The current app is a local-first MVP. The Supabase database and three authenticated server functions are deployed; the browser app is hosted at https://dasvidaniya.vercel.app. It is not a completed implementation of every feature in the project brief.

The latest email-link fix is published: signup, confirmation resend and recovery
use the current website's account page. Set Supabase's Site URL and redirect
allowlist to the deployed website, then request a fresh confirmation email.
See [photo carousel setup and deployment review](docs/CAROUSELS.md) for the new
Gym/Work photo preparation feature. Its fourth server function, `carousel`, was
deployed with user approval on 13 October 2026. Live login rejection and browser
preflight checks pass. A signed-in photo preparation still needs testing with
the user's account.

## Try the app

1. Install **Node.js 24 LTS**.
2. Open a terminal in this folder and run `npm ci`.
3. Run `npm run web` for the browser, or `npm start` and open a compatible Expo development build on your phone.
4. Start in the clearly labeled **Local sandbox**. Add a task, check off a habit, save a campaign or draft, or ask chat: `Add task: Practice piano tomorrow 19:00`.

There are no invented sample holdings, live prices, sales or technical references. Initial watchlists are unverified interests. Routine targets are editable user preferences.

Local records persist only on the current device/browser. Local mode is not secure authentication. Do not put confidential company documents on a shared device. Signing in opens a separate account workspace and does not silently transfer local data to a provider.

## What works today

- Responsive desktop sidebar and mobile bottom navigation, dark/light themes, editable profile, Asia/Jakarta default timezone, configurable widgets, Indonesian/English navigation.
- Persistent task creation/editing/completion, daily/weekly/month date agenda, all-task and priority views, time blocks, conflict detection and rescheduling through the task form. Recurring tasks generate the next occurrence on completion.
- Gym/recovery, cooking, piano and separate game checklists; editable targets, streaks, practice timer and recorded duration.
- Persistent conversations, local English/Indonesian task commands and recorded priority summaries. Configured OpenAI Responses chat can propose validated create-task, reschedule-task and save-caption actions.
- Editable Gainsip product/customer/channel profile, campaign hypotheses/status/results, review calendar tasks and manual sales/inquiry/revenue records.
- Separate content drafts for the three requested account roles, manual caption editing, pipeline stages, content calendar tasks and manual view counts. Configured AI caption generation is implemented server-side.
- Photo carousel preparation: choose and order photos, generate per-slide text and account captions, edit the result, export PNG slides plus captions as a ZIP. The authenticated `carousel` server function is deployed. Photos are not persisted in cloud records.
- Local TXT imports and source-named keyword excerpts; private cloud PDF/DOCX/TXT/XLSX/image storage when configured. Explicitly authorized PDF/DOCX/TXT indexing and citation-bearing engineering answers use OpenAI File Search.
- IDX/US watchlists and manual holding records; card inventory with explicit variants, conditions, grading and user-entered price provenance/history. Quotes and collection market values are unavailable without providers.
- Account-scoped persistence and owner-only cloud synchronization, JSON export and explicit deletion controls.
- Native scheduled local task reminders with quiet hours and duplicate identifiers. **Requires a physical Android/iOS build and notification permission. Not tested on a device here.** No web background reminders or remote push.

## Connect your own Supabase project

This enables real sign-in and account synchronization across devices.

**Current project status (12 October 2026):** the user applied the database setup
in SQL Editor. Live read-only checks recognize the app tables and reject
anonymous reads. The three lowercase Edge Functions are deployed and reject
missing/invalid logins. A new browser export includes the current Supabase
connection. Actual account sign-in, sync and AI replies need live testing after
hosting. Skip the schema
creation step below for this project. Manual SQL did not register CLI migration
history; reconcile that history before any future `db push`. Function deployment
does not require pushing the database again.

1. Create a Supabase project at supabase.com. Keep its database password private.
2. Install/use the official CLI: `npx supabase login`, then `npx supabase link --project-ref YOUR_PROJECT_REF`.
3. Apply the schema: `npx supabase db push`. Review the migration first. It creates owner-only RLS, a private engineering file bucket and server-only AI budget controls.
4. Deploy: `npx supabase functions deploy assistant`, `npx supabase functions deploy documents`, `npx supabase functions deploy account`.
5. Copy `.env.example` to `.env`. Set the public project URL and publishable/anonymous client key in the two EXPO_PUBLIC fields. These values identify the project; they are not a service-role key.
6. In Supabase Auth settings configure your deployed website URL and the exact `homiesos://profile` redirect. Keep email verification enabled and configure a reliable SMTP service for real users. Use a strong password.
7. Restart Expo, open Profile, create your account, confirm your email, and sign in. Press **Sync now** on both devices to verify the same records appear. Local sandbox records remain separate.

The server uses Supabase's built-in secret bindings. **Never place SUPABASE_SERVICE_ROLE_KEY or OPENAI_API_KEY in the frontend `.env`.** Server functions verify the bearer token with Supabase Auth even though gateway `verify_jwt` is disabled to support newer signing keys.

### Enable real AI and engineering retrieval

In the Supabase dashboard, open **Edge Functions → Secrets** and add:

- `OPENAI_API_KEY`: your key, entered securely there.
- `AI_ALLOWED_MODELS`: defaults to `gpt-4.1-mini`. Comma-separated allowlist; match the requested model in Profile.
- `AI_DAILY_REQUEST_LIMIT`: defaults to `20`, maximum `100` per user per UTC day. Up to five attempts per minute. Failed requests count toward the request budget. This is a request cap, not a currency-spend guarantee; set provider-side spending limits too.

No external AI calls work without this key. File Search storage can incur provider charges independent of request counts. Vector stores expire after 30 inactive days; expired-store recreation is not yet automatic.

Upload only authorized engineering data. Choose a classification and explicitly enable permission to send the file to OpenAI. Uploading alone keeps it in private Supabase storage. Press **Index with AI** and, if still processing, check again later. Engineering Chat uses only indexed files with active permission, quotes their names/revisions, and refuses unsupported technical answers. Revisions are user-supplied; the app does not certify manual currency. TXT imports in local mode provide keyword search only. Imported images/XLSX are stored but are not OCR'd or semantically indexed.

## Development checks

```sh
npm run typecheck
npm test
npm run check:server
npm run build:web
npm run test:e2e
```

Browser tests require Chromium. Set `PLAYWRIGHT_CHROMIUM_PATH` to your executable, or install Playwright Chromium with `npx playwright install chromium` and set that path. In this cloud workspace `/usr/bin/chromium` is already installed. Tests exercise real local workflows at desktop and phone dimensions. Database tests execute the actual migration in embedded PostgreSQL (PGlite) with Auth/Storage schema stubs and assert cross-account isolation. They do not replace testing a deployed Supabase project, native devices or a real OpenAI call.

### Cloud workspace specifics

If the machine has a read-only home directory, run commands with `npm_config_cache=/workspace/.npm-cache DOTSLASH_CACHE=/workspace/.dotslash-cache EXPO_NO_TELEMETRY=1`. `EXPO_OFFLINE=1` uses Expo's bundled SDK compatibility data when the Expo metadata API is blocked; package downloads still use npm with integrity/TLS checks. The saved onboarding install script captures these settings. Use the existing checkout; this task is already isolated, so do not create a worktree unless requested.

## Phone installation

See [the existing Homies Expo project and phone setup](docs/EXPO-SETUP.md) for Android APK status, iPhone testing, and the exact email callback. Use the existing linked app rather than creating another project.

## Deployment

- Web: `npm run build:web`, deploy `dist` to a static host. `vercel.json` configures SPA fallback. Set public Supabase build variables on your host; set server keys only in Supabase. Use HTTPS.
- Android/iOS: create an Expo account, run `npx eas-cli build:configure`, fill in your own application identifiers/project ID and `npx eas-cli build --profile preview --platform android` or production builds for each platform. Native development clients can be built with `npx eas-cli build --profile development` after installing `expo-dev-client` via `npx expo install expo-dev-client`.
- iOS distribution needs Apple Developer membership; Android publishing needs Play Console membership. The Android preview APK build has completed; see [phone setup](docs/EXPO-SETUP.md) for its installation link and download-verification limits. iOS builds and store submissions have not been run. Before publishing, supply a privacy policy and test email verification, password recovery, permission denial, account deletion, synchronization and notifications on physical devices.
- Never use the default template icon for a public release; branding assets are pending.

## Not yet implemented / release limits

Licensed market adapters, ticker verification, exchange holiday calendars, opening/closing market jobs, card catalog/OCR, live marketplace prices, currency conversions, cloud photo-library persistence, native photo-library picking, video editing/export, social OAuth/publishing, Google Calendar integration, push notifications, biometric gate, detailed notification history, rich subtask/attachment editing, full-form Indonesian translations and automatic weekly AI reports remain future work.

The database uses versioned JSON records and owner-preserving domain views for the MVP, not a complete normalized schema for all future modules. A job table provides idempotency/retry fields; no worker or automatic exchange-calendar job is active. Cloud sync is last-write-wins per record and may lose simultaneous edits to the same record. Uploaded cloud files are not included in JSON exports. Backups can be exported; full account backup import/restore is pending. Password-reset emails require a configured recovery destination; the in-app signed-in password update is available.

Dependency advisories in Expo’s upstream toolchain remain unresolved; see the security notes before a production release.

See [architecture and roadmap](docs/ARCHITECTURE.md), [validation report](docs/VALIDATION.md), and [security notes](docs/SECURITY.md). Production security review and external-service validation remain required before storing sensitive work information.
