import { describe, it, expect } from 'vitest';
import { formatSseEvent, eventStreamToReadable, collectEvents } from '@/lib/scoring/sse';
import { parsePerspectiveResponse } from '@/lib/scoring/llmClient';

describe('formatSseEvent', () => {
  it('event/data 行を SSE 形式で出力する', () => {
    expect(formatSseEvent({ event: 'perspective', data: { id: 'k', score: 80 } })).toBe(
      'event: perspective\ndata: {"id":"k","score":80}\n\n',
    );
  });
});

describe('eventStreamToReadable', () => {
  it('ReadableStream としてイベントを直列化する', async () => {
    async function* gen() {
      yield { event: 'perspective', data: { id: 'a' } };
      yield { event: 'complete', data: { ok: true } };
    }
    const stream = eventStreamToReadable(gen());
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let done = false;
    while (!done) {
      const r = await reader.read();
      done = r.done;
      if (r.value) out += decoder.decode(r.value);
    }
    expect(out).toContain('event: perspective');
    expect(out).toContain('event: complete');
    expect(out).toContain('"id":"a"');
  });

  it('ジェネレータ内エラーは error イベントとして送出される', async () => {
    async function* gen(): AsyncGenerator<{ event: string; data: unknown }> {
      yield { event: 'perspective', data: { id: 'a' } };
      throw new Error('boom');
    }
    const stream = eventStreamToReadable(gen());
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let done = false;
    while (!done) {
      const r = await reader.read();
      done = r.done;
      if (r.value) out += decoder.decode(r.value);
    }
    expect(out).toContain('event: error');
    expect(out).toContain('boom');
  });
});

describe('collectEvents', () => {
  it('AsyncIterable を配列化する', async () => {
    async function* gen() {
      yield { event: 'a', data: 1 };
      yield { event: 'b', data: 2 };
    }
    const arr = await collectEvents(gen());
    expect(arr.map((e) => e.event)).toEqual(['a', 'b']);
  });
});

describe('parsePerspectiveResponse', () => {
  it('生 JSON をパース', () => {
    const r = parsePerspectiveResponse('{"score":80,"rationale":"ok"}');
    expect(r.score).toBe(80);
    expect(r.rationale).toBe('ok');
    expect(r.matched_keywords).toEqual([]);
  });

  it('```json ``` フェンス付きでもパースできる', () => {
    const r = parsePerspectiveResponse('```json\n{"score":75,"rationale":"x"}\n```');
    expect(r.score).toBe(75);
  });

  it('スコアは 0-100 にクランプされる', () => {
    expect(parsePerspectiveResponse('{"score":150,"rationale":""}').score).toBe(100);
    expect(parsePerspectiveResponse('{"score":-5,"rationale":""}').score).toBe(0);
  });

  it('JSON でない場合はエラー', () => {
    expect(() => parsePerspectiveResponse('not json')).toThrow(/not valid JSON/);
  });

  it('score 欠落時はエラー', () => {
    expect(() => parsePerspectiveResponse('{"rationale":"x"}')).toThrow(/missing numeric/);
  });
});
