import { Validation } from '../../shared/Validation.mjs'
import { GeojsonSpecValidator } from './GeojsonSpecValidator.mjs'
import { GeometryReducer } from './GeometryReducer.mjs'
import { GeojsonCapabilityDetector } from './GeojsonCapabilityDetector.mjs'


//
// GeojsonUrlStore
// ---------------
// URL-mode replacement for the converter/seal path (Memo 096). It fetches a
// COMPLETE GeoJSON document in a SINGLE request, validates it on load (F6 —
// no file seal), reduces every feature to the flat row shape the default
// methods consume, derives capabilities, and holds everything IN MEMORY keyed
// by URL. There is no SQLite file and no on-disk artifact.
//
// Row shape (identical to the former SQLite `features` table):
//   { feature_id, geom_type, lat, lon,
//     bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat,
//     representative_rule, properties (JSON string), geometry (JSON string) }
//
// Cache is keyed by url and mirrors the opsd pattern ( data + timestamp + ttl ).
//

const _cacheByUrl = new Map()
const CACHE_TTL_MS = 86400000


export class GeojsonUrlStore {
    static async loadFromUrl( { url, force = false } ) {
        const { status, messages } = GeojsonUrlStore.#validationLoadFromUrl( { url } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const now = Date.now()
        const cached = _cacheByUrl.get( url )
        if( !force && cached && ( now - cached.timestamp ) < CACHE_TTL_MS ) {
            return {
                url,
                capabilities: cached.capabilities,
                recordCount: cached.rows.length,
                fromCache: true
            }
        }

        const collection = await GeojsonUrlStore.#fetchCollection( { url } )
        const rows = GeojsonUrlStore.#parseAndValidate( { collection, url } )
        const capabilities = GeojsonCapabilityDetector.detect( { rows } )

        _cacheByUrl.set( url, { rows, capabilities, timestamp: now } )

        return { url, capabilities, recordCount: rows.length, fromCache: false }
    }


    static getFeatures( { url } ) {
        const cached = _cacheByUrl.get( url )
        if( !cached ) {
            throw new Error( `GJSON-URL-004: no in-memory data for url '${url}'. Call loadFromUrl first.` )
        }
        return { features: cached.rows }
    }


    static getCapabilities( { url } ) {
        const cached = _cacheByUrl.get( url )
        if( !cached ) {
            throw new Error( `GJSON-URL-004: no in-memory data for url '${url}'. Call loadFromUrl first.` )
        }
        return { capabilities: cached.capabilities }
    }


    static isLoaded( { url } ) {
        return { loaded: _cacheByUrl.has( url ) }
    }


    static clear() {
        _cacheByUrl.clear()
    }


    static async #fetchCollection( { url } ) {
        let response = null
        try {
            response = await fetch( url )
        } catch( e ) {
            throw new Error( `GJSON-URL-002: fetch failed for '${url}': ${e.message}` )
        }
        if( !response.ok ) {
            throw new Error( `GJSON-URL-002: fetch failed for '${url}': HTTP ${response.status}` )
        }

        const text = await response.text()
        try {
            return JSON.parse( text )
        } catch {
            throw new Error( `GJSON-URL-003: response from '${url}' is not valid JSON` )
        }
    }


    static #parseAndValidate( { collection, url } ) {
        const v = Validation.create()
        GeojsonSpecValidator.validate( { collection, filename: url, validation: v } )
        const report = v.report()
        if( report.errors.length > 0 ) {
            const detail = report.errors
                .map( ( e ) => `${e.code}: ${e.message}` )
                .join( '; ' )
            throw new Error( `GJSON-URL-003: '${url}' is not valid GeoJSON — ${detail}` )
        }

        const rows = []
        collection.features
            .forEach( ( feature, index ) => {
                const geometry = feature.geometry
                if( geometry === null || geometry === undefined || geometry.type === 'GeometryCollection' ) {
                    return
                }
                let reduced = null
                try {
                    reduced = GeometryReducer.reduce( { geometry } )
                } catch {
                    return
                }
                const properties = feature.properties && typeof feature.properties === 'object'
                    ? feature.properties
                    : {}
                rows.push( {
                    feature_id: index,
                    geom_type: geometry.type,
                    lat: reduced.lat,
                    lon: reduced.lon,
                    bbox_min_lon: reduced.bbox.minLon,
                    bbox_min_lat: reduced.bbox.minLat,
                    bbox_max_lon: reduced.bbox.maxLon,
                    bbox_max_lat: reduced.bbox.maxLat,
                    representative_rule: reduced.rule,
                    properties: JSON.stringify( properties ),
                    geometry: JSON.stringify( geometry )
                } )
            } )

        if( rows.length === 0 ) {
            throw new Error( `GJSON-URL-003: '${url}' contains no reducible features` )
        }
        return rows
    }


    static #validationLoadFromUrl( { url } ) {
        const struct = { status: false, messages: [] }
        if( url === undefined || url === null ) {
            struct.messages.push( 'GJSON-URL-001: url is required' )
            return struct
        }
        if( typeof url !== 'string' ) {
            struct.messages.push( 'GJSON-URL-001: url must be a string' )
            return struct
        }
        if( !url.startsWith( 'https://' ) ) {
            struct.messages.push( `GJSON-URL-001: url must use HTTPS, got '${url}'` )
            return struct
        }
        struct.status = true
        return struct
    }
}
