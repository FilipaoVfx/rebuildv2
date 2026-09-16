import type { PickingInfo } from '@deck.gl/core';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { useControl, type MapRef, type ViewState } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { contextByKey } from '../lib/contexts';
import { FAMILY_COLOR, RAMPS, sample, type RGB } from '../lib/palette';
import { useStore } from '../state/store';
import type { Cell } from '../types';

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#080a0e' } }],
};

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export function MapCanvas() {
  const {
    data, context, level, zoneId, barrioId, opportunityId, view,
    visibleOpportunities, portfolio, selectZone, selectBarrio, selectOpportunity,
    hoverCell, setHoverCell,
  } = useStore();

  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<string | typeof BLANK_STYLE>(CARTO_STYLE);
  const [viewState, setViewState] = useState<Partial<ViewState>>({
    longitude: data.meta.center[0], latitude: data.meta.center[1],
    zoom: 11.6, pitch: 0, bearing: -12,
  });

  const ctxDef = contextByKey(context);
  const { lonStep, latStep } = data.meta.grid;

  /* ---- geometría derivada de la grilla (memoizada, no se recalcula al pintar) */
  const cellPolygons = useMemo(() => {
    const hw = lonStep / 2, hh = latStep / 2;
    return data.cells.map((c) => ({
      cell: c,
      polygon: [
        [c.lon - hw, c.lat - hh], [c.lon + hw, c.lat - hh],
        [c.lon + hw, c.lat + hh], [c.lon - hw, c.lat + hh],
      ] as [number, number][],
    }));
  }, [data.cells, lonStep, latStep]);

  /** Bordes de comuna = aristas entre celdas de comunas distintas. */
  const zoneBorders = useMemo(() => {
    const hw = lonStep / 2, hh = latStep / 2;
    const segs: { path: [number, number][] }[] = [];
    for (const c of data.cells) {
      const right = data.cellByRC.get(`${c.c + 1}:${c.r}`);
      const up = data.cellByRC.get(`${c.c}:${c.r + 1}`);
      if (!right || right.zoneId !== c.zoneId) {
        segs.push({ path: [[c.lon + hw, c.lat - hh], [c.lon + hw, c.lat + hh]] });
      }
      if (!up || up.zoneId !== c.zoneId) {
        segs.push({ path: [[c.lon - hw, c.lat + hh], [c.lon + hw, c.lat + hh]] });
      }
    }
    return segs;
  }, [data.cells, data.cellByRC, lonStep, latStep]);

  const selectedOpp = opportunityId
    ? data.opportunities.find((o) => o.id === opportunityId) ?? null : null;

  const catchmentRing = useMemo(() => {
    if (!selectedOpp) return [];
    const [lon, lat] = selectedOpp.center;
    const rLat = selectedOpp.radiusM / 111320;
    const rLon = rLat / Math.cos((lat * Math.PI) / 180);
    const ring = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return [lon + Math.cos(a) * rLon, lat + Math.sin(a) * rLat] as [number, number];
    });
    return [{ polygon: ring }];
  }, [selectedOpp]);

  /* ------------------------------------------------------------- foco ---- */
  const focusCells = useMemo(() => {
    if (barrioId) return new Set(data.barrios.find((b) => b.id === barrioId)?.cells ?? []);
    if (zoneId) return new Set(data.zones.find((z) => z.id === zoneId)?.cells ?? []);
    return null;
  }, [zoneId, barrioId, data.zones, data.barrios]);

  const catchmentSet = useMemo(
    () => (selectedOpp ? new Set(selectedOpp.catchment) : null), [selectedOpp]);

  const portfolioCatchment = useMemo(() => {
    if (view !== 'portafolio') return null;
    const s = new Set<number>();
    portfolio.selected.forEach((o) => o.catchment.forEach((i) => s.add(i)));
    return s;
  }, [view, portfolio.selected]);

  const ramp = RAMPS[context];

  /* El rango teórico 0..1 casi nunca se usa entero: estirar al rango real
     (p2–p98) es lo que hace que el mapa tenga contraste en vez de un tono plano. */
  const stretch = useMemo(() => {
    const vals = data.cells.map((c) => ctxDef.value(c)).sort((a, b) => a - b);
    const lo = vals[Math.floor(vals.length * 0.02)];
    const hi = vals[Math.floor(vals.length * 0.98)];
    const span = hi - lo || 1;
    return (v: number) => Math.max(0, Math.min(1, (v - lo) / span));
  }, [data.cells, ctxDef]);

  const showOpportunities =
    context === 'OPPORTUNITIES' || view === 'oportunidades' ||
    view === 'portafolio' || view === 'escenarios' || !!opportunityId;

  const getFill = useCallback((d: { cell: Cell }): [number, number, number, number] => {
    const c = d.cell;
    const t = stretch(ctxDef.value(c));
    const rgb: RGB = sample(ramp, t);
    let alpha = 150 + t * 85;
    if (focusCells && !focusCells.has(c.i)) alpha = 34;
    if (catchmentSet) alpha = catchmentSet.has(c.i) ? 185 : focusCells ? 28 : 52;
    if (portfolioCatchment) alpha = portfolioCatchment.has(c.i) ? 215 : 45;
    if (hoverCell === c.i) alpha = 255;
    return [rgb[0], rgb[1], rgb[2], alpha];
  }, [ctxDef, ramp, stretch, focusCells, catchmentSet, portfolioCatchment, hoverCell]);

  const layers = [
    new PolygonLayer<{ cell: Cell; polygon: [number, number][] }>({
      id: 'cells',
      data: cellPolygons,
      getPolygon: (d) => d.polygon,
      getFillColor: getFill,
      stroked: false,
      filled: true,
      extruded: false,
      pickable: true,
      onHover: (info) => setHoverCell(info.object ? info.object.cell.i : null),
      onClick: (info) => {
        if (!info.object) return;
        const c = info.object.cell as Cell;
        if (level === 'ciudad') selectZone(c.zoneId);
        else if (level === 'zona') selectBarrio(c.barrioId);
      },
      updateTriggers: {
        getFillColor: [context, hoverCell, zoneId, barrioId, opportunityId, view],
      },
      transitions: { getFillColor: 220 },
    }),

    new PathLayer<{ path: [number, number][] }>({
      id: 'zone-borders',
      data: zoneBorders,
      getPath: (d) => d.path,
      getColor: [150, 165, 185, level === 'ciudad' ? 95 : 55],
      getWidth: 1.4,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      updateTriggers: { getColor: [level] },
    }),

    ...(context === 'DEFICIT' || context === 'ACCESS' ? [
      new ScatterplotLayer({
        id: 'parks',
        data: data.parks.filter((p) => p.state === 'operativo'),
        getPosition: (d) => [d.lon, d.lat],
        getRadius: (d) => Math.sqrt(d.areaM2) * 0.55,
        radiusUnits: 'meters',
        radiusMinPixels: 1.5,
        getFillColor: [110, 231, 183, 150],
        pickable: true,
      }),
      new ScatterplotLayer({
        id: 'equipments',
        data: data.equipments.filter((e) => e.state === 'operativo'),
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 34,
        radiusUnits: 'meters',
        radiusMinPixels: 2,
        getFillColor: [147, 197, 253, 190],
        pickable: true,
      }),
    ] : []),

    ...((context === 'DAMAGE' && (viewState.zoom ?? 0) >= 12.8) || view === 'evidencia' ? [
      new ScatterplotLayer({
        id: 'damage-evidence',
        data: data.damageEvidence,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 26,
        radiusUnits: 'meters',
        radiusMinPixels: 2,
        getFillColor: (d) => (d.method === 'field_survey' ? [248, 250, 252, 215]
          : d.method === 'citizen_report' ? [251, 191, 36, 170] : [248, 113, 113, 160]),
        pickable: true,
      }),
    ] : []),

    ...(catchmentRing.length ? [
      new PolygonLayer<{ polygon: [number, number][] }>({
        id: 'catchment',
        data: catchmentRing,
        getPolygon: (d) => d.polygon,
        filled: false,
        stroked: true,
        getLineColor: [240, 180, 41, 210],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 1.5,
      }),
    ] : []),

    new ScatterplotLayer({
      id: 'opportunities',
      data: !showOpportunities ? []
        : view === 'portafolio' ? portfolio.selected : visibleOpportunities,
      getPosition: (d) => d.center,
      getRadius: (d) => 90 + Math.max(0, d.priority) * 170,
      radiusUnits: 'meters',
      radiusMinPixels: 3.5,
      radiusMaxPixels: 15,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: (d) => (d.id === opportunityId ? 3 : 1.2),
      getLineColor: (d) => (d.id === opportunityId ? [255, 255, 255, 255] : [10, 13, 18, 190]),
      getFillColor: (d) => {
        const base = FAMILY_COLOR[d.family] ?? [240, 180, 41];
        const dim = opportunityId && d.id !== opportunityId;
        return [base[0], base[1], base[2], dim ? 110 : 235];
      },
      pickable: true,
      onClick: (info) => { if (info.object) selectOpportunity(info.object.id); },
      updateTriggers: {
        getFillColor: [opportunityId], getLineWidth: [opportunityId],
        getLineColor: [opportunityId], getRadius: [visibleOpportunities],
      },
    }),
  ];

  /* ---- vuelo progresivo: cada nivel acerca la cámara (RF-03) ------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedOpp) {
      // El zoom se deriva del radio para que la captación entre completa en pantalla.
      const zoom = Math.max(12.4, Math.min(15.2, 16.2 - Math.log2(selectedOpp.radiusM / 150)));
      map.flyTo({ center: selectedOpp.center, zoom, duration: 900, essential: true });
    } else if (barrioId) {
      const b = data.barrios.find((x) => x.id === barrioId);
      if (b) map.flyTo({ center: b.center, zoom: 13.8, duration: 800, essential: true });
    } else if (zoneId) {
      const z = data.zones.find((x) => x.id === zoneId);
      if (z) map.flyTo({ center: z.center, zoom: 12.8, duration: 800, essential: true });
    } else {
      map.flyTo({ center: data.meta.center as [number, number], zoom: 11.6, duration: 800, essential: true });
    }
  }, [zoneId, barrioId, selectedOpp, data.zones, data.barrios, data.meta.center]);

  const getTooltip = useCallback((info: PickingInfo) => {
    const object = info.object as unknown;
    const layer = info.layer;
    if (!object || !layer) return null;
    const style = {
      background: 'rgba(11,14,19,.96)', color: '#e9eef5', fontSize: '11px',
      padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a3340',
      fontFamily: 'Inter, sans-serif', maxWidth: '260px', lineHeight: '1.45',
    };
    const o = object as Record<string, never>;
    if (layer.id === 'cells') {
      const c = (object as { cell: Cell }).cell;
      const zone = data.zones.find((z) => z.id === c.zoneId);
      const barrio = data.barrios.find((b) => b.id === c.barrioId);
      return {
        html: `<b>${barrio?.name ?? ''}</b><br/><span style="color:#8e9aab">${zone?.name ?? ''}</span>
        <hr style="border:0;border-top:1px solid #2a3340;margin:6px 0"/>
        ${ctxDef.readout(c)}<br/>
        <span style="color:#8e9aab">${c.population.toLocaleString('es-CO')} habitantes</span>`,
        style,
      };
    }
    if (layer.id === 'opportunities') {
      const d = object as unknown as { code: string; title: string; priority: number };
      return { html: `<b>${d.title}</b><br/><span style="color:#8e9aab">${d.code}</span>`, style };
    }
    if (layer.id === 'damage-evidence') {
      const d = object as unknown as { provider: string; damage_class: string; observation_date: string };
      return {
        html: `<b>${d.provider}</b><br/>${d.damage_class.replace(/_/g, ' ')}<br/>
        <span style="color:#8e9aab">${d.observation_date}</span>`, style,
      };
    }
    if (layer.id === 'parks') {
      const d = object as unknown as { name: string; areaM2: number };
      return { html: `<b>${d.name}</b><br/>${d.areaM2.toLocaleString('es-CO')} m²`, style };
    }
    if (layer.id === 'equipments') {
      const d = object as unknown as { name: string };
      return { html: `<b>${d.name}</b>`, style };
    }
    void o;
    return null;
  }, [data.zones, data.barrios, ctxDef]);

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        mapStyle={style as string}
        onError={() => setStyle(BLANK_STYLE)}
        attributionControl={true}
        dragRotate
        maxZoom={15.8}
        minZoom={9.5}
      >
        <DeckGLOverlay layers={layers} getTooltip={getTooltip} />
      </Map>
    </div>
  );
}
