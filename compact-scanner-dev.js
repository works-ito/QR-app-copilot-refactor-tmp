/* 開発版 v52：zxing-wasm採用後の最小カメラ枠テスト */
(function() {
  "use strict";

  /*
   * 読取ロジック・ズームには触れず、表示領域だけを小さくする。
   * zxing-wasm補助が小さい表示でもData Matrixを安定して拾えるか実機確認する。
   * video自体のカメラ入力解像度は変更しない。
   */
  const style = document.createElement("style");
  style.id = "compactScannerV52Style";
  style.textContent = `
    .scannerViewport {
      max-width: 430px;
    }

    .scannerVideo {
      aspect-ratio: 10 / 9 !important;
      object-fit: cover !important;
    }

    .scannerFrame {
      left: 30% !important;
      top: 27.5% !important;
      width: 40% !important;
      height: 45% !important;
      border-width: 3px !important;
      border-radius: 12px !important;
    }
  `;
  document.head.appendChild(style);

  console.info("開発版 v52：最小カメラ表示 10:9 + ガイド40% 有効");
})();
