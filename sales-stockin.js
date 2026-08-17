/* 販売品入庫受付 v42 bootstrap */
(function() {
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

  loadScript("./sales-stockin-core.js?v=33")
    .then(function() {
      return loadScript("./sales-stockin-scan-enhancements.js?v=33");
    })
    .then(function() {
      return loadScript("./sales-stockin-guards.js?v=33");
    })
    .then(function() {
      return loadScript("./compact-scanner-dev.js?v=33");
    })
    .then(function() {
      return loadScript("./irregular-master-picker-dev.js?v=41");
    })
    .then(function() {
      return loadScript("./irregular-simple-id-alias-dev.js?v=42");
    })
    .then(function() {
      return loadScript("./irregular-master-layout-dev.js?v=40");
    })
    .then(function() {
      return loadScript("./irregular-registration-guard-dev.js?v=42");
    })
    .then(function() {
      return loadScript("./mode-description-hint-dev.js?v=37");
    })
    .catch(function(error) {
      console.error("開発版追加処理の初期化に失敗しました", error);
    });
})();
