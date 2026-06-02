import { GeojsonSqliteConverter } from '../../../src/index.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Database from 'better-sqlite3'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const EXPECTED_SEAL = 'sqlite-geojson'


async function main() {
    const sourceFile = path.join( __dirname, 'source', 'sample.geojson' )
    const dbPath = path.join( __dirname, 'synthetic-geojson.db' )

    console.log( '[build-fixture] Reading source GeoJSON from:', sourceFile )
    console.log( '[build-fixture] Target DB path:', dbPath )
    console.log( '[build-fixture] Converting (inputType=geojson)...' )

    const result = await GeojsonSqliteConverter.start( {
        input: sourceFile,
        inputType: 'geojson',
        dbPath,
        force: false,
        sourceUrl: null
    } )

    if( !result.status ) {
        console.error( '[build-fixture] FAIL — converter aborted' )
        console.error( '[build-fixture] report:', JSON.stringify( result.report, null, 2 ) )
        process.exit( 1 )
    }

    if( result.seal !== EXPECTED_SEAL ) {
        console.error( `[build-fixture] SEAL MISMATCH — expected "${EXPECTED_SEAL}", got "${result.seal}"` )
        process.exit( 1 )
    }

    const db = new Database( dbPath, { readonly: true } )
    const count = db.prepare( 'SELECT COUNT(*) AS n FROM features' ).get()
    const capsRow = db.prepare( "SELECT value FROM meta WHERE key = 'capabilities'" ).get()
    db.close()

    console.log( '[build-fixture] qualitySeal =', result.seal )
    console.log( '[build-fixture] feature rows =', count.n )

    const capabilities = capsRow ? JSON.parse( capsRow.value ) : null
    const activated = Object
        .entries( capabilities || {} )
        .filter( ( [ , v ] ) => v === true )
        .map( ( [ k ] ) => k )

    console.log( '[build-fixture] Activated capabilities:' )
    activated.forEach( ( key ) => console.log( '  -', key ) )

    console.log( '[build-fixture] DONE — synthetic-geojson.db is ready at:', dbPath )
    process.exit( 0 )
}


main()
    .catch( ( err ) => {
        console.error( '[build-fixture] UNCAUGHT ERROR:', err )
        process.exit( 1 )
    } )
