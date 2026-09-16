import type { Cell, Opportunity, ScenarioWeights } from '../types';

export const DEFAULT_WEIGHTS: ScenarioWeights = {
  population: 0.6, equity: 0.4, access: 0.5, deficit: 0.6, damage: 0.5, riskTolerance: 0.35,
};

export const WEIGHT_LABELS: Record<keyof ScenarioWeights, { label: string; help: string }> = {
  population: { label: 'Población alcanzada', help: 'Prioriza intervenciones que llegan a más personas.' },
  equity: { label: 'Equidad territorial', help: 'Prioriza comunas con mayor vulnerabilidad social y menor dotación.' },
  access: { label: 'Reducción de tiempos de acceso', help: 'Prioriza donde el servicio más cercano queda más lejos.' },
  deficit: { label: 'Reducción de déficit', help: 'Prioriza donde el déficit de espacio público es mayor.' },
  damage: { label: 'Respuesta al daño', help: 'Prioriza las zonas más afectadas por el sismo.' },
  riskTolerance: { label: 'Tolerancia al riesgo', help: 'Baja tolerancia descarta oportunidades en zonas de amenaza alta.' },
};

export const SCENARIO_PRESETS: { id: string; name: string; rationale: string; weights: ScenarioWeights }[] = [
  { id: 'balanceado', name: 'Balanceado', rationale: 'Sin prioridad dominante. Punto de partida para comparar.',
    weights: DEFAULT_WEIGHTS },
  { id: 'alcance', name: 'Máximo alcance', rationale: 'Maximiza personas beneficiadas por peso invertido.',
    weights: { population: 1, equity: 0.15, access: 0.4, deficit: 0.5, damage: 0.35, riskTolerance: 0.5 } },
  { id: 'equidad', name: 'Equidad primero', rationale: 'Dirige la inversión a las comunas con mayor vulnerabilidad.',
    weights: { population: 0.3, equity: 1, access: 0.6, deficit: 0.6, damage: 0.5, riskTolerance: 0.4 } },
  { id: 'dano', name: 'Respuesta al daño', rationale: 'Concentra la recuperación donde el sismo golpeó más fuerte.',
    weights: { population: 0.45, equity: 0.4, access: 0.3, deficit: 0.3, damage: 1, riskTolerance: 0.55 } },
  { id: 'prudente', name: 'Riesgo bajo', rationale: 'Descarta suelo con amenaza alta aunque cueste alcance.',
    weights: { population: 0.6, equity: 0.4, access: 0.5, deficit: 0.6, damage: 0.4, riskTolerance: 0.05 } },
];

export interface ScoredOpportunity extends Opportunity {
  priority: number;
  priorityParts: { key: string; label: string; value: number }[];
  excluded: null | string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Baseline basado en reglas (Fase 1 del roadmap). NO es un modelo entrenado:
 * por eso el lenguaje del producto es "prioridad"/"idoneidad" y nunca
 * "probabilidad de éxito" — no existe ground truth de resultados reales.
 */
export function scoreOpportunities(
  opportunities: Opportunity[],
  cells: Cell[],
  w: ScenarioWeights,
): ScoredOpportunity[] {
  const maxPop = Math.max(...opportunities.map((o) => o.impact.populationBenefited));
  const maxCost = Math.max(...opportunities.map((o) => o.cost));

  return opportunities.map((o) => {
    const cell = cells[o.cell];
    const popN = o.impact.populationBenefited / maxPop;
    const accessGain = clamp01((o.impact.accessBefore - o.impact.accessAfter) / 14);
    const deficitGain = clamp01(o.impact.deficitReductionPct / 45);
    const damageN = o.features.damage ?? cell?.damage ?? 0;
    const equityN = clamp01((cell?.vulnerability ?? 0) * 0.65 + (o.features.equip_gap ?? 0) * 0.35);
    const riskN = o.features.risk ?? cell?.risk ?? 0;

    const parts = [
      { key: 'population', label: 'Población', value: w.population * popN },
      { key: 'equity', label: 'Equidad', value: w.equity * equityN },
      { key: 'access', label: 'Acceso', value: w.access * accessGain },
      { key: 'deficit', label: 'Déficit', value: w.deficit * deficitGain },
      { key: 'damage', label: 'Daño', value: w.damage * damageN },
      { key: 'riesgo', label: 'Riesgo', value: -(1 - w.riskTolerance) * riskN * 1.3 },
      { key: 'viabilidad', label: 'Viabilidad', value: (o.feasibilityScore - 0.5) * 0.5 },
      { key: 'costo', label: 'Costo', value: -(o.cost / maxCost) * 0.22 },
    ];
    const priority = parts.reduce((a, p) => a + p.value, 0);

    // Las restricciones duras no se compensan con puntaje: excluyen.
    const riskItem = o.feasibility.find((f) => f.key === 'risk');
    let excluded: string | null = null;
    if (riskItem?.state === 'blocked' && w.riskTolerance < 0.65) {
      excluded = 'Amenaza alta y la tolerancia al riesgo del escenario no la admite';
    } else if (o.feasibility.some((f) => f.key === 'pot' && f.state === 'blocked')) {
      excluded = 'Uso no compatible con el POT vigente';
    }

    return { ...o, priority, priorityParts: parts, excluded };
  }).sort((a, b) => b.priority - a.priority);
}
