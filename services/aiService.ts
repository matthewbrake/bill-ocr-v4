import { GoogleGenAI } from "@google/genai";
import type { BillData, AiSettings, OllamaModel, UsageChartData, LogEntry } from "../types";
import { prompt as geminiPrompt, billSchema } from '../prompts/prompt_v2';

// FIX: Define a specific type for the logging function to ensure type safety.
type AddLogFn = (level: LogEntry['level'], message: string, payload?: any) => void;

// --- Chart Analysis Framework (New for Ollama) ---

/**
 * Crops the bottom 60% of the image, where charts are typically located.
 * @param imageB64 The base64 encoded image string.
 * @returns A promise that resolves with the base64 encoded string of the cropped image.
 */
// FIX: Correctly type the addLog parameter.
const cropToChartArea = async (imageB64: string, addLog: AddLogFn): Promise<string> => {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageB64;
    });

    const cropY = img.height * 0.4;
    const cropHeight = img.height * 0.6;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context for cropping.");
    
    ctx.drawImage(img, 0, cropY, img.width, cropHeight, 0, 0, img.width, cropHeight);
    addLog('DEBUG', 'Cropped image to chart area.', { originalHeight: img.height, newHeight: cropHeight });
    return canvas.toDataURL('image/png');
};

/**
 * Performs OCR on the chart area to get text elements with their coordinates.
 * This helps the LLM to spatially understand the chart layout.
 * @param chartImage The Tesseract.ImageLike object for the chart area.
 * @param addLog The logging function.
 * @returns A string containing structured text and coordinate data.
 */
// FIX: Correctly type the addLog parameter.
const getOcrTextWithCoordsFromChart = async (chartImageB64: string, addLog: AddLogFn): Promise<string> => {
    addLog('DEBUG', 'Performing targeted OCR on chart area to extract text with coordinates...');
    const Tesseract = (await import('tesseract.js')).default;
    const { data: { words } } = await Tesseract.recognize(chartImageB64, 'eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                 addLog('DEBUG', `Chart OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
            }
        }
    });
    
    const structuredText = words.map(w => `"${w.text.trim()}" at (x: ${w.bbox.x0}, y: ${w.bbox.y0})`).join('; ');
    addLog('INFO', 'Targeted chart OCR complete.', { wordCount: words.length });
    return structuredText;
};

/**
 * This is the core function for the new chart analysis workflow.
 * It combines targeted OCR with a specialized LLM call to extract chart data.
 * @param imageB64 The full bill image.
 * @param ollamaUrl The URL for the Ollama server.
 * @param ollamaModel The model to use.
 * @param addLog The logging function.
 * @returns A promise that resolves to an array of extracted chart data.
 */
// FIX: Correctly type the addLog parameter.
const analyzeChartData = async (
    imageB64: string,
    ollamaUrl: string,
    ollamaModel: string,
    addLog: AddLogFn,
): Promise<UsageChartData[]> => {
    addLog('INFO', 'Starting chart analysis with data fusion framework.');

    // Pass 1: Crop image to focus on the chart area.
    const chartImageB64 = await cropToChartArea(imageB64, addLog);

    // Pass 2: Perform targeted OCR on the cropped chart area.
    const ocrData = await getOcrTextWithCoordsFromChart(chartImageB64, addLog);

    // Pass 3: Use an LLM to fuse the visual chart image with the OCR coordinate data.
    addLog('INFO', 'Fusing OCR data with visual analysis using Ollama.');
    const fusionPrompt = `You are a data analysis expert. You are given an image of a bar chart area and structured OCR data from that image. Your task is to interpret the chart and return ONLY a raw JSON object containing an array of all charts found.

The OCR data provides text and its (x,y) coordinates. Use these to identify the months on the x-axis, the scale on the y-axis, and the years in the legend.
Then, visually analyze the image to estimate the height of each bar. Correlate the bar's x-position with the month labels from the OCR data. Correlate the bar's color (if discernible) with the legend.

Your output must be a JSON object with a single key "usageCharts", which is an array. Each element in the array should follow this structure: { "title": "...", "unit": "...", "data": [{ "month": "...", "usage": [{ "year": "...", "value": ... }] }] }

Here is the OCR data from the chart area:
${ocrData}
`;
    
    const endpoint = new URL("/api/chat", ollamaUrl).toString();
    const body = {
        model: ollamaModel,
        format: "json",
        stream: false,
        messages: [{
            role: "system", content: fusionPrompt
        }, {
            role: "user", content: "Analyze this chart image and its corresponding OCR data.", images: [chartImageB64.substring(chartImageB64.indexOf(",") + 1)]
        }],
    };
    addLog('DEBUG', 'Ollama Chart Fusion Request:', { url: endpoint, model: ollamaModel, prompt: fusionPrompt });

    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
        const errorBody = await response.text();
        addLog('ERROR', `Chart Fusion API Error (${response.status})`, { errorBody });
        throw new Error(`Chart Fusion analysis failed with status ${response.status}.`);
    }
    const responseData = await response.json();
    const fusedJson = JSON.parse(responseData.message.content);
    
    if (!fusedJson.usageCharts || !Array.isArray(fusedJson.usageCharts)) {
        addLog('ERROR', 'Chart fusion result is missing or has an invalid "usageCharts" array.', fusedJson);
        throw new Error("Chart analysis failed: The AI's response did not contain the expected 'usageCharts' data structure.");
    }
    
    addLog('INFO', 'Chart data fused successfully.', fusedJson.usageCharts);
    return fusedJson.usageCharts;
};


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

// FIX: Correctly type the addLog parameter.
const runOcr = async (imageB64: string, addLog: AddLogFn): Promise<string> => {
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

// FIX: Correctly type the addLog parameter.
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

// FIX: Correctly type the addLog parameter.
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
        const ocrText = await runOcr(imageB64, addLog);

        // Pass 2: Specialized chart analysis using a multi-step fusion process.
        const analyzedCharts = await analyzeChartData(imageB64, url, model, addLog);

        // Pass 3: Final data fusion and structuring.
        addLog('INFO', 'Final pass: Fusing all data into the final schema.');
        const finalPrompt = `You are a data structuring expert. You are given raw OCR text from a utility bill, a pre-analyzed JSON object for the bill's usage charts, and the original image. Your job is to combine this information to produce a single, final JSON object that conforms to the provided schema.

- Prioritize the raw OCR text for extracting account details, dates, and line items.
- Use the pre-analyzed chart JSON directly for the 'usageCharts' field. Do not try to re-analyze the charts from the image.
- Refer to the image only if necessary to resolve ambiguities in the OCR text for non-chart elements.
- Your entire response MUST be a single, raw JSON object. Do not include any other text or markdown.

**Raw OCR Text:**
---
${ocrText}
---

**Pre-analyzed Usage Chart JSON:**
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
                role: "user", content: "Analyze the bill using the provided OCR text and chart data.", images: [imageB64.substring(imageB64.indexOf(",") + 1)]
            }],
        };
        addLog('DEBUG', `Ollama Final Fusion Request to ${endpoint}`, { model: finalBody.model, prompt: finalPrompt });

        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalBody) });
        if (!response.ok) throw new Error(`API Error (${response.status}): ${response.statusText}`);
        
        const responseData = await response.json();
        const finalContent = responseData.message.content;
        addLog('DEBUG', 'Ollama Final Fusion Raw Response:', finalContent);
        const finalJson = JSON.parse(finalContent);
        
        // The AI was given the chart data, but we can override it just in case it hallucinated.
        finalJson.usageCharts = analyzedCharts;

        addLog('INFO', 'Final fusion successful. Sanitizing and processing data.', finalJson);
        const sanitizedJson = sanitizeAiResponse(finalJson);
        const parsedData = postProcessData(sanitizedJson);
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


// FIX: Correctly type the addLog parameter.
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

// FIX: Correctly type the addLog parameter.
export const analyzeBill = async (imageB64: string, settings: AiSettings, addLog: AddLogFn): Promise<AnalysisResult> => {
    switch (settings.provider) {
        case 'gemini':
            return callGemini(imageB64, addLog);
        case 'ollama':
            // Ollama now uses the new Multi-Pass Fusion Framework.
            return callOllama(imageB64, settings.ollamaUrl, settings.ollamaModel, addLog);
        default:
            const exhaustiveCheck: never = settings.provider;
            throw new Error(`Invalid AI provider: ${exhaustiveCheck}`);
    }
};