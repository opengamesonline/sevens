# Sevens branding

The mark combines a bold seven, a red diamond, and a fan of playing cards. It
uses the game's existing felt, cream, gold, and red palette. All lettering is
vector geometry; no font or stock artwork is required.

## Assets

| Use | Path (relative to `app/`) |
| --- | --- |
| Editable, transparent logo | `assets/branding/mark.svg` |
| Editable themed icon mask | `assets/branding/monochrome.svg` |
| Opaque 1024 × 1024 launcher icon | `assets/images/icon.png` |
| iOS Icon Composer project | `assets/expo.icon/` |
| Android adaptive layers | `assets/images/android-icon-{foreground,background,monochrome}.png` |
| Transparent launch-screen mark | `assets/images/splash-icon.png` |
| Web favicon | `assets/images/favicon.png` |

Regenerate the PNGs and iOS vector layer after editing the vector sources:

```sh
cd app
npm run branding:generate
npm run test:branding
```

The iOS icon keeps a separate background and vector foreground for system
rendering. Android foreground and monochrome artwork fit within the central
66/108 safe circle; the system supplies its own launcher mask. The monochrome
variant uses transparent cutouts for the seven and diamond.

The launch screen reuses the mark on `#042B23`, matching the initial game UI.
It does not need its own illustration, animation, or artificial loading delay.
Native assets require a new app build; a JavaScript update is not sufficient.
Check launcher masks, iOS icon appearances, and launch screens on preview or
production builds. Expo Go and development-client splash screens are not
representative of the production launch experience.

## Store-release checklist

These store assets are separate from the assets configured in the app:

- **Both stores:** screenshots showing the real app, in the sizes requested by
  App Store Connect / Play Console. iPad screenshots are needed if shipping an
  iPad app. Localize any screenshot copy for the target markets.
- **Google Play:** a separate 512 × 512 store icon export and a required
  1024 × 500 feature graphic (JPEG or opaque PNG). The feature graphic is
  promotional artwork, not a splash screen.
- **Apple App Store:** the store icon comes from the app build; no separate
  feature banner is required for a standard listing.
- **Optional:** app preview video, wordmark, website/social sharing artwork,
  and promotional illustrations. An Android notification icon is only needed
  if notifications are added; it is a separate small monochrome asset, not the
  full-color launcher icon.

Screenshots, store exports, and promotional artwork are not generated here.
Store descriptions, support/privacy URLs, and privacy/age-rating declarations
also need completing, but are not logo assets.

References: [Expo icons and launch screens](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/),
[Google Play assets](https://support.google.com/googleplay/android-developer/answer/9866151),
[Apple screenshot sizes](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).
