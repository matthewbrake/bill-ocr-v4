
import React, { useRef, useEffect } from 'react';
import type { LogEntry } from '../types';

interface DebugLogProps {
    logs: LogEntry[];
    isVisible: boolean;
}

export const DebugLog: React.FC<DebugLogProps> = ({ logs, isVisible }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    if (!isVisible) return null;

    const getLevelColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'INFO': return 'text-sky-400';
            case 'ERROR': return 'text-red-400';
            case 'DEBUG': return 'text-slate-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="no-print fixed bottom-0 left-0 right-0 h-64 bg-slate-900/95 backdrop-blur-sm z-40 border-t border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center p-2 bg-slate-800 border-b border-slate-700">
                <h3 className="font-mono text-sm font-semibold text-slate-300">Debug Log</h3>
            </div>
            <div ref={logContainerRef} className="h-[calc(100%-2.5rem)] overflow-y-auto p-2 font-mono text-xs custom-scrollbar">
                {logs.map((log, index) => (
                    <div key={index} className="flex items-start text-slate-300 mb-1">
                        <span className="text-slate-500 mr-2">{log.timestamp}</span>
                        <span className={`font-bold w-12 flex-shrink-0 ${getLevelColor(log.level)}`}>[{log.level}]</span>
                        <div className="whitespace-pre-wrap break-all">
                            <span>{log.message}</span>
                            {log.payload && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer text-slate-400">View Payload</summary>
                                    <pre className="text-slate-400 bg-slate-800 p-2 rounded-md mt-1 text-xs overflow-x-auto">
                                        {JSON.stringify(log.payload, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
