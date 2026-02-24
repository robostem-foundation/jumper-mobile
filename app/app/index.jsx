import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Dimensions,
    Platform,
    StatusBar,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    Tv,
    Link,
    Star,
    ChevronDown,
    ChevronUp,
    Search,
    History,
    Settings,
    GitBranch,
    RotateCcw,
    Users,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';

const { width } = Dimensions.get('window');

// ── Logo ─────────────────────────────────────────────────────
const LOGO = require('../assets/images/logo.png');

// ── Section Card ─────────────────────────────────────────────
function SectionCard({ children, style }) {
    return (
        <View style={[styles.card, style]}>
            {children}
        </View>
    );
}

// ── Bottom Tab Button ─────────────────────────────────────────
function TabButton({ icon, active, onPress }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.tabButton, active && styles.tabButtonActive]}
            activeOpacity={0.7}
        >
            {icon}
        </TouchableOpacity>
    );
}

// ── Featured Events Dropdown ──────────────────────────────────
const FEATURED_EVENTS = [
    { label: 'Select an event...', value: '' },
    { label: 'VEX Worlds 2025 – Dallas', value: 'RE-VRC-25-3690' },
    { label: 'VEX State Championship – CA', value: 'RE-VRC-25-1122' },
    { label: 'VEX Regionals – PNW', value: 'RE-VRC-25-0985' },
];

export default function HomeScreen() {
    const router = useRouter();

    const [livestreamUrl, setLivestreamUrl] = useState('');
    const [eventUrl, setEventUrl] = useState('');
    const [teamQuery, setTeamQuery] = useState('');
    const [findEventOpen, setFindEventOpen] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(FEATURED_EVENTS[0]);
    const [activeTab, setActiveTab] = useState('history');

    const streamLoaded = livestreamUrl.trim().length > 0;

    const handleSearchByUrl = () => {
        if (!eventUrl.trim()) return;
        let sku = eventUrl.trim();
        const skuMatch = sku.match(/(RE-[A-Z0-9]+-\d{2}-\d{4})/);
        if (skuMatch) sku = skuMatch[1];
        const liveParam = livestreamUrl.trim()
            ? `&liveUrl=${encodeURIComponent(livestreamUrl.trim())}`
            : '';
        router.push(`/matches?sku=${sku}${liveParam}`);
    };

    const handleFeaturedSelect = (event) => {
        setSelectedEvent(event);
        setDropdownOpen(false);
        if (event.value) {
            const liveParam = livestreamUrl.trim()
                ? `&liveUrl=${encodeURIComponent(livestreamUrl.trim())}`
                : '';
            router.push(`/matches?sku=${event.value}${liveParam}`);
        }
    };

    const handleSearchByTeam = () => {
        if (!teamQuery.trim()) return;
        // Navigate or handle team search
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

            {/* ─── Header ─── */}
            <View style={styles.header}>
                <Image
                    source={LOGO}
                    style={{ width: width - 32, height: 56 }}
                    resizeMode="contain"
                />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ─── Video Player Card ─── */}
                <SectionCard>
                    {streamLoaded ? (
                        <View style={styles.videoPlaceholder}>
                            <Text style={{ color: Colors.textPrimary }}>Player will appear here</Text>
                        </View>
                    ) : (
                        <View style={styles.videoPlaceholder}>
                            <Tv color={Colors.textMuted} size={42} strokeWidth={1.2} />
                            <Text style={styles.videoPlaceholderText}>
                                Load an event first to watch streams
                            </Text>
                        </View>
                    )}
                </SectionCard>

                {/* ─── Livestream URLs Card ─── */}
                <SectionCard style={{ marginTop: 12 }}>
                    <View style={styles.cardHeader}>
                        <Tv color={Colors.textPrimary} size={16} />
                        <Text style={styles.cardTitle}>Livestream URLs</Text>
                    </View>
                    <Text style={styles.inputLabel}>Livestream URL</Text>
                    <TextInput
                        value={livestreamUrl}
                        onChangeText={setLivestreamUrl}
                        placeholder="https://youtube.com/..."
                        placeholderTextColor={Colors.textDim}
                        style={styles.input}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />
                </SectionCard>

                {/* ─── Find Event Card ─── */}
                <SectionCard style={{ marginTop: 12 }}>
                    {/* Card Header Row */}
                    <TouchableOpacity
                        style={styles.cardHeaderRow}
                        onPress={() => setFindEventOpen(!findEventOpen)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.cardHeader}>
                            <View style={styles.findEventIconGrid}>
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <View key={i} style={styles.gridDot} />
                                ))}
                            </View>
                            <Text style={[styles.cardTitle, { textTransform: 'uppercase', letterSpacing: 1 }]}>
                                Find Event
                            </Text>
                        </View>
                        {findEventOpen
                            ? <ChevronUp color={Colors.textMuted} size={18} />
                            : <ChevronDown color={Colors.textMuted} size={18} />}
                    </TouchableOpacity>

                    {findEventOpen && (
                        <View style={{ marginTop: 14 }}>
                            {/* Featured Events */}
                            <View style={styles.subSectionHeader}>
                                <Star color="#f59e0b" size={13} fill="#f59e0b" />
                                <Text style={styles.subSectionLabel}>Featured Events</Text>
                            </View>

                            {/* Dropdown trigger */}
                            <TouchableOpacity
                                style={styles.dropdownTrigger}
                                onPress={() => setDropdownOpen(!dropdownOpen)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.dropdownText,
                                        !selectedEvent.value && { color: Colors.textMuted },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {selectedEvent.label}
                                </Text>
                                <ChevronDown color={Colors.textMuted} size={18} />
                            </TouchableOpacity>

                            {/* Dropdown list */}
                            {dropdownOpen && (
                                <View style={styles.dropdownList}>
                                    {FEATURED_EVENTS.map((ev) => (
                                        <TouchableOpacity
                                            key={ev.value}
                                            style={[
                                                styles.dropdownItem,
                                                ev.value === selectedEvent.value && styles.dropdownItemActive,
                                            ]}
                                            onPress={() => handleFeaturedSelect(ev)}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.dropdownItemText,
                                                    ev.value === selectedEvent.value && { color: Colors.accentCyan },
                                                ]}
                                            >
                                                {ev.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Search by URL */}
                            <View style={[styles.subSectionHeader, { marginTop: 16 }]}>
                                <Link color={Colors.textMuted} size={13} />
                                <Text style={styles.subSectionLabel}>Search by URL</Text>
                            </View>

                            <View style={styles.searchRow}>
                                <TextInput
                                    value={eventUrl}
                                    onChangeText={setEventUrl}
                                    placeholder="Paste RobotEvents URL..."
                                    placeholderTextColor={Colors.textDim}
                                    style={styles.searchInput}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <TouchableOpacity
                                    style={styles.searchBtn}
                                    onPress={handleSearchByUrl}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.searchBtnText}>Search</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Search by Team */}
                            <View style={[styles.subSectionHeader, { marginTop: 16 }]}>
                                <Users color={Colors.textMuted} size={13} />
                                <Text style={styles.subSectionLabel}>Search by Team</Text>
                            </View>

                            <View style={styles.searchRow}>
                                <TextInput
                                    value={teamQuery}
                                    onChangeText={setTeamQuery}
                                    placeholder="Team number or name..."
                                    placeholderTextColor={Colors.textDim}
                                    style={styles.searchInput}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <TouchableOpacity
                                    style={styles.searchBtn}
                                    onPress={handleSearchByTeam}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.searchBtnText}>Search</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </SectionCard>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ─── Bottom Tab Bar ─── */}
            <View style={styles.tabBar}>
                <TabButton
                    icon={<History color={activeTab === 'history' ? Colors.textPrimary : Colors.textMuted} size={20} />}
                    active={activeTab === 'history'}
                    onPress={() => setActiveTab('history')}
                />
                <TabButton
                    icon={<Settings color={activeTab === 'settings' ? Colors.textPrimary : Colors.textMuted} size={20} />}
                    active={activeTab === 'settings'}
                    onPress={() => setActiveTab('settings')}
                />
                <TabButton
                    icon={<GitBranch color={activeTab === 'github' ? Colors.textPrimary : Colors.textMuted} size={20} />}
                    active={activeTab === 'github'}
                    onPress={() => setActiveTab('github')}
                />
                <TabButton
                    icon={<RotateCcw color={activeTab === 'undo' ? '#fff' : Colors.textMuted} size={20} />}
                    active={activeTab === 'undo'}
                    onPress={() => setActiveTab('undo')}
                />
            </View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 14 : 4,
        paddingBottom: 10,
        backgroundColor: Colors.background,
    },
    logoImage: {   /* unused — inline style used instead */
        height: 56,
        width: 280,
    },

    // ── Scroll ──
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 12, paddingTop: 6 },

    // ── Card ──
    card: {
        backgroundColor: Colors.cardBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        padding: 14,
    },

    // ── Card Header Row ──
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginLeft: 6,
    },

    // ── Find Event icon grid ──
    findEventIconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 16,
        height: 16,
        gap: 2,
        alignItems: 'center',
    },
    gridDot: {
        width: 5,
        height: 5,
        borderRadius: 1,
        backgroundColor: Colors.textPrimary,
    },

    // ── Video Placeholder ──
    videoPlaceholder: {
        height: 170,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    videoPlaceholderText: {
        color: Colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
    },

    // ── Inputs ──
    inputLabel: {
        color: Colors.textMuted,
        fontSize: 12,
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: Colors.inputBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        color: Colors.textPrimary,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 14,
    },

    // ── Sub-section ──
    subSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    subSectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // ── Dropdown ──
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.inputBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dropdownText: {
        color: Colors.textPrimary,
        fontSize: 14,
        flex: 1,
        marginRight: 8,
    },
    dropdownList: {
        marginTop: 4,
        backgroundColor: Colors.cardBgAlt,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.cardBorderBlue,
        overflow: 'hidden',
    },
    dropdownItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.cardBorder,
    },
    dropdownItemActive: {
        backgroundColor: 'rgba(34, 211, 238, 0.08)',
    },
    dropdownItemText: {
        color: Colors.textPrimary,
        fontSize: 14,
    },

    // ── Search Row ──
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
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
        paddingHorizontal: 18,
        paddingVertical: 11,
    },
    searchBtnText: {
        color: '#0d1117',
        fontWeight: '700',
        fontSize: 14,
    },

    // ── Tab Bar ──
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 14,
        paddingBottom: Platform.OS === 'ios' ? 28 : 14,
        backgroundColor: Colors.tabBarBg,
        borderTopWidth: 1,
        borderTopColor: Colors.cardBorder,
    },
    tabButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: Colors.iconBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButtonActive: {
        backgroundColor: Colors.accentRed,
    },
});
