import { GeojsonConverter } from './converters/geojson/GeojsonConverter.mjs'


export class GeojsonSqliteConverter {
    static async start( { input, inputType = 'auto', force = false, dbPath, sourceUrl = null } ) {
        return await GeojsonConverter.run( { input, inputType, force, dbPath, sourceUrl } )
    }
}
