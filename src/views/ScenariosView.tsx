import { cop, n, pct } from '../lib/format';
import { SCENARIO_PRESETS, WEIGHT_LABELS } from '../lib/scoring';
import { useStore } from '../state/store';
import type { ScenarioWeights } from '../types';
import { Panel, Provenance, SectionTitle, Stat } from '../components/ui';

const KEYS: (keyof ScenarioWeights)[] = ['population', 'equity', 'access', 'deficit', 'damage', 'riskTolerance'];

export function ScenariosView() {
  const {
    weights, setWeights, presetId, setPresetId, scored, portfolio, constraints,
    setConstraints, selectOpportunity, data,
  } = useStore();

  const excluded = scored.filter((o) => o.excluded);

  return (
    <div className="flex flex-col gap-3 p-3">
      <Panel className="p-4">
        <SectionTitle>Escenario</SectionTitle>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {SCENARIO_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPresetId(p.id); setWeights(p.weights); setPresetId(p.id); }}
              className={[
                'rounded-lg border px-2.5 py-2 text-left transition-colors',
                presetId === p.id ? 'border-accent/60 bg-accent/10' : 'border-ink-700 bg-ink-850 hover:border-mute-400/40',
              ].join(' ')}
            >
              <div className="text-[12px] font-medium">{p.name}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-mute-400">{p.rationale}</div>
            </button>
          ))}
        </div>
        {presetId === 'custom' && (
          <p className="mt-2 text-[10px] text-accent">Escenario personalizado</p>
        )}
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Prioridades</SectionTitle>
        <div className="mt-3 flex flex-col gap-4">
          {KEYS.map((k) => (
            <div key={k}>
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-[12px] font-medium">{WEIGHT_LABELS[k].label}</label>
                <span className="num text-[11px] text-mute-400">{weights[k].toFixed(2)}</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05} value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
                className="mt-1.5 w-full accent-[var(--color-accent)]"
              />
              <p className="mt-0.5 text-[10px] leading-snug text-mute-500">{WEIGHT_LABELS[k].help}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Restricciones</SectionTitle>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-[12px] font-medium">Presupuesto</label>
              <span className="num text-[12px] font-semibold text-accent">{cop(constraints.budget)}</span>
            </div>
            <input
              type="range" min={2e9} max={80e9} step={0.5e9} value={constraints.budget}
              onChange={(e) => setConstraints({ ...constraints, budget: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[var(--color-accent)]"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-[12px] font-medium">Máximo de proyectos</label>
              <span className="num text-[12px] font-semibold">{constraints.maxProjects}</span>
            </div>
            <input
              type="range" min={1} max={15} step={1} value={constraints.maxProjects}
              onChange={(e) => setConstraints({ ...constraints, maxProjects: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[var(--color-accent)]"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-[12px] font-medium">Máximo por comuna</label>
              <span className="num text-[12px] font-semibold">{constraints.maxPerZone}</span>
            </div>
            <input
              type="range" min={1} max={6} step={1} value={constraints.maxPerZone}
              onChange={(e) => setConstraints({ ...constraints, maxPerZone: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[var(--color-accent)]"
            />
            <p className="mt-0.5 text-[10px] text-mute-500">
              Evita que toda la inversión se concentre en un solo territorio.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Efecto del escenario</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat size="sm" label="Proyectos seleccionados" value={portfolio.selected.length} tone="accent" />
          <Stat size="sm" label="Presupuesto usado" value={pct(portfolio.budgetUsed)} />
          <Stat size="sm" label="Población alcanzada" value={n(portfolio.uniquePopulation)} />
          <Stat size="sm" label="Comunas alcanzadas" value={`${portfolio.zonesReached} / ${data.zones.length}`} />
        </div>
        <Provenance>
          Cambiar las prioridades no cambia los datos: cambia el orden. El portafolio se recalcula con
          cobertura marginal, así que dos proyectos que sirven a la misma población no suman dos veces.
        </Provenance>
      </Panel>

      <Panel className="p-4">
        <SectionTitle right={<span className="text-[10px] text-mute-400">top 10</span>}>
          Ranking bajo este escenario
        </SectionTitle>
        <ol className="mt-2.5 flex flex-col gap-1">
          {scored.filter((o) => !o.excluded).slice(0, 10).map((o, i) => (
            <li key={o.id}>
              <button onClick={() => selectOpportunity(o.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink-850">
                <span className="num w-5 shrink-0 text-[11px] text-mute-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px]">{o.interventionLabel}</span>
                  <span className="block text-[10px] text-mute-400">{o.barrioName} · {o.zoneName}</span>
                </span>
                <span className="num shrink-0 text-[12px] font-semibold text-accent">
                  {o.priority.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Panel>

      {excluded.length > 0 && (
        <Panel className="p-4">
          <SectionTitle right={<span className="text-[10px] text-bad">{excluded.length}</span>}>
            Excluidas por restricción dura
          </SectionTitle>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {excluded.slice(0, 6).map((o) => (
              <li key={o.id} className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2">
                <button onClick={() => selectOpportunity(o.id)} className="w-full text-left">
                  <div className="text-[12px] font-medium">{o.interventionLabel} · {o.barrioName}</div>
                  <div className="mt-0.5 text-[10px] text-bad">{o.excluded}</div>
                </button>
              </li>
            ))}
          </ul>
          <Provenance>
            Las restricciones duras no se compensan con puntaje. Una oportunidad muy bien puntuada en
            suelo de protección sigue siendo inviable.
          </Provenance>
        </Panel>
      )}
    </div>
  );
}
