import type { ReactNode } from 'react';
import { rgbCss, sample, type RGB } from '../lib/palette';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-700 bg-ink-900/85 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute-400">{children}</h3>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'default', size = 'md' }: {
  label: string; value: ReactNode; sub?: ReactNode;
  tone?: 'default' | 'accent' | 'ok' | 'warn' | 'bad'; size?: 'sm' | 'md' | 'lg';
}) {
  const toneCls = {
    default: 'text-paper', accent: 'text-accent', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad',
  }[tone];
  const sizeCls = { sm: 'text-lg', md: 'text-2xl', lg: 'text-[34px] leading-none' }[size];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.13em] text-mute-400">{label}</div>
      <div className={`num mt-1 font-semibold ${sizeCls} ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-mute-400">{sub}</div>}
    </div>
  );
}

export function Bar({ value, ramp, color, height = 6, label }: {
  value: number; ramp?: RGB[]; color?: string; height?: number; label?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  const bg = color ?? (ramp ? rgbCss(sample(ramp, v)) : 'var(--color-accent)');
  return (
    <div className="w-full">
      <div className="w-full overflow-hidden rounded-full bg-ink-700" style={{ height }}>
        <div className="h-full rounded-full transition-[width] duration-300"
             style={{ width: `${v * 100}%`, background: bg }} />
      </div>
      {label && <div className="mt-1 text-[10px] text-mute-400">{label}</div>}
    </div>
  );
}

/** Barra divergente para contribuciones positivas y negativas a un puntaje. */
export function SignedBar({ value, max }: { value: number; max: number }) {
  const w = (Math.abs(value) / max) * 50;
  const positive = value >= 0;
  return (
    <div className="relative h-2 w-full rounded-full bg-ink-800">
      <div className="absolute inset-y-0 left-1/2 w-px bg-ink-600" />
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          width: `${w}%`,
          left: positive ? '50%' : `${50 - w}%`,
          background: positive ? 'var(--color-ok)' : 'var(--color-bad)',
        }}
      />
    </div>
  );
}

export function Chip({ children, active, onClick, tone = 'default', title }: {
  children: ReactNode; active?: boolean; onClick?: () => void;
  tone?: 'default' | 'accent'; title?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
        active
          ? tone === 'accent'
            ? 'border-accent/60 bg-accent/15 text-accent'
            : 'border-mute-400/50 bg-ink-700 text-paper'
          : 'border-ink-700 bg-ink-850 text-mute-300',
        onClick ? 'hover:border-mute-400/60 hover:text-paper cursor-pointer' : '',
      ].join(' ')}
    >
      {children}
    </Tag>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

export function StateBadge({ state, children }: { state: 'ok' | 'warn' | 'blocked'; children: ReactNode }) {
  const map = {
    ok: 'border-ok/35 bg-ok/10 text-ok',
    warn: 'border-warn/35 bg-warn/10 text-warn',
    blocked: 'border-bad/35 bg-bad/10 text-bad',
  }[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${map}`}>
      {children}
    </span>
  );
}

/** Nota de procedencia: acompaña a cada cifra que no es una medición directa. */
export function Provenance({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-mute-400">
      <span className="mt-[3px] inline-block h-1 w-1 shrink-0 rounded-full bg-mute-400" />
      <span>{children}</span>
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center text-xs text-mute-400">
      {children}
    </div>
  );
}

export function Sparkline({ values, color = 'var(--color-accent)', height = 28 }: {
  values: number[]; color?: string; height?: number;
}) {
  if (!values.length) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * 100;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
