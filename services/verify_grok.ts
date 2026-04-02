import { analyzeSymptoms, chatWithAssistant } from './grokService';

async function verifyGrok() {
    console.log("Verifying Grok Service...");

    // 1. Test Chat
    console.log("\nTesting Chat...");
    try {
        const history = [{ role: 'user', text: 'Hello, who are you?' }];
        const response = await chatWithAssistant(history, 'Tell me quickly what you do.');
        console.log("Chat Response:", response);
        if (response && response.length > 0) console.log("✅ Chat Verified");
        else console.error("❌ Chat Failed");
    } catch (e) {
        console.error("❌ Chat Error:", e);
    }

    // 2. Test Triage (Symptoms)
    console.log("\nTesting Triage...");
    try {
        const result = await analyzeSymptoms("I have a severe headache and sensitivity to light.");
        console.log("Triage Result:", JSON.stringify(result, null, 2));
        if (result.severity && result.rootCauses) console.log("✅ Triage Verified");
        else console.error("❌ Triage Failed (Invalid JSON structure)");
    } catch (e) {
        console.error("❌ Triage Error:", e);
    }
}

// Check if we need to polyfill anything for Node execution of TS file
// Since we can't easily run TS directly without setup, we might need to rely on the fact that existing code imports types.
// However, the service file is written in TS.
// To run this verify script, we need to use ts-node or compile it.
// Assuming user environment has ts-node or similar.
// If not, we will rely on manual verification instructions.

verifyGrok();
