import { useState, useEffect } from 'react';
import type { AiSettings, AiProvider } from '../types';

const getInitialSettings = (): AiSettings => {
    try {
        const item = window.localStorage.getItem('aiSettings');
        if (item) {
            // FIX: Ensure the parsed settings don't contain the old geminiApiKey
            const parsed = JSON.parse(item);
            delete parsed.geminiApiKey;
            return parsed;
        }
    } catch (error) {
        console.warn('Error reading localStorage "aiSettings":', error);
    }
    
    // Fallback to default values
    return {
        provider: 'gemini',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: '',
    };
};

export const useAiSettings = (): [AiSettings, (settings: AiSettings) => void] => {
    const [settings, setSettings] = useState<AiSettings>(getInitialSettings);

    useEffect(() => {
        try {
            window.localStorage.setItem('aiSettings', JSON.stringify(settings));
        } catch (error) {
            console.warn('Error setting localStorage "aiSettings":', error);
        }
    }, [settings]);

    return [settings, setSettings];
};
