import React, { useState, useRef } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import SearchResults from "./components/SearchResults";
import SearchR from "./components/SearchR";
import SearchC from "./components/SearchC";
import SearchA from "./components/SearchA";
import General from "./components/General";
import SearchAudio from "./components/SearchAudio";

function App() {
  const [inputValue, setInputValue] = useState("");

  const [submittedQuery, setSubmittedQuery] = useState("");

  const [showGeneral, setShowGeneral] = useState(false);

  const searchInputRef = useRef(null);

  const handleExploreClick = () => {
    setShowGeneral(true);
  };

  const handleSearchSubmit = () => {
    setShowGeneral(false); // Reset General view when search is submitted
    setSubmittedQuery(inputValue);
  };

  const handleHomeClick = () => {
    setShowGeneral(false);
    setSubmittedQuery("");
    setInputValue("");
  };

  return (
    <div className="min-h-screen bg-gray-800">
      <Header
        ref={searchInputRef}
        inputValue={inputValue}
        onInputChange={(e) => setInputValue(e.target.value)}
        onSearchSubmit={handleSearchSubmit}
        onHomeClick={handleHomeClick}
      />
      <main>
        {showGeneral ? (
          <General />
        ) : submittedQuery ? (
          //<SearchResults query={submittedQuery} />
          //<SearchR query={submittedQuery} />
          //<SearchA query={submittedQuery} />
          <SearchAudio query={submittedQuery} />
        ) : (
          <Hero onExploreClick={handleExploreClick} />
        )}
      </main>
    </div>
  );
}

export default App;
