/*
 * イレギュラー受付：登録可否共通ガード（開発版 v42）
 *
 * GASは変更しない。
 * QR・直接入力・マスタ選択で共通利用できる登録可否判定の入口を維持する。
 * マスタ選択では複数選択した管理番号を1件ずつ同じ判定へ通す。
 * 簡易個体だけ、4桁ゼロ埋めIDと個体マスタの正式IDを照合して現在状態を参照する。
 */
(function() {
  "use strict";

  function normalize(text) {
    return String(text == null ? "" : text).trim();
  }

  function currentMode() {
    const mode = document.getElementById("mode");
    return normalize(mode && mode.value);
  }

  function getFirstValue(item, keys) {
    if (!item) return "";
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        const found = item[key];
        if (found !== undefined && found !== null && found !== "") return normalize(found);
      }
    }
    return "";
  }

  function managedIdOf(item) {
    return getFirstValue(item,["管理ID","管理番号","managedId","managementId","machineId","id"]);
  }

  function stateOf(item) {
    return getFirstValue(item,["現在状態","最新状態","状態","管理状態","作業区分","status","currentStatus"]);
  }

  function allManagedSourceItems() {
    const rows = [];
    try {
      /* 通常IDの完全一致は従来どおり */
      if (typeof simpleItems !== "undefined" && Array.isArray(simpleItems)) rows.push(...simpleItems);
      if (typeof individualItems !== "undefined" && Array.isArray(individualItems)) rows.push(...individualItems);
      if (typeof recItems !== "undefined" && Array.isArray(recItems)) rows.push(...recItems);
      if (typeof managedMasterItems !== "undefined" && Array.isArray(managedMasterItems)) rows.push(...managedMasterItems);
    } catch (error) {
      console.warn("開発版ガード：現在状態データの参照に失敗しました",error);
    }
    return rows;
  }

  function findManagedItem(managedId) {
    const target = normalize(managedId);
    if (!target) return null;

    /* まず正式管理番号の完全一致。個体・RECはこの経路だけを使う。 */
    const exact = allManagedSourceItems().find(function(item){
      return managedIdOf(item) === target;
    }) || null;

    /*
     * 完全一致が軽量マスタしか持っていない場合でも、簡易個体の4桁状態行が
     * 対応していれば状態判定はそちらを優先する。
     */
    try {
      if (typeof window.getIrregularSimpleAliasRecord === "function") {
        const alias = window.getIrregularSimpleAliasRecord(target);
        if (alias && alias.item) return alias.item;
      }
    } catch (error) {
      console.warn("開発版ガード：簡易個体IDの照合に失敗しました",error);
    }

    return exact;
  }

  function queueContainsManagedId(managedId) {
    const target = normalize(managedId);
    if (!target) return false;
    const list = document.getElementById("irregularMasterQueueList");
    if (!list) return false;
    return Array.from(list.querySelectorAll(".irregularMasterQueueMain")).some(function(el){
      return normalize(el.textContent) === target;
    });
  }

  function recentWorkBlocked(managedId,mode) {
    try {
      if (typeof isRecentSuccessfulWork === "function") return Boolean(isRecentSuccessfulWork(managedId,mode));
    } catch (error) {
      console.warn("開発版ガード：直近送信判定を参照できませんでした",error);
    }
    return false;
  }

  function validateTransition(currentState,mode) {
    try {
      if (typeof validateStateTransition === "function") return validateStateTransition(currentState,mode);
    } catch (error) {
      console.warn("開発版ガード：既存状態遷移判定を参照できませんでした",error);
    }
    return {ok:true,warning:true,message:"既存の状態遷移判定を取得できないため、開発版では判定を保留しました。"};
  }

  function canAddIrregularItem(record,options) {
    const data = record || {};
    const config = options || {};
    const mode = normalize(config.mode || currentMode());

    if (data.type === "quantity") {
      return {ok:true,warning:false,code:"QUANTITY_OK",message:""};
    }

    const managedId = normalize(data.managedId);
    if (!managedId) {
      return {ok:false,warning:false,code:"MANAGED_ID_REQUIRED",message:"管理番号を選択してください。"};
    }

    if (!config.skipQueueCheck && queueContainsManagedId(managedId)) {
      return {ok:false,warning:false,code:"DUPLICATE_IN_QUEUE",message:managedId+" はすでに追加済みです。"};
    }

    if (mode && recentWorkBlocked(managedId,mode)) {
      return {
        ok:false,warning:false,code:"RECENT_SUCCESS_DUPLICATE",
        message:managedId+" は直近に同じ作業で送信済みです。\n二重登録防止のため追加できません。"
      };
    }

    const item = findManagedItem(managedId);
    if (!item) {
      return {
        ok:true,warning:true,code:"STATE_NOT_FOUND",
        message:managedId+" の現在状態を取得できませんでした。"
      };
    }

    const currentState = stateOf(item);
    const transition = validateTransition(currentState,mode);

    return {
      ok:Boolean(transition && transition.ok),
      warning:Boolean(transition && transition.warning),
      code:transition && transition.ok ? "STATE_OK" : "STATE_BLOCKED",
      message:normalize(transition && transition.message),
      managedId:managedId,
      mode:mode,
      currentState:currentState
    };
  }

  window.canAddIrregularItem = canAddIrregularItem;

  function selectedManagedIdsFromUi(button) {
    if (!button) return [];
    try {
      const parsed = JSON.parse(button.dataset.managedIds || "[]");
      if (Array.isArray(parsed)) return parsed.map(normalize).filter(Boolean);
    } catch (error) {
      console.warn("開発版ガード：選択管理番号の解析に失敗しました",error);
    }
    return [];
  }

  function showBlocked(result) {
    alert(result.message || "この内容は追加できません。");
  }

  function showWarnings(results) {
    const messages = results.map(function(result){return result.message}).filter(Boolean);
    if (!messages.length) return;
    const notice = document.getElementById("irregularMasterNotice");
    if (!notice) return;
    notice.textContent = messages.join("\n");
    notice.hidden = false;
  }

  function guardMachineAdd(event) {
    const button = event.target && event.target.closest
      ? event.target.closest("#irregularMasterAddMachine")
      : null;
    if (!button) return;

    const ids = selectedManagedIdsFromUi(button);
    if (!ids.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showBlocked({message:"管理番号を選択してください。"});
      return;
    }

    const results = ids.map(function(managedId){
      return canAddIrregularItem({type:"machine",managedId:managedId});
    });

    const blocked = results.find(function(result){return !result.ok});
    if (blocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showBlocked(blocked);
      return;
    }

    showWarnings(results.filter(function(result){return result.warning}));
  }

  document.addEventListener("click",guardMachineAdd,true);
  console.info("開発版：イレギュラー受付 共通登録ガード v42 読込完了");
})();
