import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

const isMonthlyData = (item) =>
  item &&
  typeof item === "object" &&
  [
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "january",
    "february",
    "march",
  ].every((month) => Object.keys(item).includes(month));

const impexpToMonthlySeries = (doc) => {
  const months = [
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "january",
    "february",
    "march",
  ];
  return months.map((month) => ({
    month: month.charAt(0).toUpperCase() + month.slice(1),
    value: Number(doc[month]) || 0,
  }));
};

const isTopNGroup = (item) =>
  item && item._id && typeof item._id === "string" && item.totalValue;

const isByPort = (item) => item && item._id && item.total_usd;

const COLORS = [
  "#00bcd4",
  "#4caf50",
  "#ffc107",
  "#ff7043",
  "#b388ff",
  "#c51162",
  "#00e676",
  "#f50057",
  "#3d5afe",
];

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
          The AI or database may have failed. Try a different query.
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

  let chart = null;
  const results = data.results;
  if (Array.isArray(results) && results.length > 0) {
    if (isMonthlyData(results[0])) {
      chart = (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={impexpToMonthlySeries(results[0])}
            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
          >
            <XAxis dataKey="month" stroke="#fff" />
            <YAxis stroke="#fff" tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip />
            <Bar dataKey="value" fill="#00bcd4" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (isTopNGroup(results[0])) {
      chart = (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={results}
              dataKey="totalValue"
              nameKey="_id"
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#86efac"
              label
            >
              {results.map((entry, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (isByPort(results[0])) {
      chart = (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={results}
            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
          >
            <XAxis dataKey="_id" stroke="#fff" />
            <YAxis stroke="#fff" tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip />
            <Bar dataKey="total_usd" fill="#b388ff" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (
      results.length > 1 &&
      typeof results[0] === "object" &&
      results[0]._id &&
      Object.keys(results[0]).some((k) => typeof results[0][k] === "number")
    ) {
      const numKey = Object.keys(results[0]).find(
        (k) => typeof results[0][k] === "number" && k !== "_id"
      );
      chart = (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={results}
            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
          >
            <XAxis dataKey="_id" stroke="#fff" />
            <YAxis stroke="#fff" tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip />
            <Bar dataKey={numKey} fill="#ffc107" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  }

  return (
    <div className="container mx-auto p-8 text-white animate-fadeIn">
      <h2 className="text-3xl font-bold mb-4 text-gray-200">
        Results for: "<span className="text-cyan-400">{data.query}</span>"
      </h2>

      {/* Chart visualization first */}
      {chart && (
        <div className="bg-gray-900 p-6 rounded-lg shadow-xl border border-gray-700 mb-6">
          <h3 className="font-semibold text-xl text-white mb-4">
            Visualized Chart
          </h3>
          {chart}
        </div>
      )}

      {/* Fallback to pretty JSON */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-xl border border-gray-700">
        <h3 className="font-semibold text-xl text-white mb-4">
          Raw Data Output
        </h3>
        {results.length === 0 ? (
          <p className="text-gray-400">
            The query ran successfully but returned no documents.
          </p>
        ) : (
          <pre className="text-sm bg-gray-800 p-4 rounded overflow-x-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        )}
      </div>

      <div className="bg-gray-900 mt-6 p-6 rounded-lg shadow-xl border border-gray-700">
        <h3 className="font-semibold text-xl text-white mb-4">
          Debugging Info (MongoDB Pipeline)
        </h3>
        <p className="text-sm text-gray-400 mb-2">
          The AI generated this pipeline:
        </p>
        <pre className="text-sm bg-gray-800 p-4 rounded overflow-x-auto">
          {JSON.stringify(data.pipeline, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default SearchResults;
