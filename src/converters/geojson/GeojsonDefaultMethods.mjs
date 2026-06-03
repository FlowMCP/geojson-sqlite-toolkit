import { GeojsonUrlStore } from './GeojsonUrlStore.mjs'


//
// GeojsonDefaultMethods
// ---------------------
// Method catalog PLUS an in-process query engine that runs over the IN-MEMORY
// rows held by GeojsonUrlStore (Memo 096 — URL mode, no SQLite). Three methods:
//
//   inBoundingBox  -> bbox overlap on the representative point bounds (lon-first RFC 7946)
//   nearPoint      -> haversine distance, radius in METERS, sorted ascending
//   byType         -> filter by geom_type and/or a properties key/value
//
// All three methods return a normalized RFC 7946 FeatureCollection (lon-first
// coordinates) — the shared "gleicher Standard" geo output contract, matching
// geo-overpass-toolkit. Each feature carries the canonical anchor fields inside
// its properties: feature_id, geom_type, _source ('geojson') and _distanceMeters
// (the haversine metres for nearPoint, null otherwise).
//
// Rows are loaded and cached by GeojsonUrlStore (keyed by url). The algorithms
// here operate on plain row arrays and are source-agnostic.
//

const SOURCE = 'geojson'

const FEATURE_COLLECTION_OUTPUT_SCHEMA = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: [ 'FeatureCollection' ] },
        features: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type:     { type: 'string', enum: [ 'Feature' ] },
                    geometry: {
                        type: 'object',
                        properties: {
                            type:        { type: 'string', enum: [ 'Point' ] },
                            coordinates: { type: 'array', items: { type: 'number' }, description: '[ lon, lat ] (lon-first RFC 7946)' }
                        }
                    },
                    properties: {
                        type: 'object',
                        description: 'Original feature properties plus feature_id, geom_type, _source, _distanceMeters'
                    }
                }
            }
        },
        meta: {
            type: 'object',
            properties: {
                count:  { type: 'integer', description: 'Number of features' },
                source: { type: 'string', enum: [ 'geojson' ] }
            }
        }
    }
}


const METHOD_CATALOG = [
    {
        name: 'inBoundingBox',
        requiresCapabilities: [ 'spatialQuery' ],
        params: {
            minLon:     { type: 'number',  required: true,  description: 'West bound (WGS84 longitude, lon-first RFC 7946)' },
            minLat:     { type: 'number',  required: true,  description: 'South bound (WGS84 latitude)' },
            maxLon:     { type: 'number',  required: true,  description: 'East bound (WGS84 longitude)' },
            maxLat:     { type: 'number',  required: true,  description: 'North bound (WGS84 latitude)' },
            selection:  { type: 'string',  required: false, description: 'Overpass-only selection id — ignored by static add-ons' },
            categories: { type: 'array',   required: false, description: 'Overpass-only category ids — ignored by static add-ons' },
            limit:      { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: FEATURE_COLLECTION_OUTPUT_SCHEMA
    },
    {
        name: 'nearPoint',
        requiresCapabilities: [ 'spatialQuery' ],
        params: {
            lat:          { type: 'number',  required: true,  description: 'Center latitude (WGS84)' },
            lon:          { type: 'number',  required: true,  description: 'Center longitude (WGS84)' },
            radiusMeters: { type: 'number',  required: true,  description: 'Search radius in METERS' },
            selection:    { type: 'string',  required: false, description: 'Overpass-only selection id — ignored by static add-ons' },
            categories:   { type: 'array',   required: false, description: 'Overpass-only category ids — ignored by static add-ons' },
            limit:        { type: 'integer', required: false, default: 50, description: 'Max results' }
        },
        outputSchema: FEATURE_COLLECTION_OUTPUT_SCHEMA
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
        outputSchema: FEATURE_COLLECTION_OUTPUT_SCHEMA
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


    static inBoundingBox( { url, minLon, minLat, maxLon, maxLat, limit = 100 } ) {
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
            .map( ( feature ) => GeojsonDefaultMethods.#toFeature( { feature, distanceMeters: null } ) )
        return GeojsonDefaultMethods.#toFeatureCollection( { features: matched } )
    }


    static nearPoint( { url, lat, lon, radiusMeters, limit = 50 } ) {
        const { features } = GeojsonDefaultMethods.#loadFeatures( { url } )
        const matched = features
            .map( ( feature ) => {
                const distanceMeters = GeojsonDefaultMethods.#haversineKm( {
                    lat1: lat, lon1: lon, lat2: feature.lat, lon2: feature.lon
                } ) * 1000
                return { feature, distanceMeters }
            } )
            .filter( ( entry ) => entry.distanceMeters <= radiusMeters )
            .sort( ( a, b ) => a.distanceMeters - b.distanceMeters )
            .slice( 0, limit )
            .map( ( entry ) => {
                const distanceMeters = Math.round( entry.distanceMeters * 10 ) / 10
                return GeojsonDefaultMethods.#toFeature( { feature: entry.feature, distanceMeters } )
            } )
        return GeojsonDefaultMethods.#toFeatureCollection( { features: matched } )
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
            .map( ( feature ) => GeojsonDefaultMethods.#toFeature( { feature, distanceMeters: null } ) )
        return GeojsonDefaultMethods.#toFeatureCollection( { features: matched } )
    }


    static #loadFeatures( { url } ) {
        return GeojsonUrlStore.getFeatures( { url } )
    }


    static #toFeatureCollection( { features } ) {
        return {
            type: 'FeatureCollection',
            features,
            meta: { count: features.length, source: SOURCE }
        }
    }


    static #toFeature( { feature, distanceMeters } ) {
        const originalProperties = GeojsonDefaultMethods.#parseProps( { feature } )
        const properties = {
            ...originalProperties,
            feature_id: feature.feature_id,
            geom_type: feature.geom_type,
            _source: SOURCE,
            _distanceMeters: distanceMeters
        }
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [ feature.lon, feature.lat ] },
            properties
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
