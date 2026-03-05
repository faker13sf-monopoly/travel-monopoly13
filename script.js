/**
 * Wanderlust - Travel Itinerary App
 * Core Logic
 */

// --- State Management ---
const State = {
    trips: [], // Array of trip objects
    currentTripId: null,
    settings: {
        theme: 'indigo',
        currency: 'JPY'
    },

    init() {
        const storedTrips = localStorage.getItem('wanderlust_trips');
        if (storedTrips) {
            this.trips = JSON.parse(storedTrips);
        }

        const storedSettings = localStorage.getItem('wanderlust_settings');
        if (storedSettings) {
            this.settings = JSON.parse(storedSettings);
        }

        // Apply theme immediately
        document.body.setAttribute('data-theme', this.settings.theme);
    },

    save() {
        localStorage.setItem('wanderlust_trips', JSON.stringify(this.trips));
    },

    saveSettings() {
        localStorage.setItem('wanderlust_settings', JSON.stringify(this.settings));
        document.body.setAttribute('data-theme', this.settings.theme);
    },

    setTheme(themeName) {
        this.settings.theme = themeName;
        this.saveSettings();
    },

    // Global setCurrency removed - now per trip

    addTrip(trip) {
        this.trips.push(trip);
        this.save();
    },

    deleteTrip(id) {
        this.trips = this.trips.filter(t => t.id !== id);
        this.save();
    },

    getTrip(id) {
        return this.trips.find(t => t.id === id);
    },

    addActivity(tripId, activity) {
        const trip = this.getTrip(tripId);
        if (trip) {
            if (!trip.activities) trip.activities = [];
            trip.activities.push(activity);
            this.save();
        }
    },

    deleteActivity(tripId, activityId) {
        const trip = this.getTrip(tripId);
        if (trip && trip.activities) {
            trip.activities = trip.activities.filter(a => a.id !== activityId);
            this.save();
        }
    }
};

// --- DOM Elements ---
const DOM = {
    views: {
        dashboard: document.getElementById('dashboard-view'),
        detail: document.getElementById('trip-detail-view'),
        settings: document.getElementById('settings-view'),
    },
    containers: {
        trips: document.getElementById('trips-container'),
        emptyState: document.getElementById('trips-empty-state'),
        daysNav: document.getElementById('days-nav'),
        itinerary: document.getElementById('itinerary-container'),
        themePicker: document.getElementById('theme-color-picker'),
    },
    modals: {
        overlay: document.getElementById('modal-overlay'),
        createTrip: document.getElementById('modal-create-trip'),
        addActivity: document.getElementById('modal-add-activity'),
    },
    buttons: {
        newTrip: document.getElementById('btn-new-trip'),
        closeModals: document.querySelectorAll('.btn-close-modal'),
        backToDashboard: document.getElementById('btn-back-to-dashboard'),
        editTrip: document.getElementById('btn-edit-trip'),
        deleteTrip: document.getElementById('btn-delete-trip'),
        addActivity: document.getElementById('btn-add-activity'),
        submitActivity: document.querySelector('#form-add-activity button[type="submit"]'),
    },
    forms: {
        createTrip: document.getElementById('form-create-trip'),
        addActivity: document.getElementById('form-add-activity'),
    },
    detailHeader: {
        title: document.getElementById('detail-trip-title'),
        dates: document.getElementById('detail-trip-dates'),
        totalCost: document.getElementById('trip-total-cost'),
    },
    inputs: {
        tripId: document.getElementById('trip-id'),
        sortTrips: document.getElementById('sort-trips'),
        currency: document.getElementById('setting-currency'),
        activityDay: document.getElementById('activity-day-select'),
        activityTripId: document.getElementById('activity-trip-id'),
        activityId: (function () {
            let el = document.getElementById('activity-id');
            if (!el) {
                el = document.createElement('input');
                el.type = 'hidden';
                el.id = 'activity-id';
                document.getElementById('form-add-activity').appendChild(el);
            }
            return el;
        })()
    }
};

// --- Utilities ---
const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    // Helper to parse "YYYY-MM-DD" as local date (00:00:00)
    parseDate: (dateStr) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        return new Date(parts[0], parts[1] - 1, parts[2]);
    },
    formatDate: (dateStr) => {
        // Use parseDate to ensure we treat it as local date
        const date = typeof dateStr === 'string' ? Utils.parseDate(dateStr) : dateStr;

        // Enforce English locale for weekday
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        return `${datePart} ${dayName}`;
    },
    getDaysArray: (start, end) => {
        const arr = [];
        let dt = Utils.parseDate(start);
        const endDate = Utils.parseDate(end);
        while (dt <= endDate) {
            arr.push(new Date(dt));
            dt.setDate(dt.getDate() + 1);
        }
        return arr;
    },
    formatDayDate: (dateObj) => {
        // Enforce English locale for weekday to get Mon, Tue etc.
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const datePart = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `${datePart} ${dayName}`;
    },
    calculateDuration: (start, end) => {
        if (!start || !end) return '';
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);

        let diffM = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffM < 0) diffM += 24 * 60; // Handle midnight crossing roughly

        const h = Math.floor(diffM / 60);
        const m = diffM % 60;

        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    },
    formatCurrency: (amount, currencyCode = 'JPY') => {
        const val = parseFloat(amount);
        if (isNaN(val)) return '';
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(val);
    },
    calculateExpression: (expression) => {
        if (!expression) return '';
        // Allow digits, dot, spaces, and operators +, -, *, /, (, )
        if (/^[0-9+\-*/().\s]+$/.test(expression)) {
            try {
                // Safe evaluation
                return new Function('return ' + expression)();
            } catch (e) {
                console.error('Calculation error', e);
                return expression; // Return original on error
            }
        }
        return expression;
    }
};

// --- App Controller ---
const App = {
    init() {
        State.init();
        this.setupEventListeners();
        this.renderDashboard();
        this.renderSettings();
    },

    setupEventListeners() {
        // Navigation (Main)
        document.querySelectorAll('.sidebar li[data-view]').forEach(li => {
            li.addEventListener('click', () => {
                if (li.classList.contains('disabled')) return;

                const viewName = li.dataset.view;
                this.switchView(viewName);

                // Update Sidebar Active state
                document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
            });
        });

        // Navigation (Internal)
        DOM.buttons.backToDashboard.addEventListener('click', () => {
            this.switchView('dashboard');
            // Update sidebar
            document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
            document.querySelector('.sidebar li[data-view="dashboard"]').classList.add('active');
        });

        // Modals
        DOM.buttons.newTrip.addEventListener('click', () => {
            DOM.inputs.tripId.value = '';
            document.querySelector('#modal-create-trip h2').textContent = 'Create New Trip';
            document.querySelector('#form-create-trip button[type="submit"]').textContent = 'Create Trip';
            document.getElementById('form-create-trip').reset();
            this.openModal('createTrip');
        });

        if (DOM.buttons.editTrip) {
            DOM.buttons.editTrip.addEventListener('click', () => this.openEditTrip());
        }

        DOM.buttons.addActivity.addEventListener('click', () => {
            // Populate day select options first
            this.populateActivityDaySelect();
            DOM.inputs.activityTripId.value = State.currentTripId;
            DOM.inputs.activityId.value = ''; // Reset ID for new
            DOM.buttons.submitActivity.textContent = 'Add Activity';
            document.querySelector('#modal-add-activity h2').textContent = 'Add Activity';

            // Auto-fill Start Time from previous activity's Finish Time
            let defaultStartTime = '';
            const trip = State.getTrip(State.currentTripId);
            if (trip && trip.activities && trip.activities.length > 0) {
                // Sort activities to find the latest one
                const sortedActivities = [...trip.activities].sort((a, b) => {
                    const dateA = new Date(`${a.day}T${a.time}`);
                    const dateB = new Date(`${b.day}T${b.time}`);
                    return dateA - dateB;
                });
                const lastActivity = sortedActivities[sortedActivities.length - 1];
                if (lastActivity) {
                    // Default to endTime if available, otherwise reuse start time
                    defaultStartTime = lastActivity.endTime || lastActivity.time;
                    // Always set default day to the last activity's day
                    DOM.inputs.activityDay.value = lastActivity.day;
                }
            }

            document.getElementById('activity-time').value = defaultStartTime;
            document.getElementById('activity-end-time').value = '';

            document.getElementById('activity-title').value = '';
            document.getElementById('activity-cost').value = '';
            document.getElementById('activity-notes').value = '';

            this.openModal('addActivity');
        });

        DOM.buttons.closeModals.forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // DOM.modals.overlay.addEventListener('click', (e) => {
        //     if (e.target === DOM.modals.overlay) this.closeModals();
        // });

        // Forms
        DOM.forms.createTrip.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateTrip();
        });

        DOM.forms.addActivity.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddActivity();
        });

        // Calculate Cost on Change
        const costInput = document.getElementById('activity-cost');
        if (costInput) {
            costInput.addEventListener('change', (e) => {
                const result = Utils.calculateExpression(e.target.value);
                // If result is valid number, update field (rounded to 2 decimals if float)
                if (!isNaN(parseFloat(result)) && isFinite(result)) {
                    e.target.value = Math.round(parseFloat(result) * 100) / 100;
                }
            });
        }

        // Global Currency Change Listener Removed

        // Delete Trip
        DOM.buttons.deleteTrip.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this trip?')) {
                State.deleteTrip(State.currentTripId);
                this.switchView('dashboard');
            }
        });
        // Sort Change Listener
        if (DOM.inputs.sortTrips) {
            DOM.inputs.sortTrips.addEventListener('change', () => {
                this.renderDashboard();
            });
        }
    },

    switchView(viewName) {
        // Hide all views
        Object.values(DOM.views).forEach(el => {
            el.classList.remove('active');
            el.classList.add('hidden');
        });

        // Show target view
        if (DOM.views[viewName]) {
            DOM.views[viewName].classList.remove('hidden');
            // Small delay to allow CSS transition if active has properties
            setTimeout(() => {
                DOM.views[viewName].classList.add('active');
            }, 10);
        }

        // Manage Add Activity Button Visibility
        const btnAddActivity = document.getElementById('btn-add-activity');
        if (btnAddActivity) {
            if (viewName === 'detail') {
                btnAddActivity.classList.remove('hidden');
            } else {
                btnAddActivity.classList.add('hidden');
            }
        }

        if (viewName === 'dashboard') this.renderDashboard();
        window.scrollTo(0, 0);
    },

    openModal(modalName) {
        DOM.modals.overlay.classList.remove('hidden');
        // Hide all modals
        Object.values(DOM.modals).forEach(el => {
            if (el !== DOM.modals.overlay) el.classList.add('hidden');
        });
        // Show specific
        DOM.modals[modalName].classList.remove('hidden');
    },

    closeModals() {
        DOM.modals.overlay.classList.add('hidden');
        DOM.forms.createTrip.reset();
        DOM.forms.addActivity.reset();
    },

    // --- Dashboard Logic ---
    handleCreateTrip() {
        const tripId = DOM.inputs.tripId.value;
        const destination = document.getElementById('trip-destination').value;
        const startDate = document.getElementById('trip-start-date').value;
        const endDate = document.getElementById('trip-end-date').value;
        const imageUrl = document.getElementById('trip-image-url').value;
        const currency = document.getElementById('trip-currency').value;

        if (new Date(startDate) > new Date(endDate)) {
            alert('End date cannot be before start date.');
            return;
        }

        if (tripId) {
            // Update existing
            const trip = State.getTrip(tripId);
            if (trip) {
                trip.destination = destination;
                trip.startDate = startDate;
                trip.endDate = endDate;
                trip.imageUrl = imageUrl || null;
                trip.currency = currency || 'JPY';
                State.save();

                if (State.currentTripId === tripId) {
                    DOM.detailHeader.title.textContent = trip.destination;
                    DOM.detailHeader.dates.textContent = `${Utils.formatDate(trip.startDate)} - ${Utils.formatDate(trip.endDate)}`;
                    this.renderItinerary(trip);
                }
            }
        } else {
            // Create new
            const newTrip = {
                id: Utils.generateId(),
                destination,
                startDate,
                endDate,
                imageUrl: imageUrl || null,
                currency: currency || 'JPY',
                activities: []
            };
            State.addTrip(newTrip);
        }

        this.closeModals();
        this.renderDashboard();
    },

    renderDashboard() {
        DOM.containers.trips.innerHTML = '';

        if (State.trips.length === 0) {
            DOM.containers.emptyState.classList.remove('hidden');
        } else {
            DOM.containers.emptyState.classList.add('hidden');

            // Apply Sorting
            const sortValue = DOM.inputs.sortTrips ? DOM.inputs.sortTrips.value : 'date-desc';
            const sortedTrips = [...State.trips].sort((a, b) => {
                const dateA = Utils.parseDate(a.startDate);
                const dateB = Utils.parseDate(b.startDate);
                if (sortValue === 'date-asc') {
                    return dateA - dateB;
                } else if (sortValue === 'date-desc') {
                    return dateB - dateA;
                } else if (sortValue === 'name-asc') {
                    return a.destination.localeCompare(b.destination);
                } else if (sortValue === 'name-desc') {
                    return b.destination.localeCompare(a.destination);
                }
                return 0;
            });

            sortedTrips.forEach(trip => {
                const card = this.createTripCard(trip);
                DOM.containers.trips.appendChild(card);
            });
        }
    },

    createTripCard(trip) {
        const div = document.createElement('div');
        div.className = 'trip-card';
        div.onclick = () => this.openTripDetail(trip.id);

        const imgDiv = document.createElement('div');
        if (trip.imageUrl) {
            imgDiv.innerHTML = `<img src="${trip.imageUrl}" class="trip-image" alt="${trip.destination}">`;
        } else {
            imgDiv.className = 'trip-image-placeholder';
            imgDiv.innerHTML = `<ion-icon name="airplane"></ion-icon>`;
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'trip-info';

        const title = document.createElement('div');
        title.className = 'trip-title';
        title.textContent = trip.destination;

        const date = document.createElement('div');
        date.className = 'trip-date';
        date.innerHTML = `<ion-icon name="calendar-outline"></ion-icon> ${Utils.formatDate(trip.startDate)} - ${Utils.formatDate(trip.endDate)}`;

        infoDiv.appendChild(title);
        infoDiv.appendChild(date);
        div.appendChild(imgDiv);
        div.appendChild(infoDiv);

        return div;
    },

    // --- Trip Detail Logic ---
    openTripDetail(tripId) {
        State.currentTripId = tripId;
        const trip = State.getTrip(tripId);
        if (!trip) return;

        DOM.detailHeader.title.textContent = trip.destination;
        DOM.detailHeader.dates.textContent = `${Utils.formatDate(trip.startDate)} - ${Utils.formatDate(trip.endDate)}`;

        this.renderItinerary(trip);
        this.switchView('detail');
    },

    openEditTrip() {
        const trip = State.getTrip(State.currentTripId);
        if (!trip) return;

        DOM.inputs.tripId.value = trip.id;
        document.getElementById('trip-destination').value = trip.destination;
        document.getElementById('trip-start-date').value = trip.startDate;
        document.getElementById('trip-end-date').value = trip.endDate;
        document.getElementById('trip-image-url').value = trip.imageUrl || '';
        document.getElementById('trip-currency').value = trip.currency || 'JPY';

        document.querySelector('#modal-create-trip h2').textContent = 'Edit Trip';
        document.querySelector('#form-create-trip button[type="submit"]').textContent = 'Update Trip';

        this.openModal('createTrip');
    },

    renderItinerary(trip) {
        const days = Utils.getDaysArray(trip.startDate, trip.endDate);
        const currencyCode = trip.currency || 'JPY';
        DOM.containers.daysNav.innerHTML = '';
        DOM.containers.itinerary.innerHTML = '';

        let grandTotal = 0;

        days.forEach((day, index) => {
            const dayId = `day-${index}`;
            const dateStr = day.toISOString().split('T')[0];

            // 1. Navigation Anchor
            const anchor = document.createElement('div');
            anchor.className = 'day-anchor';
            anchor.textContent = `Day ${index + 1}`;
            anchor.onclick = () => {
                const el = document.getElementById(dayId);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            };
            DOM.containers.daysNav.appendChild(anchor);

            // 2. Day Section
            const section = document.createElement('div');
            section.className = 'day-section';
            section.id = dayId;

            section.innerHTML = `
                <div class="day-header">
                    <h3>Day ${index + 1}</h3>
                    <span>${Utils.formatDayDate(day)}</span>
                </div>
                <div class="timeline-list" id="timeline-${dateStr}">
                    <!-- Activities will go here -->
                </div>
                <div class="daily-subtotal" id="subtotal-${dateStr}"></div>
            `;

            DOM.containers.itinerary.appendChild(section);

            // 3. Render Activities for this day
            const container = section.querySelector('.timeline-list');
            const dailyActivities = (trip.activities || []).filter(a => a.day === dateStr);
            dailyActivities.sort((a, b) => a.time.localeCompare(b.time));

            let dayTotal = 0;

            if (dailyActivities.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No activities.</p>';
            } else {
                dailyActivities.forEach(activity => {
                    container.appendChild(this.createTimelineItem(activity, trip.id));
                    const costVal = parseFloat(activity.cost);
                    if (!isNaN(costVal)) {
                        dayTotal += costVal;
                    }
                });
            }

            if (dayTotal > 0) {
                grandTotal += dayTotal;
                section.querySelector('.daily-subtotal').textContent = `Subtotal: ${Utils.formatCurrency(dayTotal, currencyCode)}`;
            } else {
                section.querySelector('.daily-subtotal').style.display = 'none';
            }
        });

        // Update Grand Total in Header
        if (DOM.detailHeader.totalCost) {
            DOM.detailHeader.totalCost.textContent = `Total: ${Utils.formatCurrency(grandTotal, currencyCode)}`;
        }
    },

    createTimelineItem(activity, tripId) {
        const trip = State.getTrip(tripId);
        const currency = trip ? (trip.currency || 'JPY') : 'JPY';

        const div = document.createElement('div');
        div.className = 'timeline-item';

        // Always use default icon
        let iconName = 'location-outline';

        div.innerHTML = `
            <div class="icon-column">
                <div class="timeline-icon-box">
                    <ion-icon name="${iconName}"></ion-icon>
                </div>
            </div>

            <div class="time-column">
                <span class="time-start">${activity.time}</span>
                ${activity.endTime ? `
                    <div class="time-connector-wrapper">
                        <div class="time-connector"></div>
                    </div>
                    <span class="time-end">${activity.endTime}</span>
                ` : ''}
                ${activity.time && activity.endTime ? `<span class="time-duration">${Utils.calculateDuration(activity.time, activity.endTime)}</span>` : ''}
            </div>
            
            <div class="timeline-content" onclick="App.openEditActivity('${tripId}', '${activity.id}')">
                 <ion-icon name="trash-outline" class="btn-delete-activity" onclick="event.stopPropagation(); App.handleDeleteActivity('${tripId}', '${activity.id}')"></ion-icon>
                <div class="timeline-content-header">
                    <div class="activity-title">${activity.title}</div>
                    ${activity.notes ? `<div class="activity-notes-inline">${activity.notes}</div>` : ''}
                </div>
                <div class="activity-type">
                     ${activity.cost ? `<span class="activity-cost-badge"><ion-icon name="wallet-outline"></ion-icon> ${Utils.formatCurrency(activity.cost, currency)}</span>` : ''}
                </div>
            </div>
        `;
        return div;
    },

    // --- Settings Logic ---
    renderSettings() {
        // Theme Picker
        const colors = [
            { id: 'indigo', hex: '#4f46e5' },
            { id: 'rose', hex: '#e11d48' },
            { id: 'emerald', hex: '#059669' },
            { id: 'amber', hex: '#d97706' },
            { id: 'sky', hex: '#0284c7' }
        ];

        DOM.containers.themePicker.innerHTML = '';
        colors.forEach(color => {
            const div = document.createElement('div');
            div.className = `color-option ${State.settings.theme === color.id ? 'active' : ''}`;
            div.style.backgroundColor = color.hex;
            div.onclick = () => {
                State.setTheme(color.id);
                this.renderSettings();
            };
            DOM.containers.themePicker.appendChild(div);
        });

        if (DOM.inputs.currency) {
            // DOM.inputs.currency no longer exists in Settings
            // Kept listener attached just in case but element is gone from definition
        }
    },

    populateActivityDaySelect() {
        const trip = State.getTrip(State.currentTripId);
        const select = DOM.inputs.activityDay;
        select.innerHTML = '';

        if (trip) {
            const days = Utils.getDaysArray(trip.startDate, trip.endDate);
            days.forEach((day, index) => {
                const option = document.createElement('option');
                // Store date string as value
                option.value = day.toISOString().split('T')[0];
                option.textContent = `Day ${index + 1} - ${Utils.formatDayDate(day)}`;
                select.appendChild(option);
            });
        }
    },

    openEditActivity(tripId, activityId) {
        const trip = State.getTrip(tripId);
        const activity = trip.activities.find(a => a.id === activityId);
        if (!activity) return;

        // Populate Form
        this.populateActivityDaySelect();
        DOM.inputs.activityTripId.value = tripId;
        DOM.inputs.activityId.value = activityId;

        DOM.inputs.activityDay.value = activity.day;
        document.getElementById('activity-time').value = activity.time;
        document.getElementById('activity-end-time').value = activity.endTime || '';
        // document.getElementById('activity-type').value = activity.type;
        document.getElementById('activity-title').value = activity.title;
        document.getElementById('activity-cost').value = activity.cost || '';
        document.getElementById('activity-notes').value = activity.notes;

        // Update UI Text
        DOM.buttons.submitActivity.textContent = 'Update Activity';
        document.querySelector('#modal-add-activity h2').textContent = 'Edit Activity';

        this.openModal('addActivity');
    },

    handleAddActivity() {
        const tripId = DOM.inputs.activityTripId.value;
        const activityId = DOM.inputs.activityId.value; // Helper: Check if edit

        const day = DOM.inputs.activityDay.value;
        const time = document.getElementById('activity-time').value;
        const endTime = document.getElementById('activity-end-time').value;
        // const type = document.getElementById('activity-type').value;
        const title = document.getElementById('activity-title').value;
        const cost = document.getElementById('activity-cost').value;
        const notes = document.getElementById('activity-notes').value;

        // Basic validation
        if (!time) { alert('Please enter start time'); return; }

        const activityData = {
            id: activityId || Utils.generateId(), // Reuse ID if editing
            day,
            time,
            endTime,
            // type,
            title,
            cost: cost || '',
            notes
        };

        if (activityId) {
            // Update existing
            const trip = State.getTrip(tripId);
            if (trip && trip.activities) {
                const idx = trip.activities.findIndex(a => a.id === activityId);
                if (idx !== -1) {
                    trip.activities[idx] = activityData;
                    State.save();
                }
            }
        } else {
            // Create new
            State.addActivity(tripId, activityData);
        }

        this.closeModals();

        // Reload Itinerary
        const trip = State.getTrip(tripId);
        this.renderItinerary(trip);
    },

    handleDeleteActivity(tripId, activityId) {
        if (confirm('Delete this activity?')) {
            State.deleteActivity(tripId, activityId);
            const trip = State.getTrip(tripId);
            this.renderItinerary(trip);
        }
    }
};

// Functions exposed to global scope for inline onclicks
window.App = App;

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
