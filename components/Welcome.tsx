import React from 'react';

const FeatureCard = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 bg-sky-100 dark:bg-sky-900/50 p-3 rounded-full">
                {icon}
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{children}</p>
            </div>
        </div>
    </div>
);


export const Welcome: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto text-center py-8 px-4">
            <div className="flex justify-center items-center space-x-3 mb-4">
                 <svg className="w-12 h-12 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">AI Bill Analyzer</h1>
            </div>
           
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                Instantly scan, analyze, and verify utility bills with the power of multimodal AI. Just upload an image to get started.
            </p>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <FeatureCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-sky-600 dark:text-sky-400"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>}
                    title="Upload or Snap a Photo"
                >
                    Use your file browser or take a picture with your device's camera.
                </FeatureCard>

                <FeatureCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-sky-600 dark:text-sky-400"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.773 4.773ZM4.5 19.5l3-3m0 0l2.25-2.25M7.5 16.5l2.25-2.25m0 0l3 3M7.5 16.5l-3 3m0 0l-3-3m3 3V4.5m0 12V6.75" /></svg>}
                    title="Intelligent AI Analysis"
                >
                    Our AI extracts account details, line items, and complex chart data in seconds.
                </FeatureCard>
                
                <FeatureCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-sky-600 dark:text-sky-400"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 18H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 12H15m-11.25 0L5.25 9" /></svg>}
                    title="Verify & Edit"
                >
                    Review the extracted data, get warnings for low-confidence fields, and edit values directly.
                </FeatureCard>

                <FeatureCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-sky-600 dark:text-sky-400"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5h6m-6 3h6m2.25-3H21m-3.75 3H21m-3.75-3V6.75A2.25 2.25 0 0 0 15 4.5h-4.5A2.25 2.25 0 0 0 8.25 6.75v10.5M3.75 6.75h.008v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>}
                    title="Export & Submit"
                >
                    Download your data as a CSV file or submit the results to a configured endpoint.
                </FeatureCard>
            </div>
             <p className="mt-12 text-slate-400 dark:text-slate-500">
                To begin, please select a file or use your camera below.
            </p>
        </div>
    );
};