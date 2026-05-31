'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { COUNTRIES, CountryCode } from '@/lib/types';
import { translateTextGoogle } from '@/lib/translation';

interface Props {
  selectedCountry: CountryCode;
  onInsertText: (text: string) => void;
  onInsertImage: (dataUrl: string) => void;
}

type Tab = 'text' | 'image';

const ALL_LANGUAGES = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: '英語' },
  { code: 'zh-TW', name: '繁体字中国語（台湾）' },
  { code: 'zh-CN', name: '簡体字中国語' },
  { code: 'ko', name: '韓国語' },
  { code: 'th', name: 'タイ語' },
  { code: 'vi', name: 'ベトナム語' },
  { code: 'ms', name: 'マレー語' },
  { code: 'tl', name: 'フィリピン語' },
  { code: 'pt', name: 'ポルトガル語' },
  { code: 'id', name: 'インドネシア語' },
];

export default function TranslationPanel({ selectedCountry, onInsertText, onInsertImage }: Props) {
  const [tab, setTab] = useState<Tab>('text');

  // ---- text tab ----
  const [sourceText, setSourceText] = useState('');
  const [sourceLang, setSourceLang] = useState('ja');
  const [targetLang, setTargetLang] = useState(
    () => COUNTRIES.find((c) => c.code === selectedCountry)?.langCode || 'en'
  );
  const [textResult, setTextResult] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState('');

  const handleTranslateText = async () => {
    if (!sourceText.trim()) return;
    setTextLoading(true); setTextError(''); setTextResult('');
    try {
      const r = await translateTextGoogle(sourceText, targetLang);
      setTextResult(r);
    } catch {
      setTextError('翻訳に失敗しました。再試行してください。');
    } finally { setTextLoading(false); }
  };

  // ---- image tab ----
  const [srcImageUrl, setSrcImageUrl] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [imgTargetLang, setImgTargetLang] = useState(
    () => COUNTRIES.find((c) => c.code === selectedCountry)?.langCode || 'en'
  );
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState('');
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [translatedCount, setTranslatedCount] = useState<number | null>(null);
  const [pasteFeedback, setPasteFeedback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 画像を読み込む共通関数（useCallbackで安定化）
  const loadImageFile = useCallback((file: Blob | File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSrcImageUrl(e.target?.result as string);
      setResultImageUrl(null);
      setImgError('');
      setProgress('');
      setDetectedCount(null);
      setTranslatedCount(null);
      // ペースト完了フィードバック
      setPasteFeedback(true);
      setTimeout(() => setPasteFeedback(false), 1500);
    };
    reader.readAsDataURL(file);
  }, []);

  // 画像タブが開いているときはページ全体でCtrl+Vを受け付ける
  useEffect(() => {
    if (tab !== 'image') return;
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const activeEl = document.activeElement;
      const isInputFocused = !!(activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'));

      // ★ バイナリ画像はinputフォーカスに関係なく最優先で処理
      const imgItemDirect = items.find((i) => i.type.startsWith('image/'));
      if (imgItemDirect) {
        const blob = imgItemDirect.getAsFile();
        if (blob && blob.size > 0) {
          e.preventDefault();
          loadImageFile(blob);
          return;
        }
      }

      // テキスト入力欄フォーカス中はHTML/テキスト処理をスキップ
      if (isInputFocused) return;

      // navigator.clipboard.read() フォールバック
      const tryClipboardAPI = async () => {
        if (!navigator.clipboard?.read) return false;
        try {
          const ci = await navigator.clipboard.read();
          for (const item of ci) {
            const t = item.types.find((t) => t.startsWith('image/'));
            if (t) { loadImageFile(await item.getType(t)); return true; }
          }
        } catch { /* permission denied 等 */ }
        return false;
      };

      // 2. HTMLに含まれる<img>タグ（ブラウザの「画像をコピー」）
      const htmlItem = items.find((i) => i.type === 'text/html');
      if (!htmlItem) {
        // HTMLもバイナリもない場合はClipboard APIで試みる
        (async () => { await tryClipboardAPI(); })();
        return;
      }
      if (htmlItem) {
        htmlItem.getAsString(async (html) => {
          const match = html.match(/src=["']([^"']+)["']/i);
          const src = match?.[1]?.replace(/&amp;/g, '&');
          if (src) {
            setImgLoading(true); setProgress('画像を取得中...'); setImgError('');
            try {
              // data: / blob: は直接fetch
              if (src.startsWith('data:image/') || src.startsWith('blob:')) {
                const res = await fetch(src);
                const blob = await res.blob();
                if (blob.size > 0) { loadImageFile(blob); return; }
              }
              // http(s): はプロキシ経由
              if (src.startsWith('http')) {
                const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
                if (res.ok) {
                  const blob = await res.blob();
                  if (blob.size > 0) { loadImageFile(blob); return; }
                }
              }
              // 3. clipboard API フォールバック
              if (!await tryClipboardAPI()) {
                setImgError('画像の取得に失敗しました。右クリック→「名前を付けて画像を保存」してからファイルでアップロードしてください。');
              }
            } catch {
              setImgError('画像の取得に失敗しました。ファイルとして保存してからお試しください。');
            } finally {
              setImgLoading(false); setProgress('');
            }
          }
        });
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [tab, loadImageFile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadImageFile(f);
    e.target.value = '';
  };

  // Clipboard APIで画像を直接取得（ボタン押下時）
  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      setImgError('このブラウザはClipboard APIに対応していません。Ctrl+Vをお試しください。');
      return;
    }
    setImgLoading(true); setProgress('クリップボードから取得中...'); setImgError('');
    try {
      const clipItems = await navigator.clipboard.read();
      let found = false;
      for (const item of clipItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          loadImageFile(blob);
          found = true;
          break;
        }
      }
      if (!found) setImgError('クリップボードに画像が見つかりませんでした。サイトで右クリック→「画像をコピー」してから試してください。');
    } catch {
      setImgError('クリップボードへのアクセスが許可されていません。Ctrl+Vをお試しください。');
    } finally {
      setImgLoading(false); setProgress('');
    }
  };

  const handleTranslateImage = async () => {
    if (!srcImageUrl) return;
    setImgLoading(true); setImgError(''); setResultImageUrl(null);
    setDetectedCount(null); setTranslatedCount(null);
    setProgress('処理開始...'); setProgressPct(0);
    try {
      const { translateImage } = await import('@/lib/imageTranslation');
      const { resultDataUrl, detectedCount: dc, translatedCount: tc } =
        await translateImage(srcImageUrl, imgTargetLang, (msg, pct) => {
          setProgress(msg);
          setProgressPct(pct);
        });
      setResultImageUrl(resultDataUrl);
      setDetectedCount(dc);
      setTranslatedCount(tc);
      setProgress('完了！');
      setProgressPct(100);
    } catch (e) {
      setImgError(`エラーが発生しました: ${(e as Error).message}`);
      setProgress('');
    } finally {
      setImgLoading(false);
    }
  };

  const handleDownloadResult = () => {
    if (!resultImageUrl) return;
    const a = document.createElement('a');
    a.href = resultImageUrl;
    a.download = 'translated-image.png';
    a.click();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">翻訳</h3>

      {/* Tabs */}
      <div className="flex mb-3 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => setTab('text')}
          className={`flex-1 py-1.5 text-xs rounded-md transition-all ${tab === 'text' ? 'bg-white shadow-sm font-semibold text-shopee-orange' : 'text-gray-500'}`}
        >
          テキスト翻訳
        </button>
        <button
          onClick={() => setTab('image')}
          className={`flex-1 py-1.5 text-xs rounded-md transition-all ${tab === 'image' ? 'bg-white shadow-sm font-semibold text-shopee-orange' : 'text-gray-500'}`}
        >
          画像翻訳
        </button>
      </div>

      {/* ---- TEXT TAB ---- */}
      {tab === 'text' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-shopee-orange">
              {ALL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            <span className="text-gray-400 text-xs">→</span>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-shopee-orange">
              {ALL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>

          <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)}
            placeholder="翻訳したいテキストを入力..." rows={3}
            className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-shopee-orange" />

          <button onClick={handleTranslateText} disabled={textLoading || !sourceText.trim()}
            className="w-full py-2 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40">
            {textLoading ? '翻訳中...' : '翻訳する'}
          </button>

          {textError && <p className="text-xs text-red-500">{textError}</p>}

          {textResult && (
            <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{textResult}</p>
              <div className="flex gap-1">
                <button onClick={() => navigator.clipboard.writeText(textResult)}
                  className="flex-1 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md">コピー</button>
                <button onClick={() => onInsertText(textResult)}
                  className="flex-1 py-1 text-xs bg-shopee-orange text-white hover:bg-shopee-orange-dark rounded-md">
                  画像に追加
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- IMAGE TAB ---- */}
      {tab === 'image' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            画像をアップロードすると、テキスト部分を自動検出して翻訳した新しい画像を生成します。
          </p>

          {/* Upload zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-all ${
              pasteFeedback
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 hover:border-shopee-orange'
            }`}
            onClick={() => fileRef.current?.click()}
            tabIndex={0}
          >
            {pasteFeedback && (
              <p className="text-xs text-green-600 font-semibold py-2">✅ 画像を貼り付けました！</p>
            )}
            {!pasteFeedback && srcImageUrl ? (
              <div className="space-y-1">
                <img src={srcImageUrl} className="max-h-32 max-w-full object-contain rounded mx-auto" alt="source" />
                <p className="text-xs text-gray-400">クリックで変更</p>
              </div>
            ) : !pasteFeedback ? (
              <div className="py-3 space-y-1">
                <p className="text-2xl">📷</p>
                <p className="text-xs text-gray-500 font-medium">クリックでファイル選択</p>
                <p className="text-xs text-gray-400">または</p>
                <p className="text-xs bg-gray-100 rounded px-2 py-1 inline-block text-gray-600 font-mono">Ctrl + V</p>
                <p className="text-xs text-gray-400">でペースト（どこでもOK）</p>
                <p className="text-xs text-gray-400">ウェブ画像の右クリック「画像をコピー」も可</p>
              </div>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          {/* クリップボードから貼り付けボタン */}
          <button
            onClick={handlePasteFromClipboard}
            disabled={imgLoading}
            className="w-full py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition-colors disabled:opacity-40"
          >
            📋 クリップボードから貼り付け（ウェブ画像対応）
          </button>

          {/* Target language */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">翻訳先:</span>
            <select value={imgTargetLang} onChange={(e) => setImgTargetLang(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-shopee-orange">
              {ALL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>

          {/* Translate button */}
          <button
            onClick={handleTranslateImage}
            disabled={imgLoading || !srcImageUrl}
            className="w-full py-2.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {imgLoading ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{progress || '処理中...'}</span>
              </>
            ) : '🔄 画像翻訳を実行'}
          </button>

          {/* Progress bar */}
          {imgLoading && (
            <div className="space-y-1">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">{progress}</p>
            </div>
          )}

          {imgError && <p className="text-xs text-red-500">{imgError}</p>}

          {/* Result */}
          {resultImageUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">翻訳結果:</p>
                {detectedCount !== null && (
                  <p className={`text-xs px-2 py-0.5 rounded-full ${
                    translatedCount === 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                  }`}>
                    {detectedCount === 0
                      ? 'テキスト未検出'
                      : `${detectedCount}ブロック検出 / ${translatedCount}件翻訳`}
                  </p>
                )}
              </div>
              <img src={resultImageUrl} className="w-full rounded-lg border border-gray-200" alt="translated" />
              <div className="flex gap-1.5">
                <button
                  onClick={() => onInsertImage(resultImageUrl)}
                  className="flex-1 py-2 text-xs bg-shopee-orange text-white font-medium rounded-lg hover:bg-shopee-orange-dark transition-colors"
                >
                  キャンバスに追加
                </button>
                <button
                  onClick={handleDownloadResult}
                  className="flex-1 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  ⬇ ダウンロード
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
