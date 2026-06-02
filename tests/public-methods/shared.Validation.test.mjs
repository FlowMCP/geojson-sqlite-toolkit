import { describe, test, expect } from '@jest/globals'
import { Validation } from '../../src/shared/Validation.mjs'


describe( 'Validation (GJSON codes)', () => {
    test( 'getCodes exposes the registry', () => {
        const codes = Validation.getCodes()
        expect( codes[ 'GJSON-001' ].severity ).toBe( 'ERROR' )
        expect( codes[ 'GJSON-104' ].severity ).toBe( 'WARNING' )
        expect( codes[ 'GJSON-201' ].severity ).toBe( 'INFO' )
    } )


    test( 'getCodeMeta throws on unknown code', () => {
        expect( () => Validation.getCodeMeta( { code: 'GJSON-999' } ) ).toThrow( /Unknown GJSON code/ )
    } )


    test( 'error/warning/info push into the right bucket', () => {
        const v = Validation.create()
        v.error( 'GJSON-002', 'f', 'bad type' )
        v.warning( 'GJSON-101', 'f', 'not a Feature' )
        v.info( 'GJSON-201', 'f', 'points present' )
        const report = v.report()
        expect( report.status ).toBe( false )
        expect( report.summary.errorCount ).toBe( 1 )
        expect( report.summary.warningCount ).toBe( 1 )
        expect( report.summary.infoCount ).toBe( 1 )
    } )


    test( 'severity mismatch throws', () => {
        const v = Validation.create()
        expect( () => v.error( 'GJSON-101', 'f', 'x' ) ).toThrow( /not an ERROR/ )
        expect( () => v.warning( 'GJSON-001', 'f', 'x' ) ).toThrow( /not a WARNING/ )
        expect( () => v.info( 'GJSON-001', 'f', 'x' ) ).toThrow( /not an INFO/ )
    } )


    test( 'addValidator runs additional validators', () => {
        const v = Validation.create()
        let ran = false
        v.addValidator( ( { validation } ) => { ran = true; validation.info( 'GJSON-201', 'f', 'ok' ) } )
        v.runAdditionalValidators( { parsedInput: {} } )
        expect( ran ).toBe( true )
        expect( v.report().summary.infoCount ).toBe( 1 )
    } )


    test( 'addValidator rejects non-function', () => {
        const v = Validation.create()
        expect( () => v.addValidator( 'nope' ) ).toThrow( /must be a function/ )
    } )
} )
