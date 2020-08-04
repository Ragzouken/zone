const path = require('path');
const webpack = require('webpack');

module.exports = {
  watch: true,
  mode: 'development',
  entry: './src/main.ts',
  output: {
    filename: 'script.js',
    path: path.resolve(__dirname, '../../public'),
    library: 'zone',
    libraryTarget: 'window',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
            {
                loader: 'ts-loader',
                options: {
                    transpileOnly: true,
                },
            }
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  plugins: [
    new webpack.WatchIgnorePlugin([
      /\.js$/,
      /\.d\.ts$/
    ])
  ],
};
