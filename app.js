"use strict";

const steps = [
  {
    key:"reception",
    title:"受付方法を選択",
    guide:"通常の入出庫またはイレギュラー受付を選んでください。",
    options:[
      {value:"通常", note:"QRを読み取って登録"},
      {value:"イレギュラー", note:"QRなし・例外対応"}
    ]
  },
  {
    key:"action",
    title:"作業区分を選択",
    guide:"今回行う作業を選んでください。",
    options:[
      {value:"出庫", note:"機械・商品の持ち出し"},
      {value:"返却", note:"機械・商品の返却"},
      {value:"出庫取消", note:"誤った出庫を取り消す"},
      {value:"拠点移動", note:"保管拠点を変更する"}
    ],
    compact:true
  },
  {
    key:"location",
    title:"実施拠点を選択",
    guide:"作業を行っている拠点を選んでください。",
    options:[
      {value:"本社", note:"本社倉庫"},
      {value:"三郷", note:"三郷倉庫"},
      {value:"MF", note:"メインファクトリー"}
    ]
  },
  {
    key:"operator",
    title:"担当者を選択",
    guide:"実際に作業を行う担当者を選んでください。",
    options:[
      {value:"奥", note:""},
      {value:"滝島", note:""},
      {value:"上野", note:""},
      {value:"見﨑", note:""},
      {value:"田之岡", note:""},
      {value:"篠塚", note:""},
      {value:"その他", note:""}
    ],
    compact:true
  }
];

const state = {
  stepIndex:0,
  selections:{}
};

const elements = {
  backButton:document.getElementById("backButton"),
  nextButton:document.getElementById("nextButton"),
  stepCount:document.getElementById("stepCount"),
  stepTitle:document.getElementById("stepTitle"),
  stepGuide:document.getElementById("stepGuide"),
  choices:document.getElementById("choices"),
  summary:document.getElementById("summary"),
  template:document.getElementById("choiceTemplate"),
  statusText:document.getElementById("statusText")
};

function render() {
  const step = steps[state.stepIndex];
  const selected = state.selections[step.key];

  elements.stepCount.textContent = `STEP ${state.stepIndex + 1} / ${steps.length}`;
  elements.stepTitle.textContent = step.title;
  elements.stepGuide.textContent = step.guide;
  elements.backButton.hidden = state.stepIndex === 0;
  elements.nextButton.disabled = !selected;
  elements.nextButton.textContent =
    state.stepIndex === steps.length - 1 ? "読取画面へ" : "次へ";
  elements.choices.className =
    `choice-grid${step.compact ? " is-compact" : ""}`;
  elements.choices.replaceChildren();

  step.options.forEach(option => {
    const button = elements.template.content.firstElementChild.cloneNode(true);
    button.dataset.value = option.value;
    button.classList.toggle("is-selected", selected === option.value);
    button.querySelector(".choice-title").textContent = option.value;
    button.querySelector(".choice-note").textContent = option.note;
    if (!option.note) button.querySelector(".choice-note").hidden = true;
    button.addEventListener("click", () => selectOption(step.key, option.value));
    elements.choices.append(button);
  });

  renderSummary();
}

function selectOption(key, value) {
  state.selections[key] = value;
  render();
}

function renderSummary() {
  elements.summary.replaceChildren();
  steps.forEach(step => {
    const value = state.selections[step.key];
    if (!value) return;

    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = step.title.replace("を選択", "");
    detail.textContent = value;
    elements.summary.append(term, detail);
  });
}

elements.nextButton.addEventListener("click", () => {
  if (state.stepIndex < steps.length - 1) {
    state.stepIndex += 1;
    render();
    window.scrollTo({top:0, behavior:"smooth"});
    return;
  }

  elements.statusText.textContent = "入口設定完了（カメラ接続は次工程）";
  alert("入口ウィザードの選択完了です。次にQR読取画面を接続します。");
});

elements.backButton.addEventListener("click", () => {
  if (state.stepIndex === 0) return;
  state.stepIndex -= 1;
  render();
});

render();
