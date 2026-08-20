/*
 * 手動更新UI v93
 *
 * - 在庫データ表示の右側に［更新］ボタンを追加する。
 * - 通常時の件数表示を隠し、「在庫データ：最新」に簡略化する。
 * - 更新ボタンはホーム画面追加版でも使えるよう、ページ全体を
 *   キャッシュバスター付きURLで再読込する。
 */
(function() {
  "use strict";

  const STATUS_ID = "inventoryDataStatus";
  const ROW_ID = "inventoryRefreshRowDev";
  const BUTTON_ID = "manualAppRefreshButtonDev";

  function normalizeStatusText(element) {
    if (!element) return;

    const text = String(element.textContent || "").trim();

    if (
      text.indexOf("在庫データ：更新完了") === 0 ||
      text.indexOf("在庫データ：キャッシュ") === 0
    ) {
      element.textContent = "在庫データ：最新";
    }
  }

  function runFullRefresh(button, status) {
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "更新中…";

    if (status) {
      status.textContent = "在庫データ：更新中…";
    }

    /*
     * ホーム画面追加版でも確実にHTMLから読み直せるよう、
     * 現在URLのクエリを appRefresh のみに置き換えて再読込する。
     */
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("appRefresh", String(Date.now()));
    window.location.replace(url.toString());
  }

  function install() {
    const status = document.getElementById(STATUS_ID);
    if (!status) {
      setTimeout(install, 300);
      return;
    }

    if (document.getElementById(ROW_ID)) return;

    const row = document.createElement("div");
    row.id = ROW_ID;
    row.className = "inventoryRefreshRowDev";

    status.parentNode.insertBefore(row, status);
    row.appendChild(status);

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "manualAppRefreshButtonDev";
    button.type = "button";
    button.textContent = "更新";
    button.addEventListener("click", function() {
      runFullRefresh(button, status);
    });
    row.appendChild(button);

    const style = document.createElement("style");
    style.textContent =
      ".inventoryRefreshRowDev{" +
        "display:flex;align-items:center;justify-content:space-between;" +
        "gap:8px;margin-bottom:8px;" +
      "}" +
      ".inventoryRefreshRowDev #inventoryDataStatus{" +
        "min-width:0;flex:1;margin:0;" +
      "}" +
      ".manualAppRefreshButtonDev{" +
        "flex:0 0 auto;min-width:62px;min-height:34px;padding:6px 11px;" +
        "border:1px solid #d9e0ea;border-radius:9px;background:#fff;" +
        "color:#475467;font-size:13px;font-weight:800;" +
      "}" +
      ".manualAppRefreshButtonDev:active{transform:translateY(1px);background:#f4f6f8;}" +
      ".manualAppRefreshButtonDev:disabled{opacity:.65;}";
    document.head.appendChild(style);

    normalizeStatusText(status);

    const observer = new MutationObserver(function() {
      normalizeStatusText(status);
    });
    observer.observe(status, {
      childList:true,
      characterData:true,
      subtree:true
    });

    console.info("開発版：手動更新UI v93 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();
