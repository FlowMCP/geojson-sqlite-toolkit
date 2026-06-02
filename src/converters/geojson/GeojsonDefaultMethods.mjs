import { GeojsonUrlStore } from './GeojsonUrlStore.mjs'


//
// GeojsonDefaultMethods
// ---------------------
// Method catalog PLUS an in-process query engine that runs over the IN-MEMORY
// rows held by GeojsonUrlStore (Memo 096 — URL mode, no SQLite). Three methods:
//
//   featuresInBBox -> bbox overlap on the representative point bounds
//   nearPoint      -> haversine distance, radius in METERS, sorted ascending
//   byType         -> filter by geom_type and/or a properties key/value
//
// Rows are loaded and cached by GeojsonUrlStore (keyed by url). The algorithms
// here operate on plain row arrays and are source-agnostic.
//

const METHOD_CATALOG = [
    {
        name: 'featuresInBBox',
        requiresCapabilities: [ 'spatialQuery' ],
        params: {
            minLon: { type: 'number',  required: true,  description: 'West bound (WGS84 longitude)' },
            minLat: { type: 'number',  required: true,  description: 'South bound (WGS84 latitude)' },
            maxLon: { type: 'number',  required: true,  description: 'East bound (WGS84 longitude)' },
            maxLat: { type: 'number',  required: true,  description: 'North bound (WGS84 latitude)' },
            limit:  { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    feature_id: { type: 'integer' },
                    geom_type:  { type: 'string' },
                    lat:        { type: 'number' },
                    lon:        { type: 'number' },
                    properties: { type: 'object' }
                }
            }
        }
    },
    {
        name: 'nearPoint',
        requiresCapabilities: [ 'spatialQuery' ],
        params: {
            lat:          { type: 'number',  required: true,  description: 'Center latitude (WGS84)' },
            lon:          { type: 'number',  required: true,  description: 'Center longitude (WGS84)' },
            radiusMeters: { type: 'number',  required: true,  description: 'Search radius in METERS' },
            limit:        { type: 'integer', required: false, default: 50, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    feature_id:  { type: 'integer' },
                    geom_type:   { type: 'string' },
                    lat:         { type: 'number' },
                    lon:         { type: 'number' },
                    distanceM:   { type: 'number' },
                    properties:  { type: 'object' }
                }
            }
        }
    },
    {
        name: 'byType',
        requiresCapabilities: [ 'typeFilter' ],
        params: {
            geomType:      { type: 'string',  required: false, description: 'Geometry type filter (Point, LineString, Polygon, ...)' },
            propertyKey:   { type: 'string',  required: false, description: 'Property key to filter on' },
            propertyValue: { type: 'string',  required: false, description: 'Property value to match (string compare)' },
            limit:         { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    feature_id: { type: 'integer' },
                    geom_type:  { type: 'string' },
                    lat:        { type: 'number' },
                    lon:        { type: 'number' },
                    properties: { type: 'object' }
                }
            }
        }
    }
]


export class GeojsonDefaultMethods {
    static getAllMethods() {
        return METHOD_CATALOG.map( ( m ) => ( { ...m } ) )
    }


    static getMethodsForCapabilities( { capabilities } ) {
        return METHOD_CATALOG
            .filter( ( method ) => {
                return method.requiresCapabilities.every( ( cap ) => capabilities[ cap ] === true )
            } )
            .map( ( m ) => ( { ...m } ) )
    }


    static getMethodByName( { name } ) {
        const method = METHOD_CATALOG.find( ( m ) => m.name === name )
        if( !method ) {
            throw new Error( `Unknown method: ${name}` )
        }
        return { ...method }
    }


    static clearCache() {
        GeojsonUrlStore.clear()
    }


    static featuresInBBox( { url, minLon, minLat, maxLon, maxLat, limit = 100 } ) {
        const { features } = GeojsonDefaultMethods.#loadFeatures( { url } )
        const matched = features
            .filter( ( feature ) => {
                const overlaps = feature.bbox_max_lon >= minLon
                    && feature.bbox_min_lon <= maxLon
                    && feature.bbox_max_lat >= minLat
                    && feature.bbox_min_lat <= maxLat
                return overlaps
            } )
            .slice( 0, limit )
            .map( ( feature ) => GeojsonDefaultMethods.#toOutput( { feature } ) )
        return { features: matched, matchCount: matched.length }
    }


    static nearPoint( { url, lat, lon, radiusMeters, limit = 50 } ) {
        const { features } = GeojsonDefaultMethods.#loadFeatures( { url } )
        const withDistance = features
            .map( ( feature ) => {
                const distanceM = GeojsonDefaultMethods.#haversineKm( {
                    lat1: lat, lon1: lon, lat2: feature.lat, lon2: feature.lon
                } ) * 1000
                return { feature, distanceM }
            } )
            .filter( ( entry ) => entry.distanceM <= radiusMeters )
            .sort( ( a, b ) => a.distanceM - b.distanceM )
            .slice( 0, limit )
            .map( ( entry ) => {
                const out = GeojsonDefaultMethods.#toOutput( { feature: entry.feature } )
                out.distanceM = Math.round( entry.distanceM * 10 ) / 10
                return out
            } )
        return { features: withDistance, matchCount: withDistance.length }
    }


    static byType( { url, geomType = null, propertyKey = null, propertyValue = null, limit = 100 } ) {
        const { features } = GeojsonDefaultMethods.#loadFeatures( { url } )
        const matched = features
            .filter( ( feature ) => {
                if( geomType !== null && feature.geom_type !== geomType ) { return false }
                if( propertyKey !== null ) {
                    const props = GeojsonDefaultMethods.#parseProps( { feature } )
                    if( !Object.prototype.hasOwnProperty.call( props, propertyKey ) ) { return false }
                    if( propertyValue !== null && String( props[ propertyKey ] ) !== String( propertyValue ) ) { return false }
                }
                return true
            } )
            .slice( 0, limit )
            .map( ( feature ) => GeojsonDefaultMethods.#toOutput( { feature } ) )
        return { features: matched, matchCount: matched.length }
    }


    static #loadFeatures( { url } ) {
        return GeojsonUrlStore.getFeatures( { url } )
    }


    static #toOutput( { feature } ) {
        return {
            feature_id: feature.feature_id,
            geom_type: feature.geom_type,
            lat: feature.lat,
            lon: feature.lon,
            properties: GeojsonDefaultMethods.#parseProps( { feature } )
        }
    }


    static #parseProps( { feature } ) {
        if( feature.properties === null || feature.properties === undefined ) { return {} }
        try {
            const parsed = JSON.parse( feature.properties )
            return parsed === null ? {} : parsed
        } catch {
            return {}
        }
    }


    static #haversineKm( { lat1, lon1, lat2, lon2 } ) {
        const toRad = ( deg ) => deg * Math.PI / 180
        const R = 6371
        const dLat = toRad( lat2 - lat1 )
        const dLon = toRad( lon2 - lon1 )
        const a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
            Math.cos( toRad( lat1 ) ) * Math.cos( toRad( lat2 ) ) *
            Math.sin( dLon / 2 ) * Math.sin( dLon / 2 )
        const c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) )
        return R * c
    }
}
