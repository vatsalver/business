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

// Customize these queries as needed for your main dashboard KPIs
const DASHBOARD_QUERIES = [
  {
    label: "Products Unit Price",
    query: "show products unit price",
  },
  { label: "Top 5 Products", query: "top 5 commodities by value" },
  {
    label: "Import vs Export",
    query: "show import and export values by total",
  },
  {
    label: "Country Population",
    query: "show population of countries",
  },
  {
    label: "Monthly LPG Import",
    query: "show monthly sales of lpg import",
  },
  {
    label: "Trade Surplus/Deficit",
    query: "show net trade import/export for 5 countries by value",
  },
];

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

const formatLabel = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ");
  }
  return String(value);
};

// Helper to detect monthly data (impexp collection format)
const isMonthlyData = (item) => {
  if (!item || typeof item !== "object") return false;
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
  const monthCount = months.filter((month) => month in item).length;
  // Consider it monthly data if at least 8 months are present
  return monthCount >= 8;
};

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

const General = () => {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      const allResults = await Promise.all(
        DASHBOARD_QUERIES.map(async ({ label, query }) => {
          try {
            const res = await fetch(
              `http://localhost:5000/api/trade/query?query=${encodeURIComponent(
                query
              )}`
            );
            const data = await res.json();
            return {
              label,
              data: data.results || [],
              pipeline: data.pipeline || [],
            };
          } catch (e) {
            return { label, data: [], error: e.message };
          }
        })
      );
      setResults(allResults);
    };
    fetchAll();
  }, []);

  // Example chart renderers for different cards
  const renderChart = (label, data) => {
    if (label === "Products Unit Price" && Array.isArray(data) && data.length) {
      // Bar chart for products unit price - only unique products
      const productMap = new Map();

      data.forEach((entry) => {
        // Handle different possible data structures
        let productName =
          entry.commodity_doc?.commodity_name ||
          entry.commodity_name ||
          formatLabel(entry._id) ||
          "Unknown Product";
        const unitPrice = entry.unit_price || entry.avg_unit_price || 0;

        // Abbreviate specific product names
        if (productName === "Passenger Cars") {
          productName = "P.Cars";
        } else if (productName === "Semiconductors") {
          productName = "S.Conductors";
        }

        // Only add if product not already in map, or if this price is higher (keep highest price)
        if (
          !productMap.has(productName) ||
          (Number(unitPrice) || 0) > productMap.get(productName).price
        ) {
          productMap.set(productName, {
            name:
              productName.length > 15
                ? productName.substring(0, 15) + "..."
                : productName,
            fullName: productName,
            price: Number(unitPrice) || 0,
          });
        }
      });

      const chartData = Array.from(productMap.values())
        .sort((a, b) => b.price - a.price)
        .slice(0, 10); // Limit to top 10 for readability

      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
          >
            <XAxis
              dataKey="name"
              stroke="#fff"
              angle={-45}
              textAnchor="end"
              height={40}
            />
            <YAxis
              stroke="#fff"
              tickFormatter={(v) => `$${v.toLocaleString()}`}
            />
            <Tooltip
              formatter={(value) => [
                `$${value.toLocaleString()}`,
                "Unit Price",
              ]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullName || label
              }
            />
            <Bar dataKey="price" fill="#00bcd4" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (label === "Import vs Export" && Array.isArray(data) && data.length) {
      // Handle simple structure where _id is "Import" or "Export" string
      let totalImport = 0;
      let totalExport = 0;

      data.forEach((entry) => {
        const value = Number(
          entry.total_value || entry.totalValue || entry.value || 0
        );

        // Check if _id is a string "Import" or "Export"
        if (typeof entry._id === "string") {
          if (entry._id === "Import" || entry._id === "import") {
            totalImport = value;
          } else if (entry._id === "Export" || entry._id === "export") {
            totalExport = value;
          }
        } else {
          // Fallback to other structures
          const tradeType =
            entry.trade_type ||
            (typeof entry._id === "object" && entry._id.trade_type) ||
            entry.type ||
            "";

          if (tradeType === "Import" || tradeType === "import") {
            totalImport += value;
          } else if (tradeType === "Export" || tradeType === "export") {
            totalExport += value;
          }
        }
      });

      // Create chart data with single "Total" entry for line chart
      const chartData = [];
      if (totalImport > 0 || totalExport > 0) {
        chartData.push({
          country: "Total",
          fullCountry: "Total",
          import: totalImport,
          export: totalExport,
        });
      }

      // If no data after processing, show message
      if (chartData.length === 0) {
        return (
          <div className="text-sm text-gray-400 p-2">
            <p>No import/export data found.</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-cyan-400">
                Debug: Raw Data
              </summary>
              <pre className="text-xs mt-2 bg-gray-800 p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(data.slice(0, 3), null, 2)}
              </pre>
            </details>
          </div>
        );
      }

      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
          >
            <XAxis
              dataKey="country"
              stroke="#fff"
              angle={-45}
              textAnchor="end"
              height={30}
              tick={{ fontSize: 10, fill: "#fff" }}
            />
            <YAxis
              stroke="#fff"
              tickFormatter={(v) => {
                if (v >= 1000000000) return `${(v / 1000000000).toFixed(1)}B`;
                if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
                return v.toLocaleString();
              }}
              tick={{ fontSize: 10, fill: "#fff" }}
              width={70}
            />
            <Tooltip
              formatter={(value) => {
                if (value >= 1000000000)
                  return `$${(value / 1000000000).toFixed(2)}B`;
                if (value >= 1000000)
                  return `$${(value / 1000000).toFixed(2)}M`;
                if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
                return `$${value.toLocaleString()}`;
              }}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullCountry || label
              }
            />
            <Legend />
            <Bar dataKey="import" fill="#4caf50" name="Import" />
            <Bar dataKey="export" fill="#b388ff" name="Export" />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (label === "Top 5 Products" && Array.isArray(data) && data.length) {
      const pieData = data.map((entry) => ({
        ...entry,
        label: formatLabel(entry._id),
      }));
      // Pie chart for top N products by value
      return (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey={
                data[0].totalValue !== undefined ? "totalValue" : "total_value"
              }
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={70}
              fill="#00bcd4"
              //label
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (label === "Monthly LPG Import" && Array.isArray(data) && data.length) {
      // Check if it's monthly data (impexp format)
      if (isMonthlyData(data[0])) {
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={impexpToMonthlySeries(data[0])}
              margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
            >
              <XAxis dataKey="month" stroke="#fff" />
              <YAxis stroke="#fff" tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip />
              <Bar dataKey="value" fill="#b388ff" />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      // Otherwise, treat as grouped data
      const chartData = data.map((entry) => ({
        ...entry,
        label: formatLabel(entry._id ?? entry.name ?? entry.label ?? ""),
      }));
      // Bar chart for monthly sales totals
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="label" stroke="#fff" />
            <YAxis stroke="#fff" />
            <Tooltip />
            <Bar dataKey="total" fill="#b388ff" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (label === "Country Population" && Array.isArray(data) && data.length) {
      // Sort by population descending and take top 10 for readability
      const sortedData = [...data]
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .slice(0, 10)
        .map((entry) => ({
          name:
            entry.country_name ||
            entry.country ||
            formatLabel(entry._id) ||
            "Unknown",
          population: Number(entry.population) || 0,
        }));

      // Bar chart for country population comparison
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={sortedData}
            margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
          >
            <XAxis
              dataKey="name"
              stroke="#fff"
              angle={-45}
              textAnchor="end"
              height={25}
            />
            <YAxis
              stroke="#fff"
              tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              formatter={(value) => [
                `${value.toLocaleString()} people`,
                "Population",
              ]}
            />
            <Bar dataKey="population" fill="#4caf50" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (
      label === "Trade Surplus/Deficit" &&
      Array.isArray(data) &&
      data.length
    ) {
      // Handle structure where trade_surplus_deficit is directly provided
      const chartData = data
        .map((entry) => {
          // Extract country name - _id might be string or object
          const countryName =
            entry.country ||
            (typeof entry._id === "string" ? entry._id : null) ||
            entry.country_name ||
            entry.country_doc?.country_name ||
            (typeof entry._id === "object" && entry._id.country) ||
            (typeof entry._id === "object" && entry._id.country_name) ||
            formatLabel(entry._id) ||
            "Unknown";

          // Get surplus/deficit value directly from net_trade_value field
          // or from trade_surplus_deficit field, or calculate from export - import if not available
          let surplus = 0;
          if (entry.net_trade_value !== undefined) {
            surplus = Number(entry.net_trade_value);
          } else if (entry.trade_surplus_deficit !== undefined) {
            surplus = Number(entry.trade_surplus_deficit);
          } else if (entry.surplus !== undefined) {
            surplus = Number(entry.surplus);
          } else if (entry.deficit !== undefined) {
            surplus = -Number(entry.deficit); // Deficit is negative
          } else {
            // Fallback: calculate from import/export if available
            const importVal = Number(
              entry.import || entry.import_value || entry.import_total || 0
            );
            const exportVal = Number(
              entry.export || entry.export_value || entry.export_total || 0
            );
            surplus = exportVal - importVal;
          }

          return {
            country:
              countryName.length > 12
                ? countryName.substring(0, 12) + "..."
                : countryName,
            fullCountry: countryName,
            surplus: surplus,
          };
        })
        .filter((item) => item.surplus !== 0) // Filter out zero values
        .sort((a, b) => Math.abs(b.surplus) - Math.abs(a.surplus)) // Sort by absolute value
        .slice(0, 15); // Show top 15 countries (increased limit)

      // If no data after processing, show message
      if (chartData.length === 0) {
        return (
          <div className="text-sm text-gray-400 p-2">
            <p>No trade surplus/deficit data found.</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-cyan-400">
                Debug: Raw Data
              </summary>
              <pre className="text-xs mt-2 bg-gray-800 p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(data.slice(0, 3), null, 2)}
              </pre>
            </details>
          </div>
        );
      }

      // Find min and max for proper domain
      const minValue = Math.min(...chartData.map((d) => d.surplus));
      const maxValue = Math.max(...chartData.map((d) => d.surplus));
      const domainMax = Math.max(Math.abs(minValue), Math.abs(maxValue));

      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
          >
            <XAxis
              dataKey="country"
              stroke="#fff"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fontSize: 10, fill: "#fff" }}
            />
            <YAxis
              stroke="#fff"
              domain={[-domainMax, domainMax]}
              tickFormatter={(v) => {
                const sign = v >= 0 ? "" : "-";
                const absV = Math.abs(v);
                if (absV >= 1000000000)
                  return `${sign}${(absV / 1000000000).toFixed(1)}B`;
                if (absV >= 1000000)
                  return `${sign}${(absV / 1000000).toFixed(1)}M`;
                if (absV >= 1000) return `${sign}${(absV / 1000).toFixed(1)}K`;
                return `${sign}${absV.toLocaleString()}`;
              }}
              tick={{ fontSize: 10, fill: "#fff" }}
              width={80}
            />
            <Tooltip
              formatter={(value) => {
                const sign = value >= 0 ? "+" : "";
                if (Math.abs(value) >= 1000000000)
                  return `${sign}$${(Math.abs(value) / 1000000000).toFixed(
                    2
                  )}B`;
                if (Math.abs(value) >= 1000000)
                  return `${sign}$${(Math.abs(value) / 1000000).toFixed(2)}M`;
                if (Math.abs(value) >= 1000)
                  return `${sign}$${(Math.abs(value) / 1000).toFixed(2)}K`;
                return `${sign}$${Math.abs(value).toLocaleString()}`;
              }}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullCountry || label
              }
            />
            <Bar dataKey="surplus">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.surplus >= 0 ? "#4caf50" : "#f50057"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-3 text-cyan-300">
        Business Dashboard
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {results.map(({ label, data, error }) => (
          <div
            key={label}
            className="bg-gray-900 rounded-lg shadow border border-gray-700 p-4"
          >
            <div className="font-semibold text-lg text-gray-100 mb-2">
              {label}
            </div>
            {error && <div className="text-red-500">{error}</div>}
            {renderChart(label, data) || (
              <pre className="text-xs text-gray-400 bg-gray-800 rounded p-2 overflow-x-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default General;
