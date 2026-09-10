import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Metric, Panel, PageHeader } from "@/components/Panel";
import { buildFrame, EVENT_EVAL, EVENTS, POSSESSION_SEGMENTS, pressureOn } from "@/lib/data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/possession")({
  head: () => ({
    meta: [
      { title: "Possession & Events — Ball-Free Game State Reconstruction" },
      {
        name: "description",
        content:
          "Inferred possession timeline and predicted-versus-annotated event comparison with precision, recall and F1 per class.",
      },
      { property: "og:title", content: "Possession & Events — Ball-Free Game State Reconstruction" },
      {
        property: "og:description",
        content: "Possession inference timeline and per-class event evaluation.",
      },
    ],
  }),
  component: PossessionPage,
});

function PossessionPage() {
  const { frame } = useSession();
  const [tab, setTab] = useState<"compare" | "predicted" | "annotated">("compare");
  const players = buildFrame(frame);
  const possessor = players
    .filter((p) => p.role !== "GK")
    .reduce((best, p) => (pressureOn(p, players) < pressureOn(best, players) ? p : best));

  const totals = EVENT_EVAL.reduce(
    (a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn }),
    { tp: 0, fp: 0, fn: 0 },
  );
  const precision = totals.tp / (totals.tp + totals.fp);
  const recall = totals.tp / (totals.tp + totals.fn);

  return (
    <>
      <PageHeader
        title="Possession & Events"
        description="Possession is inferred from player configuration alone. Because no ball is tracked, possession here means the player most consistent with control given local geometry and motion — not observed contact with the ball."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Possession F1" value="0.741" tone="primary" sub="Against annotated possession" />
        <Metric label="Micro Precision" value={precision.toFixed(3)} sub="All event classes" />
        <Metric label="Micro Recall" value={recall.toFixed(3)} sub="All event classes" />
        <Metric label="Transitions / min" value="8.4" sub="Inferred possession changes" />
      </div>

      <Panel title="Possession Timeline" subtitle="Full-match inferred possession bands with confidence" className="mb-4">
        <div className="flex h-8 w-full overflow-hidden border border-border">
          {POSSESSION_SEGMENTS.map((s) => (
            <div
              key={s.start}
              className="h-full flex-1"
              style={{
                background:
                  s.team === "home" ? "var(--home)" : s.team === "away" ? "var(--away)" : "var(--muted)",
                opacity: 0.35 + s.confidence * 0.55,
              }}
              title={`Frames ${s.start}–${s.end} · ${s.team} · conf ${s.confidence}`}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 bg-home" /> Home
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 bg-away" /> Away
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 bg-muted" /> Contested / low confidence
          </span>
          <span>Opacity encodes model confidence</span>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="Current Inferred Possessor" subtitle={`Frame ${frame}`}>
          <div className="border border-border bg-panel-alt p-3">
            <div className="label-xs">Most likely possessor</div>
            <div className="mt-1 text-[18px] font-medium">
              #{possessor.number} {possessor.name}
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              {possessor.team === "home" ? "Home" : "Away"} · {possessor.role} · track {possessor.id}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
              <div>
                <div className="label-xs">Posterior</div>
                <div className="num">0.612</div>
              </div>
              <div>
                <div className="label-xs">Runner-up margin</div>
                <div className="num">0.147</div>
              </div>
              <div>
                <div className="label-xs">Local pressure</div>
                <div className="num">{pressureOn(possessor, players).toFixed(3)}</div>
              </div>
              <div>
                <div className="label-xs">Stability (±25 frames)</div>
                <div className="num">0.78</div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Low-margin frames (&lt;0.10) account for 21.6% of the match and are the dominant source of
            possession F1 loss.
          </p>
        </Panel>

        <Panel
          title="Events"
          subtitle="Predicted vs annotated"
          actions={
            <div className="flex gap-1">
              {(["compare", "predicted", "annotated"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border px-2 py-1 text-[11px] uppercase tracking-[0.05em] ${
                    tab === t ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        >
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-xs py-1.5">Frame</th>
                <th className="label-xs py-1.5">Time</th>
                {tab !== "annotated" && <th className="label-xs py-1.5">Predicted</th>}
                {tab !== "predicted" && <th className="label-xs py-1.5">Annotated</th>}
                <th className="label-xs py-1.5 text-right">Conf.</th>
                <th className="label-xs py-1.5 text-right">Match</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((e) => {
                const match = e.predicted === e.annotated;
                return (
                  <tr key={e.frame} className="border-b border-border/60">
                    <td className="num py-1.5">{e.frame}</td>
                    <td className="num py-1.5">{e.t}</td>
                    {tab !== "annotated" && <td className="py-1.5">{e.predicted}</td>}
                    {tab !== "predicted" && <td className="py-1.5">{e.annotated}</td>}
                    <td className="num py-1.5 text-right">{e.conf.toFixed(2)}</td>
                    <td
                      className={`py-1.5 text-right text-[10.5px] uppercase ${
                        match ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {match ? "TP" : e.predicted === "—" ? "FN" : "FP"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Event Evaluation" subtitle="Full-match confusion counts by class" className="mt-4">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-xs py-1.5">Class</th>
              <th className="label-xs py-1.5 text-right">TP</th>
              <th className="label-xs py-1.5 text-right">FP</th>
              <th className="label-xs py-1.5 text-right">FN</th>
              <th className="label-xs py-1.5 text-right">Precision</th>
              <th className="label-xs py-1.5 text-right">Recall</th>
              <th className="label-xs py-1.5 text-right">F1</th>
            </tr>
          </thead>
          <tbody>
            {EVENT_EVAL.map((r) => (
              <tr key={r.cls} className="border-b border-border/60">
                <td className="py-1.5">{r.cls}</td>
                <td className="num py-1.5 text-right">{r.tp}</td>
                <td className="num py-1.5 text-right">{r.fp}</td>
                <td className="num py-1.5 text-right">{r.fn}</td>
                <td className="num py-1.5 text-right">{r.precision.toFixed(3)}</td>
                <td className="num py-1.5 text-right">{r.recall.toFixed(3)}</td>
                <td className={`num py-1.5 text-right ${r.f1 < 0.5 ? "text-destructive" : ""}`}>
                  {r.f1.toFixed(3)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border font-medium">
              <td className="py-1.5">Micro total</td>
              <td className="num py-1.5 text-right">{totals.tp}</td>
              <td className="num py-1.5 text-right">{totals.fp}</td>
              <td className="num py-1.5 text-right">{totals.fn}</td>
              <td className="num py-1.5 text-right">{precision.toFixed(3)}</td>
              <td className="num py-1.5 text-right">{recall.toFixed(3)}</td>
              <td className="num py-1.5 text-right">
                {((2 * precision * recall) / (precision + recall)).toFixed(3)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-muted-foreground">
          DUEL remains the weakest class (F1 0.366). Without ball position, duels are largely
          indistinguishable from close-proximity marking.
        </p>
      </Panel>
    </>
  );
}
