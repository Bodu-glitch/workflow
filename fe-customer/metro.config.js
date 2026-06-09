const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix socket.io-client ESM resolution on Metro — force CJS via main field
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.unstable_enablePackageExports = false;

const webMocks = {
  'react-native-maps': path.resolve(__dirname, 'mocks/react-native-maps.web.js'),
};

const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webMocks[moduleName]) {
    return { filePath: webMocks[moduleName], type: 'sourceFile' };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
