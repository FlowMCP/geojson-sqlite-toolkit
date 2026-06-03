# GJSON-NNN Error Codes

Reference for all codes emitted by `geo-geojson-toolkit`. Codes are grouped by severity, signalled by the numeric range.

> Codes are calibrated against [RFC 7946 — The GeoJSON Format](https://datatracker.ietf.org/doc/html/rfc7946). RFC 7946 is a stable single specification, so there is no dated snapshot mechanism (unlike the GTFS toolkit's spec-reference files).

| Range | Severity |
|-------|----------|
| `GJSON-001` – `GJSON-099` | ERROR (blocks conversion in default mode) |
| `GJSON-100` – `GJSON-199` | WARNING (allows conversion, but no seal) |
| `GJSON-200` – `GJSON-299` | INFO (informational, seal still possible) |

## ERROR codes

| Code | Default context | Meaning | Example |
|------|-----------------|---------|---------|
| `GJSON-001` | input file | Input is not valid JSON | File body is not parseable JSON |
| `GJSON-002` | input file | Top-level type is not FeatureCollection | `type` is `"Feature"` instead of `"FeatureCollection"` |
| `GJSON-003` | input file | features is missing or not an array | `features` key absent |
| `GJSON-004` | the feature | Feature has no geometry or geometry is malformed | `geometry` is `null` |
| `GJSON-005` | the feature | Geometry type is unsupported | `geometry.type` is `"Circle"` |
| `GJSON-006` | the feature | Geometry coordinates missing or malformed | `coordinates` is `[]` |
| `GJSON-007` | input file | FeatureCollection has no features | `features` array is empty |

## WARNING codes

| Code | Default context | Meaning | Example |
|------|-----------------|---------|---------|
| `GJSON-101` | the feature | Feature element is not of type Feature | `features[i].type` is not `"Feature"` |
| `GJSON-102` | the feature | Feature properties is not an object | `properties` is an array |
| `GJSON-103` | the feature | Coordinate value out of WGS84 range | longitude `> 180` |
| `GJSON-104` | the feature | GeometryCollection encountered (representative point skipped) | mixed-geometry feature |

## INFO codes

| Code | Default context | Meaning |
|------|-----------------|---------|
| `GJSON-201` | features | Point geometries present |
| `GJSON-202` | features | Line geometries present (LineString/MultiLineString) |
| `GJSON-203` | features | Polygon geometries present (Polygon/MultiPolygon) |
| `GJSON-204` | features | Multi geometries present |

## Adding new codes

Add to `src/shared/Validation.mjs` (the `GJSON_CODES` dictionary). The severity is derived from the numeric range — no separate mapping needed. Document the new code in this file.
