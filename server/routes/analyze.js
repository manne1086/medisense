const express = require('express');
const router = express.Router();
const multer = require('multer');
const Groq = require('groq-sdk');
const pdfParse = require('pdf-parse');

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
                const pdfData = await pdfParse(fileBuffer);
                const text = pdfData.text;
                // Use Llama-3 for text summarization
                // Groq handles context well, but we should be mindful of token limits.
                const truncatedText = text.substring(0, 15000); // Reasonable limit

                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "Summarize the following PDF document." },
                        { role: "user", content: truncatedText }
                    ],
                    model: "llama-3.1-8b-instant", // Use text model for text analysis
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
                        2. For each medication, suggest 2-3 common market alternatives (generics/brands).
                        3. Suggest 2-3 lifestyle interventions relevant to the condition being treated.

                        RETURN ONLY VALID JSON matching this structure:
                        {
                          "medications": [
                            { 
                              "name": "Medication Name", 
                              "dosage": "500mg", 
                              "frequency": "Twice daily", 
                              "type": "Tablet", 
                              "description": "Brief description", 
                              "alternatives": [
                                { "name": "Alternative Name", "type": "Generic", "description": "Cost-effective option" }
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
                        model: "meta-llama/llama-4-scout-17b-16e-instruct", // Updated to Llama 4 Scout Vision
                        temperature: 0.1,
                        response_format: { type: "json_object" } // Force JSON if supported, otherwise rely on prompt
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
                    model: "llama-3.1-8b-instant", // Use text model for text input
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

module.exports = router;
