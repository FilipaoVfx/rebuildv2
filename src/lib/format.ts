const nf = new Intl.NumberFormat('es-CO');

export const n = (v: number) => nf.format(Math.round(v));

/** Pesos colombianos en miles de millones, como se usan en presupuesto público. */
export function cop(value: number, opts: { compact?: boolean } = {}): string {
  if (value >= 1e9) {
    const b = value / 1e9;
    return `$${b.toFixed(b < 10 ? 1 : 0)}B`;
  }
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return opts.compact ? `$${n(value)}` : `$${n(value)} COP`;
}

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const min = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)} min`;
export const m2 = (v: number) => `${n(v)} m²`;

export function relDays(days: number): string {
  if (days < 45) return `hace ${days} días`;
  if (days < 400) return `hace ${Math.round(days / 30)} meses`;
  return `hace ${(days / 365).toFixed(1)} años`;
}

export function fecha(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const damageLabel: Record<string, string> = {
  sin_dano_visible: 'Sin daño visible',
  posiblemente_danado: 'Posiblemente dañado',
  danado: 'Dañado',
  severamente_danado: 'Severamente dañado',
  destruido: 'Destruido',
};

export const methodLabel: Record<string, string> = {
  remote_sensing: 'Sensor remoto',
  field_survey: 'Levantamiento en campo',
  citizen_report: 'Reporte ciudadano',
};

export const verificationLabel: Record<string, string> = {
  sin_evidencia: 'Sin evidencia',
  fuente_unica: 'Fuente única',
  corroborado_multifuente: 'Corroborado multifuente',
  verificado_en_campo: 'Verificado en campo',
};
