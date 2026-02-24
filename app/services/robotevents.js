import axios from 'axios';

const BASE_URL = 'https://www.robotevents.com/api/v2';
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY || ''; // Expo uses EXPO_PUBLIC_ prefix

const getClient = () => {
    const apiKey = DEFAULT_API_KEY;

    return axios.create({
        baseURL: BASE_URL,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });
};

export const getEventBySku = async (sku) => {
    const client = getClient();
    const response = await client.get('/events', {
        params: {
            sku: sku,
        },
    });

    if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
    }
    throw new Error('Event not found');
};

export const getMatchesForEvent = async (event) => {
    const client = getClient();
    let allMatches = [];

    try {
        const divisions = event.divisions && event.divisions.length > 0
            ? event.divisions
            : [{ id: 1, name: 'Default Division' }];

        for (const division of divisions) {
            let page = 1;
            let lastPage = 1;

            do {
                try {
                    const response = await client.get(`/events/${event.id}/divisions/${division.id}/matches`, {
                        params: {
                            page,
                            per_page: 250
                        }
                    });

                    allMatches = [...allMatches, ...response.data.data];
                    lastPage = response.data.meta.last_page;
                } catch (err) {
                    break;
                }
                page++;
            } while (page <= lastPage);
        }

    } catch (error) {
        throw new Error(`Could not fetch matches: ${error.message}`);
    }

    return allMatches.sort((a, b) => {
        const getMatchTime = (m) => {
            if (m.started) return new Date(m.started).getTime();
            if (m.scheduled) return new Date(m.scheduled).getTime();
            return Infinity;
        };

        const aTime = getMatchTime(a);
        const bTime = getMatchTime(b);

        if (aTime === Infinity && bTime === Infinity) {
            return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
        }

        return aTime - bTime;
    });
};

export const getTeamsForEvent = async (eventId) => {
    const client = getClient();
    let allTeams = [];
    let page = 1;
    let lastPage = 1;

    try {
        do {
            const response = await client.get(`/events/${eventId}/teams`, {
                params: {
                    page,
                    per_page: 250
                }
            });
            allTeams = [...allTeams, ...response.data.data];
            lastPage = response.data.meta.last_page;
            page++;
        } while (page <= lastPage);
        return allTeams;
    } catch (error) {
        return [];
    }
};
