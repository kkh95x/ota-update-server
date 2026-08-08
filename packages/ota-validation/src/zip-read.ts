import { getObjectRange } from "@custom-os-ota/object-storage";

const EOCD_SIG = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CEN_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

const TAIL_READ_BYTES = 128 * 1024;
const MAX_CENTRAL_DIRECTORY_BYTES = 512 * 1024;
const MAX_ZIP_ENTRIES = 512;
const MAX_ENTRY_NAME_LENGTH = 512;
const MAX_EXTRACTED_BYTES = 64 * 1024;

export type ZipEntryLocation = {
  name: string;
  compressionMethod: number;
  compressedSize: bigint;
  uncompressedSize: bigint;
  localHeaderOffset: bigint;
};

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readUInt64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function findSignature(buf: Buffer, signature: number): number {
  for (let i = buf.length - 4; i >= 0; i--) {
    if (buf.readUInt32LE(i) === signature) return i;
  }
  return -1;
}

function parseZip64Extra(buf: Buffer, offset: number, size: number): {
  uncompressedSize?: bigint;
  compressedSize?: bigint;
  localHeaderOffset?: bigint;
} {
  const end = offset + size;
  let pos = offset;
  const out: {
    uncompressedSize?: bigint;
    compressedSize?: bigint;
    localHeaderOffset?: bigint;
  } = {};
  while (pos + 4 <= end) {
    const headerId = readUInt16LE(buf, pos);
    const dataSize = readUInt16LE(buf, pos + 2);
    pos += 4;
    if (pos + dataSize > end) break;
    if (headerId === 0x0001 && dataSize >= 8) {
      let field = pos;
      if (dataSize >= 8) {
        out.uncompressedSize = readUInt64LE(buf, field);
        field += 8;
      }
      if (dataSize >= 16) {
        out.compressedSize = readUInt64LE(buf, field);
        field += 8;
      }
      if (dataSize >= 24) {
        out.localHeaderOffset = readUInt64LE(buf, field);
      }
    }
    pos += dataSize;
  }
  return out;
}

type CentralDirectoryInfo = {
  entries: ZipEntryLocation[];
  entryCount: number;
};

function parseCentralDirectory(buf: Buffer, fileSize: bigint): CentralDirectoryInfo {
  const entries: ZipEntryLocation[] = [];
  let offset = 0;
  while (offset + 46 <= buf.length) {
    if (readUInt32LE(buf, offset) !== CEN_SIG) break;
    const compressionMethod = readUInt16LE(buf, offset + 10);
    let compressedSize = BigInt(readUInt32LE(buf, offset + 20));
    let uncompressedSize = BigInt(readUInt32LE(buf, offset + 24));
    const nameLength = readUInt16LE(buf, offset + 28);
    const extraLength = readUInt16LE(buf, offset + 30);
    const commentLength = readUInt16LE(buf, offset + 32);
    let localHeaderOffset = BigInt(readUInt32LE(buf, offset + 42));
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buf.length) break;
    const name = buf.subarray(nameStart, nameEnd).toString("utf8");
    if (nameLength > MAX_ENTRY_NAME_LENGTH) {
      throw new Error("zip_entry_name_too_long");
    }
    const extraStart = nameEnd;
    const extraEnd = extraStart + extraLength;
    if (extraEnd + commentLength > buf.length) break;
    const zip64 = parseZip64Extra(buf, extraStart, extraLength);
    if (uncompressedSize === 0xffffffffn && zip64.uncompressedSize != null) {
      uncompressedSize = zip64.uncompressedSize;
    }
    if (compressedSize === 0xffffffffn && zip64.compressedSize != null) {
      compressedSize = zip64.compressedSize;
    }
    if (localHeaderOffset === 0xffffffffn && zip64.localHeaderOffset != null) {
      localHeaderOffset = zip64.localHeaderOffset;
    }
    if (name.includes("..") || name.startsWith("/") || name.includes("\\")) {
      throw new Error("zip_path_traversal");
    }
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = extraEnd + commentLength;
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new Error("zip_too_many_entries");
    }
  }
  if (fileSize > 0n && entries.length === 0) {
    throw new Error("zip_central_directory_empty");
  }
  return { entries, entryCount: entries.length };
}

async function locateCentralDirectory(
  bucket: string,
  objectKey: string,
  fileSize: bigint,
): Promise<{ cdOffset: bigint; cdSize: bigint; entryCount: number }> {
  const tailSize = Number(fileSize < BigInt(TAIL_READ_BYTES) ? fileSize : BigInt(TAIL_READ_BYTES));
  const tailStart = Number(fileSize) - tailSize;
  const tail = await getObjectRange(bucket, objectKey, tailStart, tailStart + tailSize - 1);

  const zip64LocatorOffset = findSignature(tail, ZIP64_EOCD_LOCATOR_SIG);
  if (zip64LocatorOffset >= 0) {
    const zip64EocdOffset = readUInt64LE(tail, zip64LocatorOffset + 8);
    const zip64Eocd = await getObjectRange(
      bucket,
      objectKey,
      Number(zip64EocdOffset),
      Number(zip64EocdOffset) + 8191,
    );
    const zip64EocdPos = findSignature(zip64Eocd, ZIP64_EOCD_SIG);
    if (zip64EocdPos < 0) throw new Error("zip64_eocd_not_found");
    const entryCount = Number(readUInt64LE(zip64Eocd, zip64EocdPos + 24));
    const cdSize = readUInt64LE(zip64Eocd, zip64EocdPos + 40);
    const cdOffset = readUInt64LE(zip64Eocd, zip64EocdPos + 48);
    return { cdOffset, cdSize, entryCount };
  }

  const eocdOffset = findSignature(tail, EOCD_SIG);
  if (eocdOffset < 0) throw new Error("zip_eocd_not_found");
  const entryCount = readUInt16LE(tail, eocdOffset + 10);
  const cdSize = BigInt(readUInt32LE(tail, eocdOffset + 12));
  const cdOffset = BigInt(readUInt32LE(tail, eocdOffset + 16));
  return { cdOffset, cdSize, entryCount };
}

export async function listZipEntries(
  bucket: string,
  objectKey: string,
  fileSize: bigint,
): Promise<ZipEntryLocation[]> {
  const { cdOffset, cdSize, entryCount } = await locateCentralDirectory(bucket, objectKey, fileSize);
  if (entryCount > MAX_ZIP_ENTRIES) throw new Error("zip_too_many_entries");
  const cdBytes = Number(cdSize);
  if (cdBytes > MAX_CENTRAL_DIRECTORY_BYTES) throw new Error("zip_central_directory_too_large");
  const cdBuf = await getObjectRange(
    bucket,
    objectKey,
    Number(cdOffset),
    Number(cdOffset) + cdBytes - 1,
  );
  return parseCentralDirectory(cdBuf, fileSize).entries;
}

export async function readZipEntry(
  bucket: string,
  objectKey: string,
  entry: ZipEntryLocation,
): Promise<Buffer> {
  if (entry.uncompressedSize > BigInt(MAX_EXTRACTED_BYTES)) {
    throw new Error("zip_entry_too_large");
  }
  if (entry.compressionMethod !== 0) {
    throw new Error("zip_unsupported_compression");
  }
  const header = await getObjectRange(
    bucket,
    objectKey,
    Number(entry.localHeaderOffset),
    Number(entry.localHeaderOffset) + 4095,
  );
  if (readUInt32LE(header, 0) !== LFH_SIG) throw new Error("zip_local_header_invalid");
  const nameLength = readUInt16LE(header, 26);
  const extraLength = readUInt16LE(header, 28);
  const dataOffset = Number(entry.localHeaderOffset) + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + Number(entry.compressedSize) - 1;
  return getObjectRange(bucket, objectKey, dataOffset, dataEnd);
}

export async function readZipEntryByName(
  bucket: string,
  objectKey: string,
  fileSize: bigint,
  entryName: string,
): Promise<Buffer | null> {
  const entries = await listZipEntries(bucket, objectKey, fileSize);
  const entry = entries.find((e) => e.name === entryName);
  if (!entry) return null;
  return readZipEntry(bucket, objectKey, entry);
}

export async function validateZipPrefix(bucket: string, objectKey: string): Promise<boolean> {
  const prefix = await getObjectRange(bucket, objectKey, 0, 3);
  return prefix.length >= 4 && prefix.readUInt32LE(0) === LFH_SIG;
}
