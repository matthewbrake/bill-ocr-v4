
import { Type } from "@google/genai";

// This is the original prompt, kept for historical purposes.
// The app is now using prompt_v2.ts

export const billSchema = {
  type: Type.OBJECT,
  properties: {
    accountName: { type: Type.STRING, description: "Account holder's full name, if available." },
    accountNumber: { type: Type.STRING, description: "The account number." },
    serviceAddress: { type: Type.STRING, description: "The full service address, if available." },
    statementDate: { type: Type.STRING, description: "The main date of the bill statement (e.g., 'October 5, 2017')." },
    servicePeriodStart: { type: Type.STRING, description: "The start date of the service period, if available (e.g., 'MM/DD/YYYY')." },
    servicePeriodEnd: { type: Type.STRING, description: "The end date of the service period, if available (e.g., 'MM/DD/YYYY')." },
    totalCurrentCharges: { type: Type.NUMBER, description: "The total amount due for the current period." },
    dueDate: { type: Type.STRING, description: "The payment due date, if available." },
    confidenceScore: { type: Type.NUMBER, description: "A score from 0.0 to 1.0 representing your confidence in the extracted data's accuracy. 1.0 is highest confidence." },
    confidenceReasoning: { type: Type.STRING, description: "A detailed explanation for the confidence score. Mention specific issues like blurriness, glare, unusual formatting, or hard-to-read sections. Be specific about which parts of the bill were problematic." },
    usageCharts: {
      type: Type.ARRAY, description: "An array of all usage charts found on the bill.",
      items: {
        type: Type.OBJECT, properties: {
          title: { type: Type.STRING, description: "The title of the chart." },
          unit: { type: Type.STRING, description: "The unit of measurement for the usage (e.g., kWh, Therms, m³)." },
          data: {
            type: Type.ARRAY, description: "The monthly data points from the chart.",
            items: {
              type: Type.OBJECT, properties: {
                month: { type: Type.STRING, description: "Abbreviated month name (e.g., Oct, Nov)." },
                usage: {
                    type: Type.ARRAY, description: "Usage values for each year shown in the chart.",
                    items: {
                        type: Type.OBJECT, properties: {
                            year: { type: Type.STRING, description: "The year of the usage value." },
                            value: { type: Type.NUMBER, description: "The numerical usage value for that year." }
                        }, required: ["year", "value"]
                    }
                },
              }, required: ["month", "usage"],
            },
          },
        }, required: ["title", "unit", "data"],
      },
    },
    lineItems: {
        type: Type.ARRAY, description: "All individual line items from the charges/details section.",
        items: {
            type: Type.OBJECT, properties: {
                description: { type: Type.STRING, description: "The description of the charge or credit." },
                amount: { type: Type.NUMBER, description: "The corresponding amount. Use negative numbers for payments or credits." },
            }, required: ["description", "amount"],
        }
    },
    verificationQuestions: {
        type: Type.ARRAY, description: "If you are uncertain about a specific value due to blurriness or ambiguity, create a question for the user to verify it. Only create questions for critical data points you are unsure about.",
        items: {
            type: Type.OBJECT, properties: {
                field: { type: Type.STRING, description: "A dot-notation path to the uncertain field (e.g., 'usageCharts.0.data.3.usage.0.value')." },
                question: { type: Type.STRING, description: "A clear, simple question for the user (e.g., 'Is the usage for Sep 2017 approximately 120 kWh? The bar is blurry.')." }
            }, required: ["field", "question"]
        }
    }
  },
  required: ["accountNumber", "totalCurrentCharges", "usageCharts", "lineItems", "confidenceScore", "confidenceReasoning"],
};

export const prompt = `You are a world-class OCR system specializing in analyzing utility bills from any provider worldwide. Your mission is to extract detailed information from the provided bill image with extreme accuracy, even if the image quality is poor (blurry, skewed, low light).

**Core Instructions:**
1.  **Analyze Image**: Scrutinize the provided utility bill image.
2.  **Strict JSON Output**: Your entire response MUST be a single, raw JSON object that conforms to the provided schema. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
3.  **Chart Data Extraction (Crucial)**: Bar charts often show usage for multiple years for the same month. You MUST extract the data for each year. For each month, the 'usage' property must be an array of objects, one for each year.
    **Example of correct nested structure for a single month:**
    \`\`\`json
    {
      "month": "Oct",
      "usage": [
        { "year": "2016", "value": 1400 },
        { "year": "2017", "value": 1350 }
      ]
    }
    \`\`\`
4.  **Value Estimation**: If bar charts are present, meticulously estimate the values from the bar heights relative to the y-axis, even if exact numbers aren't printed on the bars.
5.  **Confidence Assessment**: Provide a \`confidenceScore\` (0.0-1.0) and a detailed \`confidenceReasoning\`. Be explicit about what parts of the image (e.g., "the line items section", "the top-right corner with the date") were difficult to read and why (e.g., "due to a camera flash glare", "text is pixelated").
6.  **User Verification**: If you are uncertain about any specific, critical data point (like a charge amount or a usage bar), generate a clear \`verificationQuestions\` item for it. Use the correct nested path for the field (e.g., 'usageCharts.0.data.3.usage.0.value').
7.  **Completeness**: Ensure every required field in the schema is present. If an optional field (like \`accountName\`) is not found, omit it from the final JSON.`;
