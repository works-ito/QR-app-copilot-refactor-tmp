/*
 * 開発版 v83：イレギュラー受付 → マスタ選択 → 出庫 の画面遷移を滑らかにする。
 *
 * v81では送信確認直後にイレギュラー受付カードを閉じるため、
 * GAS応答後のローカル保存・送信後フロー準備が終わるまで
 * 「設定完了だけが残る空白状態」が見えることがあった。
 *
 * この補強では、出庫写真画面が実際に開くまでは
 * イレギュラー受付カードを表示したまま維持する。
 * beginWizardPostSendFlow() が写真画面を開いた時点では
 * 既存の非表示処理をそのまま許可する。
 *
 * GAS送信・在庫登録・写真保存ロジックは変更しない。
 */
(function() {
  "use strict";

  if (window.__irregularMasterShipmentTransitionDevInstalled) return;
  window.__irregularMasterShipmentTransitionDevInstalled = true;

  const originalSend = window.sendIrregularMasterPickerBatch;

  if (typeof originalSend !== "function") {
    console.warn(
      "開発版：イレギュラーマスタ出庫遷移補強を読み込めませんでした"
    );
    return;
  }

  function isShipmentPhotoVisible() {
    const photoArea = document.getElementById("wizardPhotoArea");
    return Boolean(photoArea && photoArea.hidden === false);
  }

  window.sendIrregularMasterPickerBatch = async function(records) {
    if (
      wizardState.receptionType !== "irregular" ||
      wizardState.mode !== "出庫"
    ) {
      return await originalSend(records);
    }

    const irregularArea = document.getElementById("wizardIrregularArea");
    let observer = null;

    if (irregularArea) {
      observer = new MutationObserver(function() {
        /*
         * 送信中〜写真画面準備完了までは空白にしない。
         * 写真画面が開いた後は、既存フローによる非表示を許可する。
         */
        if (
          irregularArea.hidden &&
          !isShipmentPhotoVisible()
        ) {
          irregularArea.hidden = false;
        }
      });

      observer.observe(irregularArea, {
        attributes:true,
        attributeFilter:["hidden"]
      });
    }

    try {
      return await originalSend(records);
    } finally {
      if (observer) observer.disconnect();

      /*
       * 正常遷移後に写真画面が見えていれば、
       * イレギュラー受付カードは確実に閉じる。
       */
      if (irregularArea && isShipmentPhotoVisible()) {
        irregularArea.hidden = true;
      }
    }
  };

  console.info(
    "開発版：イレギュラーマスタ出庫遷移補強 v83 読込完了"
  );
})();
