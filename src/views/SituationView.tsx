import { useMemo } from 'react';
import { contextByKey } from '../lib/contexts';
import { RAMPS, rgbCss, sample } from '../lib/palette';
import { cop, min, n, pct } from '../lib/format';
import { useStore } from '../state/store';
import { Bar, Chip, Empty, Panel, Provenance, SectionTitle, Stat } from '../components/ui';

export function SituationView() {
  const {
    data, context, zoneId, barrioId, selectZone, selectBarrio, selectOpportunity,
    scored, setView,
  } = useStore();
  const ctxDef = contextByKey(context);
  const ramp = RAMPS[context];

  const zone = data.zones.find((z) => z.id === zoneId);
  const barrio = data.barrios.find((b) => b.id === barrioId);

  const city = useMemo(() => {
    const cells = data.cells;
    const highNeed = cells.filter((c) => c.need >= 0.6);
    const highNeedPop = highNeed.reduce((a, c) => a + c.population, 0);
    const damaged = cells.filter((c) => c.damage >= 0.45);
    const damagedPop = damaged.reduce((a, c) => a + c.population, 0);
    const noEvidence = cells.filter((c) => (data.damageAssessment.get(c.i)?.evidence_count ?? 0) === 0);
    const deficitPop = cells.filter((c) => c.greenPerCap < 4).reduce((a, c) => a + c.population, 0);
    const farPop = cells.filter((c) => c.equipAccessMin > 15).reduce((a, c) => a + c.population, 0);
    const totalPop = data.meta.totals.population;
    return {
      totalPop, highNeedPop, damagedPop, deficitPop, farPop,
      noEvidenceShare: noEvidence.length / cells.length,
      highNeedShare: highNeedPop / totalPop,
    };
  }, [data]);

  /** Ranking de comunas según el contexto activo: la lista sigue al mapa. */
  const ranked = useMemo(() => {
    const val = (z: typeof data.zones[number]) => ({
      SITUACION: z.need, DAMAGE: z.damage, NEED: z.need, DEFICIT: z.deficit,
      ACCESS: Math.min(1, z.accessMin / 30), RISK: z.risk,
      OPPORTUNITIES: scored.filter((o) => o.zoneId === z.id).length / 8,
    }[context] ?? z.need);
    return [...data.zones].map((z) => ({ zone: z, value: val(z) }))
      .sort((a, b) => b.value - a.value);
  }, [data.zones, context, scored]);

  const localOpps = scored.filter((o) =>
    barrioId ? o.barrioId === barrioId : zoneId ? o.zoneId === zoneId : false);

  return (
    <div className="flex flex-col gap-3 p-3">
      {!zone && (
        <>
          <Panel className="p-4">
            <SectionTitle>Lectura del territorio</SectionTitle>
            <p className="mt-2.5 text-[13px] leading-relaxed text-mute-200">
              De <b className="text-paper">{n(city.totalPop)}</b> habitantes del área urbana,{' '}
              <b className="text-paper">{n(city.highNeedPop)}</b> ({pct(city.highNeedShare)}) viven donde
              la necesidad territorial es alta. <b className="text-paper">{n(city.damagedPop)}</b> están
              en áreas con daño consolidado significativo,{' '}
              <b className="text-paper">{n(city.deficitPop)}</b> con menos de 4 m²/hab de espacio público
              efectivo y <b className="text-paper">{n(city.farPop)}</b> a más de 15 minutos a pie del
              equipamiento más cercano.
            </p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-mute-300">
              El sistema identifica <b className="text-accent">{scored.length} oportunidades de recuperación</b>{' '}
              a partir de esos cruces.{' '}
              {(() => {
                const ex = scored.filter((o) => o.excluded).length;
                return ex === 1
                  ? '1 queda excluida por restricciones duras bajo el escenario actual.'
                  : `${ex} quedan excluidas por restricciones duras bajo el escenario actual.`;
              })()}
            </p>
            <Provenance>
              Índice de necesidad = 0,34 déficit + 0,26 daño + 0,22 vulnerabilidad + 0,18 brecha de
              equipamiento. Es una composición explícita, no un modelo entrenado.
            </Provenance>
          </Panel>

          <div className="grid grid-cols-2 gap-3">
            <Panel className="p-3.5"><Stat label="Población urbana" value={n(city.totalPop)} sub={`${n(data.meta.totals.areaHa)} ha`} /></Panel>
            <Panel className="p-3.5"><Stat label="En necesidad alta" value={n(city.highNeedPop)} tone="accent" sub={pct(city.highNeedShare)} /></Panel>
            <Panel className="p-3.5"><Stat label="Oportunidades" value={scored.length} sub={`${data.meta.counts.zones} comunas`} /></Panel>
            <Panel className="p-3.5">
              <Stat label="Sin evidencia de daño" value={pct(city.noEvidenceShare)} tone="warn"
                    sub="del territorio: no afirmamos nada ahí" />
            </Panel>
          </div>
        </>
      )}

      {zone && (
        <Panel className="animate-fade-up p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-mute-400">
                {barrio ? 'Barrio' : 'Comuna'}
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{barrio?.name ?? zone.name}</h2>
              {barrio && <div className="text-[11px] text-mute-400">Comuna {zone.name}</div>}
            </div>
            <button onClick={() => (barrio ? selectBarrio(null) : selectZone(null))}
                    className="rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mute-300 hover:text-paper">
              Subir nivel
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat size="sm" label="Población" value={n((barrio ?? zone).population)} />
            <Stat size="sm" label="Daño" value={(barrio ?? zone).damage.toFixed(2)} />
            <Stat size="sm" label="Necesidad" value={(barrio ?? zone).need.toFixed(2)} tone="accent" />
            <Stat size="sm" label="Déficit EP" value={(barrio ?? zone).deficit.toFixed(2)} />
            <Stat size="sm" label="Acceso" value={min((barrio ?? zone).accessMin)} />
            <Stat size="sm" label="Riesgo" value={(barrio ?? zone).risk.toFixed(2)} />
          </div>

          {!barrio && (
            <>
              <div className="mt-4"><SectionTitle>Barrios</SectionTitle></div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.barrios.filter((b) => b.zoneId === zone.id)
                  .sort((a, b) => b.need - a.need)
                  .map((b) => (
                    <Chip key={b.id} onClick={() => selectBarrio(b.id)}>
                      {b.name}
                      <span className="num text-mute-400">{b.need.toFixed(2)}</span>
                    </Chip>
                  ))}
              </div>
              <Provenance>
                Cada nivel revela solo lo necesario: la información técnica completa está en Evidencia.
              </Provenance>
            </>
          )}
        </Panel>
      )}

      {zone && (
        <Panel className="p-4">
          <SectionTitle right={<span className="text-[10px] text-mute-400">{localOpps.length}</span>}>
            Oportunidades aquí
          </SectionTitle>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {localOpps.length === 0 && <Empty>No hay oportunidades identificadas en este nivel.</Empty>}
            {localOpps.slice(0, 8).map((o) => (
              <button key={o.id} onClick={() => selectOpportunity(o.id)}
                      className="flex items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-left transition-colors hover:border-mute-400/50">
                <span className="num w-9 shrink-0 text-[10px] text-mute-400">
                  {o.code.replace('OPORTUNIDAD #', '#')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{o.interventionLabel}</span>
                  <span className="block text-[10px] text-mute-400">
                    {n(o.impact.populationBenefited)} hab · {cop(o.cost)}
                  </span>
                </span>
                {o.excluded && <span className="shrink-0 text-[9px] text-bad">excluida</span>}
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="p-4">
        <SectionTitle right={
          <span className="text-[10px] text-mute-400">ordenado por {ctxDef.label.toLowerCase()}</span>
        }>
          Comunas
        </SectionTitle>
        <div className="mt-2.5 flex flex-col gap-1">
          {ranked.map(({ zone: z, value }) => (
            <button
              key={z.id}
              onClick={() => selectZone(z.id === zoneId ? null : z.id)}
              className={[
                'group grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                z.id === zoneId ? 'bg-ink-700' : 'hover:bg-ink-850',
              ].join(' ')}
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[12px] font-medium">{z.name}</span>
                  <span className="num shrink-0 text-[10px] text-mute-400">{n(z.population)} hab</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={value} color={rgbCss(sample(ramp, value))} height={4} />
                </div>
              </div>
              <span className="num text-[12px] font-semibold"
                    style={{ color: rgbCss(sample(ramp, value)) }}>
                {value.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
        <Provenance>
          Fuentes del contexto activo: {ctxDef.sources.map((s) =>
            data.sourceById.get(s)?.provider ?? s).join(' · ')}.{' '}
          <button className="underline hover:text-mute-200" onClick={() => setView('evidencia')}>
            Ver procedencia
          </button>
        </Provenance>
      </Panel>
    </div>
  );
}
