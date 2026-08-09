import { UploadSpeedTracker, type UploadThroughputSnapshot } from "./format-speed";

export type { UploadThroughputSnapshot };

/** PUT file to a presigned URL with upload progress and speed tracking. */
export function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (snapshot: UploadThroughputSnapshot) => void,
): Promise<void> {
  const speedTracker = new UploadSpeedTracker();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(speedTracker.tick(event.loaded, event.total));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(speedTracker.tick(file.size, file.size));
        resolve();
        return;
      }
      reject(new Error(`upload_failed_${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.onabort = () => reject(new Error("upload_aborted"));

    xhr.send(file);
  });
}
