import React, { useState } from 'react';
import type { BillData } from '../types';
import { exportLineItemsToCsv, exportUsageDataToCsv } from '../utils/csv';
import { UsageChart } from './UsageChart';
import { EditableUsageTable } from './EditableUsageTable';

interface BillDataDisplayProps {
    billData: BillData;
    onUpdate: (updatedBillData: BillData) => void;
    onAnalyzeNew: () => void;
}

const InfoField: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-slate-900 dark:text-white">{value || 'N/A'}</p>
    </div>
);

const ConfidenceMeter: React.FC<{ score: number }> = ({ score }) => {
    const percentage = score * 100;
    const getColor = () => {
        if (percentage >= 85) return 'bg-green-500';
        if (percentage >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
                className={`h-2.5 rounded-full transition-all duration-500 ${getColor()}`}
                style={{ width: `${percentage}%` }}
            ></div>
        </div>
    );
};

export const BillDataDisplay: React.FC<BillDataDisplayProps> = ({ billData, onUpdate, onAnalyzeNew }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [submitMessage, setSubmitMessage] = useState('');
    
    const handleTableUpdate = (chartIndex: number, updatedChartData: BillData['usageCharts'][0]) => {
        const newBillData = JSON.parse(JSON.stringify(billData));
        newBillData.usageCharts[chartIndex] = updatedChartData;
        onUpdate(newBillData);
    };

    const handleFormspreeSubmit = async () => {
        const formspreeId = process.env.FORMSPREE_FORM_ID;
        if (!formspreeId) {
            setSubmitStatus('error');
            setSubmitMessage('Formspree ID is not configured. Please set FORMSPREE_FORM_ID in your environment.');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus('idle');

        try {
            const response = await fetch(`https://formspree.io/f/${formspreeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    ...billData,
                    subject: `Bill Analysis Submission - Acct: ${billData.accountNumber}`,
                }),
            });

            if (response.ok) {
                setSubmitStatus('success');
                setSubmitMessage('Results submitted successfully!');
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }
        } catch (error) {
            setSubmitStatus('error');
            setSubmitMessage('Failed to submit results. Please try again.');
            console.error('Formspree submission error:', error);
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setSubmitStatus('idle'), 5000); // Reset status after 5 seconds
        }
    };

    const renderSubmitButtonContent = () => {
        if (isSubmitting) {
            return (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                </>
            );
        }
        return (
            <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                Submit Results
            </>
        );
    };

    return (
        <div className="print-container print-force-light">
            <div className="flex flex-wrap gap-4 justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bill Analysis Results</h2>
                    <p className="text-slate-500 dark:text-slate-400">Analyzed on: {new Date(billData.analyzedAt).toLocaleString()}</p>
                </div>
                <div className="no-print flex items-center gap-2">
                     <button onClick={onAnalyzeNew} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-600 border border-transparent rounded-md shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                         </svg>
                        Analyze New Bill
                    </button>
                     <button onClick={handleFormspreeSubmit} disabled={isSubmitting || !process.env.FORMSPREE_FORM_ID} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400 disabled:cursor-not-allowed">
                        {renderSubmitButtonContent()}
                    </button>
                    <button onClick={() => window.print()} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-500 dark:text-slate-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.32 0c.041-.02.083-.041.124-.061M6.34 18c-.041-.02-.083-.041-.124-.061M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </button>
                </div>
                 {submitStatus !== 'idle' && (
                    <p className={`w-full text-sm mt-2 text-center ${submitStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {submitMessage}
                    </p>
                )}
            </div>

            {billData.verificationQuestions && billData.verificationQuestions.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Verification Needed</h3>
                            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">The AI has low confidence in some fields. Please review the highlighted items below for accuracy.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Account Details */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2 border-slate-200 dark:border-slate-700">Account Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InfoField label="Account Name" value={billData.accountName} />
                        <InfoField label="Account Number" value={billData.accountNumber} />
                        <InfoField label="Statement Date" value={billData.statementDate} />
                        <InfoField label="Due Date" value={billData.dueDate} />
                        <InfoField label="Service Period" value={billData.servicePeriodStart && billData.servicePeriodEnd ? `${billData.servicePeriodStart} - ${billData.servicePeriodEnd}` : 'N/A'} />
                        <div className="col-span-2">
                             <InfoField label="Service Address" value={billData.serviceAddress} />
                        </div>
                    </div>
                </div>
                {/* Confidence & Totals */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold">Total Current Charges</h3>
                        <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                            ${billData.totalCurrentCharges.toFixed(2)}
                        </p>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold mb-2">AI Confidence</h3>
                        <div className="flex items-center space-x-4">
                           <span className="text-xl font-bold">{(billData.confidenceScore * 100).toFixed(0)}%</span>
                           <ConfidenceMeter score={billData.confidenceScore} />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
                            <strong>AI Reasoning:</strong> {billData.confidenceReasoning}
                        </p>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Line Items</h3>
                    <button onClick={() => exportLineItemsToCsv(billData)} className="no-print text-sm flex items-center space-x-1 text-sky-600 dark:text-sky-400 hover:underline">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span>Export CSV</span>
                    </button>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {billData.lineItems.map((item, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200">{item.description}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${item.amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {item.amount.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Usage Charts */}
            {billData.usageCharts.map((chart, index) => (
                 <div key={index} className="mb-8 p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xl font-semibold">{chart.title}</h3>
                         <button onClick={() => exportUsageDataToCsv(chart)} className="no-print text-sm flex items-center space-x-1 text-sky-600 dark:text-sky-400 hover:underline">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            <span>Export CSV</span>
                        </button>
                    </div>
                     <UsageChart 
                        chartData={chart}
                        chartIndex={index}
                        verificationQuestions={billData.verificationQuestions}
                     />
                     <div className="mt-6">
                        <h4 className="text-md font-semibold mb-2">Edit Usage Data</h4>
                        <EditableUsageTable 
                            chartData={chart}
                            chartIndex={index}
                            onUpdate={(updatedData) => handleTableUpdate(index, updatedData)}
                            verificationQuestions={billData.verificationQuestions}
                        />
                     </div>
                 </div>
            ))}

            {/* Raw Data Viewer */}
            {billData.rawResponse && (
                <div className="mt-8 no-print">
                    <details className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <summary className="cursor-pointer p-4 font-semibold text-slate-700 dark:text-slate-200">
                            View Raw AI Data
                        </summary>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-md overflow-x-auto custom-scrollbar">
                                {JSON.stringify(JSON.parse(billData.rawResponse), null, 2)}
                            </pre>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
};