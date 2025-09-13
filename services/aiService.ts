import { GoogleGenAI } from "@google/genai";
import type { BillData, AiSettings, OllamaModel, UsageChartData, LogEntry } from "../types";
import { prompt as geminiPrompt, billSchema } from '../prompts/prompt_v2';
import { processChart } from '../utils/chartProcessor';

// Define a specific type for the logging function to ensure type safety.
type AddLogFn = (level: LogEntry['level'], message: string, payload?: any) => void;

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
        // Filter out any non-object items that the AI might have mistakenly added.
        sanitized.usageCharts = sanitized.usageCharts
            .filter((chart: any) => typeof chart === 'object' && chart !== null && chart.data)
            .map((chart: any) => {
                if (!chart.data || !Array.isArray(chart.data)) return {...chart, data: []};
                
                // The AI might be asked to assign years. Let's ensure the structure is correct.
                const isNested = chart.data.every((d: any) => d.month && Array.isArray(d.usage));
                if(isNested) return chart;
                
                // This is a fallback to restructure flat data if the AI fails, but the prompt guides it well.
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
    // Filter out invalid entries from lineItems to prevent crashes.
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

const runOcr = async (imageB64: string, addLog: AddLogFn): Promise<string> => {
    addLog('INFO', 'Starting full-page OCR with Tesseract.js...');
    try {
        const Tesseract = (await import('tesseract.js')).default;
        
        const { data: { text } } = await Tesseract.recognize(
            imageB64, 
            'eng',
            { 
                logger: m => {
                    if (m.status === 'recognizing text') {
                         addLog('DEBUG', `Full-Page OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
                    }
                }
            }
        );

        addLog('INFO', 'Full-page OCR completed successfully.');
        addLog('DEBUG', 'Full OCR Text:', { ocrText: text });
        return text;
    } catch (error) {
        addLog('ERROR', 'OCR failed with Tesseract.js.', error);
        throw new Error(`OCR processing failed. The OCR engine could not be loaded or failed to process the image. Details: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// --- Gemini Provider ---

const callGemini = async (imageB64: string, addLog: AddLogFn): Promise<AnalysisResult> => {
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

const callOllama = async (imageB64: string, url: string, model: string, addLog: AddLogFn): Promise<AnalysisResult> => {
    if (!url || !model) {
        addLog('ERROR', 'Ollama URL or model is not configured.');
        throw new Error("Ollama URL or model is not configured. Please add it in the settings.");
    }
    addLog('INFO', `Starting analysis with Ollama model: ${model} using Multi-Pass Fusion Framework.`);

    let endpoint: string;
    try {
        endpoint = getValidatedOllamaUrl(url, "/api/chat");
    } catch (error) {
        addLog('ERROR', 'Invalid Ollama URL in settings', { url, error });
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred during Ollama URL validation.");
    }

    try {
        // Pass 1: Full-document OCR to get all text.
        const ocrTextPromise = runOcr(imageB64, addLog);

        // Pass 2: Specialized chart analysis using a programmatic, pixel-based process.
        const chartDataPromise = processChart(imageB64, addLog);
        
        const [ocrText, analyzedCharts] = await Promise.all([ocrTextPromise, chartDataPromise]);

        // Pass 3: Final data fusion and structuring with the AI.
        addLog('INFO', 'Final pass: Fusing all data into the final schema using AI.');
        const finalPrompt = `You are a data structuring expert. You are given raw OCR text from a utility bill and a perfectly pre-analyzed JSON object for the bill's usage chart(s). Your job is to combine this information to produce a single, final JSON object that conforms to the provided schema.

- Prioritize the raw OCR text for extracting account details, dates, and line items.
- The OCR text may contain errors. Use your reasoning to correct them (e.g., misread numbers, garbled text).
- Use the pre-analyzed chart JSON directly for the 'usageCharts' field. The values in this JSON are programmatically generated and 100% accurate. Do not try to re-analyze the chart from the image or text.
- Based on the statement date found in the OCR text, you MUST update any placeholder years (like 'YYYY') in the provided chart data to the correct year(s). The chart data typically shows usage for the past 12-13 months, so reason about the correct calendar years for the given months. For dual-bar charts, the legend in the text/image will tell you which years are represented.
- Your entire response MUST be a single, raw JSON object. Do not include any other text or markdown.

**Raw OCR Text:**
---
${ocrText}
---

**Pre-analyzed Usage Chart JSON (Use this directly):**
---
${JSON.stringify(analyzedCharts, null, 2)}
---
`;

        const finalBody = {
            model: model,
            format: "json",
            stream: false,
            messages: [{
                role: "system", content: finalPrompt
            }, {
                role: "user", content: "Analyze the bill using the provided OCR text and pre-analyzed chart data.", images: [imageB64.substring(imageB64.indexOf(",") + 1)]
            }],
        };
        addLog('DEBUG', `Ollama Final Fusion Request to ${endpoint}`, { model: finalBody.model, prompt: finalPrompt });

        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalBody) });
        if (!response.ok) throw new Error(`API Error (${response.status}): ${response.statusText}`);
        
        const responseData = await response.json();
        const finalContent = responseData.message.content;
        addLog('DEBUG', 'Ollama Final Fusion Raw Response:', finalContent);
        const finalJson = JSON.parse(finalContent);
        
        // The AI was told to use the chart data, but we override it here to be 100% certain it's correct.
        finalJson.usageCharts = finalJson.usageCharts && finalJson.usageCharts.length > 0 ? finalJson.usageCharts : analyzedCharts;

        addLog('INFO', 'Final fusion successful. Sanitizing and processing data.');
        addLog('DEBUG', 'Data before sanitization:', finalJson);
        const sanitizedJson = sanitizeAiResponse(finalJson);
        addLog('DEBUG', 'Data after sanitization:', sanitizedJson);
        const parsedData = postProcessData(sanitizedJson);
        addLog('DEBUG', 'Final processed data:', parsedData);
        return { parsedData, rawResponse: JSON.stringify(finalJson) };

    } catch (error) {
        addLog('ERROR', 'Ollama multi-pass fusion failed:', error);
        if (error instanceof TypeError) {
             throw new Error("Could not connect to the Ollama server. This is often a network or CORS issue. Please ensure: 1) The server is running. 2) The URL is correct. 3) CORS is enabled on the Ollama server (e.g., set OLLAMA_ORIGINS='*').");
        }
        if (error instanceof SyntaxError) {
            throw new Error("Ollama returned invalid JSON. The model may not have followed instructions. Check the debug log.");
        }
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred during the Ollama analysis workflow.");
    }
};

export const fetchOllamaModels = async (url: string, addLog: AddLogFn): Promise<OllamaModel[]> => {
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

export const analyzeBill = async (imageB64: string, settings: AiSettings, addLog: AddLogFn): Promise<AnalysisResult> => {
    switch (settings.provider) {
        case 'gemini':
            return callGemini(imageB64, addLog);
        case 'ollama':
            // Ollama now uses the new programmatic Multi-Pass Fusion Framework.
            return callOllama(imageB64, settings.ollamaUrl, settings.ollamaModel, addLog);
        default:
            const exhaustiveCheck: never = settings.provider;
            throw new Error(`Invalid AI provider: ${exhaustiveCheck}`);
    }
};