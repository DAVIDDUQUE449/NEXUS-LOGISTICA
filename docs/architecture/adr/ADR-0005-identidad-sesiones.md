# ADR-0005: Identidad OIDC + BFF con cookies HttpOnly, RBAC + ABAC en servidor

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** `D.3`, `N.05`, `O.05` (reglas de API), sección 19, `U35`, `D.10` P0 «Sesiones y revocación»

## Contexto

Hay usuarios internos (escritorio y móvil), clientes empresariales, destinatarios públicos y servicios. La especificación exige OIDC con PKCE, MFA para perfiles privilegiados, cookies `HttpOnly`/`Secure`/`SameSite`, ningún token privilegiado en `localStorage`, revocación inmediata y permisos por recurso y acción validados en el servidor.

## Decisión

### Autenticación

- **IdP OIDC** (Keycloak en desarrollo) con flujo *Authorization Code + PKCE*.
- **Patrón BFF**: las apps (web y PWA) no manejan *access tokens*. El BFF (rutas `/auth/*` de `apps/api`) intercambia el código, guarda los tokens del lado del servidor (sesión en PostgreSQL con caché en Redis) y entrega al navegador una cookie de sesión opaca: `__Host-nexus_sid`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- **CSRF**: patrón *double-submit* con un token por sesión para métodos mutantes, más la verificación de `Origin`.
- **MFA** obligatorio (TOTP o WebAuthn) para: administradores, aprobadores de alto impacto, finanzas, seguridad, soporte y gerencia con funciones privilegiadas. Para el resto es opcional, y se exige si el riesgo es alto (dispositivo nuevo, ubicación inusual).
- **Reautenticación** (*step-up*, `max_age` corto) antes de acciones críticas: aprobar una recomendación de IA de alto impacto, ajustar stock, anular una guía, cambiar un COD, exportar en masa o cambiar permisos.
- **Dispositivos operativos** (`M.13`): registro de `device` con huella, vínculo a usuario y turno, y **revocación remota**. Si el dispositivo se revoca, se borran sus datos locales en el siguiente contacto y se rechazan sus operaciones en cola.
- **Rastreo público**: sin sesión. El token de guía es opaco, de alta entropía y con vencimiento; hay *rate limit* por IP y por token (`M.20`).
- **Integraciones de máquina a máquina**: *client credentials* con `scope` mínimo, rotación y caducidad. Las claves de API del portal de clientes se guardan con hash y tienen prefijo visible.

### Autorización

- **Permiso = `recurso:acción`** (sección 19): `read`, `create`, `update`, `approve`, `export`, `delete`, `manage`, más acciones de dominio (`scan`, `confirm_pod`, `collect_cod`, `close_container`, `adjust_stock`, …). El catálogo completo está en [MAPA_ROLES.md](../../product/MAPA_ROLES.md).
- **RBAC**: rol → conjunto de permisos, asignado por `membership` (usuario × tenant × rol × ámbito).
- **ABAC**: atributos evaluados en cada caso de uso: `tenant`, `client_account`, `site`, `shift` activo, `service`, `assigned_task`, `custody` actual y `state` de la entidad (`N.05`).
- **Motor de políticas**: evaluador propio en `packages/domain-core/authz` con políticas declarativas en TypeScript, puras y testeables. Lo usan los guards de NestJS, los workers y los manejadores de WebSocket. Toda decisión `deny` se audita.
- **Separación de funciones** (`D.3`): quien crea una propuesta no la aprueba cuando la política lo prohíbe; un ajuste de stock por encima de un umbral requiere doble control; nadie se asigna superadmin a sí mismo.
- **Revocación** (`U35`): desactivar un usuario, una membresía o un turno invalida sus sesiones en Redis de inmediato. Cada petición revalida la membresía, con caché máxima de 30 s e invalidación activa por evento `MembershipRevoked`.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| JWT en el navegador (SPA pura) | Exposición a XSS y revocación difícil; la especificación lo prohíbe para tokens privilegiados. |
| OPA/Cedar como motor externo | Potente, pero añade un servicio y otro lenguaje. Puede adoptarse después sin cambiar las políticas, que son declarativas. |
| Autenticación propia con contraseñas | Riesgo innecesario; ver [ADR-0002](ADR-0002-stack-tecnologico.md). |

## Consecuencias

- **Positivas:** no hay tokens en el cliente. La revocación es real. Las políticas se prueban de forma unitaria.
- **Negativas:** el BFF guarda sesiones con estado y Redis pasa a ser crítico para el rendimiento (no para la verdad, porque la sesión persiste en PostgreSQL).
- **Riesgos:** PWA offline sin sesión válida. Ver [ADR-0008](ADR-0008-offline-first-pwa.md): las operaciones en cola se firman con una clave de dispositivo y el servidor las revalida al sincronizar.

## Verificación

- Tests de políticas por rol (matriz de [MAPA_ROLES.md](../../product/MAPA_ROLES.md)) generados como tabla de casos.
- Tests `U35` (turno revocado), D.3 (operador de sede Norte no modifica muelle Sur), «conductor solo ve viajes asignados» y «administrador revocado pierde acceso».
