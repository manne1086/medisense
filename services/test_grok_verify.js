
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: 'xai-i5RSuPg9mQZKA2m5RXAauDf2iuA4TWPz1fvBvwMZADc5MY9zYAnYHOP9pmfsB0I8KIZDM7oPUnf0Zctc',
    baseURL: 'https://api.x.ai/v1',
});

async function verify() {
    console.log("Starting Grok Verification...");
    try {
        const completion = await openai.chat.completions.create({
            model: 'grok-2-1212',
            messages: [{ role: 'user', content: 'Say "Grok is Online"' }]
        });
        console.log("Response:", completion.choices[0].message.content);
        console.log("✅ Grok Connection Verified");
    } catch (e) {
        console.error("❌ Grok Verification Failed Full Error:", JSON.stringify(e, null, 2));
        console.error("Message:", e.message);
    }
}

verify();
