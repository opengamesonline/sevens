import type { Card } from '@opengamesonline/sevens';

export type HelpExample = {
  title: string;
  rows: readonly { label: string; cards: readonly Card[] }[];
  explanation: string;
};

export type HelpSection = {
  title: string;
  paragraphs: readonly [string, ...string[]];
  examples?: readonly HelpExample[];
};

export type VariantHelp = {
  label: string;
  description: string;
  sections: readonly [HelpSection, ...HelpSection[]];
};

/** A game with selectable variants must provide help for every variant. */
export type GameHelp<Variant extends string = never> = {
  summary: string;
  sections: readonly [HelpSection, ...HelpSection[]];
  variants: [Variant] extends [never] ? null : Readonly<Record<Variant, VariantHelp>>;
};

export type AnyGameHelp = {
  summary: string;
  sections: readonly [HelpSection, ...HelpSection[]];
  variants: Readonly<Record<string, VariantHelp>> | null;
};
