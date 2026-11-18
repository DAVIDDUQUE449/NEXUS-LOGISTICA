# Mapa de roles y autorizaciones — NEXUS LOGISTICS OS V2.0

> **Estado:** diseño (Etapa 0). Fuente: `N.05` (prevalece), sección 19, `D.3`, `M.15`.
> **Principio:** toda acción se autoriza **en el servidor** (API, workers y WebSocket). Ocultar un botón no es seguridad (`N.05`).

## 1. Modelo

```
Permiso efectivo = RBAC (rol → permisos)  ∧  ABAC (atributos del sujeto, recurso y contexto)  ∧  módulo activo
```

- **Sujeto**: `user_id`, `membership` (tenant, rol, alcance), `shift_assignment` activo, `device` registrado, `mfa_level`.
- **Recurso**: `tenant_id`, `client_account_id`, `site_id`, `service`, `status`, `assigned_to`, `current_custodian`.
- **Contexto**: hora, sede seleccionada, `data_mode`, nivel de riesgo de la acción.

### 1.1 Atributos ABAC (`N.05`)

| Atributo | Regla |
|---|---|
| `tenant` | Siempre igual al tenant de la sesión. Si no coincide, la respuesta es `404` (no se revela que existe). |
| `client_account` | Los usuarios de portal solo ven sus `client_account_ids`. Los internos pueden tener alcance limitado a ciertos clientes (p. ej. un coordinador dedicado a una cuenta). |
| `site` | La acción solo es válida si `resource.site_id ∈ membership.scope.site_ids` (vacío = todas las del tenant, solo para roles de gerencia). |
| `shift` | Los roles operativos móviles requieren un `shift_assignment.status = active`. Sin turno activo, las operaciones nuevas se bloquean (`U35`). |
| `assigned_task` | Picker, packer, mensajero y conductor solo operan tareas asignadas a ellos. |
| `custody` | Escanear, entregar o transferir exige ser el custodio actual o el receptor designado del *handover*. |
| `state` | La transición debe ser válida según la máquina de estados (p. ej. no se cambia un COD después de `OUT_FOR_DELIVERY` si el contrato lo prohíbe, `U29`). |
| `service` | El servicio debe estar habilitado para el cliente y la sede (`module_activation`). |

### 1.2 Niveles de riesgo de acción

| Nivel | Requisito adicional | Ejemplos |
|---|---|---|
| R0 — lectura | Sesión válida | Ver tablero, ver tarea |
| R1 — operación | Turno activo (móvil), `Idempotency-Key` | Escanear, confirmar pick, registrar intento |
| R2 — sensible | Motivo obligatorio + auditoría detallada | Reimprimir etiqueta, reabrir pack, entrada manual de código, override de contenedor |
| R3 — alto impacto | **Step-up MFA** + motivo + (opcional) segundo aprobador | Ajuste de stock > umbral, anular guía, aprobar IA de alto impacto, cambiar COD, exportar PII masiva, cambiar permisos |
| R4 — excepcional | *Break-glass*: ticket + ventana temporal + notificación al tenant | Acceso de soporte de plataforma a datos de un tenant |

## 2. Catálogo de roles

| Código | Rol (`N.05`) | Interfaz | MFA | Alcance típico |
|---|---|---|---|---|
| `platform_superadmin` | Superadmin SaaS | Desktop | Obligatorio | Plataforma; **sin PII de tenants** por defecto |
| `tenant_admin` | Administrador de empresa (sección 19) | Desktop | Obligatorio | Tenant completo: configuración y usuarios |
| `executive` | Gerencia empresarial | Desktop/tablet | Obligatorio | Empresas y sedes permitidas, lectura |
| `ops_director` | Director de operaciones | Desktop | Obligatorio | Red completa del tenant |
| `warehouse_coordinator` | Coordinador / jefe de almacén | Desktop/móvil | Obligatorio | Sedes asignadas |
| `receiving_clerk` | Auxiliar de recepción | `mobile-nexus-warehouse` | Por riesgo | Sede + turno |
| `picker` | Picker | `mobile-nexus-pick` | Por riesgo | Sede + turno + tareas asignadas |
| `packer` | Packer | `mobile-nexus-pack` | Por riesgo | Sede + turno + estación |
| `sorter` | Clasificador / auxiliar de hub | `mobile-nexus-sort` | Por riesgo | Hub + turno |
| `forklift_operator` | Montacarguista | `mobile-nexus-warehouse` | Por riesgo | Sede + turno + tareas |
| `transport_coordinator` | Coordinador de transporte | Desktop (Nexus Control) | Obligatorio | Sedes/rutas asignadas |
| `yard_supervisor` | Supervisor de patio (sección 19) | Desktop/tablet | Por riesgo | Sede |
| `fleet_maintenance` | Mantenimiento (sección 19) | Desktop | Por riesgo | Flota del tenant |
| `linehaul_driver` | Conductor troncal | `mobile-nexus-driver` | Por riesgo | Viajes asignados |
| `courier` | Mensajero / domiciliario | `mobile-nexus-entregas` | Por riesgo | Ruta del día + custodia |
| `pudo_operator` | Encargado PUDO | `mobile-nexus-points` | Por riesgo | **Solo su punto** |
| `customer_service` | Atención al cliente | Desktop (CRM) | Por riesgo | Guías y tickets autorizados |
| `finance` | Finanzas | Desktop | Obligatorio | Tenant (recaudo, facturas) |
| `data_analyst` | Analista de datos (sección 19) | Desktop | Por riesgo | BI de sedes permitidas, datos minimizados |
| `auditor` | Auditor / compliance | Desktop | Obligatorio | Lectura de auditoría y reportes minimizados |
| `security_admin` | Seguridad / TI | Consola | Obligatorio | Security & Trust Center, catálogo de skills |
| `client_admin` | Cliente empresarial (administrador) | `web-client-portal` | Obligatorio | Sus `client_account_ids` |
| `client_user` | Cliente empresarial (usuario) | `web-client-portal` | Opcional | Sus `client_account_ids`, centro de costo |
| `public_recipient` | Destinatario público | `web-public` | — | Una guía, con token |
| `agent:<nombre>` | Identidad de servicio de agente IA | — | — | Solo lectura + `propose.*` ([ADR-0009](../architecture/adr/ADR-0009-ia-gobernada.md)) |

## 3. Matriz de permisos por módulo

Leyenda: **M** gestionar (CRUD + configurar) · **A** aprobar · **O** operar (acciones de dominio sobre lo asignado) · **R** leer · **R⁻** leer con datos minimizados · **E** exportar · — sin acceso.

| Módulo / recurso | super­admin | tenant admin | exec | ops dir | wh coord | recv | picker | packer | sorter | forklift | tr coord | yard | fleet | driver | courier | pudo | cust svc | finance | analyst | auditor | sec admin | client | public |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Plataforma / tenants | M | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | — | — |
| Configuración tenant (sedes, servicios, módulos) | — | M | R | R | R | — | — | — | — | — | R | — | — | — | — | — | — | R | — | R | R | — | — |
| Usuarios y roles | — | M·A | — | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | R | M⁽¹⁾ | — |
| Command Center / KPI | — | R | R·E | R·E | R | — | — | — | — | — | R | R | R | — | — | — | R | R | R·E | R⁻ | — | R⁽²⁾ | — |
| OMS pedidos | — | R | R | R | R·O | — | — | — | — | — | R | — | — | — | — | — | R | R | R⁻ | R⁻ | — | M⁽²⁾ | — |
| ASN / recibo / QC | — | R | R | R | M·A | O | — | — | — | — | — | R | — | — | — | — | — | — | R⁻ | R⁻ | — | M⁽²⁾ | — |
| Inventario (consulta) | — | R | R | R | R·E | R | R⁽³⁾ | R⁽³⁾ | — | R⁽³⁾ | — | — | — | — | — | — | R | R | R⁻ | R⁻ | — | R⁽²⁾ | — |
| Ajuste de stock | — | — | — | A | O·A⁽⁴⁾ | — | — | — | — | — | — | — | — | — | — | — | — | R | — | R | — | — | — |
| Putaway / movimientos | — | — | — | R | M | O | — | — | — | O | — | — | — | — | — | — | — | — | — | R⁻ | — | — | — |
| Picking | — | — | R | R | M·A | — | O | — | — | — | — | — | — | — | — | — | — | — | R⁻ | R⁻ | — | — | — |
| Sustitución de artículo | — | — | — | — | A⁽⁵⁾ | — | O⁽⁵⁾ | — | — | — | — | — | — | — | — | — | — | — | — | R | — | A⁽⁵⁾ | — |
| Packing / etiquetas | — | — | — | R | M·A | — | — | O | — | — | — | — | — | — | — | — | — | — | R⁻ | R⁻ | — | — | — |
| Reimpresión de etiqueta | — | — | — | — | A | — | — | O⁽⁶⁾ | O⁽⁶⁾ | — | — | — | — | — | — | — | — | — | — | R | — | — | — |
| Guías (crear/anular) | — | R | R | R | O | — | — | — | — | — | M·A | — | — | — | — | — | O | R | R⁻ | R⁻ | — | M⁽²⁾ | — |
| Recogidas | — | R | R | R | — | — | — | — | — | — | M | — | — | — | O⁽⁷⁾ | — | O | — | R⁻ | R⁻ | — | M⁽²⁾ | — |
| Clasificación / contenedores | — | R | R | R | R | — | — | — | O | — | M·A | — | — | — | — | — | R | — | R⁻ | R⁻ | — | — | — |
| Override cierre contenedor | — | — | — | A | — | — | — | — | — | — | A | — | — | — | — | — | — | — | — | R | — | — | — |
| Viajes / manifiestos | — | R | R | R | R | — | — | — | O⁽⁸⁾ | O⁽⁸⁾ | M·A | R | R | O⁽⁷⁾ | — | — | R | — | R⁻ | R⁻ | — | — | — |
| Rutas última milla | — | R | R | R | — | — | — | — | — | — | M·A | — | — | — | O⁽⁷⁾ | — | R | — | R⁻ | R⁻ | — | — | — |
| Posición GPS de personas | — | — | R⁻⁽⁹⁾ | R⁽⁹⁾ | — | — | — | — | — | — | R⁽⁹⁾ | — | R⁽⁹⁾ | — | — | — | — | — | — | R⁻ | — | — | — |
| POD (ver evidencia) | — | — | — | R | — | — | — | — | — | — | R | — | — | — | O⁽⁷⁾ | — | R⁽¹⁰⁾ | R⁽¹⁰⁾ | — | R⁻ | — | R⁽²⁾⁽¹⁰⁾ | — |
| POD (editar evidencia) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| COD cobrar | — | — | — | — | — | — | — | — | — | — | — | — | — | — | O⁽⁷⁾ | O⁽¹¹⁾ | — | — | — | — | — | — | — |
| COD cambiar valor | — | — | — | — | — | — | — | — | — | — | A⁽¹²⁾ | — | — | — | — | — | — | A⁽¹²⁾ | — | R | — | O⁽¹²⁾ | — |
| Arqueo / conciliación | — | — | R | R | — | — | — | — | — | — | R | — | — | — | O⁽⁷⁾ | O⁽¹¹⁾ | — | M·A | R⁻ | R | — | R⁽²⁾ | — |
| PUDO | — | R | R | R | — | — | — | — | — | — | R | — | — | — | — | O⁽¹¹⁾ | R | R | R⁻ | R⁻ | — | — | — |
| Patio / muelles | — | R | R | R | R·O | — | — | — | — | — | R·O | M·A | R | O⁽⁷⁾ | — | — | — | — | R⁻ | R⁻ | — | M⁽¹³⁾ | — |
| Flota / conductores | — | R | R | R | — | — | — | — | — | — | R·O | R | M·A | O⁽¹⁴⁾ | O⁽¹⁴⁾ | — | — | R | R⁻ | R⁻ | — | — | — |
| Tickets / reclamos | — | R | R | R | R | — | — | — | — | — | R | — | — | — | — | — | M | R·A⁽¹⁵⁾ | R⁻ | R⁻ | — | M⁽²⁾ | — |
| Facturación / tarifas | — | R | R | R | — | — | — | — | — | — | — | — | — | — | — | — | R | M·A | R⁻ | R | — | R⁽²⁾ | — |
| IA: recomendaciones | — | R | R | R·A | R·A⁽¹⁶⁾ | — | — | — | — | — | R·A⁽¹⁶⁾ | R | R·A⁽¹⁶⁾ | — | — | — | R | R | R | R | R | — | — |
| IA: kill switch / config | — | M | — | A | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | M | — | — |
| Digital Twin 3D | — | R | R | R | R | — | — | — | — | — | R | R | — | — | — | — | — | — | R | — | — | — | — |
| Reportes / exports | — | E | E | E | E | — | — | — | — | — | E | — | — | — | — | — | — | E | E | E⁻ | — | E⁽²⁾ | — |
| Auditoría | — | R | — | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | R | — | — |
| Security & Trust Center | R | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | M | — | — |
| Catálogo de skills | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | — | — |
| Rastreo público | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R | R⁽¹⁷⁾ |

**Notas:**
1. Los clientes administran solo los usuarios de su propia cuenta empresarial.
2. Solo para sus propias `client_account_ids`; nunca de otro cliente (`U26`).
3. Solo lo necesario para la tarea asignada (ubicación, SKU, lote, cantidad).
4. Doble control: un ajuste por encima del umbral configurable requiere un segundo aprobador distinto del solicitante.
5. Sustitución **solo con permiso comercial** (`M.06`): la pide el picker y la aprueba el cliente o el coordinador según el contrato.
6. Reimpresión con motivo; genera `label_print(reason=reprint)` y no cambia el ID de la unidad (`U08`).
7. Solo sobre lo asignado a él y bajo su custodia.
8. Escanear en cargue y descargue, sin modificar el manifiesto.
9. Ubicación de personas: solo durante el turno, de su sede, con finalidad declarada y precisión mínima necesaria; el acceso se audita (`D.9`). Gerencia ve datos agregados.
10. Ver POD con URL firmada y auditoría; el destinatario y su relación se muestran, y los documentos de identidad no se almacenan.
11. Solo en su punto PUDO.
12. Cambiar un COD solo antes del hito permitido por el contrato; después, `423 LOCKED` (`U29`).
13. Solicitar citas de muelle para sus entregas.
14. Checklist preoperacional y reporte de fallas del vehículo propio.
15. Finanzas aprueba indemnizaciones.
16. Aprueban según el ámbito de la recomendación (WMS → almacén, rutas → transporte, flota → mantenimiento). Las de alto impacto llevan step-up MFA.
17. Rastreo mínimo con token: estado, fecha y ciudad. Sin nombre completo ni dirección (`M.20`).

## 4. Reglas de separación de funciones (SoD)

| ID | Regla |
|---|---|
| SoD-01 | Quien solicita un ajuste de stock no puede aprobarlo. |
| SoD-02 | Quien crea una propuesta de desvío o redespacho no la aprueba si la política del tenant lo prohíbe. |
| SoD-03 | Quien recauda COD no concilia su propio arqueo. |
| SoD-04 | Quien registra una reclamación no aprueba su indemnización. |
| SoD-05 | `tenant_admin` no puede asignarse `platform_superadmin` ni `security_admin` a sí mismo. |
| SoD-06 | El auditor no tiene ningún permiso de mutación. |
| SoD-07 | Los agentes IA (`agent:*`) no tienen ningún permiso `A` ni de mutación operativa. |
| SoD-08 | Nadie puede editar un POD aceptado, un evento de custodia ni una entrada de auditoría. Las correcciones se hacen con un evento compensatorio aprobado. |

## 5. Pruebas derivadas (obligatorias en Hito 1 y cada hito posterior)

- Matriz de §3 convertida en tabla de casos `rol × permiso × esperado` en `tests/integration/authz/matrix.spec.ts`. Cada celda `—` debe producir `403` o `404`.
- `D.3`: operador de sede Norte → muelle Sur ⇒ denegado; cliente A → guía de B ⇒ `404`; conductor → viaje no asignado ⇒ `404`; administrador revocado ⇒ `401` en la siguiente petición.
- `U25`, `U26`, `U35`, `U43`; SoD-01 a SoD-08.
