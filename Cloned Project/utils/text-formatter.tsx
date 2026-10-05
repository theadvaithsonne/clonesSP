import React from 'react';

/**
 * Formats text by converting **text** to bold elementss
 * @param text - The input text containing **bold** syntax
 * @returns JSX elements with formatted text
 */
export function formatText(text: string): React.ReactNode {
  if (!text) return null;

  // Split the text by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    // Check if this part is a bold pattern
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove the ** markers and wrap in bold
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold">
          {boldText}
        </strong>
      );
    }

    // Regular text - preserve line breaks
    return (
      <span key={index}>
        {part.split('\n').map((line, lineIndex, array) => (
          <React.Fragment key={lineIndex}>
            {line}
            {lineIndex < array.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  });
}

/**
 * Component wrapper for formatted text with proper styling
 */
interface FormattedTextProps {
  text: string;
  className?: string;
}

export function FormattedText({ text, className = "" }: FormattedTextProps) {
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {formatText(text)}
    </div>
  );
}
