/**
 * components/organisms/CountryPickerSheet.tsx — v5.14
 *
 * CROWN — Country Selection Bottom Sheet
 * "The gateway to the world. Clean. Fast. Global."
 *
 * ── v5.14 CHANGELOG (global K/M/B online-count formatter) ─────────────────────
 *
 *  [v514-01] I18N — fmtCount rewritten from India-specific (L/Cr, en-IN commas)
 *            to a global K/M/B short-form. The app is used worldwide and Lakh /
 *            Crore notation is unfamiliar — and confusing — to users outside
 *            South Asia. New thresholds: ≥1,000,000,000 → "B", ≥1,000,000 → "M",
 *            ≥1,000 → "K", below that → plain en-US number. Same one-decimal-place
 *            rule as before (whole values render without a decimal, e.g. "2B" /
 *            "1.2M" / "45K" / "850").
 *
 * ── v5.13 CHANGELOG (orange rank numerals + web focus ring fix) ───────────────
 *
 *  [v513-01] VISUAL — Rank numeral colour changed gold → orange.
 *            Uses the same warm-orange base (234,88,12) as the app's bottom
 *            navigation / Africa accent, at 0.65 opacity idle / 0.75 selected.
 *            Orange is more vivid and energetic on white cards than gold, and
 *            matches the rest of the app's accent language.
 *
 *  [v513-02] WEB FIX — Browser focus ring ("black dabba") removed from search bar.
 *            Running on localhost (Expo Web / react-native-web), every browser draws
 *            a hard black outline on focused TextInput. outlineStyle:'none' in the
 *            StyleSheet is picked up by react-native-web and strips it; the property
 *            is a no-op on native iOS/Android so no platform guard is needed.
 *            The Reanimated gold glow (animatedBorderStyle) now owns the entire
 *            focus-state visual — no more system "black dabba".
 *
 * ── v5.12 CHANGELOG (golden rank numerals + divider fix) ──────────────────────
 *
 *  [v512-01] VISUAL — Rank numeral upgraded to bright golden colour.
 *            Previous: rgba(212,160,23,0.25) — the dark/muted base gold at 25%
 *            opacity looked washed-out and brownish on device. New colour uses a
 *            brighter yellow-gold base (255,200,0) at 0.60 opacity so the numerals
 *            read as clearly, unmistakably GOLDEN — warm, vivid, not dark.
 *            Active state bumped to 0.70 for a subtle selected-card pulse.
 *
 *  [v512-02] LAYOUT — RecentlyVisited sectionDivider: 6px → 1px, subtle colour.
 *            The 6px cream band above the "A" section header looked like a chunky
 *            platform divider — inconsistent with the 1px hairlines used everywhere
 *            else. Now: height:1, backgroundColor:T.borderSubtle, marginTop:0.
 *            Both sides of the "A" header now have identical thin hairlines —
 *            clean, consistent, premium.
 *
 * ── v5.11 CHANGELOG (ACTIVE badge restore + Top-10 trending) ──────────────────
 *
 *  [v511-01] UX — ACTIVE badge restored. "No one online" → "0 online".
 *            v5.10 removed the badge to "declutter", but it was the element that
 *            gave the header its premium, live feel. Restored. Simultaneously the
 *            "No one online" string was replaced with "0 online" to match HeroCard
 *            badge language — shorter, numeric, consistent across the entire sheet.
 *            New layout: 🇦🇽 Aland Islands · 0 online [ACTIVE]
 *
 *  [v511-02] FEAT — TRENDING_COUNT raised 5 → 10 (Netflix/OTT Top-10 pattern).
 *            5 cards felt incomplete for a "Trending" list. 10 completes the OTT
 *            aesthetic: watermark numerals 1–10 scroll naturally on horizontal swipe,
 *            no vertical space cost, proper leaderboard feel. HeroCardProps rank
 *            comment updated (1–5 → 1–10). Skeleton loop also expands automatically
 *            since it uses the same TRENDING_COUNT constant.
 *
 * ── v5.10 CHANGELOG (6 bugs — logic, visual, UX, Android) ─────────────────────
 *
 *  [v510-01] BUG — Recently Visited now hidden under region filters.
 *            `showRecents` was only gated on `!searchQuery`. So selecting "Asia"
 *            still showed Algeria (Africa) + Albania (Europe) in Recents. Fix:
 *            added `&& regionFilter === 'All'` — now mirrors showTrending's guard.
 *
 *  [v510-02] VISUAL — Rank numeral opacity raised: 0.12 → 0.25 (idle) / 0.30 (active).
 *            0.12 was too ghostly — numbers were nearly invisible on real hardware.
 *            0.25/0.30 lands in the sweet spot: clearly readable as a background
 *            texture without competing with the country name.
 *
 *  [v510-03] UX — "Counts at HH:MM pm" time label removed from Trending header.
 *            Static timestamps make an app feel stale. "TRENDING" alone reads as
 *            clean and real-time. RelativeTimeLabel prop removed from dep array.
 *
 *  [v510-04] LAYOUT — Hairline marginTop reduced 16 → 8 px.
 *            16px was too airy after user testing — cards looked detached from the
 *            section below. 8px gives shadow room (card shadowRadius:10 needs ≥3px)
 *            without the floaty gap.
 *
 *  [v510-05] UX — ACTIVE badge removed from header subtitle.
 *            "🇩🇿 Algeria · No one online ACTIVE" was noisy and redundant — the
 *            green LiveDot already communicates active state. Removing the badge
 *            makes the subtitle one clean line: flag + name + dot + count.
 *
 *  [v510-06] ANDROID — underlineColorAndroid="transparent" added to search TextInput.
 *            Android draws a hard black focus underline on TextInput by default.
 *            This is the system "focus ring" the user sees as a "black dabba".
 *            Setting transparent removes it; the Reanimated gold glow handles focus.
 *
 * ── v5.9 CHANGELOG (HeroCard polish — watermark rank, breathing room, badge fix) ─
 *
 *  [v59-01] VISUAL — Rank numeral downgraded to watermark opacity (0.78 → 0.12).
 *           The 0.78 opacity solid-gold numeral overpowered the country name —
 *           "Aland Islands" was illegible against "2". New idle: rgba(212,160,23,0.12)
 *           (pure watermark). Selected: rgba(212,160,23,0.16) (slightly stronger).
 *           Result: the OTT-rank aesthetic is preserved as background texture while
 *           the country name and region label remain the clear visual priority.
 *
 *  [v59-02] LAYOUT — nameGroup.right expanded: 56 → 28 px.
 *           With the numeral now at 12% opacity, text can safely overlap it.
 *           Reducing the right guard from 56 to 28 gives long country names
 *           (e.g. "Aland Islands", "United Arab Emirates") ~28 extra px of width —
 *           enough to fit on one line without truncation on most cards.
 *
 *  [v59-03] LAYOUT — 16 px breathing room added between Trending cards and hairline.
 *           The HeroCard shadow (shadowRadius:10, offset:3) needs ≥13px below the
 *           card to avoid clipping against the divider. hairline gets marginTop:16;
 *           heroScroll contentContainerStyle gains paddingVertical:10 so shadow also
 *           breathes inside the scroll content area above and below each card row.
 *
 *  [v59-04] LAYOUT — onlinePill.right tightened 11 → 8 px.
 *           Moves the badge 3px closer to the card's right edge, aligning it with
 *           the visual padding rhythm of the flag (left:12) on the other side.
 *
 * ── v5.8 CHANGELOG (HeroCard polish — gold rank, tighter height, refined badge) ─
 *
 *  [v58-01] VISUAL — Rank numeral colour upgraded to rich metallic gold.
 *           Previous idle opacity (0.25) was barely visible against white.
 *           New: rgba(212,160,23,0.78) idle · rgba(212,160,23,0.96) selected.
 *           Both states now read as clearly gold without looking garish.
 *
 *  [v58-02] LAYOUT — HeroCard height reduced 128 → 112 px.
 *           The 128px card had ~35px dead vertical space between flag and
 *           name — felt loose/unfinished. 112px closes that gap to ~14px,
 *           giving the card a tighter, more premium card feel. heroH comment
 *           updated; SkeletonHeroCard needs no position changes.
 *
 *  [v58-03] VISUAL — Online pill badge gets a hairline border for definition.
 *           rgba(0,0,0,0.05) background alone was nearly invisible on white.
 *           Added borderWidth:0.5 + borderColor:'rgba(0,0,0,0.10)' — the badge
 *           now has a subtle outlined appearance that reads as intentional UI.
 *
 * ── v5.7 CHANGELOG (OTT Ranking Card — HeroCard complete redesign) ────────────
 *
 *  [v57-01] VISUAL — HeroCard redesigned as a premium OTT-style ranking card.
 *           Previous: center-aligned vertical stack (flag → name → region → count).
 *           New layout (inspired by Netflix/Disney+ Top-10 aesthetic):
 *
 *             Top-left:     Large flag emoji (38px, no background box).
 *             Top-right:    Online status pill badge (green/grey dot + "N online").
 *             Bottom-left:  Country name (bold 13px) + region label (muted 10px).
 *             Bottom-right: Massive rank numeral (fontSize:80, metallic gold,
 *                           ~25% bleeds off the right edge — OTT clip aesthetic).
 *
 *  [v57-02] ARCH — Two-layer card structure: shadow outer + overflow-hidden inner.
 *           overflow:'hidden' on the inner View clips the bleeding rank numeral.
 *           Shadow / elevation live on the outer ReAnimated.View so they are
 *           never clipped (iOS shadow + Android elevation need a non-hidden parent).
 *
 *  [v57-03] UX — checkDot removed from HeroCard.
 *           The previous top-right check dot conflicted with the new online badge.
 *           Selected state is now communicated via border accent colour, name/
 *           region text tint, and enhanced card shadow (cardActive) — cleaner.
 *
 *  [v57-04] FEAT — rank prop added to HeroCardProps; call site passes index + 1.
 *           SkeletonHeroCard + skh StyleSheet updated to match the new positional
 *           layout (flag circle top-left, badge bar top-right, name + region
 *           bars bottom-left — no center alignment, no line3 gap bar).
 *
 * ── v5.6 CHANGELOG (HeroCard center-aligned badge redesign) ──────────────────
 *
 *  [v56-01] VISUAL — "• —" broken state fixed: "0 online" shown instead.
 *           HeroCard was rendering a green LiveDot + em-dash ("—") when
 *           onlineCount was 0 — looked like a render error. Now shows
 *           "0 online" in muted text, matching CountryRow badge behavior.
 *
 *  [v56-02] VISUAL — Region label added to HeroCard (info parity).
 *           CountryRow shows region as subtitle; HeroCard was missing it.
 *           "Asia" / "Europe" / etc. now appears between name and count row.
 *           Uses `hc.region` style: 10px muted, center-aligned. On selected
 *           state it adopts the region accent colour with the rest of the card.
 *
 *  [v56-03] VISUAL — Floating heat-track bar removed from HeroCard.
 *           The yellow `heatTrackWrap` + `heatTrack` + `heatFill` block at the
 *           bottom of each card served no legible purpose and visually floated
 *           in empty space. Removed along with the `filled` local variable.
 *           `hc.heatTrackWrap`, `hc.heatTrack`, `hc.heatFill` deleted from
 *           StyleSheet. SkeletonHeroCard `skh.heatTrackWrap` + `skh.heatBar`
 *           also removed; `skh.line3` added for region placeholder.
 *
 *  [v56-04] LAYOUT — HeroCard redesigned as center-aligned badge.
 *           Previous: left-aligned with dead right-side space.
 *           New: `alignItems:'center'` + `justifyContent:'center'` stacks all
 *           four elements (flag → name → region → count) symmetrically.
 *           Flag: 34px emoji (was 30px). Name: 13px + textAlign:'center'.
 *           Gap tightened to 4 (was 5). heroH bumped 116→128 to give content
 *           room (100px inner vs ~96px content — 4px breathing room per edge).
 *           SkeletonHeroCard updated to match: centered, line3 for region.
 * ── v5.5 CHANGELOG (CountryRow UI parity with CityPickerSheet) ───────────────
 *
 *  [v55-01] VISUAL — Heat-track bar + number removed from CountryRow.
 *           The horizontal progress bar (heatCol) and its numeric label added
 *           visual noise without user-legible meaning. Removed entirely, freeing
 *           space on the right side for the new badge (v55-03). `heatFill` local
 *           variable also removed from CountryRow (HeroCard keeps its own copy).
 *
 *  [v55-02] VISUAL — Subtitle replaced: online-status → region label.
 *           CountryRow meta row previously showed "No one online" / "1K online"
 *           (a green/grey dot + text). Replaced with a plain region text label
 *           ("Asia", "Europe", "Americas", …) matching the City picker's subtitle
 *           pattern. Uses new `cr.regionLabel` / `cr.regionLabelActive` styles.
 *
 *  [v55-03] VISUAL — Online-count badge added right of body, left of arrow.
 *           A pill-shaped badge (dot + "{n} online") now sits between the country
 *           body and the chevron/check, exactly matching the CityPickerSheet badge
 *           position and style. Uses `cr.onlineBadge`, `cr.onlineBadgeActive`,
 *           `cr.badgeDot`, `cr.badgeText` styles. Badge dot is T.green when
 *           count > 0, T.border when zero. Background tints to DV.activeRowBg
 *           when row is selected. Text adopts region accent colour when selected.
 *
 *  [v55-STYLE-FIX] CRITICAL — StyleSheet cr block fully updated.
 *           Previous v5.5 pass correctly updated CountryRow JSX but left the
 *           StyleSheet unchanged: new styles were referenced but never defined
 *           (runtime crash), and 8 stale entries remained as dead code.
 *           This pass: removes `meta`, `dotStatic`, `count`, `countActive`,
 *           `heatCol`, `heatTrack`, `heatFill`, `heatNum`; adds `regionLabel`,
 *           `regionLabelActive`, `onlineBadge`, `onlineBadgeActive`, `badgeDot`,
 *           `badgeText`. JSX and StyleSheet are now fully in sync.
 *
 * ── v5.4 CHANGELOG (CRITICAL — sheet now actually opens) ─────────────────────
 *
 *  THE BUG: tapping the country scope did nothing — the sheet never opened, while
 *  the City and Sector sheets opened fine. Root cause: a previous pass migrated
 *  ONLY this sheet to @gorhom/bottom-sheet, a library that is NOT in package.json
 *  and that the app is not wired for (no provider, everything else uses the
 *  in-house sheet). The import could not resolve, so the component never rendered.
 *
 *  THE FIX: reverted the sheet shell to the app's own Modal-based BottomSheet
 *  (`@/components/BottomSheet`) — the exact component CityPickerSheet and
 *  SectorPickerSheet use. It renders inside a React Native <Modal>, so it overlays
 *  the whole app and opens purely from the `visible` prop. No external dependency,
 *  no root provider, no ref. Net effect: this sheet now opens identically to its
 *  siblings, in this one file, with nothing else to install.
 *
 *  What changed mechanically:
 *    • import BottomSheet from '@/components/BottomSheet' (was @gorhom/bottom-sheet).
 *    • <BottomSheet visible/onClose/maxHeight/style> (was ref + snapPoints + backdrop).
 *    • BottomSheetFlatList  → plain react-native FlatList.
 *    • BottomSheetTextInput → plain react-native TextInput.
 *    • Removed sheetRef, snapPoints, renderBackdrop, handleSheetClose/Change, and
 *      the snapToIndex open/close effect — the host Modal + `visible` handle all of it.
 *    • onSheetIndexChange (bottom-nav hide/show) is preserved: it now fires 0 on
 *      open and -1 on close from the `visible` effect.
 *    • Single fixed sheet height (≈90% screen) replaces the 55%/92% snap pair; the
 *      search box sits at the top so the keyboard never covers it.
 *
 *  ALL v5.3 work below (search relevance, selected-row accent rail, input hardening,
 *  switching-overlay a11y) and every earlier business-logic fix is fully preserved.
 *  NOTE: the v5.0–v5.3 notes below are HISTORICAL — they document the gorhom era,
 *  which v5.4 supersedes.
 *
 * ── v5.3 CHANGELOG (Polish Pass — search relevance, a11y, visual, docs) ───────
 *
 *  [v53-01] UX — Relevance-ranked search results.
 *           Results were filtered but kept "busiest first" order, so typing
 *           "in" could float a high-traffic territory above India. displayCountries
 *           now ranks matches: exact ISO → exact name → name-prefix → dial-prefix →
 *           substring, with onlineCount as the in-tier tie-break. Browse mode is
 *           untouched. Row structure / heights are identical, so getItemLayout and
 *           every empty-state check remain valid (only the order of matches changes).
 *
 *  [v53-02] VISUAL — Selected country rows now carry a region-accent left edge bar.
 *           The tinted background + bold name read as "selected" but scanned weakly
 *           in a long list. A 3px rounded accent rail (region colour) hugs the left
 *           gutter, matching the accent already used on selected HeroCards. Purely
 *           decorative (pointerEvents none) — no layout shift, no hit-area change.
 *
 *  [v53-03] A11Y — Search input hardened + switching overlay announced.
 *           BottomSheetTextInput: spellCheck=false / autoComplete="off" /
 *           textContentType="none" / maxLength=40 — stops red squiggles under
 *           country names, keyboard autofill chips, and iOS strong-password offers
 *           on a pure search box. The switching overlay now exposes an
 *           accessibilityLabel so VoiceOver/TalkBack announce the country change.
 *
 *  [v53-04] DOCS — Corrected the dependency contract to match package.json:
 *           Reanimated is v4 (with react-native-worklets), not v3, and the worklets
 *           babel plugin ships inside babel-preset-expo on SDK 54 (no manual entry).
 *           NOTE: @gorhom/bottom-sheet must be present in package.json — install a
 *           v5.1.6+ release (the first line that officially supports Reanimated v4).
 *
 * ── v5.2 CHANGELOG (5 Critical Bugs Resolved) ────────────────────────────────
 *
 *  [FIX-v52-01] CRITICAL — getItemLayout search-results math corruption fixed.
 *               buildSearchResults inserts 1px dividers between country rows.
 *               The old formula returned 74px for ALL items including dividers,
 *               making FlatList's internal scroll map wrong from index 1 onward.
 *               New: even indices = Country (74px), odd = Divider (1px).
 *
 *  [FIX-v52-02] CRITICAL — handleSelect UI freeze prevented.
 *               setSheetState('idle') and setSwitchingTo(null) were inside the
 *               try block after onSelect(). If onSelect threw, the spinner froze
 *               permanently. Both resets moved to finally — unconditionally runs.
 *
 *  [FIX-v52-03] PERFORMANCE — tickNow extracted into RelativeTimeLabel component.
 *               setInterval was calling setTickNow every 60s on the root component,
 *               forcing a full re-render of CountryPickerSheetBase every minute.
 *               Now only the small time-label Text re-renders.
 *
 *  [FIX-v52-04] RACE CONDITION — Promise.all for initial data load.
 *               AsyncStorage.getItem (recents) and fetchCountries() now resolve
 *               as one atomic batch via Promise.all, eliminating the "recents
 *               pop-in after countries render" layout thrash.
 *
 *  [FIX-v52-05] ARCHITECTURAL — shimmer + PulseContext fully migrated to Reanimated.
 *               shimmerAnim: useSharedValue + withRepeat (was Animated.loop).
 *               PulseProvider: useSharedValue + withRepeat (was Animated.loop).
 *               usePulse: returns SharedValue<number> (was Animated.Value).
 *               LiveDot: ReAnimated.View + useAnimatedStyle (was Animated.View).
 *               SkeletonRow / SkeletonHeroCard: ReAnimated.View + interpolate.
 *               RN Animated library now only used for HeroCard/CountryRow scale springs
 *               (useNativeDriver:true; no JS-thread blocking).
 *
 * ── v5.1 CHANGELOG (Performance & Architecture Fixes) ────────────────────────
 *
 *  [FIX-01] CRITICAL — Re-render loop on A-Z pan drag resolved.
 *           `activeAlphaLetter` state moved from CountryPickerSheetBase into a
 *           new `AlphaSidebarAndOverlay` component. Pan frames now re-render only
 *           that tiny wrapper — not the heavy FlatList parent.
 *
 *  [FIX-02] CRITICAL — Search filter pre-computation.
 *           `normalizeDiacritics(c.name)` and `dialCode.replace(/\D/g,'')` used
 *           to run for every country on every keystroke. Both are now computed
 *           once in `mapFSDoc` and stored as `normalizedName` / `cleanDialCode`
 *           fields on CountryDoc.
 *
 *  [FIX-03] ARCHITECTURAL — Eliminated all `useNativeDriver:false` Animated usage.
 *           `searchBorderAnim` → Reanimated `useSharedValue` + `interpolateColor`.
 *           `pillsHeight / pillsOpacity` → Reanimated `useSharedValue` + `withTiming`.
 *           `flashAnim` in CountryRow → Reanimated `withSequence`.
 *           All animations now run on the UI thread with zero JS involvement.
 *
 *  [FIX-04] ARCHITECTURAL — BottomSheetView outerWrapper replaced with plain View.
 *           Eliminates gesture arbitration hijacking on Android where
 *           BottomSheetFlatList scroll could stall. BottomSheetFlatList still
 *           registers with the sheet's gesture coordinator via React context.
 *
 *  [FIX-05] ARCHITECTURAL — handleSelect: AsyncStorage calls are now fire-and-forget.
 *           `await` before disk I/O was introducing micro-lag before the sheet
 *           could dismiss. State updates happen in the `.then()` callback instead.
 *
 *  [FIX-07] MINOR — usePulse fallback Animated.Value is now lazily initialized.
 *           Previously allocated unconditionally on every usePulse call even when
 *           a PulseProvider was present.
 *
 *  [FIX-08] MINOR — Haptic helpers wrapped in try/catch.
 *           Certain custom Android ROMs restrict vibration APIs and can throw.
 *
 *  [FIX-09] MINOR — Space-only search query guard.
 *           Pills collapse animation and displayCountries filter now use
 *           `rawQuery.trim()` / `searchQuery.trim()` to ignore whitespace-only input.
 *
 *  [FIX-12] MINOR — Cache write failure now logged in __DEV__ mode.
 *
 * ── v5.0 CHANGELOG (Real Gorhom Integration) ─────────────────────────────────
 *
 *  Root Cause Fix: The previous "v4.0" file shipped a hand-rolled Modal +
 *  PanResponder BottomSheet in place of the real @gorhom/bottom-sheet library.
 *  Because both the PanResponder and FlatList ran on the JS thread, gesture
 *  arbitration (sheet-pan vs. inner-list-scroll) had an unavoidable one-frame
 *  delay on every gesture — the "sticky first frame" problem. This release
 *  deletes that shim entirely and wires up the real library.
 *
 *  [v5-ARCH-01] Deleted the 314-line local BottomSheet / BottomSheetView /
 *               BottomSheetFlatList / BottomSheetBackdrop shim. All four now
 *               come from @gorhom/bottom-sheet v5. Gesture arbitration
 *               (sheet-pan vs. list-scroll) now runs on the UI thread via
 *               Reanimated v3 shared-value worklets — zero JS involvement on
 *               every scroll frame.
 *
 *  [v5-ARCH-02] Replaced plain <TextInput> with <BottomSheetTextInput>.
 *               Gorhom's wrapper ensures keyboard show/hide is coordinated with
 *               the sheet's layout, eliminating the keyboard-covers-list bug on
 *               Android that the old kbH paddingBottom workaround tried to fix.
 *
 *  [v5-ARCH-03] Removed handleListScroll (dragBy) and handleListScrollEndDrag
 *               (snapBack / close). Both called non-existent methods on the real
 *               BottomSheet ref and their close() call could fire redundantly.
 *               gorhom's enablePanDownToClose handles the full dismiss gesture
 *               natively — when the list is at offset 0 and the user pulls down,
 *               the sheet collapses / closes with proper velocity physics on the
 *               UI thread. onScroll / scrollEventThrottle / onScrollEndDrag props
 *               have been removed from BottomSheetFlatList accordingly.
 *
 *  [v5-ARCH-04] Removed onContentSizeChange adaptive-height logic (setHeight).
 *               setHeight was a custom method on the shim ref; it does not exist
 *               on the real BottomSheet. The two snap-point system (55% / 92%)
 *               is sufficient for all content volumes. searchQueryRef and its
 *               sync useEffect (whose sole consumer was onContentSizeChange)
 *               have been removed to keep the component clean.
 *
 *  [v5-ARCH-05] sheetRef is now typed as BottomSheet (the gorhom default export)
 *               instead of the removed local BottomSheetHandle interface.
 *               The imperative API used — snapToIndex(0|1) and close() — is
 *               identical to the real library.
 *
 * ── PRESERVED FROM v4.0 (zero changes) ───────────────────────────────────────
 *
 *  All business logic: Firebase fetch, buildAlphaSections, buildSearchResults,
 *  precomputeLayouts, normalizeDiacritics, mapFSDoc, mapToRegion, computeHeat,
 *  heatColour, fmtCount, fetchCountries, cache-first AsyncStorage strategy,
 *  jitter TTL, race-protection fetchIdRef, migrateRecentsCache.
 *
 *  All state: sheetState, rawQuery / searchQuery debounce, regionFilter, error,
 *  reducedMotion, recentIds, fetchedAt, switchingTo, isRefreshing, tickNow,
 *  activeAlphaLetter.
 *
 *  All handlers: handleSelect (FIX-SWITCHING), handleRetry (MED-06),
 *                handleRefresh (ADD-03), handleAlphabetPress, handleRegion,
 *                handleSearchFocus (auto-snap to 92%), handleSearchBlur,
 *                renderBackdrop (BottomSheetBackdrop, pressBehavior="close").
 *
 *  All sub-components: LiveDot, SectionHeader, HeroCard (stagger entry),
 *                      CountryRow (flash animation), RowDivider, RegionPill,
 *                      AlphabetSidebar, LetterOverlay (spring/ease-out),
 *                      RecentlyVisitedSection, SkeletonRow, SkeletonHeroCard,
 *                      PulseProvider / PulseContext.
 *
 *  All animations: search bar glow (v4-FEAT-01), HeroCard stagger SlideInRight
 *                  (v4-FEAT-02), SwitchingOverlay FadeIn 150ms (v4-FEAT-03),
 *                  CountryRow flash (v4-FEAT-04), AnimatedPillsRow
 *                  height+opacity (v4-ARCH-06), LetterOverlay spring enter /
 *                  ease-out exit (v4-FEAT-04a), empty state FadeIn (v4-FEAT-07).
 *
 *  All layout: merged title row (v4-ARCH-05), pinned shell / FlatList split,
 *              A-Z alphabet sidebar, adaptive paddingRight for alpha bar, all
 *              StyleSheet.create blocks (sh, sk, skh, sec, hc, cr, ab, lo, rv,
 *              rp).
 *
 * ── PREREQUISITES ─────────────────────────────────────────────────────────────
 *   @/components/BottomSheet      — the app's in-house Modal sheet (already present;
 *                                   used by City & Sector pickers). No external
 *                                   bottom-sheet library and no root provider needed.
 *   react-native-reanimated v4   — paired with react-native-worklets. The worklets
 *                                  babel plugin ships inside babel-preset-expo (SDK 54),
 *                                  so no manual babel.config.js plugin entry is needed.
 *   GestureHandlerRootView at app root — already present in app/_layout.tsx (used by
 *                                  the A-Z sidebar PanResponder; standard RN setup).
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *
 *   // Mount ALWAYS (not inside a conditional) for smooth gorhom behavior:
 *   <CountryPickerSheet
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     selected="IN"
 *     onSelect={(id, name, emoji) => { … }}
 *   />
 *
 * ── FIREBASE CONFIG ───────────────────────────────────────────────────────────
 *   Adjust @/lib/firebase import path if your db lives elsewhere.
 *   ADD-09: dialCode requires a `dial_code` field in Firestore (e.g. "+91").
 *           If absent, dial-code search silently degrades to name+ISO matching.
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  type GestureResponderEvent,
  type AccessibilityActionEvent,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather }       from '@expo/vector-icons';
import * as Haptics      from 'expo-haptics';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';

// ── In-house BottomSheet ──────────────────────────────────────────────────────
// [v54] Uses the app's own Modal-based BottomSheet — the SAME component the
// City and Sector pickers use. It renders inside a React Native <Modal>, so it
// reliably overlays the whole app and opens purely from the `visible` prop (no
// ref, no snap points, no external library, no root provider). This is what makes
// the sheet actually open; the previous @gorhom/bottom-sheet build never opened
// because that library was never installed and the app isn't wired for it.
import { BottomSheet } from '@/components/BottomSheet';

// ── react-native-reanimated v4 (with react-native-worklets) ───────────────────
// Used for: HeroCard stagger entry, LetterOverlay spring, SwitchingOverlay fade,
// search-bar glow, pills collapse, skeleton shimmer — all on the UI thread.
import ReAnimated, {
  Easing as REasing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';

import { db }                    from '@/lib/firebase';
import { palette }               from '@/constants/colors';
import { FONT_BODY, FONT_HEADING } from '@/constants/typography';

// [v54] Sheet height — a fixed tall sheet (≈90% screen) so the long country list
// always has room and there is zero height jump between loading and idle states.
const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.9);

// ─── Storage keys ──────────────────────────────────────────────────────────────
const CW_COUNTRY_KEY  = '@cw/country_id'           as const;
const CW_RECENTS_KEY  = '@cw/recent_countries_v3'  as const;
const MAX_RECENTS     = 3                           as const;
const TRENDING_COUNT  = 10                          as const;  // [v511-02] Top-10 OTT pattern (was 5)
const MAX_RETRIES     = 3                           as const;

// ─── Country cache (AsyncStorage) ─────────────────────────────────────────────
const COUNTRIES_CACHE_KEY = '@cw/countries_v2'     as const;
const COUNTRIES_CACHE_TTL = 6 * 60 * 60 * 1000    as const;

// ─── Layout constants ──────────────────────────────────────────────────────────
const L = {
  rowH:         74,
  sectionH:     34,
  divH:          1,
  rowPadH:      16,
  flagBox:      48,
  flagRadius:   14,
  flagEmoji:    30,
  heroW:       154,
  heroH:       112,  // [v58] -16px: closes dead mid-card gap, tighter premium feel
  heroR:        20,
  heatW:        48,
  heatH:         4,
  heatR:         2,
  searchH:      52,
  handleW:      44,
  handleH:       5,
  closeBtn:     44,
  shimmerRows:   7,
  shimmerDur:  1200,
  pillH:        34,
  // [v4-ARCH-06] Expanded pill row height = pillH + vertical padding (9*2)
  pillRowH:     52,
  alphaItemH:   18,
  alphaBarW:    22,
} as const;

// ─── Design token aliases ──────────────────────────────────────────────────────
const T = {
  sheetBg:       '#FFFFFF',
  text:          palette.ink[950],
  textSecondary: palette.ink[600],
  textTertiary:  palette.ink[400],
  textMuted:     palette.ink[200],
  surfaceSunken: palette.cream[100],
  surfaceWell:   palette.cream[200],
  border:        palette.cream[300],
  borderSubtle:  palette.cream[200],
  gold:          palette.gold[600],
  goldLight:     palette.gold[300],
  goldDim:       palette.gold[200],
  goldSubtle:    palette.gold[100],
  green:         palette.emerald[500],
  emerald:       palette.emerald[600],
  amber:         palette.amber[600],
} as const;

// ─── Derived overlay values ────────────────────────────────────────────────────
const DV = {
  activeRowBg:    'rgba(212,160,23,0.09)' as const,
  activeRowBorder:'rgba(212,160,23,0.24)' as const,
  sectionBg:      'rgba(255,255,255,0.97)'as const,
  switchOverlay:  'rgba(255,255,255,0.93)'as const,
  regionBlue:     'rgba(59,130,246,1)'   as const,
  regionPurple:   'rgba(139,92,246,1)'   as const,
  regionRed:      'rgba(220,38,38,1)'    as const,
} as const;

// ─── Haptic helpers ────────────────────────────────────────────────────────────
// [FIX-08] try/catch: some custom Android ROMs restrict vibration APIs and throw.
const hapticLight  = async (): Promise<void> => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  } catch { /* no-op */ }
};
const hapticMedium = async (): Promise<void> => {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { /* no-op */ }
};
const hapticSelect = async (): Promise<void> => {
  try { await Haptics.selectionAsync(); } catch { /* no-op */ }
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type Region = 'Asia' | 'Americas' | 'Africa' | 'Europe' | 'Oceania' | 'Middle East';
type RegionFilter = 'All' | Region;

type SectionItem  = { type: 'section'; letter: string };
type CountryItem  = { type: 'country'; country: CountryDoc };
type DividerItem  = { type: 'divider'; id: string };
type ListItem     = SectionItem | CountryItem | DividerItem;

export interface CountryDoc {
  id:             string;
  name:           string;
  emoji:          string;
  onlineCount:    number;
  heat:           number;
  region:         Region;
  dialCode?:      string;
  /** [FIX-02] Pre-computed at fetch time — avoids regex/normalize on every search keystroke */
  normalizedName: string;
  /** [FIX-02] Pre-computed at fetch time — digits only, e.g. "91" for "+91" */
  cleanDialCode:  string;
}

export interface CountryPickerSheetProps {
  visible:  boolean;
  onClose:  () => void;
  selected: string;
  onSelect: (countryId: string, name: string, emoji: string) => void;
  /**
   * [BOTTOM-NAV] Optional: fires with gorhom snap index on every sheet change.
   * index === -1  → sheet fully closed  → show bottom nav
   * index >= 0   → sheet open (55% or 92%) → hide bottom nav
   *
   * Usage in parent screen:
   *   onSheetIndexChange={(i) =>
   *     navigation.setOptions({ tabBarStyle: i === -1 ? undefined : { display: 'none' } })
   *   }
   */
  onSheetIndexChange?: (index: number) => void;
}

// [TS-04] Exported so parent apps can type Firestore pre-fetches without copying this interface.
export interface FSCountry {
  name?:         string;
  flag?:         string;
  iso2?:         string;
  continent?:    string;
  online_count?: number;
  is_active?:    boolean;
  capital?:      string;
  dial_code?:    string;
}

// [CRIT-05] expiresAt stored with jitter to spread cache invalidations across users
interface CountryCacheEntry {
  data:      CountryDoc[];
  fetchedAt: number;
  expiresAt: number;
}

// ─── Region color system ───────────────────────────────────────────────────────
const MIDDLE_EAST_ISO = new Set<string>([
  'AE','BH','IQ','IR','IL','JO','KW','LB','OM','PS','QA','SA','SY','YE',
]);

const REGION_FLAG_BG: Record<Region, string> = {
  'Asia':        'rgba(212,160,23,0.14)',
  'Americas':    'rgba(16,185,129,0.13)',
  'Africa':      'rgba(212,101,26,0.14)',
  'Europe':      'rgba(59,130,246,0.12)',
  'Oceania':     'rgba(139,92,246,0.12)',
  'Middle East': 'rgba(220,38,38,0.11)',
};

const REGION_ACCENT: Record<Region, string> = {
  'Asia':        T.gold,
  'Americas':    T.emerald,
  'Africa':      T.amber,
  'Europe':      DV.regionBlue,
  'Oceania':     DV.regionPurple,
  'Middle East': DV.regionRed,
};

const REGION_FILTERS: RegionFilter[] = [
  'All','Asia','Europe','Americas','Africa','Oceania','Middle East',
];

// ─── Utility: diacritic normalization ─────────────────────────────────────────
function normalizeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Utility: Region mapping ───────────────────────────────────────────────────
function mapToRegion(continent: string, iso2: string): Region {
  if (MIDDLE_EAST_ISO.has(iso2)) return 'Middle East';
  switch (continent?.trim()) {
    case 'Africa':              return 'Africa';
    case 'Europe':              return 'Europe';
    case 'Oceania':
    case 'Australia/Oceania':
    case 'Australia & Oceania': return 'Oceania';
    case 'Asia':                return 'Asia';
    case 'North America':
    case 'South America':
    case 'Central America':
    case 'Americas':            return 'Americas';
    default:
      if (__DEV__ && continent?.trim()) {
        console.warn(
          `[CountryPickerSheet] Unknown continent: "${continent}" for ${iso2} — defaulting to Asia`,
        );
      }
      return 'Asia';
  }
}

// ─── Utility: Heat score ───────────────────────────────────────────────────────
function computeHeat(n: number): number {
  if (n <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(n + 1) / 5) * 100));
}

function heatColour(heat: number): string {
  if (heat >= 75) return T.emerald;
  if (heat >= 50) return T.gold;
  if (heat >= 25) return T.amber;
  return T.border;
}

// ─── Utility: Global short-count formatter (K/M/B) ─────────────────────────────
function fmtCount(n: number): string {
  if (n <= 0) return '0';
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return n.toLocaleString('en-US');
}

// ─── Firestore mapper ──────────────────────────────────────────────────────────
function mapFSDoc(docId: string, data: Partial<FSCountry>): CountryDoc {
  const iso2         = ((data.iso2 ?? docId) as string).toUpperCase();
  const onlineCount  = Number(data.online_count ?? 0);
  const name         = data.name ?? iso2;
  const dialCode     = data.dial_code;
  return {
    id:             iso2,
    name,
    emoji:          data.flag ?? '🌐',
    onlineCount,
    heat:           computeHeat(onlineCount),
    region:         mapToRegion(data.continent ?? '', iso2),
    dialCode,
    // [FIX-02] Pre-computed once here — zero cost in the search filter hot-path.
    // Previously normalizeDiacritics(c.name) ran for every country on every keystroke.
    normalizedName: normalizeDiacritics(name),
    cleanDialCode:  dialCode?.replace(/\D/g, '') ?? '',
  };
}

// ─── [FEAT-06] One-time recents cache migration: v2 → v3 ──────────────────────
// Users upgrading from the previous version would silently lose their recently-
// visited list. Run once on mount; safe to call multiple times (guarded by v3 key).
async function migrateRecentsCache(): Promise<void> {
  try {
    const v2 = await AsyncStorage.getItem('@cw/recent_countries_v2');
    if (!v2) return;
    const alreadyMigrated = await AsyncStorage.getItem(CW_RECENTS_KEY);
    if (alreadyMigrated) {
      await AsyncStorage.removeItem('@cw/recent_countries_v2');
      return;
    }
    await AsyncStorage.setItem(CW_RECENTS_KEY, v2);
    await AsyncStorage.removeItem('@cw/recent_countries_v2');
  } catch { /* non-critical */ }
}

// ─── Firestore fetch — cache-first (AsyncStorage) ─────────────────────────────
async function fetchCountries(bypassCache = false): Promise<[CountryDoc[], number]> {
  if (!bypassCache) {
    try {
      const raw = await AsyncStorage.getItem(COUNTRIES_CACHE_KEY);
      if (raw) {
        const entry = JSON.parse(raw) as CountryCacheEntry;
        if (Date.now() < entry.expiresAt) {
          return [entry.data, entry.fetchedAt];
        }
      }
    } catch { /* cache miss — fall through */ }
  }

  const snap = await getDocs(
    query(collection(db, 'countries'), where('is_active', '==', true)),
  );
  const docs = snap.docs.map((d) => mapFSDoc(d.id, d.data() as Partial<FSCountry>));
  docs.sort((a, b) =>
    b.onlineCount !== a.onlineCount
      ? b.onlineCount - a.onlineCount
      : a.name.localeCompare(b.name),
  );

  // [CRIT-05] Jitter ±30 min prevents thundering herd on TTL expiry
  const fetchedAt = Date.now();
  const jitterMs  = (Math.random() - 0.5) * 60 * 60 * 1000;
  const expiresAt = fetchedAt + COUNTRIES_CACHE_TTL + jitterMs;
  AsyncStorage.setItem(
    COUNTRIES_CACHE_KEY,
    JSON.stringify({ data: docs, fetchedAt, expiresAt } as CountryCacheEntry),
  ).catch((e) => {
    // [FIX-12] Surface cache write failures in dev — user never sees stale data silently
    if (__DEV__) console.warn('[CountryPickerSheet] cache write failed (storage full?):', e);
  });

  return [docs, fetchedAt];
}

// ─── Build A-Z grouped flat-list data ─────────────────────────────────────────
// [HIGH-04] Takes a PRE-SORTED array (caller handles sort). No internal sort.
function buildAlphaSections(sorted: CountryDoc[]): ListItem[] {
  const items: ListItem[] = [];
  let prevLetter     = '';
  let prevWasSection = true;

  for (const country of sorted) {
    const letter = country.name[0]?.toUpperCase() ?? '#';
    if (letter !== prevLetter) {
      items.push({ type: 'section', letter });
      prevLetter     = letter;
      prevWasSection = true;
    } else if (!prevWasSection) {
      items.push({ type: 'divider', id: `div-${country.id}` });
    }
    items.push({ type: 'country', country });
    prevWasSection = false;
  }
  return items;
}

function buildSearchResults(countries: CountryDoc[]): ListItem[] {
  return countries.flatMap((c, i) =>
    i === 0
      ? [{ type: 'country', country: c } as CountryItem]
      : [{ type: 'divider', id: `sdiv-${c.id}` } as DividerItem, { type: 'country', country: c } as CountryItem],
  );
}

function precomputeLayouts(
  data: ListItem[],
): Array<{ length: number; offset: number; index: number }> {
  const out: Array<{ length: number; offset: number; index: number }> = [];
  let offset = 0;
  for (let i = 0; i < data.length; i++) {
    const item   = data[i]!;
    const length =
      item.type === 'section' ? L.sectionH :
      item.type === 'divider' ? L.divH     :
      L.rowH;
    out.push({ length, offset, index: i });
    offset += length;
  }
  return out;
}

// ─── [BUG-03] PulseContext — instance-safe, ref-counted pulse animation ────────
// [FIX-05] Migrated from RN Animated to Reanimated SharedValue so the pulse
// opacity loop runs entirely on the UI thread.
interface _PulseCtx {
  anim:     SharedValue<number>; // was Animated.Value
  register: () => () => void;
}

const PulseContext = React.createContext<_PulseCtx | null>(null);

const PulseProvider = memo<{ children: React.ReactNode }>(({ children }) => {
  const anim = useSharedValue(1);
  const refs = useRef(0);

  const register = useCallback((): (() => void) => {
    refs.current++;
    if (refs.current === 1) {
      // [FIX-05] withRepeat(-1) = infinite; false = don't auto-reverse (withSequence handles it)
      anim.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 850 }),
          withTiming(1.0, { duration: 850 }),
        ),
        -1,
        false,
      );
    }
    return () => {
      refs.current = Math.max(0, refs.current - 1);
      if (refs.current === 0) {
        cancelAnimation(anim);
        anim.value = withTiming(1, { duration: 150 }); // smooth reset to fully visible
      }
    };
  }, [anim]);

  const ctx = useMemo(() => ({ anim, register }), [anim, register]);

  return <PulseContext.Provider value={ctx}>{children}</PulseContext.Provider>;
});

function usePulse(enabled: boolean): SharedValue<number> {
  const ctx = React.useContext(PulseContext);
  // [FIX-05] useSharedValue(1) is the fallback for tests/Storybook (no PulseProvider).
  // Called unconditionally (hook rules) — lightweight in the normal app path since ctx always exists.
  const fallback = useSharedValue(1);

  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.register();
  }, [enabled, ctx]);

  return ctx ? ctx.anim : fallback;
}

// ─── LiveDot ───────────────────────────────────────────────────────────────────
const LiveDot = memo<{ size?: number; gold?: boolean; pulse?: boolean }>(
  ({ size = 7, gold = false, pulse = false }) => {
    const anim     = usePulse(pulse);
    // [FIX-05] useAnimatedStyle reads SharedValue — runs on UI thread
    const animStyle = useAnimatedStyle(() => ({
      opacity: pulse ? anim.value : 1,
    }));
    return (
      <ReAnimated.View
        style={[
          {
            width:           size,
            height:          size,
            borderRadius:    size / 2,
            backgroundColor: gold ? T.gold : T.green,
          },
          animStyle,
        ]}
        accessible={false}
      />
    );
  },
);

// ─── SkeletonRow ───────────────────────────────────────────────────────────────
// [FIX-05] shimmer is now SharedValue<number> — opacity interpolation on UI thread
const SkeletonRow = memo<{ shimmer: SharedValue<number> }>(({ shimmer }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.8]),
  }));
  return (
    <View style={sk.row}>
      <ReAnimated.View style={[sk.flag, animStyle]} />
      <View style={sk.body}>
        <ReAnimated.View style={[sk.line1, animStyle]} />
        <ReAnimated.View style={[sk.line2, animStyle]} />
      </View>
      <ReAnimated.View style={[sk.heat, animStyle]} />
    </View>
  );
});

const sk = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', paddingHorizontal:L.rowPadH, height:L.rowH, gap:14 },
  flag:  { width:L.flagBox, height:L.flagBox, borderRadius:L.flagRadius, backgroundColor:T.surfaceWell },
  body:  { flex:1, gap:8 },
  line1: { height:14, borderRadius:7, backgroundColor:T.surfaceWell, width:'60%' as const },
  line2: { height:11, borderRadius:6, backgroundColor:T.surfaceWell, width:'38%' as const },
  heat:  { width:L.heatW, height:8, borderRadius:4, backgroundColor:T.surfaceWell },
});

// ─── [ADD-10] SkeletonHeroCard ─────────────────────────────────────────────────
// [FIX-05] shimmer is now SharedValue<number> — opacity interpolation on UI thread.
// [v57-04] Updated to mirror the new OTT ranking card layout:
//           flag circle top-left, badge bar top-right, name + region bars bottom-left.
const SkeletonHeroCard = memo<{ shimmer: SharedValue<number> }>(({ shimmer }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.25, 0.75]),
  }));
  return (
    <ReAnimated.View style={[skh.card, animStyle]}>
      {/* Top-left: flag circle placeholder */}
      <ReAnimated.View style={[skh.flag,   animStyle]} />
      {/* Top-right: badge bar placeholder */}
      <ReAnimated.View style={[skh.badge,  animStyle]} />
      {/* Bottom-left: country name bar */}
      <ReAnimated.View style={[skh.name,   animStyle]} />
      {/* Below name: region bar */}
      <ReAnimated.View style={[skh.region, animStyle]} />
    </ReAnimated.View>
  );
});

const skh = StyleSheet.create({
  // [v57] OTT card skeleton — mirrors the new HeroCard positional layout.
  // Previous centered line1/line2/line3 layout replaced with absolute-positioned
  // placeholders that match each element's actual position on the real card.
  card: {
    width:           L.heroW,
    height:          L.heroH,
    borderRadius:    L.heroR,
    borderWidth:     1.5,
    borderColor:     T.border,
    backgroundColor: T.surfaceWell,
  },
  // Flag circle — top-left (matches hc.flag top:11, left:12, fontSize:38)
  flag: {
    position:        'absolute',
    top:             11,
    left:            12,
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: T.surfaceSunken,
  },
  // Badge bar — top-right (matches hc.onlinePill top:11, right:11)
  badge: {
    position:        'absolute',
    top:             14,
    right:           11,
    width:           60,
    height:          14,
    borderRadius:    7,
    backgroundColor: T.surfaceSunken,
  },
  // Name bar — bottom-left (matches hc.name in nameGroup bottom:12, left:12)
  name: {
    position:        'absolute',
    bottom:          30,
    left:            12,
    width:           74,
    height:          13,
    borderRadius:    7,
    backgroundColor: T.surfaceSunken,
  },
  // Region bar — below name (matches hc.region marginTop:2)
  region: {
    position:        'absolute',
    bottom:          12,
    left:            12,
    width:           44,
    height:          10,
    borderRadius:    5,
    backgroundColor: T.surfaceSunken,
  },
});

// ─── SectionHeader ─────────────────────────────────────────────────────────────
const SectionHeader = memo<{ letter: string }>(({ letter }) => (
  <View style={sec.wrap} accessibilityRole="header">
    <Text
      style={sec.letter}
      accessibilityLabel={`Countries starting with ${letter}`}
    >
      {letter}
    </Text>
  </View>
));

const sec = StyleSheet.create({
  wrap: {
    height:            L.sectionH,
    paddingHorizontal: L.rowPadH,
    justifyContent:    'center',
    backgroundColor:   DV.sectionBg,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSubtle,
  },
  letter: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    fontFamily:    FONT_BODY.bold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
});

// ─── HeroCard ──────────────────────────────────────────────────────────────────
// [v4-FEAT-02] Added entryDelay + reducedMotion for stagger entry animation.
// [v57-04]     Added rank: the card's 1-based position in the trending list.
//              Rendered as a massive numeral bleeding off the right edge.
interface HeroCardProps {
  country:        CountryDoc;
  isSelected:     boolean;
  onPress:        (country: CountryDoc) => void;
  rank:           number;        // [v511] 1-based trending position (1–10, was 1–5)
  entryDelay?:    number;        // ms delay for stagger (0, 40, 80, 120, 160)
  reducedMotion?: boolean;       // skip animation for accessibility
}

const HeroCard = memo<HeroCardProps>(({
  country,
  isSelected,
  onPress,
  rank,
  entryDelay    = 0,
  reducedMotion = false,
}) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const accent = REGION_ACCENT[country.region] as string;

  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() =>
    Animated.spring(scale, { toValue:0.94, useNativeDriver:true, speed:50, bounciness:0 }).start(),
  [scale]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue:1.00, useNativeDriver:true, speed:40, bounciness:5 }).start(),
  [scale]);

  // [v4-FEAT-02] Stagger entry — SlideInRight with springify per PRD spec.
  const entering = useMemo(
    () => reducedMotion
      ? undefined
      : SlideInRight
          .delay(entryDelay)
          .duration(300)
          .springify()
          .damping(18),
    [entryDelay, reducedMotion],
  );

  const isOnline = country.onlineCount > 0;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${country.name}, #${rank} trending, ${fmtCount(country.onlineCount)} online`}
      accessibilityState={{ selected: isSelected }}
    >
      {/* ── OUTER CARD: shadow + border, no overflow:hidden (shadow must not clip) ── */}
      <ReAnimated.View
        entering={entering}
        style={[
          hc.card,
          isSelected && { borderColor: accent },
          isSelected && hc.cardActive,
          { transform: [{ scale }] },
        ]}
      >
        {/* ── INNER CLIP VIEW: overflow:hidden clips the bleeding rank numeral ───── */}
        <View style={hc.inner}>

          {/* TOP-LEFT: Country flag — large emoji, no background box */}
          <Text style={hc.flag} accessible={false}>{country.emoji}</Text>

          {/* TOP-RIGHT: Online status pill badge */}
          <View style={hc.onlinePill}>
            <View style={[hc.pillDot, isOnline && hc.pillDotLive]} />
            <Text style={hc.pillText}>
              {isOnline ? fmtCount(country.onlineCount) : '0'}{' online'}
            </Text>
          </View>

          {/* BOTTOM-LEFT: Country name + region label */}
          <View style={hc.nameGroup}>
            <Text style={[hc.name, isSelected && { color: accent }]} numberOfLines={1}>
              {country.name}
            </Text>
            <Text style={[hc.region, isSelected && { color: accent }]}>
              {country.region}
            </Text>
          </View>

          {/* BOTTOM-RIGHT: Massive rank numeral — bleeds ~25% off the right edge.  */}
          {/* [v57-01] OTT Top-10 aesthetic; overflow:hidden on inner clips it.     */}
          <Text
            style={[hc.rankNum, isSelected && hc.rankNumActive]}
            accessible={false}
          >
            {rank}
          </Text>

        </View>
      </ReAnimated.View>
    </Pressable>
  );
});

const hc = StyleSheet.create({
  // ── [v57] OTT Ranking Card layout ─────────────────────────────────────────────
  // Two-layer structure: outer card holds the shadow/border; inner view clips
  // the bleeding rank numeral via overflow:'hidden'.
  //
  //  ┌─────────────────────────────────────┐
  //  │ 🇦🇫               🟢 0 online       │  ← flag top-left, badge top-right
  //  │                                     │
  //  │ Afghanistan                    [1]  │  ← name+region bottom-left,
  //  │ Asia                           [▐]  │    rank numeral bottom-right (clipped)
  //  └─────────────────────────────────────┘

  // OUTER — shadow + border only; NO overflow:hidden (shadow must not be clipped).
  card: {
    width:           L.heroW,
    height:          L.heroH,
    borderRadius:    L.heroR,
    borderWidth:     1.5,
    borderColor:     T.border,
    backgroundColor: T.sheetBg,   // needed for iOS shadow + Android elevation
    shadowColor:     T.text,
    shadowOpacity:   0.06,
    shadowRadius:    10,
    shadowOffset:    { width:0, height:3 },
    elevation:       2,
  },
  // Selected: vivid accent shadow
  cardActive: { shadowOpacity:0.18, shadowRadius:22, elevation:6 },

  // INNER — clips the rank numeral bleed; borderRadius matches inner border edge.
  // Fills the outer card's content area (inside the 1.5px border via Yoga layout).
  inner: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    borderRadius:    L.heroR - 1,  // ≈ 19 — sits flush inside the outer border curve
    backgroundColor: T.sheetBg,
    overflow:        'hidden',
  },

  // TOP-LEFT: Country flag (large, no background box)
  flag: {
    position:   'absolute',
    top:        11,
    left:       12,
    fontSize:   38,
    lineHeight: 42,
  },

  // TOP-RIGHT: Online status pill badge  ──  [green/grey dot]  [N online]
  onlinePill: {
    position:          'absolute',
    top:               11,
    right:             8,    // [v59-04] tightened 11→8 — badge aligns with flag's left:12 rhythm
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   'rgba(0,0,0,0.04)',
    borderWidth:       0.5,
    borderColor:       'rgba(0,0,0,0.10)',
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      10,
  },
  pillDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: T.border,   // grey when 0 online (matches CountryRow badge)
  },
  pillDotLive: {
    backgroundColor: T.green,    // green when online count > 0
  },
  pillText: {
    fontSize:   9,
    fontWeight: '600',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.semiBold,
  },

  // BOTTOM-LEFT: Country name (bold) + region (muted)
  // [v59-02] right:28 — watermark numeral at 12% opacity lets text overlap it safely.
  // Previous right:56 reserved hard space for the solid-gold numeral; no longer needed.
  nameGroup: {
    position: 'absolute',
    bottom:   12,
    left:     12,
    right:    28,
  },
  name: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.text,
    fontFamily: FONT_HEADING.semiBold,
  },
  region: {
    fontSize:   10,
    fontWeight: '500',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.medium,
    marginTop:  2,
  },

  // BOTTOM-RIGHT: Massive rank numeral — [v57-01] OTT Top-10 aesthetic.
  // right:-10 + bottom:-10: ~25% of the digit bleeds off the right edge;
  // the overflow:hidden on hc.inner clips it cleanly at the card boundary.
  // [v58-01] Colour was 0.78 opacity (solid gold). [v59-01] Dialled back to 0.12
  //           — now a ghost watermark so country name always remains primary.
  rankNum: {
    position:   'absolute',
    bottom:     -10,
    right:      -10,
    fontSize:   80,
    fontWeight: '900',
    // [v513-01] Orange — same warm base (234,88,12) as app's bottom-nav / Africa accent.
    // 0.65 opacity: vivid and clearly orange on white cards, still a background watermark.
    color:      'rgba(234,88,12,0.65)',
    lineHeight: 88,
  },
  rankNumActive: {
    color:      'rgba(234,88,12,0.75)',   // [v513-01] stronger on selected card
  },

  // NOTE: checkDot removed in v57-03 — selected state communicated via
  //       border accent + name/region colour + cardActive shadow.
});

// ─── CountryRow ────────────────────────────────────────────────────────────────
interface CountryRowProps {
  country:    CountryDoc;
  isSelected: boolean;
  onPress:    (country: CountryDoc) => void;
}

const CountryRow = memo<CountryRowProps>(({ country, isSelected, onPress }) => {
  const scale     = useRef(new Animated.Value(1)).current;
  // [FIX-03] Flash overlay migrated from Animated (useNativeDriver:false → JS thread)
  // to Reanimated SharedValue (runs entirely on the UI thread).
  const flashAnim  = useSharedValue(0);
  const regionBg   = REGION_FLAG_BG[country.region];
  const accent     = REGION_ACCENT[country.region] as string;

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashAnim.value }));

  const handlePress = useCallback(() => onPress(country), [onPress, country]);
  const onPressIn   = useCallback(() => {
    // Scale press — 0.97 "press" confirm (stays on UI thread via native driver)
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
    // [FIX-03] 80ms background flash on UI thread — ramp up 40ms, ramp down 40ms
    flashAnim.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }, [scale, flashAnim]);
  const onPressOut  = useCallback(() =>
    Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 55, bounciness: 4 }).start(),
  [scale]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityLabel={`${country.name} (${country.id}), ${
        country.onlineCount > 0 ? fmtCount(country.onlineCount) + ' online' : 'no one online'
      }`}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View
        style={[
          cr.row,
          isSelected && cr.rowActive,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[cr.flagBox, { backgroundColor: regionBg }]}>
          <Text style={cr.flagEmoji} accessible={false}>{country.emoji}</Text>
        </View>

        <View style={cr.body}>
          <View style={cr.nameRow}>
            <Text style={[cr.name, isSelected && cr.nameActive]} numberOfLines={1}>
              {country.name}
            </Text>
            <Text style={[cr.iso, isSelected && { color: T.goldLight }]} accessible={false}>
              {country.id}
            </Text>
          </View>

          {/* [v55-02] Region label replaces "No one online" / "N online" subtitle */}
          <Text style={[cr.regionLabel, isSelected && cr.regionLabelActive]}>
            {country.region}
          </Text>
        </View>

        {/* [v55-03] Online count badge — pill with dot + count, mirrors CityPickerSheet */}
        <View style={[cr.onlineBadge, isSelected && cr.onlineBadgeActive]}>
          <View
            style={[
              cr.badgeDot,
              { backgroundColor: country.onlineCount > 0 ? T.green : T.border },
            ]}
          />
          <Text style={[cr.badgeText, isSelected && { color: accent }]}>
            {country.onlineCount > 0 ? `${fmtCount(country.onlineCount)} online` : '0 online'}
          </Text>
        </View>

        {isSelected ? (
          <View style={[cr.checkCircle, { backgroundColor: accent }]}>
            <Feather name="check" size={12} color={T.sheetBg} />
          </View>
        ) : (
          <Feather name="chevron-right" size={16} color={T.textTertiary} />
        )}

        {/* [v53-02] Selected-state left accent rail — region colour, rounded pill.
            Anchors the eye to the active row in a long list. Decorative only:
            sits in the left gutter, pointerEvents="none", no layout impact. */}
        {isSelected && (
          <View
            style={[cr.selectedRail, { backgroundColor: accent }]}
            pointerEvents="none"
            importantForAccessibility="no"
          />
        )}

        {/* [FIX-03] Flash overlay: Reanimated (UI thread) — previously used
            Animated with useNativeDriver:false which blocked the JS thread.
            pointerEvents="none" ensures it never intercepts touches. */}
        <ReAnimated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: DV.activeRowBg }, flashStyle]}
          pointerEvents="none"
        />
      </Animated.View>
    </Pressable>
  );
});

const cr = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    height:            L.rowH,
    gap:               14,
    backgroundColor:   T.sheetBg,
  },
  rowActive:   { backgroundColor: DV.activeRowBg },
  flagBox: {
    width:          L.flagBox,
    height:         L.flagBox,
    borderRadius:   L.flagRadius,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  flagEmoji: { fontSize: L.flagEmoji },
  body:      { flex:1, gap:6 },
  nameRow:   { flexDirection:'row', alignItems:'center', gap:6 },
  name: {
    fontSize:   15,
    fontWeight: '600',
    color:      T.text,
    fontFamily: FONT_HEADING.medium,
    flexShrink: 1,
  },
  nameActive: { color:T.gold, fontWeight:'700' },
  iso: {
    fontSize:      10,
    fontWeight:    '600',
    color:         T.textTertiary,
    fontFamily:    FONT_BODY.semiBold,
    letterSpacing: 0.5,
    flexShrink:    0,
  },
  // [v55-02] Region label — plain continent/region text below the country name.
  // Replaces the old "No one online" / "N online" dot+count subtitle.
  regionLabel: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.medium,
  },
  regionLabelActive: { color: T.goldLight },

  // [v55-03] Online-count badge — pill shape, sits right of body, left of chevron.
  // Mirrors the CityPickerSheet badge position and visual style.
  onlineBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   5,
    borderRadius:      20,
    backgroundColor:   T.surfaceSunken,
    flexShrink:        0,
  },
  onlineBadgeActive: { backgroundColor: DV.activeRowBg },
  badgeDot: {
    width:        5,
    height:       5,
    borderRadius: 2.5,
    flexShrink:   0,
  },
  badgeText: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
  },
  checkCircle: {
    width:28, height:28, borderRadius:14,
    alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
  // [v53-02] Region-accent rail on the selected row — rounded pill in the gutter.
  selectedRail: {
    position:     'absolute',
    left:         6,
    top:          14,
    bottom:       14,
    width:        3,
    borderRadius: 1.5,
  },
});

// ─── RowDivider ────────────────────────────────────────────────────────────────
const RowDivider = memo(() => (
  <View
    style={{ height:L.divH, backgroundColor:T.borderSubtle, marginHorizontal:L.rowPadH }}
    accessible={false}
    importantForAccessibility="no-hide-descendants"
  />
));

// ─── RegionPill ────────────────────────────────────────────────────────────────
interface RegionPillProps {
  label:   RegionFilter;
  active:  boolean;
  count?:  number;
  onPress: (filter: RegionFilter) => void;
}

const RegionPill = memo<RegionPillProps>(({ label, active, count, onPress }) => {
  const handlePress = useCallback(() => onPress(label), [onPress, label]);
  const displayText = count !== undefined ? `${label} \u00B7 ${count}` : label;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityLabel={count !== undefined ? `${label}, ${count} countries` : `Filter by ${label}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [rp.pill, active && rp.pillActive, pressed && { opacity:0.72 }]}
    >
      <Text style={[rp.text, active && rp.textActive]}>{displayText}</Text>
    </Pressable>
  );
});

const rp = StyleSheet.create({
  pill: {
    height:            L.pillH,
    paddingHorizontal: 16,
    borderRadius:      L.pillH / 2,
    borderWidth:       1,
    borderColor:       T.border,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   T.sheetBg,
  },
  pillActive: { borderColor:T.gold, backgroundColor:T.goldSubtle },
  text:       { fontSize:13, fontWeight:'600', color:T.textSecondary, fontFamily:FONT_BODY.semiBold },
  textActive: { color: T.gold },
});

// ─── AlphabetSidebar ──────────────────────────────────────────────────────────
interface AlphabetSidebarProps {
  letters:        string[];
  onPress:        (letter: string) => void;
  onLetterChange: (letter: string | null) => void;
}

const AlphabetSidebar = memo<AlphabetSidebarProps>(
  ({ letters, onPress, onLetterChange }) => {
    const heightRef    = useRef(0);
    const lastIdxRef   = useRef(-1);
    const lastHapticMs = useRef(0);

    const onPressRef        = useRef(onPress);
    const onLetterChangeRef = useRef(onLetterChange);
    const lettersRef        = useRef(letters);

    useEffect(() => { onPressRef.current        = onPress;        }, [onPress]);
    useEffect(() => { onLetterChangeRef.current = onLetterChange; }, [onLetterChange]);
    useEffect(() => { lettersRef.current        = letters;        }, [letters]);

    // [BUG-02] PanResponder is already imported at module scope — removed the
    // erroneous require() call that ran on every render and defeated tree-shaking.
    const hitLetter = useCallback((locationY: number) => {
      const ls = lettersRef.current;
      if (heightRef.current <= 0 || ls.length === 0) return;
      const idx     = Math.floor((locationY / heightRef.current) * ls.length);
      const clamped = Math.max(0, Math.min(ls.length - 1, idx));
      if (clamped !== lastIdxRef.current) {
        lastIdxRef.current = clamped;
        const letter = ls[clamped];
        if (letter) {
          const now = Date.now();
          if (now - lastHapticMs.current >= 50) {
            lastHapticMs.current = now;
            void hapticSelect();
          }
          onLetterChangeRef.current(letter);
          onPressRef.current(letter);
        }
      }
    }, []);

    const panHandlers = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // [HIGH-06] Don't claim moves — lets BottomSheetFlatList scroll normally
        onMoveShouldSetPanResponder:  () => false,
        onPanResponderGrant:   (e: GestureResponderEvent) => { lastIdxRef.current = -1; hitLetter(e.nativeEvent.locationY); },
        onPanResponderMove:    (e: GestureResponderEvent) => { hitLetter(e.nativeEvent.locationY); },
        onPanResponderRelease: () => {
          lastIdxRef.current = -1;
          onLetterChangeRef.current(null);
        },
      }).panHandlers,
    ).current;

    return (
      <View
        style={ab.wrap}
        onLayout={(e) => { heightRef.current = e.nativeEvent.layout.height; }}
        {...panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Alphabet scroller, ${letters.length} letters`}
        accessibilityHint="Drag to jump to a letter"
        accessibilityActions={[
          { name: 'increment', label: 'Next letter' },
          { name: 'decrement', label: 'Previous letter' },
        ]}
        onAccessibilityAction={(event: AccessibilityActionEvent) => {
          const ls = lettersRef.current;
          if (ls.length === 0) return;
          const cur  = lastIdxRef.current < 0 ? 0 : lastIdxRef.current;
          const next = event.nativeEvent.actionName === 'increment'
            ? Math.min(ls.length - 1, cur + 1)
            : Math.max(0, cur - 1);
          lastIdxRef.current = next;
          const letter = ls[next];
          if (letter) {
            void hapticSelect();
            onLetterChangeRef.current(letter);
            onPressRef.current(letter);
          }
        }}
      >
        {letters.map((letter) => (
          <View key={letter} style={ab.btn} accessible={false}>
            <Text style={ab.letter}>{letter}</Text>
          </View>
        ))}
      </View>
    );
  },
);

const ab = StyleSheet.create({
  wrap: {
    position:      'absolute',
    right:         2,
    top:           0,
    bottom:        0,
    width:         L.alphaBarW,
    flexDirection: 'column',
    alignItems:    'center',
    zIndex:        10,
  },
  btn: {
    width:          L.alphaBarW,
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      8,
  },
  letter: { fontSize:10, fontWeight:'700', color:T.gold, fontFamily:FONT_BODY.bold },
});

// ─── [v4-FEAT-04] LetterOverlay — Spring enter, ease-out exit ─────────────────
// Reanimated useSharedValue approach avoids re-mount jank during rapid pan.
// Single mounted instance: animates in when letter becomes non-null, out when null.
const LetterOverlay = memo<{ letter: string | null; reducedMotion?: boolean }>(
  ({ letter, reducedMotion = false }) => {
    const scale   = useSharedValue(0.7);
    const opacity = useSharedValue(0);
    const letterRef = useRef(letter);
    letterRef.current = letter;

    useEffect(() => {
      if (letter) {
        if (reducedMotion) {
          scale.value   = 1;
          opacity.value = 1;
        } else {
          // Enter: spring scale + timing opacity per PRD Feature 6 spec
          scale.value   = withSpring(1, { damping: 15, stiffness: 350 });
          opacity.value = withTiming(1, { duration: 150 });
        }
      } else {
        if (reducedMotion) {
          scale.value   = 0.7;
          opacity.value = 0;
        } else {
          // Exit: ease-out scale + opacity, 100ms per PRD Feature 6 spec
          scale.value   = withTiming(0.7, { duration: 100 });
          opacity.value = withTiming(0,   { duration: 100 });
        }
      }
    }, [letter, reducedMotion, scale, opacity]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity:    opacity.value,
    }));

    // Always render (keeps exit animation alive); invisible via opacity
    return (
      <View style={lo.container} pointerEvents="none">
        <ReAnimated.View style={[lo.bubble, animStyle]}>
          <Text style={lo.letter}>{letter ?? ''}</Text>
        </ReAnimated.View>
      </View>
    );
  },
);

const lo = StyleSheet.create({
  container: {
    position:       'absolute',
    left:           0,
    right:          0,
    top:            0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         50,
  },
  bubble: {
    width:          80,
    height:         80,
    borderRadius:   20,
    backgroundColor: T.gold,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    T.gold,
    shadowOpacity:  0.40,
    shadowRadius:   20,
    shadowOffset:   { width:0, height:4 },
    elevation:      14,
  },
  letter: {
    fontSize:   40,
    fontWeight: '800',
    color:      T.sheetBg,
    fontFamily: FONT_HEADING.bold,
    lineHeight: 44,
    includeFontPadding: false,
  },
});

// ─── [FIX-01] AlphaSidebarAndOverlay ─────────────────────────────────────────
// Root cause of re-render bug: activeAlphaLetter was state in CountryPickerSheetBase.
// Every pan frame called setActiveAlphaLetter → re-rendered the entire parent tree
// (BottomSheetFlatList with 200+ rows).
//
// Fix: Own the state here. Only this tiny component re-renders on each letter change.
// Parent passes stable props (letters, onPress, reducedMotion) — none of which change
// during a pan — so memo() guarantees zero parent-triggered re-renders during drag.
interface AlphaSidebarAndOverlayProps {
  letters:       string[];
  onPress:       (letter: string) => void;
  reducedMotion: boolean;
}

const AlphaSidebarAndOverlay = memo<AlphaSidebarAndOverlayProps>(
  ({ letters, onPress, reducedMotion }) => {
    const [activeLetter, setActiveLetter] = useState<string | null>(null);
    return (
      <>
        <AlphabetSidebar
          letters={letters}
          onPress={onPress}
          onLetterChange={setActiveLetter}
        />
        <LetterOverlay letter={activeLetter} reducedMotion={reducedMotion} />
      </>
    );
  },
);


interface RecentlyVisitedProps {
  countries: CountryDoc[];
  selected:  string;
  onSelect:  (country: CountryDoc) => void;
}

const RecentlyVisitedSection = memo<RecentlyVisitedProps>(
  ({ countries, selected, onSelect }) => (
    <View>
      <View style={rv.headerRow}>
        <Feather name="clock" size={12} color={T.gold} />
        <Text style={rv.label}>RECENTLY VISITED</Text>
      </View>
      {countries.map((c) => (
        <CountryRow
          key={c.id}
          country={c}
          isSelected={c.id === selected}
          onPress={onSelect}
        />
      ))}
      <View style={rv.sectionDivider} />
    </View>
  ),
);

const rv = StyleSheet.create({
  headerRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        12,
    marginBottom:     6,
  },
  label: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
    textTransform: 'uppercase',
  },
  sectionDivider: {
    // [v512-02] Was: height:6, backgroundColor:T.surfaceSunken, marginTop:4 — thick cream band.
    // Now: 1px hairline matching every other divider in the sheet. 'A' header has
    // identical thin lines on both sides — consistent and clean.
    height:          1,
    backgroundColor: T.borderSubtle,
    marginTop:       0,
  },
});

// ─── [FIX-03] RelativeTimeLabel ──────────────────────────────────────────────
// Owns tickNow state so only this tiny Text re-renders every 60s.
// Previously setTickNow lived in CountryPickerSheetBase — every minute tick
// forced a full re-render of the entire sheet tree (FlatList + 200+ rows).
const RelativeTimeLabel = memo<{ fetchedAt: number | null }>(({ fetchedAt }) => {
  const [tickNow, setTickNow] = useState(() => Date.now());

  useEffect(() => {
    if (fetchedAt == null) return;
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  if (fetchedAt == null) return null;

  const diffMin = Math.round((tickNow - fetchedAt) / 60_000);
  let label: string;
  if (diffMin < 1)   label = 'Updated just now';
  else if (diffMin === 1) label = 'Updated 1 min ago';
  else if (diffMin < 60)  label = `Updated ${diffMin} min ago`;
  else label = `Counts at ${new Date(fetchedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })}`;

  return <Text style={sh.countTimeLabel}>{label}</Text>;
});

// ─── Main component ────────────────────────────────────────────────────────────
type SheetState = 'loading' | 'idle' | 'switching';

function CountryPickerSheetBase({
  visible,
  onClose,
  selected,
  onSelect,
  onSheetIndexChange,
}: CountryPickerSheetProps) {

  // [v54] No sheetRef / snapPoints — the in-house BottomSheet is a Modal driven
  // purely by the `visible` prop. It renders at a single fixed height (SHEET_HEIGHT).

  const [countries,     setCountries]    = useState<CountryDoc[]>([]);
  const [sheetState,    setSheetState]   = useState<SheetState>('loading');
  const [rawQuery,      setRawQuery]     = useState('');
  const [searchQuery,   setSearchQuery]  = useState('');
  const [regionFilter,  setRegionFilter] = useState<RegionFilter>('All');
  const [error,         setError]        = useState<string | null>(null);
  const [reducedMotion, setRM]           = useState(false);
  const [recentIds,     setRecentIds]    = useState<string[]>([]);
  const [fetchedAt,     setFetchedAt]    = useState<number | null>(null);
  const [switchingTo,   setSwitchingTo]  = useState<CountryDoc | null>(null);
  const [isRefreshing,  setIsRefreshing] = useState(false);
  // [FIX-01] activeAlphaLetter removed — now owned by AlphaSidebarAndOverlay
  // [FIX-03] tickNow removed — now owned by RelativeTimeLabel

  const searchRef     = useRef<TextInput>(null);
  // [v4-ARCH-02] listRef typed as FlatList — BottomSheetFlatList is FlatList-compatible
  const listRef       = useRef<FlatList<ListItem>>(null);
  const fetchIdRef    = useRef(0);
  const isFetchingRef = useRef(false);
  const isMountedRef  = useRef(true);
  const isSwitchingRef  = useRef(false);
  const retryCountRef   = useRef(0);
  const [retryCount,    setRetryCount]   = useState(0); // [A11Y-03] state mirrors ref so a11y label re-renders
  const selectedRef     = useRef(selected);
  const recentIdsRef    = useRef(recentIds);

  useEffect(() => { selectedRef.current  = selected;     }, [selected]);
  useEffect(() => { recentIdsRef.current = recentIds;    }, [recentIds]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── [FEAT-06] One-time v2→v3 recents migration ───────────────────────────────
  useEffect(() => { void migrateRecentsCache(); }, []);

  // ── [v54] Open side-effects — the Modal opens via the `visible` prop ──────────
  // No imperative snap/close needed. We still (a) fire the subtle open haptic and
  // (b) preserve the bottom-nav hide/show contract: onSheetIndexChange(0) on open,
  // onSheetIndexChange(-1) on close — same signal the parent already consumes.
  useEffect(() => {
    if (visible) {
      void hapticLight(); // [UX-02] Subtle haptic matches iOS Share Sheet behaviour
      onSheetIndexChange?.(0);
    } else {
      onSheetIndexChange?.(-1);
    }
  }, [visible, onSheetIndexChange]);

  // ── [FIX-SCROLL-01] shellHRef — measure shell height for layout metrics ───────
  // Shell height is recorded here; no longer drives any adaptive height logic
  // (setHeight was a custom method on the removed shim). onShellLayout is kept as
  // a stable measurement hook for any future use.
  const shellHRef = useRef(0);

  // ── [FIX-03] AnimatedPillsRow — migrated from Animated (useNativeDriver:false) ─
  // to Reanimated SharedValues so height + opacity run on the UI thread.
  const pillsH  = useSharedValue(L.pillRowH);
  const pillsOp = useSharedValue(1);
  const animatedPillsStyle = useAnimatedStyle(() => ({
    height:   pillsH.value,
    opacity:  pillsOp.value,
    overflow: 'hidden' as const,
  }));

  useEffect(() => {
    // [FIX-09] trim() — prevents space-only input from collapsing pills unnecessarily
    const isSearching = rawQuery.trim().length > 0;
    if (isSearching) {
      pillsH.value  = withTiming(0,          { duration: 200, easing: REasing.out(REasing.cubic) });
      pillsOp.value = withTiming(0,          { duration: 160, easing: REasing.out(REasing.cubic) });
    } else {
      pillsH.value  = withTiming(L.pillRowH, { duration: 220, easing: REasing.out(REasing.cubic) });
      pillsOp.value = withTiming(1,          { duration: 180, easing: REasing.out(REasing.cubic) });
    }
  }, [rawQuery, pillsH, pillsOp]);

  // ── [FIX-03] Search bar focus glow — migrated from Animated (useNativeDriver:false) ─
  // Reanimated interpolateColor runs on the UI thread — no JS-thread block on keyboard show.
  const searchFocused = useSharedValue(0);
  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(searchFocused.value, [0, 1], [T.border, T.gold]),
  }));

  const handleSearchFocus = useCallback(() => {
    // [v54] No snap needed — the sheet is already at its fixed full height and the
    // search box sits at the top, so the keyboard never covers it. Just glow.
    searchFocused.value = withTiming(1, { duration: 180 });
  }, [searchFocused]);

  const handleSearchBlur = useCallback(() => {
    searchFocused.value = withTiming(0, { duration: 150 });
  }, [searchFocused]);

  // ── [FIX-HEIGHT-03] Shell layout measurement ─────────────────────────────────
  // Records shell height for future layout calculations.
  const onShellLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) shellHRef.current = h;
    },
    [],
  );

  // ── [FIX-05] Shimmer animation — Reanimated withRepeat (UI thread) ───────────
  const shimmerAnim = useSharedValue(0);
  useEffect(() => {
    if (sheetState !== 'loading') {
      cancelAnimation(shimmerAnim);
      shimmerAnim.value = 0;
      return;
    }
    shimmerAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: L.shimmerDur / 2 }),
        withTiming(0, { duration: L.shimmerDur / 2 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(shimmerAnim);
  }, [sheetState, shimmerAnim]);

  // ── Debounced search — 150ms (was 300ms, [PERF-02]) ─────────────────────────
  // 300ms lagged behind 1–2 keystrokes at normal typing speed. 150ms feels
  // instant while still avoiding a filter on every single keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawQuery), 150);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // ── [SCROLL-05] Reset list scroll when search query settles ──────────────────
  // Without this, changing search terms while mid-list leaves a blank area at
  // top because the previous scroll position doesn't match the new result set.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [searchQuery]);

  // ── Reduced motion ────────────────────────────────────────────────────────────
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setRM);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRM);
    return () => sub.remove();
  }, []);

  // ── Load on open ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    retryCountRef.current  = 0;
    setRetryCount(0); // [A11Y-03] keep state in sync for fresh a11y label
    isSwitchingRef.current = false;

    const currentFetchId = ++fetchIdRef.current;

    setSheetState('loading');
    setRawQuery('');
    setSearchQuery('');
    setRegionFilter('All');
    setError(null);
    setSwitchingTo(null);

    // [FIX-04] Promise.all: AsyncStorage recents + Firebase countries run concurrently
    // and resolve in one React batch. Previously they raced — on fast connections
    // countries would render first, then recents would arrive milliseconds later
    // popping in and shifting the entire list layout.
    const recentsPromise = AsyncStorage.getItem(CW_RECENTS_KEY)
      .then((raw): string[] => {
        if (!raw) return [];
        try { return JSON.parse(raw) as string[]; } catch { return []; }
      })
      .catch((): string[] => []);

    Promise.all([recentsPromise, fetchCountries()])
      .then(([recents, [docs, ts]]) => {
        if (fetchIdRef.current !== currentFetchId) return;
        // [FIX-03] setTickNow removed — RelativeTimeLabel owns its own tick state
        setRecentIds(recents);
        setCountries(docs);
        setFetchedAt(ts);
        setSheetState('idle');
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== currentFetchId) return;
        console.error('[CountryPickerSheet] fetch failed:', err);
        setError('Could not load countries. Check your connection and try again.');
        setSheetState('idle');
      });
  }, [visible]);

  // ── [ADD-03] Pull-to-refresh ──────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    const currentFetchId = ++fetchIdRef.current;
    fetchCountries(true)
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== currentFetchId) return;
        if (isMountedRef.current) {
          setCountries(docs);
          setFetchedAt(ts);
          // [FIX-03] setTickNow removed — RelativeTimeLabel owns its own tick state
        }
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== currentFetchId) return;
        console.error('[CountryPickerSheet] pull-to-refresh failed:', err);
      })
      .finally(() => {
        if (fetchIdRef.current === currentFetchId) isFetchingRef.current = false;
        if (isMountedRef.current) setIsRefreshing(false);
      });
  }, []);

  // ── [MED-06] Retry with cap ───────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (isFetchingRef.current) return;
    if (retryCountRef.current >= MAX_RETRIES) {
      setError('Too many failed attempts. Please check your connection and restart the app.');
      return;
    }
    retryCountRef.current++;
    setRetryCount(retryCountRef.current); // [A11Y-03] re-render a11y label with new attempt count
    isFetchingRef.current = true;

    const currentFetchId = ++fetchIdRef.current;
    setSheetState('loading');
    setError(null);

    fetchCountries(true)
      .then(([docs, ts]) => {
        if (fetchIdRef.current !== currentFetchId) return;
        if (isMountedRef.current) {
          setCountries(docs);
          setFetchedAt(ts);
          // [FIX-03] setTickNow removed — RelativeTimeLabel owns its own tick state
          setSheetState('idle');
        }
      })
      .catch((err: unknown) => {
        if (fetchIdRef.current !== currentFetchId) return;
        if (!isMountedRef.current) return;
        console.error('[CountryPickerSheet] retry failed:', err);
        setError(
          retryCountRef.current >= MAX_RETRIES
            ? `Still unable to load (attempt ${MAX_RETRIES}/${MAX_RETRIES}). Please check your connection.`
            : 'Still unable to load. Please try again later.',
        );
        setSheetState('idle');
      })
      .finally(() => {
        if (fetchIdRef.current === currentFetchId) isFetchingRef.current = false;
      });
  }, []);

  // ── Filtered + sorted lists ───────────────────────────────────────────────────
  const regionFiltered = useMemo<CountryDoc[]>(() => {
    if (regionFilter === 'All') return countries;
    return countries.filter((c) => c.region === regionFilter);
  }, [countries, regionFilter]);

  // [HIGH-04] Sort once per regionFilter change
  const sortedRegionFiltered = useMemo(
    () => [...regionFiltered].sort((a, b) => a.name.localeCompare(b.name)),
    [regionFiltered],
  );

  // [HIGH-08] Search within regionFiltered. [FIX-02] Uses pre-computed fields —
  // normalizeDiacritics + dialCode.replace() no longer run per-country per keystroke.
  const displayCountries = useMemo<CountryDoc[]>(() => {
    const q = searchQuery.trim();
    // [FIX-09] Empty/whitespace query returns browse data with zero extra work
    if (!q) return regionFiltered;

    const normQ   = normalizeDiacritics(q);
    const isDialQ = /^\+?\d+$/.test(q);
    const digits  = q.replace(/\D/g, '');

    // ── Filter — predicate UNCHANGED from v5.2 (same set of matches) ────────────
    const matches = regionFiltered.filter((c) => {
      if (c.normalizedName.includes(normQ))              return true; // [FIX-02] pre-computed
      if (c.id.toLowerCase() === normQ)                  return true;
      if (isDialQ && c.cleanDialCode.startsWith(digits)) return true; // [FIX-02] pre-computed
      return false;
    });

    // ── [v53-01] Relevance ranking — best matches first ─────────────────────────
    // Same matches, smarter order. Without this, results kept "busiest first"
    // order, so "in" could surface a high-traffic territory above India.
    // Tiers: 0 exact ISO · 1 exact name · 2 name-prefix · 3 dial-prefix · 4 substring.
    // onlineCount (then name) breaks ties — preserves the "busiest first" feel
    // within an equally-relevant group. Cheap: runs once per settled query on the
    // already-filtered (usually small) result set.
    const rank = (c: CountryDoc): number => {
      if (c.id.toLowerCase() === normQ)                  return 0;
      if (c.normalizedName === normQ)                    return 1;
      if (c.normalizedName.startsWith(normQ))            return 2;
      if (isDialQ && c.cleanDialCode.startsWith(digits)) return 3;
      return 4;
    };
    return matches.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb)                       return ra - rb;
      if (b.onlineCount !== a.onlineCount) return b.onlineCount - a.onlineCount;
      return a.name.localeCompare(b.name);
    });
  }, [regionFiltered, searchQuery]);

  const trendingCountries = useMemo(
    () => countries.slice(0, TRENDING_COUNT),
    [countries],
  );

  // [ADD-08] Country counts per region
  const regionCounts = useMemo<Partial<Record<RegionFilter, number>>>(() => {
    const counts: Partial<Record<RegionFilter, number>> = { 'All': countries.length };
    for (const c of countries) {
      counts[c.region] = (counts[c.region] ?? 0) + 1;
    }
    return counts;
  }, [countries]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selected) ?? null,
    [countries, selected],
  );

  const recentCountries = useMemo<CountryDoc[]>(
    () => recentIds.flatMap((id) => {
      const c = countries.find((c) => c.id === id);
      return c ? [c] : [];
    }),
    [recentIds, countries],
  );

  // ── Flat data + A-Z sections ──────────────────────────────────────────────────
  const flatData = useMemo<ListItem[]>(() => {
    if (searchQuery.trim()) return buildSearchResults(displayCountries);
    return buildAlphaSections(sortedRegionFiltered);
  }, [displayCountries, searchQuery, sortedRegionFiltered]);

  // [PERF-01] During search, flatData contains only CountryItem rows (no sections
  // or dividers), so every item is exactly L.rowH tall. Skip the O(n) precomputation
  // on every keystroke; use a simple formula instead. Precompute only in browse mode
  // where section/divider heights vary and scrollToIndex accuracy matters.
  const itemLayouts = useMemo(
    () => (searchQuery.trim() ? null : precomputeLayouts(flatData)),
    [flatData, searchQuery],
  );

  // ── Alphabet sidebar ──────────────────────────────────────────────────────────
  const alphabetLetters = useMemo<string[]>(() => {
    if (searchQuery.trim()) return [];
    return flatData
      .filter((item): item is SectionItem => item.type === 'section')
      .map((item) => item.letter);
  }, [flatData, searchQuery]);

  const sectionIndexMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    flatData.forEach((item, i) => {
      if (item.type === 'section') map.set(item.letter, i);
    });
    return map;
  }, [flatData]);

  const handleAlphabetPress = useCallback((letter: string) => {
    const index = sectionIndexMap.get(letter);
    if (index === undefined) return;
    listRef.current?.scrollToIndex({ index, animated: !reducedMotion, viewOffset: 0 });
  }, [sectionIndexMap, reducedMotion]);

  // ── Region filter ─────────────────────────────────────────────────────────────
  const handleRegion = useCallback((r: RegionFilter) => {
    void hapticSelect();
    setRegionFilter(r);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (country: CountryDoc) => {
    if (isSwitchingRef.current) return;
    if (country.id === selectedRef.current) { onClose(); return; }

    isSwitchingRef.current = true;
    setSwitchingTo(country);
    void hapticMedium();
    Keyboard.dismiss();
    setSheetState('switching');

    try {
      // [FIX-05] Fire-and-forget — disk I/O must NOT block UI close.
      const updated = [
        country.id,
        ...recentIdsRef.current.filter((id) => id !== country.id),
      ].slice(0, MAX_RECENTS);
      AsyncStorage.setItem(CW_COUNTRY_KEY, country.id).catch(() => {});
      AsyncStorage.setItem(CW_RECENTS_KEY, JSON.stringify(updated))
        .then(() => { if (isMountedRef.current) setRecentIds(updated); })
        .catch(() => {});

      onSelect(country.id, country.name, country.emoji);
      // ↑ parent prop — if it throws, execution jumps to finally.
      // UI reset is in finally so the spinner is NEVER permanently stuck.

      await new Promise<void>((r) => setTimeout(r, reducedMotion ? 0 : 160));
      onClose();
    } finally {
      isSwitchingRef.current = false;
      // [FIX-02] Guaranteed UI reset — even if onSelect throws, the sheet
      // exits 'switching' state and the spinner disappears.
      if (isMountedRef.current) {
        setSheetState('idle');
        setSwitchingTo(null);
      }
    }
  }, [onClose, onSelect, reducedMotion]);

  // ── List helpers ──────────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: ListItem): string => {
    if (item.type === 'section') return `sec-${item.letter}`;
    if (item.type === 'divider') return item.id;
    return `country-${item.country.id}`;
  }, []);

  // [PERF-04] `selected` was in the useCallback dep array, so every selection
  // change recreated renderItem → ALL CountryRow instances re-rendered (even
  // un-selected ones). Fix: read selected from selectedRef inside renderItem
  // (stable reference) and tell FlatList about the change via `extraData`.
  // FlatList calls renderItem again for each cell; memo on CountryRow ensures
  // only the actually-changed rows (old selected + new selected) paint.
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'section') return <SectionHeader letter={item.letter} />;
    if (item.type === 'divider') return <RowDivider />;
    return (
      <CountryRow
        country={item.country}
        isSelected={item.country.id === selectedRef.current}
        onPress={handleSelect}
      />
    );
  }, [handleSelect]); // no `selected` dep — selectedRef + extraData handle reactivity

  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      if (itemLayouts) {
        return itemLayouts[index] ?? { length: L.rowH, offset: L.rowH * index, index };
      }
      // [FIX-01] Search mode: buildSearchResults produces [Country, Divider, Country, Divider…]
      // The old formula (L.rowH * index for all items) was wrong — it assumed every item
      // was 74px, but Dividers are 1px. This corrupted FlatList's scroll map entirely.
      //
      // Correct pattern: even indices = Country (L.rowH), odd indices = Divider (L.divH)
      // cumulative item size = L.rowH + L.divH = 75px per country+divider pair
      const pairSize = L.rowH + L.divH; // 74 + 1 = 75
      if (index % 2 === 0) {
        // Country row
        return { length: L.rowH, offset: (index / 2) * pairSize, index };
      } else {
        // Divider
        return { length: L.divH, offset: Math.floor(index / 2) * pairSize + L.rowH, index };
      }
    },
    [itemLayouts],
  );

  const clearSearch = useCallback(() => {
    setRawQuery('');
    searchRef.current?.focus();
  }, []);

  // ── Dynamic labels ────────────────────────────────────────────────────────────
  // [UX-04] Removed hardcoded 195 — it was wrong when collection size differs
  // and caused a jarring number-jump when data loaded. Empty string avoids any count.
  const placeholder  = countries.length > 0
    ? `Search ${countries.length} countries…`
    : 'Search countries…';
  const showTrending = !searchQuery.trim() && regionFilter === 'All' && trendingCountries.length > 0;
  const showAlpha    = alphabetLetters.length > 0 && !searchQuery.trim();
  // [v510-01] BUG FIX — was missing regionFilter guard; showed cross-region recents.
  // Algeria (Africa) + Albania (Europe) appeared under Asia filter. Now mirrors showTrending.
  const showRecents  = recentCountries.length > 0 && !searchQuery.trim() && regionFilter === 'All';

  const isRegionSearchEmpty =
    searchQuery.trim().length > 0 &&
    displayCountries.length === 0 &&
    regionFilter !== 'All';

  // ── [FIX-LAYOUT-1] ListHeaderComponent: Trending + Recents ───────────────────
  const renderListHeader = useCallback(() => (
    <>
      {showTrending && (
        <View style={sh.trendingSection}>
          <View style={sh.trendingLabelRow}>
            <Feather name="trending-up" size={13} color={T.gold} />
            <Text style={sh.trendingLabel}>TRENDING</Text>
            {/* [v510-03] Time label removed — "Counts at HH:MM" felt stale. "TRENDING" alone is cleaner. */}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sh.heroScroll}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel="Trending countries"
          >
            {/* [v4-FEAT-02] Stagger entry: index * 40ms delay per PRD spec */}
            {/* [v57-04]     rank={index + 1} feeds the OTT rank numeral      */}
            {trendingCountries.map((c, index) => (
              <HeroCard
                key={c.id}
                country={c}
                isSelected={c.id === selected}
                onPress={handleSelect}
                rank={index + 1}
                entryDelay={index * 40}
                reducedMotion={reducedMotion}
              />
            ))}
          </ScrollView>
          <View style={sh.hairline} />
        </View>
      )}
      {showRecents && (
        <RecentlyVisitedSection
          countries={recentCountries}
          selected={selected}
          onSelect={handleSelect}
        />
      )}
    </>
  ), [showTrending, showRecents, trendingCountries, recentCountries, selected, handleSelect, reducedMotion]); // [v510-03] fetchedAt removed — RelativeTimeLabel removed

  // ── [FIX-LAYOUT-2] ListEmptyComponent: empty states inside FlatList ──────────
  // [v4-FEAT-07] Empty state fade-in — opacity 0→1 over 200ms.
  // Empty states that "pop" onto screen feel like layout thrash; a gentle fade feels intentional.
  const renderListEmpty = useCallback(() => {
    if (isRegionSearchEmpty) {
      return (
        <ReAnimated.View
          entering={!reducedMotion ? FadeIn.duration(200) : undefined}
          style={sh.stateWrap}
        >
          <View style={sh.stateIconCircle}>
            <Feather name="search" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>No Results in {regionFilter}</Text>
          <Text style={sh.stateHint}>
            No countries match "{searchQuery}" in {regionFilter}.
          </Text>
          <Pressable
            onPress={() => { void hapticLight(); setRegionFilter('All'); }}
            style={({ pressed }) => [sh.ctaBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`Search all countries for ${searchQuery}`}
          >
            <Feather name="globe" size={14} color={T.gold} />
            <Text style={sh.ctaBtnText}>Search All Countries</Text>
          </Pressable>
        </ReAnimated.View>
      );
    }
    return (
      <ReAnimated.View
        entering={!reducedMotion ? FadeIn.duration(200) : undefined}
        style={sh.stateWrap}
      >
        <View style={sh.stateIconCircle}>
          <Feather name="globe" size={28} color={T.textTertiary} />
        </View>
        <Text style={sh.stateTitle}>No Countries Found</Text>
        <Text style={sh.stateHint}>
          {searchQuery.trim()
            ? `"${searchQuery}" didn't match any country`
            : 'No countries in this region yet'}
        </Text>
      </ReAnimated.View>
    );
  }, [isRegionSearchEmpty, regionFilter, searchQuery, reducedMotion]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — v5.4 Tree
  //
  // BottomSheet (@/components/BottomSheet — Modal-based, opens on `visible`)
  //   renders its own drag handle + backdrop; we supply only the body below.
  // └── View (outerWrapper, flex:1) ← sole child; flex column
  //     ├── View (pinnedShell)         ← PINNED SHELL — never scrolls
  //     │   ├── titleRowMerged         ← Globe + Title + ActiveInline + Close
  //     │   ├── searchWrap (Animated)  ← animated border glow
  //     │   │     └── TextInput        ← plain RN input (top of sheet → keyboard-safe)
  //     │   └── pillAnimWrap (Animated)← height+opacity collapse
  //     │
  //     └── (conditional on sheetState)
  //         loading  → View + skeleton
  //         error    → View + error state
  //         idle     → FlatList (single scroll owner)
  //                      + AlphabetSidebar (absolute, no conflict)
  //                      + LetterOverlay (absolute, Reanimated)
  //
  // SwitchingOverlay (absoluteFillObject, zIndex:99, FadeIn 150ms)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      // [v54] Fixed tall sheet (≈90% screen). maxHeight + explicit height keep the
      // height stable across loading/idle so there is no jump when data arrives.
      maxHeight={SHEET_HEIGHT}
      style={sh.sheetShell}
    >
      {/* [v54] OUTER WRAPPER — flex:1 fills the sheet's content area (which is
          flex:1 in BottomSheet.tsx), so the inner FlatList sizes and scrolls. */}
      <View style={sh.outerWrapper}>


      {/* ── PINNED SHELL — The "Shell vs Content" principle (PRD §2 Principle 5) ── */}
      {/* SearchBar, title, pills live here. They CANNOT scroll away.             */}
      <View style={sh.pinnedShell} onLayout={onShellLayout}>

        {/* ── [v4-ARCH-05] MERGED TITLE ROW — saves 52px vs v3.3 ──────────────── */}
        {/* Old: [Title row 54px] + [Active strip 52px] = 106px */}
        {/* New: [Merged row ~52px] = 52px — 54px saved */}
        <View style={sh.titleRowMerged}>
          {/* Left: Globe icon */}
          <View style={sh.globeIconWrap}>
            <Feather name="globe" size={22} color={T.gold} />
          </View>

          {/* Center: Title + Active inline */}
          <View style={sh.titleTextGroup}>
            <Text style={sh.title}>Choose Country</Text>

            {/* [v4-ARCH-05] Active strip inline below title */}
            {selectedCountry != null && sheetState !== 'loading' && (
              <View
                style={sh.activeInline}
                accessibilityRole="text"
                accessibilityLabel={`Active country: ${selectedCountry.name}`}
              >
                <LiveDot size={5} pulse />
                <Text style={sh.activeFlag} accessible={false}>
                  {selectedCountry.emoji}
                </Text>
                <Text style={sh.activeName} numberOfLines={1}>
                  {selectedCountry.name}
                </Text>
                <Text style={sh.activeSep} accessible={false}>{'\u00B7'}</Text>
                {/* [v511-01] "No one online" → "0 online" — numeric, matches HeroCard badge language */}
                <Text style={sh.activeCountInline} numberOfLines={1}>
                  {selectedCountry.onlineCount > 0
                    ? `${fmtCount(selectedCountry.onlineCount)} online`
                    : '0 online'}
                </Text>
                {/* [v511-01] ACTIVE badge restored — gives header its premium "live" indicator */}
                <View style={sh.activeBadge}>
                  <Text style={sh.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
            )}
          </View>

          {/* Right: Close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [sh.closeBtn, pressed && sh.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Close country picker"
            hitSlop={{ top:4, bottom:4, left:4, right:4 }}
          >
            <Feather name="x" size={20} color={T.textSecondary} />
          </Pressable>
        </View>

        {/* ── [FIX-03] SEARCH BAR — Reanimated border glow (UI thread) ────────── */}
        {/* borderColor interpolation now runs on UI thread via Reanimated          */}
        <ReAnimated.View style={[sh.searchWrap, animatedBorderStyle]}>
          <Feather name="search" size={18} color={T.textTertiary} />
          <TextInput
            ref={searchRef}
            style={sh.searchInput}
            value={rawQuery}
            onChangeText={setRawQuery}
            placeholder={placeholder}
            placeholderTextColor={T.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            // [v510-06] Android draws a hard black underline on focus by default.
            // Setting transparent removes it — the Reanimated gold glow handles focus state.
            underlineColorAndroid="transparent"
            // [v53-03] Treat this strictly as a search box: no squiggles, no keyboard
            // autofill chips, no iOS strong-password / contact autofill offers.
            spellCheck={false}
            autoComplete="off"
            textContentType="none"
            maxLength={40}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            accessibilityLabel="Search for a country"
            accessibilityHint="Type a country name, ISO code, or dial code like 91"
          />
          {rawQuery.length > 0 && (
            <Pressable
              onPress={clearSearch}
              hitSlop={{ top:8, bottom:8, left:8, right:8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x-circle" size={18} color={T.textTertiary} />
            </Pressable>
          )}
        </ReAnimated.View>

        {/* ── [FIX-03] ANIMATED PILLS ROW — Reanimated height + opacity ─────────
            Both height and opacity now run entirely on the UI thread.            */}
        <ReAnimated.View style={[sh.pillAnimWrap, animatedPillsStyle]}>
          {sheetState !== 'loading' && error == null && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sh.pillScroll}
              keyboardShouldPersistTaps="always"
              accessibilityRole="tablist"
              accessibilityLabel="Filter countries by region"
            >
              {REGION_FILTERS.map((r) => (
                <RegionPill
                  key={r}
                  label={r}
                  active={regionFilter === r}
                  count={countries.length > 0 ? (regionCounts[r] ?? 0) : undefined}
                  onPress={handleRegion}
                />
              ))}
            </ScrollView>
          )}
        </ReAnimated.View>

        <View style={sh.hairline} />
        </View>

      {/* ── CONTENT ZONE — Everything below the shell ─────────────────────────── */}

      {sheetState === 'loading' ? (

        // [ADD-10] Skeleton trending + rows
        <View style={sh.contentArea}>
          <View style={sh.trendingSection}>
            <View style={sh.trendingLabelRow}>
              <Feather name="trending-up" size={13} color={T.gold} />
              <Text style={sh.trendingLabel}>TRENDING</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sh.heroScroll}
              scrollEnabled={false}
            >
              {Array.from({ length: TRENDING_COUNT }, (_, i) => (
                <SkeletonHeroCard key={i} shimmer={shimmerAnim} />
              ))}
            </ScrollView>
            <View style={sh.hairline} />
          </View>
          {/* [UX-03] Skeleton recents prevent the jarring pop-in. Show only when we
              already know recentIds exist (loaded from AsyncStorage before fetch). */}
          {recentIds.length > 0 && (
            <View>
              <View style={rv.headerRow}>
                <Feather name="clock" size={12} color={T.gold} />
                <Text style={rv.label}>RECENTLY VISITED</Text>
              </View>
              {recentIds.map((id) => (
                <SkeletonRow key={id} shimmer={shimmerAnim} />
              ))}
              <View style={rv.sectionDivider} />
            </View>
          )}
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading countries"
            accessible
          >
            {Array.from({ length: L.shimmerRows }, (_, i) => (
              <SkeletonRow key={i} shimmer={shimmerAnim} />
            ))}
          </View>
        </View>

      ) : error != null ? (

        <View style={sh.stateWrap}>
          <View style={sh.stateIconCircle}>
            <Feather name="wifi-off" size={28} color={T.textTertiary} />
          </View>
          <Text style={sh.stateTitle}>Failed to Load</Text>
          <Text style={sh.stateHint}>{error}</Text>
          {retryCountRef.current < MAX_RETRIES && (
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [sh.retryBtn, pressed && sh.retryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Retry loading countries (attempt ${retryCount + 1} of ${MAX_RETRIES})`}
            >
              <Feather name="refresh-cw" size={14} color={T.sheetBg} />
              <Text style={sh.retryBtnText}>Try Again</Text>
            </Pressable>
          )}
        </View>

      ) : (

        // [v5-ARCH-01] ONE scroll owner. BottomSheetFlatList from the real gorhom
        // library participates in the same RNGH gesture responder tree as the sheet
        // itself. Expansion (55%→92%) is intercepted before the list can scroll;
        // once at 92% the list scrolls freely. Pull-down from list top collapses/
        // closes the sheet — all on the UI thread via Reanimated shared values.
        <View
          style={sh.listWrap}
          accessibilityRole="radiogroup"
          accessibilityLabel="Country list"
        >
          {/* [A11Y-02] Hidden view announces search result count to screen readers.
              polite = waits for current speech to finish before announcing. */}
          {searchQuery.trim().length > 0 && (
            <View
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${displayCountries.length} ${displayCountries.length === 1 ? 'country' : 'countries'} found`}
              style={sh.srOnly}
            />
          )}
          {/* [v54] Plain FlatList — single scroll owner inside the Modal sheet.
              All getItemLayout / renderItem / ListHeaderComponent logic preserved. */}
          <FlatList
            ref={listRef}
            data={flatData}
            extraData={selected}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            // [FIX-LAYOUT-1] Trending + Recents scroll WITH the list
            ListHeaderComponent={renderListHeader}
            // [FIX-LAYOUT-2] Empty states inside FlatList
            ListEmptyComponent={renderListEmpty}
            showsVerticalScrollIndicator={false}
            style={sh.flatList}
            contentContainerStyle={[
              sh.listContent,
              showAlpha && { paddingRight: L.alphaBarW + 6 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            windowSize={8}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={(info) => {
              // [BUG-04] ScrollToIndexFailedInfo has no `averageItemLength` property.
              // Safe fallback: use precomputed offset if available, else L.rowH * index.
              const offset = itemLayouts?.[info.index]?.offset
                ?? L.rowH * info.index;
              listRef.current?.scrollToOffset({ offset, animated: false });
            }}
            // Allow overscroll on both platforms for natural feel
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
            // ── Pull-to-refresh ──────────────────────────────────────────────────
            // [ADD-03] Pull-to-refresh
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={T.gold}
                colors={[T.gold]}
              />
            }
          />

          {/* [FIX-01] AlphaSidebarAndOverlay owns activeAlphaLetter state internally.
              Only this component re-renders on each pan frame — not the FlatList above. */}
          {showAlpha && (
            <AlphaSidebarAndOverlay
              letters={alphabetLetters}
              onPress={handleAlphabetPress}
              reducedMotion={reducedMotion}
            />
          )}
        </View>

      )}

      {/* ── [v4-FEAT-03] SWITCHING OVERLAY — FadeIn 150ms ─────────────────────── */}
      {/* v3.3: instant snap (felt like a bug) → v4.0: 150ms fade (intentional) */}
      {sheetState === 'switching' && (
        <ReAnimated.View
          entering={!reducedMotion ? FadeIn.duration(150) : undefined}
          style={sh.switchOverlay}
          pointerEvents="auto"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={
            switchingTo != null
              ? `Switching to ${switchingTo.name}`
              : 'Switching country'
          }
        >
          {/* [UX-01] Spinner ring around the emoji clarifies "loading in progress".  */}
          {/* Without it, users on slow connections tapped repeatedly thinking the  */}
          {/* first tap didn't register (isSwitchingRef guard silently ate the taps). */}
          <View style={sh.switchSpinnerWrap}>
            <ActivityIndicator
              size={60}
              color={T.gold}
              style={sh.switchActivityRing}
            />
            <View style={sh.switchSpinner}>
              <Text style={sh.switchFlag}>
                {switchingTo?.emoji ?? selectedCountry?.emoji ?? '🌐'}
              </Text>
            </View>
          </View>
        </ReAnimated.View>
      )}

      </View>{/* ── [FIX-04] close outerWrapper (plain View) ── */}
    </BottomSheet>
  );
}

// [BUG-03] Wrap in PulseProvider so each mounted sheet gets its own isolated
// Animated.Value. Without this, two sheets in a Navigator stack share the module-
// level `_pulse` object, corrupting ref counts and causing visual glitches.
export const CountryPickerSheet = memo((props: CountryPickerSheetProps) => (
  <PulseProvider>
    <CountryPickerSheetBase {...props} />
  </PulseProvider>
));
export default CountryPickerSheet;

// ─── Styles ────────────────────────────────────────────────────────────────────
const sh = StyleSheet.create({

  // [v54] Passed to the in-house BottomSheet's `style` prop. Forces a fixed height
  // and paints the sheet white (the shared sheet defaults to a dark surface). The
  // shared sheet already rounds its top corners (24px); we keep its background.
  sheetShell: {
    height:          SHEET_HEIGHT,
    backgroundColor: T.sheetBg,
  },

  // ── [v54] Single outer wrapper — sole child of BottomSheet's content area ──────
  // flex:1 fills the content area (BottomSheet.content is flex:1); interior uses a
  // normal flex-column layout so pinnedShell and the list stack vertically.
  outerWrapper: {
    flex: 1,
  },

  // ── [v4-ARCH-05] Pinned shell — never scrolls ─────────────────────────────────
  // Replaces v3.3's sh.header + separate activeStrip + pillWrap + searchWrap.
  // SearchBar is here → cannot be buried by keyboard → [v4-ARCH-03] fix.
  pinnedShell: {
    backgroundColor: T.sheetBg,
    paddingBottom:   6,
  },

  // ── [v4-ARCH-05] Merged title row ─────────────────────────────────────────────
  // v3.3: titleRow (54px) + activeStrip (52px) = 106px
  // v4.0: titleRowMerged (~52px) = saves 54px
  titleRowMerged: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: L.rowPadH,
    paddingVertical:   12,
    gap:               12,
  },
  globeIconWrap: {
    width:           44,
    height:          44,
    borderRadius:    13,
    backgroundColor: T.goldSubtle,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  titleTextGroup: {
    flex: 1,
    gap:  3,
  },
  title: {
    fontSize:      17,
    fontWeight:    '700',
    color:         T.text,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: -0.3,
  },

  // [v4-ARCH-05] Active strip now inline — replaces the 52px standalone row
  activeInline: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    flexWrap:      'nowrap',
  },
  activeFlag:  { fontSize:13 },
  activeName: {
    fontSize:   13,
    fontWeight: '700',
    color:      T.gold,
    fontFamily: FONT_HEADING.semiBold,
    flexShrink: 1,
    maxWidth:   100,
  },
  activeSep:   { color:T.textMuted, fontSize:13 },
  activeCountInline: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textSecondary,
    fontFamily: FONT_BODY.medium,
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor:   T.gold,
    borderRadius:      5,
    paddingHorizontal: 5,
    paddingVertical:   2,
    flexShrink:        0,
  },
  activeBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    color:         T.sheetBg,
    letterSpacing: 0.7,
    fontFamily:    FONT_BODY.bold,
  },

  closeBtn: {
    width:           L.closeBtn,
    height:          L.closeBtn,
    borderRadius:    L.closeBtn / 2,
    backgroundColor: T.surfaceWell,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  closeBtnPressed: { opacity:0.60 },

  // ── [v4-FEAT-01] Search bar with Animated border color ───────────────────────
  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  L.rowPadH,
    marginVertical:    8,
    height:            L.searchH,
    backgroundColor:   T.surfaceSunken,
    borderRadius:      L.searchH / 2,
    paddingHorizontal: 14,
    borderWidth:       1.5,
    // borderColor is Animated — set via animatedBorderColor interpolation
    gap:               8,
  },
  searchInput: {
    flex:            1,
    fontSize:        14,
    color:           T.text,
    fontFamily:      FONT_BODY.regular,
    paddingVertical: 0,
    // [v513-02] Web-only: strips the browser's hard black "focus ring" on tap.
    // react-native-web reads outlineStyle; native iOS/Android ignores it safely.
    outlineStyle:    'none',
  },

  // ── [v4-ARCH-06] Animated pills wrapper ──────────────────────────────────────
  // height is animated (50→0 or 0→50) via Animated.Value
  // overflow:'hidden' clips the pills as height collapses
  pillAnimWrap: {
    // height is controlled by Animated.Value — don't set static height here
  },
  pillScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   9,
    gap:               10,
    flexDirection:     'row',
  },

  hairline: {
    height:          1,
    marginTop:       8,    // [v510-04] 16px was too airy (cards felt detached); 8px keeps shadow + compact look
    backgroundColor: T.borderSubtle,
  },

  // ── Content area ──────────────────────────────────────────────────────────────
  contentArea: { flex:1 },
  listWrap:    { flex:1, position:'relative' },
  flatList:    { flex:1 },
  listContent: { paddingBottom: Platform.OS === 'android' ? 32 : 28 },

  // ── Trending section ──────────────────────────────────────────────────────────
  trendingSection:  { paddingBottom:12 },
  trendingLabelRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    marginHorizontal: L.rowPadH,
    marginTop:        12,
    marginBottom:     12,
  },
  trendingLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         T.textSecondary,
    letterSpacing: 0.8,
    fontFamily:    FONT_BODY.bold,
    textTransform: 'uppercase',
    flex:          1,
  },
  countTimeLabel: {
    fontSize:   11,
    fontWeight: '500',
    color:      T.textTertiary,
    fontFamily: FONT_BODY.regular,
  },
  heroScroll: {
    paddingHorizontal: L.rowPadH,
    paddingVertical:   10,    // [v59-03] shadow breathing — prevents card shadow clipping inside scroll
    gap:               12,
  },

  // ── Empty / error states ──────────────────────────────────────────────────────
  stateWrap: {
    alignItems:        'center',
    paddingTop:        44,
    paddingBottom:     36,
    paddingHorizontal: 32,
    gap:               12,
    flex:              1,
  },
  stateIconCircle: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: T.surfaceWell,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  stateTitle: {
    fontSize:   17,
    fontWeight: '700',
    color:      T.text,
    fontFamily: FONT_HEADING.semiBold,
    textAlign:  'center',
  },
  stateHint: {
    fontSize:   13,
    color:      T.textSecondary,
    fontFamily: FONT_BODY.regular,
    textAlign:  'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginTop:         4,
    paddingVertical:   13,
    paddingHorizontal: 28,
    backgroundColor:   T.gold,
    borderRadius:      16,
    shadowColor:       T.gold,
    shadowOpacity:     0.35,
    shadowRadius:      14,
    shadowOffset:      { width:0, height:5 },
    elevation:         5,
  },
  retryBtnPressed: { opacity:0.80 },
  retryBtnText: {
    fontSize:      14,
    fontWeight:    '700',
    color:         T.sheetBg,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: 0.2,
  },

  // [ADD-07] "Search All Countries" CTA
  ctaBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginTop:         4,
    paddingVertical:   11,
    paddingHorizontal: 22,
    borderRadius:      14,
    borderWidth:       1.5,
    borderColor:       T.gold,
    backgroundColor:   T.goldSubtle,
  },
  ctaBtnText: {
    fontSize:      13,
    fontWeight:    '700',
    color:         T.gold,
    fontFamily:    FONT_HEADING.semiBold,
    letterSpacing: 0.1,
  },

  // ── [v4-FEAT-03] Switching overlay — fades in via ReAnimated FadeIn 150ms ────
  // v3.3: instant appear (felt like bug). v4.0: 150ms fade (intentional).
  switchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:      DV.switchOverlay,
    alignItems:           'center',
    justifyContent:       'center',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    zIndex:               99,
  },
  switchSpinner: {
    position:        'absolute',
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: T.sheetBg,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     T.text,
    shadowOpacity:   0.12,
    shadowRadius:    20,
    shadowOffset:    { width:0, height:8 },
    elevation:       10,
  },
  // [UX-01] Wrapper centres the spinner ring + emoji card together
  switchSpinnerWrap: {
    width:           80,
    height:          80,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // [UX-01] ActivityIndicator absolutely fills the wrap so it rings the card
  switchActivityRing: {
    position: 'absolute',
    width:    80,
    height:   80,
  },
  switchFlag: { fontSize:30 },

  // [A11Y-02] Visually hidden — zero-size container used only for live region announcements
  srOnly: { width: 0, height: 0, overflow: 'hidden' },
});
