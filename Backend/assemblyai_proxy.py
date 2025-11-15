"""
AssemblyAI WebSocket Proxy for Browser Clients

Since browsers cannot send custom headers with WebSocket connections,
this proxy server handles the authentication and forwards the connection.
"""
import os
import asyncio
import websockets
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY") or os.getenv("VITE_ASSEMBLYAI_API_KEY")

async def proxy_handler(websocket, path):
    """Proxy WebSocket connection to AssemblyAI with authentication"""
    if not ASSEMBLYAI_API_KEY:
        await websocket.close(code=4001, reason="API key not configured")
        return
    
    # Connect to AssemblyAI v3 Streaming API
    assemblyai_url = f"wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true"
    
    try:
        async with websockets.connect(
            assemblyai_url,
            extra_headers={"Authorization": ASSEMBLYAI_API_KEY}
        ) as assemblyai_ws:
            # Forward messages in both directions
            async def forward_to_assemblyai():
                try:
                    async for message in websocket:
                        await assemblyai_ws.send(message)
                except websockets.exceptions.ConnectionClosed:
                    pass
            
            async def forward_to_client():
                try:
                    async for message in assemblyai_ws:
                        await websocket.send(message)
                except websockets.exceptions.ConnectionClosed:
                    pass
            
            # Run both forwarding tasks concurrently
            await asyncio.gather(
                forward_to_assemblyai(),
                forward_to_client()
            )
    except Exception as e:
        print(f"Proxy error: {e}")
        await websocket.close(code=1011, reason=str(e))

def start_proxy_server():
    """Start the WebSocket proxy server"""
    if not ASSEMBLYAI_API_KEY:
        print("WARNING: ASSEMBLYAI_API_KEY not found in environment variables")
        print("WebSocket proxy will not work without an API key")
        return
    
    print(f"Starting AssemblyAI WebSocket proxy on ws://localhost:8765")
    print("Make sure to update the frontend to connect to ws://localhost:8765")
    
    # Note: This requires websockets library: pip install websockets
    # asyncio.run(websockets.serve(proxy_handler, "localhost", 8765))
    # For now, this is a template - you'll need to run it separately or integrate with Flask

if __name__ == "__main__":
    start_proxy_server()

