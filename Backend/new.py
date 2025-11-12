from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import openai
import json
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database schema information for AI context
SCHEMA_INFO = """
You are a MongoDB query assistant for a Trade database with 5 collections:

1. trades collection:
   - country_id: ObjectId (reference to countries)
   - commodity_id: ObjectId (reference to commodities)
   - year_id: ObjectId (reference to years)
   - trade_type: string ("Export" or "Import")
   - quantity: integer
   - value_usd: integer
   - currency: string
   - unit_price: float
   - port: string
   - created_at: ISO datetime string

2. impexp collection:
   - import_export_quantity_in_000_metric_tonnes: string ("IMPORT" or "EXPORT")
   - product: string (e.g., "CRUDE OIL")
   - april, may, june, july, august, september, october, november, december, january, february, march: integers (monthly values)
   - total: integer

3. countries collection:
   - country_code: string (e.g., "IN")
   - country_name: string (e.g., "India")
   - region: string
   - sub_region: string
   - iso3: string
   - currency: string
   - population: integer

4. commodities collection:
   - hs_code: string
   - commodity_name: string (e.g., "Rice")
   - category: string
   - unit: string
   - description: string

5. years collection:
   - year: integer (e.g., 2022)
   - description: string

Return a JSON object with:
- collection: which collection to query
- pipeline: MongoDB aggregation pipeline array (use $lookup for joins)
- filter: simple find filter object (if not using aggregation)
- limit: number of results to return

For queries mentioning specific commodities (like rice), years, or countries, use $lookup to join collections.
Always include a reasonable limit (default 100, or as specified in query).
"""

def convert_objectid(obj):
    """Convert ObjectId to string in MongoDB documents"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_objectid(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid(item) for item in obj]
    return obj

def get_db_connection(mongodb_uri):
    """Establish MongoDB connection"""
    try:
        client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        db = client['Trade']
        return db
    except Exception as e:
        raise Exception(f"MongoDB connection failed: {str(e)}")

def interpret_query_with_openai(query_text, openai_api_key):
    """Use OpenAI to interpret natural language query and generate MongoDB query"""
    try:
        openai.api_key = openai_api_key
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": SCHEMA_INFO},
                {"role": "user", "content": f"Convert this natural language query to MongoDB query parameters: {query_text}"}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        # Parse the response
        query_params = json.loads(response.choices[0].message.content)
        return query_params
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse OpenAI response: {str(e)}")
    except Exception as e:
        raise Exception(f"OpenAI API error: {str(e)}")

def execute_mongodb_query(db, query_params):
    """Execute MongoDB query based on parameters from OpenAI"""
    try:
        collection_name = query_params.get('collection', 'trades')
        collection = db[collection_name]
        
        limit = query_params.get('limit', 100)
        
        # Check if we should use aggregation pipeline
        if 'pipeline' in query_params and query_params['pipeline']:
            pipeline = query_params['pipeline']
            # Add limit to pipeline
            pipeline.append({'$limit': limit})
            results = list(collection.aggregate(pipeline))
        elif 'filter' in query_params:
            # Use simple find query
            filter_query = query_params['filter']
            results = list(collection.find(filter_query).limit(limit))
        else:
            # Default: return recent documents
            results = list(collection.find().limit(limit))
        
        # Convert ObjectId to string
        results = convert_objectid(results)
        
        return {
            'data': results,
            'metadata': {
                'collection': collection_name,
                'count': len(results),
                'query_type': 'aggregation' if 'pipeline' in query_params else 'find'
            }
        }
    except Exception as e:
        raise Exception(f"MongoDB query execution failed: {str(e)}")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'Trade Data Query API'
    })

@app.route('/api/query', methods=['POST'])
def process_query():
    """Main endpoint to process natural language queries"""
    start_time = time.time()
    
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        query_text = data.get('query', '')
        mongodb_uri = data.get('mongodb_uri', os.getenv('MONGODB_ATLAS_URI'))
        openai_api_key = data.get('openai_api_key', os.getenv('OPENAI_API_KEY'))
        
        # Validate inputs
        if not query_text:
            return jsonify({'error': 'Query text is required'}), 400
        
        if not mongodb_uri:
            return jsonify({'error': 'MongoDB URI is required'}), 400
        
        if not openai_api_key:
            return jsonify({'error': 'OpenAI API key is required'}), 400
        
        # Step 1: Connect to MongoDB
        db = get_db_connection(mongodb_uri)
        
        # Step 2: Interpret query with OpenAI
        query_params = interpret_query_with_openai(query_text, openai_api_key)
        
        # Step 3: Execute MongoDB query
        results = execute_mongodb_query(db, query_params)
        
        # Add timing information
        query_time = round(time.time() - start_time, 3)
        results['metadata']['query_time'] = f"{query_time}s"
        results['metadata']['original_query'] = query_text
        
        return jsonify(results), 200
        
    except Exception as e:
        error_message = str(e)
        print(f"Error processing query: {error_message}")
        return jsonify({
            'error': error_message,
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/api/config-status', methods=['POST'])
def check_config():
    """Check if configuration is valid"""
    try:
        data = request.get_json()
        mongodb_uri = data.get('mongodb_uri', os.getenv('MONGODB_ATLAS_URI'))
        openai_api_key = data.get('openai_api_key', os.getenv('OPENAI_API_KEY'))
        
        status = {
            'mongodb_configured': bool(mongodb_uri),
            'openai_configured': bool(openai_api_key)
        }
        
        # Test MongoDB connection if URI provided
        if mongodb_uri:
            try:
                db = get_db_connection(mongodb_uri)
                collections = db.list_collection_names()
                status['mongodb_connected'] = True
                status['collections_found'] = collections
            except Exception as e:
                status['mongodb_connected'] = False
                status['mongodb_error'] = str(e)
        
        return jsonify(status), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Get port from environment or use default
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'production') == 'development'
    
    print(f"Starting Flask server on port {port}...")
    print(f"Debug mode: {debug}")
    print("API Endpoints:")
    print("  - GET  /api/health")
    print("  - POST /api/query")
    print("  - POST /api/config-status")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
