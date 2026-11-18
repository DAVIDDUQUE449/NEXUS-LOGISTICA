# ADR-0009: IA gobernada: agentes que proponen, servidor que valida y ejecuta

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** sección 14, sección 15, `D.5`, `O.06`, `U23`, `U24`, `U31`, `U40`, `D.10` P0 «Privilegio de agentes» e «Inyección indirecta»

## Contexto

Hay seis agentes principales (Dispatch, Route, Exception, Customer, Fleet, Reporting) y siete habilidades especializadas. La especificación exige: herramientas tipadas de solo lectura por defecto, `OBSERVE → ANALYZE → PROPOSE → CHECK_POLICY → REQUEST_APPROVAL → EXECUTE → VERIFY → AUDIT`, que la IA nunca escriba directamente en la base de datos, contenido externo tratado como no confiable, *kill switch* y operación completa sin proveedor de IA.

## Decisión

1. **La IA no es dueña de ningún dato operativo** (`O.01`). El módulo `ai` es dueño solo de `ai_recommendation`, `ai_approval`, `ai_execution_result` y `ai_agent_run`.
2. **Dos motores intercambiables** detrás de la misma interfaz `AgentEngine`:
   - **`RuleEngine`** (determinista, por defecto, siempre disponible): reglas en TypeScript que producen recomendaciones reproducibles. Es el modo DEMO y el *fallback* si falla el LLM (`U31`).
   - **`LlmEngine`**: adaptador de proveedor configurable por tenant (llave en un gestor de secretos, presupuesto y cuota por agente). El LLM **redacta y razona**; los **números** (ETA, distancia, costo, capacidad) salen de herramientas deterministas y el servidor los recalcula antes de ejecutar (`14.5`).
3. **Herramientas tipadas** (`packages/ai-agents/tools`): cada herramienta tiene un esquema Zod de entrada y salida, un permiso requerido, alcance `tenant/site` heredado del contexto (nunca de los argumentos del modelo), *timeout* y cuota. Hay dos categorías:
   - `read.*`: consultan fachadas de dominio con los permisos del **usuario que invoca** o del rol de servicio `agent:<nombre>`, que es de solo lectura.
   - `propose.*`: crean un `ai_recommendation` en estado `pending_approval`. **No existe ninguna herramienta `execute.*` expuesta al modelo.**
4. **Ejecución**: solo la invoca un humano autorizado desde el Centro de Aprobaciones. El flujo es:
   `approve(recommendation_id, option_key, recommendation_version)` → step-up MFA si es de alto impacto → **revalidación del servidor** (permisos, estado actual de la entidad, vigencia, capacidad, ventanas, reglas de seguridad vial) → caso de uso de dominio normal (el mismo que usaría un humano) con `idempotency_key = recommendation_id:option_key` → `ai_execution_result` → `AIToolExecutionRecorded` → auditoría.
5. **Versión exacta** (`20.2`): la aprobación queda ligada a `recommendation_version` y a un *hash* del contexto crítico. Si el contexto cambia (ETA, estado, capacidad), la aprobación queda **invalidada** y se pide una nueva propuesta.
6. **Contenido no confiable** (`D.5`): notas de envío, tickets, correos, PDF, respuestas de integraciones y descriptores MCP entran al prompt **delimitados y etiquetados como datos**, nunca como instrucciones. Además:
   - un clasificador de inyección (heurístico + modelo) marca entradas sospechosas, como complemento y no como defensa única;
   - las herramientas disponibles **no dependen** del contenido del prompt; la *allowlist* es estática por agente (`security/agent-tool-allowlist.yaml`);
   - la salida del modelo se valida con el esquema de recomendación; lo que no valida se descarta y se registra.
7. **Contrato de recomendación** (`14.4`, ampliado): `id`, `version`, `agent`, `engine` (`rules` | `llm:<proveedor>/<modelo>`), `mode` (`demo` | `real`), `entity_type/id`, `severity`, `summary`, `causes[]`, `evidence[]` (con `source` y `timestamp`), `options[]` (`key`, `label`, `impact`, `cost`, `risks`), `confidence` (0–1) y su explicación, `data_quality` (`sufficient` | `degraded` | `insufficient`; si es `insufficient`, la UI muestra incertidumbre y no certeza, `U40`), `requires_approval`, `approval_level`, `expires_at` y `status`.
8. **Estados**: `detected → proposed → pending_approval → approved | rejected | expired → executing → executed | failed | reverted`.
9. **Kill switch** (`D.5`): `ai.kill_switch` por tenant, agente o global. Al activarse se detienen las ejecuciones de agentes y se ocultan las propuestas nuevas, mientras WMS/TMS siguen operando a mano.
10. **Privacidad**: al proveedor externo no se envía PII innecesaria. Se minimiza o seudonimiza, y no se envían datos reales sin evaluación y base contractual (`D.9`). Los prompts se registran redactados.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Agentes autónomos con herramientas de escritura | Prohibido por `D.5` y `O.06`; riesgo físico y económico. |
| Un único chatbot general | La sección 14.1 lo rechaza explícitamente. |
| Solo LLM, sin motor de reglas | Sin llaves, el sistema no funcionaría en DEMO y fallaría `U31`. |

## Consecuencias

- **Positivas:** la IA no puede causar daño por sí sola, la auditoría es completa, el DEMO funciona sin llaves y la evaluación offline es posible.
- **Negativas:** cada acción requiere intervención humana. Para casos de bajo riesgo se podrá definir en el futuro una autoaprobación por política, mediante otro ADR.

## Verificación

- `U24`: un agente intenta mover stock ⇒ no existe herramienta; un intento por API con la identidad `agent:*` ⇒ `403` y auditoría.
- Batería red-team de `D.5` en `tests/security/ai-*.spec.ts`: instrucción inyectada en una nota de envío, resultado de proveedor adulterado, herramienta no autorizada, descriptor MCP alterado, movimiento fuera de sede y aprobación vencida.
- `U23`: propuesta de desvío → aprobación → ejecución única → timeline, mapa y KPI actualizados.
