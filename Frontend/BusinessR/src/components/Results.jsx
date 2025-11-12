import React, { useState } from "react";
import axios from "axios";

function QueryHeader() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleQuery = async () => {
    const res = await axios.post("http://localhost:5000/api/query", { query });
    setResults(res.data.results);
  };

  return (
    <header>
      <input
        type="text"
        placeholder="Ask about Trade..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={handleQuery}>Search</button>
      <div>
        {results.map((r, idx) => (
          <pre key={idx}>{JSON.stringify(r, null, 2)}</pre>
        ))}
      </div>
    </header>
  );
}

export default QueryHeader;
