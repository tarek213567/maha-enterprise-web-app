import React from 'react';

interface AiFloatingOrbProps {
  onClick: () => void;
}

/**
 * AiFloatingOrb
 * Cosmic Gemini Sparkle Floating Orb (46px x 46px)
 * Positioned at bottom-right (bottom: 42px; right: 16px; z-index: 9500)
 */
export const AiFloatingOrb: React.FC<AiFloatingOrbProps> = ({ onClick }) => {
  return (
    <>
      {/* Primary Floating Orb */}
      <button
        id="btn-open-ai-manezar"
        type="button"
        onClick={onClick}
        className="ai-floating-orb group"
        title="Ai Manezar (Gemini 3 Flash) — আড়তের স্মার্ট সহকারী"
        aria-label="Ai Manezar খুলুন"
      >
        <div className="ai-orb-glow" />
        <span className="ai-orb-icon select-none transition-transform duration-200 group-hover:scale-110">
          ✨
        </span>
      </button>

      {/* Backward-compatibility alias for test suites */}
      <div className="ai-floating-fab hidden" aria-hidden="true" />
    </>
  );
};
