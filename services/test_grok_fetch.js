const apiKey = process.env.API_KEY || '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';

console.log("Testing Grok with raw fetch...");
console.log("Key length:", apiKey.length);

async function testFetch() {
    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-beta',
                messages: [
                    { role: 'system', content: 'You are a test.' },
                    { role: 'user', content: 'Hello' }
                ],
                stream: false
            })
        });

        console.log("Status:", response.status);
        console.log("Status Text:", response.statusText);

        const data = await response.json();
        console.log("Body:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testFetch();
