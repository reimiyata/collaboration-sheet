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

		// Check field type - IMPORTANT: Check checkbox/radio FIRST before text inputs
		// because some checkbox/radio fields also have text input fields for "other" details
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
