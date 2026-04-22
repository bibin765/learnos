import { useEffect, useState } from "react";
import { clearUsage, getUsage, USAGE_EVENT, type Usage } from "../lib/storage";

export default function TokenCounter() {
  const [usage, setUsage] = useState<Usage>(() => getUsage());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUsage(getUsage());

    function onUpdate(e: Event) {
      const ce = e as CustomEvent<Usage>;
      setUsage(ce.detail ?? getUsage());
    }
    window.addEventListener(USAGE_EVENT, onUpdate);
    return () => window.removeEventListener(USAGE_EVENT, onUpdate);
  }, []);

  function reset() {
    if (!confirm("Reset token counter?")) return;
    clearUsage();
    setOpen(false);
  }

  const cacheRead = usage.cache_read_input_tokens;
  const hasCache = cacheRead > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-xs text-ink/70 hover:text-ink border border-ink/15 rounded px-2 py-1 bg-white"
        title="Click for details"
      >
        <span className="text-ink/50">↓</span> {fmt(usage.input_tokens)}{" "}
        <span className="text-ink/50">↑</span> {fmt(usage.output_tokens)}
        {hasCache && (
          <span className="ml-1 text-green-700" title="cache hits">
            ◎ {fmt(cacheRead)}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 bg-white border border-ink/15 rounded shadow-lg text-xs font-mono z-20"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 border-b border-ink/10 text-ink/60">
            Usage ({usage.runs} run{usage.runs === 1 ? "" : "s"})
          </div>
          <dl className="px-3 py-2 space-y-1">
            <Row label="input" value={usage.input_tokens} />
            <Row label="output" value={usage.output_tokens} />
            <Row label="cache read" value={usage.cache_read_input_tokens} />
            <Row label="cache write" value={usage.cache_creation_input_tokens} />
            {usage.cost_usd > 0 && (
              <Row label="cost" value={`$${usage.cost_usd.toFixed(4)}`} />
            )}
          </dl>
          <div className="px-3 py-2 border-t border-ink/10 flex justify-between items-center">
            <span className="text-ink/40">cumulative, this browser</span>
            <button onClick={reset} className="underline hover:text-ink">
              reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink/60">{label}</dt>
      <dd className="tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</dd>
    </div>
  );
}

function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1) + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  return (n / 1_000_000).toFixed(1) + "M";
}
