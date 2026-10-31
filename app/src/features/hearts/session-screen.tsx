import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cardEquals, getHeartsPlayableCards, heartsRank, type StandardCard } from '@opengamesonline/sevens';
import { cardKey, PlayingCard } from '@/components/cards/playing-card';
import { RoomButton, RoomPanel } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import { SessionShell } from '../card-room/session-shell';
import { useHeartsMultiplayer } from './session-provider';

export default function HeartsSession() {
  const session = useHeartsMultiplayer();
  return <SessionShell controls={session} gameName="Hearts" summary="Exactly four seats. Add bots or wait for friends. Lowest score wins at the 100-point threshold.">
    {(onLeave) => <HeartsTable onLeave={onLeave} />}
  </SessionShell>;
}

function HeartsTable({ onLeave }: { onLeave(): void }) {
  const { snapshot, send, sending, busy, continueGame, reconnecting, retryConnection } = useHeartsMultiplayer();
  const [selection, setSelection] = useState<readonly StandardCard[]>([]);
  const game = snapshot?.state;
  if (!game || !snapshot) return null;
  const selfId = snapshot.self?.id;
  const self = snapshot.self?.metadata.role === 'player' ? game.players.find((p) => p.id === selfId) : null;
  const names = new Map([...snapshot.participants, ...game.bots].map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? 'Player';
  const disconnected = snapshot.status !== 'connected';
  const pending = sending || busy || disconnected;
  const passed = Boolean(selfId && game.passes[selfId]);
  const legal = self ? getHeartsPlayableCards(game, self.id) : [];
  const hand = [...(self?.hand ?? [])].sort((a, b) => a.suit.localeCompare(b.suit) || heartsRank(a) - heartsRank(b));
  const validSelection = selection.filter((card) => hand.some((held) => cardEquals(card, held)));
  function toggle(card: StandardCard) {
    setSelection((current) => current.some((held) => cardEquals(held, card)) ? current.filter((held) => !cardEquals(held, card)) : current.length < 3 ? [...current, card] : current);
  }
  async function pass() {
    if (validSelection.length !== 3) return;
    await send({ type: 'pass', cards: validSelection });
    setSelection([]);
  }
  const roundOver = game.phase === 'roundEnd' || game.phase === 'matchEnd';
  return <>
    <Text style={styles.title}>Hearts · Round {game.roundNumber}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{game.phase === 'passing'
      ? `Pass three cards ${game.passDirection}. ${Object.keys(game.passes).length}/4 ready.`
      : roundOver ? game.phase === 'matchEnd' ? `Match won by ${game.winnerIds.map(nameOf).join(' & ')}` : 'Round complete'
        : `${nameOf(game.currentPlayerId)} to play · trick ${game.tricksPlayed + 1}/13 · hearts ${game.heartsBroken ? 'broken' : 'unbroken'}`}</Text>
    <RoomPanel>
      {[...game.players].sort((a, b) => a.score - b.score).map((player) => <View key={player.id} style={styles.scoreRow}>
        <Text style={styles.name}>{nameOf(player.id)}{player.id === selfId ? ' · YOU' : ''}{game.currentPlayerId === player.id && game.phase === 'playing' ? ' ◀' : ''}</Text>
        <Text style={styles.body}>{player.hand.length} cards · {roundOver ? `+${player.roundPoints} · ` : ''}{player.score} pts</Text>
      </View>)}
    </RoomPanel>
    <RoomPanel>
      <Text style={styles.label}>{game.trick.length ? 'CURRENT TRICK' : game.lastTrick.length ? 'LAST TRICK' : 'THE TABLE'}</Text>
      <View style={styles.trick}>{(game.trick.length ? game.trick : game.lastTrick).map((play) => <View key={play.playerId} style={styles.play}>
        <Text numberOfLines={1} style={styles.player}>{nameOf(play.playerId)}</Text>
        <PlayingCard card={play.card} compact />
      </View>)}</View>
      {!game.trick.length && !game.lastTrick.length ? <Text style={styles.body}>The holder of 2♣ leads after passing.</Text> : null}
    </RoomPanel>
    {self && !roundOver ? <RoomPanel>
      <Text style={styles.label}>{game.phase === 'passing' ? passed ? 'WAITING FOR OTHER PLAYERS' : `SELECT THREE CARDS · ${validSelection.length}/3` : 'YOUR HAND'}</Text>
      <View style={styles.hand}>{hand.map((card) => <PlayingCard key={cardKey(card)} card={card} handSize
        selected={game.phase === 'passing' && !passed && validSelection.some((held) => cardEquals(held, card))}
        playable={game.phase === 'passing' || legal.some((held) => cardEquals(held, card))}
        selectable={!pending && (game.phase === 'passing' ? !passed : legal.some((held) => cardEquals(held, card)))}
        onPress={() => game.phase === 'passing' ? toggle(card) : void send({ type: 'play', card })} />)}</View>
      {game.phase === 'passing' ? <RoomButton label={passed ? 'Cards submitted' : `Pass ${game.passDirection}`} variant="primary"
        disabled={pending || passed || validSelection.length !== 3} onPress={() => void pass()} /> : null}
    </RoomPanel> : null}
    {!self && !roundOver ? <Text style={styles.body}>Spectating · players’ hands stay face down.</Text> : null}
    {game.moonShooterId ? <Text style={styles.body}>{nameOf(game.moonShooterId)} shot the moon. Each opponent receives 26 points.</Text> : null}
    {roundOver && snapshot.role === 'host' ? <RoomButton variant="primary" label={game.phase === 'matchEnd' ? 'Return to lobby' : 'Deal next round'} disabled={pending}
      onPress={() => void (game.phase === 'matchEnd' ? continueGame() : send({ type: 'nextRound' }))} /> : null}
    {roundOver && snapshot.role !== 'host' ? <Text style={styles.body}>Waiting for the host to continue.</Text> : null}
    {disconnected ? <RoomButton label={reconnecting ? 'Recovering…' : 'Retry connection'} disabled={reconnecting} onPress={() => void retryConnection()} /> : null}
    <RoomButton label="Leave table" variant="danger" disabled={sending} onPress={onLeave} />
  </>;
}
const styles = StyleSheet.create({
  title: { color: GameColors.cream, fontSize: 26, fontWeight: '700' }, body: { color: GameColors.whiteMuted, lineHeight: 21 },
  label: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  hand: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, trick: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  play: { alignItems: 'center', gap: 6, flex: 1 }, player: { color: GameColors.cream, fontSize: 10, maxWidth: 70 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, name: { color: GameColors.cream, flex: 1 },
});
