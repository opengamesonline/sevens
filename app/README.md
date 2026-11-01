# Card Room by Draso Labs

The installed app is named **Card Room**, with native identifier
`com.drasolabs.cardroom` on iOS and Android. Sevens and Hearts are supported;
the library's existing package name is retained for compatibility.

The app is linked to the new Expo project `@drasolabs/cardroom`
(`6beddb09-a647-4179-820b-b79513017133`).
See [the identity migration checklist](../docs/ios-deployment.md#card-room-identity-migration)
before deploying. Apple submissions target the new Card Room record (`6829304218`).

## Branding

See [branding assets and store checklist](../docs/branding.md). Regenerate the
logo exports with `npm run branding:generate` and validate them with
`npm run test:branding`. Native icon/splash changes require a new app build.

## iOS CI and deployment

See [iOS deployment setup](../docs/ios-deployment.md) for GitHub secrets,
required PR checks, and automatic EAS local builds/TestFlight uploads from `dev`.

## Development Client

Initialize the local LAN package, build the Bun game library, then install the app dependencies:

```bash
git submodule update --init --recursive
cd library && bun install && bun run build
cd ../app && npm install --ignore-scripts
```

Create a local development build:

```bash
npm run android
# or
npm run ios
```

After the development client is installed, start Metro on the LAN with `npm start`. Use `npm run android:device` to select a physical Android device.

Native dependency or app configuration changes require rebuilding the development client.

### iOS builds in the Nix shell

The root `flake.nix` uses `mkShellNoCC` and, on macOS, clears inherited native
compiler/linker, SDK, and deployment-target overrides. Xcode must select its own
compiler driver and SDK; an inherited `LD=ld` can produce
`ld: -objc_abi_version '-Xlinker' not supported (expected 2)`.
`DEVELOPER_DIR` is preserved if you explicitly selected an Xcode installation.

After changing the flake, exit the existing development shell and run
`nix develop` again from the repository root, then `cd app && npm run ios`.
Do not just start a nested shell inside the old environment. If a shell startup
file or direnv hook sets these overrides again afterward, remove that override
there as well. No lockfile update is needed.

## Games and shared rooms

- Choose Sevens or Hearts before creating a room. The game cannot change inside
  a room; leave it first to create/join a different game.
- Nearby rooms share a browser with game filters and room-name search. Joining
  automatically selects the advertised game. Incompatible protocol versions
  are excluded and rejected by the game policies.
- `src/features/card-room/` owns the registry, shared browser coordination,
  player name, room UI, and generic session/bot/recovery lifecycle.
- `src/features/sevens/` and `src/features/hearts/` own their game-specific
  setup, table UI, policies, state validation, and session adapters.
- Expo Router files in `src/app/` are thin entry points (with the shared room browser).

Hearts uses exactly four seats (humans and/or bots), supports spectator hosts,
and plays successive hands to a 100-point match threshold. See
[Hearts rules and testing](../docs/hearts.md) for the exact rules and device checks.

Recovery uses separate game-specific storage keys; Sevens retains its old key
and protocol identity. The last selected game is saved separately so only that
game's session is restored. Explicitly leaving removes that game's saved table.

`npm run test:policy` covers both games, discovery filters, and recovery validation.
Run `npm run check` and `npm run lint` before testing on devices.

The app persists active table recovery snapshots with AsyncStorage. Temporary disconnects, background suspension, and process restarts attempt to recover the same participant identity automatically. If the host disappears, devices use the table's participant order and authority term to select and advertise a replacement host. Explicitly leaving or closing a table deletes the local recovery record.

## Emulator Bridge

Android emulators advertise LAN games on their virtual networks. To expose those games to an iOS simulator or device on the Mac's network, start the bridge in a separate terminal:

```bash
npm run bridge
```

Leave it running, create a game on an Android emulator, then select the service marked `[bridge emulator-...]` on iOS. The bridge requires `adb` on `PATH` and also starts the Expo LAN dev server.

Run `npm run test:bridge` to test the bridge helpers and `npm run check` to type-check the app.
