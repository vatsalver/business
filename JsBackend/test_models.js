import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';


dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("❌ ERROR: GOOGLE_API_KEY not found in .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

async function listModels() {
    try {
        console.log("Connecting to Google AI to list models...");


        const models = await genAI.listModels();

        console.log("--- ✅ SUCCESS! Available Models ---");

        for (const m of models) {

            if (m.supportedGenerationMethods.includes('generateContent')) {
                console.log(`\nModel name: ${m.name}`);
                console.log(`  Description: ${m.description}`);
                console.log(`  Supported Methods: ${m.supportedGenerationMethods}`);
            }
        }

        console.log("\n-------------------------------------");
        console.log("Find a model name in this list (like 'models/gemini-pro') and paste it into your server.js file.");

    } catch (e) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("CRITICAL ERROR while trying to list models:", e.message);
        console.error("This almost always means your API key is invalid or the 'Generative Language API' is not enabled in your Google Cloud project.");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    }
}

listModels();