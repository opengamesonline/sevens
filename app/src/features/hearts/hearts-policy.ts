import type { CreateGameOptions, Participant } from '@opengamesonline/expo-lan-multiplayer';
import { BotPlaystyle, initializeHearts, nextHeartsRound, passHeartsCards, playHeartsCard } from '@opengamesonline/sevens';
import { HEARTS_APP_ID, HEARTS_GAME_VERSION, type HeartsBot, type HeartsGameEvent, type HeartsGameState, type HeartsLobbyMetadata, type HeartsParticipantMetadata } from './types';
import { isHeartsAction, isHeartsParticipantMetadata, isRecord } from './validation';

export type CreateHeartsPolicyOptions = {
  gameName: string; participantName: string; role: 'player' | 'spectator';
  recovery?: { lobbyMetadata: HeartsLobbyMetadata; participants: readonly Participant<HeartsParticipantMetadata>[] };
};
export type HeartsPolicy = CreateGameOptions<HeartsGameState, HeartsGameEvent, HeartsParticipantMetadata, HeartsLobbyMetadata> & {
  addBot(playstyle: BotPlaystyle, participants: readonly Participant<HeartsParticipantMetadata>[]): HeartsBot;
  removeBot(id: string): boolean;
};
export function createHeartsParticipantMetadata(role: 'player' | 'spectator'): HeartsParticipantMetadata {
  return { appId: HEARTS_APP_ID, gameVersion: HEARTS_GAME_VERSION, role };
}
export function createHeartsPolicy(options: CreateHeartsPolicyOptions): HeartsPolicy {
  let bots = options.recovery?.lobbyMetadata.bots.map((bot) => ({ ...bot })) ?? [];
  let lastScores = options.recovery?.lobbyMetadata.latestScores ?? [];
  let totals = options.recovery?.lobbyMetadata.cumulativeScores ?? [];
  let roundsPlayed = options.recovery?.lobbyMetadata.roundsPlayed ?? 0;
  let names = new Map<string, string>();
  const humans = (participants: readonly Participant<HeartsParticipantMetadata>[]) => participants.filter((p) => isHeartsParticipantMetadata(p.metadata) && p.metadata.role === 'player');
  return {
    name: options.gameName, participantName: options.participantName, participantMetadata: createHeartsParticipantMetadata(options.role),
    addBot(playstyle, participants) {
      if (!Object.values(BotPlaystyle).includes(playstyle)) throw new Error('Unsupported bot playstyle');
      if (humans(participants).length + bots.length >= 4) throw new Error('The player roster is full');
      let number = 1;
      while (bots.some((b) => b.id === `hearts-bot-${number}` || b.name === `Bot ${number}`) ||
        participants.some((p) => p.id === `hearts-bot-${number}` || p.name.trim().toLowerCase() === `bot ${number}`)) number++;
      const bot = { id: `hearts-bot-${number}`, name: `Bot ${number}`, playstyle };
      bots = [...bots, bot];
      return bot;
    },
    removeBot(id) { const before = bots.length; bots = bots.filter((b) => b.id !== id); return bots.length !== before; },
    getLobbyMetadata(participants) {
      return { appId: HEARTS_APP_ID, gameVersion: HEARTS_GAME_VERSION, minPlayers: 4, maxPlayers: 4,
        playerCount: humans(participants).length + bots.length, spectatorCount: participants.filter((p) => p.metadata.role === 'spectator').length,
        bots: bots.map((b) => ({ ...b })), roundsPlayed, latestScores: [...lastScores], cumulativeScores: [...totals] };
    },
    validateJoin(candidate, participants) {
      if (!isHeartsParticipantMetadata(candidate.metadata)) return 'This participant is not compatible with Hearts';
      if (participants.some((p) => p.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()) ||
        bots.some((b) => b.name.toLowerCase() === candidate.name.trim().toLowerCase())) return 'That participant name is already in use';
      return candidate.metadata.role === 'player' && humans(participants).length + bots.length >= 4 ? 'The player roster is full' : null;
    },
    validateStart(participants, connected) {
      if (humans(participants).length + bots.length !== 4) return 'Hearts requires exactly four players (including bots)';
      return connected && humans(participants).some((p) => !connected.has(p.id)) ? 'All players must reconnect before starting' : null;
    },
    createInitialState(participants) {
      names = new Map([...participants, ...bots].map((p) => [p.id, p.name]));
      roundsPlayed = 0; lastScores = []; totals = [];
      return { ...initializeHearts([...humans(participants), ...bots].map((p) => p.id)), bots: bots.map((b) => ({ ...b })) };
    },
    reduceEvent(game, event, participant, context) {
      let actorId = participant.id;
      let action: unknown = event;
      if (isRecord(event) && event.type === 'botTurn') {
        if (!context.authoritativeHost || !game.bots.some((b) => b.id === event.botId)) return game;
        actorId = event.botId as string; action = event.action;
      } else if (!isHeartsParticipantMetadata(participant.metadata)) return game;
      if (!isHeartsAction(action)) return game;
      if (action.type === 'nextRound') {
        if (!context.authoritativeHost || event.type === 'botTurn') return game;
        const next = nextHeartsRound(game);
        return next ? { ...next, bots: game.bots } : game;
      }
      if (event.type !== 'botTurn' && participant.metadata.role !== 'player') return game;
      const next = action.type === 'pass' ? passHeartsCards(game, actorId, action.cards) : playHeartsCard(game, actorId, action.card);
      if (!next) return game;
      if (next.phase === 'roundEnd' || next.phase === 'matchEnd') {
        // Recover names from the authoritative roster after a host migration.
        names = new Map([...names, ...game.bots.map((b) => [b.id, b.name] as const),
          ...(options.recovery?.participants.map((p) => [p.id, p.name] as const) ?? [])]);
        lastScores = next.players.map((p) => ({ playerId: p.id, playerName: names.get(p.id) ?? p.id, points: p.roundPoints }));
        totals = next.players.map((p) => ({ playerId: p.id, playerName: names.get(p.id) ?? p.id, points: p.score }));
        roundsPlayed = next.roundNumber;
      }
      return { ...next, bots: game.bots };
    },
  };
}
