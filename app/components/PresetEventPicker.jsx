import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { fetchPresetRoutes, clearPresetRoutesCache } from '../services/presetRoutes';

const PLACEHOLDER = { label: 'Select a preset event…', sku: '' };

/**
 * PresetEventPicker
 *
 * Fetches live preset events from the Jumper API and renders a dropdown.
 * Newest event (last in API) is shown first.
 *
 * Props:
 *   onSelect(sku: string) — called when a real event is chosen
 */
export default function PresetEventPicker({ onSelect }) {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(PLACEHOLDER);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPresetRoutes();
            setRoutes(data);
        } catch (e) {
            setError('Could not load events. Check your connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleRetry = () => {
        clearPresetRoutesCache();
        load();
    };

    const handleSelect = (item) => {
        setSelected(item);
        setOpen(false);
        if (item.sku) onSelect(item);   // pass full item so parent can use .streams
    };

    // ── Loading state ──────────────────────────────────────────
    if (loading) {
        return (
            <View style={styles.stateRow}>
                <ActivityIndicator size="small" color={Colors.accentCyan} />
                <Text style={styles.stateText}>Loading events…</Text>
            </View>
        );
    }

    // ── Error state ────────────────────────────────────────────
    if (error) {
        return (
            <View style={styles.errorRow}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.7}>
                    <RefreshCw size={12} color={Colors.accentCyan} />
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── Dropdown ───────────────────────────────────────────────
    return (
        <View>
            {/* Trigger button */}
            <TouchableOpacity
                style={styles.trigger}
                onPress={() => setOpen(o => !o)}
                activeOpacity={0.8}
            >
                <Text
                    style={[styles.triggerText, selected.sku && { color: Colors.accentCyan }]}
                    numberOfLines={1}
                >
                    {selected.label}
                </Text>
                {open
                    ? <ChevronUp color={Colors.textMuted} size={15} />
                    : <ChevronDown color={Colors.textMuted} size={15} />
                }
            </TouchableOpacity>

            {/* Dropdown list */}
            {open && (
                <View style={styles.menu}>
                    <ScrollView
                        style={{ maxHeight: 220 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        {/* Placeholder row */}
                        <TouchableOpacity
                            style={[styles.item, styles.itemBorder]}
                            onPress={() => handleSelect(PLACEHOLDER)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.itemText, { color: Colors.textDim }]}>
                                {PLACEHOLDER.label}
                            </Text>
                        </TouchableOpacity>

                        {routes.map((ev, idx) => {
                            const isSelected = ev.sku === selected.sku;
                            const isLast = idx === routes.length - 1;
                            return (
                                <TouchableOpacity
                                    key={ev.sku}
                                    style={[styles.item, !isLast && styles.itemBorder]}
                                    onPress={() => handleSelect(ev)}
                                    activeOpacity={0.7}
                                >
                                    {/* "Latest" badge on the first item */}
                                    {idx === 0 && (
                                        <View style={styles.latestBadge}>
                                            <Text style={styles.latestBadgeText}>LATEST</Text>
                                        </View>
                                    )}
                                    <Text
                                        style={[styles.itemText, isSelected && { color: Colors.accentCyan }]}
                                        numberOfLines={1}
                                    >
                                        {ev.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Loading / error
    stateRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.inputBg,
        borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder,
        paddingHorizontal: 12, paddingVertical: 11,
    },
    stateText: { color: Colors.textMuted, fontSize: 12 },

    errorRow: {
        gap: 8,
        backgroundColor: Colors.inputBg,
        borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    errorText: { color: Colors.accentRed, fontSize: 12 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
    retryText: { color: Colors.accentCyan, fontSize: 12, fontWeight: '600' },

    // Dropdown
    trigger: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: Colors.inputBg,
        borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    triggerText: { color: Colors.textPrimary, fontSize: 12, flex: 1, marginRight: 6 },

    menu: {
        marginTop: 4,
        backgroundColor: Colors.cardBgAlt,
        borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder,
        overflow: 'hidden',
    },
    item: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
    itemText: { color: Colors.textPrimary, fontSize: 12, flex: 1 },

    latestBadge: {
        backgroundColor: 'rgba(34,211,238,0.12)',
        borderRadius: 4, borderWidth: 1, borderColor: 'rgba(34,211,238,0.25)',
        paddingHorizontal: 5, paddingVertical: 1,
    },
    latestBadgeText: { color: Colors.accentCyan, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
});
