import Tesseract from 'tesseract.js';
import type { LogEntry, UsageChartData } from '../types';

type AddLogFn = (level: LogEntry['level'], message: string, payload?: any) => void;

interface OcrWord {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number; };
}

// These bounding box coordinates are fine-tuned for the PECO bill example (825x1066px).
// They define specific regions for targeted OCR to improve accuracy.
const CHART_REGIONS = {
    yAxis: { top: 500, left: 75, width: 35, height: 200 },
    months: { top: 705, left: 160, width: 520, height: 20 },
    barChartArea: { top: 500, left: 160, width: 520, height: 200 }
};

/**
 * Checks if a pixel from a canvas's ImageData is dark (i.e., not background).
 * @param data The Uint8ClampedArray from getImageData.
 * @param index The starting index of the pixel's RGBA values.
 * @returns True if the pixel is not white or near-white.
 */
const isDarkPixel = (data: Uint8ClampedArray, index: number): boolean => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    // Simple threshold check for non-white pixels.
    return r < 240 && g < 240 && b < 240;
};

/**
 * Programmatically detects the height of bars in the chart area.
 * @param imageB64 The base64 encoded string of the full bill image.
 * @param months An array of month words with their bounding boxes.
 * @param yAxisValues An array of Y-axis value words with their bounding boxes.
 * @param addLog The logging function.
 * @returns An array of numbers representing the calculated value of each bar.
 */
const detectBars = async (
    imageB64: string,
    months: OcrWord[],
    yAxisValues: OcrWord[],
    addLog: AddLogFn
): Promise<number[]> => {
    addLog('INFO', 'Starting programmatic bar detection by analyzing image pixels.');
    
    // --- 1. Set up canvas and image ---
    const img = new Image();
    await new Promise(resolve => { img.onload = resolve; img.src = imageB64; });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get canvas context for bar detection.");
    ctx.drawImage(img, 0, 0);

    // --- 2. Calculate the Y-Axis scale (value per pixel) ---
    const yValues = yAxisValues.map(v => ({
        value: parseInt(v.text.replace(/,/g, ''), 10),
        y: v.bbox.y0
    })).filter(v => !isNaN(v.value));

    if (yValues.length < 2) {
        addLog('ERROR', 'Could not determine chart scale. Need at least two Y-axis values.');
        throw new Error("Chart analysis failed: Insufficient Y-axis data from OCR.");
    }

    const sortedY = [...yValues].sort((a, b) => a.value - b.value);
    const yMin = sortedY[0];
    const yMax = sortedY[sortedY.length - 1];

    const pixelRange = Math.abs(yMin.y - yMax.y);
    const valueRange = yMax.value - yMin.value;
    const valuePerPixel = valueRange / pixelRange;
    const baselineY = yMin.y; // The Y-coordinate for the '0' value line.

    addLog('DEBUG', 'Calculated Y-axis scale', { yMin, yMax, valuePerPixel });

    // --- 3. Detect bar heights ---
    const barValues: number[] = [];
    const { top, left, width, height } = CHART_REGIONS.barChartArea;
    const imageData = ctx.getImageData(left, top, width, height);

    for (const month of months) {
        // Center of the month's text is our scanline
        const scanX = Math.round(month.bbox.x0 + (month.bbox.x1 - month.bbox.x0) / 2);
        // Adjust to be relative to the cropped barChartArea
        const relativeScanX = scanX - left;

        let barTopY = -1;
        // Scan vertically upwards from the baseline
        for (let y = height - 1; y >= 0; y--) {
            const pixelIndex = (y * width + relativeScanX) * 4;
            if (isDarkPixel(imageData.data, pixelIndex)) {
                barTopY = y + top; // Convert back to full image coordinate
                break;
            }
        }

        if (barTopY !== -1) {
            const pixelHeight = baselineY - barTopY;
            const calculatedValue = Math.round(pixelHeight * valuePerPixel);
            barValues.push(calculatedValue);
            addLog('DEBUG', `Detected bar for month: ${month.text}`, { scanX, barTopY, pixelHeight, calculatedValue });
        } else {
            barValues.push(0); // Assume 0 if no bar is found
            addLog('DEBUG', `No bar found for month: ${month.text}. Assuming value 0.`);
        }
    }

    addLog('INFO', 'Programmatic bar detection complete.');
    return barValues;
};


/**
 * The main chart processing function. It orchestrates targeted OCR and programmatic
 * bar detection to extract chart data without LLM visual interpretation.
 * @param imageB64 The base64 encoded string of the full bill image.
 * @param addLog The logging function.
 * @returns A promise resolving to a structured UsageChartData object.
 */
export const processChart = async (imageB64: string, addLog: AddLogFn): Promise<UsageChartData> => {
    addLog('INFO', 'Starting programmatic chart processing...');
    
    // FIX: A Tesseract worker is needed to perform OCR on a specific region of an image.
    const worker = await Tesseract.createWorker('eng');
    try {
        // --- Pass 1: Targeted OCR on Chart Regions ---
        addLog('DEBUG', 'Performing targeted OCR on Y-Axis & Months...');
        // FIX: The `rectangle` option is part of the second argument in `worker.recognize`.
        const ocrPromises = [
            worker.recognize(imageB64, { rectangle: CHART_REGIONS.yAxis }),
            worker.recognize(imageB64, { rectangle: CHART_REGIONS.months })
        ];
        const [yAxisResult, monthsResult] = await Promise.all(ocrPromises);

        // FIX: The 'words' property may not be directly on 'data' depending on the type definitions.
        // Accessing words via flat-mapping the 'lines' array is more robust.
        const yAxisValues = yAxisResult.data.lines.flatMap(l => l.words).map(w => ({ text: w.text.trim(), bbox: w.bbox }));
        const months = monthsResult.data.lines.flatMap(l => l.words).map(w => ({ text: w.text.trim(), bbox: w.bbox }));
        
        addLog('DEBUG', 'Targeted OCR complete.', { yAxisValues: yAxisValues.map(v=>v.text), months: months.map(m=>m.text) });
        
        if (months.length === 0 || yAxisValues.length < 2) {
            addLog('ERROR', 'Initial OCR failed to find critical chart elements (months or y-axis).');
            throw new Error("Chart analysis failed: Could not read the chart's axes.");
        }
        
        // --- Pass 2: Programmatic Bar Detection ---
        const barValues = await detectBars(imageB64, months, yAxisValues, addLog);

        // --- Pass 3: Data Fusion ---
        // The statement date from the main bill is needed to figure out the years for the months.
        // The final assembly LLM will handle this. We will just assign a placeholder year for now.
        // This makes the structure correct for the LLM to populate.
        const chartData: UsageChartData = {
            title: '13-Month Usage (Total kWh)', // This is specific to the PECO bill. A more advanced solution might OCR this too.
            unit: 'kWh',
            data: months.map((month, index) => ({
                month: month.text,
                usage: [{
                    year: 'YYYY', // Placeholder year
                    value: barValues[index] || 0
                }]
            }))
        };
        
        addLog('INFO', 'Programmatic chart analysis successful.', chartData);
        return chartData;
    } finally {
        // FIX: Always terminate the worker to release resources.
        await worker.terminate();
    }
};
