import React, { useState, useRef } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import SearchResults from "./components/SearchResults";

function App() {
  const [inputValue, setInputValue] = useState("");

  const [submittedQuery, setSubmittedQuery] = useState("");

  const searchInputRef = useRef(null);

  const handleExploreClick = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSearchSubmit = () => {
    setSubmittedQuery(inputValue);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Header
        ref={searchInputRef}
        inputValue={inputValue}
        onInputChange={(e) => setInputValue(e.target.value)}
        onSearchSubmit={handleSearchSubmit}
      />
      {submittedQuery ? (
        <SearchResults query={submittedQuery} />
      ) : (
        <Hero onExploreClick={handleExploreClick} />
      )}
    </div>
  );
}

export default App;
