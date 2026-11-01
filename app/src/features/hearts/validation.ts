import { BotPlaystyle, CARD_RANKS, CARD_SUITS, GameStatus, passDirection, type HeartsAction, type StandardCard } from '@opengamesonline/sevens';
import { HEARTS_APP_ID, HEARTS_GAME_VERSION, type HeartsGameState, type HeartsLobbyMetadata, type HeartsParticipantMetadata } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isHeartsParticipantMetadata(value: unknown): value is HeartsParticipantMetadata {
  return isRecord(value) && value.appId === HEARTS_APP_ID && value.gameVersion === HEARTS_GAME_VERSION &&
    (value.role === 'player' || value.role === 'spectator');
}
function nonnegative(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function card(value: unknown): value is StandardCard {
  return isRecord(value) && value.kind === undefined && CARD_SUITS.includes(value.suit as StandardCard['suit']) && CARD_RANKS.includes(value.rank as StandardCard['rank']);
}
function bots(value: unknown): value is HeartsLobbyMetadata['bots'] {
  return Array.isArray(value) && value.every((bot) => isRecord(bot) && typeof bot.id === 'string' && bot.id.length > 0 &&
    typeof bot.name === 'string' && bot.name.length > 0 && Object.values(BotPlaystyle).includes(bot.playstyle as BotPlaystyle)) &&
    new Set(value.map((bot) => bot.id)).size === value.length;
}
function scores(value: unknown): value is HeartsLobbyMetadata['latestScores'] {
  return Array.isArray(value) && value.every((score) => isRecord(score) && typeof score.playerId === 'string' &&
    typeof score.playerName === 'string' && nonnegative(score.points)) && new Set(value.map((score) => score.playerId)).size === value.length;
}
export function isHeartsLobbyMetadata(value: unknown): value is HeartsLobbyMetadata {
  return isRecord(value) && value.appId === HEARTS_APP_ID && value.gameVersion === HEARTS_GAME_VERSION &&
    value.minPlayers === 4 && value.maxPlayers === 4 && nonnegative(value.playerCount) && value.playerCount <= 4 &&
    nonnegative(value.spectatorCount) && bots(value.bots) && value.bots.length <= value.playerCount &&
    nonnegative(value.roundsPlayed) && scores(value.latestScores) && scores(value.cumulativeScores);
}
export function isHeartsAction(value: unknown): value is HeartsAction {
  if (!isRecord(value)) return false;
  if (value.type === 'nextRound') return true;
  if (value.type === 'play') return card(value.card);
  return value.type === 'pass' && Array.isArray(value.cards) && value.cards.length === 3 && value.cards.every(card);
}
export function isHeartsGameState(value: unknown): value is HeartsGameState {
  if (!isRecord(value) || !Array.isArray(value.players) || value.players.length !== 4 || !bots(value.bots)) return false;
  const players = value.players;
  if (!players.every((p) => isRecord(p) && typeof p.id === 'string' && p.id.length > 0 && Array.isArray(p.hand) &&
      p.hand.every(card) && Array.isArray(p.captured) && p.captured.every(card) && nonnegative(p.score) && nonnegative(p.roundPoints))) return false;
  const ids = players.map((p) => p.id);
  const trick = (v: unknown) => Array.isArray(v) && v.length <= 4 && v.every((play) => isRecord(play) && ids.includes(play.playerId) && card(play.card)) &&
    new Set(v.map((play) => play.playerId)).size === v.length;
  const phases = ['passing', 'playing', 'roundEnd', 'matchEnd'];
  if (new Set(ids).size !== 4 || !phases.includes(value.phase as string) || !Object.values(GameStatus).includes(value.status as GameStatus) ||
      !ids.includes(value.currentPlayerId) || !nonnegative(value.roundNumber) || value.roundNumber < 1 ||
      !nonnegative(value.tricksPlayed) || value.tricksPlayed > 13 || typeof value.heartsBroken !== 'boolean' ||
      !['left', 'right', 'across', 'hold'].includes(value.passDirection as string) ||
      !trick(value.trick) || !trick(value.lastTrick) || !isRecord(value.passes) ||
      !Array.isArray(value.winnerIds) || !value.winnerIds.every((id) => ids.includes(id)) ||
      (value.moonShooterId !== null && !ids.includes(value.moonShooterId)) || !value.bots.every((bot) => ids.includes(bot.id))) return false;
  if (!Object.entries(value.passes).every(([id, selection]) => ids.includes(id) && Array.isArray(selection) && selection.length === 3 &&
      selection.every(card) && new Set(selection.map((c) => `${c.suit}:${c.rank}`)).size === 3 &&
      selection.every((c) => players.find((p) => p.id === id)!.hand.some((held: StandardCard) => held.suit === c.suit && held.rank === c.rank)))) return false;
  // Every card has exactly one owner; lastTrick/passes are references, not extra cards.
  const cards = [...players.flatMap((p) => [...p.hand, ...p.captured]), ...(value.trick as { card: StandardCard }[]).map((play) => play.card)];
  if (cards.length !== 52 || new Set(cards.map((c) => `${c.suit}:${c.rank}`)).size !== 52 ||
    value.passDirection !== passDirection(value.roundNumber) ||
    (value.phase === 'matchEnd') !== (value.status === GameStatus.Finished) ||
    new Set(value.winnerIds).size !== value.winnerIds.length) return false;
  if (value.phase === 'passing') return value.passDirection !== 'hold' && value.tricksPlayed === 0 &&
    (value.trick as unknown[]).length === 0 && players.every((p) => p.hand.length === 13 && p.captured.length === 0) &&
    Object.keys(value.passes).length < 4 && value.winnerIds.length === 0;
  if (Object.keys(value.passes).length !== 0 || (value.trick as unknown[]).length > 3 ||
    players.reduce((sum, p) => sum + p.captured.length, 0) !== value.tricksPlayed * 4) return false;
  if (value.phase === 'playing') return value.tricksPlayed < 13 && value.winnerIds.length === 0;
  const minimum = Math.min(...players.map((p) => p.score));
  return value.tricksPlayed === 13 && players.every((p) => p.hand.length === 0) &&
    (value.phase === 'matchEnd'
      ? players.some((p) => p.score >= 100) && value.winnerIds.length > 0 &&
        value.winnerIds.length === players.filter((p) => p.score === minimum).length &&
        value.winnerIds.every((id) => players.some((p) => p.id === id && p.score === minimum))
      : players.every((p) => p.score < 100) && value.winnerIds.length === 0);
}
