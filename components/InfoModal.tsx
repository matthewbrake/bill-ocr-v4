import React from 'react';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const changelogItems = [
        {
            version: "2.1",
            title: "Dynamic Chart Engine & Verbose Logging",
            points: [
                "Replaced chart analysis with a dynamic, geometry-based engine that can find multiple charts and handle multi-bar layouts.",
                "Greatly increased the verbosity of the debug log to show the full analysis pipeline.",
                "Added this version/changelog info modal."
            ]
        },
        {
            version: "2.0",
            title: "Multi-Pass Data Fusion Framework",
            points: [
                "Introduced a new analysis framework for Ollama that uses programmatic chart analysis for accuracy and an LLM for data fusion.",
                "Added interactive/editable data tables for usage charts.",
                "Implemented AI-powered Verification Questions for uncertain data points."
            ]
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">About AI Bill Analyzer</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Version 2.1</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-500 dark:text-slate-400">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <h3 className="text-md font-semibold text-slate-800 dark:text-slate-200 mb-4">What's New</h3>
                    <div className="space-y-6">
                        {changelogItems.map(item => (
                            <div key={item.version}>
                                <p className="font-semibold text-slate-700 dark:text-slate-300"><span className="bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 font-mono text-sm px-2 py-1 rounded-md mr-2">{item.version}</span>{item.title}</p>
                                <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400 pl-2">
                                    {item.points.map((point, index) => (
                                        <li key={index}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
