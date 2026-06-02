import { describe, test, expect, afterEach } from '@jest/globals'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { MetaWriter } from '../../src/shared/MetaWriter.mjs'
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


describe( 'MetaWriter', () => {
    test( 'writeMeta then readMeta round-trips scalars and objects', () => {
        tmpDir = mkdtempSync( join( tmpdir(), 'geojson-meta-' ) )
        const dbPath = join( tmpDir, 'm.db' )
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema: { dummy: [ { name: 'x', type: 'TEXT' } ] } } )
        MetaWriter.writeMeta( { db, metaTable: {
            qualitySeal: 'sqlite-geojson',
            nothing: null,
            rowCounts: { features: 3 },
            tags: [ 'a', 'b' ]
        } } )
        const out = MetaWriter.readMeta( { db } )
        SqliteBuilder.close( { db } )

        expect( out.qualitySeal ).toBe( 'sqlite-geojson' )
        expect( out.nothing ).toBeNull()
        expect( out.rowCounts ).toEqual( { features: 3 } )
        expect( out.tags ).toEqual( [ 'a', 'b' ] )
    } )
} )
