import { describe, test, expect } from '@jest/globals'
import { GeojsonMetadataSchema } from '../../src/converters/geojson/GeojsonMetadataSchema.mjs'


describe( 'GeojsonMetadataSchema.computeSeal', () => {
    const cleanReport = { summary: { errorCount: 0, warningCount: 0, infoCount: 0 } }

    test( 'clean report yields sqlite-geojson seal', () => {
        expect( GeojsonMetadataSchema.computeSeal( { validationReport: cleanReport } ) ).toBe( 'sqlite-geojson' )
    } )


    test( 'errors yield null seal', () => {
        const report = { summary: { errorCount: 1, warningCount: 0, infoCount: 0 } }
        expect( GeojsonMetadataSchema.computeSeal( { validationReport: report } ) ).toBeNull()
    } )


    test( 'warnings yield null seal', () => {
        const report = { summary: { errorCount: 0, warningCount: 1, infoCount: 0 } }
        expect( GeojsonMetadataSchema.computeSeal( { validationReport: report } ) ).toBeNull()
    } )


    test( 'forceUsed yields null seal', () => {
        expect( GeojsonMetadataSchema.computeSeal( { validationReport: cleanReport, forceUsed: true } ) ).toBeNull()
    } )
} )


describe( 'GeojsonMetadataSchema build/parse', () => {
    test( 'buildMeta returns all mandatory keys', () => {
        const meta = GeojsonMetadataSchema.buildMeta( {
            qualitySeal: 'sqlite-geojson',
            specUrl: 'https://datatracker.ietf.org/doc/html/rfc7946',
            converterVersion: 'geojson-sqlite-toolkit@0.1.0',
            sourceUrl: null,
            sourceHash: null,
            buildDate: '2026-06-02T00:00:00.000Z',
            rowCounts: { features: 5 },
            capabilities: { spatialQuery: true },
            representativePointRules: { Point: 'point-itself' },
            validationReport: { errors: 0, warnings: 0, info: 0 }
        } )
        GeojsonMetadataSchema.getPflichtKeys()
            .forEach( ( key ) => {
                expect( Object.prototype.hasOwnProperty.call( meta, key ) ).toBe( true )
            } )
    } )


    test( 'parseCapabilities parses JSON string', () => {
        const caps = GeojsonMetadataSchema.parseCapabilities( { metaTable: { capabilities: '{"spatialQuery":true}' } } )
        expect( caps.spatialQuery ).toBe( true )
    } )


    test( 'parseCapabilities passes through object', () => {
        const caps = GeojsonMetadataSchema.parseCapabilities( { metaTable: { capabilities: { spatialQuery: false } } } )
        expect( caps.spatialQuery ).toBe( false )
    } )


    test( 'parseRowCounts and parseReport handle null', () => {
        expect( GeojsonMetadataSchema.parseRowCounts( { metaTable: {} } ) ).toBeNull()
        expect( GeojsonMetadataSchema.parseReport( { metaTable: {} } ) ).toBeNull()
    } )
} )
