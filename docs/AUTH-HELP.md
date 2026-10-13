# Sign-in and AI troubleshooting — 13 October 2026

## Current account status

The user reported that Android sign-in succeeds after setting a new password in the already signed-in website session. The native callback `homiesos://profile` is now listed exactly in Supabase's redirect allowlist. Opening a newly requested Android email link still needs a physical-phone check; old emails keep their original destination.

The source fixes are saved in commit `3d3ae233de15a7bf18e1f280b17aa9d9fa41dc45`. Android version 0.1.1, version code 2, is being built in the existing Expo project. Keep PR #2 a draft until the remaining phone checks are complete.

## Choose the correct account action

| Action | What to enter | Expected behavior |
| --- | --- | --- |
| Email me a sign-in link | Your existing account's email | Requests a one-use email link; no password is needed. Open the newest link on that device. |
| Sign in | Email and existing password | Signs in with the password. It does not send a login email. |
| Create account | A new account's email and a password of at least eight characters | Requests account creation and confirmation when needed. It does not reset an existing account's password. |
| Request password reset | Your existing email | Requests a reset link. Open the newest link, then set a new password in Profile. |

For privacy, Supabase may accept a sign-up request for an already registered address without creating another account or sending another confirmation email. An accepted request is not proof of email delivery. The updated messages explain this without revealing whether an address belongs to an account.

If a confirmation link already opens the website signed in, use **Profile → New password → Update password** there, then use the new password in Android. Keep passwords and email-link URLs private.

Version 0.1.1 allows existing passwords shorter than eight characters to be submitted to the server; new account and password-update forms still require at least eight characters. The email-link button is shown before the password field.

## Email links should return to the requesting app

Open https://supabase.com/dashboard/project/jnuaexajxrudalbcxcii/auth/url-configuration . Keep the website Site URL and existing redirects, and include these exact entries:

- `homiesos://profile`
- `https://dasvidaniya.vercel.app/profile`

Request a fresh link from Android using **Email me a sign-in link**. A link requested from the website is expected to return to the website. Custom email templates must preserve the supported Supabase confirmation URL instead of hardcoding a website address. A redirect change does not change passwords or fix missing email delivery.

## If an email never arrives

Check inbox and spam, use the newest email, and avoid repeatedly pressing sign-up/resend. Check the app's message for a confirmation requirement, invalid credentials, email delivery restriction or request limit.

The app owner can inspect **Authentication → Users**, **Auth logs**, **Email/SMTP** and **Rate Limits** in the Supabase dashboard. Share only an error code/status/message; never share passwords, API keys or complete email links.

Supabase's documented built-in mail service is restricted to organization-team addresses and currently permits only two emails per hour per project. These are default service limits, not a verified observation of this project's SMTP setup. A properly configured custom mail provider is needed for general-user delivery. Changing to a paid provider requires approval. Keep email confirmation enabled.

Official guidance: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/rate-limits .

## OpenAI 429: no credits remaining

An error that explicitly says **OpenAI 429** and **no credits/quota remaining** comes from the configured OpenAI API account. It is separate from password login, Supabase email delivery, Expo's free build allowance and a ChatGPT subscription. The current server code passes the provider's error message through to the app.

Check https://platform.openai.com/settings/organization/billing/overview for the API organization/project whose key is stored securely as `OPENAI_API_KEY` in Supabase's Edge Function secrets. Confirm usable API credits and billing/quota. If funds are available, check that the server key belongs to the intended API project; replace it only through the secure Supabase dashboard if needed. Never put a provider key in `EXPO_PUBLIC` settings or chat.

Adding API funds is a paid action and requires the user's decision. No funds, paid limit changes, provider calls or new keys were made by this diagnostic work. Avoid retrying AI requests until the funding/quota problem is resolved. Tasks, habits and manual draft editing remain available. Cloud chat, caption/photo AI and document indexing need usable provider quota. A request-rate 429 is different from an explicit insufficient-credit error.

## Checks and limits

- TypeScript, 86 unit tests, 16 focused auth browser checks and the final 52-workflow browser suite passed. Authenticated browser responses are mocked; native email callback checks use test clients.
- Final Android and iOS Hermes exports passed. The user independently confirmed actual Android password sign-in after updating the password.
- One existing mobile task-completion browser check failed initially, then passed three isolated repeats and the full suite rerun without code changes.
- No database migration, Edge Function or website deployment, real email send, account creation or billable provider request was made by the assistant. The user performed the password and redirect changes securely.
- Physical email-link opening, session restart/refresh, sync, photo export/sharing and reminders remain phone checks. APK binary/signature inspection still requires the artifact CDN host to be allowed in the cloud environment.
