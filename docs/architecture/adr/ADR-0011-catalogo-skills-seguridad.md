# ADR-0011: Catálogo de skills de ciberseguridad como inventario consultable, nunca ejecutable

- **Estado:** Propuesto
- **Fecha:** 2026-11-18
- **Requisitos relacionados:** Apéndice D, Apéndice E (E.2–E.12), `Q.01` (biblioteca de ciberseguridad), `U48`, Hito 9

## Contexto

La especificación exige integrar el **100 %** del repositorio comunitario `mukul975/Anthropic-Cybersecurity-Skills` (unas 818 skills en 34 dominios según su README; el conteo real hay que verificarlo) como **inventario consultable**: fijado por SHA, reconciliado entre `SKILL.md` e `index.json`, con licencias preservadas y clasificado por riesgo. Ninguna skill se ejecuta automáticamente y el uso ofensivo queda prohibido.

Ese repositorio **no es oficial de Anthropic** (lo aclara la propia especificación en `D`) y contiene material de doble uso.

## Decisión

1. **Checkout fijado**: `third_party/anthropic-cybersecurity-skills/` como *git submodule* fijado a un commit SHA concreto, con `MANIFEST.lock.json` (SHA del commit, fecha, conteo de `SKILL.md`, conteo de `index.json`, hash por archivo y licencia).
2. **Sin ejecución**: el directorio se excluye de los *workspaces* de pnpm, del `PATH`, de los *builds* y de las imágenes de contenedor. Un test de CI falla si algún código importa o ejecuta archivos de esa ruta. Los scripts incluidos se indexan como texto.
3. **Índice** (`packages/security-catalog-adapter`): un *parser* de *frontmatter* y contenido genera `security.skill_catalog_entry` con `skill_id`, `path`, `domain`, `title`, `summary`, `frameworks[]`, `risk_class` (`defensive` | `dual_use` | `offensive` | `unknown`), `allowed_use` (`reference` | `reference_restricted` | `blocked_from_agents`), `license`, `source_sha` y `content_hash`.
4. **Reconciliación**: el reporte `SECURITY_SKILLS_INVENTORY.csv` muestra el conteo real, las skills que están en `SKILL.md` pero no en `index.json` y viceversa, y los duplicados. No se afirma «100 %» si la reconciliación no cierra (`E.12`).
5. **Acceso**: la UI `SecuritySkillsExplorer` está en el Security & Trust Center, solo para los roles `security_admin` y `platform_superadmin`. Es lectura y búsqueda, y cada acceso a una skill `dual_use` u `offensive` se audita.
6. **Agentes de NEXUS**: no pueden leer skills `offensive` ni `dual_use`. Pueden consultar skills `defensive` como **referencia de texto** para redactar recomendaciones de seguridad, siempre tratadas como contenido no confiable ([ADR-0009](ADR-0009-ia-gobernada.md)).
7. **Uso durante el desarrollo**: el equipo consulta las skills que `D.11` selecciona (DevSecOps, API gateway, SBOM, Gitleaks, threat modeling, …) y adapta sus procedimientos al stack **después de revisarlos**. Se documenta en `docs/security/` qué skill y qué SHA se usaron.

## Riesgos abiertos

- La licencia (Apache-2.0 según `D.11`) se verifica en el commit fijado antes de redistribuir. Si no está clara, el submódulo no se redistribuye: se descarga en tiempo de *build* desde una ruta documentada.
- **Bloqueo actual**: esta sesión de trabajo solo tiene acceso al repositorio `DAVIDDUQUE449/NEXUS-LOGISTICA`. Obtener el catálogo requiere acceso de red a `github.com/mukul975/...` y se probará en el Hito 9.

## Verificación

- `U48`: el inventario muestra el conteo verificado; los intentos de ejecución están bloqueados.
- Test CI `no-third-party-exec`: ningún `import`/`require`/`spawn` hacia `third_party/`.
