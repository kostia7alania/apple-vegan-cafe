/**
 * Launch gate. While `false`, every page carries <meta name="robots" noindex>.
 *
 * The live menu now comes from the owner's Grab Bulk Update export. Keep this
 * true unless a serious legal/reputation issue requires temporarily removing
 * the public site from search.
 */
export const SITE_LAUNCHED = true;

/**
 * The Thai Jay landing contains long-form cultural copy that still needs the
 * family's review. While false, the route redirects to the verified Thai menu
 * and is excluded from the sitemap instead of publishing draft copy.
 */
export const TH_JAY_LANDING_REVIEWED = false;
export const TH_JAY_LANDING_PATH = '/th/ร้านอาหารเจ-พัทยา/';
