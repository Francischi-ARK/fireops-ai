// ponytail: skip Remotion's slow dependency scan; delete when upstream CLI startup is fast again.
const versions = require("../node_modules/@remotion/cli/dist/versions.js");
versions.validateVersionsBeforeCommand = async () => {};

require("../node_modules/@remotion/cli/dist/index.js").cli().catch((error) => {
  console.error(error);
  process.exit(1);
});
