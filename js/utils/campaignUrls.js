/**
 * Campaign URL helpers – shareable links.
 * On Vercel, use /l/:c[/:ref] for OG preview; otherwise index.html?c=...
 */

export function isVercel() {
    return typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
}

function getIndexBaseUrl() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const basePath = pathname.replace(/\/(admin|admin\.html|index\.html)?\/?$/, '') || '/';
    const path = basePath.endsWith('/') ? basePath : basePath + '/';
    return `${origin}${path}index.html`;
}

/**
 * Shareable campaign URL. On Vercel uses /l/:c[/:ref] for OG preview.
 * @param {string} campaignId
 * @param {string} [ref]
 * @returns {string}
 */
export function getShareableCampaignUrl(campaignId, ref) {
    const origin = window.location.origin;
    if (isVercel()) {
        const path = ref ? `/l/${campaignId}/${ref}` : `/l/${campaignId}`;
        return `${origin}${path}`;
    }
    const base = getIndexBaseUrl();
    const q = ref ? `?c=${campaignId}&ref=${ref}` : `?c=${campaignId}`;
    return `${base}${q}`;
}
