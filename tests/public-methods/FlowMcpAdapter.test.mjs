import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { GeojsonSqliteConverter } from '../../src/GeojsonSqliteConverter.mjs'
import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null
let sealedDbPath = null


const collection = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [ 10, 50 ] }, properties: { name: 'a' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ], [ 0, 0 ] ] ] }, properties: {} }
    ]
}


beforeAll( async () => {
    tmpDir = mkdtempSync( join( tmpdir(), 'geojson-adapter-' ) )
    sealedDbPath = join( tmpDir, 'sealed.db' )
    const result = await GeojsonSqliteConverter.start( {
        input: Buffer.from( JSON.stringify( collection ) ), inputType: 'buffer', dbPath: sealedDbPath
    } )
    if( !result.status ) { throw new Error( 'adapter fixture build failed' ) }
} )


afterAll( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


function createNoSealDb( { fileName } ) {
    const dbPath = join( tmpDir, fileName )
    const db = new Database( dbPath )
    db.exec( 'CREATE TABLE meta( key TEXT PRIMARY KEY, value TEXT )' )
    db.prepare( 'INSERT INTO meta( key, value ) VALUES( ?, ? )' ).run( 'buildDate', '2026-06-02T00:00:00Z' )
    db.close()
    return dbPath
}


function createNoMetaDb( { fileName } ) {
    const dbPath = join( tmpDir, fileName )
    const db = new Database( dbPath )
    db.exec( 'CREATE TABLE features( feature_id INTEGER )' )
    db.close()
    return dbPath
}


describe( 'FlowMcpAdapter.verifySeal', () => {
    test( 'sealed DB returns sealed=true with qualitySeal sqlite-geojson', () => {
        const result = FlowMcpAdapter.verifySeal( { dbPath: sealedDbPath } )
        expect( result.sealed ).toBe( true )
        expect( result.meta.qualitySeal ).toBe( 'sqlite-geojson' )
        expect( result.reason ).toBeUndefined()
    } )


    test( 'DB with meta but wrong/no seal returns NO_SEAL', () => {
        const result = FlowMcpAdapter.verifySeal( { dbPath: createNoSealDb( { fileName: 'no-seal.db' } ) } )
        expect( result.sealed ).toBe( false )
        expect( result.reason ).toBe( 'NO_SEAL' )
    } )


    test( 'DB without meta table returns NO_META', () => {
        const result = FlowMcpAdapter.verifySeal( { dbPath: createNoMetaDb( { fileName: 'no-meta.db' } ) } )
        expect( result.sealed ).toBe( false )
        expect( result.reason ).toBe( 'NO_META' )
    } )


    test( 'missing file returns DB_UNREADABLE', () => {
        const result = FlowMcpAdapter.verifySeal( { dbPath: join( tmpDir, 'nope', 'missing.db' ) } )
        expect( result.sealed ).toBe( false )
        expect( result.reason ).toBe( 'DB_UNREADABLE' )
    } )


    test( 'invalid dbPath throws', () => {
        expect( () => FlowMcpAdapter.verifySeal( { dbPath: '' } ) ).toThrow()
        expect( () => FlowMcpAdapter.verifySeal( { dbPath: 123 } ) ).toThrow()
    } )
} )


describe( 'FlowMcpAdapter.getAvailableMethods', () => {
    test( 'returns the three spatial methods for sealed DB', () => {
        const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath: sealedDbPath } )
        const names = methods.map( ( m ) => m.name ).sort()
        expect( names ).toEqual( [ 'byType', 'featuresInBBox', 'nearPoint' ] )
        expect( capabilities.spatialQuery ).toBe( true )
    } )
} )


describe( 'FlowMcpAdapter.buildToolDefinitions', () => {
    test( 'tools are namespace-prefixed with valid inputSchema', () => {
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath: sealedDbPath, namespace: 'mygeo' } )
        expect( tools.length ).toBe( 3 )
        const names = tools.map( ( t ) => t.name )
        expect( names ).toContain( 'mygeo.featuresInBBox' )
        expect( names ).toContain( 'mygeo.nearPoint' )
        expect( names ).toContain( 'mygeo.byType' )
        tools.forEach( ( tool ) => {
            expect( tool.inputSchema.type ).toBe( 'object' )
            expect( typeof tool.inputSchema.properties ).toBe( 'object' )
            expect( Array.isArray( tool.inputSchema.required ) ).toBe( true )
        } )
    } )


    test( 'invalid namespace rejected', () => {
        expect( () => FlowMcpAdapter.buildToolDefinitions( { dbPath: sealedDbPath, namespace: 'Bad Name' } ) ).toThrow()
    } )
} )
