import {
    TriageResult,
    SeverityLevel,
    Medication,
    LifestyleIntervention,
    AIAnalysisResult,
    MedicalReport,
    Hospital,
    ComparativeMetric,
    RiskCondition,
    Biomarker,
    BiomarkerCategory,
    AnalysisCategoryBreakdown,
    AnalysisOverview,
    InsightConfidence,
    PatientOverallStatus
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000';

const GROK_MODEL_TEXT = import.meta.env.VITE_GROQ_TEXT_MODEL?.trim() || 'llama-3.3-70b-versatile';
const GROK_MODEL_VISION = import.meta.env.VITE_GROQ_VISION_MODEL?.trim() || 'meta-llama/llama-4-scout-17b-16e-instruct';

/**
 * Calls the server-side Groq proxy instead of directly using the Groq API.
 * This keeps the API key on the server.
 */
const groqChat = async (params: {
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
    stream?: boolean;
}) => {
    const res = await fetch(`${API_BASE}/api/groq/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Groq proxy returned ${res.status}`);
    }
    return res.json();
};

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

const ensureGroqConfigured = () => {
    // API key is now on the server side; nothing to check here.
};

const normalizeStringList = (value: unknown, maxItems = 4): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
};

const normalizeBiomarkerCategory = (category?: unknown): BiomarkerCategory => {
    const normalized = typeof category === 'string' ? category.trim().toLowerCase() : '';
    if (normalized.includes('cardio')) return 'Cardiovascular';
    if (normalized.includes('hema') || normalized.includes('blood')) return 'Hematology';
    if (normalized.includes('renal') || normalized.includes('kidney')) return 'Renal';
    if (normalized.includes('metab') || normalized.includes('sugar') || normalized.includes('lipid')) return 'Metabolic';
    return 'Other';
};

const normalizeConfidence = (value?: unknown): InsightConfidence => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'high') return 'High';
    if (normalized === 'low') return 'Low';
    return 'Medium';
};

const normalizeOverallStatus = (value?: unknown): PatientOverallStatus | null => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized.includes('looks okay') || normalized.includes('stable')) return 'Looks Okay';
    if (normalized.includes('monitor')) return 'Monitor';
    if (normalized.includes('doctor')) return 'Book Doctor Visit';
    if (normalized.includes('urgent')) return 'Needs Urgent Review';
    return null;
};

const normalizeComparisonStatus = (status?: unknown): ComparativeMetric['status'] => {
    const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
    if (normalized === 'critical') return 'Critical';
    if (normalized === 'warning' || normalized === 'caution') return 'Warning';
    return 'Normal';
};

const normalizeRiskProbability = (value?: unknown): RiskCondition['probability'] => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'high') return 'High';
    if (normalized === 'low') return 'Low';
    return 'Medium';
};

const normalizeImpact = (value?: unknown): LifestyleIntervention['impact'] => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'high') return 'High';
    if (normalized === 'low') return 'Low';
    return 'Medium';
};

const normalizeBiomarkers = (value: unknown): Biomarker[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const raw = item as Record<string, unknown>;
            const numericValue = typeof raw.value === 'number'
                ? raw.value
                : Number.parseFloat(String(raw.value ?? '').replace(/[^\d.-]/g, ''));

            if (!Number.isFinite(numericValue)) {
                return null;
            }

            const name = typeof raw.name === 'string' ? raw.name.trim() : '';
            if (!name) {
                return null;
            }

            return {
                name,
                value: Number(numericValue.toFixed(2)),
                unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
                category: normalizeBiomarkerCategory(raw.category)
            };
        })
        .filter((item): item is Biomarker => Boolean(item));
};

const buildFallbackCategoryBreakdown = (
    biomarkers: Biomarker[],
    comparisons: ComparativeMetric[]
): AnalysisCategoryBreakdown[] => {
    const flaggedNames = new Set(
        comparisons
            .filter((metric) => metric.status !== 'Normal')
            .map((metric) => metric.name.trim().toLowerCase())
    );

    const categories: BiomarkerCategory[] = ['Metabolic', 'Cardiovascular', 'Hematology', 'Renal', 'Other'];

    return categories
        .map((category) => {
            const categoryBiomarkers = biomarkers.filter((marker) => marker.category === category);
            if (categoryBiomarkers.length === 0) {
                return null;
            }

            const flagged = categoryBiomarkers.filter((marker) => {
                const markerName = marker.name.trim().toLowerCase();
                return Array.from(flaggedNames).some((flaggedName) =>
                    flaggedName.includes(markerName) || markerName.includes(flaggedName)
                );
            }).length;

            return {
                name: category,
                total: categoryBiomarkers.length,
                flagged
            };
        })
        .filter((item): item is AnalysisCategoryBreakdown => Boolean(item));
};

const buildFallbackOverview = (
    summary: string,
    comparisons: ComparativeMetric[],
    risks: RiskCondition[],
    preventiveMeasures: LifestyleIntervention[],
    reportType: string,
    extractionQuality: InsightConfidence,
    history: MedicalReport[]
): AnalysisOverview => {
    const criticalCount = comparisons.filter((metric) => metric.status === 'Critical').length;
    const warningCount = comparisons.filter((metric) => metric.status === 'Warning').length;
    const highRiskCount = risks.filter((risk) => risk.probability === 'High').length;
    const abnormalComparisons = comparisons.filter((metric) => metric.status !== 'Normal');
    const stableComparisons = comparisons.filter((metric) => metric.status === 'Normal');

    let overallStatus: PatientOverallStatus = 'Looks Okay';
    if (criticalCount >= 2 || highRiskCount >= 2) {
        overallStatus = 'Needs Urgent Review';
    } else if (criticalCount > 0 || highRiskCount > 0) {
        overallStatus = 'Book Doctor Visit';
    } else if (warningCount > 0 || risks.length > 0) {
        overallStatus = 'Monitor';
    }

    const headline = abnormalComparisons[0]
        ? `${abnormalComparisons[0].name} stands out most in this ${reportType.toLowerCase()}.`
        : risks[0]
            ? `This report suggests follow-up around ${risks[0].condition.toLowerCase()}.`
            : `This ${reportType.toLowerCase()} does not show an obvious high-priority concern.`;

    const keyConcerns = [
        ...abnormalComparisons.map((metric) => `${metric.name} is ${metric.status.toLowerCase()} compared with expected range or prior history.`),
        ...risks.map((risk) => risk.reasoning)
    ].filter(Boolean).slice(0, 3);

    const stableIndicators = stableComparisons.length > 0
        ? stableComparisons.slice(0, 3).map((metric) => `${metric.name} appears stable in this report.`)
        : ['Several extracted values appear steady, but clinical confirmation is still recommended.'];

    const nextSteps = preventiveMeasures.length > 0
        ? preventiveMeasures.slice(0, 3).map((item) => `${item.title}: ${item.description}`)
        : [
            'Review these findings with your doctor, especially if you have related symptoms.',
            'Keep future reports in MediSense so trend changes become easier to spot.',
            'Repeat any abnormal test only as advised by a qualified clinician.'
        ];

    const questionsToAsk = [
        abnormalComparisons[0] ? `Should I repeat my ${abnormalComparisons[0].name} test or monitor it over time?` : '',
        risks[0] ? `Do these results suggest early signs of ${risks[0].condition.toLowerCase()}?` : '',
        history.length > 0 ? 'How do these results compare with my previous reports?' : 'Which result should I keep track of first?'
    ].filter(Boolean).slice(0, 3);

    const confidence = extractionQuality === 'Low' && comparisons.length < 3 ? 'Low' : extractionQuality === 'High' ? 'High' : 'Medium';

    return {
        overallStatus,
        headline,
        keyConcerns,
        stableIndicators,
        nextSteps,
        questionsToAsk,
        confidence
    };
};

const sanitizeAnalysisResult = (
    rawAnalysis: any,
    extractedRecord: MedicalReport,
    history: MedicalReport[]
): AIAnalysisResult => {
    const rawComparisons = Array.isArray(rawAnalysis?.comparisons) ? rawAnalysis.comparisons : [];
    const comparisons: ComparativeMetric[] = rawComparisons
        .map((item: any) => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const name = typeof item.name === 'string' ? item.name.trim() : '';
            const currentValue = Number(item.currentValue);
            if (!name || !Number.isFinite(currentValue)) {
                return null;
            }

            const previousValue =
                item.previousValue === null || item.previousValue === undefined || item.previousValue === ''
                    ? null
                    : Number(item.previousValue);
            const deltaPercent =
                item.deltaPercent === null || item.deltaPercent === undefined || item.deltaPercent === ''
                    ? null
                    : Number(item.deltaPercent);

            return {
                name,
                currentValue: Number(currentValue.toFixed(2)),
                previousValue: previousValue !== null && Number.isFinite(previousValue) ? Number(previousValue.toFixed(2)) : null,
                unit: typeof item.unit === 'string' ? item.unit.trim() : '',
                deltaPercent: deltaPercent !== null && Number.isFinite(deltaPercent) ? Number(deltaPercent.toFixed(1)) : null,
                velocity: typeof item.velocity === 'string' && item.velocity.trim()
                    ? item.velocity.trim()
                    : previousValue !== null
                        ? 'Compared with the previous saved report.'
                        : 'No earlier report was available for comparison.',
                status: normalizeComparisonStatus(item.status)
            };
        })
        .filter((item: ComparativeMetric | null): item is ComparativeMetric => Boolean(item));

    const risks: RiskCondition[] = Array.isArray(rawAnalysis?.risks)
        ? rawAnalysis.risks
            .map((item: any) => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const condition = typeof item.condition === 'string' ? item.condition.trim() : '';
                if (!condition) {
                    return null;
                }

                return {
                    condition,
                    probability: normalizeRiskProbability(item.probability),
                    reasoning: typeof item.reasoning === 'string' && item.reasoning.trim()
                        ? item.reasoning.trim()
                        : 'This may be worth discussing with a healthcare professional.',
                    forecastHorizon: typeof item.forecastHorizon === 'string' && item.forecastHorizon.trim()
                        ? item.forecastHorizon.trim()
                        : undefined
                };
            })
            .filter((item: RiskCondition | null): item is RiskCondition => Boolean(item))
        : [];

    const preventiveMeasures: LifestyleIntervention[] = Array.isArray(rawAnalysis?.preventiveMeasures)
        ? rawAnalysis.preventiveMeasures
            .map((item: any) => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const title = typeof item.title === 'string' ? item.title.trim() : '';
                if (!title) {
                    return null;
                }

                return {
                    category: typeof item.category === 'string' && ['Diet', 'Exercise', 'Habit', 'Medical'].includes(item.category)
                        ? item.category
                        : 'Medical',
                    title,
                    description: typeof item.description === 'string' && item.description.trim()
                        ? item.description.trim()
                        : 'Consider discussing this with your doctor.',
                    impact: normalizeImpact(item.impact)
                };
            })
            .filter((item: LifestyleIntervention | null): item is LifestyleIntervention => Boolean(item))
        : [];

    const reportType = typeof rawAnalysis?.reportType === 'string' && rawAnalysis.reportType.trim()
        ? rawAnalysis.reportType.trim()
        : extractedRecord.type;
    const reportDate = typeof rawAnalysis?.reportDate === 'string' && rawAnalysis.reportDate.trim()
        ? rawAnalysis.reportDate.trim()
        : extractedRecord.date;
    const extractionQuality = normalizeConfidence(rawAnalysis?.extractionQuality || (extractedRecord.biomarkers.length >= 8 ? 'High' : extractedRecord.biomarkers.length >= 4 ? 'Medium' : 'Low'));
    const summary = typeof rawAnalysis?.summary === 'string' && rawAnalysis.summary.trim()
        ? rawAnalysis.summary.trim()
        : 'MediSense extracted your report and generated a brief interpretation. Please review the findings with a healthcare professional.';
    const plainLanguageSummary = typeof rawAnalysis?.plainLanguageSummary === 'string' && rawAnalysis.plainLanguageSummary.trim()
        ? rawAnalysis.plainLanguageSummary.trim()
        : summary;

    const categoryBreakdown = Array.isArray(rawAnalysis?.categoryBreakdown) && rawAnalysis.categoryBreakdown.length > 0
        ? rawAnalysis.categoryBreakdown
            .map((item: any) => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const total = Number(item.total);
                if (!Number.isFinite(total) || total <= 0) {
                    return null;
                }

                return {
                    name: normalizeBiomarkerCategory(item.name),
                    total: Number(total),
                    flagged: Number.isFinite(Number(item.flagged)) ? Number(item.flagged) : 0
                };
            })
            .filter((item: AnalysisCategoryBreakdown | null): item is AnalysisCategoryBreakdown => Boolean(item))
        : buildFallbackCategoryBreakdown(extractedRecord.biomarkers, comparisons);

    const fallbackOverview = buildFallbackOverview(
        plainLanguageSummary,
        comparisons,
        risks,
        preventiveMeasures,
        reportType,
        extractionQuality,
        history
    );

    const overview: AnalysisOverview = {
        overallStatus: normalizeOverallStatus(rawAnalysis?.overview?.overallStatus) || fallbackOverview.overallStatus,
        headline: typeof rawAnalysis?.overview?.headline === 'string' && rawAnalysis.overview.headline.trim()
            ? rawAnalysis.overview.headline.trim()
            : fallbackOverview.headline,
        keyConcerns: normalizeStringList(rawAnalysis?.overview?.keyConcerns).length > 0
            ? normalizeStringList(rawAnalysis?.overview?.keyConcerns)
            : fallbackOverview.keyConcerns,
        stableIndicators: normalizeStringList(rawAnalysis?.overview?.stableIndicators).length > 0
            ? normalizeStringList(rawAnalysis?.overview?.stableIndicators)
            : fallbackOverview.stableIndicators,
        nextSteps: normalizeStringList(rawAnalysis?.overview?.nextSteps).length > 0
            ? normalizeStringList(rawAnalysis?.overview?.nextSteps)
            : fallbackOverview.nextSteps,
        questionsToAsk: normalizeStringList(rawAnalysis?.overview?.questionsToAsk).length > 0
            ? normalizeStringList(rawAnalysis?.overview?.questionsToAsk)
            : fallbackOverview.questionsToAsk,
        confidence: normalizeConfidence(rawAnalysis?.overview?.confidence || fallbackOverview.confidence)
    };

    return {
        reportId: typeof rawAnalysis?.reportId === 'string' && rawAnalysis.reportId.trim()
            ? rawAnalysis.reportId.trim()
            : extractedRecord.id,
        summary,
        plainLanguageSummary,
        overview,
        reportType,
        reportDate,
        extractionQuality,
        categoryBreakdown,
        comparisons,
        risks,
        preventiveMeasures
    };
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

/**
 * Detect language from input text by checking for script characters
 * Supports: Hindi, Telugu, Tamil, Kannada, Bengali, Malayalam, Gujarati, Marathi
 * Returns detected language code or 'en-IN' as fallback
 */
const detectLanguageFromText = (text: string): string => {
  if (!text || text.trim().length === 0) return 'en-IN';

  // Count script characters to handle mixed-language text
  const counts: Record<string, number> = {
    devanagari: 0,
    telugu: 0,
    tamil: 0,
    kannada: 0,
    bengali: 0,
    malayalam: 0,
    gujarati: 0,
    odia: 0,
  };

  // Devanagari script (Hindi, Marathi, Sanskrit, Nepali) - U+0900 to U+097F
  const devanagariRegex = /[\u0900-\u097F]/g;
  const devanagariMatches = text.match(devanagariRegex) || [];
  counts.devanagari = devanagariMatches.length;

  // Telugu script - U+0C00 to U+0C7F
  const teluguRegex = /[\u0C00-\u0C7F]/g;
  const teluguMatches = text.match(teluguRegex) || [];
  counts.telugu = teluguMatches.length;

  // Tamil script - U+0B80 to U+0BFF
  const tamilRegex = /[\u0B80-\u0BFF]/g;
  const tamilMatches = text.match(tamilRegex) || [];
  counts.tamil = tamilMatches.length;

  // Kannada script - U+0C80 to U+0CFF
  const kannadaRegex = /[\u0C80-\u0CFF]/g;
  const kannadaMatches = text.match(kannadaRegex) || [];
  counts.kannada = kannadaMatches.length;

  // Bengali script - U+0980 to U+09FF
  const bengaliRegex = /[\u0980-\u09FF]/g;
  const bengaliMatches = text.match(bengaliRegex) || [];
  counts.bengali = bengaliMatches.length;

  // Malayalam script - U+0D00 to U+0D7F
  const malayalamRegex = /[\u0D00-\u0D7F]/g;
  const malayalamMatches = text.match(malayalamRegex) || [];
  counts.malayalam = malayalamMatches.length;

  // Gujarati script - U+0A80 to U+0AFF
  const gujaratiRegex = /[\u0A80-\u0AFF]/g;
  const gujaratiMatches = text.match(gujaratiRegex) || [];
  counts.gujarati = gujaratiMatches.length;

  // Odia script - U+0B00 to U+0B7F
  const odiaRegex = /[\u0B00-\u0B7F]/g;
  const odiaMatches = text.match(odiaRegex) || [];
  counts.odia = odiaMatches.length;

  // Find the script with the most characters
  const maxCount = Math.max(...Object.values(counts));
  
  if (maxCount === 0) {
    // No Indian scripts found, default to English
    return 'en-IN';
  }

  // Map to language code based on highest count
  if (counts.devanagari === maxCount) return 'hi-IN';
  if (counts.telugu === maxCount) return 'te-IN';
  if (counts.tamil === maxCount) return 'ta-IN';
  if (counts.kannada === maxCount) return 'kn-IN';
  if (counts.bengali === maxCount) return 'bn-IN';
  if (counts.malayalam === maxCount) return 'ml-IN';
  if (counts.gujarati === maxCount) return 'gu-IN';
  if (counts.odia === maxCount) return 'or-IN';

  // Default to English
  return 'en-IN';
};

const normalizeLanguageCode = (languageCode?: unknown): string => {
    if (typeof languageCode !== 'string') return 'auto';

    const normalized = languageCode.trim().toLowerCase();
    if (!normalized || normalized === 'auto') return 'auto';
    if (normalized.startsWith('en')) return 'en-IN';
    if (normalized.startsWith('hi')) return 'hi-IN';
    if (normalized.startsWith('te')) return 'te-IN';
    if (normalized.startsWith('ta')) return 'ta-IN';
    if (normalized.startsWith('kn')) return 'kn-IN';
    if (normalized.startsWith('bn') || normalized.startsWith('be')) return 'bn-IN';
    if (normalized.startsWith('ml')) return 'ml-IN';
    if (normalized.startsWith('gu')) return 'gu-IN';
    if (normalized.startsWith('or')) return 'or-IN';
    return languageCode.trim();
};

const LANGUAGE_NAMES: Record<string, string> = {
    'en-IN': 'English',
    'hi-IN': 'Hindi',
    'te-IN': 'Telugu',
    'ta-IN': 'Tamil',
    'kn-IN': 'Kannada',
    'bn-IN': 'Bengali',
    'ml-IN': 'Malayalam',
    'gu-IN': 'Gujarati',
    'or-IN': 'Odia',
};

const getChatLanguageInstruction = (languageCode?: string): string => {
    const normalizedLanguageCode = normalizeLanguageCode(languageCode);

    if (normalizedLanguageCode === 'auto') {
        return `LANGUAGE BEHAVIOR:
- Detect the user's language from their latest message and reply in that same language.
- If the user writes in English, reply in English. If in Hindi, reply in Hindi. Match their language exactly.
- If the user mixes languages, reply naturally in that mix.
- The patient's medical records may be written in any language. Do not let that override the reply language — always match the USER's message language.
- Keep the answer readable and avoid switching languages unless the user does first.`;
    }

    const langName = LANGUAGE_NAMES[normalizedLanguageCode] || normalizedLanguageCode;

    return `LANGUAGE BEHAVIOR:
- Reply ONLY in ${langName}.
- Keep the entire response in ${langName} unless the user explicitly mixes languages.
- The patient's medical records may be written in English or other languages. Use them for facts, but always keep the reply language as ${langName}.`;
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

const IMAGE_ANALYSIS_SYSTEM_INSTRUCTION = `
You are MediSense AI, a medical image analysis assistant. You specialize in analyzing images of skin conditions, wounds, rashes, and other visible medical symptoms.

When the user uploads a medical image, you MUST:

1. **Observation**: Describe exactly what you see — color, texture, pattern, distribution, size estimation, affected body area, and any distinctive features (e.g., raised, flat, scaly, blistered, oozing, dry).

2. **Classification**: Identify the most likely condition(s). Provide your top 1-3 possible diagnoses ranked by likelihood. For each condition include:
   - Disease/condition name
   - Brief description of why the image matches this condition
   - How common this condition is

3. **Severity Assessment**: Rate the severity:
   - Mild: Cosmetic concern or minor irritation, manageable at home
   - Moderate: Needs medical attention but not urgent
   - Severe: Needs prompt medical evaluation
   - Emergency: Seek immediate medical care

4. **Recommended Actions**:
   - Immediate home care steps (if applicable)
   - Which type of specialist to consult (dermatologist, general physician, etc.)
   - Any red flags to watch for that would require urgent care

5. **Important Disclaimers**: Always note that visual analysis alone cannot replace clinical examination, lab tests, or biopsy. Recommend professional consultation.

RESPONSE FORMAT:
Respond in clear, readable text (NOT JSON). Use this structure:

🔍 **What I Observe:**
[Describe the visible features]

🏥 **Possible Condition(s):**
1. **[Condition Name]** (Most Likely) — [explanation]
2. **[Condition Name]** (Possible) — [explanation]

⚠️ **Severity:** [Mild/Moderate/Severe/Emergency]

💊 **Recommended Actions:**
- [action 1]
- [action 2]

📋 **Follow-up Questions:**
- [question about duration, itching, pain, spreading, etc.]

⚕️ *Disclaimer: This is an AI-assisted preliminary analysis and not a medical diagnosis. Please consult a qualified healthcare professional for proper evaluation and treatment.*

If the image is unclear or not medical in nature, politely ask for a clearer photo and describe what you need.
`;

export const analyzeSymptoms = async (symptoms: string, imageBase64?: string, mimeType?: string, languageCode: string = 'auto'): Promise<TriageResult> => {
    ensureGroqConfigured();
    const isMultimodal = !!(imageBase64 && mimeType);
    const model = isMultimodal ? GROK_MODEL_VISION : GROK_MODEL_TEXT;
    
    // Detect language from symptoms text if 'auto' is selected
    const detectedLanguageCode = languageCode === 'auto' 
      ? detectLanguageFromText(symptoms)
      : normalizeLanguageCode(languageCode);
    
    const languageInstruction = detectedLanguageCode === 'en-IN'
        ? 'The user is speaking in English. Reply in English and set "language_code" to "en-IN".'
        : `Detected speech language code: ${detectedLanguageCode}. Reply in this language and set "language_code" to "${detectedLanguageCode}".`;
    const analysisPrompt = isMultimodal
        ? `Analyze this medical image carefully.${symptoms ? ` The user describes: "${symptoms}".` : ' The user has not provided any description.'} Identify the condition, classify the disease type, assess severity, and provide actionable recommendations.`
        : `${languageInstruction}\nAnalyze these symptoms: ${symptoms}. Return strictly JSON.`;

    const messages: any[] = [
        { role: 'system', content: isMultimodal ? IMAGE_ANALYSIS_SYSTEM_INSTRUCTION : TRIAGE_SYSTEM_INSTRUCTION }
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
        const completion = await groqChat({
            model: model,
            messages: messages,
            temperature: 0.1,
            max_tokens: isMultimodal ? 1024 : undefined,
            response_format: isMultimodal ? undefined : { type: "json_object" }
        });

        const content = completion.choices[0].message.content || '{}';
        const parsed = parseJSON(content);

        // Vision models may return plain text instead of JSON
        if (!parsed && isMultimodal) {
            return {
                text: content.trim(),
                emotion: 'calm' as const,
                language_code: detectedLanguageCode,
                severity: 'Moderate' as SeverityLevel,
                needsFollowUp: true,
                followUpQuestions: [],
            };
        }

        return normalizeTriageResult(parsed, detectedLanguageCode);
    } catch (error) {
        console.error("Grok Triage Error:", error);
        return normalizeTriageResult({}, normalizedLanguageCode);
    }
};

export const chatWithAssistant = async (
    history: { role: 'user' | 'model', text: string }[],
    message: string,
    medicalRecords?: any[],
    languageCode: string = 'auto',
    voiceConverse: boolean = false
) => {
    try {
        ensureGroqConfigured();

        // Build RAG context from patient records
        let ragContext = '';
        if (medicalRecords && medicalRecords.length > 0) {
            const recordSummaries = medicalRecords
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((record: any) => {
                    const parts: string[] = [];
                    parts.push(`Report: ${record.type || 'Medical Report'} | Date: ${new Date(record.date).toLocaleDateString()}`);

                    if (record.analysis?.overview?.overallStatus) {
                        parts.push(`Status: ${record.analysis.overview.overallStatus}`);
                    }
                    if (record.analysis?.overview?.headline) {
                        parts.push(`Headline: ${record.analysis.overview.headline}`);
                    }
                    if (record.analysis?.plainLanguageSummary) {
                        parts.push(`Summary: ${record.analysis.plainLanguageSummary}`);
                    } else if (record.analysis?.summary) {
                        parts.push(`Summary: ${record.analysis.summary}`);
                    }

                    if (record.biomarkers && record.biomarkers.length > 0) {
                        const markers = record.biomarkers
                            .map((b: any) => `${b.name}: ${b.value} ${b.unit}`)
                            .join(', ');
                        parts.push(`Biomarkers: ${markers}`);
                    }

                    if (record.analysis?.risks && record.analysis.risks.length > 0) {
                        const risks = record.analysis.risks
                            .map((r: any) => `${r.condition} (${r.probability})`)
                            .join(', ');
                        parts.push(`Risks: ${risks}`);
                    }

                    if (record.analysis?.overview?.keyConcerns && record.analysis.overview.keyConcerns.length > 0) {
                        parts.push(`Concerns: ${record.analysis.overview.keyConcerns.join(', ')}`);
                    }

                    if (record.prescriptions && record.prescriptions.length > 0) {
                        const meds = record.prescriptions
                            .map((p: any) => `${p.name} (${p.dosage}, ${p.frequency})`)
                            .join(', ');
                        parts.push(`Medications: ${meds}`);
                    }

                    if (record.analysis?.preventiveMeasures && record.analysis.preventiveMeasures.length > 0) {
                        const measures = record.analysis.preventiveMeasures
                            .map((m: any) => m.title)
                            .join(', ');
                        parts.push(`Recommendations: ${measures}`);
                    }

                    return parts.join('\n');
                })
                .join('\n---\n');

            ragContext = `\n\n--- PATIENT MEDICAL HISTORY (${medicalRecords.length} reports on file) ---\n${recordSummaries}\n--- END OF MEDICAL HISTORY ---\n`;
        }

        const systemPrompt = `You are MediSense, an expert AI medical assistant. You provide helpful, accurate, and empathetic health guidance.

IMPORTANT RULES:
- You have access to this patient's medical records below. Use them to give personalized, context-aware answers.
- When the patient asks about their health, labs, medications, or risks, reference their actual data.
- If a question relates to a specific biomarker or condition in their records, cite the relevant values and dates.
- If the patient's records show concerning trends, proactively mention them when relevant.
- NEVER say "I'm an AI, not a doctor" or "consult a qualified doctor" or similar disclaimers. Instead, end your response by asking if the user needs help with anything else, or suggest a relevant follow-up (e.g., "Would you like tips to lower your triglycerides?" or "Want me to explain what this means for your diet?").
- If you don't have relevant data in their records, say so honestly and give general guidance.

${voiceConverse
  ? `RESPONSE STYLE (VOICE CONVERSATION MODE):
- Keep responses SHORT and PRECISE — 2-4 sentences max.
- Speak naturally as if having a real conversation. No bullet points, no numbered lists, no markdown formatting.
- Get straight to the point. Do NOT elaborate unless the user asks for more detail.
- Use simple everyday words. This response will be read aloud via text-to-speech.`
  : `RESPONSE STYLE (TEXT MODE):
- Give detailed, comprehensive responses with relevant context.
- Use bullet points, numbered lists, and clear formatting for readability.
- Include specific values, ranges, and actionable advice.
- Be thorough — the user is reading this on screen and wants full information.`}

${getChatLanguageInstruction(
          languageCode === 'auto' ? detectLanguageFromText(message) : languageCode
        )}${ragContext}`;

        const messages: any[] = [{ role: 'system', content: systemPrompt }];
        messages.push(...history.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text
        })));
        messages.push({ role: 'user', content: message });

        const completion = await groqChat({
            model: GROK_MODEL_TEXT,
            messages: messages,
        });

        return completion.choices[0].message.content || "I apologize, I couldn't process that.";
    } catch (error) {
        console.error("Grok Chat Error:", error);
        return "I encountered an error connecting to my knowledge base.";
    }
};

const EXTRACTION_SYSTEM_INSTRUCTION = `
You are an expert OCR medical AI for lab reports, health checkups, and diagnostic summaries.
Extract all visible medical biomarkers and report metadata from the uploaded image.
Normalize names to standard medical terms and only keep numeric test results.
Return ONLY valid JSON matching:
{ 
    "date": "YYYY-MM-DD", 
    "type": "Report Type", 
    "biomarkers": [ 
      { "name": "string", "value": number, "unit": "string", "category": "Metabolic"|"Cardiovascular"|"Hematology"|"Renal"|"Other" }
    ]
}
`;

const ANALYSIS_SYSTEM_INSTRUCTION = `
You are MediSense, a patient-first medical report interpretation assistant.
Your job is to turn extracted medical values into a concise, calm, and useful explanation for an everyday user.
Never claim to diagnose disease. Use supportive, plain-language guidance.
Return ONLY valid JSON.

Schema:
{
  reportId: string,
  summary: string,
  plainLanguageSummary: string,
  overview: {
    overallStatus: "Looks Okay" | "Monitor" | "Book Doctor Visit" | "Needs Urgent Review",
    headline: string,
    keyConcerns: string[],
    stableIndicators: string[],
    nextSteps: string[],
    questionsToAsk: string[],
    confidence: "High" | "Medium" | "Low"
  },
  reportType: string,
  reportDate: string,
  extractionQuality: "High" | "Medium" | "Low",
  categoryBreakdown: [{ name, total, flagged }],
  comparisons: [{ name, currentValue, previousValue, unit, deltaPercent, velocity, status }],
  risks: [{ condition, probability, reasoning, forecastHorizon }],
  preventiveMeasures: [{ category, title, description, impact }]
}

Rules:
- Keep summary patient-friendly and easy to scan.
- Mention what changed from prior reports when history exists.
- Use "Critical" only for genuinely concerning values.
- If there is not enough prior history, use null for previousValue and deltaPercent.
- Provide 2-4 practical next steps and 2-3 useful questions the patient can ask a doctor.
`;

export const processMedicalReport = async (
    base64Image: string,
    mimeType: string,
    history: MedicalReport[],
    onStageChange?: (stage: 'reasoning') => void
): Promise<{ analysis: AIAnalysisResult, extractedRecord: MedicalReport }> => {
    ensureGroqConfigured();

    let extraction: any = {};

    const isPDF = mimeType === 'application/pdf';

    if (isPDF) {
        // ── PDF path: send to server for text extraction ────────────
        try {
            const byteCharacters = atob(base64Image);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });

            const formData = new FormData();
            formData.append('file', blob, 'report.pdf');

            const response = await fetch(`${API_BASE}/api/analyze/extract-pdf`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned ${response.status}`);
            }

            extraction = await response.json();
        } catch (e: any) {
            console.error("PDF Extraction Error:", e);
            throw new Error(e.message || "Failed to extract data from PDF.");
        }
    } else {
        // ── Image path: use Groq vision model directly ─────────────
        try {
            const completion = await groqChat({
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
            console.error("Vision Extraction Error:", e);
            throw new Error("Failed to extract data via Groq Vision.");
        }
    }

    const normalizedBiomarkers = normalizeBiomarkers(extraction.biomarkers);

    if (normalizedBiomarkers.length === 0) {
        throw new Error("Could not extract any biomarkers.");
    }

    const extractedRecord: MedicalReport = {
        id: `report-${Date.now()}`,
        date: extraction.date || new Date().toISOString(),
        type: extraction.type || "Uploaded Report",
        biomarkers: normalizedBiomarkers,
        ...(extraction.prescriptions && extraction.prescriptions.length > 0 && { prescriptions: extraction.prescriptions })
    };

    onStageChange?.('reasoning');

    const recentHistory = [...history]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
    let analysis: AIAnalysisResult;
    try {
        const completion = await groqChat({
            model: GROK_MODEL_TEXT,
            messages: [
                { role: 'system', content: ANALYSIS_SYSTEM_INSTRUCTION },
                {
                    role: 'user',
                    content: `Current Extraction: ${JSON.stringify(extractedRecord)}\nPatient History: ${JSON.stringify(recentHistory)}`
                }
            ],
            response_format: { type: "json_object" }
        });
        analysis = sanitizeAnalysisResult(parseJSON(completion.choices[0].message.content || '{}'), extractedRecord, recentHistory);
    } catch (e) {
        console.error("Analysis Error:", e);
        analysis = sanitizeAnalysisResult({}, extractedRecord, recentHistory);
    }

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

        const response = await fetch(`${API_BASE}/api/analyze`, {
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
