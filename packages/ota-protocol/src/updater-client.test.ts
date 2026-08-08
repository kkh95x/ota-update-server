import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFullOtaDownloadKey,
  buildIncrementalDownloadKey,
  parseChannelMetadata,
  resolveDownloadKeys,
  shouldOfferUpdate,
} from "./updater-client.js";

describe("updater-client", () => {
  it("parseChannelMetadata matches generate-metadata layout", () => {
    const parsed = parseChannelMetadata("2026072900 1785291770 panther stable\n");
    assert.deepEqual(parsed, {
      targetIncremental: "2026072900",
      postTimestamp: "1785291770",
      codename: "panther",
      channelKey: "stable",
    });
  });

  it("parseChannelMetadata supports group channels", () => {
    const parsed = parseChannelMetadata("2026072900 1785291770 komodo grp-alpha-test\n");
    assert.equal(parsed.channelKey, "grp-alpha-test");
  });

  it("shouldOfferUpdate when postTimestamp is newer", () => {
    assert.equal(shouldOfferUpdate("1785291770", "1785291700"), true);
    assert.equal(shouldOfferUpdate("1785291700", "1785291770"), false);
    assert.equal(shouldOfferUpdate("1785291770", "1785291770"), false);
  });

  it("builds GrapheneOS download paths", () => {
    assert.equal(
      buildIncrementalDownloadKey("panther", "2026072800", "2026072900"),
      "panther-incremental-2026072800-2026072900.zip",
    );
    assert.equal(buildFullOtaDownloadKey("panther", "2026072900"), "panther-ota_update-2026072900.zip");
    assert.equal(
      buildFullOtaDownloadKey("panther", "2026072900", true),
      "panther-streaming-ota_update-2026072900.zip",
    );
  });

  it("resolveDownloadKeys for incremental then full fallback", () => {
    const metadata = parseChannelMetadata("2026072900 1785291770 panther stable");
    const keys = resolveDownloadKeys({
      codename: "panther",
      deviceIncremental: "2026072800",
      metadata,
    });
    assert.equal(keys.incrementalKey, "panther-incremental-2026072800-2026072900.zip");
    assert.equal(keys.fullKey, "panther-ota_update-2026072900.zip");
  });
});
