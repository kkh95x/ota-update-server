const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;

export type SessionKeepaliveHandle = {
  stop: () => void;
  ping: () => Promise<boolean>;
};

/** Ping dashboard auth during long direct-to-MinIO uploads so idle session does not expire. */
export function startUploadSessionKeepalive(): SessionKeepaliveHandle {
  let timer: ReturnType<typeof setInterval> | undefined;

  const ping = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/keepalive", { method: "GET", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  };

  void ping();
  timer = setInterval(() => {
    void ping();
  }, KEEPALIVE_INTERVAL_MS);

  return {
    ping,
    stop: () => {
      if (timer) clearInterval(timer);
    },
  };
}
