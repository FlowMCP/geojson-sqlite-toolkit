import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { GeojsonSqliteConverter } from '../../src/GeojsonSqliteConverter.mjs'
import { GeojsonDefaultMethods } from '../../src/converters/geojson/GeojsonDefaultMethods.mjs'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null
let dbPath = null


const collection = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [ 10.0, 50.0 ] }, properties: { name: 'Alpha', category: 'poi' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [ 10.01, 50.01 ] }, properties: { name: 'Beta', category: 'poi' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [ 20.0, 60.0 ] }, properties: { name: 'Far', category: 'remote' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [ [ 10.0, 50.0 ], [ 10.02, 50.02 ], [ 10.04, 50.04 ] ] }, properties: { category: 'route' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ [ [ 10.0, 50.0 ], [ 10.1, 50.0 ], [ 10.1, 50.1 ], [ 10.0, 50.1 ], [ 10.0, 50.0 ] ] ] }, properties: { category: 'zone' } }
    ]
}


beforeAll( async () => {
    tmpDir = mkdtempSync( join( tmpdir(), 'geojson-engine-' ) )
    dbPath = join( tmpDir, 'engine.db' )
    GeojsonDefaultMethods.clearCache()
    const result = await GeojsonSqliteConverter.start( {
        input: Buffer.from( JSON.stringify( collection ) ), inputType: 'buffer', dbPath
    } )
    if( !result.status ) { throw new Error( 'engine fixture build failed' ) }
} )


afterAll( () => {
    GeojsonDefaultMethods.clearCache()
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'GeojsonDefaultMethods.featuresInBBox', () => {
    test( 'enclosing bbox returns the near cluster (>= 1)', () => {
        const { features, matchCount } = GeojsonDefaultMethods.featuresInBBox( {
            dbPath, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2
        } )
        expect( matchCount ).toBeGreaterThanOrEqual( 1 )
        const geomTypes = new Set( features.map( ( f ) => f.geom_type ) )
        expect( geomTypes.has( 'Point' ) ).toBe( true )
    } )


    test( 'disjoint bbox returns 0', () => {
        const { matchCount } = GeojsonDefaultMethods.featuresInBBox( {
            dbPath, minLon: 100, minLat: 80, maxLon: 110, maxLat: 85
        } )
        expect( matchCount ).toBe( 0 )
    } )
} )


describe( 'GeojsonDefaultMethods.nearPoint', () => {
    test( 'tiny radius around Alpha returns only Alpha, distance in meters', () => {
        const { features } = GeojsonDefaultMethods.nearPoint( {
            dbPath, lat: 50.0, lon: 10.0, radiusMeters: 50
        } )
        expect( features.length ).toBe( 1 )
        expect( features[ 0 ].properties.name ).toBe( 'Alpha' )
        expect( features[ 0 ].distanceM ).toBeLessThan( 50 )
    } )


    test( 'larger radius returns the cluster sorted ascending by distance', () => {
        const { features } = GeojsonDefaultMethods.nearPoint( {
            dbPath, lat: 50.0, lon: 10.0, radiusMeters: 5000
        } )
        expect( features.length ).toBeGreaterThanOrEqual( 2 )
        const distances = features.map( ( f ) => f.distanceM )
        const sorted = [ ...distances ].sort( ( a, b ) => a - b )
        expect( distances ).toEqual( sorted )
    } )


    test( 'far point returns nothing within a small radius', () => {
        const { matchCount } = GeojsonDefaultMethods.nearPoint( {
            dbPath, lat: 0, lon: 0, radiusMeters: 100
        } )
        expect( matchCount ).toBe( 0 )
    } )
} )


describe( 'GeojsonDefaultMethods.byType', () => {
    test( 'geomType Point returns only point features', () => {
        const { features } = GeojsonDefaultMethods.byType( { dbPath, geomType: 'Point' } )
        expect( features.length ).toBe( 3 )
        features.forEach( ( f ) => expect( f.geom_type ).toBe( 'Point' ) )
    } )


    test( 'property filter matches category', () => {
        const { features } = GeojsonDefaultMethods.byType( {
            dbPath, propertyKey: 'category', propertyValue: 'poi'
        } )
        expect( features.length ).toBe( 2 )
    } )


    test( 'no filter returns all features', () => {
        const { matchCount } = GeojsonDefaultMethods.byType( { dbPath } )
        expect( matchCount ).toBe( 5 )
    } )
} )


describe( 'GeojsonDefaultMethods catalog', () => {
    test( 'getMethodsForCapabilities gates by capability', () => {
        const all = GeojsonDefaultMethods.getMethodsForCapabilities( { capabilities: { spatialQuery: true, typeFilter: true } } )
        expect( all.map( ( m ) => m.name ).sort() ).toEqual( [ 'byType', 'featuresInBBox', 'nearPoint' ] )

        const none = GeojsonDefaultMethods.getMethodsForCapabilities( { capabilities: {} } )
        expect( none.length ).toBe( 0 )
    } )


    test( 'getMethodByName throws for unknown', () => {
        expect( () => GeojsonDefaultMethods.getMethodByName( { name: 'nope' } ) ).toThrow( /Unknown method/ )
    } )
} )
