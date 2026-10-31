# Card Room by Draso Labs

The installed app is named **Card Room**, with native identifier
`com.drasolabs.cardroom` on iOS and Android. Sevens is the first supported game;
the Sevens engine package and multiplayer protocol retain their game-specific names.

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

The app persists active table recovery snapshots with AsyncStorage. Temporary disconnects, background suspension, and process restarts attempt to recover the same participant identity automatically. If the host disappears, devices use the table's participant order and authority term to select and advertise a replacement host. Explicitly leaving or closing a table deletes the local recovery record.

## Emulator Bridge

Android emulators advertise LAN games on their virtual networks. To expose those games to an iOS simulator or device on the Mac's network, start the bridge in a separate terminal:

```bash
npm run bridge
```

Leave it running, create a game on an Android emulator, then select the service marked `[bridge emulator-...]` on iOS. The bridge requires `adb` on `PATH` and also starts the Expo LAN dev server.

Run `npm run test:bridge` to test the bridge helpers and `npm run check` to type-check the app.
