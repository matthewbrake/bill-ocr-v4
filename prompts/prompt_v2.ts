
import { Type } from "@google/genai";

// This is the V2 prompt, designed to be simpler and more robust for a wider range of models.

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

export const prompt = `You are an expert OCR system specializing in utility bills. Your task is to extract information from the provided image and respond ONLY with a single, raw JSON object that conforms to the schema. Do not include any other text, explanations, or markdown.

**Critical Thinking Process:**

1.  **Initial Scan**: First, scan the entire bill to identify all major sections: Account Details, "Here's what you owe" summary, and Usage Charts ("YOUR ELECTRICITY USE AT A GLANCE", "YOUR WATER USE AT A GLANCE").

2.  **Line Item Analysis (Crucial for Accuracy)**:
    *   Locate the "Here's what you owe" section.
    *   Identify all charge descriptions and their amounts.
    *   **IMPORTANT**: Most line items represent charges and MUST be POSITIVE numbers (e.g., 'GST', 'Water/wastewater', 'Drainage services').
    *   Look for specific keywords like 'Payments' or 'Credit'. ONLY these line items should be represented with a NEGATIVE number. In the provided example, "Payments" is clearly shown with a minus sign.
    *   The sum of these line items should roughly equal the "New charges" or be related to the "Amount of your last bill" and "Total". Use this to self-correct the signs of the amounts.

3.  **Usage Chart Extraction**:
    *   For EACH chart found, identify the title (e.g., "YOUR ELECTRICITY USE AT A GLANCE"), the unit on the Y-axis (e.g., 'kWh', 'm³'), and the years shown in the legend (e.g., '2015/2016', '2016/2017').
    *   For each month on the X-axis (e.g., 'Oct', 'Nov'), meticulously estimate the value for EACH bar corresponding to a year.
    *   Construct the nested 'usage' array correctly. For 'Oct', it should have two entries: one for '2016' and one for '2017'.

4.  **Confidence & Verification**:
    *   Based on image clarity (blurriness, glare, skew), determine a \`confidenceScore\`.
    *   Provide clear \`confidenceReasoning\`. Be specific about which parts were difficult to read.
    *   If a specific number (e.g., a bar height on a chart, a digit in a line item amount) is ambiguous, create a \`verificationQuestions\` item for it. Use a clear, simple question and the exact dot-notation path to the field.

5.  **Final JSON Assembly**: Compile all extracted data into a single JSON object that strictly adheres to the schema. Omit any optional fields that are not present on the bill. Ensure the entire output is only the raw JSON.`;