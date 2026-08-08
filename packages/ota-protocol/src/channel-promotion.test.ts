import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatChannelMetadata,
  isValidOtaChannelKey,
  parseChannelMetadata,
  publishedMetadataKey,
  sortOtaChannelKeys,
} from "./index.js";

describe("channel promotion metadata", () => {
  const base = {
    incrementalBuild: "2026080100",
    postTimestamp: "1785291770",
    codename: "komodo",
  };

  it("formatChannelMetadata differs only by channel field", () => {
    const testing = formatChannelMetadata({ ...base, channelKey: "testing" });
    const beta = formatChannelMetadata({ ...base, channelKey: "beta" });
    const alpha = formatChannelMetadata({ ...base, channelKey: "alpha" });

    assert.equal(testing, "2026080100 1785291770 komodo testing\n");
    assert.equal(beta, "2026080100 1785291770 komodo beta\n");
    assert.equal(alpha, "2026080100 1785291770 komodo alpha\n");

    const parsedTesting = parseChannelMetadata(testing);
    const parsedBeta = parseChannelMetadata(beta);
    assert.equal(parsedTesting.targetIncremental, parsedBeta.targetIncremental);
    assert.equal(parsedTesting.postTimestamp, parsedBeta.postTimestamp);
    assert.equal(parsedTesting.codename, parsedBeta.codename);
    assert.notEqual(parsedTesting.channelKey, parsedBeta.channelKey);
  });

  it("publishedMetadataKey per channel", () => {
    assert.equal(publishedMetadataKey("komodo", "testing"), "komodo-testing");
    assert.equal(publishedMetadataKey("komodo", "beta"), "komodo-beta");
  });

  it("isValidOtaChannelKey accepts standard and grp channels", () => {
    assert.equal(isValidOtaChannelKey("testing"), true);
    assert.equal(isValidOtaChannelKey("stable-security-preview"), true);
    assert.equal(isValidOtaChannelKey("grp-lab-damascus"), true);
    assert.equal(isValidOtaChannelKey("invalid channel"), false);
  });

  it("sortOtaChannelKeys dedupes and orders by rollout path", () => {
    assert.deepEqual(sortOtaChannelKeys(["stable", "testing", "beta", "testing"]), [
      "testing",
      "beta",
      "stable",
    ]);
  });
});
