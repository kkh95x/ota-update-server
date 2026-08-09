import { UploadSpeedTracker } from "./format-speed";

export type MultipartPartSpec = {
  partNumber: number;
  uploadUrl: string;
};

export type MultipartUploadProgress = {
  loaded: number;
  total: number;
  percent: number;
  speedBps: number;
  avgSpeedBps: number;
  etaSeconds: number | null;
  elapsedSeconds: number;
  completedParts: number;
  totalParts: number;
  activeParts: number;
  failedParts: number;
};

export type CompletedPart = {
  partNumber: number;
  etag: string;
};

function putPartWithProgress(
  url: string,
  blob: Blob,
  onPartProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onPartProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("upload_missing_etag"));
          return;
        }
        resolve(etag);
        return;
      }
      reject(new Error(`upload_failed_${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.onabort = () => reject(new Error("upload_aborted"));

    xhr.send(blob);
  });
}

/**
 * Upload a file via presigned S3 multipart URLs with bounded parallelism.
 */
export async function uploadMultipartParallel(
  file: File,
  parts: MultipartPartSpec[],
  partSize: number,
  concurrency: number,
  onProgress: (progress: MultipartUploadProgress) => void,
): Promise<CompletedPart[]> {
  const sorted = parts.slice().sort((a, b) => a.partNumber - b.partNumber);
  const totalParts = sorted.length;
  const totalBytes = file.size;
  const speedTracker = new UploadSpeedTracker();

  const partLoaded = new Map<number, number>();
  const partSizes = new Map<number, number>();
  for (const part of sorted) {
    const start = (part.partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    partSizes.set(part.partNumber, Math.max(0, end - start));
    partLoaded.set(part.partNumber, 0);
  }

  let completedParts = 0;
  let failedParts = 0;
  let activeParts = 0;

  const emitProgress = () => {
    let loaded = 0;
    for (const [partNumber, bytes] of partLoaded) {
      loaded += Math.min(bytes, partSizes.get(partNumber) ?? 0);
    }
    const throughput = speedTracker.tick(loaded, totalBytes);
    onProgress({
      ...throughput,
      completedParts,
      totalParts,
      activeParts,
      failedParts,
    });
  };

  emitProgress();

  const results: CompletedPart[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < sorted.length) {
      const index = nextIndex;
      nextIndex += 1;
      const part = sorted[index];
      if (!part) return;

      const start = (part.partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const blob = file.slice(start, end);

      activeParts += 1;
      emitProgress();

      try {
        const etag = await putPartWithProgress(part.uploadUrl, blob, (loaded) => {
          partLoaded.set(part.partNumber, loaded);
          emitProgress();
        });
        partLoaded.set(part.partNumber, partSizes.get(part.partNumber) ?? blob.size);
        completedParts += 1;
        results.push({ partNumber: part.partNumber, etag });
      } catch (err) {
        failedParts += 1;
        throw err;
      } finally {
        activeParts -= 1;
        emitProgress();
      }
    }
  }

  const workers = Math.min(Math.max(1, concurrency), sorted.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return results.sort((a, b) => a.partNumber - b.partNumber);
}
