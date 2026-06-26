'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Simple tag input — no external dependencies.
 * Enter or comma triggers tag addition. Click × to remove.
 * Duplicates are silently ignored.
 */
export function TagsInput({ value, onChange, placeholder, disabled }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setInputValue('');
      return;
    }
    onChange([...value, tag]);
    setInputValue('');
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 min-h-10">
      {value.map((tag, i) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-sm text-primary"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="rounded-full hover:bg-primary/20 p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={disabled}
        className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}
