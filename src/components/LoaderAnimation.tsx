import type { FC } from 'react';
import './LoaderAnimation.css';

interface LoaderAnimationProps {
  text?: string;
}

export const LoaderAnimation: FC<LoaderAnimationProps> = ({ text = 'Generating' }) => {
  const letters = text.split('');

  return (
    <div className="loader-wrapper">
      {letters.map((letter, index) => (
        <span key={index} className="loader-letter" style={{ animationDelay: `${index * 0.1}s` }}>
          {letter}
        </span>
      ))}
      <div className="loader"></div>
    </div>
  );
};
