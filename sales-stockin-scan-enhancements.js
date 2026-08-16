/* 販売品入庫QR：通常スキャナ相当のズーム・読取フィードバック・連続追加補助 */
(function() {
  let lastFeedbackText = "";
  let lastFeedbackAt = 0;

  function flashSalesSuccess() {
    const old = document.getElementById("salesScanSuccessFlashOverlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "salesScanSuccessFlashOverlay";
    Object.assign(overlay.style, {
      position:"fixed",
      left:"4px",
      top:"4px",
      right:"4px",
      bottom:"4px",
      border:"8px solid #19a34a",
      borderRadius:"12px",
      boxSizing:"border-box",
      pointerEvents:"none",
      zIndex:"999999",
      opacity:"1"
    });
    document.body.appendChild(overlay);

    setTimeout(function() {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.15s";
    }, 300);
    setTimeout(function() { overlay.remove(); }, 500);
  }

  function salesSuccessFeedback() {
    if (typeof playWizardScanBeep === "function") {
      playWizardScanBeep("success");
    }
    if (navigator.vibrate) navigator.vibrate(80);
    flashSalesSuccess();
  }

  function salesErrorFeedback() {
    if (typeof playWizardScanBeep === "function") {
      playWizardScanBeep("error");
    }
    if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 120]);
    if (typeof flashWizardScanError === "function") {
      flashWizardScanError();
    }
  }

  async function applySalesCameraSettings() {
    try {
      const video = document.getElementById("salesStockInQrVideo");
      const stream = video && video.srcObject;
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom) {
        await track.applyConstraints({
          advanced:[{
            zoom:Math.min(1.8, capabilities.zoom.max)
          }]
        });
      }

      try {
        await track.applyConstraints({advanced:[{focusMode:"continuous"}]});
      } catch (error) {
        console.log("販売品QR：継続フォーカス未対応", error);
      }
    } catch (error) {
      console.log("販売品QR：カメラ設定未対応", error);
    }
  }

  function scheduleSalesCameraSettings() {
    setTimeout(applySalesCameraSettings, 500);
    setTimeout(applySalesCameraSettings, 1200);
    setTimeout(applySalesCameraSettings, 2000);
  }

  function observeSalesQrStatus() {
    const status = document.getElementById("salesStockInQrStatus");
    if (!status) return;

    const observer = new MutationObserver(function() {
      const text = String(status.textContent || "").trim();
      const now = Date.now();

      if (text === lastFeedbackText && now - lastFeedbackAt < 900) return;

      if (text.includes("販売品QRを読み取りました")) {
        lastFeedbackText = text;
        lastFeedbackAt = now;
        salesSuccessFeedback();
        return;
      }

      if (
        text.includes("販売品QRではありません") ||
        text.includes("カメラ起動失敗")
      ) {
        lastFeedbackText = text;
        lastFeedbackAt = now;
        salesErrorFeedback();
      }
    });

    observer.observe(status, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }

  function wireSalesScannerEnhancements() {
    const startButton = document.getElementById("salesStockInQrStartButton");
    const addButton = document.getElementById("salesStockInQrAddButton");
    const status = document.getElementById("salesStockInQrStatus");

    if (!startButton || !addButton || !status) {
      setTimeout(wireSalesScannerEnhancements, 100);
      return;
    }

    startButton.addEventListener("click", function() {
      scheduleSalesCameraSettings();
    });

    /*
     * 販売品はQR読取後に数量入力が必要。
     * 「追加」が成功したら、自動で次のQR読取を開始する。
     * 操作順：QR → 数量 → 追加 → 自動再開 → 次のQR
     */
    addButton.addEventListener("click", function() {
      setTimeout(function() {
        const current = String(status.textContent || "").trim();
        const detected = document.getElementById("salesStockInQrDetected");
        const detectedText = detected ? String(detected.textContent || "").trim() : "";

        if (
          current.includes("必要なら続けてQRから追加できます") &&
          !detectedText
        ) {
          startButton.click();
        }
      }, 120);
    });

    observeSalesQrStatus();
  }

  wireSalesScannerEnhancements();
})();
