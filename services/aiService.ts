import { GoogleGenAI } from "@google/genai";
import type { BillData, AiSettings, OllamaModel } from "../types";
import { prompt as geminiPrompt, billSchema } from '../prompts/prompt_v2';
// Note: The hybrid prompt is no longer directly used by callOllama, but kept for reference
import { prompt as ollamaHybridPrompt } from '../prompts/prompt_ocr_hybrid';

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
        // FIX: Dynamically import Tesseract.js to prevent potential startup crashes.
        // The module is loaded on-demand, which also improves initial load time.
        const Tesseract = (await import('tesseract.js')).default;
        
        const { data: { text } } = await Tesseract.recognize(
            imageB64, 
            'eng',
            { 
                logger: m => {
                    // Log progress updates to the debug console
                    if (m.progress > 0 && m.progress < 1) {
                         addLog('DEBUG', `Tesseract.js: ${m.status}`, { progress: `${(m.progress * 100).toFixed(0)}%` });
                    }
                }
            }
        );

        addLog('INFO', 'OCR completed successfully.', { textLength: text.length });
        return text;
    } catch (error) {
        addLog('ERROR', 'OCR failed with Tesseract.js.', error);
        // FIX: Throw an error that can be caught by the UI to show a helpful message.
        throw new Error(`OCR processing failed. The OCR engine could not be loaded or failed to process the image. Details: ${error instanceof Error ? error.message : String(error)}`);
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

// Utility to generate a chart image for self-correction
const generateVerificationImage = (chartData: BillData['usageCharts'][0]): Promise<string> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; // Define a consistent size for the image
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve('');
            return;
        }

        // Simple white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render chart title
        ctx.fillStyle = '#000000';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(chartData.title, canvas.width / 2, 30);

        // Simple axis
        const xOffset = 50;
        const yOffset = 50;
        const chartWidth = canvas.width - xOffset * 2;
        const chartHeight = canvas.height - yOffset * 2;
        const maxVal = Math.max(1, ...chartData.data.flatMap(d => d.usage.map(u => u.value))); // Ensure maxVal is at least 1

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xOffset, yOffset);
        ctx.lineTo(xOffset, yOffset + chartHeight);
        ctx.lineTo(xOffset + chartWidth, yOffset + chartHeight);
        ctx.stroke();

        // Draw bars based on the provided data
        if (chartData.data.length > 0 && chartData.data[0].usage.length > 0) {
            const barWidth = chartWidth / (chartData.data.length * chartData.data[0].usage.length) - 5;
            chartData.data.forEach((monthData, monthIndex) => {
                monthData.usage.forEach((usageData, yearIndex) => {
                    const barHeight = (usageData.value / maxVal) * chartHeight;
                    const xPos = xOffset + (monthIndex * monthData.usage.length + yearIndex) * (barWidth + 5);
                    const yPos = yOffset + chartHeight - barHeight;

                    ctx.fillStyle = ['#38bdf8', '#a78bfa', '#fbbf24', '#f87171'][yearIndex % 4]; // Use a color
                    ctx.fillRect(xPos, yPos, barWidth, barHeight);

                    // Draw the value on top of the bar for explicit reference
                    ctx.fillStyle = '#000000';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(String(usageData.value), xPos + barWidth / 2, yPos - 5);
                });
            });
        }
        
        resolve(canvas.toDataURL('image/jpeg'));
    });
};

const callOllama = async (imageB64: string, url: string, model: string, addLog: Function): Promise<AnalysisResult> => {
    if (!url || !model) {
        addLog('ERROR', 'Ollama URL or model is not configured.');
        throw new Error("Ollama URL or model is not configured. Please add it in the settings.");
    }
    addLog('INFO', `Starting a two-pass analysis with Ollama model: ${model}`);

    const ocrText = await runOcr(imageB64, addLog);

    let endpoint: string;
    try {
        endpoint = getValidatedOllamaUrl(url, "/api/chat");
    } catch (error) {
        addLog('ERROR', 'Invalid Ollama URL in settings', { url, error });
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred during Ollama URL validation.");
    }

    // --- First Pass: Initial Extraction ---
    addLog('INFO', 'First pass: extracting initial data from the bill.');
    const firstPassPrompt = `You are an expert OCR system. Extract information from the provided image and raw OCR text, and return a single, raw JSON object that conforms to the schema.
    
Raw OCR Text:
${ocrText}
`;

    let firstPassResponse;
    try {
        const firstPassBody = {
            model: model,
            format: "json",
            stream: false,
            messages: [{ role: "system", content: firstPassPrompt }, { role: "user", content: "Analyze this bill image.", images: [imageB64.substring(imageB64.indexOf(",") + 1)] }],
        };
        addLog('DEBUG', `Ollama First Pass Request to ${endpoint}`, firstPassBody);
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(firstPassBody) });
        if (!response.ok) throw new Error(`API Error (${response.status}): ${response.statusText}`);
        const responseData = await response.json();
        firstPassResponse = JSON.parse(responseData.message.content);
        addLog('DEBUG', 'First Pass Response:', firstPassResponse);
    } catch (error) {
        addLog('ERROR', 'First pass failed:', error);
        throw new Error("Initial analysis failed. The model may not have followed instructions. Check the debug log for details.");
    }

    // --- Generate Verification Image from First Pass Data ---
    if (!firstPassResponse.usageCharts || firstPassResponse.usageCharts.length === 0) {
        addLog('INFO', 'No usage charts found in the first pass. Skipping self-correction and returning initial data.');
        const parsedData = postProcessData(sanitizeAiResponse(firstPassResponse));
        return { parsedData, rawResponse: JSON.stringify(firstPassResponse) };
    }

    const verificationChartImage = await generateVerificationImage(firstPassResponse.usageCharts[0]);
    addLog('INFO', 'Generated verification image from first pass data.');

    // --- Second Pass: Guided Correction ---
    addLog('INFO', 'Second pass: self-correcting using the verification image.');
    const secondPassPrompt = `You are an expert OCR system. I have two images:
1.  The original utility bill.
2.  A verification image that visualizes the chart data you previously extracted.

Your task is to compare the chart in the original image with the data points shown in the verification image. If you find any discrepancies, correct the chart data and provide a new, corrected JSON object. If the data is correct, return the original JSON.

Original Bill Image vs. Verification Chart Image: Analyze both to ensure the data is accurate.

Original Data to be Verified:
${JSON.stringify(firstPassResponse, null, 2)}
`;

    try {
        const secondPassBody = {
            model: model,
            format: "json",
            stream: false,
            messages: [{
                role: "system", content: secondPassPrompt
            }, {
                role: "user", content: "Compare and correct the data.", images: [imageB64.substring(imageB64.indexOf(",") + 1), verificationChartImage.substring(verificationChartImage.indexOf(",") + 1)]
            }],
        };
        addLog('DEBUG', `Ollama Second Pass Request to ${endpoint}`, secondPassBody);

        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(secondPassBody) });
        if (!response.ok) throw new Error(`API Error (${response.status}): ${response.statusText}`);
        const responseData = await response.json();
        const finalJson = JSON.parse(responseData.message.content);
        
        addLog('INFO', 'Second pass successful. Final data:', finalJson);
        const sanitizedJson = sanitizeAiResponse(finalJson);
        const parsedData = postProcessData(sanitizedJson);
        return { parsedData, rawResponse: JSON.stringify(finalJson) };

    } catch (error) {
        addLog('ERROR', 'Second pass failed:', error);
        if (error instanceof TypeError) {
             throw new Error("Could not connect to the Ollama server. This is often a network or CORS issue. Please ensure: 1) The server is running. 2) The URL is correct. 3) CORS is enabled on the Ollama server (e.g., set OLLAMA_ORIGINS='*').");
        }
        if (error instanceof SyntaxError) {
            throw new Error("Ollama returned invalid JSON during self-correction. The model may not have followed instructions. Check the debug log.");
        }
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred during the self-correction phase.");
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
            // Ollama now uses the two-pass iterative workflow
            return callOllama(imageB64, settings.ollamaUrl, settings.ollamaModel, addLog);
        default:
            const exhaustiveCheck: never = settings.provider;
            throw new Error(`Invalid AI provider: ${exhaustiveCheck}`);
    }
};
