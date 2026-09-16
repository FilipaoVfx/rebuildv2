import type { Cell, Doc, Opportunity } from '../types';

export type CriterionOrigin = 'spatial' | 'structured' | 'semantic';

export interface Criterion {
  origin: CriterionOrigin;
  field: string;
  op: string;
  value: string;
  label: string;
  test?: (o: Opportunity, cell: Cell | undefined) => boolean;
}

export interface SearchResult {
  criteria: Criterion[];
  opportunities: Opportunity[];
  documents: { doc: Doc; score: number; matched: string[] }[];
  unmatchedTerms: string[];
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Rule {
  terms: string[];
  build: () => Criterion;
}

const RULES: Rule[] = [
  { terms: ['parque', 'parques', 'espacio publico', 'zona verde', 'zonas verdes', 'plaza'],
    build: () => ({ origin: 'structured', field: 'intervention.family', op: '=', value: 'espacio_publico',
      label: 'Intervención = espacio público',
      test: (o) => o.family === 'espacio_publico' }) },
  { terms: ['salud', 'hospital', 'centro de salud', 'atencion primaria'],
    build: () => ({ origin: 'structured', field: 'intervention.type', op: '=', value: 'SALUD',
      label: 'Intervención = salud', test: (o) => o.interventionType === 'SALUD' }) },
  { terms: ['colegio', 'escuela', 'educacion', 'educativo'],
    build: () => ({ origin: 'structured', field: 'intervention.type', op: '=', value: 'COLEGIO',
      label: 'Intervención = educación', test: (o) => o.interventionType === 'COLEGIO' }) },
  { terms: ['vivienda', 'viviendas', 'hogares', 'reposicion', 'alojamiento'],
    build: () => ({ origin: 'structured', field: 'intervention.type', op: '=', value: 'VIVIENDA',
      label: 'Intervención = vivienda', test: (o) => o.interventionType === 'VIVIENDA' }) },
  { terms: ['movilidad', 'peatonal', 'conexion', 'conectividad'],
    build: () => ({ origin: 'structured', field: 'intervention.type', op: '=', value: 'MOVILIDAD',
      label: 'Intervención = movilidad', test: (o) => o.interventionType === 'MOVILIDAD' }) },
  { terms: ['afectad', 'dano', 'danos', 'sismo', 'terremoto', 'destruido', 'colapso'],
    build: () => ({ origin: 'spatial', field: 'damage', op: '>', value: '0.45',
      label: 'Daño > 0.45', test: (o) => (o.features.damage ?? 0) > 0.45 }) },
  { terms: ['poblacion', 'gente', 'habitantes', 'densa', 'denso', 'mucha gente'],
    build: () => ({ origin: 'spatial', field: 'population_catchment', op: '>', value: '6.000 hab',
      label: 'Población en captación > 6.000', test: (o) => o.impact.populationBenefited > 6000 }) },
  { terms: ['deficit', 'falta espacio', 'haga falta', 'hacen falta', 'sin parques', 'poca cobertura'],
    build: () => ({ origin: 'spatial', field: 'public_space_deficit', op: '>', value: '0.6',
      label: 'Déficit de espacio público > 0.6', test: (o) => (o.features.deficit ?? 0) > 0.6 }) },
  { terms: ['riesgo bajo', 'bajo riesgo', 'seguro', 'sin riesgo', 'evitando riesgo'],
    build: () => ({ origin: 'spatial', field: 'risk', op: '<', value: '0.4',
      label: 'Riesgo < 0.4', test: (o) => (o.features.risk ?? 1) < 0.4 }) },
  { terms: ['riesgo alto', 'amenaza'],
    build: () => ({ origin: 'spatial', field: 'risk', op: '>', value: '0.5',
      label: 'Riesgo > 0.5', test: (o) => (o.features.risk ?? 0) > 0.5 }) },
  { terms: ['duplicar', 'redundancia', 'solapamiento', 'sin duplicar', 'no duplicar'],
    build: () => ({ origin: 'spatial', field: 'redundancy', op: '<', value: 'media',
      label: 'Redundancia baja (se penaliza el solapamiento)', }) },
  { terms: ['pot', 'norma', 'normativa', 'viable', 'viabilidad', 'compatible'],
    build: () => ({ origin: 'structured', field: 'feasibility.pot', op: '=', value: 'ok',
      label: 'Compatibilidad POT = ok', test: (o) => o.feasibility.some((f) => f.key === 'pot' && f.state === 'ok') }) },
  { terms: ['barato', 'economico', 'bajo costo', 'menos de'],
    build: () => ({ origin: 'structured', field: 'cost', op: '<', value: '$4B COP',
      label: 'Costo < $4B COP', test: (o) => o.cost < 4e9 }) },
  { terms: ['confianza', 'evidencia', 'verificado', 'confiable'],
    build: () => ({ origin: 'structured', field: 'confidence', op: '>=', value: 'media',
      label: 'Confianza ≥ media', test: (o) => o.confidence.value >= 0.52 }) },
  { terms: ['vulnerable', 'vulnerabilidad', 'equidad', 'pobreza'],
    build: () => ({ origin: 'spatial', field: 'social_vulnerability', op: '>', value: '0.5',
      label: 'Vulnerabilidad social > 0.5', test: (o) => (o.features.vulnerability ?? 0) > 0.5 }) },
  { terms: ['lejos', 'acceso', 'accesibilidad', 'caminando', 'minutos'],
    build: () => ({ origin: 'spatial', field: 'access_gap', op: '>', value: '12 min',
      label: 'Tiempo de acceso actual > 12 min', test: (o) => o.impact.accessBefore > 12 }) },
];

const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'que', 'en',
  'con', 'sin', 'por', 'para', 'donde', 'quiero', 'muestrame', 'dame', 'hay', 'es', 'del',
  'al', 'se', 'su', 'mas', 'pero', 'como', 'exista', 'existe', 'suficiente', 'zonas', 'zona', 'sitios']);

/**
 * Simulación en cliente del retrieval híbrido descrito en §9 del requerimiento.
 * En producción esto sería: query parser -> PostGIS (espacial) + FTS/pg_trgm
 * (léxico) + pgvector (semántico) -> ranking. Aquí se resuelve con reglas y
 * solapamiento de términos, y se etiqueta como tal en la interfaz.
 */
export function hybridSearch(
  query: string,
  opportunities: Opportunity[],
  documents: Doc[],
  cells: Cell[],
  zoneNames: { id: string; name: string }[],
): SearchResult {
  const q = strip(query.trim());
  if (!q) return { criteria: [], opportunities, documents: [], unmatchedTerms: [] };

  const criteria: Criterion[] = [];
  const used = new Set<string>();

  for (const rule of RULES) {
    const hit = rule.terms.find((t) => q.includes(strip(t)));
    if (!hit) continue;
    const crit = rule.build();
    if (criteria.some((c) => c.field === crit.field)) continue;
    criteria.push(crit);
    rule.terms.forEach((t) => strip(t).split(' ').forEach((w) => used.add(w)));
  }

  // Coincidencia de nombre de comuna: en producción sería FTS + pg_trgm.
  for (const z of zoneNames) {
    if (q.includes(strip(z.name))) {
      criteria.push({
        origin: 'spatial', field: 'zone', op: '=', value: z.name,
        label: `Comuna = ${z.name}`, test: (o) => o.zoneId === z.id,
      });
      strip(z.name).split(' ').forEach((w) => used.add(w));
    }
  }

  const tokens = q.split(/[^a-z0-9ñ]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const unmatchedTerms = [...new Set(tokens.filter((t) => !used.has(t)))];

  const tests = criteria.filter((c) => c.test);
  const filtered = opportunities.filter((o) => {
    const cell = cells[o.cell];
    return tests.every((c) => c.test!(o, cell));
  });

  // Recuperación "semántica": solapamiento de términos con las palabras clave
  // del documento. Sustituye al coseno sobre embeddings de pgvector.
  const docs = documents.map((doc) => {
    const bag = [...doc.keywords.map(strip), ...strip(doc.title).split(/\s+/)];
    const matched = tokens.filter((t) => bag.some((b) => b.includes(t) || t.includes(b)));
    const criteriaMatch = criteria.filter((c) =>
      doc.keywords.some((k) => strip(k).includes(strip(c.field.split('.').pop() ?? '')))).length;
    const score = matched.length / Math.max(3, tokens.length) + criteriaMatch * 0.18;
    return { doc, score, matched: [...new Set(matched)] };
  }).filter((d) => d.score > 0.05).sort((a, b) => b.score - a.score).slice(0, 5);

  return { criteria, opportunities: filtered, documents: docs, unmatchedTerms };
}

export const EXAMPLE_QUERIES = [
  'Zonas afectadas donde haga falta espacio público y exista población suficiente, sin duplicar cobertura',
  'Sitios con alto déficit y bajo riesgo',
  '¿Dónde hacen falta equipamientos de salud?',
  'Vivienda de reposición en zonas muy afectadas con riesgo bajo',
  'Oportunidades baratas con compatibilidad POT y confianza media',
];
