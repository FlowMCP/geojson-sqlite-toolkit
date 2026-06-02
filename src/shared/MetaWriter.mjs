export class MetaWriter {
    static writeMeta( { db, metaTable } ) {
        db.exec( 'CREATE TABLE IF NOT EXISTS "meta" ( "key" TEXT PRIMARY KEY, "value" TEXT )' )
        const stmt = db.prepare( 'INSERT OR REPLACE INTO "meta" ( "key", "value" ) VALUES ( ?, ? )' )
        const writeMany = db.transaction( ( entries ) => {
            entries.forEach( ( [ key, value ] ) => {
                const serialized = MetaWriter.#serialize( { value } )
                stmt.run( key, serialized )
            } )
        } )
        writeMany( Object.entries( metaTable ) )
        return { written: Object.keys( metaTable ).length }
    }


    static readMeta( { db } ) {
        const rows = db.prepare( 'SELECT "key", "value" FROM "meta"' ).all()
        const result = {}
        rows.forEach( ( row ) => {
            result[ row.key ] = MetaWriter.#deserialize( { value: row.value } )
        } )
        return result
    }


    static #serialize( { value } ) {
        if( value === null || value === undefined ) {
            return ''
        }
        if( typeof value === 'string' ) {
            return value
        }
        return JSON.stringify( value )
    }


    static #deserialize( { value } ) {
        if( value === '' ) {
            return null
        }
        const trimmed = value.trim()
        if( trimmed.startsWith( '{' ) || trimmed.startsWith( '[' ) ) {
            try {
                return JSON.parse( value )
            } catch {
                return value
            }
        }
        return value
    }
}
