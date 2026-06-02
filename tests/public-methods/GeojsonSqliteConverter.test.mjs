import { describe, test, expect, afterEach } from '@jest/globals'
import { GeojsonSqliteConverter } from '../../src/GeojsonSqliteConverter.mjs'
import { GeojsonMetadataSchema } from '../../src/converters/geojson/GeojsonMetadataSchema.mjs'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


const setupTmpDir = () => {
    tmpDir = mkdtempSync( join( tmpdir(), 'geojson-pipeline-' ) )
    return tmpDir
}


const validCollection = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [ 10, 50 ] }, properties: { name: 'a' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 2, 2 ], [ 4, 4 ] ] }, properties: {} }
    ]
}


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'GeojsonSqliteConverter.start (Pipeline)', () => {
    test( 'valid buffer produces sealed DB with mandatory meta keys', async () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GeojsonSqliteConverter.start( {
            input: Buffer.from( JSON.stringify( validCollection ) ),
            inputType: 'buffer',
            dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.aborted ).toBe( false )
        expect( result.seal ).toBe( 'sqlite-geojson' )
        expect( existsSync( dbPath ) ).toBe( true )

        const meta = GeojsonMetadataSchema.parseMeta( { dbPath } )
        expect( meta.qualitySeal ).toBe( 'sqlite-geojson' )
        expect( meta.specUrl ).toMatch( /rfc7946/ )
        expect( meta.representativePointRules.Point ).toBe( 'point-itself' )
        GeojsonMetadataSchema.getPflichtKeys()
            .forEach( ( key ) => {
                expect( meta[ key ] !== undefined ).toBe( true )
            } )
    } )


    test( 'invalid JSON aborts without DB (GJSON-001)', async () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GeojsonSqliteConverter.start( {
            input: Buffer.from( 'not json {{{' ),
            inputType: 'buffer',
            dbPath
        } )
        expect( result.status ).toBe( false )
        expect( result.aborted ).toBe( true )
        expect( existsSync( dbPath ) ).toBe( false )
        expect( result.report.errors.map( ( e ) => e.code ) ).toContain( 'GJSON-001' )
    } )


    test( 'empty feature collection aborts (GJSON-007)', async () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GeojsonSqliteConverter.start( {
            input: Buffer.from( JSON.stringify( { type: 'FeatureCollection', features: [] } ) ),
            inputType: 'buffer',
            dbPath
        } )
        expect( result.aborted ).toBe( true )
        expect( result.report.errors.map( ( e ) => e.code ) ).toContain( 'GJSON-007' )
    } )


    test( 'unsupported geometry aborts without force, builds unsealed with force', async () => {
        setupTmpDir()
        const bad = {
            type: 'FeatureCollection',
            features: [ { type: 'Feature', geometry: { type: 'Circle', coordinates: [ 0, 0 ] }, properties: {} } ]
        }

        const dbPathA = join( tmpDir, 'a.db' )
        const aborted = await GeojsonSqliteConverter.start( {
            input: Buffer.from( JSON.stringify( bad ) ), inputType: 'buffer', dbPath: dbPathA
        } )
        expect( aborted.status ).toBe( false )
        expect( existsSync( dbPathA ) ).toBe( false )

        const dbPathB = join( tmpDir, 'b.db' )
        const forced = await GeojsonSqliteConverter.start( {
            input: Buffer.from( JSON.stringify( bad ) ), inputType: 'buffer', dbPath: dbPathB, force: true
        } )
        expect( forced.status ).toBe( true )
        expect( forced.seal ).toBeNull()
        expect( existsSync( dbPathB ) ).toBe( true )
    } )


    test( 'features table holds one row per valid feature', async () => {
        setupTmpDir()
        const dbPath = join( tmpDir, 'out.db' )
        await GeojsonSqliteConverter.start( {
            input: Buffer.from( JSON.stringify( validCollection ) ), inputType: 'buffer', dbPath
        } )
        const { db } = SqliteBuilder.openDatabase( { dbPath } )
        const count = db.prepare( 'SELECT COUNT(*) AS n FROM features' ).get()
        SqliteBuilder.close( { db } )
        expect( count.n ).toBe( 2 )
    } )


    test( 'reads from a .geojson file path and auto-detects type', async () => {
        setupTmpDir()
        const filePath = join( tmpDir, 'sample.geojson' )
        writeFileSync( filePath, JSON.stringify( validCollection ) )
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GeojsonSqliteConverter.start( {
            input: filePath, inputType: 'auto', dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.seal ).toBe( 'sqlite-geojson' )
    } )


    test( 'reads from a folder', async () => {
        setupTmpDir()
        const folder = join( tmpDir, 'feed' )
        const { mkdirSync } = await import( 'node:fs' )
        mkdirSync( folder )
        writeFileSync( join( folder, 'features.geojson' ), JSON.stringify( validCollection ) )
        const dbPath = join( tmpDir, 'out.db' )
        const result = await GeojsonSqliteConverter.start( {
            input: folder, inputType: 'folder', dbPath
        } )
        expect( result.status ).toBe( true )
        expect( result.capabilities.pointFeatures ).toBe( true )
        expect( result.capabilities.lineFeatures ).toBe( true )
    } )
} )
