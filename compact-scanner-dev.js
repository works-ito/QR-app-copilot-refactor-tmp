/* 開発版：通常スキャナをSE向けにコンパクト化 */
(function() {
  function injectCompactScannerStyle() {
    if (document.getElementById("compactScannerDevStyle")) return;

    const style = document.createElement("style");
    style.id = "compactScannerDevStyle";
    style.textContent = `
      /*
       * 従来は3:4の縦長表示だったため、SEで画面を占有しすぎていた。
       * 横幅は維持しつつ高さだけ約3割縮め、QRの画素数をなるべく残す。
       */
      #cameraPreview .scannerViewport {
        width:100%;
        max-width:430px;
        margin:0 auto 6px;
        scroll-margin-top:96px;
      }

      #cameraPreview .scannerVideo {
        width:100%;
        aspect-ratio:10 / 9;
        object-fit:cover;
      }

      /* 四隅の位置合わせガイドは表示しない。成功時だけ緑枠を出す。 */
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

      #scannerCompactCount {
        margin:2px 0 8px;
        padding:7px 10px;
        border:1px solid #c8ddfa;
        border-radius:10px;
        background:#eef6ff;
        color:#145aa8;
        font-size:15px;
        line-height:1.2;
        font-weight:900;
        text-align:center;
      }

      @media (max-width:390px) and (max-height:700px) {
        #cameraPreview .scannerViewport {
          scroll-margin-top:82px;
          margin-bottom:5px;
        }

        #scannerCompactCount {
          margin-bottom:6px;
          padding:6px 8px;
          font-size:14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function installCompactCount() {
    const viewport = document.getElementById("scannerViewport");
    const originalCount = document.getElementById("scannerResultCount");

    if (!viewport || !originalCount) {
      setTimeout(installCompactCount, 100);
      return;
    }

    let compactCount = document.getElementById("scannerCompactCount");
    if (!compactCount) {
      compactCount = document.createElement("div");
      compactCount.id = "scannerCompactCount";
      compactCount.setAttribute("aria-live", "polite");
      viewport.insertAdjacentElement("afterend", compactCount);
    }

    function syncCount() {
      const text = String(originalCount.textContent || "0件").trim();
      compactCount.textContent = "読取件数：" + text;
    }

    syncCount();

    const observer = new MutationObserver(syncCount);
    observer.observe(originalCount, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }

  injectCompactScannerStyle();
  installCompactCount();
})();
