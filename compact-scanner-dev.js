/* 開発版 v45：Data Matrix向けに表示サイズとズーム適用を再調整 */
(function() {
  "use strict";

  const STYLE_ID = "compactScannerDevStyle";
  const ZOOM_TARGET = 1.8;
  const RETRY_DELAYS = [250, 500, 900, 1400, 2200, 3200];
  let zoomTimers = [];

  function injectCompactScannerStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /*
       * 10:9ではData Matrixの読取余裕が少なかったため、
       * 本番3:4よりコンパクト・10:9より縦を残す1:1へ調整する。
       */
      #cameraPreview .scannerViewport {
        width:100%;
        max-width:430px;
        margin:0 auto 6px;
        scroll-margin-top:96px;
      }

      #cameraPreview .scannerVideo {
        width:100%;
        aspect-ratio:1 / 1;
        object-fit:cover;
        background:#000;
      }

      /* 成功時のみ緑枠。常時の位置合わせ枠は表示しない。 */
      #cameraPreview .scannerFrame {
        left:0;
        top:0;
        width:100%;
        height:100%;
        border:0;
        border-radius:14px;
        filter:none;
      }

      #cameraPreview .scannerFrame.isSuccess {
        border:5px solid #00e676;
        box-shadow:inset 0 0 18px rgba(0,230,118,.75), 0 0 12px rgba(0,230,118,.5);
      }

      @media (max-width:390px) and (max-height:700px) {
        #cameraPreview .scannerViewport {
          scroll-margin-top:82px;
          margin-bottom:5px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function clearZoomTimers() {
    zoomTimers.forEach(function(timer) {
      clearTimeout(timer);
    });
    zoomTimers = [];
  }

  async function applyReliableZoom(attempt) {
    try {
      const video = document.getElementById("scannerVideo");
      if (!video || !video.srcObject) return false;

      const track = video.srcObject.getVideoTracks()[0];
      if (!track) return false;

      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      const settingsBefore = track.getSettings ? track.getSettings() : {};

      if (!capabilities.zoom) {
        console.info("開発版ズーム：zoom非対応", {
          attempt:attempt,
          label:track.label || "",
          current:settingsBefore.zoom
        });
        return true;
      }

      const min = Number(capabilities.zoom.min);
      const max = Number(capabilities.zoom.max);
      const step = Number(capabilities.zoom.step || 0);
      let target = Math.min(ZOOM_TARGET, Number.isFinite(max) ? max : ZOOM_TARGET);
      if (Number.isFinite(min)) target = Math.max(target, min);

      if (step > 0 && Number.isFinite(min)) {
        const steps = Math.round((target - min) / step);
        target = min + (steps * step);
        if (Number.isFinite(max)) target = Math.min(target, max);
      }

      await track.applyConstraints({
        advanced:[{zoom:target}]
      });

      try {
        await track.applyConstraints({
          advanced:[{focusMode:"continuous"}]
        });
      } catch (focusError) {
        /* iOS/Safariで未対応の場合は無視 */
      }

      const settingsAfter = track.getSettings ? track.getSettings() : {};
      const actual = Number(settingsAfter.zoom);

      console.info("開発版ズーム適用", {
        attempt:attempt,
        label:track.label || "",
        min:min,
        max:max,
        requested:target,
        actual:settingsAfter.zoom
      });

      if (Number.isFinite(actual) && Math.abs(actual - target) <= 0.08) {
        clearZoomTimers();
        return true;
      }

      return false;
    } catch (error) {
      console.info("開発版ズーム再試行", attempt, error);
      return false;
    }
  }

  function scheduleReliableZoom() {
    clearZoomTimers();

    RETRY_DELAYS.forEach(function(delay, index) {
      const timer = setTimeout(function() {
        void applyReliableZoom(index + 1);
      }, delay);
      zoomTimers.push(timer);
    });
  }

  /* カメラ開始ボタン操作後に、映像トラック生成を待ちながら再試行する。 */
  document.addEventListener("click", function(event) {
    const target = event.target && event.target.closest
      ? event.target.closest("#startScannerButton, #startReadButton, [data-start-scanner]")
      : null;
    if (target) scheduleReliableZoom();
  }, true);

  /* ボタンID差異や自動再開にも対応するため、映像srcObject出現も監視する。 */
  function watchVideoStream() {
    const video = document.getElementById("scannerVideo");
    if (!video) return;

    let lastStream = null;
    setInterval(function() {
      const stream = video.srcObject || null;
      if (stream && stream !== lastStream) {
        lastStream = stream;
        scheduleReliableZoom();
      } else if (!stream) {
        lastStream = null;
      }
    }, 300);
  }

  function init() {
    injectCompactScannerStyle();
    watchVideoStream();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();
