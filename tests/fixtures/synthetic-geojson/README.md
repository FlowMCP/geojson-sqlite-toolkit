# Synthetic Mini-GeoJSON Fixture (CC0)

A fully fictional GeoJSON FeatureCollection (RFC 7946) used for reproducible tests of the `geo-geojson-toolkit` and its FlowMCP integration. In URL mode (Memo 096) the file is served through a stubbed `fetch` and parsed into memory — there is no SQLite build artifact. No real-world geodata is included.

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
└── source/
    └── sample.geojson      5 fictional features (3 Point, 1 LineString, 1 Polygon)
```

## Usage

`source/sample.geojson` is read by the test suites and the manual runner
(`tests/manual/run-all.mjs`), served through a stubbed `fetch`, and parsed into
memory via `GeojsonUrlStore.loadFromUrl`. No on-disk database is produced.

## Capabilities

The loaded collection activates these `GeojsonCapabilityDetector` booleans:

| Capability | State | Reason |
|------------|-------|--------|
| `spatialQuery` | true | at least one feature has a representative point |
| `pointFeatures` | true | three Point features |
| `lineFeatures` | true | one LineString feature |
| `areaFeatures` | true | one Polygon feature |
| `typeFilter` | true | features present |
| `propertyFilter` | true | features carry non-empty `properties` |

## Representative-point rule

`GeometryReducer` reduces non-Point geometries to a single representative point
(NO SILENT DEFAULT). The applied rule is recorded per row in
`representative_rule`:

| Geometry | Representative point |
|----------|----------------------|
| Point | the point itself |
| MultiPoint | mean of all points |
| LineString | the middle vertex |
| MultiLineString | middle vertex of the longest sub-line |
| Polygon | centroid of the outer ring (closing vertex excluded) |
| MultiPolygon | centroid of the outer ring of the first part |

The bounding box always spans every coordinate of the geometry, so
`inBoundingBox` stays exact regardless of the representative point.

## Repository policy

- `source/sample.geojson` is **tracked** (original CC0 work).
- No build artifacts are produced (URL mode is in-memory).

For real datasets, host the file at an HTTPS URL the schema references — never commit third-party geodata.
