# Homies OS app updates

The existing Expo project now supports EAS Update. Android 0.1.2 (version code 3) is the first native build with the update engine. Install that APK over the existing Homies OS installation once. Older APKs cannot gain the update engine through an online update.

## Updating on your phone

With internet access, the app checks for updates when it starts from a closed state. A compatible update downloads in the background and applies on the next cold start. Opening the app from the background is not necessarily a cold start.

For a manual check, open **Profile → App updates → Check for updates**. When a download is ready, finish or save your work and tap **Restart to update**. Downloading does not force a restart. The app remains usable offline with its embedded or last successfully installed code. The website receives changes through its separate website deployment process.

App updates can deliver compatible screens, text, styles, behavior and assets. Adding native libraries, changing the Expo SDK, permissions, native settings, launcher icons or signing configuration still requires a new APK. Future Google Play distribution can provide those native replacements through the store, but no store release has been made.

## Maintainer release process

Reuse `@andravads/ads-assistant`, project `64949f00-07a2-4515-a279-64d90ff38443`. The `preview` build uses the `preview` channel and `preview` environment. Update URL: `https://u.expo.dev/64949f00-07a2-4515-a279-64d90ff38443`.

The fingerprint runtime policy derives compatibility from native dependencies/configuration. An update is eligible only when its platform, channel mapping and runtime match the installed build. Do not override a runtime to force an incompatible release. Check native fingerprint differences before deciding whether an APK is necessary. The 0.1.2 Android build's runtime is `c33dfa84e1be9348a443e87d0c2023d2a55b3318`; the permitted local resolver matches it.

Before publication:

1. Verify the intended source, TypeScript, relevant tests and native export. Keep server keys out of app configuration and bundles.
2. Check `eas account:usage andravads --json --non-interactive` and remain within the included allowance; no paid upgrade or purchase is authorized.
3. Publish Android only, using the same EAS environment as the build:

   ```sh
   eas update --platform android --channel preview --environment preview --message "Describe the change" --non-interactive
   ```

4. Check the reported update runtime against the build runtime and inspect the channel/branch mapping. Test **Check for updates → Restart to update** on a phone, then confirm session and task persistence.

SDK 55 and later require the explicit update environment. This project stores only its two public Supabase settings in EAS preview; `OPENAI_API_KEY` remains in Supabase server secrets. Updating that server key requires neither an APK nor an EAS update.

In this managed Codex workspace, run Expo/EAS verification commands with supported additional network permission and the documented cache/proxy environment from [phone setup](EXPO-SETUP.md). The default sandbox blocks local socket shutdown used by child-process stdin; autolinking can silently return an incomplete fingerprint. The permitted resolver includes 106 sources and matches the build. Never use a mismatching fingerprint to publish an update.

If native compatibility changes, increment the Android version code and create a new preview APK using the existing keystore. Keep development, preview and production channels separate. A release still requires an explicit maintainer publication; saving a GitHub commit does not publish an app update. Website Git deployment remains disabled for this PR branch.

## Verification limits

The update controls are covered with mocked lifecycle tests. Native configuration is inspected separately, and EAS build/update metadata establish packaging and publication status. Physical installation, download/restart behavior and persistence remain phone checks until explicitly confirmed. This cloud environment needs `update-assets-upload-production.storage.googleapis.com` for EAS update asset uploads, `u.expo.dev` for manifest inspection and `wf-artifacts.eascdn.net` for APK download. The parent `storage.googleapis.com` allowlist entry does not cover that upload subdomain. Keep the supported proxy and TLS verification; do not bypass the network policy.

Official references: https://docs.expo.dev/eas-update/getting-started/ , https://docs.expo.dev/eas-update/runtime-versions/ , https://docs.expo.dev/eas-update/download-updates/ and https://docs.expo.dev/versions/v57.0.0/sdk/updates/ .
