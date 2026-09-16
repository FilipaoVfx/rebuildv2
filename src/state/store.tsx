import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { loadDataset, type Dataset } from '../data';
import { buildPortfolio, type PortfolioConstraints, type PortfolioMetrics } from '../lib/portfolio';
import { DEFAULT_WEIGHTS, scoreOpportunities, type ScoredOpportunity } from '../lib/scoring';
import { hybridSearch, type SearchResult } from '../lib/search';
import type { ContextKey, ScenarioWeights, ViewKey } from '../types';

export type Level = 'ciudad' | 'zona' | 'barrio' | 'oportunidad';

interface Store {
  data: Dataset;
  view: ViewKey; setView: (v: ViewKey) => void;
  context: ContextKey; setContext: (c: ContextKey) => void;
  zoneId: string | null; barrioId: string | null; opportunityId: string | null;
  level: Level;
  selectZone: (id: string | null) => void;
  selectBarrio: (id: string | null) => void;
  selectOpportunity: (id: string | null) => void;
  goUp: () => void;
  weights: ScenarioWeights; setWeights: (w: ScenarioWeights) => void;
  presetId: string; setPresetId: (id: string) => void;
  constraints: PortfolioConstraints; setConstraints: (c: PortfolioConstraints) => void;
  compare: string[]; toggleCompare: (id: string) => void; clearCompare: () => void;
  technical: boolean; setTechnical: (v: boolean) => void;
  query: string; setQuery: (q: string) => void;
  scored: ScoredOpportunity[];
  visibleOpportunities: ScoredOpportunity[];
  portfolio: PortfolioMetrics;
  search: SearchResult;
  hoverCell: number | null; setHoverCell: (i: number | null) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera del provider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewKey>('situacion');
  const [context, setContext] = useState<ContextKey>('SITUACION');
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [barrioId, setBarrioId] = useState<string | null>(null);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [weights, setWeights] = useState<ScenarioWeights>(DEFAULT_WEIGHTS);
  const [presetId, setPresetId] = useState('balanceado');
  const [constraints, setConstraints] = useState<PortfolioConstraints>({
    budget: 18.4e9, maxProjects: 7, allowBlocked: false, maxPerZone: 2,
  });
  const [compare, setCompare] = useState<string[]>([]);
  const [technical, setTechnical] = useState(false);
  const [query, setQuery] = useState('');
  const [hoverCell, setHoverCell] = useState<number | null>(null);

  useEffect(() => {
    loadDataset().then(setData).catch((e: Error) => setError(e.message));
  }, []);

  const scored = useMemo(
    () => (data ? scoreOpportunities(data.opportunities, data.cells, weights) : []),
    [data, weights],
  );

  const search = useMemo(
    () => (data
      ? hybridSearch(query, data.opportunities, data.documents, data.cells,
          data.zones.map((z) => ({ id: z.id, name: z.name })))
      : { criteria: [], opportunities: [], documents: [], unmatchedTerms: [] }),
    [data, query],
  );

  const visibleOpportunities = useMemo(() => {
    let list = scored;
    if (query.trim()) {
      const ids = new Set(search.opportunities.map((o) => o.id));
      list = list.filter((o) => ids.has(o.id));
    }
    if (barrioId) list = list.filter((o) => o.barrioId === barrioId);
    else if (zoneId) list = list.filter((o) => o.zoneId === zoneId);
    return list;
  }, [scored, search, query, zoneId, barrioId]);

  const portfolio = useMemo(
    () => (data
      ? buildPortfolio(scored, data.cells, data.zones, constraints)
      : null as unknown as PortfolioMetrics),
    [data, scored, constraints],
  );

  const level: Level = opportunityId ? 'oportunidad' : barrioId ? 'barrio' : zoneId ? 'zona' : 'ciudad';

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-bad font-semibold">No se pudieron cargar los datos</p>
          <p className="mt-2 text-sm text-mute-300">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <Booting />;

  const store: Store = {
    data, view, setView, context, setContext,
    zoneId, barrioId, opportunityId, level,
    selectZone: (id) => { setZoneId(id); setBarrioId(null); setOpportunityId(null); },
    selectBarrio: (id) => {
      setBarrioId(id); setOpportunityId(null);
      if (id) setZoneId(data.barrios.find((b) => b.id === id)?.zoneId ?? null);
    },
    selectOpportunity: (id) => {
      setOpportunityId(id);
      if (id) {
        const o = data.opportunities.find((x) => x.id === id);
        if (o) { setZoneId(o.zoneId); setBarrioId(o.barrioId); }
      }
    },
    goUp: () => {
      if (opportunityId) setOpportunityId(null);
      else if (barrioId) setBarrioId(null);
      else setZoneId(null);
    },
    weights,
    setWeights: (w) => { setWeights(w); setPresetId('custom'); },
    presetId, setPresetId,
    constraints, setConstraints,
    compare,
    toggleCompare: (id) => setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]),
    clearCompare: () => setCompare([]),
    technical, setTechnical,
    query, setQuery,
    scored, visibleOpportunities, portfolio, search,
    hoverCell, setHoverCell,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

function Booting() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="h-px w-40 overflow-hidden bg-ink-700">
        <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] bg-accent" />
      </div>
      <p className="text-xs tracking-[0.18em] text-mute-400 uppercase">Cargando territorio</p>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
