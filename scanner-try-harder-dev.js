/* 開発版：状態なし機械でマスタ索引を汚染しないための互換パッチ */
(function() {
  "use strict";

  const DYNAMIC_MASTER_KEYS = [
    "現在状態",
    "最新状態",
    "状態",
    "作業区分",
    "status",
    "現在拠点",
    "保管拠点",
    "location",
    "最終作業者"
  ];

  function sanitizeManagedMasterItem(item) {
    if (!item || typeof item !== "object") return item;

    DYNAMIC_MASTER_KEYS.forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        delete item[key];
      }
    });

    return item;
  }

  function sanitizeManagedMasterItems(items) {
    if (!Array.isArray(items)) return items;
    items.forEach(sanitizeManagedMasterItem);
    return items;
  }

  /*
   * 既存端末のIndexedDBに、過去のローカル即時反映で
   * managedMasterItemsへ混入した動的状態が残っていても、
   * app.jsが読み取る前に自動除去する。
   */
  if (
    typeof IDBObjectStore !== "undefined" &&
    IDBObjectStore.prototype &&
    typeof IDBObjectStore.prototype.get === "function"
  ) {
    const originalGet = IDBObjectStore.prototype.get;

    IDBObjectStore.prototype.get = function() {
      const request = originalGet.apply(this, arguments);
      const storeName = String(this.name || "");

      if (storeName === "inventory" && request) {
        request.addEventListener(
          "success",
          function() {
            const cached = request.result;
            if (
              cached &&
              Array.isArray(cached.managedMasterItems)
            ) {
              sanitizeManagedMasterItems(
                cached.managedMasterItems
              );
            }
          },
          { once:true }
        );
      }

      return request;
    };

    /*
     * 今後保存するキャッシュにも汚染を残さない。
     * ランタイム中のオブジェクトは変更せず、保存用コピーだけを浄化する。
     */
    if (typeof IDBObjectStore.prototype.put === "function") {
      const originalPut = IDBObjectStore.prototype.put;

      IDBObjectStore.prototype.put = function(value) {
        let valueToStore = value;

        if (
          String(this.name || "") === "inventory" &&
          value &&
          typeof value === "object" &&
          Array.isArray(value.managedMasterItems)
        ) {
          valueToStore = Object.assign({}, value, {
            managedMasterItems:
              value.managedMasterItems.map(function(item) {
                return sanitizeManagedMasterItem(
                  Object.assign({}, item)
                );
              })
          });
        }

        const args = Array.prototype.slice.call(arguments);
        args[0] = valueToStore;
        return originalPut.apply(this, args);
      };
    }
  }

  /*
   * app.js読込後にgetLocalManagedItemを差し替える。
   * 状態Mapに対象がなくマスタ索引しか見つからない場合は、
   * マスタ本体を返さず、状態用コピーを作って該当Map/配列へ登録する。
   * これによりapplySuccessfulLocalState / restoreLocalStateが
   * managedMasterItemsを直接書き換える経路を遮断する。
   */
  setTimeout(function() {
    if (
      typeof getLocalManagedItem !== "function" ||
      typeof normalizeLookupKey !== "function" ||
      typeof normalizeManagedIdKey !== "function"
    ) {
      console.warn(
        "状態分離パッチ：app.jsの対象関数を確認できませんでした"
      );
      return;
    }

    getLocalManagedItem = function(qrText, managementType) {
      const key = normalizeLookupKey(qrText);
      const managedKey = normalizeManagedIdKey(qrText);
      const normalizedType = String(managementType || "");
      const targetMap =
        normalizedType === "simple"
          ? simpleItemMap
          : normalizedType === "rec"
            ? recItemMap
            : individualItemMap;
      const targetItems =
        normalizedType === "simple"
          ? simpleItems
          : normalizedType === "rec"
            ? recItems
            : individualItems;

      const existing =
        targetMap.get(key) ||
        targetMap.get(managedKey);

      if (existing) return existing;

      const masterItem =
        managedMasterItemMap.get(key) ||
        managedMasterItemMap.get(managedKey) ||
        null;

      if (!masterItem) return null;

      const stateItem = sanitizeManagedMasterItem(
        Object.assign({}, masterItem)
      );

      targetItems.push(stateItem);

      if (key) {
        targetMap.set(key, stateItem);
      }

      if (managedKey) {
        targetMap.set(managedKey, stateItem);
      }

      return stateItem;
    };

    console.log(
      "状態分離パッチ有効：マスタ索引と現在状態を分離しました"
    );
  }, 0);
})();
