import type { ContextKey } from '../types';

export type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Rampas secuenciales generadas desde un tono base con la MISMA curva de
 * luminosidad. Cambia el color del contexto sin cambiar cómo se lee el mapa:
 * oscuro = bajo, claro = alto, siempre.
 */
function ramp(hue: number, hueShift = 26): RGB[] {
  const stops = [
    { l: 13, s: 16 }, { l: 22, s: 34 }, { l: 32, s: 46 },
    { l: 44, s: 56 }, { l: 58, s: 64 }, { l: 74, s: 72 },
  ];
  return stops.map((st, i) => hslToRgb(hue + (hueShift * i) / (stops.length - 1), st.s, st.l));
}

export const RAMPS: Record<ContextKey, RGB[]> = {
  SITUACION: ramp(268, 78),   // violeta → ámbar: compuesto de necesidad
  DAMAGE: ramp(348, 34),      // rojo
  NEED: ramp(292, 40),        // magenta
  DEFICIT: ramp(196, -28),    // cian → azul
  ACCESS: ramp(158, 46),      // verde → lima
  RISK: ramp(22, 30),         // naranja
  OPPORTUNITIES: ramp(45, 12),// ámbar
};

export function sample(rampArr: RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(1, t)) * (rampArr.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = rampArr[i];
  const b = rampArr[Math.min(rampArr.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export const rgbCss = (c: RGB, alpha = 1) =>
  alpha === 1 ? `rgb(${c[0]} ${c[1]} ${c[2]})` : `rgb(${c[0]} ${c[1]} ${c[2]} / ${alpha})`;

export const FAMILY_COLOR: Record<string, RGB> = {
  espacio_publico: [74, 222, 128],
  equipamiento: [96, 165, 250],
  vivienda: [240, 180, 41],
  movilidad: [192, 132, 252],
};

export const FAMILY_LABEL: Record<string, string> = {
  espacio_publico: 'Espacio público',
  equipamiento: 'Equipamiento',
  vivienda: 'Vivienda',
  movilidad: 'Movilidad',
};

export const STATE_COLOR: Record<string, string> = {
  ok: 'var(--color-ok)', warn: 'var(--color-warn)', blocked: 'var(--color-bad)',
};
