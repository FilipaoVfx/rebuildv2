/**
 * Urban Recovery Intelligence — generador de datos sintéticos.
 *
 * TODO lo que produce este script es SINTÉTICO. No representa mediciones reales
 * de Pereira ni de ningún evento real. Existe para poder diseñar y evaluar la
 * experiencia de producto antes de conectar las fuentes reales (Sentinel, DANE,
 * POT/IDE AMCO, CARDER, SGC, Copernicus EMS, UNOSAT...).
 *
 * Es determinístico: misma semilla -> mismos datos. `npm run data` regenera todo.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'data');
mkdirSync(OUT, { recursive: true });

const SEED = 20260416;
const PROCESSING_VERSION = 'synthetic-0.2.0';
const GENERATED_AT = '2026-09-16T00:00:00Z';
const EVENT_DATE = '2026-04-16';

/* ------------------------------------------------------------------ RNG --- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const rand = (a = 0, b = 1) => a + (b - a) * rng();
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

/* ------------------------------------------------------------- geografía -- */
// Marco espacial aproximado del área urbana de Pereira (sintético).
const ORIGIN_LON = -75.7640;
const ORIGIN_LAT = 4.7690;
const COLS = 56;
const ROWS = 36;
const LON_STEP = 0.002857;          // ~317 m
const LAT_STEP = 0.002847;          // ~316 m
const CELL_AREA_HA = 10.0;          // ~316m x 317m ≈ 10 ha

const cx = (c) => ORIGIN_LON + (c + 0.5) * LON_STEP;
const cy = (r) => ORIGIN_LAT + (r + 0.5) * LAT_STEP;

/** Campo suave por suma de gaussianas: produce patrones orgánicos, no ruido. */
function makeField(nBlobs, spread = 0.22, anisotropy = 1) {
  const blobs = Array.from({ length: nBlobs }, () => ({
    u: rand(-0.1, 1.1),
    v: rand(-0.1, 1.1),
    s: rand(spread * 0.5, spread * 1.6),
    w: rand(0.4, 1),
    a: rand(1 / anisotropy, anisotropy),
  }));
  return (u, v) => {
    let acc = 0;
    for (const b of blobs) {
      const du = (u - b.u) / (b.s * b.a);
      const dv = (v - b.v) / b.s;
      acc += b.w * Math.exp(-(du * du + dv * dv));
    }
    return acc;
  };
}
function normalizeField(fn) {
  let min = Infinity, max = -Infinity;
  const sample = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = fn(c / (COLS - 1), r / (ROWS - 1));
    sample.push(v); if (v < min) min = v; if (v > max) max = v;
  }
  const span = max - min || 1;
  return (c, r) => (sample[r * COLS + c] - min) / span;
}

const fUrban = normalizeField(makeField(6, 0.30, 1.4));
const fDamage = normalizeField(makeField(9, 0.16, 1.2));
const fGreen = normalizeField(makeField(7, 0.13, 1.1));
const fRisk = normalizeField(makeField(5, 0.14, 2.6));   // corredores (ríos/laderas)
const fVuln = normalizeField(makeField(6, 0.22, 1.2));
const fRoads = normalizeField(makeField(8, 0.26, 1.3));
const fEquip = normalizeField(makeField(6, 0.15, 1.1));

/* --------------------------------------------------------- huella urbana -- */
const footprintNoise = normalizeField(makeField(10, 0.18, 1.5));
function inCity(c, r) {
  const u = c / (COLS - 1), v = r / (ROWS - 1);
  const du = (u - 0.5) / 0.52, dv = (v - 0.5) / 0.46;
  const radial = Math.sqrt(du * du + dv * dv);
  return radial + (footprintNoise(c, r) - 0.5) * 0.42 < 0.92;
}

/* -------------------------------------------------------------- comunas --- */
const ZONE_NAMES = [
  'Centro', 'Cuba', 'San Joaquín', 'El Jardín', 'Villa Santana', 'Universidad',
  'Río Otún', 'Ferrocarril', 'Olímpica', 'Boston', 'Del Café', 'San Nicolás',
  'Perla del Otún', 'Consota',
];
const zoneSeeds = [];
for (let i = 0; i < ZONE_NAMES.length; i++) {
  let c, r, guard = 0;
  do { c = randInt(3, COLS - 4); r = randInt(3, ROWS - 4); guard++; }
  while (guard < 200 && (!inCity(c, r) || zoneSeeds.some((s) => Math.hypot(s.c - c, s.r - r) < 7)));
  zoneSeeds.push({ c, r, id: `Z${String(i + 1).padStart(2, '0')}`, name: ZONE_NAMES[i] });
}
const zoneJitter = normalizeField(makeField(14, 0.10));

function nearestSeed(seeds, c, r, jitterAmp = 0) {
  let best = null, bestD = Infinity;
  for (const s of seeds) {
    const d = Math.hypot(s.c - c, s.r - r) + (jitterAmp ? (zoneJitter(c, r) - 0.5) * jitterAmp : 0);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/* --------------------------------------------------------------- barrios -- */
// Nombres de barrio compuestos con concordancia de género correcta.
const BARRIO_NAMES = [
  'Villa Esperanza', 'El Mirador', 'Nuevo Progreso', 'El Palmar', 'La Aurora',
  'San Cayetano', 'El Cedral', 'Los Guaduales', 'El Pinar', 'Canaán',
  'Belmonte', 'La Providencia', 'Los Laureles', 'El Bosque', 'El Recreo',
  'Los Andes', 'Cañaveral', 'La Samaria', 'El Jardín Alto', 'Villa Consota',
  'San Fernando', 'La Playita', 'El Poblado Bajo', 'Las Brisas', 'El Rocío',
  'La Unión', 'Santa Teresa', 'El Vergel', 'Los Alpes', 'La Julita',
  'Corocito', 'El Danubio', 'La Churria', 'Boquerón', 'San Camilo',
  'El Triunfo', 'La Isla', 'Los Naranjos', 'El Porvenir', 'La Macarena',
  'Villa Nueva', 'El Remanso', 'La Aurora Alta', 'Kennedy Norte', 'El Otoño',
  'Los Cristales', 'La Badea', 'El Plumón', 'San Marcos', 'La Estrella',
  'El Chaquiro', 'Villa Consuelo', 'Los Pinos', 'El Tigre', 'La Cristalina',
  'Monserrate', 'El Rosal', 'La Floresta', 'Puerto Caldas', 'El Crucero',
];
const barrioNamePool = [...BARRIO_NAMES].sort(() => rng() - 0.5);

const barrioSeeds = [];
for (const z of zoneSeeds) {
  const n = randInt(3, 5);
  for (let i = 0; i < n; i++) {
    const c = clamp(Math.round(z.c + rand(-3.6, 3.6)), 0, COLS - 1);
    const r = clamp(Math.round(z.r + rand(-3.6, 3.6)), 0, ROWS - 1);
    barrioSeeds.push({
      c, r, zoneId: z.id,
      id: `B${String(barrioSeeds.length + 1).padStart(3, '0')}`,
      name: barrioNamePool[barrioSeeds.length % barrioNamePool.length],
    });
  }
}

/* ----------------------------------------------------------------- celdas -- */
/* Pase 1 — campos base por celda. */
const cells = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (!inCity(c, r)) continue;
    const urban = fUrban(c, r);
    const zone = nearestSeed(zoneSeeds, c, r, 2.6);
    const inZoneBarrios = barrioSeeds.filter((b) => b.zoneId === zone.id);
    const barrio = nearestSeed(inZoneBarrios.length ? inZoneBarrios : barrioSeeds, c, r, 1.4);

    const builtDensity = clamp(urban * 0.85 + rand(0, 0.18));
    const population = Math.round(CELL_AREA_HA * (12 + 108 * Math.pow(builtDensity, 1.45)) * rand(0.8, 1.2));
    const damage = clamp(fDamage(c, r) * 0.72 + fRisk(c, r) * 0.2 + builtDensity * 0.14 + rand(-0.07, 0.07));
    const risk = clamp(fRisk(c, r) * 0.88 + rand(-0.06, 0.1));
    const vulnerability = clamp(fVuln(c, r) * 0.8 + (1 - urban) * 0.22 + rand(-0.06, 0.06));
    const connectivity = clamp(fRoads(c, r) * 0.82 + urban * 0.2 + rand(-0.05, 0.05));
    const landUseCompat = clamp(0.35 + (1 - risk) * 0.5 + rand(-0.14, 0.2));

    cells.push({
      i: cells.length, c, r,
      lon: Math.round(cx(c) * 1e6) / 1e6, lat: Math.round(cy(r) * 1e6) / 1e6,
      zoneId: zone.id, barrioId: barrio.id,
      population, builtDensity: r3(builtDensity), damage: r3(damage),
      risk: r3(risk), vulnerability: r3(vulnerability), connectivity: r3(connectivity),
      landUseCompat: r3(landUseCompat),
    });
  }
}
const cellByRC = new Map(cells.map((c) => [`${c.c}:${c.r}`, c]));

/* Equipamiento existente: parques y equipamientos como entidades, no como campo.
   La accesibilidad se calcula por distancia real a la entidad más cercana. */
const CELL_M = 316;
const WALK_M_PER_MIN = 75;     // ~4.5 km/h
const DETOUR = 1.35;           // factor de rodeo sobre distancia euclidiana

const PARK_NAMES = ['Parque Lineal', 'Parque del Barrio', 'Plazoleta', 'Parque Recreativo',
  'Zona Verde', 'Parque Mirador', 'Cancha Comunal', 'Parque Infantil'];
const parks = [];
{
  // Aceptación probabilística ponderada por el campo verde: produce zonas
  // bien dotadas y zonas desatendidas, que es justo lo que hay que detectar.
  const shuffled = [...cells].sort(() => rng() - 0.5);
  for (const cell of shuffled) {
    if (parks.length >= 320) break;
    const g = fGreen(cell.c, cell.r);
    if (rng() > 0.70 + 0.30 * g) continue;
    if (parks.some((p) => Math.hypot(p.c - cell.c, p.r - cell.r) < 1.4)) continue;
    parks.push({
      id: `PK-${String(parks.length + 1).padStart(3, '0')}`,
      name: `${pick(PARK_NAMES)} ${pick(BARRIO_NAMES)}`,
      c: cell.c, r: cell.r, lon: cell.lon, lat: cell.lat,
      areaM2: Math.round((2500 + Math.pow(g, 0.8) * 70000 * rand(0.4, 1.7)) / 100) * 100,
      zoneId: cell.zoneId,
      state: rng() < 0.22 ? 'afectado' : 'operativo',
      source_id: 'SRC-OSM',
    });
  }
}

const EQUIP_KINDS = [
  { kind: 'salud', label: 'Centro de salud', n: 34, sep: 2.2 },
  { kind: 'educacion', label: 'Institución educativa', n: 72, sep: 1.5 },
  { kind: 'abastecimiento', label: 'Equipamiento de abastecimiento', n: 24, sep: 2.6 },
];
const equipments = [];
for (const ek of EQUIP_KINDS) {
  const shuffled = [...cells].sort(() => rng() - 0.5);
  let n = 0;
  for (const cell of shuffled) {
    if (n >= ek.n) break;
    const e = fEquip(cell.c, cell.r);
    if (rng() > 0.12 + 0.88 * Math.pow(e, 1.4)) continue;
    if (equipments.some((x) => x.kind === ek.kind && Math.hypot(x.c - cell.c, x.r - cell.r) < ek.sep)) continue;
    equipments.push({
      id: `EQ-${String(equipments.length + 1).padStart(3, '0')}`,
      kind: ek.kind, label: ek.label,
      name: `${ek.label} ${pick(BARRIO_NAMES)}`,
      c: cell.c, r: cell.r, lon: cell.lon, lat: cell.lat,
      zoneId: cell.zoneId,
      state: rng() < 0.18 ? 'fuera_de_servicio' : 'operativo',
      source_id: 'SRC-OSM',
    });
    n++;
  }
}

/* Pase 2 — accesibilidad y déficit derivados de las entidades anteriores. */
function nearestDistM(list, cell, filter) {
  let best = Infinity;
  for (const p of list) {
    if (filter && !filter(p)) continue;
    const d = Math.hypot(p.c - cell.c, p.r - cell.r) * CELL_M;
    if (d < best) best = d;
  }
  return best;
}
const NB_RADIUS_CELLS = Math.ceil(500 / CELL_M);
function neighborhood(cell, radiusCells) {
  const out = [];
  for (let dr = -radiusCells; dr <= radiusCells; dr++) for (let dc = -radiusCells; dc <= radiusCells; dc++) {
    if (Math.hypot(dc, dr) > radiusCells) continue;
    const n = cellByRC.get(`${cell.c + dc}:${cell.r + dr}`);
    if (n) out.push(n);
  }
  return out;
}
for (const cell of cells) {
  const nb = neighborhood(cell, NB_RADIUS_CELLS);
  const nbPop = nb.reduce((a, n) => a + n.population, 0);
  // Decaimiento por distancia (kernel 500 m) en lugar de un corte duro: evita
  // que una celda tenga "cero espacio público" por 20 m de diferencia.
  const greenAccessM2 = parks.reduce((a, p) => {
    if (p.state !== 'operativo') return a;
    const d = Math.hypot(p.c - cell.c, p.r - cell.r) * CELL_M;
    if (d > 1400) return a;
    return a + p.areaM2 * Math.exp(-Math.pow(d / 500, 2));
  }, 0);

  const dPark = nearestDistM(parks, cell, (p) => p.state === 'operativo');
  const dEquip = nearestDistM(equipments, cell, (e) => e.state === 'operativo');
  const dHealth = nearestDistM(equipments, cell, (e) => e.kind === 'salud' && e.state === 'operativo');
  const dSchool = nearestDistM(equipments, cell, (e) => e.kind === 'educacion' && e.state === 'operativo');

  cell.greenM2 = Math.round(greenAccessM2);
  cell.greenPerCap = r2(nbPop ? greenAccessM2 / nbPop : 0);
  cell.deficit = r3(clamp(1 - cell.greenPerCap / 10));
  cell.accessMin = r2(Math.min(40, (dPark * DETOUR) / WALK_M_PER_MIN));
  cell.equipAccessMin = r2(Math.min(45, (dEquip * DETOUR) / WALK_M_PER_MIN));
  cell.healthAccessMin = r2(Math.min(60, (dHealth * DETOUR) / WALK_M_PER_MIN));
  cell.schoolAccessMin = r2(Math.min(60, (dSchool * DETOUR) / WALK_M_PER_MIN));
  cell.equipAccess = r3(clamp(1 - cell.equipAccessMin / 35));
  cell.need = r3(clamp(0.34 * cell.deficit + 0.26 * cell.damage + 0.22 * cell.vulnerability + 0.18 * (1 - cell.equipAccess)));
}

/* Percentiles: permiten comparar variables de naturaleza distinta sin que una
   escala domine a las demás (se usan para elegir el tipo de intervención). */
function percentiles(values) {
  const sorted = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  sorted.forEach(([, i], rank) => { out[i] = values.length > 1 ? rank / (values.length - 1) : 0; });
  return out;
}
const PCT = {
  deficit: percentiles(cells.map((c) => c.deficit)),
  damage: percentiles(cells.map((c) => c.damage)),
  density: percentiles(cells.map((c) => c.builtDensity)),
  pop: percentiles(cells.map((c) => c.population)),
  risk: percentiles(cells.map((c) => c.risk)),
  vuln: percentiles(cells.map((c) => c.vulnerability)),
  accessGap: percentiles(cells.map((c) => c.accessMin)),
  healthGap: percentiles(cells.map((c) => c.healthAccessMin)),
  schoolGap: percentiles(cells.map((c) => c.schoolAccessMin)),
  equipGap: percentiles(cells.map((c) => c.equipAccessMin)),
  connGap: percentiles(cells.map((c) => 1 - c.connectivity)),
};
cells.forEach((c) => { c.pct = {}; for (const k of Object.keys(PCT)) c.pct[k] = r3(PCT[k][c.i]); });

/* -------------------------------------------- evidencia de daño (RD-02) --- */
const DAMAGE_SOURCES = [
  { id: 'SRC-EMS', provider: 'Copernicus EMS', product: 'EMSR-SYN-742 / Grading map v2', weight: 0.9, method: 'remote_sensing' },
  { id: 'SRC-UNOSAT', provider: 'UNOSAT', product: 'Damage Assessment SYN-2026-04', weight: 0.85, method: 'remote_sensing' },
  { id: 'SRC-S1', provider: 'ESA Sentinel-1', product: 'Coherence change detection', weight: 0.6, method: 'remote_sensing' },
  { id: 'SRC-DIGER', provider: 'DIGER Pereira', product: 'Censo de afectación en campo', weight: 1.0, method: 'field_survey' },
  { id: 'SRC-CIUD', provider: 'Reportes ciudadanos', product: 'Formulario abierto de afectación', weight: 0.35, method: 'citizen_report' },
];
const DAMAGE_CLASSES = ['sin_dano_visible', 'posiblemente_danado', 'danado', 'severamente_danado', 'destruido'];

const damageEvidence = [];
const damageByCell = new Map();
const evidenceTarget = 1150;
for (let k = 0; k < evidenceTarget; k++) {
  // muestreo por rechazo ponderado por daño: la evidencia se concentra donde hay daño
  let cell = null;
  for (let t = 0; t < 40; t++) {
    const cand = cells[Math.floor(rng() * cells.length)];
    if (rng() < Math.pow(cand.damage, 1.6) + 0.04) { cell = cand; break; }
  }
  if (!cell) cell = cells[Math.floor(rng() * cells.length)];

  const src = rng() < 0.42 ? DAMAGE_SOURCES[randInt(0, 2)]
    : rng() < 0.55 ? DAMAGE_SOURCES[3] : DAMAGE_SOURCES[4];
  // la clase observada depende del daño real del área + ruido propio de la fuente
  const noise = src.method === 'citizen_report' ? 0.30 : src.method === 'field_survey' ? 0.08 : 0.18;
  const level = clamp(cell.damage + rand(-noise, noise));
  const cls = DAMAGE_CLASSES[Math.min(4, Math.floor(level * 5))];
  const dayOffset = src.method === 'field_survey' ? randInt(6, 48)
    : src.method === 'citizen_report' ? randInt(0, 30) : randInt(1, 12);
  const obsDate = new Date(Date.parse(EVENT_DATE + 'T00:00:00Z') + dayOffset * 86400000)
    .toISOString().slice(0, 10);

  const ev = {
    id: `DE-${String(k + 1).padStart(5, '0')}`,
    cell: cell.i,
    lon: r3(cell.lon + rand(-0.0012, 0.0012) * 1000) / 1000,
    lat: r3(cell.lat + rand(-0.0012, 0.0012) * 1000) / 1000,
    source_id: src.id,
    provider: src.provider,
    product: src.product,
    method: src.method,
    damage_class: cls,
    observation_date: obsDate,
    ingestion_date: new Date(Date.parse(obsDate + 'T00:00:00Z') + randInt(1, 6) * 86400000).toISOString().slice(0, 10),
    original_id: `${src.id.replace('SRC-', '')}-${randInt(10000, 99999)}`,
    license: src.method === 'citizen_report' ? 'CC-BY-SA 4.0 (sintético)' : 'CC-BY 4.0 (sintético)',
  };
  damageEvidence.push(ev);
  if (!damageByCell.has(cell.i)) damageByCell.set(cell.i, []);
  damageByCell.get(cell.i).push(ev);
}

/* -------- consolidación separada: damage_assessment != damage_evidence --- */
const damageAssessment = [];
for (const cell of cells) {
  const evs = damageByCell.get(cell.i) || [];
  if (!evs.length) {
    damageAssessment.push({
      cell: cell.i, damage_class: null, evidence_count: 0, source_count: 0,
      agreement_score: null, verification_status: 'sin_evidencia', confidence: 0.0,
    });
    continue;
  }
  const idx = evs.map((e) => DAMAGE_CLASSES.indexOf(e.damage_class));
  const mean = idx.reduce((a, b) => a + b, 0) / idx.length;
  const variance = idx.reduce((a, b) => a + (b - mean) ** 2, 0) / idx.length;
  const agreement = clamp(1 - variance / 2.4);
  const sources = new Set(evs.map((e) => e.source_id));
  const verified = evs.some((e) => e.method === 'field_survey');
  const confidence = clamp(
    0.28 + 0.30 * agreement + 0.22 * Math.min(1, sources.size / 3) +
    0.12 * Math.min(1, evs.length / 8) + (verified ? 0.12 : 0)
  );
  damageAssessment.push({
    cell: cell.i,
    damage_class: DAMAGE_CLASSES[Math.round(mean)],
    evidence_count: evs.length,
    source_count: sources.size,
    agreement_score: r2(agreement),
    verification_status: verified ? 'verificado_en_campo' : sources.size >= 2 ? 'corroborado_multifuente' : 'fuente_unica',
    confidence: r2(confidence),
  });
}
const assessByCell = new Map(damageAssessment.map((d) => [d.cell, d]));

/* ------------------------------------------------------------- comunas ---- */
const zones = zoneSeeds.map((z) => {
  const zc = cells.filter((c) => c.zoneId === z.id);
  const pop = zc.reduce((a, c) => a + c.population, 0);
  const wavg = (f) => zc.reduce((a, c) => a + f(c) * c.population, 0) / (pop || 1);
  return {
    id: z.id, name: z.name, kind: 'comuna',
    center: [r3(cx(z.c) * 1000) / 1000, r3(cy(z.r) * 1000) / 1000],
    cells: zc.map((c) => c.i),
    population: pop,
    areaHa: r2(zc.length * CELL_AREA_HA),
    damage: r3(wavg((c) => c.damage)),
    need: r3(wavg((c) => c.need)),
    deficit: r3(wavg((c) => c.deficit)),
    risk: r3(wavg((c) => c.risk)),
    vulnerability: r3(wavg((c) => c.vulnerability)),
    accessMin: r2(wavg((c) => c.accessMin)),
    greenPerCap: r2(wavg((c) => c.greenPerCap)),
    evidenceCount: zc.reduce((a, c) => a + (damageByCell.get(c.i)?.length || 0), 0),
    damageConfidence: r2(zc.reduce((a, c) => a + (assessByCell.get(c.i)?.confidence || 0), 0) / (zc.length || 1)),
  };
}).filter((z) => z.cells.length > 0);

const barrios = barrioSeeds.map((b) => {
  const bc = cells.filter((c) => c.barrioId === b.id);
  const pop = bc.reduce((a, c) => a + c.population, 0);
  const wavg = (f) => bc.reduce((a, c) => a + f(c) * c.population, 0) / (pop || 1);
  return {
    id: b.id, name: b.name, zoneId: b.zoneId,
    center: [r3(cx(b.c) * 1000) / 1000, r3(cy(b.r) * 1000) / 1000],
    cells: bc.map((c) => c.i),
    population: pop,
    damage: r3(wavg((c) => c.damage)),
    need: r3(wavg((c) => c.need)),
    deficit: r3(wavg((c) => c.deficit)),
    risk: r3(wavg((c) => c.risk)),
    accessMin: r2(wavg((c) => c.accessMin)),
  };
}).filter((b) => b.cells.length > 0);

/* -------------------------------------------------------- intervenciones -- */
const INTERVENTIONS = {
  PARQUE: { label: 'Parque urbano', family: 'espacio_publico', radiusM: 500, unit: 'm²', min: 2200, max: 6200, cop: 1_180_000, icon: 'park' },
  PLAZA: { label: 'Plaza / espacio público', family: 'espacio_publico', radiusM: 380, unit: 'm²', min: 900, max: 2600, cop: 1_420_000, icon: 'plaza' },
  COLEGIO: { label: 'Equipamiento educativo', family: 'equipamiento', radiusM: 850, unit: 'm²', min: 900, max: 1700, cop: 4_400_000, icon: 'school' },
  SALUD: { label: 'Centro de salud', family: 'equipamiento', radiusM: 1250, unit: 'm²', min: 650, max: 1350, cop: 5_100_000, icon: 'health' },
  VIVIENDA: { label: 'Vivienda de reposición', family: 'vivienda', radiusM: 320, unit: 'viviendas', min: 38, max: 84, cop: 92_000_000, icon: 'housing' },
  MERCADO: { label: 'Equipamiento de abastecimiento', family: 'equipamiento', radiusM: 700, unit: 'm²', min: 700, max: 1600, cop: 3_300_000, icon: 'market' },
  MOVILIDAD: { label: 'Conexión peatonal / movilidad', family: 'movilidad', radiusM: 900, unit: 'm lineales', min: 350, max: 1100, cop: 5_600_000, icon: 'mobility' },
};

/** Ordena los tipos de intervención según cuál brecha es dominante en esa celda.
 *  Se comparan percentiles, no valores crudos: así ninguna variable gana por escala. */
function chooseIntervention(cell, assess) {
  const p = cell.pct;
  const scores = {
    PARQUE: 1.00 * p.deficit + 0.40 * p.accessGap + 0.22 * p.pop,
    PLAZA: 0.72 * p.deficit + 0.85 * p.density + 0.25 * p.accessGap,
    COLEGIO: 1.05 * p.schoolGap + 0.40 * p.vuln + 0.30 * p.pop,
    SALUD: 1.05 * p.healthGap + 0.55 * p.vuln + 0.25 * p.damage,
    VIVIENDA: 1.40 * p.damage + 0.35 * p.vuln - 0.55 * p.risk,
    MERCADO: 0.95 * p.equipGap + 0.55 * p.density,
    MOVILIDAD: 1.25 * p.connGap + 0.35 * p.accessGap,
  };
  if (assess && (assess.damage_class === 'destruido' || assess.damage_class === 'severamente_danado')) {
    scores.VIVIENDA += 0.30;
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/** Celdas dentro del radio de captación. */
function catchmentCells(cell, radiusM) {
  const rad = radiusM / 316;
  const out = [];
  const R = Math.ceil(rad);
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    if (Math.hypot(dc, dr) > rad) continue;
    const n = cellByRC.get(`${cell.c + dc}:${cell.r + dr}`);
    if (n) out.push(n.i);
  }
  return out;
}

const FEATURE_DEFS = [
  { key: 'population', label: 'Población en captación', get: (ctx) => clamp(ctx.catchPop / 22000) },
  { key: 'deficit', label: 'Déficit de espacio público', get: (ctx) => ctx.cell.deficit },
  { key: 'damage', label: 'Afectación post-sismo', get: (ctx) => ctx.cell.damage },
  { key: 'access_gap', label: 'Brecha de accesibilidad', get: (ctx) => clamp(ctx.cell.accessMin / 30) },
  { key: 'vulnerability', label: 'Vulnerabilidad social', get: (ctx) => ctx.cell.vulnerability },
  { key: 'equip_gap', label: 'Déficit de equipamientos', get: (ctx) => 1 - ctx.cell.equipAccess },
  { key: 'connectivity', label: 'Conectividad vial', get: (ctx) => ctx.cell.connectivity },
  { key: 'land_use', label: 'Compatibilidad de uso (POT)', get: (ctx) => ctx.cell.landUseCompat },
  { key: 'risk', label: 'Riesgo (penaliza)', get: (ctx) => ctx.cell.risk },
];

// Pesos del baseline basado en reglas (Fase 1 del roadmap: NO es un modelo de ML).
const BASE_WEIGHTS = {
  population: 0.20, deficit: 0.18, damage: 0.15, access_gap: 0.12,
  vulnerability: 0.12, equip_gap: 0.08, connectivity: 0.06, land_use: 0.09,
  risk: -0.14,
};

/* --------------------------------------------- selección de oportunidades - */
const candidates = cells
  .map((cell) => {
    const catch_ = catchmentCells(cell, 500);
    const catchPop = catch_.reduce((a, i) => a + cells[i].population, 0);
    const ctx = { cell, catchPop };
    const f = {};
    for (const d of FEATURE_DEFS) f[d.key] = r3(d.get(ctx));
    const score = Object.entries(BASE_WEIGHTS).reduce((a, [k, w]) => a + w * f[k], 0);
    return { cell, f, score };
  })
  .sort((a, b) => b.score - a.score);

const chosen = [];
for (const cand of candidates) {
  if (chosen.length >= 38) break;
  if (chosen.some((o) => Math.hypot(o.cell.c - cand.cell.c, o.cell.r - cand.cell.r) < 3.2)) continue;
  chosen.push(cand);
}

const POT_NOTES = {
  ok: 'Uso compatible con el tratamiento urbanístico vigente.',
  warn: 'Requiere concepto de norma específica antes de formulación.',
  blocked: 'Suelo de protección: uso no compatible sin modificación del POT.',
};

const takenByBarrio = new Map();   // barrioId -> Set(tipos ya propuestos)
const opportunities = chosen.map((cand, idx) => {
  const cell = cand.cell;
  const assess = assessByCell.get(cell.i);
  // Proponer tres veces lo mismo en el mismo barrio no es un portafolio, es un
  // artefacto del ranking: se baja al siguiente tipo cuando ya está cubierto.
  const ranking = chooseIntervention(cell, assess);
  const taken = takenByBarrio.get(cell.barrioId) ?? new Set();
  const type = ranking.find((t) => !taken.has(t)) ?? ranking[0];
  taken.add(type);
  takenByBarrio.set(cell.barrioId, taken);
  const spec = INTERVENTIONS[type];
  const zone = zones.find((z) => z.id === cell.zoneId);
  const barrio = barrios.find((b) => b.id === cell.barrioId);

  const catch_ = catchmentCells(cell, spec.radiusM);
  const catchCells = catch_.map((i) => cells[i]);
  const catchPop = catchCells.reduce((a, c) => a + c.population, 0);
  const size = spec.unit === 'viviendas' ? randInt(spec.min, spec.max)
    : Math.round(rand(spec.min, spec.max) / 50) * 50;
  const cost = Math.round(size * spec.cop * rand(0.92, 1.12));

  // features + score (vista técnica, RF-05)
  const ctx = { cell, catchPop };
  const features = {};
  for (const d of FEATURE_DEFS) features[d.key] = r3(d.get(ctx));
  const contributions = Object.entries(BASE_WEIGHTS)
    .map(([k, w]) => ({ key: k, weight: w, value: features[k], contribution: r3(w * features[k]) }));
  const score = r3(contributions.reduce((a, c) => a + c.contribution, 0));

  // impacto (estimado por reglas, no por un modelo entrenado)
  const deficitBefore = r2(catchCells.reduce((a, c) => a + c.deficit * c.population, 0) / (catchPop || 1));
  const newGreenM2 = spec.family === 'espacio_publico' ? size : 0;
  const deficitAfter = spec.family === 'espacio_publico'
    ? r2(clamp(deficitBefore - clamp(newGreenM2 / (catchPop * 10 || 1)) * 0.86))
    : r2(deficitBefore);
  const accessBefore = r2(catchCells.reduce((a, c) => a + c.accessMin * c.population, 0) / (catchPop || 1));
  const accessAfter = r2(Math.max(3.2, accessBefore * (spec.family === 'espacio_publico' ? rand(0.52, 0.68) : rand(0.68, 0.84))));
  const householdsRehoused = type === 'VIVIENDA' ? size : 0;

  // viabilidad (RF-04)
  const potState = cell.landUseCompat > 0.62 ? 'ok' : cell.landUseCompat > 0.42 ? 'warn' : 'blocked';
  const riskState = cell.risk < 0.42 ? 'ok' : cell.risk < 0.66 ? 'warn' : 'blocked';
  const areaState = rng() < 0.72 ? 'ok' : rng() < 0.7 ? 'warn' : 'blocked';
  const accessState = cell.connectivity > 0.55 ? 'ok' : cell.connectivity > 0.34 ? 'warn' : 'blocked';
  const infraState = rng() < 0.68 ? 'ok' : 'warn';
  const tenureState = rng() < 0.55 ? 'ok' : rng() < 0.75 ? 'warn' : 'blocked';
  const feasibility = [
    { key: 'pot', label: 'Compatibilidad POT', state: potState, note: POT_NOTES[potState], source: 'SRC-POT' },
    { key: 'risk', label: 'Riesgo', state: riskState, source: 'SRC-SGC',
      note: riskState === 'ok' ? 'Fuera de zonas de amenaza alta mapeadas.' : riskState === 'warn' ? 'Amenaza media: requiere estudio de detalle.' : 'Amenaza alta por remoción en masa.' },
    { key: 'area', label: 'Disponibilidad de área', state: areaState, source: 'SRC-CAT',
      note: areaState === 'ok' ? 'Predios contiguos suficientes para el área requerida.' : areaState === 'warn' ? 'Área alcanzable solo con englobe de 2+ predios.' : 'Área insuficiente en el polígono identificado.' },
    { key: 'access', label: 'Accesibilidad', state: accessState, source: 'SRC-OSM',
      note: accessState === 'ok' ? 'Conectado a malla vial secundaria.' : accessState === 'warn' ? 'Acceso por vía terciaria en regular estado.' : 'Sin acceso vehicular directo.' },
    { key: 'infra', label: 'Infraestructura de servicios', state: infraState, source: 'SRC-AAA',
      note: infraState === 'ok' ? 'Redes de acueducto y energía disponibles.' : 'Requiere extensión de redes.' },
    { key: 'tenure', label: 'Situación predial', state: tenureState, source: 'SRC-CAT',
      note: tenureState === 'ok' ? 'Predio público o de fácil adquisición.' : tenureState === 'warn' ? 'Predio privado: requiere negociación.' : 'Predio con conflicto de titularidad.' },
  ];
  const blockers = feasibility.filter((f) => f.state === 'blocked').length;
  const warnings = feasibility.filter((f) => f.state === 'warn').length;
  const feasibilityScore = r2(clamp(1 - blockers * 0.34 - warnings * 0.11));

  // evidencia y confianza
  const evIds = (damageByCell.get(cell.i) || []).slice(0, 6).map((e) => e.id);
  const catchEvidence = catch_.reduce((a, i) => a + (damageByCell.get(i)?.length || 0), 0);
  const sourceIds = new Set((damageByCell.get(cell.i) || []).map((e) => e.source_id));
  const confidenceValue = r2(clamp(
    0.30 + 0.22 * (assess?.confidence || 0) + 0.18 * Math.min(1, catchEvidence / 18) +
    0.16 * Math.min(1, sourceIds.size / 3) + 0.14 * (1 - Math.abs(0.5 - cell.landUseCompat))
  ));
  const confidenceLevel = confidenceValue > 0.72 ? 'alta' : confidenceValue > 0.52 ? 'media' : 'baja';

  // "¿Por qué aquí?" — factores ordenados por contribución real al score
  const reasons = contributions
    .filter((c) => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution).slice(0, 5)
    .map((c) => ({
      key: c.key,
      label: FEATURE_DEFS.find((d) => d.key === c.key).label,
      value: c.value,
      contribution: c.contribution,
    }));

  const problemText = {
    PARQUE: `Concentración de población con déficit de espacio público y afectación por el sismo. ${Math.round(catchPop).toLocaleString('es-CO')} personas dentro de 500 m tienen ${deficitBefore > 0.7 ? 'menos de 3' : 'menos de 6'} m² de espacio público efectivo por habitante.`,
    PLAZA: `Tejido denso sin espacio público de proximidad. El tiempo medio de acceso a un espacio abierto es de ${accessBefore} minutos.`,
    COLEGIO: `Brecha de equipamiento educativo frente a la población en edad escolar, agravada por daños en infraestructura existente.`,
    SALUD: `Cobertura de atención primaria insuficiente para la población del área de influencia, con vulnerabilidad social alta.`,
    VIVIENDA: `Concentración de edificaciones con daño severo o destruidas; hogares en alojamiento temporal sin solución de reposición en sitio.`,
    MERCADO: `Ausencia de equipamiento de abastecimiento de proximidad; la población depende de desplazamientos largos.`,
    MOVILIDAD: `Fragmentación de la malla peatonal: barreras físicas aíslan el área del resto de la comuna.`,
  }[type];

  return {
    id: `OP-${String(idx + 1).padStart(3, '0')}`,
    code: `OPORTUNIDAD #${String(idx + 1).padStart(3, '0')}`,
    title: `${spec.label} — ${barrio?.name || zone?.name}`,
    zoneId: cell.zoneId,
    zoneName: zone?.name,
    barrioId: cell.barrioId,
    barrioName: barrio?.name,
    cell: cell.i,
    center: [cell.lon, cell.lat],
    interventionType: type,
    interventionLabel: spec.label,
    family: spec.family,
    size, unit: spec.unit,
    radiusM: spec.radiusM,
    catchment: catch_,
    problem: problemText,
    reasons,
    features,
    contributions,
    score,
    impact: {
      populationBenefited: catchPop,
      deficitBefore, deficitAfter,
      deficitReductionPct: r2(deficitBefore > 0 ? ((deficitBefore - deficitAfter) / deficitBefore) * 100 : 0),
      accessBefore, accessAfter,
      newGreenM2, householdsRehoused,
      costPerBeneficiary: Math.round(cost / (catchPop || 1)),
    },
    feasibility, feasibilityScore, blockers, warnings,
    cost,
    confidence: { value: confidenceValue, level: confidenceLevel,
      drivers: [
        { label: 'Evidencia de daño en el área', value: r2(Math.min(1, catchEvidence / 18)), detail: `${catchEvidence} observaciones en la captación` },
        { label: 'Concordancia entre fuentes', value: assess?.agreement_score ?? 0, detail: assess ? `${assess.source_count} fuentes, ${assess.verification_status}` : 'sin evidencia directa' },
        { label: 'Cobertura normativa (POT)', value: r2(cell.landUseCompat), detail: 'capa POT sintética, sin verificación jurídica' },
      ] },
    evidence: {
      damageEvidenceIds: evIds,
      damageEvidenceCount: catchEvidence,
      assessment: assess,
      datasets: ['SRC-DANE', 'SRC-OSM', 'SRC-POT', 'SRC-EMS', 'SRC-SGC'],
      documents: [],
    },
    provenance: {
      processing_version: PROCESSING_VERSION,
      generator: 'rule_based_baseline',
      model_version: 'baseline-weights-v1',
      generated_at: GENERATED_AT,
      parameters: { weights: BASE_WEIGHTS, catchment_radius_m: spec.radiusM },
    },
  };
});

/* ------------------------------------------------------------- documentos - */
const DOC_TEMPLATES = [
  ['POT Pereira — Componente urbano: sistema de espacio público', 'normativa', 'SRC-POT',
    'El sistema de espacio público efectivo se estructura sobre parques de escala zonal y barrial. El índice mínimo adoptado es de 10 m² por habitante, con una meta intermedia de 6 m²/hab al año 2030.',
    ['espacio público', 'déficit', 'parque', 'norma', 'índice', 'POT']],
  ['POT Pereira — Tratamientos urbanísticos y usos compatibles', 'normativa', 'SRC-POT',
    'Los tratamientos de renovación y mejoramiento integral admiten la localización de equipamientos colectivos y espacio público sin requerir modificación excepcional de norma.',
    ['POT', 'uso compatible', 'tratamiento', 'equipamiento', 'renovación']],
  ['CARDER — Estudio de amenaza por movimientos en masa', 'estudio', 'SRC-CARDER',
    'Las laderas del corredor del río Otún presentan amenaza alta por remoción en masa. Se recomienda restringir usos residenciales y priorizar espacio público de bajo impacto.',
    ['riesgo', 'amenaza', 'remoción en masa', 'ladera', 'Otún']],
  ['SGC — Microzonificación sísmica preliminar', 'estudio', 'SRC-SGC',
    'La respuesta sísmica local varía significativamente entre depósitos de ladera y terrazas aluviales, con factores de amplificación entre 1.2 y 2.4.',
    ['sismo', 'microzonificación', 'amplificación', 'riesgo', 'suelo']],
  ['DANE — Proyecciones de población por manzana', 'dataset', 'SRC-DANE',
    'Las proyecciones a nivel de manzana permiten estimar población beneficiada por área de captación de equipamientos.',
    ['población', 'densidad', 'manzana', 'proyección', 'censo']],
  ['Copernicus EMS — Grading map post-evento', 'evidencia', 'SRC-EMS',
    'Producto de evaluación rápida de daños derivado de imágenes de muy alta resolución. La clasificación indica daño observable desde la vertical y no sustituye la inspección estructural.',
    ['daño', 'satélite', 'evidencia', 'evaluación rápida', 'post-sismo']],
  ['UNOSAT — Damage assessment report', 'evidencia', 'SRC-UNOSAT',
    'Evaluación independiente de daños. Se recomienda corroboración en campo antes de decisiones de demolición o reposición.',
    ['daño', 'satélite', 'verificación', 'corroboración']],
  ['DIGER — Censo de afectación y alojamientos temporales', 'evidencia', 'SRC-DIGER',
    'Registro de hogares afectados y ubicación de alojamientos temporales. Es la fuente de mayor precisión para decisiones de vivienda de reposición.',
    ['vivienda', 'hogares', 'alojamiento', 'afectación', 'reposición']],
  ['Estudio de déficit de espacio público efectivo', 'estudio', 'SRC-ALC',
    'El déficit no se distribuye de forma homogénea: las comunas con mayor densidad concentran la menor dotación por habitante y los mayores tiempos de acceso.',
    ['déficit', 'espacio público', 'cobertura', 'parque', 'accesibilidad', 'equidad']],
  ['Cobertura de equipamientos de salud y educación', 'estudio', 'SRC-ALC',
    'El análisis de áreas de servicio muestra zonas sin cobertura de atención primaria dentro de 15 minutos caminando.',
    ['equipamiento', 'salud', 'educación', 'cobertura', 'accesibilidad']],
  ['IDEAM — Series de precipitación y escenarios de inundación', 'dataset', 'SRC-IDEAM',
    'Los escenarios de precipitación extrema aumentan el área expuesta en los corredores hídricos urbanos.',
    ['inundación', 'clima', 'riesgo', 'corredor hídrico']],
  ['OpenStreetMap — Extracto de malla vial y equipamientos', 'dataset', 'SRC-OSM',
    'Base de referencia para cálculo de accesibilidad peatonal y conectividad de la malla vial.',
    ['malla vial', 'accesibilidad', 'conectividad', 'OSM', 'red']],
  ['Lineamientos de equidad territorial en la inversión de recuperación', 'normativa', 'SRC-ALC',
    'La inversión debe evitar concentrarse en una sola comuna. Se adopta un criterio de equilibrio territorial en la conformación de portafolios.',
    ['equidad', 'portafolio', 'inversión', 'distribución', 'territorial']],
  ['Metodología de estimación de costos de referencia', 'metodologia', 'SRC-ALC',
    'Los costos son valores de referencia por metro cuadrado o por unidad de vivienda; no sustituyen presupuesto de obra.',
    ['costo', 'presupuesto', 'estimación', 'referencia', 'metodología']],
  ['Nota metodológica — Del dato a la oportunidad', 'metodologia', 'SRC-ALC',
    'La cadena dato → evidencia → necesidad → oportunidad → intervención → impacto se documenta para cada resultado, incluyendo versión de procesamiento y parámetros.',
    ['metodología', 'trazabilidad', 'provenance', 'evidencia', 'reproducibilidad']],
  ['Registro de brechas de datos conocidas', 'metodologia', 'SRC-ALC',
    'Se declaran explícitamente las áreas sin cobertura de evidencia, los datasets desactualizados y las variables estimadas por regla en lugar de medidas.',
    ['brecha', 'cobertura', 'dato faltante', 'honestidad', 'limitación']],
];

const documents = DOC_TEMPLATES.map((d, i) => ({
  id: `DOC-${String(i + 1).padStart(3, '0')}`,
  title: d[0], type: d[1], source_id: d[2], excerpt: d[3], keywords: d[4],
  date: `202${randInt(4, 6)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
  pages: randInt(4, 180),
  license: 'Uso público (sintético)',
  original_url: `synthetic://${d[2].toLowerCase()}/doc-${i + 1}`,
}));

/* ---------------------------------------------------------------- fuentes - */
const sources = [
  { id: 'SRC-EMS', name: 'Copernicus EMS — Rapid Mapping', provider: 'Copernicus / EU', dataset: 'EMSR-SYN-742 Grading map v2', kind: 'evidencia_dano', observation_date: '2026-04-21', ingestion_date: '2026-04-24', license: 'CC-BY 4.0 (sintético)', original_url: 'synthetic://copernicus/emsr-syn-742', processing_version: PROCESSING_VERSION, freshness_days: 148, coverage: 0.93, reliability: 0.88, note: 'Detección desde la vertical. No implica evaluación estructural.' },
  { id: 'SRC-UNOSAT', name: 'UNOSAT — Damage Assessment', provider: 'UNITAR/UNOSAT', dataset: 'SYN-2026-04', kind: 'evidencia_dano', observation_date: '2026-04-23', ingestion_date: '2026-04-27', license: 'CC-BY 4.0 (sintético)', original_url: 'synthetic://unosat/syn-2026-04', processing_version: PROCESSING_VERSION, freshness_days: 146, coverage: 0.81, reliability: 0.85, note: 'Cobertura parcial del área urbana.' },
  { id: 'SRC-S1', name: 'Sentinel-1 — Coherence change', provider: 'ESA', dataset: 'S1-COH-SYN', kind: 'evidencia_dano', observation_date: '2026-04-18', ingestion_date: '2026-04-19', license: 'Copernicus Open (sintético)', original_url: 'synthetic://esa/s1-coh-syn', processing_version: PROCESSING_VERSION, freshness_days: 151, coverage: 1.0, reliability: 0.6, note: 'El cambio de coherencia no equivale a edificio destruido.' },
  { id: 'SRC-DIGER', name: 'DIGER — Censo de afectación', provider: 'Alcaldía de Pereira / DIGER', dataset: 'censo_afectacion_2026', kind: 'evidencia_dano', observation_date: '2026-05-30', ingestion_date: '2026-06-04', license: 'Uso institucional (sintético)', original_url: 'synthetic://diger/censo-2026', processing_version: PROCESSING_VERSION, freshness_days: 109, coverage: 0.54, reliability: 0.97, note: 'Máxima confiabilidad, menor cobertura. Levantamiento en curso.' },
  { id: 'SRC-CIUD', name: 'Reportes ciudadanos', provider: 'Alcaldía de Pereira', dataset: 'reportes_abiertos', kind: 'evidencia_dano', observation_date: '2026-05-16', ingestion_date: '2026-05-16', license: 'CC-BY-SA 4.0 (sintético)', original_url: 'synthetic://pereira/reportes', processing_version: PROCESSING_VERSION, freshness_days: 123, coverage: 0.38, reliability: 0.35, note: 'Sesgo de reporte: sobre-representa zonas con mayor conectividad.' },
  { id: 'SRC-DANE', name: 'DANE — Población por manzana', provider: 'DANE', dataset: 'proyecciones_manzana_2026', kind: 'poblacion', observation_date: '2026-01-01', ingestion_date: '2026-03-02', license: 'Datos abiertos (sintético)', original_url: 'synthetic://dane/manzana-2026', processing_version: PROCESSING_VERSION, freshness_days: 258, coverage: 1.0, reliability: 0.9, note: 'Proyección, no censo del año en curso.' },
  { id: 'SRC-POT', name: 'POT / IDE AMCO — Norma urbana', provider: 'IDE AMCO', dataset: 'pot_vigente', kind: 'normativa', observation_date: '2025-08-12', ingestion_date: '2026-02-11', license: 'Datos abiertos (sintético)', original_url: 'synthetic://amco/pot', processing_version: PROCESSING_VERSION, freshness_days: 400, coverage: 1.0, reliability: 0.8, note: 'La compatibilidad mostrada es indicativa, no un concepto de norma.' },
  { id: 'SRC-CARDER', name: 'CARDER — Amenaza y riesgo', provider: 'CARDER', dataset: 'amenaza_movimientos_masa', kind: 'riesgo', observation_date: '2024-11-20', ingestion_date: '2026-02-11', license: 'Datos abiertos (sintético)', original_url: 'synthetic://carder/amenaza', processing_version: PROCESSING_VERSION, freshness_days: 665, coverage: 0.88, reliability: 0.82, note: 'Desactualizado respecto al evento de 2026.' },
  { id: 'SRC-SGC', name: 'SGC — Microzonificación sísmica', provider: 'Servicio Geológico Colombiano', dataset: 'microzonificacion_pre', kind: 'riesgo', observation_date: '2026-06-10', ingestion_date: '2026-06-18', license: 'Datos abiertos (sintético)', original_url: 'synthetic://sgc/microzonificacion', processing_version: PROCESSING_VERSION, freshness_days: 98, coverage: 0.72, reliability: 0.86, note: 'Versión preliminar post-evento.' },
  { id: 'SRC-IDEAM', name: 'IDEAM — Clima e inundación', provider: 'IDEAM', dataset: 'escenarios_precipitacion', kind: 'riesgo', observation_date: '2025-12-01', ingestion_date: '2026-02-20', license: 'Datos abiertos (sintético)', original_url: 'synthetic://ideam/escenarios', processing_version: PROCESSING_VERSION, freshness_days: 289, coverage: 1.0, reliability: 0.75, note: '' },
  { id: 'SRC-OSM', name: 'OpenStreetMap — Malla vial y equipamientos', provider: 'OSM Contributors', dataset: 'osm_pereira_extract', kind: 'base', observation_date: '2026-09-01', ingestion_date: '2026-09-02', license: 'ODbL (sintético)', original_url: 'synthetic://osm/pereira', processing_version: PROCESSING_VERSION, freshness_days: 15, coverage: 0.96, reliability: 0.78, note: 'Cobertura desigual en periferia.' },
  { id: 'SRC-CAT', name: 'Catastro — Predios', provider: 'Catastro Municipal', dataset: 'predios_2026', kind: 'base', observation_date: '2026-03-15', ingestion_date: '2026-04-02', license: 'Uso institucional (sintético)', original_url: 'synthetic://catastro/predios', processing_version: PROCESSING_VERSION, freshness_days: 185, coverage: 0.91, reliability: 0.83, note: 'Titularidad no verificada jurídicamente.' },
  { id: 'SRC-AAA', name: 'Empresa de servicios — Redes', provider: 'Aguas y Aguas / Energía', dataset: 'redes_servicios', kind: 'base', observation_date: '2025-10-05', ingestion_date: '2026-02-28', license: 'Uso institucional (sintético)', original_url: 'synthetic://servicios/redes', processing_version: PROCESSING_VERSION, freshness_days: 346, coverage: 0.86, reliability: 0.7, note: '' },
  { id: 'SRC-ALC', name: 'Alcaldía de Pereira — Estudios y lineamientos', provider: 'Alcaldía de Pereira', dataset: 'estudios_recuperacion', kind: 'documental', observation_date: '2026-07-01', ingestion_date: '2026-07-10', license: 'Uso público (sintético)', original_url: 'synthetic://pereira/estudios', processing_version: PROCESSING_VERSION, freshness_days: 77, coverage: 0.6, reliability: 0.8, note: '' },
];

/* ------------------------------------------------- brechas declaradas ----- */
const cellsWithoutEvidence = cells.filter((c) => !damageByCell.has(c.i)).length;
const gaps = [
  { id: 'GAP-01', severity: 'alta', title: 'Evidencia de daño incompleta',
    detail: `${cellsWithoutEvidence} de ${cells.length} celdas (${Math.round((cellsWithoutEvidence / cells.length) * 100)}%) no tienen ninguna observación de daño. En esas áreas el sistema no afirma nada sobre afectación.`,
    affects: ['damage', 'need', 'opportunities'] },
  { id: 'GAP-02', severity: 'alta', title: 'El censo de campo cubre el 54% del área urbana',
    detail: 'La fuente más confiable (DIGER) tiene la menor cobertura. Las zonas evaluadas solo por sensores remotos tienen confianza estructuralmente menor.', affects: ['damage', 'confidence'] },
  { id: 'GAP-03', severity: 'media', title: 'Capa de riesgo anterior al evento',
    detail: 'La amenaza por movimientos en masa (CARDER, 2024) no incorpora los cambios inducidos por el sismo de abril de 2026.', affects: ['risk', 'feasibility'] },
  { id: 'GAP-04', severity: 'media', title: 'Situación predial no verificada jurídicamente',
    detail: 'La disponibilidad de suelo es una estimación catastral. Ninguna oportunidad debe formularse sin verificación de titularidad.', affects: ['feasibility', 'cost'] },
  { id: 'GAP-05', severity: 'media', title: 'Costos de referencia, no presupuestos',
    detail: 'Los costos se estiman por valor unitario de referencia. La dispersión real esperada es de ±30%.', affects: ['cost', 'portfolio'] },
  { id: 'GAP-06', severity: 'baja', title: 'Sin ground truth de resultados',
    detail: 'No existe registro de intervención real → resultado real. Por eso el sistema habla de "idoneidad" y "prioridad", nunca de "probabilidad de éxito".', affects: ['scoring'] },
  { id: 'GAP-07', severity: 'critica', title: 'Todo el conjunto de datos es sintético',
    detail: 'Estos datos se generan con un modelo determinístico para diseñar y evaluar la experiencia de producto. Ninguna cifra corresponde a mediciones reales de Pereira.', affects: ['*'] },
];

/* -------------------------------------------------------------- escritura - */
const meta = {
  generated_at: GENERATED_AT,
  seed: SEED,
  processing_version: PROCESSING_VERSION,
  synthetic: true,
  event: { name: 'Sismo de Pereira (escenario sintético)', date: EVENT_DATE, magnitude: 6.4 },
  grid: { originLon: ORIGIN_LON, originLat: ORIGIN_LAT, cols: COLS, rows: ROWS, lonStep: LON_STEP, latStep: LAT_STEP, cellAreaHa: CELL_AREA_HA },
  bbox: [ORIGIN_LON, ORIGIN_LAT, ORIGIN_LON + COLS * LON_STEP, ORIGIN_LAT + ROWS * LAT_STEP],
  center: [ORIGIN_LON + (COLS * LON_STEP) / 2, ORIGIN_LAT + (ROWS * LAT_STEP) / 2],
  counts: {
    cells: cells.length, zones: zones.length, barrios: barrios.length,
    opportunities: opportunities.length, damageEvidence: damageEvidence.length,
    documents: documents.length, sources: sources.length,
    parks: parks.length, equipments: equipments.length,
  },
  totals: {
    population: cells.reduce((a, c) => a + c.population, 0),
    areaHa: r2(cells.length * CELL_AREA_HA),
  },
  weights: BASE_WEIGHTS,
  featureDefs: FEATURE_DEFS.map((d) => ({ key: d.key, label: d.label })),
  interventions: INTERVENTIONS,
  damageClasses: DAMAGE_CLASSES,
};

// Formato columnar para la grilla: mucho más liviano que GeoJSON por celda.
const grid = {
  keys: ['c', 'r', 'zoneId', 'barrioId', 'population', 'builtDensity', 'damage', 'greenM2',
    'greenPerCap', 'deficit', 'accessMin', 'equipAccessMin', 'healthAccessMin',
    'schoolAccessMin', 'risk', 'vulnerability', 'connectivity', 'equipAccess',
    'landUseCompat', 'need'],
  rows: cells.map((c) => [c.c, c.r, c.zoneId, c.barrioId, c.population, c.builtDensity,
    c.damage, c.greenM2, c.greenPerCap, c.deficit, c.accessMin, c.equipAccessMin,
    c.healthAccessMin, c.schoolAccessMin, c.risk, c.vulnerability, c.connectivity,
    c.equipAccess, c.landUseCompat, c.need]),
};

const write = (name, obj) => {
  const p = resolve(OUT, name);
  writeFileSync(p, JSON.stringify(obj));
  return `${name} ${(JSON.stringify(obj).length / 1024).toFixed(0)} KB`;
};

const report = [
  write('meta.json', meta),
  write('grid.json', grid),
  write('zones.json', zones),
  write('barrios.json', barrios),
  write('opportunities.json', opportunities),
  write('damage-evidence.json', damageEvidence),
  write('damage-assessment.json', damageAssessment),
  write('documents.json', documents),
  write('sources.json', sources),
  write('parks.json', parks),
  write('equipments.json', equipments),
  write('gaps.json', gaps),
];
console.log('Datos sintéticos generados en /public/data');
for (const line of report) console.log('  ·', line);
console.log(`  · ${cells.length} celdas · ${zones.length} comunas · ${barrios.length} barrios · ${opportunities.length} oportunidades`);
