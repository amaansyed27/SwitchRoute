"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import type {
  ModelOption,
  ProviderCatalogEntry,
  ProviderConnection,
} from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

export function ProviderConnectForm({
  provider,
  onConnected,
}: {
  provider: ProviderCatalogEntry;
  onConnected: (provider: ProviderConnection) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState(provider.display_name);
  const [baseUrl, setBaseUrl] = useState("");
  const [discoverModels, setDiscoverModels] = useState(true);
  const [manualModelId, setManualModelId] = useState("");
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function body() {
    const connection = provider.requires_base_url
      ? {
          base_url: baseUrl.trim(),
          discover_models: discoverModels,
          manual_model_id: manualModelId.trim() || undefined,
        }
      : undefined;
    return { provider_kind: provider.id, api_key: key, connection };
  }

  function invalidate() {
    setModels(null);
    setError(null);
  }

  async function test(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setModels(null);
    try {
      const result = await manageFetch<{ models: ModelOption[] }>("providers/validate", {
        method: "POST",
        body: JSON.stringify(body()),
      });
      setModels(result.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!models) return;
    setBusy(true);
    setError(null);
    try {
      const providerConnection = await manageFetch<ProviderConnection>("providers", {
        method: "POST",
        body: JSON.stringify({ ...body(), display_name: name.trim() }),
      });
      setKey("");
      onConnected(providerConnection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const customReady =
    !provider.requires_base_url ||
    (baseUrl.trim().length > 0 && (discoverModels || manualModelId.trim().length > 0));

  return (
    <form onSubmit={test} className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-xs font-semibold">
          {provider.mark}
        </span>
        <div>
          <strong className="block text-sm">{provider.display_name}</strong>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            {provider.description}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Field label="Connection name" htmlFor="provider-name">
          <Input
            id="provider-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {provider.requires_base_url && (
          <>
            <Field
              label="Base URL"
              htmlFor="provider-base-url"
              hint="Public HTTPS only. Localhost, private networks, link-local and cloud metadata addresses are rejected."
            >
              <Input
                id="provider-base-url"
                type="url"
                required
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  invalidate();
                }}
                placeholder="https://api.example.com/v1"
              />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={discoverModels}
                onChange={(event) => {
                  setDiscoverModels(event.target.checked);
                  invalidate();
                }}
              />
              <span>
                <strong className="block font-medium">Discover models automatically</strong>
                <span className="text-xs text-[var(--muted-foreground)]">
                  SwitchRoute calls the endpoint&apos;s /models route when available.
                </span>
              </span>
            </label>
            <Field
              label={discoverModels ? "Manual model ID fallback" : "Manual model ID"}
              htmlFor="provider-manual-model"
              hint={
                discoverModels
                  ? "Optional. Used when /models is unavailable."
                  : "Required when discovery is disabled."
              }
            >
              <Input
                id="provider-manual-model"
                required={!discoverModels}
                value={manualModelId}
                onChange={(event) => {
                  setManualModelId(event.target.value);
                  invalidate();
                }}
                placeholder="model-id"
              />
            </Field>
          </>
        )}
        <Field
          label="API key"
          htmlFor="provider-key"
          hint={
            provider.requires_base_url
              ? "Validated with a fixed one-token compatibility probe, then encrypted. No user prompt is used or retained."
              : "The key is validated first, then encrypted. It is never returned to the browser after save."
          }
        >
          <Input
            id="provider-key"
            type="password"
            required
            autoComplete="off"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              invalidate();
            }}
            placeholder={`Paste ${provider.display_name} API key`}
          />
        </Field>
      </div>

      {error && <Alert>{error}</Alert>}
      {models && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/7 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Icon name="check" className="size-4" />Credential validated · {models.length} model
            {models.length === 1 ? "" : "s"}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {models.slice(0, 8).map((model) => (
              <Badge key={model.id}>{model.name}</Badge>
            ))}
            {models.length > 8 && <Badge>+{models.length - 8}</Badge>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || key.length < 3 || !customReady}
        >
          {busy && !models ? "Testing…" : "Test credential"}
        </Button>
        <Button type="button" disabled={busy || !models || !name.trim()} onClick={save}>
          {busy && models ? "Saving…" : "Save connection"}
        </Button>
      </div>
    </form>
  );
}
