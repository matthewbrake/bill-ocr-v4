import React from 'react';
import type { UsageChartData, VerificationQuestion } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface UsageChartComponentProps {
    chartData: UsageChartData;
    chartIndex: number;
    verificationQuestions?: VerificationQuestion[];
}

const COLORS = ['#38bdf8', '#fbbf24', '#a78bfa', '#f87171'];

export const UsageChart: React.FC<UsageChartComponentProps> = ({ chartData, chartIndex, verificationQuestions }) => {
    if (!chartData || !chartData.data || chartData.data.length === 0) {
        return <p>No usage data available for this chart.</p>;
    }

    const years = Array.from(new Set(chartData.data.flatMap(d => d.usage.map(u => u.year)))).sort();

    const processedData = chartData.data.map(item => {
        const dataPoint: { [key: string]: string | number } = { month: item.month };
        item.usage.forEach(u => {
            dataPoint[u.year] = u.value;
        });
        return dataPoint;
    });

    const isUncertain = (month: string, year: string): boolean => {
        if (!verificationQuestions) return false;

        const monthIndex = chartData.data.findIndex(d => d.month === month);
        if (monthIndex === -1) return false;

        const dataPoint = chartData.data[monthIndex];
        const usageIndex = dataPoint.usage.findIndex(u => u.year === year);
        if (usageIndex === -1) return false;

        // FIX: Ensure the regex pattern correctly matches the nested structure path.
        const fieldPathPattern = new RegExp(`usageCharts\\.${chartIndex}\\.data\\.${monthIndex}\\.usage\\.${usageIndex}\\.value`);
        return verificationQuestions.some(q => fieldPathPattern.test(q.field));
    };

    return (
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={processedData}
                    margin={{
                        top: 5,
                        right: 20,
                        left: -10,
                        bottom: 5,
                    }}
                >
                    <defs>
                        {COLORS.map((color, index) => (
                             <pattern key={`pattern-${index}`} id={`pattern-${index}`} patternUnits="userSpaceOnUse" width="8" height="8">
                                <rect width="8" height="8" fill={color} />
                                <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
                            </pattern>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                    <XAxis dataKey="month" tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} />
                    <YAxis
                        tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }}
                        label={{ value: chartData.unit, angle: -90, position: 'insideLeft', fill: 'rgb(100 116 139)', style: { textAnchor: 'middle' } }}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }}
                        contentStyle={{
                            backgroundColor: 'rgb(15 23 42)',
                            borderColor: 'rgb(51 65 85)',
                            color: 'rgb(226 232 240)',
                            borderRadius: '0.5rem'
                        }}
                    />
                    <Legend wrapperStyle={{fontSize: "14px"}}/>
                    {years.map((year, yearIndex) => (
                        <Bar key={year} dataKey={year} fill={COLORS[yearIndex % COLORS.length]}>
                            {processedData.map((entry, entryIndex) => (
                                <Cell
                                    key={`cell-${entryIndex}`}
                                    fill={isUncertain(entry.month as string, year)
                                        ? `url(#pattern-${yearIndex % COLORS.length})`
                                        : COLORS[yearIndex % COLORS.length]
                                    }
                                />
                            ))}
                        </Bar>
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
