# Homies OS phone setup — 13 October 2026

The existing app remains linked to `@andravads/ads-assistant`, EAS project `64949f00-07a2-4515-a279-64d90ff38443`. The new environment successfully uploaded the Android source. PR #2 stays a draft until physical-phone testing is complete.

## Android: install the completed preview

- **Download APK:** https://expo.dev/artifacts/eas/TmrTv8qoU3E4sX4gWND5Fz9vxFQTfkTVhyH-AYkpXyc.apk
- **Expo build page:** https://expo.dev/accounts/andravads/projects/ads-assistant/builds/a127c7d4-9084-4e14-b0e5-be572ab243aa
- Build `a127c7d4-9084-4e14-b0e5-be572ab243aa`: FINISHED; internal Android preview, version `0.1.0`, package `com.homies.os`.
- Expo's upload log reports a 102 MB release APK. The hosted artifact expires on 27 October 2026; download it before then.
- Expo completed the release build and uploaded `app-release.apk` using the existing remote Android keystore. The installation URL resolves from `expo.dev` to `api.expo.dev` and then `wf-artifacts.eascdn.net`. This environment rejects that final CDN host with HTTP 403, so the APK binary, manifest and signature were not independently inspected and no local APK copy was saved. Physical installation/runtime are also pending.
- This preview includes its own app code. It does not need Expo Go or a running development server.
- Free allowance before the build: 0/30 total credits and 0/15 Android credits used. After completion: 1/30 total and 1/15 Android credits used, leaving 29 total and 14 Android credits. Additional usage cost remains $0. No paid action or upgrade was taken.

On your Android phone:

1. Open the APK download link in your browser and download it.
2. Open the downloaded file. If asked, allow that browser or Files app to **install unknown apps**, then tap **Install**. You can turn that permission off afterward.
3. Open **Homies OS**. Start with **Local sandbox** and add a test task. Sign in under **Profile** when you want your account workspace.

## Finish APK binary verification in Codex

The completed APK does not need to be rebuilt. To allow this environment to download and independently verify the existing artifact, add **`wf-artifacts.eascdn.net`** in Codex environment settings while retaining the existing hosts. Save, finish environment setup, select **Republish**, and use the newly published environment in a new cloud task. Existing tasks may retain their original policy. Reuse build `a127c7d4-9084-4e14-b0e5-be572ab243aa`; the follow-up should download and inspect it, not create another build. Keep the supported proxy and TLS verification.

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

See [account sign-in and OpenAI credit troubleshooting](AUTH-HELP.md). The user confirmed Android password sign-in after setting a new password in the signed-in website session, and added the exact native redirect. Source version 0.1.1 improves email-only login, existing-password validation and authentication error messages; its updated APK is being built.

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

## Photos and captions

JPEG, PNG and WebP selection, ordering, editing, captions and PNG/ZIP exports are preserved. Native selection uses **Files**, not a native photo-library picker. On iPhone, an easy test is **Photos → select two screenshots → Share → Save to Files**, then choose those PNGs in Homies. Convert HEIC photos to JPEG first.

Photos/slide images remain in page memory; saved drafts preserve text and captions. Export before leaving the page. Native ZIP sharing and image rendering still need phone testing. Automatic social publishing is not implemented.

## Verification completed

- Exact PR head `5ef25ee2f898544a7e2cff636abb4a9ddbf974a3` was restored and all 85 tracked file hashes verified before the scoped fix. The built app includes the caption guard saved in commit `0cb08c771c50051a1d8ecdfc9ad78aad8103ec67`.
- Fixed a confirmed account-isolation race: a delayed signed-in AI caption could enter the local sandbox after logout. A generation guard now discards the stale response, with desktop and phone browser regression coverage.
- TypeScript passes; all 68 unit/database/provider/carousel/auth/notification tests pass.
- All 40 browser workflows pass at desktop and phone dimensions, including navigation, tasks, email redirect destinations, logout/account separation and photo/caption exports. Authenticated backend responses are mocked; these are not physical-iPhone Safari checks.
- Expo dependency compatibility passes and Expo Doctor passes 21/21 checks using the inherited proxy with Node's environment-proxy support.
- Final Android and iOS Hermes exports pass. The Android EAS build completed its native prebuild, bundling, compilation and signing.
- Live read-only Supabase checks confirm email signup with required confirmation, denied anonymous reads of five app tables and the tasks view, and 401 rejection for missing/invalid carousel sessions. These do not prove authenticated two-account isolation or email delivery.

No database migration, Edge Function deployment, website deployment, store submission or real AI/provider call was made by the assistant. The PR branch's `git.deploymentEnabled.setup/expo-project=false` Vercel setting is preserved. Signing values and server keys were not committed or placed in app configuration; only the two public Supabase settings are saved in EAS preview.

## Maintainer continuation

Use this existing checkout/project; do not create another app. Device registration and initial iOS signing require an interactive, secure EAS/Apple session. Once access is authorized, the applicable commands are `eas device:create`, `eas build --platform ios --profile preview`, and, for later added devices, `eas build:resign` or a new preview build. Recheck the remaining free allowance before any new build and ask before a paid action.

The environment policy is enforced and includes the requested Expo/npm/Google Storage/Supabase hosts. Keep the inherited HTTP(S) proxy and TLS verification. In this read-only-home workspace, use `npm_config_cache=/workspace/.npm-cache`, `EXPO_NO_TELEMETRY=1` and the SDK-supported shell cache override `__UNSAFE_EXPO_HOME_DIRECTORY=/workspace/work/expo`; `NODE_USE_ENV_PROXY=1` enables Node's supported proxy handling. The source archive was uploaded using `EAS_NO_VCS=1` and `EAS_PROJECT_ROOT=/workspace/dasvidaniya`; GitHub changes retain the real PR parent/tree. Scratch verification files are outside the app root.
