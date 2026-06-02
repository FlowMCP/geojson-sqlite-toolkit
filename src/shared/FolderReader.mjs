import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'


export class FolderReader {
    static readFolder( { folderPath } ) {
        const entries = readdirSync( folderPath )
        const files = new Map()
        entries
            .filter( ( name ) => {
                const lower = name.toLowerCase()
                return lower.endsWith( '.geojson' ) || lower.endsWith( '.json' )
            } )
            .filter( ( name ) => statSync( join( folderPath, name ) ).isFile() )
            .forEach( ( name ) => {
                const buffer = readFileSync( join( folderPath, name ) )
                files.set( name, buffer )
            } )
        return { files }
    }
}
