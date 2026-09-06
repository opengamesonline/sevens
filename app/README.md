# Sevens App

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
