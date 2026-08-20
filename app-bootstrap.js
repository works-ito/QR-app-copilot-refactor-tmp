/* QR在庫管理 Refactor integration bootstrap v1 */
(function() {
  "use strict";

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function() {
        reject(new Error("読み込み失敗：" + src));
      };
      document.body.appendChild(script);
    });
  }

  const modules = [
    "https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/iife/reader/index.js",
    "./scanner-zxing-wasm-dev.js?v=50",

    "./sales-stockin-core.js?v=33",
    "./sales-stockin-scan-enhancements.js?v=33",
    "./sales-stockin-guards.js?v=33",

    "./compact-scanner-dev.js?v=53",

    "./irregular-master-picker-dev.js?v=64",
    "./irregular-entry-simplify-dev.js?v=72",
    "./irregular-category-ui-tuning-dev.js?v=62",
    "./irregular-simple-id-alias-dev.js?v=42",
    "./irregular-master-layout-dev.js?v=40",
    "./irregular-registration-guard-dev.js?v=43",
    "./irregular-quantity-flow-dev.js?v=55",
    "./irregular-master-send-bridge-dev.js?v=85",
    "./irregular-master-shipment-photo-dev.js?v=82",

    "./quantity-transfer-dev.js?v=96",

    "./gemini-timing-dev.js?v=77",
    "./gemini-whole-image-dev.js?v=80",

    "./mode-description-hint-dev.js?v=37",
    "./runtime-control.js?v=1"
  ];

  modules.reduce(function(chain, src) {
    return chain.then(function() {
      return loadScript(src);
    });
  }, Promise.resolve()).catch(function(error) {
    console.error("リファクタ版の初期化に失敗しました", error);
  });
})();
