
import type { BillData, UsageChartData } from '../types';

function downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const escapeCsvCell = (cell: any): string => {
    const cellStr = String(cell ?? '');
    if (/[",\n\r]/.test(cellStr)) {
        return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
};

export const exportLineItemsToCsv = (billData: BillData) => {
    const headers = ['Description', 'Amount'];
    const rows = billData.lineItems.map(item => [item.description, item.amount]);
    
    let csvContent = headers.map(escapeCsvCell).join(',') + '\r\n';
    rows.forEach(row => {
        csvContent += row.map(escapeCsvCell).join(',') + '\r\n';
    });
    
    downloadCSV(csvContent, `line-items-${billData.accountNumber}-${billData.statementDate}.csv`);
};

export const exportUsageDataToCsv = (chart: UsageChartData) => {
    const years = Array.from(new Set(chart.data.flatMap(d => d.usage.map(u => u.year)))).sort();
    const headers = ['Month', ...years.map(y => `${chart.unit} ${y}`)];

    const rows = chart.data.map(dataPoint => {
        const row: (string | number)[] = [dataPoint.month];
        years.forEach(year => {
            const usageForYear = dataPoint.usage.find(u => u.year === year);
            row.push(usageForYear ? usageForYear.value : '');
        });
        return row;
    });

    let csvContent = headers.map(escapeCsvCell).join(',') + '\r\n';
    rows.forEach(row => {
        csvContent += row.map(escapeCsvCell).join(',') + '\r\n';
    });
    
    downloadCSV(csvContent, `usage-data-${chart.title.replace(/\s+/g, '_')}.csv`);
};
