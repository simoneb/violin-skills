/**
 * Variant overrides on top of app.json.
 *
 * Development builds get their own application id so they can sit next to the
 * released app on the same phone. Without that they cannot be installed at all
 * once the release is on the device: a local debug build is signed with the
 * debug key and the release with the EAS upload key, so Android refuses the
 * update (INSTALL_FAILED_UPDATE_INCOMPATIBLE) and the only way in is to
 * uninstall — which takes the practice history with it.
 *
 * APP_VARIANT is set by the development profile in eas.json, and by the
 * `start:dev` / `android:dev` npm scripts for local builds.
 *
 * Everything else lives in app.json; this file only diverges the identity.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'Violin Skills (dev)' : config.name,
  // Distinct scheme too: with both installed, a shared one makes
  // violinskills:// links ambiguous and Android may hand them to either app.
  scheme: IS_DEV ? 'violinskillsdev' : config.scheme,
  android: {
    ...config.android,
    package: IS_DEV ? 'com.simoneb.violinskills.dev' : config.android.package,
  },
});
