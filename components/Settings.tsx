
import React, { useState, useEffect, useCallback } from 'react';
import type { AiSettings, AiProvider, OllamaModel } from '../types';
import { fetchOllamaModels } from '../services/aiService';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AiSettings;
    onSave: (settings: AiSettings) => void;
    addLog: (level: 'INFO' | 'ERROR' | 'DEBUG', message: string, payload?: any) => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, settings, onSave, addLog }) => {
    const [localSettings, setLocalSettings] = useState<AiSettings>(settings);
    const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        setLocalSettings(settings);
        // If ollama is the provider and we have a URL but no model, try to fetch models
        if (settings.provider === 'ollama' && settings.ollamaUrl && ollamaModels.length === 0) {
            handleTestConnection();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings, isOpen]);

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };
    
    const handleTestConnection = useCallback(async () => {
        if (localSettings.provider !== 'ollama' || !localSettings.ollamaUrl) return;
        setConnectionStatus('testing');
        setConnectionError(null);
        setOllamaModels([]);
        try {
            const models = await fetchOllamaModels(localSettings.ollamaUrl, addLog);
            setOllamaModels(models);
            if (models.length > 0) {
                setConnectionStatus('success');
                // If no model is selected, or the selected one isn't in the list, default to the first one
                const currentModelExists = models.some(m => m.name === localSettings.ollamaModel);
                if (!localSettings.ollamaModel || !currentModelExists) {
                    setLocalSettings(s => ({...s, ollamaModel: models[0].name}));
                }
            } else {
                setConnectionStatus('error');
                setConnectionError("Connection successful, but no models found on the Ollama server.");
            }
        } catch (error) {
            setConnectionStatus('error');
            setConnectionError(error instanceof Error ? error.message : "An unknown error occurred.");
        }
    }, [localSettings.ollamaUrl, localSettings.ollamaModel, localSettings.provider, addLog]);

    if (!isOpen) return null;

    const renderConnectionStatus = () => {
        switch (connectionStatus) {
            case 'success':
                return <p className="text-xs text-green-500 mt-1">Connection successful. Found {ollamaModels.length} models.</p>;
            case 'error':
                return <p className="text-xs text-red-500 mt-1">{connectionError}</p>;
            case 'testing':
                return <p className="text-xs text-slate-400 mt-1">Testing connection...</p>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI Provider</label>
                        <select
                            value={localSettings.provider}
                            onChange={(e) => setLocalSettings({ ...localSettings, provider: e.target.value as AiProvider })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="ollama">Ollama (Local)</option>
                        </select>
                    </div>

                    {/* FIX: Remove Gemini API key input to comply with guidelines. API key should come from environment variables. */}
                    {localSettings.provider === 'gemini' && (
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                The Gemini API key is configured securely on the server using the <code>API_KEY</code> environment variable.
                            </p>
                        </div>
                    )}

                    {localSettings.provider === 'ollama' && (
                        <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                             <h3 className="text-md font-semibold text-slate-800 dark:text-slate-200">Ollama Configuration</h3>
                            <div>
                                <label htmlFor="ollamaUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ollama Server URL</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        id="ollamaUrl"
                                        value={localSettings.ollamaUrl}
                                        onChange={(e) => setLocalSettings({ ...localSettings, ollamaUrl: e.target.value })}
                                        className="flex-grow w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                        placeholder="http://localhost:11434"
                                    />
                                    <button
                                        onClick={handleTestConnection}
                                        disabled={connectionStatus === 'testing'}
                                        className="px-3 py-2 bg-slate-100 dark:bg-slate-600 text-sm font-medium rounded-md hover:bg-slate-200 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {connectionStatus === 'testing' ? 'Testing...' : 'Test & Fetch'}
                                    </button>
                                </div>
                                {renderConnectionStatus()}
                            </div>
                             <div>
                                <label htmlFor="ollamaModel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
                                <select
                                    id="ollamaModel"
                                    value={localSettings.ollamaModel}
                                    onChange={(e) => setLocalSettings({ ...localSettings, ollamaModel: e.target.value })}
                                    disabled={ollamaModels.length === 0 || connectionStatus !== 'success'}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed"
                                >
                                    {ollamaModels.length > 0 ? (
                                        <>
                                            <option value="">-- Select a model --</option>
                                            {ollamaModels.map(model => (
                                                <option key={model.name} value={model.name}>{model.name}</option>
                                            ))}
                                        </>
                                    ) : (
                                        <option value="">{connectionStatus === 'error' ? 'Could not fetch models' : 'Test connection to see models'}</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};