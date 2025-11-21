import axios from 'axios';

const BASE_URL = 'https://www.robotevents.com/api/v2';
const DEFAULT_API_KEY = import.meta.env.VITE_DEFAULT_ROBOTEVENTS_API_KEY;

const getClient = () => {
    const userKey = localStorage.getItem('robotevents_api_key');
    const apiKey = userKey || DEFAULT_API_KEY;

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
    // Search for the event by SKU
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

export const getTeamByNumber = async (number) => {
    const client = getClient();
    const response = await client.get('/teams', {
        params: {
            number: number,
            my_teams: false
        },
    });

    // Filter to find exact match if needed, though API usually does good job
    const team = response.data.data.find(t => t.number === number);
    if (team) return team;

    if (response.data.data.length > 0) return response.data.data[0];

    throw new Error('Team not found');
};

export const getMatchesForEventAndTeam = async (eventId, teamId) => {
    const client = getClient();
    let allMatches = [];

    try {
        // First, try to get matches through divisions
        try {
            const divisionsResponse = await client.get(`/events/${eventId}/divisions`);
            const divisions = divisionsResponse.data.data;

            // Fetch matches from each division
            for (const division of divisions) {
                let page = 1;
                let lastPage = 1;

                do {
                    const response = await client.get(`/events/${eventId}/divisions/${division.id}/matches`, {
                        params: {
                            page,
                            per_page: 250
                        }
                    });

                    allMatches = [...allMatches, ...response.data.data];
                    lastPage = response.data.meta.last_page;
                    page++;
                } while (page <= lastPage);
            }
        } catch (divisionError) {
            // This is expected for some events that don't expose divisions
            console.warn('Divisions endpoint not available (404), falling back to team-based fetch.');

            // Fallback: Try to fetch all matches for the team across all their events
            // Then filter for this specific event
            let page = 1;
            let lastPage = 1;

            do {
                const response = await client.get(`/teams/${teamId}/matches`, {
                    params: {
                        page,
                        per_page: 250,
                        event: [eventId]
                    }
                });

                allMatches = [...allMatches, ...response.data.data];
                lastPage = response.data.meta.last_page;
                page++;
            } while (page <= lastPage);
        }
    } catch (error) {
        console.error('Error fetching matches:', error);
        throw new Error(`Could not fetch matches: ${error.response?.data?.message || error.message}`);
    }

    // Filter matches where the team is playing (in case we got extra data)
    const teamMatches = allMatches.filter(match => {
        return match.alliances && match.alliances.some(alliance =>
            alliance.teams && alliance.teams.some(t => t.team && t.team.id === teamId)
        );
    });

    // Sort by start time, putting unplayed matches at the end
    return teamMatches.sort((a, b) => {
        // Use started time if available, otherwise scheduled time, otherwise Infinity (future)
        const getMatchTime = (m) => {
            if (m.started) return new Date(m.started).getTime();
            if (m.scheduled) return new Date(m.scheduled).getTime();
            return Infinity; // Unplayed/Unscheduled matches go to the end
        };

        const aTime = getMatchTime(a);
        const bTime = getMatchTime(b);

        // If both are Infinity (unplayed), sort by match name/number if possible
        if (aTime === Infinity && bTime === Infinity) {
            // Simple alphanumeric sort for match names (e.g., Q1, Q2)
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
        console.error('Error fetching teams:', error);
        return [];
    }
};

export const getRankingsForEvent = async (eventId, divisions = []) => {
    const client = getClient();
    let allRankings = [];

    // All events have divisions, so we go directly to division-based endpoints
    // instead of trying the main event endpoint which often returns 404
    if (divisions.length === 0) {
        console.warn('No divisions provided for rankings fetch');
        return [];
    }

    try {
        for (const division of divisions) {
            let dPage = 1;
            let dLastPage = 1;
            do {
                const response = await client.get(`/events/${eventId}/divisions/${division.id}/rankings`, {
                    params: { page: dPage, per_page: 250 }
                });
                allRankings = [...allRankings, ...response.data.data];
                dLastPage = response.data.meta.last_page;
                dPage++;
            } while (dPage <= dLastPage);
        }
        return allRankings;
    } catch (error) {
        // Suppress 404s as they might mean rankings aren't published yet
        if (error.response && error.response.status !== 404) {
            console.warn('Could not fetch division rankings', error);
        }
        return [];
    }
};

export const getSkillsForEvent = async (eventId) => {
    const client = getClient();
    let allSkills = [];
    let page = 1;
    let lastPage = 1;

    try {
        do {
            const response = await client.get(`/events/${eventId}/skills`, {
                params: {
                    page,
                    per_page: 250
                }
            });
            allSkills = [...allSkills, ...response.data.data];
            lastPage = response.data.meta.last_page;
            page++;
        } while (page <= lastPage);
        return allSkills;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // console.warn('Skills not found for event');
        } else {
            console.error('Error fetching skills:', error);
        }
        return [];
    }
};

export const getWorldSkillsForTeams = async (seasonId, teamIds) => {
    // The RobotEvents API v2 does not currently support bulk fetching of skills for specific teams
    // or a generic /skills endpoint that we can filter by team list efficiently.
    // Endpoints like /skills and /seasons/{id}/skills return 404.
    // To avoid errors, we return an empty list.
    console.warn('World Skills API not available for bulk fetch.');
    return [];
};
