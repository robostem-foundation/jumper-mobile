import React, { useState, useEffect } from 'react';
import { Tv, Plus, X, Loader } from 'lucide-react';
import { extractVideoId, getStreamStartTime } from '../services/youtube';

/**
 * StreamManager component - Manages multiple livestream inputs
 * Auto-creates stream boxes based on event duration
 * Allows adding backup streams
 */
function StreamManager({ event, streams, onStreamsChange, onWebcastSelect }) {
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});

    // Fetch stream start times when stream URLs change
    useEffect(() => {
        const fetchStreamTimes = async () => {
            for (const stream of streams) {
                if (stream.videoId && !stream.streamStartTime && !loading[stream.id]) {
                    setLoading(prev => ({ ...prev, [stream.id]: true }));
                    setErrors(prev => ({ ...prev, [stream.id]: null }));

                    try {
                        const startTime = await getStreamStartTime(stream.videoId);
                        if (startTime) {
                            updateStream(stream.id, {
                                streamStartTime: new Date(startTime).getTime()
                            });
                            setErrors(prev => ({ ...prev, [stream.id]: null }));
                        } else {
                            // Stream start time not available
                            setErrors(prev => ({
                                ...prev,
                                [stream.id]: 'Unable to detect stream start time. You\'ll need to manually sync.'
                            }));
                        }
                    } catch (error) {
                        console.error(`Error fetching stream start time for ${stream.id}:`, error);
                        setErrors(prev => ({
                            ...prev,
                            [stream.id]: 'Error loading stream info. Check your YouTube API key in settings.'
                        }));
                    } finally {
                        setLoading(prev => ({ ...prev, [stream.id]: false }));
                    }
                }
            }
        };

        fetchStreamTimes();
    }, [streams.map(s => s.videoId).join(',')]); // Only re-run when video IDs change

    const updateStream = (streamId, updates) => {
        const updated = streams.map(s =>
            s.id === streamId ? { ...s, ...updates } : s
        );
        onStreamsChange(updated);
    };

    const handleUrlChange = (streamId, url) => {
        const videoId = url ? extractVideoId(url) : null;
        updateStream(streamId, { url, videoId });

        // Also notify parent for WebcastSelector handling
        if (onWebcastSelect && videoId && url) {
            onWebcastSelect(videoId, url, 'manual');
        }
    };

    const addStream = () => {
        const backupIndex = streams.filter(s => s.dayIndex === null).length + 1;
        const newStream = {
            id: `stream-${Date.now()}`,
            url: '',
            videoId: null,
            streamStartTime: null,
            dayIndex: null,
            label: `Backup Stream ${backupIndex}`
        };
        onStreamsChange([...streams, newStream]);
    };

    const removeStream = (streamId) => {
        if (streams.length <= 1) {
            alert("You must have at least one stream input.");
            return;
        }
        onStreamsChange(streams.filter(s => s.id !== streamId));
    };

    // Group streams by day-specific vs backup
    const dayStreams = streams.filter(s => s.dayIndex !== null).sort((a, b) => a.dayIndex - b.dayIndex);
    const backupStreams = streams.filter(s => s.dayIndex === null);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Tv className="w-5 h-5 text-[#4FCEEC]" />
                    2. Livestream URLs
                </h2>
                <button
                    onClick={addStream}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Add a backup livestream"
                >
                    <Plus className="w-4 h-4" />
                    Add Stream
                </button>
            </div>

            {/* Day-specific streams */}
            {dayStreams.length > 0 && (
                <div className="space-y-3">
                    {dayStreams.map((stream) => (
                        <StreamInput
                            key={stream.id}
                            stream={stream}
                            loading={loading[stream.id]}
                            error={errors[stream.id]}
                            canRemove={streams.length > 1}
                            onUrlChange={(url) => handleUrlChange(stream.id, url)}
                            onRemove={() => removeStream(stream.id)}
                        />
                    ))}
                </div>
            )}

            {/* Backup streams */}
            {backupStreams.length > 0 && (
                <div className="space-y-3">
                    {dayStreams.length > 0 && (
                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex-1 h-px bg-gray-700"></div>
                            <span className="text-xs text-gray-500 uppercase tracking-wider">Backup Streams</span>
                            <div className="flex-1 h-px bg-gray-700"></div>
                        </div>
                    )}
                    {backupStreams.map((stream) => (
                        <StreamInput
                            key={stream.id}
                            stream={stream}
                            loading={loading[stream.id]}
                            error={errors[stream.id]}
                            canRemove={streams.length > 1}
                            onUrlChange={(url) => handleUrlChange(stream.id, url)}
                            onRemove={() => removeStream(stream.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Individual stream input component
 */
function StreamInput({ stream, loading, error, canRemove, onUrlChange, onRemove }) {
    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                        {stream.label}
                        {loading && (
                            <span className="ml-2 text-xs text-[#4FCEEC]">
                                <Loader className="inline w-3 h-3 animate-spin mr-1" />
                                Loading stream info...
                            </span>
                        )}
                        {stream.streamStartTime && !loading && (
                            <span className="ml-2 text-xs text-green-400">
                                ✓ Stream detected
                            </span>
                        )}
                        {error && !loading && (
                            <span className="ml-2 text-xs text-yellow-400">
                                ⚠ {error}
                            </span>
                        )}
                    </label>
                    <input
                        type="text"
                        value={stream.url}
                        onChange={(e) => onUrlChange(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-[#4FCEEC] focus:ring-1 focus:ring-[#4FCEEC] outline-none transition-all"
                    />
                </div>
                {canRemove && (
                    <button
                        onClick={onRemove}
                        className="p-2 mt-6 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Remove this stream"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
}

export default StreamManager;
