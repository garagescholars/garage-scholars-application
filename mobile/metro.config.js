const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Register 3D asset extensions for ViroReact AR models
config.resolver.assetExts.push("glb", "gltf", "obj", "mtl", "vrx", "bin", "hdr", "ktx");

module.exports = config;
