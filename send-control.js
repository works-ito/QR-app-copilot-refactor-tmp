/*
 * send-control.js v1
 *
 * Phase 1-Alpha: Send/Cancel Control Consolidation
 * 
 * Responsibilities:
 * - GAS batch write API (sendBatchRecords)
 * - Send cancellation (cancelLastSuccessfulSend)
 * - Local state capture/restore for undo
 * - Recent work tracking (5-minute duplicate prevention)
 * - Cancel button expiry management
 *
 * No wrapper functions. Direct function extraction from app.js.
 * All functions delegate to globals already defined in app.js
 * (appInitialDataLoaded, lastSuccessfulSend, etc.)
 *
 * Dependencies on app.js:
 * - GAS_URL constant
 * - appInitialDataLoaded, wizardSendBusy, scannerBusy
 * - scannedEntries, wizardPostSendContext
 * - lastSuccessfulSend, cancelSendExpiryTimer
 * - wizardState, wizardSelectedPhotos, wizardCurrentSlipInfo, wizardPendingPhotoSave
 * - startAnimatedDots(), stopAnimatedDots()
 * - setInventoryDataStatus(), renderCancelSendButton()
 * - setTemporaryScannerStatus()
 * - saveInventoryCache(), loadAppInitialData()
 * - resumeWizardContinuousScan()
 * - startReadOnlyScanner(), stopReadOnlyScanner()
 *
 * Store references to these functions and manage batch send/cancel.
 */
(function() {
  "use strict";

  const LAST_SUCCESSFUL_SEND_STORAGE_KEY = "qrInventoryWizardLastSuccessfulSendV1";
  const RECENT_WORK_STORAGE_KEY = "qrInventoryRecentSuccessfulWorks";
  const CANCEL_SEND_VALID_MS = 5 * 60 * 1000;
  const RECENT_WORK_BLOCK_MS = 5 * 60 * 1000;

  /**
   * Extract function signatures from app.js globals for delegation
   */
  function getAppGlobal(name) {
    return typeof window[name] !== "undefined" ? window[name] : null;
  }

  function getAppFunction(name) {
    const fn = getAppGlobal(name);
    return typeof fn === "function" ? fn : null;
  }

  /**
   * createBatchId() - Generate unique batch ID
   */
  function createBatchId() {
    return "BATCH-" + new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14) + "-" +
      Math.floor(Math.random() * 1000);
  }

  /**
   * buildBatchRecordData() - Transform scanned record to GAS payload
   */
  function buildBatchRecordData(record) {
    const data = {
      mode: record.mode,
      qr: record.qr || record.qrText,
      user: record.user,
      location: record.location,
      recTarget: record.recTarget || "",
      recDate: record.recDate || "",
      recordType: record.recordType || "",
      managementType: record.managementType || "",
      displayName: record.displayName || ""
    };

    if (record.recordType === "quantity") {
      data.itemCode = record.itemCode;
      data.quantity = record.quantity;
      data.unit = record.unit;
      data.category = record.category;
      data.sourceQuantityLogId = record.sourceQuantityLogId || "";
    }

    return data;
  }

  /**
   * getSuccessfulResultIndexes() - Parse GAS response to identify successful sends
   */
  function getSuccessfulResultIndexes(result, recordCount) {
    const results = result && Array.isArray(result.results) ? result.results : [];
    const indexes = [];

    results.forEach(function(item, position) {
      const itemSucceeded = Boolean(item && (item.ok === true || item.success === true));
      if (!itemSucceeded) return;
      const suppliedIndex = Number(item.index);
      const index = Number.isInteger(suppliedIndex) ? suppliedIndex : position;
      if (index >= 0 && index < recordCount) indexes.push(index);
    });

    const uniqueIndexes = Array.from(new Set(indexes));

    /**
     * When GAS batch succeeds but returns no detail results,
     * complement if: ok=true, failedCount=0, successCount matches recordCount
     */
    if (
      uniqueIndexes.length === 0 &&
      result &&
      result.ok === true &&
      Number(result.failedCount || 0) === 0 &&
      (
        Number(result.successCount || 0) === recordCount ||
        (results.length === 0 && Number(result.successCount || 0) === 0)
      )
    ) {
      return Array.from({ length: recordCount }, function(_, index) { return index; });
    }

    return uniqueIndexes;
  }

  /**
   * captureLocalState() - Save item state before send (for undo)
   */
  function captureLocalState(record) {
    if (!record || record.recordType === "quantity") return null;

    const getLocalManagedItem = getAppFunction("getLocalManagedItem");
    const getLocalItemState = getAppFunction("getLocalItemState");
    const getLocalItemLocation = getAppFunction("getLocalItemLocation");

    if (!getLocalManagedItem || !getLocalItemState || !getLocalItemLocation) return null;

    const item = getLocalManagedItem(record.qr || record.qrText, record.managementType);
    return {
      qr: record.qr || record.qrText,
      managementType: record.managementType,
      previousState: getLocalItemState(item),
      previousLocation: getLocalItemLocation(item),
      mode: record.mode
    };
  }

  /**
   * applySuccessfulLocalState() - Update item state after successful send
   */
  function applySuccessfulLocalState(record) {
    if (!record || record.recordType === "quantity") return;

    const getLocalManagedItem = getAppFunction("getLocalManagedItem");
    const getNextLocalState = getAppFunction("getNextLocalState");
    const setFirstLocalValue = getAppFunction("setFirstLocalValue");

    if (!getLocalManagedItem || !getNextLocalState || !setFirstLocalValue) return;

    const item = getLocalManagedItem(record.qr || record.qrText, record.managementType);
    const nextState = getNextLocalState(record.mode);

    if (nextState) {
      setFirstLocalValue(
        item,
        ["現在状態", "最新状態", "状態", "作業区分", "status"],
        nextState,
        "現在状態"
      );
    }

    if ((record.mode === "拠点移動") && record.location) {
      setFirstLocalValue(
        item,
        ["現在拠点", "拠点", "保管拠点", "location"],
        record.location,
        "現在拠点"
      );
    }
  }

  /**
   * restoreLocalState() - Restore item state on send cancel
   */
  function restoreLocalState(snapshot) {
    if (!snapshot) return;

    const getLocalManagedItem = getAppFunction("getLocalManagedItem");
    const setFirstLocalValue = getAppFunction("setFirstLocalValue");

    if (!getLocalManagedItem || !setFirstLocalValue) return;

    const item = getLocalManagedItem(snapshot.qr, snapshot.managementType);

    setFirstLocalValue(
      item,
      ["現在状態", "最新状態", "状態", "作業区分", "status"],
      snapshot.previousState || "",
      "現在状態"
    );

    setFirstLocalValue(
      item,
      ["現在拠点", "拠点", "保管拠点", "location"],
      snapshot.previousLocation || "",
      "現在拠点"
    );
  }

  /**
   * getRecentSuccessfulWorks() - Get recent 5-minute work history
   */
  function getRecentSuccessfulWorks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_WORK_STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      const active = parsed.filter(function(item) {
        return item && now - Number(item.sentAt || 0) < RECENT_WORK_BLOCK_MS;
      });
      localStorage.setItem(RECENT_WORK_STORAGE_KEY, JSON.stringify(active));
      return active;
    } catch (error) {
      console.warn("Recent work history load failed", error);
      return [];
    }
  }

  /**
   * rememberRecentSuccessfulWorks() - Add successful sends to 5-minute block list
   */
  function rememberRecentSuccessfulWorks(records, successfulIndexes) {
    const source = Array.isArray(records) ? records : [];
    const successSet = new Set(Array.isArray(successfulIndexes) ? successfulIndexes : []);
    const now = Date.now();
    let recent = getRecentSuccessfulWorks();
    const savedKeys = [];

    const normalizeLookupKey = getAppFunction("normalizeLookupKey");
    if (!normalizeLookupKey) return savedKeys;

    source.forEach(function(record, index) {
      if (!record || !successSet.has(index)) return;
      if (record.recordType === "quantity") return;

      const qrText = String(record.qrText || record.qr || "").trim();
      const qrKey = normalizeLookupKey(qrText);
      const mode = String(record.mode || "").trim();
      if (!qrKey || !mode) return;

      const workKey = qrKey + "||" + mode;
      recent = recent.filter(function(item) {
        return item.qrKey + "||" + item.mode !== workKey;
      });
      recent.push({ qrKey: qrKey, mode: mode, sentAt: now });
      savedKeys.push(workKey);
    });

    try {
      localStorage.setItem(RECENT_WORK_STORAGE_KEY, JSON.stringify(recent));
    } catch (error) {
      console.warn("Recent work history save failed", error);
    }

    return savedKeys;
  }

  /**
   * clearRecentSuccessfulWorkRecords() - Remove items from 5-minute block
   */
  function clearRecentSuccessfulWorkRecords(workKeys) {
    const keys = Array.isArray(workKeys) ? workKeys : [];
    if (!keys.length) return;
    const keySet = new Set(keys);
    const recent = getRecentSuccessfulWorks().filter(function(item) {
      return !keySet.has(item.qrKey + "||" + item.mode);
    });
    try {
      localStorage.setItem(RECENT_WORK_STORAGE_KEY, JSON.stringify(recent));
    } catch (error) {
      console.warn("Recent work history clear failed", error);
    }
  }

  /**
   * saveLastSuccessfulSend() - Store send transaction for 5-minute cancel window
   */
  function saveLastSuccessfulSend(transaction) {
    try {
      localStorage.setItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY, JSON.stringify(transaction));
      const renderFn = getAppFunction("renderCancelSendButton");
      if (renderFn) renderFn();
    } catch (error) {
      console.warn("Last send save failed", error);
    }
  }

  /**
   * clearLastSuccessfulSend() - Clear send transaction
   */
  function clearLastSuccessfulSend() {
    try {
      localStorage.removeItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY);
      const renderFn = getAppFunction("renderCancelSendButton");
      if (renderFn) renderFn();
    } catch (error) {
      console.warn("Last send clear failed", error);
    }
  }

  /**
   * restoreLastSuccessfulSend() - Load send transaction from storage on page load
   */
  function restoreLastSuccessfulSend() {
    try {
      const value = JSON.parse(localStorage.getItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY) || "null");
      if (value && Number(value.expiresAt || 0) > Date.now()) {
        // Value is valid, let app.js handle it
        return value;
      } else {
        localStorage.removeItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY);
      }
    } catch (error) {
      localStorage.removeItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY);
    }
    return null;
  }

  /**
   * sendBatchRecords() - POST to GAS batch write API
   *
   * Note: No automatic retry. If response is lost, GAS has already saved.
   * Returning "result unknown" prevents double sends.
   */
  function sendBatchRecords(records, options) {
    const gasUrl = getAppGlobal("GAS_URL");
    if (!gasUrl) {
      return Promise.reject(new Error("GAS_URL not found"));
    }

    const batchId = createBatchId();
    window.lastPendingSendId = batchId;

    const recordsWithIds = records.map(function(record) {
      return Object.assign({}, record, {
        batchId: batchId,
        sendId: batchId
      });
    });

    const payload = {
      action: "batchWrite",
      batchId: batchId,
      sendId: batchId,
      initialDataVersion: "status-light-v2",
      stateValidationVersion: "known-state-v2",
      records: recordsWithIds
    };

    if (options && typeof options === "object") {
      Object.assign(payload, options);
    }

    return fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    }).then(async function(response) {
      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (error) {
        const unknownError = new Error("Failed to parse send result");
        unknownError.sendId = batchId;
        unknownError.responseExcerpt = responseText.slice(0, 200);
        throw unknownError;
      }

      if (!result || typeof result.ok !== "boolean") {
        const unknownError = new Error("Invalid send result format");
        unknownError.sendId = batchId;
        throw unknownError;
      }

      if (!response.ok && result.ok !== false) {
        const unknownError = new Error("HTTP " + response.status + ": Cannot confirm send result");
        unknownError.sendId = batchId;
        throw unknownError;
      }

      if (!result.sendId) {
        result.sendId = batchId;
      }

      return result;
    });
  }

  /**
   * Public API
   */
  window.SendControl = {
    createBatchId: createBatchId,
    buildBatchRecordData: buildBatchRecordData,
    getSuccessfulResultIndexes: getSuccessfulResultIndexes,
    captureLocalState: captureLocalState,
    applySuccessfulLocalState: applySuccessfulLocalState,
    restoreLocalState: restoreLocalState,
    getRecentSuccessfulWorks: getRecentSuccessfulWorks,
    rememberRecentSuccessfulWorks: rememberRecentSuccessfulWorks,
    clearRecentSuccessfulWorkRecords: clearRecentSuccessfulWorkRecords,
    saveLastSuccessfulSend: saveLastSuccessfulSend,
    clearLastSuccessfulSend: clearLastSuccessfulSend,
    restoreLastSuccessfulSend: restoreLastSuccessfulSend,
    sendBatchRecords: sendBatchRecords
  };

  console.info("send-control.js v1 loaded. API: window.SendControl.*");
})();
