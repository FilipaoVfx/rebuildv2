export type ContextKey =
  | 'SITUACION' | 'DAMAGE' | 'NEED' | 'DEFICIT' | 'ACCESS' | 'RISK' | 'OPPORTUNITIES';

export type ViewKey = 'situacion' | 'oportunidades' | 'escenarios' | 'portafolio' | 'evidencia';

export type FeasibilityState = 'ok' | 'warn' | 'blocked';

export interface Cell {
  i: number; c: number; r: number; lon: number; lat: number;
  zoneId: string; barrioId: string;
  population: number; builtDensity: number; damage: number;
  greenM2: number; greenPerCap: number; deficit: number;
  accessMin: number; equipAccessMin: number; healthAccessMin: number; schoolAccessMin: number;
  risk: number; vulnerability: number; connectivity: number;
  equipAccess: number; landUseCompat: number; need: number;
}

export interface Zone {
  id: string; name: string; kind: string; center: [number, number]; cells: number[];
  population: number; areaHa: number; damage: number; need: number; deficit: number;
  risk: number; vulnerability: number; accessMin: number; greenPerCap: number;
  evidenceCount: number; damageConfidence: number;
}

export interface Barrio {
  id: string; name: string; zoneId: string; center: [number, number]; cells: number[];
  population: number; damage: number; need: number; deficit: number; risk: number; accessMin: number;
}

export interface DamageEvidence {
  id: string; cell: number; lon: number; lat: number; source_id: string;
  provider: string; product: string; method: string; damage_class: string;
  observation_date: string; ingestion_date: string; original_id: string; license: string;
}

export interface DamageAssessment {
  cell: number; damage_class: string | null; evidence_count: number; source_count: number;
  agreement_score: number | null; verification_status: string; confidence: number;
}

export interface FeasibilityItem {
  key: string; label: string; state: FeasibilityState; note: string; source: string;
}

export interface Contribution { key: string; weight: number; value: number; contribution: number; }

export interface Opportunity {
  id: string; code: string; title: string;
  zoneId: string; zoneName: string; barrioId: string; barrioName: string;
  cell: number; center: [number, number];
  interventionType: string; interventionLabel: string; family: string;
  size: number; unit: string; radiusM: number; catchment: number[];
  problem: string;
  reasons: { key: string; label: string; value: number; contribution: number }[];
  features: Record<string, number>;
  contributions: Contribution[];
  score: number;
  impact: {
    populationBenefited: number; deficitBefore: number; deficitAfter: number;
    deficitReductionPct: number; accessBefore: number; accessAfter: number;
    newGreenM2: number; householdsRehoused: number; costPerBeneficiary: number;
  };
  feasibility: FeasibilityItem[];
  feasibilityScore: number; blockers: number; warnings: number;
  cost: number;
  confidence: { value: number; level: string; drivers: { label: string; value: number; detail: string }[] };
  evidence: {
    damageEvidenceIds: string[]; damageEvidenceCount: number;
    assessment: DamageAssessment | null; datasets: string[]; documents: string[];
  };
  provenance: {
    processing_version: string; generator: string; model_version: string;
    generated_at: string; parameters: Record<string, unknown>;
  };
}

export interface Source {
  id: string; name: string; provider: string; dataset: string; kind: string;
  observation_date: string; ingestion_date: string; license: string; original_url: string;
  processing_version: string; freshness_days: number; coverage: number; reliability: number; note: string;
}

export interface Doc {
  id: string; title: string; type: string; source_id: string; excerpt: string;
  keywords: string[]; date: string; pages: number; license: string; original_url: string;
}

export interface Park { id: string; name: string; c: number; r: number; lon: number; lat: number; areaM2: number; zoneId: string; state: string; source_id: string; }
export interface Equipment { id: string; kind: string; label: string; name: string; c: number; r: number; lon: number; lat: number; zoneId: string; state: string; source_id: string; }
export interface Gap { id: string; severity: string; title: string; detail: string; affects: string[]; }

export interface Meta {
  generated_at: string; seed: number; processing_version: string; synthetic: boolean;
  event: { name: string; date: string; magnitude: number };
  grid: { originLon: number; originLat: number; cols: number; rows: number; lonStep: number; latStep: number; cellAreaHa: number };
  bbox: [number, number, number, number]; center: [number, number];
  counts: Record<string, number>;
  totals: { population: number; areaHa: number };
  weights: Record<string, number>;
  featureDefs: { key: string; label: string }[];
  interventions: Record<string, { label: string; family: string; radiusM: number; unit: string; cop: number; icon: string }>;
  damageClasses: string[];
}

export interface ScenarioWeights {
  population: number; equity: number; access: number; deficit: number; damage: number;
  riskTolerance: number;
}
