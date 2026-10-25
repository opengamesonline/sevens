# iOS CI and TestFlight deployment

The `iOS` GitHub Actions workflow follows the local-build pattern used by
[Sudokuru/Frontend](https://github.com/Sudokuru/Frontend/blob/main/.github/workflows/pipeline.yml).
Android builds and public App Store releases are not included.

## What runs

- PRs targeting `dev`: game library build, type-checks, library tests, app lint,
  app policy tests, and bridge-helper tests. These checks need no Expo/Apple secrets.
- Pushes/merges to `dev`: checks, followed by a signed iOS release build on a
  GitHub macOS runner, then an EAS Submit upload to Apple.
- Manual runs: checks on the selected branch; deployment only when selecting `dev`.

No path filters are used, so required PR checks are not left pending on docs-only
changes. Outdated PR runs are canceled. Deployments are serialized and active
builds/uploads are not canceled by newer pushes. GitHub concurrency may replace
an older pending run when multiple new commits arrive while a deployment runs.

The workflow uses Node 26.5.0, Bun 1.3.13, EAS CLI 25.3.0, and Xcode 26.4
on `macos-26` (Expo SDK 57 requires Xcode 26.4 or newer). If GitHub removes that
Xcode version, update the selection to a supported newer version.

## One-time GitHub setup

1. In Expo, create a [personal access token](https://docs.expo.dev/accounts/programmatic-access/#personal-access-tokens)
   for a user with access to the `drasolabs/sevens` project and its credentials.
   Treat it like a password; never commit it or paste it into an issue/chat.
2. In GitHub, open **Settings → Environments**, create **testflight**, and restrict
   its deployment branches to the selected branch `dev`. Do not require manual
   reviewers if you want automatic deployment after merges.
3. In that environment, add the secret **EXPO_TOKEN** containing the token.
   Expo stores the Apple distribution certificate, provisioning profile, and
   App Store Connect API key; do not copy those into this repository.
4. Under **Settings → Rules → Rulesets** (or **Branches → Branch protection**),
   protect `dev`: require a pull request, require the **CI checks** status check
   from this workflow, and require the branch to be up to date before merging.
   Restrict bypasses/direct pushes as appropriate.
   Run the workflow on a PR first if GitHub has not yet discovered the check name.

Adding workflow files does not configure branch protection or environment rules.
These GitHub settings must be applied separately. Feature availability depends
on your repository visibility and GitHub plan.

## Expo and Apple configuration

- Expo project: `@drasolabs/sevens`, project ID
  `cf266b75-da16-4843-bea0-25bd563f9daa`.
- iOS bundle ID: `com.drasolabs.sevens`.
- App Store Connect Apple ID: `6826725191` (`submit.production.ios.ascAppId`).
- `production` uses store distribution and Expo-managed remote signing credentials.
- `cli.appVersionSource` is `remote` and `production.autoIncrement` is enabled:
  EAS maintains/increments the iOS build number, including for local builds.
  The user-facing version is `expo.version` in `app/app.json` (currently `0.1.0`).
  Keep it aligned with `app/package.json` and its lockfile when changing versions.
- If EAS asks to initialize remote version state interactively before the first
  CI build, run `npx eas-cli@25.3.0 build:version:set --platform ios --profile production`
  from `app` and follow the prompts. Use a build number higher than any already uploaded.

The game library is built before app installation. EAS local builds work in a
fresh temporary copy, so `eas-build-pre-install` also installs/builds `../library`
inside that copy. Merely building ignored `library/dist` on the outer runner
would not be sufficient. Checkout initializes public submodules recursively at
their committed revisions; it does not follow the submodule's latest `dev` tip.

## First deployment

1. Open a PR into `dev` containing the workflow and app/EAS configuration.
2. Confirm **CI checks** passes and enable it as a required check.
3. Merge the PR. The workflow checks the merged commit, builds the `.ipa`, saves
   it as a GitHub artifact for 14 days, and waits for EAS Submit to finish uploading.
4. Open [App Store Connect](https://appstoreconnect.apple.com/) → your app →
   **TestFlight**. Apple processes the uploaded build separately; a successful
   upload does not mean it is immediately installable.
5. Complete any export-compliance questions and required beta information, then
   add the build to your internal testing group. External testing can require
   Apple's beta review. The workflow does not create groups/invite testers or
   automatically enable external distribution.

This does **not** submit the app for public App Store review or release it.
If uploads are blocked, check Apple agreements, API key permissions, and that the
API key is assigned to this Expo project for EAS Submit.

## Retry and costs

Use **Actions → iOS → Run workflow**, selecting `dev`, to build and submit again.
The new build gets a new build number. If only submission failed, the signed
binary is retained as an artifact; it can be downloaded and submitted without
rebuilding:

```sh
# From app, after downloading/extracting the artifact:
npx eas-cli@25.3.0 submit --platform ios --profile production --no-auto-testflight-setup --path /path/to/sevens.ipa
```

Do not re-upload an already accepted build with the same version/build number.
Treat signed artifacts as release material and review repository access before
retaining them in a public repository.

Compilation runs on GitHub, not Expo cloud build workers. GitHub runner/storage
usage is subject to your GitHub plan. EAS Submit uploads the binary through
Expo's service using the API key stored there; Apple's processing/review is
separate. See [Expo pricing](https://expo.dev/pricing) for current service terms.

## References

- [Expo SDK 57 requirements](https://docs.expo.dev/versions/v57.0.0/)
- [Local builds](https://docs.expo.dev/build-reference/local-builds/)
- [Managed credentials](https://docs.expo.dev/app-signing/managed-credentials/)
- [Monorepo builds](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [EAS Submit for iOS](https://docs.expo.dev/submit/ios/)
