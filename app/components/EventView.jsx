/**
 * EventView.jsx
 * The 3-tab event panel (Find Team | Team List | Matches).
 * Rendered inside the home screen's bottom sheet — not a separate screen.
 * `onWatch(match)` is called instead of navigating away.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { Search, Trophy, Medal, Users, LayoutList, Play } from 'lucide-react-native';
import {
    getMatchesForEvent,
    getMatchesForEventAndTeam,
    getTeamsForEvent,
    getTeamByNumber,
    getRankingsForEvent,
    getSkillsForEvent,
} from '../services/robotevents';
import { Colors } from '../constants/colors';

const TABS = [
    { key: 'search', label: 'Find Team' },
    { key: 'list', label: 'Team List' },
    { key: 'matches', label: 'Matches' },
];

// ─── Group matches by actual event day ───────────────────────────
function groupMatchesByEventDay(matches, event) {
    // Determine number of event days
    let numDays = 1;
    if (event?.start && event?.end) {
        const s = new Date(event.start.split('T')[0]);
        const e = new Date(event.end.split('T')[0]);
        numDays = Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
    if (numDays <= 1) return matches; // single day — no headers

    const eventStart = new Date(event.start.split('T')[0]);
    const groups = new Map();

    matches.forEach(m => {
        const timeStr = m.started || m.scheduled;
        if (!timeStr) {
            if (!groups.has(-1)) groups.set(-1, []);
            groups.get(-1).push(m);
            return;
        }
        // Compare UTC date parts to avoid timezone issues
        const matchDay = new Date(timeStr.split('T')[0]);
        const dayIdx = Math.max(0, Math.round((matchDay - eventStart) / 86400000));
        if (!groups.has(dayIdx)) groups.set(dayIdx, []);
        groups.get(dayIdx).push(m);
    });

    // Flatten with day-header dividers
    const flat = [];
    const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
    sortedKeys.forEach(dayIdx => {
        let label;
        if (dayIdx < 0) {
            label = 'Unscheduled';
        } else {
            const d = new Date(eventStart.getTime() + dayIdx * 86400000);
            label = `Day ${dayIdx + 1} — ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        flat.push({ type: 'header', label, id: `hdr-${dayIdx}` });
        groups.get(dayIdx).forEach(m => flat.push({ type: 'match', ...m }));
    });
    return flat;
}

// ─── Match Card ───────────────────────────────────────────────
function MatchCard({ item, onPress, highlightTeam }) {
    const red = item.alliances?.find(a => a.color === 'red');
    const blue = item.alliances?.find(a => a.color === 'blue');
    const rs = red?.score ?? '—';
    const bs = blue?.score ?? '—';
    const matchComplete = typeof rs === 'number' && typeof bs === 'number';
    const redWins = matchComplete && rs > bs;
    const blueWins = matchComplete && bs > rs;
    const redTeams = red?.teams?.map(t => t.team?.name).filter(Boolean) || [];
    const blueTeams = blue?.teams?.map(t => t.team?.name).filter(Boolean) || [];

    const renderAllianceTeams = (teams) => {
        if (!teams.length) return '—';
        return teams.map((t, i) => {
            const isTarget = highlightTeam && t === highlightTeam;
            return (
                <Text key={i} style={[s.teamTxtBase, isTarget && s.teamTxtHighlight]}>
                    {t}{i < teams.length - 1 ? '  ' : ''}
                </Text>
            );
        });
    };

    return (
        <TouchableOpacity style={s.matchCard} onPress={onPress} activeOpacity={0.75}>
            <View style={s.matchHeader}>
                <Text style={s.matchName}>{item.name}</Text>
                <View style={s.watchBadge}>
                    <Play size={11} color={Colors.accentCyan} fill={Colors.accentCyan} />
                    <Text style={s.watchText}>Watch</Text>
                </View>
            </View>
            <View style={s.scoreBar}>
                {/* Red alliance — solid if winner, outline if loser */}
                <View style={[s.half, matchComplete && !redWins ? s.redOutline : s.redSolid]}>
                    <Text style={s.teamTxtContainer} numberOfLines={1}>{renderAllianceTeams(redTeams)}</Text>
                    <Text style={s.scoreNum}>{rs}</Text>
                </View>
                <View style={s.vsDivider}><Text style={s.vsText}>VS</Text></View>
                {/* Blue alliance */}
                <View style={[s.half, matchComplete && !blueWins ? s.blueOutline : s.blueSolid]}>
                    <Text style={s.scoreNum}>{bs}</Text>
                    <Text style={[s.teamTxtContainer, { textAlign: 'right' }]} numberOfLines={1}>{renderAllianceTeams(blueTeams)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ─── Team Row ─────────────────────────────────────────────────
function TeamRow({ team, ranking, skillScore, onPress }) {
    return (
        <TouchableOpacity style={s.teamRow} onPress={onPress} activeOpacity={0.75}>
            <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.teamNum}>{team.number}</Text>
                    <Text style={s.teamName} numberOfLines={1}>{team.team_name || ''}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {ranking && (
                        <View style={s.chip}>
                            <Trophy size={10} color={Colors.textMuted} />
                            <Text style={s.chipTxt}>#{ranking.rank}</Text>
                        </View>
                    )}
                    {skillScore > 0 && (
                        <View style={s.chip}>
                            <Medal size={10} color={Colors.textMuted} />
                            <Text style={s.chipTxt}>{skillScore}</Text>
                        </View>
                    )}
                </View>
            </View>
            <Search size={13} color={Colors.textDim} />
        </TouchableOpacity>
    );
}

// ─── Main Component ───────────────────────────────────────────
export default function EventView({ event, onWatch }) {
    const [activeTab, setActiveTab] = useState('list');

    // Team List
    const [teams, setTeams] = useState([]);
    const [rankingsMap, setRankingsMap] = useState({});
    const [skillsMap, setSkillsMap] = useState({});
    const [teamSearch, setTeamSearch] = useState('');
    const [sortMode, setSortMode] = useState('default');
    const [listLoading, setListLoading] = useState(false);

    // Find Team
    const [teamQuery, setTeamQuery] = useState('');
    const [foundTeam, setFoundTeam] = useState(null);
    const [teamMatches, setTeamMatches] = useState([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState(null);

    // All Matches
    const [allMatches, setAllMatches] = useState([]);
    const [matchSearch, setMatchSearch] = useState('');
    const [matchesLoading, setMatchesLoading] = useState(false);

    // Reset when event changes
    useEffect(() => {
        setTeams([]); setRankingsMap({}); setSkillsMap({});
        setAllMatches([]); setFoundTeam(null); setTeamMatches([]);
        setTeamSearch(''); setTeamQuery(''); setMatchSearch('');
    }, [event?.id]);

    // Load Team List
    useEffect(() => {
        if (activeTab !== 'list' || !event || teams.length > 0) return;
        setListLoading(true);
        Promise.all([
            getTeamsForEvent(event.id),
            getRankingsForEvent(event.id, event.divisions),
            getSkillsForEvent(event.id),
        ]).then(([teamsData, rankingsData, skillsData]) => {
            setTeams(teamsData);
            const rMap = {};
            rankingsData.forEach(r => { if (r.team) rMap[r.team.id] = r; });
            setRankingsMap(rMap);
            const ts = {};
            skillsData.forEach(s => {
                if (!s.team) return;
                if (!ts[s.team.id]) ts[s.team.id] = { d: 0, p: 0 };
                if (s.type === 'driver') ts[s.team.id].d = Math.max(ts[s.team.id].d, s.score);
                if (s.type === 'programming') ts[s.team.id].p = Math.max(ts[s.team.id].p, s.score);
            });
            const sMap = {};
            Object.keys(ts).forEach(id => { sMap[id] = { score: ts[id].d + ts[id].p }; });
            setSkillsMap(sMap);
        }).catch(console.error).finally(() => setListLoading(false));
    }, [activeTab, event]);

    // Load All Matches
    useEffect(() => {
        if (activeTab !== 'matches' || !event || allMatches.length > 0) return;
        setMatchesLoading(true);
        getMatchesForEvent(event)
            .then(setAllMatches)
            .catch(console.error)
            .finally(() => setMatchesLoading(false));
    }, [activeTab, event]);

    // Sorted team list
    const sortedTeams = useCallback(() => {
        let list = [...teams];
        if (teamSearch) {
            const q = teamSearch.toLowerCase();
            list = list.filter(t =>
                t.number?.toLowerCase().includes(q) || t.team_name?.toLowerCase().includes(q)
            );
        }
        switch (sortMode) {
            case 'rank': return list.sort((a, b) => (rankingsMap[a.id]?.rank || 9999) - (rankingsMap[b.id]?.rank || 9999));
            case 'skills': return list.sort((a, b) => (skillsMap[b.id]?.score || 0) - (skillsMap[a.id]?.score || 0));
            default: return list.sort((a, b) => a.number?.localeCompare(b.number, undefined, { numeric: true }));
        }
    }, [teams, teamSearch, sortMode, rankingsMap, skillsMap]);

    // Find Team search
    const searchTeam = async (num) => {
        const q = (num || teamQuery).trim();
        if (!q || !event) return;
        setTeamLoading(true); setTeamError(null); setFoundTeam(null); setTeamMatches([]);
        try {
            const td = await getTeamByNumber(q);
            setFoundTeam(td);
            const m = await getMatchesForEventAndTeam(event.id, td.id);
            setTeamMatches(m);
        } catch (e) { setTeamError(e.message); }
        finally { setTeamLoading(false); }
    };

    // ── Render tabs ──
    const renderFindTeam = () => (
        <View style={{ flex: 1 }}>
            <View style={s.inputRow}>
                <TextInput
                    value={teamQuery} onChangeText={setTeamQuery}
                    placeholder="Team number (e.g. 10B)"
                    placeholderTextColor={Colors.textDim}
                    style={s.textInput}
                    autoCapitalize="characters" autoCorrect={false}
                    returnKeyType="search" onSubmitEditing={() => searchTeam()}
                />
                <TouchableOpacity style={s.cyanBtn} onPress={() => searchTeam()} activeOpacity={0.8}>
                    <Search size={17} color="#0d1117" />
                </TouchableOpacity>
            </View>

            {teamLoading && <View style={s.center}><ActivityIndicator color={Colors.accentCyan} /></View>}
            {teamError && <View style={s.center}><Text style={s.errTxt}>{teamError}</Text></View>}

            {foundTeam && !teamLoading && (
                <>
                    <View style={s.teamCard}>
                        <Text style={s.teamNum}>{foundTeam.number}</Text>
                        <Text style={s.teamCardTitle}>{foundTeam.team_name}</Text>
                    </View>
                    {teamMatches.length === 0
                        ? <View style={s.center}><Text style={s.mutedTxt}>No matches found for this team.</Text></View>
                        : <FlatList
                            data={groupMatchesByEventDay(teamMatches, event)}
                            keyExtractor={i => i.id?.toString() ?? i.label}
                            contentContainerStyle={{ padding: 10, gap: 8 }}
                            renderItem={({ item }) => {
                                if (item.type === 'header') {
                                    return (
                                        <View style={s.dayDivider}>
                                            <View style={s.dayLine} />
                                            <Text style={s.dayLabel}>{item.label}</Text>
                                            <View style={s.dayLine} />
                                        </View>
                                    );
                                }
                                return <MatchCard item={item} onPress={() => onWatch(item)} highlightTeam={foundTeam.number} />;
                            }}
                        />
                    }
                </>
            )}
            {!foundTeam && !teamLoading && !teamError && (
                <View style={s.center}>
                    <Users size={36} color={Colors.textDim} strokeWidth={1.2} />
                    <Text style={s.mutedTxt}>Enter a team number to see their matches</Text>
                </View>
            )}
        </View>
    );

    const renderTeamList = () => (
        <View style={{ flex: 1 }}>
            <View style={s.searchBar}>
                <Search size={13} color={Colors.textMuted} />
                <TextInput value={teamSearch} onChangeText={setTeamSearch}
                    placeholder="Search teams..." placeholderTextColor={Colors.textDim}
                    style={{ flex: 1, color: Colors.textPrimary, fontSize: 13 }} />
            </View>
            <View style={s.sortRow}>
                {[
                    { key: 'default', label: 'Default', Icon: Users },
                    { key: 'rank', label: 'Rank', Icon: Trophy },
                    { key: 'skills', label: 'Skills', Icon: Medal },
                ].map(({ key, label, Icon }) => (
                    <TouchableOpacity key={key}
                        style={[s.sortChip, sortMode === key && s.sortChipOn]}
                        onPress={() => setSortMode(key)} activeOpacity={0.7}>
                        <Icon size={11} color={sortMode === key ? '#0d1117' : Colors.textMuted} />
                        <Text style={[s.sortTxt, sortMode === key && { color: '#0d1117' }]}>{label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {listLoading
                ? <View style={s.center}><ActivityIndicator color={Colors.accentCyan} /></View>
                : <FlatList
                    data={sortedTeams()}
                    keyExtractor={i => i.id.toString()}
                    contentContainerStyle={{ padding: 8, gap: 6 }}
                    renderItem={({ item }) => (
                        <TeamRow
                            team={item}
                            ranking={rankingsMap[item.id]}
                            skillScore={skillsMap[item.id]?.score}
                            onPress={() => { setActiveTab('search'); setTeamQuery(item.number); searchTeam(item.number); }}
                        />
                    )}
                    ListEmptyComponent={<View style={s.center}><Text style={s.mutedTxt}>No teams found.</Text></View>}
                />
            }
        </View>
    );

    const renderMatches = () => {
        let filteredMatches = allMatches;
        if (matchSearch) {
            const q = matchSearch.toLowerCase();
            filteredMatches = allMatches.filter(m => {
                if (m.name.toLowerCase().includes(q)) return true;
                const r = m.alliances?.find(a => a.color === 'red')?.teams?.map(t => t.team?.name) || [];
                const b = m.alliances?.find(a => a.color === 'blue')?.teams?.map(t => t.team?.name) || [];
                if (r.some(t => t?.toLowerCase().includes(q))) return true;
                if (b.some(t => t?.toLowerCase().includes(q))) return true;
                return false;
            });
        }

        const flatData = groupMatchesByEventDay(filteredMatches, event);
        return (
            <View style={{ flex: 1 }}>
                <View style={s.searchBar}>
                    <Search size={13} color={Colors.textMuted} />
                    <TextInput value={matchSearch} onChangeText={setMatchSearch}
                        placeholder="Search matches or teams..." placeholderTextColor={Colors.textDim}
                        style={{ flex: 1, color: Colors.textPrimary, fontSize: 13 }} />
                </View>
                {matchesLoading
                    ? <View style={s.center}><ActivityIndicator color={Colors.accentCyan} /></View>
                    : <FlatList
                        data={flatData}
                        keyExtractor={i => i.id?.toString() ?? i.label}
                        contentContainerStyle={{ padding: 10, gap: 8 }}
                        renderItem={({ item }) => {
                            if (item.type === 'header') {
                                return (
                                    <View style={s.dayDivider}>
                                        <View style={s.dayLine} />
                                        <Text style={s.dayLabel}>{item.label}</Text>
                                        <View style={s.dayLine} />
                                    </View>
                                );
                            }
                            return <MatchCard item={item} onPress={() => onWatch(item)} />;
                        }}
                        ListEmptyComponent={<View style={s.center}><Text style={s.mutedTxt}>No matches found.</Text></View>}
                    />
                }
            </View>
        );
    };

    if (!event) return null;

    return (
        <View style={{ flex: 1 }}>
            {/* Tab bar */}
            <View style={s.tabBar}>
                {TABS.map(({ key, label }) => (
                    <TouchableOpacity key={key}
                        style={[s.tabItem, activeTab === key && s.tabItemOn]}
                        onPress={() => setActiveTab(key)} activeOpacity={0.7}>
                        <Text style={[s.tabLabel, activeTab === key && s.tabLabelOn]}>{label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {/* Content */}
            {activeTab === 'search' ? renderFindTeam()
                : activeTab === 'list' ? renderTeamList()
                    : renderMatches()}
        </View>
    );
}

const s = StyleSheet.create({
    // Tabs
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
    tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabItemOn: { borderBottomColor: Colors.accentCyan },
    tabLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    tabLabelOn: { color: Colors.accentCyan },

    // Match card
    matchCard: { backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, padding: 11, gap: 8 },
    matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    matchName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
    watchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,211,238,0.1)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)' },
    watchText: { fontSize: 11, fontWeight: '600', color: Colors.accentCyan },

    scoreBar: { flexDirection: 'row', height: 50, gap: 3 },
    half: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, borderRadius: 7, borderWidth: 2 },
    // Red — solid (winner) vs outline (loser)
    redSolid: { backgroundColor: '#7f1d1d', borderColor: '#dc2626' },
    redOutline: { backgroundColor: 'transparent', borderColor: '#7f1d1d' },
    // Blue — solid (winner) vs outline (loser)
    blueSolid: { backgroundColor: '#1e3a5f', borderColor: '#2563eb' },
    blueOutline: { backgroundColor: 'transparent', borderColor: '#1e3a5f' },

    vsDivider: { width: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBgAlt },
    vsText: { fontSize: 8, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
    scoreNum: { fontSize: 18, fontWeight: '900', color: '#fff' },

    teamTxtContainer: { flex: 1 },
    teamTxtBase: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    teamTxtHighlight: { fontWeight: '900', color: Colors.accentCyan },

    // Team
    teamRow: { backgroundColor: Colors.inputBg, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamNum: { fontSize: 14, fontWeight: '800', color: Colors.accentCyan },
    teamName: { fontSize: 12, color: Colors.textMuted, flex: 1 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    chipTxt: { fontSize: 11, color: Colors.textMuted },
    teamCard: { marginHorizontal: 10, marginBottom: 6, backgroundColor: Colors.cardBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorderBlue, padding: 12, gap: 3 },
    teamCardTitle: { fontSize: 15, color: Colors.textPrimary, fontWeight: '700' },

    // Search / sort
    inputRow: { flexDirection: 'row', gap: 8, padding: 10 },
    textInput: { flex: 1, backgroundColor: Colors.inputBg, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, color: Colors.textPrimary, paddingHorizontal: 13, paddingVertical: 10, fontSize: 13 },
    cyanBtn: { backgroundColor: Colors.accentCyan, borderRadius: 9, width: 44, alignItems: 'center', justifyContent: 'center' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 10, backgroundColor: Colors.inputBg, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 11, paddingVertical: 8 },
    sortRow: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8, gap: 8, flexDirection: 'row' },
    sortChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.iconBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.cardBorder },
    sortChipOn: { backgroundColor: Colors.accentCyan, borderColor: Colors.accentCyan },
    sortTxt: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

    // States
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
    mutedTxt: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
    errTxt: { color: Colors.accentRed, fontSize: 13, textAlign: 'center' },

    // Day divider
    dayDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
    dayLine: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
    dayLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
});
