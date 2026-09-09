# UI and routing acceptance checklist

Use a disposable Route and test key for changes. A test key is a naming/environment distinction; it does not make paid provider calls free. Keep paid fallback disabled for the initial pass.

## Appearance and navigation

- [ ] Open the landing page at desktop and phone widths. No horizontal page scroll, clipped copy, or overlapping controls.
- [ ] Check light, dark, and system themes. Text, inputs, status badges, and focused controls remain readable.
- [ ] Hover and press primary buttons: a small lift and press response, without jitter or layout shifts. Links and sidebar items transition smoothly.
- [ ] Scroll through the landing page: sections enter once, and the waterfall illustration appears in order. Text stays readable while loading.
- [ ] Navigate between Overview, Providers, Waterfalls, API keys, Activity, and Docs. Page entries are brief; navigation and data loading remain responsive.
- [ ] Enable reduced motion in your OS/browser and reload. Movement is suppressed, content and controls remain available.
- [ ] Use Tab, Shift+Tab, Enter, and Escape. Focus is visible; drawers trap focus, close with Escape, and return focus to their opener.
- [ ] On a phone, verify bottom navigation does not cover content and drawer actions remain reachable. Expand and collapse the Docs menu.

## Authentication

- [ ] Create an account, confirm its email, and sign in. Verify the confirmation returns to the correct deployment.
- [ ] Test secure email link, password sign-in, and password reset with your own account.
- [ ] Switch auth methods before submitting. Email persists, correct fields appear, and the heading transitions without losing keyboard access.
- [ ] Check an invalid password and expired link: a readable error appears, and retry works.
- [ ] Sign out, then reload a protected URL. It redirects to sign-in.

## Providers and waterfalls

- [ ] Connect a provider with a valid key. Confirm its account name and discovered models appear; stored plaintext credentials never reappear.
- [ ] Try an invalid credential and recover. Search the provider catalog, including a query with no matches.
- [ ] Connect two accounts for one provider and confirm they remain separately selectable.
- [ ] Create a waterfall. Search models and filter billing types. Paid, free, account-dependent, and unverified prices must remain distinct.
- [ ] Check that missing price data is not shown as free. Refresh older provider metadata if it predates the pricing correction.
- [ ] Add, reorder, and remove targets. Save and reopen: provider, model, and exact order persist.
- [ ] A blank model prevents saving. A new waterfall blocks paid fallback by default; existing spending settings are preserved.
- [ ] With paid fallback blocked, a paid or unverified target must not produce an unexpected billable request. Verify the provider account usage as well as SwitchRoute activity.
- [ ] Using disposable test targets, make the primary unavailable before streaming begins. An eligible backup is used; no response combines output from two models.

## Keys, activity, and loading

- [ ] Create a key bound to the test waterfall. Copy it once, reload, and confirm only its safe prefix is visible. Revoke it and confirm subsequent requests fail.
- [ ] Make one non-streaming and one streaming request through an OpenAI client using that key and the documented gateway URL.
- [ ] Check Activity for model, provider account, timing, outcome, cost estimate, and fallback details. Prompt and completion content must not appear.
- [ ] Filter by success/error and search by model or waterfall. No-match state and clear/reset behavior are understandable.
- [ ] Try slow network and temporary offline mode. Loading feedback appears, controls do not submit duplicates, and retry recovers.
- [ ] Run mobile Lighthouse against the deployed production build for landing, login, and an authenticated page. Record performance, accessibility, LCP, CLS, and INP separately from development-server timings.

## Verification boundary

Automated web and gateway tests cover the changed behavior. Landing, signup mode switching, documentation disclosure, responsive geometry, and browser console were checked locally. Real signed-in provider, waterfall, key, billing, and activity acceptance remains the account owner's checklist above. Redis-dependent tests require the integration environment; database/RLS tests require the Supabase test stack.
