import { describe, test, expect, afterEach } from '@jest/globals'
import { FolderReader } from '../../src/shared/FolderReader.mjs'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


describe( 'FolderReader.readFolder', () => {
    test( 'reads only .geojson/.json files', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'geojson-folder-' ) )
        writeFileSync( join( tmpDir, 'a.geojson' ), '{}' )
        writeFileSync( join( tmpDir, 'b.json' ), '{}' )
        writeFileSync( join( tmpDir, 'c.txt' ), 'nope' )
        const { files } = FolderReader.readFolder( { folderPath: tmpDir } )
        const names = [ ...files.keys() ].sort()
        expect( names ).toEqual( [ 'a.geojson', 'b.json' ] )
        expect( Buffer.isBuffer( files.get( 'a.geojson' ) ) ).toBe( true )
    } )
} )
