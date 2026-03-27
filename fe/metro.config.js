const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix Google OAuth popup on web:
// Metro sends COOP: same-origin by default, which blocks window.opener.postMessage()
// that expo-auth-session uses to receive the token back from the Google popup.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
      middleware(req, res, next);
    };
  },
};

module.exports = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // className support is handled by component wrappers (src/tw)
  globalClassNamePolyfill: false,
});
