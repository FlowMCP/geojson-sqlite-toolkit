import { SqliteBuilder } from '../../shared/SqliteBuilder.mjs'
import { MetaWriter } from '../../shared/MetaWriter.mjs'
import { Validation } from '../../shared/Validation.mjs'
import { InputDetector } from '../../shared/InputDetector.mjs'
import { FolderReader } from '../../shared/FolderReader.mjs'
import { GeojsonSpecValidator } from './GeojsonSpecValidator.mjs'
import { GeojsonCapabilityDetector } from './GeojsonCapabilityDetector.mjs'
import { GeometryReducer } from './GeometryReducer.mjs'
import { GeojsonMetadataSchema } from './GeojsonMetadataSchema.mjs'
import { GeojsonDefaultMethods } from './GeojsonDefaultMethods.mjs'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'


const CONVERTER_VERSION = 'geojson-sqlite-toolkit@0.1.0'

const FEATURES_SCHEMA = {
    features: [
        { name: 'feature_id',   type: 'INTEGER' },
        { name: 'geom_type',    type: 'TEXT' },
        { name: 'lat',          type: 'REAL' },
        { name: 'lon',          type: 'REAL' },
        { name: 'bbox_min_lon', type: 'REAL' },
        { name: 'bbox_min_lat', type: 'REAL' },
        { name: 'bbox_max_lon', type: 'REAL' },
        { name: 'bbox_max_lat', type: 'REAL' },
        { name: 'representative_rule', type: 'TEXT' },
        { name: 'properties',   type: 'TEXT' },
        { name: 'geometry',     type: 'TEXT' }
    ]
}


export class GeojsonConverter {
    static async run( { input, inputType = 'auto', force = false, dbPath, sourceUrl = null } ) {
        const resolvedType = inputType === 'auto'
            ? InputDetector.detect( { input } ).inputType
            : inputType

        const { collection, filename, sourceBuffer } = GeojsonConverter.#loadCollection( { input, inputType: resolvedType } )

        const v = Validation.create()
        if( collection === null ) {
            v.error( 'GJSON-001', filename, 'Input is not valid JSON' )
            return GeojsonConverter.#abort( { report: v.report() } )
        }

        GeojsonSpecValidator.validate( { collection, filename, validation: v } )
        const report = v.report()

        if( report.errors.length > 0 && !force ) {
            return GeojsonConverter.#abort( { report } )
        }

        const rows = GeojsonConverter.#buildRows( { collection, validation: v } )
        const postReport = v.report()

        if( postReport.errors.length > 0 && !force ) {
            return GeojsonConverter.#abort( { report: postReport } )
        }

        const dbPathNew = `${dbPath}.new`
        const { db } = SqliteBuilder.createDatabase( { dbPath: dbPathNew, schema: FEATURES_SCHEMA } )
        SqliteBuilder.insertRows( { db, tableName: 'features', rows } )

        const capabilities = GeojsonCapabilityDetector.detect( { rows } )

        const seal = GeojsonMetadataSchema.computeSeal( {
            validationReport: postReport,
            forceUsed: force && postReport.errors.length > 0
        } )

        const sourceHash = sourceBuffer
            ? createHash( 'sha256' ).update( sourceBuffer ).digest( 'hex' )
            : null

        const meta = GeojsonMetadataSchema.buildMeta( {
            qualitySeal: seal,
            specUrl: GeojsonSpecValidator.getSpecUrl(),
            converterVersion: CONVERTER_VERSION,
            sourceUrl,
            sourceHash,
            buildDate: new Date().toISOString(),
            rowCounts: { features: rows.length },
            capabilities,
            representativePointRules: GeometryReducer.getRepresentativePointRules(),
            validationReport: {
                errors: postReport.summary.errorCount,
                warnings: postReport.summary.warningCount,
                info: postReport.summary.infoCount
            }
        } )
        MetaWriter.writeMeta( { db, metaTable: meta } )

        SqliteBuilder.close( { db } )
        SqliteBuilder.atomicSwap( { dbPathNew, dbPathFinal: dbPath } )

        GeojsonDefaultMethods.clearCache()

        return {
            status: true,
            dbPath,
            report: postReport,
            capabilities,
            seal,
            aborted: false
        }
    }


    static #loadCollection( { input, inputType } ) {
        const { filename, buffer } = GeojsonConverter.#readSource( { input, inputType } )
        try {
            const collection = JSON.parse( buffer.toString( 'utf-8' ) )
            return { collection, filename, sourceBuffer: buffer }
        } catch {
            return { collection: null, filename, sourceBuffer: buffer }
        }
    }


    static #readSource( { input, inputType } ) {
        if( inputType === 'buffer' ) {
            return { filename: 'input.geojson', buffer: input }
        }
        if( inputType === 'geojson' || inputType === 'json' ) {
            return { filename: input, buffer: readFileSync( input ) }
        }
        if( inputType === 'folder' ) {
            const { files } = FolderReader.readFolder( { folderPath: input } )
            const names = [ ...files.keys() ]
            if( names.length === 0 ) {
                throw new Error( `No .geojson/.json files found in folder: ${input}` )
            }
            const firstName = names[ 0 ]
            return { filename: firstName, buffer: files.get( firstName ) }
        }
        throw new Error( `Unsupported inputType: ${inputType}` )
    }


    static #buildRows( { collection, validation } ) {
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
                    validation.error( 'GJSON-005', 'input.geojson', `features[${index}] geometry could not be reduced` )
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
        return rows
    }


    static #abort( { report } ) {
        return {
            status: false,
            dbPath: null,
            report,
            capabilities: null,
            seal: null,
            aborted: true
        }
    }
}
