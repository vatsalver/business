# --- V_PYTHON_GOOGLE_AI_FINAL ---
import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import pymongo
from bson import ObjectId
from google import genai # The library that works

# --- 1. App Setup ---
load_dotenv()
app = Flask(__name__)
# Make sure this port matches your React app (e.g., 5173)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}}) 

# --- 2. Database Connection ---
try:
    MONGO_URI = os.getenv("MONGO_ATLAS_URI")
    if not MONGO_URI:
        raise ValueError("MONGO_ATLAS_URI not found in .env file")
    
    client = pymongo.MongoClient(MONGO_URI)
    
    # --- THIS IS YOUR SCHEMA ---
    db = client.get_database("Trade") # Your DB is "Trade" (capital T)
    trades_collection = db.get_collection("trades")
    countries_collection = db.get_collection("countries")
    commodities_collection = db.get_collection("commodities")
    years_collection = db.get_collection("years")
    impexp_collection = db.get_collection("impexp") # The 5th collection
    # --- END SCHEMA ---

    client.admin.command('ping')
    print("✅ MongoDB connected.")
except Exception as e:
    print(f"❌ CRITICAL STARTUP ERROR (MongoDB): {e}")
    trades_collection = None
    impexp_collection = None

# --- 3. Google AI Client Setup ---
llm_client = None
try:
    # This automatically finds the GEMINI_API_KEY from your .env file
    llm_client = genai.Client()
    llm_client.models.list() 
    print("✅ Google AI client initialized and key is valid.")
except Exception as e:
    print(f"❌ CRITICAL STARTUP ERROR (Google AI): {e}")

# --- 4. The Query Generation Function ---
def get_gemini_generated_query(user_query: str) -> dict | None:
    """
    Calls the Google AI API to generate the query.
    Returns a dictionary: {"collection": "...", "pipeline": [...] }
    """
    if not llm_client:
        raise Exception("Google AI client is not initialized.")
    
    # --- THIS IS THE NEW, CORRECTED PROMPT ---
    # It includes ALL your fields and collections.
    schema_instructions = f"""
    You are a world-class MongoDB expert. Your only job is to translate a user's
    natural language query into a valid JSON object.
    
    The JSON object you return MUST have this structure:
    {{"collection": "<collection_to_query>", "pipeline": [...]}}

    I have two types of data in the 'Trade' database:
    
    1. NORMALIZED DATA (for specific trade details):
       - 'trades' (main collection): {{ _id, country_id, commodity_id, year_id, trade_type, quantity, value_usd, port }}
       - 'countries': {{ _id, country_code, country_name, region, sub_region }}
       - 'commodities': {{ _id, hs_code, commodity_name, category, unit }}
       - 'years': {{ _id, year, description }}
       Relationships:
       - trades.country_id -> countries._id
       - trades.commodity_id -> commodities._id
       - trades.year_id -> years._id

    2. AGGREGATED MONTHLY DATA (for totals and monthly trends):
       - 'impexp': {{ import_export_quantity_in_000_metric_tonnes, product, april, may, june, july, august, september, october, november, december, january, february, march, total }}
       (Note: 'product' in 'impexp' is like 'commodity_name' in 'commodities')
       (Note: 'import_export_quantity_in_000_metric_tonnes' is either "IMPORT" or "EXPORT")

    You must CHOOSE which collection to query based on the user's request.
    - If the user asks for *specific trades*, *ports*, or *USD values*, use the 'trades' collection and $lookup.
    - If the user asks for *monthly totals*, *quantities in metric tonnes*, or "LPG", "MS", "HSD", use the 'impexp' collection.

    --- EXAMPLES ---
    User: "exports from india"
    Your Response:
    {{"collection": "trades", "pipeline": [
      {{"$lookup": {{"from": "countries", "localField": "country_id", "foreignField": "_id", "as": "country_doc"}}}},
      {{"$unwind": "$country_doc"}},
      {{"$match": {{"country_doc.country_name": "India", "trade_type": "Export"}}}}
    ]}}

    User: "top 5 commodities by value"
    Your Response:
    {{"collection": "trades", "pipeline": [
      {{"$lookup": {{"from": "commodities", "localField": "commodity_id", "foreignField": "_id", "as": "commodity_doc"}}}},
      {{"$unwind": "$commodity_doc"}},
      {{"$group": {{"_id": "$commodity_doc.commodity_name", "totalValue": {{"$sum": "$value_usd"}}}}}},
      {{"$sort": {{"totalValue": -1}}}},
      {{"$limit": 5}}
    ]}}
    
    User: "monthly import of crude oil"
    Your Response:
    {{"collection": "impexp", "pipeline": [
      {{"$match": {{"product": "CRUDE OIL", "import_export_quantity_in_000_metric_tonnes": "IMPORT"}}}},
      {{"$project": {{"_id": 0, "product": 1, "april": 1, "may": 1, "june": 1, "july": 1, "august": 1, "september": 1, "october": 1, "november": 1, "december": 1, "january": 1, "february": 1, "march": 1}}}}
    ]}}
    --- END EXAMPLES ---

    Now, generate the JSON object for this user query:
    "{user_query}"
    """
    
    # We use .format() and double curly braces {{...}}
    final_prompt = schema_instructions.format(user_query=user_query)
    response_text = None
    
    try:
        response = llm_client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=final_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        response_text = response.text
        
        print(f"--- Raw LLM Response ---:\n{response_text}\n-------------------------")
        
        # The response_text *is* the JSON. We just need to parse it.
        query_data = json.loads(response_text)

        # Validate the structure
        if "collection" not in query_data or "pipeline" not in query_data:
            raise ValueError("AI response missing 'collection' or 'pipeline' key.")
        
        if not isinstance(query_data["pipeline"], list):
            raise TypeError("AI 'pipeline' value is not a list.")

        return query_data

    except Exception as e:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"CRITICAL ERROR in get_gemini_generated_query: {e}")
        if response_text:
            print(f"Raw response text that failed was: {response_text}")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        return None

# --- 5. API Endpoint ---
@app.route('/api/trade/query', methods=['GET'])
def get_trade_data():
    user_query = request.args.get('query')
    if not user_query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    if trades_collection is None or impexp_collection is None:
        return jsonify({"error": "Database not connected"}), 500
    if llm_client is None:
        return jsonify({"error": "AI Model is not configured"}), 500

    query_data = None
    try:
        query_data = get_gemini_generated_query(user_query)

        if query_data is None:
            raise ValueError("AI query function returned None. Check server log for LLM errors.")

        collection_name = query_data.get("collection")
        pipeline_to_execute = query_data.get("pipeline")

        # --- THIS IS THE NEW ROUTING LOGIC ---
        target_collection = None
        if collection_name == "trades":
            target_collection = trades_collection
        elif collection_name == "impexp":
            target_collection = impexp_collection
        else:
            raise ValueError(f"AI returned an invalid collection name: {collection_name}")
        # --- END ROUTING LOGIC ---

        print(f"--- EXECUTING on collection '{collection_name}' ---")
        print(json.dumps(pipeline_to_execute, indent=2))
        
        results = list(target_collection.aggregate(pipeline_to_execute))

        # Helper function to convert ObjectIds to strings
        def convert_objectids(doc):
            if isinstance(doc, list):
                return [convert_objectids(item) for item in doc]
            if isinstance(doc, dict):
                for key, value in doc.items():
                    if isinstance(value, ObjectId):
                        doc[key] = str(value)
                    elif isinstance(value, (dict, list)):
                        doc[key] = convert_objectids(value)
            return doc

        final_results = convert_objectids(results)

        return jsonify({
            "query": user_query,
            "pipeline": pipeline_to_execute,
            "collection_queried": collection_name,
            "results": final_results
        })

    except Exception as e:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"--- CRITICAL ERROR in get_trade_data ---")
        print(f"--- The error was: {e} ---")
        if query_data:
            print(f"--- Query data that failed was: {json.dumps(query_data)} ---")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- 6. Run the App ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)