/**
 * コンテンツ API クライアント（詳細設計§6）
 * /api/mobile/v1/bootstrap, /content/manifest, /content/exams/:id
 */
import { apiFetch } from './api-client';
import { Mobile } from '@ipa-lab/shared';

export async function fetchBootstrap(): Promise<Mobile.BootstrapResponse | null> {
    const res = await apiFetch<Mobile.BootstrapResponse>('/api/mobile/v1/bootstrap');
    return res.ok ? res.data : null;
}

export async function fetchContentManifest(
    etag?: string,
): Promise<{ data: Mobile.ContentManifestResponse; etag: string } | { notModified: true } | null> {
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;

    const res = await apiFetch<Mobile.ContentManifestResponse>(
        '/api/mobile/v1/content/manifest',
        { headers },
    );

    if (res.status === 304) return { notModified: true };
    if (!res.ok || !res.data) return null;
    return { data: res.data, etag: '' };
}

export async function fetchExamContent(
    examId: string,
): Promise<Mobile.ExamContentResponse | null> {
    const res = await apiFetch<Mobile.ExamContentResponse>(
        `/api/mobile/v1/content/exams/${examId}`,
    );
    return res.ok ? res.data : null;
}
