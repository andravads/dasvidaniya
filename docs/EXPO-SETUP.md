# Expo setup — 13 October 2026

The existing Homies app is already an Expo SDK 57 project. Its prepared Expo slug
is `ads-assistant`, with the supplied EAS project ID
`64949f00-07a2-4515-a279-64d90ff38443` in `app.json`. Its visible app name remains
Homies OS. Creating a new `ads-assistant` starter would omit the existing app.

## Verified locally

`expo config --type public` resolves the slug, supplied project ID, app identifiers
and plugins. Strict TypeScript passes. The Expo development server started in this
workspace; its `/status` endpoint returns 200 `packager-status:running`.

This is local configuration, not verification of ownership or access to the EAS
project. No Expo account has been authenticated, no signing credentials have been
created, and no native cloud build or store submission has been started.

## Remaining environment setup

The environment currently allows only the Supabase hostname. Add
`registry.npmjs.org` and `api.expo.dev` to its allowed domains and apply the
configuration. These are needed to install EAS CLI and access the Expo API.

Create an Expo access token from your account's **Settings → Access tokens**, then
save it securely in the Codex environment's **Secrets** under `EXPO_TOKEN`.
Do not put it in chat, `app.json`, a public environment variable, or GitHub source.
The token has not been supplied or inspected here.

Once access is ready, run EAS initialization and project information checks using
the supplied project ID. Confirm the actual project slug and owner, and align the
local slug with the server if needed. Adding a UUID to a config file alone does
not establish an authenticated EAS link.

The requested `codex plugin add expo@openai-curated` command was attempted and
returned `plugin expo was not found in marketplace openai-curated` in this
environment. Plugin directory search and the install suggestion could not resolve
it either. The plugin is not installed. Normal Expo/EAS tooling remains the
fallback; the missing plugin does not require rebuilding the app.

## Starting from your own computer

Use this repository rather than generating a fresh app. With Node.js 24 and your
Expo account available, the ordinary setup commands are:

```sh
npm ci
npx eas-cli@latest login
npx eas-cli@latest init --id 64949f00-07a2-4515-a279-64d90ff38443
npx eas-cli@latest project:info
npx expo start
```

The server running inside Codex is a cloud development server. Its localhost QR
address is not reachable from a separate phone. To scan a development QR code,
run Expo on a computer reachable from the phone, or configure a supported tunnel.
A phone-installable build is a separate next step.

## Native build profiles

`eas.json` already has an Android **preview** profile producing an APK, plus
development and production profiles. The development profile requires installing
the SDK-compatible `expo-dev-client` package before a development build. That
package has not been installed. Existing bundle identifiers are starter values;
confirm final ownership and identifiers before store release. iPhone physical
device builds also require Apple's signing/distribution setup.

Before testing native email links, add `homiesos://profile` to Supabase's Redirect
URLs. Browser and Supabase deployments do not need to be rebuilt for EAS account
verification. Physical devices, Expo Go compatibility and native signing remain
unverified.
