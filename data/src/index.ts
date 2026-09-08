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
  SENIOR_SERVICE_CATEGORIES,
  UNCATEGORIZED_LABEL,
  bodyAreasForTopic,
  categoriesForTopic,
  getGuideCategory,
  serviceCategoriesForTopic,
  type CategoryQuestion,
  type GuideCategoryDef,
} from "./guides/categories.js";
export { seniorSeedPosts, type SeedPost } from "./guides/seed-posts.js";
