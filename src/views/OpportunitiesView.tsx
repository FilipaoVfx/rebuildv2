import { useState } from 'react';
import { cop, n, pct } from '../lib/format';
import { FAMILY_COLOR, FAMILY_LABEL, rgbCss } from '../lib/palette';
import { EXAMPLE_QUERIES } from '../lib/search';
import { useStore } from '../state/store';
import type { ScoredOpportunity } from '../lib/scoring';
import { Bar, Chip, Empty, Panel, Provenance, SectionTitle, StateBadge } from '../components/ui';

export function OpportunitiesView() {
  const {
    data, query, setQuery, search, visibleOpportunities, selectOpportunity,
    opportunityId, compare, toggleCompare, clearCompare, zoneId, selectZone,
  } = useStore();
  const [showCompare, setShowCompare] = useState(false);
  const compared = compare.map((id) => visibleOpportunities.find((o) => o.id === id)
    ?? data.opportunities.find((o) => o.id === id)).filter(Boolean) as ScoredOpportunity[];

  return (
    <div className="flex flex-col gap-3 p-3">
      <Panel className="p-3.5">
        <SectionTitle>Búsqueda</SectionTitle>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe lo que buscas en lenguaje natural…"
          className="mt-2 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5 text-[13px] text-paper placeholder:text-mute-500 focus:border-accent/60 focus:outline-none"
        />

        {!query && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {EXAMPLE_QUERIES.slice(0, 3).map((q) => (
              <Chip key={q} onClick={() => setQuery(q)}>{q.length > 52 ? `${q.slice(0, 52)}…` : q}</Chip>
            ))}
          </div>
        )}

        {query && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-mute-400">
              Criterios interpretados
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {search.criteria.length === 0 && (
                <span className="text-[11px] text-mute-400">
                  No se reconoció ningún criterio. Se muestran todas las oportunidades.
                </span>
              )}
              {search.criteria.map((c, i) => (
                <span key={i}
                      className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 font-mono text-[10px]">
                  <span className={
                    c.origin === 'spatial' ? 'text-ok' : c.origin === 'structured' ? 'text-accent' : 'text-mute-300'
                  }>
                    {c.origin === 'spatial' ? 'PostGIS' : c.origin === 'structured' ? 'SQL' : 'vector'}
                  </span>
                  <span className="text-mute-200">{c.field} {c.op} {c.value}</span>
                </span>
              ))}
            </div>

            {search.unmatchedTerms.length > 0 && (
              <p className="mt-2 text-[10px] text-warn">
                Términos no interpretados: {search.unmatchedTerms.join(', ')}. Se ignoran en el filtrado
                estructurado, pero sí se usan en la recuperación de documentos.
              </p>
            )}

            {search.documents.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-mute-400">
                  Documentos relacionados
                </div>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {search.documents.map(({ doc, score, matched }) => (
                    <li key={doc.id} className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium">{doc.title}</span>
                        <span className="num shrink-0 text-[10px] text-mute-400">{score.toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-mute-400">{doc.excerpt}</p>
                      {matched.length > 0 && (
                        <div className="mt-1 text-[9px] text-mute-500">coincide en: {matched.join(', ')}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Provenance>
              Simulación en cliente del retrieval híbrido: en producción el filtrado espacial se resuelve
              en PostGIS, el léxico en FTS/pg_trgm y el semántico en pgvector. La vector DB no reemplaza
              el cálculo espacial.
            </Provenance>
          </div>
        )}
      </Panel>

      {compare.length > 0 && (
        <Panel className="p-3.5">
          <SectionTitle right={
            <button onClick={() => setShowCompare(!showCompare)}
                    className="text-[10px] text-mute-400 hover:text-paper">
              {showCompare ? 'ocultar' : 'mostrar'}
            </button>
          }>
            Comparación · {compare.length}
          </SectionTitle>
          {showCompare && <CompareTable opps={compared} />}
          {!showCompare && (
            <p className="mt-2 text-[11px] text-mute-400">
              {compared.map((o) => o.code.replace('OPORTUNIDAD ', '')).join(' · ')}
            </p>
          )}
          <button onClick={clearCompare} className="mt-2 text-[10px] text-mute-400 underline hover:text-paper">
            limpiar comparación
          </button>
        </Panel>
      )}

      <Panel className="p-3.5">
        <SectionTitle right={
          <span className="text-[10px] text-mute-400">
            {visibleOpportunities.length} de {data.opportunities.length}
          </span>
        }>
          Oportunidades de recuperación
        </SectionTitle>

        {zoneId && (
          <div className="mt-2">
            <Chip active onClick={() => selectZone(null)}>
              Comuna {data.zones.find((z) => z.id === zoneId)?.name} ✕
            </Chip>
          </div>
        )}

        <div className="mt-2.5 flex flex-col gap-2">
          {visibleOpportunities.length === 0 && (
            <Empty>Ninguna oportunidad cumple los criterios actuales.</Empty>
          )}
          {visibleOpportunities.map((o) => (
            <OpportunityCard
              key={o.id} opp={o}
              selected={o.id === opportunityId}
              inCompare={compare.includes(o.id)}
              onSelect={() => selectOpportunity(o.id === opportunityId ? null : o.id)}
              onCompare={() => toggleCompare(o.id)}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function OpportunityCard({ opp, selected, inCompare, onSelect, onCompare }: {
  opp: ScoredOpportunity; selected: boolean; inCompare: boolean;
  onSelect: () => void; onCompare: () => void;
}) {
  const famColor = rgbCss(FAMILY_COLOR[opp.family] ?? [240, 180, 41]);
  return (
    <div className={[
      'rounded-xl border p-3 transition-colors',
      selected ? 'border-accent/50 bg-accent/5' : 'border-ink-700 bg-ink-850 hover:border-mute-400/40',
      opp.excluded ? 'opacity-60' : '',
    ].join(' ')}>
      <button onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: famColor }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="num text-[10px] tracking-wider text-mute-400">
                {opp.code.replace('OPORTUNIDAD #', '#')}
              </span>
              <span className="truncate text-[13px] font-medium">{opp.interventionLabel}</span>
            </div>
            <div className="text-[11px] text-mute-400">
              {opp.barrioName} · Comuna {opp.zoneName}
            </div>
          </div>
          <span className="num shrink-0 text-right">
            <span className="block text-[13px] font-semibold text-accent">{opp.priority.toFixed(2)}</span>
            <span className="block text-[9px] text-mute-500">prioridad</span>
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
          <Metric label="Población" value={n(opp.impact.populationBenefited)} />
          <Metric label="Costo" value={cop(opp.cost)} />
          <Metric label="Acceso"
                  value={`${opp.impact.accessBefore.toFixed(0)} → ${opp.impact.accessAfter.toFixed(0)} min`} />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Bar value={Math.max(0, Math.min(1, opp.priority / 1.6))} color={famColor} height={3} />
        </div>
      </button>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Chip>{FAMILY_LABEL[opp.family]}</Chip>
        {opp.blockers > 0 && <StateBadge state="blocked">{opp.blockers} bloqueante(s)</StateBadge>}
        {opp.blockers === 0 && opp.warnings > 0 && <StateBadge state="warn">{opp.warnings} advertencia(s)</StateBadge>}
        {opp.blockers === 0 && opp.warnings === 0 && <StateBadge state="ok">sin restricciones</StateBadge>}
        <Chip title="Nivel y origen de la evidencia que sostiene la oportunidad">
          confianza <span className={
            opp.confidence.level === 'alta' ? 'text-ok' : opp.confidence.level === 'media' ? 'text-warn' : 'text-bad'
          }>{opp.confidence.level}</span>
        </Chip>
        <button
          onClick={onCompare}
          className={[
            'ml-auto rounded-md border px-2 py-0.5 text-[10px] transition-colors',
            inCompare ? 'border-accent/60 bg-accent/15 text-accent' : 'border-ink-700 text-mute-400 hover:text-paper',
          ].join(' ')}
        >
          {inCompare ? '✓ comparando' : '+ comparar'}
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-mute-500">{label}</div>
      <div className="num mt-0.5 text-[12px] font-medium">{value}</div>
    </div>
  );
}

function CompareTable({ opps }: { opps: ScoredOpportunity[] }) {
  const rows: { label: string; get: (o: ScoredOpportunity) => string; best?: 'max' | 'min'; raw?: (o: ScoredOpportunity) => number }[] = [
    { label: 'Intervención', get: (o) => o.interventionLabel },
    { label: 'Comuna', get: (o) => o.zoneName },
    { label: 'Población beneficiada', get: (o) => n(o.impact.populationBenefited), best: 'max', raw: (o) => o.impact.populationBenefited },
    { label: 'Costo', get: (o) => cop(o.cost), best: 'min', raw: (o) => o.cost },
    { label: 'Costo por beneficiario', get: (o) => cop(o.impact.costPerBeneficiary, { compact: true }), best: 'min', raw: (o) => o.impact.costPerBeneficiary },
    { label: 'Reducción de déficit', get: (o) => `${o.impact.deficitReductionPct.toFixed(1)}%`, best: 'max', raw: (o) => o.impact.deficitReductionPct },
    { label: 'Ganancia de acceso', get: (o) => `−${(o.impact.accessBefore - o.impact.accessAfter).toFixed(1)} min`, best: 'max', raw: (o) => o.impact.accessBefore - o.impact.accessAfter },
    { label: 'Riesgo', get: (o) => (o.features.risk ?? 0).toFixed(2), best: 'min', raw: (o) => o.features.risk ?? 0 },
    { label: 'Viabilidad', get: (o) => o.feasibilityScore.toFixed(2), best: 'max', raw: (o) => o.feasibilityScore },
    { label: 'Evidencia (obs.)', get: (o) => n(o.evidence.damageEvidenceCount), best: 'max', raw: (o) => o.evidence.damageEvidenceCount },
    { label: 'Confianza', get: (o) => pct(o.confidence.value), best: 'max', raw: (o) => o.confidence.value },
    { label: 'Prioridad', get: (o) => o.priority.toFixed(2), best: 'max', raw: (o) => o.priority },
  ];

  return (
    <div className="mt-2.5 overflow-x-auto">
      <table className="w-full min-w-[420px] text-[11px]">
        <thead>
          <tr>
            <th className="w-32" />
            {opps.map((o) => (
              <th key={o.id} className="px-2 pb-2 text-left">
                <div className="num text-[9px] text-mute-500">{o.code.replace('OPORTUNIDAD #', '#')}</div>
                <div className="text-[11px] font-medium">{o.interventionLabel}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const values = r.raw ? opps.map(r.raw) : [];
            const best = r.best && values.length
              ? (r.best === 'max' ? Math.max(...values) : Math.min(...values)) : null;
            return (
              <tr key={r.label} className="border-t border-ink-800">
                <td className="py-1.5 pr-2 text-mute-400">{r.label}</td>
                {opps.map((o, i) => (
                  <td key={o.id} className={[
                    'num px-2 py-1.5',
                    best !== null && values[i] === best ? 'font-semibold text-ok' : '',
                  ].join(' ')}>
                    {r.get(o)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Provenance>
        El resaltado marca el mejor valor de cada fila entre las opciones comparadas. No implica que esa
        opción sea globalmente preferible: el criterio depende del escenario.
      </Provenance>
    </div>
  );
}
