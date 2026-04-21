/**
 * Server-Sent Events 形式のユーティリティ
 *
 * 設計書 15_AfternoonScoringAPI_v2.md §2.0 に準拠。
 * EventSource は使用せず、fetch + ReadableStream で受信する想定。
 */

export interface SseEvent {
  event: string;
  data: unknown;
}

export function formatSseEvent(evt: SseEvent): string {
  const dataLine = JSON.stringify(evt.data);
  return `event: ${evt.event}\ndata: ${dataLine}\n\n`;
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/** SSEイベントの非同期反復子から ReadableStream を構築 */
export function eventStreamToReadable(events: AsyncIterable<SseEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const evt of events) {
          controller.enqueue(encoder.encode(formatSseEvent(evt)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(formatSseEvent({ event: 'error', data: { message } })),
        );
      } finally {
        controller.close();
      }
    },
  });
}

/** AsyncIterable を配列に集めるテスト用ユーティリティ */
export async function collectEvents(events: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const out: SseEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}
