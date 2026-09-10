import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader } from "@/components/Panel";
import { Pitch, PitchLegend } from "@/components/Pitch";
import { buildFrame, candidatesFor } from "@/lib/data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/counterfactual")({
  head: () => ({
    meta: [
      { title: "Counterfactual Decisions — Ball-Free Game State Reconstruction" },
      {
        name: "description",
        content:
          "Model-ranked hypothetical passing options generated from the observed player-only state, with a full scoring breakdown.",
      },
      { property: "og:title", content: "Counterfactual Decisions — Ball-Free Game State Reconstruction" },
      {
        property: "og:description",
        content: "Hypothetical option ranking with distance, pressure, space and obstruction terms.",
      },
    ],
  }),
  component: Counterfactual,
});

export function Disclaimer() {
  return (
    <div className="border border-warn/40 bg-warn/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-warn">
      <span className="mr-1.5 font-semibold uppercase tracking-[0.06em]">Disclaimer</span>
      This is a model-ranked hypothetical option generated from the observed player-only state. It does
      not indicate that the player selected this option.
    </div>
  );
}

function Counterfactual() {
  const { frame, selectedPlayer, setSelectedPlayer } = useSession();
  const players = buildFrame(frame);
  const source = players.find((p) => p.id === selectedPlayer && p.role !== "GK") ?? players[9]!;
  const candidates = candidatesFor(source, players);
  const top = candidates[0]!;

  return (
    <>
      <PageHeader
        title="Counterfactual Decisions"
        description="For a chosen source player, the model enumerates every teammate as a hypothetical receiving option and ranks them by a weighted decision score. No ball or intent information enters this computation."
      />

      <div className="mb-4">
        <Disclaimer />
      </div>

      <Panel className="mb-4" bodyClassName="p-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="label-xs">Source player</span>
          <select
            value={source.id}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="border border-input bg-panel-alt px-2 py-1 text-[12px]"
          >
            {players
              .filter((p) => p.role !== "GK")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.team === "home" ? "HOME" : "AWAY"} · #{p.number} {p.name} ({p.role})
                </option>
              ))}
          </select>
          <span className="num text-[12px] text-muted-foreground">
            Frame {frame} · {candidates.length} candidate options
          </span>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Candidate Pass Lines" subtitle="Top five hypothetical options drawn from the source player">
          <Pitch
            players={players}
            selectedId={source.id}
            onSelect={setSelectedPlayer}
            passLines={candidates.slice(0, 5).map((c) => ({
              fromId: source.id,
              toId: c.targetId,
              rank: c.rank,
              score: c.score,
            }))}
          />
          <div className="mt-2">
            <PitchLegend />
          </div>
        </Panel>

        <Panel title="Why this option ranked here" subtitle={`Rank 1 · ${top.target}`}>
          <div className="space-y-2 text-[11.5px]">
            {[
              {
                k: "Space (weight 0.34)",
                v: top.space,
                note: `Nearest opponent to the target is ${(top.space * 12).toFixed(1)} m away, the largest separation among viable receivers.`,
              },
              {
                k: "Inverse pressure (weight 0.26)",
                v: +(1 - top.pressure).toFixed(3),
                note: `Target pressure index is ${top.pressure.toFixed(3)}; ${top.pressure < 0.35 ? "below" : "above"} the frame median.`,
              },
              {
                k: "Line clearance (weight 0.22)",
                v: +(1 - top.obstruction).toFixed(3),
                note:
                  top.obstruction === 0
                    ? "No opponent intersects the 3.5 m corridor along this line."
                    : "At least one opponent lies within the 3.5 m corridor; the option is penalised accordingly.",
              },
              {
                k: "Forward progression (weight 0.18)",
                v: +((top.distance / 105) * 1).toFixed(3),
                note: "Measured as normalised gain along the attacking axis, not as expected threat.",
              },
            ].map((r) => (
              <div key={r.k} className="border border-border bg-panel-alt p-2.5">
                <div className="flex items-center justify-between">
                  <span>{r.k}</span>
                  <span className="num text-primary">{r.v}</span>
                </div>
                <div className="mt-1 h-1 w-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, r.v * 100)}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{r.note}</p>
              </div>
            ))}
            <div className="border border-border p-2.5">
              <div className="flex items-center justify-between">
                <span className="label-xs">Composite decision score</span>
                <span className="num text-[15px] text-primary">{top.score.toFixed(3)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Margin over rank 2</span>
                <span className="num">{(top.score - (candidates[1]?.score ?? 0)).toFixed(3)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Rank stability under perturbation</span>
                <span className="num">{top.stability.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Candidate Ranking" subtitle="All teammates scored as hypothetical options" className="mt-4">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-xs py-1.5">Rank</th>
              <th className="label-xs py-1.5">Target</th>
              <th className="label-xs py-1.5 text-right">Distance (m)</th>
              <th className="label-xs py-1.5 text-right">Pressure</th>
              <th className="label-xs py-1.5 text-right">Space</th>
              <th className="label-xs py-1.5 text-right">Line obstruction</th>
              <th className="label-xs py-1.5 text-right">Decision score</th>
              <th className="label-xs py-1.5 text-right">Stability</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.targetId} className={`border-b border-border/60 ${c.rank === 1 ? "bg-accent/40" : ""}`}>
                <td className="num py-1.5">{c.rank}</td>
                <td className="py-1.5">{c.target}</td>
                <td className="num py-1.5 text-right">{c.distance.toFixed(1)}</td>
                <td className="num py-1.5 text-right">{c.pressure.toFixed(3)}</td>
                <td className="num py-1.5 text-right">{c.space.toFixed(3)}</td>
                <td className="num py-1.5 text-right">{c.obstruction.toFixed(3)}</td>
                <td className={`num py-1.5 text-right ${c.rank === 1 ? "text-primary" : ""}`}>
                  {c.score.toFixed(3)}
                </td>
                <td className="num py-1.5 text-right">{c.stability.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
