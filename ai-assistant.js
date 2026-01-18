// AI Assistant for Collaboration Sheet
// Manages chat interface, Azure OpenAI integration, and undo/redo functionality

// ========================================
// State Management
// ========================================

let aiSettings = {
	endpoint: '',
	apiKey: '',
	model: 'gpt-5',
	reasoningEffort: 'medium',
	verbosity: 'medium'
};

let chatHistory = [];
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 100;
let isProcessing = false;

// Speech recognition
let recognition = null;
let isRecording = false;

// ========================================
// Settings Management
// ========================================

function loadSettings() {
	const saved = localStorage.getItem('ai-assistant-settings');
	if (saved) {
		try {
			aiSettings = JSON.parse(saved);
			// Populate form
			$('#ai-endpoint').val(aiSettings.endpoint);
			$('#ai-api-key').val(aiSettings.apiKey);
			$('#ai-model').val(aiSettings.model);
			$('#ai-reasoning').val(aiSettings.reasoningEffort);
			$('#ai-verbosity').val(aiSettings.verbosity);
		} catch (e) {
			console.error('Failed to load settings:', e);
		}
	}
}

function saveSettings() {
	aiSettings = {
		endpoint: $('#ai-endpoint').val().trim(),
		apiKey: $('#ai-api-key').val().trim(),
		model: $('#ai-model').val(),
		reasoningEffort: $('#ai-reasoning').val(),
		verbosity: $('#ai-verbosity').val()
	};

	if (!validateSettings()) {
		return false;
	}

	localStorage.setItem('ai-assistant-settings', JSON.stringify(aiSettings));
	$('#aiSettingsModal').modal('hide');
	alert('設定を保存しました');
	return true;
}

function validateSettings() {
	if (!aiSettings.endpoint) {
		alert('エンドポイントを入力してください');
		return false;
	}
	if (!aiSettings.apiKey) {
		alert('APIキーを入力してください');
		return false;
	}
	return true;
}

// ========================================
// Azure OpenAI Integration
// ========================================

async function sendChatRequest(userMessage) {
	if (!validateSettings()) {
		addMessage('設定が不完全です。設定ボタンからAzure OpenAIの情報を入力してください。', 'ai');
		return;
	}

	// Add user message to history
	chatHistory.push({
		role: 'user',
		content: userMessage,
		timestamp: new Date().toISOString()
	});

	// Generate system prompt
	const systemPrompt = generateSystemPrompt();

	// Prepare messages
	const messages = [
		{ role: 'system', content: systemPrompt },
		...chatHistory
	];

	try {
		showLoading();

		const response = await fetch(`${aiSettings.endpoint}/chat/completions?api-version=2024-12-01-preview`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'api-key': aiSettings.apiKey
			},
			body: JSON.stringify({
				model: aiSettings.model,
				messages: messages,
				reasoning_effort: aiSettings.reasoningEffort,
				verbosity: aiSettings.verbosity,
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'sheet_update',
						strict: true,
						schema: {
							type: 'object',
							properties: {
								message: {
									type: 'string',
									description: 'ユーザーへのメッセージ'
								},
								updates: {
									type: 'array',
									description: 'シートの更新内容',
									items: {
										type: 'object',
										properties: {
											field_id: {
												type: 'string',
												description: 'フィールドID（例: A-01）'
											},
											value: {
												type: 'string',
												description: '設定する値'
											}
										},
										required: ['field_id', 'value'],
										additionalProperties: false
									}
								}
							},
							required: ['message', 'updates'],
							additionalProperties: false
						}
					}
				}
			})
		});

		hideLoading();

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API Error: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		const assistantMessage = data.choices[0].message.content;

		// Add assistant response to history
		chatHistory.push({
			role: 'assistant',
			content: assistantMessage,
			timestamp: new Date().toISOString()
		});

		// Parse and apply updates
		try {
			const parsed = JSON.parse(assistantMessage);
			addMessage(parsed.message, 'ai');

			if (parsed.updates && parsed.updates.length > 0) {
				applySheetUpdates(parsed.updates);
			}
		} catch (e) {
			console.error('Failed to parse AI response:', e);
			addMessage(assistantMessage, 'ai');
		}

	} catch (error) {
		hideLoading();
		console.error('Chat request failed:', error);
		addMessage(`エラーが発生しました: ${error.message}`, 'ai');
	}
}

function generateSystemPrompt() {
	const spec = JSON.parse($('#data-sheetspec').html());
	const content = spec['sheet-content'];

	let prompt = `あなたは「BRIDGE AIアシスタント」です。教員と司書をつなぐ打ち合わせシートの入力を支援します。

【役割】
- 対話を通じて授業や資料提供に関する情報を収集する
- 収集した情報を適切なフィールドに自動入力する
- prior: 1 の項目を優先的に質問する
- 自然で親しみやすい対話を心がける

【シート構造】
以下のフィールドがあります:

`;

	// Build field list
	content.forEach(item => {
		if (item.type === 'terminal') {
			prompt += `\n- ID: ${item.id}, 名前: ${item.name}`;
			if (item.form['form-main-option']) {
				prompt += `, 選択肢: ${item.form['form-main-option']}`;
			}
			if (item.form.prior === 1) {
				prompt += ` [優先]`;
			}
			if (item.form.description) {
				prompt += `\n  説明: ${item.form.description}`;
			}
		}
	});

	prompt += `\n\n【対話の進め方】
1. **一度に1つか2つの質問のみ**を行う（決して3つ以上質問しない）
2. まだ入力されていない優先項目から順に質問する
3. 選択肢がある項目は選択肢を提示する
4. ユーザーの回答から関連する情報を抽出し、適切なフィールドに入力する
5. 一度に複数の項目を埋められる場合は積極的に埋める
6. すべての重要な情報が収集できたら、ユーザーに確認する

【重要な制約】
- 1回のメッセージで質問するのは最大2つまで
- 簡潔で分かりやすい質問を心がける
- ユーザーが答えやすいように質問を工夫する

【フィールドタイプ別の入力ルール】
- **選択肢がある項目（checkbox, radio）**: ユーザーの回答内容に該当する選択肢がある場合、必ず選択肢の値をそのまま使用する
  - 例: 選択肢が「調べ学習／読み聞かせ・ブックトーク／その他／未定」の場合
    - ユーザーが「調べ学習をします」と答えた場合 → value: "調べ学習"
    - ユーザーが「調べ学習と読み聞かせ」と答えた場合 → value: "調べ学習／読み聞かせ・ブックトーク"
  - 選択肢に該当しない場合のみ、詳細欄（form-sub）にテキストで入力する
- **テキスト入力項目**: ユーザーの回答をそのまま入力

【出力形式】
必ずJSON形式で以下のように返してください:
{
  "message": "ユーザーへのメッセージ（次の質問や確認など）",
  "updates": [
    { "field_id": "A-01", "value": "小3" },
    { "field_id": "A-02", "value": "国語" }
  ]
}

updatesが空の配列の場合でも必ず含めてください。`;

	return prompt;
}

function applySheetUpdates(updates) {
	if (!updates || updates.length === 0) return;

	// Save current state before applying updates
	saveState();

	updates.forEach(update => {
		const fieldId = update.field_id;
		const value = update.value;

		// Find the input element
		const $field = $(`#${CSS.escape(fieldId)}`);
		if ($field.length === 0) {
			console.warn(`Field not found: ${fieldId}`);
			return;
		}

		// Apply value based on field type
		const $checkbox = $field.find('input[type="checkbox"]');
		const $radio = $field.find('input[type="radio"]');
		const $input = $field.find('.form-control').first();

		if ($checkbox.length > 0) {
			// Handle checkbox (multiple values separated by ／)
			const values = value.split('／').map(v => v.trim());
			$checkbox.each(function () {
				const $cb = $(this);
				$cb.prop('checked', values.includes($cb.val()));
			});
			console.log(`Checkbox updated for ${fieldId}:`, values);
		} else if ($radio.length > 0) {
			// Handle radio button
			const trimmedValue = value.trim();
			const matched = $radio.filter(function () {
				return $(this).val() === trimmedValue;
			});
			if (matched.length > 0) {
				matched.prop('checked', true);
				console.log(`Radio updated for ${fieldId}:`, trimmedValue);
			} else {
				console.warn(`No matching radio option for "${trimmedValue}" in ${fieldId}`);
			}
		} else if ($input.length > 0) {
			// Handle text input/textarea/select
			$input.val(value);
			// Trigger change event for any listeners
			$input.trigger('change');
			console.log(`Text input updated for ${fieldId}:`, value);
		}
	});

	// Update spec
	updateSpec();

	// Update undo/redo buttons
	updateUndoRedoButtons();
}

// ========================================
// Chat UI Management
// ========================================

function initializeChat() {
	$('#ai-chat-messages').empty();
	chatHistory = [];

	// Update spec to sync form values to JSON before analysis
	updateSpec();

	// Analyze current sheet data to generate context-aware greeting
	const sheetAnalysis = analyzeSheetData();
	const greeting = generateInitialGreeting(sheetAnalysis);

	addMessage(greeting, 'ai');

	// Send initial question after a brief delay
	setTimeout(() => {
		sendInitialQuestion();
	}, 500);
}

// Analyze current sheet data to determine what's filled and what's missing
function analyzeSheetData() {
	const spec = JSON.parse($('#data-sheetspec').html());
	const content = spec['sheet-content'];

	const analysis = {
		filledFields: [],
		emptyPriorityFields: [],
		totalFields: 0,
		filledCount: 0
	};

	content.forEach(item => {
		if (item.type === 'terminal') {
			analysis.totalFields++;

			const hasAnswer = item.form['form-main-answer'] && item.form['form-main-answer'].trim() !== '';

			if (hasAnswer) {
				analysis.filledCount++;
				analysis.filledFields.push({
					id: item.id,
					name: item.name,
					value: item.form['form-main-answer']
				});
			} else if (item.form.prior === 1) {
				analysis.emptyPriorityFields.push({
					id: item.id,
					name: item.name,
					options: item.form['form-main-option']
				});
			}
		}
	});

	return analysis;
}

// Generate initial greeting based on sheet analysis
function generateInitialGreeting(analysis) {
	// Simple initial greeting
	const greeting = 'こんにちは！ BRIDGE AIアシスタントです。先生と司書をつなぐお手伝いをします。\n\n授業についていくつか質問させてください。';

	// Store analysis for follow-up question
	window._sheetAnalysis = analysis;

	return greeting;
}

// Generate and send first question using AI based on sheet analysis
async function sendInitialQuestion() {
	const analysis = window._sheetAnalysis;
	if (!analysis) return;

	try {
		showLoading();
		const question = await generateAIInitialQuestion(analysis);
		hideLoading();

		// Add AI message with the question
		addMessage(question, 'ai');

		// Add to chat history as if AI sent it
		chatHistory.push({
			role: 'assistant',
			content: JSON.stringify({
				message: question,
				updates: []
			}),
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		hideLoading();
		console.error('Failed to generate initial question:', error);

		// Fallback to simple question
		const fallbackQuestion = 'まず、何年生向けの授業を考えていますか？';
		addMessage(fallbackQuestion, 'ai');
		chatHistory.push({
			role: 'assistant',
			content: JSON.stringify({
				message: fallbackQuestion,
				updates: []
			}),
			timestamp: new Date().toISOString()
		});
	}
}

// Generate AI-powered question based on sheet analysis
async function generateAIInitialQuestion(analysis) {
	if (!validateSettings()) {
		throw new Error('AI settings not configured');
	}

	// Build context about current sheet state
	let context = `【現在のシート状態】\n`;
	context += `- 総フィールド数: ${analysis.totalFields}\n`;
	context += `- 入力済み: ${analysis.filledCount}\n`;

	if (analysis.filledFields.length > 0) {
		context += `- 入力済みフィールド:\n`;
		analysis.filledFields.forEach(field => {
			context += `  - ${field.name}: ${field.value}\n`;
		});
	}

	if (analysis.emptyPriorityFields.length > 0) {
		context += `- 未入力の優先フィールド:\n`;
		analysis.emptyPriorityFields.forEach(field => {
			context += `  - ${field.name}`;
			if (field.options) {
				context += ` (選択肢: ${field.options})`;
			}
			context += `\n`;
		});
	}

	const systemPrompt = `あなたはBRIDGE AIアシスタントです。教員との対話を通じて授業の打ち合わせシートを埋めていきます。

${context}

【あなたの役割】
シートの現在の状態を分析し、次に何を質問すべきか判断してください。

【質問作成のガイドライン】
1. すでに入力されている情報は簡潔に確認する（任意）
2. 未入力の優先項目から最も重要なものを1つ選ぶ
3. 自然で親しみやすい質問にする
4. 選択肢がある場合は提示する
5. 一度に1つか2つの質問のみ
6. 簡潔に（2-3文程度）

【出力形式】
必ずJSON形式で返してください:
{
  "message": "質問内容"
}`;

	const messages = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: '最初の質問を生成してください。' }
	];

	const response = await fetch(`${aiSettings.endpoint}/chat/completions?api-version=2024-12-01-preview`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'api-key': aiSettings.apiKey
		},
		body: JSON.stringify({
			model: aiSettings.model,
			messages: messages,
			reasoning_effort: aiSettings.reasoningEffort,
			verbosity: aiSettings.verbosity,
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'initial_question',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							message: {
								type: 'string',
								description: 'ユーザーへの質問'
							}
						},
						required: ['message'],
						additionalProperties: false
					}
				}
			}
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API Error: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
	const aiResponse = JSON.parse(data.choices[0].message.content);

	return aiResponse.message;
}


// Generate and send follow-up question when reopening chat
async function sendFollowUpQuestion(analysis) {
	try {
		showLoading();
		const question = await generateAIInitialQuestion(analysis);
		hideLoading();

		// Add AI message with the question
		addMessage(question, 'ai');

		// Add to chat history
		chatHistory.push({
			role: 'assistant',
			content: JSON.stringify({
				message: question,
				updates: []
			}),
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		hideLoading();
		console.error('Failed to generate follow-up question:', error);

		// Fallback to simple question
		let fallbackQuestion = '';
		if (analysis.emptyPriorityFields.length > 0) {
			const nextField = analysis.emptyPriorityFields[0];
			fallbackQuestion = `${nextField.name}について教えてください。`;
			if (nextField.options) {
				fallbackQuestion += `\n選択肢: ${nextField.options}`;
			}
		} else {
			fallbackQuestion = '他に追加・修正したい情報があれば教えてください。';
		}

		addMessage(fallbackQuestion, 'ai');
		chatHistory.push({
			role: 'assistant',
			content: JSON.stringify({
				message: fallbackQuestion,
				updates: []
			}),
			timestamp: new Date().toISOString()
		});
	}
}

function addMessage(text, sender) {
	const messageClass = sender === 'ai' ? 'ai-message' : 'user-message';
	const $message = $(`<div class="${messageClass}">${escapeHtml(text)}</div>`);
	$('#ai-chat-messages').append($message);
	scrollToBottom();
}

function showLoading() {
	const $loading = $(`
		<div class="ai-loading">
			<span></span>
			<span></span>
			<span></span>
		</div>
	`);
	$('#ai-chat-messages').append($loading);
	scrollToBottom();
	isProcessing = true;
	$('#ai-send-btn').prop('disabled', true);
}

function hideLoading() {
	$('.ai-loading').remove();
	isProcessing = false;
	$('#ai-send-btn').prop('disabled', false);
}

function scrollToBottom() {
	const $messages = $('#ai-chat-messages');
	$messages.scrollTop($messages[0].scrollHeight);
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML.replace(/\n/g, '<br>');
}

// ========================================
// Undo/Redo Management
// ========================================

function captureSheetState() {
	const spec = JSON.parse($('#data-sheetspec').html());
	return JSON.stringify(spec);
}

function restoreSheetState(stateJson) {
	const spec = JSON.parse(stateJson);

	// Update the spec
	$('#data-sheetspec').text(JSON.stringify(spec, null, 2));

	// Redraw the sheet
	$('#hearing-item-wrap').empty();
	makeSheet(spec);
	resizeTextarea();
}

function saveState() {
	// Remove any states after current index
	historyStack = historyStack.slice(0, historyIndex + 1);

	// Capture current state
	const state = captureSheetState();
	historyStack.push(state);

	// Limit to MAX_HISTORY
	if (historyStack.length > MAX_HISTORY) {
		historyStack.shift();
	} else {
		historyIndex++;
	}

	updateUndoRedoButtons();
}

function undo() {
	if (historyIndex > 0) {
		historyIndex--;
		restoreSheetState(historyStack[historyIndex]);
		updateUndoRedoButtons();
	}
}

function redo() {
	if (historyIndex < historyStack.length - 1) {
		historyIndex++;
		restoreSheetState(historyStack[historyIndex]);
		updateUndoRedoButtons();
	}
}

function updateUndoRedoButtons() {
	const canUndo = historyIndex > 0;
	const canRedo = historyIndex < historyStack.length - 1;

	// Update AI assistant buttons
	$('#ai-undo-btn').prop('disabled', !canUndo);
	$('#ai-redo-btn').prop('disabled', !canRedo);

	// Update main menu buttons
	$('#main-undo-btn').prop('disabled', !canUndo);
	$('#main-redo-btn').prop('disabled', !canRedo);
}

function clearAllFields() {
	// Clear all form inputs
	$('.form-control').val('');
	$('.form-check-input').prop('checked', false);
	
	// Update the spec and save state for undo/redo
	updateSpec();
	saveState();
	
	// Redraw the sheet to reflect changes
	const spec = JSON.parse($('#data-sheetspec').text());
	$('#hearing-item-wrap').empty();
	makeSheet(spec);
	resizeTextarea();
}

// ========================================
// Speech Recognition
// ========================================

function initializeSpeechRecognition() {
	// Check browser support
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

	if (!SpeechRecognition) {
		console.warn('Speech recognition not supported in this browser');
		$('#ai-mic-btn').prop('disabled', true).attr('title', '音声入力は非対応のブラウザです');
		return;
	}

	recognition = new SpeechRecognition();
	recognition.lang = 'ja-JP';
	recognition.continuous = false;
	recognition.interimResults = false;

	recognition.onstart = function () {
		isRecording = true;
		$('#ai-mic-btn').addClass('recording');
		$('#ai-user-input').attr('placeholder', '聞き取り中...');
	};

	recognition.onend = function () {
		isRecording = false;
		$('#ai-mic-btn').removeClass('recording');
		$('#ai-user-input').attr('placeholder', '質問を送信');
	};

	recognition.onresult = function (event) {
		const transcript = event.results[0][0].transcript;
		$('#ai-user-input').val(transcript);
		// Automatically send after recognition
		setTimeout(() => {
			if ($('#ai-user-input').val() === transcript) {
				$('#ai-send-btn').click();
			}
		}, 500);
	};

	recognition.onerror = function (event) {
		console.error('Speech recognition error:', event.error);
		isRecording = false;
		$('#ai-mic-btn').removeClass('recording');
		$('#ai-user-input').attr('placeholder', '質問を送信');

		if (event.error === 'no-speech') {
			alert('音声が検出されませんでした。もう一度お試しください。');
		} else if (event.error === 'not-allowed') {
			alert('マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。');
		} else {
			alert(`音声認識エラー: ${event.error}`);
		}
	};
}

function toggleSpeechRecognition() {
	if (!recognition) {
		alert('音声認識が利用できません');
		return;
	}

	if (isRecording) {
		recognition.stop();
	} else {
		try {
			recognition.start();
		} catch (e) {
			console.error('Failed to start recognition:', e);
		}
	}
}

// ========================================
// Event Handlers
// ========================================

$(document).ready(function () {
	// Load settings
	loadSettings();

	// Initialize with first state
	saveState();

	// Initialize speech recognition
	initializeSpeechRecognition();

	// AI Assistant button click
	$('#ai-assistant-btn').on('click', function () {
		$('#ai-chat-window').removeClass('ai-chat-hidden');
		if (chatHistory.length === 0) {
			// First time opening - show initial greeting and question
			initializeChat();
		} else {
			// Reopening - sync form values and analyze current sheet
			updateSpec();
			const sheetAnalysis = analyzeSheetData();
			if (sheetAnalysis.emptyPriorityFields.length > 0 || sheetAnalysis.filledCount < sheetAnalysis.totalFields) {
				// There are still fields to fill - send a follow-up question
				setTimeout(() => {
					sendFollowUpQuestion(sheetAnalysis);
				}, 300);
			}
		}
	});

	// Settings button click
	$('#ai-settings-btn').on('click', function () {
		$('#aiSettingsModal').modal('show');
	});

	// Close chat window
	$('#ai-close-btn').on('click', function () {
		$('#ai-chat-window').addClass('ai-chat-hidden');
	});

	// Save settings
	$('#ai-save-settings').on('click', function () {
		saveSettings();
	});

	// Send message
	function sendMessage() {
		const message = $('#ai-user-input').val().trim();
		if (!message || isProcessing) return;

		addMessage(message, 'user');
		$('#ai-user-input').val('');

		sendChatRequest(message);
	}

	$('#ai-send-btn').on('click', sendMessage);

	$('#ai-user-input').on('keypress', function (e) {
		if (e.which === 13 && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	// Microphone button
	$('#ai-mic-btn').on('click', function () {
		toggleSpeechRecognition();
	});

	// Undo/Redo (AI assistant buttons)
	$('#ai-undo-btn').on('click', undo);
	$('#ai-redo-btn').on('click', redo);

	// Undo/Redo (main menu buttons)
	$('#main-undo-btn').on('click', undo);
	$('#main-redo-btn').on('click', redo);

	// Track manual input changes for undo/redo
	// Use debounce to avoid saving state too frequently
	let inputTimeout;
	$(document).on('change', '.form-control, .form-check-input', function () {
		clearTimeout(inputTimeout);
		inputTimeout = setTimeout(() => {
			updateSpec();
			saveState();
		}, 500); // Wait 500ms after last change before saving
	});

	// Track dropdown selection for undo/redo
	$(document).on('click', 'a.hearing-item-option', function () {
		clearTimeout(inputTimeout);
		inputTimeout = setTimeout(() => {
			updateSpec();
			saveState();
		}, 500); // Wait 500ms after selection before saving
	});

	// Clear all button
	$('#clear-all-btn').on('click', function () {
		const result = window.confirm('すべての入力項目をクリアしますか？\n\nこの操作は元に戻す（Undo）ことができます。');
		if (result) {
			clearAllFields();
		}
	});
// ========================================
// AI Bulk Input Feature
// ========================================

let bulkInputFiles = [];

// Open AI Bulk Input Modal
$('#ai-bulk-input-btn').on('click', function () {
	// Load settings from AI assistant if available
	if (aiSettings.endpoint) {
		$('#bulk-ai-endpoint').val(aiSettings.endpoint);
		$('#bulk-ai-api-key').val(aiSettings.apiKey);
		$('#bulk-ai-model').val(aiSettings.model);
		$('#bulk-ai-reasoning').val(aiSettings.reasoningEffort);
		$('#bulk-ai-verbosity').val(aiSettings.verbosity);
	}

	// Clear previous files
	bulkInputFiles = [];
	$('#file-list').empty();

	// Show modal
	$('#aiBulkInputModal').modal('show');
});

// File selection button
$('#select-files-btn').on('click', function () {
	$('#bulk-file-input').click();
});

// File input change
$('#bulk-file-input').on('change', function (e) {
	handleFiles(e.target.files);
});

// Drag and drop
$('#file-drop-zone').on('click', function () {
	$('#bulk-file-input').click();
});

$('#file-drop-zone').on('dragover', function (e) {
	e.preventDefault();
	e.stopPropagation();
	$(this).addClass('bg-light');
});

$('#file-drop-zone').on('dragleave', function (e) {
	e.preventDefault();
	e.stopPropagation();
	$(this).removeClass('bg-light');
});

$('#file-drop-zone').on('drop', function (e) {
	e.preventDefault();
	e.stopPropagation();
	$(this).removeClass('bg-light');

	const files = e.originalEvent.dataTransfer.files;
	handleFiles(files);
});

function handleFiles(files) {
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		bulkInputFiles.push(file);

		// Display file in list
		const fileItem = $(`
			<div class="file-item d-flex justify-content-between align-items-center p-2 border rounded mb-2" data-index="${bulkInputFiles.length - 1}">
				<div>
					<i class="fas fa-file mr-2"></i>
					<span>${file.name}</span>
					<small class="text-muted ml-2">(${(file.size / 1024).toFixed(1)} KB)</small>
				</div>
				<button type="button" class="btn btn-sm btn-outline-danger remove-file-btn">
					<i class="fas fa-times"></i>
				</button>
			</div>
		`);

		$('#file-list').append(fileItem);
	}
}

// Remove file
$(document).on('click', '.remove-file-btn', function () {
	const fileItem = $(this).closest('.file-item');
	const index = parseInt(fileItem.attr('data-index'));

	bulkInputFiles.splice(index, 1);
	fileItem.remove();

	// Update indices
	$('.file-item').each(function (i) {
		$(this).attr('data-index', i);
	});
});

// Execute bulk input
$('#execute-bulk-input-btn').on('click', async function () {
	const endpoint = $('#bulk-ai-endpoint').val().trim();
	const apiKey = $('#bulk-ai-api-key').val().trim();
	const model = $('#bulk-ai-model').val();
	const reasoning = $('#bulk-ai-reasoning').val();
	const verbosity = $('#bulk-ai-verbosity').val();
	const textInput = $('#bulk-text-input').val().trim();
	const additionalInstructions = $('#bulk-additional-instructions').val().trim();

	if (!endpoint || !apiKey) {
		alert('Azure OpenAI エンドポイントとAPIキーを入力してください。');
		return;
	}

	try {
		$(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 処理中...');

		// Read file contents
		const fileContents = await readAllFiles();

		// Get current sheet data
		updateSpec();
		const currentSheet = JSON.parse($('#data-sheetspec').text());

		// Call AI API
		const result = await callBulkInputAI(endpoint, apiKey, model, reasoning, verbosity, currentSheet, fileContents, textInput, additionalInstructions);

		// Apply results to sheet
		applyBulkInputResults(result);

		// Close modal
		$('#aiBulkInputModal').modal('hide');

		alert('AI一括入力が完了しました。');
	} catch (error) {
		console.error('Bulk input error:', error);
		alert('エラーが発生しました: ' + error.message);
	} finally {
		$(this).prop('disabled', false).html('実行');
	}
});

async function readAllFiles() {
	const contents = [];

	for (const file of bulkInputFiles) {
		try {
			const content = await readFileContent(file);
			contents.push({
				name: file.name,
				type: file.type,
				content: content
			});
		} catch (error) {
			console.error(`Error reading file ${file.name}:`, error);
		}
	}

	return contents;
}

function readFileContent(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = function (e) {
			if (file.type.startsWith('image/')) {
				// For images, use base64
				resolve(e.target.result);
			} else {
				// For text files
				resolve(e.target.result);
			}
		};

		reader.onerror = function () {
			reject(new Error(`Failed to read file: ${file.name}`));
		};

		if (file.type.startsWith('image/')) {
			reader.readAsDataURL(file);
		} else {
			reader.readAsText(file);
		}
	});
}

async function callBulkInputAI(endpoint, apiKey, model, reasoning, verbosity, currentSheet, fileContents, textInput, additionalInstructions) {
	// Build prompt
	const systemPrompt = buildBulkInputPrompt(currentSheet, fileContents, textInput, additionalInstructions);

	const messages = [
		{
			role: 'system',
			content: systemPrompt
		},
		{
			role: 'user',
			content: 'シートの各フィールドに適切な内容を入力してください。'
		}
	];

	const response = await fetch(`${endpoint}/chat/completions?api-version=2024-12-01-preview`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'api-key': apiKey
		},
		body: JSON.stringify({
			model: model,
			messages: messages,
			reasoning_effort: reasoning,
			verbosity: verbosity,
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'bulk_input_result',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							fields: {
								type: 'object',
								additionalProperties: {
									type: 'string'
								}
							}
						},
						required: ['fields'],
						additionalProperties: false
					}
				}
			}
		})
	});

	if (!response.ok) {
		throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	const content = data.choices[0].message.content;
	const result = JSON.parse(content);

	return result.fields;
}

function buildBulkInputPrompt(currentSheet, fileContents, textInput, additionalInstructions) {
	let prompt = 'あなたは教育用の打ち合わせシート入力アシスタントです。\n\n';

	prompt += '【シート構造】\n';
	prompt += 'シートには以下のフィールドがあります：\n';
	currentSheet['sheet-content'].forEach(item => {
		if (item.type === 'terminal') {
			const currentValue = item.form['form-main-answer'] || '';
			prompt += `- ${item.id} (${item.name}): ${item.form.description || ''} [現在値: ${currentValue}]\n`;
		}
	});

	prompt += '\n【提供された情報】\n';

	if (fileContents.length > 0) {
		prompt += 'ファイル内容:\n';
		fileContents.forEach(file => {
			prompt += `\n--- ${file.name} ---\n`;
			if (file.type.startsWith('image/')) {
				prompt += '[画像ファイル]\n';
			} else {
				prompt += file.content + '\n';
			}
		});
	}

	if (textInput) {
		prompt += '\nテキスト入力:\n' + textInput + '\n';
	}

	if (additionalInstructions) {
		prompt += '\n【追加指示】\n' + additionalInstructions + '\n';
	}

	prompt += '\n上記の情報を基に、シートの各フィールドに適切な内容を入力してください。\n';
	prompt += 'フィールドIDをキーとし、入力内容を値とするJSONオブジェクトで返してください。\n';

	return prompt;
}

function applyBulkInputResults(results) {
	// Apply each field value
	for (const [fieldId, value] of Object.entries(results)) {
		const fieldElement = $(`#${fieldId}`).find('.form-control').first();
		if (fieldElement.length > 0) {
			fieldElement.val(value);
			fieldElement.trigger('change');
		}
	}

	// Update spec and save state for undo/redo
	setTimeout(() => {
		updateSpec();
		saveState();
	}, 1000);
}


	// Hide AI assistant in customization mode
	// (This will be called from customization.js)
});

// ========================================
// Export/Import Functions (Global)
// ========================================

// Export chat history for saving
function getChatHistory() {
	return chatHistory.map(msg => ({
		role: msg.role,
		content: msg.content,
		timestamp: msg.timestamp || new Date().toISOString()
	}));
}

// Restore chat history from loaded data
function restoreChatHistory(history) {
	if (!history || !Array.isArray(history)) {
		console.warn('Invalid chat history data');
		return;
	}

	// Clear current chat
	chatHistory = history;

	// Redraw chat messages
	$('#ai-chat-messages').empty();
	history.forEach(msg => {
		if (msg.role === 'user') {
			addMessage(msg.content, 'user');
		} else if (msg.role === 'assistant') {
			// Parse and display assistant message
			try {
				const parsed = JSON.parse(msg.content);
				addMessage(parsed.message, 'ai');
			} catch (e) {
				addMessage(msg.content, 'ai');
			}
		}
	});

	console.log('Chat history restored:', history.length, 'messages');
}

// Make functions globally accessible
window.getChatHistory = getChatHistory;
window.restoreChatHistory = restoreChatHistory;

