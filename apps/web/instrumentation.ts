/**
 * Next.js Instrumentation Hook
 *
 * Node.js ランタイム専用の処理は instrumentation.node.ts に分離している。
 * これにより Edge ランタイム向け webpack コンパイル時に
 * @grpc/grpc-js 等の Node.js 固有モジュールが解析されるのを防ぐ。
 *
 * 参照: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { registerNodeInstrumentation } = await import('./instrumentation.node');
        await registerNodeInstrumentation();
    }
}
