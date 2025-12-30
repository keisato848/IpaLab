
'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
    chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState('');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose', // Needed to allow HTML in nodes if used
        });

        const renderChart = async () => {
            if (!chart || !ref.current) return;

            try {
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                // Use renderAsync or render
                const { svg } = await mermaid.render(id, chart);
                setSvg(svg);
                setIsError(false);
            } catch (error) {
                console.error('Mermaid Render Error:', error);
                setIsError(true);
            }
        };

        renderChart();
    }, [chart]);

    if (isError) return <div className="text-red-500 text-sm p-2 border border-red-300 rounded">図の描画に失敗しました</div>;

    // Using dangerouslySetInnerHTML to insert the SVG
    return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} className="mermaid-diagram my-4 overflow-x-auto" />;
};

export default Mermaid;
