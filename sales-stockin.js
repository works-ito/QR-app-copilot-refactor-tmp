/* 販売品入庫受付 v32 bootstrap */
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

  loadScript("./sales-stockin-core.js?v=32")
    .then(function() {
      return loadScript("./sales-stockin-scan-enhancements.js?v=32");
    })
    .then(function() {
      return loadScript("./sales-stockin-guards.js?v=32");
    })
    .catch(function(error) {
      console.error("販売品入庫受付の初期化に失敗しました", error);
    });
})();
