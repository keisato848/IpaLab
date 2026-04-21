/**
 * 採点API SSE ストリーム購読フック
 *
 * - fetch + ReadableStream で `text/event-stream` を読み取り、
 *   `event: ...\ndata: ...\n\n` 形式をパースして state に反映
 * - design ref: docs/02_design/15_AfternoonScoringAPI_v2.md §2.0
 */

'use client';

import { useCallback, useRef, useState } from 'react';

export interface SseEventReceived {
  event: string;
  data: unknown;
}

export interface UseScoringStreamState {
  events: SseEventReceived[];
  status: 'idle' | 'streaming' | 'done' | 'error';
  errorMessage: string | null;
}

export interface UseScoringStreamApi extends UseScoringStreamState {
  start: (url: string, body: unknown) => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: UseScoringStreamState = {
  events: [],
  status: 'idle',
  errorMessage: null,
};

/** 1チャンクから SSE イベントを抽出。残りバッファを返す */
export function parseSseChunk(buf: string): { events: SseEventReceived[]; rest: string } {
  const events: SseEventReceived[] = [];
  let rest = buf;
  while (true) {
    const idx = rest.indexOf('\n\n');
    if (idx === -1) break;
    const chunk = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let evName = 'message';
    const dataLines: string[] = [];
    for (const raw of chunk.split('\n')) {
      const line = raw.trimEnd();
      if (line.startsWith('event:')) evName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) continue;
    const dataText = dataLines.join('\n');
    let data: unknown = dataText;
    try {
      data = JSON.parse(dataText);
    } catch {
      // データがJSONでない場合は文字列のまま
    }
    events.push({ event: evName, data });
  }
  return { events, rest };
}

export function useScoringStream(): UseScoringStreamApi {
  const [state, setState] = useState<UseScoringStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const start = useCallback(async (url: string, body: unknown) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ events: [], status: 'streaming', errorMessage: null });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      setState({
        events: [],
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!res.ok) {
      let errBody: unknown = null;
      try {
        errBody = await res.json();
      } catch {
        // ignore
      }
      const extracted =
        errBody && typeof errBody === 'object' && 'error' in errBody
          ? String((errBody as Record<string, unknown>).error)
          : '';
      const message = extracted || `HTTP ${res.status}`;
      setState({ events: [], status: 'error', errorMessage: message });
      return;
    }

    if (!res.body) {
      setState({ events: [], status: 'error', errorMessage: 'No response body' });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events: parsed, rest } = parseSseChunk(buffer);
        buffer = rest;
        if (parsed.length > 0) {
          setState((prev) => ({
            events: [...prev.events, ...parsed],
            status: 'streaming',
            errorMessage: null,
          }));
        }
      }
      setState((prev) => ({ ...prev, status: 'done' }));
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  return { ...state, start, reset };
}
