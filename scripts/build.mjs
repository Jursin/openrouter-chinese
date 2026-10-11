import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dictionaryHash, validateDictionary, validateReleaseConfig } from "./dictionary-utils.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(path.join(rootDir, name), "utf8"));
const [pkg, config, dictionary, template] = await Promise.all([
  readJson("package.json"), readJson("release.config.json"), readJson("locales/zh-CN.json"),
  readFile(path.join(rootDir, "src/openrouter-chinese.user.js"), "utf8"),
]);
validateReleaseConfig(config);
const entries = validateDictionary(dictionary);
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error("在线脚本版本必须为数字版本号");
if (dictionaryHash(dictionary) !== config.dictionarySha256) {
  throw new Error("词典发生变化：请先运行 npm run dictionary:bump 同步词典 revision 和本地版版本");
}
// 本地版版本号用词典日期（revision 形如 2026101101 → 26.10.11），便于分辨词库截至时间。
const revisionText = String(config.dictionaryRevision);
const legacyVersion = revisionText.slice(2, 4) + "." + revisionText.slice(4, 6) + "." + revisionText.slice(6, 8);
const envelope = {
  schemaVersion: 1, revision: config.dictionaryRevision, entries, dictionary,
};
const onlineJson = JSON.stringify(envelope, null, 2) + "\n";
if (Buffer.byteLength(onlineJson, "utf8") > 800_000) throw new Error("在线词典超过大小上限");

function replaceOnce(source, token, replacement) {
  if (source.split(token).length !== 2) throw new Error("模板标记必须唯一：" + token);
  return source.replace(token, () => replacement);
}

function compile({ online, version, namespace, output }) {
  let source = template;
  for (const [token, value] of [
    ['/* build:version */ "1.0.0"', JSON.stringify(version)],
    ['/* build:online */ true', String(online)],
    ['/* build:revision */ 2026101001', String(config.dictionaryRevision)],
    // 本地版注入完整词典快照；在线版保持空对象，词典来自外置 JSON。
    ['/* build:dictionary */ {}', online ? "{}" : JSON.stringify(dictionary, null, 2)],
  ]) source = replaceOnce(source, token, value);
  source = source.replace(/^\/\/ @version\s+.*$/m, "// @version      " + version);
  source = source.replace(/^\/\/ @namespace\s+.*$/m, "// @namespace    " + namespace);
  const updateUrl = "https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/" + output;
  source = source.replace(/^\/\/ @downloadURL\s+.*$/m, "// @downloadURL  " + updateUrl)
    .replace(/^\/\/ @updateURL\s+.*$/m, "// @updateURL    " + updateUrl)
    .replace("/v1.0.0/locales/zh-CN.online.json", "/v" + pkg.version + "/locales/zh-CN.online.json");
  if (!online) {
    // 兼容 CRLF 检出：`.` 不匹配 `\r`，因此显式匹配行尾
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    source = source.replace(/^\/\/ @(grant|connect)[ \t]+[^\r\n]*\r?\n/gm, "");
    source = source.replace("// @run-at", "// @grant        none" + eol + "// @run-at");
    source = source.replace(/^\/\/ @description\s+.*$/m,
      "// @description  中文化 OpenRouter 界面，本地版内置完整词典，不联网获取词典");
    const start = source.indexOf("  // build:online:start");
    const end = source.indexOf("  // build:online:end", start);
    if (start < 0 || end < 0) throw new Error("缺少在线代码边界");
    source = source.slice(0, start) + `  function loadCachedDictionary() {}
  function setupDictionaryUpdates() {}
  async function refreshDictionary() { return false; }
` + source.slice(end + "  // build:online:end".length);
  }
  return source;
}

const namespace = "https://github.com/isdoge/openrouter-chinese";
const variants = [
  { online: true, version: pkg.version, namespace, output: "dist/openrouter-chinese.user.js" },
  { online: true, version: pkg.version, namespace: namespace + "/remote-dictionary-preview", output: "dist/openrouter-chinese-remote.user.js" },
  { online: false, version: legacyVersion, namespace, output: "legacy/openrouter-chinese.user.js" },
];
for (const variant of variants) {
  const output = path.join(rootDir, variant.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, compile(variant), "utf8");
  console.log("已生成 " + variant.output + "（" + variant.version + "，" + entries + " 条）");
}
await writeFile(path.join(rootDir, "locales/zh-CN.online.json"), onlineJson, "utf8");
console.log("已生成版本化在线词典（revision " + config.dictionaryRevision + "）");
