import { useEffect, useState } from 'react';

/**
 * The LeetCode solved count from this site's own `/api/leetcode`, which asks
 * LeetCode server-side (a browser call would fail on CORS).
 *
 * The request is aborted on unmount, caught on failure, and skipped entirely when
 * the dashboard has the block switched off — hiding it should stop the request,
 * not only its result. `status` lets callers show a dash rather than an empty
 * space when the count is unavailable.
 */
export function useLeetcode(enabled = true) {
    const [state, setState] = useState({ status: enabled ? 'loading' : 'off', solved: null });

    useEffect(() => {
        if (!enabled) return undefined;
        const controller = new AbortController();

        fetch('/api/leetcode', { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : Promise.reject(response)))
            .then((stats) => setState({ status: 'ready', solved: stats.totalSolved }))
            .catch((error) => {
                if (error?.name === 'AbortError') return;
                setState({ status: 'failed', solved: null });
            });

        return () => controller.abort();
    }, [enabled]);

    return state;
}
