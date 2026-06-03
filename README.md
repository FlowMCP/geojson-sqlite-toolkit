# geo-geojson-toolkit

Load GeoJSON FeatureCollections (RFC 7946) from a URL into memory and expose
reusable spatial queries as FlowMCP auto-tools. The complete file is fetched in a
single request, validated on load, and held in memory (Memo 096 URL model).

GeoJSON is **self-describing** (RFC 7946: `FeatureCollection.features[]`,
geometry as `[lon, lat]`, free-form `properties`), so — unlike a CSV add-on —
this toolkit needs **no parse config**. You point it at a URL; the shape is
already known.

This add-on is part of the FlowMCP geo add-on family (`geo-geojson-toolkit` /
`geo-csv-tsv-toolkit` / `gtfs-sqlite-toolkit` / `geo-overpass-toolkit`). It shares
the common geo method family — `nearPoint`, `inBoundingBox`, `byType`.

## Runtime category

**In-Memory** (URL model, no SQLite). The complete FeatureCollection is fetched
in one request and held in memory keyed by URL — there is no `.db` file and no
on-disk artifact.

## Install

This package is not published to npm. Use it via GitHub:

```bash
npm install github:FlowMCP/geojson-sqlite-toolkit
```

No native dependencies — the load path uses the global `fetch` and a pure-JS
validator. This is an In-Memory add-on; it never writes a database file.

## Load

```javascript
import { GeojsonUrlStore } from 'geo-geojson-toolkit'

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
always spans every coordinate, so `inBoundingBox` stays exact regardless of the
representative point.

## Methods

The query engine reads the in-memory rows and serves the shared geo method family
(Haversine in km internally, radius in **meters** at the API):

| Method | Input | Output |
|--------|-------|--------|
| `nearPoint` | `{ url, lat, lon, radiusMeters, limit? }` | FeatureCollection near a point, distance-sorted (`_distanceMeters` per feature) |
| `inBoundingBox` | `{ url, minLon, minLat, maxLon, maxLat, limit? }` (lon-first RFC 7946) | FeatureCollection overlapping the bbox |
| `byType` | `{ url, geomType?, propertyKey?, propertyValue?, limit? }` | FeatureCollection filtered by geometry type and/or property |

```javascript
import { GeojsonDefaultMethods } from 'geo-geojson-toolkit'

GeojsonDefaultMethods.nearPoint( { url, lat, lon, radiusMeters, limit } )   // sorted by distance, _distanceMeters per feature
GeojsonDefaultMethods.inBoundingBox( { url, minLon, minLat, maxLon, maxLat, limit } )
GeojsonDefaultMethods.byType( { url, geomType, propertyKey, propertyValue, limit } )
```

### Output: normalized RFC 7946 FeatureCollection (v2.0.0)

All three methods return the **shared geo output contract** ("gleicher Standard",
matching `geo-overpass-toolkit`): a normalized RFC 7946 `FeatureCollection` with
lon-first coordinates. Each feature keeps its original properties plus the
canonical anchor fields `feature_id`, `geom_type`, `_source` and `_distanceMeters`.

```jsonc
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [ 10.0, 50.0 ] },   // [ lon, lat ] — lon-first
      "properties": {
        // ...original feature properties...
        "feature_id": 0,
        "geom_type": "Point",
        "_source": "geojson",
        "_distanceMeters": 12.3   // number for nearPoint, null for inBoundingBox / byType
      }
    }
  ],
  "meta": { "count": 1, "source": "geojson" }
}
```

- `nearPoint`: `_distanceMeters` is the haversine distance in metres (rounded to
  0.1); features are sorted ascending by it and sliced to `limit`.
- `inBoundingBox` / `byType`: `_distanceMeters` is `null`; features sliced to `limit`.
- `meta.count` always equals `features.length`.

> **Breaking change in v2.0.0** — the previous output
> (`{ features: [ { feature_id, geom_type, lat, lon, distanceM?, properties } ], matchCount }`)
> was replaced by the FeatureCollection above. `lat`/`lon` are now `geometry.coordinates`
> (lon-first), `feature_id`/`geom_type` moved into `properties`, `distanceM` became
> `properties._distanceMeters`, and `matchCount` became `meta.count`.

The optional `selection` / `categories[]` slots in the shared family are
**Overpass-only** and are ignored by this static add-on (declared, not silently
dropped).

A fix in the add-on propagates to every schema that uses it — there is one
central implementation, not a per-file copy.

## FlowMCP integration

```javascript
import { FlowMcpAdapter } from 'geo-geojson-toolkit'

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

- `nearPoint` — features near a coordinate, Haversine-sorted (requires `spatialQuery`)
- `inBoundingBox` — features within a lon-first bounding box (requires `spatialQuery`)
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
                source:       'geo-geojson',
                mode:         'url',
                url:          'https://example.org/features.geojson',
                addon:        'geo-geojson-toolkit',
                addonVersion: '>=1.0.0',
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
