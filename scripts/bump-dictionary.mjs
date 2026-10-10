import { readFile, writeFile } from "node:fs/promises";
import { dictionaryHash, validateDictionary, validateReleaseConfig } from "./dictionary-utils.mjs";

const configUrl = new URL("../release.config.json", import.meta.url);
const dictionary = JSON.parse(await readFile(new URL("../locales/zh-CN.json", import.meta.url), "utf8"));
const config = JSON.parse(await readFile(configUrl, "utf8"));
validateDictionary(dictionary);
validateReleaseConfig(config);
const fingerprint = dictionaryHash(dictionary);
if (fingerprint === config.dictionarySha256) {
  console.log("词典没有变化，版本保持不变。");
} else {
  if (!Number.isSafeInteger(config.dictionaryRevision + 1)) {
    throw new Error("版本号超出安全整数范围");
  }
  config.dictionaryRevision += 1;
  config.dictionarySha256 = fingerprint;
  await writeFile(configUrl, JSON.stringify(config, null, 2) + "\n", "utf8");
  const revisionText = String(config.dictionaryRevision);
  console.log("已递增词典 revision：" + config.dictionaryRevision
    + "（本地版词典日期版本 " + revisionText.slice(2, 4) + "." + revisionText.slice(4, 6) + "." + revisionText.slice(6, 8) + "）");
  console.log("下一步：npm run build && npm test，并提交词典、配置与全部生成产物。");
}
