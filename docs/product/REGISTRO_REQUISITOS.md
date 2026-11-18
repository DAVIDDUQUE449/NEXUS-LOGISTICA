# Registro de requisitos — NEXUS LOGISTICS OS V2.0

> Generado a partir de la especificación maestra V2.0 (2026-11-18). Estados (`G.10`): **PENDIENTE / EN DESARROLLO / IMPLEMENTADO / PROBADO / BLOQUEADO**. Un requisito solo pasa a **PROBADO** con evidencia (commit + comando + salida).
>
> **Actualizado al cierre de los Hitos 1–2 (2026-11-18).** Evidencia: [REPORTE_HITOS_1_2](../REPORTE_HITOS_1_2.md). «PROBADO» = existe una prueba automatizada que pasa; «IMPLEMENTADO» = código sin prueba dedicada aún; «EN DESARROLLO» = parcial.

## 1. Requisitos funcionales (Apéndice M)

| ID | Requisito | Hito | Estado | Evidencia |
|---|---|---|---|---|
| M.01 | Planeación de red, sedes y centros de operaciones | 1 | EN DESARROLLO | Sedes con coordenadas y alcance por sede; faltan enlaces de red, calendarios y capacidad |
| M.02 | Alta comercial, clientes y cotizador de servicios | 7 | PENDIENTE | — |
| M.03 | OMS y gestión integral de pedidos | 7 | PENDIENTE | — |
| M.04 | Compras, abastecimiento y aviso anticipado ASN | 3 | PENDIENTE | — |
| M.05 | WMS: stock físico, ubicaciones y calidad | 3 | PENDIENTE | — |
| M.06 | Aplicación específica para PICKERS — Nexus Pick | 3 | PENDIENTE | — |
| M.07 | Aplicación específica para PACKERS — Nexus Pack | 3 | PENDIENTE | — |
| M.08 | Admisión de documentos, paquetes y mercancías ya preparadas | 4 | PENDIENTE | — |
| M.09 | Recogidas / first mile / recolecciones | 4 | PENDIENTE | — |
| M.10 | Clasificación de paquetería / HUB SORT / cross-docking | 4 | PENDIENTE | — |
| M.11 | Manifiestos, consolidación, cargue y transporte troncal | 4 | PENDIENTE | — |
| M.12 | Centro destino, desconsolidación y reparto urbano | 5 | PENDIENTE | — |
| M.13 | App completa para mensajeros y repartidores — Nexus Entregas | 5 | PENDIENTE | — |
| M.14 | App de conductores de transporte troncal — Nexus Driver | 4/6 | PENDIENTE | — |
| M.15 | App de coordinadores logísticos — Nexus Control | 6 | PENDIENTE | — |
| M.16 | Aplicación de auxiliares de clasificación y hubs — Nexus Sort | 4 | PENDIENTE | — |
| M.17 | Aplicación de recepción, control de calidad y montacarguista — Nexus Warehouse Mobile | 3 | PENDIENTE | — |
| M.18 | Aplicación para puntos de recogida y entrega (PUDO) — Nexus Points | 5 | PENDIENTE | — |
| M.19 | Servicio al cliente, novedades, reclamaciones e indemnizaciones | 7 | PENDIENTE | — |
| M.20 | Portal de clientes empresariales y rastreo público | 7 | PENDIENTE | — |
| M.21 | Recaudo contra entrega, pagos, liquidación y conciliación | 5 | PENDIENTE | — |
| M.22 | Devoluciones, rechazo, reintentos, logística inversa y recuperación | 5/7 | PENDIENTE | — |
| M.23 | Transporte, flota, patio, muelles y seguridad vial | 6 | PENDIENTE | — |
| M.24 | Cadena de frío y mercancía especial | 3/6 | PENDIENTE | — |
| M.25 | Facturación, analítica de costos, gerencia y talento operativo | 7 | PENDIENTE | — |

## 2. Casos integrales (Apéndice O.10)

Detalle de pasos y criterios en [CASOS_DE_PRUEBA](../../tests/CASOS_DE_PRUEBA.md).

| ID | Caso | Criterio mínimo | Hito | Estado | Evidencia |
|---|---|---|---|---|---|
| U01 | Recibo ASN → inspección → putaway → disponibilidad | Ledger y ubicación correctos | 3 | PENDIENTE | — |
| U02 | Pedido ecommerce → reserva → pick → pack → guía → hub → ruta → POD | Trazabilidad única y cierre correcto | 7 | PENDIENTE | — |
| U03 | Orden B2B 10 estibas → ASN → cross-dock → TMS → recibo almacén destino | No exigir flujo de paquete postal | 6 | PENDIENTE | — |
| U04 | Mensajería documento ya preparado → recogida → clasificación → entrega | No exigir SKU/inventario comercial | 4 | PENDIENTE | — |
| U05 | Picking de SKU equivocado | Bloqueo y causa registrada | 3 | PENDIENTE | — |
| U06 | Picking sin stock | Novedad y autorización, sin stock negativo | 3 | PENDIENTE | — |
| U07 | Packing con unidad faltante | Bloqueo de sellado y resolución | 3 | PENDIENTE | — |
| U08 | Impresión duplicada etiqueta | Reimpresión auditada, ID único | 3 | PENDIENTE | — |
| U09 | Paquete clasificado a hub incorrecto | Alerta, reversión y custodia | 4 | PENDIENTE | — |
| U10 | Cierre de jaula sin reconciliar | Requiere supervisor o bloqueo | 4 | PENDIENTE | — |
| U11 | Cargue de guía que no pertenece a manifiesto | Rechazo y log | 4 | PENDIENTE | — |
| U12 | Tránsito troncal y llegada sin lectura de unidad | Novedad, no confirmación falsa | 4 | PENDIENTE | — |
| U13 | Repartidor confirma recepción de ruta | Unidades físicamente asignadas | 5 | PENDIENTE | — |
| U14 | Entrega con OTP verificado | POD válido y un único evento de entrega | 5 | PENDIENTE | — |
| U15 | Entrega con captura de firma | Archivo protegido y auditoría | 5 | PENDIENTE | — |
| U16 | Intento fallido por destinatario ausente | Reintento posible y estado coherente | 5 | PENDIENTE | — |
| U17 | COD en efectivo validado | No marcar liquidación sin conciliación | 5 | PENDIENTE | — |
| U18 | Entrega parcial multibulto | Unidades y guía agregada consistentes | 5 | PENDIENTE | — |
| U19 | PUDO: recepción y retiro con OTP | Cadena de custodia actualizada | 5 | PENDIENTE | — |
| U20 | Devolución a remitente y reintegro a stock | Inspección antes de aumento de inventario | 7 | PENDIENTE | — |
| U21 | App offline captura POD y se reconecta | Idempotente y sin duplicar entrega | 5 | PENDIENTE | — |
| U22 | Dos mensajeros envían estados contradictorios | Conflicto a revisión, sin sobrescritura | 5 | PENDIENTE | — |
| U23 | Propuesta IA de desviación | Aprobación humana y reglas de servidor | 2/8 | PROBADO | `ai-approval.spec.ts` (6 casos) + E2E `U23 en la UI` |
| U24 | Agente IA intenta modificar stock directamente | Denegación y auditoría | 8 | EN DESARROLLO | Política `AGENT_CANNOT_MUTATE` probada en domain-core; faltan identidades de agente en la API (Hito 8) |
| U25 | Tenant A consulta guía Tenant B | Acceso denegado en API y DB | 1 | PROBADO | `database-security.spec.ts` (SQL) + `tenancy.spec.ts` (API) |
| U26 | Cliente consulta POD de envío ajeno | Acceso denegado | 7 | PENDIENTE | — |
| U27 | Cliente crea guía masiva con ID duplicado | Idempotencia | 7 | PENDIENTE | — |
| U28 | Capacidad de vehículo insuficiente | Bloqueo o propuesta alternativa | 6 | PENDIENTE | — |
| U29 | Contrato impide cambio de valor COD al salir a reparto | Bloqueo/auditoría | 5 | PENDIENTE | — |
| U30 | Fallo de internet/servicio de mapas | Flujos críticos degradan sin perder datos | 10 | PENDIENTE | — |
| U31 | Fallo del servicio de IA | WMS/Parcel/TMS continúan operando | 8 | IMPLEMENTADO | Sin proveedor de IA: opera el motor de reglas; falta prueba de caída del proveedor (Hito 8) |
| U32 | Dashboard KPI cruza hub, WMS, TMS y POD | Misma fuente de eventos y números | 8 | PENDIENTE | — |
| U33 | 3D muestra un muelle ocupado | Estado corresponde a YMS real/demo | 8 | PENDIENTE | — |
| U34 | Auditor investiga paquete perdido | Timeline y chain-of-custody completa | 10 | PENDIENTE | — |
| U35 | Supervisor revoca turno de un mensajero | Operaciones futuras bloqueadas | 1/5 | EN DESARROLLO | Revocación de usuario/sesiones probada (S-P0-07); falta revocación de turno (Hito 5) |
| U36 | Escanear el mismo paquete dos veces concurrentemente | No duplica movimiento ni saldo | 3 | PENDIENTE | — |
| U37 | Transferencia interbodega parcial | Origen y destino conciliados | 3 | PENDIENTE | — |
| U38 | Exceso de temperatura en lote | Retención/alerta y autorización de liberación | 3 | PENDIENTE | — |
| U39 | Importación ecommerce repetida | Pedidos no duplicados | 7 | PENDIENTE | — |
| U40 | Motor de recomendaciones sin base de calidad | Presenta incertidumbre, no certeza falsa | 8 | EN DESARROLLO | Regla `data_quality` probada en `route-rules.spec.ts`; falta escenario con GPS antiguo en UI |
| U41 | Flujo de reclamación por daño | Expediente con evidencia y permisos | 7 | PENDIENTE | — |
| U42 | Arqueo diario de mensajero | Diferencias visibles y no editables sin causa | 5 | PENDIENTE | — |
| U43 | Cambio de sede en un usuario autorizado | Datos filtrados por sede y tenant | 1 | PROBADO | `tenancy.spec.ts` (alcance por sede y cambio de sede rechazado) |
| U44 | Mobile 360px: escaneo/POD con una mano | Botones y navegación funcionales | 10 | EN DESARROLLO | E2E 360 px del Command Center sin desbordamiento; faltan PWA de escaneo/POD |
| U45 | Accesibilidad: lector de pantalla y teclado | Acciones críticas accesibles | 10 | PENDIENTE | — |
| U46 | Red sin GPS disponible | Entrega con evidencia alternativa y política | 5 | PENDIENTE | — |
| U47 | Registros sin fecha de última sincronización | UI muestra fuente no actualizada | 2 | EN DESARROLLO | La UI muestra «Última sincronización» y estado en línea; falta aviso explícito de datos desactualizados |
| U48 | Acceso al catálogo de 818 skills | Inventario completo; sin ejecución ofensiva | 9 | PENDIENTE | — |
| U49 | Aplicación de módulos activables | WMS y paquetería operan juntos, y por separado | 1/7 | PENDIENTE | — |
| U50 | Publicación final con checklist de videos | Controles de seguridad/performance/SEO aplicables verificados | 10 | PENDIENTE | — |

## 3. Seguridad P0/P1/P2 (Apéndice D.10)

| ID | Prueba | Prioridad | Hito | Estado |
|---|---|---|---|---|
| S-P0-01 | Acceso cruzado entre tenants/sedes | P0 | 1 | PROBADO (envíos, viajes, recomendaciones, contexto); ampliar a cada endpoint nuevo |
| S-P0-02 | Privilegio de agentes | P0 | 8 | PENDIENTE |
| S-P0-03 | Inyección indirecta | P0 | 8 | PENDIENTE |
| S-P0-04 | Autorización en API y WebSocket | P0 | 1 | IMPLEMENTADO (SSE filtrado por tenant y sede; falta prueba dedicada) |
| S-P0-05 | Secretos y vulnerabilidades críticas en CI | P0 | 1 | EN DESARROLLO (Gitleaks en CI; falta SAST/SCA) |
| S-P0-06 | Auditoría de acciones críticas | P0 | 1 | PROBADO (cadena de hash verificada) |
| S-P0-07 | Sesiones y revocación | P0 | 1 | PROBADO |
| S-P1-01 | Gestión de dependencias (SBOM) | P1 | 1 | PENDIENTE |
| S-P1-02 | Respuesta y recuperación | P1 | 10 | PENDIENTE |
| S-P1-03 | Centro de seguridad con datos reales | P1 | 9 | PENDIENTE |
| S-P1-04 | Protección GPS/PII | P1 | 5/6 | PENDIENTE |
| S-P2-01 | Firmado de artefactos/procedencia | P2 | 10 | PENDIENTE |
| S-P2-02 | Operación avanzada SOC/SIEM | P2 | 10 | PENDIENTE |

## 4. Recomendaciones de los seis videos (Apéndice H)

> Directiva `H.0`: cada requisito se clasifica como **obligatorio**, **condicional** o **no aplicable motivado**. Esa clasificación se hará en el Hito 1 con revisión del propietario. Hasta entonces figura como «por clasificar». La evidencia final va en `IMPLEMENTATION_MATRIX.md` (Hito 10).

| ID | Requisito | Hito previsto | Clasificación | Estado |
|---|---|---|---|---|
| H-LEG-01 | Términos y condiciones | 10 | por clasificar | PENDIENTE |
| H-LEG-02 | Política de tratamiento de datos | 10 | por clasificar | PENDIENTE |
| H-LEG-03 | Consentimientos diferenciados | 10 | por clasificar | PENDIENTE |
| H-LEG-04 | Aviso comprensible | 10 | por clasificar | PENDIENTE |
| H-LEG-05 | Evidencia de autorización | 10 | por clasificar | PENDIENTE |
| H-LEG-06 | Cambio de documentos | 10 | por clasificar | PENDIENTE |
| H-LEG-07 | Derechos del titular | 10 | por clasificar | PENDIENTE |
| H-LEG-08 | Conservación y eliminación | 10 | por clasificar | PENDIENTE |
| H-LEG-09 | Ecommerce/retracto | 10 | por clasificar | PENDIENTE |
| H-LEG-10 | Prohibición de textos inventados | 10 | por clasificar | PENDIENTE |
| H-PRIV-01 | **Política de privacidad** | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-02 | **Registrá la base de datos — AAIP / Ley 25.326** | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-03 | **Claves expuestas en el código** | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-04 | **Consentimiento informado** | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-05 | **Botón para borrar datos** | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-06 | **Revisá las licencias** (fotografías y tipografías) | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-07 | **Banner de cookies** | 1/10 | por clasificar | PENDIENTE |
| H-PRIV-08 | **Términos y condiciones** | 1/10 | por clasificar | PENDIENTE |
| H-PERF-01 | **Comprime las imágenes** | 10 | por clasificar | PENDIENTE |
| H-PERF-02 | **Haz lazy loading** | 10 | por clasificar | PENDIENTE |
| H-PERF-03 | **Difiere los scripts no críticos** | 10 | por clasificar | PENDIENTE |
| H-PERF-04 | **Divide el código en partes** | 10 | por clasificar | PENDIENTE |
| H-PERF-05 | **Minifica el JS y el CSS** | 10 | por clasificar | PENDIENTE |
| H-PERF-06 | **Quita las dependencias sin usar** | 10 | por clasificar | PENDIENTE |
| H-PERF-07 | **Evita los re-renders innecesarios** | 10 | por clasificar | PENDIENTE |
| H-PERF-08 | **Pon debounce en los campos** | 10 | por clasificar | PENDIENTE |
| H-PERF-09 | **Pagina las listas largas** | 10 | por clasificar | PENDIENTE |
| H-PERF-10 | **Usa esqueletos de carga** | 10 | por clasificar | PENDIENTE |
| H-PERF-11 | **Agrega un CDN** | 10 | por clasificar | PENDIENTE |
| H-PERF-12 | **Define el tamaño de cada imagen** | 10 | por clasificar | PENDIENTE |
| H-PERF-13 | **Precarga la imagen principal** | 10 | por clasificar | PENDIENTE |
| H-PERF-14 | **Sirve imágenes al tamaño de pantalla** | 10 | por clasificar | PENDIENTE |
| H-PERF-15 | **Carga solo las fuentes que usas** | 10 | por clasificar | PENDIENTE |
| H-PERF-16 | **Carga videos y mapas al hacer clic** | 10 | por clasificar | PENDIENTE |
| H-PERF-17 | **Elimina el CSS sin usar** | 10 | por clasificar | PENDIENTE |
| H-PERF-18 | **Genera las páginas estáticas** | 10 | por clasificar | PENDIENTE |
| H-PERF-19 | **Activa el caché del navegador** | 10 | por clasificar | PENDIENTE |
| H-PERF-20 | **Haz una auditoría con Lighthouse** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-01 | **Privacy policy** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-02 | **Terms page** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-03 | **Clear CTA** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-04 | **FAQ** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-05 | **robots.txt** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-06 | **sitemap.xml** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-07 | **Custom 404** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-08 | **Alt text** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-09 | **Analytics** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-10 | **Meta titles** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-11 | **Meta description** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-12 | **Social share** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-13 | **Favicon** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-14 | **Canonical URLs** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-15 | **Cookie consents** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-16 | **Mobile version** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-17 | **Accessibility** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-18 | **Test forms** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-19 | **Check broken links** | 10 | por clasificar | PENDIENTE |
| H-LAUNCH-20 | **Optimize performance** | 10 | por clasificar | PENDIENTE |
| H-SEC-01 | **Pon Cloudflare delante** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-02 | **Fuerza HTTPS** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-03 | **Nunca subas .env a Git** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-04 | **No hardcodees claves** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-05 | **Rota claves filtradas** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-06 | **No filtres secretos en logs** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-07 | **No pongas secretos en frontend** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-08 | **Desactiva debug en producción** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-09 | **Elimina rutas de prueba** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-10 | **Configura cabeceras y CSP** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-11 | **Restringe CORS** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-12 | **Usa un login seguro** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-13 | **Limita intentos de acceso** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-14 | **Valida permisos en servidor** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-15 | **Protege rutas por defecto** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-16 | **Aísla datos por usuario** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-17 | **Activa RLS y buckets privados** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-18 | **Valida datos y archivos** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-19 | **Evita SQL y NoSQL injection** | 1/10 | por clasificar | PENDIENTE |
| H-SEC-20 | **Actualiza, haz backups y usa 2FA** | 1/10 | por clasificar | PENDIENTE |
| H-SEO-01 | **Aviso legal** | 10 | por clasificar | PENDIENTE |
| H-SEO-02 | **Política de privacidad** | 10 | por clasificar | PENDIENTE |
| H-SEO-03 | **Aviso de cookies** | 10 | por clasificar | PENDIENTE |
| H-SEO-04 | **Forzar HTTPS** | 10 | por clasificar | PENDIENTE |
| H-SEO-05 | **Meta títulos y descripciones** | 10 | por clasificar | PENDIENTE |
| H-SEO-06 | **Datos estructurados** | 10 | por clasificar | PENDIENTE |
| H-SEO-07 | **Sitemap y robots.txt** | 10 | por clasificar | PENDIENTE |
| H-SEO-08 | **Ficha de Google** | 10 | por clasificar | PENDIENTE |
| H-SEO-09 | **Favicon** | 10 | por clasificar | PENDIENTE |
| H-SEO-10 | **Texto alternativo en las imágenes** | 10 | por clasificar | PENDIENTE |
| H-SEO-11 | **Imágenes comprimidas** | 10 | por clasificar | PENDIENTE |
| H-SEO-12 | **Velocidad de carga optimizada** | 10 | por clasificar | PENDIENTE |
| H-SEO-13 | **Contraste de colores** | 10 | por clasificar | PENDIENTE |
| H-SEO-14 | **Que se vea bien en el móvil** | 10 | por clasificar | PENDIENTE |
| H-SEO-15 | **Página 404 personalizada** | 10 | por clasificar | PENDIENTE |
| H-SEO-16 | **Enlaces rotos arreglados** | 10 | por clasificar | PENDIENTE |
| H-SEO-17 | **Formularios protegidos contra spam** | 10 | por clasificar | PENDIENTE |
| H-SEO-18 | **Botón de WhatsApp visible** | 10 | por clasificar | PENDIENTE |
| H-SEO-19 | **Analítica instalada** | 10 | por clasificar | PENDIENTE |
| H-SEO-20 | **Una sola llamada a la acción** | 10 | por clasificar | PENDIENTE |

## 5. Entregables globales (Apéndice Q.04)

| # | Entregable | Estado |
|---|---|---|
| Q.04.1 | Prompt consolidado y registro de decisiones | EN DESARROLLO — ADR y docs de Etapa 0 creados |
| Q.04.2 | PRD funcional y mapa de módulos/roles/flujos | EN DESARROLLO — arquitectura, roles, sitemap y plan creados |
| Q.04.3 | Ocho pantallas estrella implementables | PENDIENTE |
| Q.04.4 | Design system Aurora Glass Light/Dark | PENDIENTE |
| Q.04.5 | Código fuente runnable + docker compose + .env.example | EN DESARROLLO — Core + Command Center ejecutables |
| Q.04.6 | BD, migraciones y seeds multioperación | EN DESARROLLO — esquemas core/fleet/tms/parcel/ai + seed DEMO |
| Q.04.7 | UI desktop/web de todos los módulos | PENDIENTE |
| Q.04.8 | Apps operativas PWA (Pick/Pack/Sort/Driver/Entregas/Points/Recepción) | PENDIENTE |
| Q.04.9 | Portal de empresas | PENDIENTE |
| Q.04.10 | Tracking público limitado | PENDIENTE |
| Q.04.11 | API OpenAPI + webhooks | PENDIENTE |
| Q.04.12 | Motor de notificaciones con consentimiento | PENDIENTE |
| Q.04.13 | Gemelo digital conectado | PENDIENTE |
| Q.04.14 | Seis agentes IA + habilidades con aprobación | EN DESARROLLO — Route y Exception Agent (reglas) con aprobación |
| Q.04.15 | Catálogo GitHub completo inventariado | PENDIENTE |
| Q.04.16 | Dashboards KPI con fórmulas | PENDIENTE |
| Q.04.17 | Pruebas automatizadas U01–U50 | EN DESARROLLO — 62 pruebas automatizadas; U23, U25, U43 completos |
| Q.04.18 | Plan de salida a producción | PENDIENTE |
| Q.04.19 | Manual por rol y tutorial contextual | PENDIENTE |
| Q.04.20 | Reporte final de evidencia | PENDIENTE |
