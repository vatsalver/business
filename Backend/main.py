import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv
from openai import OpenAI
from bson import ObjectId

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
mongo_uri = os.getenv("MONGODB_URI")

# Connect to MongoDB
client = MongoClient(mongo_uri)
db = client["Trade"]
collections = {
    "trades": db.trades,
    "countries": db.countries,
    "commodities": db.commodities,
    "years": db.years,
    "impexp": db.impexp
}

# Request model
class QueryRequest(BaseModel):
    query: str

def interpret_natural_language(query: str) -> dict:
    prompt = f"""
    Given the following MongoDB collections in the Trade database:
    - trades: fields: country_id (ObjectId), commodity_id (ObjectId), year_id (ObjectId), trade_type (string), quantity (int), value_usd (int), currency (string), unit_price (float), port (string), created_at (ISODate)
    - impexp: fields: import_export_quantity_in_000_metric_tonnes (string), product (string), april (int), may (int), june (int), july (int), august (int), september (int), october (int), november (int), december (int), january (int), february (int), march (int), total (int)
    -countries: fields: country_code (string), country_name (string), region (string), sub_region (string), iso3 (string), currency (string), population (int)
    - commodities: fields: hs_code (string), commodity_name (string), category (string), unit (string), description (string)
    - years: fields: year (int), description (string)

    Translate this natural language query into a MongoDB filter for the relevant collection(s):
    Query: {query}
    Return only the filter as a JSON object, e.g., {{"trades": {{"trade_type": "Export"}}, "countries": {{"country_name": "India"}}}}
    """
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200
        )
        filter_str = response.choices[0].message.content.strip()
        return eval(filter_str)  # Convert string to dict (be cautious in production)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

@app.post("/search")
async def search(request: QueryRequest):
    try:
        filters = interpret_natural_language(request.query)
        results = {}
        for collection_name, filter_dict in filters.items():
            if collection_name in collections:
                results[collection_name] = list(collections[collection_name].find(filter_dict, {"_id": 0}))
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
