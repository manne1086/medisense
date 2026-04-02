import fs from 'fs';
import os from 'os';

const API_KEY = 'sk_je0mb4qg_XZfcPoQSgGvvTADq5rFlUikj';

async function testSTT() {
  try {
    const filePath = 'C:\\Windows\\Media\\tada.wav';
    const audioBuffer = fs.readFileSync(filePath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'tada.wav');
    formData.append('model', 'saaras:v3');

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      fs.writeFileSync('err.json', err);
      process.exit(1);
    }
    const data = await response.json();
    fs.writeFileSync('out.json', JSON.stringify(data));
  } catch(e) {
    fs.writeFileSync('err.json', String(e));
  }
}

testSTT();
