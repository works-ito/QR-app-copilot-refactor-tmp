/*
 * 開発版 v48：ZXing 読取探索強化
 *
 * app.js 本体やGAS、本番版を変更せず、BrowserMultiFormatReader生成時に
 * TRY_HARDER を追加する。QR / Data Matrix のフォーマット指定は既存のまま。
 */
(function() {
  "use strict";

  if (!window.ZXing || !ZXing.BrowserMultiFormatReader) {
    console.warn("開発版読取強化：ZXingが見つかりません");
    return;
  }

  const OriginalBrowserMultiFormatReader = ZXing.BrowserMultiFormatReader;

  function EnhancedBrowserMultiFormatReader(hints, timeBetweenScansMillis) {
    let enhancedHints = hints;

    try {
      if (!(enhancedHints instanceof Map)) {
        enhancedHints = new Map();
      }

      if (
        ZXing.DecodeHintType &&
        ZXing.DecodeHintType.TRY_HARDER !== undefined
      ) {
        enhancedHints.set(
          ZXing.DecodeHintType.TRY_HARDER,
          true
        );
      }
    } catch (error) {
      console.warn("開発版読取強化：TRY_HARDER設定失敗", error);
    }

    return new OriginalBrowserMultiFormatReader(
      enhancedHints,
      timeBetweenScansMillis
    );
  }

  EnhancedBrowserMultiFormatReader.prototype =
    OriginalBrowserMultiFormatReader.prototype;

  try {
    Object.setPrototypeOf(
      EnhancedBrowserMultiFormatReader,
      OriginalBrowserMultiFormatReader
    );
  } catch (error) {}

  ZXing.BrowserMultiFormatReader =
    EnhancedBrowserMultiFormatReader;

  console.info(
    "開発版読取強化 v48：ZXing TRY_HARDER 有効"
  );
})();
