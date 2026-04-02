import cp from "child_process";
import path from "path";

import fs from "fs-extra";

const OWNER_ID = "aetherknight";
const REPOSITORY_ID = "tarot-cards-for-vtt-foundry";
const MODULE_ID = "tarot-cards-for-vtt";

const run = async (
  command /* string */,
  args /* Array<string> */,
  options /* { stdio?: any } */,
) /* Promise<any> */ => {
  const stdio = options?.stdio ?? "inherit";
  // not actually async. Don't want to write the wrapper around node's old
  // asynchronous code to use async/await for this
  const result = cp.spawnSync(command, args, {
    stdio: stdio,
    encoding: "utf-8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw `${command} exited with status ${result.status}`;
  return Promise.resolve(result);
};

export const getFoundryDataPath = async () /* Promise<string> */ => {
  const result = await run("npx", ["fvtt", "configure", "get", "dataPath"], {
    stdio: ["pipe", "pipe", "inherit"], // still print stderr
  });
  return result.stdout.trim();
};

/** Setup the repo for development in a local Foundry instance.
 *
 * It relies on the configured dataPath for the fvtt command line to find the
 * location of the Foundry deployment, to symlink the module into place.
 */
export const setup = async () => {
  const dataPath = await getFoundryDataPath();
  const modulePathInFoundry = `${dataPath}/Data/modules/${MODULE_ID}`;
  const moduleSourcePath = `${import.meta.dirname}/dist`;

  await fs.ensureDir(path.resolve(".", "dist"));
  await fs.ensureSymlink(moduleSourcePath, modulePathInFoundry);
};

const unpackPack = async (packName /* string */) => {
  await run("npx", [
    "fvtt",
    "package",
    "unpack",
    "--type",
    "Module",
    "--id",
    MODULE_ID,
    "-n",
    packName,
    "--yaml",
  ]);
};

const packPack = async (packName /* string */) => {
  const packPath = path.resolve(".", "dist", "packs", packName);
  if (await fs.exists(packPath)) {
    await fs.remove(packPath);
  }
  await fs.ensureDir(packPath);
  await run("npx", [
    "fvtt",
    "package",
    "pack",
    "--type",
    "Module",
    "--id",
    MODULE_ID,
    "-n",
    packName,
    "--in",
    `./src/packs/${packName}`,
    "--out",
    `./dist/packs/`,
    "--yaml",
  ]);
};

export const unpack = async () => {
  await setup();
  await unpackPack("tarot-cards-for-vtt");
};

export const pack = async () => {
  await setup();
  await packPack("tarot-cards-for-vtt");
};

export const images = async () => {
  const imagePath = path.resolve(".", "dist", "images");
  if (await fs.exists(imagePath)) {
    await fs.remove(imagePath);
  }
  await fs.ensureDir(imagePath);
  await fs.copy(path.resolve("public", "images"), imagePath);
};

export const files = async () => {
  await fs.ensureDir(path.resolve(".", "dist"));
  const filesToCopy = [
    [path.resolve(".", "README.md"), path.resolve(".", "dist", "README.md")],
    [
      path.resolve(".", "LICENSE-images.txt"),
      path.resolve(".", "dist", "LICENSE-images.txt"),
    ],
    [
      path.resolve(".", "LICENSE-source.txt"),
      path.resolve(".", "dist", "LICENSE-source.txt"),
    ],
  ];
  for (const [src, dest] of filesToCopy) {
    await fs.copy(src, dest);
  }
};

export const getGitVersion = async () => {
  const proc = await run("git", ["describe", "--tags"], {
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf-8",
  });
  return proc.stdout.trim().replace(/^v/, "");
};

export const moduleJson = async () => {
  await fs.ensureDir(path.resolve(".", "dist"));
  const gitVersion = await getGitVersion();
  console.log(`Version is: ${gitVersion}`);
  const module_json = await fs.readJson(path.resolve(".", "module.json"));
  // Set the version using git describe. This makes the tag the source-of-truth for the version
  module_json["version"] = gitVersion;
  module_json["download"] =
    `https://github.com/${OWNER_ID}/${REPOSITORY_ID}/releases/download/${gitVersion}/${MODULE_ID}.zip`;
  fs.writeJson(path.resolve(".", "dist", "module.json"), module_json);
};

export const build = async () => {
  await setup();
  await pack();
  await images();
  await files();
  await moduleJson();
};

export const clean = async () => {
  await fs.remove("dist");
};
