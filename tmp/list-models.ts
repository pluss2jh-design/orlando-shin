import { GoogleGenAI } from '@google/genai';

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is missing');
        return;
    }
    const client = new GoogleGenAI({ apiKey });
    try {
        console.log('Fetching models...');
        const models = await client.models.list();
        console.log('Models found:', JSON.stringify(models, null, 2));
    } catch (error) {
        console.error('ListModels failed:', error);
    }
}

main();
