/**
 * npm run find-location [-- --write]
 * アカウント一覧 → 店舗一覧 → 「GLOW WORKS 生野」を店舗名と住所の両方で照合し、
 * 一意に特定できた場合のみ GBP_ACCOUNT_ID / GBP_LOCATION_ID を表示 (--write で .env に保存)。
 */
import { loadConfig } from "../src/config.js";
import { accountIdOf, listAccounts } from "../src/gbp/account.js";
import { listLocations, locationIdOf } from "../src/gbp/location.js";
import { findUniqueMatch, type MatchResult } from "../src/gbp/match.js";
import { parseArgs } from "../src/utils/args.js";
import { upsertEnvValues } from "../src/utils/envFile.js";
import { errorMessage } from "../src/utils/errors.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  const args = parseArgs();
  const cfg = loadConfig();
  logger.setFileLogging(false);
  console.log(`照合条件: 店舗名「${cfg.GBP_EXPECTED_NAME}」 + 住所「${cfg.GBP_EXPECTED_ADDRESS}」\n`);

  const accounts = await listAccounts(cfg);
  console.log(`アカウント: ${accounts.length}件`);
  const all: (MatchResult & { accountId: string })[] = [];
  for (const acc of accounts) {
    const accountId = accountIdOf(acc.name);
    const locations = await listLocations(cfg, accountId);
    console.log(`  - ${acc.accountName ?? "(名称なし)"} [${accountId}] type=${acc.type ?? "?"}: 店舗 ${locations.length}件`);
    const { candidates } = findUniqueMatch(locations, cfg.GBP_EXPECTED_NAME, cfg.GBP_EXPECTED_ADDRESS);
    for (const l of locations) {
      const c = candidates.find((x) => x.location.name === l.name);
      console.log(`      ${c?.nameMatch && c.addressMatch ? "✅" : c ? "⚠️" : "  "} ${l.title} | ${c?.address ?? ""} | ${locationIdOf(l.name)}`);
    }
    all.push(...candidates.map((c) => ({ ...c, accountId })));
  }

  const both = all.filter((c) => c.nameMatch && c.addressMatch);
  // 同じ店舗が複数アカウント (個人/組織) から見える場合は同一 location ID なら1件とみなす
  const unique = [...new Map(both.map((c) => [locationIdOf(c.location.name), c])).values()];
  if (unique.length !== 1) {
    console.error(`\n❌ 店舗を一意に特定できませんでした (一致 ${unique.length}件)。誤投稿防止のため設定しません。`);
    for (const c of all) console.error(`   候補: ${c.location.title} / ${c.address} / name=${c.nameMatch} address=${c.addressMatch}`);
    console.error("   店舗名・住所の表記が異なる場合は .env の GBP_EXPECTED_NAME / GBP_EXPECTED_ADDRESS を Google 上の表記に合わせてください。");
    process.exit(1);
  }
  const m = unique[0]!;
  const locationId = locationIdOf(m.location.name);
  console.log(`\n✅ 特定しました: ${m.location.title} / ${m.address}`);
  console.log(`GBP_ACCOUNT_ID=${m.accountId}\nGBP_LOCATION_ID=${locationId}`);
  if (m.location.metadata?.mapsUri) console.log(`Maps: ${m.location.metadata.mapsUri}`);
  if (args.write) {
    upsertEnvValues({ GBP_ACCOUNT_ID: m.accountId, GBP_LOCATION_ID: locationId });
    console.log("\n.env に保存しました。");
  } else {
    console.log("\n.env に保存するには: npm run find-location -- --write");
  }
}

main().catch((err) => {
  console.error(`\n❌ ${errorMessage(err)}`);
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(String(err))) {
    console.error("   → Business Profile API の利用申請が未承認の場合、クォータが 0 のため 429 になります。README「Business Profile API 利用申請」を参照。");
  }
  process.exit(1);
});
