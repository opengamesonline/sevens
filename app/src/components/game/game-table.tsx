import {
  GameStatus,
  Rank,
  Suit,
  TurnActionType,
  cardEquals,
  isJokerCard,
  type Card,
  type TurnAction,
} from '@opengamesonline/sevens';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { cardKey, PlayingCard, suitGlyph } from '@/components/cards/playing-card';
import { RoomButton, RoomPanel } from '@/components/room/room-ui';
import { GameCardSize, GameColors } from '@/constants/theme';
import {
  canAttemptPlay,
  illegalMoveMessage,
  shouldPresentCardAsPlayable,
  sortFinalScores,
} from '@/features/multiplayer/presentation';
import {
  selectOpponents,
  selectOwnHand,
  selectParticipantName,
  selectPlayableCards,
  selectSuitRuns,
  type SevensSessionSnapshot,
} from '@/features/multiplayer';

const handSuitOrder: Record<Suit, number> = {
  [Suit.Spades]: 0,
  [Suit.Diamonds]: 1,
  [Suit.Clubs]: 2,
  [Suit.Hearts]: 3,
};

export function GameTable({
  snapshot,
  actionPending,
  continuePending,
  reconnecting,
  onSend,
  onContinue,
  onRetryConnection,
  onLeave,
}: {
  snapshot: SevensSessionSnapshot;
  actionPending: boolean;
  continuePending: boolean;
  reconnecting: boolean;
  onSend(action: TurnAction): Promise<void>;
  onContinue(): Promise<void>;
  onRetryConnection(): Promise<void>;
  onLeave(): void;
}) {
  const game = snapshot.state;
  const [selection, setSelection] = useState<{ card: Card; revision: number } | null>(null);
  const [handWidth, setHandWidth] = useState(0);
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
  const showPlayableCards = snapshot.lobbyMetadata?.showPlayableCards ?? false;
  const isCurrentPlayer = isPlayer && game.currentPlayerId === selfId;
  const isDonor = isPlayer && game.pendingDraw?.donorId === selfId;
  const isRequester = isPlayer && game.pendingDraw?.requesterId === selfId;
  const winnerName = selectParticipantName(snapshot, game.winnerId);
  const currentName = selectParticipantName(snapshot, game.currentPlayerId) ?? 'Unknown player';
  const requesterName = selectParticipantName(snapshot, game.pendingDraw?.requesterId ?? null);
  const donorName = selectParticipantName(snapshot, game.pendingDraw?.donorId ?? null);
  const illegalPlayerName = selectParticipantName(snapshot, game.lastIllegalMovePlayerId);
  const illegalMessage = game.lastIllegalMovePlayerId
    ? illegalMoveMessage(illegalPlayerName ?? 'A player')
    : null;
  const finalScores = game.status === GameStatus.Finished
    ? sortFinalScores(
        game.latestScores.map(({ playerId, points }) => ({ playerId, score: points })),
        game.winnerId,
      )
    : [];
  const latestNames = new Map(game.latestScores.map(({ playerId, playerName }) => [playerId, playerName]));
  const cumulativePoints = new Map(
    game.cumulativeScores.map(({ playerId, points }) => [playerId, points]),
  );
  const sortedHand = hand
    ? [...hand].sort(
        (left, right) => {
          if (isJokerCard(left)) return isJokerCard(right) ? 0 : -1;
          if (isJokerCard(right)) return 1;
          return handSuitOrder[left.suit] - handSuitOrder[right.suit] || left.rank - right.rank;
        },
      )
    : [];
  const handCardWidth = GameCardSize.compactWidth * 2;
  const cardsPerHandRow = handWidth
    ? Math.max(1, Math.min(10, Math.floor((handWidth - handCardWidth) / 25) + 1))
    : 8;
  const handRowCount = Math.ceil(sortedHand.length / cardsPerHandRow);
  const balancedCardsPerRow = handRowCount
    ? Math.ceil(sortedHand.length / handRowCount)
    : 0;
  const handRows = Array.from({ length: handRowCount }, (_, index) =>
    sortedHand.slice(
      index * balancedCardsPerRow,
      (index + 1) * balancedCardsPerRow,
    ),
  );

  async function send(action: TurnAction) {
    await onSend(action);
    setSelection(null);
  }

  const localDisconnected = snapshot.status !== 'connected';
  const disconnectedSelf = localDisconnected
    ? game.players.find(({ id }) => id === snapshot.self?.id)
    : undefined;
  const missingPlayer = disconnectedSelf ?? game.players.find(
    ({ id }) =>
      !game.bots.some((bot) => bot.id === id) &&
      !snapshot.connectedParticipantIds.includes(id),
  );
  const turnStatus =
    game.status === GameStatus.Finished
      ? `${winnerName ?? 'A player'} wins`
      : missingPlayer
        ? 'Match interrupted'
        : isCurrentPlayer
          ? 'Your turn'
          : `${currentName}'s turn`;
  const showTurnActions =
    game.status === GameStatus.Active &&
    !localDisconnected &&
    !missingPlayer &&
    isCurrentPlayer &&
    !game.pendingDraw;
  const leaveLabel = game.status === GameStatus.Finished
    ? snapshot.role === 'host' ? 'Close table' : 'Leave table'
    : snapshot.role === 'host' ? 'End game' : 'Leave game';

  return (
    <View style={styles.page}>
      {!isPlayer ? (
        <View style={styles.tableHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SPECTATOR VIEW</Text>
            <Text style={styles.title}>{turnStatus}</Text>
          </View>
          <View style={styles.revisionPill}>
            <Text style={styles.revision}>REV {snapshot.revision}</Text>
          </View>
        </View>
      ) : null}

      {missingPlayer ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            {missingPlayer.id === snapshot.self?.id
              ? reconnecting
                ? 'Reconnecting to the table…'
                : 'Your connection to the table was lost.'
              : `Waiting for ${selectParticipantName(snapshot, missingPlayer.id) ?? 'a player'} to reconnect.`}
          </Text>
        </View>
      ) : null}

      {localDisconnected && !reconnecting ? (
        <RoomButton label="Retry connection" onPress={() => void onRetryConnection()} />
      ) : null}

      {game.status === GameStatus.Finished ? (
        <RoomPanel style={styles.resultsPanel}>
          <View style={styles.resultsHeading}>
            <Text style={styles.resultsTitle}>Round {game.roundNumber} results</Text>
            <Text style={styles.resultsWinner}>{winnerName ?? 'A player'} wins</Text>
          </View>
          <View style={styles.resultsList}>
            {finalScores.map(({ playerId, score }, index) => (
              <View key={playerId} style={styles.resultRow}>
                <Text style={styles.resultPlace}>{index + 1}</Text>
                <View style={styles.resultPlayer}>
                  <Text style={styles.resultName}>
                    {latestNames.get(playerId) ?? selectParticipantName(snapshot, playerId) ?? playerId}
                  </Text>
                  {playerId === game.winnerId ? (
                    <Text style={styles.winnerLabel}>WINNER</Text>
                  ) : null}
                </View>
                <View style={styles.resultPoints}>
                  <Text style={styles.resultScore}>{score} pts</Text>
                  <Text style={styles.resultTotal}>{cumulativePoints.get(playerId) ?? score} total</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.scoringNote}>Low score wins</Text>
        </RoomPanel>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.opponents}
          >
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
        </>
      )}

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

      {illegalMessage ? (
        <View style={styles.illegalNotice}>
          <Text style={styles.illegalNoticeText}>{illegalMessage}</Text>
        </View>
      ) : null}

      {game.status === GameStatus.Finished ? null : hand ? (
        <View style={styles.handSection}>
          <View style={styles.handHeading}>
            <Text style={[styles.panelLabel, !isDonor && styles.turnLabel]}>
              {isDonor ? 'CHOOSE A CARD TO GIVE' : turnStatus}
            </Text>
            <Text style={styles.handCount}>{hand.length} cards</Text>
          </View>
          <View
            style={styles.hand}
            onLayout={({ nativeEvent }) => setHandWidth(nativeEvent.layout.width)}
          >
            {handRows.map((row) => {
              const cardStep =
                row.length > 1 && handWidth > 0
                  ? Math.max(
                      0,
                      Math.min(
                        handCardWidth + 8,
                        (handWidth - handCardWidth) / (row.length - 1),
                      ),
                    )
                  : 0;
              const rowWidth = handCardWidth + cardStep * (row.length - 1);

              return (
                <View
                  key={cardKey(row[0]!)}
                  style={[styles.handRow, { width: Math.max(handCardWidth, rowWidth) }]}
                >
                  {row.map((card, index) => {
                    const selected = selectedCard ? cardEquals(card, selectedCard) : false;
                    const selectable =
                      !actionPending &&
                      (isDonor || (isCurrentPlayer && game.pendingDraw === null));
                    return (
                      <View
                        key={cardKey(card)}
                        style={[styles.overlappingHandCard, { left: cardStep * index }]}
                      >
                        <PlayingCard
                          card={card}
                          handSize
                          selected={selected}
                          selectable={selectable}
                          playable={shouldPresentCardAsPlayable(
                            showPlayableCards,
                            isDonor,
                            playableKeys.has(cardKey(card)),
                          )}
                          onPress={() => {
                            setSelection(selected ? null : { card, revision: snapshot.revision });
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
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

      {game.status === GameStatus.Finished && snapshot.role === 'host' ? (
        <RoomButton
          label={continuePending ? 'Returning to lobby…' : 'Continue to lobby'}
          variant="primary"
          disabled={continuePending}
          onPress={() => void onContinue()}
        />
      ) : null}

      {game.status === GameStatus.Finished && snapshot.role !== 'host' ? (
        <View style={styles.continueNotice}>
          <Text style={styles.continueNoticeText}>Waiting for the host to continue.</Text>
        </View>
      ) : null}

      {showTurnActions ? (
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <RoomButton
              label="Play selected"
              variant="primary"
              compact
              disabled={!canAttemptPlay(selectedCard, actionPending)}
              onPress={() => {
                if (!selectedCard) return;
                void send({ type: TurnActionType.Play, card: selectedCard });
              }}
            />
          </View>
          <View style={styles.actionButton}>
            <RoomButton
              label="Draw"
              compact
              disabled={actionPending}
              onPress={() => void send({ type: TurnActionType.RequestDraw })}
            />
          </View>
          <View style={styles.actionButton}>
            <RoomButton
              label={leaveLabel}
              variant="danger"
              compact
              onPress={onLeave}
            />
          </View>
        </View>
      ) : null}

      {!showTurnActions ? (
        <RoomButton
          label={leaveLabel}
          variant="danger"
          onPress={onLeave}
        />
      ) : null}
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
  resultsPanel: { gap: 18 },
  resultsHeading: { gap: 3 },
  resultsTitle: { color: GameColors.white, fontSize: 28, fontWeight: '800' },
  resultsWinner: { color: GameColors.gold, fontSize: 16, fontWeight: '700' },
  resultsList: { gap: 8 },
  resultRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(246,240,223,0.07)',
  },
  resultPlace: { width: 20, color: GameColors.gold, fontSize: 16, fontWeight: '900' },
  resultPlayer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { color: GameColors.cream, fontSize: 16, fontWeight: '700' },
  winnerLabel: { color: GameColors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  resultScore: { color: GameColors.white, fontSize: 17, fontWeight: '800' },
  resultPoints: { alignItems: 'flex-end' },
  resultTotal: { color: GameColors.whiteMuted, fontSize: 10, marginTop: 2 },
  scoringNote: { color: GameColors.whiteMuted, fontSize: 12, textAlign: 'right' },
  continueNotice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.border,
    padding: 12,
  },
  continueNoticeText: { color: GameColors.creamMuted, textAlign: 'center' },
  panelLabel: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  turnLabel: { color: GameColors.cream, fontSize: 17, letterSpacing: 0 },
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
  illegalNotice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.danger,
    backgroundColor: 'rgba(213,107,98,0.14)',
    padding: 12,
  },
  illegalNoticeText: { color: '#FFD8D2', fontWeight: '700', lineHeight: 20 },
  handSection: { gap: 9 },
  handHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  handCount: { color: GameColors.whiteMuted, fontSize: 12 },
  hand: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 9,
    paddingBottom: 5,
  },
  handRow: {
    position: 'relative',
    height: GameCardSize.compactHeight * 2,
  },
  overlappingHandCard: { position: 'absolute', top: 0 },
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
