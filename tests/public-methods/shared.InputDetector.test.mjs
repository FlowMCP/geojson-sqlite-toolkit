import { describe, test, expect, afterEach } from '@jest/globals'
import { InputDetector } from '../../src/shared/InputDetector.mjs'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'InputDetector.detect', () => {
    test( 'buffer input', () => {
        expect( InputDetector.detect( { input: Buffer.from( '{}' ) } ).inputType ).toBe( 'buffer' )
    } )


    test( '.geojson path', () => {
        expect( InputDetector.detect( { input: '/x/y.geojson' } ).inputType ).toBe( 'geojson' )
    } )


    test( '.json path', () => {
        expect( InputDetector.detect( { input: '/x/y.JSON' } ).inputType ).toBe( 'json' )
    } )


    test( 'directory path', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'geojson-detect-' ) )
        expect( InputDetector.detect( { input: tmpDir } ).inputType ).toBe( 'folder' )
    } )


    test( 'unknown path throws', () => {
        expect( () => InputDetector.detect( { input: '/x/y.txt' } ) ).toThrow( /Cannot detect/ )
    } )


    test( 'non-string non-buffer throws', () => {
        expect( () => InputDetector.detect( { input: 42 } ) ).toThrow( /Buffer or string/ )
    } )
} )
