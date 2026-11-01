import { useState } from 'react';
import { ErrorBanner, RoomButton } from '@/components/room/room-ui';
import { useCardRoom } from './room-provider';
import type { GameOptions, GameType } from './registry';

export type GameSetupProps = {
  gameName: string;
  participantName: string;
  role: 'player' | 'spectator';
  onVariantChange?(variant: string): void;
  onCreated(): void;
  onCancel(): void;
};

export function CreateActions<K extends GameType>({ gameType, options, gameName, participantName, onCreated, onCancel, sessionBusy, sessionError }: GameSetupProps & {
  gameType: K; options: GameOptions<K>; sessionBusy: boolean; sessionError: string | null;
}) {
  const room = useCardRoom();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const active = room.gameType === gameType;
  const busy = submitting || Boolean(room.pendingCreate) || room.busy || (active && sessionBusy);

  async function submit() {
    if (!gameName.trim()) { setFormError('Enter a lobby name.'); return; }
    if (!participantName.trim()) { setFormError('Enter your name.'); return; }
    setFormError(null);
    setSubmitting(true);
    try { await room.requestCreate({ gameType, options, onCreated }); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not create room'); }
    finally { setSubmitting(false); }
  }
  return <>
    <ErrorBanner message={formError ?? (active ? sessionError : null)} />
    <RoomButton label={busy ? 'Creating…' : 'Create lobby'} variant="primary" disabled={busy} onPress={() => void submit()} />
    <RoomButton label="Cancel" disabled={busy} onPress={onCancel} />
  </>;
}
