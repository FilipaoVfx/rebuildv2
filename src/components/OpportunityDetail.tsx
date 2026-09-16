import { cop, damageLabel, fecha, m2, min, n, pct, verificationLabel } from '../lib/format';
import { FAMILY_COLOR, FAMILY_LABEL, rgbCss } from '../lib/palette';
import { useStore } from '../state/store';
import type { ScoredOpportunity } from '../lib/scoring';
import { Bar, Chip, Provenance, SectionTitle, SignedBar, StateBadge, Stat } from './ui';

export function OpportunityDetail({ opp }: { opp: ScoredOpportunity }) {
  const {
    data, selectOpportunity, technical, setTechnical, compare, toggleCompare, setView,
  } = useStore();
  const famColor = rgbCss(FAMILY_COLOR[opp.family] ?? [240, 180, 41]);
  const inCompare = compare.includes(opp.id);
  const assessment = opp.evidence.assessment;

  return (
    <aside className="animate-fade-up flex h-full w-full flex-col border-ink-700 bg-ink-900/98 backdrop-blur lg:border-l">
      <header className="shrink-0 border-b border-ink-700 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: famColor }} />
              <span className="num text-[10px] tracking-[0.12em] text-mute-400">{opp.code}</span>
            </div>
            <h2 className="mt-1 text-lg leading-tight font-semibold tracking-tight">{opp.title}</h2>
            <p className="mt-0.5 text-[11px] text-mute-400">
              {opp.barrioName} · Comuna {opp.zoneName}
            </p>
          </div>
          <button onClick={() => selectOpportunity(null)}
                  className="shrink-0 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mute-300 hover:text-paper">
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip tone="accent" active>{FAMILY_LABEL[opp.family]}</Chip>
          <Chip>Prioridad <span className="num font-semibold text-paper">{opp.priority.toFixed(2)}</span></Chip>
          <Chip>Confianza <span className={
            opp.confidence.level === 'alta' ? 'text-ok' : opp.confidence.level === 'media' ? 'text-warn' : 'text-bad'
          }>{opp.confidence.level}</span></Chip>
          <button
            onClick={() => toggleCompare(opp.id)}
            className={[
              'ml-auto rounded-lg border px-2 py-1 text-[11px] transition-colors',
              inCompare ? 'border-accent/60 bg-accent/15 text-accent' : 'border-ink-700 text-mute-300 hover:text-paper',
            ].join(' ')}
          >
            {inCompare ? 'En comparación' : 'Comparar'}
          </button>
        </div>

        {opp.excluded && (
          <div className="mt-3 rounded-lg border border-bad/35 bg-bad/10 px-2.5 py-2 text-[11px] text-bad">
            <b>Excluida del escenario actual.</b> {opp.excluded}.
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Problema">
          <p className="text-[13px] leading-relaxed text-mute-200">{opp.problem}</p>
        </Section>

        <Section title="¿Por qué aquí?">
          <ul className="flex flex-col gap-2">
            {opp.reasons.map((r) => (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <span className="text-ok">✓</span>{r.label}
                  </span>
                  <span className="num text-[11px] text-mute-400">{r.value.toFixed(2)}</span>
                </div>
                <div className="mt-1"><Bar value={r.value} color="var(--color-mute-400)" height={3} /></div>
              </li>
            ))}
          </ul>
          <Provenance>
            Los factores están ordenados por su contribución real al puntaje, no por importancia narrativa.
            El detalle numérico está en la vista técnica.
          </Provenance>
        </Section>

        <Section title="Intervención propuesta">
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <div className="text-[14px] font-semibold">{opp.interventionLabel}</div>
            <div className="num mt-1 text-[12px] text-mute-300">
              {n(opp.size)} {opp.unit} · radio de influencia {opp.radiusM} m
            </div>
          </div>
        </Section>

        <Section title="Impacto estimado">
          <div className="grid grid-cols-2 gap-3">
            <Stat size="sm" label="Población beneficiada" value={n(opp.impact.populationBenefited)}
                  tone="accent" sub="dentro del radio de influencia" />
            <Stat size="sm" label="Costo por beneficiario"
                  value={cop(opp.impact.costPerBeneficiary, { compact: true })} />
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <BeforeAfter label="Acceso promedio a pie"
                         before={min(opp.impact.accessBefore)} after={min(opp.impact.accessAfter)} good />
            {opp.impact.deficitReductionPct > 0 && (
              <BeforeAfter label="Déficit de espacio público"
                           before={opp.impact.deficitBefore.toFixed(2)}
                           after={opp.impact.deficitAfter.toFixed(2)}
                           extra={`−${opp.impact.deficitReductionPct.toFixed(1)}%`} good />
            )}
            {opp.impact.newGreenM2 > 0 && (
              <Row label="Nuevo espacio público" value={m2(opp.impact.newGreenM2)} />
            )}
            {opp.impact.householdsRehoused > 0 && (
              <Row label="Hogares reubicados en sitio" value={n(opp.impact.householdsRehoused)} />
            )}
          </div>
          <Provenance>
            Estimación por reglas a partir de población en captación y dotación existente. No es una
            predicción de resultado: no existe registro de intervención real → resultado real que permita
            calibrarla.
          </Provenance>
        </Section>

        <Section title="Viabilidad">
          <ul className="flex flex-col gap-2">
            {opp.feasibility.map((f) => (
              <li key={f.key} className="flex items-start gap-2.5">
                <StateBadge state={f.state}>
                  {f.state === 'ok' ? '✓' : f.state === 'warn' ? '!' : '✕'}
                </StateBadge>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium">{f.label}</div>
                  <div className="text-[11px] leading-snug text-mute-400">{f.note}</div>
                  <div className="mt-0.5 text-[10px] text-mute-500">
                    {data.sourceById.get(f.source)?.provider ?? f.source}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Costo">
          <Stat label="Estimación de referencia" value={cop(opp.cost)} size="lg"
                sub={`${cop(Math.round(opp.cost / opp.size), { compact: true })} por ${opp.unit.replace(/s$/, '')}`} />
          <Provenance>
            Valor unitario de referencia, no presupuesto de obra. Dispersión esperada ±30%.
          </Provenance>
        </Section>

        <Section title="Confianza">
          <div className="flex items-center gap-3">
            <div className="num text-2xl font-semibold"
                 style={{ color: opp.confidence.level === 'alta' ? 'var(--color-ok)'
                   : opp.confidence.level === 'media' ? 'var(--color-warn)' : 'var(--color-bad)' }}>
              {pct(opp.confidence.value)}
            </div>
            <div className="text-[11px] text-mute-300">Confianza {opp.confidence.level}</div>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {opp.confidence.drivers.map((d) => (
              <li key={d.label}>
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-mute-200">{d.label}</span>
                  <span className="num text-mute-400">{d.value.toFixed(2)}</span>
                </div>
                <div className="mt-1"><Bar value={d.value} height={3} color="var(--color-mute-400)" /></div>
                <div className="mt-0.5 text-[10px] text-mute-500">{d.detail}</div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Evidencia">
          <div className="grid grid-cols-2 gap-3">
            <Stat size="sm" label="Observaciones en captación" value={n(opp.evidence.damageEvidenceCount)} />
            <Stat size="sm" label="Fuentes" value={assessment?.source_count ?? 0} />
          </div>
          {assessment && assessment.damage_class && (
            <div className="mt-3 rounded-lg border border-ink-700 bg-ink-850 p-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-mute-400">Clase consolidada</span>
                <span className="font-medium">{damageLabel[assessment.damage_class]}</span>
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-mute-400">Concordancia entre fuentes</span>
                <span className="num">{assessment.agreement_score?.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-mute-400">Verificación</span>
                <span>{verificationLabel[assessment.verification_status]}</span>
              </div>
            </div>
          )}
          {!assessment?.damage_class && (
            <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-[11px] text-warn">
              No hay observaciones de daño en la celda de origen. La oportunidad se sostiene en déficit
              y accesibilidad, no en evidencia de afectación.
            </div>
          )}
          <Provenance>
            La evidencia se almacena separada del estado consolidado. Un cambio detectado por satélite no
            se interpreta como edificio destruido.{' '}
            <button className="underline hover:text-mute-200" onClick={() => setView('evidencia')}>
              Ver cadena completa
            </button>
          </Provenance>
        </Section>

        <div className="border-t border-ink-700 p-4">
          <button
            onClick={() => setTechnical(!technical)}
            className="flex w-full items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] text-mute-300 hover:text-paper"
          >
            <span>Vista técnica · features, pesos y puntaje</span>
            <span className="text-mute-500">{technical ? '▲' : '▼'}</span>
          </button>

          {technical && (
            <div className="animate-fade-in mt-3">
              <SectionTitle>Contribuciones al puntaje base</SectionTitle>
              <table className="mt-2 w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-mute-500">
                    <th className="pb-1 font-medium">feature</th>
                    <th className="pb-1 text-right font-medium">valor</th>
                    <th className="pb-1 text-right font-medium">peso</th>
                    <th className="pb-1 pl-2 font-medium">aporte</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {opp.contributions.map((c) => (
                    <tr key={c.key} className="border-t border-ink-800">
                      <td className="py-1 text-mute-300">{c.key}</td>
                      <td className="num py-1 text-right">{c.value.toFixed(3)}</td>
                      <td className="num py-1 text-right text-mute-400">{c.weight.toFixed(2)}</td>
                      <td className="w-20 py-1 pl-2"><SignedBar value={c.contribution} max={0.22} /></td>
                    </tr>
                  ))}
                  <tr className="border-t border-ink-600">
                    <td className="py-1.5 font-semibold text-paper">score</td>
                    <td colSpan={3} className="num py-1.5 text-right font-semibold text-accent">
                      {opp.score.toFixed(3)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3">
                <SectionTitle>Prioridad bajo el escenario activo</SectionTitle>
                <table className="mt-2 w-full text-[11px] font-mono">
                  <tbody>
                    {opp.priorityParts.map((p) => (
                      <tr key={p.key} className="border-t border-ink-800">
                        <td className="py-1 text-mute-300">{p.label}</td>
                        <td className="num py-1 text-right">{p.value.toFixed(3)}</td>
                        <td className="w-20 py-1 pl-2"><SignedBar value={p.value} max={0.7} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-lg border border-ink-800 bg-ink-950 p-2.5 font-mono text-[10px] leading-relaxed text-mute-400">
                <div>generator: {opp.provenance.generator}</div>
                <div>model_version: {opp.provenance.model_version}</div>
                <div>processing_version: {opp.provenance.processing_version}</div>
                <div>generated_at: {fecha(opp.provenance.generated_at)}</div>
                <div>catchment_radius_m: {opp.radiusM}</div>
                <div>cell_id: {opp.cell} · zone: {opp.zoneId} · barrio: {opp.barrioId}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-ink-800 p-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-2.5">{children}</div>
    </section>
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

function BeforeAfter({ label, before, after, extra, good }: {
  label: string; before: string; after: string; extra?: string; good?: boolean;
}) {
  return (
    <div className="rounded-lg bg-ink-850 px-2.5 py-2">
      <div className="text-[11px] text-mute-300">{label}</div>
      <div className="num mt-1 flex items-baseline gap-2 text-[13px]">
        <span className="text-mute-400 line-through decoration-ink-500">{before}</span>
        <span className="text-mute-500">→</span>
        <span className={good ? 'font-semibold text-ok' : 'font-semibold'}>{after}</span>
        {extra && <span className="ml-auto text-[11px] text-ok">{extra}</span>}
      </div>
    </div>
  );
}
