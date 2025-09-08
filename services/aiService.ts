import { GoogleGenAI } from "@google/genai";
import type { BillData, AiSettings, OllamaModel } from "../types";
import { prompt as geminiPrompt, billSchema } from '../prompts/prompt_v2';
import { prompt as ollamaHybridPrompt } from '../prompts/prompt_ocr_hybrid';
import Tesseract from 'tesseract.js';

// --- Common Utilities ---

type BillDataSansId = Omit<BillData, 'id' | 'analyzedAt'>;
interface AnalysisResult {
    parsedData: BillDataSansId;
    rawResponse: string;
}

const getValidatedOllamaUrl = (baseUrl: string, path: string): string => {
    try {
        if (!/^(https?|ftp):\/\//i.test(baseUrl)) {
             throw new Error("URL is missing a protocol (e.g., http:// or https://).");
        }
        const url = new URL(path, baseUrl);
        return url.toString();
    } catch (error) {
        console.error("Invalid Ollama URL provided:", error);
        throw new Error(`The Ollama URL "${baseUrl}" is invalid. Please check the format and try again.`);
    }
};

const sanitizeAiResponse = (rawJson: any): Partial<BillData> => {
    const sourceData = rawJson.properties && typeof rawJson.properties === 'object' ? rawJson.properties : rawJson;

    if (typeof sourceData !== 'object' || sourceData === null) {
        return {};
    }

    const sanitized: any = {};
    const keyMap: { [key: string]: string[] } = {
        accountName: ['account_name'],
        accountNumber: ['account_number', 'invoice_number', 'account_no'],
        totalCurrentCharges: ['total_current_charges', 'total_due', 'amount_due', 'total', 'charges'],
        statementDate: ['statement_date', 'bill_date', 'invoice_date'],
        dueDate: ['due_date', 'payment_due'],
        serviceAddress: ['service_address'],
        lineItems: ['line_items', 'charges_details', 'breakdown'],
        usageCharts: ['usage_charts', 'usage_history', 'graphs'],
        confidenceScore: ['confidence_score'],
        confidenceReasoning: ['confidence_reasoning'],
        verificationQuestions: ['verification_questions'],
    };

    const findValue = (obj: any, primaryKey: string, alternatives: string[]): any => {
        const keysToSearch = [primaryKey, ...alternatives];
        for (const key of keysToSearch) {
            const actualKey = Object.keys(obj).find(k => k.toLowerCase().replace(/_/g, '') === key.toLowerCase().replace(/_/g, ''));
            if (actualKey && obj[actualKey] !== undefined) {
                return obj[actualKey];
            }
        }
        return undefined;
    };

    for (const key in keyMap) {
        const value = findValue(sourceData, key, keyMap[key]);
        if (value !== undefined) {
            sanitized[key] = value;
        }
    }
    
    for (const key in sourceData) {
        if (!sanitized.hasOwnProperty(key) && (billSchema.properties as any).hasOwnProperty(key)) {
            sanitized[key] = sourceData[key];
        }
    }
    
    if (Array.isArray(sanitized.usageCharts)) {
        // FIX: Filter out any non-object items that the AI might have mistakenly added.
        sanitized.usageCharts = sanitized.usageCharts
            .filter((chart: any) => typeof chart === 'object' && chart !== null && chart.data)
            .map((chart: any) => {
                if (!chart.data || !Array.isArray(chart.data)) return {...chart, data: []};
                
                const isNested = chart.data.every((d: any) => d.month && Array.isArray(d.usage));
                if(isNested) return chart;
                
                const monthMap: { [key: string]: { month: string, usage: { year: string, value: number }[] } } = {};
                
                for (const flatPoint of chart.data) {
                    if (!flatPoint.month || typeof flatPoint.month !== 'string' || flatPoint.value === undefined) {
                        continue;
                    }

                    const match = flatPoint.month.match(/([a-zA-Z]{3,})\.?\s*,?\s*(\d{4})/);
                    if (match) {
                        const month = match[1];
                        const year = match[2];
                        
                        if (!monthMap[month]) {
                            monthMap[month] = { month, usage: [] };
                        }
                        monthMap[month].usage.push({ year, value: parseFloat(String(flatPoint.value)) || 0 });
                    }
                }
                return { ...chart, data: Object.values(monthMap) };
            });
    }

    // Ensure required fields and arrays have safe default values to prevent crashes
    sanitized.accountNumber = sanitized.accountNumber ?? 'N/A';
    sanitized.totalCurrentCharges = sanitized.totalCurrentCharges ?? 0;
    sanitized.confidenceScore = sanitized.confidenceScore ?? 0.5;
    sanitized.confidenceReasoning = sanitized.confidenceReasoning ?? 'Confidence not provided by AI. Please verify data.';
    // FIX: Filter out invalid entries from lineItems to prevent crashes.
    sanitized.lineItems = Array.isArray(sanitized.lineItems) 
        ? sanitized.lineItems.filter((item: any) => typeof item === 'object' && item !== null && item.description) 
        : [];
    sanitized.usageCharts = Array.isArray(sanitized.usageCharts) ? sanitized.usageCharts : [];
    sanitized.verificationQuestions = Array.isArray(sanitized.verificationQuestions) ? sanitized.verificationQuestions : [];

    return sanitized;
};


const postProcessData = (parsedData: any): BillDataSansId => {
    if (typeof parsedData.totalCurrentCharges === 'string') {
        parsedData.totalCurrentCharges = parseFloat(parsedData.totalCurrentCharges.replace(/[^0-9.-]+/g,""));
    }
    if (parsedData.lineItems) {
        parsedData.lineItems.forEach((item: any) => {
            if(typeof item.amount === 'string') {
                item.amount = parseFloat(item.amount.replace(/[^0-9.-]+/g, ""));
            }
        });
    }
    if (parsedData.usageCharts) {
        parsedData.usageCharts.forEach((chart: any) => {
            if (chart.data) {
                chart.data.forEach((point: any) => {
                    if(point.usage) {
                        point.usage.forEach((u: any) => {
                            if(typeof u.value === 'string') {
                                u.value = parseFloat(u.value);
                            }
                        })
                    }
                })
            }
        })
    }
    return parsedData;
};

// --- Tesseract OCR Function ---

const runOcr = async (imageB64: string, addLog: Function): Promise<string> => {
    addLog('INFO', 'Starting OCR with Tesseract.js...');
    try {
        const { data: { text } } = await Tesseract.recognize(imageB64, 'eng');
        addLog('INFO', 'OCR completed successfully.', { text });
        return text;
    } catch (error) {
        addLog('ERROR', 'OCR failed with Tesseract.js.', error);
        return '';
    }
};

// --- Gemini Provider ---

const callGemini = async (imageB64: string, addLog: Function): Promise<AnalysisResult> => {
    addLog('INFO', 'Starting bill analysis with Gemini...');
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
        inlineData: {
            mimeType: imageB64.substring(imageB64.indexOf(":") + 1, imageB64.indexOf(";")),
            data: imageB64.substring(imageB64.indexOf(",") + 1),
        },
    };

    try {
        const requestPayload = {
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: geminiPrompt }, imagePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: billSchema,
            },
        };
        addLog('DEBUG', 'Gemini Request Payload:', requestPayload);

        const response = await ai.models.generateContent(requestPayload);
        
        const jsonText = response.text.trim();
        addLog('DEBUG', 'Gemini Raw Response:', jsonText);

        const parsedJson = JSON.parse(jsonText);
        const sanitizedJson = sanitizeAiResponse(parsedJson);
        addLog('INFO', 'Successfully parsed & sanitized Gemini response.', sanitizedJson);
        const parsedData = postProcessData(sanitizedJson);
        return { parsedData, rawResponse: jsonText };
    } catch (error) {
        addLog('ERROR', 'Gemini API Error:', error);
        console.error("Gemini API Error:", error);
        throw new Error("Failed to analyze bill with Gemini. The model could not process the image. Check your API key and try a clearer image.");
    }
};

// --- Ollama Provider ---

const callOllama = async (imageB64: string, url: string, model: string, addLog: Function): Promise<AnalysisResult> => {
    if (!url || !model) {
        addLog('ERROR', 'Ollama URL or model is not configured.');
        throw new Error("Ollama URL or model is not configured. Please add it in the settings.");
    }
    addLog('INFO', `Starting bill analysis with Ollama model: ${model}`);

    const ocrText = await runOcr(imageB64, addLog);

    let endpoint: string;
    try {
        endpoint = getValidatedOllamaUrl(url, "/api/chat"); // Ollama API uses /api/chat
    } catch (error) {
        addLog('ERROR', 'Invalid Ollama URL in settings', { url, error });
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred during Ollama URL validation.");
    }

    try {
        const requestBody = {
            model: model,
            format: "json", // Use the 'format' parameter for Ollama
            stream: false,
            options: {
                // temperature: 0, // Optional: lower temp for more deterministic output
            },
            messages: [
                {
                    role: "system",
                    content: ollamaHybridPrompt(ocrText),
                },
                {
                    role: "user",
                    content: "Analyze this utility bill image.",
                    images: [imageB64.substring(imageB64.indexOf(",") + 1)], // Send base64 data directly
                }
            ],
        };
        addLog('DEBUG', `Ollama Request to ${endpoint}`, requestBody);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            addLog('ERROR', `Ollama API Error (${response.status})`, errorBody);
            console.error("Ollama API Error Response:", errorBody);
            throw new Error(`Ollama API returned an error: ${response.status} ${response.statusText}. Check your server URL and ensure the model is running.`);
        }

        const responseData = await response.json();
        addLog('DEBUG', 'Ollama Raw Response:', responseData);
        
        // The JSON content is in the 'content' property of the message
        const jsonText = responseData.message.content;
        
        const parsedJson = JSON.parse(jsonText);
        const sanitizedJson = sanitizeAiResponse(parsedJson);
        addLog('INFO', 'Successfully parsed & sanitized Ollama response.', sanitizedJson);
        const parsedData = postProcessData(sanitizedJson);
        return { parsedData, rawResponse: jsonText };

    } catch (error) {
        addLog('ERROR', 'Ollama Request Error:', error);
        console.error("Ollama Request Error:", error);
        if (error instanceof TypeError) {
             throw new Error("Could not connect to the Ollama server. This is often a network or CORS issue. Please ensure: 1) The server is running. 2) The URL is correct. 3) CORS is enabled on the Ollama server (e.g., set OLLAMA_ORIGINS='*').");
        }
        if (error instanceof SyntaxError) {
            // This error is caught when JSON.parse fails
            throw new Error("Ollama returned invalid JSON. The model may not have followed instructions. Check the debug log.");
        }
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while communicating with Ollama.");
    }
};

export const fetchOllamaModels = async (url: string, addLog: Function): Promise<OllamaModel[]> => {
    if (!url) {
        throw new Error("Ollama URL is not provided.");
    }
    addLog('INFO', `Fetching models from Ollama at ${url}`);
    
    let endpoint: string;
    try {
        endpoint = getValidatedOllamaUrl(url, "/api/tags");
    } catch (error) {
        addLog('ERROR', 'Invalid Ollama URL in settings', { url, error });
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred during Ollama URL validation.");
    }

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            const errorBody = await response.text();
            addLog('ERROR', `Failed to fetch Ollama models (${response.status})`, errorBody);
            throw new Error(`Failed to fetch models: ${response.statusText}. The server responded with status ${response.status}.`);
        }
        const data = await response.json();
        addLog('DEBUG', 'Ollama models fetched successfully.', data.models);
        return data.models;
    } catch (error) {
        addLog('ERROR', 'Error fetching Ollama models:', error);
        console.error("Error fetching Ollama models:", error);
        if (error instanceof TypeError) { 
            throw new Error("Could not connect to the Ollama server. This is often a network or CORS issue. Please ensure: 1) The server is running. 2) The URL is correct. 3) CORS is enabled on the Ollama server (e.g., set OLLAMA_ORIGINS='*').");
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("An unexpected error occurred while fetching Ollama models. Check the debug log.");
    }
};


// --- Main Service Function ---

export const analyzeBill = async (imageB64: string, settings: AiSettings, addLog: Function): Promise<AnalysisResult> => {
    switch (settings.provider) {
        case 'gemini':
            return callGemini(imageB64, addLog);
        case 'ollama':
            // Ollama now uses the hybrid workflow
            return callOllama(imageB64, settings.ollamaUrl, settings.ollamaModel, addLog);
        default:
            const exhaustiveCheck: never = settings.provider;
            throw new Error(`Invalid AI provider: ${exhaustiveCheck}`);
    }
};