import { build } from "vite";
import viteConfig from "../vite.config.js";

await build({
  ...viteConfig,
  configFile: false
});
