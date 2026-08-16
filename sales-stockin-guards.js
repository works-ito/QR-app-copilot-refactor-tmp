/* 販売品入庫受付中の既存ウィザードナビゲーション競合を防ぐ。 */
(function() {
  function isSalesPanelActive() {
    const panel = document.getElementById("salesStockInPanel");
    return Boolean(panel && panel.classList.contains("isActive"));
  }

  function closeSalesPanelToReception() {
    const panel = document.getElementById("salesStockInPanel");
    if (panel) panel.classList.remove("isActive");
    if (typeof stopSalesQrScanner === "function") {
      try { stopSalesQrScanner(); } catch (error) {}
    }
    showStep("reception");
    document.getElementById("headerBackButton").classList.add("hidden");
  }

  const salesEntryButton = document.getElementById("salesStockInEntryButton");
  if (salesEntryButton) {
    salesEntryButton.addEventListener("click", function() {
      document.getElementById("headerBackButton").classList.add("hidden");
    });
  }

  ["headerBackButton", "restartButton"].forEach(function(id) {
    const button = document.getElementById(id);
    if (!button) return;

    button.addEventListener("click", function(event) {
      if (!isSalesPanelActive()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSalesPanelToReception();
    }, true);
  });
})();
