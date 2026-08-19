/*
 * 開発版 v78：Gemini伝票解析を「全体画像1回」に固定するA/Bテスト用モジュール。
 *
 * - 上部50%の先行解析を停止する。
 * - 全体画像（長辺1600px / JPEG 0.85）を1回だけGeminiへ送る。
 * - 解析結果が空・エラーでも2回目のGemini呼び出しは行わない。
 * - GAS・本番版は変更しない。
 * - gemini-timing-dev.js と併用し、成功時のAPI所要時間を画面表示する。
 */
(function() {
  "use strict";

  if (window.__geminiWholeImageDevInstalled) return;
  window.__geminiWholeImageDevInstalled = true;

  async function analyzeWholeImageOnce(file, photoType) {
    startAnimatedDots("wizardPhotoPreview", "伝票情報を確認しています");

    try {
      const profile = {
        label:"全体1回",
        cropRatio:1,
        maxSide:1600,
        quality:0.85
      };

      const photoBase64 =
        await makeWizardSlipAnalysisImage(
          file,
          profile
        );

      /*
       * A/BテストではGemini呼び出し回数を厳密に1回へ固定するため、
       * fetchWithRetry() は使わない。
       */
      const response = await fetch(GAS_URL, {
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
        throw new Error(
          "伝票解析結果を読み取れませんでした\n" +
          text.slice(0, 200)
        );
      }

      if (!response.ok || !result || result.ok !== true) {
        throw new Error(
          result && result.message
            ? result.message
            : "伝票情報を取得できませんでした"
        );
      }

      const customerName =
        sanitizeWizardPhotoTitlePart(
          result.customerName
        );

      const siteName =
        sanitizeWizardPhotoTitlePart(
          result.siteName
        );

      if (!customerName && !siteName) {
        throw new Error(
          "顧客名・現場名を判定できませんでした"
        );
      }

      wizardCurrentSlipInfo = {
        customerName:customerName,
        siteName:siteName,
        originalSiteName:siteName,
        acquisitionMethod:
          result.acquisitionMethod || "ai_ocr",
        siteNameEdited:false,
        confirmedTitle:
          buildWizardPhotoTitle(
            customerName,
            siteName
          ),
        acquiredAt:new Date().toISOString(),
        analysisRegion:profile.label,
        geminiFetchMs:Number(
          result.geminiFetchMs || 0
        )
      };

      return wizardCurrentSlipInfo;

    } catch (error) {
      console.warn(
        "伝票情報取得失敗（全体1回テスト）",
        error
      );

      alert(
        "伝票情報の解析に失敗しました\n\n" +
        (error.message || String(error)) +
        "\n\n写真保存はこのまま続行できます。"
      );

      wizardCurrentSlipInfo = null;
      return null;

    } finally {
      stopAnimatedDots("wizardPhotoPreview");
    }
  }

  /*
   * app.js の既存2段階解析関数を開発版だけ差し替える。
   * classic script のトップレベル関数なので window 経由で上書き可能。
   */
  window.analyzeWizardSlipPhoto =
    analyzeWholeImageOnce;

  console.info(
    "開発版：Gemini全体画像1回テスト v78 読込完了"
  );
})();
