
import React, { useState, useEffect, useCallback } from 'react';
import { useAiSettings } from './hooks/useAiSettings';
import { analyzeBill } from './services/aiService';
import type { BillData, LogEntry } from './types';
import { Header } from './components/Header';
import { Welcome } from './components/Welcome';
import { FileUpload } from './components/FileUpload';
import { CameraCapture } from './components/CameraCapture';
import { Loader } from './components/Loader';
import { ErrorMessage } from './components/ErrorMessage';
import { BillDataDisplay } from './components/BillDataDisplay';
import { Settings } from './components/Settings';
import { HistoryList } from './components/HistoryList';
import { DebugLog } from './components/DebugLog';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
    const [settings, saveSettings] = useAiSettings();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [billData, setBillData] = useState<BillData | null>(null);
    const [history, setHistory] = useState<BillData[]>(() => {
        try {
            const savedHistory = localStorage.getItem('billHistory');
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            console.error("Failed to parse history from localStorage", e);
            return [];
        }
    });
    const [showSettings, setShowSettings] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showDebugLog, setShowDebugLog] = useState(false);

    const addLog = useCallback((level: LogEntry['level'], message: string, payload?: any) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prevLogs => [...prevLogs, { timestamp, level, message, payload }]);
    }, []);

    useEffect(() => {
        localStorage.setItem('billHistory', JSON.stringify(history));
    }, [history]);

    const toggleDarkMode = () => {
        const newIsDarkMode = !isDarkMode;
        setIsDarkMode(newIsDarkMode);
        if (newIsDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };
    
    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const handleFileUpload = async (file: File) => {
        setError(null);
        try {
            const dataUrl = await fileToDataUrl(file);
            setCapturedImage(dataUrl);
            addLog('INFO', `Image uploaded: ${file.name}`);
        } catch (e) {
            const errorMessage = "Failed to read the uploaded file.";
            setError(errorMessage);
            addLog('ERROR', errorMessage, e);
        }
    };

    const handleCameraCapture = (dataUrl: string) => {
        setError(null);
        setCapturedImage(dataUrl);
        addLog('INFO', 'Image captured from camera.');
    };
    
    const handleAnalyzeBill = useCallback(async () => {
        if (!capturedImage) {
            setError("No image to analyze.");
            addLog('ERROR', "Analysis triggered with no image.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setLogs([]); // Clear logs for new analysis
        addLog('INFO', 'Starting bill analysis...');

        try {
            const { parsedData, rawResponse } = await analyzeBill(capturedImage, settings, addLog);
            const newBill: BillData = {
                ...parsedData,
                id: `bill-${Date.now()}`,
                analyzedAt: new Date().toISOString(),
                rawResponse: rawResponse,
            };
            setBillData(newBill);
            setHistory(prev => [newBill, ...prev.slice(0, 19)]); // Keep last 20
            setCapturedImage(null);
            addLog('INFO', 'Analysis successful!', newBill);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
            setError(errorMessage);
            addLog('ERROR', `Analysis failed: ${errorMessage}`, err);
        } finally {
            setIsLoading(false);
        }
    }, [capturedImage, settings, addLog]);

    const handleSelectHistory = (id: string) => {
        const selectedBill = history.find(item => item.id === id);
        if (selectedBill) {
            setBillData(selectedBill);
            setCapturedImage(null);
            setError(null);
        }
    };
    
    const handleDeleteHistory = (id: string) => {
        const newHistory = history.filter(item => item.id !== id);
        setHistory(newHistory);
        if (billData?.id === id) {
            setBillData(null);
        }
    };

    const resetState = () => {
        setCapturedImage(null);
        setBillData(null);
        setError(null);
    };

    const handleBillDataUpdate = (updatedBillData: BillData) => {
        setBillData(updatedBillData);
        // Also update the history
        setHistory(prev => prev.map(h => h.id === updatedBillData.id ? updatedBillData : h));
        addLog('INFO', 'Bill data updated by user.');
    };
    
    return (
        <div className="min-h-screen flex flex-col">
            <Header
                onSettingsClick={() => setShowSettings(true)}
                onDebugClick={() => setShowDebugLog(prev => !prev)}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
            />
            <Settings 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
                settings={settings} 
                onSave={saveSettings}
                addLog={addLog}
            />

            <div className="flex-grow flex">
                <aside className="w-64 h-[calc(100vh-4rem)] sticky top-16 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 flex-col no-print hidden md:flex">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="font-semibold text-slate-800 dark:text-slate-200">History</h2>
                    </div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                       <HistoryList history={history} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} activeId={billData?.id || null} />
                    </div>
                </aside>
                
                <main className="flex-grow p-4 sm:p-6 lg:p-8 relative">
                    <ErrorBoundary>
                        {isLoading && <Loader message="Analyzing your bill..." />}
                        
                        {error && !isLoading && (
                            <div className="max-w-4xl mx-auto">
                                <ErrorMessage message={error} onRetry={capturedImage ? handleAnalyzeBill : resetState} />
                            </div>
                        )}

                        {!billData && !capturedImage && !isLoading && <Welcome />}

                        {billData && !isLoading && <BillDataDisplay billData={billData} onUpdate={handleBillDataUpdate} onAnalyzeNew={resetState} />}

                        {capturedImage && !billData && !isLoading && (
                            <div className="max-w-4xl mx-auto text-center">
                                <h2 className="text-2xl font-bold mb-4">Image Ready for Analysis</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-4">Your image has been loaded. Click the button below to start the AI analysis.</p>
                                <img src={capturedImage} alt="Captured bill" className="max-w-full max-h-[50vh] mx-auto rounded-lg shadow-lg mb-6" />
                                <div className="flex justify-center space-x-4">
                                    <button onClick={resetState} className="px-6 py-2 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md font-semibold hover:bg-slate-50 dark:hover:bg-slate-600">
                                        Cancel
                                    </button>
                                    <button onClick={handleAnalyzeBill} className="px-6 py-2 text-white bg-sky-600 rounded-md font-semibold hover:bg-sky-700">
                                        Analyze Bill
                                    </button>
                                </div>
                            </div>
                        )}
                    </ErrorBoundary>
                </main>
            </div>
            
            {!billData && !capturedImage && (
                <footer className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700 p-4 no-print z-20">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
                        <FileUpload onFileUpload={handleFileUpload} disabled={isLoading} />
                        <div className="text-sm text-slate-400">OR</div>
                        <CameraCapture onCapture={handleCameraCapture} disabled={isLoading} />
                    </div>
                </footer>
            )}
            
            <DebugLog logs={logs} isVisible={showDebugLog} />
        </div>
    );
};

export default App;