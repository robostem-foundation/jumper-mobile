import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Play } from 'lucide-react-native';
import { getEventBySku, getMatchesForEvent } from '../services/robotevents';

export default function MatchesScreen() {
    const { sku } = useLocalSearchParams();
    const router = useRouter();

    const [event, setEvent] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const eventData = await getEventBySku(sku);
                setEvent(eventData);

                const matchesData = await getMatchesForEvent(eventData);
                setMatches(matchesData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (sku) {
            fetchData();
        }
    }, [sku]);

    const renderMatch = ({ item }) => {
        // Determine winner for highlight
        let redScore = item.alliances?.find(a => a.color === 'red')?.score || 0;
        let blueScore = item.alliances?.find(a => a.color === 'blue')?.score || 0;

        return (
            <TouchableOpacity
                className="bg-white dark:bg-zinc-800 rounded-2xl mb-3 p-4 shadow-sm border border-gray-100 dark:border-zinc-700 mx-4"
                onPress={() => router.push(`/player?sku=${sku}&matchId=${item.id}`)}
            >
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">{item.name}</Text>
                    <View className="bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full flex-row items-center">
                        <Play size={14} color="#EF4444" className="mr-1" />
                        <Text className="text-red-600 dark:text-red-400 font-medium text-xs">Play Video</Text>
                    </View>
                </View>

                {/* Scores */}
                <View className="flex-row rounded-lg overflow-hidden h-12">
                    <View className={`flex-1 justify-center items-center ${redScore > blueScore ? 'bg-red-500' : 'bg-red-400/80'}`}>
                        <Text className="text-white font-bold text-lg">{redScore}</Text>
                    </View>
                    <View className={`flex-1 justify-center items-center ${blueScore > redScore ? 'bg-blue-500' : 'bg-blue-400/80'}`}>
                        <Text className="text-white font-bold text-lg">{blueScore}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <View className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
                    <ChevronLeft color="#6B7280" size={24} />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white" numberOfLines={1}>
                        {event ? event.name : 'Loading Event...'}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-zinc-400">{sku}</Text>
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#EF4444" />
                    <Text className="mt-4 text-gray-500 font-medium">Fetching Matches...</Text>
                </View>
            ) : error ? (
                <View className="flex-1 justify-center items-center p-6">
                    <Text className="text-red-500 text-center text-lg">{error}</Text>
                    <TouchableOpacity
                        className="mt-4 bg-red-600 px-6 py-3 rounded-xl"
                        onPress={() => router.back()}
                    >
                        <Text className="text-white font-bold">Go Back</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
                    data={matches}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderMatch}
                    ListEmptyComponent={
                        <Text className="text-center text-gray-500 mt-10">No matches found for this event.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}
