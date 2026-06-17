import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, SafeAreaView, StatusBar } from 'react-native';
import { Settings, Info, ArrowUp, ArrowDown, ChevronRight, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react-native';

// --- TOKENS & CONSTANTS (From PRD §3.1) ---
const COLORS = {
  bgSurface: '#0D1018',
  bgCard: '#161B26',
  brand: '#F59E0B',
  brandLight: '#F5C842',
  textStrong: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.7)',
  accentOrange: '#E07B20',
  success: '#10B981',
  danger: '#EF4444',
  borderSubtle: 'rgba(255,255,255,0.08)',
};

// --- SUB-COMPONENTS ---

const ScreenHeader = () => (
  <View className="flex-row items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0D1018] z-10 sticky top-0">
    <View className="flex-row items-center gap-2">
      <Text className="text-[#F59E0B] text-2xl">👑</Text>
      <Text className="text-white text-2xl font-extrabold tracking-tighter" style={{ fontFamily: 'System' }}>CROWN</Text>
    </View>
    <TouchableOpacity activeOpacity={0.7} className="flex-row items-center bg-[#161B26] border border-white/10 rounded-full px-3 py-1.5 gap-2">
      <Text className="text-white text-xs font-medium">🛡 Auto-Accept</Text>
      <Settings size={14} color={COLORS.textMuted} />
    </TouchableOpacity>
  </View>
);

const CrownHeroCard = () => (
  <View className="mx-4 mt-6 bg-[#161B26] rounded-2xl border border-[#F59E0B]/30 p-5 overflow-hidden">
    {/* Subtle Glow Background Effect */}
    <View className="absolute top-0 right-0 w-32 h-32 bg-[#F59E0B]/10 rounded-full blur-3xl -mr-10 -mt-10" />
    
    <View className="flex-row items-start justify-between">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-[#F59E0B] text-xl">👑</Text>
          <Text className="text-[#F59E0B] text-xl font-bold tracking-tight">BARON of Sector 35, Chandigarh</Text>
        </View>
        <View className="flex-row items-center gap-3 mt-1">
          <Text className="text-white/70 text-sm">@YourHandle</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-white/50 text-xs">👁</Text>
            <Text className="text-white/70 text-xs">312 saw your pin</Text>
          </View>
        </View>
      </View>
    </View>

    <View className="mt-5 space-y-1">
      <Text className="text-white text-sm font-medium">Held since: 2 cycles <Text className="text-[#10B981]"> (↑ from 1 last week)</Text></Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-white/70 text-sm">Cycle reward:</Text>
        <Text className="text-[#10B981] font-mono text-base font-bold tracking-tight">500 Cr / cycle</Text>
        <TouchableOpacity>
          <Text className="text-[#F59E0B] text-xs font-medium ml-1">[ℹ︎ How it's paid]</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View className="mt-5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg p-3 flex-row items-center gap-2">
      <CheckCircle2 size={16} color={COLORS.success} />
      <Text className="text-[#10B981] text-xs font-semibold uppercase tracking-wider">Your title is ACTIVE this cycle</Text>
    </View>
  </View>
);

const RankCard = ({ emoji, tier, location, rank, progress, progressLabel, stats, phase, isMonospaced = true }) => (
  <TouchableOpacity activeOpacity={0.8} className="mx-4 mb-4 bg-[#161B26] rounded-xl border border-white/10 p-4">
    <View className="flex-row items-center justify-between mb-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg">{emoji}</Text>
        <Text className="text-white font-bold tracking-tight text-sm uppercase">{tier} — {location}</Text>
      </View>
      <View className="bg-white/5 px-2 py-1 rounded border border-white/10">
        <Text className="text-white/70 text-[10px] font-semibold">{phase}</Text>
      </View>
    </View>

    <View className="mb-4">
      <Text className="text-white/50 text-[11px] font-medium uppercase tracking-widest mb-1">Rank</Text>
      <Text className={`text-[#F59E0B] text-3xl font-bold ${isMonospaced ? 'font-mono tracking-tighter' : ''}`}>
        {rank}
      </Text>
    </View>

    {progress !== null && (
      <View className="space-y-2 mb-4">
        <View className="flex-row justify-between items-center">
          <View className="flex-1 h-1.5 bg-[#0D1018] rounded-full overflow-hidden mr-3">
            <View className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${progress}%` }} />
          </View>
          <Text className="text-white/80 text-xs font-medium">{progressLabel}</Text>
        </View>
      </View>
    )}

    {stats && (
      <View className="flex-row items-center gap-3 pt-3 border-t border-white/5">
        <Text className="text-white/60 font-mono text-xs">{stats.score} pts</Text>
        <Text className="text-white/40 text-[10px]">•</Text>
        <Text className="text-white/60 text-xs">Reactions: {stats.reactions}</Text>
        {stats.delta && (
          <>
            <Text className="text-white/40 text-[10px]">•</Text>
            <View className="flex-row items-center">
              <ArrowUp size={12} color={COLORS.success} />
              <Text className="text-[#10B981] text-xs font-mono ml-1">{stats.delta}</Text>
            </View>
          </>
        )}
      </View>
    )}
  </TouchableOpacity>
);

const ActiveCyclePanel = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View className="mx-4 mb-8 bg-[#161B26] rounded-xl border-2 border-[#E07B20] p-5 shadow-lg shadow-[#E07B20]/20">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">⚔️</Text>
          <Text className="text-white font-bold tracking-widest text-sm uppercase">BATTLE HOUR</Text>
          <Animated.View style={{ opacity: pulseAnim }} className="w-2 h-2 bg-red-500 rounded-full ml-1" />
          <Text className="text-red-500 text-[10px] font-bold">LIVE</Text>
        </View>
        <Text className="text-white/60 text-xs">Sector 35 · BARON</Text>
      </View>

      <Text className="text-white/80 text-sm mb-2">Leaderboard is LIVE. Every reaction matters.</Text>
      <View className="flex-row items-center justify-between mb-5">
        <Text className="text-white/60 text-xs">Cycle freezes in:</Text>
        <Text className="text-[#E07B20] font-mono text-xl font-bold">00 : 47 : 13</Text>
      </View>

      <View className="bg-[#0D1018] rounded-lg p-4 mb-4 border border-white/5">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white/60 text-[11px] uppercase tracking-widest">Your Rank</Text>
          <Text className="text-[#10B981] text-xs font-medium">↑ from #14 (live)</Text>
        </View>
        <Text className="text-[#F59E0B] font-mono text-2xl font-bold mb-3">#8</Text>
        <View className="h-1.5 bg-white/10 rounded-full mb-2">
          <View className="h-full bg-[#F59E0B] rounded-full w-[80%]" />
        </View>
        <Text className="text-white/60 text-[10px] text-right">Top 10 — held for 12 min</Text>
      </View>

      <View className="mb-5">
        <Text className="text-white/40 text-[10px] uppercase tracking-widest mb-3">── Leaderboard Top 5 ─────────</Text>
        {[
          { rank: '#1', handle: '@AyeshaT', pts: '512', isYou: false, hasCrown: true },
          { rank: '#2', handle: '@Bittu_92', pts: '488', isYou: false },
          { rank: '#3', handle: '@Pooja_M', pts: '421', isYou: false },
          { rank: '#8', handle: 'YOU', pts: '247', isYou: true },
        ].map((user, i) => (
          <View key={i} className={`flex-row items-center py-2 ${user.isYou ? 'bg-white/5 rounded px-2 -mx-2' : ''}`}>
            <Text className={`w-8 font-mono text-sm ${user.isYou ? 'text-[#F59E0B] font-bold' : 'text-white/60'}`}>{user.rank}</Text>
            <Text className={`flex-1 text-sm ${user.isYou ? 'text-[#F59E0B] font-bold' : 'text-white/80'}`}>{user.handle}</Text>
            <Text className="font-mono text-sm text-white/60">{user.pts} pts</Text>
            {user.hasCrown && <Text className="ml-2 text-xs">👑</Text>}
          </View>
        ))}
      </View>

      <TouchableOpacity className="bg-[#F59E0B] rounded-lg py-3 flex-row justify-center items-center gap-2">
        <Text className="text-[#0D1018] font-bold text-sm">Go earn now → Open HOME</Text>
      </TouchableOpacity>
    </View>
  );
};

const SectionTitle = ({ title }) => (
  <View className="mx-4 mb-4 flex-row items-center overflow-hidden">
    <Text className="text-white/40 text-[10px] font-bold tracking-widest uppercase mr-3">─── {title}</Text>
    <View className="flex-1 h-[1px] bg-white/5" />
  </View>
);

// --- MAIN SCREEN EXPORT ---
export default function RanksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0D1018]">
      <StatusBar barStyle="light-content" backgroundColor="#0D1018" />
      
      <ScreenHeader />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Section 1 - Hero */}
        <View className="pb-8">
          <CrownHeroCard />
        </View>

        {/* Section 2 - Live Rank Cards */}
        <SectionTitle title="Your Ranks" />
        <RankCard 
          emoji="🏘️" tier="BARON" location="Sector 35, Chandigarh" 
          rank="#8" phase="🌒 Dark Tunnel"
          progress={80} progressLabel="Top 10 held"
          stats={{ score: 247, reactions: 38, delta: '+89' }}
        />
        <RankCard 
          emoji="🏙️" tier="Mayor (VICEROY)" location="Mumbai" 
          rank="#1,247" phase="⚔️ Battle Hour"
          progress={40} progressLabel="Need 192 more reactions"
        />
        <RankCard 
          emoji="🇮🇳" tier="SOVEREIGN" location="India" 
          rank="#18,994" phase="🔒 Frozen"
          progress={15} progressLabel="Need 3,400 more"
        />
        <RankCard 
          emoji="🌍" tier="IMPERATOR" location="World" 
          rank="Not in Top 10K" phase="💰 BOLI"
          progress={null} progressLabel="Keep going!"
          isMonospaced={false}
        />

        {/* Section 3 - Active Cycle */}
        <View className="mt-6">
          <SectionTitle title="Active Cycle" />
          <ActiveCyclePanel />
        </View>

        {/* Section 4 - Battle Schedule Strip */}
        <SectionTitle title="Next Freezes" />
        <View className="mx-4 mb-8 bg-[#161B26] rounded-xl border border-white/10 p-4">
          <Text className="text-white/50 text-xs font-semibold mb-4">Schedule for YOUR geographies</Text>
          {[
            { emoji: '🏘️', name: 'Sector 35 BARON', date: 'TODAY', time: '8:00 PM', wait: '2h 47m' },
            { emoji: '🏙️', name: 'Mumbai VICEROY', date: 'TODAY', time: '1:00 AM', wait: '7h 47m' },
            { emoji: '🇮🇳', name: 'India SOVEREIGN', date: 'TODAY', time: '9:00 PM', wait: '3h 47m' },
          ].map((item, i) => (
            <View key={i} className="flex-row items-center justify-between py-2 border-b border-white/5">
              <View className="flex-row items-center gap-3">
                <Text className="text-base">{item.emoji}</Text>
                <Text className="text-white/90 text-sm font-medium">{item.name}</Text>
              </View>
              <View className="flex-row items-center gap-4">
                <Text className="text-white/50 text-xs font-mono">{item.date} {item.time}</Text>
                <Text className="text-[#F59E0B] text-xs font-bold w-12 text-right">{item.wait}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity className="mt-4 flex-row items-center justify-center py-2">
            <Text className="text-white/40 text-xs font-medium">See all upcoming [+4 more]</Text>
          </TouchableOpacity>
        </View>

        {/* Section 6 - Bids */}
        <SectionTitle title="Your Bids" />
        <View className="mx-4 mb-4 bg-[#161B26] rounded-xl border border-white/10 p-4">
          <View className="flex-row justify-between items-start mb-3">
            <Text className="text-white font-bold text-sm">🏙️ Tokyo Mayor (VICEROY)</Text>
            <View className="bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20">
              <Text className="text-[#10B981] text-[10px] font-bold">ACTIVE BID</Text>
            </View>
          </View>
          <View className="bg-[#0D1018] rounded-lg p-3 border border-[#EF4444]/20 flex-row items-center gap-3">
            <AlertTriangle size={16} color={COLORS.danger} />
            <View>
              <Text className="text-[#EF4444] text-xs font-bold">You've been outbid</Text>
              <Text className="text-white/60 text-xs mt-0.5">Your bid: <Text className="font-mono text-white/80">8,400 Cr</Text>  ·  High: <Text className="font-mono text-[#F59E0B]">9,200 Cr</Text></Text>
            </View>
          </View>
        </View>
        <View className="mx-4 mb-8 bg-[#161B26] rounded-xl border border-white/5 p-4 opacity-70">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white/80 font-bold text-sm">🏘️ Sector 22, Lagos</Text>
            <View className="flex-row items-center gap-1">
              <RefreshCw size={12} color={COLORS.textMuted} />
              <Text className="text-white/50 text-[10px] font-bold">SETTLED</Text>
            </View>
          </View>
          <Text className="text-white/60 text-xs font-mono mb-1">5,000 Cr  ·  ✓ Refunded</Text>
          <Text className="text-white/40 text-[10px]">25 Apr · 2:47 PM</Text>
        </View>

        {/* Section 7 - Crown Journey Timeline */}
        <SectionTitle title="Crown Journey" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mx-4 mb-12 bg-[#161B26] rounded-xl border border-white/10 p-5">
          <View className="flex-row items-center pt-2 pb-4">
            {/* Timeline Track */}
            <View className="absolute left-0 right-0 h-0.5 bg-white/10 top-4 z-0" />
            
            {[
              { type: 'badge', title: 'Heard', date: 'Apr 3' },
              { type: 'badge', title: 'Heard', date: 'Apr 7' },
              { type: 'title', title: 'BARON\nSector 35', date: 'Apr 12' },
              { type: 'current', title: 'BARON\n(current)', date: 'Apr 17' }
            ].map((node, i) => (
              <View key={i} className="items-center mr-10 z-10 w-16">
                <View className={`w-4 h-4 rounded-full border-2 border-[#161B26] items-center justify-center mb-3
                  ${node.type === 'badge' ? 'bg-white/40' : 
                    node.type === 'title' ? 'bg-[#F5C842] w-5 h-5 rounded' : 
                    'bg-[#F59E0B] w-6 h-6 shadow-lg shadow-[#F59E0B]/50'}`}>
                </View>
                <Text className="text-white/80 text-[11px] font-bold text-center leading-tight">{node.title}</Text>
                <Text className="text-white/40 text-[10px] mt-1">{node.date}</Text>
              </View>
            ))}
            <View className="items-center z-10 w-16 opacity-50">
               <Text className="text-white/40 text-xs">→</Text>
               <Text className="text-white/40 text-[10px] mt-4">now</Text>
            </View>
          </View>
        </ScrollView>
        
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
