'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

// A numeric field whose parent keeps a number, but which lets the box be empty while
// typing. Without this, clearing the box writes 0 back into it, so a leading "0" can
// never be deleted. An empty box is reported to the parent as 0.
export function NumberInput({ value, onChange, placeholder = '0', ...rest }: NumberInputProps) {
  const [text, setText] = useState(value === 0 ? '' : String(value));

  // Follow outside changes (e.g. a loaded record) without fighting what the user is typing.
  useEffect(() => {
    const parsed = text === '' ? 0 : Number(text);
    if (parsed !== value) setText(value === 0 ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const parsed = next === '' ? 0 : Number(next);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
    />
  );
}
