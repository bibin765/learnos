import { useEffect, useState } from "react";
import { getApiKey, setApiKey, clearApiKey, getModel, setModel, MODELS, type ModelId } from "../lib/storage";

export default function ApiKeyBar() {
  const [key, setKey] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [model, setModelState] = useState<ModelId>("claude-opus-4-7");
  const [editing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    const existing = getApiKey();
    setHasKey(Boolean(existing));
    setModelState(getModel());
  }, []);

  function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setHasKey(true);
    setEditing(false);
    setKey("");
  }

  function remove() {
    clearApiKey();
    setHasKey(false);
  }

  function onModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ModelId;
    setModel(next);
    setModelState(next);
  }

  return (
    <div className="border-b border-ink/10 bg-paper/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-mono text-ink/60">API key:</span>
        {hasKey && !editing ? (
          <>
            <span className="text-green-700 font-mono">•••• stored</span>
            <button onClick={() => setEditing(true)} className="underline text-ink/60 hover:text-ink">
              change
            </button>
            <button onClick={remove} className="underline text-ink/60 hover:text-ink">
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
                if (e.key === "Enter") save();
              }}
            />
            <button
              onClick={save}
              className="bg-ink text-paper px-3 py-1 rounded text-xs hover:bg-ink/80 disabled:opacity-50"
              disabled={!key.trim()}
            >
              save
            </button>
            {hasKey && (
              <button onClick={() => setEditing(false)} className="underline text-ink/60 hover:text-ink">
                cancel
              </button>
            )}
          </>
        )}
        <span className="ml-auto flex items-center gap-2">
          <span className="font-mono text-ink/60">model:</span>
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
      {!hasKey && (
        <div className="bg-amber-50 border-t border-amber-200 text-amber-900 text-xs px-4 py-2 max-w-5xl mx-auto">
          <strong>Heads up:</strong> your key is stored in <code className="font-mono">localStorage</code> and sent
          directly from the browser to Anthropic. Any script on this page could read it — treat these keys as
          disposable.
        </div>
      )}
    </div>
  );
}
