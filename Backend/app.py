
import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import pymongo
from bson import ObjectId


import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM


load_dotenv()
app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})


try:
    MONGO_URI = os.getenv("MONGO_ATLAS_URI")
    if not MONGO_URI:
        raise ValueError("MONGO_ATLAS_URI not found in .env file")
    
    client = pymongo.MongoClient(MONGO_URI)
    

    db = client.get_database("trade")
    trades_collection = db.get_collection("trades")
    

    client.admin.command('ping')
    print("✅ MongoDB connected.")
except Exception as e:
    print(f"❌ CRITICAL STARTUP ERROR (MongoDB): {e}")
    trades_collection = None


try:
    print("Loading nl2mongo model... (This may take a moment)")
    MODEL_NAME = "Chirayu/nl2mongo"
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    
    print(f"✅ Model '{MODEL_NAME}' loaded successfully on {device}.")
except Exception as e:
    print(f"❌ CRITICAL STARTUP ERROR (Model): {e}")
    print("   Try running: pip install sentencepiece")
    model = None
    tokenizer = None


def generate_mongo_query(
        textual_query: str,
        num_beams: int = 10,
        max_length: int = 512, 
    ) -> str:
    
    
    if not model or not tokenizer:
        raise Exception("Model is not loaded.")
        
    input_ids = tokenizer.encode(
        textual_query, return_tensors="pt", add_special_tokens=True
    )
    input_ids = input_ids.to(device)
    
    generated_ids = model.generate(
        input_ids=input_ids,
        num_beams=num_beams,
        max_length=max_length,
     
    )
    
    query = [
        tokenizer.decode(
            generated_id,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        )
        for generated_id in generated_ids
    ][0]
    
    return query

def get_schema_for_prompt():
  
    schema = [
        "trade : trades : _id, country_id, commodity_id, year_id, trade_type, value_usd",
        "trade : countries : _id, country_name",
        "trade : commodities : _id, commodity_name",
        "trade : years : _id, year"
    ]
    
    schema.append("relationships : trades.country_id -> countries._id | trades.commodity_id -> commodities._id | trades.year_id -> years._id")
    return " | ".join(schema)

@app.route('/api/trade/query', methods=['GET'])
@app.route('/api/trade/query', methods=['GET'])
def get_trade_data():
    user_query = request.args.get('query')
    if not user_query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    if trades_collection is None:
        return jsonify({"error": "Database not connected"}), 500
    if model is None:
        return jsonify({"error": "AI Model is not loaded"}), 500

    pipeline_json_string = None
    try:
       
        schema = get_schema_for_prompt()
        prompt = f"{user_query} | {schema}"
        print(f"--- Sending to Model ---:\n{prompt}\n-------------------------")

 
        pipeline_json_string = generate_mongo_query(prompt)
        print(f"--- Raw Model Response ---:\n{pipeline_json_string}\n-------------------------")

       
        start_index = pipeline_json_string.find('[')
        end_index = pipeline_json_string.rfind(']')
        
        if start_index == -1 or end_index == -1:
            raise ValueError(f"Model did not return a valid list. Got: {pipeline_json_string}")

        pipeline_string = pipeline_json_string[start_index : end_index + 1]
        
       
        pipeline_string_json = pipeline_string.replace("'", '"')
        
      
        pipeline_string_json = pipeline_string_json.replace('"localfield"', '"localField"')
        pipeline_string_json = pipeline_string_json.replace('"foreignfield"', '"foreignField"')
       

        print(f"--- Cleaned JSON String ---:\n{pipeline_string_json}\n-------------------------")
        
        pipeline_to_execute = json.loads(pipeline_string_json)
        
        if not isinstance(pipeline_to_execute, list):
             raise TypeError("Parsed query is not a list.")

        print(f"--- EXECUTING ---")
        print(json.dumps(pipeline_to_execute, indent=2))
        
    
        results = list(trades_collection.aggregate(pipeline_to_execute))

        
        for doc in results:
            if '_id' in doc and isinstance(doc['_id'], ObjectId):
                doc['_id'] = str(doc['_id'])
            
            if 'country_doc' in doc and isinstance(doc['country_doc'], list) and len(doc['country_doc']) > 0:
                 if '_id' in doc['country_doc'][0] and isinstance(doc['country_doc'][0]['_id'], ObjectId):
                    doc['country_doc'][0]['_id'] = str(doc['country_doc'][0]['_id'])
            

        return jsonify({
            "query": user_query,
            "pipeline": pipeline_to_execute,
            "results": results
        })

    except Exception as e:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"--- CRITICAL ERROR in get_trade_data ---")
        print(f"--- The error was: {e} ---")
        if pipeline_json_string:
            print(f"--- Raw response that failed was: {pipeline_json_string} ---")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)