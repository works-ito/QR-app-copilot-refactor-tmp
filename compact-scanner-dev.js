/* 開発版 v44：Data Matrix切り分け用に通常スキャナ表示を本番相当へ戻す */
(function() {
  function injectCompactScannerStyle() {
    if (document.getElementById("compactScannerDevStyle")) return;

    const style = document.createElement("style");
    style.id = "compactScannerDevStyle";
    style.textContent = `
      /*
       * Data Matrix読取不良の切り分け用。
       * 以前の10:9コンパクト表示は一旦停止し、styles.css本来の3:4表示を使う。
       * 読取ロジック・ZXing設定・GASは変更しない。
       */
      #cameraPreview .scannerViewport {
        scroll-margin-top:96px;
      }

      @media (max-width:390px) and (max-height:700px) {
        #cameraPreview .scannerViewport {
          scroll-margin-top:82px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectCompactScannerStyle();
})();
