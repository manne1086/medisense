const express = require('express');
const router = express.Router();
const multer = require('multer');
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');

// ── Document parsing via Landing AI ADE ──
const LANDING_AI_API_KEY = process.env.LANDING_AI_API_KEY;
const LANDING_AI_PARSE_URL = 'https://api.va.landing.ai/v1/ade/parse';

const parseDocumentWithLandingAI = async (buffer, mimeType = 'application/pdf', filename = 'document.pdf') => {
    if (!LANDING_AI_API_KEY) {
        throw new Error('LANDING_AI_API_KEY is not configured in server .env');
    }

    console.log(`Landing AI: parsing ${filename} (${mimeType}, ${buffer.length} bytes)`);

    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('document', blob, filename);
    formData.append('model', 'dpt-2-latest');

    const response = await fetch(LANDING_AI_PARSE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${LANDING_AI_API_KEY}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('Landing AI error:', response.status, errBody);
        throw new Error(`Landing AI returned ${response.status}: ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();
    const markdown = data.markdown || '';
    console.log(`Landing AI: extracted ${markdown.length} chars of markdown`);
    return markdown;
};

console.log("Document parsing module loaded (Landing AI ADE)");

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Groq Client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const uploadMiddleware = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (req.is('json') || req.headers['content-type']?.includes('application/json')) {
                return next();
            }
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

router.post('/', uploadMiddleware, async (req, res) => {
    console.log("Analyze route hit. CT:", req.headers['content-type']);
    console.log("Inside Analyze Handler. Body keys:", Object.keys(req.body));
    console.log("File:", req.file ? "Yes" : "No");

    // Check for authentication token even though this route may be used without auth
    // But extract-pdf requires auth, so we log it
    const authHeader = req.header('Authorization');
    if (authHeader) {
        console.log("[analyze POST] Auth header present");
    }

    if (!req.file && !req.body.text) {
        return res.status(400).json({ error: 'No file uploaded and no text provided' });
    }

    const task = req.body.task; // 'prescription' or undefined
    const providedText = req.body.text;

    try {
        let systemPrompt = "You are a helpful AI assistant.";
        let userMessageContent = [];

        // 1. Handle File Content (Image or PDF)
        if (req.file) {
            const mimeType = req.file.mimetype;
            const fileBuffer = req.file.buffer;

            if (mimeType === 'application/pdf') {
                const markdown = await parseDocumentWithLandingAI(fileBuffer, mimeType, req.file.originalname || 'report.pdf');
                const truncatedText = markdown.substring(0, 15000);

                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "Summarize the following medical document." },
                        { role: "user", content: truncatedText }
                    ],
                    model: "llama-3.3-70b-versatile",
                });

                return res.json({ type: 'pdf_summary', data: { summary_text: completion.choices[0]?.message?.content || "No summary generated." } });

            } else if (mimeType.startsWith('image/')) {
                // Convert buffer to base64 data URI
                const base64Image = fileBuffer.toString('base64');
                const dataUrl = `data:${mimeType};base64,${base64Image}`;

                if (task === 'prescription') {
                    systemPrompt = "You are an expert pharmacist AI. Analyze the medical prescription image and Extract all data into JSON format.";

                    const prompt = `Analyze this prescription image.
                        
                        YOUR TASKS:
                        1. Identify all prescribed medications (name, dosage, frequency).
                        1. Identify all prescribed medications (name, dosage, frequency).
                        2. For each medication, provide a helpful 2-3 sentence description explaining: what the drug is, what condition it treats, how it works in simple terms, and any common side effects to watch for.
                        3. For each medication, suggest 2-3 common market alternatives (generics/brands) with brief descriptions.
                        4. Suggest 2-3 lifestyle interventions relevant to the condition being treated.

                        RETURN ONLY VALID JSON matching this structure:
                        {
                          "medications": [
                            { 
                              "name": "Medication Name", 
                              "dosage": "500mg", 
                              "frequency": "Twice daily", 
                              "type": "Tablet", 
                              "description": "2-3 sentence description: what it is, what it treats, how it works, key side effects.", 
                              "alternatives": [
                                { "name": "Alternative Name", "type": "Generic", "description": "Brief description of the alternative" }
                              ] 
                            }
                          ],
                          "interventions": [
                            { "category": "Diet/Exercise", "title": "Title", "description": "Advice", "impact": "High" }
                          ]
                        }`;

                    const completion = await groq.chat.completions.create({
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: prompt },
                                    { type: "image_url", image_url: { url: dataUrl } }
                                ]
                            }
                        ],
                        model: "meta-llama/llama-4-scout-17b-16e-instruct",
                        temperature: 0.1,
                        response_format: { type: "json_object" }
                    });

                    const responseText = completion.choices[0]?.message?.content;
                    // Try to parse JSON
                    try {
                        const jsonResponse = JSON.parse(responseText);
                        return res.json(jsonResponse);
                    } catch (e) {
                        // Attempt cleanup or return raw
                        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                        try {
                            return res.json(JSON.parse(cleanJson));
                        } catch (e2) {
                            return res.json({ error: "Failed to parse JSON", raw: responseText });
                        }
                    }

                } else {
                    // Generic Image Description
                    const completion = await groq.chat.completions.create({
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: "Describe this image in detail." },
                                    { type: "image_url", image_url: { url: dataUrl } }
                                ]
                            }
                        ],
                        model: "meta-llama/llama-4-scout-17b-16e-instruct"
                    });

                    return res.json({ type: 'image_caption', data: [{ generated_text: completion.choices[0]?.message?.content }] });
                }
            } else {
                return res.status(400).json({ error: 'Unsupported file type.' });
            }
        }

        // 2. Handle Text Input (Simulation)
        if (providedText) {
            if (task === 'prescription') {
                const prompt = `
                    You are an expert pharmacist AI. Analyze the following prescription text and return strictly JSON.
                    
                    TEXT: "${providedText}"

                    RETURN ONLY VALID JSON matching this structure:
                    {
                        "medications": [{ "name": "...", "alternatives": [...] }],
                        "interventions": [...]
                    }
                 `;

                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are an expert pharmacist AI. Return JSON only." },
                        { role: "user", content: prompt }
                    ],
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                });

                const responseText = completion.choices[0]?.message?.content;
                try {
                    return res.json(JSON.parse(responseText));
                } catch (e) {
                    return res.json({ error: "Failed to parse JSON", raw: responseText });
                }
            }
        }

        res.json({ error: "Invalid request parameters" });

    } catch (error) {
        console.error('Groq Analysis Error:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Failed to analyze content', details: error.message });
    }
});

// ── Medical Report Extraction Route (PDF + Image via Landing AI) ────
router.post('/extract-pdf', auth, uploadMiddleware, async (req, res) => {
    console.log("[extract-pdf] Route hit by user:", req.user._id);
    console.log("[extract-pdf] File received:", req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');

    if (!req.file) {
        console.log("[extract-pdf] ERROR: No file uploaded");
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const mimeType = req.file.mimetype;
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    if (!supportedTypes.includes(mimeType)) {
        console.log("[extract-pdf] ERROR: Unsupported mime type:", mimeType);
        return res.status(400).json({ error: `Unsupported file type: ${mimeType}. Supported: PDF, JPEG, PNG, WebP, TIFF` });
    }

    try {
        const fileBuffer = req.file.buffer;
        const filename = req.file.originalname || (mimeType === 'application/pdf' ? 'report.pdf' : 'report.jpg');
        console.log("[extract-pdf] Processing:", filename, "Type:", mimeType);

        // Step 1: Parse document with Landing AI for high-quality text extraction
        const markdown = await parseDocumentWithLandingAI(fileBuffer, mimeType, filename);

        if (!markdown || markdown.trim().length < 10) {
            return res.status(400).json({ error: 'Could not extract meaningful content from the document. The file may be blank or unreadable.' });
        }

        const truncatedText = markdown.substring(0, 15000);

        // Step 2: Send extracted text to Groq for structured medical data extraction
        const extractionPrompt = `You are an expert medical data extraction AI. Analyze the following medical document text and extract ALL relevant medical information.

IMPORTANT: This could be ANY type of medical document — lab report, discharge summary, prescription, imaging report, doctor's notes, health checkup, etc. Extract whatever medical data is present.

INSTRUCTIONS:
1. Identify the document type (e.g., "Lab Report", "Discharge Summary", "Prescription", "Imaging Report", "Health Checkup", etc.)
2. Extract the date from the document if present
3. For lab reports / health checkups: extract ALL test results as biomarkers with numeric values
4. For discharge summaries / doctor's notes: extract key clinical findings as biomarkers where possible (e.g., vitals like BP, heart rate, temperature, SpO2), and capture the rest as a summary
5. For ANY document: extract medications/prescriptions if mentioned
6. Extract diagnosis, clinical findings, and key observations as "findings"

CATEGORY MAPPING FOR BIOMARKERS:
- Metabolic: Glucose, HbA1c, Uric Acid, Cholesterol, Triglycerides, Bilirubin, Albumin, Protein, SGOT, SGPT, ALT, AST, ALP
- Cardiovascular: HDL, LDL, VLDL, Blood Pressure, Systolic, Diastolic, Heart Rate, Pulse
- Hematology: Hemoglobin, Hematocrit, RBC, WBC, Platelets, MCV, MCH, MCHC, ESR, PCV, Neutrophils, Lymphocytes, Eosinophils, Basophils, Monocytes
- Renal: Creatinine, BUN, eGFR, Urea, Uric Acid
- Other: TSH, T3, T4, Vitamin D, Vitamin B12, Iron, Ferritin, Calcium, Sodium, Potassium, Chloride, SpO2, Temperature, BMI, or any other test

RETURN VALID JSON ONLY:
{
    "date": "YYYY-MM-DD or best guess from document",
    "type": "Document type (Lab Report, Discharge Summary, Prescription, etc.)",
    "summary": "2-4 sentence plain-language summary of the document's key findings",
    "biomarkers": [
        {"name": "Test Name", "value": 123.4, "unit": "unit", "category": "Category"}
    ],
    "findings": [
        "Key clinical finding or diagnosis 1",
        "Key clinical finding or diagnosis 2"
    ],
    "prescriptions": [
        {"name": "Medication Name", "dosage": "500mg", "frequency": "Twice daily", "type": "Tablet", "description": "Brief description"}
    ]
}

RULES:
- Extract EVERY numeric test result you can find as a biomarker
- If no numeric biomarkers exist (e.g., discharge summary), the biomarkers array can be empty — that is OK
- Always try to populate "findings" with key medical observations from the document
- Always try to populate "summary" with a brief overview
- For dates, prefer the report/test date, not the patient's birth date
- Do NOT invent or hallucinate values. Only extract what is explicitly in the text.

MEDICAL DOCUMENT TEXT:
${truncatedText}`;

        console.log("Sending extraction request to Groq...");

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are an expert medical document parser. Extract and return ONLY valid JSON. Do not include markdown formatting. Extract ALL available medical data from the document." },
                { role: "user", content: extractionPrompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        console.log("Groq response:", responseText.substring(0, 200));

        let parsed;
        try {
            parsed = JSON.parse(responseText);
            console.log("Successfully parsed JSON. Biomarkers:", parsed.biomarkers?.length, "Findings:", parsed.findings?.length);
        } catch (e) {
            console.log("Initial parse failed, attempting cleanup...");
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').replace(/\n/g, ' ').trim();
            try {
                parsed = JSON.parse(cleanJson);
            } catch (e2) {
                console.error("Final parse failed. Raw response:", responseText);
                return res.status(500).json({ error: 'Failed to parse extraction result', raw: responseText.substring(0, 500) });
            }
        }

        // Ensure arrays exist
        if (!parsed.biomarkers) parsed.biomarkers = [];
        if (!parsed.findings) parsed.findings = [];
        if (!parsed.prescriptions) parsed.prescriptions = [];

        return res.json(parsed);

    } catch (error) {
        console.error('Document Extraction Error:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Failed to extract data from document', details: error.message });
    }
});

module.exports = router;
