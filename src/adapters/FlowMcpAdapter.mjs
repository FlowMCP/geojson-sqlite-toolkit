import { GeojsonUrlStore } from '../converters/geojson/GeojsonUrlStore.mjs'
import { GeojsonDefaultMethods } from '../converters/geojson/GeojsonDefaultMethods.mjs'


//
// FlowMcpAdapter (URL mode — Memo 096)
// ------------------------------------
// Consumer API for FlowMCP-CLI. The former file-based / seal path is gone.
// The CLI now: (1) loadFromUrl — fetch+parse+validate-on-load+in-memory,
// (2) buildToolDefinitions — derive auto-tools from in-memory capabilities,
// (3) at runtime calls the GeojsonDefaultMethods directly (keyed by url).
//
export class FlowMcpAdapter {
    static async loadFromUrl( { url } ) {
        const { status, messages } = FlowMcpAdapter.#validationUrl( { url } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const { capabilities, recordCount, fromCache } = await GeojsonUrlStore.loadFromUrl( { url } )
        return { loaded: true, url, capabilities, recordCount, fromCache }
    }


    static executeMethod( { url, method, params = {} } ) {
        const { status, messages } = FlowMcpAdapter.#validationUrl( { url } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const fn = GeojsonDefaultMethods[ method ]
        const known = [ 'inBoundingBox', 'nearPoint', 'byType' ]
        if( !known.includes( method ) || typeof fn !== 'function' ) {
            throw new Error( `Unknown method: ${method}` )
        }
        return fn( { url, ...params } )
    }


    static getAvailableMethods( { url } ) {
        const { status, messages } = FlowMcpAdapter.#validationUrl( { url } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const { capabilities } = GeojsonUrlStore.getCapabilities( { url } )
        const methods = GeojsonDefaultMethods.getMethodsForCapabilities( { capabilities } )
        return { methods, capabilities }
    }


    static buildToolDefinitions( { url, namespace } ) {
        const { status, messages } = FlowMcpAdapter.#validationBuildToolDefinitions( { url, namespace } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const { methods } = FlowMcpAdapter.getAvailableMethods( { url } )

        const tools = methods
            .map( ( method ) => {
                const properties = {}
                const required = []
                Object
                    .entries( method.params )
                    .forEach( ( [ paramName, paramDef ] ) => {
                        properties[ paramName ] = {
                            type: paramDef.type,
                            description: paramDef.description || ''
                        }
                        if( paramDef.required === true ) {
                            required.push( paramName )
                        }
                    } )
                return {
                    name: `${namespace}.${method.name}`,
                    description: `GeoJSON default method: ${method.name}`,
                    inputSchema: {
                        type: 'object',
                        properties,
                        required
                    },
                    outputSchema: method.outputSchema,
                    requiresCapabilities: method.requiresCapabilities,
                    method: method.name
                }
            } )
        return { tools }
    }


    static #validationUrl( { url } ) {
        const struct = { status: false, messages: [] }
        if( url === undefined || url === null ) {
            struct.messages.push( 'url is required' )
            return struct
        }
        if( typeof url !== 'string' ) {
            struct.messages.push( 'url must be a string' )
            return struct
        }
        if( url.length === 0 ) {
            struct.messages.push( 'url must not be empty' )
            return struct
        }
        struct.status = true
        return struct
    }


    static #validationBuildToolDefinitions( { url, namespace } ) {
        const struct = { status: false, messages: [] }
        const fields = [
            [ 'url',       url,       'string', null ],
            [ 'namespace', namespace, 'string', /^[a-z][a-z0-9-]*$/ ]
        ]
        fields
            .forEach( ( [ key, value, type, pattern ] ) => {
                if( value === undefined || value === null ) {
                    struct.messages.push( `${key} is required` )
                    return
                }
                if( typeof value !== type ) {
                    struct.messages.push( `${key} must be a ${type}` )
                    return
                }
                if( value.length === 0 ) {
                    struct.messages.push( `${key} must not be empty` )
                    return
                }
                if( pattern && !pattern.test( value ) ) {
                    struct.messages.push( `${key} must match ${pattern}` )
                }
            } )
        if( struct.messages.length === 0 ) { struct.status = true }
        return struct
    }
}
