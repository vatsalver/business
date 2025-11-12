# AI NLSQL 🤖

An AI-powered, full-stack web application that translates natural language questions into complex MongoDB aggregation pipelines to query and visualize a global trade database.

---

## Table of Contents

-   [Overview](#overview)
-   [Features](#features)
-   [System-Architecture](#system-architecture)
-   [Tech-Stack](#tech-stack)
-   [Database-Schema](#database-schema)
-   [Prerequisites](#prerequisites)
-   [Installation](#installation)
-   [Running-the-Project](#running-the-project)
-   [API-Endpoints](#api-endpoints)
-   [Project-Structure](#project-structure)
-   [Future-Improvements](#future-improvements)

---

## Overview

**AI NLSQL** (Natural Language to "SQL") is a data intelligence platform that removes the barrier between complex data and the users who need to query it. Instead of writing complex MongoDB aggregation queries with multiple `$lookup` and `$match` stages, users can simply ask questions in plain English, such as:

* *"What were the top 5 commodities exported from India in 2024?"*
* *"Show me all imports of Crude Oil for 2023."*
* *"Compare the trade value of Rice vs. Wheat."*

The backend, powered by a Python Flask server, intercepts this natural language query. It then dynamically generates a detailed prompt, including the database schema, and sends it to an AI model (like OpenAI's GPT or a local Ollama model). The AI returns a complex MongoDB aggregation pipeline as a JSON string. The server parses, validates, and executes this pipeline against a normalized MongoDB Atlas database, returning the final data to the React frontend for display.

## Features

* **Conversational AI Querying:** Ask complex analytical questions in plain English.
* **AI-to-Query Translation:** A robust Python backend translates natural language into secure, complex MongoDB aggregation pipelines.
* **Normalized Database:** Utilizes a relational-style MongoDB structure (with `trades`, `countries`, `commodities`, `years`) for efficient and scalable data storage.
* **Dynamic React Frontend:** A responsive UI that dynamically renders the raw JSON data returned from the API, along with the query that was generated.
* **Pluggable AI Backend:** Easily switch between different AI providers:
    * **OpenAI** (`gpt-4o-mini`, etc.)
    * **Hugging Face API** (`deepseek-ai/deepseek-coder`, `Chirayu/nl2mongo`)
    * **Local LLM** (Ollama, using `llama3` or `gemma:2b`)

## System Architecture

The application operates on a client-server model with a separate AI processing step.

[Image of a data flow diagram for AI NLSQL, showing React, Flask, AI API, and MongoDB]

1.  **React Frontend:** The user types a query (e.g., "top 5 products") into the search bar.
2.  **Flask Backend:** The React app sends a `GET` request to the `/api/trade/query` endpoint with the query string.
3.  **AI Model (Query Generation):**
    * The Flask server builds a detailed **system prompt** containing the MongoDB schema and examples.
    * It sends this prompt and the user's query to the configured AI (e.g., OpenAI).
    * The AI model returns a **JSON string** representing the MongoDB aggregation pipeline.
4.  **Flask Backend (Execution):**
    * The server receives the JSON string.
    * It **parses and sanitizes** the string (e.g., fixing `localfield` to `localField` if using `nl2mongo`).
    * It executes this pipeline on the **MongoDB Atlas** database using `pymongo`.
5.  **MongoDB Atlas:** The database processes the complex query (with `$lookup`s) and returns the data.
6.  **React Frontend:** The Flask server sends the final `results` (along with the `pipeline` for debugging) back to the React client, which displays it.

---

## Tech Stack

### Frontend (Client)

* **React.js:** A JavaScript library for building user interfaces.
* **Vite:** Frontend tooling for a fast development environment.
* **Tailwind CSS:** A utility-first CSS framework for rapid UI styling.
* **`fetch` API:** For making API requests to the backend.

### Backend (Server)

* **Python 3.10+**
* **Flask:** A lightweight web server for the API.
* **`pymongo`:** The Python driver for MongoDB.
* **`python-dotenv`:** For managing environment variables.
* **`requests`:** For making requests to the Hugging Face API.
* **`openai` / `google-generative-ai` / `mistralai`:** AI client libraries (depending on the chosen backend).
* **Ollama:** For local LLM support.

### Database

* **MongoDB Atlas:** A fully-managed cloud database.

---

## Database Schema

The data is normalized across 5 collections in the `Trade` database, as shown in the provided JSON files.

* **`trades`:** The main transaction table.
    * `country_id`: `ObjectId` (links to `countries._id`)
    * `commodity_id`: `ObjectId` (links to `commodities._id`)
    * `year_id`: `ObjectId` (links to `years._id`)
    * `trade_type`: (String) "Import" or "Export"
    * `value_usd`: (Number)
* **`countries`:**
    * `_id`: `ObjectId`
    * `country_name`: (String)
* **`commodities`:**
    * `_id`: `ObjectId`
    * `commodity_name`: (String)
* **`years`:**
    * `_id`: `ObjectId`
    * `year`: (Number)
* **`impexp`:** (Note: This collection is separate and not used in the main `$lookup` query, but contains monthly aggregate data).

---

## Prerequisites

* **Node.js** (v18+) and **npm**
* **Python** (v3.10+) and **pip**
* A **MongoDB Atlas** account.
    * Create a cluster (e.g., "trading").
    * Create a database (e.g., "Trade").
    * Import your JSON files (`trades.json`, `countries.json`, etc.) into their respective collections.
    * Get your connection string.
* **API Keys:**
    * Create a `.env` file in the `/server` directory.
    * Add your `MONGO_ATLAS_URI`.
    * Add your chosen AI provider's API key (e.g., `OPENAI_API_KEY` or `HF_TOKEN`).

---

## Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/](https://github.com/)[your-username]/ai-nlsql.git
    cd ai-nlsql
    ```

2.  **Set up the Backend (Python):**
    ```bash
    # Navigate to the backend folder
    cd server 

    # Create and activate a virtual environment
    python -m venv venv
    .\venv\Scripts\activate  # Windows
    # source venv/bin/activate   # macOS/Linux

    # Install Python dependencies
    pip install -r requirements.txt

    # Create your .env file
    # (Copy .env.example or create a new .env)
    # Add your MONGO_ATLAS_URI and AI API Key
    ```

3.  **Set up the Frontend (React):**
    ```bash
    # From the root, navigate to the frontend folder
    cd ../client

    # Install Node.js dependencies
    npm install
    ```

---

## Running the Project

You must have **two terminals** open.

### Terminal 1: Run the Backend (Flask)

```bash
# In the /server folder
# Activate your venv
.\venv\Scripts\activate

# Run the Flask app
python app.py
```
###Your backend will be running at http://localhost:5000.

### Terminal 2: Run the Frontend (React)

```bash
# In the /client folder
# Run the React development server
npm run dev
```
Your frontend will open at http://localhost:5173 (or a similar port). You can now use the app.
