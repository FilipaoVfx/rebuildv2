import type { Cell, ContextKey } from '../types';

export interface ContextDef {
  key: ContextKey;
  label: string;
  question: string;
  /** Valor 0..1 por celda que se pinta en el mapa. */
  value: (c: Cell) => number;
  /** Etiqueta legible del valor crudo. */
  readout: (c: Cell) => string;
  legend: [string, string];
  unit: string;
  sources: string[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const CONTEXTS: ContextDef[] = [
  {
    key: 'SITUACION', label: 'Situación', question: '¿Qué está pasando en el territorio?',
    value: (c) => c.need,
    readout: (c) => `Índice de necesidad ${c.need.toFixed(2)}`,
    legend: ['Estable', 'Crítico'], unit: 'índice compuesto',
    sources: ['SRC-DANE', 'SRC-EMS', 'SRC-OSM', 'SRC-POT'],
  },
  {
    key: 'DAMAGE', label: 'Daño', question: '¿Dónde hubo afectación por el sismo?',
    value: (c) => c.damage,
    readout: (c) => `Índice de daño ${c.damage.toFixed(2)}`,
    legend: ['Sin daño', 'Daño severo'], unit: 'índice de daño consolidado',
    sources: ['SRC-EMS', 'SRC-UNOSAT', 'SRC-S1', 'SRC-DIGER', 'SRC-CIUD'],
  },
  {
    key: 'NEED', label: 'Necesidad', question: '¿Dónde se concentra la necesidad?',
    value: (c) => clamp01(c.need * 0.62 + (c.population / 1400) * 0.38),
    readout: (c) => `${c.population.toLocaleString('es-CO')} hab · necesidad ${c.need.toFixed(2)}`,
    legend: ['Baja', 'Alta'], unit: 'necesidad ponderada por población',
    sources: ['SRC-DANE', 'SRC-EMS', 'SRC-OSM'],
  },
  {
    key: 'DEFICIT', label: 'Déficit', question: '¿Dónde falta espacio público?',
    value: (c) => c.deficit,
    readout: (c) => `${c.greenPerCap.toFixed(1)} m²/hab de espacio público efectivo`,
    legend: ['Dotado', 'Sin dotación'], unit: 'déficit frente a 10 m²/hab',
    sources: ['SRC-OSM', 'SRC-DANE', 'SRC-POT'],
  },
  {
    key: 'ACCESS', label: 'Acceso', question: '¿A cuánto está el servicio más cercano?',
    value: (c) => clamp01(c.equipAccessMin / 30),
    readout: (c) => `${c.equipAccessMin.toFixed(0)} min a pie al equipamiento más cercano`,
    legend: ['< 5 min', '> 30 min'], unit: 'minutos caminando',
    sources: ['SRC-OSM'],
  },
  {
    key: 'RISK', label: 'Riesgo', question: '¿Dónde no se debería intervenir?',
    value: (c) => c.risk,
    readout: (c) => `Índice de amenaza ${c.risk.toFixed(2)}`,
    legend: ['Bajo', 'Alto'], unit: 'amenaza por movimientos en masa e inundación',
    sources: ['SRC-CARDER', 'SRC-SGC', 'SRC-IDEAM'],
  },
  {
    key: 'OPPORTUNITIES', label: 'Oportunidades', question: '¿Dónde podemos actuar?',
    value: (c) => c.need * 0.55 + (1 - c.risk) * 0.2 + c.landUseCompat * 0.25,
    readout: (c) => `Idoneidad base ${(c.need * 0.55 + (1 - c.risk) * 0.2 + c.landUseCompat * 0.25).toFixed(2)}`,
    legend: ['Poco idóneo', 'Idóneo'], unit: 'idoneidad (baseline por reglas)',
    sources: ['SRC-POT', 'SRC-SGC', 'SRC-DANE', 'SRC-OSM'],
  },
];

export const contextByKey = (k: ContextKey) => CONTEXTS.find((c) => c.key === k)!;
