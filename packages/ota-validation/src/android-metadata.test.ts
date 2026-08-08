import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  metadataDeviceCodename,
  metadataSourceIncremental,
  metadataTargetIncremental,
  parseAndroidOtaMetadata,
} from "./android-metadata.js";

describe("android-metadata", () => {
  const sample = `
ota-type=AB
pre-build=google/panther/panther:15/BP1A.250305.020/123456:user/release-keys
pre-build-incremental=2026072800
post-build=google/panther/panther:15/BP1A.250305.020/123456:user/release-keys
post-build-incremental=2026072900
pre-device=google/panther/panther
post-timestamp=1785291770
`.trim();

  it("parses key=value metadata", () => {
    const meta = parseAndroidOtaMetadata(sample);
    assert.equal(meta["ota-type"], "AB");
    assert.equal(meta["post-build-incremental"], "2026072900");
  });

  it("extracts codename and incrementals", () => {
    const meta = parseAndroidOtaMetadata(sample);
    assert.equal(metadataDeviceCodename(meta), "panther");
    assert.equal(metadataTargetIncremental(meta), "2026072900");
    assert.equal(metadataSourceIncremental(meta), "2026072800");
  });
});
