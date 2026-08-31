# ADR 0001: Cloud Core boundaries

Status: Accepted

SwitchRoute uses Next.js App Router for the product UI, FastAPI for the gateway, LiteLLM for provider request normalization, and Supabase Auth/Postgres for identity and durable state.

The gateway—not LiteLLM—owns virtual keys, Route semantics, candidate ordering, secret handling, fallback policy, usage retention and errors. This prevents provider-normalization infrastructure from becoming the product domain model.
