# Homies OS phone setup — 13 October 2026

Use the existing Homies OS application and Expo project `@andravads/ads-assistant`, project ID `64949f00-07a2-4515-a279-64d90ff38443`. No starter app was created. The current source was reconciled with PR #2 before mobile changes, preserving its carousel, auth, accessibility and security improvements.

## Ready in source

- Expo SDK 57 compatible patch versions; SDK-compatible expo-dev-client and expo-system-ui installed.
- Android preview uses an APK with its own bundled app code, internal distribution and the medium resource class. It does not require a running Metro server. Development profile remains available for developer testing.
- EAS preview has only the two public Supabase settings, copied from the already saved environment. Server keys and EXPO_TOKEN are not app configuration.
- Android signing keystore was created and stored on Expo's credential service. No signing value was printed or committed.
- Native email confirmation/recovery/sign-in callbacks accept the current app callback, including Expo Go and PKCE. Sessions refresh while the app is active; account switching preserves device/account separation. Delayed startup events cannot overwrite a later sign-in or logout, and installed development/preview apps use the stable homiesos callback even when connected to Metro.
- Keyboard handling, long labels, native TXT import and foreground local task reminders improved. Existing mobile navigation, photo carousel editing/export and captions preserved.

## Current installation status

Build permission is now available. The Expo API currently identifies the robot's role as ADMIN (broader than the Developer role required for builds). Before the first build attempt the account was on Free, with 0 of 30 included build credits used and no overage. No paid action was authorized or taken.

The first Android preview attempt stopped before it could queue: the cloud environment proxy rejected the source upload to `storage.googleapis.com` with HTTP 403. Native credentials and public app settings succeeded. An installable APK does not exist from that attempt, so there is no installation link yet.

In Codex environment settings, retain existing domains and add `storage.googleapis.com` (EAS source upload), `expo.dev` (installation-link checks), `exp.host` (Expo config schema) and `reactnative.directory` (compatibility metadata). Apply the configuration. This changes the supported allowlist; it does not disable the proxy or TLS checks.

## iPhone testing

The current Apple App Store Expo Go stops at SDK 54. Homies uses SDK 57, so it cannot run in that iPhone app. Official Expo version metadata includes an SDK 57 client for Android and an iOS simulator archive; those do not establish an installable App Store client for a physical iPhone. Reference: https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/ . A tunnel or hosted JavaScript update does not remove this native version requirement.

Use a signed internal Homies OS iOS preview build. It requires an existing Apple Developer Program membership and registering the iPhone for internal distribution. Membership itself is paid; no purchase is authorized. Credentials must be entered through Expo/Apple's secure signing flow, never in chat or GitHub. An internal preview does not submit to the App Store. A simulator build cannot be installed on an iPhone. No iOS build or store submission was started.

Android has an SDK 57-compatible Expo Go download, and the app's native modules are included in that client. An Android preview APK is the simpler standalone route and tests native callback ownership/reminders. Expo's supported tunnel command rejected the robot identity with `Cannot use ngrok with a robot user`. No tunnel was established or externally verified; localhost is not a phone link. A personal Expo token would address the robot restriction, but would not make this SDK run in iPhone App Store Expo Go.

## Email links: one dashboard change

Open https://supabase.com/dashboard/project/jnuaexajxrudalbcxcii/auth/url-configuration . Under Authentication → URL Configuration → Redirect URLs, add:

- `homiesos://profile`
- `https://dasvidaniya.vercel.app/profile`

Keep the existing website redirects and Site URL. Press Save. Use a newly requested confirmation/recovery email; existing emails retain their original destination. For Expo Go email tests, add the exact current `exp://<reachable-tunnel>/--/profile` address once a working tunnel exists. Do not add a broad wildcard just to make testing easier. Custom email templates must retain Supabase's `{{ .ConfirmationURL }}`.

## When the Android install link is available

1. Open the actual installation link on your Android phone and download the APK.
2. If Android asks, allow this browser to install unknown apps, then tap Install. You can turn that permission off afterward.
3. Open Homies OS. Start with local tasks/habits, then sign in to use your account workspace. Local sandbox records remain separate.
4. Confirm a new email link, close/reopen the app, check the session, and sign out. Create a short test task with a reminder, grant notification permission, and check it both while the app is open and while it is closed.

## Photo and caption test

Open Workspace → Content Studio. The native picker opens Files. On iPhone, use Photos → select two screenshots → Share → Save to Files; screenshots avoid HEIC compatibility problems. Choose these PNGs, order them, and use Prepare with AI only after signing in. Preparing sends photo previews to the configured provider and uses the existing AI request budget; no provider call was made by this setup work. Review/edit the slides and captions, then share/download the ZIP before leaving the page.

JPEG, PNG and WebP are supported. HEIC must be converted to JPEG. Photos/slide images stay in page memory; saved drafts preserve text/captions. Camera capture, card recognition and automatic social publishing are not implemented. Native ZIP sharing and notification delivery still require physical-phone testing.

## Verification and boundaries

TypeScript passed. All 68 unit/database/provider/carousel/auth/notification tests passed, including focused notification revalidation. Native Android/iOS Hermes exports and both native prebuilds succeeded. The web production export succeeded locally. Existing browser workflows passed across the broad and focused reruns (36 workflows plus the two corrected confirmation/recovery checks). Browser cloud tests mock authenticated responses; they do not establish a real user's signed-in backend success.

Supabase's real auth settings allow email signup and require confirmation. Anonymous requests to account records and carousel return 401. This is an authentication boundary check, not a complete production security audit.

Expo install compatibility passes. Expo Doctor initially passed 19/21 checks; its schema and React Native Directory requests were unavailable under the restricted policy. These checks are not falsely marked passed.

No database migration, Edge Function deployment, website deployment, or store submission was performed. Branch-specific Vercel Git deployments are disabled for `setup/expo-project` so saving PR #2 does not publish a website. Other branches retain their existing deployment behavior.

## Maintainer commands after access is available

```sh
npm ci
npx expo install --check
npx expo-doctor
npx eas-cli project:info
npx eas-cli build --profile preview --platform android
npx expo start --go --tunnel
```

On this managed workspace the home directory is read-only. Use workspace npm/Expo/DevTools caches and network-enabled command access while preserving the inherited proxy and CA trust. The snapshot has no writable Git history; EAS_NO_VCS=1 with EAS_PROJECT_ROOT=/workspace/dasvidaniya was used for its archive/build attempt. GitHub updates preserve the real PR parent/tree rather than replacing it with that empty local history.
