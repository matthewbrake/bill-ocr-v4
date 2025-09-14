import React from 'react';

interface ErrorMessageProps {
    message: string;
    onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
    return (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/30 p-6 rounded-lg my-4 shadow-md">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                </div>
                <div className="ml-4">
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Analysis Error</h3>
                    <p className="mt-1 text-red-700 dark:text-red-300">
                        {message}
                    </p>
                    {onRetry && (
                        <div className="mt-4">
                             <button onClick={onRetry} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 dark:focus:ring-offset-slate-900 focus:ring-red-500">
                                Try again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};