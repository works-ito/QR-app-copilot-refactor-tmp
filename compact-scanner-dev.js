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

      @media (max-width:390px) and (max-height:700px) {
        #cameraPreview .scannerViewport {
          scroll-margin-top:82px;
          margin-bottom:5px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectCompactScannerStyle();
})();
