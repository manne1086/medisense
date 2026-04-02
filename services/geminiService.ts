
import { GoogleGenAI, Type } from "@google/genai";
import { TriageResult, SeverityLevel, Medication, LifestyleIntervention, AIAnalysisResult, MedicalReport, Hospital } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseJSON = (text: string) => {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                return JSON.parse(codeBlockMatch[1]);
            }
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                 const jsonString = text.substring(firstBrace, lastBrace + 1);
                 return JSON.parse(jsonString);
            }
        } catch (e2) {
             console.error("JSON Parse Error. Raw Text:", text);
        }
        return null;
    }
};

const TRIAGE_SYSTEM_INSTRUCTION = `
You are a highly advanced Medical Diagnostic Assistant (MediSense). 
Your goal is to perform a Bayesian Triage based on user symptoms and optional visual inputs.
You must return the result in strictly structured JSON format.
`;

const TRIAGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    rootCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
    severity: { type: Type.STRING, enum: ['Low', 'Moderate', 'Urgent', 'Emergency'] },
    specialist: { type: Type.STRING },
    reasoning: { type: Type.STRING },
    recommendedAction: { type: Type.STRING },
    citations: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['rootCauses', 'severity', 'specialist', 'reasoning', 'recommendedAction']
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reportId: { type: Type.STRING },
    summary: { type: Type.STRING },
    comparisons: { 
        type: Type.ARRAY, 
        items: { 
            type: Type.OBJECT, 
            properties: {
                name: { type: Type.STRING },
                currentValue: { type: Type.NUMBER },
                previousValue: { type: Type.NUMBER, nullable: true },
                unit: { type: Type.STRING },
                deltaPercent: { type: Type.NUMBER, nullable: true },
                velocity: { type: Type.STRING },
                status: { type: Type.STRING, enum: ['Normal', 'Warning', 'Critical'] }
            }
        } 
    },
    risks: { 
        type: Type.ARRAY, 
        items: {
            type: Type.OBJECT,
            properties: {
                condition: { type: Type.STRING },
                probability: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                reasoning: { type: Type.STRING },
                forecastHorizon: { type: Type.STRING }
            }
        }
    },
    preventiveMeasures: { 
        type: Type.ARRAY, 
        items: { 
            type: Type.OBJECT, 
            properties: {
                category: { type: Type.STRING, enum: ['Diet', 'Exercise', 'Habit', 'Medical'] },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                impact: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
            }
        } 
    }
  }
};

const extractDataFromImage = async (base64Image: string, mimeType: string): Promise<any> => {
    const prompt = `
    You are an expert OCR Medical AI. Extract all visible medical biomarkers from this image.
    Normalize names to standard medical terms.
    Return ONLY valid JSON.
    { 
      "date": "YYYY-MM-DD", 
      "type": "Report Type", 
      "biomarkers": [ 
        { "name": "string", "value": number, "unit": "string", "category": "Metabolic"|"Cardiovascular"|"Renal"|"Other" } 
      ] 
    }
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: prompt }
            ]
        }
    });
    return parseJSON(response.text || '{}') || {};
};

const generateComparativeAnalysis = async (extractedData: any, history: MedicalReport[]): Promise<AIAnalysisResult> => {
    const recentHistory = history.slice(-3);
    const prompt = `
    You are MediSense, an expert medical AI.
    Current Extraction: ${JSON.stringify(extractedData)}
    Patient History: ${JSON.stringify(recentHistory)}
    Provide a detailed comparative analysis in JSON format using the defined schema.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: ANALYSIS_SCHEMA
        }
    });
    return parseJSON(response.text || '{}') || {};
};

export const processMedicalReport = async (
    base64Image: string, 
    mimeType: string, 
    history: MedicalReport[]
): Promise<{ analysis: AIAnalysisResult, extractedRecord: MedicalReport }> => {
    const extraction = await extractDataFromImage(base64Image, mimeType);
    if (!extraction.biomarkers || extraction.biomarkers.length === 0) {
        throw new Error("Could not extract any biomarkers.");
    }
    const analysis = await generateComparativeAnalysis(extraction, history);
    const extractedRecord: MedicalReport = {
        id: `report-${Date.now()}`,
        date: extraction.date || new Date().toISOString(),
        type: extraction.type || "Uploaded Report",
        biomarkers: extraction.biomarkers || []
    };
    return { analysis, extractedRecord };
};

export const findNearbyHospitals = async (specialist: string, lat: number, lng: number): Promise<Hospital[]> => {
    const prompt = `Use Google Maps to find the 3 nearest top-rated hospitals or ${specialist} centers near latitude ${lat}, longitude ${lng}.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
            },
        });
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (!chunks || chunks.length === 0) return [];
        const hospitals: Hospital[] = chunks
            .filter((c: any) => c.web?.uri && c.web?.title) 
            .map((c: any) => ({
                name: c.web.title,
                googleMapsUri: c.web.uri,
                address: "View on Map for details", 
                rating: "4.0+" 
            }));
        const unique = hospitals.filter((v, i, a) => a.findIndex(t => t.googleMapsUri === v.googleMapsUri) === i);
        return unique.slice(0, 3);
    } catch (e) {
        console.error("Maps Grounding Error:", e);
        return [];
    }
};

export const analyzeSymptoms = async (symptoms: string, imageBase64?: string, mimeType?: string): Promise<TriageResult> => {
    const isMultimodal = !!(imageBase64 && mimeType);
    const model = isMultimodal ? 'gemini-2.5-flash-image' : 'gemini-3-flash-preview';
    const parts: any[] = [];
    if (isMultimodal) {
        parts.push({ inlineData: { data: imageBase64, mimeType } });
    }
    let config: any = {};
    let promptText = "";
    if (!isMultimodal) {
        config = { 
            responseMimeType: "application/json",
            responseSchema: TRIAGE_SCHEMA
        };
        promptText = `${TRIAGE_SYSTEM_INSTRUCTION} \n User Query: ${symptoms}`;
    } else {
        promptText = `${TRIAGE_SYSTEM_INSTRUCTION} \n User Query: ${symptoms} \n Return JSON format directly.`;
    }
    parts.push({ text: promptText });
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config
    });
    return parseJSON(response.text || '{}') || {};
};

export const analyzePrescription = async (base64Image: string, mimeType: string): Promise<{ medications: Medication[], interventions: LifestyleIntervention[] }> => {
    const prompt = `
    Analyze this medical prescription image.
    Task 1: Extract all prescribed medications. 
    Task 2: For each medication found, identify the active chemical salt/ingredient and list 2-3 market alternatives available in pharmacies. These should include both Generic versions and other leading Brand names.
    Task 3: Suggest specific lifestyle interventions (Diet, Exercise, Habits) based on the medications (e.g., if blood pressure meds are seen, suggest low sodium).

    Return strictly valid JSON matching this structure:
    {
      "medications": [
        {
          "name": "string (The name on the prescription)",
          "dosage": "string (e.g. 500mg)",
          "frequency": "string (e.g. twice daily)",
          "type": "string (e.g. Antibiotic, Antihypertensive)",
          "description": "string (concise 1-sentence educational description)",
          "alternatives": [
            { "name": "string", "type": "Generic" | "Brand", "description": "Quick reason why it is an alternative (e.g., same active salt Paracetamol)" }
          ]
        }
      ],
      "interventions": [
        {
            "category": "Diet" | "Exercise" | "Habit" | "Medical",
            "title": "string",
            "description": "string",
            "impact": "High" | "Medium" | "Low"
        }
      ]
    }
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: prompt }
            ]
        }
    });
    return parseJSON(response.text || '{}') || { medications: [], interventions: [] };
};

export const chatWithAssistant = async (history: { role: 'user' | 'model', text: string }[], message: string) => {
    const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction: "You are MediSense." },
        history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const result = await chat.sendMessage({ message });
    return result.text;
};
