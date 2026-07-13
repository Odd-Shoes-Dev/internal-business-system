'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';

interface Category {
  id: string;
  name: string;
}

interface CategoryComboboxProps {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function CategoryCombobox({ categories, value, onChange, placeholder = 'Select category...', className = '' }: CategoryComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = categories.find((c) => c.id === value);

  const filtered = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : categories;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="flex items-center w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm cursor-text focus-within:ring-2 focus-within:ring-[#1e3a5f] focus-within:border-transparent"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 min-w-0"
        />
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {value && (
            <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 text-xs px-1">
              ✕
            </button>
          )}
          <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              {query ? `No categories matching "${query}"` : 'No categories yet'}
            </div>
          ) : (
            filtered.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${cat.id === value ? 'bg-blue-50 font-medium text-blueox-primary' : 'text-gray-800'}`}
              >
                {cat.name}
                {cat.id === value && <CheckIcon className="w-4 h-4 text-blueox-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
