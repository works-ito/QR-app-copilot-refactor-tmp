const PREVIOUS_SETTINGS_STORAGE_KEY =
      "qrInventoryWizardPreviousSettingsV1";

    /*
     * 現行HTMLから移植した在庫データ基盤。
     * この段階ではカメラ・送信処理からはまだ使用しない。
     */
    const GAS_URL =
      "https://script.google.com/macros/s/AKfycbztguQj2mLmDPaddFF_upjvGOqlIUqXNcdvr3ILbORFbrJYQmm6Hopc_uPRNPEGofJ-0Q/exec";

    const INVENTORY_DB_NAME =
      "qrInventoryCache";

    const INVENTORY_STORE_NAME =
      "inventory";

    const INVENTORY_CACHE_KEY =
      "latest";

    let appInitialDataLoaded = false;
    let appInitialDataLoading = false;
    let appInitialDataError = "";

    let individualItems = [];
    let simpleItems = [];
    let recItems = [];
    let quantityItems = [];
    let managedMasterItems = [];

    let individualItemMap = new Map();
    let simpleItemMap = new Map();
    let recItemMap = new Map();
    let quantityItemMap = new Map();
    let managedMasterItemMap = new Map();

    let scannerCodeReader = null;
    let scannerStream = null;
    let scannerRunning = false;
    let scannerBusy = false;
    let scannedEntries = [];
    let scannerStatusTimer = null;
    let pendingWizardQuantityRecord = null;
    let resetAllArmed = false;
    let resetAllArmTimer = null;
    let wizardSendBusy = false;
    let lastPendingSendId = "";
    let lastSuccessfulSend = null;
    let cancelSendExpiryTimer = null;
    const LAST_SUCCESSFUL_SEND_STORAGE_KEY =
      "qrInventoryWizardLastSuccessfulSendV1";
    const CANCEL_SEND_VALID_MS = 5 * 60 * 1000;
    const RECENT_WORK_STORAGE_KEY =
      "qrInventoryRecentSuccessfulWorks";
    const RECENT_WORK_BLOCK_MS = 5 * 60 * 1000;
    const animatedDotsTimers = new Map();
    let wizardPostSendContext = null;
    let wizardSelectedPhotos = [];
    let wizardCurrentSlipInfo = null;
    let wizardPendingPhotoSave = null;
    let wizardPostSendBusy = false;
    let wizardIrregularRecord = null;
    let wizardIrregularDetected = null;

    function stopAnimatedDots(elementId) {
      const timer = animatedDotsTimers.get(
        elementId
      );

      if (timer) {
        clearInterval(timer);
        animatedDotsTimers.delete(elementId);
      }
    }

    function startAnimatedDots(
      elementId,
      baseMessage
    ) {
      stopAnimatedDots(elementId);

      const element =
        document.getElementById(elementId);

      if (!element) return;

      let dots = 0;

      const update = function() {
        element.innerText =
          baseMessage + ".".repeat(dots);

        dots = (dots + 1) % 4;
      };

      update();

      animatedDotsTimers.set(
        elementId,
        setInterval(update, 400)
      );
    }

       const MODE_OPTIONS = [
      {
        value:"出庫",
        label:"出庫"
      },
      {
        value:"返却",
        label:"返却"
      },
      {
        value:"完成機",
        label:"完成機"
      },
      {
        value:"修理中",
        label:"修理"
      },
      {
        value:"拠点移動",
        label:"拠点移動"
      },
      {
        value:"出庫取消",
        label:"出庫取消"
      },
      {
        value:"校正中",
        label:"校正中",
        kind:"special"
      },
      {
        value:"校正完了",
        label:"校正完了",
        kind:"special"
      },
      {
        value:"交換完了",
        label:"交換完了",
        kind:"special"
      },
      {
        value:"入庫",
        label:"入庫"
      },
      {
        value:"廃棄",
        label:"廃棄",
        kind:"danger"
      }
    ];

    const LOCATION_OPTIONS = [
      "本社",
      "三郷",
      "MF"
    ];

    const USER_OPTIONS = [
      "奥",
      "滝島",
      "上野",
      "見﨑",
      "田之岡",
      "篠塚",
      "その他"
    ];

    const REC_TARGET_OPTIONS = [
      "騒音計",
      "振動計",
      "内部USB"
    ];

    const WIZARD_REC_MODES = [
      "校正中",
      "校正完了",
      "交換完了"
    ];

    const REC_DATE_REQUIRED_MODES = [
      "校正完了",
      "交換完了"
    ];

    const STEP_IDS = {
     reception:"receptionStep",
     previous:"previousStep",
     mode:"modeStep",
     location:"locationStep",
     user:"userStep",
     rec:"recStep",
     complete:"completeStep"
    };

    const wizardState = {
     receptionType:"",
     receptionLabel:"",
     mode:"",
     modeLabel:"",
     location:"",
     user:"",
     recTarget:"",
     recDate:"",

     previousLocation:"",
     previousUser:"",
     hasPreviousSettings:false,
     usePreviousSettings:false,

     lastInputStep:"user",
     currentStep:"reception"
   };

    function createChoiceButton(options) {
      const data =
        options || {};

      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        "choiceButton";

      button.innerText =
        data.label ||
        data.value ||
        "";

      if (data.kind) {
        button.dataset.kind =
          data.kind;
      }

      button.addEventListener(
        "click",
        function() {
          if (
            typeof data.onClick ===
            "function"
          ) {
            data.onClick();
          }
        }
      );

      return button;
    }

    function renderButtons() {
      const modeButtons =
        document.getElementById(
          "modeButtons"
        );

      MODE_OPTIONS.forEach(
        function(item) {
          modeButtons.appendChild(
            createChoiceButton({
              label:item.label,
              value:item.value,
              kind:item.kind,

              onClick:function() {
                selectMode(item);
              }
            })
          );
        }
      );

      const locationButtons =
        document.getElementById(
          "locationButtons"
        );

      LOCATION_OPTIONS.forEach(
        function(location) {
          locationButtons.appendChild(
            createChoiceButton({
              label:location,
              value:location,

              onClick:function() {
                selectLocation(location);
              }
            })
          );
        }
      );

      const userButtons =
        document.getElementById(
          "userButtons"
        );

      USER_OPTIONS.forEach(
        function(user) {
          userButtons.appendChild(
            createChoiceButton({
              label:user,
              value:user,

              onClick:function() {
                selectUser(user);
              }
            })
          );
        }
      );

      const recTargetButtons =
        document.getElementById(
          "recTargetButtons"
        );

      REC_TARGET_OPTIONS.forEach(
        function(target) {
          recTargetButtons.appendChild(
            createChoiceButton({
              label:target,
              value:target,
              kind:"special",

              onClick:function() {
                selectRecTarget(target);
              }
            })
          );
        }
      );
    }

    function showStep(stepName) {
      wizardState.currentStep =
        stepName;

      Object.keys(
        STEP_IDS
      ).forEach(
        function(name) {
          const panel =
            document.getElementById(
              STEP_IDS[name]
            );

          panel.classList.toggle(
            "isActive",
            name === stepName
          );
        }
      );

      updateProgress(stepName);
      updateReceptionStatus();
      updateSummary();
      updateHeaderBackButton(stepName);

      window.scrollTo({
        top:0,
        behavior:"smooth"
      });
    }

    function updateHeaderBackButton(stepName) {
      const backButton =
        document.getElementById(
          "headerBackButton"
        );

      backButton.classList.toggle(
        "hidden",
        stepName === "reception"
      );
    }

    function updateProgress(stepName) {
      const progressIndex = {
       reception:0,
       previous:0,
       mode:1,
       location:2,
       user:3,
       rec:4,
       complete:5
      }[stepName] || 0;

      document
        .querySelectorAll(
          ".progressStep"
        )
        .forEach(
          function(step, index) {
            step.classList.toggle(
              "isDone",
              index < progressIndex
            );
          }
        );
    }

    function updateReceptionStatus() {
      const isIrregular =
        wizardState.receptionType ===
        "irregular";

      document
        .querySelectorAll(
          "[data-reception-status]"
        )
        .forEach(
          function(status) {
            status.innerText =
              wizardState.receptionLabel ||
              "通常受付";

            status.classList.toggle(
              "isIrregular",
              isIrregular
            );
          }
        );
    }

    function updateSummary() {
      const summary =
        document.getElementById(
          "selectionSummary"
        );

      const values = [];

      if (wizardState.modeLabel) {
        values.push(
          wizardState.modeLabel
        );
      }

      if (wizardState.location) {
        values.push(
          wizardState.location
        );
      }

      if (wizardState.user) {
        values.push(
          wizardState.user
        );
      }

      summary.classList.toggle(
        "isEmpty",
        values.length === 0
      );

      summary.innerHTML = "";

      values.forEach(
        function(value) {
          const chip =
            document.createElement(
              "div"
            );

          chip.className =
            "summaryChip";

          chip.innerText =
            value;

          summary.appendChild(
            chip
          );
        }
      );
    }

    function getPreviousSettings() {
  try {
    const raw =
      localStorage.getItem(
        PREVIOUS_SETTINGS_STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    const location =
      String(
        parsed.location || ""
      ).trim();

    const user =
      String(
        parsed.user || ""
      ).trim();

    if (
      !LOCATION_OPTIONS.includes(location) ||
      !USER_OPTIONS.includes(user)
    ) {
      return null;
    }

    return {
      location:location,
      user:user
    };

  } catch (error) {
    console.warn(
      "前回設定の読込に失敗しました",
      error
    );

    return null;
  }
}

    function savePreviousSettings() {
  if (
    !LOCATION_OPTIONS.includes(
      wizardState.location
    ) ||
    !USER_OPTIONS.includes(
      wizardState.user
    )
  ) {
    return;
  }

  try {
    localStorage.setItem(
      PREVIOUS_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        location:
          wizardState.location,

        user:
          wizardState.user
      })
    );

  } catch (error) {
    console.warn(
      "前回設定の保存に失敗しました",
      error
    );
  }
}

    function preparePreviousSettingsStep() {
  const previous =
    getPreviousSettings();

  wizardState.hasPreviousSettings =
    Boolean(previous);

  if (!previous) {
    wizardState.previousLocation = "";
    wizardState.previousUser = "";
    wizardState.usePreviousSettings =
      false;

    return false;
  }

  wizardState.previousLocation =
    previous.location;

  wizardState.previousUser =
    previous.user;

  document.getElementById(
    "previousLocationDisplay"
  ).innerText =
    previous.location;

  document.getElementById(
    "previousUserDisplay"
  ).innerText =
    previous.user;

  const receptionStatus =
    document.getElementById(
      "previousReceptionStatus"
    );

  receptionStatus.innerText =
    wizardState.receptionLabel;

  receptionStatus.classList.toggle(
    "isIrregular",
    wizardState.receptionType ===
      "irregular"
  );

  return true;
}
    
    function selectReceptionType(type) {
  wizardState.receptionType =
    type;

  wizardState.receptionLabel =
    type === "irregular"
      ? "イレギュラー受付"
      : "通常受付";

  wizardState.mode = "";
  wizardState.modeLabel = "";
  wizardState.location = "";
  wizardState.user = "";
  wizardState.recTarget = "";
  wizardState.recDate = "";

  wizardState.usePreviousSettings =
    false;

  if (
    preparePreviousSettingsStep()
  ) {
    showStep("previous");
    return;
  }

  showStep("mode");
}

    function usePreviousSettings() {
  wizardState.location =
    wizardState.previousLocation;

  wizardState.user =
    wizardState.previousUser;

  wizardState.usePreviousSettings =
    true;

  showStep("mode");
}

function changePreviousSettings() {
  wizardState.location = "";
  wizardState.user = "";

  wizardState.usePreviousSettings =
    false;

  showStep("mode");
}
    
   function selectMode(item) {
  wizardState.mode =
    item.value;

  wizardState.modeLabel =
    item.label;

  wizardState.recTarget = "";
  wizardState.recDate = "";

  /*
   * 前回の拠点・担当者を使う場合は、
   * STEP2・STEP3を飛ばす。
   */
  if (
    wizardState.usePreviousSettings
  ) {
    if (
      WIZARD_REC_MODES.includes(
        wizardState.mode
      )
    ) {
      wizardState.lastInputStep =
        "rec";

      prepareRecStep();
      showStep("rec");
      return;
    }

    wizardState.lastInputStep =
      "mode";

    finishWizard();
    return;
  }

  /*
   * 前回設定を変更する場合は、
   * 通常どおり拠点→担当者へ進む。
   */
  wizardState.location = "";
  wizardState.user = "";

  showStep("location");
}
    
    function selectLocation(location) {
      wizardState.location =
        location;

      wizardState.user = "";
      wizardState.recTarget = "";
      wizardState.recDate = "";

      showStep("user");
    }

    function selectUser(user) {
      wizardState.user =
        user;

      if (
        WIZARD_REC_MODES.includes(
          wizardState.mode
        )
      ) {
        wizardState.lastInputStep =
          "rec";

        prepareRecStep();
        showStep("rec");
        return;
      }

      wizardState.lastInputStep =
        "user";

      finishWizard();
    }

    function prepareRecStep() {
      wizardState.recTarget = "";
      wizardState.recDate = "";

      document.getElementById(
        "wizardRecDate"
      ).value = "";

      document.getElementById(
        "wizardRecDateBox"
      ).classList.add(
        "hidden"
      );
    }

    function selectRecTarget(target) {
      wizardState.recTarget =
        target;

      if (
        REC_DATE_REQUIRED_MODES.includes(
          wizardState.mode
        )
      ) {
        const dateBox =
          document.getElementById(
            "wizardRecDateBox"
          );

        const dateLabel =
          document.getElementById(
            "wizardRecDateLabel"
          );

        dateLabel.innerText =
          wizardState.mode ===
          "交換完了"
            ? "交換実施日"
            : "校正実施日";

        dateBox.classList.remove(
          "hidden"
        );

        document.getElementById(
          "wizardRecDate"
        ).focus();

        return;
      }

      wizardState.recDate = "";

      finishWizard();
    }

    function confirmRecSettings() {
      const dateValue =
        document.getElementById(
          "wizardRecDate"
        ).value;

      if (!wizardState.recTarget) {
        alert(
          "REC対象を選んでください"
        );
        return;
      }

      if (
        REC_DATE_REQUIRED_MODES.includes(
          wizardState.mode
        ) &&
        !dateValue
      ) {
        alert(
          "実施日を入力してください"
        );
        return;
      }

      wizardState.recDate =
        dateValue;

      finishWizard();
    }

    function buildWizardSettings() {
      return {
        receptionType:
          wizardState.receptionType,

        mode:
          wizardState.mode,

        location:
          wizardState.location,

        user:
          wizardState.user,

        recTarget:
          wizardState.recTarget,

        recDate:
          wizardState.recDate
      };
    }

    function finishWizard() {
     const settings =
       buildWizardSettings();

       savePreviousSettings();

       renderCompleteSettings(settings);
       showStep("complete");
       completeEntryWizard(settings);
    }
    

    function renderCompleteSettings(settings) {
      const list =
        document.getElementById(
          "completeList"
        );

      const rows = [
        [
          "受付方法",
          wizardState.receptionLabel
        ],

        [
          "作業区分",
          wizardState.modeLabel
        ],

        [
          "実施拠点",
          settings.location
        ],

        [
          "担当者",
          settings.user
        ]
      ];

      if (settings.recTarget) {
        rows.push([
          "REC対象",
          settings.recTarget
        ]);
      }

      if (settings.recDate) {
        rows.push([
          "実施日",
          settings.recDate
        ]);
      }

      list.innerHTML = "";

      rows.forEach(
        function(row) {
          const term =
            document.createElement(
              "dt"
            );

          const description =
            document.createElement(
              "dd"
            );

          term.innerText =
            row[0];

          description.innerText =
            row[1];

          list.appendChild(
            term
          );

          list.appendChild(
            description
          );
        }
      );

      const cameraPreview =
        document.getElementById(
          "cameraPreview"
        );

      const connectionNote =
        document.getElementById(
          "connectionNote"
        );

      if (
        settings.receptionType ===
        "irregular"
      ) {
        cameraPreview.classList.remove(
          "isActive"
        );

        connectionNote.innerText =
          "本番接続時はカメラを起動せず、番号入力／番号不明・追記・写真の画面へ進みます。";
      } else {
        cameraPreview.classList.add(
          "isActive"
        );

        connectionNote.innerText =
          "読み取った内容は、確認後にまとめて送信されます。";
      }

    }

    function completeEntryWizard(settings) {
      syncWizardSettingsToLegacyFields(
        settings
      );

      scannedEntries = [];
      pendingWizardQuantityRecord = null;
      hideWizardQuantityInput();
      renderScannerResults();

      window.dispatchEvent(
        new CustomEvent(
          "entrywizard:complete",
          {
            detail:{
              ...settings
            }
          }
        )
      );

      console.log(
        "入口ウィザード設定完了",
        settings
      );

      if (
        settings.receptionType ===
        "normal"
      ) {
        startReadOnlyScanner();
      } else {
        stopReadOnlyScanner();
        openWizardIrregularArea();
      }
    }

    function getScannerItemDetails(
      qrText
    ) {
      const lookupKey =
        normalizeLookupKey(qrText);

      const managedLookupKey =
        normalizeManagedIdKey(qrText);

      const isRecWork =
        ["校正中", "校正完了", "交換完了"]
          .includes(wizardState.mode);

      const baseManaged =
        findManagedItemLocal(qrText);

      const recLogItem =
        recItemMap.get(lookupKey) ||
        recItemMap.get(managedLookupKey) ||
        null;

      const isRecManagedId =
        /^rec[a-z0-9]*-\d+$/i.test(
          normalizeLookupKey(qrText)
        );

      /*
       * REC機器は通常作業では個体管理機として扱う。
       * REC専用作業を選択した場合だけRECデータ側を参照する。
       */
      let managed = baseManaged;

      if (isRecWork && recLogItem) {
        managed = {
          managementType:"rec",
          item:recLogItem
        };

      } else if (
        isRecWork &&
        baseManaged &&
        isRecManagedId
      ) {
        /*
         * RECログがまだ1件もない機械も、
         * 個体マスタに存在するREC管理IDなら初回登録を許可する。
         */
        managed = {
          managementType:"rec",
          item:baseManaged.item
        };
      }

      if (managed) {
        const typeLabels = {
          individual:"個体",
          simple:"簡易個体",
          rec:"個体（REC対象）"
        };

        return {
          qrText:qrText,
          managementType:
            managed.managementType,
          managementLabel:
            typeLabels[
              managed.managementType
            ] || "管理品",
          displayName:getManagedDisplayName(
            qrText,
            managed.item
          ),
          currentState:getFirstItemValue(
            managed.item,
            [
              "現在状態",
              "最新状態",
              "状態",
              "作業区分",
              "status"
            ]
          ) || "状態なし",
          sourceItem:managed.item
        };
      }

      const quantity =
        findQuantityItemLocal(qrText);

      if (quantity) {
        return {
          qrText:qrText,
          managementType:"quantity",
          managementLabel:"数量管理",
          displayName:getFirstItemValue(
            quantity,
            [
              "表示名",
              "品名",
              "商品名",
              "displayName"
            ]
          ) || "名称なし",
          currentState:getFirstItemValue(
            quantity,
            [
              "現在状態",
              "状態",
              "status"
            ]
          ) || "数量管理品",
          sourceItem:quantity
        };
      }

      return null;
    }

    /*
     * 読取結果を、現行HTMLのscannedRecordsと同じ形へ変換する。
     * この段階ではGASへ送信しない。
     */
    function buildWizardScanRecord(details) {
      const isQuantity =
        details.managementType === "quantity";

      const record = {
        key:
          normalizeManagedIdKey(details.qrText) +
          "__" +
          wizardState.mode +
          (WIZARD_REC_MODES.includes(wizardState.mode)
            ? "__" + wizardState.recTarget
            : ""),

        qrText:details.qrText,
        mode:wizardState.mode,
        user:wizardState.user,
        location:wizardState.location,
        recTarget:WIZARD_REC_MODES.includes(
          wizardState.mode
        ) ? wizardState.recTarget : "",
        recDate:REC_DATE_REQUIRED_MODES.includes(
          wizardState.mode
        ) ? wizardState.recDate : "",

        recordType:isQuantity
          ? "quantity"
          : "managed",
        managementType:details.managementType,
        managedItem:isQuantity
          ? null
          : details.sourceItem,

        displayName:details.displayName,
        displayText:WIZARD_REC_MODES.includes(
          wizardState.mode
        )
          ? details.qrText + " / " + wizardState.recTarget
          : details.qrText,

        currentState:details.currentState,
        managementLabel:details.managementLabel
      };

      if (isQuantity) {
        record.itemCode = getFirstItemValue(
          details.sourceItem,
          [
            "品目コード",
            "itemCode",
            "商品コード",
            "コード"
          ]
        ) || details.qrText;

        record.category = getFirstItemValue(
          details.sourceItem,
          ["区分", "category"]
        );

        record.unit = getFirstItemValue(
          details.sourceItem,
          ["単位", "unit"]
        );

        /* 数量は次工程の数量入力画面で設定する。 */
        record.quantity = null;
      }

      return record;
    }

    /*
     * 現行HTMLのbuildBatchRecordData()と同じ送信用形式を返す。
     * 次工程の送信ボタン接続時に、この配列をそのまま使用する。
     */
    function getWizardPreparedBatchRecords() {
      return scannedEntries.map(function(record) {
        const data = {
          mode:record.mode,
          qr:record.qrText,
          user:record.user,
          location:record.location,
          recTarget:record.recTarget || "",
          recDate:record.recDate || "",
          recordType:record.recordType || "",
          managementType:record.managementType || "",
          displayName:record.displayName || ""
        };

        if (record.recordType === "quantity") {
          data.itemCode = record.itemCode;
          data.quantity = record.quantity;
          data.unit = record.unit;
          data.category = record.category;
        }

        return data;
      });
    }

    function isScannerModeAllowed(
      managementType,
      mode
    ) {
      if (
        ["校正中", "校正完了", "交換完了"]
          .includes(mode)
      ) {
        return managementType === "rec";
      }

      if (["入庫", "廃棄"].includes(mode)) {
        return managementType === "quantity";
      }

      if (mode === "修理中") {
        return managementType !== "quantity";
      }

      return true;
    }

    function renderScannerResults() {
      const list =
        document.getElementById(
          "scannerResultList"
        );

      list.innerHTML = "";

      scannedEntries.forEach(function(details, index) {
        const item = document.createElement("li");
        const number = document.createElement("div");
        const body = document.createElement("div");
        const name = document.createElement("div");
        const meta = document.createElement("div");

        item.className = "scannerResultItem";
        number.className = "scannerResultNumber";
        name.className = "scannerResultName";
        meta.className = "scannerResultMeta";

        number.innerText = String(index + 1);
        name.innerText = details.displayName;
        const quantityText =
          details.recordType === "quantity"
            ? " ／ 数量：" +
              details.quantity +
              (details.unit || "")
            : "";

        meta.innerText =
          details.qrText + " ／ " +
          details.managementLabel + " ／ " +
          details.currentState +
          quantityText;

        body.appendChild(name);
        body.appendChild(meta);
        item.appendChild(number);
        item.appendChild(body);
        list.appendChild(item);
      });

      const count = scannedEntries.length;

      document.getElementById("scannerResultCount")
        .innerText = count + "件";

      document.getElementById("scannerResult")
        .classList.toggle("isVisible", count > 0);

      document.getElementById("cancelLastScanButton")
        .classList.toggle("isVisible", count > 0);

      document.getElementById("resetAllScansButton")
        .classList.toggle("isVisible", count > 0);

      const sendButton =
        document.getElementById(
          "wizardSendBatchButton"
        );

      sendButton.classList.toggle(
        "isVisible",
        count > 0
      );

      sendButton.innerText =
        WIZARD_REC_MODES.includes(
          wizardState.mode
        )
          ? "REC読取分を送信"
          : "読取分をまとめて送信";
    }

    function setTemporaryScannerStatus(message, duration) {
      stopAnimatedDots("scannerStatus");

      const status = document.getElementById("scannerStatus");

      if (scannerStatusTimer) {
        clearTimeout(scannerStatusTimer);
      }

      status.innerText = message;

      scannerStatusTimer = setTimeout(function() {
        if (!scannerRunning) return;

        status.innerText =
          "続けてQRを読み取ってください\n読取件数：" +
          scannedEntries.length + "件";
      }, duration || 900);
    }

    function cancelLastScan() {
      if (!scannedEntries.length) return;

      scannerBusy = true;

      const removed = scannedEntries.pop();
      renderScannerResults();
      setTemporaryScannerStatus(
        "最後の読取を取り消しました\n" + removed.displayName,
        1100
      );

      /*
       * 取り消し直後、まだ同じQRが画面内にある間の
       * 即時再登録を防ぐ。少しカメラを離せば再読取できる。
       */
      setTimeout(function() {
        scannerBusy = false;
      }, 900);
    }

    function resetAllScans() {
      const count = scannedEntries.length;

      if (!count) return;

      const button = document.getElementById(
        "resetAllScansButton"
      );

      /*
       * iPhoneでは、カメラ起動中のconfirm()によって
       * 映像だけ静止することがある。
       * ネイティブ確認画面を使わず、3秒以内の2回押しで確認する。
       */
      if (!resetAllArmed) {
        resetAllArmed = true;
        button.innerText =
          "もう一度押すと" + count + "件すべて削除";

        setTemporaryScannerStatus(
          "全件リセットの確認中\n赤いボタンをもう一度押してください",
          3000
        );

        if (resetAllArmTimer) {
          clearTimeout(resetAllArmTimer);
        }

        resetAllArmTimer = setTimeout(function() {
          resetAllArmed = false;
          resetAllArmTimer = null;
          button.innerText = "読取をすべてリセット";
        }, 3000);

        return;
      }

      resetAllArmed = false;

      if (resetAllArmTimer) {
        clearTimeout(resetAllArmTimer);
        resetAllArmTimer = null;
      }

      button.innerText = "読取をすべてリセット";

      scannerBusy = true;
      scannedEntries = [];
      renderScannerResults();

      setTemporaryScannerStatus(
        "読み取った内容をすべてリセットしました",
        1100
      );

      /*
       * リセット直後に、カメラ内へ残っているQRが
       * 意図せず即時登録されるのを防ぐ。
       */
      setTimeout(function() {
        scannerBusy = false;

        const video = document.getElementById(
          "scannerVideo"
        );

        if (video && video.srcObject) {
          const playResult = video.play();

          if (
            playResult &&
            typeof playResult.catch === "function"
          ) {
            playResult.catch(function() {});
          }
        }
      }, 900);
    }

    function hideWizardQuantityInput() {
      document.getElementById(
        "scannerQuantityInput"
      ).classList.remove("isVisible");

      document.getElementById(
        "scannerQuantityValue"
      ).value = "";
    }

    function showWizardQuantityInput(record) {
      pendingWizardQuantityRecord = record;

      document.getElementById(
        "scannerQuantityName"
      ).innerText =
        record.displayName || record.itemCode;

      document.getElementById(
        "scannerQuantityInfo"
      ).innerText =
        "品目コード：" + record.itemCode +
        "\n区分：" + (record.category || "未設定");

      document.getElementById(
        "scannerQuantityUnit"
      ).innerText = record.unit || "";

      const area = document.getElementById(
        "scannerQuantityInput"
      );

      area.classList.add("isVisible");

      document.getElementById(
        "scannerStatus"
      ).innerText =
        "数量を入力してください\n" +
        (record.displayName || record.itemCode);

      area.scrollIntoView({
        behavior:"smooth",
        block:"center"
      });

      setTimeout(function() {
        document.getElementById(
          "scannerQuantityValue"
        ).focus();
      }, 250);
    }

    function commitWizardScanRecord(record) {
      const frame =
        document.getElementById(
          "scannerFrame"
        );

      frame.classList.add("isSuccess");

      if (navigator.vibrate) {
        navigator.vibrate(80);
      }

      scannedEntries.push(record);
      renderScannerResults();

      setTemporaryScannerStatus(
        "読取成功 ✔\n" +
        (
          record.recordType === "quantity"
            ? record.displayText
            : record.displayName
        ),
        850
      );

      setTimeout(function() {
        frame.classList.remove("isSuccess");
        scannerBusy = false;
      }, 650);
    }

    function addWizardQuantityItem() {
      if (!pendingWizardQuantityRecord) return;

      const quantity = Number(
        document.getElementById(
          "scannerQuantityValue"
        ).value
      );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        alert("数量を1以上の整数で入力してください");
        return;
      }

      const record = pendingWizardQuantityRecord;
      record.quantity = quantity;
      record.displayText =
        (record.displayName || record.itemCode) +
        " × " +
        quantity +
        (record.unit || "");

      pendingWizardQuantityRecord = null;
      hideWizardQuantityInput();
      commitWizardScanRecord(record);
    }

    function cancelWizardQuantityInput() {
      pendingWizardQuantityRecord = null;
      hideWizardQuantityInput();

      setTemporaryScannerStatus(
        "数量入力を取り消しました\nQRは再読取できます",
        900
      );

      setTimeout(function() {
        scannerBusy = false;
      }, 500);
    }

    function createBatchId() {
      return "BATCH-" + new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, "")
        .slice(0, 14) + "-" +
        Math.floor(Math.random() * 1000);
    }

    function buildBatchRecordData(record) {
      const data = {
        mode:record.mode,
        qr:record.qr,
        user:record.user,
        location:record.location,
        recTarget:record.recTarget || "",
        recDate:record.recDate || "",
        recordType:record.recordType || "",
        managementType:record.managementType || "",
        displayName:record.displayName || ""
      };

      if (record.recordType === "quantity") {
        data.itemCode = record.itemCode;
        data.quantity = record.quantity;
        data.unit = record.unit;
        data.category = record.category;
      }

      return data;
    }

    function getLocalManagedItem(qrText, managementType) {
      const key = normalizeLookupKey(qrText);
      const managedKey = normalizeManagedIdKey(qrText);
      const map = managementType === "simple"
        ? simpleItemMap
        : managementType === "rec"
          ? recItemMap
          : individualItemMap;

      return (
        map.get(key) ||
        map.get(managedKey) ||
        managedMasterItemMap.get(key) ||
        managedMasterItemMap.get(managedKey) ||
        null
      );
    }

    function getLocalItemState(item) {
      return getFirstItemValue(item || {}, [
        "現在状態", "最新状態", "状態", "作業区分", "status"
      ]) || "";
    }

    function getLocalItemLocation(item) {
      return getFirstItemValue(item || {}, [
        "現在拠点", "拠点", "保管拠点", "location"
      ]) || "";
    }

    function setFirstLocalValue(item, keys, value, fallbackKey) {
      if (!item) return;
      const existingKey = keys.find(function(key) {
        return Object.prototype.hasOwnProperty.call(item, key);
      });
      item[existingKey || fallbackKey] = value;
    }

    function getNextLocalState(mode) {
      const states = {
        "出庫":"出庫中",
        "返却":"未点検",
        "修理中":"修理中",
        "完成機":"完成機",
        "校正中":"校正中",
        "校正完了":"校正完了",
        "交換完了":"交換完了"
      };
      return states[mode] || "";
    }

    function validateStateTransition(currentState, mode) {
      const state = String(currentState || "").trim();
      const action = String(mode || "").trim();

      if (!state) {
        return {
          ok:true,
          warning:true,
          message:"現在状態を取得できませんでした"
        };
      }

      if (action === "出庫") {
        if (state === "出庫" || state === "出庫中") {
          return {
            ok:false,
            warning:false,
            message:
              "この機械はすでに出庫中です。\n" +
              "二重出庫の可能性があるため登録できません。"
          };
        }
        return {ok:true, warning:false, message:""};
      }

      if (action === "返却" || action === "出庫取消") {
        if (state !== "出庫" && state !== "出庫中") {
          return {
            ok:false,
            warning:false,
            message:
              "この機械は出庫中ではありません。\n" +
              "現在状態が「" + state + "」のため" +
              action + "登録できません。"
          };
        }
        return {ok:true, warning:false, message:""};
      }

      return {ok:true, warning:false, message:""};
    }

    function getRecentSuccessfulWorks() {
      try {
        const parsed = JSON.parse(
          localStorage.getItem(RECENT_WORK_STORAGE_KEY) || "[]"
        );
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        const active = parsed.filter(function(item) {
          return (
            item &&
            now - Number(item.sentAt || 0) < RECENT_WORK_BLOCK_MS
          );
        });
        localStorage.setItem(
          RECENT_WORK_STORAGE_KEY,
          JSON.stringify(active)
        );
        return active;
      } catch (error) {
        console.warn("直近送信記録の取得失敗", error);
        return [];
      }
    }

    function isRecentSuccessfulWork(qrText, mode) {
      const qrKey = normalizeLookupKey(qrText || "");
      const modeKey = String(mode || "").trim();
      if (!qrKey || !modeKey) return false;
      return getRecentSuccessfulWorks().some(function(item) {
        return item.qrKey === qrKey && item.mode === modeKey;
      });
    }

    function rememberRecentSuccessfulWorks(records, successfulIndexes) {
      const source = Array.isArray(records) ? records : [];
      const successSet = new Set(
        Array.isArray(successfulIndexes) ? successfulIndexes : []
      );
      const now = Date.now();
      let recent = getRecentSuccessfulWorks();
      const savedKeys = [];

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
        recent.push({qrKey:qrKey, mode:mode, sentAt:now});
        savedKeys.push(workKey);
      });

      try {
        localStorage.setItem(
          RECENT_WORK_STORAGE_KEY,
          JSON.stringify(recent)
        );
      } catch (error) {
        console.warn("直近送信記録の保存失敗", error);
      }
      return savedKeys;
    }

    function clearRecentSuccessfulWorkRecords(workKeys) {
      const keys = Array.isArray(workKeys) ? workKeys : [];
      if (!keys.length) return;
      const keySet = new Set(keys);
      const recent = getRecentSuccessfulWorks().filter(function(item) {
        return !keySet.has(item.qrKey + "||" + item.mode);
      });
      try {
        localStorage.setItem(
          RECENT_WORK_STORAGE_KEY,
          JSON.stringify(recent)
        );
      } catch (error) {
        console.warn("直近送信記録の解除失敗", error);
      }
    }

    function getSuccessfulResultIndexes(result, recordCount) {
      const results =
        result && Array.isArray(result.results)
          ? result.results
          : [];
      const indexes = [];

      results.forEach(function(item, position) {
        if (!item || !item.ok) return;
        const suppliedIndex = Number(item.index);
        const index = Number.isInteger(suppliedIndex)
          ? suppliedIndex
          : position;
        if (index >= 0 && index < recordCount) indexes.push(index);
      });

      return Array.from(new Set(indexes));
    }

    function captureLocalState(record) {
      if (!record || record.recordType === "quantity") return null;
      const item = getLocalManagedItem(record.qr, record.managementType);
      return {
        qr:record.qr,
        managementType:record.managementType,
        previousState:getLocalItemState(item),
        previousLocation:getLocalItemLocation(item),
        mode:record.mode
      };
    }

    function applySuccessfulLocalState(record) {
      if (!record || record.recordType === "quantity") return;
      const item = getLocalManagedItem(record.qr, record.managementType);
      const nextState = getNextLocalState(record.mode);
      if (nextState) {
        setFirstLocalValue(
          item,
          ["現在状態", "最新状態", "状態", "作業区分", "status"],
          nextState,
          "現在状態"
        );
      }
      if (record.mode === "拠点移動" && record.location) {
        setFirstLocalValue(
          item,
          ["現在拠点", "拠点", "保管拠点", "location"],
          record.location,
          "現在拠点"
        );
      }
    }

    function restoreLocalState(snapshot) {
      if (!snapshot) return;
      const item = getLocalManagedItem(
        snapshot.qr,
        snapshot.managementType
      );
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

    function saveLastSuccessfulSend(transaction) {
      lastSuccessfulSend = transaction;
      localStorage.setItem(
        LAST_SUCCESSFUL_SEND_STORAGE_KEY,
        JSON.stringify(transaction)
      );
      renderCancelSendButton();
    }

    function clearLastSuccessfulSend() {
      lastSuccessfulSend = null;
      localStorage.removeItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY);
      renderCancelSendButton();
    }

    function renderCancelSendButton() {
      const button = document.getElementById("wizardCancelSendButton");
      if (!button) return;
      if (cancelSendExpiryTimer) clearTimeout(cancelSendExpiryTimer);

      const remaining = lastSuccessfulSend
        ? Number(lastSuccessfulSend.expiresAt || 0) - Date.now()
        : 0;
      button.classList.toggle("isVisible", remaining > 0);
      button.disabled = wizardSendBusy || !appInitialDataLoaded;

      if (remaining > 0) {
        cancelSendExpiryTimer = setTimeout(function() {
          renderCancelSendButton();
        }, Math.min(remaining + 50, 30000));
      }
    }

    function restoreLastSuccessfulSend() {
      try {
        const value = JSON.parse(
          localStorage.getItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY) || "null"
        );
        if (value && Number(value.expiresAt || 0) > Date.now()) {
          lastSuccessfulSend = value;
        } else {
          localStorage.removeItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY);
        }
      } catch (error) {
        localStorage.removeItem(LAST_SUCCESSFUL_SEND_STORAGE_KEY);
      }
      renderCancelSendButton();
    }

    async function refreshInventoryInBackground(successfulRecords) {
      try {
        await loadAppInitialData(false);
        (Array.isArray(successfulRecords) ? successfulRecords : [])
          .forEach(applySuccessfulLocalState);
        if (
          Array.isArray(successfulRecords) &&
          successfulRecords.length
        ) {
          await saveInventoryCache();
        }
      } catch (error) {
        console.warn("バックグラウンド状態更新失敗", error);
      }
    }

    async function cancelLastSuccessfulSend() {
      if (wizardSendBusy || !lastSuccessfulSend) return;
      if (Date.now() >= Number(lastSuccessfulSend.expiresAt || 0)) {
        clearLastSuccessfulSend();
        alert("直前送信の取消可能時間（5分）を過ぎています");
        return;
      }
      if (!confirm(
        "直前に送信した" + lastSuccessfulSend.successCount +
        "件を取り消します。よろしいですか？"
      )) return;

      wizardSendBusy = true;
      scannerBusy = true;
      renderCancelSendButton();
      startAnimatedDots("wizardSendStatus", "取消中");
      document.getElementById("wizardSendStatus").className =
        "wizardSendStatus isVisible isSending";

      try {
        const response = await fetch(GAS_URL, {
          method:"POST",
          headers:{"Content-Type":"text/plain"},
          body:JSON.stringify({
            action:"cancelSend",
            sendId:lastSuccessfulSend.sendId,
            sentAt:lastSuccessfulSend.sentAt
          })
        });
        const result = JSON.parse(await response.text());
        if (!result.ok) throw new Error(result.error || result.message || "取消失敗");

        (lastSuccessfulSend.snapshots || []).forEach(restoreLocalState);
        clearRecentSuccessfulWorkRecords(
          lastSuccessfulSend.recentWorkKeys || []
        );
        await saveInventoryCache();
        setWizardSendStatus(
          "直前送信を取消しました ✔\n" +
          result.cancelCount + "件\n送信ID：" + result.sendId,
          "isSuccess"
        );
        if (
          wizardPostSendContext &&
          String(wizardPostSendContext.sendId || "") ===
            String(lastSuccessfulSend.sendId || "")
        ) {
          wizardPostSendContext = null;
          wizardSelectedPhotos = [];
          wizardCurrentSlipInfo = null;
          wizardPendingPhotoSave = null;
          document.getElementById("wizardPostSendArea").hidden = true;
          document.getElementById("wizardRecMemoArea").hidden = true;
          document.getElementById("wizardPhotoArea").hidden = true;
          document.getElementById("wizardPhotoTitleArea").hidden = true;
        }
        clearLastSuccessfulSend();
        setTemporaryScannerStatus(
          "取消完了 ✔\n同じQRを再読取できます",
          1400
        );
        void refreshInventoryInBackground();
      } catch (error) {
        setWizardSendStatus(
          "取消失敗\n" + (error.message || String(error)),
          "isError"
        );
      } finally {
        stopAnimatedDots("wizardSendStatus");
        wizardSendBusy = false;
        scannerBusy = false;
        renderCancelSendButton();
      }
    }

    function sendBatchRecords(records) {
      const batchId = createBatchId();
      lastPendingSendId = batchId;

      const recordsWithIds = records.map(
        function(record) {
          return Object.assign({}, record, {
            batchId:batchId,
            sendId:batchId
          });
        }
      );

      return fetch(GAS_URL, {
        method:"POST",
        headers:{
          "Content-Type":"text/plain"
        },
        body:JSON.stringify({
          action:"batchWrite",
          batchId:batchId,
          sendId:batchId,
          initialDataVersion:"status-light-v2",
          stateValidationVersion:"known-state-v2",
          records:recordsWithIds
        })
      }).then(async function(response) {
        const text = await response.text();

        try {
          const result = JSON.parse(text);

          if (!result.sendId) {
            result.sendId = batchId;
          }

          return result;
        } catch (error) {
          const unknownError = new Error(
            "送信結果を確認できませんでした"
          );

          unknownError.sendId = batchId;
          throw unknownError;
        }
      });
    }

    function setWizardSendStatus(message, state) {
      const status = document.getElementById(
        "wizardSendStatus"
      );

      stopAnimatedDots("wizardSendStatus");
      status.innerText = message || "";
      status.className = "wizardSendStatus";

      if (!message) return;

      status.classList.add("isVisible");

      if (state) {
        status.classList.add(state);
      }
    }

    function startWizardSendLoading() {
      const status = document.getElementById(
        "wizardSendStatus"
      );

      status.className =
        "wizardSendStatus isVisible isSending";

      startAnimatedDots(
        "wizardSendStatus",
        "送信中"
      );
    }

    function getWizardBatchFailures(result) {
      const results =
        result && Array.isArray(result.results)
          ? result.results
          : [];

      return results.filter(function(item) {
        return !item.ok;
      });
    }

    function createWizardIrregularCaseId() {
      return "IRR-" + new Date().toISOString()
        .replace(/[-:.TZ]/g, "").slice(0, 14) + "-" +
        String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    }

    function openWizardIrregularArea() {
      wizardIrregularRecord = null;
      wizardIrregularDetected = null;
      document.getElementById("wizardPostSendArea").hidden = false;
      document.getElementById("wizardIrregularArea").hidden = false;
      document.getElementById("wizardIrregularNumber").value = "";
      document.getElementById("wizardIrregularNumber").disabled = false;
      document.getElementById("wizardIrregularNote").value = "";
      document.getElementById("wizardIrregularQuantity").value = "";
      document.getElementById("wizardIrregularQuantityBox").hidden = true;
      document.getElementById("wizardIrregularCheckResult").innerText = "";
      document.querySelectorAll('input[name="wizardIrregularNumberType"]').forEach(function(radio) {
        radio.checked = radio.value === "入力";
      });
      document.querySelectorAll('input[name="wizardIrregularSlipStatus"]').forEach(function(radio) {
        radio.checked = radio.value === "伝票あり";
      });
      updateWizardIrregularSlipGuide();
      scrollToWizardPostSend("wizardIrregularArea");
      setTimeout(function() { document.getElementById("wizardIrregularNumber").focus(); }, 300);
    }

    function updateWizardIrregularNumberType() {
      const selected = document.querySelector('input[name="wizardIrregularNumberType"]:checked');
      const input = document.getElementById("wizardIrregularNumber");
      const unknown = selected && selected.value === "番号不明";
      input.disabled = Boolean(unknown);
      input.value = unknown ? "" : input.value;
      input.placeholder = unknown ? "番号不明として登録します" : "管理番号または品目コードを入力";
      document.getElementById("wizardIrregularQuantityBox").hidden = true;
      document.getElementById("wizardIrregularCheckResult").innerText = unknown
        ? "番号不明は通常管理ログと在庫状態を更新しません。" : "";
    }

    function updateWizardIrregularSlipGuide() {
      const selected = document.querySelector('input[name="wizardIrregularSlipStatus"]:checked');
      const hasSlip = selected && selected.value === "伝票あり";
      document.getElementById("wizardIrregularSlipGuide").innerText = hasSlip
        ? "1枚目に伝票写真を追加してください。"
        : "機械全体・管理番号・QRラベル・状態が分かる写真を追加してください。";
    }

    function buildWizardIrregularRecord() {
      const numberTypeNode = document.querySelector('input[name="wizardIrregularNumberType"]:checked');
      const slipNode = document.querySelector('input[name="wizardIrregularSlipStatus"]:checked');
      const numberType = numberTypeNode ? numberTypeNode.value : "";
      const slipStatus = slipNode ? slipNode.value : "";
      const enteredNumber = document.getElementById("wizardIrregularNumber").value.trim();
      const note = document.getElementById("wizardIrregularNote").value.trim();

      if (!numberType || !slipStatus) throw new Error("番号の状態と伝票の有無を選択してください");
      if (numberType === "入力" && !enteredNumber) throw new Error("管理番号または品目コードを入力してください");
      if (!note) throw new Error("状況・理由・機械の特徴を入力してください");

      const base = {
        irregularCaseId:createWizardIrregularCaseId(),
        qrText:numberType === "番号不明" ? "番号不明" : enteredNumber,
        numberType:numberType,
        mode:wizardState.mode,
        user:wizardState.user,
        location:wizardState.location,
        recTarget:wizardState.recTarget || "",
        recDate:wizardState.recDate || "",
        irregularNote:note,
        slipStatus:slipStatus,
        readMethod:numberType === "番号不明"
          ? "イレギュラーQR（番号不明）" : "イレギュラーQR（手入力）"
      };

      if (numberType === "番号不明") {
        return Object.assign(base, {
          managementType:"unknown", displayName:"番号不明", currentState:""
        });
      }

      const managed = findManagedItemLocal(enteredNumber);
      if (managed) {
        const details = getScannerItemDetails(enteredNumber);
        if (!details) throw new Error("管理番号の情報を取得できませんでした");
        if (!isScannerModeAllowed(details.managementType, wizardState.mode)) {
          throw new Error("この管理区分では「" + wizardState.modeLabel + "」を使用できません");
        }
        const knownState = details.currentState === "状態なし" ? "" : details.currentState;
        if (wizardState.mode === "出庫" && knownState === "出庫中") {
          throw new Error("この機械はすでに出庫中です。二重出庫の可能性があるため登録できません。");
        }
        if (wizardState.mode === "返却" && knownState && knownState !== "出庫中") {
          throw new Error("この機械は出庫中ではないため返却登録できません。\n現在状態：" + knownState);
        }
        wizardIrregularDetected = details;
        return Object.assign(base, {
          managementType:details.managementType,
          displayName:details.displayName,
          currentState:details.currentState === "状態なし" ? "" : details.currentState
        });
      }

      const quantity = findQuantityItemLocal(enteredNumber);
      if (quantity) {
        if (!isScannerModeAllowed("quantity", wizardState.mode)) {
          throw new Error("数量管理品では「" + wizardState.modeLabel + "」を使用できません");
        }
        const displayName = getFirstItemValue(quantity, ["表示名", "品名", "商品名", "名称", "displayName", "name"]) || enteredNumber;
        throw new Error(
          "数量管理品「" + displayName + "」を確認しました。\n\n" +
          "現行GASでは数量管理品のイレギュラー受付が未接続のため、登録を停止しました。"
        );
      }

      throw new Error("入力した番号がマスタに登録されていません\n入力番号：" + enteredNumber);
    }

    function confirmWizardIrregularInput() {
      try {
        const record = buildWizardIrregularRecord();
        wizardIrregularRecord = record;
        document.getElementById("wizardIrregularCheckResult").innerText =
          "受付内容\n" + record.displayName + "\n" + record.qrText +
          " ／ " + (record.managementType === "unknown" ? "番号不明" : record.managementType) +
          (record.quantity ? " ／ 数量：" + record.quantity + (record.unit || "") : "") +
          "\n追記：" + record.irregularNote;
        if (!confirm(
          "イレギュラー受付内容を確認してください\n\n" +
          "番号：" + record.qrText + "\n品名：" + record.displayName +
          "\n作業区分：" + record.mode + "\n拠点：" + record.location +
          "\n担当者：" + record.user + "\n伝票：" + record.slipStatus +
          "\n追記：" + record.irregularNote + "\n\n写真登録へ進みます。"
        )) return;
        document.getElementById("wizardIrregularArea").hidden = true;
        openWizardIrregularPhotoArea(record);
      } catch (error) {
        alert(error.message || String(error));
      }
    }

    function sanitizeWizardPhotoTitlePart(value) {
      return String(value || "").normalize("NFKC").trim()
        .replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ");
    }

    function buildWizardPhotoTitle(customerName, siteName) {
      return [customerName, siteName]
        .map(sanitizeWizardPhotoTitlePart).filter(Boolean).join("_");
    }

    function createWizardPhotoRequestId() {
      return "PHOTO-" + (
        window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : Date.now() + "-" + Math.random().toString(36).slice(2, 10)
      );
    }

    function scrollToWizardPostSend(elementId) {
      setTimeout(function() {
        const element = document.getElementById(elementId);
        if (element) element.scrollIntoView({behavior:"smooth", block:"start"});
      }, 120);
    }

    async function resumeWizardContinuousScan(message) {
      wizardPostSendContext = null;
      wizardSelectedPhotos = [];
      wizardCurrentSlipInfo = null;
      wizardPendingPhotoSave = null;
      document.getElementById("wizardPostSendArea").hidden = true;
      document.getElementById("wizardRecMemoArea").hidden = true;
      document.getElementById("wizardPhotoArea").hidden = true;
      document.getElementById("wizardPhotoTitleArea").hidden = true;
      scannerBusy = false;
      setTemporaryScannerStatus(message || "完了 ✔\n続けてQRを読み取れます", 1400);
      if (!scannerRunning) await startReadOnlyScanner();
    }

    function successfulWizardSendContext(sourceEntries, sendRecords, result, indexes) {
      const resultItems = Array.isArray(result.results) ? result.results : [];
      return {
        mode:wizardState.mode,
        modeLabel:wizardState.modeLabel,
        sendId:String(result.sendId || lastPendingSendId || ""),
        sentAt:new Date().toISOString(),
        entries:indexes.map(function(index) { return sourceEntries[index]; }).filter(Boolean),
        records:indexes.map(function(index) { return sendRecords[index]; }).filter(Boolean),
        logIds:indexes.map(function(index) {
          const item = resultItems.find(function(row) { return Number(row.index) === index; });
          return item && item.logId ? item.logId : "";
        }).filter(Boolean)
      };
    }

    async function beginWizardPostSendFlow(context) {
      if (!context || !context.records.length) return;
      wizardPostSendContext = context;
      await stopReadOnlyScanner();
      scannerBusy = true;
      document.getElementById("wizardPostSendArea").hidden = false;

      if (["校正中", "校正完了", "交換完了"].includes(context.mode)) {
        const names = context.entries.map(function(entry) {
          return entry.displayText || entry.displayName || entry.qrText;
        }).join("\n");
        document.getElementById("wizardRecMemoTarget").innerText =
          "送信済：" + context.records.length + "件\n" + names;
        document.getElementById("wizardRecMemoText").value = "";
        document.getElementById("wizardRecMemoArea").hidden = false;
        scrollToWizardPostSend("wizardRecMemoArea");
        return;
      }

      if (context.mode === "出庫" || context.mode === "返却") {
        openWizardPhotoArea(context);
        return;
      }

      await resumeWizardContinuousScan();
    }

    function openWizardPhotoArea(context) {
      wizardSelectedPhotos = [];
      wizardCurrentSlipInfo = null;
      document.getElementById("wizardSkipPhotosButton").hidden = false;
      document.getElementById("wizardPhotoHeading").innerText =
        context.mode === "出庫" ? "出庫写真の添付" : "返却写真の添付";
      document.getElementById("wizardPhotoSummary").innerText =
        context.mode + "送信完了：" + context.records.length + "件\n送信ID：" + context.sendId;
      document.getElementById("wizardPhotoPreview").innerText =
        "写真はまだ選択されていません。最大6枚まで追加できます。";
      document.getElementById("wizardSavePhotosButton").hidden = true;
      document.getElementById("wizardPhotoArea").hidden = false;
      scrollToWizardPostSend("wizardPhotoArea");
    }

    function openWizardIrregularPhotoArea(record) {
      wizardPostSendContext = {
        isIrregular:true,
        mode:record.mode,
        records:[record],
        entries:[],
        logIds:[],
        sendId:"",
        sentAt:new Date().toISOString(),
        irregularRecord:record
      };
      wizardSelectedPhotos = [];
      wizardCurrentSlipInfo = null;
      document.getElementById("wizardPhotoHeading").innerText = "イレギュラー受付写真";
      document.getElementById("wizardPhotoSummary").innerText =
        (record.slipStatus === "伝票あり"
          ? "1枚目は伝票写真を選択してください。"
          : "機械全体・管理番号・QRラベル・状態が分かる写真を選択してください。") +
        "\n写真は1枚以上必須・最大6枚です。";
      document.getElementById("wizardPhotoPreview").innerText = "写真はまだ選択されていません。";
      document.getElementById("wizardSavePhotosButton").hidden = true;
      document.getElementById("wizardSkipPhotosButton").hidden = true;
      document.getElementById("wizardPhotoArea").hidden = false;
      scrollToWizardPostSend("wizardPhotoArea");
    }

    function addWizardPhotos(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      if (wizardSelectedPhotos.length + files.length > 6) {
        alert("写真は最大6枚までです\n現在：" + wizardSelectedPhotos.length + "枚");
        return;
      }
      wizardSelectedPhotos.push.apply(wizardSelectedPhotos, files);
      document.getElementById("wizardPhotoPreview").innerText =
        wizardSelectedPhotos.length + "枚追加済み\n最大6枚まで。1枚のコラージュ画像にして保存します。";
      document.getElementById("wizardSavePhotosButton").hidden = false;
    }

    function clearWizardPhotos() {
      wizardSelectedPhotos = [];
      document.getElementById("wizardPhotoCameraInput").value = "";
      document.getElementById("wizardPhotoLibraryInput").value = "";
      document.getElementById("wizardPhotoPreview").innerText = "写真はまだ選択されていません。";
      document.getElementById("wizardSavePhotosButton").hidden = true;
    }

    function loadWizardPhotoImage(file) {
      return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function(event) {
          const image = new Image();
          image.onerror = reject;
          image.onload = function() { resolve(image); };
          image.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    async function makeWizardSlipAnalysisImage(file, options) {
      const settings = options || {};
      const image = await loadWizardPhotoImage(file);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const cropRatio = Math.max(0.1, Math.min(1, Number(settings.cropRatio) || 1));
      const sourceHeight = Math.max(1, Math.round(height * cropRatio));
      const maxSide = Number(settings.maxSide) || 1600;
      const quality = Number(settings.quality) || 0.85;
      const scale = Math.min(1, maxSide / Math.max(width, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        0, 0, width, sourceHeight,
        0, 0, canvas.width, canvas.height
      );
      return canvas.toDataURL("image/jpeg", quality);
    }

    async function fetchWithRetry(url, options, retryCount = 1, retryDelayMs = 1200) {
      let lastError = null;

      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          const response = await fetch(url, options);

          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }

          return response;
        } catch (error) {
          lastError = error;

          if (attempt >= retryCount) break;

          console.warn("通信失敗。再試行します。", error);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }

      throw lastError;
    }

    async function analyzeWizardSlipPhoto(file, photoType) {
      startAnimatedDots("wizardPhotoPreview", "伝票情報を確認しています");
      try {
        const analysisProfiles = [
          {
            label:"上部優先",
            cropRatio:0.5,
            maxSide:1400,
            quality:0.82
          },
          {
            label:"全体再解析",
            cropRatio:1,
            maxSide:1600,
            quality:0.85
          }
        ];

        let lastAnalysisError = null;

        for (let attempt = 0; attempt < analysisProfiles.length; attempt++) {
          const profile = analysisProfiles[attempt];
          const photoBase64 = await makeWizardSlipAnalysisImage(file, profile);
          const response = await fetchWithRetry(GAS_URL, {
            method:"POST",
            headers:{"Content-Type":"text/plain"},
            body:JSON.stringify({
              action:"analyzeSlipPhoto",
              photoBase64:photoBase64,
              photoType:photoType,
              requestedFields:["customerName", "siteName"],
              analysisRegion:profile.label
            })
          });

          const text = await response.text();
          let result;

          try {
            result = JSON.parse(text);
          } catch (parseError) {
            lastAnalysisError = new Error(
              "伝票解析結果を読み取れませんでした\n" +
              text.slice(0, 200)
            );
            if (attempt === 0) continue;
            throw lastAnalysisError;
          }

          if (!result.ok) {
            lastAnalysisError = new Error(
              result.message || "伝票情報を取得できませんでした"
            );
            if (attempt === 0) continue;
            throw lastAnalysisError;
          }

          const customerName = sanitizeWizardPhotoTitlePart(result.customerName);
          const siteName = sanitizeWizardPhotoTitlePart(result.siteName);

          if (!customerName && !siteName) {
            lastAnalysisError = new Error(
              "顧客名・現場名を判定できませんでした"
            );
            if (attempt === 0) continue;
            throw lastAnalysisError;
          }

          wizardCurrentSlipInfo = {
            customerName:customerName,
            siteName:siteName,
            originalSiteName:siteName,
            acquisitionMethod:result.acquisitionMethod || "ai_ocr",
            siteNameEdited:false,
            confirmedTitle:buildWizardPhotoTitle(customerName, siteName),
            acquiredAt:new Date().toISOString(),
            analysisRegion:profile.label
          };

          return wizardCurrentSlipInfo;
        }

        throw lastAnalysisError || new Error(
          "顧客名・現場名を判定できませんでした"
        );
      } catch (error) {
        console.warn("伝票情報取得失敗", error);
        alert("伝票情報の解析に失敗しました\n\n" + (error.message || String(error)) +
          "\n\n写真保存はこのまま続行できます。");
        wizardCurrentSlipInfo = null;
        return null;
      } finally {
        stopAnimatedDots("wizardPhotoPreview");
      }
    }

    function drawWizardImageCover(context, image, x, y, width, height) {
      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    async function makeWizardPhotoCollage(files, info) {
      const images = [];
      for (const file of files) images.push(await loadWizardPhotoImage(file));
      const cellWidth = 800, cellHeight = 600, headerHeight = 150;
      const canvas = document.createElement("canvas");
      canvas.width = cellWidth * 3;
      canvas.height = cellHeight * 2 + headerHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000";
      context.font = "28px sans-serif";
      context.fillText(info.mode + "写真", 16, 36);
      context.font = "20px sans-serif";
      context.fillText("日時：" + new Date().toLocaleString("ja-JP"), 16, 72);
      context.fillText("担当：" + (info.user || "") + "　拠点：" + (info.location || ""), 16, 106);
      context.fillText("送信ID：" + (info.sendId || ""), 580, 72);
      context.fillText("QR：" + (info.ids || []).join(" ").slice(0, 120), 580, 106);
      images.forEach(function(image, index) {
        const x = (index % 3) * cellWidth;
        const y = Math.floor(index / 3) * cellHeight + headerHeight;
        context.save();
        context.beginPath(); context.rect(x, y, cellWidth, cellHeight); context.clip();
        drawWizardImageCover(context, image, x, y, cellWidth, cellHeight);
        context.restore();
      });
      return canvas.toDataURL("image/jpeg", 0.85);
    }

    function buildWizardPhotoInfo(context) {
      const first = context.records[0] || {};
      const confirmedTitle = wizardCurrentSlipInfo ? wizardCurrentSlipInfo.confirmedTitle : "";
      const info = {
        mode:context.mode,
        ids:context.records.map(function(record) { return record.qr || record.qrText; }),
        user:first.user || wizardState.user,
        location:first.location || wizardState.location,
        sendId:context.sendId,
        logIds:context.logIds.slice(),
        createdAt:context.sentAt,
        slipInfo:wizardCurrentSlipInfo,
        saveTitleCandidate:confirmedTitle,
        confirmedTitle:confirmedTitle
      };
      if (context.isIrregular) {
        info.photoType = "irregular";
        info.irregularCaseId = context.irregularRecord.irregularCaseId;
        info.irregularRecord = Object.assign({}, context.irregularRecord, {
          photoCount:wizardSelectedPhotos.length
        });
        info.slipStatus = context.irregularRecord.slipStatus;
        info.photoRequired = true;
      }
      return info;
    }

    async function saveWizardPhotoNow() {
      if (wizardPostSendBusy || !wizardPendingPhotoSave) return;
      wizardPostSendBusy = true;
      const button = document.getElementById("wizardConfirmPhotoTitleButton");
      button.disabled = true;
      startAnimatedDots("wizardPhotoTitleCandidate", "写真を保存中");
      try {
        const pending = wizardPendingPhotoSave;
        const photoInfo = pending.photoInfo;
        const collage = await makeWizardPhotoCollage(pending.files, photoInfo);
        const action = photoInfo.photoType === "irregular"
          ? "saveIrregularRegistration"
          : photoInfo.mode === "出庫" ? "saveShipmentPhoto" : "saveReturnPhoto";
        const extraPayload = photoInfo.photoType === "irregular"
          ? {record:photoInfo.irregularRecord, irregularCaseId:photoInfo.irregularCaseId}
          : {};
        const response = await fetch(GAS_URL, {
          method:"POST", headers:{"Content-Type":"text/plain"},
          body:JSON.stringify({
            action:action, photoRequestId:pending.photoRequestId,
            photoBase64:collage, photoInfo:photoInfo,
            slipInfo:photoInfo.slipInfo, saveTitleCandidate:photoInfo.confirmedTitle,
            confirmedTitle:photoInfo.confirmedTitle,
            ...extraPayload
          })
        });
        const result = JSON.parse(await response.text());
        if (!result.ok) throw new Error(result.message || "写真を保存できませんでした");
        if (photoInfo.photoType === "irregular") {
          alert("イレギュラー受付を保存しました");
          await finishWizardIrregularFlow();
        } else {
          alert(photoInfo.mode + "写真を保存しました");
          await resumeWizardContinuousScan("写真保存完了 ✔\n続けてQRを読み取れます");
        }
      } catch (error) {
        alert("写真保存失敗\n" + (error.message || String(error)));
      } finally {
        stopAnimatedDots("wizardPhotoTitleCandidate");
        wizardPostSendBusy = false;
        button.disabled = false;
      }
    }

    async function prepareWizardPhotoSave() {
      if (!wizardPostSendContext || !wizardSelectedPhotos.length || wizardPostSendBusy) return;
      wizardPostSendBusy = true;
      document.getElementById("wizardSavePhotosButton").disabled = true;
      try {
        const isIrregular = Boolean(wizardPostSendContext.isIrregular);
        const hasSlip = !isIrregular || wizardPostSendContext.irregularRecord.slipStatus === "伝票あり";
        if (hasSlip) {
          await analyzeWizardSlipPhoto(
            wizardSelectedPhotos[0],
            isIrregular ? "irregular" :
              wizardPostSendContext.mode === "出庫" ? "shipment" : "return"
          );
        } else {
          wizardCurrentSlipInfo = {
            customerName:"", siteName:"", originalSiteName:"",
            acquisitionMethod:"manual_no_slip", siteNameEdited:true,
            confirmedTitle:"", acquiredAt:new Date().toISOString()
          };
        }
        const photoInfo = buildWizardPhotoInfo(wizardPostSendContext);
        wizardPendingPhotoSave = {
          files:wizardSelectedPhotos.slice(), photoInfo:photoInfo,
          photoRequestId:createWizardPhotoRequestId()
        };
        if (!wizardCurrentSlipInfo && !isIrregular) {
          /* AI失敗時はタイトル確認を飛ばし、従来タイトルで保存を継続する。 */
          wizardPostSendBusy = false;
          await saveWizardPhotoNow();
          return;
        }
        if (!wizardCurrentSlipInfo) {
          wizardCurrentSlipInfo = {
            customerName:"", siteName:"", originalSiteName:"",
            acquisitionMethod:"manual_after_analysis_failure", siteNameEdited:true,
            confirmedTitle:"", acquiredAt:new Date().toISOString()
          };
          wizardPendingPhotoSave.photoInfo.slipInfo = wizardCurrentSlipInfo;
        }
        document.getElementById("wizardPhotoCustomerName").value = wizardCurrentSlipInfo.customerName || "";
        document.getElementById("wizardPhotoSiteName").value = wizardCurrentSlipInfo.siteName || "";
        document.getElementById("wizardPhotoTitleCandidate").innerText = wizardCurrentSlipInfo.confirmedTitle;
        document.getElementById("wizardPhotoArea").hidden = true;
        document.getElementById("wizardPhotoTitleArea").hidden = false;
        scrollToWizardPostSend("wizardPhotoTitleArea");
      } finally {
        wizardPostSendBusy = false;
        document.getElementById("wizardSavePhotosButton").disabled = false;
      }
    }

    async function confirmWizardPhotoTitle() {
      if (!wizardPendingPhotoSave) return;
      const customerName = sanitizeWizardPhotoTitlePart(document.getElementById("wizardPhotoCustomerName").value);
      const siteName = sanitizeWizardPhotoTitlePart(document.getElementById("wizardPhotoSiteName").value);
      if (
        wizardPendingPhotoSave.photoInfo.photoType === "irregular" &&
        (!customerName || !siteName)
      ) {
        alert("イレギュラー受付は顧客名と現場名を入力してください");
        return;
      }
      wizardCurrentSlipInfo.customerName = customerName;
      wizardCurrentSlipInfo.siteName = siteName;
      wizardCurrentSlipInfo.siteNameEdited = true;
      wizardCurrentSlipInfo.confirmedTitle = buildWizardPhotoTitle(customerName, siteName);
      Object.assign(wizardPendingPhotoSave.photoInfo, {
        slipInfo:wizardCurrentSlipInfo,
        saveTitleCandidate:wizardCurrentSlipInfo.confirmedTitle,
        confirmedTitle:wizardCurrentSlipInfo.confirmedTitle
      });
      await saveWizardPhotoNow();
    }

    async function finishWizardIrregularFlow() {
      wizardIrregularRecord = null;
      wizardIrregularDetected = null;
      wizardPostSendContext = null;
      wizardSelectedPhotos = [];
      wizardCurrentSlipInfo = null;
      wizardPendingPhotoSave = null;
      document.getElementById("wizardPostSendArea").hidden = true;
      document.getElementById("wizardIrregularArea").hidden = true;
      document.getElementById("wizardPhotoArea").hidden = true;
      document.getElementById("wizardPhotoTitleArea").hidden = true;
      resetWizard();
      void refreshInventoryInBackground();
    }

    async function saveWizardRecMemo() {
      if (!wizardPostSendContext || wizardPostSendBusy) return;
      const memo = document.getElementById("wizardRecMemoText").value.trim();
      if (!memo) { alert("追記内容を入力してください"); return; }
      wizardPostSendBusy = true;
      const button = document.getElementById("wizardSaveRecMemoButton");
      button.disabled = true;
      startAnimatedDots("wizardRecMemoTarget", "追記保存中");
      try {
        const context = wizardPostSendContext;
        const results = await Promise.all(context.records.map(async function(record, index) {
          const entry = context.entries[index] || {};
          const response = await fetch(GAS_URL, {
            method:"POST", headers:{"Content-Type":"text/plain"},
            body:JSON.stringify({
              action:"addMemo", kanriNo:record.qr,
              kubun:record.managementType || record.recordType || "",
              kishu:record.displayName || entry.displayName || record.qr,
              sendId:context.sendId, logId:context.logIds[index] || "",
              memo:memo, user:record.user || wizardState.user
            })
          });
          const result = JSON.parse(await response.text());
          if (!result.ok) throw new Error((record.qr || "不明") + "：" + (result.message || "追記保存失敗"));
          return result;
        }));
        alert("REC追記を保存しました\n" + results.length + "件");
        await resumeWizardContinuousScan("REC追記保存完了 ✔\n続けてQRを読み取れます");
      } catch (error) {
        alert("REC追記保存失敗\n" + (error.message || String(error)));
      } finally {
        stopAnimatedDots("wizardRecMemoTarget");
        wizardPostSendBusy = false;
        button.disabled = false;
      }
    }

    async function sendWizardBatch() {
      if (wizardSendBusy) return;

      const records =
        getWizardPreparedBatchRecords();

      if (!records.length) {
        alert("送信するQRがありません");
        return;
      }

      const invalidQuantity = records.some(
        function(record) {
          return (
            record.recordType === "quantity" &&
            (
              !Number.isInteger(record.quantity) ||
              record.quantity <= 0
            )
          );
        }
      );

      if (invalidQuantity) {
        alert("数量が未入力の品目があります");
        return;
      }

      if (!confirm(
        wizardState.modeLabel + "を " +
        records.length +
        "件まとめて送信します。よろしいですか？"
      )) {
        return;
      }

      wizardSendBusy = true;
      scannerBusy = true;

      const button = document.getElementById(
        "wizardSendBatchButton"
      );

      button.disabled = true;
      startWizardSendLoading();

      try {
        const sentAt = new Date().toISOString();
        const sourceEntries = scannedEntries.slice();
        const snapshots = sourceEntries.map(captureLocalState);
        const sendRecords = records.map(
          buildBatchRecordData
        );

        const result = await sendBatchRecords(
          sendRecords
        );

        const failures = getWizardBatchFailures(
          result
        );

        const successCount = Number(
          result.successCount || 0
        );

        const failedCount = Number(
          result.failedCount || failures.length || 0
        );

        const resultItems = Array.isArray(result.results)
          ? result.results
          : [];
        const successfulIndexes = getSuccessfulResultIndexes(
          result,
          sourceEntries.length
        );
        const successfulSet = new Set(successfulIndexes);
        const successfulRecords = successfulIndexes
          .map(function(index) { return sendRecords[index]; })
          .filter(Boolean);
        const recentWorkKeys = rememberRecentSuccessfulWorks(
          sourceEntries,
          successfulIndexes
        );
        const postSendContext = successfulWizardSendContext(
          sourceEntries,
          sendRecords,
          result,
          successfulIndexes
        );

        successfulIndexes.forEach(function(index) {
          applySuccessfulLocalState(sendRecords[index]);
        });

        if (successfulIndexes.length > 0) {
          await saveInventoryCache();
          saveLastSuccessfulSend({
            sendId:result.sendId || lastPendingSendId,
            sentAt:sentAt,
            expiresAt:Date.now() + CANCEL_SEND_VALID_MS,
            successCount:successfulIndexes.length,
            logIds:resultItems
              .filter(function(item) { return item.ok && item.logId; })
              .map(function(item) { return item.logId; }),
            snapshots:successfulIndexes
              .map(function(index) { return snapshots[index]; })
              .filter(Boolean),
            recentWorkKeys:recentWorkKeys
          });
        }

        scannedEntries = sourceEntries.filter(function(entry, index) {
          return !successfulSet.has(index);
        });
        renderScannerResults();

        if (!result.ok || failedCount > 0) {
          const failureText = failures.map(
            function(item) {
              return (
                (item.qr || "不明") + "：" +
                (item.message || "送信失敗")
              );
            }
          ).join("\n");

          setWizardSendStatus(
            "一部送信失敗\n" +
            "成功：" + successCount + "件\n" +
            "失敗：" + failedCount + "件" +
            (failureText ? "\n\n" + failureText : "") +
            "\n\n送信ID：" +
            (result.sendId || lastPendingSendId),
            "isError"
          );

          scannerBusy = false;
          void refreshInventoryInBackground(successfulRecords);
          if (successfulIndexes.length > 0) {
            await beginWizardPostSendFlow(postSendContext);
          }
          return;
        }

        setWizardSendStatus(
          "送信完了 ✔\n" +
          successCount + "件\n" +
          "送信ID：" +
          (result.sendId || lastPendingSendId),
          "isSuccess"
        );

        setTemporaryScannerStatus(
          "送信完了 ✔\n続けてQRを読み取れます",
          1400
        );

        scannerBusy = false;
        void refreshInventoryInBackground(successfulRecords);
        await beginWizardPostSendFlow(postSendContext);
      } catch (error) {
        const sendId =
          error.sendId ||
          lastPendingSendId ||
          "不明";

        setWizardSendStatus(
          "送信結果不明\n" +
          "スプレッドシートを確認してください。" +
          "同じ内容をすぐに再送信しないでください。\n\n" +
          "送信ID：" + sendId,
          "isError"
        );

        scannerBusy = false;
      } finally {
        stopAnimatedDots("wizardSendStatus");
        wizardSendBusy = false;
        button.disabled = false;
      }
    }

    async function handleReadOnlyDecoded(text) {
      if (scannerBusy) return;

      scannerBusy = true;

      const qrText =
        String(text || "").trim();

      const duplicateKey =
        normalizeManagedIdKey(qrText);

      const alreadyScanned = scannedEntries.some(
        function(entry) {
          return normalizeManagedIdKey(entry.qrText) === duplicateKey;
        }
      );

      if (alreadyScanned) {
        if (navigator.vibrate) navigator.vibrate(35);

        setTemporaryScannerStatus(
          "このQRは読取済みです\n重複のため追加しません",
          1000
        );

        setTimeout(function() {
          scannerBusy = false;
        }, 750);
        return;
      }

      const details =
        getScannerItemDetails(qrText);

      if (!details) {
        document.getElementById(
          "scannerStatus"
        ).innerText =
          "登録データに見つかりません\n" +
          qrText;

        setTimeout(function() {
          scannerBusy = false;
        }, 900);
        return;
      }

      if (
        !isScannerModeAllowed(
          details.managementType,
          wizardState.mode
        )
      ) {
        setTemporaryScannerStatus(
          "この管理区分では「" +
          wizardState.modeLabel +
          "」を使用できません",
          1200
        );

        setTimeout(function() {
          scannerBusy = false;
        }, 1000);
        return;
      }
      /*
       * 個体・簡易個体・RECは、直近送信と現在状態を確認する。
       * 数量管理品は同じ品目を続けて扱う可能性があるため、
       * 5分ブロックと状態遷移判定の対象外。
       */
      if (details.managementType !== "quantity") {
        if (
          isRecentSuccessfulWork(
            qrText,
            wizardState.mode
          )
        ) {
          if (navigator.vibrate) {
            navigator.vibrate([80, 60, 80]);
          }

          setTemporaryScannerStatus(
            "この作業は5分以内に登録済みです\n" +
            "二重登録の可能性があるため登録できません",
            1800
          );

          setTimeout(function() {
            scannerBusy = false;
          }, 1600);
          return;
        }

        const knownState =
          details.currentState === "状態なし"
            ? ""
            : details.currentState;

        const stateCheck = validateStateTransition(
          knownState,
          wizardState.mode
        );

        if (!stateCheck.ok) {
          if (navigator.vibrate) {
            navigator.vibrate([80, 60, 80]);
          }

          setTemporaryScannerStatus(
            stateCheck.message +
            "\n現在状態：" + (knownState || "状態なし"),
            1900
          );

          setTimeout(function() {
            scannerBusy = false;
          }, 1700);
          return;
        }
      }
      const scanRecord =
        buildWizardScanRecord(details);

      if (scanRecord.recordType === "quantity") {
        showWizardQuantityInput(scanRecord);
        return;
      }

      commitWizardScanRecord(scanRecord);
    }

    async function applyReadOnlyCameraSettings() {
      try {
        const video =
          document.getElementById(
            "scannerVideo"
          );

        const source = video.srcObject;

        if (!source) return;

        scannerStream = source;

        const track =
          source.getVideoTracks()[0];

        if (!track) return;

        const capabilities =
          track.getCapabilities
            ? track.getCapabilities()
            : {};

        if (capabilities.zoom) {
          await track.applyConstraints({
            advanced:[{
              zoom:Math.min(
                1.8,
                capabilities.zoom.max
              )
            }]
          });
        }

        try {
          await track.applyConstraints({
            advanced:[{
              focusMode:"continuous"
            }]
          });
        } catch (error) {
          console.log(
            "継続フォーカス未対応",
            error
          );
        }
      } catch (error) {
        console.log(
          "カメラ設定未対応",
          error
        );
      }
    }

    async function startReadOnlyScanner() {
      if (scannerRunning) return;

      if (!appInitialDataLoaded) {
        document.getElementById(
          "scannerStatus"
        ).innerText =
          "在庫データの取得完了後に、もう一度お試しください";
        return;
      }

      scannerBusy = false;

      document.getElementById(
        "scannerViewport"
      ).hidden = false;

      document.getElementById(
        "scannerFrame"
      ).classList.remove("isSuccess");

      startAnimatedDots(
        "scannerStatus",
        "カメラ起動中"
      );

      try {
        const hints = new Map();

        hints.set(
          ZXing.DecodeHintType.POSSIBLE_FORMATS,
          [
            ZXing.BarcodeFormat.QR_CODE,
            ZXing.BarcodeFormat.DATA_MATRIX
          ]
        );

        scannerCodeReader =
          new ZXing.BrowserMultiFormatReader(
            hints
          );

        const devices =
          await scannerCodeReader
            .listVideoInputDevices();

        if (!devices || !devices.length) {
          throw new Error(
            "カメラが見つかりません"
          );
        }

        const backCamera = devices.find(
          function(device) {
            const label = String(
              device.label || ""
            ).toLowerCase();

            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment") ||
              label.includes("背面")
            );
          }
        );

        const deviceId = backCamera
          ? backCamera.deviceId
          : devices[devices.length - 1].deviceId;

        scannerCodeReader.decodeFromVideoDevice(
          deviceId,
          "scannerVideo",
          function(result) {
            if (result) {
              handleReadOnlyDecoded(
                result.getText()
              );
            }
          }
        );

        scannerRunning = true;

        stopAnimatedDots("scannerStatus");

        document.getElementById(
          "scannerStatus"
        ).innerText =
          "QRを読み取ってください\n読取件数：" +
          scannedEntries.length + "件";

        /*
         * 現行HTMLと同じく、カメラ起動後に
         * 読取画面まで滑らかに自動スクロールする。
         */
        setTimeout(function() {
          document.getElementById(
            "scannerViewport"
          ).scrollIntoView({
            behavior:"smooth",
            block:"start"
          });
        }, 300);

        setTimeout(
          applyReadOnlyCameraSettings,
          500
        );

        setTimeout(
          applyReadOnlyCameraSettings,
          1200
        );
        setTimeout(
          applyReadOnlyCameraSettings,
          2000
        );
      } catch (error) {
        stopAnimatedDots("scannerStatus");
        scannerRunning = false;
        scannerBusy = false;

        document.getElementById(
          "scannerStatus"
        ).innerText =
          "カメラ起動失敗\n" +
          (error && error.message
            ? error.message
            : String(error));
      }
    }

    async function stopReadOnlyScanner() {
      stopAnimatedDots("scannerStatus");

      if (scannerCodeReader) {
        try {
          scannerCodeReader.reset();
        } catch (error) {}

        scannerCodeReader = null;
      }

      if (scannerStream) {
        scannerStream
          .getTracks()
          .forEach(function(track) {
            track.stop();
          });

        scannerStream = null;
      }

      scannerRunning = false;
    }

    function setInventoryDataStatus(
      message,
      state
    ) {
      stopAnimatedDots("inventoryDataStatus");

      const status =
        document.getElementById(
          "inventoryDataStatus"
        );

      if (!status) return;

      status.innerText = message;
      status.className =
        "inventoryDataStatus" +
        (state ? " " + state : "");
    }

    function startInventoryDataStatusAnimation(
      message
    ) {
      const status =
        document.getElementById(
          "inventoryDataStatus"
        );

      if (!status) return;

      status.className =
        "inventoryDataStatus isLoading";

      startAnimatedDots(
        "inventoryDataStatus",
        message
      );
    }

    /*
     * 次工程のGAS送信接続でも同じ点アニメーションを使う。
     */
    function startWizardSendLoading(message) {
      const button = document.getElementById(
        "wizardSendBatchButton"
      );

      button.disabled = true;

      startAnimatedDots(
        "wizardSendBatchButton",
        message || "送信中"
      );
    }

    function stopWizardSendLoading() {
      stopAnimatedDots("wizardSendBatchButton");

      const button = document.getElementById(
        "wizardSendBatchButton"
      );

      button.disabled = false;
      renderScannerResults();
    }

    function formatInventoryUpdatedAt(value) {
      const date = value
        ? new Date(value)
        : null;

      if (
        !date ||
        Number.isNaN(date.getTime())
      ) {
        return "更新時刻不明";
      }

      return new Intl.DateTimeFormat(
        "ja-JP",
        {
          month:"2-digit",
          day:"2-digit",
          hour:"2-digit",
          minute:"2-digit",
          hour12:false
        }
      ).format(date);
    }

    function normalizeLookupKey(value) {
      return String(value || "")
        .normalize("NFKC")
        .trim()
        .replace(/[‐-‒–—―ー−]/g, "-")
        .replace(/\s+/g, "")
        .toLowerCase();
    }

    /*
     * 管理IDの3桁／4桁表記差を吸収する。
     * 例：REC01-001 と REC01-0001 は同じ検索キーにする。
     */
    function normalizeManagedIdKey(value) {
      const normalized =
        normalizeLookupKey(value);

      const matched = normalized.match(
        /^([a-z0-9]+)-(\d+)$/
      );

      if (!matched) return normalized;

      return matched[1] +
        "-" +
        String(Number(matched[2]));
    }

    function isManagedId(value) {
      return /^[A-Za-z0-9]+-\d{3,4}$/.test(
        String(value || "").trim()
      );
    }

    function getFirstItemValue(
      item,
      keyCandidates
    ) {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return "";
      }

      for (
        let index = 0;
        index < keyCandidates.length;
        index++
      ) {
        const key = keyCandidates[index];

        if (
          Object.prototype.hasOwnProperty.call(
            item,
            key
          ) &&
          item[key] !== null &&
          item[key] !== undefined &&
          String(item[key]).trim() !== ""
        ) {
          return String(item[key]).trim();
        }
      }

      return "";
    }

    function createItemMap(
      items,
      keyCandidates
    ) {
      const map = new Map();

      items.forEach(function(item) {
        const key = getFirstItemValue(
          item,
          keyCandidates
        );

        const normalizedKey =
          normalizeLookupKey(key);

        if (normalizedKey) {
          map.set(normalizedKey, item);
        }
      });

      return map;
    }

    function createManagedItemMap(items) {
      const map = new Map();

      items.forEach(function(item) {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return;
        }

        let managedId = getFirstItemValue(
          item,
          [
            "管理ID",
            "管理ＩＤ",
            "管理Id",
            "管理id",
            "管理番号",
            "QR",
            "qr",
            "id"
          ]
        );

        /*
         * RECデータなどで、機種コードと管理番号が
         * 別項目になっている場合は管理IDを組み立てる。
         */
        const machineCode = getFirstItemValue(
          item,
          [
            "機種コード",
            "機種CD",
            "機種ＣＤ",
            "modelCode",
            "機種"
          ]
        );

        const managementNumber =
          getFirstItemValue(
            item,
            [
              "管理番号",
              "管理No",
              "管理NO",
              "管理Ｎｏ",
              "番号",
              "No",
              "no"
            ]
          );

        if (
          machineCode &&
          managementNumber &&
          !String(managedId || "").includes("-")
        ) {
          managedId =
            machineCode +
            "-" +
            managementNumber;
        }

        if (!managedId) {
          const values = Object.values(item);

          for (
            let index = 0;
            index < values.length;
            index++
          ) {
            const value =
              String(values[index] || "").trim();

            if (isManagedId(value)) {
              managedId = value;
              break;
            }
          }
        }

        const normalizedKey =
          normalizeLookupKey(managedId);

        if (normalizedKey) {
          map.set(normalizedKey, item);

          map.set(
            normalizeManagedIdKey(managedId),
            item
          );
        }
      });

      return map;
    }

    function buildAppInitialDataMaps() {
      individualItemMap =
        createManagedItemMap(
          individualItems
        );

      simpleItemMap =
        createManagedItemMap(
          simpleItems
        );

      recItemMap =
        createManagedItemMap(recItems);

      quantityItemMap = createItemMap(
        quantityItems,
        [
          "品目コード",
          "itemCode",
          "商品コード",
          "コード"
        ]
      );

      managedMasterItemMap =
        createManagedItemMap(
          managedMasterItems
        );
    }

    function findManagedItemLocal(qrText) {
      const key =
        normalizeLookupKey(qrText);

      const managedKey =
        normalizeManagedIdKey(qrText);

      if (!key) return null;

      if (
        simpleItemMap.has(key) ||
        simpleItemMap.has(managedKey)
      ) {
        return {
          managementType:"simple",
          item:
            simpleItemMap.get(key) ||
            simpleItemMap.get(managedKey)
        };
      }

      if (
        individualItemMap.has(key) ||
        individualItemMap.has(managedKey)
      ) {
        return {
          managementType:"individual",
          item:
            individualItemMap.get(key) ||
            individualItemMap.get(managedKey)
        };
      }

      if (
        recItemMap.has(key) ||
        recItemMap.has(managedKey)
      ) {
        return {
          managementType:"rec",
          item:
            recItemMap.get(key) ||
            recItemMap.get(managedKey)
        };
      }

      if (
        managedMasterItemMap.has(key) ||
        managedMasterItemMap.has(managedKey)
      ) {
        const item =
          managedMasterItemMap.get(key) ||
          managedMasterItemMap.get(managedKey);
        const managementCategory = String(
          getFirstItemValue(item, ["管理区分", "managementType"]) || ""
        ).trim();

        return {
          managementType:
            managementCategory === "数量"
              ? "simple"
              : "individual",
          item:item
        };
      }

      return null;
    }

    /*
     * 状態データ側に名称がない場合だけ、
     * 同じ管理IDの別データから表示名を補完する。
     * 管理区分・状態・検索順には影響させない。
     */
    function getManagedDisplayName(
      qrText,
      primaryItem
    ) {
      const key =
        normalizeLookupKey(qrText);

      const managedKey =
        normalizeManagedIdKey(qrText);

      const candidates = [
        primaryItem,
        simpleItemMap.get(key),
        simpleItemMap.get(managedKey),
        individualItemMap.get(key),
        individualItemMap.get(managedKey),
        recItemMap.get(key),
        recItemMap.get(managedKey),
        managedMasterItemMap.get(key),
        managedMasterItemMap.get(managedKey)
      ];

      const nameKeys = [
        "機種表示",
        "表示名",
        "機種名",
        "機械名",
        "名称",
        "品名",
        "商品名",
        "機種",
        "displayName",
        "name"
      ];

      for (
        let index = 0;
        index < candidates.length;
        index++
      ) {
        const displayName =
          getFirstItemValue(
            candidates[index],
            nameKeys
          );

        if (displayName) {
          return displayName;
        }
      }

      return String(qrText || "名称なし");
    }

    function findQuantityItemLocal(itemCode) {
      const key =
        normalizeLookupKey(itemCode);

      if (!key) return null;

      return quantityItemMap.get(key) || null;
    }

    function openInventoryDb() {
      return new Promise(
        function(resolve, reject) {
          const request = indexedDB.open(
            INVENTORY_DB_NAME,
            1
          );

          request.onupgradeneeded =
            function(event) {
              const db =
                event.target.result;

              if (
                !db.objectStoreNames.contains(
                  INVENTORY_STORE_NAME
                )
              ) {
                db.createObjectStore(
                  INVENTORY_STORE_NAME
                );
              }
            };

          request.onsuccess =
            function(event) {
              resolve(event.target.result);
            };

          request.onerror =
            function(event) {
              reject(event.target.error);
            };
        }
      );
    }

    async function saveInventoryCache() {
      const db = await openInventoryDb();

      const cacheData = {
        updatedAt:
          new Date().toISOString(),
        individualItems:individualItems,
        simpleItems:simpleItems,
        recItems:recItems,
        quantityItems:quantityItems,
        managedMasterItems:managedMasterItems
      };

      return new Promise(
        function(resolve, reject) {
          const transaction = db.transaction(
            INVENTORY_STORE_NAME,
            "readwrite"
          );

          const request = transaction
            .objectStore(INVENTORY_STORE_NAME)
            .put(
              cacheData,
              INVENTORY_CACHE_KEY
            );

          request.onsuccess = function() {
            resolve(cacheData);
          };

          request.onerror = function(event) {
            reject(event.target.error);
          };

          transaction.oncomplete = function() {
            db.close();
          };
        }
      );
    }

    async function loadInventoryCache() {
      const db = await openInventoryDb();

      return new Promise(
        function(resolve, reject) {
          const transaction = db.transaction(
            INVENTORY_STORE_NAME,
            "readonly"
          );

          const request = transaction
            .objectStore(INVENTORY_STORE_NAME)
            .get(INVENTORY_CACHE_KEY);

          request.onsuccess = function() {
            resolve(request.result || null);
          };

          request.onerror = function(event) {
            reject(event.target.error);
          };

          transaction.oncomplete = function() {
            db.close();
          };
        }
      );
    }

    async function restoreInventoryCache() {
      try {
        const cache =
          await loadInventoryCache();

        if (!cache) return null;

        individualItems = Array.isArray(
          cache.individualItems
        ) ? cache.individualItems : [];

        simpleItems = Array.isArray(
          cache.simpleItems
        ) ? cache.simpleItems : [];

        recItems = Array.isArray(
          cache.recItems
        ) ? cache.recItems : [];

        quantityItems = Array.isArray(
          cache.quantityItems
        ) ? cache.quantityItems : [];

        managedMasterItems = Array.isArray(
          cache.managedMasterItems
        ) ? cache.managedMasterItems : [];

        buildAppInitialDataMaps();
        appInitialDataLoaded = true;
        renderCancelSendButton();

        return cache;

      } catch (error) {
        console.warn(
          "在庫データキャッシュ復元失敗",
          error
        );

        return null;
      }
    }

    async function loadAppInitialData(
      showLoading
    ) {
      if (appInitialDataLoading) {
        return false;
      }

      appInitialDataLoading = true;
      appInitialDataError = "";

      if (showLoading) {
        startInventoryDataStatusAnimation(
          "在庫データ：最新データ取得中"
        );
      }

      try {
        let response = null;
        let responseText = "";

        for (
          let attempt = 1;
          attempt <= 2;
          attempt++
        ) {
          response = await fetch(
            GAS_URL +
              "?t=" + Date.now() +
              "&attempt=" + attempt,
            {
              method:"POST",
              headers:{
                "Content-Type":"text/plain"
              },
              cache:"no-store",
              body:JSON.stringify({
                action:"getAppInitialData",
                initialDataVersion:"status-light-v2"
              })
            }
          );

          responseText =
            await response.text();

          if (response.ok) break;

          if (attempt === 1) {
            await new Promise(
              function(resolve) {
                setTimeout(resolve, 1000);
              }
            );
          }
        }

        let result = null;

        try {
          result = JSON.parse(responseText);
        } catch (error) {
          throw new Error(
            "在庫データの解析に失敗しました"
          );
        }

        if (!result.success && !result.ok) {
          throw new Error(
            result.error ||
            result.message ||
            "初期データを取得できませんでした"
          );
        }

        individualItems = Array.isArray(
          result.individualItems
        ) ? result.individualItems : [];

        simpleItems = Array.isArray(
          result.simpleItems
        ) ? result.simpleItems : [];

        recItems = Array.isArray(
          result.recItems
        ) ? result.recItems : [];

        quantityItems = Array.isArray(
          result.quantityItems
        ) ? result.quantityItems : [];

        managedMasterItems = Array.isArray(
          result.managedMasterItems
        ) ? result.managedMasterItems : [];

        buildAppInitialDataMaps();
        appInitialDataLoaded = true;
        renderCancelSendButton();

        const cache =
          await saveInventoryCache();

        setInventoryDataStatus(
          "在庫データ：更新完了 " +
            formatInventoryUpdatedAt(
              cache.updatedAt
            ) +
            "（個体 " +
            individualItems.length +
            "／簡易 " +
            simpleItems.length +
            "／REC " +
            recItems.length +
            "／数量 " +
            quantityItems.length +
            "／索引 " +
            managedMasterItems.length +
            "）",
          "isReady"
        );

        return true;

      } catch (error) {
        appInitialDataError =
          error && error.message
            ? error.message
            : String(error);

        console.error(
          "在庫データ取得失敗",
          error
        );

        return false;

      } finally {
        appInitialDataLoading = false;
      }
    }

    async function initializeInventoryDataFoundation() {
      const cache =
        await restoreInventoryCache();

      if (cache) {
        startInventoryDataStatusAnimation(
          "在庫データ：前回データ確認済み " +
            formatInventoryUpdatedAt(
              cache.updatedAt
            ) +
            "／最新データへ更新中"
        );

        const success =
          await loadAppInitialData(false);

        if (!success) {
          setInventoryDataStatus(
            "在庫データ：更新失敗・前回データを使用 " +
              formatInventoryUpdatedAt(
                cache.updatedAt
              ),
            "isError"
          );
        }

        startScannerAfterInventoryReady();

        return;
      }

      const success =
        await loadAppInitialData(true);

      if (!success) {
        setInventoryDataStatus(
          "在庫データ：取得失敗 " +
            appInitialDataError,
          "isError"
        );
      }

      startScannerAfterInventoryReady();
    }

    /*
     * 初期データ取得中にウィザードを完了した場合も、
     * 取得完了後に通常受付のカメラを自動で開始する。
     */
    function startScannerAfterInventoryReady() {
      if (
        appInitialDataLoaded &&
        wizardState.currentStep === "complete" &&
        wizardState.receptionType === "normal" &&
        !scannerRunning
      ) {
        startReadOnlyScanner();
      }
    }

    /*
     * 現行HTMLの各処理は、mode・location・user・recTarget・recDateを
     * getElementById()で参照している。移植中も既存処理を書き換えずに
     * 利用できるよう、ウィザード確定値を同じIDのフィールドへ同期する。
     */
    function syncWizardSettingsToLegacyFields(settings) {
      const modeSelect =
        document.getElementById("mode");

      modeSelect.innerHTML = "";

      const modeOption =
        document.createElement("option");

      modeOption.value = settings.mode || "";
      modeOption.textContent = settings.mode || "";
      modeOption.selected = true;
      modeSelect.appendChild(modeOption);

      document.getElementById("location").value =
        settings.location || "";

      document.getElementById("user").value =
        settings.user || "";

      document.getElementById("recTarget").value =
        settings.recTarget || "騒音計";

      document.getElementById("recDate").value =
        settings.recDate || "";
    }

   function goBackFromCurrentStep() {
  const currentStep =
    wizardState.currentStep;

  /*
   * 前回設定確認
   * ↓
   * 受付方法
   */
  if (
    currentStep ===
    "previous"
  ) {
    showStep(
      "reception"
    );
    return;
  }

  /*
   * 作業区分
   *
   * 前回設定がある場合は
   * 前回設定確認へ戻る。
   *
   * 前回設定がない場合は
   * 受付方法へ戻る。
   */
  if (
    currentStep ===
    "mode"
  ) {
    if (
      wizardState.hasPreviousSettings
    ) {
      showStep(
        "previous"
      );
      return;
    }

    showStep(
      "reception"
    );
    return;
  }

  /*
   * 拠点
   * ↓
   * 作業区分
   */
  if (
    currentStep ===
    "location"
  ) {
    showStep(
      "mode"
    );
    return;
  }

  /*
   * 担当者
   * ↓
   * 拠点
   */
  if (
    currentStep ===
    "user"
  ) {
    showStep(
      "location"
    );
    return;
  }

  /*
   * REC追加設定
   *
   * 前回設定を使用した場合は
   * 作業区分へ戻る。
   *
   * 前回設定を変更した場合は
   * 担当者へ戻る。
   */
  if (
    currentStep ===
    "rec"
  ) {
    if (
      wizardState.usePreviousSettings
    ) {
      showStep(
        "mode"
      );
      return;
    }

    showStep(
      "user"
    );
    return;
  }

  /*
   * 設定完了画面から戻る。
   */
  if (
    currentStep ===
    "complete"
  ) {
    stopReadOnlyScanner();

    showStep(
      wizardState.lastInputStep ||
      "user"
    );
  }
}

    function resetWizard() {
  stopReadOnlyScanner();

  wizardIrregularRecord = null;
  wizardIrregularDetected = null;
  wizardPostSendContext = null;
  wizardSelectedPhotos = [];
  wizardCurrentSlipInfo = null;
  wizardPendingPhotoSave = null;
  document.getElementById("wizardPostSendArea").hidden = true;
  document.getElementById("wizardIrregularArea").hidden = true;
  document.getElementById("wizardRecMemoArea").hidden = true;
  document.getElementById("wizardPhotoArea").hidden = true;
  document.getElementById("wizardPhotoTitleArea").hidden = true;

  scannedEntries = [];
  pendingWizardQuantityRecord = null;
  hideWizardQuantityInput();
  renderScannerResults();

  wizardState.receptionType = "";
  wizardState.receptionLabel = "";

  wizardState.mode = "";
  wizardState.modeLabel = "";

  wizardState.location = "";
  wizardState.user = "";

  wizardState.recTarget = "";
  wizardState.recDate = "";

  wizardState.previousLocation = "";
  wizardState.previousUser = "";

  wizardState.hasPreviousSettings =
    false;

  wizardState.usePreviousSettings =
    false;

  wizardState.lastInputStep =
    "user";

  wizardState.currentStep =
    "reception";

  document.getElementById(
    "wizardRecDate"
  ).value = "";

  document.getElementById(
    "wizardRecDateBox"
  ).classList.add(
    "hidden"
  );

  showStep(
    "reception"
  );
}
  document
  .querySelectorAll(
    "[data-reception-type]"
  )
  .forEach(
    function(button) {
      button.addEventListener(
        "click",
        function() {
          selectReceptionType(
            button.dataset
              .receptionType
          );
        }
      );
    }
  );

document
  .getElementById(
    "usePreviousSettingsButton"
  )
  .addEventListener(
    "click",
    usePreviousSettings
  );

document
  .getElementById(
    "changePreviousSettingsButton"
  )
  .addEventListener(
    "click",
    changePreviousSettings
  );

document
  .getElementById(
    "confirmRecButton"
  )
  .addEventListener(
    "click",
    confirmRecSettings
  );

document
  .getElementById(
    "headerBackButton"
  )
  .addEventListener(
    "click",
    goBackFromCurrentStep
  );

document
  .getElementById(
    "restartButton"
  )
  .addEventListener(
    "click",
    function() {
      if (
        wizardState.currentStep ===
        "reception"
      ) {
        resetWizard();
        return;
      }

      const confirmed =
        confirm(
          "設定を最初からやり直しますか？"
        );

      if (!confirmed) {
        return;
      }

      resetWizard();
    }
  );

document
  .getElementById(
    "cancelLastScanButton"
  )
  .addEventListener(
    "click",
    cancelLastScan
  );

document
  .getElementById(
    "resetAllScansButton"
  )
  .addEventListener(
    "click",
    resetAllScans
  );

document
  .getElementById(
    "addQuantityButton"
  )
  .addEventListener(
    "click",
    addWizardQuantityItem
  );

document
  .getElementById(
    "cancelQuantityButton"
  )
  .addEventListener(
    "click",
    cancelWizardQuantityInput
  );

document
  .getElementById(
    "wizardSendBatchButton"
  )
  .addEventListener(
    "click",
    sendWizardBatch
  );

document
  .getElementById("wizardCancelSendButton")
  .addEventListener("click", cancelLastSuccessfulSend);

document.getElementById("wizardPhotoCameraButton").addEventListener("click", function() {
  document.getElementById("wizardPhotoCameraInput").click();
});
document.getElementById("wizardPhotoLibraryButton").addEventListener("click", function() {
  document.getElementById("wizardPhotoLibraryInput").click();
});
document.getElementById("wizardPhotoCameraInput").addEventListener("change", function(event) {
  addWizardPhotos(event.target.files); event.target.value = "";
});
document.getElementById("wizardPhotoLibraryInput").addEventListener("change", function(event) {
  addWizardPhotos(event.target.files); event.target.value = "";
});
document.getElementById("wizardClearPhotosButton").addEventListener("click", clearWizardPhotos);
document.getElementById("wizardSavePhotosButton").addEventListener("click", prepareWizardPhotoSave);
document.getElementById("wizardSkipPhotosButton").addEventListener("click", function() {
  resumeWizardContinuousScan("写真なしで完了 ✔\n続けてQRを読み取れます");
});
document.getElementById("wizardConfirmPhotoTitleButton").addEventListener("click", confirmWizardPhotoTitle);
document.getElementById("wizardBackToPhotosButton").addEventListener("click", function() {
  wizardPendingPhotoSave = null;
  document.getElementById("wizardPhotoTitleArea").hidden = true;
  document.getElementById("wizardPhotoArea").hidden = false;
  scrollToWizardPostSend("wizardPhotoArea");
});
document.getElementById("wizardSaveRecMemoButton").addEventListener("click", saveWizardRecMemo);
document.getElementById("wizardSkipRecMemoButton").addEventListener("click", function() {
  resumeWizardContinuousScan("REC追記なしで完了 ✔\n続けてQRを読み取れます");
});
document.querySelectorAll('input[name="wizardIrregularNumberType"]').forEach(function(radio) {
  radio.addEventListener("change", updateWizardIrregularNumberType);
});
document.querySelectorAll('input[name="wizardIrregularSlipStatus"]').forEach(function(radio) {
  radio.addEventListener("change", updateWizardIrregularSlipGuide);
});
document.getElementById("wizardConfirmIrregularButton").addEventListener("click", confirmWizardIrregularInput);
document.getElementById("wizardCancelIrregularButton").addEventListener("click", function() {
  if (confirm("イレギュラー受付を取り消して最初に戻りますか？")) {
    finishWizardIrregularFlow();
  }
});

renderButtons();
resetWizard();
restoreLastSuccessfulSend();
initializeInventoryDataFoundation();
