# geojson-sqlite-toolkit

Load GeoJSON FeatureCollections (RFC 7946) from a URL into memory and expose
reusable spatial queries as FlowMCP auto-tools. There is **no SQLite file** and
**no file seal** — the complete file is fetched in a single request, validated
on load, and held in memory (Memo 096 URL model).

GeoJSON is **self-describing** (RFC 7946: `FeatureCollection.features[]`,
geometry as `[lon, lat]`, free-form `properties`), so — unlike a CSV add-on —
this toolkit needs **no parse config**. You point it at a URL; the shape is
already known.

This is a sibling of [`csv-tsv-sqlite-toolkit`](https://github.com/FlowMCP/csv-tsv-sqlite-toolkit)
and follows the same FlowMCP add-on pattern (own repo → thin URL schema →
in-memory load → auto-inject via `FlowMcpAdapter`).

## Install

This package is not published to npm. Use it via GitHub:

```bash
npm install github:FlowMCP/geojson-sqlite-toolkit
```

No native dependencies — the load path uses the global `fetch` and a pure-JS
validator. (`better-sqlite3` is no longer required; the seal/file path was
removed in the URL model.)

## Load

```javascript
import { GeojsonUrlStore } from 'geojson-sqlite-toolkit'

const result = await GeojsonUrlStore.loadFromUrl( {
    url: 'https://example.org/features.geojson'   // HTTPS only
} )

// result.recordCount, result.capabilities, result.fromCache
```

The store:
1. Validates the URL is HTTPS (else it throws — no silent default).
2. Fetches the COMPLETE GeoJSON document in a single request.
3. Parses and validates on load against RFC 7946 (`GeojsonSpecValidator`) — this
   replaces the former quality seal. Invalid GeoJSON aborts the load.
4. Reduces every feature to a flat row and holds the rows in memory keyed by URL
   (24 h TTL). There is no `.db` file and no on-disk artifact.

### Representative point (NO SILENT DEFAULT)

`nearPoint` needs a single point per feature. Non-Point geometries are reduced by
an **explicit, documented** rule (`GeometryReducer`) — never silently "first
coordinate":

| Geometry | Representative point |
|----------|----------------------|
| Point | the point itself |
| MultiPoint | mean of all points |
| LineString | the middle vertex |
| MultiLineString | middle vertex of the longest sub-line |
| Polygon | centroid of the outer ring (closing vertex excluded) |
| MultiPolygon | centroid of the outer ring of the first part |

The applied rule is stored per row in `representative_rule`. The bounding box
always spans every coordinate, so `featuresInBBox` stays exact regardless of the
representative point.

## Query

The query engine reads the in-memory rows and serves three queries (Haversine in
km internally, radius in **meters** at the API):

```javascript
import { GeojsonDefaultMethods } from 'geojson-sqlite-toolkit'

GeojsonDefaultMethods.featuresInBBox( { url, minLon, minLat, maxLon, maxLat, limit } )
GeojsonDefaultMethods.nearPoint( { url, lat, lon, radiusMeters, limit } )   // sorted by distance, distanceM in output
GeojsonDefaultMethods.byType( { url, geomType, propertyKey, propertyValue, limit } )
```

A fix in the add-on propagates to every schema that uses it — there is one
central implementation, not a per-file copy.

## FlowMCP integration

```javascript
import { FlowMcpAdapter } from 'geojson-sqlite-toolkit'

await FlowMcpAdapter.loadFromUrl( { url } )
// -> { loaded: true, url, capabilities, recordCount, fromCache }

FlowMcpAdapter.getAvailableMethods( { url } )
// -> { methods, capabilities } (capability-filtered)

FlowMcpAdapter.buildToolDefinitions( { url, namespace: 'mygeo' } )
// -> { tools } with names prefixed 'mygeo.' and valid inputSchema

FlowMcpAdapter.executeMethod( { url, method: 'nearPoint', params: { lat, lon, radiusMeters } } )
// -> rows from the in-memory store
```

### Auto-Tools

`buildToolDefinitions` emits the following tools, subject to the loaded file's
capability matrix:

- `featuresInBBox` — features within a latitude/longitude bounding box (requires `spatialQuery`)
- `nearPoint` — features near a coordinate, Haversine-sorted (requires `spatialQuery`)
- `byType` — features filtered by geometry type and/or a property key/value (requires `typeFilter`)

Tool names are prefixed with the schema namespace (e.g. `mygeo.nearPoint`). When
a capability is missing, the corresponding tool is omitted.

> **Spike note (Memo 100, PRD-013 / F5):** A spike investigated whether `nearPoint`
> could instead be emitted as an MCP **Resource Template** (parameterized resource URI).
> Verdict: **NICHT TRAGFÄHIG** — FlowMCP v4.3.0 defines no Resource-Template primitive
> (resources map to MCP `server.resource` and bind to SQL `?` placeholders only). The
> methods stay emitted as Tools. Parked, no blocker. See
> [`docs/spike-resource-template.md`](./docs/spike-resource-template.md).

### Schema auto-inject contract

A FlowMCP schema declares a thin URL add-on resource. The CLI resolves the
add-on, calls `loadFromUrl`, and injects the tools:

```javascript
export const schema = {
    namespace: 'mygeo',
    name: 'mygeo-features-v1',
    version: '2.0.0',
    main: {
        resources: [
            {
                source:       'sqlite-geojson',
                mode:         'url',
                url:          'https://example.org/features.geojson',
                addon:        'geojson-sqlite-toolkit',
                addonVersion: '>=0.1.0',
                addonSource:  'github:FlowMCP/geojson-sqlite-toolkit'
            }
        ],
        tools: []
    }
}
```

Provider GeoJSON data is never shipped in this repository — the schema points at
the provider's own HTTPS URL. There are no API keys, because there is no API.

## Scope (Memo 090 K3)

The add-on targets **complete, single-step-downloadable static GeoJSON** — one
HTTPS request returns the whole FeatureCollection. Paginated or query-per-page
sources (e.g. WFS) are **out of scope**: a single `loadFromUrl` could not fetch
them in one request.

## Error Codes

The URL-mode load path uses the `GJSON-URL-NNN` scheme:

| Code | Meaning |
|------|---------|
| `GJSON-URL-001` | `url` missing, not a string, or not HTTPS |
| `GJSON-URL-002` | fetch failed (network error or non-2xx) |
| `GJSON-URL-003` | validate-on-load: response is not valid JSON / not valid GeoJSON / no reducible features |
| `GJSON-URL-004` | query/accessor called for a URL that was never loaded |

## Capability Matrix

| Capability | Trigger |
|------------|---------|
| `spatialQuery` | at least one feature with a representative point |
| `typeFilter` | at least one feature with a geometry type or property |

## Provider Data Policy

Provider GeoJSON datasets carry individual licenses and are **never** shipped in
this repo. Only the synthetic CC0 fixture under
`tests/fixtures/synthetic-geojson/` is included. A pre-push guard
(`scripts/check-no-provider-data.sh`) flags any other `.geojson`/`.json` to
prevent accidental redistribution of third-party data.

## Tests

```bash
git clone https://github.com/FlowMCP/geojson-sqlite-toolkit
cd geojson-sqlite-toolkit
npm install
npm test                 # jest unit suites (stubbed fetch, no live network)
npm run test:coverage:src
npm run test:manual      # POC against a local (non-committed) GeoJSON file
```

## License

MIT — see [LICENSE](./LICENSE). The synthetic fixture is CC0.
</content>
</invoke>
