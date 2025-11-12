import React from "react";
import { FiArrowRight } from "react-icons/fi";

/**
 * Hero Component
 * @param {object} props
 * @param {function} props.onExploreClick
 */
const Hero = ({ onExploreClick }) => {
  return (
    <div className="relative text-white text-center py-32 md:py-48 px-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gray-800 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-transparent to-gray-950"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <h1
          className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 
                     bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500"
        >
          AI-Powered Global Trade Insights
        </h1>

        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
          Harness the power of AI to analyze, visualize, and understand complex
          global trade data. Aalmost Human provides the clarity you need.
        </p>

        <button
          onClick={onExploreClick}
          className="flex items-center justify-center mx-auto text-lg font-semibold 
                     py-3 px-8 rounded-full transition-all duration-300
                     bg-cyan-700 text-white 
                     hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30
                     focus:outline-none focus:ring-4 focus:ring-cyan-500 focus:ring-opacity-50
                     transform hover:-translate-y-0.5"
        >
          Explore Data
          <FiArrowRight className="ml-2" />
        </button>
      </div>
    </div>
  );
};

export default Hero;
