import { CONTEXTS, contextByKey } from '../lib/contexts';
import { RAMPS, rgbCss } from '../lib/palette';
import { useStore } from '../state/store';
import type { ViewKey } from '../types';
import { Chip } from './ui';

const NAV: { key: ViewKey; label: string; question: string }[] = [
  { key: 'situacion', label: 'Situación', question: '¿Qué está pasando?' },
  { key: 'oportunidades', label: 'Oportunidades', question: '¿Dónde podemos actuar?' },
  { key: 'escenarios', label: 'Escenarios', question: '¿Qué pasa si cambiamos las prioridades?' },
  { key: 'portafolio', label: 'Portafolio', question: '¿Qué combinación tiene sentido?' },
  { key: 'evidencia', label: 'Evidencia', question: '¿En qué nos estamos basando?' },
];

export function TopBar() {
  const { view, setView, data } = useStore();
  return (
    <header className="z-30 flex shrink-0 flex-col border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Glyph />
          <div className="leading-tight">
            <div className="text-[12px] font-semibold tracking-tight sm:text-[13px]">
              Urban Recovery Intelligence
            </div>
            <div className="hidden text-[10px] text-mute-400 sm:block">
              Pereira · recuperación post-sismo {data.meta.event.date.slice(0, 4)}
            </div>
          </div>
        </div>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              title={n.question}
              className={[
                'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                view === n.key ? 'bg-ink-700 text-paper' : 'text-mute-300 hover:bg-ink-850 hover:text-paper',
              ].join(' ')}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SyntheticBadge />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-ink-800 px-3 py-1.5 lg:hidden">
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setView(n.key)}
            className={[
              'shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium',
              view === n.key ? 'bg-ink-700 text-paper' : 'text-mute-300',
            ].join(' ')}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Glyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="20" height="20" rx="5" fill="none" stroke="var(--color-ink-600)" />
      <rect x="5" y="11" width="3.4" height="6" rx="1" fill="var(--color-mute-400)" />
      <rect x="9.3" y="7.5" width="3.4" height="9.5" rx="1" fill="var(--color-mute-300)" />
      <rect x="13.6" y="4.4" width="3.4" height="12.6" rx="1" fill="var(--color-accent)" />
    </svg>
  );
}

export function SyntheticBadge() {
  const { data, setView } = useStore();
  return (
    <button
      onClick={() => setView('evidencia')}
      title="Todos los datos de esta demo son generados. Ver procedencia y brechas."
      className="flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-warn transition-colors hover:bg-warn/20"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
      <span className="hidden sm:inline">DATOS SINTÉTICOS</span>
      <span className="sm:hidden">SINTÉTICO</span>
      <span className="hidden font-normal text-warn/70 md:inline">· seed {data.meta.seed}</span>
    </button>
  );
}

export function ContextSwitcher() {
  const { context, setContext } = useStore();
  const def = contextByKey(context);
  return (
    <div className="pointer-events-auto">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-ink-600 bg-ink-950/97 p-1 shadow-lg shadow-black/50 backdrop-blur sm:flex-wrap sm:overflow-visible">
        {CONTEXTS.map((c) => {
          const active = c.key === context;
          const col = rgbCss(RAMPS[c.key][4]);
          return (
            <button
              key={c.key}
              onClick={() => setContext(c.key)}
              title={c.question}
              className={[
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors',
                active ? 'bg-ink-700 text-paper' : 'text-mute-400 hover:bg-ink-850 hover:text-mute-200',
              ].join(' ')}
            >
              <span className="h-1.5 w-1.5 rounded-full"
                    style={{ background: active ? col : 'var(--color-ink-500)' }} />
              {c.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 hidden max-w-[340px] pl-1 text-[10px] leading-relaxed text-mute-400 sm:block">
        {def.question} <span className="text-mute-500">· {def.unit}</span>
      </p>
    </div>
  );
}

export function Legend() {
  const { context, data } = useStore();
  const def = contextByKey(context);
  const ramp = RAMPS[context];
  return (
    <div className="pointer-events-none rounded-lg border border-ink-600 bg-ink-950/97 px-2.5 py-2 shadow-lg shadow-black/50 backdrop-blur">
      <div className="flex h-1.5 w-32 overflow-hidden rounded-full">
        {ramp.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: rgbCss(c) }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-mute-400">
        <span>{def.legend[0]}</span><span>{def.legend[1]}</span>
      </div>
      <div className="mt-1 hidden border-t border-ink-800 pt-1 text-[9px] text-mute-500 sm:block">
        celda {Math.round(data.meta.grid.lonStep * 111320 * Math.cos((data.meta.center[1] * Math.PI) / 180))} m
      </div>
    </div>
  );
}

export function Breadcrumb() {
  const { data, zoneId, barrioId, opportunityId, selectZone, selectBarrio, selectOpportunity } = useStore();
  const zone = data.zones.find((z) => z.id === zoneId);
  const barrio = data.barrios.find((b) => b.id === barrioId);
  const opp = data.opportunities.find((o) => o.id === opportunityId);

  const crumbs = [
    { label: 'Pereira', onClick: () => selectZone(null), active: !zoneId },
    ...(zone ? [{ label: zone.name, onClick: () => selectZone(zone.id), active: !barrioId && !opportunityId }] : []),
    ...(barrio ? [{ label: barrio.name, onClick: () => selectBarrio(barrio.id), active: !opportunityId }] : []),
    ...(opp ? [{ label: opp.code, onClick: () => selectOpportunity(opp.id), active: true }] : []),
  ];

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-950/97 px-2 py-1.5 text-[11px] shadow-lg shadow-black/50 backdrop-blur">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-ink-500">/</span>}
          <button
            onClick={c.onClick}
            className={c.active ? 'font-medium text-paper' : 'text-mute-400 hover:text-paper'}
          >
            {c.label}
          </button>
        </span>
      ))}
      {!zoneId && (
        <span className="ml-1.5 hidden border-l border-ink-700 pl-2 text-[10px] text-mute-500 sm:inline">
          clic en el mapa para bajar de nivel
        </span>
      )}
    </div>
  );
}

export function CompareTray() {
  const { compare, clearCompare, toggleCompare, data, setView } = useStore();
  if (!compare.length) return null;
  const opps = compare.map((id) => data.opportunities.find((o) => o.id === id)!).filter(Boolean);
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-accent/40 bg-ink-950/97 px-2.5 py-2 shadow-lg shadow-black/50 backdrop-blur">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Comparar</span>
      {opps.map((o) => (
        <Chip key={o.id} active onClick={() => toggleCompare(o.id)} title="Quitar de la comparación">
          {o.code.replace('OPORTUNIDAD ', '')} ✕
        </Chip>
      ))}
      <button
        onClick={() => setView('oportunidades')}
        className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-ink-950 hover:bg-accent/85"
      >
        Ver comparación
      </button>
      <button onClick={clearCompare} className="px-1 text-[11px] text-mute-400 hover:text-paper">
        limpiar
      </button>
    </div>
  );
}
