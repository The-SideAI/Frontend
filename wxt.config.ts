import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "MG Extension",
    web_accessible_resources: [
      {
        resources: [
          "inject-init.js",
          "platforms/instagram.js",
          "platforms/telegram.js",
          "utils/common.js"
        ],
        matches: ["*://*.instagram.com/*", "*://*.web.telegram.org/*"]
      }
    ]
  },
});
