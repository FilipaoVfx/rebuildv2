# Urban Recovery Intelligence — MVP de producto

Plataforma de inteligencia territorial para la recuperación urbana de Pereira después
de un sismo. Este repositorio contiene el **frontend del MVP**, construido con
**datos sintéticos** para poder diseñar y evaluar la experiencia antes de conectar
las fuentes reales.

> **Todos los datos son sintéticos.** Se generan de forma determinística a partir de
> una semilla. Ninguna cifra corresponde a mediciones reales de Pereira, y el evento
> sísmico es un escenario, no un hecho.

---

## Qué resuelve

El MVP anterior era un visor GIS: muchas capas, mucha información, pocas decisiones.
Esta versión invierte la relación —muchas fuentes para producir **pocas salidas
comprensibles**— y hace explícita la cadena:

```
DATO → EVIDENCIA → NECESIDAD → OPORTUNIDAD → INTERVENCIÓN → IMPACTO → PORTAFOLIO → DECISIÓN
```

La entidad central ya no es el `site` sino la **Recovery Opportunity**: lugar +
problema + evidencia + intervención + impacto + viabilidad + costo + confianza +
procedencia.

## Las cinco vistas

| Vista | Pregunta que responde |
|---|---|
| **Situación** | ¿Qué está pasando en el territorio? |
| **Oportunidades** | ¿Dónde podemos actuar y por qué ahí? |
| **Escenarios** | ¿Qué cambia si cambiamos las prioridades? |
| **Portafolio** | ¿Qué combinación de proyectos tiene sentido con este presupuesto? |
| **Evidencia** | ¿En qué nos estamos basando y qué no sabemos? |

### Exploración progresiva

`Ciudad → Comuna → Barrio → Oportunidad`. Cada nivel revela información adicional
solo cuando hace falta; la cámara del mapa acompaña el nivel.

### Contextos del mapa

El mapa es una interfaz espacial, no un contenedor de capas. Un solo contexto activo
a la vez: `Situación · Daño · Necesidad · Déficit · Acceso · Riesgo · Oportunidades`.
Cada uno usa una rampa secuencial con la misma curva de luminosidad, estirada al
rango real de los datos (p2–p98) para que el mapa tenga contraste en vez de un tono
plano.

---

## Decisiones de producto que se sostienen en el código

**Lenguaje calibrado.** El sistema habla de *idoneidad*, *prioridad* y *estimación*.
Nunca de *probabilidad de éxito*: no existe registro de intervención real → resultado
real que permita calibrar una predicción. El scoring es un **baseline por reglas con
pesos explícitos** (`src/lib/scoring.ts`), inspeccionable desde la vista técnica de
cada oportunidad.

**Evidencia separada del estado consolidado.** `damage-evidence.json` guarda cada
observación cruda con su fuente, fecha, licencia e identificador original.
`damage-assessment.json` consolida aparte, conservando `evidence_count`,
`source_count`, `agreement_score` y `verification_status`. Un cambio detectado por
satélite no se convierte automáticamente en "edificio destruido".

**Restricciones duras que no se compensan con puntaje.** Una oportunidad muy bien
puntuada en suelo de protección sigue siendo inviable y aparece como excluida, con el
motivo.

**Brechas declaradas.** La vista de Evidencia lista lo que el sistema *no* sabe:
cobertura incompleta, capas anteriores al evento, titularidad sin verificar, costos de
referencia que no son presupuestos.

**Cobertura marginal en el portafolio.** El optimizador greedy
(`src/lib/portfolio.ts`) cuenta población *nueva*: dos proyectos que sirven a la misma
gente no suman dos veces. Reporta redundancia, cobertura de necesidad alta y un Gini
de inversión per cápita.

**Búsqueda híbrida.** La caja de búsqueda traduce lenguaje natural a criterios y los
muestra etiquetados por el motor que los resolvería en producción
(`PostGIS` / `SQL` / `vector`), además de recuperar documentos relacionados. En esta
demo la resolución es en cliente y así se declara en la interfaz.

---

## Datos sintéticos

El generador (`scripts/generate-data.mjs`) produce un territorio coherente, no ruido:

- Grilla de **1.352 celdas** de ~317 m sobre el área urbana, con huella irregular.
- **14 comunas** y **52 barrios** por asignación al germen más cercano con borde ruidoso.
- Campos espaciales suaves (suma de gaussianas) para densidad, daño, riesgo,
  vulnerabilidad y conectividad.
- **Parques y equipamientos como entidades**: la accesibilidad se calcula por
  distancia real a la entidad más cercana (75 m/min, factor de rodeo 1,35), y el
  déficit de espacio público por un kernel de decaimiento de 500 m contra la
  población del entorno.
- **~1.150 observaciones de daño** muestreadas por rechazo según el campo de daño,
  con ruido propio de cada método de captura (campo < sensor remoto < reporte
  ciudadano).
- **38 oportunidades** con separación mínima, tipo de intervención elegido por
  percentiles de la brecha dominante y sin repetir intervención dentro de un barrio.

Salida en `public/data/`, consultable directamente desde la aplicación y desde el
navegador. La grilla viaja en formato columnar (no GeoJSON por celda) para mantener
la carga liviana.

```bash
npm run data     # regenera todo; misma semilla → mismo territorio
```

---

## Stack

React · TypeScript · Vite · Tailwind CSS v4 · MapLibre GL · deck.gl

Sin backend: el MVP es deliberadamente solo frontend. El cálculo espacial pesado
(PostGIS, vector tiles, pgvector, optimización MILP) pertenece al servidor y está
descrito en el requerimiento, no implementado aquí.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173/rebuildv2/
npm run build      # regenera datos, typecheck y build de producción
npm run preview
npm run typecheck
```

## Despliegue

GitHub Actions publica `dist/` en GitHub Pages en cada push a la rama de trabajo
(`.github/workflows/deploy.yml`). La ruta base se define en `vite.config.ts`
(`/rebuildv2/`) y puede sobreescribirse con `VITE_BASE`.

## Estructura

```
scripts/generate-data.mjs   generador determinístico de datos sintéticos
public/data/*.json          territorio generado (consultable)
src/lib/contexts.ts         definición de los contextos del mapa
src/lib/scoring.ts          baseline por reglas + escenarios
src/lib/portfolio.ts        greedy de cobertura marginal + métricas
src/lib/search.ts           simulación del retrieval híbrido
src/lib/palette.ts          rampas secuenciales derivadas de un tono
src/components/MapCanvas.tsx  capas deck.gl y encuadre progresivo
src/views/                  las cinco vistas
```

## Limitaciones conocidas

- Datos 100% sintéticos; ninguna cifra es una medición.
- El retrieval híbrido se simula en cliente con reglas y solapamiento de términos.
- El optimizador es greedy, no MILP: se prefiere explicable a óptimo.
- Los costos son valores unitarios de referencia con dispersión esperada de ±30%.
- El mapa base es un estilo público de CARTO; si no carga, la aplicación sigue
  siendo usable sobre fondo neutro.
