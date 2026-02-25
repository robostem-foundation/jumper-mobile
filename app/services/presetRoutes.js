const API_URL = 'https://jumper.robostem.org/api/get-all-routes';

let cachedRoutes = null;

/**
 * Fetches preset event routes from the Jumper API.
 * Returns items reversed so the newest event is first.
 * Result is cached in memory for the session.
 */
export async function fetchPresetRoutes() {
    if (cachedRoutes) return cachedRoutes;

    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Reverse so newest (last in API) is at the top
    cachedRoutes = [...data].reverse();
    return cachedRoutes;
}

/** Clear the cache (e.g. for retry after error) */
export function clearPresetRoutesCache() {
    cachedRoutes = null;
}
