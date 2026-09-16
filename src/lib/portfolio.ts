import type { Cell, Zone } from '../types';
import type { ScoredOpportunity } from './scoring';

export interface PortfolioConstraints {
  budget: number;
  maxProjects: number;
  allowBlocked: boolean;
  /** Máximo de proyectos por comuna: evita concentrar toda la inversión. */
  maxPerZone: number;
}

export interface PortfolioMetrics {
  selected: ScoredOpportunity[];
  rejected: { opp: ScoredOpportunity; reason: string }[];
  totalCost: number;
  budgetUsed: number;
  uniquePopulation: number;
  grossPopulation: number;
  redundancy: number;
  coverageHighNeed: number;
  coveredCells: number;
  zonesReached: number;
  zoneShares: { zone: Zone; population: number; cost: number; perCapita: number }[];
  gini: number;
  avgDeficitReduction: number;
  avgAccessGain: number;
  householdsRehoused: number;
  newPublicSpaceM2: number;
  constraintFlags: { level: 'warn' | 'bad'; text: string }[];
  costPerBeneficiary: number;
}

/** Gini sobre inversión per cápita por comuna. 0 = perfecta igualdad. */
function gini(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const sum = v.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  let cum = 0;
  v.forEach((x, i) => { cum += (i + 1) * x; });
  return Math.max(0, Math.min(1, (2 * cum) / (v.length * sum) - (v.length + 1) / v.length));
}

/**
 * Greedy con cobertura marginal: en cada paso elige la oportunidad con mejor
 * beneficio NUEVO por peso. Es el baseline explícito del roadmap (§18), no un
 * MILP: se prefiere un resultado explicable a uno óptimo pero opaco.
 */
export function buildPortfolio(
  scored: ScoredOpportunity[],
  cells: Cell[],
  zones: Zone[],
  constraints: PortfolioConstraints,
): PortfolioMetrics {
  const covered = new Set<number>();
  const selected: ScoredOpportunity[] = [];
  const rejected: { opp: ScoredOpportunity; reason: string }[] = [];
  const perZone = new Map<string, number>();
  let spent = 0;

  const eligible = scored.filter((o) => {
    if (o.excluded && !constraints.allowBlocked) {
      rejected.push({ opp: o, reason: o.excluded });
      return false;
    }
    return true;
  });

  const pool = [...eligible];
  while (selected.length < constraints.maxProjects) {
    let best: ScoredOpportunity | null = null;
    let bestRatio = -Infinity;

    for (const o of pool) {
      if (spent + o.cost > constraints.budget) continue;
      if ((perZone.get(o.zoneId) ?? 0) >= constraints.maxPerZone) continue;
      const marginalPop = o.catchment.reduce(
        (a, i) => a + (covered.has(i) ? 0 : cells[i]?.population ?? 0), 0);
      if (marginalPop <= 0) continue;
      // beneficio marginal = población nueva x prioridad del escenario
      const benefit = marginalPop * Math.max(0.05, o.priority);
      const ratio = benefit / (o.cost / 1e9);
      if (ratio > bestRatio) { bestRatio = ratio; best = o; }
    }

    if (!best) break;
    selected.push(best);
    spent += best.cost;
    perZone.set(best.zoneId, (perZone.get(best.zoneId) ?? 0) + 1);
    best.catchment.forEach((i) => covered.add(i));
    pool.splice(pool.indexOf(best), 1);
  }

  for (const o of pool) {
    if (rejected.some((r) => r.opp.id === o.id)) continue;
    if (spent + o.cost > constraints.budget) rejected.push({ opp: o, reason: 'No cabe en el presupuesto restante' });
    else if ((perZone.get(o.zoneId) ?? 0) >= constraints.maxPerZone) rejected.push({ opp: o, reason: `Límite de ${constraints.maxPerZone} proyectos en ${o.zoneName}` });
    else rejected.push({ opp: o, reason: 'Beneficio marginal menor que el de los seleccionados' });
  }

  const uniquePopulation = [...covered].reduce((a, i) => a + (cells[i]?.population ?? 0), 0);
  const grossPopulation = selected.reduce((a, o) => a + o.impact.populationBenefited, 0);

  const highNeed = cells.filter((c) => c.need >= 0.6);
  const highNeedCovered = highNeed.filter((c) => covered.has(c.i)).length;

  const zoneShares = zones.map((z) => {
    const zSel = selected.filter((o) => o.zoneId === z.id);
    const pop = z.cells.filter((i) => covered.has(i)).reduce((a, i) => a + (cells[i]?.population ?? 0), 0);
    const cost = zSel.reduce((a, o) => a + o.cost, 0);
    return { zone: z, population: pop, cost, perCapita: z.population ? cost / z.population : 0 };
  }).sort((a, b) => b.cost - a.cost);

  const withDeficit = selected.filter((o) => o.impact.deficitReductionPct > 0);
  const flags: { level: 'warn' | 'bad'; text: string }[] = [];
  const blocked = selected.filter((o) => o.blockers > 0);
  const warned = selected.filter((o) => o.warnings > 0);
  if (blocked.length) flags.push({ level: 'bad', text: `${blocked.length} proyecto(s) con al menos una restricción bloqueante sin resolver.` });
  if (warned.length) flags.push({ level: 'warn', text: `${warned.length} proyecto(s) requieren gestión previa (predial, norma o redes).` });
  const zonesReached = new Set(selected.map((o) => o.zoneId)).size;
  if (selected.length >= 3 && zonesReached <= Math.ceil(selected.length / 2)) {
    flags.push({ level: 'warn', text: `La inversión se concentra en ${zonesReached} comuna(s) de ${zones.length}.` });
  }
  const lowConfidence = selected.filter((o) => o.confidence.level === 'baja');
  if (lowConfidence.length) flags.push({ level: 'warn', text: `${lowConfidence.length} proyecto(s) se apoyan en evidencia de confianza baja.` });
  if (!selected.length) flags.push({ level: 'bad', text: 'Ninguna oportunidad cabe en las restricciones actuales.' });

  return {
    selected, rejected,
    totalCost: spent,
    budgetUsed: constraints.budget ? spent / constraints.budget : 0,
    uniquePopulation, grossPopulation,
    redundancy: grossPopulation ? 1 - uniquePopulation / grossPopulation : 0,
    coverageHighNeed: highNeed.length ? highNeedCovered / highNeed.length : 0,
    coveredCells: covered.size,
    zonesReached,
    zoneShares,
    gini: gini(zoneShares.filter((z) => z.cost > 0).map((z) => z.perCapita)),
    avgDeficitReduction: withDeficit.length
      ? withDeficit.reduce((a, o) => a + o.impact.deficitReductionPct, 0) / withDeficit.length : 0,
    avgAccessGain: selected.length
      ? selected.reduce((a, o) => a + (o.impact.accessBefore - o.impact.accessAfter), 0) / selected.length : 0,
    householdsRehoused: selected.reduce((a, o) => a + o.impact.householdsRehoused, 0),
    newPublicSpaceM2: selected.reduce((a, o) => a + o.impact.newGreenM2, 0),
    constraintFlags: flags,
    costPerBeneficiary: uniquePopulation ? spent / uniquePopulation : 0,
  };
}
