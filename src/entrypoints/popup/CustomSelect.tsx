import { useState, useRef, useEffect } from "react";
import "./CustomSelect.css";

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function CustomSelect({ value, onChange, options, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-wrapper ${className}`} ref={selectRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-select-value">{selectedOption?.label}</span>
        <svg 
          className={`custom-select-arrow ${isOpen ? "rotate" : ""}`}
          width="16" 
          height="16" 
          viewBox="0 0 16 16"
        >
          <path fill="currentColor" d="M4 6l4 4 4-4z"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`custom-select-option ${option.value === value ? "selected" : ""}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
              {option.value === value && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path 
                    d="M13 4L6 11L3 8" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
