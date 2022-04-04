const ignore = process.env.NODE_ENV === 'test' ? [] : ["**/*.test.ts"];

module.exports = {
  presets: [
    "@babel/preset-typescript",
    "@babel/preset-env",
  ],
  sourceMaps: true,
  ignore,
};
