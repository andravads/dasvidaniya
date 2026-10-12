# Homies OS browser build and hosting proposal — 12 October 2026

## Current state

The user approved rebuilding the existing browser app and improving its UI.
The database was previously applied in SQL Editor, and all three lowercase
Supabase helpers are deployed with missing/invalid login rejection and browser
preflight verified. No new modules, migrations or server changes were added.

A production Expo web export now contains the configured root Supabase URL and
publishable client key. No credential-like secret keys or private keys were
found in the export or source publication candidates. No key values were printed.
The dist file inventory and SHA-256 checksums are in web-build-configuration.json.

## Interface improvements

- Clear persistent five-item navigation, current-page state, and account access.
- Home prioritizes tasks and routines, without redundant metric cards.
- Calendar agenda is visible above optional search/date/workspace filters; date
  arrows keep their field synchronized and month cells align to weekdays.
- Readable input text, larger controls, friendly workspace/language/theme labels.
- Light-theme button foreground contrast fixed.
- Less-used settings expand on request, with accessible expanded/pressed state.
- Chat explains local commands versus signed-in AI plainly.
- Browser notifications are disabled and accurately described as native-only.
- Keeping the route slot mounted prevents login/sign-out from resetting the
  current screen while account data loads. Workspace data stays hidden during
  that transition. Signup feedback preserves the email-confirmation message.

## Validation

Strict TypeScript and production export passed. The full browser suite passed
34 cases across desktop and iPhone-sized views, including 320-pixel navigation,
local persistence, calendar edits, friendly labels and expandable settings.
The 42 application/domain/provider/PostgreSQL tests passed. Desktop and phone
previews were inspected in both themes, and Home/Calendar were simplified further
after that review. Eight targeted browser checks also passed after the final small text/status
changes. Formatting checks passed for every edited component and browser test.

Browser sign-in success/error, account separation, login persistence, cloud sync
request shape, authenticated assistant invocation and returned task actions are
tested with simulated Supabase responses. No real accounts, data writes, AI
charges, document indexing or account deletion were performed by those tests.
Live authenticated cloud login/sync/AI still require verification after hosting.

## Proposed publication

Repository: andravads/dasvidaniya (public, currently empty, confirmed via GitHub).
Publish the reviewed existing app source to its main branch; keep environment
files, dist, dependencies, browser artifacts and work scratch files excluded.
Upload no OpenAI key, service-role key, passwords or user data.

Hosting: the user's existing Vercel account, new project homies-os. The connected
Vercel tools currently report no teams and no linked repo project. Do not invent
a team ID; guide the user through their dashboard account/project selection or
use the account connection after the intended scope becomes available.

Project settings: Framework Other, build command npm run build:web, output dist,
Node.js 24. Existing vercel.json provides SPA route fallback. Configure only
EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY on the hosting build.
The saved OpenAI key and service-role credentials remain server-side in Supabase.

After deployment, use the resulting HTTPS URL for Supabase Auth Site URL and
allowed redirect URLs, then verify real email-confirmed login, record persistence
and a cloud AI response with the user. Native reminders need a physical-device
build; web background reminders are not included.

Source upload and website publication approval remain pending. No app has been
published, no remote Git ref changed, and no Vercel project was created.
