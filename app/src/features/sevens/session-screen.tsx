import { SevensVariant } from '@opengamesonline/sevens';
import { SessionShell } from '../card-room/session-shell';
import { GameTable } from './components/game-table';
import { useSevensMultiplayer } from './session-provider';

export default function SevensSession() {
  const session = useSevensMultiplayer();
  const lobby = session.snapshot?.lobbyMetadata;
  return <SessionShell controls={session} gameName="Sevens"
    cautiousBotDescription="Keeps useful runs for itself."
    summary={`3–7 players. ${lobby?.variant === SevensVariant.Joker ? 'Joker' : 'Standard'} · hints ${lobby?.showPlayableCards ? 'on' : 'off'} · draws ${lobby?.preventIllegalDraw ? 'locked' : 'free'}`}>
    {(onLeave) => session.snapshot ? <GameTable snapshot={session.snapshot} actionPending={session.sending}
      continuePending={session.busy || session.sending} reconnecting={session.reconnecting} onContinue={session.continueGame}
      onRetryConnection={session.retryConnection} onSend={session.send} onLeave={onLeave} /> : null}
  </SessionShell>;
}
