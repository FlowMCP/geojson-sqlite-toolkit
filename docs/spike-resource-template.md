# Spike — MCP Resource Template for GeoJSON `nearPoint` (Memo 100, PRD-013, F5)

| Field | Value |
|-------|-------|
| Memo | 100 (REV-07) — Overpass Geo-Eintrittspunkt |
| PRD | PRD-013 — MCP Resource-Template Spike (F5) |
| Type | Spike (time-boxed feasibility study, two-branched decision gate) |
| Probe target | GeoJSON default method `nearPoint( { lat, lon, radiusMeters, limit } )` |
| Date | 2026-06-03 |

---

## Question

Can the geo default method `nearPoint` (GeoJSON add-on) be emitted as an **MCP Resource
Template** (a parameterized resource URI such as `geo://nearPoint/{lat},{lon}` discoverable
via `resources/templates/list`) instead of / in addition to an MCP **Tool** — and does the
FlowMCP specification define a Resource-Template primitive with parameters?

---

## Feasibility checklist (fixed BEFORE the verdict)

These criteria were defined up front (PRD-013 step 2). The verdict below is decided strictly
against them.

| # | Criterion | Result |
|---|-----------|--------|
| (a) | The four named parameters (`lat`, `lon`, `radiusMeters`, `limit`) are losslessly expressible in the primitive | ❌ no primitive exists to express them in |
| (b) | The `nearPoint` output schema (array of `{ feature_id, geom_type, lat, lon, distanceM, properties }`) is representable by the primitive | ❌ no primitive exists |
| (c) | `flowmcp-core` / `flowmcp-cli` provide Resource-Template support, OR the missing support is clearly named | ✅ named: support is **absent** (see evidence) |
| (d) | An MCP client could consume the probe **without** falling back to the Tools path | ❌ not possible — nothing would emit/register a template |

A single ❌ on (a), (b), or (d) is sufficient to fail the spike. Three of four fail; (c)
is satisfied only in the sense that the gap is unambiguously identifiable.

---

## Spec evidence (cited, file:line)

All citations are from `repos/flowmcp-spec/spec/v4.3.0/`.

1. **Resources map to `server.resource`, not `server.resourceTemplate`.**
   `13-resources.md:10` — "Resources provide local data access via SQLite databases and
   Markdown documents. They map to the MCP `server.resource` primitive and are defined in
   `main.resources` alongside `main.tools`." There is no mention of `server.resourceTemplate`
   or `resources/templates/list` anywhere in the spec.

2. **The `source` enum is closed — no template type.**
   `13-resources.md:68-73` — the only `source` values are `sqlite` (modes `in-memory` /
   `file-based`), `markdown`, and `http`. None is a parameterized URI template.

3. **Resource parameters bind to SQL `?` placeholders, not to a URI template.**
   `13-resources.md:1031` — "Resource parameters are bound to SQL `?` placeholders — their
   position is determined by array order, not by an HTTP request structure."
   `13-resources.md:987` — `sql` is a "SQL prepared statement with `?` placeholders for
   parameter binding." A resource is inseparable from a SQL query; there is no methodless,
   query-less, URI-addressed parameter form.

4. **Resource parameters accept scalars only — no method-style argument object.**
   `13-resources.md:1083` — "The `array()` and `object()` primitives are not supported for
   resource parameters — SQL parameter binding accepts only scalar values."

5. **No URI-template primitive exists in the entire spec.**
   A full-text scan of `spec/v4.3.0/` for `resources/templates`, `uriTemplate`,
   `ResourceTemplate`, and "resource template" returns **zero** matches.

6. **MCP integration registers Tools only.**
   `19-mcp-integration.md:14` — "When FlowMCP is used as an MCP Server, each Tool is
   registered with MCP-specific metadata." `19-mcp-integration.md:55-62` — the MCP translation
   table maps `meta.*` Tool fields to MCP annotations. There is no resource-template
   registration path in core/CLI; the only emitted MCP primitives are Tools (and SQL-bound
   resources via `server.resource`).

7. **The add-on's own resource path is SQL/method-bound, not URI-template-bound.**
   `13-resources.md:393` — for add-on `mode: 'url'` sources (GeoJSON/CSV), data is held in
   memory and "exposed through the add-on's central default methods (`inBoundingBox`,
   `nearPoint`, `byType`) — not through hand-written SQL." These default methods are emitted
   as **Tools** by `src/adapters/FlowMcpAdapter.mjs` `buildToolDefinitions` (lines 46-81),
   which is exactly the current, correct behavior.

### FACT

FlowMCP v4.3.0 does **not** define a Resource-Template primitive. It defines exactly two
resource shapes — SQL-bound resources (`source: sqlite | http`, accessed via `queries` /
auto-injected `runSql` / `describeTables`) and Markdown resources — both mapping to the MCP
`server.resource` primitive. There is no parameterized URI template, no `resources/templates/list`
equivalent, and no method-with-named-arguments resource form. Resource parameters are
SQL `?` bindings restricted to scalar values. A method like `nearPoint( { lat, lon,
radiusMeters, limit } )` therefore has no lossless target in the resource model and could
not be consumed by an MCP client as a resource template, because neither `flowmcp-core` nor
`flowmcp-cli` has any code path that would emit or register such a primitive.

---

## VERDICT

**NICHT TRAGFÄHIG**

The FlowMCP spec has no Resource-Template primitive (evidence 1–6). Criteria (a), (b), and
(d) of the pre-fixed checklist fail; (c) is satisfied only as "the missing support is clearly
named." Emitting `nearPoint` as a parameterized MCP Resource Template is therefore not
feasible against the current spec, core, and CLI. The Tools path remains the only correct and
client-consumable emission.

---

## Consequence (Fallback branch — PRD-013 Branch B)

- **kein Blocker, geparkt** — per Memo 100, Kap. 14 (Risiken): "Resources strukturell (F5):
  ggf. parken." This spike strand ends without follow-up: it does not block the Memo 100
  rollout.
- The existing Tools emission `FlowMcpAdapter.buildToolDefinitions`
  (`src/adapters/FlowMcpAdapter.mjs:46-81`) is **left unchanged**. The GeoJSON default methods
  continue to be emitted as MCP Tools, which is the spec-conformant path (evidence 6, 7).
- **No probe function was added** to `FlowMcpAdapter.mjs`. Because the spec offers no target
  primitive, a "Resource-Template descriptor" probe would only encode an invented, non-spec
  shape — it would be a research artifact with no client that could consume it, and it would
  add surface area to a verified file for no productive gain. Per PRD-013 Branch B, the
  probe is documented here as a research artifact rather than left as dead code.
- **No change** to `flowmcp-spec`, `flowmcp-core`, or `flowmcp-cli` (PRD-013 Branch B
  acceptance: diff in these three repos is empty).

## If the spec evolves (out of scope for this PRD)

Should a Resource-Template primitive ever be desired, it would require a **new follow-up
Memo/PRD** spanning `flowmcp-spec` (a new `source`/primitive with a URI-template grammar and
non-SQL parameter binding), plus `flowmcp-core` and `flowmcp-cli` emission/registration
support, plus an MCP-client consumption test. That is explicitly **not** implemented or
proposed-in-detail here, because the verdict is NICHT TRAGFÄHIG against the current spec —
there is no incremental, additive change available within v4.3.0.
