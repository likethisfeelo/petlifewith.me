export * as schema from "./db/schema.js";
export { REGIONS, SIDO, normalizeSidoName, type RegionDef, type SidoDef } from "./regions/regions.js";
export { slugify } from "./etl/lib/slug.js";
export {
  REHAB_MODALITIES,
  getRehabModality,
  isRehabModalitySlug,
  normalizeModalitySlugs,
  type RehabModalityDef,
} from "./rehab/modalities.js";
