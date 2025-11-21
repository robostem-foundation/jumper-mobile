import { format } from 'date-fns';

/**
 * Calculate the number of days an event spans
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {number} Number of days (minimum 1)
 */
export const calculateEventDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 1;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate difference in days (ceiling to count partial days)
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // An event starting and ending on the same day is 1 day
    // An event spanning Nov 1-2 is 2 days, etc.
    return Math.max(1, diffDays + 1);
};

/**
 * Determine which day index (0-based) a match occurred on
 * @param {string} matchDate - ISO date string of match start
 * @param {string} eventStartDate - ISO date string of event start
 * @returns {number} Day index (0 for day 1, 1 for day 2, etc.)
 */
export const getMatchDayIndex = (matchDate, eventStartDate) => {
    if (!matchDate || !eventStartDate) return 0;

    // Extract just the calendar date (YYYY-MM-DD) from the ISO string
    // This preserves the local timezone without conversion
    const matchDateOnly = matchDate.split('T')[0];
    const eventDateOnly = eventStartDate.split('T')[0];

    // Parse as dates at midnight UTC for comparison
    const matchDay = new Date(matchDateOnly + 'T00:00:00Z');
    const eventDay = new Date(eventDateOnly + 'T00:00:00Z');

    const diffTime = matchDay - eventDay;
    const dayIndex = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, dayIndex);
};

/**
 * Find the best stream for a given match
 * @param {Object} match - Match object with started/scheduled time
 * @param {Array} streams - Array of stream objects
 * @param {string} eventStartDate - Event start date for day calculation
 * @returns {Object|null} Stream object or null if no valid stream
 */
export const findStreamForMatch = (match, streams, eventStartDate) => {
    if (!match || !streams || streams.length === 0) return null;

    // If match hasn't started, we can't determine availability
    const matchStartTime = match.started || match.scheduled;
    if (!matchStartTime) return null;

    const matchDay = getMatchDayIndex(matchStartTime, eventStartDate);
    const matchTimeMs = new Date(matchStartTime).getTime();

    // Filter streams that could show this match:
    // 1. Stream is for the same day (or is a backup stream with dayIndex null)
    // 2. Stream started before or at the match time
    const validStreams = streams.filter(stream => {
        // Check if stream is for this day or is a backup stream (dayIndex === null)
        const matchesDay = stream.dayIndex === null || stream.dayIndex === matchDay;
        if (!matchesDay) return false;

        // Check if stream has a valid start time
        if (!stream.streamStartTime) return false;

        // Check if stream started before the match
        const streamStartedBeforeMatch = stream.streamStartTime <= matchTimeMs;

        return streamStartedBeforeMatch;
    });

    // Return first valid stream (user can reorder streams if needed)
    // Prioritize day-specific streams over backup streams
    const daySpecific = validStreams.find(s => s.dayIndex === matchDay);
    if (daySpecific) return daySpecific;

    return validStreams[0] || null;
};

/**
 * Get the reason why a match is unavailable (grayed out)
 * @param {Object} match - Match object
 * @param {Array} streams - Array of stream objects
 * @param {string} eventStartDate - Event start date
 * @returns {string|null} Reason string or null if match is available
 */
export const getGrayOutReason = (match, streams, eventStartDate) => {
    if (!match) return null;

    const matchStartTime = match.started || match.scheduled;

    // If match hasn't been played/scheduled, it's not grayed out
    if (!matchStartTime) return null;

    // If no streams at all
    if (!streams || streams.length === 0) {
        return "No livestreams added yet. Add a stream URL above.";
    }

    const matchDay = getMatchDayIndex(matchStartTime, eventStartDate);
    const matchTimeMs = new Date(matchStartTime).getTime();
    const matchTimeFormatted = format(new Date(matchStartTime), 'h:mm a');

    // Check if there's a stream for this day
    const streamsForDay = streams.filter(s =>
        s.dayIndex === null || s.dayIndex === matchDay
    );

    if (streamsForDay.length === 0) {
        return `No livestream for Day ${matchDay + 1}. Add a stream for this day to watch matches.`;
    }

    // Check if any stream has started yet
    const streamsWithStartTime = streamsForDay.filter(s => s.streamStartTime);

    if (streamsWithStartTime.length === 0) {
        return `Stream URL added but not loaded yet. The stream needs to load to detect start time.`;
    }

    // Check if any stream started early enough
    const validStream = streamsWithStartTime.find(s => s.streamStartTime <= matchTimeMs);

    if (!validStream) {
        const earliestStream = streamsWithStartTime
            .sort((a, b) => a.streamStartTime - b.streamStartTime)[0];
        const streamStartFormatted = format(new Date(earliestStream.streamStartTime), 'h:mm a');

        return `Stream started at ${streamStartFormatted}, but this match was at ${matchTimeFormatted}.`;
    }

    return null;
};
