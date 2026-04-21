import { describe, it, expect } from 'vitest';
import { parseSseChunk } from '@/components/features/scoring/useScoringStream';

describe('parseSseChunk', () => {
  it('完全な単一イベントをパースする', () => {
    const buf = 'event: perspective\ndata: {"id":"k","score":80}\n\n';
    const { events, rest } = parseSseChunk(buf);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('perspective');
    expect(events[0].data).toEqual({ id: 'k', score: 80 });
    expect(rest).toBe('');
  });

  it('複数イベントを1チャンクから取り出す', () => {
    const buf =
      'event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y":2}\n\n';
    const { events } = parseSseChunk(buf);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('a');
    expect(events[1].event).toBe('b');
  });

  it('未完成のイベントは rest に残す', () => {
    const buf = 'event: perspective\ndata: {"id":"k","sco';
    const { events, rest } = parseSseChunk(buf);
    expect(events).toHaveLength(0);
    expect(rest).toBe(buf);
  });

  it('event 行がない場合は message として扱う', () => {
    const buf = 'data: "hello"\n\n';
    const { events } = parseSseChunk(buf);
    expect(events[0].event).toBe('message');
    expect(events[0].data).toBe('hello');
  });

  it('JSONでない data はそのまま文字列で返す', () => {
    const buf = 'event: x\ndata: not-json\n\n';
    const { events } = parseSseChunk(buf);
    expect(events[0].data).toBe('not-json');
  });
});
