// カスタマイズモード管理
let isCustomizationMode = false;

// カスタマイズモードの切り替え
function toggleCustomizationMode() {
	isCustomizationMode = !isCustomizationMode;

	if (isCustomizationMode) {
		enterCustomizationMode();
	} else {
		exitCustomizationMode();
	}
}

// カスタマイズモードに入る
function enterCustomizationMode() {
	console.log("Entering customization mode");

	// ボタンのスタイルを変更
	$('#toggle-customization-mode')
		.removeClass('btn-warning')
		.addClass('btn-success')
		.html('<i class="fas fa-check"></i> 通常モードに戻る');

	// all-wrapにカスタマイズモードクラスを追加
	$('#all-wrap').addClass('customization-mode');

	// 入れ子構造でシートを描画
	let spec = JSON.parse($('#data-sheetspec').html());
	makeNestedSheet(spec);

	// ドラッグ&ドロップを有効化
	initializeDragAndDrop();
}

// カスタマイズモードを終了
function exitCustomizationMode() {
	console.log("Exiting customization mode");

	// ボタンのスタイルを戻す
	$('#toggle-customization-mode')
		.removeClass('btn-success')
		.addClass('btn-warning')
		.html('<i class="fas fa-edit"></i> カスタマイズモード');

	// カスタマイズモードクラスを削除
	$('#all-wrap').removeClass('customization-mode');

	// カスタマイズコントロールを削除
	$('.customization-controls').remove();

	// 入力フォームを表示
	$('.form-wrap').show();

	// ドラッグ&ドロップを無効化
	destroyDragAndDrop();

	// シートを再描画（通常モード）
	$('#hearing-item-wrap').empty();
	let spec = JSON.parse($('#data-sheetspec').html());
	makeSheet(spec);
	resizeTextarea();
}

// 入れ子構造でシートを作成
function makeNestedSheet(spec) {
	$('#hearing-item-wrap').empty();
	let content = spec['sheet-content'];

	// 親子関係のマップを作成
	let childrenMap = {};
	content.forEach(item => {
		if (!childrenMap[item.parent]) {
			childrenMap[item.parent] = [];
		}
		childrenMap[item.parent].push(item);
	});

	// 再帰的にDOMを作成する関数
	function createItemDom(parentId) {
		let items = childrenMap[parentId];
		if (!items) return null;

		let container = $('<div class="children-wrap"></div>');
		if (parentId === 'root') {
			container = $('#hearing-item-wrap'); // ルートは直接追加
		}

		items.forEach(item => {
			let id = item.id;
			let level = item.level;
			let type = item.type;
			let name = item.name;

			// 既存のHTML生成ロジックを再利用（簡略化）
			// 本来ならmakeSheetの一部を切り出して再利用すべきだが、ここではカスタマイズモード専用に構築
			let prefix = "";
			let eachDom = $(`<div id="${id}" data-parent="${item.parent}" class="hearing-each-wrap level-${level} ${type}" data-name="${name}">
				<div class="hearing-each-name">
					${prefix}(${id.split('-').slice(-1)[0]}) ${name}
				</div>
			</div>`);

			// カスタマイズコントロールを追加
			addCustomizationControls(eachDom);

			// 子要素のコンテナを追加
			if (childrenMap[id]) {
				let childrenDom = createItemDom(id);
				if (childrenDom) {
					eachDom.append(childrenDom);
				}
			}

			container.append(eachDom);
		});

		return container;
	}

	createItemDom('root');
	$('.form-wrap').hide(); // フォームは隠す
}

// 項目にカスタマイズコントロールを追加
function addCustomizationControls(itemDom) {
	let id = itemDom.attr('id');

	// レベル3の場合は子項目追加ボタンを表示しない
	let isMaxLevel = itemDom.hasClass('level-3');
	let addChildBtn = isMaxLevel ? '' : `
      <button class="btn btn-sm btn-success add-child-btn" data-id="${id}" title="子項目を追加">
        <i class="fas fa-plus"></i> 子項目
      </button>
	`;

	let controls = $(`
    <div class="customization-controls">
      <span class="drag-handle" title="ドラッグして移動">
        <i class="fas fa-grip-vertical"></i>
      </span>
      <button class="btn btn-sm btn-info edit-item-btn" data-id="${id}" title="編集">
        <i class="fas fa-edit"></i> 編集
      </button>
      ${addChildBtn}
      <button class="btn btn-sm btn-danger delete-item-btn" data-id="${id}" title="削除">
        <i class="fas fa-trash"></i> 削除
      </button>
    </div>
  `);

	// nameの後ろに追加
	itemDom.find('.hearing-each-name').first().after(controls);
}

// ドラッグ&ドロップの初期化
let sortableInstances = [];

function initializeDragAndDrop() {
	// 既存のインスタンスを破棄
	destroyDragAndDrop();

	// ルートレベル
	let rootEl = document.getElementById('hearing-item-wrap');
	if (rootEl) {
		createSortable(rootEl);
	}

	// 子レベル（すべての.children-wrap）
	let childWraps = document.getElementsByClassName('children-wrap');
	for (let i = 0; i < childWraps.length; i++) {
		createSortable(childWraps[i]);
	}
}

function createSortable(el) {
	let sortable = Sortable.create(el, {
		animation: 150,
		handle: '.drag-handle',
		ghostClass: 'sortable-ghost',
		dragClass: 'sortable-drag',
		group: {
			name: 'nested',
			pull: false, // 他のリストへの移動を禁止
			put: false   // 他のリストからの受け入れを禁止
		},
		onEnd: function (evt) {
			reassignIds();
			// refreshSheetは呼ばない（DOM構造が変わるため、Sortableが混乱する可能性がある）
			// 必要なら再描画ではなく、ID表示のみ更新する処理を入れる
			// ここではシンプルにデータ更新のみ行い、ユーザーが何かアクションしたときに再描画される
			refreshIdsInDom();
		}
	});
	sortableInstances.push(sortable);
}

// ドラッグ&ドロップの無効化
function destroyDragAndDrop() {
	sortableInstances.forEach(instance => {
		if (instance) {
			instance.destroy();
		}
	});
	sortableInstances = [];
}

// IDの自動振り直し（DOM構造からSpecを再構築）
function reassignIds() {
	let spec = JSON.parse($('#data-sheetspec').html());
	let originalContent = spec['sheet-content']; // フォームデータなどを保持するために参照

	let newContent = [];
	let idCounters = {};

	// DOMをトラバースして順序と階層を取得
	function traverse(element, parentId, level) {
		let children = $(element).children('.hearing-each-wrap');

		children.each(function () {
			let currentId = $(this).attr('id');
			// オリジナルのデータを検索（フォームの内容などを維持するため）
			let itemData = originalContent.find(c => c.id === currentId);
			if (!itemData) {
				// 新規追加などで見つからない場合のフォールバック（通常はありえない）
				itemData = {
					id: currentId,
					name: $(this).data('name'),
					type: $(this).hasClass('terminal') ? 'terminal' : 'nonterminal',
					form: {}
				};
			}

			// 新しいIDを生成
			let newId;
			if (parentId === 'root') {
				if (!idCounters[parentId]) idCounters[parentId] = 65; // A
				newId = String.fromCharCode(idCounters[parentId]);
				idCounters[parentId]++;
			} else {
				if (!idCounters[parentId]) idCounters[parentId] = 1;

				if (level === 2) {
					newId = `${parentId}-${String(idCounters[parentId]).padStart(2, '0')}`;
				} else if (level === 3) {
					newId = `${parentId}-${String.fromCharCode(96 + idCounters[parentId])}`;
				} else {
					newId = `${parentId}-${idCounters[parentId]}`;
				}
				idCounters[parentId]++;
			}

			// データを更新（元の配列を汚染しないようにコピーを作成）
			let newItemData = Object.assign({}, itemData);
			newItemData.id = newId;
			newItemData.parent = parentId;
			newItemData.level = level;

			newContent.push(newItemData);

			// DOM上のIDなども更新（後で一括更新だとSortableが狂うかも？一旦データだけ作る）

			// 再帰的に子要素を処理
			let childContainer = $(this).children('.children-wrap');
			if (childContainer.length > 0) {
				traverse(childContainer, newId, level + 1);
			}
		});
	}

	traverse($('#hearing-item-wrap'), 'root', 1);

	// Specを更新
	spec['sheet-content'] = newContent;
	$('#data-sheetspec').text(JSON.stringify(spec, null, 2));

	console.log("IDs reassigned based on DOM structure");
}

// DOM上のID表示のみ更新（再描画なし）
function refreshIdsInDom() {
	let spec = JSON.parse($('#data-sheetspec').html());
	let content = spec['sheet-content'];

	// 現在のDOMの各要素に対して、新しいIDを適用
	// 注意: DOMのIDを変更するとSortableが動かなくなる可能性があるかは要検証
	// ここではID属性そのものは変更せず、見た目のラベルだけ変えるのが安全かもしれないが
	// 保存処理などでID属性を使っているので、整合性をとる必要がある。
	// 一旦、reassignIds内でIDが変わっているので、DOMのIDも変える必要がある。

	// しかし、IDを変えるとtraverseができなくなるので、reassignIdsのロジック内でやるべきか、
	// あるいは全再描画する方が安全。
	// SortableのonEndで全再描画するとドラッグ状態がおかしくなることがあるが、onEndならドロップ完了後なので大丈夫なはず。

	refreshSheet();
}

// シートの再描画
function refreshSheet() {
	if (!isCustomizationMode) return;

	// スクロール位置の保持
	let scrollPos = $(window).scrollTop();

	let spec = JSON.parse($('#data-sheetspec').html());
	makeNestedSheet(spec);
	initializeDragAndDrop();

	$(window).scrollTop(scrollPos);
}

// 項目の編集
function editItem(itemId) {
	let spec = JSON.parse($('#data-sheetspec').html());
	let item = spec['sheet-content'].find(c => c.id === itemId);

	if (!item) {
		alert('項目が見つかりません');
		return;
	}

	// モーダルに値を設定
	$('#edit-item-id').val(item.id);
	$('#edit-item-name').val(item.name);
	$('#edit-item-type').val(item.type);

	if (item.type === 'terminal') {
		$('#edit-item-description').val(item.form.description || '');
		$('#edit-item-example').val(item.form.example || '');
		$('#edit-item-form-main').val(item.form['form-main'] || 'input');
		$('#edit-item-form-option').val(item.form['form-main-option'] || '');
		$('#edit-item-importance').val(item.form.importance || 1);
		$('#edit-item-prior').val(item.form.prior || 0);

		$('#terminal-fields').show();
		toggleFormOptionField();
	} else {
		$('#terminal-fields').hide();
	}

	// モーダルを表示
	$('#editItemModal').modal('show');
}

// 項目の保存
function saveItem() {
	let itemId = $('#edit-item-id').val();
	let spec = JSON.parse($('#data-sheetspec').html());
	let item = spec['sheet-content'].find(c => c.id === itemId);

	if (!item) {
		alert('項目が見つかりません');
		return;
	}

	// 値を更新
	item.name = $('#edit-item-name').val();
	item.type = $('#edit-item-type').val();

	if (item.type === 'terminal') {
		if (!item.form) {
			item.form = {};
		}
		item.form.description = $('#edit-item-description').val();
		item.form.example = $('#edit-item-example').val();
		item.form['form-main'] = $('#edit-item-form-main').val();
		item.form['form-main-option'] = $('#edit-item-form-option').val();
		item.form.importance = parseInt($('#edit-item-importance').val());
		item.form.prior = parseInt($('#edit-item-prior').val());

		// デフォルト値を設定
		if (!item.form.dependence) item.form.dependence = '';
		if (!item.form['form-main-default']) item.form['form-main-default'] = '';
		if (!item.form['form-main-answer']) item.form['form-main-answer'] = '';
		if (!item.form['form-sub']) item.form['form-sub'] = '';
		if (!item.form['form-sub-default']) item.form['form-sub-default'] = '';
		if (!item.form['form-sub-answer']) item.form['form-sub-answer'] = '';
		if (!item.form.memo) item.form.memo = '';
	} else {
		// nonterminalの場合、formにpriorだけ設定
		item.form = { prior: parseInt($('#edit-item-prior').val()) || 0 };
	}

	// JSONを更新
	$('#data-sheetspec').text(JSON.stringify(spec, null, 2));

	// モーダルを閉じる
	$('#editItemModal').modal('hide');

	// シートを再描画
	refreshSheet();
}

// 項目の削除
function deleteItem(itemId) {
	let spec = JSON.parse($('#data-sheetspec').html());
	let item = spec['sheet-content'].find(c => c.id === itemId);

	if (!item) {
		alert('項目が見つかりません');
		return;
	}

	// 子項目があるかチェック
	let hasChildren = spec['sheet-content'].some(c => c.parent === itemId);

	let confirmMsg = hasChildren
		? `「${item.name}」とその子項目をすべて削除しますか？この操作は取り消せません。`
		: `「${item.name}」を削除しますか？この操作は取り消せません。`;

	if (!confirm(confirmMsg)) {
		return;
	}

	// 項目と子項目を削除
	function deleteItemAndChildren(id) {
		spec['sheet-content'] = spec['sheet-content'].filter(c => {
			if (c.id === id) {
				return false;
			}
			if (c.parent === id) {
				deleteItemAndChildren(c.id);
				return false;
			}
			return true;
		});
	}

	deleteItemAndChildren(itemId);

	// JSONを更新
	$('#data-sheetspec').text(JSON.stringify(spec, null, 2));

	// IDを振り直し
	reassignIds();

	// シートを再描画
	refreshSheet();
}

// 子項目の追加
function addChildItem(parentId) {
	let spec = JSON.parse($('#data-sheetspec').html());
	let parent = spec['sheet-content'].find(c => c.id === parentId);

	if (!parent) {
		alert('親項目が見つかりません');
		return;
	}

	// 新しいIDを生成
	let newId = `${parentId}-new-${Date.now()}`;
	let newLevel = parent.level + 1;

	// 新しい項目を作成
	let newItem = {
		id: newId,
		parent: parentId,
		level: newLevel,
		type: 'terminal',
		name: '新しい項目',
		form: {
			dependence: '',
			importance: 1,
			prior: 0,
			'form-main': 'input',
			'form-main-default': '',
			'form-main-option': '',
			'form-main-answer': '',
			'form-sub': '',
			'form-sub-default': '',
			'form-sub-answer': '',
			description: '',
			example: '',
			memo: ''
		}
	};

	// 親の直後に挿入
	let parentIndex = spec['sheet-content'].findIndex(c => c.id === parentId);
	spec['sheet-content'].splice(parentIndex + 1, 0, newItem);

	// JSONを更新
	$('#data-sheetspec').text(JSON.stringify(spec, null, 2));

	// シートを一時的に再描画（DOMに新しい項目を追加するため）
	refreshSheet();

	// IDを振り直し
	reassignIds();

	// シートを再描画（正しいIDで表示するため）
	refreshSheet();

	// 新しい項目を編集モードで開く
	setTimeout(() => {
		// IDが振り直されているので、新しいIDを取得
		let updatedSpec = JSON.parse($('#data-sheetspec').html());
		let updatedItem = updatedSpec['sheet-content'].find(c => c.name === '新しい項目' && c.parent === parentId);
		if (updatedItem) {
			editItem(updatedItem.id);
		}
	}, 100);
}

// フォームオプションフィールドの表示/非表示
function toggleFormOptionField() {
	let formType = $('#edit-item-form-main').val();
	if (formType === 'select' || formType === 'checkbox' || formType === 'radio') {
		$('#form-option-group').show();
	} else {
		$('#form-option-group').hide();
	}
}

// イベントハンドラ
$(document).ready(function () {
	// 編集モーダルをDOMに追加
	if ($('#editItemModal').length === 0) {
		let modalHtml = `
      <div class="modal fade" id="editItemModal" tabindex="-1" role="dialog" aria-labelledby="editItemModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="editItemModalTitle">項目を編集</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <form id="edit-item-form">
                <input type="hidden" id="edit-item-id" value="">
                
                <div class="form-group">
                  <label for="edit-item-name">項目名 <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="edit-item-name" required>
                </div>

                <div class="form-group">
                  <label for="edit-item-type">項目タイプ</label>
                  <select class="form-control" id="edit-item-type">
                    <option value="terminal">入力項目（terminal）</option>
                    <option value="nonterminal">カテゴリ（nonterminal）</option>
                  </select>
                </div>

                <div id="terminal-fields">
                  <div class="form-group">
                    <label for="edit-item-description">説明</label>
                    <textarea class="form-control" id="edit-item-description" rows="2"></textarea>
                  </div>

                  <div class="form-group">
                    <label for="edit-item-example">例（複数ある場合は「／」で区切る）</label>
                    <textarea class="form-control" id="edit-item-example" rows="2"></textarea>
                  </div>

                  <div class="form-group">
                    <label for="edit-item-form-main">入力フォームタイプ</label>
                    <select class="form-control" id="edit-item-form-main">
                      <option value="input">テキスト入力</option>
                      <option value="textarea">複数行テキスト</option>
                      <option value="select">選択（ドロップダウン）</option>
                      <option value="checkbox">チェックボックス</option>
                      <option value="radio">ラジオボタン</option>
                    </select>
                  </div>

                  <div class="form-group" id="form-option-group">
                    <label for="edit-item-form-option">選択肢（「／」で区切る）</label>
                    <input type="text" class="form-control" id="edit-item-form-option">
                    <small class="form-text text-muted">例: 選択肢1／選択肢2／選択肢3</small>
                  </div>

                  <div class="form-group">
                    <label for="edit-item-importance">重要度（1-3）</label>
                    <select class="form-control" id="edit-item-importance">
                      <option value="1">1 - 低</option>
                      <option value="2">2 - 中</option>
                      <option value="3">3 - 高</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="edit-item-prior">事前入力推奨</label>
                    <select class="form-control" id="edit-item-prior">
                      <option value="0">いいえ</option>
                      <option value="1">はい</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">キャンセル</button>
              <button type="button" class="btn btn-primary" id="save-item-btn">保存</button>
            </div>
          </div>
        </div>
      </div>
    `;
		$('body').append(modalHtml);
	}

	// カスタマイズモード切り替えボタンがまだ存在しない場合は追加
	if ($('#toggle-customization-mode').length === 0) {
		let toggleBtn = $(`
      <div class="small menu-item">
        <span id="toggle-customization-mode" class="btn btn-sm btn-warning">
          <i class="fas fa-edit"></i> カスタマイズモード
        </span>
      </div>
    `);
		$('#menu-wrap').prepend(toggleBtn);
	}

	// カスタマイズモード切り替え
	$(document).on('click', '#toggle-customization-mode', toggleCustomizationMode);

	// 編集ボタン
	$(document).on('click', '.edit-item-btn', function () {
		let itemId = $(this).data('id');
		editItem(itemId);
	});

	// 削除ボタン
	$(document).on('click', '.delete-item-btn', function () {
		let itemId = $(this).data('id');
		deleteItem(itemId);
	});

	// 子項目追加ボタン
	$(document).on('click', '.add-child-btn', function () {
		let parentId = $(this).data('id');
		addChildItem(parentId);
	});

	// 保存ボタン
	$(document).on('click', '#save-item-btn', saveItem);

	// フォームタイプ変更時
	$(document).on('change', '#edit-item-form-main', toggleFormOptionField);

	// 項目タイプ変更時
	$(document).on('change', '#edit-item-type', function () {
		if ($(this).val() === 'terminal') {
			$('#terminal-fields').show();
		} else {
			$('#terminal-fields').hide();
		}
	});
});
