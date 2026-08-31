# Local development on Windows

Use PowerShell from the repository root.

```powershell
Copy-Item .env.example .env
supabase start
npm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".\services\gateway[dev]"
python -m uvicorn switchroute.main:app --app-dir services/gateway/src --reload --port 8000
```

Open a second PowerShell window:

```powershell
npm run dev:web
```

Local web: `http://localhost:3000`. Local gateway: `http://localhost:8000`.

Before manual provider testing, configure GitHub/Google OAuth in Supabase if desired and add real Groq/Gemini/OpenRouter keys through the product UI. Email magic-link auth works once the Supabase Auth redirect URLs are configured.
