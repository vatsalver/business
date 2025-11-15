import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiMic, FiHome, FiSettings, FiUser } from "react-icons/fi";

const PlaceholderLogo = () => (
  <svg
    width="44"
    height="44"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: "#00FFFF" }} />
        <stop offset="100%" style={{ stopColor: "#00BFFF" }} />
      </linearGradient>
    </defs>
    <text
      x="50%"
      y="52%"
      dominantBaseline="middle"
      textAnchor="middle"
      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      fontSize="60"
      fontWeight="700"
      fill="url(#logoGradient)"
    >
      AH
    </text>
  </svg>
);

const Header = React.forwardRef(
  ({ inputValue, onInputChange, onSearchSubmit, onHomeClick }, ref) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const workletNodeRef = useRef(null);
    const silenceTimeoutRef = useRef(null);
    const lastAudioTimeRef = useRef(null);

    // AssemblyAI API key - should be in environment variable
    const ASSEMBLYAI_API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY || "";

    // Connection parameters for AssemblyAI v3 Streaming API
    const CONNECTION_PARAMS = {
      sample_rate: 16000,
      format_turns: true, // Request formatted final transcripts
    };

    // Build WebSocket URL with query parameters
    const buildWebSocketUrl = (apiKey) => {
      const params = new URLSearchParams();
      params.append("sample_rate", CONNECTION_PARAMS.sample_rate.toString());
      params.append("format_turns", CONNECTION_PARAMS.format_turns.toString());
      // Try adding token as URL parameter (if API supports it)
      if (apiKey) {
        params.append("token", apiKey);
      }
      return `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
    };

    useEffect(() => {
      // Cleanup on unmount
      return () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        stopRecording();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopRecording = (shouldSubmit = false) => {
      // Clear silence detection timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      // Send termination message if WebSocket is open
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        try {
          const terminateMessage = { type: "Terminate" };
          socketRef.current.send(JSON.stringify(terminateMessage));
        } catch (error) {
          console.error("Error sending termination message:", error);
        }
      }

      // Close WebSocket connection
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (error) {
          console.error("Error closing WebSocket:", error);
        }
        socketRef.current = null;
      }

      // Disconnect AudioWorklet
      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }

      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsRecording(false);
      setIsConnecting(false);

      // Submit search if requested (silence detected)
      if (shouldSubmit) {
        // Small delay to ensure transcription is complete
        setTimeout(() => {
          if (inputValue.trim()) {
            console.log("Auto-submitting search after silence:", inputValue);
            onSearchSubmit();
          }
        }, 500); // Wait 500ms for final transcript to arrive
      }
    };

    // Check for silence and auto-stop after 3.5 seconds
    const checkSilence = () => {
      const now = Date.now();
      const SILENCE_THRESHOLD = 3500; // 3.5 seconds

      if (lastAudioTimeRef.current) {
        const timeSinceLastAudio = now - lastAudioTimeRef.current;

        if (timeSinceLastAudio >= SILENCE_THRESHOLD) {
          console.log(
            "Silence detected, stopping recording and submitting search"
          );
          stopRecording(true); // true = submit search
          return;
        }
      }

      // Schedule next check
      if (isRecording) {
        silenceTimeoutRef.current = setTimeout(checkSilence, 500); // Check every 500ms
      }
    };

    // Update last audio time when audio is detected
    const updateAudioActivity = () => {
      lastAudioTimeRef.current = Date.now();
    };

    const startRecording = async () => {
      if (!ASSEMBLYAI_API_KEY) {
        alert(
          "AssemblyAI API key not found. Please set VITE_ASSEMBLYAI_API_KEY in your .env file."
        );
        return;
      }

      try {
        setIsConnecting(true);

        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = stream;

        // Create audio context for processing
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)({
          sampleRate: 16000,
        });
        audioContextRef.current = audioContext;

        // Load AudioWorklet processor
        try {
          await audioContext.audioWorklet.addModule("/audio-processor.js");
        } catch (error) {
          console.error("Error loading AudioWorklet:", error);
          alert(
            "Failed to initialize audio processor. Please refresh the page."
          );
          stopRecording();
          return;
        }

        // Connect to AssemblyAI v3 Streaming API via WebSocket
        // Note: Browser WebSocket doesn't support custom headers
        // We'll try token in URL first, then fallback to first message
        const wsUrl = buildWebSocketUrl(ASSEMBLYAI_API_KEY);
        console.log("Connecting to AssemblyAI v3 Streaming API...");

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        let sessionStarted = false;

        ws.onopen = async () => {
          console.log("WebSocket connection opened.");
          console.log(
            `Connected to: ${wsUrl.replace(/token=[^&]+/, "token=***")}`
          );

          // If token in URL doesn't work, try sending as first message
          // Note: AssemblyAI v3 may require Authorization header via backend proxy
          // See Backend/assemblyai_proxy.py for a proxy solution
          setIsConnecting(false);
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            const msgType = data.type;

            if (msgType === "Begin") {
              const sessionId = data.id;
              const expiresAt = data.expires_at;
              console.log(
                `Session began: ID=${sessionId}, ExpiresAt=${new Date(
                  expiresAt * 1000
                ).toISOString()}`
              );
              sessionStarted = true;

              // Start streaming audio using AudioWorklet after session begins
              const source = audioContext.createMediaStreamSource(stream);
              const workletNode = new AudioWorkletNode(
                audioContext,
                "audio-processor"
              );
              workletNodeRef.current = workletNode;

              workletNode.port.onmessage = (event) => {
                if (event.data.type === "audioActivity") {
                  // Audio detected - update activity time and reset silence timer
                  updateAudioActivity();

                  // Clear existing timeout and restart silence detection
                  if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                  }
                  silenceTimeoutRef.current = setTimeout(checkSilence, 3500); // Check after 3.5s of silence
                } else if (
                  event.data.type === "audioData" &&
                  ws.readyState === WebSocket.OPEN &&
                  sessionStarted
                ) {
                  // Send raw PCM audio data directly (not base64 encoded JSON)
                  const int16Data = new Int16Array(event.data.data);
                  ws.send(int16Data.buffer);
                }
              };

              source.connect(workletNode);
              setIsRecording(true);

              // Initialize silence detection
              lastAudioTimeRef.current = Date.now();
              silenceTimeoutRef.current = setTimeout(checkSilence, 3500); // Start checking after 3.5s
            } else if (msgType === "Turn") {
              // Handle transcription turns
              const transcript = data.transcript || "";
              const formatted = data.turn_is_formatted;

              if (transcript) {
                // Update input with transcript
                const event = {
                  target: { value: transcript },
                };
                onInputChange(event);

                // If this is a formatted (final) transcript and we're about to stop due to silence,
                // ensure we have the latest transcript before submitting
                if (formatted) {
                  // Reset silence timer since we got a final transcript
                  // This gives user a moment to continue speaking if needed
                  if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                  }
                  // Restart silence detection with fresh timer
                  lastAudioTimeRef.current = Date.now();
                  silenceTimeoutRef.current = setTimeout(checkSilence, 3500);
                }
              }
            } else if (msgType === "Termination") {
              const audioDuration = data.audio_duration_seconds;
              const sessionDuration = data.session_duration_seconds;
              console.log(
                `Session Terminated: Audio Duration=${audioDuration}s, Session Duration=${sessionDuration}s`
              );
              stopRecording();
            } else if (msgType === "Error") {
              console.error("AssemblyAI error:", data);
              alert(`Error with voice transcription: ${JSON.stringify(data)}`);
              stopRecording();
            }
          } catch (error) {
            console.error(`Error handling message: ${error}`);
            console.error(`Message data: ${event.data}`);
          }
        };

        ws.onerror = (error) => {
          console.error(`WebSocket Error: ${error}`);
          alert("Error connecting to AssemblyAI. Please check your API key.");
          stopRecording();
        };

        ws.onclose = (event) => {
          console.log(
            `WebSocket Disconnected: Status=${event.code}, Msg=${event.reason}`
          );
          if (event.code !== 1000 && event.code !== 1001) {
            console.error("Unexpected WebSocket closure:", event);
            if (event.code === 1006) {
              console.error(
                "Connection closed abnormally. Check your API key and network connection."
              );
            }
          }
          setIsRecording(false);
        };
      } catch (error) {
        console.error("Error starting recording:", error);
        alert(
          "Failed to start recording. Please check microphone permissions."
        );
        stopRecording();
      }
    };

    const handleMicClick = async (e) => {
      e.preventDefault();
      if (isRecording) {
        stopRecording();
      } else {
        await startRecording();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (isRecording) {
          stopRecording();
        }
        onSearchSubmit();
      }
    };

    const handleLogoClick = (e) => {
      e.preventDefault();
      if (onHomeClick) onHomeClick();
    };

    const handleHomeButtonClick = (e) => {
      e.preventDefault();
      if (onHomeClick) onHomeClick();
    };

    return (
      <header className="bg-gray-700 text-gray-200 p-4 shadow-lg w-full sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
            aria-label="Go to home"
          >
            <PlaceholderLogo />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Aalmost Human
              </h1>
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                AI Company
              </p>
            </div>
          </button>

          <div className="flex items-center space-x-8">
            <div className="relative flex items-center hidden md:flex">
              <input
                ref={ref}
                type="text"
                placeholder="AI Search..."
                className="bg-gray-800 text-white placeholder-gray-500 rounded-full py-2.5 px-5 pl-12 
                         focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all 
                         w-186 text-base"
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={handleKeyDown}
              />

              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg" />
              <button
                onClick={handleMicClick}
                disabled={isConnecting}
                className={`ml-2 p-2 rounded-full focus:outline-none focus:ring-2 
                         focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all 
                         flex items-center justify-center ${
                           isRecording
                             ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                             : isConnecting
                             ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                             : "bg-cyan-600 hover:bg-cyan-500 text-white"
                         }`}
                aria-label={
                  isRecording ? "Stop recording" : "Start voice search"
                }
                title={isRecording ? "Stop recording" : "Start voice search"}
              >
                <FiMic size={22} />
              </button>
              {isRecording && (
                <span className="ml-2 text-xs text-red-400 animate-pulse">
                  Recording...
                </span>
              )}
            </div>

            <nav className="flex items-center space-x-5">
              <button
                onClick={handleHomeButtonClick}
                className="text-gray-400 hover:text-cyan-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-700 rounded p-1"
                title="Home"
                aria-label="Go to home"
              >
                <FiHome size={22} />
              </button>
              <a
                href="#"
                className="text-gray-400 hover:text-cyan-400 transition-colors duration-200"
                title="Settings"
              >
                <FiSettings size={22} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-cyan-400 transition-colors duration-200"
                title="Profile"
              >
                <FiUser size={22} />
              </a>
            </nav>
            <div className="text-right">
              <span className="text-sm font-medium text-white">Hi, User!</span>
            </div>
          </div>
        </div>
      </header>
    );
  }
);

export default Header;
