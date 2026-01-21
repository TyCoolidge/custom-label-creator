// Label Creator App - CRUD Operations with Local Storage and Preset Management

class LabelManager {
	constructor() {
		this.labels = [];
		this.presets = [];
		this.businessInfo = this.getEmptyBusinessInfo();
		this.editingLabelId = null;
		this.editingPresetId = null;
		this.lastCreatedLabelId = null; // Track last created label for copy
		this.presetSortOrder = null; // 'az', 'za', or null for default (creation order)
		this.presetSearchQuery = ""; // Current search query for Ingredient List tab
		this.presetSearchResults = null; // null means show all, array means show filtered
		this.searchDebounceTimer = null; // Timer for debounced search
		this.ingredientSelectSearchQuery = ""; // Search query for Select Ingredients in Create Label tab
		this.ingredientSelectSearchResults = null; // null means show all, array means show filtered
		this.ingredientSelectDebounceTimer = null; // Timer for debounced search
		this.initializeElements();
		this.attachEventListeners();
		this.render();
		this.renderPresets();
		// Initialize preset mode (default)
		this.renderPresetCheckboxes();
		// Pre-populate business info
		this.populateBusinessInfo();
		// Update business tab indicator
		this.updateBusinessTabIndicator();
		// Disable copy button initially
		this.updateCopyPreviewButton();
		// Load data from backend
		this.loadInitialData();
	}

	// Default empty business info object
	getEmptyBusinessInfo() {
		return {
			businessName: "",
			businessAddress: "",
			businessCity: "",
			businessState: "",
			businessZip: "",
			businessPhone: "",
		};
	}

	// Load initial data from backend
	async loadInitialData() {
		try {
			const [labels, presets, businessInfo] = await Promise.all([
				this.apiRequest("/api/labels", { method: "GET", silent: true }),
				this.apiRequest("/api/presets", { method: "GET", silent: true }),
				this.apiRequest("/api/business", { method: "GET", silent: true }),
			]);

			this.labels = Array.isArray(labels) ? labels : [];
			this.presets = Array.isArray(presets) ? presets : [];
			this.businessInfo = businessInfo || this.getEmptyBusinessInfo();
		} catch (error) {
			console.error("Failed to load initial data", error);
			this.showToast(
				"Unable to load data from server. Starting with empty state.",
				"error"
			);
		} finally {
			this.render();
			this.renderPresets();
			this.renderPresetCheckboxes();
			this.populateBusinessInfo();
			this.updateBusinessTabIndicator();
			this.updateCopyPreviewButton();
		}
	}

	// Generic API helper
	async apiRequest(path, options = {}) {
		try {
			const response = await fetch(path, {
				method: options.method || "GET",
				headers: {
					"Content-Type": "application/json",
					...(options.headers || {}),
				},
				body:
					options.body && typeof options.body === "object"
						? JSON.stringify(options.body)
						: options.body,
			});

			const contentType = response.headers.get("content-type") || "";
			let data = null;
			if (contentType.includes("application/json")) {
				data = await response.json().catch(() => null);
			}

			if (!response.ok) {
				const message =
					(data && data.error) ||
					`Request failed with status ${response.status}`;
				if (!options.silent) {
					this.showToast(message, "error");
				}
				throw new Error(message);
			}

			return data;
		} catch (error) {
			console.error("API request error for", path, error);
			if (!options.silent) {
				this.showToast("Network error. Please try again.", "error");
			}
			throw error;
		}
	}

	// Save business info to backend
	async saveBusinessInfo(info) {
		const payload = { ...this.businessInfo, ...info };
		try {
			const saved = await this.apiRequest("/api/business", {
				method: "POST",
				body: payload,
			});
			this.businessInfo = saved || payload;
			this.updateBusinessTabIndicator();
		} catch (error) {
			console.error("Failed to save business info", error);
			// apiRequest already displays a toast on error
		}
	}

	// Check if required business info is filled out
	isBusinessInfoComplete() {
		return (
			this.businessInfo.businessName &&
			this.businessInfo.businessAddress &&
			this.businessInfo.businessCity &&
			this.businessInfo.businessState &&
			this.businessInfo.businessZip
		);
	}

	// Update the business tab indicator (checkmark or exclamation)
	updateBusinessTabIndicator() {
		const businessTabBtn = document.querySelector('[data-tab="business"]');
		if (businessTabBtn) {
			if (this.isBusinessInfoComplete()) {
				businessTabBtn.innerHTML = "Business ✓";
				businessTabBtn.classList.add("tab-complete");
				businessTabBtn.classList.remove("tab-incomplete");
			} else {
				businessTabBtn.innerHTML = "Business ❗";
				businessTabBtn.classList.add("tab-incomplete");
				businessTabBtn.classList.remove("tab-complete");
			}
		}
		// Also update the warning overlay
		this.updateBusinessWarningOverlay();
	}

	// Show/hide the business warning overlay on Create Label tab
	updateBusinessWarningOverlay() {
		if (this.businessWarningOverlay) {
			if (this.isBusinessInfoComplete()) {
				this.businessWarningOverlay.classList.add("hidden");
			} else {
				this.businessWarningOverlay.classList.remove("hidden");
			}
		}
	}

	// Populate business fields from saved info
	populateBusinessInfo() {
		if (this.businessInfo.businessName) {
			this.businessName.value = this.businessInfo.businessName;
		}
		if (this.businessInfo.businessAddress) {
			this.businessAddress.value = this.businessInfo.businessAddress;
		}
		if (this.businessInfo.businessCity) {
			this.businessCity.value = this.businessInfo.businessCity;
		}
		if (this.businessInfo.businessState) {
			this.businessState.value = this.businessInfo.businessState;
		}
		if (this.businessInfo.businessZip) {
			this.businessZip.value = this.businessInfo.businessZip;
		}
		if (this.businessInfo.businessPhone) {
			this.businessPhone.value = this.businessInfo.businessPhone;
		}
	}

	// Initialize DOM elements
	initializeElements() {
		// Label form elements
		this.form = document.getElementById("label-form");
		this.creationMode = document.getElementById("creation-mode");
		this.labelText = document.getElementById("label-text");
		this.manualInputGroup = document.getElementById("manual-input-group");
		this.presetSelectGroup = document.getElementById("preset-select-group");
		this.presetCheckboxes = document.getElementById("preset-checkboxes");
		this.additionalIngredientsGroup = document.getElementById(
			"additional-ingredients-group"
		);
		this.additionalIngredients = document.getElementById(
			"additional-ingredients"
		);
		this.labelName = document.getElementById("label-name");
		this.nameError = document.getElementById("name-error");
		this.submitBtn = document.getElementById("submit-btn");
		this.cancelBtn = document.getElementById("cancel-btn");
		this.formTitle = document.getElementById("form-title");
		this.labelsContainer = document.getElementById("labels-container");
		this.emptyState = document.getElementById("empty-state");
		this.labelCount = document.getElementById("label-count");

		// Preset form elements
		this.presetForm = document.getElementById("preset-form");
		this.presetFormWrapper = document.getElementById("preset-form-wrapper");
		this.togglePresetFormBtn = document.getElementById("toggle-preset-form");
		this.presetName = document.getElementById("preset-name");
		this.presetBrandName = document.getElementById("preset-brand-name");
		this.presetIngredients = document.getElementById("preset-ingredients");
		this.presetSubmitBtn = document.getElementById("preset-submit-btn");
		this.presetCancelBtn = document.getElementById("preset-cancel-btn");
		this.presetFormTitle = document.getElementById("preset-form-title");
		this.presetsList = document.getElementById("presets-list");
		this.presetsEmptyState = document.getElementById("presets-empty-state");
		this.sortAzBtn = document.getElementById("sort-az");
		this.sortZaBtn = document.getElementById("sort-za");
		this.presetSearchInput = document.getElementById("preset-search");
		this.presetSearchClear = document.getElementById("preset-search-clear");
		this.ingredientSelectSearch = document.getElementById(
			"ingredient-select-search"
		);
		this.ingredientSelectSearchClear = document.getElementById(
			"ingredient-select-search-clear"
		);
		this.toastContainer = document.getElementById("toast-container");

		// Help modal elements
		this.helpBtn = document.getElementById("help-btn");
		this.helpModal = document.getElementById("help-modal");
		this.helpClose = document.getElementById("help-close");

		// FDA food labeling elements
		this.netQuantity = document.getElementById("net-quantity");
		this.netQuantityUnit = document.getElementById("net-quantity-unit");
		this.allergenDetails = document.getElementById("allergen-details");
		this.businessName = document.getElementById("business-name");
		this.businessAddress = document.getElementById("business-address");
		this.businessCity = document.getElementById("business-city");
		this.businessState = document.getElementById("business-state");
		this.businessZip = document.getElementById("business-zip");
		this.businessPhone = document.getElementById("business-phone");
		this.cottageDisclaimer = document.getElementById("cottage-disclaimer");
		this.saveBusinessBtn = document.getElementById("save-business-btn");

		// Tab elements
		this.tabButtons = document.querySelectorAll(".tab-btn");
		this.tabPanels = document.querySelectorAll(".tab-panel");

		// Preview elements
		this.labelPreview = document.getElementById("label-preview");
		this.copyPreviewBtn = document.getElementById("copy-preview-btn");

		// Business warning overlay
		this.businessWarningOverlay = document.getElementById(
			"business-warning-overlay"
		);
		this.goToBusinessBtn = document.getElementById("go-to-business-btn");

		this.defaultColor = "#3498db"; // Default color for all labels
	}

	// Attach event listeners
	attachEventListeners() {
		// Label form listeners
		this.form.addEventListener("submit", (e) => this.handleSubmit(e));
		this.cancelBtn.addEventListener("click", () => this.cancelEdit());
		this.creationMode.addEventListener("change", () => {
			this.handleCreationModeChange();
			this.updatePreview();
		});

		// Preview update listeners - update on any form input change
		this.labelName.addEventListener("input", () => this.updatePreview());
		this.labelText.addEventListener("input", () => this.updatePreview());
		this.additionalIngredients.addEventListener("input", () =>
			this.updatePreview()
		);
		this.netQuantity.addEventListener("input", () => this.updatePreview());
		this.netQuantityUnit.addEventListener("change", () => this.updatePreview());
		this.allergenDetails.addEventListener("input", () => this.updatePreview());

		// Allergen checkbox listeners
		document.querySelectorAll('input[name="allergen"]').forEach((cb) => {
			cb.addEventListener("change", () => this.updatePreview());
		});

		// Copy preview button
		this.copyPreviewBtn.addEventListener("click", () => this.copyPreview());

		// Preset form listeners
		this.presetForm.addEventListener("submit", (e) =>
			this.handlePresetSubmit(e)
		);
		this.togglePresetFormBtn.addEventListener("click", () =>
			this.togglePresetForm()
		);
		this.presetCancelBtn.addEventListener("click", () =>
			this.cancelPresetEdit()
		);

		// Preset sorting listeners
		this.sortAzBtn.addEventListener("click", () => this.sortPresets("az"));
		this.sortZaBtn.addEventListener("click", () => this.sortPresets("za"));

		// Preset search listeners
		this.presetSearchInput.addEventListener("input", (e) =>
			this.handleSearchInput(e.target.value)
		);
		this.presetSearchClear.addEventListener("click", () =>
			this.clearPresetSearch()
		);

		// Ingredient select search listeners (Create Label tab)
		this.ingredientSelectSearch.addEventListener("input", (e) =>
			this.handleIngredientSelectSearch(e.target.value)
		);
		this.ingredientSelectSearchClear.addEventListener("click", () =>
			this.clearIngredientSelectSearch()
		);

		// Help modal listeners
		this.helpBtn.addEventListener("click", () => this.openHelpModal());
		this.helpClose.addEventListener("click", () => this.closeHelpModal());
		this.helpModal.addEventListener("click", (e) => {
			if (e.target === this.helpModal) {
				this.closeHelpModal();
			}
		});
		// Close modal on Escape key
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.helpModal.style.display !== "none") {
				this.closeHelpModal();
			}
		});

		// Help tab navigation listeners
		this.helpTabButtons = document.querySelectorAll(".help-tab-btn");
		this.helpTabPanels = document.querySelectorAll(".help-tab-panel");
		this.helpTabButtons.forEach((btn) => {
			btn.addEventListener("click", () =>
				this.switchHelpTab(btn.dataset.helpTab)
			);
		});

		// Tab navigation listeners
		this.tabButtons.forEach((btn) => {
			btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
		});

		// Save business info button
		this.saveBusinessBtn.addEventListener("click", () =>
			this.handleSaveBusinessInfo()
		);

		// Go to business tab button (from warning overlay)
		this.goToBusinessBtn.addEventListener("click", () => {
			this.switchTab("business");
		});
	}

	// Switch active tab
	switchTab(tabId) {
		// Update button states
		this.tabButtons.forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.tab === tabId);
		});

		// Update panel visibility
		this.tabPanels.forEach((panel) => {
			panel.classList.toggle("active", panel.id === `tab-${tabId}`);
		});
	}

	// Handle save business info button click
	handleSaveBusinessInfo() {
		const businessData = {
			businessName: this.businessName.value.trim(),
			businessAddress: this.businessAddress.value.trim(),
			businessCity: this.businessCity.value.trim(),
			businessState: this.businessState.value.trim().toUpperCase(),
			businessZip: this.businessZip.value.trim(),
			businessPhone: this.businessPhone.value.trim(),
		};

		this.saveBusinessInfo(businessData);
		this.showToast("Business info saved! Will be used for all future labels.");
	}

	// Open help modal
	openHelpModal() {
		this.helpModal.style.display = "flex";
		document.body.style.overflow = "hidden";
	}

	// Close help modal
	closeHelpModal() {
		this.helpModal.style.display = "none";
		document.body.style.overflow = "";
	}

	// Switch active help tab
	switchHelpTab(tabId) {
		// Update button states
		this.helpTabButtons.forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.helpTab === tabId);
		});

		// Update panel visibility
		this.helpTabPanels.forEach((panel) => {
			panel.classList.toggle("active", panel.id === `help-tab-${tabId}`);
		});
	}

	// Update the label preview based on current form values
	// Shows formatted HTML preview
	updatePreview() {
		const labelName = this.labelName.value.trim() || "Label Name";
		const mode = this.creationMode.value;

		// Get ingredients text
		let ingredientsText = "";
		if (mode === "manual") {
			ingredientsText = this.labelText.value.trim();
		} else {
			ingredientsText = this.buildFormattedLabelText() || "";
		}

		// Get allergens
		const allergens = this.getSelectedAllergens();
		const allergenDetails = this.allergenDetails.value.trim();

		// Check if there's any content
		const hasContent =
			this.labelName.value.trim() ||
			ingredientsText ||
			this.netQuantity.value ||
			allergens.length > 0;

		if (!hasContent) {
			this.labelPreview.innerHTML = `<p class="preview-placeholder">Fill out the form above to see a preview of your label</p>`;
			this.labelPreview.classList.remove("has-content");
			return;
		}

		this.labelPreview.classList.add("has-content");

		// Build the preview data object
		const previewData = {
			name: labelName,
			text: ingredientsText,
			netQuantity: this.netQuantity.value,
			netQuantityUnit: this.netQuantityUnit.value,
			allergens: allergens,
			allergenDetails: allergenDetails,
			...this.businessInfo,
			includeCottageDisclaimer: this.cottageDisclaimer.checked,
		};

		// Build formatted HTML preview
		const previewHtml = this.buildFormattedLabelHtml(previewData);
		this.labelPreview.innerHTML = `<div class="preview-formatted">${previewHtml}</div>`;
	}

	// Build formatted HTML for label (used in preview, storage, and rich text copy)
	// This generates clean, centered FDA-compliant label HTML matching the design spec
	// FDA Requirements: minimum 8pt font, consistent single-line spacing
	// Uses pt units for proper Google Docs/rich text compatibility
	buildFormattedLabelHtml(label) {
		const cleanIngredients = this.stripBracketsFromIngredients(
			label.text || label.ingredientsText || ""
		);

		// Consistent spacing between sections (8px single-line spacing)
		const sectionMargin = "margin-bottom: 8px;";
		const fontFamily =
			"font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;";

		// Font sizes in pt for proper rich text/Google Docs compatibility
		const largeFontSize = "font-size: 14pt;"; // Product name & net weight
		const smallFontSize = "font-size: 8pt;"; // FDA minimum for other text

		// Product name - bold, centered (same size as net weight for consistency)
		const productNameHtml = label.name
			? `<div style="text-align: center; font-weight: 700; ${largeFontSize} ${sectionMargin} ${fontFamily}">${this.escapeHtml(label.name)}</div>`
			: "";

		// Ingredients with underlined AND bold "Ingredients:" label, bold preset names (not sub-ingredients)
		// Format: "Preset Name (ingredient1, ingredient2)" - only preset name is bold
		let ingredientsHtml = "";
		if (cleanIngredients) {
			const formattedIngredients =
				this.formatIngredientsWithBoldPresetNames(cleanIngredients);
			ingredientsHtml = `<div style="text-align: center; line-height: 1.6; ${sectionMargin} ${smallFontSize} ${fontFamily}"><span style="text-decoration: underline; font-weight: 700;">Ingredients:</span> ${formattedIngredients}</div>`;
		}

		// Allergens - bold CONTAINS label, centered (8pt minimum)
		let allergenHtml = "";
		if (label.allergens && label.allergens.length > 0) {
			const allergenText = label.allergens.join(", ").toUpperCase();
			allergenHtml = `<div style="text-align: center; font-weight: 700; ${sectionMargin} ${smallFontSize} ${fontFamily}">CONTAINS: ${this.escapeHtml(allergenText)}</div>`;
		}

		// Business info - bold name and address, no comma between name and address
		// Format: "Business Name Address, City, State Zip" - all bold
		let businessInfoHtml = "";
		if (label.businessName) {
			// Build address: no comma between business name and street address
			let addressStr = label.businessName;
			if (label.businessAddress) {
				addressStr += " " + label.businessAddress; // No comma between name and address
			}
			// City, State, Zip with commas
			const cityStateZip = [
				label.businessCity,
				label.businessState,
				label.businessZip,
			]
				.filter((p) => p)
				.join(", ");
			if (cityStateZip) {
				addressStr += ", " + cityStateZip;
			}
			businessInfoHtml = `<div style="text-align: center; font-weight: 700; ${smallFontSize} ${sectionMargin} ${fontFamily}">${this.escapeHtml(addressStr)}</div>`;
		}

		// Net weight - bold, centered (same size as product name)
		let netQuantityHtml = "";
		if (label.netQuantity) {
			netQuantityHtml = `<div style="text-align: center; font-weight: 700; ${largeFontSize} ${sectionMargin} ${fontFamily}">Net Wt. ${this.escapeHtml(label.netQuantity)} ${this.escapeHtml(label.netQuantityUnit || "oz")}</div>`;
		}

		// Cottage food disclaimer - bold, all caps, centered (8pt minimum)
		let cottageHtml = "";
		if (label.includeCottageDisclaimer) {
			cottageHtml = `<div style="text-align: center; font-weight: 700; ${smallFontSize} text-transform: uppercase; letter-spacing: 0.3px; ${fontFamily}">MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION</div>`;
		}

		// Combine all sections - clean, minimal design with consistent spacing
		const labelHtml = `<div style="background: #ffffff; padding: 24px; ${fontFamily} max-width: 500px; margin: 0 auto;">${productNameHtml}${ingredientsHtml}${allergenHtml}${businessInfoHtml}${netQuantityHtml}${cottageHtml}</div>`;

		return labelHtml;
	}

	// Format ingredients with bold preset names only (not sub-ingredients in parentheses)
	// e.g. "Cookie Mix (flour, sugar), Butter" -> "<strong>Cookie Mix</strong> (flour, sugar), <strong>Butter</strong>"
	formatIngredientsWithBoldPresetNames(text) {
		if (!text) return "";

		// Split by comma, but not commas inside parentheses
		const parts = [];
		let current = "";
		let parenDepth = 0;

		for (const char of text) {
			if (char === "(") parenDepth++;
			if (char === ")") parenDepth--;
			if (char === "," && parenDepth === 0) {
				parts.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}
		if (current.trim()) parts.push(current.trim());

		// Format each part: bold only the name before parentheses, not the content inside
		const formatted = parts.map((part) => {
			const parenIndex = part.indexOf("(");
			if (parenIndex > 0) {
				const name = part.substring(0, parenIndex).trim();
				const rest = part.substring(parenIndex); // Keep parenthetical content as-is (not escaped, preserves formatting)
				return `<strong>${this.escapeHtml(name)}</strong> ${rest}`;
			}
			// No parentheses - bold the whole ingredient
			return `<strong>${this.escapeHtml(part)}</strong>`;
		});

		return formatted.join(", ");
	}

	// Copy the label as rich text (HTML) to clipboard
	copyPreview() {
		// Check if we have a recently created label ID to copy
		if (!this.lastCreatedLabelId) {
			this.showToast("Please create the label first before copying");
			return;
		}

		const label = this.getLabelById(this.lastCreatedLabelId);
		if (!label) {
			this.showToast("Label not found. Please create a new label.");
			return;
		}

		// Copy as rich text
		this.copyRichText(label, this.copyPreviewBtn);
	}

	// Copy label as rich text (HTML) for formatted pasting
	copyRichText(label, button) {
		const html = this.buildFormattedLabelHtml(label);
		const plainText = this.buildFullLabelText(label);

		// Try to copy as rich text using Clipboard API
		if (navigator.clipboard && window.ClipboardItem) {
			const htmlBlob = new Blob([html], { type: "text/html" });
			const textBlob = new Blob([plainText], { type: "text/plain" });

			navigator.clipboard
				.write([
					new ClipboardItem({
						"text/html": htmlBlob,
						"text/plain": textBlob,
					}),
				])
				.then(() => {
					this.showCopySuccess(button);
				})
				.catch(() => {
					// Fallback to plain text
					this.handleCopy(plainText, button);
				});
		} else {
			// Fallback to plain text
			this.handleCopy(plainText, button);
		}
	}

	// Show copy success feedback
	showCopySuccess(button) {
		const originalText = button.innerHTML;
		button.innerHTML = "✓ Copied!";
		button.classList.add("copied");
		setTimeout(() => {
			button.innerHTML = originalText;
			button.classList.remove("copied");
		}, 2000);
	}

	// CREATE: Add new label via API
	async createLabel(labelData) {
		const payload = {
			...labelData,
			color: labelData.color || this.defaultColor,
		};
		try {
			const createdLabel = await this.apiRequest("/api/labels", {
				method: "POST",
				body: payload,
			});
			if (createdLabel) {
				this.labels.push(createdLabel);
				// Track last created label for copy functionality
				this.lastCreatedLabelId = createdLabel.id;
				this.updateCopyPreviewButton();
			}
			return createdLabel;
		} catch (error) {
			console.error("Failed to create label", error);
			return null;
		}
	}

	// Update copy preview button state
	updateCopyPreviewButton() {
		if (this.copyPreviewBtn) {
			if (this.lastCreatedLabelId) {
				this.copyPreviewBtn.disabled = false;
				this.copyPreviewBtn.classList.remove("btn-disabled");
			} else {
				this.copyPreviewBtn.disabled = true;
				this.copyPreviewBtn.classList.add("btn-disabled");
			}
		}
	}

	// CREATE: Batch create multiple labels (helper, currently unused)
	async createBatchLabels(mainText, additionalTexts, size) {
		const createdLabels = [];
		if (mainText && mainText.trim()) {
			const main = await this.createLabel({
				text: mainText.trim(),
				color: this.defaultColor,
				size: size,
			});
			if (main) createdLabels.push(main);
		}

		if (Array.isArray(additionalTexts)) {
			for (const text of additionalTexts) {
				if (text && text.trim()) {
					const extra = await this.createLabel({
						text: text.trim(),
						color: this.defaultColor,
						size: size,
					});
					if (extra) createdLabels.push(extra);
				}
			}
		}

		return createdLabels;
	}

	// Parse comma-separated labels
	parseAdditionalLabels(text) {
		if (!text || !text.trim()) {
			return [];
		}
		return text
			.split(",")
			.map((label) => label.trim())
			.filter((label) => label.length > 0);
	}

	// READ: Get all labels
	getAllLabels() {
		return this.labels;
	}

	// READ: Get label by ID
	getLabelById(id) {
		return this.labels.find((label) => label.id === id);
	}

	// UPDATE: Edit existing label via API
	async updateLabel(id, updatedData) {
		try {
			const updatedLabel = await this.apiRequest(
				`/api/labels/${encodeURIComponent(id)}`,
				{ method: "PUT", body: updatedData }
			);
			if (!updatedLabel) return false;
			const index = this.labels.findIndex((label) => label.id === id);
			if (index !== -1) {
				this.labels[index] = updatedLabel;
			}
			return true;
		} catch (error) {
			console.error("Failed to update label", error);
			return false;
		}
	}

	// DELETE: Remove label via API
	async deleteLabel(id) {
		try {
			await this.apiRequest(`/api/labels/${encodeURIComponent(id)}`, {
				method: "DELETE",
			});
			const index = this.labels.findIndex((label) => label.id === id);
			if (index !== -1) {
				this.labels.splice(index, 1);
			}
			if (this.lastCreatedLabelId === id) {
				this.lastCreatedLabelId = null;
				this.updateCopyPreviewButton();
			}
			return true;
		} catch (error) {
			console.error("Failed to delete label", error);
			return false;
		}
	}

	// ========== PRESET CRUD OPERATIONS ==========

	// CREATE: Add new preset via API
	async createPreset(presetData) {
		try {
			const newPreset = await this.apiRequest("/api/presets", {
				method: "POST",
				body: presetData,
			});
			if (newPreset) {
				this.presets.push(newPreset);
			}
			return newPreset;
		} catch (error) {
			console.error("Failed to create preset", error);
			return null;
		}
	}

	// READ: Get all presets
	getAllPresets() {
		return this.presets;
	}

	// READ: Get preset by ID
	getPresetById(id) {
		return this.presets.find((preset) => preset.id === id);
	}

	// Get presets sorted according to current sort order
	// Uses search results if a search is active, otherwise all presets
	getSortedPresets() {
		// Use search results if available, otherwise use all presets
		const basePresets =
			this.presetSearchResults !== null
				? [...this.presetSearchResults]
				: [...this.presets];

		if (this.presetSortOrder === "az") {
			return basePresets.sort((a, b) =>
				a.name.toLowerCase().localeCompare(b.name.toLowerCase())
			);
		} else if (this.presetSortOrder === "za") {
			return basePresets.sort((a, b) =>
				b.name.toLowerCase().localeCompare(a.name.toLowerCase())
			);
		}
		// Default: return in original order (by createdAt from backend)
		return basePresets;
	}

	// Set sort order and re-render presets
	sortPresets(order) {
		// Toggle off if clicking the same button
		if (this.presetSortOrder === order) {
			this.presetSortOrder = null;
		} else {
			this.presetSortOrder = order;
		}
		this.updateSortButtonStates();
		this.renderPresets();
	}

	// Update active state of sort buttons
	updateSortButtonStates() {
		this.sortAzBtn.classList.toggle("active", this.presetSortOrder === "az");
		this.sortZaBtn.classList.toggle("active", this.presetSortOrder === "za");
	}

	// Handle search input with debouncing
	handleSearchInput(value) {
		this.presetSearchQuery = value;

		// Show/hide clear button
		this.presetSearchClear.style.display = value.trim() ? "block" : "none";

		// Clear existing debounce timer
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}

		// Debounce the search (300ms delay)
		this.searchDebounceTimer = setTimeout(() => {
			this.performPresetSearch(value);
		}, 300);
	}

	// Perform the actual search API call
	async performPresetSearch(query) {
		try {
			if (!query.trim()) {
				// Empty query - show all presets
				this.presetSearchResults = null;
				this.renderPresets();
				return;
			}

			const results = await this.apiRequest(
				`/api/presets/search?q=${encodeURIComponent(query.trim())}`,
				{ method: "GET", silent: true }
			);
			this.presetSearchResults = Array.isArray(results) ? results : [];
			this.renderPresets();
		} catch (error) {
			console.error("Search failed", error);
			this.presetSearchResults = [];
			this.renderPresets();
		}
	}

	// Clear search input and results
	clearPresetSearch() {
		this.presetSearchInput.value = "";
		this.presetSearchQuery = "";
		this.presetSearchResults = null;
		this.presetSearchClear.style.display = "none";
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}
		this.renderPresets();
	}

	// Handle search input for Select Ingredients in Create Label tab (server-side API)
	handleIngredientSelectSearch(value) {
		this.ingredientSelectSearchQuery = value;

		// Show/hide clear button
		this.ingredientSelectSearchClear.style.display = value.trim()
			? "block"
			: "none";

		// Clear existing debounce timer
		if (this.ingredientSelectDebounceTimer) {
			clearTimeout(this.ingredientSelectDebounceTimer);
		}

		// Debounce the search (300ms delay)
		this.ingredientSelectDebounceTimer = setTimeout(() => {
			this.performIngredientSelectSearch(value);
		}, 300);
	}

	// Perform the actual search API call for ingredient select
	async performIngredientSelectSearch(query) {
		try {
			if (!query.trim()) {
				// Empty query - show all presets
				this.ingredientSelectSearchResults = null;
				this.renderPresetCheckboxes();
				return;
			}

			const results = await this.apiRequest(
				`/api/presets/search?q=${encodeURIComponent(query.trim())}`,
				{ method: "GET", silent: true }
			);
			this.ingredientSelectSearchResults = Array.isArray(results)
				? results
				: [];
			this.renderPresetCheckboxes();
		} catch (error) {
			console.error("Ingredient select search failed", error);
			this.ingredientSelectSearchResults = [];
			this.renderPresetCheckboxes();
		}
	}

	// Clear ingredient select search
	clearIngredientSelectSearch() {
		this.ingredientSelectSearch.value = "";
		this.ingredientSelectSearchQuery = "";
		this.ingredientSelectSearchResults = null;
		this.ingredientSelectSearchClear.style.display = "none";
		if (this.ingredientSelectDebounceTimer) {
			clearTimeout(this.ingredientSelectDebounceTimer);
		}
		this.renderPresetCheckboxes();
	}

	// UPDATE: Edit existing preset via API
	async updatePreset(id, updatedData) {
		console.log("Updating preset", id, updatedData);
		try {
			const updatedPreset = await this.apiRequest(
				`/api/presets/${encodeURIComponent(id)}`,
				{ method: "PUT", body: updatedData }
			);
			if (!updatedPreset) return false;
			const index = this.presets.findIndex((preset) => preset.id === id);
			if (index !== -1) {
				this.presets[index] = updatedPreset;
			}
			return true;
		} catch (error) {
			console.error("Failed to update preset", error);
			return false;
		}
	}

	// DELETE: Remove preset via API
	async deletePreset(id) {
		try {
			await this.apiRequest(`/api/presets/${encodeURIComponent(id)}`, {
				method: "DELETE",
			});
			const index = this.presets.findIndex((preset) => preset.id === id);
			if (index !== -1) {
				this.presets.splice(index, 1);
			}
			return true;
		} catch (error) {
			console.error("Failed to delete preset", error);
			return false;
		}
	}

	// Parse comma-separated ingredients
	parseIngredients(text) {
		if (!text || !text.trim()) {
			return [];
		}
		return text
			.split(",")
			.map((ingredient) => ingredient.trim())
			.filter((ingredient) => ingredient.length > 0);
	}

	// Get selected allergens from checkboxes
	getSelectedAllergens() {
		const checkboxes = document.querySelectorAll(
			'input[name="allergen"]:checked'
		);
		return Array.from(checkboxes).map((cb) => cb.value);
	}

	// Set allergen checkboxes
	setAllergenCheckboxes(allergens = []) {
		const checkboxes = document.querySelectorAll('input[name="allergen"]');
		checkboxes.forEach((cb) => {
			cb.checked = allergens.includes(cb.value);
		});
	}

	// Collect all FDA label data
	collectFDAData() {
		const businessData = {
			businessName: this.businessName.value.trim(),
			businessAddress: this.businessAddress.value.trim(),
			businessCity: this.businessCity.value.trim(),
			businessState: this.businessState.value.trim().toUpperCase(),
			businessZip: this.businessZip.value.trim(),
			businessPhone: this.businessPhone.value.trim(),
		};

		// Save business info for future labels
		this.saveBusinessInfo(businessData);

		return {
			netQuantity: this.netQuantity.value,
			netQuantityUnit: this.netQuantityUnit.value,
			allergens: this.getSelectedAllergens(),
			allergenDetails: this.allergenDetails.value.trim(),
			...businessData,
			includeCottageDisclaimer: this.cottageDisclaimer.checked,
		};
	}

	// Form submission handler
	async handleSubmit(e) {
		e.preventDefault();

		// Validate form
		if (!this.validateForm()) {
			return;
		}

		const mode = this.creationMode.value;
		const labelName = this.labelName.value.trim();
		const fdaData = this.collectFDAData();

		if (this.editingLabelId) {
			// Update existing label (editing mode)
			const labelId = this.editingLabelId;
			let labelData;
			if (mode === "preset") {
				const selectedPresetIds = this.getSelectedPresets();
				const additionalText = this.additionalIngredients.value.trim();
				const formattedText = this.buildFormattedLabelText();
				const allIngredients = this.collectAllIngredients();
				labelData = {
					name: labelName,
					text: formattedText,
					color: this.defaultColor,
					creationMode: "preset",
					selectedPresetIds,
					additionalIngredientsText: additionalText,
					ingredients: allIngredients,
					...fdaData,
				};
			} else {
				// Default to manual mode for legacy or manual labels
				const text = this.labelText.value.trim();
				labelData = {
					name: labelName,
					text,
					color: this.defaultColor,
					creationMode: "manual",
					selectedPresetIds: [],
					additionalIngredientsText: "",
					ingredients: [],
					...fdaData,
				};
			}
			const success = await this.updateLabel(labelId, labelData);
			if (success) {
				// Treat the edited label as the "last active" label for copy preview
				this.lastCreatedLabelId = labelId;
				this.updateCopyPreviewButton();
				this.editingLabelId = null;
				this.resetForm();
				this.showToast(`Label "${labelName}" updated successfully!`);
				this.render();
			}
		} else {
			// Create new label(s)
			let createdLabel = null;
			if (mode === "manual") {
				// Manual single label creation
				const text = this.labelText.value.trim();
				createdLabel = await this.createLabel({
					name: labelName,
					text,
					color: this.defaultColor,
					creationMode: "manual",
					selectedPresetIds: [],
					additionalIngredientsText: "",
					ingredients: [],
					...fdaData,
				});
				if (createdLabel) {
					this.showToast(`Label "${labelName}" created!`);
				}
			} else if (mode === "preset") {
				// Combine all ingredients from selected presets + additional manual ingredients
				const allIngredients = this.collectAllIngredients();
				if (allIngredients.length > 0) {
					// Create ONE label with formatted preset sections
					const formattedText = this.buildFormattedLabelText();
					const selectedPresetIds = this.getSelectedPresets();
					const additionalText = this.additionalIngredients.value.trim();
					createdLabel = await this.createLabel({
						name: labelName,
						text: formattedText,
						color: this.defaultColor,
						creationMode: "preset",
						selectedPresetIds,
						additionalIngredientsText: additionalText,
						ingredients: allIngredients,
						...fdaData,
					});
					if (createdLabel) {
						this.showToast(
							`Label "${labelName}" created with ${allIngredients.length} ingredients!`
						);
					}
				}
			}
			if (createdLabel) {
				this.resetForm();
				this.render();
			}
		}
	}

	// Handle creation mode change
	handleCreationModeChange() {
		const mode = this.creationMode.value;

		if (mode === "manual") {
			this.manualInputGroup.style.display = "block";
			this.presetSelectGroup.style.display = "none";
			this.additionalIngredientsGroup.style.display = "none";
			this.labelText.required = true;
		} else if (mode === "preset") {
			this.manualInputGroup.style.display = "none";
			this.presetSelectGroup.style.display = "block";
			this.additionalIngredientsGroup.style.display = "block";
			this.labelText.required = false;
			this.renderPresetCheckboxes();
		}
	}

	// Get selected preset IDs from checkboxes
	getSelectedPresets() {
		const checkboxes = this.presetCheckboxes.querySelectorAll(
			'input[type="checkbox"]:checked'
		);
		return Array.from(checkboxes).map((cb) => cb.value);
	}

	// Set preset checkbox selection from an array of preset IDs
	setSelectedPresets(selectedPresetIds = []) {
		const checkboxes = this.presetCheckboxes.querySelectorAll(
			'input[type="checkbox"]'
		);
		const idSet = new Set(selectedPresetIds || []);
		checkboxes.forEach((cb) => {
			cb.checked = idSet.has(cb.value);
		});
	}

	// Collect all ingredients from selected presets and additional manual input
	collectAllIngredients() {
		const allIngredients = [];

		// Get ingredients from selected presets
		const selectedPresetIds = this.getSelectedPresets();
		selectedPresetIds.forEach((presetId) => {
			const preset = this.getPresetById(presetId);
			if (preset) {
				// For single ingredients (no sub-ingredients), use the preset name itself
				if (preset.ingredients && preset.ingredients.length > 0) {
					allIngredients.push(...preset.ingredients);
				} else {
					// Single ingredient - use the preset name
					allIngredients.push(preset.name);
				}
			}
		});

		// Get additional manual ingredients
		const additionalText = this.additionalIngredients.value.trim();
		if (additionalText) {
			const additionalItems = this.parseIngredients(additionalText);
			allIngredients.push(...additionalItems);
		}

		return allIngredients;
	}

	// Build formatted label text with preset sections: PresetName (ingredient1, ingredient2)
	buildFormattedLabelText() {
		const parts = [];

		// Get ingredients from selected presets in format: PresetName (ingredient1, ingredient2)
		const selectedPresetIds = this.getSelectedPresets();
		selectedPresetIds.forEach((presetId) => {
			const preset = this.getPresetById(presetId);
			if (preset) {
				if (preset.ingredients && preset.ingredients.length > 0) {
					// Multi-ingredient preset: show as "PresetName (ingredient1, ingredient2)"
					const ingredientsList = preset.ingredients.join(", ");
					parts.push(`${preset.name} (${ingredientsList})`);
				} else {
					// Single ingredient: just show the preset name
					parts.push(preset.name);
				}
			}
		});

		// Get additional manual ingredients (added as standalone items)
		const additionalText = this.additionalIngredients.value.trim();
		if (additionalText) {
			const additionalItems = this.parseIngredients(additionalText);
			parts.push(...additionalItems);
		}

		return parts.join(", ");
	}

	// Form validation
	validateForm() {
		const mode = this.creationMode.value;
		const textError = document.getElementById("text-error");
		const presetSelectError = document.getElementById("preset-select-error");

		// Clear previous errors
		textError.textContent = "";
		presetSelectError.textContent = "";
		this.nameError.textContent = "";

		// Validate label name (always required)
		const labelName = this.labelName.value.trim();
		if (labelName === "") {
			this.nameError.textContent = "Label name is required";
			this.labelName.focus();
			return false;
		}
		if (labelName.length < 2) {
			this.nameError.textContent = "Label name must be at least 2 characters";
			this.labelName.focus();
			return false;
		}

		if (mode === "manual") {
			const text = this.labelText.value.trim();
			if (text === "") {
				textError.textContent = "Label text is required";
				this.labelText.focus();
				return false;
			}
			if (text.length < 2) {
				textError.textContent = "Label text must be at least 2 characters";
				this.labelText.focus();
				return false;
			}
		} else if (mode === "preset") {
			// Check if we have at least one ingredient from presets or manual input
			const allIngredients = this.collectAllIngredients();
			if (allIngredients.length === 0) {
				presetSelectError.textContent =
					"Please select at least one ingredient or add ingredients manually";
				return false;
			}
		}

		return true;
	}

	// Edit label - populate form with existing label values
	editLabel(id) {
		const label = this.getLabelById(id);
		if (!label) return;

		// Switch to the label creation tab
		this.switchTab("label");

		// Enter editing mode
		this.editingLabelId = id;

		// Determine creation mode; default to manual for legacy labels
		const mode = label.creationMode === "preset" ? "preset" : "manual";
		this.creationMode.value = mode;
		this.handleCreationModeChange();

		// Populate core label fields
		this.labelName.value = label.name || "";
		if (mode === "manual") {
			// Manual labels use the free-form text area
			this.labelText.value = label.text || "";
			// Clear any preset selections / extra ingredients
			if (this.presetCheckboxes) {
				this.setSelectedPresets([]);
			}
			this.additionalIngredients.value = "";
		} else {
			// Preset-based labels: restore preset selection + additional ingredients
			const selectedPresetIds = label.selectedPresetIds || [];
			if (this.presetCheckboxes) {
				this.setSelectedPresets(selectedPresetIds);
			}
			this.additionalIngredients.value = label.additionalIngredientsText || "";
			// Keep manual text in sync with stored label text for completeness
			this.labelText.value = label.text || "";
		}

		// Populate FDA fields
		this.netQuantity.value = label.netQuantity || "";
		this.netQuantityUnit.value = label.netQuantityUnit || "oz";
		this.setAllergenCheckboxes(label.allergens || []);
		this.allergenDetails.value = label.allergenDetails || "";
		this.cottageDisclaimer.checked = !!label.includeCottageDisclaimer;

		// Clear any previous errors
		document.getElementById("text-error").textContent = "";
		this.nameError.textContent = "";

		// Update preview to reflect the label being edited
		this.updatePreview();

		// Update form UI
		this.formTitle.textContent = "Edit Label";
		this.submitBtn.textContent = "Update Label";
		this.cancelBtn.style.display = "block";

		// Scroll to form
		this.form.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	// Cancel edit mode
	cancelEdit() {
		this.editingLabelId = null;
		this.resetForm();
	}

	// Reset form to initial state
	resetForm() {
		this.form.reset();
		this.formTitle.textContent = "Create Labels";
		this.submitBtn.textContent = "Create Label(s)";
		this.cancelBtn.style.display = "none";
		this.creationMode.value = "preset";
		this.handleCreationModeChange();
		this.labelName.value = "";
		document.getElementById("text-error").textContent = "";
		document.getElementById("preset-select-error").textContent = "";
		this.nameError.textContent = "";

		// Reset FDA fields (but preserve business info)
		this.netQuantity.value = "";
		this.netQuantityUnit.value = "oz";
		this.setAllergenCheckboxes([]);
		this.allergenDetails.value = "";
		this.cottageDisclaimer.checked = true;

		// Re-populate business info (persists across labels)
		this.populateBusinessInfo();
	}

	// Delete label with confirmation
	async handleDelete(id) {
		const label = this.getLabelById(id);
		if (label && confirm(`Are you sure you want to delete "${label.name}"?`)) {
			const labelName = label.name;
			const success = await this.deleteLabel(id);
			if (success) {
				// If we were editing this label, cancel edit mode
				if (this.editingLabelId === id) {
					this.cancelEdit();
				}
				this.render();
				this.showToast(`Label "${labelName}" deleted`);
			}
		}
	}

	// Copy label text to clipboard
	async handleCopy(text, button) {
		try {
			// Try modern Clipboard API first
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(text);
				this.showCopyFeedback(button);
			} else {
				// Fallback for older browsers
				this.copyToClipboardFallback(text);
				this.showCopyFeedback(button);
			}
		} catch (err) {
			console.error("Failed to copy text:", err);
			// Try fallback method
			try {
				this.copyToClipboardFallback(text);
				this.showCopyFeedback(button);
			} catch (fallbackErr) {
				console.error("Fallback copy also failed:", fallbackErr);
				alert("Failed to copy to clipboard. Please copy manually.");
			}
		}
	}

	// Fallback copy method for older browsers
	copyToClipboardFallback(text) {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		textArea.style.position = "fixed";
		textArea.style.left = "-999999px";
		textArea.style.top = "-999999px";
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			document.execCommand("copy");
			textArea.remove();
		} catch (err) {
			textArea.remove();
			throw err;
		}
	}

	// Show visual feedback for copy action
	showCopyFeedback(button) {
		button.classList.add("copied");
		const originalText = button.textContent;
		button.textContent = "✓ Copied!";

		setTimeout(() => {
			button.classList.remove("copied");
			button.textContent = originalText;
		}, 2000);
	}

	// Show toast notification
	showToast(message, type = "success") {
		const toast = document.createElement("div");
		toast.className = `toast ${type}`;

		const icons = {
			success: "✓",
			error: "✕",
			info: "ℹ",
		};

		toast.innerHTML = `
			<span class="toast-icon">${icons[type] || icons.success}</span>
			<span class="toast-message">${message}</span>
		`;

		this.toastContainer.appendChild(toast);

		// Auto-remove after 3 seconds
		setTimeout(() => {
			toast.classList.add("hiding");
			setTimeout(() => {
				toast.remove();
			}, 300);
		}, 3000);
	}

	// ========== PRESET FORM HANDLERS ==========

	// Toggle ingredient form visibility
	togglePresetForm() {
		const isVisible = this.presetFormWrapper.style.display !== "none";
		if (isVisible) {
			this.presetFormWrapper.style.display = "none";
			this.togglePresetFormBtn.textContent = "+ New Ingredient";
		} else {
			this.presetFormWrapper.style.display = "block";
			this.togglePresetFormBtn.textContent = "− Hide Form";
			this.presetName.focus();
		}
	}

	// Handle preset form submission
	async handlePresetSubmit(e) {
		e.preventDefault();

		if (!this.validatePresetForm()) {
			return;
		}

		const name = this.presetName.value.trim();
		const brandName = this.presetBrandName.value.trim();
		const ingredientsText = this.presetIngredients.value.trim();
		const ingredients = this.parseIngredients(ingredientsText);

		let success = false;
		if (this.editingPresetId) {
			// Update existing ingredient
			success = await this.updatePreset(this.editingPresetId, {
				name,
				brandName,
				ingredients,
			});
			if (success) {
				this.editingPresetId = null;
				this.showToast(`Ingredient "${name}" updated!`);
			}
		} else {
			// Create new ingredient
			const newPreset = await this.createPreset({
				name,
				brandName,
				ingredients,
			});
			if (newPreset) {
				success = true;
				this.showToast(
					`Ingredient "${name}" created with ${ingredients.length} sub-ingredients!`
				);
			}
		}

		if (success) {
			this.resetPresetForm();
			this.renderPresets();
			this.updatePresetDropdown();
		}
	}

	// Validate ingredient form
	validatePresetForm() {
		const nameError = document.getElementById("preset-name-error");
		const ingredientsError = document.getElementById(
			"preset-ingredients-error"
		);

		nameError.textContent = "";
		ingredientsError.textContent = "";

		const name = this.presetName.value.trim();

		if (name === "") {
			nameError.textContent = "Ingredient name is required";
			this.presetName.focus();
			return false;
		}

		// Sub-ingredients are now optional - no validation required

		return true;
	}

	// Edit ingredient - populate form
	editPreset(id) {
		const preset = this.getPresetById(id);
		if (preset) {
			this.editingPresetId = id;
			this.presetName.value = preset.name;
			this.presetBrandName.value = preset.brandName || "";
			this.presetIngredients.value = preset.ingredients.join(", ");

			this.presetFormTitle.textContent = "Edit Ingredient";
			this.presetSubmitBtn.textContent = "Update Ingredient";
			this.presetFormWrapper.style.display = "block";
			this.togglePresetFormBtn.textContent = "− Hide Form";

			// Scroll to form
			this.presetForm.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}

	// Cancel preset edit mode
	cancelPresetEdit() {
		this.editingPresetId = null;
		this.resetPresetForm();
	}

	// Reset ingredient form
	resetPresetForm() {
		this.presetForm.reset();
		this.presetFormTitle.textContent = "Create New Ingredient";
		this.presetSubmitBtn.textContent = "Create Ingredient";
		this.presetFormWrapper.style.display = "none";
		this.togglePresetFormBtn.textContent = "+ New Ingredient";
		document.getElementById("preset-name-error").textContent = "";
		document.getElementById("preset-ingredients-error").textContent = "";
	}

	// Delete ingredient with confirmation
	async handlePresetDelete(id) {
		const preset = this.getPresetById(id);
		if (
			preset &&
			confirm(
				`Are you sure you want to delete the "${preset.name}" ingredient?`
			)
		) {
			const presetName = preset.name;
			const success = await this.deletePreset(id);
			if (success) {
				// If we were editing this ingredient, cancel edit mode
				if (this.editingPresetId === id) {
					this.cancelPresetEdit();
				}
				this.renderPresets();
				this.updatePresetDropdown();
				this.showToast(`Ingredient "${presetName}" deleted`);
			}
		}
	}

	// Render preset checkboxes for multi-selection
	renderPresetCheckboxes() {
		// Save currently selected preset IDs before re-rendering
		const previouslySelected = this.getSelectedPresets();

		const allPresets = this.getAllPresets();
		this.presetCheckboxes.innerHTML = "";

		if (allPresets.length === 0) {
			this.presetCheckboxes.innerHTML =
				'<p class="no-presets-message">No ingredients available. Create an ingredient first.</p>';
			return;
		}

		// Use server-side search results if a search is active
		const isSearchActive = this.ingredientSelectSearchResults !== null;
		const presetsToDisplay = isSearchActive
			? this.ingredientSelectSearchResults
			: allPresets;

		// Show empty search message if search returned no results
		if (isSearchActive && presetsToDisplay.length === 0) {
			const escapedQuery = this.escapeHtml(this.ingredientSelectSearchQuery);
			this.presetCheckboxes.innerHTML = `<p class="no-presets-message">🔍 No ingredients found matching "${escapedQuery}"</p>`;
			return;
		}

		presetsToDisplay.forEach((preset) => {
			const item = document.createElement("div");
			item.className = "preset-checkbox-item";

			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = `preset-cb-${preset.id}`;
			checkbox.value = preset.id;
			// Restore selection state
			checkbox.checked = previouslySelected.includes(preset.id);
			// Update preview when preset selection changes
			checkbox.addEventListener("change", () => this.updatePreview());

			// Build label text with optional brand name
			const brandText = preset.brandName
				? ` - <span class="preset-brand-label">${this.escapeHtml(preset.brandName)}</span>`
				: "";

			// Handle item count display for empty ingredients
			const hasIngredients =
				preset.ingredients && preset.ingredients.length > 0;
			const itemCountText = hasIngredients
				? `(${preset.ingredients.length} items)`
				: "(Single)";

			const label = document.createElement("label");
			label.htmlFor = `preset-cb-${preset.id}`;
			label.innerHTML = `${this.escapeHtml(preset.name)}${brandText} <span class="preset-item-count">${itemCountText}</span>`;

			item.appendChild(checkbox);
			item.appendChild(label);
			this.presetCheckboxes.appendChild(item);
		});
	}

	// Update preset dropdown options (legacy - now uses checkboxes)
	updatePresetDropdown() {
		// Re-render checkboxes when presets change
		if (this.creationMode.value === "preset") {
			this.renderPresetCheckboxes();
		}
	}

	// Render all labels to the DOM
	render() {
		const labels = this.getAllLabels();

		// Update label count
		this.labelCount.textContent = `${labels.length} label${labels.length !== 1 ? "s" : ""}`;

		// Show/hide empty state
		if (labels.length === 0) {
			this.emptyState.style.display = "block";
			this.labelsContainer.style.display = "none";
		} else {
			this.emptyState.style.display = "none";
			this.labelsContainer.style.display = "grid";
		}

		// Clear container
		this.labelsContainer.innerHTML = "";

		// Render each label
		labels.forEach((label) => {
			const labelCard = this.createLabelCard(label);
			this.labelsContainer.appendChild(labelCard);
		});
	}

	// Create label card element
	createLabelCard(label) {
		const card = document.createElement("div");
		card.className = "label-card fda-label";

		// Build allergen statement
		let allergenStatement = "";
		if (label.allergens && label.allergens.length > 0) {
			let allergenText = label.allergens.join(", ");
			if (label.allergenDetails) {
				allergenText += ` (${label.allergenDetails})`;
			}
			allergenStatement = `<div class="label-allergens"><strong>CONTAINS:</strong> ${this.escapeHtml(allergenText)}</div>`;
		}

		// Build business info
		let businessInfo = "";
		if (label.businessName) {
			const addressParts = [
				label.businessAddress,
				label.businessCity,
				label.businessState,
				label.businessZip,
			]
				.filter((p) => p)
				.join(", ");
			const phoneStr = label.businessPhone
				? ` ☎ ${this.escapeHtml(label.businessPhone)}`
				: "";
			businessInfo = `<div class="label-business"><strong>${this.escapeHtml(label.businessName)}</strong> 📍 ${this.escapeHtml(addressParts)}${phoneStr}</div>`;
		}

		// Build net quantity
		let netQuantityStr = "";
		if (label.netQuantity) {
			netQuantityStr = `<div class="label-quantity"><strong>Net Wt.</strong> ${this.escapeHtml(
				label.netQuantity
			)} ${this.escapeHtml(label.netQuantityUnit || "oz")}</div>`;
		}

		// Cottage food disclaimer
		let cottageDisclaimer = "";
		if (label.includeCottageDisclaimer) {
			cottageDisclaimer = `<div class="label-disclaimer">MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION</div>`;
		}

		// Ingredients section with bold ingredient names (used for both display and rich text copy)
		const cleanIngredients = this.stripBracketsFromIngredients(label.text);
		let ingredientsSection = "";
		if (cleanIngredients) {
			const formattedIngredients =
				this.formatIngredientsWithBoldPresetNames(cleanIngredients);
			ingredientsSection = `
					<div class="label-ingredients">
						<strong>Ingredients:</strong> ${formattedIngredients}
					</div>
				`;
		}

		card.innerHTML = `
		            <div class="label-header">
		                <div class="label-name">${this.escapeHtml(label.name)}</div>
		                ${netQuantityStr}
		            </div>
		            ${ingredientsSection}
		            ${allergenStatement}
		            ${businessInfo}
		            ${cottageDisclaimer}
		            <div class="label-actions">
		                <button class="btn btn-edit" data-id="${label.id}">
		                    ✏️ Edit
		                </button>
		                <button class="btn btn-copy" data-id="${label.id}">
		                    📋 Copy
		                </button>
		                <button class="btn btn-delete" data-id="${label.id}">
		                    🗑️ Delete
		                </button>
		            </div>
		        `;

		// Attach event listeners to buttons
		const editBtn = card.querySelector(".btn-edit");
		const copyBtn = card.querySelector(".btn-copy");
		const deleteBtn = card.querySelector(".btn-delete");

		editBtn.addEventListener("click", () => this.editLabel(label.id));
		copyBtn.addEventListener("click", () => this.copyRichText(label, copyBtn));
		deleteBtn.addEventListener("click", () => this.handleDelete(label.id));

		return card;
	}

	// Build full label text for copying
	buildFullLabelText(label) {
		// Strip brackets and normalize whitespace in ingredient text
		const cleanIngredients = this.stripBracketsFromIngredients(label.text);

		// Build lines for each logical section to ensure single-line spacing
		const lines = [];

		if (label.name) {
			lines.push(label.name);
		}

		if (cleanIngredients) {
			lines.push(`Ingredients: ${cleanIngredients}`);
		}

		if (label.allergens && label.allergens.length > 0) {
			let allergenText = label.allergens.join(", ");
			if (label.allergenDetails) {
				allergenText += ` (${label.allergenDetails})`;
			}
			lines.push(`CONTAINS: ${allergenText}`);
		}

		// Business info - all on one line
		if (label.businessName) {
			const addressParts = [
				label.businessName,
				label.businessAddress,
				label.businessCity,
				label.businessState,
				label.businessZip,
				label.businessPhone,
			]
				.filter((p) => p)
				.join(", ");
			if (addressParts) {
				lines.push(addressParts);
			}
		}

		if (label.netQuantity) {
			lines.push(
				`Net Wt. ${label.netQuantity} ${label.netQuantityUnit || "oz"}`
			);
		}

		if (label.includeCottageDisclaimer) {
			lines.push(
				"MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO GOVERNMENT FOOD SAFETY INSPECTION"
			);
		}

		// Join with a single newline to avoid double-line spacing
		return lines.join("\n");
	}

	// Clean up ingredient text for copying
	// Format is now: INGREDIENT (sub ingredients) - no stripping needed
	stripBracketsFromIngredients(text) {
		if (!text) return "";
		// Just clean up any extra whitespace
		return text.replace(/\s+/g, " ").trim();
	}

	// Escape HTML to prevent XSS
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	// ========== PRESET RENDERING ==========

	// Render all presets to the DOM
	renderPresets() {
		const allPresets = this.getAllPresets();
		const sortedPresets = this.getSortedPresets();
		const isSearchActive = this.presetSearchResults !== null;

		// Clear container
		this.presetsList.innerHTML = "";

		// Handle empty states
		if (allPresets.length === 0 && !isSearchActive) {
			// No presets at all
			this.presetsEmptyState.innerHTML =
				"<p>📦 No ingredients yet. Create your first ingredient above!</p>";
			this.presetsEmptyState.style.display = "block";
			this.presetsList.style.display = "none";
		} else if (isSearchActive && sortedPresets.length === 0) {
			// Search returned no results
			const escapedQuery = this.escapeHtml(this.presetSearchQuery);
			this.presetsEmptyState.innerHTML = `<p>🔍 No ingredients found matching "${escapedQuery}"</p>`;
			this.presetsEmptyState.style.display = "block";
			this.presetsList.style.display = "none";
		} else {
			// Show presets
			this.presetsEmptyState.style.display = "none";
			this.presetsList.style.display = "grid";

			// Render each preset in sorted order
			sortedPresets.forEach((preset) => {
				const presetCard = this.createPresetCard(preset);
				this.presetsList.appendChild(presetCard);
			});
		}
	}

	// Create preset card element
	createPresetCard(preset) {
		const card = document.createElement("div");
		card.className = "preset-card";

		// Handle ingredients display - show "Single ingredient" if no sub-ingredients
		const hasIngredients = preset.ingredients && preset.ingredients.length > 0;
		let ingredientsDisplay = "";
		let itemCountText = "";

		if (hasIngredients) {
			const ingredientsList = preset.ingredients
				.slice(0, 3)
				.map((ing) => this.escapeHtml(ing))
				.join(", ");
			const moreText =
				preset.ingredients.length > 3
					? ` +${preset.ingredients.length - 3} more`
					: "";
			ingredientsDisplay = `${ingredientsList}${moreText}`;
			itemCountText = `${preset.ingredients.length} items`;
		} else {
			ingredientsDisplay = `<em class="no-sub-ingredients">Single ingredient</em>`;
			itemCountText = "Single";
		}

		// Only show brand name line if it exists
		const brandNameHtml = preset.brandName
			? `<div class="preset-brand-name">Brand: ${this.escapeHtml(preset.brandName)}</div>`
			: "";

		card.innerHTML = `
            <div class="preset-card-header">
                <span class="preset-name">${this.escapeHtml(preset.name)}</span>
                <span class="preset-count">${itemCountText}</span>
            </div>
            ${brandNameHtml}
            <div class="preset-ingredients">
                ${ingredientsDisplay}
            </div>
            <div class="preset-actions">
                <button class="btn btn-edit btn-small" data-id="${preset.id}">
                    ✏️ Edit
                </button>
                <button class="btn btn-delete btn-small" data-id="${preset.id}">
                    🗑️ Delete
                </button>
            </div>
        `;

		// Attach event listeners to buttons
		const editBtn = card.querySelector(".btn-edit");
		const deleteBtn = card.querySelector(".btn-delete");

		editBtn.addEventListener("click", () => this.editPreset(preset.id));
		deleteBtn.addEventListener("click", () =>
			this.handlePresetDelete(preset.id)
		);

		return card;
	}
}

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
	new LabelManager();
});
