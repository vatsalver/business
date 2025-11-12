import os
import sys
from google import genai
from dotenv import load_dotenv

def main():
    """
    Starts a simple, interactive chat session with the Google Gemini API.
    """
    
    # --- 1. Load API Key ---
    load_dotenv()
    # Note: The 'google-ai' library automatically looks for GEMINI_API_KEY
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ ERROR: GEMINI_API_KEY not found in .env file.")
        print("Please create a .env file and add your API key.")
        sys.exit(1)

    # --- 2. Initialize Client ---
    try:
        client = genai.Client()
        # Test the connection by listing models
        client.models.list() 
        print("✅ Google AI client initialized and API key is valid.")
    except Exception as e:
        print(f"❌ CRITICAL ERROR: Could not initialize Google AI client.")
        print(f"   Details: {e}")
        print("   This is likely an invalid API key, a billing issue, or the API is not enabled in your Google Cloud project.")
        sys.exit(1)

    # --- 3. The Chat Loop ---
    print("\n--- 🤖 Google Gemini Chat ---")
    print("Using model: gemini-2.5-flash")
    print("Type 'exit' or 'quit' to end the conversation.")
    print("-----------------------------------")

    while True:
        try:
            # 1. Get user input
            user_input = input("You: ")
            
            if user_input.lower() in ['exit', 'quit']:
                print("\n👋 Goodbye!")
                break
                
            if not user_input:
                continue

            # 2. Send to Google AI
            print("\n...AI is thinking...\n")
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=user_input
            )

            # 3. Get the AI's response
            ai_response = response.text
            print(f"Gemini: {ai_response}\n")

        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ An error occurred: {e}")
            break

if __name__ == "__main__":
    main()