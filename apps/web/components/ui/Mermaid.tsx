
'use client';

import React, { useEffect, useRef, useState } from 'react';

interface MermaidProps {
    chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const renderChart = async () => {
            if (!chart) return;
            setIsLoading(true);

            try {
                // Lazy load mermaid to prevent main thread blocking
                const mermaid = (await import('mermaid')).default;

                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose', // Needed to allow HTML in nodes if used
                });

                if (!ref.current) return;

                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                // Use renderAsync or render
                const { svg } = await mermaid.render(id, chart);

                if (isMounted) {
                    setSvg(svg);
                    setIsError(false);
                }
            } catch (error) {
                console.error('Mermaid Render Error:', error);
                if (isMounted) {
                    setIsError(true);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        renderChart();

        return () => {
            isMounted = false;
        };
    }, [chart]);

    if (isError) return <div className="text-red-500 text-sm p-2 border border-red-300 rounded">図の描画に失敗しました</div>;

    return (
        <div className="mermaid-wrapper min-h-[50px]">
            {isLoading && !svg && <div className="text-gray-400 text-sm p-2 animate-pulse">Loading diagram...</div>}
            <div
                ref={ref}
                dangerouslySetInnerHTML={{ __html: svg }}
                className={`mermaid-diagram my-4 overflow-x-auto ${isLoading ? 'opacity-50' : 'opacity-100'} transition-opacity`}
            />
        </div>
    );
};

export default Mermaid;
