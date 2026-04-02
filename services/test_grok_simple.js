import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: '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',
    baseURL: 'https://api.x.ai/v1',
});

async function verify() {
    console.log("Starting Grok Verification...");
    try {
        const completion = await openai.chat.completions.create({
            model: 'grok-beta',
            messages: [{ role: 'user', content: 'Say "Grok is Online"' }]
        });
        console.log("Response:", completion.choices[0].message.content);
        console.log("✅ Grok Connection Verified");
    } catch (e) {
        console.error("❌ Grok Verification Failed:", e.message);
    }
}

verify();
