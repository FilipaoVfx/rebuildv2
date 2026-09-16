import type {
  Barrio, Cell, DamageAssessment, DamageEvidence, Doc, Equipment, Gap, Meta,
  Opportunity, Park, Source, Zone,
} from '../types';

export interface Dataset {
  meta: Meta;
  cells: Cell[];
  cellByRC: Map<string, Cell>;
  zones: Zone[];
  barrios: Barrio[];
  opportunities: Opportunity[];
  damageEvidence: DamageEvidence[];
  damageAssessment: Map<number, DamageAssessment>;
  documents: Doc[];
  sources: Source[];
  sourceById: Map<string, Source>;
  parks: Park[];
  equipments: Equipment[];
  gaps: Gap[];
}

const base = import.meta.env.BASE_URL;
export const dataUrl = (name: string) => `${base}data/${name}`;

async function getJSON<T>(name: string): Promise<T> {
  const res = await fetch(dataUrl(name));
  if (!res.ok) throw new Error(`No se pudo cargar ${name} (${res.status})`);
  return res.json() as Promise<T>;
}

/** La grilla viaja en formato columnar; aquí se rehidrata a objetos. */
function hydrateGrid(grid: { keys: string[]; rows: (number | string)[][] }): Cell[] {
  const { keys, rows } = grid;
  return rows.map((row, i) => {
    const o: Record<string, number | string> = { i };
    keys.forEach((k, j) => { o[k] = row[j]; });
    const c = o as unknown as Cell;
    return c;
  });
}

export async function loadDataset(): Promise<Dataset> {
  const [meta, grid, zones, barrios, opportunities, damageEvidence, damageAssessment,
    documents, sources, parks, equipments, gaps] = await Promise.all([
    getJSON<Meta>('meta.json'),
    getJSON<{ keys: string[]; rows: (number | string)[][] }>('grid.json'),
    getJSON<Zone[]>('zones.json'),
    getJSON<Barrio[]>('barrios.json'),
    getJSON<Opportunity[]>('opportunities.json'),
    getJSON<DamageEvidence[]>('damage-evidence.json'),
    getJSON<DamageAssessment[]>('damage-assessment.json'),
    getJSON<Doc[]>('documents.json'),
    getJSON<Source[]>('sources.json'),
    getJSON<Park[]>('parks.json'),
    getJSON<Equipment[]>('equipments.json'),
    getJSON<Gap[]>('gaps.json'),
  ]);

  const cells = hydrateGrid(grid);
  const { originLon, originLat, lonStep, latStep } = meta.grid;
  for (const cell of cells) {
    cell.lon = originLon + (cell.c + 0.5) * lonStep;
    cell.lat = originLat + (cell.r + 0.5) * latStep;
  }

  return {
    meta, cells,
    cellByRC: new Map(cells.map((c) => [`${c.c}:${c.r}`, c])),
    zones, barrios, opportunities, damageEvidence,
    damageAssessment: new Map(damageAssessment.map((d) => [d.cell, d])),
    documents, sources,
    sourceById: new Map(sources.map((s) => [s.id, s])),
    parks, equipments, gaps,
  };
}
