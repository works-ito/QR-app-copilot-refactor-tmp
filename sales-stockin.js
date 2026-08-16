/*
 * 販売品入庫受付（開発版）
 *
 * 現時点ではGAS側の仕入入庫処理・販売品出庫取消履歴選択が未実装のため、
 * 仕入入庫の送信と販売品の出庫取消送信は行わない。
 * UI・販売品抽出・通常受付での販売品制限だけ先行実装する。
 */
(function() {
  const SALES_CATEGORY = "販売品";
  const SALES_ALLOWED_NORMAL_MODES = ["出庫", "出庫取消"];

  let salesEntryState = {
    location:"",
    user:"",
    selections:[]
  };

  function getCategory(item) {
    return getFirstItemValue(item || {}, ["区分", "category"]);
  }

  function isSalesItem(item) {
    return String(getCategory(item) || "").trim() === SALES_CATEGORY;
  }

  function getSalesMasterItems() {
    return quantityItems
      .filter(isSalesItem)
      .map(function(item) {
        const itemCode = getFirstItemValue(
          item,
          ["品目コード", "itemCode", "商品コード", "コード"]
        );
        return {
          itemCode:itemCode,
          displayName:getFirstItemValue(
            item,
            ["表示名", "品名", "商品名", "名称", "displayName", "name"]
          ) || itemCode,
          unit:getFirstItemValue(item, ["単位", "unit"]) || "個",
          category:SALES_CATEGORY,
          sourceItem:item
        };
      })
      .filter(function(item) {
        return Boolean(item.itemCode);
      });
  }

  function hideWizardPanelsForSalesEntry() {
    Object.keys(STEP_IDS).forEach(function(name) {
      const panel = document.getElementById(STEP_IDS[name]);
      if (panel) panel.classList.remove("isActive");
    });

    const salesPanel = document.getElementById("salesStockInPanel");
    if (salesPanel) salesPanel.classList.add("isActive");

    document.getElementById("selectionSummary").innerHTML = "";
    document.getElementById("selectionSummary").classList.add("isEmpty");
    document.getElementById("headerBackButton").classList.remove("hidden");
    window.scrollTo({top:0, behavior:"smooth"});
  }

  function showReceptionStepFromSalesEntry() {
    stopSalesQrScanner();
    const salesPanel = document.getElementById("salesStockInPanel");
    if (salesPanel) salesPanel.classList.remove("isActive");
    showStep("reception");
  }

  function renderSalesLocationButtons() {
    const container = document.getElementById("salesStockInLocations");
    container.replaceChildren();

    LOCATION_OPTIONS.forEach(function(location) {
      const button = createChoiceButton({
        label:location,
        value:location,
        onClick:function() {
          salesEntryState.location = location;
          renderSalesEntryState();
        }
      });
      container.appendChild(button);
    });
  }

  function renderSalesUserButtons() {
    const container = document.getElementById("salesStockInUsers");
    container.replaceChildren();

    USER_OPTIONS.forEach(function(user) {
      const button = createChoiceButton({
        label:user,
        value:user,
        onClick:function() {
          salesEntryState.user = user;
          renderSalesEntryState();
        }
      });
      container.appendChild(button);
    });
  }

  function renderSalesProductSelect() {
    const select = document.getElementById("salesStockInItemSelect");
    select.replaceChildren();

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "販売品を選択してください";
    select.appendChild(empty);

    getSalesMasterItems().forEach(function(item) {
      const option = document.createElement("option");
      option.value = item.itemCode;
      option.textContent = item.displayName + "（" + item.itemCode + "）";
      select.appendChild(option);
    });
  }

  function addSalesSelection(itemCode, quantity) {
    const item = getSalesMasterItems().find(function(candidate) {
      return normalizeLookupKey(candidate.itemCode) === normalizeLookupKey(itemCode);
    });

    if (!item) {
      alert("販売品マスタに見つかりません");
      return false;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      alert("数量を1以上の整数で入力してください");
      return false;
    }

    const existing = salesEntryState.selections.find(function(row) {
      return normalizeLookupKey(row.itemCode) === normalizeLookupKey(item.itemCode);
    });

    if (existing) {
      existing.quantity += qty;
    } else {
      salesEntryState.selections.push({
        itemCode:item.itemCode,
        displayName:item.displayName,
        unit:item.unit,
        category:item.category,
        quantity:qty
      });
    }

    renderSalesEntryState();
    return true;
  }

  function addSalesSelectionFromList() {
    const itemCode = document.getElementById("salesStockInItemSelect").value;
    const quantity = document.getElementById("salesStockInQuantity").value;

    if (!itemCode) {
      alert("販売品を選択してください");
      return;
    }

    if (addSalesSelection(itemCode, quantity)) {
      document.getElementById("salesStockInQuantity").value = "";
    }
  }

  function renderSalesSelectionRows() {
    const container = document.getElementById("salesStockInRows");
    container.replaceChildren();

    salesEntryState.selections.forEach(function(item, index) {
      const row = document.createElement("div");
      row.className = "quantityInspectionRow";

      const header = document.createElement("div");
      header.className = "quantityInspectionRowHeader";

      const title = document.createElement("div");
      title.className = "quantityInspectionRowName";
      title.textContent = item.displayName;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "quantityInspectionRemove";
      remove.textContent = "削除";
      remove.addEventListener("click", function() {
        salesEntryState.selections.splice(index, 1);
        renderSalesEntryState();
      });

      header.append(title, remove);

      const summary = document.createElement("div");
      summary.className = "quantityInspectionPending";
      summary.textContent =
        item.itemCode + " ／ 入庫数量 " + item.quantity + item.unit;

      row.append(header, summary);
      container.appendChild(row);
    });
  }

  function renderSalesEntryState() {
    const summary = document.getElementById("salesStockInSummary");
    const sendButton = document.getElementById("salesStockInSendButton");

    summary.innerText =
      "実施拠点：" + (salesEntryState.location || "未選択") +
      "\n担当者：" + (salesEntryState.user || "未選択") +
      "\n追加済み：" + salesEntryState.selections.length + "品目";

    renderSalesSelectionRows();

    sendButton.disabled = true;
    sendButton.innerText = "GAS対応後に送信可能";
  }

  function resetSalesEntry() {
    stopSalesQrScanner();
    salesEntryState = {
      location:"",
      user:"",
      selections:[]
    };
    document.getElementById("salesStockInQuantity").value = "";
    document.getElementById("salesStockInQrQuantity").value = "";
    document.getElementById("salesStockInQrDetected").innerText = "";
    renderSalesProductSelect();
    renderSalesEntryState();
  }

  function openSalesEntry() {
    resetSalesEntry();
    hideWizardPanelsForSalesEntry();
  }

  let salesQrReader = null;
  let salesQrRunning = false;
  let salesQrDetectedItem = null;

  async function startSalesQrScanner() {
    if (salesQrRunning) return;
    if (!appInitialDataLoaded) {
      alert("在庫データ取得完了後にお試しください");
      return;
    }

    const status = document.getElementById("salesStockInQrStatus");
    status.innerText = "カメラ起動中…";

    try {
      const hints = new Map();
      hints.set(
        ZXing.DecodeHintType.POSSIBLE_FORMATS,
        [ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.DATA_MATRIX]
      );

      salesQrReader = new ZXing.BrowserMultiFormatReader(hints);
      const devices = await salesQrReader.listVideoInputDevices();
      if (!devices || !devices.length) throw new Error("カメラが見つかりません");

      const backCamera = devices.find(function(device) {
        const label = String(device.label || "").toLowerCase();
        return label.includes("back") || label.includes("rear") ||
          label.includes("environment") || label.includes("背面");
      });
      const deviceId = backCamera
        ? backCamera.deviceId
        : devices[devices.length - 1].deviceId;

      salesQrRunning = true;
      salesQrReader.decodeFromVideoDevice(
        deviceId,
        "salesStockInQrVideo",
        function(result) {
          if (!result || salesQrDetectedItem) return;
          const text = String(result.getText() || "").trim();
          const item = findQuantityItemLocal(text);

          if (!item || !isSalesItem(item)) {
            status.innerText = "販売品QRではありません\n" + text;
            return;
          }

          salesQrDetectedItem = {
            itemCode:getFirstItemValue(
              item,
              ["品目コード", "itemCode", "商品コード", "コード"]
            ) || text,
            displayName:getFirstItemValue(
              item,
              ["表示名", "品名", "商品名", "名称", "displayName", "name"]
            ) || text,
            unit:getFirstItemValue(item, ["単位", "unit"]) || "個"
          };

          document.getElementById("salesStockInQrDetected").innerText =
            salesQrDetectedItem.displayName +
            "（" + salesQrDetectedItem.itemCode + "）";
          status.innerText = "販売品QRを読み取りました ✔";
          stopSalesQrScanner();
          document.getElementById("salesStockInQrQuantity").focus();
        }
      );

      status.innerText = "販売品QRを読み取ってください";
    } catch (error) {
      status.innerText = "カメラ起動失敗\n" + (error.message || String(error));
      stopSalesQrScanner();
    }
  }

  function stopSalesQrScanner() {
    if (salesQrReader) {
      try { salesQrReader.reset(); } catch (error) {}
      salesQrReader = null;
    }
    salesQrRunning = false;
  }

  function addDetectedSalesQrItem() {
    if (!salesQrDetectedItem) {
      alert("先に販売品QRを読み取ってください");
      return;
    }

    const quantity = document.getElementById("salesStockInQrQuantity").value;
    if (addSalesSelection(salesQrDetectedItem.itemCode, quantity)) {
      salesQrDetectedItem = null;
      document.getElementById("salesStockInQrQuantity").value = "";
      document.getElementById("salesStockInQrDetected").innerText = "";
      document.getElementById("salesStockInQrStatus").innerText =
        "必要なら続けてQRから追加できます";
    }
  }

  function injectSalesEntryUi() {
    const receptionGrid = document.querySelector("#receptionStep .buttonGrid");
    if (!receptionGrid || document.getElementById("salesStockInEntryButton")) return;

    const entryButton = document.createElement("button");
    entryButton.id = "salesStockInEntryButton";
    entryButton.className = "choiceButton";
    entryButton.type = "button";
    entryButton.dataset.kind = "special";
    entryButton.innerHTML =
      "販売品入庫受付" +
      '<span class="choiceSubText">仕入れた販売品の在庫を増やす</span>';
    entryButton.addEventListener("click", openSalesEntry);
    receptionGrid.appendChild(entryButton);

    const panel = document.createElement("section");
    panel.id = "salesStockInPanel";
    panel.className = "panel";
    panel.innerHTML = `
      <div class="stepHeader">
        <div class="stepLabel">販売品入庫</div>
        <div class="receptionStatus">販売品入庫受付</div>
      </div>

      <h1 class="question">販売品の入庫内容を入力してください</h1>
      <p class="questionHint">販売品だけが対象です。一覧選択またはQR読取で追加できます。</p>

      <div class="quantityInspectionGuide">
        <h2>実施拠点</h2>
      </div>
      <div id="salesStockInLocations" class="buttonGrid singleColumn"></div>

      <div class="quantityInspectionGuide">
        <h2>担当者</h2>
      </div>
      <div id="salesStockInUsers" class="buttonGrid"></div>

      <div id="salesStockInSummary" class="wizardPostSummary"></div>

      <div class="quantityInspectionGuide">
        <h2>一覧から追加</h2>
        <p>数量管理品マスタの「区分＝販売品」だけ表示します。</p>
      </div>
      <label for="salesStockInItemSelect">販売品</label>
      <select id="salesStockInItemSelect"></select>
      <div class="scannerQuantityField">
        <input id="salesStockInQuantity" type="number" inputmode="numeric" min="1" step="1" placeholder="数量">
      </div>
      <button id="salesStockInAddButton" type="button">この販売品を追加</button>

      <div class="quantityInspectionGuide">
        <h2>QRから追加</h2>
        <p>棚などにある販売品QRからも品目を指定できます。</p>
      </div>
      <button id="salesStockInQrStartButton" type="button">販売品QRを読み取る</button>
      <div id="salesStockInQrStatus" class="wizardPostSummary">QR読取は任意です</div>
      <video id="salesStockInQrVideo" class="scannerVideo" playsinline muted></video>
      <div id="salesStockInQrDetected" class="wizardPostSummary"></div>
      <div class="scannerQuantityField">
        <input id="salesStockInQrQuantity" type="number" inputmode="numeric" min="1" step="1" placeholder="数量">
      </div>
      <button id="salesStockInQrAddButton" type="button">QR読取品を追加</button>

      <div id="salesStockInRows" class="quantityInspectionRows"></div>

      <button id="salesStockInSendButton" class="wizardSendButton" type="button" disabled>
        GAS対応後に送信可能
      </button>
      <div class="connectionNote">
        開発版：現在は画面と販売品判定のみ先行実装しています。仕入入庫の送信はGAS対応後に有効化します。
      </div>
      <button id="salesStockInBackButton" class="backButton" type="button">受付方法へ戻る</button>
    `;

    const receptionStep = document.getElementById("receptionStep");
    receptionStep.insertAdjacentElement("afterend", panel);

    document.getElementById("salesStockInAddButton")
      .addEventListener("click", addSalesSelectionFromList);
    document.getElementById("salesStockInQrStartButton")
      .addEventListener("click", startSalesQrScanner);
    document.getElementById("salesStockInQrAddButton")
      .addEventListener("click", addDetectedSalesQrItem);
    document.getElementById("salesStockInBackButton")
      .addEventListener("click", showReceptionStepFromSalesEntry);

    renderSalesLocationButtons();
    renderSalesUserButtons();
    renderSalesProductSelect();
    renderSalesEntryState();
  }

  /* 検品候補から販売品を除外する。 */
  const originalGetQuantityInspectionMasterItems = getQuantityInspectionMasterItems;
  getQuantityInspectionMasterItems = function() {
    return originalGetQuantityInspectionMasterItems().filter(function(item) {
      return String(item.category || "").trim() !== SALES_CATEGORY;
    });
  };

  /* 通常受付で販売品に許可するのは出庫だけ。出庫取消は履歴選択実装待ち。 */
  const originalHandleReadOnlyDecoded = handleReadOnlyDecoded;
  handleReadOnlyDecoded = async function(text) {
    if (scannerBusy) return;

    const item = findQuantityItemLocal(text);
    if (item && isSalesItem(item)) {
      if (wizardState.mode === "出庫取消") {
        scannerBusy = true;
        notifyWizardScanError(
          "販売品の出庫取消は履歴を選択して行います\n履歴選択機能の実装後に使用できます",
          1900
        );
        setTimeout(function() { scannerBusy = false; }, 1700);
        return;
      }

      if (!SALES_ALLOWED_NORMAL_MODES.includes(wizardState.mode)) {
        scannerBusy = true;
        notifyWizardScanError(
          "販売品では「" + wizardState.modeLabel + "」を使用できません\n販売品は出庫のみ対象です",
          1800
        );
        setTimeout(function() { scannerBusy = false; }, 1600);
        return;
      }
    }

    return originalHandleReadOnlyDecoded(text);
  };

  /* イレギュラー受付でも販売品の返却・検品等を通さない。 */
  const originalBuildWizardIrregularRecord = buildWizardIrregularRecord;
  buildWizardIrregularRecord = function() {
    const record = originalBuildWizardIrregularRecord();
    if (
      record &&
      record.recordType === "quantity" &&
      String(record.category || "").trim() === SALES_CATEGORY &&
      !SALES_ALLOWED_NORMAL_MODES.includes(record.mode)
    ) {
      throw new Error("販売品では「" + record.mode + "」を使用できません。販売品は出庫のみ対象です。");
    }
    if (
      record &&
      record.recordType === "quantity" &&
      String(record.category || "").trim() === SALES_CATEGORY &&
      record.mode === "出庫取消"
    ) {
      throw new Error("販売品の出庫取消は、QR読取後に出庫履歴から対象を選択する方式で実装します。現在は未接続です。");
    }
    return record;
  };

  injectSalesEntryUi();
})();
