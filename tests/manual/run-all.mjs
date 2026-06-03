import { FlowMcpAdapter, GeojsonDefaultMethods } from '../../src/index.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )


//
// Manual POC runner (URL mode — Memo 096). Point the argument at a LOCAL
// GeoJSON file you keep OUTSIDE the repo. Never commit third-party geodata.
// The file is read locally and served through a stubbed fetch so the URL
// pipeline (fetch -> parse -> validate-on-load -> in-memory) runs end to end
// without a network. Falls back to the CC0 synthetic fixture.
//

async function main() {
    const arg = process.argv[ 2 ]
    const file = arg
        ? path.resolve( arg )
        : path.join( __dirname, '..', 'fixtures', 'synthetic-geojson', 'source', 'sample.geojson' )
    const url = 'https://example.org/manual-geojson.geojson'

    console.log( '[run-all] file:', file )
    console.log( '[run-all] url :', url )

    const body = readFileSync( file, 'utf-8' )
    global.fetch = async () => ( { ok: true, status: 200, text: async () => body } )

    const loaded = await FlowMcpAdapter.loadFromUrl( { url } )
    console.log( '[run-all] loaded:', loaded.loaded, 'records:', loaded.recordCount, 'capabilities:', loaded.capabilities )

    const { tools } = FlowMcpAdapter.buildToolDefinitions( { url, namespace: 'mygeo' } )
    console.log( '[run-all] tools:', tools.map( ( t ) => t.name ) )

    const bbox = GeojsonDefaultMethods.inBoundingBox( {
        url, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2, limit: 100
    } )
    console.log( '[run-all] inBoundingBox matchCount:', bbox.matchCount )

    const near = GeojsonDefaultMethods.nearPoint( {
        url, lat: 50.0, lon: 10.0, radiusMeters: 5000, limit: 50
    } )
    console.log( '[run-all] nearPoint matchCount:', near.matchCount )

    process.exit( 0 )
}


main()
    .catch( ( err ) => {
        console.error( '[run-all] UNCAUGHT ERROR:', err )
        process.exit( 1 )
    } )
