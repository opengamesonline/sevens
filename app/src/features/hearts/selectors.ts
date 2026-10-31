import type { TablePlayer } from '@/components/room/player-strip';
import type { HeartsSessionSnapshot } from './types';

/** Display public seat information without exposing hands or pass selections. */
export function selectHeartsPlayers(snapshot: HeartsSessionSnapshot): readonly TablePlayer[] {
  const game = snapshot.state;
  if (!game) return [];
  const names = new Map([...snapshot.participants, ...game.bots].map(({ id, name }) => [id, name]));
  const selfId = snapshot.self?.id;
  return game.players.map((player) => {
    const bot = game.bots.some(({ id }) => id === player.id);
    const offline = !bot && (player.id === selfId ? snapshot.status !== 'connected' : !snapshot.connectedParticipantIds.includes(player.id));
    const passing = game.phase === 'passing' ? (game.passes[player.id] ? 'Submitted' : 'Waiting') : null;
    return {
      id: player.id, name: names.get(player.id) ?? 'Left table', cardCount: player.hand.length,
      isSelf: player.id === selfId && snapshot.self?.metadata.role === 'player',
      isCurrentPlayer: game.phase === 'playing' && game.currentPlayerId === player.id,
      detail: [passing, `${player.score} pts`].filter(Boolean).join(' · '), offline,
    };
  });
}
