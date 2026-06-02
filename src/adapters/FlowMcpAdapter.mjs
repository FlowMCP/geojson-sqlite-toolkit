import { SqliteBuilder } from '../shared/SqliteBuilder.mjs'
import { MetaWriter } from '../shared/MetaWriter.mjs'
import { GeojsonMetadataSchema } from '../converters/geojson/GeojsonMetadataSchema.mjs'
import { GeojsonDefaultMethods } from '../converters/geojson/GeojsonDefaultMethods.mjs'


export class FlowMcpAdapter {
    static verifySeal( { dbPath } ) {
        const { status, messages } = FlowMcpAdapter.#validationVerifySeal( { dbPath } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        let db = null
        try {
            const opened = SqliteBuilder.openDatabase( { dbPath } )
            db = opened.db
        } catch( e ) {
            return { sealed: false, meta: null, reason: 'DB_UNREADABLE' }
        }

        try {
            const hasMetaRow = db
                .prepare( "SELECT name FROM sqlite_master WHERE type='table' AND name='meta'" )
                .get()
            if( !hasMetaRow ) {
                return { sealed: false, meta: null, reason: 'NO_META' }
            }

            const raw = MetaWriter.readMeta( { db } )
            if( raw.qualitySeal !== 'sqlite-geojson' ) {
                return { sealed: false, meta: null, reason: 'NO_SEAL' }
            }

            return { sealed: true, meta: raw }
        } finally {
            try { db.close() } catch( e ) { /* ignore */ }
        }
    }


    static getAvailableMethods( { dbPath } ) {
        const { status, messages } = FlowMcpAdapter.#validationGetAvailableMethods( { dbPath } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const meta = GeojsonMetadataSchema.parseMeta( { dbPath } )
        const capabilities = GeojsonMetadataSchema.parseCapabilities( { metaTable: meta } ) || {}
        const methods = GeojsonDefaultMethods.getMethodsForCapabilities( { capabilities } )
        return { methods, capabilities }
    }


    static buildToolDefinitions( { dbPath, namespace } ) {
        const { status, messages } = FlowMcpAdapter.#validationBuildToolDefinitions( { dbPath, namespace } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath } )

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
                    sqlTemplate: method.sqlTemplate
                }
            } )
        return { tools }
    }


    static #validationVerifySeal( { dbPath } ) {
        const struct = { status: false, messages: [] }
        if( dbPath === undefined || dbPath === null ) {
            struct.messages.push( 'dbPath is required' )
            return struct
        }
        if( typeof dbPath !== 'string' ) {
            struct.messages.push( 'dbPath must be a string' )
            return struct
        }
        if( dbPath.length === 0 ) {
            struct.messages.push( 'dbPath must not be empty' )
            return struct
        }
        struct.status = true
        return struct
    }


    static #validationGetAvailableMethods( { dbPath } ) {
        const struct = { status: false, messages: [] }
        if( dbPath === undefined || dbPath === null ) {
            struct.messages.push( 'dbPath is required' )
            return struct
        }
        if( typeof dbPath !== 'string' ) {
            struct.messages.push( 'dbPath must be a string' )
            return struct
        }
        if( dbPath.length === 0 ) {
            struct.messages.push( 'dbPath must not be empty' )
            return struct
        }
        struct.status = true
        return struct
    }


    static #validationBuildToolDefinitions( { dbPath, namespace } ) {
        const struct = { status: false, messages: [] }
        const fields = [
            [ 'dbPath',    dbPath,    'string', null ],
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
