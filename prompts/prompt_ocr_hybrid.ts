import { Type } from "@google/genai";

// This prompt is specifically for a hybrid workflow, where we provide both the image and raw OCR text.

export const billSchema = {
  type: Type.OBJECT,
  properties: {
    accountName: { type: Type.STRING, description: "Account holder's full name." },
    accountNumber: { type: Type.STRING, description: "The account number." },
    serviceAddress: { type: Type.STRING, description: "The full service address." },
    statementDate: { type: Type.STRING, description: "The main date of the bill statement (e.g., 'October 5, 2017')." },
    servicePeriodStart: { type: Type.STRING, description: "The start date of the service period (e.g., 'MM/DD/YYYY')." },
    servicePeriodEnd: { type: Type.STRING, description: "The end date of the service period (e.g., 'MM/DD/YYYY')." },
    totalCurrentCharges: { type: Type.NUMBER, description: "The total amount due for the current period." },
    dueDate: { type: Type.STRING, description: "The payment due date." },
    confidenceScore: { type: Type.NUMBER, description: "A score from 0.0 to 1.0 representing your confidence in the extracted data's accuracy. 1.0 is highest confidence." },
    confidenceReasoning: { type: Type.STRING, description: "A detailed explanation for the confidence score. Mention specific issues like blurriness, glare, or unusual formatting." },
    usageCharts: {
      type: Type.ARRAY, description: "An array of ALL usage charts found on the bill (e.g., 'Electricity Usage', 'Water Use').",
      items: {
        type: Type.OBJECT, properties: {
          title: { type: Type.STRING, description: "The title of the chart." },
          unit: { type: Type.STRING, description: "The unit of measurement (e.g., kWh, m³)." },
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
        type: Type.ARRAY, description: "If you are uncertain about a specific value due to blurriness, create a question for the user to verify it.",
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

export const prompt = (ocrText: string) => `You are an expert OCR system specializing in utility bills. Your task is to extract information from the provided image and its raw OCR text, and respond ONLY with a single, raw JSON object that conforms to the schema. Do not include any other text, explanations, or markdown.

**Instructions:**
1.  **Analyze the Image:** Use the image to identify visual elements like charts and tables.
2.  **Analyze the OCR Text:** Use the provided text to precisely extract values for account details, line items, and other written information.
3.  **Cross-Reference:** Cross-reference the data from the OCR text with the visual information from the image to ensure accuracy. For example, use the OCR text to get exact numbers for line items and use the image to estimate values for charts.
4.  **Strict JSON Output**: Your entire response MUST be a single, raw JSON object that conforms to the provided schema. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
5.  **Chart Data Extraction (Crucial)**: Meticulously estimate the values from the bar heights relative to the y-axis, even if exact numbers aren't printed on the bars.
6.  **Confidence Assessment**: Provide a \`confidenceScore\` (0.0-1.0) and a detailed \`confidenceReasoning\`. Be explicit about what parts of the image (e.g., "the line items section", "the top-right corner with the date") were difficult to read and why (e.g., "due to a camera flash glare", "text is pixelated").
7.  **User Verification**: If you are uncertain about any specific, critical data point, generate a clear \`verificationQuestions\` item for it. Use the correct nested path for the field.
8.  **Completeness**: Ensure every required field in the schema is present. If an optional field is not found, omit it from the final JSON.

**Raw OCR Text:**
${ocrText}
`;