import { GeojsonSqliteConverter, FlowMcpAdapter, GeojsonDefaultMethods } from '../../src/index.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )


//
// Manual POC runner. Point INPUT at a LOCAL GeoJSON file you keep OUTSIDE the
// repo (e.g. under tests/manual/data/, which is gitignored). Never commit
// third-party geodata. Falls back to the CC0 synthetic fixture when no
// argument is given.
//

async function main() {
    const arg = process.argv[ 2 ]
    const input = arg
        ? path.resolve( arg )
        : path.join( __dirname, '..', 'fixtures', 'synthetic-geojson', 'source', 'sample.geojson' )
    const dbPath = path.join( __dirname, 'data', 'manual-geojson.db' )

    console.log( '[run-all] input:', input )
    console.log( '[run-all] dbPath:', dbPath )

    const result = await GeojsonSqliteConverter.start( {
        input,
        inputType: 'geojson',
        dbPath,
        force: false,
        sourceUrl: null
    } )

    console.log( '[run-all] status:', result.status, 'seal:', result.seal )
    if( !result.status ) {
        console.error( '[run-all] aborted:', JSON.stringify( result.report, null, 2 ) )
        process.exit( 1 )
    }

    const { sealed, meta } = FlowMcpAdapter.verifySeal( { dbPath } )
    console.log( '[run-all] sealed:', sealed, 'features:', meta.rowCounts )

    const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath, namespace: 'mygeo' } )
    console.log( '[run-all] tools:', tools.map( ( t ) => t.name ) )

    const bbox = GeojsonDefaultMethods.featuresInBBox( {
        dbPath, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2, limit: 100
    } )
    console.log( '[run-all] featuresInBBox matchCount:', bbox.matchCount )

    process.exit( 0 )
}


main()
    .catch( ( err ) => {
        console.error( '[run-all] UNCAUGHT ERROR:', err )
        process.exit( 1 )
    } )
