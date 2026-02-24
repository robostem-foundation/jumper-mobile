import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Dimensions,
    StatusBar,
    Image,
    Animated,
    PanResponder,
    ActivityIndicator,
} from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import {
    Tv,
    Star,
    ChevronDown,
    ChevronUp,
    History,
    Settings,
    GitBranch,
    RotateCcw,
    Play,
    Pause,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { extractVideoId, fetchStreamStartTime } from '../services/youtube';
import { getEventBySku } from '../services/robotevents';
import EventView from '../components/EventView';

const { width, height } = Dimensions.get('window');
const LOGO = require('../assets/images/logo.png');

const SHEET_COLLAPSED = 52;
const SHEET_DEFAULT = height * 0.50;   // just below player + controls
const SHEET_FULL = height * 0.82;   // dragged all the way up

// ── Helpers ───────────────────────────────────────────────────
function getEventDayCount(event) {
    if (!event?.start || !event?.end) return 1;
    const s = new Date(event.start.split('T')[0]);
    const e = new Date(event.end.split('T')[0]);
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function getMatchDayIndex(match, eventStartStr) {
    const matchTime = match.started || match.scheduled;
    if (!matchTime || !eventStartStr) return 0;
    const m = new Date(new Date(matchTime).toISOString().split('T')[0]);
    const s = new Date(eventStartStr.split('T')[0]);
    return Math.max(0, Math.round((m - s) / 86400000));
}

function getDayLabel(dayIndex, eventStartStr) {
    if (!eventStartStr) return `Day ${dayIndex + 1}`;
    const d = new Date(new Date(eventStartStr).getTime() + dayIndex * 86400000);
    return `Day ${dayIndex + 1} — ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ── Section Card ──────────────────────────────────────────────
function SectionCard({ children, style }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

// ── Bottom Tab Button ─────────────────────────────────────────
function TabButton({ icon, active, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]} activeOpacity={0.7}>
            {icon}
        </TouchableOpacity>
    );
}

// ── Skip Button ───────────────────────────────────────────────
function SkipBtn({ label, onPress }) {
    return (
        <TouchableOpacity style={styles.skipBtn} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.skipLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
    // ── Streams — one per day ──
    const playerRef = useRef(null);
    const pendingSeekRef = useRef(null);            // used when switching days mid-seek
    const [streams, setStreams] = useState([{ url: '', videoId: null, startTime: null }]);
    const [activeStreamDay, setActiveStreamDay] = useState(0);
    const [playing, setPlaying] = useState(false);

    const activeStream = streams[activeStreamDay] || streams[0] || {};
    const currentVideoId = activeStream.videoId;
    const currentStartTime = activeStream.startTime;

    // ── Event ──
    const [event, setEvent] = useState(null);
    const [eventLoading, setEventLoading] = useState(false);

    // ── Find Event UI ──
    const [eventUrl, setEventUrl] = useState('');
    const [findEventOpen, setFindEventOpen] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState({ label: 'Select an event...', value: '' });
    const [activeNavTab, setActiveNavTab] = useState('history');

    // ── Bottom sheet ──
    const sheetAnim = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
    const sheetValRef = useRef(SHEET_COLLAPSED);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [tabBarH, setTabBarH] = useState(58);  // measured via onLayout

    sheetAnim.addListener(({ value }) => { sheetValRef.current = value; });

    const animSheet = useCallback((toValue) => {
        Animated.spring(sheetAnim, { toValue, useNativeDriver: false, bounciness: 3 }).start();
    }, [sheetAnim]);

    const openSheet = useCallback(() => { setSheetVisible(true); animSheet(SHEET_DEFAULT); }, [animSheet]);
    const minimiseSheet = useCallback(() => animSheet(SHEET_COLLAPSED), [animSheet]);

    // ── 3-position snap on release ──
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
            onPanResponderMove: (_, g) => {
                const next = Math.max(SHEET_COLLAPSED, Math.min(SHEET_FULL, sheetValRef.current - g.dy));
                sheetAnim.setValue(next);
            },
            onPanResponderRelease: (_, g) => {
                const cur = sheetValRef.current;
                const vel = g.vy;
                if (vel > 0.8) {
                    animSheet(SHEET_COLLAPSED);
                } else if (vel < -0.8) {
                    // Fast upward: step up one stage at a time
                    if (cur < SHEET_DEFAULT) animSheet(SHEET_DEFAULT);
                    else animSheet(SHEET_FULL);
                } else {
                    // Snap to nearest stage
                    const dC = Math.abs(cur - SHEET_COLLAPSED);
                    const dD = Math.abs(cur - SHEET_DEFAULT);
                    const dF = Math.abs(cur - SHEET_FULL);
                    if (dC <= dD && dC <= dF) animSheet(SHEET_COLLAPSED);
                    else if (dD <= dF) animSheet(SHEET_DEFAULT);
                    else animSheet(SHEET_FULL);
                }
            },
        })
    ).current;

    // ── Load event ──
    const loadEvent = useCallback(async (sku) => {
        if (!sku) return;
        setEventLoading(true);
        try {
            const ev = await getEventBySku(sku);
            setEvent(ev);
            const numDays = getEventDayCount(ev);
            setStreams(current => {
                const next = [...current];
                while (next.length < numDays) next.push({ url: '', videoId: null, startTime: null });
                return next.slice(0, numDays);
            });
            setFindEventOpen(false);
            openSheet();
        } catch (e) { console.error('Event not found:', e.message); }
        finally { setEventLoading(false); }
    }, [openSheet]);

    // ── Update a single day's stream URL ──
    const handleStreamUrl = (dayIndex, url) => {
        const id = extractVideoId(url);
        setStreams(prev => {
            const next = [...prev];
            next[dayIndex] = { ...next[dayIndex], url, videoId: id, startTime: null };
            return next;
        });
        if (id) {
            fetchStreamStartTime(id).then(t => {
                if (t) setStreams(prev => {
                    const next = [...prev];
                    next[dayIndex] = { ...next[dayIndex], startTime: t };
                    return next;
                });
            });
        }
        const skuMatch = url.match(/(RE-[A-Z0-9]+-\d{2}-\d{4})/);
        if (skuMatch) loadEvent(skuMatch[1]);
    };

    // ── Search by URL ──
    const handleSearchByUrl = () => {
        if (!eventUrl.trim()) return;
        const m = eventUrl.match(/(RE-[A-Z0-9]+-\d{2}-\d{4})/);
        if (m) loadEvent(m[1]);
    };

    const FEATURED_EVENTS = [
        { label: 'Select an event...', value: '' },
        { label: 'VEX Worlds 2025 – Dallas', value: 'RE-VRC-25-3690' },
        { label: 'VEX State Championship – CA', value: 'RE-VRC-25-1122' },
        { label: 'VEX Regionals – PNW', value: 'RE-VRC-25-0985' },
    ];

    // ── Seek in current player ──
    const handleSeek = useCallback(async (delta) => {
        if (!playerRef.current) return;
        const cur = await playerRef.current.getCurrentTime();
        playerRef.current.seekTo(Math.max(0, cur + delta), true);
    }, []);

    // ── Watch a match: switch day stream if needed, then seek ──
    const handleWatch = useCallback((match) => {
        const dayIdx = getMatchDayIndex(match, event?.start);
        const stream = streams[dayIdx] || streams[0];
        if (!stream?.videoId) return;

        const time = match.started || match.scheduled;
        const startSec = (stream.startTime && time)
            ? Math.max(0, (new Date(time).getTime() - stream.startTime) / 1000)
            : null;

        if (dayIdx !== activeStreamDay) {
            // Switching to a different day's stream — pendingSeek fires on 'playing'
            pendingSeekRef.current = startSec;
            setActiveStreamDay(dayIdx);
            setPlaying(true);  // prop still needed to trigger initial load with play
        } else {
            playerRef.current?.playVideo();  // direct injectJavaScript
            setPlaying(true);
            if (startSec !== null) {
                setTimeout(() => { playerRef.current?.seekTo(startSec, true); }, 400);
            }
        }
        minimiseSheet();
    }, [streams, event, activeStreamDay, minimiseSheet]);

    // ─────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

            {/* ── Header ── */}
            <View style={styles.header}>
                <Image source={LOGO} style={{ width: width - 32, height: 44 }} resizeMode="contain" />
            </View>

            {/* ── Main Scroll ── */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                {/* ── Player ── */}
                <SectionCard style={styles.playerCard}>
                    {currentVideoId ? (
                        <YoutubeIframe
                            key={currentVideoId}
                            ref={playerRef}
                            height={200}
                            videoId={currentVideoId}
                            play={playing}
                            onChangeState={(state) => {
                                if (state === 'ended') setPlaying(false);
                                // Only act on 'playing' if there's a pending seek (from day switch)
                                if (state === 'playing' && pendingSeekRef.current !== null) {
                                    const sec = pendingSeekRef.current;
                                    pendingSeekRef.current = null;
                                    setTimeout(() => { playerRef.current?.seekTo(sec, true); }, 400);
                                }
                            }}
                            initialPlayerParams={{ rel: 0, modestbranding: 1 }}
                        />
                    ) : (
                        <View style={styles.playerPlaceholder}>
                            <Tv color={Colors.textDim} size={34} strokeWidth={1.2} />
                            <Text style={styles.playerPlaceholderText}>Enter a livestream URL below</Text>
                        </View>
                    )}
                </SectionCard>

                {/* ── Player Controls (only when stream loaded) ── */}
                {currentVideoId && (
                    <View style={styles.controlsRow}>
                        <SkipBtn label="−1m" onPress={() => handleSeek(-60)} />
                        <SkipBtn label="−30s" onPress={() => handleSeek(-30)} />
                        <SkipBtn label="−10s" onPress={() => handleSeek(-10)} />
                        <SkipBtn label="−5s" onPress={() => handleSeek(-5)} />
                        <TouchableOpacity
                            style={styles.playPauseBtn}
                            onPress={() => {
                                if (playing) {
                                    // Use patched injectJavaScript path if available, else fall back to prop
                                    if (typeof playerRef.current?.pauseVideo === 'function') {
                                        playerRef.current.pauseVideo();
                                    }
                                    setPlaying(false);
                                } else {
                                    if (typeof playerRef.current?.playVideo === 'function') {
                                        playerRef.current.playVideo();
                                    }
                                    setPlaying(true);
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            {playing
                                ? <Pause size={15} color="#0d1117" fill="#0d1117" />
                                : <Play size={15} color="#0d1117" fill="#0d1117" />}
                        </TouchableOpacity>
                        <SkipBtn label="+5s" onPress={() => handleSeek(5)} />
                        <SkipBtn label="+10s" onPress={() => handleSeek(10)} />
                        <SkipBtn label="+30s" onPress={() => handleSeek(30)} />
                        <SkipBtn label="+1m" onPress={() => handleSeek(60)} />
                    </View>
                )}

                {/* ── Livestream URLs — one input per day ── */}
                <SectionCard>
                    <View style={styles.cardHeaderLeft}>
                        <Tv color={Colors.textMuted} size={14} />
                        <Text style={styles.cardTitle}>Livestream URLs</Text>
                    </View>
                    {streams.map((stream, i) => {
                        const multiDay = streams.length > 1;
                        const dayDate = event?.start
                            ? new Date(new Date(event.start).getTime() + i * 86400000)
                                .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : null;
                        const label = multiDay
                            ? `Day ${i + 1}${dayDate ? ` — ${dayDate}` : ''}`
                            : 'Livestream URL';
                        return (
                            <View key={i}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Text style={styles.inputLabel}>{label}</Text>
                                    {stream.startTime && (
                                        <Text style={styles.calibratedText}>✓ calibrated</Text>
                                    )}
                                </View>
                                <TextInput
                                    value={stream.url}
                                    onChangeText={(url) => handleStreamUrl(i, url)}
                                    placeholder="https://youtube.com/..."
                                    placeholderTextColor={Colors.textDim}
                                    style={styles.input}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        );
                    })}
                </SectionCard>

                {/* ── Find Event ── */}
                <SectionCard>
                    <TouchableOpacity style={styles.cardHeader} onPress={() => setFindEventOpen(o => !o)} activeOpacity={0.7}>
                        <View style={styles.cardHeaderLeft}>
                            <View style={styles.iconBox}><Text style={styles.iconBoxText}>⊞</Text></View>
                            <Text style={styles.cardTitle}>FIND EVENT</Text>
                        </View>
                        {findEventOpen ? <ChevronUp color={Colors.textMuted} size={17} /> : <ChevronDown color={Colors.textMuted} size={17} />}
                    </TouchableOpacity>

                    {findEventOpen && (
                        <>
                            <Text style={styles.sectionLabel}>FEATURED EVENTS</Text>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setDropdownOpen(o => !o)} activeOpacity={0.8}>
                                <Text style={styles.dropdownText}>{selectedEvent.label}</Text>
                                <ChevronDown color={Colors.textMuted} size={15} />
                            </TouchableOpacity>
                            {dropdownOpen && (
                                <View style={styles.dropdownMenu}>
                                    {FEATURED_EVENTS.map(ev => (
                                        <TouchableOpacity key={ev.value} style={styles.dropdownItem} onPress={() => { setSelectedEvent(ev); setDropdownOpen(false); if (ev.value) loadEvent(ev.value); }}>
                                            <Text style={[styles.dropdownText, ev.value === selectedEvent.value && { color: Colors.accentCyan }]}>{ev.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>SEARCH BY URL</Text>
                            <View style={styles.searchRow}>
                                <TextInput
                                    value={eventUrl} onChangeText={setEventUrl}
                                    placeholder="Paste RobotEvents URL..."
                                    placeholderTextColor={Colors.textDim}
                                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                    autoCapitalize="none" autoCorrect={false}
                                    returnKeyType="search" onSubmitEditing={handleSearchByUrl}
                                />
                                <TouchableOpacity style={styles.searchButton} onPress={handleSearchByUrl} activeOpacity={0.8}>
                                    {eventLoading
                                        ? <ActivityIndicator color="#0d1117" size="small" />
                                        : <Text style={styles.searchButtonText}>Search</Text>}
                                </TouchableOpacity>
                            </View>

                            {/* Search by Team — commented out */}
                            {/* <Text style={[styles.sectionLabel, { marginTop: 4 }]}>SEARCH BY TEAM</Text> ... */}
                        </>
                    )}

                    {event && (
                        <TouchableOpacity style={styles.eventLoaded} onPress={openSheet} activeOpacity={0.8}>
                            <Star size={12} color={Colors.accentCyan} fill={Colors.accentCyan} />
                            <Text style={styles.eventLoadedText} numberOfLines={1}>{event.name}</Text>
                            <ChevronUp size={13} color={Colors.accentCyan} />
                        </TouchableOpacity>
                    )}
                </SectionCard>

                <View style={{ height: sheetVisible ? SHEET_COLLAPSED + tabBarH + 12 : 16 }} />
            </ScrollView>

            {/* ── Bottom Tab Bar — rendered AFTER sheet so it sits above ── */}
            <View
                style={styles.bottomTabBar}
                onLayout={(e) => setTabBarH(e.nativeEvent.layout.height)}
            >
                <TabButton icon={<History color={activeNavTab === 'history' ? Colors.accentCyan : Colors.textMuted} size={20} />} active={activeNavTab === 'history'} onPress={() => setActiveNavTab('history')} />
                <TabButton icon={<Settings color={activeNavTab === 'settings' ? Colors.accentCyan : Colors.textMuted} size={20} />} active={activeNavTab === 'settings'} onPress={() => setActiveNavTab('settings')} />
                <TabButton icon={<GitBranch color={activeNavTab === 'github' ? Colors.accentCyan : Colors.textMuted} size={20} />} active={activeNavTab === 'github'} onPress={() => setActiveNavTab('github')} />
                <TabButton icon={<RotateCcw color={activeNavTab === 'undo' ? Colors.accentRed : Colors.textMuted} size={20} />} active={activeNavTab === 'undo'} onPress={() => setActiveNavTab('undo')} />
            </View>

            {/* ── Event Bottom Sheet ── */}
            {sheetVisible && (
                <Animated.View style={[styles.bottomSheet, { height: sheetAnim, bottom: tabBarH }]}>
                    <View {...panResponder.panHandlers} style={styles.sheetHandle}>
                        <View style={styles.sheetHandleBar} />
                        <View style={styles.sheetEventRow}>
                            <Star size={11} color={Colors.accentCyan} fill={Colors.accentCyan} />
                            <Text style={styles.sheetEventName} numberOfLines={1}>{event?.name || 'Event'}</Text>
                            <TouchableOpacity onPress={minimiseSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <ChevronDown color={Colors.textMuted} size={15} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <EventView event={event} onWatch={handleWatch} />
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },

    header: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.headerBg, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, alignItems: 'center' },

    scrollContent: { paddingHorizontal: 12, paddingTop: 10, gap: 9 },

    card: { backgroundColor: Colors.cardBg, borderRadius: 13, borderWidth: 1, borderColor: Colors.cardBorder, padding: 13, gap: 9 },

    // Player
    playerCard: { padding: 0, overflow: 'hidden' },
    playerPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 32 },
    playerPlaceholderText: { color: Colors.textMuted, fontSize: 12 },

    // Controls — slim inline bar
    controlsRow: {
        backgroundColor: Colors.cardBg,
        borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 6, paddingVertical: 7,
    },
    skipBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 3 },
    skipLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
    playPauseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accentCyan, alignItems: 'center', justifyContent: 'center', marginHorizontal: 1 },

    // Card header
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    cardTitle: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
    iconBox: { width: 20, height: 20, backgroundColor: Colors.iconBg, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    iconBoxText: { color: Colors.textMuted, fontSize: 10 },

    // Inputs
    inputLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },
    calibratedText: { color: Colors.accentCyan, fontSize: 10 },
    input: {
        backgroundColor: Colors.inputBg, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder,
        color: Colors.textPrimary, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, marginBottom: 2,
    },

    sectionLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

    // Dropdown
    dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.inputBg, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, paddingVertical: 10 },
    dropdownText: { color: Colors.textPrimary, fontSize: 12, flex: 1 },
    dropdownMenu: { backgroundColor: Colors.cardBgAlt, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
    dropdownItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },

    // Search
    searchRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
    searchButton: { backgroundColor: Colors.accentCyan, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center' },
    searchButtonText: { color: '#0d1117', fontWeight: '700', fontSize: 12 },

    // Event badge
    eventLoaded: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,211,238,0.07)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(34,211,238,0.18)', paddingHorizontal: 11, paddingVertical: 8 },
    eventLoadedText: { flex: 1, color: Colors.accentCyan, fontSize: 12, fontWeight: '600' },

    // Bottom nav
    bottomTabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.tabBarBg,
        borderTopWidth: 1, borderTopColor: Colors.cardBorder,
        paddingBottom: 6, paddingTop: 4,
        zIndex: 20,
    },
    tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 7, marginHorizontal: 3 },
    tabButtonActive: { backgroundColor: 'rgba(34,211,238,0.08)' },

    // Bottom sheet
    bottomSheet: {
        position: 'absolute',
        left: 0, right: 0,
        backgroundColor: Colors.cardBg,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        borderWidth: 1, borderColor: Colors.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.5, shadowRadius: 12,
        elevation: 12, zIndex: 10,
        overflow: 'hidden',
    },
    sheetHandle: { paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, alignItems: 'center', paddingTop: 9, gap: 7 },
    sheetHandleBar: { width: 32, height: 3, backgroundColor: Colors.textDim, borderRadius: 2 },
    sheetEventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, width: '100%' },
    sheetEventName: { flex: 1, color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
});
