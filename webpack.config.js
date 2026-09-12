const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
    open: true,
    host: "localhost",
    // PORT lets a second checkout serve itself without evicting the first. Playwright reads the
    // same variable, so the suite and the server always agree.
    port: Number(process.env.PORT) || 8080,
    hot: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "index.html",
      favicon: "src/images/favicon.ico",
    }),
    new webpack.ProvidePlugin({
      p5: "p5",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        loader: "babel-loader",
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2|png|jpg|jpeg|gif|ico|wav|ogg|mp3)$/,
        type: "asset",
      },
    ],
  },
};
