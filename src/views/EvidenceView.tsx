import { useMemo, useState } from 'react';
import { dataUrl } from '../data';
import { damageLabel, fecha, methodLabel, n, pct, relDays } from '../lib/format';
import { useStore } from '../state/store';
import { Bar, Chip, Panel, Provenance, SectionTitle, Stat } from '../components/ui';

const SEVERITY_TONE: Record<string, string> = {
  critica: 'border-bad/40 bg-bad/10 text-bad',
  alta: 'border-bad/30 bg-bad/5 text-bad',
  media: 'border-warn/30 bg-warn/5 text-warn',
  baja: 'border-ink-700 bg-ink-850 text-mute-300',
};

export function EvidenceView() {
  const { data } = useStore();
  const [kind, setKind] = useState<string>('todas');

  const kinds = useMemo(
    () => ['todas', ...new Set(data.sources.map((s) => s.kind))], [data.sources]);

  const sources = data.sources.filter((s) => kind === 'todas' || s.kind === kind);

  const evidenceStats = useMemo(() => {
    const byMethod = new Map<string, number>();
    const byClass = new Map<string, number>();
    for (const e of data.damageEvidence) {
      byMethod.set(e.method, (byMethod.get(e.method) ?? 0) + 1);
      byClass.set(e.damage_class, (byClass.get(e.damage_class) ?? 0) + 1);
    }
    const assessments = [...data.damageAssessment.values()];
    const withEvidence = assessments.filter((a) => a.evidence_count > 0);
    const verified = assessments.filter((a) => a.verification_status === 'verificado_en_campo');
    const corroborated = assessments.filter((a) => a.verification_status === 'corroborado_multifuente');
    const single = assessments.filter((a) => a.verification_status === 'fuente_unica');
    return {
      byMethod, byClass,
      total: data.damageEvidence.length,
      cellsWithEvidence: withEvidence.length,
      cellsTotal: assessments.length,
      verified: verified.length, corroborated: corroborated.length, single: single.length,
      avgAgreement: withEvidence.reduce((a, x) => a + (x.agreement_score ?? 0), 0) / (withEvidence.length || 1),
    };
  }, [data]);

  const files = [
    'meta.json', 'grid.json', 'zones.json', 'barrios.json', 'opportunities.json',
    'damage-evidence.json', 'damage-assessment.json', 'parks.json', 'equipments.json',
    'documents.json', 'sources.json', 'gaps.json',
  ];

  return (
    <div className="flex flex-col gap-3 p-3">
      <Panel className="border-warn/30 bg-warn/5 p-4">
        <SectionTitle>Antes que nada</SectionTitle>
        <p className="mt-2 text-[13px] leading-relaxed text-mute-200">
          Todo el conjunto de datos de esta demo es <b className="text-warn">sintético</b>. Se genera de
          forma determinística (semilla <span className="num">{data.meta.seed}</span>, versión{' '}
          <span className="font-mono text-[11px]">{data.meta.processing_version}</span>) para poder
          diseñar y evaluar la experiencia de producto antes de conectar las fuentes reales.
          Ninguna cifra corresponde a mediciones de Pereira, y el evento sísmico de{' '}
          {fecha(data.meta.event.date)} es un escenario, no un hecho.
        </p>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Cadena de trazabilidad</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          {['dato', 'evidencia', 'necesidad', 'oportunidad', 'intervención', 'impacto', 'portafolio', 'decisión']
            .map((step, i, arr) => (
              <span key={step} className="flex items-center gap-1.5">
                <span className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-mute-200">{step}</span>
                {i < arr.length - 1 && <span className="text-ink-500">→</span>}
              </span>
            ))}
        </div>
        <Provenance>
          Cada eslabón conserva su origen. Un resultado del portafolio puede rastrearse hasta el dataset,
          la versión de procesamiento, los parámetros y la fecha que lo produjeron.
        </Provenance>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Evidencia de daño ≠ estado consolidado</SectionTitle>
        <p className="mt-2 text-[12px] leading-relaxed text-mute-300">
          Las observaciones se almacenan crudas y por separado. El estado consolidado se calcula después,
          conservando cuántas fuentes lo sostienen y cuánto concuerdan entre sí. No se interpreta
          automáticamente que un cambio detectado por satélite equivalga a un edificio destruido.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat size="sm" label="Observaciones crudas" value={n(evidenceStats.total)} />
          <Stat size="sm" label="Concordancia media" value={evidenceStats.avgAgreement.toFixed(2)} />
          <Stat size="sm" label="Celdas con evidencia"
                value={pct(evidenceStats.cellsWithEvidence / evidenceStats.cellsTotal)}
                sub={`${n(evidenceStats.cellsWithEvidence)} de ${n(evidenceStats.cellsTotal)}`} />
          <Stat size="sm" label="Verificado en campo" value={n(evidenceStats.verified)} tone="ok"
                sub="celdas" />
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-mute-400">Por método de captura</div>
          <div className="mt-2 flex flex-col gap-2">
            {[...evidenceStats.byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, count]) => (
              <div key={m}>
                <div className="flex items-baseline justify-between text-[11px]">
                  <span>{methodLabel[m] ?? m}</span>
                  <span className="num text-mute-400">{n(count)}</span>
                </div>
                <div className="mt-1">
                  <Bar value={count / evidenceStats.total}
                       color={m === 'field_survey' ? 'var(--color-ok)'
                         : m === 'citizen_report' ? 'var(--color-warn)' : 'var(--color-bad)'} height={4} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-mute-400">
            Estado de verificación por celda
          </div>
          <div className="mt-2 flex flex-col gap-1.5 text-[11px]">
            <VerifyRow label="Verificado en campo" value={evidenceStats.verified}
                       total={evidenceStats.cellsTotal} tone="var(--color-ok)" />
            <VerifyRow label="Corroborado multifuente" value={evidenceStats.corroborated}
                       total={evidenceStats.cellsTotal} tone="var(--color-warn)" />
            <VerifyRow label="Fuente única" value={evidenceStats.single}
                       total={evidenceStats.cellsTotal} tone="var(--color-bad)" />
            <VerifyRow label="Sin evidencia"
                       value={evidenceStats.cellsTotal - evidenceStats.cellsWithEvidence}
                       total={evidenceStats.cellsTotal} tone="var(--color-ink-500)" />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-mute-400">Clases observadas</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.meta.damageClasses.map((c) => (
              <Chip key={c}>
                {damageLabel[c]} <span className="num text-mute-400">{n(evidenceStats.byClass.get(c) ?? 0)}</span>
              </Chip>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle right={<span className="text-[10px] text-mute-400">{sources.length}</span>}>
          Fuentes y procedencia
        </SectionTitle>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <Chip key={k} active={k === kind} onClick={() => setKind(k)}>{k.replace(/_/g, ' ')}</Chip>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {sources.map((s) => (
            <div key={s.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium">{s.name}</div>
                  <div className="text-[10px] text-mute-400">{s.provider}</div>
                </div>
                <span className={[
                  'shrink-0 rounded-md border px-1.5 py-0.5 text-[9px]',
                  s.freshness_days > 365 ? 'border-bad/35 bg-bad/10 text-bad'
                    : s.freshness_days > 180 ? 'border-warn/35 bg-warn/10 text-warn'
                    : 'border-ok/35 bg-ok/10 text-ok',
                ].join(' ')}>
                  {relDays(s.freshness_days)}
                </span>
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
                <Field k="dataset" v={s.dataset} />
                <Field k="observación" v={s.observation_date} />
                <Field k="ingesta" v={s.ingestion_date} />
                <Field k="licencia" v={s.license} />
                <Field k="versión" v={s.processing_version} />
                <Field k="url" v={s.original_url} />
              </dl>

              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-mute-500">cobertura</div>
                  <div className="mt-1"><Bar value={s.coverage} height={3} color="var(--color-mute-300)" /></div>
                  <div className="num mt-0.5 text-[10px] text-mute-400">{pct(s.coverage)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-mute-500">confiabilidad</div>
                  <div className="mt-1"><Bar value={s.reliability} height={3} color="var(--color-mute-300)" /></div>
                  <div className="num mt-0.5 text-[10px] text-mute-400">{pct(s.reliability)}</div>
                </div>
              </div>

              {s.note && <p className="mt-2 text-[10px] leading-snug text-mute-400">{s.note}</p>}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Brechas declaradas</SectionTitle>
        <p className="mt-1.5 text-[11px] text-mute-400">
          Lo que el sistema no sabe, dicho explícitamente.
        </p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {data.gaps.map((g) => (
            <li key={g.id} className={`rounded-lg border px-2.5 py-2 ${SEVERITY_TONE[g.severity]}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium">{g.title}</span>
                <span className="shrink-0 text-[9px] uppercase tracking-wider opacity-70">{g.severity}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug opacity-90">{g.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Documentos indexados</SectionTitle>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {data.documents.map((d) => (
            <li key={d.id} className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium">{d.title}</span>
                <span className="shrink-0 text-[9px] text-mute-500">{d.type}</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-mute-400">{d.excerpt}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {d.keywords.map((k) => (
                  <span key={k} className="rounded bg-ink-800 px-1.5 py-0.5 text-[9px] text-mute-400">{k}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Provenance>
          En producción estos documentos se indexarían con embeddings en pgvector para búsqueda
          semántica. Aquí la recuperación se simula por solapamiento de términos.
        </Provenance>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Datos crudos</SectionTitle>
        <p className="mt-1.5 text-[11px] text-mute-400">
          Todos los archivos que alimentan esta interfaz son consultables directamente.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {files.map((f) => (
            <a key={f} href={dataUrl(f)} target="_blank" rel="noreferrer"
               className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 font-mono text-[10px] text-mute-300 hover:border-mute-400/50 hover:text-paper">
              {f}
            </a>
          ))}
        </div>
        <Provenance>
          Regenerables con <span className="font-mono">npm run data</span>. La misma semilla produce
          exactamente el mismo territorio.
        </Provenance>
      </Panel>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-500">{k}</dt>
      <dd className="truncate text-mute-200" title={v}>{v}</dd>
    </div>
  );
}

function VerifyRow({ label, value, total, tone }: {
  label: string; value: number; total: number; tone: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-mute-200">{label}</span>
        <span className="num text-mute-400">{n(value)} · {pct(value / total)}</span>
      </div>
      <div className="mt-1"><Bar value={value / total} color={tone} height={3} /></div>
    </div>
  );
}
