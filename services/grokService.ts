import OpenAI from 'openai';
import { TriageResult, SeverityLevel, Medication, LifestyleIntervention, AIAnalysisResult, MedicalReport, Hospital } from '../types';

const openai = new OpenAI({
    apiKey: process.env.API_KEY || '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',
    baseURL: 'https://api.groq.com/openai/v1',
    dangerouslyAllowBrowser: true
});

const GROK_MODEL_TEXT = 'llama-3.1-8b-instant';
const GROK_MODEL_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct';

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
You are MediSense AI, a multilingual healthcare voice assistant designed for Indian users.

Your role is to help users with:
* Basic health guidance
* Medicine reminders
* Appointment booking
* Explaining medical reports in simple language
* Answering health-related questions

LANGUAGE BEHAVIOR:
* Detect the user's language automatically when no speech language code is provided
* If the prompt includes a detected speech language code, use that language for the reply
* Always reply in the same language the user used
* If the user mixes languages, respond naturally in that mix
* Keep responses simple, conversational, and voice-friendly

VOICE RESPONSE STYLE:
* Responses must be short (1-3 sentences max)
* Use natural spoken tone
* Avoid long paragraphs
* Avoid complex medical jargon
* Be calm, friendly, and reassuring

HEALTHCARE SAFETY RULES:
* NEVER give critical medical diagnosis
* NEVER prescribe medicines or dosages
* Only escalate immediately when there are clear red flags
* If information is incomplete for a safe triage decision, ask focused follow-up questions first
* If unsure and there are no red flags, gather more details instead of immediately telling the user to see a doctor

TASK HANDLING:
1. Symptom queries: Give general guidance only, suggest possible reasons (non-diagnostic), and ask 2-3 targeted follow-up questions when details are missing.
2. Medicine reminders: Confirm timing clearly.
3. Report explanation: Simplify medical terms.
4. Appointments: Ask follow-up questions if needed.

SEVERITY RULES:
* Low: mild/common symptoms with no red flags
* Moderate: needs more detail or routine doctor follow-up, but not urgent
* Urgent: significant concern that should be checked soon, but not immediate emergency mode
* Emergency: only for explicit red flags such as severe chest pain with breathing trouble, stroke signs, unconsciousness, seizure, severe bleeding, blue lips, or extreme confusion
* Fever alone is NOT an emergency unless paired with major red flags

FOLLOW-UP RULES:
* If the user gives a short or incomplete symptom statement, set "needs_follow_up" to true
* Include 2-3 short, specific follow-up questions in the same language
* Make the questions practical, such as duration, severity, associated symptoms, age, temperature, breathing trouble, vomiting, rash, etc.
* When "needs_follow_up" is true, do not jump straight to hospital/ER advice unless there are explicit red flags

RESPONSE FORMAT:
Return ONLY:
{
  "text": "<short spoken response>",
  "emotion": "<calm | friendly | alert>",
  "language_code": "<te-IN | hi-IN | en-IN>",
  "severity": "<Low | Moderate | Urgent | Emergency>",
  "needs_follow_up": <true | false>,
  "follow_up_questions": ["<question 1>", "<question 2>"]
}

DO NOT:
* Give long answers
* Use bullet points
* Output anything outside JSON
* Sound robotic

EXAMPLES:
User: "Naaku headache undi"
Output:
{
  "text": "Headache ki stress or dehydration reason avachu. Konchem rest teesukondi. Severe ayithe doctor ni consult cheyyandi.",
  "emotion": "calm",
  "language_code": "te-IN"
}

User: "Mujhe bukhar hai"
Output:
{
  "text": "Mujhe thodi aur jankari chahiye taaki sahi salah de sakun.",
  "emotion": "friendly",
  "language_code": "hi-IN",
  "severity": "Moderate",
  "needs_follow_up": true,
  "follow_up_questions": ["Bukhar kitne din se hai?", "Temperature kitna hai?", "Khaansi, gala dard, ya saans ki dikkat hai kya?"]
}

User: "I am feeling headache"
Output:
{
  "text": "A headache can happen because of stress or dehydration. Please rest, drink water, and see a doctor if it gets worse.",
  "emotion": "calm",
  "language_code": "en-IN",
  "severity": "Low",
  "needs_follow_up": false,
  "follow_up_questions": []
}

User: "Mujhe chest pain hai aur saans nahi aa rahi"
Output:
{
  "text": "Yeh emergency ho sakti hai. Kripya turant emergency help lijiye.",
  "emotion": "alert",
  "language_code": "hi-IN",
  "severity": "Emergency",
  "needs_follow_up": false,
  "follow_up_questions": []
}
`;

const normalizeLanguageCode = (languageCode?: unknown): string => {
    if (typeof languageCode !== 'string') return 'auto';

    const normalized = languageCode.trim().toLowerCase();
    if (!normalized || normalized === 'auto') return 'auto';
    if (normalized.startsWith('en')) return 'en-IN';
    if (normalized.startsWith('hi')) return 'hi-IN';
    if (normalized.startsWith('te')) return 'te-IN';
    if (normalized.startsWith('ta')) return 'ta-IN';
    return languageCode.trim();
};

const normalizeEmotion = (emotion?: unknown): TriageResult['emotion'] => {
    if (typeof emotion !== 'string') return 'calm';

    const normalized = emotion.trim().toLowerCase();
    if (normalized === 'alert' || normalized.includes('urgent') || normalized.includes('emergency')) {
        return 'alert';
    }
    if (normalized === 'friendly') {
        return 'friendly';
    }
    if (normalized === 'calm') {
        return 'calm';
    }

    if (
        normalized.includes('ఆందోళన') ||
        normalized.includes('జాగ్రత్త') ||
        normalized.includes('चेतावनी') ||
        normalized.includes('सावधान')
    ) {
        return 'alert';
    }

    if (
        normalized.includes('స్నేహ') ||
        normalized.includes('మైత్రి') ||
        normalized.includes('दोस्ताना')
    ) {
        return 'friendly';
    }

    return 'calm';
};

const normalizeSeverity = (severity?: unknown, emotion?: TriageResult['emotion']): SeverityLevel => {
    if (typeof severity === 'string') {
        const normalized = severity.trim().toLowerCase();
        if (normalized === 'low') return SeverityLevel.LOW;
        if (normalized === 'moderate') return SeverityLevel.MODERATE;
        if (normalized === 'urgent') return SeverityLevel.URGENT;
        if (normalized === 'emergency') return SeverityLevel.EMERGENCY;
    }

    if (emotion === 'alert') {
        return SeverityLevel.URGENT;
    }

    return SeverityLevel.MODERATE;
};

const normalizeFollowUpQuestions = (questions?: unknown): string[] => {
    if (!Array.isArray(questions)) {
        return [];
    }

    return questions
        .filter((question): question is string => typeof question === 'string')
        .map((question) => question.trim())
        .filter(Boolean)
        .slice(0, 3);
};

const getDefaultFollowUpText = (languageCode: string): string => {
    const normalized = languageCode.toLowerCase();
    if (normalized.startsWith('hi')) {
        return 'Sahi salah dene ke liye mujhe thodi aur jankari chahiye.';
    }
    if (normalized.startsWith('te')) {
        return 'Sariyaina salah ivvadam kosam konchem marinta vivaralu kavali.';
    }
    return 'I need a little more detail so I can guide you better.';
};

const shouldReplaceWithSoftFollowUpText = (text: string): boolean => {
    const normalized = text.toLowerCase();
    return (
        !normalized ||
        normalized.includes('nothing can be told') ||
        normalized.includes('cannot be told') ||
        normalized.includes('insufficient information') ||
        normalized.includes('kuch bhi nahi') ||
        normalized.includes('kuch bhi nahin') ||
        normalized.includes('paryapt nahin') ||
        normalized.includes('पर्याप्त नहीं')
    );
};

const normalizeTriageResult = (raw: any, requestedLanguageCode: string): TriageResult => {
    const fallbackLanguage = requestedLanguageCode === 'auto' ? 'en-IN' : requestedLanguageCode;
    const normalizedLanguage = normalizeLanguageCode(raw?.language_code || fallbackLanguage);
    const normalizedEmotion = normalizeEmotion(raw?.emotion);
    const followUpQuestions = normalizeFollowUpQuestions(raw?.follow_up_questions);
    const needsFollowUp = typeof raw?.needs_follow_up === 'boolean'
        ? raw.needs_follow_up
        : followUpQuestions.length > 0;
    const normalizedText = typeof raw?.text === 'string' ? raw.text.trim() : '';

    return {
        text: needsFollowUp && shouldReplaceWithSoftFollowUpText(normalizedText)
            ? getDefaultFollowUpText(normalizedLanguage === 'auto' ? 'en-IN' : normalizedLanguage)
            : normalizedText,
        emotion: normalizedEmotion,
        language_code: normalizedLanguage === 'auto' ? 'en-IN' : normalizedLanguage,
        severity: normalizeSeverity(raw?.severity, normalizedEmotion),
        needsFollowUp,
        followUpQuestions,
    };
};

export const analyzeSymptoms = async (symptoms: string, imageBase64?: string, mimeType?: string, languageCode: string = 'auto'): Promise<TriageResult> => {
    const isMultimodal = !!(imageBase64 && mimeType);
    const model = isMultimodal ? GROK_MODEL_VISION : GROK_MODEL_TEXT;
    const normalizedLanguageCode = normalizeLanguageCode(languageCode);
    const languageInstruction = normalizedLanguageCode === 'auto'
        ? 'Detect the user language from the symptom text and respond in that same language.'
        : `Detected speech language code: ${normalizedLanguageCode}. Reply in this language and set "language_code" to "${normalizedLanguageCode}".`;
    const analysisPrompt = `${languageInstruction}\nAnalyze these symptoms: ${symptoms}. Return strictly JSON.`;

    const messages: any[] = [
        { role: 'system', content: TRIAGE_SYSTEM_INSTRUCTION }
    ];

    if (isMultimodal) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: analysisPrompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${imageBase64}`,
                    },
                },
            ],
        });
    } else {
        messages.push({ role: 'user', content: analysisPrompt });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.1,
            response_format: isMultimodal ? undefined : { type: "json_object" }
        });

        const content = completion.choices[0].message.content || '{}';
        return normalizeTriageResult(parseJSON(content), normalizedLanguageCode);
    } catch (error) {
        console.error("Grok Triage Error:", error);
        return normalizeTriageResult({}, normalizedLanguageCode);
    }
};

export const chatWithAssistant = async (history: { role: 'user' | 'model', text: string }[], message: string) => {
    try {
        const messages: any[] = history.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text
        }));
        messages.unshift({ role: 'system', content: "You are MediSense, an expert medical AI assistant." });
        messages.push({ role: 'user', content: message });

        const completion = await openai.chat.completions.create({
            model: GROK_MODEL_TEXT,
            messages: messages,
            stream: false
        });

        return completion.choices[0].message.content || "I apologize, I couldn't process that.";
    } catch (error) {
        console.error("Grok Chat Error:", error);
        return "I encountered an error connecting to my knowledge base.";
    }
};

const EXTRACTION_SYSTEM_INSTRUCTION = `
You are an expert OCR Medical AI. Extract all visible medical biomarkers from this image.
Normalize names to standard medical terms.
Return ONLY valid JSON matching:
{ 
    "date": "YYYY-MM-DD", 
    "type": "Report Type", 
    "biomarkers": [ 
    { "name": "string", "value": number, "unit": "string", "category": "Metabolic"|"Cardiovascular"|"Renal"|"Other" } 
    ] 
}
`;

const ANALYSIS_SYSTEM_INSTRUCTION = `
You are MediSense, an expert medical AI.
Provide a detailed comparative analysis in JSON format.
Schema:
{
    reportId: string,
    summary: string,
    comparisons: [{ name, currentValue, previousValue, unit, deltaPercent, velocity, status }],
    risks: [{ condition, probability, reasoning, forecastHorizon }],
    preventiveMeasures: [{ category, title, description, impact }]
}
`;

export const processMedicalReport = async (
    base64Image: string,
    mimeType: string,
    history: MedicalReport[]
): Promise<{ analysis: AIAnalysisResult, extractedRecord: MedicalReport }> => {

    let extraction: any = {};
    try {
        const completion = await openai.chat.completions.create({
            model: GROK_MODEL_VISION,
            messages: [
                { role: 'system', content: EXTRACTION_SYSTEM_INSTRUCTION },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: "Extract medical data from this image." },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                    ]
                }
            ]
        });
        extraction = parseJSON(completion.choices[0].message.content || '{}');
    } catch (e) {
        console.error("Extraction Error:", e);
        throw new Error("Failed to extract data via Grok.");
    }

    if (!extraction.biomarkers || extraction.biomarkers.length === 0) {
        throw new Error("Could not extract any biomarkers.");
    }

    const recentHistory = history.slice(-3);
    let analysis: any = {};
    try {
        const completion = await openai.chat.completions.create({
            model: GROK_MODEL_TEXT,
            messages: [
                { role: 'system', content: ANALYSIS_SYSTEM_INSTRUCTION },
                { role: 'user', content: `Current Extraction: ${JSON.stringify(extraction)}\nPatient History: ${JSON.stringify(recentHistory)}` }
            ],
            response_format: { type: "json_object" }
        });
        analysis = parseJSON(completion.choices[0].message.content || '{}');
    } catch (e) {
        console.error("Analysis Error:", e);
        analysis = { summary: "Analysis failed.", comparisons: [], risks: [], preventiveMeasures: [] };
    }

    const extractedRecord: MedicalReport = {
        id: `report-${Date.now()}`,
        date: extraction.date || new Date().toISOString(),
        type: extraction.type || "Uploaded Report",
        biomarkers: extraction.biomarkers || []
    };

    return { analysis, extractedRecord };
};

export const analyzePrescription = async (base64Image: string, mimeType: string): Promise<{ medications: Medication[], interventions: LifestyleIntervention[] }> => {
    try {
        const byteCharacters = atob(base64Image);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        const formData = new FormData();
        formData.append('file', blob, 'prescription.jpg');
        formData.append('task', 'prescription');

        const response = await fetch('http://localhost:5000/api/analyze', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            console.error("Prescription Analysis AI Error:", data.error);
            return { medications: [], interventions: [] };
        }

        return {
            medications: data.medications || [],
            interventions: data.interventions || []
        };

    } catch (e) {
        console.error("Prescription Analysis Error:", e);
        return { medications: [], interventions: [] };
    }
};

export const findNearbyHospitals = async (specialist: string, lat: number, lng: number): Promise<Hospital[]> => {
    console.warn("Grok Maps integration not available. Returning generic advice.");
    return [
        {
            name: "Consult Local Maps",
            googleMapsUri: `https://www.google.com/maps/search/${specialist}/@${lat},${lng},14z`,
            address: "Click to open Google Maps",
            rating: "N/A"
        }
    ];
};
