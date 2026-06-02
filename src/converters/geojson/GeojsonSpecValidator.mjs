import { Validation } from '../../shared/Validation.mjs'


const SUPPORTED_GEOMETRY_TYPES = [
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon'
]

const SPEC_URL = 'https://datatracker.ietf.org/doc/html/rfc7946'


export class GeojsonSpecValidator {
    static getSupportedGeometryTypes() {
        return [ ...SUPPORTED_GEOMETRY_TYPES ]
    }


    static getSpecUrl() {
        return SPEC_URL
    }


    static validate( { collection, filename = 'input.geojson', validation } ) {
        const v = validation || Validation.create()

        if( collection === null || typeof collection !== 'object' || Array.isArray( collection ) ) {
            v.error( 'GJSON-002', filename, 'Parsed input is not a JSON object' )
            return v
        }
        if( collection.type !== 'FeatureCollection' ) {
            v.error( 'GJSON-002', filename, `Top-level type must be "FeatureCollection", got "${collection.type}"` )
            return v
        }
        if( !Array.isArray( collection.features ) ) {
            v.error( 'GJSON-003', filename, 'features must be an array' )
            return v
        }
        if( collection.features.length === 0 ) {
            v.error( 'GJSON-007', filename, 'FeatureCollection has no features' )
            return v
        }

        collection.features
            .forEach( ( feature, index ) => {
                GeojsonSpecValidator.#validateFeature( { feature, index, filename, validation: v } )
            } )

        return v
    }


    static #validateFeature( { feature, index, filename, validation } ) {
        if( feature === null || typeof feature !== 'object' || Array.isArray( feature ) ) {
            validation.error( 'GJSON-004', filename, `features[${index}] is not an object` )
            return
        }
        if( feature.type !== 'Feature' ) {
            validation.warning( 'GJSON-101', filename, `features[${index}].type should be "Feature", got "${feature.type}"` )
        }
        if( feature.properties !== undefined && feature.properties !== null ) {
            if( typeof feature.properties !== 'object' || Array.isArray( feature.properties ) ) {
                validation.warning( 'GJSON-102', filename, `features[${index}].properties is not an object` )
            }
        }

        const geometry = feature.geometry
        if( geometry === null || typeof geometry !== 'object' || Array.isArray( geometry ) ) {
            validation.error( 'GJSON-004', filename, `features[${index}].geometry is missing or malformed` )
            return
        }
        if( geometry.type === 'GeometryCollection' ) {
            validation.warning( 'GJSON-104', filename, `features[${index}] is a GeometryCollection` )
            return
        }
        if( !SUPPORTED_GEOMETRY_TYPES.includes( geometry.type ) ) {
            validation.error( 'GJSON-005', filename, `features[${index}].geometry.type "${geometry.type}" is unsupported` )
            return
        }
        if( !Array.isArray( geometry.coordinates ) || geometry.coordinates.length === 0 ) {
            validation.error( 'GJSON-006', filename, `features[${index}].geometry.coordinates missing or malformed` )
        }
    }
}
