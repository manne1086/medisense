
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: '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',
    baseURL: 'https://api.groq.com/openai/v1',
});

async function verify() {
    console.log("Starting Groq Cloud Verification...");
    try {
        const completion = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Say "Groq is Online"' }]
        });
        console.log("Response:", completion.choices[0].message.content);
        console.log("✅ Grok Cloud Connection Verified");
    } catch (e) {
        console.error("❌ Grok Cloud Verification Failed Full Error:", JSON.stringify(e, null, 2));
        console.error("Message:", e.message);
    }
}

verify();
