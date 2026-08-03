import {
  GameStatus,
  Rank,
  TurnActionType,
  cardEquals,
  type Card,
  type TurnAction,
} from '@opengamesonline/sevens';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { cardKey, PlayingCard, suitGlyph } from '@/components/cards/playing-card';
import { RoomButton, RoomPanel } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import {
  selectOpponents,
  selectOwnHand,
  selectParticipantName,
  selectPlayableCards,
  selectSuitRuns,
  type SevensSessionSnapshot,
} from '@/features/multiplayer';

export function GameTable({
  snapshot,
  actionPending,
  onSend,
  onLeave,
}: {
  snapshot: SevensSessionSnapshot;
  actionPending: boolean;
  onSend(action: TurnAction): Promise<void>;
  onLeave(): void;
}) {
  const game = snapshot.state;
  const [selection, setSelection] = useState<{ card: Card; revision: number } | null>(null);
  const selectedCard = selection?.revision === snapshot.revision ? selection.card : null;

  if (!game) {
    return (
      <RoomPanel>
        <Text style={styles.title}>Preparing the table</Text>
        <Text style={styles.muted}>Waiting for the host to deal the cards.</Text>
      </RoomPanel>
    );
  }

  const hand = selectOwnHand(snapshot);
  const playableCards = selectPlayableCards(snapshot);
  const playableKeys = new Set(playableCards.map(cardKey));
  const opponents = selectOpponents(snapshot);
  const suitRuns = selectSuitRuns(snapshot);
  const selfId = snapshot.self?.id ?? null;
  const isPlayer = snapshot.self?.metadata.role === 'player';
  const isCurrentPlayer = isPlayer && game.currentPlayerId === selfId;
  const isDonor = isPlayer && game.pendingDraw?.donorId === selfId;
  const isRequester = isPlayer && game.pendingDraw?.requesterId === selfId;
  const winnerName = selectParticipantName(snapshot, game.winnerId);
  const currentName = selectParticipantName(snapshot, game.currentPlayerId) ?? 'Unknown player';
  const requesterName = selectParticipantName(snapshot, game.pendingDraw?.requesterId ?? null);
  const donorName = selectParticipantName(snapshot, game.pendingDraw?.donorId ?? null);
  const selectedIsPlayable =
    selectedCard !== null && playableCards.some((card) => cardEquals(card, selectedCard));
  const sortedHand = hand
    ? [...hand].sort((left, right) => left.suit.localeCompare(right.suit) || left.rank - right.rank)
    : [];

  async function send(action: TurnAction) {
    await onSend(action);
    setSelection(null);
  }

  const missingPlayer = game.players.find(
    ({ id }) => !snapshot.participants.some((participant) => participant.id === id),
  );

  return (
    <View style={styles.page}>
      <View style={styles.tableHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            {snapshot.self?.metadata.role === 'spectator' ? 'SPECTATOR VIEW' : 'YOUR TABLE'}
          </Text>
          <Text style={styles.title}>
            {game.status === GameStatus.Finished
              ? `${winnerName ?? 'A player'} wins`
              : missingPlayer
                ? 'Match interrupted'
                : `${currentName}'s turn`}
          </Text>
        </View>
        <View style={styles.revisionPill}>
          <Text style={styles.revision}>REV {snapshot.revision}</Text>
        </View>
      </View>

      {missingPlayer ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            {selectParticipantName(snapshot, missingPlayer.id) ?? 'A player'} left the game. This POC
            cannot resume the match.
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.opponents}>
        {opponents.map((opponent) => (
          <View
            key={opponent.id}
            style={[styles.opponent, opponent.isCurrentPlayer && styles.currentOpponent]}
          >
            <View style={styles.cardBack}>
              <Text style={styles.cardBackMark}>7</Text>
            </View>
            <View>
              <Text style={styles.opponentName}>{opponent.name}</Text>
              <Text style={styles.opponentCount}>
                {opponent.cardCount} {opponent.cardCount === 1 ? 'card' : 'cards'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <RoomPanel style={styles.boardPanel}>
        <Text style={styles.panelLabel}>CARDS IN PLAY</Text>
        <View style={styles.suitRows}>
          {suitRuns.map(({ suit, cards }) => (
            <View key={suit} style={styles.suitRow}>
              <Text
                style={[
                  styles.suitLabel,
                  (suit === 'diamonds' || suit === 'hearts') && styles.redSuit,
                ]}
              >
                {suitGlyph(suit)}
              </Text>
              <View style={styles.run}>
                {cards.length === 0 ? (
                  <PlayingCard card={{ suit, rank: Rank.Seven }} compact placeholder />
                ) : (
                  cards.map((card, index) => (
                    <View key={cardKey(card)} style={index > 0 ? styles.overlapCard : undefined}>
                      <PlayingCard card={card} compact />
                    </View>
                  ))
                )}
              </View>
            </View>
          ))}
        </View>
      </RoomPanel>

      {game.pendingDraw ? (
        <View style={styles.drawNotice}>
          <Text style={styles.drawNoticeTitle}>DRAW REQUEST</Text>
          <Text style={styles.drawNoticeText}>
            {isDonor
              ? `${requesterName ?? 'The current player'} is drawing from you. Choose a card to give.`
              : isRequester
                ? `Waiting for ${donorName ?? 'the player on your right'} to choose a card.`
                : `${requesterName ?? 'A player'} is drawing from ${donorName ?? 'their right-hand player'}.`}
          </Text>
        </View>
      ) : null}

      {hand ? (
        <View style={styles.handSection}>
          <View style={styles.handHeading}>
            <Text style={styles.panelLabel}>{isDonor ? 'CHOOSE A CARD TO GIVE' : 'YOUR HAND'}</Text>
            <Text style={styles.handCount}>{hand.length} cards</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hand}
          >
            {sortedHand.map((card, index) => {
              const selected = selectedCard ? cardEquals(card, selectedCard) : false;
              const selectable =
                !actionPending && (isDonor || (isCurrentPlayer && game.pendingDraw === null));
              return (
                <View key={cardKey(card)} style={index > 0 ? styles.handOverlap : undefined}>
                  <PlayingCard
                    card={card}
                    selected={selected}
                    selectable={selectable}
                    playable={isDonor || playableKeys.has(cardKey(card))}
                    onPress={() =>
                      setSelection(selected ? null : { card, revision: snapshot.revision })
                    }
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.spectatorNote}>
          <Text style={styles.spectatorTitle}>Watching from the rail</Text>
          <Text style={styles.muted}>Hands are hidden in spectator mode.</Text>
        </View>
      )}

      {game.status === GameStatus.Active && !missingPlayer && isDonor ? (
        <RoomButton
          label="Give selected card"
          variant="primary"
          disabled={actionPending || !selectedCard}
          onPress={() => {
            if (selectedCard) void send({ type: TurnActionType.GiveCard, card: selectedCard });
          }}
        />
      ) : null}

      {game.status === GameStatus.Active && !missingPlayer && isCurrentPlayer && !game.pendingDraw ? (
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <RoomButton
              label="Play selected"
              variant="primary"
              disabled={actionPending || !selectedIsPlayable}
              onPress={() => {
                if (selectedCard) void send({ type: TurnActionType.Play, card: selectedCard });
              }}
            />
          </View>
          <View style={styles.actionButton}>
            <RoomButton
              label="Draw"
              disabled={actionPending}
              onPress={() => void send({ type: TurnActionType.RequestDraw })}
            />
          </View>
        </View>
      ) : null}

      <RoomButton
        label={snapshot.role === 'host' ? 'End game' : 'Leave game'}
        variant="danger"
        onPress={onLeave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingBottom: 24 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: GameColors.white, fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  muted: { color: GameColors.whiteMuted, fontSize: 14, lineHeight: 20 },
  revisionPill: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: GameColors.border,
  },
  revision: { color: GameColors.whiteMuted, fontSize: 10, fontWeight: '700' },
  alert: {
    borderWidth: 1,
    borderColor: GameColors.danger,
    borderRadius: 12,
    backgroundColor: 'rgba(213,107,98,0.13)',
    padding: 12,
  },
  alertText: { color: '#FFD8D2', lineHeight: 20 },
  opponents: { gap: 9, paddingVertical: 2 },
  opponent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GameColors.border,
    padding: 9,
    minWidth: 144,
    backgroundColor: 'rgba(0,0,0,0.13)',
  },
  currentOpponent: { borderColor: GameColors.gold, backgroundColor: 'rgba(215,174,90,0.1)' },
  cardBack: {
    width: 30,
    height: 42,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: GameColors.creamMuted,
    backgroundColor: GameColors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackMark: { color: GameColors.cream, fontWeight: '900' },
  opponentName: { color: GameColors.white, fontSize: 14, fontWeight: '700' },
  opponentCount: { color: GameColors.whiteMuted, fontSize: 12, marginTop: 2 },
  boardPanel: { paddingHorizontal: 13 },
  panelLabel: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  suitRows: { gap: 8 },
  suitRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58 },
  suitLabel: { width: 30, color: GameColors.cream, fontSize: 23, textAlign: 'center' },
  redSuit: { color: '#EE8C87' },
  run: { flex: 1, flexDirection: 'row', justifyContent: 'center', paddingRight: 8 },
  overlapCard: { marginLeft: -17 },
  drawNotice: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GameColors.gold,
    padding: 13,
    backgroundColor: 'rgba(215,174,90,0.12)',
  },
  drawNoticeTitle: { color: GameColors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  drawNoticeText: { color: GameColors.cream, marginTop: 5, lineHeight: 20 },
  handSection: { gap: 9 },
  handHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  handCount: { color: GameColors.whiteMuted, fontSize: 12 },
  hand: { paddingTop: 15, paddingBottom: 9, paddingHorizontal: 3, paddingRight: 56 },
  handOverlap: { marginLeft: -42 },
  spectatorNote: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GameColors.border,
    borderStyle: 'dashed',
    padding: 20,
  },
  spectatorTitle: { color: GameColors.cream, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
});
