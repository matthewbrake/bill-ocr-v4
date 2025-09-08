
import React from 'react';

export const Welcome: React.FC = () => {
    return (
        <div className="text-center p-8">
            <div className="max-w-md mx-auto">
                <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5h6m-6 3h6m-6-3v-6A1.5 1.5 0 0 1 10.5 6h3A1.5 1.5 0 0 1 15 7.5v6m-6 3h6m-6-3H9m6 3H9m6 3h.008v.008H15V18Zm-6 0h.008v.008H9V18Zm-3 0h.008v.008H6V18Zm-3 0h.008v.008H3V18Zm3 0h.008v.008H6V18Zm6 0h.008v.008H12V18Zm3 0h.008v.008H15V18Zm3 0h.008v.008H18V18Zm-3-1.5h.008v.008H15V16.5Zm-6 0h.008v.008H9V16.5Zm-3 0h.008v.008H6V16.5Zm-3 0h.008v.008H3V16.5Zm3 0h.008v.008H6V16.5Zm6 0h.008v.008H12V16.5Zm3 0h.008v.008H15V16.5Zm3 0h.008v.008H18V16.5Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M3.75 3h16.5" />
                </svg>
                <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Welcome to the AI Bill Analyzer</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                    Get started by uploading or taking a picture of your utility bill. The AI will automatically extract and display the key details.
                </p>
                <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
                    Use the controls at the bottom to upload a file or use your camera.
                </p>
            </div>
        </div>
    );
};
