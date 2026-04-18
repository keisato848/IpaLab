'use client';

import dynamic from 'next/dynamic';

const AiAssistantWidget = dynamic(
    () => import('@/components/features/ai-assistant/AiAssistantWidget'),
    { ssr: false }
);

export default function AiAssistantLoader() {
    return <AiAssistantWidget />;
}
