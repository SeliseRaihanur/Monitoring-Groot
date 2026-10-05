import { useState } from "react";
import type { FormEvent } from "react";
import { ActionButton } from "../../shared/ui/ActionButton";
import { createService } from "./api";

async function hashIngestKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function RegisterServiceForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("dev");
  const [owner, setOwner] = useState("");
  const [oneTimeKey, setOneTimeKey] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const key = randomKey();
    try {
      await createService({
        name,
        environment,
        owner,
        sloLatencyMs: 500,
        sloErrorRate: 0.05,
        ingestKeyHash: await hashIngestKey(key),
        ingestKeyId: key.slice(0, 8),
        otlpEndpointHint: "http://127.0.0.1:4318"
      });
      setOneTimeKey(key);
      setName("");
      onCreated();
    } catch {
      setError("Could not register the service.");
    }
  }

  return (
    <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
      <label className="form-field">
        <span>Name</span>
        <input required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="form-field">
        <span>Environment</span>
        <input required value={environment} onChange={(event) => setEnvironment(event.target.value)} />
      </label>
      <label className="form-field">
        <span>Owning team</span>
        <input value={owner} onChange={(event) => setOwner(event.target.value)} />
      </label>
      <div className="form-actions">
        <ActionButton type="submit">Register service</ActionButton>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {oneTimeKey ? <p>Ingest key (shown once): <code>{oneTimeKey}</code></p> : null}
    </form>
  );
}
