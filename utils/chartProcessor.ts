import Tesseract from 'tesseract.js';
import type { LogEntry, UsageChartData } from '../types';

type AddLogFn = (level: LogEntry['level'], message: string, payload?: any) => void;

interface OcrWord {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number; };
    confidence: number;
}

interface ChartCandidate {
    id: number;
    months: OcrWord[];
    yAxis: OcrWord[];
    legend: OcrWord[];
    title: OcrWord[];
    unit?: OcrWord;
    bounds: { x0: number, y0: number, x1: number, y1: number };
}

// --- Text Classification and Filtering ---

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const isMonth = (word: OcrWord) => {
    const cleanText = word.text.toLowerCase().replace(/[^a-z]/g, '');
    return MONTHS.some(m => m.startsWith(cleanText));
};
const isNumber = (word: OcrWord) => !isNaN(parseFloat(word.text.replace(/,/g, '')));
const isYear = (word: OcrWord) => /^\d{4}$/.test(word.text);
const isUnit = (word: OcrWord) => ['kwh', 'm³', 'therms'].includes(word.text.toLowerCase());


// --- Geometric Analysis Utilities ---

const getCenter = (bbox: OcrWord['bbox']) => ({
    x: (bbox.x0 + bbox.x1) / 2,
    y: (bbox.y0 + bbox.y1) / 2
});

const isHorizontallyAligned = (word1: OcrWord, word2: OcrWord, tolerance = 10) => {
    const y1 = getCenter(word1.bbox).y;
    const y2 = getCenter(word2.bbox).y;
    return Math.abs(y1 - y2) < tolerance;
};

const isVerticallyAligned = (word1: OcrWord, word2: OcrWord, tolerance = 15) => {
    const x1 = getCenter(word1.bbox).x;
    const x2 = getCenter(word2.bbox).x;
    return Math.abs(x1 - x2) < tolerance;
};

const distance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Dynamically finds and clusters chart-related text elements using geometric analysis.
 */
const findChartCandidates = (words: OcrWord[], addLog: AddLogFn): ChartCandidate[] => {
    addLog('DEBUG', 'Starting dynamic chart candidate discovery...');
    const potentialMonths = words.filter(isMonth).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const potentialYAxis = words.filter(isNumber).sort((a, b) => b.bbox.y0 - a.bbox.y0);
    const potentialLegends = words.filter(isYear);
    const potentialUnits = words.filter(isUnit);

    const candidates: ChartCandidate[] = [];
    let chartId = 0;

    // Find groups of horizontally aligned months, which are strong indicators of a chart's x-axis.
    for (let i = 0; i < potentialMonths.length; i++) {
        const monthGroup = [potentialMonths[i]];
        for (let j = i + 1; j < potentialMonths.length; j++) {
            if (isHorizontallyAligned(potentialMonths[i], potentialMonths[j])) {
                monthGroup.push(potentialMonths[j]);
            }
        }

        if (monthGroup.length > 3 && !candidates.some(c => c.months.includes(monthGroup[0]))) {
            const sortedMonths = monthGroup.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            const avgY = sortedMonths.reduce((sum, m) => sum + getCenter(m.bbox).y, 0) / sortedMonths.length;
            const minX = sortedMonths[0].bbox.x0;
            const maxX = sortedMonths[sortedMonths.length - 1].bbox.x1;

            // Find associated Y-axis labels (vertically aligned, to the left of the months)
            const associatedYAxis = potentialYAxis.filter(y =>
                isVerticallyAligned(y, sortedMonths[0], 30) && y.bbox.x1 < minX
            );

            if (associatedYAxis.length > 1) {
                const bounds = {
                    x0: associatedYAxis[0].bbox.x0,
                    y0: associatedYAxis[associatedYAxis.length-1].bbox.y0,
                    x1: maxX,
                    y1: avgY,
                };
                
                // Find legend and unit within a reasonable distance of the chart area
                const chartCenter = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
                const associatedLegend = potentialLegends.filter(l => distance(getCenter(l.bbox), chartCenter) < 300);
                const associatedUnit = potentialUnits.find(u => distance(getCenter(u.bbox), {x: bounds.x0, y: chartCenter.y}) < 100);

                candidates.push({
                    id: chartId++,
                    months: sortedMonths,
                    yAxis: associatedYAxis,
                    legend: associatedLegend.sort((a,b) => a.bbox.x0 - b.bbox.x0),
                    title: [], // Title detection can be added here
                    unit: associatedUnit,
                    bounds,
                });
            }
        }
    }
    
    addLog('INFO', `Found ${candidates.length} potential chart(s) on the page.`, candidates);
    return candidates;
};

// --- Pixel Analysis for Bar Detection ---

const isDarkPixel = (data: Uint8ClampedArray, index: number): boolean => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return r < 240 && g < 240 && b < 240; // Simple threshold for non-white
};

const detectBarsForChart = async (
    imageB64: string,
    chart: ChartCandidate,
    addLog: AddLogFn
): Promise<UsageChartData> => {
    addLog('INFO', `Starting programmatic bar detection for Chart ${chart.id}.`);
    
    const img = new Image();
    await new Promise(resolve => { img.onload = resolve; img.src = imageB64; });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get canvas context.");
    ctx.drawImage(img, 0, 0);

    // Calculate Y-Axis scale
    const yValues = chart.yAxis.map(v => ({
        value: parseInt(v.text.replace(/,/g, ''), 10),
        y: getCenter(v.bbox).y
    })).filter(v => !isNaN(v.value)).sort((a, b) => a.value - b.value);
    
    if (yValues.length < 2) throw new Error(`Chart ${chart.id} has insufficient Y-axis labels.`);
    
    const yMin = yValues[0];
    const yMax = yValues[yValues.length - 1];
    const pixelRange = Math.abs(yMin.y - yMax.y);
    const valueRange = yMax.value - yMin.value;
    const valuePerPixel = valueRange / pixelRange;
    const zeroLineY = yMin.value === 0 ? yMin.y : yMax.y + ((yMax.value / valueRange) * pixelRange);
    
    addLog('DEBUG', `Chart ${chart.id} Y-axis scale calculated`, { yMin, yMax, valuePerPixel, zeroLineY });
    
    const chartArea = {
        x0: chart.months[0].bbox.x0,
        y0: yMax.y,
        x1: chart.months[chart.months.length - 1].bbox.x1,
        y1: zeroLineY
    };
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const years = chart.legend.map(l => l.text);
    const numYears = Math.max(1, years.length);

    const usageData: UsageChartData['data'] = [];

    for (const month of chart.months) {
        const monthCenter = getCenter(month.bbox);
        const barWidthGuess = (month.bbox.x1 - month.bbox.x0) / numYears;
        const monthUsage: { year: string, value: number }[] = [];

        for (let i = 0; i < numYears; i++) {
            const scanX = Math.round(month.bbox.x0 + (i * barWidthGuess) + (barWidthGuess / 2));
            let barTopY = -1;

            for (let y = Math.floor(zeroLineY); y > chartArea.y0; y--) {
                const pixelIndex = (y * canvas.width + scanX) * 4;
                if (isDarkPixel(imageData.data, pixelIndex)) {
                    barTopY = y;
                    break;
                }
            }

            const year = years[i] || `Year ${i+1}`;
            if (barTopY !== -1) {
                const pixelHeight = zeroLineY - barTopY;
                const value = Math.round(pixelHeight * valuePerPixel);
                monthUsage.push({ year, value });
                addLog('DEBUG', `Detected bar for ${month.text} ${year}`, { scanX, barTopY, value });
            } else {
                monthUsage.push({ year, value: 0 });
            }
        }
        usageData.push({ month: month.text, usage: monthUsage });
    }

    return {
        title: chart.title.map(t => t.text).join(' ') || `Usage Chart ${chart.id}`,
        unit: chart.unit?.text || 'Units',
        data: usageData,
    };
};

// --- Main Exported Function ---

export const processChart = async (imageB64: string, addLog: AddLogFn): Promise<UsageChartData[]> => {
    addLog('INFO', 'Starting advanced programmatic chart processing v2.1...');
    
    const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => addLog('DEBUG', `Chart OCR Progress: ${m.status} (${(m.progress * 100).toFixed(0)}%)`),
    });
    
    try {
        // Pass 1: Full-page OCR to get all text geometry
        const { data } = await worker.recognize(imageB64);
        // FIX: Property 'lines' does not exist on type 'Page'. This was causing a type error.
        // Traversing the full block -> paragraph -> line hierarchy is more robust across Tesseract.js versions
        // and handles cases where top-level properties might be missing from the type definitions.
        const words = (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => (p.lines || []).flatMap(l => l.words || [])));
        const allWords: OcrWord[] = words.map(w => ({
            text: w.text,
            bbox: w.bbox,
            confidence: w.confidence
        }));
        addLog('DEBUG', `Chart processor OCR complete. Found ${allWords.length} words.`);

        // Pass 2: Find chart candidates
        const candidates = findChartCandidates(allWords, addLog);
        if (candidates.length === 0) {
            addLog('INFO', 'No chart candidates found on the page.');
            return [];
        }

        // Pass 3: Process each candidate
        const processedCharts: UsageChartData[] = [];
        for (const candidate of candidates) {
            try {
                const chartData = await detectBarsForChart(imageB64, candidate, addLog);
                processedCharts.push(chartData);
            } catch (e) {
                addLog('ERROR', `Failed to process chart candidate ${candidate.id}`, e);
            }
        }
        
        addLog('INFO', `Programmatic chart analysis successful. Extracted ${processedCharts.length} chart(s).`, processedCharts);
        return processedCharts;

    } catch(error) {
        addLog('ERROR', 'The chart processing engine failed.', error);
        // Return empty array on failure so the rest of the app doesn't crash.
        return [];
    }
    finally {
        await worker.terminate();
    }
};