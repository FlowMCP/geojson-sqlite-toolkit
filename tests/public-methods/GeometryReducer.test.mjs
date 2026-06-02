import { describe, test, expect } from '@jest/globals'
import { GeometryReducer } from '../../src/converters/geojson/GeometryReducer.mjs'


describe( 'GeometryReducer.reduce', () => {
    test( 'Point returns the point itself', () => {
        const out = GeometryReducer.reduce( { geometry: { type: 'Point', coordinates: [ 10, 50 ] } } )
        expect( out.lon ).toBe( 10 )
        expect( out.lat ).toBe( 50 )
        expect( out.rule ).toBe( 'point-itself' )
        expect( out.bbox ).toEqual( { minLon: 10, minLat: 50, maxLon: 10, maxLat: 50 } )
    } )


    test( 'MultiPoint returns the mean of points', () => {
        const out = GeometryReducer.reduce( { geometry: { type: 'MultiPoint', coordinates: [ [ 0, 0 ], [ 10, 20 ] ] } } )
        expect( out.lon ).toBe( 5 )
        expect( out.lat ).toBe( 10 )
        expect( out.rule ).toBe( 'mean-of-points' )
    } )


    test( 'LineString returns the middle vertex', () => {
        const out = GeometryReducer.reduce( { geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 5, 5 ], [ 10, 10 ] ] } } )
        expect( out.lon ).toBe( 5 )
        expect( out.lat ).toBe( 5 )
        expect( out.rule ).toBe( 'middle-vertex' )
        expect( out.bbox ).toEqual( { minLon: 0, minLat: 0, maxLon: 10, maxLat: 10 } )
    } )


    test( 'MultiLineString uses middle vertex of the longest line', () => {
        const geometry = {
            type: 'MultiLineString',
            coordinates: [
                [ [ 0, 0 ], [ 1, 1 ] ],
                [ [ 0, 0 ], [ 5, 5 ], [ 10, 10 ] ]
            ]
        }
        const out = GeometryReducer.reduce( { geometry } )
        expect( out.lon ).toBe( 5 )
        expect( out.lat ).toBe( 5 )
        expect( out.rule ).toBe( 'middle-vertex-of-longest-line' )
    } )


    test( 'Polygon returns centroid of the outer ring excluding closing vertex', () => {
        const geometry = {
            type: 'Polygon',
            coordinates: [ [ [ 0, 0 ], [ 10, 0 ], [ 10, 10 ], [ 0, 10 ], [ 0, 0 ] ] ]
        }
        const out = GeometryReducer.reduce( { geometry } )
        expect( out.lon ).toBe( 5 )
        expect( out.lat ).toBe( 5 )
        expect( out.rule ).toBe( 'centroid-outer-ring' )
    } )


    test( 'MultiPolygon uses centroid of outer ring of first part', () => {
        const geometry = {
            type: 'MultiPolygon',
            coordinates: [
                [ [ [ 0, 0 ], [ 10, 0 ], [ 10, 10 ], [ 0, 10 ], [ 0, 0 ] ] ],
                [ [ [ 100, 100 ], [ 110, 100 ], [ 110, 110 ], [ 100, 100 ] ] ]
            ]
        }
        const out = GeometryReducer.reduce( { geometry } )
        expect( out.lon ).toBe( 5 )
        expect( out.lat ).toBe( 5 )
        expect( out.rule ).toBe( 'centroid-outer-ring-first-part' )
        expect( out.bbox ).toEqual( { minLon: 0, minLat: 0, maxLon: 110, maxLat: 110 } )
    } )


    test( 'unsupported geometry type throws', () => {
        expect( () => GeometryReducer.reduce( { geometry: { type: 'Circle', coordinates: [ 0, 0 ] } } ) )
            .toThrow( /unsupported geometry type/ )
    } )


    test( 'getRepresentativePointRules exposes the full explicit mapping', () => {
        const rules = GeometryReducer.getRepresentativePointRules()
        expect( rules.Point ).toBe( 'point-itself' )
        expect( rules.Polygon ).toBe( 'centroid-outer-ring' )
        expect( Object.keys( rules ).length ).toBe( 6 )
    } )
} )
