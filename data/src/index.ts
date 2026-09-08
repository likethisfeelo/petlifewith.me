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
export {
  GUIDE_CATEGORIES_BY_TOPIC,
  SENIOR_BODY_AREAS,
  UNCATEGORIZED_LABEL,
  categoriesForTopic,
  getGuideCategory,
  type CategoryQuestion,
  type GuideCategoryDef,
} from "./guides/categories.js";
