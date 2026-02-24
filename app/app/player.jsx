import React, { useState, useCallback } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import YoutubeIframe from 'react-native-youtube-iframe';
import { ChevronLeft } from 'lucide-react-native';

export default function PlayerScreen() {
    const { sku, matchId, videoId, startSeconds } = useLocalSearchParams();
    const router = useRouter();

    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);

    // In a real scenario, we'd fetch the stream info or expect it via params
    const ytVideoId = videoId || 'dQw4w9WgXcQ'; // Fallback for now
    const parsedStart = parseInt(startSeconds, 10) || 0;

    const onStateChange = useCallback((state) => {
        if (state === 'ended') {
            setPlaying(false);
        }
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-zinc-900">
            <View className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
                    <ChevronLeft color="#6B7280" size={24} />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1" numberOfLines={1}>
                    Match Video Highlights
                </Text>
            </View>

            <ScrollView className="flex-1">
                {loading ? (
                    <View className="h-64 justify-center items-center bg-black">
                        <ActivityIndicator size="large" color="#EF4444" />
                    </View>
                ) : (
                    <View className="bg-black w-full aspect-video">
                        <YoutubeIframe
                            height={'100%'}
                            width={'100%'}
                            play={playing}
                            videoId={ytVideoId}
                            initialPlayerParams={{
                                start: parsedStart,
                                rel: 0,
                                modestbranding: 1
                            }}
                            onChangeState={onStateChange}
                        />
                    </View>
                )}

                <View className="p-5">
                    <Text className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                        Match Overview
                    </Text>
                    <View className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 mt-2">
                        <Text className="text-gray-600 dark:text-zinc-400 font-medium mb-1">Event SKU:</Text>
                        <Text className="text-gray-900 dark:text-white font-bold text-lg mb-4">{sku}</Text>

                        <Text className="text-gray-600 dark:text-zinc-400 font-medium mb-1">Match ID:</Text>
                        <Text className="text-gray-900 dark:text-white font-bold text-lg">{matchId}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
