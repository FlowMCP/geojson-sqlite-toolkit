import { describe, test, expect, beforeAll, afterEach, afterAll } from '@jest/globals'
import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'
import { GeojsonUrlStore } from '../../src/converters/geojson/GeojsonUrlStore.mjs'


const URL = 'https://example.org/sealed.geojson'

const collection = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [ 10, 50 ] }, properties: { name: 'a' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ [ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ], [ 0, 0 ] ] ] }, properties: {} }
    ]
}


let originalFetch = null


function mockFetch( { ok = true, status = 200, body } ) {
    global.fetch = async () => ( {
        ok,
        status,
        text: async () => ( typeof body === 'string' ? body : JSON.stringify( body ) )
    } )
}


beforeAll( async () => {
    originalFetch = global.fetch
    mockFetch( { body: collection } )
    GeojsonUrlStore.clear()
    await FlowMcpAdapter.loadFromUrl( { url: URL } )
} )


afterEach( () => {
    mockFetch( { body: collection } )
} )


afterAll( () => {
    GeojsonUrlStore.clear()
    global.fetch = originalFetch
} )


describe( 'FlowMcpAdapter.loadFromUrl', () => {
    test( 'loads a complete GeoJSON in one request and reports capabilities', async () => {
        GeojsonUrlStore.clear()
        const result = await FlowMcpAdapter.loadFromUrl( { url: URL } )
        expect( result.loaded ).toBe( true )
        expect( result.recordCount ).toBe( 2 )
        expect( result.capabilities.spatialQuery ).toBe( true )
    } )


    test( 'rejects non-HTTPS url (no silent skip)', async () => {
        await expect( FlowMcpAdapter.loadFromUrl( { url: 'http://example.org/x.geojson' } ) )
            .rejects.toThrow( /HTTPS|GJSON-URL-001/ )
    } )


    test( 'invalid GeoJSON is rejected on load (F6, replaces verifySeal)', async () => {
        mockFetch( { body: '{ not json' } )
        GeojsonUrlStore.clear()
        await expect( FlowMcpAdapter.loadFromUrl( { url: 'https://example.org/bad.geojson' } ) )
            .rejects.toThrow( /GJSON-URL-003/ )
    } )


    test( 'fetch failure (HTTP error) is surfaced, not silently skipped', async () => {
        mockFetch( { ok: false, status: 503, body: '' } )
        GeojsonUrlStore.clear()
        await expect( FlowMcpAdapter.loadFromUrl( { url: 'https://example.org/down.geojson' } ) )
            .rejects.toThrow( /GJSON-URL-002/ )
    } )
} )


describe( 'FlowMcpAdapter.getAvailableMethods', () => {
    test( 'returns the three spatial methods for a loaded url', async () => {
        mockFetch( { body: collection } )
        GeojsonUrlStore.clear()
        await FlowMcpAdapter.loadFromUrl( { url: URL } )
        const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { url: URL } )
        const names = methods.map( ( m ) => m.name ).sort()
        expect( names ).toEqual( [ 'byType', 'inBoundingBox', 'nearPoint' ] )
        expect( capabilities.spatialQuery ).toBe( true )
    } )
} )


describe( 'FlowMcpAdapter.buildToolDefinitions', () => {
    test( 'tools are namespace-prefixed with valid inputSchema', async () => {
        mockFetch( { body: collection } )
        GeojsonUrlStore.clear()
        await FlowMcpAdapter.loadFromUrl( { url: URL } )
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { url: URL, namespace: 'mygeo' } )
        expect( tools.length ).toBe( 3 )
        const names = tools.map( ( t ) => t.name )
        expect( names ).toContain( 'mygeo.inBoundingBox' )
        expect( names ).toContain( 'mygeo.nearPoint' )
        expect( names ).toContain( 'mygeo.byType' )
        tools.forEach( ( tool ) => {
            expect( tool.inputSchema.type ).toBe( 'object' )
            expect( typeof tool.inputSchema.properties ).toBe( 'object' )
            expect( Array.isArray( tool.inputSchema.required ) ).toBe( true )
            expect( typeof tool.method ).toBe( 'string' )
        } )
    } )


    test( 'invalid namespace rejected', () => {
        expect( () => FlowMcpAdapter.buildToolDefinitions( { url: URL, namespace: 'Bad Name' } ) ).toThrow()
    } )
} )
