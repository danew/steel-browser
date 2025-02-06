import { useEffect, useState } from "react";

/**
 * Accepts a base64 encoded JPEG image buffer and returns an object URL
 */
export function useScreenshot(base64?: string): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!base64) {
      setBlobUrl(undefined);
      return;
    }
    const byteCharacters = atob(base64);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [base64]);

  return blobUrl;
}
