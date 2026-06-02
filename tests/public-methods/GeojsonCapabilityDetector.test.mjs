import { describe, test, expect } from '@jest/globals'
import { GeojsonCapabilityDetector } from '../../src/converters/geojson/GeojsonCapabilityDetector.mjs'


describe( 'GeojsonCapabilityDetector.detect', () => {
    test( 'detects point, line, area and property capabilities', () => {
        const rows = [
            { geom_type: 'Point', properties: JSON.stringify( { name: 'a' } ) },
            { geom_type: 'LineString', properties: '{}' },
            { geom_type: 'Polygon', properties: JSON.stringify( { kind: 'zone' } ) }
        ]
        const caps = GeojsonCapabilityDetector.detect( { rows } )
        expect( caps.spatialQuery ).toBe( true )
        expect( caps.pointFeatures ).toBe( true )
        expect( caps.lineFeatures ).toBe( true )
        expect( caps.areaFeatures ).toBe( true )
        expect( caps.typeFilter ).toBe( true )
        expect( caps.propertyFilter ).toBe( true )
    } )


    test( 'empty rows yield all-false capabilities', () => {
        const caps = GeojsonCapabilityDetector.detect( { rows: [] } )
        expect( caps.spatialQuery ).toBe( false )
        expect( caps.pointFeatures ).toBe( false )
        expect( caps.typeFilter ).toBe( false )
        expect( caps.propertyFilter ).toBe( false )
    } )


    test( 'propertyFilter false when all properties empty', () => {
        const rows = [ { geom_type: 'Point', properties: '{}' } ]
        const caps = GeojsonCapabilityDetector.detect( { rows } )
        expect( caps.pointFeatures ).toBe( true )
        expect( caps.propertyFilter ).toBe( false )
    } )
} )
