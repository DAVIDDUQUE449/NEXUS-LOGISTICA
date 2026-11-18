# Sitemap y rutas — NEXUS LOGISTICS OS V2.0

> **Estado:** diseño (Etapa 0). Fuente: `N.04` (estructura), `N.02` (inicio), `N.03` (apps por perfil), `Q.02`.
> **Regla de UI (`N.04`):** cada ruta visible del menú tiene una página útil. Lo no implementado se **oculta** o se muestra como «Disponible en Hito N» con explicación; nunca hay botones que simulen funciones.
> **Columna Hito:** cuándo la ruta pasa a ser funcional ([PLAN_HITOS](../product/PLAN_HITOS.md)).

## 1. `web-control-tower` (escritorio/tablet, sesión de empleado)

| Sección (`N.04`) | Ruta | Página | Roles principales | Hito |
|---|---|---|---|---|
| **Inicio / Command Center** | `/` | Home Aurora Glass Light (`N.02`): saludo, 6 KPI, panel de envío en riesgo con camión, Operations Brief IA, mapa, cronograma, próximas acciones | todos los internos | 2 |
| | `/login`, `/logout`, `/seleccionar-empresa` | Autenticación OIDC, selector de tenant/sede | todos | 1 |
| **Operación integral** | `/operacion/torre` | Torre de control: backlog por etapa y semáforo SLA | ops_director, coordinadores | 6 |
| | `/operacion/alertas` | Alertas e incidentes (dedupe, ack, escalamiento) | coordinadores | 4 |
| | `/operacion/alertas/:id` | Incident room: causa raíz, acciones, responsables | coordinadores | 6 |
| | `/operacion/agenda` | Turnos y agenda operativa | coordinadores | 6 |
| | `/operacion/digital-twin` | Selector de sede → escena 3D | coordinadores, gerencia | 8 |
| | `/operacion/digital-twin/:siteId` | NEXUS Digital Twin Studio / Parcel Hub 3D / Yard 3D + HUD | coordinadores, gerencia | 8 |
| | `/operacion/capacidad` | Tableros de capacidad por sede, turno y zona | ops_director | 6 |
| **Nexus Control** (`M.15`) | `/control` | Vista por rol: jefe de turno, jefe de sede, transporte, gerente, auditor | coordinadores | 6 |
| **Cadena de suministro / OMS** | `/oms/pedidos` · `/oms/pedidos/:id` | Lista con filtros · detalle con líneas, reservas, envíos y timeline | wh_coord, cust_svc | 3 (lectura) / 7 |
| | `/oms/pedidos/importar` | Importación CSV/XLSX idempotente | wh_coord | 7 |
| | `/oms/abastecimiento` · `/oms/asn/:id` | Órdenes de compra y ASN | wh_coord | 3 |
| | `/oms/proveedores` · `/oms/clientes` | Maestros | tenant_admin | 1 (clientes) / 3 |
| | `/oms/promesas` | Promesas y reservas | wh_coord | 7 |
| | `/oms/integraciones` | Canales e-commerce (estado del conector) | tenant_admin | 7 |
| **Almacenes / WMS** | `/wms/recibos` · `/wms/recibos/:id` | Recibo ASN, inspección y discrepancias | wh_coord | 3 |
| | `/wms/ubicaciones` | Ubicaciones, mapa 2D y slotting | wh_coord | 3 |
| | `/wms/inventario` | Stock por propietario, lote, estado y ubicación | wh_coord, analyst | 3 |
| | `/wms/inventario/movimientos` | Ledger auditable | wh_coord, auditor | 3 |
| | `/wms/picking` · `/wms/picking/olas/:id` | Olas, tareas y asignación | wh_coord | 3 |
| | `/wms/packing` | Estaciones, QC y materiales | wh_coord | 3 |
| | `/wms/despacho` | Staging, cargue y despacho | wh_coord | 3 |
| | `/wms/conteos` · `/wms/ajustes` · `/wms/transferencias` | Conteos, ajustes con aprobación y transferencias | wh_coord | 3 |
| | `/wms/devoluciones` | Devoluciones comerciales e inspección | wh_coord | 7 |
| **Mensajería y paquetería / Parcel** | `/parcel/cotizador` | Cotizador de servicios | cust_svc, tr_coord | 7 |
| | `/parcel/guias` · `/parcel/guias/:numero` | Guías, rótulos, timeline por guía y unidad (`ShipmentTrace`, `ShipmentUnitTree`) | tr_coord, cust_svc | 4 |
| | `/parcel/recogidas` | Solicitudes de recogida y asignación | tr_coord | 4 |
| | `/parcel/admision` | Admisión en ventanilla | tr_coord | 4 |
| | `/parcel/hubs` · `/parcel/hubs/:siteId` | Clasificación por hub, reglas y puestos | tr_coord | 4 |
| | `/parcel/contenedores` | Jaulas, sacas y consolidación | tr_coord | 4 |
| | `/parcel/red` | Red de centros, enlaces y tránsitos | ops_director | 4 |
| | `/parcel/ultima-milla` | Intentos y POD por ruta | tr_coord | 5 |
| | `/parcel/pudo` | Puntos y custodias | tr_coord | 5 |
| | `/parcel/reintentos` | Reintentos y devoluciones | tr_coord | 5 |
| **Transporte / TMS** | `/tms/planificador` | Planificador de rutas | tr_coord | 6 |
| | `/tms/viajes` · `/tms/viajes/:id` | Viajes, manifiestos y reconciliación | tr_coord | 4 (troncal) / 6 |
| | `/tms/cargue` | Carga, descarga y tránsitos | tr_coord | 4 |
| | `/tms/mapa` | Tracking en mapa (antigüedad de señal) | tr_coord | 6 |
| | `/tms/despachos` | Timeline de despachos | tr_coord | 6 |
| | `/tms/costos` | Costos y transportadores | tr_coord, finance | 6 |
| **Flota / YMS** | `/flota/vehiculos` · `/flota/conductores` | Maestros + documentos y vencimientos | fleet | 6 |
| | `/flota/mantenimiento` · `/flota/combustible` | Órdenes y registros | fleet | 6 |
| | `/yms/patio` · `/yms/citas` · `/yms/muelles` | Patio, citas y ocupación de muelles | yard | 3 (muelles básicos) / 6 |
| | `/flota/inspecciones` | Inspecciones de seguridad | fleet | 6 |
| **Finanzas y CRM** | `/finanzas/recaudo` · `/finanzas/arqueos/:id` | COD, arqueo y liquidación | finance | 5 |
| | `/finanzas/facturacion` · `/finanzas/tarifas` | Facturas (estado del proveedor) y tarifas | finance | 7 |
| | `/finanzas/costos` | Costos y rentabilidad | finance, exec | 7 |
| | `/crm/tickets` · `/crm/tickets/:id` | Tickets, novedades y PQR con timeline unificada | cust_svc | 7 |
| | `/crm/indemnizaciones` | Expedientes | cust_svc, finance | 7 |
| | `/crm/notificaciones` | Plantillas, canales y consentimiento | tenant_admin | 7 |
| **Nexus AI** | `/ia/brief` | Operations Brief | coordinadores | 2 (reglas) / 8 |
| | `/ia/agentes` | Tarjetas de agentes: estado, fuente, tasa de aprobación, kill switch | tenant_admin, ops_director | 8 |
| | `/ia/aprobaciones` · `/ia/aprobaciones/:id` | Centro de aprobaciones con comparador antes/después | aprobadores | 2 (escenario DEMO) / 8 |
| | `/ia/automatizaciones` | Predicción y reglas | ops_director | 8 |
| **Datos y BI** | `/bi/kpi` · `/bi/kpi/:codigo` | Diccionario de KPI y drilldown a registros | analyst, exec | 2 / 10 |
| | `/bi/tableros` | Tableros por rol y sede | analyst | 10 |
| | `/bi/reportes` | Informes y exportaciones (CSV/XLSX/PDF con marca DEMO/REAL) | analyst | 7 |
| | `/bi/calidad` | Calidad de datos y trazabilidad | analyst, auditor | 10 |
| **Seguridad y cumplimiento** | `/seguridad` | Security & Trust Center | security_admin | 9 |
| | `/seguridad/skills` | Catálogo de skills (solo administradores autorizados) | security_admin | 9 |
| | `/seguridad/auditoria` | Visor de auditoría | auditor | 1 |
| | `/seguridad/privacidad` | Registro de tratamientos, retención y solicitudes de titulares | security_admin | 9 |
| | `/seguridad/lanzamiento` | Launch Readiness & Compliance (H-*, U*, D.10) | security_admin | 10 |
| **Configuración** | `/config/empresa` · `/config/sedes` · `/config/modulos` | Empresas, sedes y módulos habilitados | tenant_admin | 1 |
| | `/config/servicios` · `/config/sla` · `/config/contratos` · `/config/tarifas` | Servicios, SLA, contratos y tarifas | tenant_admin | 1 (servicios) / 7 |
| | `/config/usuarios` · `/config/roles` | Usuarios, RBAC y ABAC | tenant_admin | 1 |
| | `/config/dispositivos` | Dispositivos, impresoras y escáneres; revocación remota | tenant_admin | 5 |
| | `/config/integraciones` · `/config/webhooks` | Conectores y webhooks | tenant_admin | 7 |
| | `/config/preferencias` | Tema claro/oscuro, transparencia reducida, idioma y accesibilidad | todos | 2 |
| | `/simulador` | Estado y controles del simulador (solo tenant DEMO) | tenant_admin | 2 |

**Búsqueda universal** (topbar, `N.02.2`): guía, pedido, cliente, vehículo, SKU y mensajero. Respeta los permisos y nunca devuelve entidades fuera de alcance. Hito 4.

## 2. Apps operativas PWA (móvil, una mano)

Todas comparten `packages/mobile-shell`: login, sede/turno, `OfflineSyncIndicator` y franja DEMO.

| App | Pantalla principal (`N.03`) | Rutas | Hito |
|---|---|---|---|
| `mobile-nexus-warehouse` | «Mi siguiente tarea» | `/` · `/recibo/:asnId` · `/putaway/:taskId` · `/movimiento/:taskId` · `/conteo/:sessionId` · `/checklist` | 3 |
| `mobile-nexus-pick` | **«Mi siguiente tarea»** a pantalla completa | `/` · `/tarea/:taskId` (Siguiente ubicación → Escanear ubicación → Escanear producto → Confirmar cantidad) · `/novedad/:taskId` · `/ola/:waveId/fin` | 3 |
| `mobile-nexus-pack` | **«Escanear tote para empacar»** | `/` · `/sesion/:sessionId` (verificar → material → pesar → sellar → etiqueta) · `/reabrir/:sessionId` | 3 |
| `mobile-nexus-sort` | **«Escanear paquete»** con destino grande | `/` · `/contenedor/:id` · `/cerrar/:id` · `/excepciones` | 4 |
| `mobile-nexus-driver` | **«Mi viaje»** | `/` · `/checklist` · `/viaje/:tripId` (manifiesto · check-in · salida · llegada) · `/incidente` · `/gastos` | 4 (básico) / 6 |
| `mobile-nexus-entregas` | **«Mi ruta de hoy»** + botón **«Confirmar entrega»** | `/` · `/inicio-jornada` (checklist, recepción de unidades) · `/ruta` · `/parada/:stopId` · `/parada/:stopId/pod` · `/parada/:stopId/fallida` · `/recogidas` · `/recaudo` · `/fin-jornada` · `/sincronizacion` | 5 |
| `mobile-nexus-points` | Recepción / almacenadas / para retiro / por vencer / entregadas | `/` · `/recibir` · `/retirar` · `/inventario` · `/caja` | 5 |

## 3. `web-client-portal` (cliente empresarial)

| Ruta | Página | Hito |
|---|---|---|
| `/` | Tablero de autogestión: guías activas, novedades, recogidas y stock | 7 |
| `/guias` · `/guias/nueva` · `/guias/importar` · `/guias/:numero` | Crear, importar en masa (idempotente), rastrear y descargar etiqueta | 7 |
| `/cotizar` | Cotizador con desglose en COP | 7 |
| `/recogidas` | Solicitar y seguir recogidas | 7 |
| `/pedidos` · `/stock` | Fulfillment: pedidos y stock contractual | 7 |
| `/b2b/citas` · `/b2b/asn` | Citas de recibo y ASN | 7 |
| `/facturas` · `/recaudos` | Facturas y liquidaciones COD | 7 |
| `/reclamos` | Novedades y reclamaciones | 7 |
| `/reportes` | Descargas | 7 |
| `/usuarios` · `/api-keys` · `/notificaciones` | Administración de la cuenta | 7 |

## 4. `web-public` (sin sesión)

| Ruta | Página | Hito |
|---|---|---|
| `/` | Landing NEXUS LOGISTICS OS | 10 |
| `/rastreo` · `/rastreo/:token` | Rastreo público mínimo (estado, fecha y ciudad; *rate limit*) | 5 |
| `/legal/terminos` · `/legal/privacidad` · `/legal/cookies` · `/legal/licencias` | Documentos versionados (H-LEG) | 10 |
| `/privacidad/solicitudes` | Canal de derechos del titular (Ley 1581) | 10 |
| `/ayuda` · `/ayuda/faq` | Ayuda | 10 |
| `/404`, `/sitemap.xml`, `/robots.txt` | SEO técnico (H-SEO) | 10 |

## 5. API (`apps/api`, prefijo `/v1`)

Se documenta en OpenAPI generado desde `packages/shared-contracts`. Los endpoints de `O.05` son la base mínima. Rutas auxiliares: `/auth/*` (BFF), `/health/*`, `/v1/offline/sync`, `/v1/stream` (SSE).
