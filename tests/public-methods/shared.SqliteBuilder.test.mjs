import { describe, test, expect, afterEach } from '@jest/globals'
import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'


let tmpDir = null


const schema = { t: [ { name: 'id', type: 'INTEGER' }, { name: 'label', type: 'TEXT' } ] }


afterEach( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


const setup = () => { tmpDir = mkdtempSync( join( tmpdir(), 'geojson-sqlite-' ) ); return tmpDir }


describe( 'SqliteBuilder', () => {
    test( 'createDatabase + insertRows + openDatabase round-trip', () => {
        setup()
        const dbPath = join( tmpDir, 'a.db' )
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema } )
        SqliteBuilder.insertRows( { db, tableName: 't', rows: [ { id: 1, label: 'x' }, { id: 2, label: '' } ] } )
        SqliteBuilder.close( { db } )

        const { db: db2 } = SqliteBuilder.openDatabase( { dbPath } )
        const rows = db2.prepare( 'SELECT * FROM t ORDER BY id' ).all()
        db2.close()
        expect( rows.length ).toBe( 2 )
        expect( rows[ 0 ].label ).toBe( 'x' )
        expect( rows[ 1 ].label ).toBeNull()
    } )


    test( 'insertRows with empty array inserts nothing', () => {
        setup()
        const dbPath = join( tmpDir, 'b.db' )
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema } )
        const result = SqliteBuilder.insertRows( { db, tableName: 't', rows: [] } )
        SqliteBuilder.close( { db } )
        expect( result.inserted ).toBe( 0 )
    } )


    test( 'atomicSwap moves .new into place', () => {
        setup()
        const dbPathNew = join( tmpDir, 'c.db.new' )
        const dbPathFinal = join( tmpDir, 'c.db' )
        const { db } = SqliteBuilder.createDatabase( { dbPath: dbPathNew, schema } )
        SqliteBuilder.close( { db } )
        const result = SqliteBuilder.atomicSwap( { dbPathNew, dbPathFinal } )
        expect( result.dbPath ).toBe( dbPathFinal )
        expect( existsSync( dbPathFinal ) ).toBe( true )
        expect( existsSync( dbPathNew ) ).toBe( false )
    } )


    test( 'atomicSwap throws when source missing', () => {
        setup()
        expect( () => SqliteBuilder.atomicSwap( { dbPathNew: join( tmpDir, 'missing.db.new' ), dbPathFinal: join( tmpDir, 'x.db' ) } ) )
            .toThrow( /does not exist/ )
    } )


    test( 'createDatabase overwrites existing file', () => {
        setup()
        const dbPath = join( tmpDir, 'd.db' )
        writeFileSync( dbPath, 'garbage' )
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema } )
        SqliteBuilder.close( { db } )
        const { db: db2 } = SqliteBuilder.openDatabase( { dbPath } )
        const count = db2.prepare( 'SELECT COUNT(*) AS n FROM t' ).get()
        db2.close()
        expect( count.n ).toBe( 0 )
    } )
} )
