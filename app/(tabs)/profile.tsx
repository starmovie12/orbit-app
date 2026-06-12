/**
 * AESTHETIC DIRECTION: Glass Island — deep blurred surfaces, spring physics, strict hierarchical typography.
 * Implements the "Rich Profile Screen (My Best Of)" architecture exactly as specified in PRD v5.1 §11A.8[span_0](start_span)[span_0](end_span).
 * Honors Safety Mode Panic Button integration §24.5.1[span_1](start_span)[span_1](end_span).
 * Enforces Zero-Raw-Color Law (Law 2) via Semantic Tokens.
 * Enforces Avatar Law (Law 30) — Zero avatars rendered in the header.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

/* ── INTERACTION LAYER (LAW 5: MICRO-INTERACTION COMPLETENESS) ───────────── */

interface InteractiveSurfaceProps {
  children: React.ReactNode;
  onPress: () => void;
  className?: string;
  accessibilityLabel: string;
  hapticType?: 'selection' | 'impact' | 'warning';
}

const InteractiveSurface = ({
  children,
  onPress,
  className,
  accessibilityLabel,
  hapticType = 'impact',
}: InteractiveSurfaceProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (Platform.OS !== 'web') {
      if (hapticType === 'selection') Haptics.selectionAsync();
      else if (hapticType === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 6,
      tension: 40,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 30,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }] }} className={className}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ── DOMAIN DATA (MOCK FOR RENDERING) ────────────────────────────────────── */

const MOCK_USER = {
  handle: '@Bittu_92',
  title: '👑 BARON of Bandra W',
  origin: 'originally from 🏙️ Patna',
  trustScore: 87,
  bio: 'Funny baatein. Half the time serious. — bio',
  stats: {
    messages: 147,
    reactions: '4.2K',
    followers: 89,
    following: 23,
  },
};

const BEST_OF_MESSAGES = [
  {
    id: 'msg_1',
    text: 'Bandra mein traffic abhi sab band hai, koi accident hai shaayad — sab Andheri se nikalo',
    reactions: 84,
    time: '2d ago',
  },
  {
    id: 'msg_2',
    text: 'Aaj raat Marine Drive chalo? Kaun in?',
    reactions: 62,
    time: '1w ago',
  },
  {
    id: 'msg_3',
    text: 'Kya scene hai aaj Chandigarh mein?',
    reactions: 45,
    time: '2w ago',
  },
  {
    id: 'msg_4',
    text: 'Sector 35 mein dekh rahe hain!',
    reactions: 31,
    time: '1m ago',
  },
  {
    id: 'msg_5',
    text: 'Phoenix mall chalo · 4 floor wala juice spot',
    reactions: 14,
    time: '2m ago',
  },
];

/* ── COMPONENT DEFINITION ────────────────────────────────────────────────── */

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [isShadowMode, setIsShadowMode] = useState(false);

  const togglePanicButton = () => {
    setIsShadowMode(!isShadowMode);
    // Emits BEHAVIOR SIGNAL: 'security.panic_button_toggled'
  };

  return (
    <View className="flex-1 bg-[var(--bg-base)]">
      
      {/* 1. SCREEN HEADER (No Avatar per Law 30) */}
      <View
        className="flex-row items-center justify-between px-[var(--sp-5)] pb-[var(--sp-4)] border-b-[1px] border-[var(--border-subtle)] bg-[var(--bg-surface)]"
        style={{ paddingTop: Math.max(insets.top, 16) }}
      >
        <Text className="text-[var(--text-primary)] font-[var(--font-display)] text-[18px] font-[800] tracking-[-0.2px]">
          PROFILE
        </Text>
        <View className="flex-row gap-[var(--sp-3)]">
          {/* Panic Button (Safety Mode)[span_2](start_span)[span_2](end_span) */}
          <InteractiveSurface
            onPress={togglePanicButton}
            accessibilityLabel="Toggle Panic Mode"
            hapticType="warning"
            className={`w-[44px] h-[44px] rounded-[var(--radius-full)] items-center justify-center ${
              isShadowMode ? 'bg-[var(--color-destructive)]' : 'bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <Feather 
              name="shield" 
              size={20} 
              color={isShadowMode ? 'var(--text-on-destructive)' : 'var(--color-destructive)'} 
            />
          </InteractiveSurface>
          
          <InteractiveSurface
            onPress={() => {}}
            accessibilityLabel="Settings"
            hapticType="selection"
            className="w-[44px] h-[44px] rounded-[var(--radius-full)] bg-[var(--bg-surface-elevated)] items-center justify-center"
          >
            <Feather name="settings" size={20} color="var(--text-primary)" />
          </InteractiveSurface>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* 2. PROFILE HERO (Identity & Bio)[span_3](start_span)[span_3](end_span) */}
        <View className="items-center py-[var(--sp-8)] px-[var(--sp-5)]">
          <Text className="text-[var(--text-primary)] text-[24px] font-[var(--font-display)] font-[800] tracking-[-0.5px]">
            {MOCK_USER.handle}
          </Text>
          
          <View className="bg-[var(--colorPrimaryMuted)] px-[var(--sp-3)] py-[6px] rounded-[var(--radius-full)] mt-[var(--sp-2)] border-[1px] border-[var(--color-primary-subtle)]">
            <Text className="text-[var(--color-primary)] text-[12px] font-[700] font-[var(--font-body)]">
              {MOCK_USER.title}
            </Text>
          </View>

          <View className="flex-row items-center gap-[var(--sp-2)] mt-[var(--sp-3)]">
            <Text className="text-[var(--text-secondary)] text-[13px] font-[var(--font-body)]">
              {MOCK_USER.origin}
            </Text>
            <Text className="text-[var(--text-tertiary)] text-[12px]">·</Text>
            <Text className="text-[var(--color-success)] text-[13px] font-[700] font-[var(--font-numeric)]">
              ⭐ Trust {MOCK_USER.trustScore}
            </Text>
          </View>

          <Text className="text-[var(--text-secondary)] text-[14px] leading-[20px] text-center mt-[var(--sp-4)] px-[var(--sp-5)]">
            {MOCK_USER.bio}
          </Text>

          {/* Action Buttons[span_4](start_span)[span_4](end_span) */}
          <View className="flex-row gap-[var(--sp-3)] mt-[var(--sp-6)]">
            <InteractiveSurface onPress={() => {}} accessibilityLabel="Follow User" className="h-[44px] px-[var(--sp-6)] bg-[var(--text-primary)] rounded-[var(--radius-base)] items-center justify-center">
              <Text className="text-[var(--text-on-primary)] text-[14px] font-[600]">Follow</Text>
            </InteractiveSurface>
            <InteractiveSurface onPress={() => {}} accessibilityLabel="Message User" className="h-[44px] px-[var(--sp-6)] bg-[var(--bg-surface-elevated)] border-[1px] border-[var(--border-strong)] rounded-[var(--radius-base)] items-center justify-center">
              <Text className="text-[var(--text-primary)] text-[14px] font-[600]">DM</Text>
            </InteractiveSurface>
            <InteractiveSurface onPress={() => {}} accessibilityLabel="Send Spark Gift" className="h-[44px] px-[var(--sp-4)] bg-[var(--bg-surface-elevated)] border-[1px] border-[var(--border-strong)] rounded-[var(--radius-base)] items-center justify-center">
              <Feather name="zap" size={16} color="var(--color-primary)" />
            </InteractiveSurface>
          </View>
        </View>

        {/* 3. STATS STRIP[span_5](start_span)[span_5](end_span) */}
        <View className="flex-row bg-[var(--bg-surface)] mx-[var(--sp-5)] rounded-[var(--radius-lg)] py-[var(--sp-4)] border-[1px] border-[var(--border-subtle)] mb-[var(--sp-6)]">
          <View className="flex-1 items-center">
            <Text className="text-[var(--text-primary)] text-[16px] font-[var(--font-numeric)] font-[700]">{MOCK_USER.stats.messages}</Text>
            <Text className="text-[var(--text-tertiary)] text-[10px] font-[600] tracking-[0.5px] mt-[4px]">MESSAGES</Text>
          </View>
          <View className="w-[1px] bg-[var(--border-subtle)]" />
          <View className="flex-1 items-center">
            <Text className="text-[var(--text-primary)] text-[16px] font-[var(--font-numeric)] font-[700]">{MOCK_USER.stats.reactions}</Text>
            <Text className="text-[var(--text-tertiary)] text-[10px] font-[600] tracking-[0.5px] mt-[4px]">REACTIONS</Text>
          </View>
          <View className="w-[1px] bg-[var(--border-subtle)]" />
          <View className="flex-1 items-center">
            <Text className="text-[var(--text-primary)] text-[16px] font-[var(--font-numeric)] font-[700]">{MOCK_USER.stats.followers}</Text>
            <Text className="text-[var(--text-tertiary)] text-[10px] font-[600] tracking-[0.5px] mt-[4px]">FOLLOWERS</Text>
          </View>
          <View className="w-[1px] bg-[var(--border-subtle)]" />
          <View className="flex-1 items-center">
            <Text className="text-[var(--text-primary)] text-[16px] font-[var(--font-numeric)] font-[700]">{MOCK_USER.stats.following}</Text>
            <Text className="text-[var(--text-tertiary)] text-[10px] font-[600] tracking-[0.5px] mt-[4px]">FOLLOWING</Text>
          </View>
        </View>

        {/* 4. MY BEST OF (Top 5 Messages)[span_6](start_span)[span_6](end_span) */}
        <View className="px-[var(--sp-5)] mb-[var(--sp-8)]">
          <View className="flex-row items-center mb-[var(--sp-4)]">
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
            <Text className="text-[var(--text-tertiary)] text-[11px] font-[700] tracking-[1.5px] mx-[var(--sp-3)]">MY BEST OF</Text>
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
          </View>
          
          {BEST_OF_MESSAGES.map((msg) => (
            <InteractiveSurface key={msg.id} onPress={() => {}} accessibilityLabel="View Message" className="bg-[var(--bg-surface)] border-[1px] border-[var(--border-subtle)] rounded-[var(--radius-md)] p-[var(--sp-4)] mb-[var(--sp-3)]">
              <Text className="text-[var(--text-primary)] text-[14px] leading-[20px] font-[var(--font-body)]" numberOfLines={2}>
                {msg.text}
              </Text>
              <View className="flex-row justify-between items-center mt-[var(--sp-3)]">
                <View className="flex-row items-center bg-[var(--color-primary-subtle)] px-[var(--sp-2)] py-[4px] rounded-[var(--radius-sm)] gap-[4px]">
                  <Feather name="heart" size={12} color="var(--color-primary)" />
                  <Text className="text-[var(--color-primary)] text-[12px] font-[700] font-[var(--font-numeric)]">{msg.reactions}</Text>
                </View>
                <Text className="text-[var(--text-tertiary)] text-[12px]">{msg.time}</Text>
              </View>
            </InteractiveSurface>
          ))}
        </View>

        {/* 5. QUOTE OF THE WEEK[span_7](start_span)[span_7](end_span) */}
        <View className="px-[var(--sp-5)] mb-[var(--sp-8)]">
          <View className="flex-row items-center mb-[var(--sp-4)]">
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
            <Text className="text-[var(--text-tertiary)] text-[11px] font-[700] tracking-[1.5px] mx-[var(--sp-3)]">QUOTE OF THE WEEK</Text>
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
          </View>
          <View className="bg-[var(--bg-surface-sunken)] border-[1px] border-[var(--border-strong)] rounded-[var(--radius-md)] p-[var(--sp-5)] items-center">
            <Feather name="message-square" size={16} color="var(--color-primary)" style={{ marginBottom: 8 }} />
            <Text className="text-[var(--text-secondary)] text-[16px] italic text-center leading-[24px]">
              "Bandra mein traffic abhi sab band hai, koi accident hai shaayad — sab Andheri se nikalo"
            </Text>
          </View>
        </View>

        {/* 6. CROWN JOURNEY[span_8](start_span)[span_8](end_span) */}
        <View className="px-[var(--sp-5)] mb-[var(--sp-8)]">
          <View className="flex-row items-center mb-[var(--sp-4)]">
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
            <Text className="text-[var(--text-tertiary)] text-[11px] font-[700] tracking-[1.5px] mx-[var(--sp-3)]">CROWN JOURNEY</Text>
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
          </View>
          <View className="bg-[var(--bg-surface)] border-[1px] border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-[var(--sp-5)]">
            
            <View className="flex-row">
              <View className="w-[24px] items-center">
                <View className="w-[10px] h-[10px] rounded-[5px] bg-[var(--color-primary)] z-10 shadow-sm shadow-[var(--color-primary)]" />
                <View className="w-[2px] flex-1 bg-[var(--border-subtle)] mt-[-2px] mb-[-2px]" />
              </View>
              <View className="flex-1 pb-[var(--sp-5)] pl-[var(--sp-2)]">
                <Text className="text-[var(--color-primary)] text-[14px] font-[700]">BARON of Bandra W</Text>
                <Text className="text-[var(--text-tertiary)] text-[13px] mt-[4px] leading-[18px]">Held 12 cycles (now)</Text>
              </View>
            </View>

            <View className="flex-row">
              <View className="w-[24px] items-center">
                <View className="w-[10px] h-[10px] rounded-[5px] bg-[var(--border-strong)] z-10" />
                <View className="w-[2px] flex-1 bg-[var(--border-subtle)] mt-[-2px] mb-[-2px]" />
              </View>
              <View className="flex-1 pb-[var(--sp-5)] pl-[var(--sp-2)]">
                <Text className="text-[var(--text-secondary)] text-[14px] font-[600]">Mumbai Top 10 Today</Text>
                <Text className="text-[var(--text-tertiary)] text-[13px] mt-[4px] leading-[18px]">Earned 3 times</Text>
              </View>
            </View>

            <View className="flex-row">
              <View className="w-[24px] items-center">
                <View className="w-[10px] h-[10px] rounded-[5px] bg-[var(--border-strong)] z-10" />
              </View>
              <View className="flex-1 pl-[var(--sp-2)]">
                <Text className="text-[var(--text-secondary)] text-[14px] font-[600]">Sector Hero</Text>
                <Text className="text-[var(--text-tertiary)] text-[13px] mt-[4px] leading-[18px]">Earned 7 times</Text>
              </View>
            </View>

          </View>
        </View>

        {/* 7. MY CITY HEAT[span_9](start_span)[span_9](end_span) */}
        <View className="px-[var(--sp-5)] mb-[var(--sp-8)]">
          <View className="flex-row items-center mb-[var(--sp-4)]">
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
            <Text className="text-[var(--text-tertiary)] text-[11px] font-[700] tracking-[1.5px] mx-[var(--sp-3)]">MY CITY HEAT</Text>
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
          </View>
          <View className="bg-[var(--bg-surface)] border-[1px] border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-[var(--sp-5)] h-[120px] flex-row items-end justify-between">
            {/* Sparkline representation via flex blocks */}
            {[20, 35, 10, 50, 80, 40, 60, 90, 100, 30, 45, 70, 85, 20, 55].map((height, i) => (
              <View 
                key={i} 
                className="w-[12px] bg-[var(--color-primary)] opacity-80 rounded-t-[var(--radius-sm)]" 
                style={{ height: `${height}%` }} 
              />
            ))}
          </View>
        </View>

        {/* 8. RECENT SPARKS RECEIVED[span_10](start_span)[span_10](end_span) */}
        <View className="px-[var(--sp-5)] mb-[var(--sp-8)]">
          <View className="flex-row items-center mb-[var(--sp-4)]">
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
            <Text className="text-[var(--text-tertiary)] text-[11px] font-[700] tracking-[1.5px] mx-[var(--sp-3)]">RECENT SPARKS</Text>
            <View className="flex-1 h-[1px] bg-[var(--border-subtle)]" />
          </View>
          
          <View className="bg-[var(--bg-surface)] border-[1px] border-[var(--border-subtle)] rounded-[var(--radius-md)] p-[var(--sp-4)] flex-row items-center gap-[var(--sp-3)] mb-[var(--sp-3)]">
            <View className="w-[32px] h-[32px] bg-[var(--color-primary-subtle)] rounded-[var(--radius-full)] items-center justify-center">
              <Feather name="zap" size={16} color="var(--color-primary)" />
            </View>
            <Text className="flex-1 text-[var(--text-secondary)] text-[14px] leading-[20px]">
              You received a Spark from <Text className="text-[var(--text-primary)] font-[600]">@Viceroy_CHD</Text>
            </Text>
            <Text className="text-[var(--text-tertiary)] text-[12px]">4h ago</Text>
          </View>

          <View className="bg-[var(--bg-surface)] border-[1px] border-[var(--border-subtle)] rounded-[var(--radius-md)] p-[var(--sp-4)] flex-row items-center gap-[var(--sp-3)] mb-[var(--sp-3)]">
            <View className="w-[32px] h-[32px] bg-[var(--color-primary-subtle)] rounded-[var(--radius-full)] items-center justify-center">
              <Feather name="zap" size={16} color="var(--color-primary)" />
            </View>
            <Text className="flex-1 text-[var(--text-secondary)] text-[14px] leading-[20px]">
              You received a Spark from <Text className="text-[var(--text-primary)] font-[600]">@AyeshaT</Text>
            </Text>
            <Text className="text-[var(--text-tertiary)] text-[12px]">1d ago</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
