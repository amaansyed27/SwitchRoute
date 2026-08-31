# Vercel deployment topology

SwitchRoute uses two Vercel projects from the same repository so the public boundaries stay independent:

- Web project root: `apps/web` → intended `switchroute.dawnlightlabs.com`
- Gateway project root: `services/gateway` → intended `api.switchroute.dawnlightlabs.com`

The gateway exposes a recognized root `main.py`; current Vercel FastAPI detection serves the whole ASGI app as one Fluid-compute function without redirect configuration.

Use Git integration for preview deployments on branches. Configure production environment variables separately in each project. Do not expose `SUPABASE_DB_URL`, `SWITCHROUTE_SECRET_KEY`, or `SWITCHROUTE_KEY_PEPPER` to the web project.

Production custom domains are intentionally not attached by Slice 1. Add them only after preview verification and Supabase redirect/CORS values are updated.
