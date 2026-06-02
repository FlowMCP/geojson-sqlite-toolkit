const GJSON_CODES = {
    'GJSON-001': { severity: 'ERROR',   description: 'Input is not valid JSON' },
    'GJSON-002': { severity: 'ERROR',   description: 'Top-level type is not FeatureCollection' },
    'GJSON-003': { severity: 'ERROR',   description: 'features is missing or not an array' },
    'GJSON-004': { severity: 'ERROR',   description: 'Feature has no geometry or geometry is malformed' },
    'GJSON-005': { severity: 'ERROR',   description: 'Geometry type is unsupported' },
    'GJSON-006': { severity: 'ERROR',   description: 'Geometry coordinates missing or malformed' },
    'GJSON-007': { severity: 'ERROR',   description: 'FeatureCollection has no features' },

    'GJSON-101': { severity: 'WARNING', description: 'Feature element is not of type Feature' },
    'GJSON-102': { severity: 'WARNING', description: 'Feature properties is not an object' },
    'GJSON-103': { severity: 'WARNING', description: 'Coordinate value out of WGS84 range' },
    'GJSON-104': { severity: 'WARNING', description: 'GeometryCollection encountered (representative point skipped)' },

    'GJSON-201': { severity: 'INFO',    description: 'Point geometries present' },
    'GJSON-202': { severity: 'INFO',    description: 'Line geometries present (LineString/MultiLineString)' },
    'GJSON-203': { severity: 'INFO',    description: 'Polygon geometries present (Polygon/MultiPolygon)' },
    'GJSON-204': { severity: 'INFO',    description: 'Multi geometries present' }
}


export class Validation {
    #errors
    #warnings
    #info
    #additionalValidators


    constructor() {
        this.#errors = []
        this.#warnings = []
        this.#info = []
        this.#additionalValidators = []
    }


    static create() {
        return new Validation()
    }


    static getCodes() {
        return { ...GJSON_CODES }
    }


    static getCodeMeta( { code } ) {
        if( !GJSON_CODES[ code ] ) {
            throw new Error( `Unknown GJSON code: ${code}` )
        }
        return { ...GJSON_CODES[ code ] }
    }


    error( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'ERROR' ) {
            throw new Error( `Code ${code} is not an ERROR (severity: ${meta.severity})` )
        }
        this.#errors.push( { code, file, message, severity: 'ERROR' } )
    }


    warning( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'WARNING' ) {
            throw new Error( `Code ${code} is not a WARNING (severity: ${meta.severity})` )
        }
        this.#warnings.push( { code, file, message, severity: 'WARNING' } )
    }


    info( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'INFO' ) {
            throw new Error( `Code ${code} is not an INFO (severity: ${meta.severity})` )
        }
        this.#info.push( { code, file, message, severity: 'INFO' } )
    }


    addValidator( validator ) {
        if( typeof validator !== 'function' ) {
            throw new Error( 'additionalValidator must be a function' )
        }
        this.#additionalValidators.push( validator )
    }


    runAdditionalValidators( { parsedInput } ) {
        this.#additionalValidators.forEach( ( validator ) => {
            validator( { parsedInput, validation: this } )
        } )
    }


    report() {
        return {
            status: this.#errors.length === 0,
            errors: [ ...this.#errors ],
            warnings: [ ...this.#warnings ],
            info: [ ...this.#info ],
            summary: {
                errorCount: this.#errors.length,
                warningCount: this.#warnings.length,
                infoCount: this.#info.length
            }
        }
    }
}
