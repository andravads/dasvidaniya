# Homies OS phone setup — 13 October 2026

The existing app remains linked to `@andravads/ads-assistant`, EAS project `64949f00-07a2-4515-a279-64d90ff38443`. The new environment successfully uploaded the Android source. PR #2 stays a draft until physical-phone testing is complete.

## Android: update-enabled preview

- **Latest Expo build page:** https://expo.dev/accounts/andravads/projects/ads-assistant/builds/99d57427-f844-49a1-a768-237777185774
- Build `99d57427-f844-49a1-a768-237777185774`: queued; internal Android preview, version `0.1.2`, version code `3`, package `com.homies.os`. Its new APK link will appear after successful completion.
- The existing remote Android keystore is reused. The APK download resolves through `wf-artifacts.eascdn.net`, which this environment currently excludes. Binary/signature and physical installation/runtime checks remain pending.
- This preview includes its own app code and the update engine. It does not need Expo Go or a running development server.
- Before this build, Free usage was 2/30 total and 2/15 Android included credits, with $0 additional cost. No paid action or upgrade was taken.

The previous authentication-only Android 0.1.1 build completed: https://expo.dev/artifacts/eas/H1ynZTuH3NlC4McAvgsY3O4uF40Z-wwIpa5DVUtmduo.apk . It lacks the update engine. Use the new 0.1.2 APK once it is finished to gain in-app updates.

On your Android phone:

1. After the 0.1.2 build finishes, open its APK download link in your browser and download it.
2. Open the downloaded file and install it over the existing Homies OS app; do not uninstall first. If asked, allow that browser or Files app to **install unknown apps**, then tap **Install**. You can turn that permission off afterward.
3. Open **Homies OS**. Start with **Local sandbox** and add a test task. Sign in under **Profile** when you want your account workspace.

## Updates after this installation

Version 0.1.2 adds **Profile → App updates → Check for updates**, download status and an explicit **Restart to update** button. It also checks automatically on a cold start, downloads in the background and applies compatible updates on the next cold start. Save unfinished work before restarting. Native/SDK changes still require a new APK.

Source is saved in commit `b6d961e3000f04c6d5b3bdbe13941c1999ebc3e6`. Preview channel and branch are linked. Android runtime `c33dfa84e1be9348a443e87d0c2023d2a55b3318` matches the permitted local resolver. The first compatible update was exported, but publication failed with HTTP 403 at `update-assets-upload-production.storage.googleapis.com`; no update group was created. Add that exact upload host to the environment policy before retrying. See [app update instructions](APP-UPDATES.md).

## Finish APK binary verification in Codex

To allow this environment to publish app updates and inspect the completed APK, add **`update-assets-upload-production.storage.googleapis.com`**, **`u.expo.dev`** and **`wf-artifacts.eascdn.net`** in Codex environment settings while retaining the existing hosts. Save, finish environment setup and select **Republish**. If the current task retains its original policy, use the newly published environment in a new cloud task. Reuse build `99d57427-f844-49a1-a768-237777185774` after completion; do not rebuild merely to download it. Keep the supported proxy and TLS verification.

## iPhone: signed internal preview

Current official Expo guidance says the Apple App Store version of Expo Go stops at SDK 54. This app uses SDK 57. A tunnel cannot solve the native compatibility requirement. The SDK 57 iOS simulator archive is also not installable on a physical iPhone.

Use the existing app's **signed internal iOS preview**, which bundles its own code. It requires an active Apple Developer Program membership, an authorized Apple signing flow, and the iPhone's registration in the ad hoc provisioning profile. Existing Expo metadata currently shows no saved Apple team, iOS build credentials or registered devices for this account/project. It does not establish whether you personally have Apple membership.

**Your required next step:** confirm whether you already have active Apple Developer Program membership. No membership purchase is authorized. After confirmation, device registration and signing must be completed through Expo/Apple's secure flows: open Expo's registration link on the iPhone, authorize signing securely, then build this same `preview` profile for iOS. Open the completed build page on that registered iPhone to install it. Enter passwords, two-factor codes and signing material only in the official secure flow, never in chat or GitHub.

No iOS build or App Store/TestFlight submission has been made. Current official references:

- https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/tutorial/eas/internal-distribution-builds/

Their current official source was verified through the Expo GitHub repositories; the version API at https://exp.host/--/api/v2/versions also confirms the SDK 57 Android client and iOS simulator assets. The newer `eas go` route submits to App Store Connect/TestFlight, so it is outside this task's scope.

## Sign-in help

See [account sign-in and OpenAI credit troubleshooting](AUTH-HELP.md). The user confirmed Android password sign-in after setting a new password in the signed-in website session, and added the exact native redirect. The 0.1.1 email-only login, existing-password validation and authentication error improvements are retained in 0.1.2. Install the latest APK over the existing Homies OS app with the same package and keystore. The website was not redeployed under the original restriction.

## Email links: verify the two redirect URLs

Public Supabase settings do not expose the redirect allowlist, so this requires your dashboard access.

1. Open https://supabase.com/dashboard/project/jnuaexajxrudalbcxcii/auth/url-configuration .
2. Under **Authentication → URL Configuration → Redirect URLs**, add these exact entries if missing:
   - `homiesos://profile`
   - `https://dasvidaniya.vercel.app/profile`
3. Keep the existing website redirects and Site URL; leave email confirmation enabled. Press **Save**.
4. Request a fresh confirmation or recovery email from the app. Existing emails retain their original destination. Custom email templates must preserve Supabase's `{{ .ConfirmationURL }}`.

## Physical-phone checks

1. Visit Home, Calendar, Chat, Workspace and Profile. Check small-screen navigation, keyboard visibility and long labels.
2. Create, edit, complete and reschedule a task. Close and reopen the app to check persistence.
3. Open newly requested confirmation/sign-in/recovery links with the app closed and with it already open. Check the password-reset flow.
4. Sign in, close/reopen the app and check session persistence. Reopen after a longer idle period to exercise token refresh. Sign out and confirm account records disappear. If you use a second account, confirm its workspace is separate; local sandbox records must also stay separate.
5. Use **Sync now** on the phone and existing website and compare a test task. Browser cloud tests use mocks; this is still a real-account check.
6. Test denied and granted notification permission. Schedule a short test reminder and check it with the app open and closed. Foreground/background delivery has not been verified on a physical phone.
7. Test photo selection, slide editing, captions, PNG/ZIP export and opening the shared ZIP in another app. AI generation sends previews to the configured provider and may use paid provider services; no billable provider call was made during this work.
8. After a compatible update is published, use **Profile → App updates → Check for updates → Restart to update**. Confirm the app reopens, retains a saved test task and keeps the expected session. Downloading must not force a restart.

## Photos and captions

JPEG, PNG and WebP selection, ordering, editing, captions and PNG/ZIP exports are preserved. Native selection uses **Files**, not a native photo-library picker. On iPhone, an easy test is **Photos → select two screenshots → Share → Save to Files**, then choose those PNGs in Homies. Convert HEIC photos to JPEG first.

Photos/slide images remain in page memory; saved drafts preserve text and captions. Export before leaving the page. Native ZIP sharing and image rendering still need phone testing. Automatic social publishing is not implemented.

## Verification completed

- Exact PR head `5ef25ee2f898544a7e2cff636abb4a9ddbf974a3` was restored and all 85 tracked file hashes verified before the scoped fix. The built app includes the caption guard saved in commit `0cb08c771c50051a1d8ecdfc9ad78aad8103ec67` and the auth fixes saved in `3d3ae233de15a7bf18e1f280b17aa9d9fa41dc45`.
- Fixed a confirmed account-isolation race: a delayed signed-in AI caption could enter the local sandbox after logout. A generation guard now discards the stale response, with desktop and phone browser regression coverage.
- TypeScript passes; all 98 unit/database/provider/carousel/auth/notification/update tests pass.
- All 54 browser workflows pass at desktop and phone dimensions, including navigation, tasks, email redirect destinations, logout/account separation, photo/caption exports and safe web update guidance. Authenticated backend responses are mocked; these are not physical-iPhone Safari checks.
- Expo dependency compatibility passes and Expo Doctor passes 21/21 checks using the inherited proxy with Node's environment-proxy support.
- Final 0.1.2 Android and iOS Hermes exports pass. Native configuration inspection enables updates on both platforms, with cold-start checks and zero launch wait. The previous 0.1.1 EAS build completed native compilation/signing; the update-enabled 0.1.2 build is queued.
- Live read-only Supabase checks confirm email signup with required confirmation, denied anonymous reads of five app tables and the tasks view, and 401 rejection for missing/invalid carousel sessions. These do not prove authenticated two-account isolation or email delivery.

No database migration, Edge Function deployment, website deployment, store submission or real AI/provider call was made by the assistant. The PR branch's `git.deploymentEnabled.setup/expo-project=false` Vercel setting is preserved. Signing values and server keys were not committed or placed in app configuration; only the two public Supabase settings are saved in EAS preview.

## Maintainer continuation

Use this existing checkout/project; do not create another app. Device registration and initial iOS signing require an interactive, secure EAS/Apple session. Once access is authorized, the applicable commands are `eas device:create`, `eas build --platform ios --profile preview`, and, for later added devices, `eas build:resign` or a new preview build. Recheck the remaining free allowance before any new build and ask before a paid action.

The environment policy is enforced and includes the requested Expo/npm/Google Storage/Supabase hosts. Keep the inherited HTTP(S) proxy and TLS verification. In this read-only-home workspace, use `npm_config_cache=/workspace/.npm-cache`, `EXPO_NO_TELEMETRY=1` and the SDK-supported shell cache override `__UNSAFE_EXPO_HOME_DIRECTORY=/workspace/work/expo`; `NODE_USE_ENV_PROXY=1` enables Node's supported proxy handling. The source archive was uploaded using `EAS_NO_VCS=1` and `EAS_PROJECT_ROOT=/workspace/dasvidaniya`; GitHub changes retain the real PR parent/tree. Scratch verification files are outside the app root.
