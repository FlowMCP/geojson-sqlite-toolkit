//
// GeojsonCapabilityDetector
// -------------------------
// Derives the capability map from the geometry types and property keys that
// actually occur in the converted features. The map gates which default
// methods FlowMcpAdapter exposes.
//
// Capabilities (all booleans):
//   spatialQuery  -> always true once >=1 feature has a representative point
//                    (enables inBoundingBox + nearPoint)
//   pointFeatures -> at least one Point/MultiPoint geometry present
//   lineFeatures  -> at least one LineString/MultiLineString geometry present
//   areaFeatures  -> at least one Polygon/MultiPolygon geometry present
//   typeFilter    -> always true (byType works on geom_type + properties)
//   propertyFilter-> at least one feature carries non-empty properties
//

const POINT_TYPES = [ 'Point', 'MultiPoint' ]
const LINE_TYPES = [ 'LineString', 'MultiLineString' ]
const AREA_TYPES = [ 'Polygon', 'MultiPolygon' ]


export class GeojsonCapabilityDetector {
    static detect( { rows } ) {
        const geomTypes = new Set( rows.map( ( row ) => row.geom_type ) )
        const hasAny = ( list ) => list.some( ( t ) => geomTypes.has( t ) )

        const hasProperties = rows.some( ( row ) => {
            if( row.properties === null || row.properties === undefined ) { return false }
            try {
                const parsed = JSON.parse( row.properties )
                return parsed !== null && typeof parsed === 'object' && Object.keys( parsed ).length > 0
            } catch {
                return false
            }
        } )

        return {
            spatialQuery:   rows.length > 0,
            pointFeatures:  hasAny( POINT_TYPES ),
            lineFeatures:   hasAny( LINE_TYPES ),
            areaFeatures:   hasAny( AREA_TYPES ),
            typeFilter:     rows.length > 0,
            propertyFilter: hasProperties
        }
    }
}
