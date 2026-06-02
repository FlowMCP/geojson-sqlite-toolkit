# Synthetic Mini-GeoJSON Fixture (CC0)

A fully fictional GeoJSON FeatureCollection (RFC 7946) used for reproducible tests of the `geojson-sqlite-toolkit` and its FlowMCP integration. No real-world geodata is included.

## Purpose

Allow integration tests, CI runs and FlowMCP CLI exercises to run without distributing or relying on third-party geodata. Real GeoJSON datasets carry source-specific license terms and must not enter this repository.

## License

**CC0 1.0 Universal — Public Domain Dedication.**

The single source file in `source/sample.geojson` is an original synthetic work. It contains no real place names, addresses, or coordinates from any real dataset. The dedication is documented in `LICENSE`.

## Contents

```
synthetic-geojson/
├── LICENSE                 CC0 1.0 Universal legal text
├── README.md               this file
├── build-fixture.mjs       builds synthetic-geojson.db from source/
├── source/
│   └── sample.geojson      5 fictional features (3 Point, 1 LineString, 1 Polygon)
└── synthetic-geojson.db    build artifact, gitignored
```

## Building

```bash
node tests/fixtures/synthetic-geojson/build-fixture.mjs
```

The script reads `source/sample.geojson`, converts it via `GeojsonSqliteConverter`, and writes `synthetic-geojson.db` next to itself.

## Capabilities

The resulting database activates these `GeojsonCapabilityDetector` booleans:

| Capability | State | Reason |
|------------|-------|--------|
| `spatialQuery` | true | at least one feature has a representative point |
| `pointFeatures` | true | three Point features |
| `lineFeatures` | true | one LineString feature |
| `areaFeatures` | true | one Polygon feature |
| `typeFilter` | true | features present |
| `propertyFilter` | true | features carry non-empty `properties` |

## Representative-point rule

The converter reduces non-Point geometries to a single representative point
(NO SILENT DEFAULT). The applied rule is stored per row in
`features.representative_rule` and the full mapping is stored in
`meta.representativePointRules`:

| Geometry | Representative point |
|----------|----------------------|
| Point | the point itself |
| MultiPoint | mean of all points |
| LineString | the middle vertex |
| MultiLineString | middle vertex of the longest sub-line |
| Polygon | centroid of the outer ring (closing vertex excluded) |
| MultiPolygon | centroid of the outer ring of the first part |

The bounding box always spans every coordinate of the geometry, so
`featuresInBBox` stays exact regardless of the representative point.

## Repository policy

- `source/sample.geojson` is **tracked** (original CC0 work).
- `synthetic-geojson.db` is **gitignored** (rebuilt on demand).
- WAL artifacts (`*.db-shm`, `*.db-wal`) are gitignored via the global `*.db` pattern.

For real datasets, keep user-provided data outside the repository at `${FLOWMCP_RESOURCES}/`.
