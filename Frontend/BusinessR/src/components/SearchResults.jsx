import React, { useEffect, useState } from "react";

const SearchResults = ({ query }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!query) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await fetch(
          `http://localhost:5000/api/trade/query?query=${encodeURIComponent(
            query
          )}`
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData.error || `HTTP error! status: ${response.status}`
          );
        }

        const resultData = await response.json();
        setData(resultData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query]);

  if (loading) {
    return (
      <div className="container mx-auto p-8 text-white flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
        <p className="ml-4 text-lg text-gray-300">
          Asking AI to analyze data for "{query}"...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p className="text-xl text-red-400">Error: {error}</p>
        <p className="text-gray-400 mt-2">
          The AI translator or database may have failed. Please try a different
          query.
        </p>
      </div>
    );
  }

  if (!data || !data.results) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p className="text-xl text-gray-400">No results found for "{query}".</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 text-white animate-fadeIn">
      <h2 className="text-3xl font-bold mb-4 text-gray-200">
        Results for: "<span className="text-cyan-400">{data.query}</span>"
      </h2>

      <div className="bg-gray-900 p-6 rounded-lg shadow-xl border border-gray-700">
        <h3 className="font-semibold text-xl text-white mb-4">
          Raw Data Output
        </h3>
        {data.results.length === 0 ? (
          <p className="text-gray-400">
            The query ran successfully but returned no documents.
          </p>
        ) : (
          <pre className="text-sm bg-gray-800 p-4 rounded overflow-x-auto">
            {JSON.stringify(data.results, null, 2)}
          </pre>
        )}
      </div>

      <div className="bg-gray-900 mt-6 p-6 rounded-lg shadow-xl border border-gray-700">
        <h3 className="font-semibold text-xl text-white mb-4">
          Debugging Info (MongoDB Pipeline)
        </h3>
        <p className="text-sm text-gray-400 mb-2">
          The Gemini AI generated this pipeline:
        </p>
        <pre className="text-sm bg-gray-800 p-4 rounded overflow-x-auto">
          {JSON.stringify(data.pipeline, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default SearchResults;
