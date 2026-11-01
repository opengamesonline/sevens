import { isJokerCard } from '@opengamesonline/sevens';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayingCard } from '@/components/cards/playing-card';
import { rankLabels } from '@/components/cards/card-text';
import { RoomButton } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import type { HelpExample, HelpSection } from './help-types';
import { GAME_INFO, type GameType } from './registry';

export function HelpLink({ gameType, onPress, disabled = false }: { gameType: GameType; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`How to play ${GAME_INFO[gameType].name}`} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.link, (pressed || disabled) && styles.pressed]}>
    <Text style={styles.linkMark}>?</Text><Text style={styles.linkText}>How to play</Text>
  </Pressable>;
}

function Example({ example }: { example: HelpExample }) {
  return <View style={styles.example}>
    <Text style={styles.exampleTitle}>{example.title}</Text>
    {example.rows.map((row) => <View key={row.label} style={styles.exampleRow}>
      <Text style={styles.rowLabel}>{row.label}</Text>
      <View style={styles.cards} accessible accessibilityLabel={`${row.label}: ${row.cards.map((card) => isJokerCard(card) ? 'Joker' : `${rankLabels[card.rank]} of ${card.suit}`).join(', ')}`}>
        {row.cards.map((card, index) => <PlayingCard key={index} card={card} compact />)}
      </View>
    </View>)}
    <Text style={styles.body}>{example.explanation}</Text>
  </View>;
}

function Section({ section }: { section: HelpSection }) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
    {section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}
    {section.examples?.map((example) => <Example key={example.title} example={example} />)}
  </View>;
}

/** Content can be shown inside the creation modal or a standalone game modal. */
export function HelpSheet({ gameType, onClose, selectedVariant, gameInProgress = false }: {
  gameType: GameType; onClose(): void; selectedVariant?: string; gameInProgress?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { name, help } = GAME_INFO[gameType];
  const variants = help.variants ? Object.entries(help.variants) : [];
  return <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}><Text style={styles.eyebrow}>CARD ROOM GUIDE</Text>
        <Text accessibilityRole="header" style={styles.title}>How to play {name}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close help" onPress={onClose} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.intro}>{help.summary}</Text>
      {gameInProgress ? <Text style={styles.notice}>The game continues while this guide is open.</Text> : null}
      {help.sections.map((section) => <Section key={section.title} section={section} />)}
      {variants.length ? <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Variants</Text>
        {variants.map(([id, variant]) => <View key={id} style={styles.variant}>
          <Text style={styles.variantTitle}>{variant.label}{id === selectedVariant ? ' · Currently Selected' : ''}</Text>
          <Text style={styles.body}>{variant.description}</Text>
          {variant.sections.map((section) => <Section key={section.title} section={section} />)}
        </View>)}
      </View> : null}
    </ScrollView>
    <RoomButton label="Close help" onPress={onClose} />
  </View>;
}

/** Standalone help entry for the lobby and active game. */
export function GameHelpButton({ gameType, selectedVariant, gameInProgress = false }: {
  gameType: GameType; selectedVariant?: string; gameInProgress?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.linkRow}>
    <HelpLink gameType={gameType} onPress={() => setVisible(true)} />
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} accessibilityLabel="Close help" />
        <HelpSheet gameType={gameType} selectedVariant={selectedVariant} gameInProgress={gameInProgress} onClose={() => setVisible(false)} />
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  linkRow: { alignItems: 'flex-end' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  linkMark: { color: GameColors.gold, borderColor: GameColors.gold, borderWidth: 1, borderRadius: 12, width: 23, height: 23, textAlign: 'center', lineHeight: 21, fontWeight: '800' },
  linkText: { color: GameColors.gold, fontSize: 13, fontWeight: '700' }, pressed: { opacity: 0.65 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,18,14,0.74)' },
  sheet: { width: '100%', maxWidth: 720, maxHeight: '90%', alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: GameColors.panelSolid, borderColor: GameColors.border, borderWidth: 1, padding: 20, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headingCopy: { flex: 1, gap: 4 },
  eyebrow: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: GameColors.white, fontSize: 25, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: GameColors.cream, fontSize: 20 },
  scroll: { flexShrink: 1 }, scrollContent: { gap: 20, paddingBottom: 8 },
  intro: { color: GameColors.cream, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  notice: { color: GameColors.gold, fontSize: 12, lineHeight: 18 },
  section: { gap: 8 }, sectionTitle: { color: GameColors.gold, fontSize: 16, fontWeight: '800' },
  body: { color: GameColors.creamMuted, fontSize: 14, lineHeight: 21 },
  example: { borderWidth: 1, borderColor: GameColors.border, borderRadius: 14, padding: 12, backgroundColor: 'rgba(0,0,0,0.13)', gap: 9 },
  exampleTitle: { color: GameColors.white, fontSize: 14, fontWeight: '800' },
  exampleRow: { gap: 5 }, rowLabel: { color: GameColors.whiteMuted, fontSize: 11, fontWeight: '700' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  variant: { gap: 8, borderTopWidth: 1, borderTopColor: GameColors.border, paddingTop: 12 },
  variantTitle: { color: GameColors.white, fontSize: 16, fontWeight: '800' },
});
