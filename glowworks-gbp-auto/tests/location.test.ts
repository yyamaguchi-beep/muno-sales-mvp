import assert from "node:assert/strict";
import { test } from "node:test";
import { findUniqueMatch, normalizeAddress } from "../src/gbp/match.js";

const EXPECTED_NAME = "GLOW WORKS 生野";
const EXPECTED_ADDR = "大阪府大阪市生野区小路東5丁目12-19";

test("住所の表記ゆれを同一視する", () => {
  const a = normalizeAddress(EXPECTED_ADDR);
  assert.equal(normalizeAddress("〒544-0001 大阪府大阪市生野区小路東５丁目１２−１９"), a);
  assert.equal(normalizeAddress("大阪市生野区小路東5-12-19"), a);
  assert.equal(normalizeAddress("大阪府大阪市生野区小路東五丁目12番19号"), a);
  assert.notEqual(normalizeAddress("大阪府大阪市生野区小路東5丁目12-20"), a);
});

const loc = (name: string, title: string, lines: string[], locality = "大阪市生野区") => ({
  name: `locations/${name}`,
  title,
  storefrontAddress: { regionCode: "JP", administrativeArea: "大阪府", locality, addressLines: lines },
});

test("店舗名と住所が両方一致する1件だけを選ぶ", () => {
  const r = findUniqueMatch(
    [loc("1", "GLOW WORKS 東大阪", ["高井田1-1-1"], "東大阪市"), loc("2", "GLOW WORKS　生野", ["小路東５丁目１２−１９"]), loc("3", "別の店", ["小路東5丁目12-19"])],
    EXPECTED_NAME,
    EXPECTED_ADDR,
  );
  assert.equal(r.match?.location.name, "locations/2");
});

test("名前だけ一致・住所だけ一致では選ばない", () => {
  assert.equal(findUniqueMatch([loc("1", "GLOW WORKS 生野", ["小路東1-1-1"])], EXPECTED_NAME, EXPECTED_ADDR).match, null);
  assert.equal(findUniqueMatch([loc("1", "GLOW WORKS", ["小路東5-12-19"])], EXPECTED_NAME, EXPECTED_ADDR).match, null);
});

test("一致が複数なら選ばない", () => {
  const r = findUniqueMatch([loc("1", "GLOW WORKS 生野", ["小路東5-12-19"]), loc("2", "GLOW WORKS 生野", ["小路東5-12-19"])], EXPECTED_NAME, EXPECTED_ADDR);
  assert.equal(r.match, null);
});
