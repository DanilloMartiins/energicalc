const path = require("path");

function readJson(relativePathFromSrc) {
  const absolutePath = path.resolve(__dirname, "..", relativePathFromSrc);
  return require(absolutePath);
}

module.exports = {
  readJson
};
