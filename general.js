function makeForm(formType, formValue, formOption, id) {
  let formDom = "";
  if (formType == "input") {
    formDom = $(`<input type="text" class="form-control form-control-sm" placeholder="" aria-label="" value="${formValue}">`);
  } else if (formType == "textarea") {
    formDom = $(`<textarea class="form-control form-control-sm auto-resize" rows="1" placeholder="" value="">${formValue.replace(/▶/g, "\n")}</textarea>`);
  } else if (formType == "select") {
    formDom = $(`<div class="dropdown dropdown-option"><input type="text" class="form-control form-control-sm searchformss dropdown-toggle" data-toggle="dropdown" placeholder="" value="${formValue}"><div class="dropdown-menu"></div></div>`);
    let options = formOption.split('／');
    for (let i = 0; i < options.length; i++) {
      let optionDom = $(`<option>${options[i]}</option>`);
      formDom.find(".dropdown-menu:last").append(`<a class="dropdown-item hearing-item-option">${options[i]}</a>`);
    }
  } else if (formType == "checkbox") {
    formDom = $(`<div class="checkbox-wrap"></div>`);
    let formValueList = formValue.split("／")
    let options = formOption.split('／');
    for (let i = 0; i < options.length; i++) {
      let checked = (formValueList.includes(options[i])) ? 'checked="checked"' : "";
      let optionDom = $(`<div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="${id}-${options[i]}" value="${options[i]}" ${checked}><label class="form-check-label" for="${id}-${options[i]}">${options[i]}</label></div>`);
      formDom.append(optionDom);
    }
  } else if (formType == "radio") {
    formDom = $(`<div class="radio-wrap"></div>`);
    let options = formOption.split('／');
    for (let i = 0; i < options.length; i++) {
      let checked = (options[i] == formValue) ? 'checked="checked"' : "";
      let optionDom = $(`<div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="radio-${id}" id="${id}-${options[i]}" value="${options[i]}" ${checked}><label class="form-check-label" for="${id}-${options[i]}">${options[i]}</label></div>`);
      formDom.append(optionDom);
    }
  }
  return formDom;
}

function makeBRtag(string) {
  return string.replace(/▶/g, "<br>");
}


// シートの描画
function makeSheet(spec) {
  // メタ情報の描画
  let meta = spec["sheet-meta"];
  let metaDom = $("#basic-info-wrap");
  metaDom.find("#data-submissionid").val(meta["受付番号"]);
  metaDom.find("#data-submissiontime").val(meta["受付日"]);
  metaDom.find("#data-lastmodifiedtime").val(meta["最終更新日"]);
  metaDom.find("#data-creator").val(meta["作成者"]);
  metaDom.find("#data-version").val(meta["バージョン"]);
  metaDom.find("#data-progress").val(meta["進行状況"]);
  metaDom.find("#data-teacher").val(meta["授業者"]);
  metaDom.find("#data-librarian").val(meta["司書"]);
  metaDom.find("#data-sheetname").val(meta["シート名"]);
  metaDom.find("#data-sheetnote").val(meta["メモ"]);

  // 入力項目の描画
  let content = spec["sheet-content"];
  let contentDom = $("#hearing-item-wrap");
  for (let i = 0; i < content.length; i++) {
    let id = content[i]["id"];
    let parent = content[i]["parent"];
    let idsimple = id.split('-').slice(-1)[0];
    let level = content[i]["level"];
    let prefix = (level >= 2) ? "" : "";
    let type = content[i]["type"];
    let name = content[i]["name"];
    // 事前入力推奨項目のマーキング
    let prior = "";
    if (content[i]["form"]["prior"] == 1) {
      prior = '<span class="form-prior"></span>';
    }
    if (content[i]["form"]["prior"] == 1 && content[i]["type"] == "terminal") {
      prior += "*";
    }
    let eachDom = $(`<div id="${id}" data-parent="${parent}" class="hearing-each-wrap level-${level} ${type}"  data-name="${name}"><div class="hearing-each-name">${prefix}(${idsimple}) ${name}${prior}</div></div>`);
    if (type == "terminal") {
      eachDom.append($(`<div class="form-wrap"><div class="form-main"></div></div>`));
      let dependence = content[i]["form"]["dependence"];
      let description = content[i]["form"]["description"];
      let example = content[i]["form"]["example"];
      eachDom.attr("data-dependence", dependence);
      eachDom.attr("data-description", description);
      eachDom.attr("data-example", example);
      // 回答が記入済みかの判定
      let form_main_value = (content[i]["form"]["form-main-answer"] != "") ? content[i]["form"]["form-main-answer"] : content[i]["form"]["form-main-default"];
      let mainDom = makeForm(content[i]["form"]["form-main"], form_main_value, content[i]["form"]["form-main-option"], id);
      eachDom.find(".form-main").append(mainDom);
      if (content[i]["form"]["form-sub"] != "") {
        // 回答が記入済みかの判定
        let form_sub_value = (content[i]["form"]["form-sub-answer"] != "") ? content[i]["form"]["form-sub-answer"] : content[i]["form"]["form-sub-default"];
        let subDom = makeForm(content[i]["form"]["form-sub"], form_sub_value, "", id);
        subDom.attr("placeholder", "詳細");
        eachDom.find(".form-wrap").append($(`<div class="form-sub"></div>`));
        eachDom.find(".form-sub").append(subDom);
      }
    }
    contentDom.append(eachDom);
  }
}


$(document).ready(function () {
  let spec = JSON.parse($("#data-sheetspec").html());
  makeSheet(spec);
});


// textareaの動的リサイズ

//// リサイズ関数
function resizeTextarea() {
  $('textarea.auto-resize').each(function (index, element) {
    if ($(element).outerHeight() > this.scrollHeight) {
      $(element).height(1)
    }
    while ($(element).outerHeight() < this.scrollHeight) {
      $(element).height($(element).height() + 1)
    }
  })
}

//// 読み込み時
$(document).ready(function () {
  resizeTextarea();
});

//// 入力時
$(function () {
  $(document).on('change keyup keydown paste cut',
    'textarea.auto-resize', function () {
      if ($(this).outerHeight() > this.scrollHeight) {
        $(this).height(1)
      }
      while ($(this).outerHeight() < this.scrollHeight) {
        $(this).height($(this).height() + 1)
      }
    });
});


// ヒアリング項目マウスオーバー
$(document).on("mouseenter", ".form-control", function () {
  $(this).addClass("highlight");
});
$(document).on("mouseleave", ".form-control", function () {
  $(this).removeClass("highlight");
});


// ガイドの生成と移動
function makeGuide(id) {
  let content = JSON.parse($("#data-sheetspec").html())['sheet-content'];
  let targetDom = $("#" + id);
  let guideDom = $("#guide-wrap");
  let name = targetDom.attr("data-name");
  let description = targetDom.attr("data-description");
  let examples = targetDom.attr("data-example").split("／");
  let id_last = id.split('-').slice(-1)[0];
  let heading = `(${id_last}) ${name}`;
  let parent_id = targetDom.attr("data-parent");;

  guideDom.attr("data-id", id);

  // 見出しの作成
  while (parent_id != "root") {
    for (var i = 0; i < content.length; i++) {
      if (content[i]["id"] == parent_id) {
        let id_last = parent_id.split('-').slice(-1)[0];
        heading = `(${id_last}) ${content[i]["name"]} ＞ ${heading}`;
        parent_id = content[i]["parent"];
      }
    }
  }
  guideDom.find(".guide-label").html(heading.replace("に関する情報", ""));

  // 説明の作成
  guideDom.find(".guide-description").html(makeBRtag(description));

  // 例の作成
  guideDom.find(".example-wrap").empty();
  for (var i = 0; i < examples.length; i++) {
    if (examples[i] != "") {
      let example = examples[i].replace("[", '<span class="katsuyo-db badge badge-dark">').replace("]", '</span>');
      let exampleDom = $(`<div class="each-example"><span class="badge badge-secondary">例</span><div class="example">${makeBRtag(example)}</div></div>`);
      guideDom.find(".example-wrap").append(exampleDom);
    }
  }

  // 表示アニメーション
  $(".guide-item-wrap").css({ display: "none" });
  // $(".guide-item-wrap").removeClass("hidden");
  $(".guide-item-wrap").css({
    top: targetDom.offset().top - 180
  });
  $(".guide-item-wrap").fadeIn(700);
  // $(".guide-item-wrap").animate({
  //   top: targetDom.offset().top - 125
  // }, 500);

}

// ターミナル項目のクリック
$(document).on('click', '.terminal .hearing-each-name', function () {
  let targetDom = $(this);
  if (targetDom.hasClass("marker")) {
    targetDom.removeClass("marker");
    $(".guide-item-wrap").css({ display: "none" });

  } else {
    $(".marker").removeClass("marker");
    targetDom.addClass("marker");
    let id = targetDom.parent().attr("id");
    makeGuide(id);
  }
});

// input要素へのフォーカス時
$(document).on('focus', '.hearing-each-wrap .form-control', function () {
  let targetDom = $(this).parents(".terminal").children(".hearing-each-name");
  $(".marker").removeClass("marker");
  targetDom.addClass("marker");
  let id = targetDom.parent().attr("id");
  let currentGuideId = $("#guide-wrap").attr("data-id");
  if (id != currentGuideId) {
    makeGuide(id);
  }
  $(".guide-item-wrap").removeClass("hidden");
});

// checkbox要素クリック時
$(document).on('click', '.hearing-each-wrap .checkbox-wrap', function () {
  let targetDom = $(this).parents(".terminal").children(".hearing-each-name");
  $(".marker").removeClass("marker");
  targetDom.addClass("marker");
  let id = targetDom.parent().attr("id");
  let currentGuideId = $("#guide-wrap").attr("data-id");
  if (id != currentGuideId) {
    makeGuide(id);
  }
  $(".guide-item-wrap").removeClass("hidden");
});

// radio要素クリック時
$(document).on('click', '.hearing-each-wrap .radio-wrap', function () {
  let targetDom = $(this).parents(".terminal").children(".hearing-each-name");
  $(".marker").removeClass("marker");
  targetDom.addClass("marker");
  let id = targetDom.parent().attr("id");
  let currentGuideId = $("#guide-wrap").attr("data-id");
  if (id != currentGuideId) {
    makeGuide(id);
  }
  $(".guide-item-wrap").removeClass("hidden");
});


// ドロップダウン選択時
$(document).on('click', 'a.hearing-item-option', function () {
  let subItem = $(this).html();
  $(this).parents(".dropdown").find("input").val(subItem);

  // 依存関係の選択肢の動的な生成
  let id = $(this).parents(".hearing-each-wrap").attr("id");
  let dependence = JSON.parse($("#data-dependence").html());

  if (!dependence[id]) {
    return null;
  }

  let option = JSON.parse($("#data-option").html());

  for (let i = 0; i < dependence[id].length; i++) {
    let targetId = dependence[id][i][0];
    let queryIds = dependence[id][i][1];
    let keyString = "";

    for (let j = 0; j < queryIds.length; j++) {
      let input = $("#" + queryIds[j]).find("input").val();
      keyString += input
    }

    let targetDom = $("#" + targetId).find(".dropdown-menu");
    targetDom.empty();

    // keyStringがoptionでマッチする時のみ選択肢を生成
    if (!option[targetId][keyString]) {
      break;
    }
    let targetOptions = option[targetId][keyString].split("／");
    for (let i = 0; i < targetOptions.length; i++) {
      targetDom.append(`<a class="dropdown-item hearing-item-option">${targetOptions[i]}</a>`);
    }
  }

});

// 事前入力推奨項目のみの表示
$(document).on('click', '#display-prior', function () {
  $(".hearing-each-wrap").each(function (index, element) {
    let size = $(element).find(".form-prior").length;
    if (size == 0) {
      $(element).addClass("hidden");
    }
  });
  $(this).text("全項目");
  $(this).attr("id", "display-all");
  $(this).addClass("btn-warning");
  $(this).removeClass("btn-secondary");
});

// 事前入力推奨項目のみの表示
$(document).on('click', '#display-all', function () {
  $(".hearing-each-wrap").each(function (index, element) {
    $(element).removeClass("hidden");
  });
  $(this).text("* 事前入力項目");
  $(this).attr("id", "display-prior");
  $(this).addClass("btn-secondary");
  $(this).removeClass("btn-warning");
});

// シートの印刷
$(document).on('click', '#print-sheet', function () {
  //印刷したいエリアの取得
  let basicDom = $("#basic-info-wrap").clone();
  let sheetDom = $("#hearing-wrap").clone();

  //印刷用の要素「#print」を作成
  $('body').append('<div id="print"></div>');
  $('#print').append(basicDom);
  $('#print').append(sheetDom);

  //「#print」以外の要素に非表示用のclass「print-off」を指定
  $('body > :not(#print)').addClass('print-off');
  window.print();

  //window.print()の実行後、作成した「#print」と、非表示用のclass「print-off」を削除
  $('#print').remove();
  $('.print-off').removeClass('print-off');
});

// フォームの中身を取得する関数
function getFormAnswer(formDom) {
  let text = "";
  let input = formDom.find(".form-control").val();
  let checked = []
  formDom.find(".form-check-input:checked").each(function (index, element) {
    checked.push($(element).val());
  });
  text += input ? input : "";
  text += checked ? checked.join("／") : "";
  text = text.replace(/\r\n|\r|\n/g, "▶");
  return text;
}


// 既存シートの読み込み
$(document).on('click', '#show-user-sheet', function () {
  let result = window.confirm('現在表示中のシートの内容は上書きされますが、よろしいでしょうか。');
  if (result) {
    let file = document.getElementById('open-user-sheet').files[0];
    let file_content;
    console.log(file);
    reader = new FileReader();
    reader.onload = function (evt) {
      console.log("State: " + evt.target.readyState);
      console.log("Result: " + evt.target.result);

      let data = JSON.parse(evt.target.result);

      // Check if this is the new format with chat history
      if (data.version && data.sheetSpec) {
        // New format (with version and sheetSpec)
        file_content = data.sheetSpec;

        // Update spec first
        $("#data-sheetspec").text(JSON.stringify(file_content, null, 2));

        // Restore chat history if present
        if (data.chatHistory && data.chatHistory.length > 0) {
          if (typeof window.restoreChatHistory === 'function') {
            window.restoreChatHistory(data.chatHistory);
            console.log('Chat history restored:', data.chatHistory.length, 'messages');
          }
        }
      } else {
        // Old format (just the spec)
        file_content = data;
        $("#data-sheetspec").text(JSON.stringify(file_content, null, 2));
      }

      // Redraw sheet
      $("#hearing-item-wrap").empty();
      makeSheet(file_content);
      resizeTextarea();
    };
    reader.readAsText(file, "utf-8");
  }
});


// SpecのJSONを更新
function updateSpec() {
  let json_data = JSON.parse($("#data-sheetspec").text());

  // シート管理情報
  $(".sheet-info-each").each(function (index, element) {
    if ($(element).hasClass("input-group-text")) {
      let string = $(element).text().split("：").join("\t");
      tsv_data = tsv_data + string + "\r\n";
    } else {
      let label = $(element).attr("data-label");
      let value = $(element).val();
      json_data["sheet-meta"][label] = value;
    };
  });

  // 回答結果
  $(".hearing-each-wrap").each(function (index, element) {
    let id = $(element).attr("id");
    let mainDom = $(element).find(".form-main");
    let subDom = $(element).find(".form-sub");
    let answerText = getFormAnswer(mainDom);
    let subAnswerText = getFormAnswer(subDom);

    for (let i = 0; i < json_data['sheet-content'].length; i++) {
      const item = json_data['sheet-content'][i];
      let item_id = item['id'];
      if (id == item_id) {
        json_data['sheet-content'][i]['form']['form-main-answer'] = answerText;
        json_data['sheet-content'][i]['form']['form-sub-answer'] = subAnswerText;
        console.log(answerText);
      }
    }

    console.log(json_data);
    $("#data-sheetspec").text(JSON.stringify(json_data, null, 2));

  });
}


// シートの出力

//// TSV出力
$(document).on('click', '#output-sheet-tsv', function (e) {
  e.preventDefault();

  // TSVデータの用意
  // id, name, answer, description
  let tsv_data = "======打ち合わせシート======\r\n【シート管理情報】\r\n";

  // シート管理情報
  $(".sheet-info-each").each(function (index, element) {
    if ($(element).hasClass("input-group-text")) {
      let string = $(element).text().split("：").join("\t");
      tsv_data = tsv_data + string + "\r\n";
    } else {
      tsv_data = tsv_data + $(element).attr("data-label") + "\t" + $(element).val() + "\r\n";
    };
  });

  // 打ち合わせ項目入力内容
  tsv_data += "\r\n【打ち合わせ項目入力内容】\r\nID\t項目\t回答\t説明\r\n";
  $(".hearing-each-wrap").each(function (index, element) {
    let id = $(element).attr("id");
    let name = $(element).attr("data-name");
    let description = $(element).attr("data-description");
    if (!description) {
      description = "";
    }
    let mainDom = $(element).find(".form-main");
    let subDom = $(element).find(".form-sub");
    let answerText = getFormAnswer(mainDom);
    let subAnswerText = getFormAnswer(subDom);
    if (subAnswerText != "") {
      answerText += ": ";
      answerText += subAnswerText;
    }
    tsv_data = tsv_data + id + "\t" + name + "\t" + answerText + "\t" + description + "\r\n";
  });

  // BOM付きでBlobを作成（Safari対応）
  let bom = "\uFEFF";
  let content = bom + tsv_data;
  let blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8;' });

  // Safari対応：一時的なアンカー要素を作成してダウンロード
  let downloader = document.createElement('a');
  downloader.download = 'sheet.tsv';

  if (window.navigator.msSaveOrOpenBlob) {
    // IE10+
    window.navigator.msSaveBlob(blob, 'sheet.tsv');
  } else {
    // その他のブラウザ
    let url = window.URL.createObjectURL(blob);
    downloader.href = url;
    document.body.appendChild(downloader);
    downloader.click();
    document.body.removeChild(downloader);
    window.URL.revokeObjectURL(url);
  }

});


//// JSON出力
$(document).on('click', '#output-sheet-json', function (e) {
  e.preventDefault();

  // まずJSONを更新
  updateSpec();

  // シート管理情報
  let json_data = $("#data-sheetspec").text();

  // BOM付きでBlobを作成（Safari対応）
  let bom = "\uFEFF";
  let content = bom + json_data;
  let blob = new Blob([content], { type: 'application/json;charset=utf-8;' });

  // Safari対応：一時的なアンカー要素を作成してダウンロード
  let downloader = document.createElement('a');
  downloader.download = 'sheet.json';

  if (window.navigator.msSaveOrOpenBlob) {
    // IE10+
    window.navigator.msSaveBlob(blob, 'sheet.json');
  } else {
    // その他のブラウザ
    let url = window.URL.createObjectURL(blob);
    downloader.href = url;
    document.body.appendChild(downloader);
    downloader.click();
    document.body.removeChild(downloader);
    window.URL.revokeObjectURL(url);
  }

});

//// JSON出力（シート＋チャットログ）
$(document).on('click', '#output-sheet-chat-json', function (e) {
  e.preventDefault();

  // まずJSONを更新
  updateSpec();

  // シート管理情報
  let sheetSpec = JSON.parse($("#data-sheetspec").text());

  // チャット履歴を取得（ai-assistant.jsから）
  let chatHistory = [];
  if (typeof window.getChatHistory === 'function') {
    chatHistory = window.getChatHistory();
  }

  // 統合データを作成
  let exportData = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    sheetSpec: sheetSpec,
    chatHistory: chatHistory
  };

  let json_data = JSON.stringify(exportData, null, 2);

  // BOM付きでBlobを作成（Safari対応）
  let bom = "\uFEFF";
  let content = bom + json_data;
  let blob = new Blob([content], { type: 'application/json;charset=utf-8;' });

  // Safari対応：一時的なアンカー要素を作成してダウンロード
  let downloader = document.createElement('a');
  let filename = 'sheet-with-chat-' + new Date().toISOString().slice(0, 10) + '.json';
  downloader.download = filename;

  if (window.navigator.msSaveOrOpenBlob) {
    // IE10+
    window.navigator.msSaveBlob(blob, filename);
  } else {
    // その他のブラウザ
    let url = window.URL.createObjectURL(blob);
    downloader.href = url;
    document.body.appendChild(downloader);
    downloader.click();
    document.body.removeChild(downloader);
    window.URL.revokeObjectURL(url);
  }

});
