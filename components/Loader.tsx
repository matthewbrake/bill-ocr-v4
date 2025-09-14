import React, { useState, useEffect } from 'react';
import type { LogEntry } from '../types';

interface LoaderProps {
    logs: LogEntry[];
}

export const Loader: React.FC<LoaderProps> = ({ logs }) => {
    const [progressSteps, setProgressSteps] = useState<string[]>([]);

    useEffect(() => {
        const newSteps = logs
            .filter(log => log.level === 'PROGRESS')
            .map(log => log.message);
        setProgressSteps(newSteps);
    }, [logs]);

    const lastStep = progressSteps[progressSteps.length - 1] || "Initializing...";

    return (
        <div className="absolute inset-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center z-30 transition-opacity duration-300">
            <div className="text-center p-8">
                <svg className="animate-spin h-12 w-12 text-sky-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h2 className="mt-6 text-xl font-semibold text-slate-800 dark:text-slate-200">Analyzing your bill...</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400 animate-pulse">{lastStep}</p>
                
                <div className="mt-8 text-left w-72 mx-auto space-y-2">
                    {progressSteps.slice(0, -1).map((step, index) => (
                         <div key={index} className="flex items-center text-green-600 dark:text-green-400 opacity-80">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm">{step}</span>
                        </div>
                    ))}
                    {progressSteps.length > 0 && (
                         <div className="flex items-center text-sky-600 dark:text-sky-400">
                           <svg className="animate-spin h-5 w-5 mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                           </svg>
                            <span className="text-sm font-semibold">{lastStep}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};