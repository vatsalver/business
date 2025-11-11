
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());


const MONGO_URI = process.env.MONGO_ATLAS_URI;
if (!MONGO_URI) {
    throw new Error("MONGO_ATLAS_URI not found in .env file");
}



let tradesCollection;
let db;

const connectToDB = async () => {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db("trade");
        tradesCollection = db.collection("trades");
        console.log("✅ MongoDB connected.");
    } catch (e) {
        console.error("❌ CRITICAL STARTUP ERROR:", e);
        process.exit(1);
    }
};


const getOllamaGeneratedQuery = async (userQuery) => {

    const OLLAMA_URL = "http://localhost:11434/api/chat";

    const schemaInstructions = `
    You are a world-class MongoDB expert. Your only job is to translate a user's
    natural language query into a valid MongoDB aggregation pipeline.

    You MUST respond with *only* a valid JSON array (a list of stages).
    Your response must start with '[' and end with ']'. Do NOT use markdown \`\`\`json.
    My database schema is:
    - 'trades' (main collection): { country_id: ObjectId, commodity_id: ObjectId, year_id: ObjectId, trade_type: String, value_usd: Number }
    - 'countries': { _id: ObjectId, country_name: String }
    - 'commodities': { _id: ObjectId, commodity_name: String }
    - 'years': { _id: ObjectId, year: Number }
    You MUST use '$lookup' to join these.
    
    --- EXAMPLES ---
    User: "exports from india"
    Your Response:
    [{"$lookup": {"from": "countries", "localField": "country_id", "foreignField": "_id", "as": "country_doc"}}, {"$unwind": "$country_doc"}, {"$match": {"country_doc.country_name": "India", "trade_type": "Export"}}]
    User: "top 5 commodities by value"
    Your Response:
    [{"$lookup": {"from": "commodities", "localField": "commodity_id", "foreignField": "_id", "as": "commodity_doc"}}, {"$unwind": "$commodity_doc"}, {"$group": {"_id": "$commodity_doc.commodity_name", "totalValue": {"$sum": "$value_usd"}}}, {"$sort": {"totalValue": -1}}, {"$limit": 5}]
    --- END EXAMPLES ---
    Now, generate the pipeline for this user query:
    "${userQuery}"
  `;


    const requestBody = {
        model: "llama3",
        format: "json",
        stream: false,
        system: schemaInstructions,
        prompt: userQuery
    };

    let responseText = null;
    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("--- Ollama API Error Response ---", errorData);
            throw new Error(`Ollama API responded with ${response.status}: ${errorData.error}`);
        }

        const data = await response.json();


        responseText = data.message.content;

        console.log(`--- Raw LLM Response ---:\n${responseText}\n-------------------------`);

        let parsedData = JSON.parse(responseText);
        let pipeline = null;

        if (Array.isArray(parsedData)) {
            pipeline = parsedData;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
            pipeline = [parsedData];
        } else {
            throw new Error(`AI returned an unknown data type: ${typeof parsedData}`);
        }


        const pipelineStr = JSON.stringify(pipeline).toLowerCase();
        if (pipelineStr.includes("$where") || pipelineStr.includes("$function")) {
            console.log("❌ DANGEROUS OPERATOR DETECTED. Blocking.");
            return null;
        }
        return pipeline;

    } catch (e) {
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log(`CRITICAL ERROR in getOllamaGeneratedQuery: ${e}`);
        if (responseText) {
            console.log(`Raw response text that failed was: ${responseText}`);
        }
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        return null;
    }
};


app.get('/api/trade/query', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
    }

    if (!tradesCollection) {
        console.error("--- ERROR: DB not connected. ---");
        return res.status(500).json({ error: "Database not connected" });
    }

    let pipelineToExecute = null;
    try {
        pipelineToExecute = await getOllamaGeneratedQuery(query);

        if (!pipelineToExecute || !Array.isArray(pipelineToExecute)) {
            throw new Error("AI query function returned invalid data.");
        }

        console.log(`--- EXECUTING (Type: ${typeof pipelineToExecute}) ---`);
        console.log(JSON.stringify(pipelineToExecute, null, 2));

        const results = await tradesCollection.aggregate(pipelineToExecute).toArray();

        res.json({
            query: query,
            pipeline: pipelineToExecute,
            results: results
        });

    } catch (e) {
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log(`--- CRITICAL ERROR in get_trade_data ---`);
        console.log(`--- The error was: ${e.message} ---`);
        console.log(`--- State of 'pipelineToExecute' when it crashed: ---`);
        console.log(`--- Type: ${typeof pipelineToExecute} ---`);
        console.log(`--- Value: ${JSON.stringify(pipelineToExecute)} ---`);
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

        res.status(500).json({ error: `An error occurred: ${e.message}` });
    }
});


connectToDB().then(() => {
    app.listen(port, () => {
        console.log(`✅ Server running on http://localhost:${port}`);
    });
});