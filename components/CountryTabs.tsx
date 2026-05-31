'use client';
import { CountryCode, COUNTRIES } from '@/lib/types';

interface Props {
  selected: CountryCode;
  onChange: (code: CountryCode) => void;
}

export default function CountryTabs({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {COUNTRIES.map((c) => (
        <button
          key={c.code}
          onClick={() => onChange(c.code)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            selected === c.code
              ? 'bg-shopee-orange text-white shadow-md scale-105'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-shopee-orange hover:text-shopee-orange'
          }`}
        >
          <span className="text-base">{c.flag}</span>
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}
