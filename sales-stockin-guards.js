/* 販売品入庫受付中の既存ウィザードナビゲーション競合を防ぐ。 */
(function() {
  function isSalesPanelActive() {
    const panel = document.getElementById("salesStockInPanel");
    return Boolean(panel && panel.classList.contains("isActive"));
  }

  const salesEntryButton = document.getElementById("salesStockInEntryButton");
  if (salesEntryButton) {
    salesEntryButton.addEventListener("click", function() {
      /* 販売品受付には専用の「受付方法へ戻る」ボタンがある。 */
      document.getElementById("headerBackButton").classList.add("hidden");
    });
  }

  const restartButton = document.getElementById("restartButton");
  if (restartButton) {
    restartButton.addEventListener("click", function(event) {
      if (!isSalesPanelActive()) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      /*
       * 販売品QRカメラが起動中でも確実にMediaStreamを破棄するため、
       * 販売品受付中の「最初から」はページ再初期化で受付画面へ戻す。
       */
      window.location.reload();
    }, true);
  }
})();
