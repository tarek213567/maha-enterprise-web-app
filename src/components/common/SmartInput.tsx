import React from 'react';
import { parseSmartNumber } from '../../utils/bengaliNumbers';

interface SmartInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string, numericValue: number) => void;
  allowDecimals?: boolean;
}

/**
 * Smart Input Component:
 * Seamlessly accepts both English (0-9) and Bengali (০-৯) digits,
 * parses correctly, and provides both the display string and clean numeric value.
 */
export const SmartInput: React.FC<SmartInputProps> = ({
  value,
  onChange,
  allowDecimals = true,
  className = '',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const num = parseSmartNumber(rawVal);
    onChange(rawVal, num);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      className={`font-semibold outline-none transition-colors ${className}`}
      {...props}
    />
  );
};

