/** PUT file to a presigned URL with upload progress (fetch has no upload progress). */
export function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
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
