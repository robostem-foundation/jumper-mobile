import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    StyleSheet,
    StatusBar,
    Platform,
    ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ChevronLeft,
    Play,
    Trophy,
    Users,
    Medal,
    Globe,
    Search,
    LayoutList,
} from 'lucide-react-native';
import {
    getEventBySku,
    getMatchesForEvent,
    getMatchesForEventAndTeam,
    getTeamsForEvent,
    getTeamByNumber,
    getRankingsForEvent,
    getSkillsForEvent,
} from '../services/robotevents';
import { Colors } from '../constants/colors';

// ─── YouTube video ID extractor ────────────────────────────────
function extractVideoId(url) {
    if (!url) return null;
    const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watch) return watch[1];
    const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (short) return short[1];
    const live = url.match(/\/live\/([a-zA-Z0-9_-]{11})/);
    if (live) return live[1];
    return null;
}

// ─── Tab Bar ──────────────────────────────────────────────────
const TABS = [
    { key: 'search', label: 'Find Team', Icon: Search },
    { key: 'list', label: 'Team List', Icon: Users },
    { key: 'matches', label: 'Matches', Icon: LayoutList },
];

// ─── Match Card ───────────────────────────────────────────────
function MatchCard({ item, onPress }) {
    const redAlliance = item.alliances?.find(a => a.color === 'red');
    const blueAlliance = item.alliances?.find(a => a.color === 'blue');
    const redScore = redAlliance?.score ?? '—';
    const blueScore = blueAlliance?.score ?? '—';
    const redWins = typeof redScore === 'number' && typeof blueScore === 'number' && redScore > blueScore;
    const blueWins = typeof redScore === 'number' && typeof blueScore === 'number' && blueScore > redScore;

    const redTeams = redAlliance?.teams?.map(t => t.team?.name).filter(Boolean) || [];
    const blueTeams = blueAlliance?.teams?.map(t => t.team?.name).filter(Boolean) || [];

    return (
        <TouchableOpacity style={styles.matchCard} onPress={onPress} activeOpacity={0.75}>
            <View style={styles.matchHeader}>
                <Text style={styles.matchName}>{item.name}</Text>
                <View style={styles.playBadge}>
                    <Play size={11} color={Colors.accentCyan} fill={Colors.accentCyan} />
                    <Text style={styles.playBadgeText}>Watch</Text>
                </View>
            </View>
            <View style={styles.scoreBar}>
                <View style={[styles.scoreHalf, styles.redHalf, redWins && styles.winnerHL]}>
                    <Text style={styles.teamNames} numberOfLines={1}>{redTeams.join('  ') || '—'}</Text>
                    <Text style={styles.scoreNum}>{redScore}</Text>
                </View>
                <View style={styles.vsDivider}><Text style={styles.vsText}>VS</Text></View>
                <View style={[styles.scoreHalf, styles.blueHalf, blueWins && styles.winnerHL]}>
                    <Text style={styles.scoreNum}>{blueScore}</Text>
                    <Text style={[styles.teamNames, { textAlign: 'right' }]} numberOfLines={1}>{blueTeams.join('  ') || '—'}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ─── Team Row ─────────────────────────────────────────────────
function TeamRow({ team, ranking, skillScore, onPress }) {
    return (
        <TouchableOpacity style={styles.teamRow} onPress={onPress} activeOpacity={0.75}>
            <View style={styles.teamRowLeft}>
                <View style={styles.teamRowTop}>
                    <Text style={styles.teamNumber}>{team.number}</Text>
                    <Text style={styles.teamName} numberOfLines={1}>{team.team_name || ''}</Text>
                </View>
                <View style={styles.teamRowStats}>
                    {ranking && (
                        <View style={styles.statChip}>
                            <Trophy size={10} color={Colors.textMuted} />
                            <Text style={styles.statText}>#{ranking.rank}</Text>
                        </View>
                    )}
                    {skillScore !== undefined && skillScore > 0 && (
                        <View style={styles.statChip}>
                            <Medal size={10} color={Colors.textMuted} />
                            <Text style={styles.statText}>{skillScore}</Text>
                        </View>
                    )}
                </View>
            </View>
            <Search size={14} color={Colors.textDim} />
        </TouchableOpacity>
    );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function MatchesScreen() {
    const { sku, liveUrl } = useLocalSearchParams();
    const router = useRouter();
    const videoId = extractVideoId(decodeURIComponent(liveUrl || ''));

    const [event, setEvent] = useState(null);
    const [activeTab, setActiveTab] = useState('list');

    // Team List state
    const [teams, setTeams] = useState([]);
    const [rankingsMap, setRankingsMap] = useState({});
    const [skillsMap, setSkillsMap] = useState({});
    const [teamSearch, setTeamSearch] = useState('');
    const [sortMode, setSortMode] = useState('default'); // default | rank | skills
    const [listLoading, setListLoading] = useState(false);

    // Find Team tab state
    const [teamQuery, setTeamQuery] = useState('');
    const [searchedTeam, setSearchedTeam] = useState(null);
    const [teamMatches, setTeamMatches] = useState([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState(null);

    // Matches tab state
    const [allMatches, setAllMatches] = useState([]);
    const [matchesLoading, setMatchesLoading] = useState(false);

    const [error, setError] = useState(null);

    // ── Load event on mount ──
    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const ev = await getEventBySku(sku);
                setEvent(ev);
            } catch (e) {
                setError(e.message);
            }
        };
        if (sku) fetchEvent();
    }, [sku]);

    // ── Load Team List data when tab switches ──
    useEffect(() => {
        if (activeTab !== 'list' || !event || teams.length > 0) return;
        const load = async () => {
            setListLoading(true);
            try {
                const [teamsData, rankingsData, skillsData] = await Promise.all([
                    getTeamsForEvent(event.id),
                    getRankingsForEvent(event.id, event.divisions),
                    getSkillsForEvent(event.id),
                ]);
                setTeams(teamsData);

                const rMap = {};
                rankingsData.forEach(r => {
                    if (r.team) rMap[r.team.id] = r;
                });
                setRankingsMap(rMap);

                // Aggregate skills: driver + programming = combined
                const teamSkills = {};
                skillsData.forEach(s => {
                    if (!s.team) return;
                    if (!teamSkills[s.team.id]) teamSkills[s.team.id] = { driver: 0, programming: 0 };
                    if (s.type === 'driver') teamSkills[s.team.id].driver = Math.max(teamSkills[s.team.id].driver, s.score);
                    if (s.type === 'programming') teamSkills[s.team.id].programming = Math.max(teamSkills[s.team.id].programming, s.score);
                });
                const sMap = {};
                Object.keys(teamSkills).forEach(id => {
                    sMap[id] = { score: teamSkills[id].driver + teamSkills[id].programming };
                });
                setSkillsMap(sMap);
            } catch (e) {
                console.error(e);
            } finally {
                setListLoading(false);
            }
        };
        load();
    }, [activeTab, event]);

    // ── Load All Matches when tab switches ──
    useEffect(() => {
        if (activeTab !== 'matches' || !event || allMatches.length > 0) return;
        const load = async () => {
            setMatchesLoading(true);
            try {
                const m = await getMatchesForEvent(event);
                setAllMatches(m);
            } catch (e) {
                setError(e.message);
            } finally {
                setMatchesLoading(false);
            }
        };
        load();
    }, [activeTab, event]);

    // ── Sorted / filtered team list ──
    const sortedTeams = useCallback(() => {
        let list = [...teams];
        if (teamSearch) {
            const q = teamSearch.toLowerCase();
            list = list.filter(t =>
                t.number?.toLowerCase().includes(q) ||
                t.team_name?.toLowerCase().includes(q)
            );
        }
        switch (sortMode) {
            case 'rank':
                return list.sort((a, b) => (rankingsMap[a.id]?.rank || 9999) - (rankingsMap[b.id]?.rank || 9999));
            case 'skills':
                return list.sort((a, b) => (skillsMap[b.id]?.score || 0) - (skillsMap[a.id]?.score || 0));
            default:
                return list.sort((a, b) => a.number?.localeCompare(b.number, undefined, { numeric: true }));
        }
    }, [teams, teamSearch, sortMode, rankingsMap, skillsMap]);

    // ── Find Team search ──
    const handleTeamSearch = async () => {
        if (!teamQuery.trim() || !event) return;
        setTeamLoading(true);
        setTeamError(null);
        setSearchedTeam(null);
        setTeamMatches([]);
        try {
            const teamData = await getTeamByNumber(teamQuery.trim());
            setSearchedTeam(teamData);
            const matches = await getMatchesForEventAndTeam(event.id, teamData.id);
            setTeamMatches(matches);
        } catch (e) {
            setTeamError(e.message);
        } finally {
            setTeamLoading(false);
        }
    };

    const handleTeamSelect = (number) => {
        setActiveTab('search');
        setTeamQuery(number);
        setTimeout(() => handleTeamSearch(), 50);
    };

    // ── Render tab content ──
    const renderFindTeam = () => (
        <View style={styles.tabContent}>
            <View style={styles.searchRow}>
                <TextInput
                    value={teamQuery}
                    onChangeText={setTeamQuery}
                    placeholder="Team number (e.g. 10B)"
                    placeholderTextColor={Colors.textDim}
                    style={styles.searchInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={handleTeamSearch}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleTeamSearch} activeOpacity={0.8}>
                    <Search size={18} color="#0d1117" />
                </TouchableOpacity>
            </View>

            {teamLoading && (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.accentCyan} />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            )}

            {teamError && (
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{teamError}</Text>
                </View>
            )}

            {searchedTeam && !teamLoading && (
                <View style={{ flex: 1 }}>
                    <View style={styles.teamFoundCard}>
                        <Text style={styles.teamFoundNumber}>{searchedTeam.number}</Text>
                        <Text style={styles.teamFoundName}>{searchedTeam.team_name || ''}</Text>
                        {searchedTeam.organization && (
                            <Text style={styles.teamFoundOrg}>{searchedTeam.organization}</Text>
                        )}
                    </View>

                    {teamMatches.length === 0 ? (
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No matches found for this team.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={teamMatches}
                            keyExtractor={item => item.id.toString()}
                            contentContainerStyle={{ padding: 12, gap: 10 }}
                            renderItem={({ item }) => (
                                <MatchCard
                                    item={item}
                                    onPress={() => router.push(
                                        `/player?sku=${sku}&matchId=${item.id}` +
                                        (videoId ? `&videoId=${videoId}` : '') +
                                        (item.started ? `&matchStarted=${encodeURIComponent(item.started)}` : '')
                                    )}
                                />
                            )}
                        />
                    )}
                </View>
            )}

            {!searchedTeam && !teamLoading && !teamError && (
                <View style={styles.centered}>
                    <Users size={40} color={Colors.textDim} strokeWidth={1.2} />
                    <Text style={styles.emptyText}>Search for a team to see their matches</Text>
                </View>
            )}
        </View>
    );

    const renderTeamList = () => {
        const sorted = sortedTeams();
        return (
            <View style={styles.tabContent}>
                {/* Search bar */}
                <View style={styles.teamSearchBar}>
                    <Search size={14} color={Colors.textMuted} />
                    <TextInput
                        value={teamSearch}
                        onChangeText={setTeamSearch}
                        placeholder="Search teams..."
                        placeholderTextColor={Colors.textDim}
                        style={styles.teamSearchInput}
                        autoCapitalize="none"
                    />
                </View>

                {/* Sort filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortBar} contentContainerStyle={styles.sortBarContent}>
                    {[
                        { key: 'default', label: 'Default', Icon: Users },
                        { key: 'rank', label: 'Rank', Icon: Trophy },
                        { key: 'skills', label: 'Skills', Icon: Medal },
                    ].map(({ key, label, Icon }) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.sortChip, sortMode === key && styles.sortChipActive]}
                            onPress={() => setSortMode(key)}
                            activeOpacity={0.7}
                        >
                            <Icon size={12} color={sortMode === key ? '#0d1117' : Colors.textMuted} />
                            <Text style={[styles.sortChipText, sortMode === key && styles.sortChipTextActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {listLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color={Colors.accentCyan} />
                        <Text style={styles.loadingText}>Loading teams...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={sorted}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ padding: 8, gap: 6 }}
                        renderItem={({ item }) => (
                            <TeamRow
                                team={item}
                                ranking={rankingsMap[item.id]}
                                skillScore={skillsMap[item.id]?.score}
                                onPress={() => handleTeamSelect(item.number)}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={styles.centered}>
                                <Text style={styles.emptyText}>No teams found.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        );
    };

    const renderMatches = () => (
        <View style={styles.tabContent}>
            {matchesLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.accentCyan} />
                    <Text style={styles.loadingText}>Loading matches...</Text>
                </View>
            ) : (
                <FlatList
                    data={allMatches}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 12, gap: 10 }}
                    renderItem={({ item }) => (
                        <MatchCard
                            item={item}
                            onPress={() => router.push(
                                `/player?sku=${sku}&matchId=${item.id}` +
                                (videoId ? `&videoId=${videoId}` : '') +
                                (item.started ? `&matchStarted=${encodeURIComponent(item.started)}` : '')
                            )}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No matches found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.backBtn2} onPress={() => router.back()}>
                        <Text style={styles.backBtn2Text}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
                    <ChevronLeft color={Colors.textMuted} size={22} />
                </TouchableOpacity>
                <View style={styles.headerMid}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {event ? event.name : 'Loading...'}
                    </Text>
                    <Text style={styles.headerSku}>{sku}</Text>
                </View>
                <Trophy size={18} color={Colors.accentCyan} />
            </View>

            {/* ── 3 Tabs ── */}
            <View style={styles.tabBar}>
                {TABS.map(({ key, label }) => (
                    <TouchableOpacity
                        key={key}
                        style={[styles.tabItem, activeTab === key && styles.tabItemActive]}
                        onPress={() => setActiveTab(key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.tabLabel, activeTab === key && styles.tabLabelActive]}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Tab Content ── */}
            {!event ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.accentCyan} size="large" />
                    <Text style={styles.loadingText}>Loading event...</Text>
                </View>
            ) : (
                activeTab === 'search' ? renderFindTeam()
                    : activeTab === 'list' ? renderTeamList()
                        : renderMatches()
            )}
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.cardBorder,
        backgroundColor: Colors.cardBg,
        gap: 8,
    },
    backIcon: { padding: 4 },
    headerMid: { flex: 1 },
    headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    headerSku: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

    // Tab Bar
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.cardBorder,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 13,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: Colors.accentCyan,
    },
    tabLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    tabLabelActive: { color: Colors.accentCyan },

    // Tab content wrapper
    tabContent: { flex: 1 },

    // Search row (Find Team)
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        padding: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: Colors.inputBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        color: Colors.textPrimary,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 14,
    },
    searchBtn: {
        backgroundColor: Colors.accentCyan,
        borderRadius: 10,
        width: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Team found card
    teamFoundCard: {
        marginHorizontal: 12,
        marginBottom: 8,
        backgroundColor: Colors.cardBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.cardBorderBlue,
        padding: 14,
    },
    teamFoundNumber: { fontSize: 20, fontWeight: '900', color: Colors.accentCyan },
    teamFoundName: { fontSize: 14, color: Colors.textPrimary, marginTop: 2, fontWeight: '600' },
    teamFoundOrg: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

    // Team List search bar
    teamSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        margin: 10,
        backgroundColor: Colors.inputBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    teamSearchInput: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: 13,
    },

    // Sort chips
    sortBar: { flexGrow: 0 },
    sortBarContent: {
        paddingHorizontal: 10,
        paddingBottom: 10,
        gap: 8,
        flexDirection: 'row',
    },
    sortChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: Colors.iconBg,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
    },
    sortChipActive: {
        backgroundColor: Colors.accentCyan,
        borderColor: Colors.accentCyan,
    },
    sortChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
    sortChipTextActive: { color: '#0d1117' },

    // Team row
    teamRow: {
        backgroundColor: Colors.cardBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    teamRowLeft: { flex: 1, gap: 4 },
    teamRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    teamNumber: { fontSize: 15, fontWeight: '800', color: Colors.accentCyan },
    teamName: { fontSize: 12, color: Colors.textMuted, flex: 1 },
    teamRowStats: { flexDirection: 'row', gap: 10 },
    statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 11, color: Colors.textMuted },

    // Match card
    matchCard: {
        backgroundColor: Colors.cardBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        padding: 12,
        gap: 10,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    matchName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    playBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(34,211,238,0.1)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(34,211,238,0.2)',
    },
    playBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.accentCyan },
    scoreBar: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', height: 50, gap: 2 },
    scoreHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, opacity: 0.8 },
    redHalf: { backgroundColor: '#7f1d1d', borderRadius: 8 },
    blueHalf: { backgroundColor: '#1e3a5f', borderRadius: 8 },
    winnerHL: { opacity: 1 },
    vsDivider: { width: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBgAlt },
    vsText: { fontSize: 9, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
    scoreNum: { fontSize: 20, fontWeight: '900', color: '#fff' },
    teamNames: { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600', flex: 1 },

    // States
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    loadingText: { color: Colors.textMuted, fontSize: 13, marginTop: 6 },
    errorText: { color: Colors.accentRed, fontSize: 14, textAlign: 'center' },
    emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
    backBtn2: { backgroundColor: Colors.accentRed, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    backBtn2Text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
