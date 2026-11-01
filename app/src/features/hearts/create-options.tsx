import { CreateActions, type GameSetupProps } from '../card-room/create-actions';
import { useHeartsMultiplayer } from './session-provider';

export function HeartsCreateOptions(props: GameSetupProps) {
  const session = useHeartsMultiplayer();
  return <CreateActions {...props} gameType="hearts" sessionBusy={session.busy} sessionError={session.error}
    options={{ gameName: props.gameName.trim(), participantName: props.participantName.trim(), role: props.role }} />;
}
