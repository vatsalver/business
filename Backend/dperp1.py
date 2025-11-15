import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import pymongo
from bson import ObjectId
from openai import OpenAI


load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

MONGO_URI = os.getenv("MONGO_ATLAS_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client.get_database("Trade")
trades_collection = db.get_collection("trades")
impexp_collection = db.get_collection("impexp")
countries_collection = db.get_collection("countries")
commodities_collection = db.get_collection("commodities")
years_collection = db.get_collection("years")


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
llm_client = OpenAI(api_key=OPENAI_API_KEY)

def get_openai_generated_query(user_query: str) -> dict | None:
    """
    Calls OpenAI API to generate the query. 
    Returns dict: {"collection": "...", "pipeline": [...] }
    """
    # IMPORTANT: This is your refined schema prompt
    schema_instructions = f"""
You are a MongoDB aggregation expert.  
Your job is to convert the user's plain-English question into a concise valid JSON object with these top-level fields only:
{{"collection": "<collection>", "pipeline": [...]}}

The database is named 'Trade' (exact case). It contains these collections and relationships:

1. trades:
   - Fields: _id, country_id (ObjectId), commodity_id (ObjectId), year_id (ObjectId), trade_type ("Export"|"Import"), quantity (Number), value_usd (Number), currency ("USD"), unit_price (Number), port (String), created_at (ISODate)
   - Relationships:
     - trades.country_id → countries._id
     - trades.commodity_id → commodities._id
     - trades.year_id → years._id

2. countries:
   - _id, country_code, country_name, region, sub_region, iso3, currency, population (Number)

3. commodities:
   - _id, hs_code, commodity_name, category, unit, description

4. years:
   - _id, year (Number), description

5. impexp:
   - _id, import_export_quantity_in_000_metric_tonnes ("IMPORT"|"EXPORT"), product (String), april, may, june, july, august, september, october, november, december, january, february, march, total (all Numbers)
     (product is equivalent to commodities.commodity_name)

Instructions:
- Choose 'trades' for queries about: specific trade lines, USD values, units, ports, trades by country/commodity/year, or "top N by value". Always join related info using $lookup and $unwind as needed.
- Choose 'impexp' for: monthly/annual import/export totals, queries using words like "metric tonnes", or product-based aggregated import/export (e.g. LPG, MS, HSD, CRUDE OIL).
- Only use fields exactly as shown (no guessing keys). Only output a JSON object with keys: collection and pipeline.

EXAMPLES:

User: "exports from india"
{{"collection": "trades", "pipeline": [
  {{"$lookup": {{"from": "countries", "localField": "country_id", "foreignField": "_id", "as": "country_doc"}}}},
  {{"$unwind": "$country_doc"}},
  {{"$match": {{"country_doc.country_name": "India", "trade_type": "Export"}}}}
]}}

User: "top 3 commodities by value last year"
{{"collection": "trades", "pipeline": [
  {{"$lookup": {{"from": "years", "localField": "year_id", "foreignField": "_id", "as": "year_doc"}}}},
  {{"$unwind": "$year_doc"}},
  {{"$lookup": {{"from": "commodities", "localField": "commodity_id", "foreignField": "_id", "as": "commodity_doc"}}}},
  {{"$unwind": "$commodity_doc"}},
  {{"$match": {{"year_doc.year": 2024}}}},
  {{"$group": {{"_id": "$commodity_doc.commodity_name", "total_value": {{"$sum": "$value_usd"}}}}}},
  {{"$sort": {{"total_value": -1}}}},
  {{"$limit": 3}}
]}}

User: "monthly import of crude oil"
{{"collection": "impexp", "pipeline": [
  {{"$match": {{"product": "CRUDE OIL", "import_export_quantity_in_000_metric_tonnes": "IMPORT"}}}},
  {{"$project": {{"_id": 0, "product": 1, "april": 1, "may": 1, "june": 1, "july": 1, "august": 1, "september": 1, "october": 1, "november": 1, "december": 1, "january": 1, "february": 1, "march": 1, "total": 1}}}}
]}}

User: "total exports by port"
{{"collection": "trades", "pipeline": [
  {{"$match": {{"trade_type": "Export"}}}},
  {{"$group": {{"_id": "$port", "total_usd": {{"$sum": "$value_usd"}}}}}},
  {{"$sort": {{"total_usd": -1}}}}
]}}

ALWAYS generate only valid JSON using double quotes. Only allowed values for "collection" are: trades, impexp, countries, commodities, years. Ignore any unrelated collections or fields.  
Now, output the JSON query object for this (verbatim) user request:
"{user_query}"
"""
    try:
        completion = llm_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": schema_instructions}],
            response_format={"type": "json_object"},
            temperature=0.0
        )
        response_text = completion.choices[0].message.content
        query_data = json.loads(response_text)
        if "collection" not in query_data or "pipeline" not in query_data:
            raise ValueError("AI response missing 'collection' or 'pipeline' key.")
        if not isinstance(query_data["pipeline"], list):
            if isinstance(query_data["pipeline"], dict):
                query_data["pipeline"] = [query_data["pipeline"]]
            else:
                raise TypeError("AI 'pipeline' value is not a list or dict.")
        return query_data
    except Exception as e:
        print("!!!!!!!! OpenAI query generation error:", e)
        return None


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


@app.route('/api/trade/query', methods=['GET'])
def get_trade_data():
    user_query = request.args.get('query')
    if not user_query:
        return jsonify({"error": "Query parameter is required"}), 400

    query_data = get_openai_generated_query(user_query)
    if query_data is None:
        return jsonify({"error": "AI failed to generate a valid query. See server logs."}), 500

    collection_name = query_data.get("collection")
    pipeline_to_execute = query_data.get("pipeline")
    """ if collection_name == "trades":
        target_collection = trades_collection
    elif collection_name == "impexp":
        target_collection = impexp_collection
    else:
        return jsonify({"error": f"Collection not valid: {collection_name}"}), 500 """
    COLLECTION_MAP = {
    "trades": trades_collection,
    "impexp": impexp_collection,
    "countries": countries_collection,
    "commodities": commodities_collection,
    "years": years_collection
}

    target_collection = COLLECTION_MAP.get(collection_name)
    if target_collection is None:
        return jsonify({"error": f"Collection not valid: {collection_name}"}), 500
    print(f"--- Executing pipeline on '{collection_name}' ---")
    print(json.dumps(pipeline_to_execute, indent=2))
    try:
        results = list(target_collection.aggregate(pipeline_to_execute))
        final_results = convert_objectids(results)
        return jsonify({
            "query": user_query,
            "pipeline": pipeline_to_execute,
            "collection_queried": collection_name,
            "results": final_results
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
