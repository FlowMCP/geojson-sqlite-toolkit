import { statSync, existsSync } from 'node:fs'


export class InputDetector {
    static detect( { input } ) {
        if( Buffer.isBuffer( input ) ) {
            return { inputType: 'buffer' }
        }
        if( typeof input === 'string' ) {
            const lower = input.toLowerCase()
            if( lower.endsWith( '.geojson' ) ) {
                return { inputType: 'geojson' }
            }
            if( lower.endsWith( '.json' ) ) {
                return { inputType: 'json' }
            }
            if( existsSync( input ) && statSync( input ).isDirectory() ) {
                return { inputType: 'folder' }
            }
            throw new Error( `Cannot detect input type from path: ${input}` )
        }
        throw new Error( 'Input must be Buffer or string path' )
    }
}
