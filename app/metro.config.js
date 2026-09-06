const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '../library');
const socketsRoot = path.resolve(projectRoot, '../submodules/expo-lan/expo-lan-sockets');
const multiplayerRoot = path.resolve(projectRoot, '../submodules/expo-lan/expo-lan-multiplayer');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [libraryRoot, socketsRoot, multiplayerRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules/expo/node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  '@opengamesonline/sevens': libraryRoot,
  '@opengamesonline/expo-lan-sockets': socketsRoot,
  '@opengamesonline/expo-lan-multiplayer': multiplayerRoot,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath.startsWith(path.join(libraryRoot, 'src')) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js')
  ) {
    const sourcePath = path.resolve(
      path.dirname(context.originModulePath),
      `${moduleName.slice(0, -3)}.ts`,
    );
    if (fs.existsSync(sourcePath)) {
      return { filePath: sourcePath, type: 'sourceFile' };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
