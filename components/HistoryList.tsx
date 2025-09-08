
import React from 'react';
import type { BillData } from '../types';

interface HistoryListProps {
    history: BillData[];
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    activeId: string | null;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onDelete, activeId }) => {
    if (history.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-slate-400">
                No analysis history yet.
            </div>
        );
    }

    return (
        <div className="space-y-2 p-2">
            {history.map(item => (
                <div
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        activeId === item.id 
                        ? 'bg-sky-100 dark:bg-sky-900/50' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    <div className="truncate">
                        <p className={`font-medium truncate ${
                            activeId === item.id 
                            ? 'text-sky-700 dark:text-sky-300' 
                            : 'text-slate-700 dark:text-slate-200'
                        }`}>
                           Acct: ...{item.accountNumber.slice(-6)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                           {item.statementDate || new Date(item.analyzedAt).toLocaleDateString()}
                        </p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                        }}
                        className="ml-2 p-1 rounded-full text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                        title="Delete item"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
};
