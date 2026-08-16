/*
 * イレギュラー受付：マスタ選択UI（開発版 v34）
 * 既存の直接入力・番号不明フローは残したまま、
 * 大分類 → 機種/品目 → 管理番号 の選択導線だけを追加する。
 * 送信ロジックは変更しない。
 */
(function() {
  const STYLE_ID = "irregularMasterPickerDevStyle";
  const ROOT_ID = "irregularMasterPickerDev";

  let pickerState = {
    category:"",
    item:null
  };

  function value(item, keys) {
    if (!item) return "";
    if (typeof getFirstItemValue === "function") {
      const found = getFirstItemValue(item, keys);
      if (found !== undefined && found !== null && found !== "") return found;
    }
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        const found = item[key];
        if (found !== undefined && found !== null && found !== "") return found;
      }
    }
    return "";
  }

  function normalize(text) {
    return String(text == null ? "" : text).trim();
  }

  function majorCategoryOf(item) {
    return normalize(value(item, [
      "大分類",
      "majorCategory",
      "major_category",
      "categoryMajor"
    ]));
  }

  function managementIdOf(item) {
    return normalize(value(item, [
      "管理ID",
      "管理番号",
      "managedId",
      "managementId",
      "machineId",
      "id"
    ]));
  }

  function machineCodeOf(item) {
    const explicit = normalize(value(item, [
      "識別文字",
      "機種コード",
      "machineCode",
      "modelCode",
      "code"
    ]));
    if (explicit) return explicit;

    const managedId = managementIdOf(item);
    if (managedId && managedId.includes("-")) {
      return managedId.split("-")[0];
    }

    const machine = normalize(value(item, ["機種"]));
    if (machine && /^[A-Za-z0-9]+$/.test(machine)) return machine;
    return "";
  }

  function itemCodeOf(item) {
    return normalize(value(item, [
      "品目コード",
      "itemCode",
      "商品コード",
      "コード",
      "code"
    ]));
  }

  function displayNameOf(item, fallback) {
    return normalize(value(item, [
      "表示用",
      "表示名",
      "機種名",
      "品名",
      "商品名",
      "名称",
      "displayName",
      "name"
    ])) || fallback || "名称未設定";
  }

  function orderOf(item) {
    const raw = Number(value(item, ["並び順", "sortOrder", "order"]));
    return Number.isFinite(raw) ? raw : 999999;
  }

  function machineSourceArrays() {
    const result = [];
    if (typeof managedMasterItems !== "undefined" && Array.isArray(managedMasterItems)) result.push(...managedMasterItems);
    if (typeof individualItems !== "undefined" && Array.isArray(individualItems)) result.push(...individualItems);
    if (typeof simpleItems !== "undefined" && Array.isArray(simpleItems)) result.push(...simpleItems);
    if (typeof recItems !== "undefined" && Array.isArray(recItems)) result.push(...recItems);
    return result;
  }

  function machineMasterChoices() {
    const map = new Map();
    machineSourceArrays().forEach(function(item) {
      const category = majorCategoryOf(item);
      const code = machineCodeOf(item);
      if (!category || !code) return;
      const key = category + "\u0000" + code;
      const current = map.get(key);
      const candidate = {
        type:"machine",
        category:category,
        code:code,
        name:displayNameOf(item, code),
        order:orderOf(item),
        source:item
      };
      if (!current || candidate.order < current.order) map.set(key, candidate);
    });
    return Array.from(map.values());
  }

  function quantityMasterChoices() {
    if (typeof quantityItems === "undefined" || !Array.isArray(quantityItems)) return [];
    return quantityItems.map(function(item) {
      const category = majorCategoryOf(item);
      const code = itemCodeOf(item);
      if (!category || !code) return null;
      return {
        type:"quantity",
        category:category,
        code:code,
        name:displayNameOf(item, code),
        order:orderOf(item),
        unit:normalize(value(item, ["単位", "unit"])) || "個",
        source:item
      };
    }).filter(Boolean);
  }

  function allChoices() {
    return machineMasterChoices().concat(quantityMasterChoices());
  }

  function managedIdsForMachine(code) {
    const seen = new Set();
    const rows = [];
    const arrays = [];
    if (typeof individualItems !== "undefined" && Array.isArray(individualItems)) arrays.push(...individualItems);
    if (typeof simpleItems !== "undefined" && Array.isArray(simpleItems)) arrays.push(...simpleItems);
    if (typeof recItems !== "undefined" && Array.isArray(recItems)) arrays.push(...recItems);

    arrays.forEach(function(item) {
      const itemCode = machineCodeOf(item);
      const managedId = managementIdOf(item);
      if (itemCode !== code || !managedId || seen.has(managedId)) return;
      seen.add(managedId);
      rows.push({
        managedId:managedId,
        status:normalize(value(item, ["状態", "管理状態", "status", "currentStatus"])),
        location:normalize(value(item, ["拠点", "現在拠点", "location", "currentLocation"]))
      });
    });

    rows.sort(function(a, b) {
      return a.managedId.localeCompare(b.managedId, "ja", {numeric:true});
    });
    return rows;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        margin:12px 0 18px;
        padding:14px;
        border:1px solid #d8dee6;
        border-radius:14px;
        background:#f8fafc;
      }
      #${ROOT_ID} .irregularMasterLead {
        margin:0 0 10px;
        font-size:14px;
        line-height:1.55;
        color:#475569;
      }
      #${ROOT_ID} .irregularMasterOpen {
        width:100%;
        min-height:58px;
        font-weight:800;
      }
      #${ROOT_ID} .irregularMasterOpen small {
        display:block;
        margin-top:3px;
        font-size:12px;
        font-weight:600;
        opacity:.72;
      }
      #${ROOT_ID} .irregularMasterPanel[hidden] { display:none !important; }
      #${ROOT_ID} .irregularMasterPanel { margin-top:12px; }
      #${ROOT_ID} .irregularMasterBreadcrumb {
        padding:9px 10px;
        border-radius:10px;
        background:#fff;
        font-size:13px;
        font-weight:700;
        line-height:1.45;
      }
      #${ROOT_ID} .irregularMasterGrid {
        display:grid;
        grid-template-columns:1fr;
        gap:8px;
        margin-top:10px;
      }
      #${ROOT_ID} .irregularMasterChoice {
        width:100%;
        min-height:52px;
        padding:10px 12px;
        text-align:left;
        border:1px solid #cbd5e1;
        border-radius:11px;
        background:#fff;
        color:#0f172a;
        font-size:15px;
        font-weight:750;
      }
      #${ROOT_ID} .irregularMasterChoice small {
        display:block;
        margin-top:3px;
        color:#64748b;
        font-size:12px;
        font-weight:600;
      }
      #${ROOT_ID} .irregularMasterBack {
        width:100%;
        margin-top:10px;
      }
      #${ROOT_ID} .irregularMasterNotice {
        margin-top:10px;
        padding:11px 12px;
        border-radius:10px;
        background:#fff7ed;
        color:#9a3412;
        font-size:13px;
        line-height:1.55;
      }
      #${ROOT_ID} .irregularMasterSet {
        margin-top:10px;
        padding:10px 12px;
        border-radius:10px;
        background:#ecfdf5;
        color:#166534;
        font-size:13px;
        font-weight:800;
        line-height:1.5;
      }
    `;
    document.head.appendChild(style);
  }

  function setExistingNumber(valueToSet) {
    const input = document.getElementById("wizardIrregularNumber");
    if (!input) return false;

    const radio = document.querySelector('input[name="wizardIrregularNumberType"][value="入力"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", {bubbles:true}));
    }

    input.disabled = false;
    input.value = valueToSet;
    input.dispatchEvent(new Event("input", {bubbles:true}));
    input.dispatchEvent(new Event("change", {bubbles:true}));
    input.scrollIntoView({behavior:"smooth", block:"center"});
    input.focus({preventScroll:true});
    return true;
  }

  function root() {
    return document.getElementById(ROOT_ID);
  }

  function panel() {
    return document.getElementById("irregularMasterPickerPanel");
  }

  function breadcrumb(text) {
    const el = document.getElementById("irregularMasterBreadcrumb");
    if (el) el.textContent = text || "マスタから選択";
  }

  function grid() {
    return document.getElementById("irregularMasterGrid");
  }

  function notice(text) {
    const el = document.getElementById("irregularMasterNotice");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
  }

  function setMessage(text) {
    const el = document.getElementById("irregularMasterSetMessage");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
  }

  function makeChoice(label, sub, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "irregularMasterChoice";
    button.textContent = label;
    if (sub) {
      const small = document.createElement("small");
      small.textContent = sub;
      button.appendChild(small);
    }
    button.addEventListener("click", onClick);
    return button;
  }

  function renderCategories() {
    pickerState.category = "";
    pickerState.item = null;
    setMessage("");
    breadcrumb("大分類を選んでください");
    notice("");

    const target = grid();
    if (!target) return;
    target.replaceChildren();

    const choices = allChoices();
    const categories = Array.from(new Set(choices.map(function(item) {
      return item.category;
    }).filter(Boolean)));

    categories.sort(function(a, b) {
      const aOrder = Math.min.apply(null, choices.filter(function(x) { return x.category === a; }).map(function(x) { return x.order; }));
      const bOrder = Math.min.apply(null, choices.filter(function(x) { return x.category === b; }).map(function(x) { return x.order; }));
      return aOrder - bOrder || a.localeCompare(b, "ja");
    });

    if (!categories.length) {
      notice("大分類データがまだアプリへ届いていません。次のGAS更新で機種マスタ／数量管理品マスタの「大分類」を初期データへ追加すると、この画面に分類ボタンが表示されます。今は下の直接入力をそのまま使用できます。");
      return;
    }

    categories.forEach(function(category) {
      const count = choices.filter(function(item) { return item.category === category; }).length;
      target.appendChild(makeChoice(category, count + "件", function() {
        renderItems(category);
      }));
    });
  }

  function renderItems(category) {
    pickerState.category = category;
    pickerState.item = null;
    setMessage("");
    breadcrumb(category + " → 機種・品目を選択");
    notice("");

    const target = grid();
    target.replaceChildren();

    const choices = allChoices().filter(function(item) {
      return item.category === category;
    }).sort(function(a, b) {
      return a.order - b.order || a.name.localeCompare(b.name, "ja", {numeric:true});
    });

    choices.forEach(function(item) {
      target.appendChild(makeChoice(
        item.name,
        item.code + (item.type === "quantity" ? " ／ 数量管理" : ""),
        function() {
          if (item.type === "quantity") {
            setExistingNumber(item.code);
            setMessage(item.name + " を入力欄へセットしました。数量を入力して既存の確認ボタンへ進んでください。");
            return;
          }
          renderManagedIds(item);
        }
      ));
    });

    const back = document.createElement("button");
    back.type = "button";
    back.className = "secondaryButton irregularMasterBack";
    back.textContent = "大分類へ戻る";
    back.addEventListener("click", renderCategories);
    target.appendChild(back);
  }

  function renderManagedIds(item) {
    pickerState.item = item;
    setMessage("");
    breadcrumb(item.category + " → " + item.name + " → 管理番号");
    notice("");

    const target = grid();
    target.replaceChildren();
    const rows = managedIdsForMachine(item.code);

    if (!rows.length) {
      notice("この機種の管理番号候補を現在の初期データから取得できませんでした。直接入力を使用するか、GAS側のマスタデータ接続後に再確認してください。");
    } else {
      rows.forEach(function(row) {
        const details = [row.location, row.status].filter(Boolean).join(" ／ ");
        target.appendChild(makeChoice(row.managedId, details, function() {
          setExistingNumber(row.managedId);
          setMessage(row.managedId + " を入力欄へセットしました。既存の確認ボタンへ進んでください。");
        }));
      });
    }

    const back = document.createElement("button");
    back.type = "button";
    back.className = "secondaryButton irregularMasterBack";
    back.textContent = item.category + "の機種一覧へ戻る";
    back.addEventListener("click", function() {
      renderItems(item.category);
    });
    target.appendChild(back);
  }

  function openPicker() {
    const targetPanel = panel();
    if (!targetPanel) return;
    targetPanel.hidden = false;
    renderCategories();
    targetPanel.scrollIntoView({behavior:"smooth", block:"start"});
  }

  function closePicker() {
    const targetPanel = panel();
    if (!targetPanel) return;
    targetPanel.hidden = true;
    pickerState = {category:"", item:null};
  }

  function injectUi() {
    if (root()) return;
    const irregularArea = document.getElementById("wizardIrregularArea");
    if (!irregularArea) return;

    const container = document.createElement("div");
    container.id = ROOT_ID;
    container.innerHTML = `
      <p class="irregularMasterLead">QRがない・読めない場合は、マスタから対象を選べます。直接入力と番号不明も下に残しています。</p>
      <button type="button" id="irregularMasterPickerOpenButton" class="choiceButton irregularMasterOpen">
        マスタから選ぶ
        <small>大分類 → 機種・品目 → 管理番号</small>
      </button>
      <div id="irregularMasterPickerPanel" class="irregularMasterPanel" hidden>
        <div id="irregularMasterBreadcrumb" class="irregularMasterBreadcrumb">大分類を選んでください</div>
        <div id="irregularMasterNotice" class="irregularMasterNotice" hidden></div>
        <div id="irregularMasterSetMessage" class="irregularMasterSet" hidden></div>
        <div id="irregularMasterGrid" class="irregularMasterGrid"></div>
        <button type="button" id="irregularMasterPickerCloseButton" class="secondaryButton irregularMasterBack">マスタ選択を閉じる</button>
      </div>
    `;

    const heading = irregularArea.querySelector("h3");
    if (heading && heading.nextSibling) {
      irregularArea.insertBefore(container, heading.nextSibling);
    } else {
      irregularArea.prepend(container);
    }

    document.getElementById("irregularMasterPickerOpenButton").addEventListener("click", openPicker);
    document.getElementById("irregularMasterPickerCloseButton").addEventListener("click", closePicker);
  }

  function watchIrregularArea() {
    const irregularArea = document.getElementById("wizardIrregularArea");
    if (!irregularArea) return;
    const observer = new MutationObserver(function() {
      if (!irregularArea.hidden && panel() && !panel().hidden) {
        renderCategories();
      }
    });
    observer.observe(irregularArea, {attributes:true, attributeFilter:["hidden"]});
  }

  function init() {
    injectStyle();
    injectUi();
    watchIrregularArea();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();
