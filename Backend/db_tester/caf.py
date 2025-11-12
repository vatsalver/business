import os
import pymongo
import pprint
from dotenv import load_dotenv

def main():
    """
    Connects to the MongoDB Atlas cluster and fetches data from
    the collection specified by the user.
    """
    try:
       
        load_dotenv()
        MONGO_URI = os.getenv("MONGO_ATLAS_URI")
        
        if not MONGO_URI:
            print("ERROR: MONGO_ATLAS_URI not found in .env file.")
            print("Please create a .env file with your connection string.")
            return

       
        print("Connecting to MongoDB Atlas...")
        client = pymongo.MongoClient(MONGO_URI)
        
       
        client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        
        
        db = client.get_database("Trade")
        print(f"Accessing database: '{db.name}'")
        
        
        collection_names = db.list_collection_names()
        print(f"Found collections: {collection_names}")
        
        if not collection_names:
            print("ERROR: No collections found in this database.")
            return

     
        while True:
            print("\n-------------------------------------------------")
            collection_name = input(f"Enter a collection name to fetch (or 'exit' to quit): \n{collection_names}\n> ")
            
            if collection_name == "exit":
                break
                
            if collection_name not in collection_names:
                print(f"ERROR: Collection '{collection_name}' does not exist.")
                continue

            
            print(f"Fetching first 5 documents from '{collection_name}'...")
            collection = db.get_collection(collection_name)
            
            
            documents = list(collection.find().limit(5))
            
            if not documents:
                print(f"No documents found in '{collection_name}'.")
            else:
                print(f"--- Found {len(documents)} documents ---")
             
                pprint.pprint(documents)

    except pymongo.errors.ConfigurationError:
        print("ERROR: Invalid connection string. Check your .env file.")
    except pymongo.errors.OperationFailure as e:
        print(f"ERROR: MongoDB operation failed (check username/password): {e.details}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if 'client' in locals():
            client.close()
            print("MongoDB connection closed.")

if __name__ == "__main__":
    main()