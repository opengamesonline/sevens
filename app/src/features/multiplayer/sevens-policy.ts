import type { CreateGameOptions, Participant } from '@opengamesonline/expo-lan-multiplayer';
import {
  BotPlaystyle,
  GameStatus,
  Suit,
  createFinalScores,
  getPlayableCards,
  initializeSevens,
  SevensVariant,
  TurnActionType,
  validateTurn,
  type StandardCard,
  type TurnAction,
} from '@opengamesonline/sevens';

import { cardLabel } from '@/components/cards/card-text';

import {
  MAX_SEVENS_PLAYERS,
  MIN_SEVENS_PLAYERS,
  SEVENS_APP_ID,
  SEVENS_GAME_VERSION,
  type SevensBot,
  type SevensGameEvent,
  type SevensGameState,
  type SevensLobbyMetadata,
  type SevensMoveLogEntry,
  type SevensParticipantMetadata,
  type SevensParticipantRole,
  type SevensScore,
} from './types';
import { illegalMoveMessage } from './presentation';
import {
  isSevensBotTurnEvent,
  isSevensParticipantMetadata,
  isTurnAction,
} from './validation';

export type CreateSevensPolicyOptions = {
  gameName: string;
  participantName: string;
  role: SevensParticipantRole;
  maxPlayers: number;
  showPlayableCards: boolean;
  preventIllegalDraw: boolean;
  variant?: SevensVariant;
  recovery?: {
    lobbyMetadata: SevensLobbyMetadata;
    participants: readonly Participant<SevensParticipantMetadata>[];
  };
};

export type SevensPolicy = CreateGameOptions<
  SevensGameState,
  SevensGameEvent,
  SevensParticipantMetadata,
  SevensLobbyMetadata
> & {
  addBot(
    playstyle: BotPlaystyle,
    participants: readonly Participant<SevensParticipantMetadata>[],
  ): SevensBot;
  removeBot(botId: string): boolean;
};

export function createSevensParticipantMetadata(
  role: SevensParticipantRole,
): SevensParticipantMetadata {
  return {
    appId: SEVENS_APP_ID,
    gameVersion: SEVENS_GAME_VERSION,
    role,
  };
}

function players(
  participants: readonly Participant<SevensParticipantMetadata>[],
): Participant<SevensParticipantMetadata>[] {
  return participants.filter(
    (participant) =>
      isSevensParticipantMetadata(participant.metadata) &&
      participant.metadata.role === 'player',
  );
}

function spectators(
  participants: readonly Participant<SevensParticipantMetadata>[],
): Participant<SevensParticipantMetadata>[] {
  return participants.filter(
    (participant) =>
      isSevensParticipantMetadata(participant.metadata) &&
      participant.metadata.role === 'spectator',
  );
}

const MAX_MOVE_LOG_ENTRIES = 50;

const moveLogSuitOrder: readonly Suit[] = [
  Suit.Spades,
  Suit.Diamonds,
  Suit.Clubs,
  Suit.Hearts,
];

function boardAdditions(
  prev: SevensGameState['board'],
  next: SevensGameState['board'],
): StandardCard[] {
  const added: StandardCard[] = [];
  for (const suit of moveLogSuitOrder) {
    const prevBounds = prev[suit];
    const nextBounds = next[suit];
    if (nextBounds.min === null || nextBounds.max === null) continue;
    for (let rank = nextBounds.min; rank <= nextBounds.max; rank += 1) {
      if (
        prevBounds.min === null ||
        prevBounds.max === null ||
        rank < prevBounds.min ||
        rank > prevBounds.max
      ) {
        added.push({ suit, rank });
      }
    }
  }
  return added;
}

function appendMoveLog(
  game: SevensGameState,
  texts: readonly string[],
): readonly SevensMoveLogEntry[] {
  const base = game.moveLog;
  return [
    ...base,
    ...texts.map((text, index) => ({
      key: `${game.roundNumber}-${base.length + index}`,
      text,
    })),
  ].slice(-MAX_MOVE_LOG_ENTRIES);
}

export function createSevensPolicy({
  gameName,
  participantName,
  role,
  maxPlayers,
  showPlayableCards,
  preventIllegalDraw,
  variant = SevensVariant.Standard,
  recovery,
}: CreateSevensPolicyOptions): SevensPolicy {
  const restoredLobby = recovery?.lobbyMetadata;
  const policyMaxPlayers = restoredLobby?.maxPlayers ?? maxPlayers;
  const policyShowPlayableCards = restoredLobby?.showPlayableCards ?? showPlayableCards;
  const policyPreventIllegalDraw = restoredLobby?.preventIllegalDraw ?? preventIllegalDraw;
  const policyVariant = restoredLobby?.variant ?? variant;
  if (
    !Number.isInteger(policyMaxPlayers) ||
    policyMaxPlayers < MIN_SEVENS_PLAYERS ||
    policyMaxPlayers > MAX_SEVENS_PLAYERS
  ) {
    throw new RangeError(
      `Maximum players must be between ${MIN_SEVENS_PLAYERS} and ${MAX_SEVENS_PLAYERS}`,
    );
  }

  let bots: SevensBot[] = restoredLobby?.bots.map((bot) => ({ ...bot })) ?? [];
  let nextBotNumber =
    Math.max(
      0,
      ...bots.map(({ id }) => Number.parseInt(id.replace('sevens-bot-', ''), 10) || 0),
    ) + 1;
  let roundsPlayed = restoredLobby?.roundsPlayed ?? 0;
  let latestScores: SevensScore[] =
    restoredLobby?.latestScores.map((score) => ({ ...score })) ?? [];
  let cumulativeScores: SevensScore[] =
    restoredLobby?.cumulativeScores.map((score) => ({ ...score })) ?? [];
  let roundPlayerNames = new Map<string, string>([
    ...(recovery?.participants.map(({ id, name }) => [id, name] as const) ?? []),
    ...bots.map(({ id, name }) => [id, name] as const),
  ]);

  function flagIllegalMove(target: SevensGameState, offenderId: string): SevensGameState {
    if (target.lastIllegalMovePlayerId === offenderId) {
      return { ...target, lastIllegalMovePlayerId: offenderId };
    }
    return {
      ...target,
      lastIllegalMovePlayerId: offenderId,
      moveLog: appendMoveLog(target, [
        illegalMoveMessage(roundPlayerNames.get(offenderId) ?? offenderId),
      ]),
    };
  }

  return {
    name: gameName,
    participantName,
    participantMetadata: createSevensParticipantMetadata(role),
    addBot(playstyle, participants) {
      if (!Object.values(BotPlaystyle).includes(playstyle)) {
        throw new RangeError(`Unsupported bot playstyle: ${String(playstyle)}`);
      }
      if (players(participants).length + bots.length >= policyMaxPlayers) {
        throw new Error('The player roster is full');
      }

      const usedNames = new Set(participants.map(({ name }) => name.trim().toLowerCase()));
      let name = `Bot ${nextBotNumber}`;
      while (usedNames.has(name.toLowerCase()) || bots.some((bot) => bot.name === name)) {
        nextBotNumber += 1;
        name = `Bot ${nextBotNumber}`;
      }
      const bot = {
        id: `sevens-bot-${nextBotNumber}`,
        name,
        playstyle,
      };
      nextBotNumber += 1;
      bots = [...bots, bot];
      return bot;
    },
    removeBot(botId) {
      const nextBots = bots.filter(({ id }) => id !== botId);
      if (nextBots.length === bots.length) return false;
      bots = nextBots;
      return true;
    },
    createInitialState(participants) {
      const humanPlayers = players(participants);
      const playerIds = [...humanPlayers.map(({ id }) => id), ...bots.map(({ id }) => id)];
      roundPlayerNames = new Map([
        ...humanPlayers.map(({ id, name }) => [id, name] as const),
        ...bots.map(({ id, name }) => [id, name] as const),
      ]);
      const roundNumber = roundsPlayed + 1;
      return {
        ...initializeSevens(playerIds, policyVariant),
        lastIllegalMovePlayerId: null,
        bots: bots.map((bot) => ({ ...bot })),
        roundNumber,
        latestScores: latestScores.map((score) => ({ ...score })),
        cumulativeScores: cumulativeScores.map((score) => ({ ...score })),
        moveLog: [{ key: `${roundNumber}-0`, text: `Round ${roundNumber} dealt.` }],
      };
    },
    getLobbyMetadata(participants) {
      return {
        appId: SEVENS_APP_ID,
        gameVersion: SEVENS_GAME_VERSION,
        playerCount: players(participants).length + bots.length,
        spectatorCount: spectators(participants).length,
        minPlayers: MIN_SEVENS_PLAYERS,
        maxPlayers: policyMaxPlayers,
        bots: bots.map((bot) => ({ ...bot })),
        roundsPlayed,
        latestScores: latestScores.map((score) => ({ ...score })),
        cumulativeScores: cumulativeScores.map((score) => ({ ...score })),
        showPlayableCards: policyShowPlayableCards,
        preventIllegalDraw: policyPreventIllegalDraw,
        variant: policyVariant,
      };
    },
    validateJoin(candidate, participants) {
      if (!isSevensParticipantMetadata(candidate.metadata)) {
        return 'This participant is not compatible with Sevens';
      }

      const candidateName = candidate.name.trim().toLowerCase();
      if (
        participants.some(
          ({ name }) => name.trim().toLowerCase() === candidateName,
        ) || bots.some(({ name }) => name.trim().toLowerCase() === candidateName)
      ) {
        return 'That participant name is already in use';
      }

      if (
        candidate.metadata.role === 'player' &&
        players(participants).length + bots.length >= policyMaxPlayers
      ) {
        return 'The player roster is full';
      }

      return null;
    },
    validateStart(participants, connectedParticipantIds) {
      const playerCount = players(participants).length + bots.length;
      if (
        connectedParticipantIds &&
        players(participants).some(({ id }) => !connectedParticipantIds.has(id))
      ) {
        return 'All players must reconnect before starting';
      }
      return playerCount < MIN_SEVENS_PLAYERS
        ? `At least ${MIN_SEVENS_PLAYERS} players are required to start`
        : null;
    },
    reduceEvent(game, event, participant, context) {
      let actorId: string;
      let action: TurnAction;
      if (
        isSevensParticipantMetadata(participant.metadata) &&
        participant.metadata.role === 'player' &&
        isTurnAction(event)
      ) {
        actorId = participant.id;
        action = event;
      } else if (
        context.authoritativeHost &&
        isSevensBotTurnEvent(event) &&
        game.bots.some(({ id }) => id === event.botId)
      ) {
        actorId = event.botId;
        action = event.action;
      } else {
        return game;
      }

      const nextGame = validateTurn(game, actorId, action);
      if (!nextGame) {
        if (game.status === GameStatus.Active && action.type === TurnActionType.Play) {
          return flagIllegalMove(game, actorId);
        }
        return game;
      }
      if (
        policyPreventIllegalDraw &&
        action.type === TurnActionType.RequestDraw &&
        game.pendingDraw === null &&
        actorId === game.currentPlayerId
      ) {
        const actor = game.players.find(({ id }) => id === actorId);
        const playable = actor
          ? getPlayableCards(game.board, actor.hand, game.variant, {
              playerId: actorId,
              players: game.players,
            })
          : [];
        if (playable.length > 0) {
          return flagIllegalMove(game, actorId);
        }
      }
        const texts: string[] = [];
        const nameOf = (playerId: string) => roundPlayerNames.get(playerId) ?? playerId;
        if (!game.pendingDraw && nextGame.pendingDraw) {
          texts.push(
            `${nameOf(nextGame.pendingDraw.requesterId)} draws from ${nameOf(nextGame.pendingDraw.donorId)}.`,
          );
        }
        const played = boardAdditions(game.board, nextGame.board);
        if (played.length > 0) {
          texts.push(`${nameOf(actorId)} played ${played.map(cardLabel).join(', ')}.`);
        }
        if (game.pendingDraw && !nextGame.pendingDraw) {
          texts.push(
            `${nameOf(game.pendingDraw.donorId)} gave a card to ${nameOf(game.pendingDraw.requesterId)}.`,
          );
        }
        if (game.status === GameStatus.Active && nextGame.status === GameStatus.Finished) {
          latestScores = createFinalScores(nextGame).map(({ playerId, score }) => ({
            playerId,
            playerName: roundPlayerNames.get(playerId) ?? playerId,
            points: score,
          }));
          const totals = new Map(
            cumulativeScores.map((score) => [score.playerId, { ...score }] as const),
          );
          latestScores.forEach((score) => {
            const previous = totals.get(score.playerId);
            totals.set(score.playerId, {
              playerId: score.playerId,
              playerName: score.playerName,
              points: (previous?.points ?? 0) + score.points,
            });
          });
          cumulativeScores = [...totals.values()];
          roundsPlayed += 1;
          const winnerPoints = latestScores.find(
            ({ playerId }) => playerId === nextGame.winnerId,
          )?.points;
          texts.push(
            `${nameOf(nextGame.winnerId ?? '')} wins round ${game.roundNumber}` +
              (winnerPoints !== undefined ? ` · ${winnerPoints} pts` : ''),
          );
        }

        return {
          ...nextGame,
          bots: game.bots,
          roundNumber: game.roundNumber,
          latestScores: latestScores.map((score) => ({ ...score })),
          cumulativeScores: cumulativeScores.map((score) => ({ ...score })),
          lastIllegalMovePlayerId: null,
          moveLog: appendMoveLog(game, texts),
        };
    },
  };
}
