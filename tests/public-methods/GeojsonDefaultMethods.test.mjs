import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { GeojsonDefaultMethods } from '../../src/converters/geojson/GeojsonDefaultMethods.mjs'
import { GeojsonUrlStore } from '../../src/converters/geojson/GeojsonUrlStore.mjs'


const URL = 'https://example.org/engine.geojson'

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


let originalFetch = null


beforeAll( async () => {
    originalFetch = global.fetch
    global.fetch = async () => ( {
        ok: true,
        status: 200,
        text: async () => JSON.stringify( collection )
    } )
    GeojsonDefaultMethods.clearCache()
    await GeojsonUrlStore.loadFromUrl( { url: URL } )
} )


afterAll( () => {
    GeojsonDefaultMethods.clearCache()
    global.fetch = originalFetch
} )


describe( 'GeojsonDefaultMethods.inBoundingBox', () => {
    test( 'enclosing bbox returns a FeatureCollection with the near cluster (>= 1)', () => {
        const fc = GeojsonDefaultMethods.inBoundingBox( {
            url: URL, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.meta.source ).toBe( 'geojson' )
        expect( fc.meta.count ).toBe( fc.features.length )
        expect( fc.features.length ).toBeGreaterThanOrEqual( 1 )
        const geomTypes = new Set( fc.features.map( ( f ) => f.properties.geom_type ) )
        expect( geomTypes.has( 'Point' ) ).toBe( true )
        fc.features.forEach( ( f ) => {
            expect( f.type ).toBe( 'Feature' )
            expect( f.geometry.type ).toBe( 'Point' )
            expect( Array.isArray( f.geometry.coordinates ) ).toBe( true )
            expect( f.properties._source ).toBe( 'geojson' )
            expect( f.properties._distanceMeters ).toBe( null )
        } )
    } )


    test( 'coordinates are lon-first [ lon, lat ]', () => {
        const fc = GeojsonDefaultMethods.inBoundingBox( {
            url: URL, minLon: 19.9, minLat: 59.9, maxLon: 20.1, maxLat: 60.1
        } )
        const far = fc.features.find( ( f ) => f.properties.name === 'Far' )
        expect( far ).toBeDefined()
        expect( far.geometry.coordinates[ 0 ] ).toBe( 20.0 )
        expect( far.geometry.coordinates[ 1 ] ).toBe( 60.0 )
    } )


    test( 'disjoint bbox returns an empty FeatureCollection', () => {
        const fc = GeojsonDefaultMethods.inBoundingBox( {
            url: URL, minLon: 100, minLat: 80, maxLon: 110, maxLat: 85
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.features.length ).toBe( 0 )
        expect( fc.meta.count ).toBe( 0 )
    } )
} )


describe( 'GeojsonDefaultMethods.nearPoint', () => {
    test( 'tiny radius around Alpha returns only Alpha, distance in meters', () => {
        const fc = GeojsonDefaultMethods.nearPoint( {
            url: URL, lat: 50.0, lon: 10.0, radiusMeters: 50
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.features.length ).toBe( 1 )
        expect( fc.features[ 0 ].properties.name ).toBe( 'Alpha' )
        expect( fc.features[ 0 ].properties._distanceMeters ).toBeLessThan( 50 )
        expect( typeof fc.features[ 0 ].properties._distanceMeters ).toBe( 'number' )
    } )


    test( 'larger radius returns the cluster sorted ascending by distance', () => {
        const fc = GeojsonDefaultMethods.nearPoint( {
            url: URL, lat: 50.0, lon: 10.0, radiusMeters: 5000
        } )
        expect( fc.features.length ).toBeGreaterThanOrEqual( 2 )
        const distances = fc.features.map( ( f ) => f.properties._distanceMeters )
        const sorted = [ ...distances ].sort( ( a, b ) => a - b )
        expect( distances ).toEqual( sorted )
    } )


    test( 'far point returns an empty FeatureCollection within a small radius', () => {
        const fc = GeojsonDefaultMethods.nearPoint( {
            url: URL, lat: 0, lon: 0, radiusMeters: 100
        } )
        expect( fc.features.length ).toBe( 0 )
        expect( fc.meta.count ).toBe( 0 )
    } )
} )


describe( 'GeojsonDefaultMethods.byType', () => {
    test( 'geomType Point returns only point features', () => {
        const fc = GeojsonDefaultMethods.byType( { url: URL, geomType: 'Point' } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.features.length ).toBe( 3 )
        fc.features.forEach( ( f ) => {
            expect( f.properties.geom_type ).toBe( 'Point' )
            expect( f.properties._distanceMeters ).toBe( null )
        } )
    } )


    test( 'property filter matches category', () => {
        const fc = GeojsonDefaultMethods.byType( {
            url: URL, propertyKey: 'category', propertyValue: 'poi'
        } )
        expect( fc.features.length ).toBe( 2 )
    } )


    test( 'no filter returns all features', () => {
        const fc = GeojsonDefaultMethods.byType( { url: URL } )
        expect( fc.meta.count ).toBe( 5 )
        expect( fc.features.length ).toBe( 5 )
    } )
} )


describe( 'GeojsonDefaultMethods catalog', () => {
    test( 'getMethodsForCapabilities gates by capability', () => {
        const all = GeojsonDefaultMethods.getMethodsForCapabilities( { capabilities: { spatialQuery: true, typeFilter: true } } )
        expect( all.map( ( m ) => m.name ).sort() ).toEqual( [ 'byType', 'inBoundingBox', 'nearPoint' ] )

        const none = GeojsonDefaultMethods.getMethodsForCapabilities( { capabilities: {} } )
        expect( none.length ).toBe( 0 )
    } )


    test( 'getMethodByName throws for unknown', () => {
        expect( () => GeojsonDefaultMethods.getMethodByName( { name: 'nope' } ) ).toThrow( /Unknown method/ )
    } )
} )


describe( 'GeojsonDefaultMethods requires a loaded url', () => {
    test( 'querying an unloaded url throws GJSON-URL-004', () => {
        expect( () => GeojsonDefaultMethods.byType( { url: 'https://example.org/never-loaded.geojson' } ) )
            .toThrow( /GJSON-URL-004/ )
    } )
} )
