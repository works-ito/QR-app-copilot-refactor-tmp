/*
 * 開発版 v49：Data Matrix 多点補助デコーダ
 *
 * 通常の BrowserMultiFormatReader(QR + Data Matrix) はそのまま維持。
 * Data Matrixだけ、カメラ映像の複数領域を順番に切り出して
 * 「その領域が画像中央にある」状態へ変換し、補助的にZXingへ渡す。
 *
 * 新しい外部ライブラリ / GAS / 本番版は変更しない。
 */
(function() {
  "use strict";

  if (!window.ZXing || !ZXing.BrowserMultiFormatReader) {
    console.warn("開発版Data Matrix補助：ZXingが見つかりません");
    return;
  }

  const ReaderClass = ZXing.BrowserMultiFormatReader;
  const originalDecodeFromVideoDevice =
    ReaderClass.prototype.decodeFromVideoDevice;
  const originalReset = ReaderClass.prototype.reset;

  /*
   * 画面中心だけでなく、左右・上下・四隅も順番に中央化する。
   * 1回に1領域だけ処理して、iPhoneでのCPU負荷を抑える。
   */
  const ZONES = [
    {name:"center", cx:0.50, cy:0.50},
    {name:"left",   cx:0.27, cy:0.50},
    {name:"right",  cx:0.73, cy:0.50},
    {name:"top",    cx:0.50, cy:0.27},
    {name:"bottom", cx:0.50, cy:0.73},
    {name:"lt",     cx:0.28, cy:0.28},
    {name:"rt",     cx:0.72, cy:0.28},
    {name:"lb",     cx:0.28, cy:0.72},
    {name:"rb",     cx:0.72, cy:0.72}
  ];

  const AUX_INTERVAL_MS = 180;
  const CROP_RATIO = 0.62;
  const CANVAS_SIZE = 420;
  const CALLBACK_COOLDOWN_MS = 700;

  function supportsLowLevelDecode() {
    return Boolean(
      ZXing.MultiFormatReader &&
      ZXing.HTMLCanvasElementLuminanceSource &&
      ZXing.HybridBinarizer &&
      ZXing.BinaryBitmap
    );
  }

  function createAuxState(reader) {
    if (reader.__dmAuxState) return reader.__dmAuxState;

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvas.style.display = "none";

    const context = canvas.getContext("2d", {
      alpha:false,
      willReadFrequently:true
    });

    let dmReader = null;
    if (supportsLowLevelDecode()) {
      const hints = new Map();
      hints.set(
        ZXing.DecodeHintType.POSSIBLE_FORMATS,
        [ZXing.BarcodeFormat.DATA_MATRIX]
      );
      if (
        ZXing.DecodeHintType &&
        ZXing.DecodeHintType.TRY_HARDER !== undefined
      ) {
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      }
      dmReader = new ZXing.MultiFormatReader();
      dmReader.setHints(hints);
    }

    reader.__dmAuxState = {
      canvas:canvas,
      context:context,
      dmReader:dmReader,
      timer:null,
      zoneIndex:0,
      running:false,
      callback:null,
      video:null,
      lastText:"",
      lastCallbackAt:0,
      warnedUnsupported:false
    };

    return reader.__dmAuxState;
  }

  function stopAuxDecoder(reader) {
    const state = reader && reader.__dmAuxState;
    if (!state) return;

    state.running = false;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.callback = null;
    state.video = null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function drawZone(state, zone) {
    const video = state.video;
    if (!video || video.readyState < 2) return false;

    const vw = Number(video.videoWidth || 0);
    const vh = Number(video.videoHeight || 0);
    if (!vw || !vh) return false;

    /*
     * 正方形領域を切り出す。Data Matrixを画面端に置いても、
     * その領域だけ見ればシンボルが画像中央寄りになる。
     */
    const cropSize = Math.max(
      80,
      Math.min(vw, vh) * CROP_RATIO
    );

    let sx = (vw * zone.cx) - (cropSize / 2);
    let sy = (vh * zone.cy) - (cropSize / 2);
    sx = clamp(sx, 0, Math.max(0, vw - cropSize));
    sy = clamp(sy, 0, Math.max(0, vh - cropSize));

    state.context.save();
    state.context.fillStyle = "#fff";
    state.context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    state.context.drawImage(
      video,
      sx,
      sy,
      cropSize,
      cropSize,
      0,
      0,
      CANVAS_SIZE,
      CANVAS_SIZE
    );
    state.context.restore();

    return true;
  }

  function decodeCanvas(state) {
    if (!state.dmReader) return null;

    try {
      const source =
        new ZXing.HTMLCanvasElementLuminanceSource(state.canvas);
      const bitmap = new ZXing.BinaryBitmap(
        new ZXing.HybridBinarizer(source)
      );
      return state.dmReader.decode(bitmap);
    } catch (error) {
      /* NotFoundException等は通常動作なので無視する。 */
      return null;
    } finally {
      try {
        if (state.dmReader && state.dmReader.reset) {
          state.dmReader.reset();
        }
      } catch (error) {}
    }
  }

  function deliverAuxResult(state, result, zoneName) {
    if (!result || !state.callback) return;

    const text = String(
      typeof result.getText === "function"
        ? result.getText()
        : (result.text || "")
    ).trim();

    if (!text) return;

    const now = Date.now();
    if (
      text === state.lastText &&
      now - state.lastCallbackAt < CALLBACK_COOLDOWN_MS
    ) {
      return;
    }

    state.lastText = text;
    state.lastCallbackAt = now;

    console.info(
      "開発版Data Matrix補助読取成功",
      zoneName,
      text
    );

    /* 既存のhandleReadOnlyDecodedへ通常ZXingと同じ経路で渡す。 */
    try {
      state.callback(result, null);
    } catch (error) {
      console.warn("開発版Data Matrix補助：結果通知失敗", error);
    }
  }

  function scheduleNext(reader) {
    const state = reader.__dmAuxState;
    if (!state || !state.running) return;

    state.timer = setTimeout(function() {
      state.timer = null;
      runAuxTick(reader);
    }, AUX_INTERVAL_MS);
  }

  function runAuxTick(reader) {
    const state = reader.__dmAuxState;
    if (!state || !state.running) return;

    if (!state.dmReader) {
      if (!state.warnedUnsupported) {
        state.warnedUnsupported = true;
        console.warn(
          "開発版Data Matrix補助：このZXingビルドでは低レベルCanvas読取を利用できません"
        );
      }
      scheduleNext(reader);
      return;
    }

    const zone = ZONES[state.zoneIndex % ZONES.length];
    state.zoneIndex = (state.zoneIndex + 1) % ZONES.length;

    if (drawZone(state, zone)) {
      const result = decodeCanvas(state);
      if (result) deliverAuxResult(state, result, zone.name);
    }

    scheduleNext(reader);
  }

  function startAuxDecoder(reader, videoSource, callbackFn) {
    const state = createAuxState(reader);
    stopAuxDecoder(reader);

    const video = typeof videoSource === "string"
      ? document.getElementById(videoSource)
      : videoSource;

    if (!video) return;

    state.video = video;
    state.callback = callbackFn;
    state.zoneIndex = 0;
    state.running = true;
    state.lastText = "";
    state.lastCallbackAt = 0;

    scheduleNext(reader);

    console.info(
      "開発版Data Matrix多点補助 v49：開始",
      ZONES.map(function(zone){ return zone.name; }).join(",")
    );
  }

  ReaderClass.prototype.decodeFromVideoDevice = function(
    deviceId,
    videoSource,
    callbackFn
  ) {
    const result = originalDecodeFromVideoDevice.call(
      this,
      deviceId,
      videoSource,
      callbackFn
    );

    startAuxDecoder(this, videoSource, callbackFn);
    return result;
  };

  ReaderClass.prototype.reset = function() {
    stopAuxDecoder(this);
    return originalReset.call(this);
  };

  console.info(
    "開発版 v49：Data Matrix 多点補助デコーダ有効"
  );
})();
