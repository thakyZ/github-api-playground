// import * as fs from "node:fs";
// import * as path from "path";
//import * as process from "process";
// import * as url from "url";
//import { Octokit } from "@octokit/rest";
import { Roarr as logger } from "roarr";

// const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @typedef {object} OctokitResponseError
 * @property {string} message
 * @property {string} documentation_url
 */

/**
 * @typedef {object} OctokitResponseInner
 * @property {string} url
 * @property {number} status
 * @property {{[key:string]:string}} headers
 * @property {OctokitResponseError | OctokitResponsePackageVersion[] | OctokitResponsePackage[]} data
 */

/**
 * @typedef {object} OctokitRequestInner
 * @property {number} timeout
 */

/**
 * @typedef {object} OctokitRequest
 * @property {string} method
 * @property {string} url
 * @property {{[key:string]:string}} headers
 * @property {OctokitRequestInner} request
 */

/**
 * @typedef {object} OctokitResponseOverall
 * @property {string | Object} name
 * @property {number} status
 * @property {OctokitResponseInner} response
 * @property {OctokitRequest} request
 */

/**
 * @typedef {"private" | "public"} PackageVisibility
 */

/**
 * @typedef {object} OctokitResponsePackage
 * @property {number} id
 * @property {string} name
 * @property {string} package_type
 * @property {PackageVisibility} visibility
 * @property {object} owner
 * @property {number} version_count
 * @property {string} url
 * @property {Date} created_at
 * @property {Date} updated_at
 * @property {string} html_url
 */

/**
 * @typedef {object} PackageContainerData
 * @property {string[]} tags
 */

/**
 * @typedef {object} PackageMetadata
 * @property {string} package_type
 * @property {PackageContainerData | undefined} container
 */

/**
 * @typedef {object} OctokitResponsePackageVersion
 * @property {number} id
 * @property {string} name
 * @property {string} url
 * @property {string} package_html_url
 * @property {string} license
 * @property {Date} created_at
 * @property {Date} updated_at
 * @property {string} description
 * @property {string} html_url
 * @property {PackageMetadata} metadata
 */

/**
 * @param {Config} config
 * @param {Octokit} octokit
 * @returns {Promise<number>}
 */
async function run(config, octokit) {
  try {
    /** @type {OctokitResponseOverall} */
    const _allPackages = await octokit.request("GET /users/{username}/packages", {
      username: config.plugins["delete_extra_packages"].user,
      package_type: "container",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (_allPackages.status !== 200) {
      throw new Error(`${_allPackages.response.status} - ${_allPackages.response.data.message} - ${_allPackages.response.data.documentation_url}`);
    }

    /**
     * @type {OctokitResponsePackage[]}
     */
    const allPackages = _allPackages.data;

    /**
     * @type {OctokitResponsePackage}
     */
    let pack = undefined;
    for (pack of allPackages) {
      logger.info(`handling package ${pack.name}`)
      /** @type {OctokitResponseOverall} */
      const _currentPackage = await octokit.request("GET /users/{username}/packages/{package_type}/{package_name}/versions", {
        username: config.plugins["delete_extra_packages"].user,
        package_type: pack.package_type,
        package_name: pack.name,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      if (_currentPackage.status !== 200) {
        throw new Error(`${_currentPackage.response.status} - ${_currentPackage.response.data.message} - ${_currentPackage.response.data.documentation_url}`);
      }


      /**
       * @type {OctokitResponsePackageVersion[]}
       */
      const currentPackage = _currentPackage.data;

      /**
       * @type {OctokitResponsePackageVersion}
       */
      let version = undefined
      for (version of currentPackage) {
        if (!Object.hasOwn(version.metadata, "container") || version.metadata.container.tags.length > 0) {
          continue;
        }

        /** @type {OctokitResponseOverall} */
        const _deletedPackage = await octokit.request("DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}", {
          package_type: pack.package_type,
          package_name: pack.name,
          package_version_id: version.id,
          username: config.plugins["delete_extra_packages"].user,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28"
          }
        });

        if (_deletedPackage.status !== 204) {
          throw new Error(`${_deletedPackage.response} - ${_deletedPackage.response.data.message} - ${_deletedPackage.response.data.documentation_url}`);
        }

        await sleep(100000);
      }
    }
  } catch (error) {
    if (error) {
      logger.error(error.message);
      console.log(error);
    }
    return 1;
  }

  return 0;
}

export default { run }
