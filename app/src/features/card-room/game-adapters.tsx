import type { ComponentType, ReactNode } from 'react';
import { HeartsCreateOptions } from '../hearts/create-options';
import HeartsSession from '../hearts/session-screen';
import { HeartsMultiplayerProvider } from '../hearts/session-provider';
import { SevensCreateOptions } from '../sevens/create-options';
import SevensSession from '../sevens/session-screen';
import { SevensMultiplayerProvider } from '../sevens/session-provider';
import type { GameSetupProps } from './create-actions';
import type { GameType } from './registry';

type GameAdapter = {
  Provider: ComponentType<{ children: ReactNode; enabled?: boolean }>;
  CreateOptions: ComponentType<GameSetupProps>;
  Session: ComponentType;
};

/** Each registered game supplies its own settings, session and transport adapter. */
export const GAME_ADAPTERS = {
  sevens: { Provider: SevensMultiplayerProvider, CreateOptions: SevensCreateOptions, Session: SevensSession },
  hearts: { Provider: HeartsMultiplayerProvider, CreateOptions: HeartsCreateOptions, Session: HeartsSession },
} satisfies Record<GameType, GameAdapter>;
