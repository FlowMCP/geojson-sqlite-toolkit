# geojson-sqlite-toolkit

Convert GeoJSON FeatureCollections (RFC 7946) into queryable, quality-sealed SQLite databases, and expose reusable spatial queries as FlowMCP auto-tools.

This is a **file add-on** in the FlowMCP ecosystem, mirroring the structure of [`gtfs-sqlite-toolkit`](https://github.com/FlowMCP/gtfs-sqlite-toolkit). It is **not** a generic loader inside `flowmcp-core` — it is a standalone repo: own converter, own sealed SQLite, auto-inject via `FlowMcpAdapter`.

GeoJSON is self-describing (RFC 7946: `FeatureCollection.features[]`, geometry as `[lon, lat]`, free-form `properties`), so the converter needs **minimal configuration** — no column or separator hints like a CSV add-on would.

## Install

This package is not published to npm. Use it via GitHub:

```bash
npm install github:FlowMCP/geojson-sqlite-toolkit
```

`better-sqlite3` is a **peer dependency** (you provide it in the consuming project).

## Convert

```javascript
import { GeojsonSqliteConverter } from 'geojson-sqlite-toolkit'

const result = await GeojsonSqliteConverter.start( {
    input: '/path/to/features.geojson',
    inputType: 'geojson',          // 'geojson' | 'json' | 'folder' | 'buffer' | 'auto'
    dbPath: '/path/to/features.db',
    force: false,                  // true = build DB even on validation errors (no seal)
    sourceUrl: 'https://example.org/features.geojson'
} )

// result.status, result.seal ('sqlite-geojson' | null), result.capabilities, result.report
```

The converter:
1. Reads + `JSON.parse`s the input, validates against RFC 7946 (`GeojsonSpecValidator`).
2. Writes one row per feature into a `features` table.
3. Seals the DB with `meta.qualitySeal = 'sqlite-geojson'` (only when there are no errors and no warnings).
4. Writes via a temporary `.new` file and an atomic swap.

### Representative point (NO SILENT DEFAULT)

`nearPoint` needs a single point per feature. Non-Point geometries are reduced by an **explicit, documented** rule (`GeometryReducer`) — never silently "first coordinate":

| Geometry | Representative point |
|----------|----------------------|
| Point | the point itself |
| MultiPoint | mean of all points |
| LineString | the middle vertex |
| MultiLineString | middle vertex of the longest sub-line |
| Polygon | centroid of the outer ring (closing vertex excluded) |
| MultiPolygon | centroid of the outer ring of the first part |

The applied rule is stored per row in `features.representative_rule` and the full mapping in `meta.representativePointRules`. The bounding box always spans every coordinate, so `featuresInBBox` stays exact regardless of the representative point.

## Query

The query engine follows the verified `opsd` pattern (load + in-process cache + filter, haversine in km internally, radius in **meters** at the API):

```javascript
import { GeojsonDefaultMethods } from 'geojson-sqlite-toolkit'

GeojsonDefaultMethods.featuresInBBox( { dbPath, minLon, minLat, maxLon, maxLat, limit } )
GeojsonDefaultMethods.nearPoint( { dbPath, lat, lon, radiusMeters, limit } )   // sorted by distance, distanceM in output
GeojsonDefaultMethods.byType( { dbPath, geomType, propertyKey, propertyValue, limit } )
```

## FlowMCP integration

```javascript
import { FlowMcpAdapter } from 'geojson-sqlite-toolkit'

FlowMcpAdapter.verifySeal( { dbPath } )
// -> { sealed: true, meta } | { sealed: false, meta: null, reason: 'NO_SEAL' | 'NO_META' | 'DB_UNREADABLE' }

FlowMcpAdapter.getAvailableMethods( { dbPath } )
// -> { methods, capabilities } (capability-filtered)

FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'mygeo' } )
// -> { tools } with names prefixed 'mygeo.' and valid inputSchema
```

### Schema auto-inject contract

A FlowMCP schema declares the sealed DB as a `sqlite-geojson` resource. The CLI resolves the add-on and injects the tools:

```javascript
export const schema = {
    namespace: 'mygeo',
    name: 'mygeo-features-v1',
    version: '2.0.0',
    main: {
        resources: [
            {
                source:       'sqlite-geojson',
                mode:         'file-based',
                path:         '${FLOWMCP_RESOURCES}/my-features.db',
                addon:        'geojson-sqlite-toolkit',
                addonVersion: '>=0.1.0',
                addonSource:  'github:FlowMCP/geojson-sqlite-toolkit'
            }
        ],
        tools: []
    }
}
```

`${FLOWMCP_RESOURCES}` resolves to `~/.flowmcp/resources/`. Provider data never lives in this repo.

## Tests

```bash
npm install
npm test                 # jest unit + integration
npm run test:coverage:src
npm run test:manual      # POC against a local (non-committed) GeoJSON file
```

A CC0 synthetic fixture (`tests/fixtures/synthetic-geojson/`) is the only geodata in this repo. A pre-push guard (`scripts/check-no-provider-data.sh`) flags any other `.geojson`/`.json`/`.db` to prevent accidental redistribution of third-party data.

## License

MIT — see [LICENSE](./LICENSE). The synthetic fixture is CC0.
