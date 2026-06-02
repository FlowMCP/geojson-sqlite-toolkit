//
// GeometryReducer
// ---------------
// Reduces any supported GeoJSON geometry (RFC 7946) to a single
// REPRESENTATIVE POINT [ lon, lat ] plus an axis-aligned bounding box.
//
// The representative-point rule is EXPLICIT and documented here (NO SILENT
// DEFAULT — PRD-G1, Memo 092). It is NOT "first coordinate":
//
//   Point            -> the point itself
//   MultiPoint       -> arithmetic mean of all points (centroid of vertices)
//   LineString       -> the MIDDLE vertex (index floor(n/2)); for an even
//                       vertex count this is the upper-middle vertex
//   MultiLineString  -> middle vertex of the LONGEST sub-line (most vertices)
//   Polygon          -> centroid (arithmetic mean) of the OUTER ring vertices,
//                       excluding the closing vertex that repeats the first
//   MultiPolygon     -> centroid of the outer ring of the FIRST polygon part
//
// The bounding box is always the min/max over EVERY coordinate of the
// geometry (all rings, all parts), so featuresInBBox stays exact regardless
// of the representative point.
//
// Every reduction returns { lon, lat, bbox, rule } where `rule` names the
// applied strategy so callers/consumers can see how the point was derived.
//

const REPRESENTATIVE_POINT_RULES = {
    Point:           'point-itself',
    MultiPoint:      'mean-of-points',
    LineString:      'middle-vertex',
    MultiLineString: 'middle-vertex-of-longest-line',
    Polygon:         'centroid-outer-ring',
    MultiPolygon:    'centroid-outer-ring-first-part'
}


export class GeometryReducer {
    static getRepresentativePointRules() {
        return { ...REPRESENTATIVE_POINT_RULES }
    }


    static reduce( { geometry } ) {
        const { type, coordinates } = geometry
        if( !Object.prototype.hasOwnProperty.call( REPRESENTATIVE_POINT_RULES, type ) ) {
            throw new Error( `GeometryReducer: unsupported geometry type "${type}"` )
        }

        const allPositions = GeometryReducer.#flattenPositions( { type, coordinates } )
        const bbox = GeometryReducer.#boundingBox( { positions: allPositions } )
        const representative = GeometryReducer.#representativePoint( { type, coordinates } )

        return {
            lon: representative[ 0 ],
            lat: representative[ 1 ],
            bbox,
            rule: REPRESENTATIVE_POINT_RULES[ type ]
        }
    }


    static #representativePoint( { type, coordinates } ) {
        if( type === 'Point' ) {
            return [ coordinates[ 0 ], coordinates[ 1 ] ]
        }
        if( type === 'MultiPoint' ) {
            return GeometryReducer.#mean( { positions: coordinates } )
        }
        if( type === 'LineString' ) {
            return GeometryReducer.#middleVertex( { line: coordinates } )
        }
        if( type === 'MultiLineString' ) {
            const longest = coordinates
                .slice()
                .sort( ( a, b ) => b.length - a.length )[ 0 ]
            return GeometryReducer.#middleVertex( { line: longest } )
        }
        if( type === 'Polygon' ) {
            return GeometryReducer.#ringCentroid( { ring: coordinates[ 0 ] } )
        }
        // MultiPolygon
        return GeometryReducer.#ringCentroid( { ring: coordinates[ 0 ][ 0 ] } )
    }


    static #middleVertex( { line } ) {
        const index = Math.floor( line.length / 2 )
        const position = line[ index ]
        return [ position[ 0 ], position[ 1 ] ]
    }


    static #ringCentroid( { ring } ) {
        const first = ring[ 0 ]
        const last = ring[ ring.length - 1 ]
        const isClosed = ring.length > 1 && first[ 0 ] === last[ 0 ] && first[ 1 ] === last[ 1 ]
        const vertices = isClosed ? ring.slice( 0, ring.length - 1 ) : ring
        return GeometryReducer.#mean( { positions: vertices } )
    }


    static #mean( { positions } ) {
        const totals = positions
            .reduce( ( acc, position ) => {
                return { lon: acc.lon + position[ 0 ], lat: acc.lat + position[ 1 ] }
            }, { lon: 0, lat: 0 } )
        return [ totals.lon / positions.length, totals.lat / positions.length ]
    }


    static #flattenPositions( { type, coordinates } ) {
        if( type === 'Point' ) {
            return [ coordinates ]
        }
        if( type === 'MultiPoint' || type === 'LineString' ) {
            return coordinates
        }
        if( type === 'MultiLineString' || type === 'Polygon' ) {
            return coordinates.flat()
        }
        // MultiPolygon -> array of polygons -> array of rings -> array of positions
        return coordinates.flat( 2 )
    }


    static #boundingBox( { positions } ) {
        const lons = positions.map( ( position ) => position[ 0 ] )
        const lats = positions.map( ( position ) => position[ 1 ] )
        return {
            minLon: Math.min( ...lons ),
            minLat: Math.min( ...lats ),
            maxLon: Math.max( ...lons ),
            maxLat: Math.max( ...lats )
        }
    }
}
