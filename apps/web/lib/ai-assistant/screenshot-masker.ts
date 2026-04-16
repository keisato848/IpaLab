export async function captureWithMasking(): Promise<Blob> {
    const selectors = [
        '[data-user-identity]',
        '[data-testid="user-name"]',
        '.user-display-name',
    ];

    const originals: Array<{ el: HTMLElement; text: string }> = [];

    // 1. マスキング
    for (const sel of selectors) {
        document.querySelectorAll<HTMLElement>(sel).forEach(el => {
            originals.push({ el, text: el.textContent ?? '' });
            el.textContent = '****';
        });
    }

    try {
        // 2. キャプチャ（ウィジェット自体を除外）
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(document.body, {
            ignoreElements: (el) => el.closest('[data-ai-assistant]') !== null,
        });
        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('Canvas to Blob failed')),
                'image/png'
            );
        });
    } finally {
        // 3. 復元（必ず実行）
        for (const { el, text } of originals) {
            el.textContent = text;
        }
    }
}
