# Photo carousels

Status, 13 October 2026: the user approved the feature and deployed the lowercase
`carousel` Edge Function. Live missing/invalid session checks return the expected
401 responses, and browser preflight returns 204 with the required CORS headers.
The frontend is released through the app's main branch. A real signed-in photo
request remains unverified; no production photos or provider calls were used for
these checks. The confirmation/resend/password-reset fix was published separately.

## What you will do

Open Workspace → Content Studio. Choose **Gym** or **Work**, choose 1–10 photos,
and arrange their order. Press **Prepare with AI**. Homies looks at the photos,
writes text for each slide, and prepares separate post captions. Review the
result, make any corrections, and download the carousel. The ZIP contains ordered
1080 × 1350 PNGs and `captions.txt`. Original photos are fitted into the image
without cropping, with readable text over a dark fade near the bottom.

Gym prepares captions for TikTok Gym and Instagram Gym. Work prepares a caption
for TikTok Working tips. These are account roles, not connected social accounts.
The app does not post to external accounts. Optional context and language are
under an expandable control; choosing photos is enough to start.

Photos are kept in page memory, not uploaded to the database or included in cloud
sync. Preparing explicitly sends 512 × 640 PNG previews to OpenAI. Provider
`store: false` is used; this is not a promise of zero provider retention. Each
preparation uses one request from the existing daily and per-minute AI budget.
Download before leaving or reloading the page. Saving drafts stores only the
slide text and captions. Native shared exports remain temporarily in OS-managed
cache so the receiving app can read them.

Supported inputs: JPEG, PNG and WebP; 8 MB per photo, 32 MB per set, 10 slides.
The current native picker opens files. Photos in an iPhone Photos library need
to be available in Files; a dedicated native photo-library picker remains future
work. HEIC needs conversion to JPEG. Browser selection can use the phone's
supported photo/file chooser.

## Fix email links

In Supabase → Authentication → URL Configuration:

- Site URL: `https://dasvidaniya.vercel.app`
- Redirect URLs: `https://dasvidaniya.vercel.app/**`

Save, then use **Resend confirmation email** in Profile and open the newest email.
Old emails keep their original localhost address. The app now explicitly supplies
the current website's `/profile` address for signup, resend and recovery. Custom
email templates must retain Supabase's `{{ .ConfirmationURL }}` rather than a
hardcoded localhost URL. Admin settings and custom templates are not editable
using a public client key and have not been changed by Codex.

## Server deployment review

No database migration, new bucket, grant or RLS policy is needed. Add only the
authenticated `carousel` Edge Function. It uses existing Supabase built-in server
bindings, `OPENAI_API_KEY` and `reserve_ai_request`. It does not replace assistant,
documents or account functions. Optional `CAROUSEL_MODEL` defaults to the project's
existing `gpt-4.1-mini` model and must be in `AI_ALLOWED_MODELS`.

The current project already deployed `carousel` after explicit user approval;
do not deploy it again or rerun migrations just to use the app. For future dashboard deployment,
copy the whole generated [dashboard file](../review/carousel-dashboard.ts), name
the URL slug **carousel** (lowercase), and disable gateway Verify JWT. The handler
independently verifies every bearer token with Supabase Auth before reading the
request or creating an AI reservation; disabling gateway JWT does not disable
application authentication. Missing/invalid sessions must return 401. Keep email
verification enabled. Then publish the feature branch to the app's main branch.

Developer checks: `node scripts/prepare-carousel-dashboard.mjs --check` verifies
the dashboard copy matches the source. `npm run check:server` checks the modular
and dashboard entry points. Never run `db push` for this feature; the existing
schema was applied manually and its CLI history needs reconciliation.

## Phone app

The same codebase includes iOS and Android support, native secure session storage,
file sharing, and a `homiesos://profile` email callback. Add that exact callback to
Supabase Redirect URLs before testing a signed native build. This does not make
the website an App Store app. Native JavaScript bundles are checked here, but
device behavior and signed app builds are unverified.

Create a free account at https://expo.dev/signup when ready for downloadable
builds. EAS project ownership, application identifiers and signing must be set up
for that account. Android can be distributed as a test APK; iPhone distribution
requires Apple's signing/distribution setup. Expo account details have not been
supplied; no EAS build, paid subscription, store upload or signing action was run.

## Validation

Unit tests cover bounded thumbnail input, request streams, generated account and
slide matching, export interoperability/checksums, auth callback routing, required
login, authenticated owner scope, AI budget refusal and incomplete provider output.
Desktop and phone browser tests use simulated authenticated responses, exercise
real thumbnail rendering and PNG/ZIP downloads, and check draft saving and category
changes. They do not prove live AI responses, real email delivery or native-device
behavior. No production photos were accessed and no provider calls were made.
