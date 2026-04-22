import { useEffect, useState } from "react";
import {
  getApiKey,
  setApiKey,
  clearApiKey,
  getModel,
  setModel,
  getBackend,
  setBackend,
  MODELS,
  type ModelId,
  type Backend,
} from "../lib/storage";
import { bridgeHealthy } from "../lib/claude";

export default function ApiKeyBar() {
  const [backend, setBackendState] = useState<Backend>("cli");
  const [bridgeUp, setBridgeUp] = useState<boolean | null>(null);
  const [key, setKey] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [model, setModelState] = useState<ModelId>("claude-opus-4-7");
  const [editing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    setBackendState(getBackend());
    setHasKey(Boolean(getApiKey()));
    setModelState(getModel());
    bridgeHealthy().then(setBridgeUp);
  }, []);

  function saveKey() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setHasKey(true);
    setEditing(false);
    setKey("");
  }

  function clear() {
    clearApiKey();
    setHasKey(false);
  }

  function onModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ModelId;
    setModel(next);
    setModelState(next);
  }

  function onBackendChange(next: Backend) {
    setBackend(next);
    setBackendState(next);
  }

  return (
    <div className="border-b border-ink/10 bg-paper/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex rounded border border-ink/20 overflow-hidden">
          <button
            onClick={() => onBackendChange("cli")}
            className={`px-3 py-1 font-mono text-xs ${
              backend === "cli" ? "bg-ink text-paper" : "bg-white text-ink/60 hover:text-ink"
            }`}
          >
            CLI
          </button>
          <button
            onClick={() => onBackendChange("api")}
            className={`px-3 py-1 font-mono text-xs border-l border-ink/20 ${
              backend === "api" ? "bg-ink text-paper" : "bg-white text-ink/60 hover:text-ink"
            }`}
          >
            API
          </button>
        </div>

        {backend === "cli" ? (
          <span className="font-mono text-xs text-ink/60">
            via local <code className="text-accent">claude</code> CLI{" "}
            {bridgeUp === null ? (
              <span className="text-ink/40">(checking…)</span>
            ) : bridgeUp ? (
              <span className="text-green-700">●</span>
            ) : (
              <span className="text-red-700">● bridge offline — run `npm run dev`</span>
            )}
          </span>
        ) : (
          <>
            <span className="font-mono text-ink/60 text-xs">API key:</span>
            {hasKey && !editing ? (
              <>
                <span className="text-green-700 font-mono text-xs">•••• stored</span>
                <button onClick={() => setEditing(true)} className="underline text-ink/60 hover:text-ink text-xs">
                  change
                </button>
                <button onClick={clear} className="underline text-ink/60 hover:text-ink text-xs">
                  clear
                </button>
              </>
            ) : (
              <>
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="border border-ink/20 rounded px-2 py-1 font-mono text-xs w-56 bg-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveKey();
                  }}
                />
                <button
                  onClick={saveKey}
                  className="bg-ink text-paper px-3 py-1 rounded text-xs hover:bg-ink/80 disabled:opacity-50"
                  disabled={!key.trim()}
                >
                  save
                </button>
                {hasKey && (
                  <button onClick={() => setEditing(false)} className="underline text-ink/60 hover:text-ink text-xs">
                    cancel
                  </button>
                )}
              </>
            )}
          </>
        )}

        <span className="ml-auto flex items-center gap-2">
          <span className="font-mono text-ink/60 text-xs">model:</span>
          <select
            value={model}
            onChange={onModelChange}
            className="border border-ink/20 rounded px-2 py-1 font-mono text-xs bg-white"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      {backend === "api" && !hasKey && (
        <div className="bg-amber-50 border-t border-amber-200 text-amber-900 text-xs px-4 py-2 max-w-5xl mx-auto">
          <strong>Heads up:</strong> in API mode your key is stored in <code className="font-mono">localStorage</code>{" "}
          and sent directly from the browser to Anthropic. Any script on this page could read it.
        </div>
      )}
    </div>
  );
}
