import type { ChangeEvent, FC, ReactNode } from 'react';
import './Select.css';

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export const Select: FC<SelectProps> = ({
  value,
  onChange,
  children,
  className = ''
}) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={`modern-select-wrapper ${className}`}>
      <select
        value={value}
        onChange={handleChange}
        className="modern-select"
      >
        {children}
      </select>
      <div className="select-arrow">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
};

