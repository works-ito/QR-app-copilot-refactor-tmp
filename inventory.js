/*
 * inventory.js v1
 *
 * Phase 1-Bravo: Consolidate inventory management
 *
 * Integrates:
 * - app.js inventory functions (initializeInventoryDataFoundation, loadAppInitialData, etc.)
 * - inventory-refresh-control-dev.js (periodic refresh, visibility handling)
 * - manual-refresh-ui-dev.js (manual refresh button)
 *
 * Single, unified responsibility:
 * - IndexedDB cache management
 * - Initial data load (GAS API)
 * - Periodic refresh (15 minutes)
 * - Visibility-based refresh (5min+ away)
 * - Manual refresh UI button
 * - Status display and animation
 *
 * No wrapper functions. Direct function definitions.
 * All functions delegate to app.js globals that already exist.
 */
(function() {
  "use strict";

  // Configuration
  const STATUS_ID = "inventoryDataStatus";
  const RESUME_REFRESH_MS = 5 * 60 * 1000;
  const RECENT_REFRESH_SUPPRESS_MS = 2 * 60 * 1000;
  const PENDING_CHECK_MS = 2000;
  const INITIAL_STATUS_CHECK_MS = 500;
  const INITIAL_STATUS_CHECK_LIMIT = 60;

  // State
  let refreshHiddenAt = null;
  let pendingInventoryRefresh = false;
  let lastInventoryRefreshAt = 0;
  let pendingCheckTimer = null;
  let initialStatusCheckTimer = null;
  let initialStatusCheckCount = 0;
  let inventoryRefreshTimer = null;

  /**
   * Get reference to app.js globals
   */
  function getAppGlobal(name) {
    return typeof window[name] !== "undefined" ? window[name] : null;
  }

  function getAppFunction(name) {
    const fn = getAppGlobal(name);
    return typeof fn === "function" ? fn : null;
  }

  /**
   * UI status updates
   */
  function startAnimatedDots(statusId) {
    const fn = getAppFunction("startAnimatedDots");
    if (fn) fn(statusId);
  }

  function stopAnimatedDots(statusId) {
    const fn = getAppFunction("stopAnimatedDots");
    if (fn) fn(statusId);
  }

  /**
   * Visibility checks
   */
  function isVisible() {
    return document.visibilityState === "visible";
  }

  function isIrregularMasterPickerOpen() {
    const panel = document.getElementById("irregularMasterPickerPanel");
    return Boolean(panel && panel.hidden === false);
  }

  function isReceptionIdle() {
    const wizardState = getAppGlobal("wizardState");
    if (wizardState && wizardState.currentStep !== "reception") {
      return false;
    }

    const pendingRecord = getAppGlobal("pendingWizardQuantityRecord");
    if (pendingRecord) {
      return false;
    }

    if (isIrregularMasterPickerOpen()) {
      return false;
    }

    const canRefreshFn = getAppFunction("canRefreshInventoryAutomatically");
    if (canRefreshFn) {
      return canRefreshFn();
    }

    return false;
  }

  /**
   * Status display formatting
   */
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatAbsoluteMinute(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";

    return (
      date.getFullYear() + "/" +
      pad2(date.getMonth() + 1) + "/" +
      pad2(date.getDate()) + " " +
      pad2(date.getHours()) + ":" +
      pad2(date.getMinutes())
    );
  }

  /**
   * setInventoryDataStatus() - Update status display
   */
  function setInventoryDataStatus(timestamp, animated) {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;

    const formatted = formatAbsoluteMinute(timestamp || Date.now());
    if (!formatted) return;

    if (animated) {
      startAnimatedDots(STATUS_ID);
    } else {
      stopAnimatedDots(STATUS_ID);
    }

    status.textContent = "在庫データ：" + formatted;
    status.className = "inventoryDataStatus isReady";
  }

  function setInventoryDataStatusLoading() {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;

    status.textContent = "在庫データ：前回データ確認済み ... ／最新データへ更新中";
    status.className = "inventoryDataStatus isLoading";
    startAnimatedDots(STATUS_ID);
  }

  function setInventoryDataStatusError(message) {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;

    const appInitialDataLoaded = getAppGlobal("appInitialDataLoaded");
    const hasCachedData = appInitialDataLoaded === true;

    status.textContent = hasCachedData
      ? "在庫データ：更新失敗・前回データを使用"
      : "在庫データ：取得失敗";

    if (message) {
      status.title = String(message);
    }

    status.className = "inventoryDataStatus isError";
    stopAnimatedDots(STATUS_ID);
  }

  /**
   * Refresh state tracking
   */
  function wasRecentlyRefreshed() {
    return (
      lastInventoryRefreshAt > 0 &&
      Date.now() - lastInventoryRefreshAt < RECENT_REFRESH_SUPPRESS_MS
    );
  }

  function markRefreshSuccess() {
    lastInventoryRefreshAt = Date.now();
    pendingInventoryRefresh = false;
    setInventoryDataStatus(lastInventoryRefreshAt, false);
  }

  /**
   * loadAppInitialData() - Fetch inventory from GAS
   * Delegate to app.js version
   */
  function loadAppInitialData(showLoading) {
    const appFn = getAppFunction("loadAppInitialData");
    if (!appFn) {
      return Promise.reject(new Error("app.js loadAppInitialData not found"));
    }

    if (showLoading !== false) {
      setInventoryDataStatusLoading();
    }

    return Promise.resolve(appFn(showLoading)).then(function(result) {
      if (result === true) {
        markRefreshSuccess();
      } else {
        const error = getAppGlobal("appInitialDataError");
        setInventoryDataStatusError(error || "");
      }
      return result;
    }).catch(function(error) {
      setInventoryDataStatusError(error && error.message ? error.message : String(error));
      return false;
    });
  }

  /**
   * requestRefresh() - Refresh inventory with conditions
   */
  async function requestRefresh(reason) {
    if (!isVisible()) {
      pendingInventoryRefresh = true;
      return false;
    }

    if (wasRecentlyRefreshed()) {
      pendingInventoryRefresh = false;
      console.log("在庫データ自動更新を省略：直近2分以内に更新済み", reason || "");
      return true;
    }

    if (!isReceptionIdle()) {
      pendingInventoryRefresh = true;
      console.log("在庫データ自動更新を保留：受付処理中", reason || "");
      return false;
    }

    console.log("在庫データ自動更新開始", reason || "");
    const success = await loadAppInitialData(false);

    if (success) {
      console.log("在庫データ自動更新完了", reason || "", new Date().toLocaleString());
      return true;
    }

    pendingInventoryRefresh = true;
    console.warn("在庫データ自動更新失敗", reason || "");
    return false;
  }

  /**
   * installControlledTimer() - Periodic refresh (15 minutes)
   */
  function installControlledTimer() {
    const DATA_REFRESH_MINUTES = getAppGlobal("DATA_REFRESH_MINUTES");
    if (typeof DATA_REFRESH_MINUTES === "undefined") return false;

    if (inventoryRefreshTimer) clearInterval(inventoryRefreshTimer);

    inventoryRefreshTimer = setInterval(function() {
      if (!isVisible()) return;
      void requestRefresh("定期更新");
    }, DATA_REFRESH_MINUTES * 60 * 1000);

    return true;
  }

  /**
   * handleVisibleReturn() - Refresh on return from background (5min+)
   */
  function handleVisibleReturn() {
    if (!refreshHiddenAt) return;

    const awayMs = Date.now() - refreshHiddenAt;
    refreshHiddenAt = null;

    const AUTO_RELOAD_MINUTES = getAppGlobal("AUTO_RELOAD_MINUTES");
    if (
      typeof AUTO_RELOAD_MINUTES !== "undefined" &&
      awayMs >= AUTO_RELOAD_MINUTES * 60 * 1000
    ) {
      return;
    }

    if (awayMs < RESUME_REFRESH_MS) return;
    void requestRefresh("5分復帰更新");
  }

  /**
   * installVisibilityControl() - Monitor visibility changes
   */
  function installVisibilityControl() {
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") {
        refreshHiddenAt = Date.now();
        return;
      }

      if (document.visibilityState === "visible") {
        handleVisibleReturn();
      }
    });

    window.addEventListener("pageshow", function() {
      if (document.visibilityState === "visible") {
        handleVisibleReturn();
      }
    });
  }

  /**
   * runPendingAfterSession() - Process pending refresh after session ends
   */
  function runPendingAfterSession() {
    if (!pendingInventoryRefresh) return;
    setTimeout(function() {
      void requestRefresh("受付終了後の保留更新");
    }, 0);
  }

  /**
   * startPendingChecker() - Periodic check for pending refresh
   */
  function startPendingChecker() {
    if (pendingCheckTimer) clearInterval(pendingCheckTimer);

    pendingCheckTimer = setInterval(function() {
      if (!pendingInventoryRefresh) return;
      if (!isVisible()) return;
      if (!isReceptionIdle()) return;
      void requestRefresh("保留更新の再確認");
    }, PENDING_CHECK_MS);
  }

  /**
   * installManualRefreshUi() - Add manual refresh button
   */
  function installManualRefreshUi() {
    const status = document.getElementById(STATUS_ID);
    if (!status) {
      setTimeout(installManualRefreshUi, 300);
      return;
    }

    const ROW_ID = "inventoryRefreshRow";
    const BUTTON_ID = "manualAppRefreshButton";

    if (document.getElementById(ROW_ID)) return;

    const row = document.createElement("div");
    row.id = ROW_ID;
    row.className = "inventoryRefreshRow";
    status.parentNode.insertBefore(row, status);
    row.appendChild(status);

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "manualAppRefreshButton";
    button.type = "button";
    button.textContent = "更新";

    button.addEventListener("click", function() {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = "更新中…";
      if (status) {
        status.textContent = "在庫データ：更新中…";
        status.className = "inventoryDataStatus isLoading";
      }

      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("appRefresh", String(Date.now()));
      window.location.replace(url.toString());
    });

    row.appendChild(button);

    const style = document.createElement("style");
    style.textContent =
      ".inventoryRefreshRow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}" +
      ".inventoryRefreshRow #inventoryDataStatus{min-width:0;flex:1;margin:0;}" +
      ".manualAppRefreshButton{flex:0 0 auto;min-width:62px;min-height:34px;padding:6px 11px;border:1px solid #d9e0ea;border-radius:9px;background:#fff;color:#475467;font-size:13px;font-weight:500;cursor:pointer;transition:all 200ms;}" +
      ".manualAppRefreshButton:hover{background:#f3f4f6;border-color:#bfdbfe;}" +
      ".manualAppRefreshButton:active{transform:translateY(1px);background:#f4f6f8;}" +
      ".manualAppRefreshButton:disabled{opacity:.65;}";
    document.head.appendChild(style);
  }

  /**
   * startInitialStatusCheck() - Monitor initial data load completion
   */
  function startInitialStatusCheck() {
    if (initialStatusCheckTimer) clearInterval(initialStatusCheckTimer);
    initialStatusCheckCount = 0;

    initialStatusCheckTimer = setInterval(function() {
      initialStatusCheckCount += 1;

      const appInitialDataLoaded = getAppGlobal("appInitialDataLoaded");
      const appInitialDataLoading = getAppGlobal("appInitialDataLoading");

      if (
        appInitialDataLoaded === true &&
        (appInitialDataLoading === undefined || appInitialDataLoading === false)
      ) {
        markRefreshSuccess();
        clearInterval(initialStatusCheckTimer);
        initialStatusCheckTimer = null;
        return;
      }

      if (initialStatusCheckCount >= INITIAL_STATUS_CHECK_LIMIT) {
        clearInterval(initialStatusCheckTimer);
        initialStatusCheckTimer = null;
      }
    }, INITIAL_STATUS_CHECK_MS);
  }

  /**
   * initializeInventoryDataFoundation() - Restore cache or load fresh
   */
  function initializeInventoryDataFoundation() {
    const restoreInventoryCache = getAppFunction("restoreInventoryCache");
    if (restoreInventoryCache) {
      restoreInventoryCache();
    }

    const appInitialDataLoaded = getAppGlobal("appInitialDataLoaded");

    if (appInitialDataLoaded === true) {
      markRefreshSuccess();
    } else {
      startInitialStatusCheck();
    }

    const startScannerFn = getAppFunction("startScannerAfterInventoryReady");
    if (startScannerFn) {
      startScannerFn();
    }
  }

  /**
   * install() - Initialize all inventory management
   */
  function install() {
    installManualRefreshUi();
    installControlledTimer();
    installVisibilityControl();
    startPendingChecker();

    const appInitialDataLoaded = getAppGlobal("appInitialDataLoaded");
    if (appInitialDataLoaded === true) {
      markRefreshSuccess();
    } else {
      startInitialStatusCheck();
    }

    // Export public API
    window.InventoryControl = {
      requestRefresh: requestRefresh,
      runPendingAfterSession: runPendingAfterSession,
      markRefreshSuccess: markRefreshSuccess,
      setInventoryDataStatus: setInventoryDataStatus,
      loadAppInitialData: loadAppInitialData
    };

    console.info("inventory.js v1 loaded. Unified inventory management.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
