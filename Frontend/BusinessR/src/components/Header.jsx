import React from "react";
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
  ({ inputValue, onInputChange, onSearchSubmit }, ref) => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSearchSubmit();
      }
    };

    return (
      <header className="bg-gray-700 text-gray-200 p-4 shadow-lg w-full sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <PlaceholderLogo />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Aalmost Human
              </h1>
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                AI Company
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-8">
            <div className="relative flex items-center hidden md:flex">
              <input
                ref={ref}
                type="text"
                placeholder="AI Search..."
                className="bg-gray-800 text-white placeholder-gray-500 rounded-full py-2.5 px-5 pl-12 
                         focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all 
                         w-96 text-base"
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={handleKeyDown}
              />

              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg" />
              <button
                className="ml-2 p-2 rounded-full bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 
                         focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all 
                         text-white flex items-center justify-center"
                aria-label="Speech input"
              >
                <FiMic size={22} />
              </button>
            </div>

            <nav className="flex items-center space-x-5">
              <a
                href="#"
                className="text-gray-400 hover:text-cyan-400 transition-colors duration-200"
                title="Home"
              >
                <FiHome size={22} />
              </a>
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
