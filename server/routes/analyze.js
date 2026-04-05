const express = require('express');
const router = express.Router();
const multer = require('multer');
const Groq = require('groq-sdk');

// ── Custom PDF text extraction using pdf-parse ──
const { PDFParse } = require('pdf-parse');

const extractPdfText = async (buffer) => {
    try {
        console.log("Starting PDF extraction, buffer size:", buffer.length);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        console.log("Total extracted:", result.text.length, "characters");
        return result.text;
    } catch (e) {
        console.error('PDF extraction error:', e);
        throw new Error(`Failed to extract text from PDF: ${e.message}`);
    }
};

// Test the function once at startup
console.log("PDF extraction module loaded (pdf-parse)");

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
                const text = await extractPdfText(fileBuffer);
                const truncatedText = text.substring(0, 15000); // Reasonable limit

                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "Summarize the following PDF document." },
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

// ── PDF Medical Report Extraction Route ─────────────────────────────
router.post('/extract-pdf', uploadMiddleware, async (req, res) => {
    console.log("PDF extraction route hit");

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const mimeType = req.file.mimetype;
    if (mimeType !== 'application/pdf') {
        return res.status(400).json({ error: 'Only PDF files are supported on this endpoint' });
    }

    try {
        const fileBuffer = req.file.buffer;
        const text = await extractPdfText(fileBuffer);

        if (!text || text.trim().length < 20) {
            return res.status(400).json({ error: 'Could not extract meaningful text from the PDF. The file may be scanned/image-based.' });
        }

        const truncatedText = text.substring(0, 15000);

        const extractionPrompt = `You are an expert medical data extraction AI specializing in parsing lab reports and medical documents.

TASK: Extract medical test results (biomarkers) AND any prescribed medications from the provided medical report text.

INSTRUCTIONS FOR BIOMARKERS:
1. Find every test name, result value, and unit from the report
2. Categorize each test appropriately
3. If date is in report, extract it; otherwise use today's date
4. Report type is usually at the top (e.g., "TEST REPORT", "Lab Report", etc)

INSTRUCTIONS FOR PRESCRIPTIONS:
1. Look for a "Prescriptions", "Medications", "Rx", or "Treatment" section
2. Extract medication name, dosage, and frequency
3. If no prescriptions found, return empty array

CATEGORY MAPPING FOR BIOMARKERS:
- Metabolic: Glucose, HbA1c, Creatinine, Uric Acid, Cholesterol, Triglycerides, eGFR
- Cardiovascular: HDL, LDL, Blood Pressure, Systolic, Diastolic
- Hematology: Hemoglobin, Hematocrit, RBC, WBC, Platelets, HbA1c
- Renal: Creatinine, BUN, eGFR, Urea
- Other: TSH, T3, T4, Thyroid, any other tests

RETURN VALID JSON ONLY - NO MARKDOWN:
{
    "date": "YYYY-MM-DD",
    "type": "Lab Test Report",
    "biomarkers": [
        {"name": "Creatinine", "value": 0.9, "unit": "mg/dL", "category": "Renal"},
        {"name": "Glucose", "value": 114, "unit": "mg/dL", "category": "Metabolic"}
    ],
    "prescriptions": [
        {"name": "Medication Name", "dosage": "500mg", "frequency": "Twice daily", "type": "Tablet", "description": "Brief description"}
    ]
}

MEDICAL REPORT TEXT:
${truncatedText}`;

        console.log("Sending extraction request to Groq...");

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are an expert medical lab report parser. Extract and return ONLY valid JSON. Do not include markdown formatting." },
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
            console.log("Successfully parsed JSON. Biomarkers count:", parsed.biomarkers?.length);
        } catch (e) {
            console.log("Initial parse failed, attempting cleanup...");
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').replace(/\n/g, ' ').trim();
            try {
                parsed = JSON.parse(cleanJson);
                console.log("Successfully parsed cleaned JSON");
            } catch (e2) {
                console.error("Final parse failed. Raw response:", responseText);
                return res.status(500).json({ error: 'Failed to parse extraction result', raw: responseText.substring(0, 500) });
            }
        }

        // Ensure biomarkers array exists and has items
        if (!parsed.biomarkers || !Array.isArray(parsed.biomarkers) || parsed.biomarkers.length === 0) {
            console.warn("No biomarkers extracted. Returning what we have:", parsed);
            return res.json(parsed);
        }

        return res.json(parsed);

    } catch (error) {
        console.error('PDF Extraction Error:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Failed to extract data from PDF', details: error.message });
    }
});

module.exports = router;
