import { describe, test, expect } from '@jest/globals'
import { GeojsonSpecValidator } from '../../src/converters/geojson/GeojsonSpecValidator.mjs'


const validFeature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [ 10, 50 ] },
    properties: { name: 'x' }
}


describe( 'GeojsonSpecValidator.validate', () => {
    test( 'valid FeatureCollection reports no errors', () => {
        const v = GeojsonSpecValidator.validate( {
            collection: { type: 'FeatureCollection', features: [ validFeature ] }
        } )
        expect( v.report().summary.errorCount ).toBe( 0 )
    } )


    test( 'wrong top-level type emits GJSON-002', () => {
        const v = GeojsonSpecValidator.validate( { collection: { type: 'Feature', features: [] } } )
        const codes = v.report().errors.map( ( e ) => e.code )
        expect( codes ).toContain( 'GJSON-002' )
    } )


    test( 'missing features array emits GJSON-003', () => {
        const v = GeojsonSpecValidator.validate( { collection: { type: 'FeatureCollection' } } )
        const codes = v.report().errors.map( ( e ) => e.code )
        expect( codes ).toContain( 'GJSON-003' )
    } )


    test( 'empty features array emits GJSON-007', () => {
        const v = GeojsonSpecValidator.validate( { collection: { type: 'FeatureCollection', features: [] } } )
        const codes = v.report().errors.map( ( e ) => e.code )
        expect( codes ).toContain( 'GJSON-007' )
    } )


    test( 'malformed geometry emits GJSON-004', () => {
        const v = GeojsonSpecValidator.validate( {
            collection: { type: 'FeatureCollection', features: [ { type: 'Feature', geometry: null } ] }
        } )
        const codes = v.report().errors.map( ( e ) => e.code )
        expect( codes ).toContain( 'GJSON-004' )
    } )


    test( 'unsupported geometry type emits GJSON-005', () => {
        const v = GeojsonSpecValidator.validate( {
            collection: { type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Circle', coordinates: [ 0, 0 ] } } ] }
        } )
        const codes = v.report().errors.map( ( e ) => e.code )
        expect( codes ).toContain( 'GJSON-005' )
    } )


    test( 'GeometryCollection emits warning GJSON-104, not an error', () => {
        const v = GeojsonSpecValidator.validate( {
            collection: { type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'GeometryCollection', geometries: [] } } ] }
        } )
        const report = v.report()
        expect( report.warnings.map( ( w ) => w.code ) ).toContain( 'GJSON-104' )
        expect( report.summary.errorCount ).toBe( 0 )
    } )


    test( 'getSupportedGeometryTypes / getSpecUrl expose constants', () => {
        expect( GeojsonSpecValidator.getSupportedGeometryTypes() ).toContain( 'Polygon' )
        expect( GeojsonSpecValidator.getSpecUrl() ).toMatch( /rfc7946/ )
    } )
} )
