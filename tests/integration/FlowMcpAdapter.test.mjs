import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GeojsonSqliteConverter } from '../../src/GeojsonSqliteConverter.mjs'
import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'
import { GeojsonDefaultMethods } from '../../src/converters/geojson/GeojsonDefaultMethods.mjs'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const FIXTURE_SOURCE = path.resolve( __dirname, '..', 'fixtures', 'synthetic-geojson', 'source', 'sample.geojson' )

let tmpDir = null
let dbPath = null


//
// Full path Fixture -> Converter -> Seal -> Adapter -> Engine.
// The DB is written to a temp dir, NEVER to ~/.flowmcp.
//

beforeAll( async () => {
    tmpDir = mkdtempSync( path.join( tmpdir(), 'geojson-int-' ) )
    dbPath = path.join( tmpDir, 'synthetic-geojson.db' )
    GeojsonDefaultMethods.clearCache()

    const result = await GeojsonSqliteConverter.start( {
        input: FIXTURE_SOURCE, inputType: 'geojson', dbPath, force: false, sourceUrl: 'https://example.org/sample.geojson'
    } )
    if( !result.status ) {
        throw new Error( `converter failed: ${JSON.stringify( result.report )}` )
    }
} )


afterAll( () => {
    GeojsonDefaultMethods.clearCache()
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'integration: fixture -> converter -> seal', () => {
    test( 'sealed with qualitySeal sqlite-geojson and mandatory meta', () => {
        const { sealed, meta } = FlowMcpAdapter.verifySeal( { dbPath } )
        expect( sealed ).toBe( true )
        expect( meta.qualitySeal ).toBe( 'sqlite-geojson' )
        expect( meta.specUrl ).toMatch( /rfc7946/ )
        expect( meta.sourceHash ).not.toBeNull()
        expect( meta.representativePointRules.Polygon ).toBe( 'centroid-outer-ring' )
    } )
} )


describe( 'integration: adapter tool surface', () => {
    test( 'three spatial methods exposed and namespace-prefixed', () => {
        const { methods } = FlowMcpAdapter.getAvailableMethods( { dbPath } )
        expect( methods.length ).toBe( 3 )

        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'mygeo' } )
        tools.forEach( ( tool ) => expect( tool.name.startsWith( 'mygeo.' ) ).toBe( true ) )
    } )
} )


describe( 'integration: engine queries against the sealed DB', () => {
    test( 'featuresInBBox enclosing returns >=1, disjoint returns 0', () => {
        const inside = GeojsonDefaultMethods.featuresInBBox( { dbPath, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2 } )
        const outside = GeojsonDefaultMethods.featuresInBBox( { dbPath, minLon: 100, minLat: 80, maxLon: 110, maxLat: 85 } )
        expect( inside.matchCount ).toBeGreaterThanOrEqual( 1 )
        expect( outside.matchCount ).toBe( 0 )
    } )


    test( 'nearPoint small radius returns exactly Alpha', () => {
        const { features } = GeojsonDefaultMethods.nearPoint( { dbPath, lat: 50.0, lon: 10.0, radiusMeters: 50 } )
        expect( features.length ).toBe( 1 )
        expect( features[ 0 ].properties.name ).toBe( 'Alpha Marker' )
    } )


    test( 'byType Point returns only point features', () => {
        const { features } = GeojsonDefaultMethods.byType( { dbPath, geomType: 'Point' } )
        expect( features.length ).toBe( 3 )
        features.forEach( ( f ) => expect( f.geom_type ).toBe( 'Point' ) )
    } )
} )


describe( 'integration: build-fixture script runs end-to-end', () => {
    test( 'build-fixture.mjs exits 0 and produces a sealed DB', () => {
        const fixtureDir = path.resolve( __dirname, '..', 'fixtures', 'synthetic-geojson' )
        execFileSync( 'node', [ 'build-fixture.mjs' ], { cwd: fixtureDir, stdio: 'inherit' } )
        const builtDb = path.join( fixtureDir, 'synthetic-geojson.db' )
        expect( existsSync( builtDb ) ).toBe( true )

        const copy = path.join( tmpDir, 'built-copy.db' )
        copyFileSync( builtDb, copy )
        const { sealed } = FlowMcpAdapter.verifySeal( { dbPath: copy } )
        expect( sealed ).toBe( true )
    } )
} )
