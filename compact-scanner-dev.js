/* 開発版 v51：zxing-wasm採用後の最小カメラ枠テスト */
(function() {
  "use strict";

  /*
   * 読取ロジック・ズームには触れず、表示領域だけを小さくする。
   * zxing-wasm補助が小さい表示でもData Matrixを安定して拾えるか実機確認する。
   * video自体のカメラ入力解像度は変更しない。
   */
  const style = document.createElement("style");
  style.id = "compactScannerV51Style";
  style.textContent = `
    .scannerViewport {
      max-width: 430px;
    }

    .scannerVideo {
      aspect-ratio: 10 / 9 !important;
      object-fit: cover !important;
    }

    .scannerFrame {
      left: 25% !important;
      top: 22% !important;
      width: 50% !important;
      height: 56% !important;
      border-width: 3px !important;
      border-radius: 12px !important;
    }
  `;
  document.head.appendChild(style);

  console.info("開発版 v51：最小カメラ表示 10:9 + ガイド50% 有効");
})();
