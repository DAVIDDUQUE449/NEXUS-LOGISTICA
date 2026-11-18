# ADR-0012: Modo DEMO aislado por tenant y etiquetado obligatorio

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** sección 23, `O.09`, `N.01` (funcionalidad primero), `L.2`, `P.03`, `25` (separar entornos)

## Contexto

El producto tiene que demostrarse sin llaves de terceros y con datos ficticios realistas de Colombia. Nunca debe presentar datos simulados como reales ni insinuar una afiliación con Coordinadora Mercantil S. A.

## Decisión

1. **El DEMO es un atributo del tenant**: `core.tenant.data_mode ∈ {demo, real}`. El tenant **NEXUS DEMO COLOMBIA** (`O.09`) se crea con `demo`. Un tenant `real` no puede pasar a `demo` ni al revés; habría que crear uno nuevo.
2. **Etiqueta persistente**: si `data_mode = demo`, el `NexusAppShell` muestra la franja «ENTORNO DEMO — DATOS SIMULADOS» en todas las apps (escritorio, PWA y portal). Los exports y PDF la incluyen en el encabezado y el pie, y las respuestas de la API llevan `X-Nexus-Data-Mode: demo`.
3. **Fuente por dato**: los datos generados llevan `source = simulator` (GPS, temperatura, ETA, telemetría). La UI muestra la fuente en *tooltips* y en el inspector.
4. **Simulador** (`packages/simulation` + `apps/worker`): semilla fija, controles `Pausar / Reanudar / Reiniciar / Velocidad 1× 2× 5×` y escenarios `Simular retraso`, `Simular muelle congestionado`, `Simular bajo stock` y `Simular excursión térmica` (sección 23.2). **Solo opera sobre tenants `demo`**: lo garantizan una política y una comprobación en el servidor.
5. **Generación por casos de uso**: el *seed* no inserta filas sueltas. Invoca los casos de uso de dominio (recibir, reservar, pickear, …), así los datos DEMO respetan las mismas invariantes, eventos y auditoría que los reales.
6. **Credenciales DEMO**: se generan aleatoriamente en el *seed* y se escriben en `.demo-credentials.local` (ignorado por git). Nunca se commitean.
7. **Coordinadora**: el DEMO es una «empresa ficticia inspirada en una red de servicios de mensajería y logística en Colombia» (`P.03`). No usa logos, colores, nombres de sedes reales, tarifas ni datos de Coordinadora. Las sedes son ciudades (Cali, Palmira, Bogotá, Medellín, Barranquilla, Buenaventura) con direcciones ficticias.
8. **Escenarios reproducibles**: incluye el caso `SF-48291` (I-80/I-680, millas; sección 15.1) **claramente marcado como escenario de referencia de EE. UU.** y el caso colombiano `CAL-2026-0001` Cali → Yumbo → Palmira (km, COP, `America/Bogota`; sección 15.3). El usuario puede alternar entre ambos.

## Consecuencias

- **Positivas:** las demostraciones son honestas y reproducibles, y los datos DEMO ejercitan las mismas reglas que producción.
- **Negativas:** el *seed* por casos de uso es más lento que un volcado SQL. Se mitiga con *snapshots* de base de datos para los tests E2E.

## Verificación

- Test: cada página del Control Tower renderiza la franja DEMO cuando el tenant es `demo`.
- Test: el simulador rechaza operar sobre un tenant `real`.
