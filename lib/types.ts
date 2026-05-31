export type CountryCode = 'SG' | 'PH' | 'MY' | 'TH' | 'TW' | 'VN' | 'BR';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  flag: string;
  langCode: string;
  langName: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'SG', name: 'シンガポール', flag: '🇸🇬', langCode: 'en', langName: 'English' },
  { code: 'PH', name: 'フィリピン', flag: '🇵🇭', langCode: 'tl', langName: 'Filipino' },
  { code: 'MY', name: 'マレーシア', flag: '🇲🇾', langCode: 'ms', langName: 'Malay' },
  { code: 'TH', name: 'タイ', flag: '🇹🇭', langCode: 'th', langName: 'Thai' },
  { code: 'TW', name: '台湾', flag: '🇹🇼', langCode: 'zh-TW', langName: '繁體中文' },
  { code: 'VN', name: 'ベトナム', flag: '🇻🇳', langCode: 'vi', langName: 'Vietnamese' },
  { code: 'BR', name: 'ブラジル', flag: '🇧🇷', langCode: 'pt', langName: 'Português' },
];

export const MAX_FRAMES = 3;
export const MAX_IMAGES = 15;
export const CANVAS_DISPLAY_SIZE = 540;
export const CANVAS_EXPORT_MULTIPLIER = 2; // 540 * 2 = 1080

export interface TextOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: 'left' | 'center' | 'right';
  strokeColor: string;
  strokeWidth: number;
}

export const DEFAULT_TEXT_OPTIONS: TextOptions = {
  text: '',
  fontFamily: 'Noto Sans JP',
  fontSize: 36,
  color: '#000000',
  bold: false,
  italic: false,
  underline: false,
  textAlign: 'left',
  strokeColor: '#000000',
  strokeWidth: 0,
};

export const FONT_FAMILIES = [
  'Noto Sans JP',
  'Arial',
  'Georgia',
  'Impact',
  'Trebuchet MS',
  'Verdana',
  'Times New Roman',
  'Courier New',
  'Comic Sans MS',
];
