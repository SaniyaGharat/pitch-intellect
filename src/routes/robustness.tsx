import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Metric, Panel, PageHeader } from "@/components/Panel";
import { Disclaimer } from "./counterfactual";
import { buildFrame, candidatesFor, type Player } from "@/lib/data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/robustness")({
  head: () => ({
    meta: [
      { title: "Decision Robustness — Ball-Free Game State Reconstruction" },
      {
        name: "description",
        content:
          "Perturbation study of counterfactual option ranking: top-1/top-3 retention, Spearman and Kendall correlation, decision flip rate.",
      },
      { property: "og:title", content: "Decision Robustness — Ball-Free Game State Reconstruction" },
      {
        property: "og:description",
        content: "Rank retention and flip rate under coordinate jitter, dropout and availability noise.",
      },
    ],
  }),
  component: Robustness,
});

function perturb(players: Player[], jitter: number, dropout: number, availability: number, seed: number) {
  let s = seed * 2654435761;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return players
    .filter((p, i) => i < 1 || rnd() > dropout)
    .map((p) => ({
      ...p,
      x: p.x + (rnd() - 0.5) * 2 * jitter,
      y: p.y + (rnd() - 0.5) * 2 * jitter,
      vx: p.vx * (1 + (rnd() - 0.5) * availability),
      vy: p.vy * (1 + (rnd() - 0.5) * availability),
    }));
}

function spearman(a: string[], b: string[]) {
  const n = a.length;
  if (n < 2) return 0;
  const rankB = new Map(b.map((id, i) => [id, i]));
  let d2 = 0;
  let counted = 0;
  a.forEach((id, i) => {
    const j = rankB.get(id);
    if (j === undefined) return;
    d2 += (i - j) ** 2;
    counted++;
  });
  if (counted < 2) return 0;
  return +(1 - (6 * d2) / (counted * (counted ** 2 - 1))).toFixed(3);
}

function kendall(a: string[], b: string[]) {
  const rankB = new Map(b.map((id, i) => [id, i]));
  const common = a.filter((id) => rankB.has(id));
  let conc = 0;
  let disc = 0;
  for (let i = 0; i < common.length; i++) {
    for (let j = i + 1; j < common.length; j++) {
      const bi = rankB.get(common[i]!)!;
      const bj = rankB.get(common[j]!)!;
      if (bi < bj) conc++;
      else disc++;
    }
  }
  const total = conc + disc;
  return total ? +((conc - disc) / total).toFixed(3) : 0;
}

function Robustness() {
  const { frame, selectedPlayer } = useSession();
  const [jitter, setJitter] = useState(0.5);
  const [dropout, setDropout] = useState(0.1);
  const [availability, setAvailability] = useState(0.2);
  const [severity, setSeverity] = useState(1);

  const result = useMemo(() => {
    const players = buildFrame(frame);
    const source = players.find((p) => p.id === selectedPlayer && p.role !== "GK") ?? players[9]!;
    const ref = candidatesFor(source, players);

    const trials = Array.from({ length: 24 }, (_, t) => {
      const pp = perturb(players, jitter * severity, dropout * severity, availability * severity, t + 1);
      const src = pp.find((p) => p.id === source.id) ?? source;
      return candidatesFor(src, pp.some((p) => p.id === source.id) ? pp : [...pp, source]);
    });

    const refIds = ref.map((r) => r.targetId);
    const top1 =
      trials.filter((t) => t[0]?.targetId === refIds[0]).length / trials.length;
    const top3 =
      trials.filter((t) => t.slice(0, 3).some((c) => c.targetId === refIds[0])).length / trials.length;
    const sp = trials.map((t) => spearman(refIds, t.map((c) => c.targetId)));
    const kd = trials.map((t) => kendall(refIds, t.map((c) => c.targetId)));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    return {
      ref,
      perturbed: trials[0] ?? [],
      top1,
      top3,
      spearman: mean(sp),
      kendall: mean(kd),
      flip: 1 - top1,
    };
  }, [frame, selectedPlayer, jitter, dropout, availability, severity]);

  return (
    <>
      <PageHeader
        title="Decision Robustness"
        description="Repeated perturbation of the observed player state (24 trials per configuration) to measure how stable the hypothetical option ranking is under realistic tracking noise."
      />

      <div className="mb-4">
        <Disclaimer />
      </div>

      <Panel title="Perturbation Controls" className="mb-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Coordinate Jitter (m)", value: jitter, set: setJitter, min: 0, max: 2, step: 0.05 },
            { label: "Player Dropout", value: dropout, set: setDropout, min: 0, max: 0.4, step: 0.01 },
            { label: "Availability Jitter", value: availability, set: setAvailability, min: 0, max: 1, step: 0.05 },
            { label: "Severity Multiplier", value: severity, set: setSeverity, min: 0.25, max: 3, step: 0.25 },
          ].map((c) => (
            <div key={c.label}>
              <div className="flex justify-between">
                <span className="label-xs">{c.label}</span>
                <span className="num text-[11.5px] text-primary">{c.value}</span>
              </div>
              <input
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={c.value}
                onChange={(e) => c.set(Number(e.target.value))}
                className="mt-1.5 h-1 w-full accent-[var(--primary)]"
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Top-1 Retention" value={result.top1.toFixed(2)} tone="primary" sub="24 trials" />
        <Metric label="Top-3 Retention" value={result.top3.toFixed(2)} sub="Reference best in top 3" />
        <Metric label="Spearman ρ" value={result.spearman.toFixed(3)} sub="Mean over trials" />
        <Metric label="Kendall τ" value={result.kendall.toFixed(3)} sub="Mean over trials" />
        <Metric
          label="Decision Flip Rate"
          value={result.flip.toFixed(2)}
          tone={result.flip > 0.25 ? "warn" : undefined}
          sub="Rank-1 changed"
        />
      </div>

      <Panel title="Reference vs Perturbed Ranking" subtitle="Trial 1 shown alongside the unperturbed ranking">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-xs py-1.5">Rank</th>
              <th className="label-xs py-1.5">Reference target</th>
              <th className="label-xs py-1.5 text-right">Ref score</th>
              <th className="label-xs py-1.5">Perturbed target</th>
              <th className="label-xs py-1.5 text-right">Pert. score</th>
              <th className="label-xs py-1.5 text-right">Δ rank</th>
            </tr>
          </thead>
          <tbody>
            {result.ref.map((r, i) => {
              const p = result.perturbed[i];
              const newIdx = result.perturbed.findIndex((c) => c.targetId === r.targetId);
              const delta = newIdx === -1 ? null : newIdx - i;
              return (
                <tr key={r.targetId} className="border-b border-border/60">
                  <td className="num py-1.5">{i + 1}</td>
                  <td className="py-1.5">{r.target}</td>
                  <td className="num py-1.5 text-right">{r.score.toFixed(3)}</td>
                  <td className="py-1.5">{p ? p.target : "—"}</td>
                  <td className="num py-1.5 text-right">{p ? p.score.toFixed(3) : "—"}</td>
                  <td
                    className={`num py-1.5 text-right ${
                      delta === null ? "text-destructive" : delta === 0 ? "text-primary" : "text-warn"
                    }`}
                  >
                    {delta === null ? "dropped" : delta > 0 ? `+${delta}` : delta}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Dropped targets are receivers removed by player dropout in the perturbed trial; they are excluded
          from the rank-correlation statistics rather than penalised.
        </p>
      </Panel>
    </>
  );
}
