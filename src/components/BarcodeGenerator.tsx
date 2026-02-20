'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
    value: string;
    width?: number;
    height?: number;
}

export default function BarcodeGenerator({ value, width = 2, height = 60 }: BarcodeProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: 'CODE128',
                    width,
                    height,
                    displayValue: false,
                    margin: 4,
                    background: '#ffffff',
                    lineColor: '#000000',
                });
            } catch (e) {
                console.error('Barcode error:', e);
            }
        }
    }, [value, width, height]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
}
