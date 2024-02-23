import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import * as url from "url";
import { Octokit } from "@octokit/rest";
import { Roarr as logger } from "roarr";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

/**
 * @typedef Config
 * @property {boolean | undefined} error
 * @property {string} token
 * @property {{[key: string]:boolean}} enabled
 * @property {{[key: string]:object}} plugins
 */

/**
 * @returns {Promise<Config>}
 */
async function loadConfig() {
  try {
    const configPath = path.join(__dirname, "..", "config", "config.json")

    if (!fs.existsSync(configPath)) {
      throw new Error(`No config exists in path ${configPath}`);
    }

    const configText = await fs.promises.readFile(configPath, { encoding: "utf-8", flag: "r" });
    const configJson = JSON.parse(configText);
    return configJson;
  } catch (error) {
    logger.error(error);
    return { "error": true };
  }
}

/**
 * @param {{[key: string]:object}} pluginsToRun
 * @param {Config} config
 * @param {Octokit} octokit
 * @returns {Promise<number>}
 */
async function runPlugins(pluginsToRun, config, octokit) {
  /**
   * @type {[string, object][]}
   */
  const plugins = Object.entries(pluginsToRun);
  let name = "";
  /**
   * @type {object}
   */
  let plugin = undefined;
  /**
   * @type {{[key: string]: number}}
   */
  const returned = {}
  for ([name, plugin] of plugins) {
    logger.info(`Running plugin: ${name}`);
    returned[name] = await plugin.run(config, octokit);
  }
  const anyFailed = Object.entries(returned).filter(x => x[1] != 0);
  if (anyFailed.length > 0) {
    logger.info(`At least ${anyFailed.length} plugins failed.`)
    return 1;
  }
  return 0;
}

/**
 * @returns {Promise<number>}
 */
async function run() {
  try {
    logger.info(`Loading config...`);
    /**
     * @type {Config}
     */
    const config = await loadConfig();

    if (Object.hasOwn(config, "error") && config.error === true) {
      return 1;
    }

    const octokit = new Octokit({
      auth: config.token,
      userAgent: "NekoBoiNick GitHub Api Playground",
      timeZone: "America/Los_Angeles",
      baseUrl: "https://api.github.com",
      log: {
        debug: (value) => { logger.debug(value) },
        info: (value) => { logger.info(value) },
        warn: (value) => { logger.warn(value) },
        error: (value) => { logger.error(value) },
      },
      request: {
        agent: undefined,
        fetch: undefined,
        timeout: 10000
      }
    });

    /** @type {{[key: string]:object}} */
    const pluginsToRun = {}

    const enabledEntires = Object.entries(config.enabled);
    let item = "";
    let enabled = false;
    for ([item, enabled] of enabledEntires) {
      if (!enabled) {
        continue;
      }

      logger.info(`Enabling plugin: ${item}`);

      const plugin = await import(`./plugins/${item}.js`);

      pluginsToRun[item] = plugin.default;
    }

    const output = await runPlugins(pluginsToRun, config, octokit);
    return output;
  } catch (error) {
    logger.error(error);
    return 1;
  }
}

logger.info("Running main thread...");
run().then(returned => {
  process.exit(returned);
});
