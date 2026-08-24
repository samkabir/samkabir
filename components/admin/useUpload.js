import { useCallback, useRef, useState } from 'react';

/**
 * Uploading one file, with progress.
 *
 * `XMLHttpRequest` rather than `fetch`, for one reason: `fetch` still cannot
 * report upload progress. A progress bar matters more here than modern syntax —
 * a CV upload on a slow connection with no feedback is indistinguishable from a
 * frozen page, and the user's next move is to click again.
 *
 * The file is sent as the **raw body** with its metadata in the query string, to
 * match `pages/api/admin/media/upload.js`. No `FormData`, so no multipart parser
 * is needed on the server.
 */
export function useUpload() {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);

  /** Aborts an upload in flight. Safe to call when there is none. */
  const cancel = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setProgress(null);
  }, []);

  const upload = useCallback((file, { alt } = {}) => {
    setError(null);
    setProgress(0);

    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({ filename: file.name });
      if (alt) params.set('alt', alt);

      const request = new XMLHttpRequest();
      requestRef.current = request;

      request.open('POST', `/api/admin/media/upload?${params}`);
      // The declared type is cross-checked against the file's actual bytes
      // server-side, so a browser guessing wrong is caught rather than trusted.
      request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      const fail = (message) => {
        setError(message);
        setProgress(null);
        requestRef.current = null;
        reject(new Error(message));
      };

      request.addEventListener('load', () => {
        requestRef.current = null;
        setProgress(null);

        let body = null;
        try {
          body = JSON.parse(request.responseText);
        } catch {
          // A non-JSON body means something upstream answered instead of the
          // route — a proxy error page, most likely. Saying so beats a JSON
          // parse error surfacing in the UI.
        }

        if (request.status >= 200 && request.status < 300 && body?.item) {
          resolve(body.item);
          return;
        }

        fail(
          body?.error?.message ??
            (request.status === 401
              ? 'Your session has expired. Sign in again.'
              : `Upload failed (${request.status}).`)
        );
      });

      request.addEventListener('error', () =>
        fail('The upload could not reach the server. Check your connection and try again.')
      );

      request.addEventListener('abort', () => {
        requestRef.current = null;
        setProgress(null);
        reject(new Error('Upload cancelled.'));
      });

      request.send(file);
    });
  }, []);

  return { upload, cancel, progress, error, setError, isUploading: progress !== null };
}
