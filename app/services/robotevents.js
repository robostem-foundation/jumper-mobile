import axios from 'axios';

const BASE_URL = 'https://www.robotevents.com/api/v2';
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY || '';

const getClient = () =>
    axios.create({
        baseURL: BASE_URL,
        headers: {
            Authorization: `Bearer ${DEFAULT_API_KEY}`,
            Accept: 'application/json',
        },
    });

// ── Events ────────────────────────────────────────────────────
export const getEventBySku = async (sku) => {
    const res = await getClient().get('/events', { params: { sku } });
    if (res.data.data?.length > 0) return res.data.data[0];
    throw new Error('Event not found');
};

// ── Matches ───────────────────────────────────────────────────
export const getMatchesForEvent = async (event) => {
    const client = getClient();
    let allMatches = [];

    const divisions = event.divisions?.length > 0
        ? event.divisions
        : [{ id: 1, name: 'Default Division' }];

    for (const division of divisions) {
        let page = 1, lastPage = 1;
        do {
            try {
                const res = await client.get(
                    `/events/${event.id}/divisions/${division.id}/matches`,
                    { params: { page, per_page: 250 } }
                );
                allMatches = [...allMatches, ...res.data.data];
                lastPage = res.data.meta.last_page;
            } catch { break; }
            page++;
        } while (page <= lastPage);
    }

    return allMatches.sort((a, b) => {
        const t = m => m.started
            ? new Date(m.started).getTime()
            : m.scheduled
                ? new Date(m.scheduled).getTime()
                : Infinity;
        const at = t(a), bt = t(b);
        if (at === Infinity && bt === Infinity)
            return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
        return at - bt;
    });
};

export const getMatchesForEventAndTeam = async (eventId, teamId) => {
    const client = getClient();
    let allMatches = [];
    try {
        const divRes = await client.get(`/events/${eventId}/divisions`);
        const divisions = divRes.data.data;
        for (const div of divisions) {
            let page = 1, lastPage = 1;
            do {
                const res = await client.get(
                    `/events/${eventId}/divisions/${div.id}/matches`,
                    { params: { page, per_page: 250 } }
                );
                allMatches = [...allMatches, ...res.data.data];
                lastPage = res.data.meta.last_page;
                page++;
            } while (page <= lastPage);
        }
    } catch {
        // Fallback: fetch via team endpoint
        let page = 1, lastPage = 1;
        do {
            const res = await client.get(`/teams/${teamId}/matches`, {
                params: { page, per_page: 250, event: [eventId] }
            });
            allMatches = [...allMatches, ...res.data.data];
            lastPage = res.data.meta.last_page;
            page++;
        } while (page <= lastPage);
    }

    return allMatches
        .filter(m => m.alliances?.some(a => a.teams?.some(t => t.team?.id === teamId)))
        .sort((a, b) => {
            const t = m => m.started
                ? new Date(m.started).getTime()
                : m.scheduled
                    ? new Date(m.scheduled).getTime()
                    : Infinity;
            return t(a) - t(b);
        });
};

// ── Teams ─────────────────────────────────────────────────────
export const getTeamsForEvent = async (eventId) => {
    const client = getClient();
    let allTeams = [], page = 1, lastPage = 1;
    do {
        const res = await client.get(`/events/${eventId}/teams`, { params: { page, per_page: 250 } });
        allTeams = [...allTeams, ...res.data.data];
        lastPage = res.data.meta.last_page;
        page++;
    } while (page <= lastPage);
    return allTeams;
};

export const getTeamByNumber = async (number) => {
    const res = await getClient().get('/teams', { params: { number, my_teams: false } });
    const exact = res.data.data.find(t => t.number === number);
    if (exact) return exact;
    if (res.data.data.length > 0) return res.data.data[0];
    throw new Error('Team not found');
};

// ── Rankings ──────────────────────────────────────────────────
export const getRankingsForEvent = async (eventId, divisions = []) => {
    const client = getClient();
    let all = [];
    const targets = divisions?.length > 0
        ? divisions
        : [{ id: 1, name: 'Default Division' }];

    for (const div of targets) {
        let page = 1, lastPage = 1;
        do {
            try {
                const res = await client.get(
                    `/events/${eventId}/divisions/${div.id}/rankings`,
                    { params: { page, per_page: 250 } }
                );
                all = [...all, ...res.data.data];
                lastPage = res.data.meta.last_page;
            } catch { break; }
            page++;
        } while (page <= lastPage);
    }
    return all;
};

// ── Skills ────────────────────────────────────────────────────
export const getSkillsForEvent = async (eventId) => {
    const client = getClient();
    let all = [], page = 1, lastPage = 1;
    try {
        do {
            const res = await client.get(`/events/${eventId}/skills`, { params: { page, per_page: 250 } });
            all = [...all, ...res.data.data];
            lastPage = res.data.meta.last_page;
            page++;
        } while (page <= lastPage);
    } catch { return []; }
    return all;
};
