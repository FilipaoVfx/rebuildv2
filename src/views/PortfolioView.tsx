import { cop, m2, n, pct } from '../lib/format';
import { FAMILY_COLOR, rgbCss } from '../lib/palette';
import { useStore } from '../state/store';
import { Bar, Empty, Panel, Provenance, SectionTitle, Stat } from '../components/ui';

export function PortfolioView() {
  const { portfolio, constraints, selectOpportunity, data, setView } = useStore();
  const p = portfolio;

  return (
    <div className="flex flex-col gap-3 p-3">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionTitle>Portafolio propuesto</SectionTitle>
            <p className="mt-1 text-[11px] text-mute-400">
              Bajo {cop(constraints.budget)} y máximo {constraints.maxProjects} proyectos
            </p>
          </div>
          <button onClick={() => setView('escenarios')}
                  className="shrink-0 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mute-300 hover:text-paper">
            Ajustar
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Stat label="Población alcanzada" value={n(p.uniquePopulation)} size="lg" tone="accent"
                sub="personas distintas, sin doble conteo" />
          <Stat label="Costo total" value={cop(p.totalCost)} size="lg"
                sub={`${pct(p.budgetUsed, p.budgetUsed > 0.985 && p.budgetUsed < 1 ? 1 : 0)} del presupuesto`} />
        </div>

        <div className="mt-3">
          <Bar value={p.budgetUsed} color="var(--color-accent)" height={5} />
          <div className="mt-1 flex justify-between text-[10px] text-mute-400">
            <span>{p.selected.length} proyectos</span>
            <span>quedan {cop(Math.max(0, constraints.budget - p.totalCost))}</span>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel className="p-3.5">
          <Stat size="sm" label="Cobertura de necesidad alta" value={pct(p.coverageHighNeed)}
                sub="celdas con necesidad ≥ 0,6" />
        </Panel>
        <Panel className="p-3.5">
          <Stat size="sm" label="Redundancia" value={pct(p.redundancy)}
                tone={p.redundancy > 0.25 ? 'warn' : 'default'}
                sub="población servida por más de un proyecto" />
        </Panel>
        <Panel className="p-3.5">
          <Stat size="sm" label="Equilibrio territorial" value={p.gini.toFixed(2)}
                tone={p.gini > 0.45 ? 'warn' : 'ok'}
                sub="Gini de inversión per cápita (0 = equitativo)" />
        </Panel>
        <Panel className="p-3.5">
          <Stat size="sm" label="Costo por beneficiario"
                value={cop(p.costPerBeneficiary, { compact: true })} />
        </Panel>
      </div>

      {p.constraintFlags.length > 0 && (
        <Panel className="p-4">
          <SectionTitle>Restricciones y advertencias</SectionTitle>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {p.constraintFlags.map((f, i) => (
              <li key={i} className={[
                'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug',
                f.level === 'bad' ? 'border-bad/30 bg-bad/5 text-bad' : 'border-warn/30 bg-warn/5 text-warn',
              ].join(' ')}>
                <span className="mt-0.5">{f.level === 'bad' ? '✕' : '!'}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="p-4">
        <SectionTitle right={<span className="text-[10px] text-mute-400">{p.selected.length}</span>}>
          Proyectos
        </SectionTitle>
        <ol className="mt-2.5 flex flex-col gap-1.5">
          {p.selected.length === 0 && (
            <Empty>Ninguna oportunidad cabe en las restricciones. Sube el presupuesto en Escenarios.</Empty>
          )}
          {p.selected.map((o, i) => (
            <li key={o.id}>
              <button onClick={() => selectOpportunity(o.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-left hover:border-mute-400/40">
                <span className="num mt-0.5 w-4 shrink-0 text-[11px] text-mute-500">{i + 1}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: rgbCss(FAMILY_COLOR[o.family] ?? [240, 180, 41]) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{o.interventionLabel}</span>
                  <span className="block text-[10px] text-mute-400">
                    {o.barrioName} · Comuna {o.zoneName}
                  </span>
                </span>
                <span className="num shrink-0 text-right">
                  <span className="block text-[12px] font-medium">{cop(o.cost)}</span>
                  <span className="block text-[10px] text-mute-400">{n(o.impact.populationBenefited)} hab</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <Provenance>
          Selección por greedy de cobertura marginal: en cada paso se elige la oportunidad con mayor
          beneficio <i>nuevo</i> por peso invertido. Es un baseline explicable, no un óptimo MILP.
        </Provenance>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Resultado agregado</SectionTitle>
        <div className="mt-3 flex flex-col gap-2">
          <Row label="Reducción media de déficit"
               value={p.avgDeficitReduction > 0 ? `${p.avgDeficitReduction.toFixed(1)}%` : '—'} />
          <Row label="Ganancia media de acceso"
               value={p.avgAccessGain > 0 ? `−${p.avgAccessGain.toFixed(1)} min` : '—'} />
          <Row label="Nuevo espacio público"
               value={p.newPublicSpaceM2 > 0 ? m2(p.newPublicSpaceM2) : '—'} />
          <Row label="Hogares reubicados"
               value={p.householdsRehoused > 0 ? n(p.householdsRehoused) : '—'} />
          <Row label="Población servida (bruta)" value={n(p.grossPopulation)} />
          <Row label="Población servida (única)" value={n(p.uniquePopulation)} />
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Distribución territorial</SectionTitle>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {p.zoneShares.filter((z) => z.cost > 0).map((z) => (
            <div key={z.zone.id}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span>{z.zone.name}</span>
                <span className="num text-mute-400">{cop(z.cost)} · {n(z.population)} hab</span>
              </div>
              <div className="mt-1">
                <Bar value={p.totalCost ? z.cost / p.totalCost : 0} color="var(--color-accent)" height={4} />
              </div>
            </div>
          ))}
          {p.zoneShares.every((z) => z.cost === 0) && <Empty>Sin inversión asignada.</Empty>}
        </div>
        <Provenance>
          {p.zonesReached} de {data.zones.length} comunas reciben inversión. El Gini se calcula sobre
          inversión per cápita de las comunas alcanzadas.
        </Provenance>
      </Panel>

      {p.rejected.length > 0 && (
        <Panel className="p-4">
          <SectionTitle right={<span className="text-[10px] text-mute-400">{p.rejected.length}</span>}>
            No seleccionadas · por qué
          </SectionTitle>
          <ul className="mt-2.5 flex flex-col gap-1">
            {p.rejected.slice(0, 8).map(({ opp, reason }) => (
              <li key={opp.id} className="flex items-baseline gap-2 py-1 text-[11px]">
                <button onClick={() => selectOpportunity(opp.id)}
                        className="shrink-0 text-mute-200 underline decoration-ink-600 hover:text-paper">
                  {opp.code.replace('OPORTUNIDAD #', '#')}
                </button>
                <span className="truncate text-mute-400">{reason}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg bg-ink-850 px-2.5 py-1.5 text-[12px]">
      <span className="text-mute-300">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
