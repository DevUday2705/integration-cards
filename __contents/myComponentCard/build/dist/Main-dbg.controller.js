sap.ui.define(
	["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
	function (Controller, JSONModel) {
		"use strict";

		return Controller.extend("my.component.sample.cardContentControls.Main", {
			// Store refresh timer ID
			refreshTimerId: null,
			autoRefreshInterval: 10000, // 10 seconds

			onInit: function () {
				const oComponent = this.getOwnerComponent();
				const oCard = oComponent.card;


				const oModel = new JSONModel({
					LastRefreshedDate: "",
					TaskCount: 0,
					TaskBusy: false,
					TaskDetails: []
				});

				this.getView().setModel(oModel, "Card");
				this._loadCustomCSS();

				// Load current user first to get roles
				if (oCard) {
					this.loadCurrentUser(oCard, oModel);
				} else {
					console.warn("Card instance not available yet. API calls will not be made.");
				}

			},

			onExit: function () {
				// Clean up: stop the auto-refresh timer when component is destroyed
				this._stopAutoRefresh();
			}, _loadCustomCSS: function () {
				try {
					var modulePath = jQuery.sap.getModulePath("my.component.sample.cardContentControls");
					var cssPath = modulePath + "/styles/custom.css";
					var link = document.createElement("link");
					link.rel = "stylesheet";
					link.type = "text/css";
					link.href = cssPath;
					document.head.appendChild(link);
				} catch (err) {
					console.warn("Could not load custom CSS:", err);
				}
			},

			setTaskData: function (card, model) {

				this.setLastRefreshedTime(model);
				this.loadCOFATasks(card, model);
			},

			setLastRefreshedTime: function (model) {
				var now = new Date();
				model.setProperty("/LastRefreshedDate", now);

				// Update the status message in DOM
				this._updateStatusMessage(now);
			},

			_updateStatusMessage: function (refreshDate) {
				var that = this;
				
				// Format date: November 11th, 2025
				var options = { year: 'numeric', month: 'long', day: 'numeric' };
				var dateStr = refreshDate.toLocaleDateString('en-US', options);

				// Format time: hh:mm:ss
				var hours = String(refreshDate.getHours()).padStart(2, '0');
				var minutes = String(refreshDate.getMinutes()).padStart(2, '0');
				var seconds = String(refreshDate.getSeconds()).padStart(2, '0');
				var timeStr = hours + ':' + minutes + ':' + seconds;

				var statusText = 'Showing results for ' + dateStr + ' - Data refreshed: ' + timeStr;
				
				var statusElement = document.querySelector('[data-id="statusText"]');
				if (statusElement) {
					statusElement.textContent = statusText;
					console.log("✓ Status message updated:", statusText);
				} else {
					console.warn("✗ Status element not found for update on first attempt - retrying...");
					
					// Retry with exponential backoff
					var retryCount = 0;
					var maxRetries = 5;
					
					var retryUpdate = function () {
						retryCount++;
						var retryElement = document.querySelector('[data-id="statusText"]');
						
						if (retryElement) {
							retryElement.textContent = statusText;
							console.log("✓ Status message updated (retry " + retryCount + "):", statusText);
						} else if (retryCount < maxRetries) {
							console.warn("✗ Status element still not found (retry " + retryCount + ") - retrying in 300ms...");
							setTimeout(retryUpdate, 300);
						} else {
							console.error("✗ Status element not found after " + maxRetries + " retries");
						}
					};
					
					setTimeout(retryUpdate, 300);
				}
			},

			_startAutoRefresh: function (card, model) {
				var that = this;

				// Clear any existing timer
				if (this.refreshTimerId) {
					clearInterval(this.refreshTimerId);
				}

				console.log("Starting auto-refresh timer with interval:", this.autoRefreshInterval, "ms");

				// Set up the auto-refresh interval
				this.refreshTimerId = setInterval(function () {
					console.log("Auto-refresh triggered");
					that.setLastRefreshedTime(model);
					that.loadCOFATasks(card, model);
				}, this.autoRefreshInterval);

				// Also add refresh button handler
				setTimeout(function () {
					var refreshButton = document.querySelector('[data-action="refresh"]');
					if (refreshButton) {
						refreshButton.style.cursor = "pointer";
						refreshButton.addEventListener("click", function (oEvent) {
							oEvent.stopPropagation();
							console.log("Manual refresh triggered");
							that.setLastRefreshedTime(model);
							that.loadCOFATasks(card, model);
						});
					}
				}, 500);
			},

			_stopAutoRefresh: function () {
				if (this.refreshTimerId) {
					console.log("Stopping auto-refresh timer");
					clearInterval(this.refreshTimerId);
					this.refreshTimerId = null;
				}
			},

			onCardTopPress: function (oEvent) {


				const source = oEvent.getSource();
				const customData = source.getCustomData();

				if (customData && customData.length > 0) {
					const value = customData[0].getValue();

				}
			},

			onTypePress: function (oEvent) {


				const source = oEvent.getSource();
				const customData = source.getCustomData();

				if (customData && customData.length >= 2) {
					const cardValue = customData[0].getValue();
					const typeValue = customData[1].getValue();

				}
			},

			loadCurrentUser: function (card, model) {

				var that = this;

				card.resolveDestination("SPNI_COFA_APPROVALPROCESS1")
					.then(function (destination) {

						const url = "/odata/v2/cofa/currentUser";
						const requestConfig = {
							url: destination + url,
							mode: "cors",
							method: "GET",
							dataType: "json",
							withCredentials: true,
							headers: {
								Accept: "application/json",
								"Content-Type": "application/json"
							}
						};


						model.setProperty("/TaskBusy", true);

						card.request(requestConfig)
							.then(function (response) {


								// Extract data from OData response - it's nested in response.d.currentUser
								var userData = (response.d && response.d.currentUser) ? response.d.currentUser : (response.d || response);

								console.log('UserData', userData)
								// Store user information
								model.setProperty("/CurrentUser", userData);
								model.setProperty("/UserRoles", userData.roles || []);


								// Filter and show only relevant cards based on user roles
								that._filterCardsByRoles(userData.roles || []);								// Now set up click handlers for visible cards only
								that._addTaskCardHandlers();

								// Then load task data
								that.setTaskData(card, model);

								// Start auto-refresh timer
								that._startAutoRefresh(card, model);
							})
							.catch(function (err) {
								console.error("currentUser API Error:", err);
								model.setProperty("/CurrentUser", null);
								model.setProperty("/UserRoles", []);
								model.setProperty("/TaskBusy", false);
							});
					})
					.catch(function (err) {
						console.log('CurrentUserCall failed', err)
						model.setProperty("/TaskBusy", false);
						model.setProperty("/CurrentUser", null);
						model.setProperty("/UserRoles", []);
					});
			},

			_filterCardsByRoles: function (userRoles) {

				var attemptFilter = function (attempt) {
					var allCards = document.querySelectorAll(".taskCard");

					if (allCards.length === 0 && attempt < 5) {
						// DOM not ready yet, try again
						console.warn("No cards found yet, retrying in 200ms...");
						setTimeout(function () {
							attemptFilter(attempt + 1);
						}, 200);
						return;
					}

					if (allCards.length === 0) {
						console.error("No cards found after 5 attempts!");
						return;
					}

					allCards.forEach(function (card) {
						var cardRole = card.getAttribute("data-role");
						var shouldShow = false;

						// Check if user has this role (including partial matches for INP prefix)
						for (var i = 0; i < userRoles.length; i++) {
							var userRole = userRoles[i];
							
							// Exact match (RCM, AGR, PERF, DCD)
							if (userRole === cardRole) {
								shouldShow = true;
								break;
							}
							
							// Special case: if card role is INP (Input Provider), match any role starting with INP
							if (cardRole === "INP" && userRole.indexOf("INP") === 0) {
								shouldShow = true;
								break;
							}
						}

						if (shouldShow) {
							card.style.display = "block";
						} else {
							card.style.display = "none";
						}
					});

				};

				// Start the first attempt
				setTimeout(function () {
					attemptFilter(1);
				}, 100);
			},

			loadCOFATasks: function (card, model) {
				console.log("Starting Request API call...");
				var that = this;

				// Get current user email from model
				var currentUser = model.getProperty("/CurrentUser");
				var userEmail = currentUser ? currentUser.userEmail : null;
				var userRoles = model.getProperty("/UserRoles") || [];

				if (!userEmail) {
					console.error("User email not found!");
					model.setProperty("/TaskBusy", false);
					return;
				}

				console.log("Loading tasks for user:", userEmail);
				console.log("User roles:", userRoles);

				card.resolveDestination("SPNI_COFA_APPROVALPROCESS1")
					.then(function (destination) {
						console.log("Request - Destination resolved:", destination);

						// IMPORTANT: Only create promises for roles the user has
						var rolePromises = userRoles.map(function (role) {
							return that._loadTasksForRole(card, destination, userEmail, role);
						});

						model.setProperty("/TaskBusy", true);

						// Wait for all role requests to complete
						Promise.all(rolePromises)
							.then(function (results) {
								console.log("All role data loaded successfully");

								// Wait a bit for DOM to be fully ready after filtering
								setTimeout(function () {
									// Process results - each result contains {role, data}
									results.forEach(function (result) {
										console.log("Processing data for role:", result.role);
										that._processRoleData(result.role, result.data);
									});
								}, 800); // Increased delay to ensure DOM is ready

								model.setProperty("/TaskBusy", false);
							})
							.catch(function (err) {
								console.error("Error loading tasks:", err);
								model.setProperty("/TaskBusy", false);
							});
					})
					.catch(function (err) {
						console.error("Request - Destination resolve error:", err);
						model.setProperty("/TaskBusy", false);
					});
			},

			_loadTasksForRole: function (card, destination, userEmail, role) {
				console.log("Loading tasks for role:", role);

				// Check if this is an Input Provider role (starts with INP)
				if (role.indexOf("INP") === 0) {
					// For Input Provider, use InputRequest API
					var filter = "requestedToEmail eq '" + userEmail + "' and status eq 'PENDING' and (isMandatory eq true or isMandatory eq false)";
					var url = "/odata/v2/cofa/InputRequest?$filter=" + encodeURIComponent(filter) + "&$inlinecount=allpages";

					var requestConfig = {
						url: destination + url,
						mode: "cors",
						method: "GET",
						dataType: "json",
						withCredentials: true,
						headers: {
							Accept: "application/json",
							"Content-Type": "application/json"
						}
					};

					return card.request(requestConfig)
						.then(function (response) {
							console.log("Input Provider InputRequest API response for role " + role + ":", response);
							var results = (response.d && response.d.results) ? response.d.results : [];
							var totalCount = (response.d && response.d.__count) ? parseInt(response.d.__count) : results.length;
							console.log("Number of input requests for " + role + ":", totalCount);
							// Return with totalCount from __count
							return { role: role, data: results, totalCount: totalCount };
						})
						.catch(function (err) {
							console.error("Error loading tasks for role " + role + ":", err);
							return { role: role, data: [], totalCount: 0 };
						});
				} else {
					// For other roles, use the existing Request API
					var filter = "pendingWithEmail eq '" + userEmail + "' and (stage eq '" + role + "' or stageId eq '" + role + "')";
								
					var url = "/odata/v2/cofa/Request?$filter=" + encodeURIComponent(filter);

					var requestConfig = {
						url: destination + url,
						mode: "cors",
						method: "GET",
						dataType: "json",
						withCredentials: true,
						headers: {
							Accept: "application/json",
							"Content-Type": "application/json"
						}
					};

					return card.request(requestConfig)
						.then(function (response) {
							console.log("Response for role " + role + ":", response);
							var results = (response.d && response.d.results) ? response.d.results : [];
							console.log("Number of requests for " + role + ":", results.length);
							return { role: role, data: results };
						})
						.catch(function (err) {
							console.error("Error loading tasks for role " + role + ":", err);
							return { role: role, data: [] };
						});
				}
			},

			_processRoleData: function (role, data) {
				
				var that = this;
				console.log("========================================");
				console.log("Processing role:", role, "with", data.length, "requests");
				console.log("Raw data:", JSON.stringify(data, null, 2));

				// Map role codes to element ID prefixes
				// Supports exact matches and prefix matches (e.g., INP, INP1, INP2, etc.)
				var roleMap = {
					"RCM": "recommender",
					"AGR": "agreer",
					"PERF": "performer",
					"DCD": "decider"
				};

				var elementPrefix = roleMap[role];
				
				// If no exact match, check for prefix matches
				if (!elementPrefix) {
					if (role.indexOf("INP") === 0) {
						// Any role starting with INP maps to inputProvider
						elementPrefix = "inputProvider";
						console.log("Role '" + role + "' matches INP prefix, mapping to 'inputProvider'");
					} else {
						console.warn("Unknown role:", role);
						return;
					}
				}

				// Calculate total count
				var totalCount = data.totalCount !== undefined ? data.totalCount : data.length;
				console.log("Total count for " + role + ":", totalCount);

				// Update total count for all roles
				this._updateElementText(elementPrefix + "Count", totalCount);

				// Get actual data array
				var actualData = data.data || data;

				// Count by request type for progress bars
				var typeCounts = {};
				
				// Count by aging for stacked bar
				var aging0to10 = 0;
				var aging10to20 = 0;
				var aging20plus = 0;

				actualData.forEach(function (request) {
					var requestType = request.requestType || "Unknown";
					console.log("Request type found:", requestType);
					typeCounts[requestType] = (typeCounts[requestType] || 0) + 1;
					
					// Count by aging for stacked bar
					var aging = request.aging || 0;
					if (aging <= 10) {
						aging0to10++;
					} else if (aging <= 20) {
						aging10to20++;
					} else {
						aging20plus++;
					}
				});

				console.log("Type counts:", typeCounts);
				console.log("Stacked bar counts by aging - 0-10:", aging0to10, "10-20:", aging10to20, "20+:", aging20plus);

				// Update stacked bar with aging-based values (for ALL roles including Input Provider)
				this._updateStackedBar(elementPrefix, aging0to10, aging10to20, aging20plus);

				// Update detail counts based on role
				if (elementPrefix === "inputProvider") {
					console.log("Input Provider count updated to:", totalCount);
					
					// Count mandatory vs non-mandatory from the data
					var mandatoryCount = 0;
					var nonMandatoryCount = 0;
					
					actualData.forEach(function (request) {
						if (request.isMandatory === true) {
							mandatoryCount++;
						} else if (request.isMandatory === false) {
							nonMandatoryCount++;
						}
					});
					
					console.log("Input Provider - Mandatory:", mandatoryCount, "Non-Mandatory:", nonMandatoryCount);
					
					this._updateProgressBar(elementPrefix + "Mandatory", mandatoryCount, totalCount > 0 ? totalCount : 1);
					this._updateProgressBar(elementPrefix + "NonMandatory", nonMandatoryCount, totalCount > 0 ? totalCount : 1);
					console.log("========================================");
					return;
				}

				// For other roles, process progress bars
				var fundCountBar = typeCounts["Fund"] || 0;
				var contentCountBar = typeCounts["Content"] || 0;
				var expenseCountBar = typeCounts["Specified Expense"] || 0;
				var nonPOCountBar = typeCounts["Non PO"] || 0;

				// Count content-related types (Content, ContentGate1, ContentGate2, etc.)
				contentCountBar = 0;
				Object.keys(typeCounts).forEach(function(requestType) {
				    if (requestType === "Content" || requestType.indexOf("ContentGate") === 0) {
				        contentCountBar += typeCounts[requestType];
				    }
				});

				console.log("Updating " + role + " with progress bars - Fund:", fundCountBar, "Content:", contentCountBar, "Expense:", expenseCountBar, "NonPO:", nonPOCountBar);
				this._updateProgressBar(elementPrefix + "Fund", fundCountBar, totalCount);
				this._updateProgressBar(elementPrefix + "Content", contentCountBar, totalCount);
				this._updateProgressBar(elementPrefix + "Expense", expenseCountBar, totalCount);
				this._updateProgressBar(elementPrefix + "NonPO", nonPOCountBar, totalCount);

				console.log("========================================");
			},

			_updateProgressBar: function (elementId, count, total) {
				// Update the text value
				this._updateElementText(elementId, count);

				// Update the progress bar width
				var percentage = total > 0 ? (count / total) * 100 : 0;
				var barElement = document.querySelector('[data-id="' + elementId + '-bar"]');

				if (barElement) {
					barElement.style.width = percentage + '%';
					console.log("✓ Updated progress bar", elementId, "to", percentage + '%');
				} else {
					console.warn("✗ Progress bar not found:", elementId + '-bar');
					// Retry after delay
					var that = this;
					setTimeout(function () {
						var retryBar = document.querySelector('[data-id="' + elementId + '-bar"]');
						if (retryBar) {
							retryBar.style.width = percentage + '%';
							console.log("✓ Updated progress bar (retry)", elementId, "to", percentage + '%');
						}
					}, 300);
				}
			},

			_updateStackedBar: function (elementPrefix, aging0to10, aging10to20, aging20plus) {
				var that = this;
				var total = aging0to10 + aging10to20 + aging20plus;
				
				console.log("Updating stacked bar for", elementPrefix, "- 0-10 days:", aging0to10, "10-20 days:", aging10to20, "20+ days:", aging20plus, "Total:", total);

				if (total === 0) {
					console.warn("No data for stacked bar");
					return;
				}

				// Calculate percentages
				var percentage0to10 = (aging0to10 / total) * 100;
				var percentage10to20 = (aging10to20 / total) * 100;
				var percentage20plus = (aging20plus / total) * 100;

				console.log("Percentages - 0-10 days:", percentage0to10.toFixed(2), "% 10-20 days:", percentage10to20.toFixed(2), "% 20+ days:", percentage20plus.toFixed(2), "%");

				// Find the stacked bar container for this card
				var cardSelector = '.' + elementPrefix;
				if (elementPrefix === "inputProvider") {
					cardSelector = '.taskCard.inputProvider';
				} else if (elementPrefix === "recommender") {
					cardSelector = '.taskCard.recommender';
				} else if (elementPrefix === "agreer") {
					cardSelector = '.taskCard.agreer';
				} else if (elementPrefix === "performer") {
					cardSelector = '.taskCard.performer';
				} else if (elementPrefix === "decider") {
					cardSelector = '.taskCard.decider';
				}

				var card = document.querySelector(cardSelector);
				if (!card) {
					console.warn("Card not found:", cardSelector);
					return;
				}

				var stackedBar = card.querySelector('.stackedBar');
				if (!stackedBar) {
					console.warn("Stacked bar not found in card");
					return;
				}

				// Update the segments - ALL cards have 3 segments for aging
				var segments = stackedBar.querySelectorAll('.stackedBarSegment');
				
				if (segments.length >= 3) {
					// Update 0-10 days segment (blue/fundSegment)
					segments[0].style.width = percentage0to10 + '%';
					segments[0].querySelector('.segmentValue').textContent = aging0to10 > 0 ? aging0to10 : '';
					segments[0].setAttribute('title', '0-10 days: ' + aging0to10);

					// Update 10-20 days segment (green/contentSegment)
					segments[1].style.width = percentage10to20 + '%';
					segments[1].querySelector('.segmentValue').textContent = aging10to20 > 0 ? aging10to20 : '';
					segments[1].setAttribute('title', '10-20 days: ' + aging10to20);

					// Update 20+ days segment (orange/expenseSegment)
					segments[2].style.width = percentage20plus + '%';
					segments[2].querySelector('.segmentValue').textContent = aging20plus > 0 ? aging20plus : '';
					segments[2].setAttribute('title', '20+ days: ' + aging20plus);

					console.log("✓ Stacked bar updated successfully for", elementPrefix);
				} else {
					console.warn("Not enough segments found in stacked bar");
				}
			},

			_updateElementText: function (elementId, value) {
				var that = this;
				var element = document.querySelector('[data-id="' + elementId + '"]');

				if (element) {
					element.textContent = value;
					console.log("✓ Updated", elementId, "to", value);
				} else {
					console.warn("✗ Element not found on first attempt:", elementId);

					// Try again after a delay with multiple retries
					var retryCount = 0;
					var maxRetries = 3;

					var retryUpdate = function () {
						retryCount++;
						var retryElement = document.querySelector('[data-id="' + elementId + '"]');

						if (retryElement) {
							retryElement.textContent = value;
							console.log("✓ Updated (retry " + retryCount + ")", elementId, "to", value);
						} else if (retryCount < maxRetries) {
							console.warn("✗ Element still not found (retry " + retryCount + "):", elementId, "- Retrying in 300ms...");
							setTimeout(retryUpdate, 300);
						} else {
							console.error("✗ Element not found after " + maxRetries + " retries:", elementId);
							// Log available elements with data-id for debugging
							var allElements = document.querySelectorAll('[data-id]');
							console.log("Available elements with data-id:", Array.from(allElements).map(function (el) { return el.getAttribute('data-id'); }));
						}
					};

					setTimeout(retryUpdate, 300);
				}
			},
			_addTaskCardHandlers: function () {
				var that = this;

				setTimeout(function () {
					var aTaskCards = document.querySelectorAll(".taskCard");

					if (aTaskCards.length === 0) {
						console.warn("No task cards found! Trying again in 500ms...");
						setTimeout(function () {
							that._addTaskCardHandlers();
						}, 500);
						return;
					}

					// Add handler for "All Tasks" header using data attribute
					var allTasksHeader = document.querySelector('[data-action="allTasks"]');
					if (allTasksHeader) {
						allTasksHeader.style.cursor = "pointer";
						allTasksHeader.addEventListener("click", function (oEvent) {
							console.log("All Tasks header clicked");
							that._onAllTasksClick();
						});
					}

					aTaskCards.forEach(function (oCard, index) {
						var sRole = oCard.getAttribute("data-role");

						oCard.addEventListener("click", function (oEvent) {
							var oTarget = oEvent.target;
							var oDetailLabel = oTarget.closest(".taskDetailLabel");

							if (oDetailLabel) {
								return;
							}

							console.log("CLICK EVENT FIRED on card:", this.getAttribute("data-role"));
							var sCardRole = this.getAttribute("data-role");
							that._onTaskCardClick(sCardRole, null);
						});

						// Add handlers for progress bar labels
						var aDetailLabels = oCard.querySelectorAll(".taskDetailLabel[data-type]");
						aDetailLabels.forEach(function (oLabel) {
							oLabel.addEventListener("click", function (oEvent) {
								oEvent.stopPropagation();
								var sCardRole = oCard.getAttribute("data-role");
								var sType = this.getAttribute("data-type");
								console.log("PROGRESS BAR LABEL CLICKED - Role:", sCardRole, "Type:", sType);
								that._onTaskCardClick(sCardRole, sType);
							});
						});

						oCard.style.cursor = "pointer";
					});

					console.log("All handlers attached successfully!");
				}, 500);
			},

			_onAllTasksClick: function () {

				const oComponent = this.getOwnerComponent();
				const oCard = oComponent.card;
				const oParameters = oCard.getCombinedParameters();

				try {
					const sSemanticObject = ["managed", "create"][0];
					const sAction = ["managed", "create"][1];

					if (sSemanticObject && sAction) {
						const oParams = {
							role: 'AP'
						};

						const oNavigationConfig = {
							ibnTarget: {
								semanticObject: sSemanticObject,
								action: sAction
							},
							ibnParams: oParams
						};

						console.log("All Tasks Navigation parameters:", oNavigationConfig);
						oCard.triggerAction({
							type: "Navigation",
							parameters: oNavigationConfig
						});
					} else {
						throw new Error("Provide Semantic object and action details");
					}
				} catch (error) {
					console.log(error);
					MessageBox.error(oI18n.getResourceBundle().getText("invalidParameterText"));
				}
			},

			_onTaskCardClick: function (sRole, sType) {

				const oComponent = this.getOwnerComponent();
				const oCard = oComponent.card;
				const oParameters = oCard.getCombinedParameters();

				try {
					const sSemanticObject = ["managed", "create"][0];
					const sAction = ["managed", "create"][1];

					if (sSemanticObject && sAction) {
						const oParams = {
							role: 'AP',
							stage: sRole
						};

						if (sType) {
							// Convert type to lowercase for API compatibility (e.g., "Fund" -> "fund", "Mandatory" -> "mandatory")
							oParams.type = sType.toLowerCase();
						}

						const oNavigationConfig = {
							ibnTarget: {
								semanticObject: sSemanticObject,
								action: sAction
							},
							ibnParams: oParams
						};

						console.log("Navigation parameters:", oNavigationConfig);
						oCard.triggerAction({
							type: "Navigation",
							parameters: oNavigationConfig
						});
					} else {
						throw new Error("Provide Semantic object and action details");
					}
				} catch (error) {
					console.log(error);
					MessageBox.error(oI18n.getResourceBundle().getText("invalidParameterText"));
				}
			},
		});
	}
);