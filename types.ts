
export type AiProvider = 'gemini' | 'ollama';

export interface AiSettings {
    provider: AiProvider;
    ollamaUrl: string;
    ollamaModel: string;
}

export interface LineItem {
  description: string;
  amount: number;
}

export interface UsageByYear {
  year: string;
  value: number;
}

export interface UsageDataPoint {
  month: string;
  usage: UsageByYear[];
}

export interface UsageChartData {
  title: string;
  unit: string;
  data: UsageDataPoint[];
}

export interface VerificationQuestion {
  field: string; // e.g., "usageCharts.0.data.3.value" or "lineItems.2.amount"
  question: string;
}

export interface BillData {
  id: string;
  analyzedAt: string;
  accountName?: string;
  accountNumber: string;
  serviceAddress?: string;
  statementDate?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  totalCurrentCharges: number;
  dueDate?: string;
  usageCharts: UsageChartData[];
  lineItems: LineItem[];
  confidenceScore: number;
  confidenceReasoning: string;
  verificationQuestions?: VerificationQuestion[];
  rawResponse?: string;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export type LogEntry = {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'DEBUG';
  message: string;
  payload?: any;
};