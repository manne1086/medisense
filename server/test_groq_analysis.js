// Using native fetch in Node 18+

// Sample text that mimics OCR output or just direct text input
const sampleText = `
PRESCRIPTION
Patient: Jane Doe
Date: 11/11/2023
Dr. Bob Jones, MD

Rx:
Lisinopril 10mg
Take 1 tablet by mouth daily.

Diagnosis: Hypertension
`;

console.log("--- Simulating Prescription Analysis with Groq (Llama 3.2) ---");
console.log("Input Text:\n", sampleText);
console.log("----------------------------------------");

async function runSimulation() {
    try {
        const response = await fetch('http://localhost:5000/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: 'prescription',
                text: sampleText
            })
        });

        const rawText = await response.text();
        try {
            const data = JSON.parse(rawText);
            console.log("\n--- AI Analysis Result ---");
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("Failed to parse response JSON. Raw output:");
            console.log(rawText);
        }

    } catch (error) {
        console.error("Simulation failed:", error);
    }
}

runSimulation();
