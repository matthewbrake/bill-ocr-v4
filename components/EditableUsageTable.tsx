import React, { useState, useEffect } from 'react';
import type { UsageChartData, VerificationQuestion } from '../types';

interface EditableUsageTableProps {
    chartData: UsageChartData;
    chartIndex: number;
    verificationQuestions?: VerificationQuestion[];
    onUpdate: (updatedChartData: UsageChartData) => void;
}

export const EditableUsageTable: React.FC<EditableUsageTableProps> = ({ chartData, chartIndex, verificationQuestions, onUpdate }) => {
    const [localData, setLocalData] = useState(chartData);

    useEffect(() => {
        setLocalData(chartData);
    }, [chartData]);
    
    const years = Array.from(new Set(localData.data.flatMap(d => d.usage.map(u => u.year)))).sort();

    const handleValueChange = (month: string, year: string, value: string) => {
        const newData = JSON.parse(JSON.stringify(localData)); // Deep copy
        const dataPoint = newData.data.find((d: any) => d.month === month);
        if (dataPoint) {
            const usagePoint = dataPoint.usage.find((u: any) => u.year === year);
            const parsedValue = parseFloat(value);
            if (usagePoint) {
                usagePoint.value = isNaN(parsedValue) ? 0 : parsedValue;
            } else {
                 dataPoint.usage.push({year, value: isNaN(parsedValue) ? 0 : parsedValue})
            }
            setLocalData(newData);
            onUpdate(newData);
        }
    };
    
    const getVerificationQuestionForField = (monthIndex: number, year: string) => {
        if (!verificationQuestions) return null;

        const dataPoint = chartData.data[monthIndex];
        if (!dataPoint) return null;
        
        const usageIndex = dataPoint.usage.findIndex(u => u.year === year);
        if (usageIndex === -1) return null;

        // FIX: Correctly construct the regex to match the nested usage path.
        const fieldPathPattern = new RegExp(`usageCharts\\.${chartIndex}\\.data\\.${monthIndex}\\.usage\\.${usageIndex}\\.value`);

        return verificationQuestions.find(q => fieldPathPattern.test(q.field));
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Month</th>
                        {years.map(year => (
                            <th key={year} scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{year}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                    {localData.data.map((item, monthIndex) => (
                        <tr key={item.month}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-200">{item.month}</td>
                            {years.map(year => {
                                const usage = item.usage.find(u => u.year === year);
                                const verificationQuestion = getVerificationQuestionForField(monthIndex, year);
                                return (
                                    <td key={year} className="px-4 py-2 whitespace-nowrap text-sm">
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                value={usage ? usage.value : ''}
                                                onChange={(e) => handleValueChange(item.month, year, e.target.value)}
                                                className={`w-24 bg-transparent border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                                    verificationQuestion 
                                                    ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                                                    : 'border-slate-300 dark:border-slate-600'
                                                }`}
                                            />
                                            {verificationQuestion && (
                                                <div className="group relative ml-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                    </svg>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs text-white bg-slate-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                        <span className="font-semibold block">AI Verification Request:</span>
                                                        {verificationQuestion.question}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
