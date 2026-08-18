/*
 * イレギュラー受付：マスタ選択 → 共通送信ブリッジ補強 v70
 *
 * 目的：
 * - マスタ選択キューを通常QRと同じ scannedEntries / sendWizardBatch() へ渡す。
 * - 返却時、追記確認へ遷移した時点でキュー側は受け渡し完了とする。
 * - マスタ選択後に旧「番号入力」画面へ戻らず、返却追記へそのまま進める。
 * - 同一レコードが既に staged 済みなら、同内容に限って再利用する。
 * - 数量・出庫取消は sourceQuantityLogId まで含めて同一性を判定する。
 *
 * GASは変更しない。
 */
(function() {
  "use strict";

  function normalize(value) {
    return String(value == null ? "" : value).trim();
  }

  function sameStagedRecord(existing, candidate) {
    if (!existing || !candidate) return false;
    if (existing.key !== candidate.key) return false;
    if (existing.recordType !== candidate.recordType) return false;

    if (candidate.recordType === "quantity") {
      return (
        Number(existing.quantity) === Number(candidate.quantity) &&
        normalize(existing.itemCode) === normalize(candidate.itemCode) &&
        normalize(existing.sourceQuantityLogId) ===
          normalize(candidate.sourceQuantityLogId)
      );
    }

    return (
      normalize(existing.qrText) === normalize(candidate.qrText) &&
      normalize(existing.managementType) === normalize(candidate.managementType)
    );
  }

  function prepareReturnMemoHost() {
    const irregularArea =
      document.getElementById("wizardIrregularArea");
    const cameraArea =
      document.getElementById("cameraPreview");

    /*
     * 旧直接入力フォームは wizardIrregularArea の中にある。
     * マスタから選択済みなら、返却追記へ進む間はここを閉じる。
     */
    if (irregularArea) {
      irregularArea.hidden = true;
    }

    /*
     * 返却追記は cameraPreview（scannerArea）の中にある。
     * イレギュラー受付では通常この領域が非表示なので、
     * マスタ選択 → 返却のときだけ追記用ホストとして表示する。
     */
    if (cameraArea) {
      cameraArea.classList.add("isActive");
    }

    [
      "scannerStatus",
      "scannerViewport",
      "scannerResult",
      "scannerQuantityInput",
      "cancelLastScanButton",
      "resetAllScansButton",
      "wizardSendBatchButton"
    ].forEach(function(id) {
      const element = document.getElementById(id);
      if (element) element.hidden = true;
    });
  }

  window.sendIrregularMasterPickerBatch = async function(records) {
    if (!Array.isArray(records) || !records.length) {
      alert("送信する品目がありません");
      return false;
    }

    const imported = [];

    for (const selected of records) {
      if (selected && selected.preview) {
        alert("UI確認用データは送信できません");
        return false;
      }

      const lookupCode =
        selected.type === "machine"
          ? selected.managedId
          : selected.code;

      const details = getScannerItemDetails(lookupCode);

      if (!details) {
        alert(
          (lookupCode || "対象品目") +
          "を最新の初期データから確認できません。\n" +
          "画面を再読み込みして、もう一度選択してください。"
        );
        return false;
      }

      if (!isScannerModeAllowed(details.managementType, wizardState.mode)) {
        alert(
          details.displayName +
          "は「" + wizardState.modeLabel +
          "」では送信できません"
        );
        return false;
      }

      const record = buildWizardScanRecord(details);

      if (record.recordType === "quantity") {
        const quantity = Number(selected.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
          alert("数量は1以上の整数で入力してください");
          return false;
        }

        record.quantity = quantity;
        record.sourceQuantityLogId =
          normalize(selected.sourceQuantityLogId);

        if (
          wizardState.mode === "出庫取消" &&
          !record.sourceQuantityLogId
        ) {
          alert("取消対象の出庫履歴を選択してください");
          return false;
        }

        if (record.sourceQuantityLogId) {
          record.key += "__" + record.sourceQuantityLogId;
        }
      }

      const staged = scannedEntries.find(function(item) {
        return item && item.key === record.key;
      });

      if (staged) {
        if (!sameStagedRecord(staged, record)) {
          alert(
            record.displayName +
            "は同じ作業で別内容がすでに追加されています。\n" +
            "読取済み一覧を確認してください。"
          );
          return false;
        }
        continue;
      }

      if (
        imported.some(function(item) {
          return item.key === record.key;
        })
      ) {
        alert(record.displayName + "はすでに追加済みです");
        return false;
      }

      imported.push(record);
    }

    if (imported.length) {
      scannedEntries.push.apply(scannedEntries, imported);
      renderScannerResults();
    }

    const isReturnMemoStage =
      wizardState.mode === "返却" &&
      !wizardReturnMemoConfirmed;

    if (isReturnMemoStage) {
      prepareReturnMemoHost();
      await sendWizardBatch();

      /*
       * この false は「送信失敗」ではなく、返却追記の入力待ち。
       * picker側のキューは役目を終えているのでクリアさせる。
       */
      return true;
    }

    return await sendWizardBatch();
  };

  console.info(
    "開発版：イレギュラーマスタ送信ブリッジ v70 読込完了"
  );
})();
