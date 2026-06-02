// Internal Building Blocks
export { Validation } from './shared/Validation.mjs'

export { GeojsonSpecValidator } from './converters/geojson/GeojsonSpecValidator.mjs'
export { GeometryReducer } from './converters/geojson/GeometryReducer.mjs'
export { GeojsonCapabilityDetector } from './converters/geojson/GeojsonCapabilityDetector.mjs'


// FlowMCP Consumer API (URL mode — Memo 096)
export { GeojsonUrlStore } from './converters/geojson/GeojsonUrlStore.mjs'
export { GeojsonDefaultMethods } from './converters/geojson/GeojsonDefaultMethods.mjs'
export { FlowMcpAdapter } from './adapters/FlowMcpAdapter.mjs'
