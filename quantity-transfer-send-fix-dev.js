/*
 * 数量管理品：拠点移動 送信補強 v90
 *
 * 目的：
 * - getWizardPreparedBatchRecords() で sourceLocation を必ずGAS送信データへ含める。
 * - イレギュラー受付のマスタ選択経由でも、拠点移動成功時に通常の
 *   1受付1セッション終了フローへ確実に乗せる。
 *
 * GASは変更しない。
 */
(function() {
  "use strict";

  function normalize(value) {
    return String(value == null ? "" : value).trim();
  }

  function patchPreparedBatchRecords() {
    if (typeof getWizardPreparedBatchRecords !== "function") return false;
    if (getWizardPreparedBatchRecords.__quantityTransferSendFixV90) return true;

    const original = getWizardPreparedBatchRecords;

    const patched = function() {
      const prepared = original.apply(this, arguments);
      if (!Array.isArray(prepared)) return prepared;

      prepared.forEach(function(data, index) {
        if (!data || data.recordType !== "quantity") return;

        let live = null;
        try {
          live = Array.isArray(scannedEntries) ? scannedEntries[index] : null;
        } catch (error) {}

        if (data.mode === "拠点移動") {
          const source = normalize(
            data.sourceLocation ||
            (live && live.sourceLocation)
          );

          data.sourceLocation = source;

          if (!source) {
            throw new Error(
              (data.itemCode || data.qr || "数量管理品") +
              "の移動元拠点が送信データにありません"
            );
          }
        } else if (live && live.sourceLocation) {
          data.sourceLocation = normalize(live.sourceLocation);
        }
      });

      return prepared;
    };

    patched.__quantityTransferSendFixV90 = true;
    patched.__original = original;

    getWizardPreparedBatchRecords = patched;
    window.getWizardPreparedBatchRecords = patched;
    return true;
  }

  function patchIrregularTransferCompletion() {
    if (typeof window.sendIrregularMasterPickerBatch !== "function") return false;
    if (window.sendIrregularMasterPickerBatch.__quantityTransferCompletionV90) return true;

    const original = window.sendIrregularMasterPickerBatch;

    const patched = async function(records) {
      const isTransfer =
        typeof wizardState !== "undefined" &&
        wizardState.receptionType === "irregular" &&
        wizardState.mode === "拠点移動";

      const accepted = await original.apply(this, arguments);

      /*
       * 成功時は共通送信側で scannedEntries が空になり、
       * beginWizardPostSendFlow() → resumeWizardContinuousScan() →
       * 1受付1セッション終了へ進む。
       * ここでは旧マスタパネルが再露出しないよう、成功時だけ閉じる。
       * 失敗時は再送用レコードを残すため閉じない。
       */
      if (isTransfer && accepted) {
        let hasRemaining = false;
        try {
          hasRemaining = Array.isArray(scannedEntries) && scannedEntries.length > 0;
        } catch (error) {}

        if (!hasRemaining) {
          const panel = document.getElementById("irregularMasterPickerPanel");
          if (panel) panel.hidden = true;

          const root = document.getElementById("irregularMasterPickerDev");
          if (root) {
            root.querySelectorAll(".irregularMasterStep").forEach(function(step) {
              step.hidden = true;
            });
          }
        }
      }

      return accepted;
    };

    patched.__quantityTransferCompletionV90 = true;
    patched.__original = original;
    window.sendIrregularMasterPickerBatch = patched;
    return true;
  }

  function install() {
    if (!patchPreparedBatchRecords()) {
      setTimeout(patchPreparedBatchRecords, 300);
    }

    if (!patchIrregularTransferCompletion()) {
      setTimeout(patchIrregularTransferCompletion, 300);
    }

    console.info("開発版：数量管理品 拠点移動送信補強 v90 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();
