import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatChannelMetadata,
  publicArtifactUrl,
  publishedFullOtaKey,
  publishedIncrementalKey,
  publishedMetadataKey,
} from "./index.js";

describe("ota-protocol", () => {
  it("formatChannelMetadata matches GrapheneOS generate-metadata layout", () => {
    const line = formatChannelMetadata({
      incrementalBuild: "2026072900",
      postTimestamp: "1785291770",
      codename: "panther",
      channelKey: "stable",
    });
    assert.equal(line, "2026072900 1785291770 panther stable\n");
  });

  it("builds published object keys", () => {
    assert.equal(publishedFullOtaKey("panther", "2026080100"), "panther-ota_update-2026080100.zip");
    assert.equal(
      publishedIncrementalKey("panther", "2026072900", "2026080100"),
      "panther-incremental-2026072900-2026080100.zip",
    );
    assert.equal(publishedMetadataKey("panther", "beta"), "panther-beta");
  });

  it("publicArtifactUrl joins base and key", () => {
    assert.equal(
      publicArtifactUrl("https://release.mod-syria.org/", "panther-stable"),
      "https://release.mod-syria.org/panther-stable",
    );
  });
});
