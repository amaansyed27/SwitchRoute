# Local development on Windows

Use PowerShell from the repository root. Normal product testing uses a hosted Supabase project; Docker is only needed when deliberately running the database/RLS test stack locally.

## 1. Configure hosted Supabase

In Supabase **Authentication → URL Configuration**, allow:

- Site URL: `http://localhost:3000` while testing locally
- Redirect URL: `http://localhost:3000/auth/callback`
- Redirect URL: `http://localhost:3000/auth/callback?next=/onboarding`
- Redirect URL: `http://localhost:3000/auth/confirm?next=/onboarding`
- Optional equivalents using `http://127.0.0.1:3000`

### Email magic-link templates

SwitchRoute uses Supabase SSR cookies. Email links therefore verify a token hash on the server instead of relying on a PKCE verifier surviving the trip through the mail client.

In **Authentication → Email Templates**, update both **Confirm signup** and **Magic Link** so the link uses the redirect supplied by SwitchRoute and appends the token hash:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Continue to SwitchRoute</a>
```

SwitchRoute supplies `/auth/confirm?next=/onboarding` as `.RedirectTo`, so this works for localhost now and for the production origin later without hard-coding either hostname into the email template.

OAuth providers still return through `/auth/callback`; email authentication returns through `/auth/confirm`.

Copy `.env.example` to `.env`, then replace the Gateway values with the hosted project URL, publishable key, and the **Session Pooler** database connection string. Keep `sslmode=require` on the hosted database URL.

Create `apps/web/.env.local` and copy only the Web block from `.env.example` into it.

Generate local encryption material with Python 3.12:

```powershell
py -3.12 -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
py -3.12 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use the first output as `SWITCHROUTE_SECRET_KEY` and the second as `SWITCHROUTE_KEY_PEPPER`. Never commit either env file.

## 2. Install dependencies

```powershell
npm install
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".\services\gateway[dev]"
```

## 3. Run the gateway

With the Python virtual environment active:

```powershell
python -m uvicorn switchroute.main:app --app-dir services/gateway/src --reload --port 8000
```

Gateway: `http://localhost:8000`

## 4. Run the web app

Open a second PowerShell window in the repository root:

```powershell
npm run dev:web
```

Web: `http://localhost:3000`

Email magic-link auth works with hosted Supabase after the local URLs and token-hash email templates above are configured. GitHub and Google buttons additionally require those OAuth providers to be configured in the Supabase dashboard.

## Optional: database/RLS tests locally

This is a CI/database-development workflow, not required for normal product testing:

```powershell
supabase start
supabase test db
supabase stop
```

It requires Docker and downloads the Supabase local stack.
