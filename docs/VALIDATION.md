# Validation — 9 October 2026

## Carousel release — 13 October 2026

The user approved publication and deployed the prepared lowercase `carousel`
function. Live non-destructive checks return 401 `Authentication required` for
a missing login, 401 `Invalid or expired session` for an invalid bearer, and 204
for browser preflight with the expected origin/method/header permissions. These
requests neither sent photos to OpenAI nor wrote application records.

The tested carousel frontend is released through main after these checks. Live
signed-in photo generation and the user's email flow remain unverified because
Codex does not have the user's login. The tests and native bundle validation below
still apply to the unchanged application code. No new migrations were applied.

A final frontend fix automatically shrinks detailed photo previews instead of
rejecting them for poor PNG compression. Strict TypeScript and web production
export passed again. The carousel browser flow passed on desktop and mobile with
a deterministic high-entropy image, verifying automatic preview resizing, the
unchanged 1080 × 1350 export, captions and idempotent draft saves. The deployed
server code remains unchanged.

## Photo and login update — 12 October 2026

The browser app is published at https://dasvidaniya.vercel.app. The confirmation,
resend and password-reset redirect fix was published separately; GitHub's Vercel
status reports a successful deployment for commit `eb6e9b4`.

The new photo carousel flow is prepared on a review branch; its fourth Edge
Function is not deployed. Strict TypeScript, frozen Deno checks (including the
generated dashboard copy), web production export, and 53 unit/security/database
tests passed. All 38 desktop/mobile browser checks passed across a complete run
and targeted reruns: two page-initialization checks hit their five-second wait
during concurrent native bundling and passed when rerun. Carousel export checks
exercise actual PNG rasterization, ZIP structure/checksums, slide order, separate
account captions, editing and draft persistence using simulated cloud responses.

iOS and Android Hermes JavaScript bundles exported successfully. They are not
signed native builds; no Expo account, EAS build, physical-device test or store
submission has been completed. Live photo AI, the user's email delivery, live
signed-in cloud sync, and Supabase administrative URL settings are unverified.
No production photo or AI provider call was used in testing. See
[carousel implementation and deployment review](CAROUSELS.md).

The remaining entries below describe earlier checks and their historical limits.

Latest update — 12 October 2026: the user-approved browser rebuild and UI
simplification are complete. Production export and strict TypeScript passed;
42 unit/domain/provider/PostgreSQL tests and 34 desktop/mobile browser checks
passed. Browser cloud flows use simulated services; authenticated production
cloud flows remain unverified. See `review/web-deployment-plan.md`.

The user previously applied the database and deployed all three lowercase Edge
Functions. Their missing/invalid login rejection and preflight checks pass.
Publishing the website and uploading the source repository await approval.

The 9 October checks below are retained as historical validation.

## Executed successfully

| Check                         | Evidence                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| TypeScript                    | `npm run typecheck` passed with strict types                                                     |
| Domain and PostgreSQL tests   | 21 tests passed across 3 suites                                                                  |
| Browser workflows             | 24 tests passed: 12 workflows at desktop and iPhone-sized browser dimensions                     |
| Edge Function types           | Deno checked all three authenticated endpoints with frozen lockfile                              |
| Web production export         | Expo produced the SPA and static bundles in `dist`                                               |
| Android/iOS JavaScript export | Expo produced Hermes bundles for both platforms; this is not a signed native app build           |
| Development server            | Expo served the task editor to a browser; no browser page errors in the functional smoke check   |
| Manual UI review              | Desktop and mobile screenshots inspected; clipped mobile task action fixed and regression-tested |
| Dependency compatibility      | Scoped UUID override exercised through xcode's UUID generator                                    |

Browser checks cover chat-created calendar tasks, persistence across reload, calendar conflicts, task completion, habits, campaign/calendar linking, content scheduling, authorized local TXT excerpts, unavailable market-data labels, confirmed card variants with manual price provenance, preference persistence, local-mode authentication labeling, task-delete confirmation and mobile quick-action placement.

PostgreSQL tests execute the migration in PGlite with minimal Auth/Storage schemas. They check forged-owner writes, cross-owner reads, security-invoker views, timestamp/tombstone merges, private file-prefix policies, restricted document updates, server-only AI budget reservations and anonymous denial. They are not tests against a deployed Supabase instance.

## Not executed / unresolved

- No supplied Supabase project or OpenAI key: real sign-in/email recovery, cross-device cloud sync, private Storage requests and OpenAI/File Search calls remain unverified. No tests claim these external integrations succeeded.
- Native physical-device notifications, background delivery, iOS/Android builds, store submission and mobile biometrics have not been tested. Mobile browser tests do not establish native behavior.
- Cloud functions have source/type validation and database-policy tests; production deployment and live endpoint tests remain required.
- Dependency audit after the compatible UUID fix reports 21 affected dependency paths (18 high, 3 moderate), originating from three remaining advisory sources. See SECURITY.md for actual advisories and remediation limits.
- The optional React Native DevTools desktop shell cannot launch in the cloud sandbox because its SUID helper is unavailable; Metro and web development remain functional without it. No sandbox protection was disabled.
- Provider features, content media editors, OAuth integrations and scheduled exchange-calendar jobs remain unimplemented, not skipped passing tests.

The current local development workflow is verified. The full ten-workflow product acceptance checklist is not complete, and production readiness is not claimed.

The complete saved install script was executed again with `npm ci`, strict typecheck, all 21 unit/database/provider tests, frozen server checks and production web export. All completed successfully. The final rebuilt app passed all 24 browser tests again. `install_script`, `start_skill` and public Supabase variable requirements were saved to the cloud environment draft; this does not publish the environment or deploy the app.
