/**
 * Practica Application Logic
 */

const App = {
    state: {
        user: null, // Who's steering the ship today?
        currentWorkspace: null,
        workspaces: [],
        view: 'board', // Board view is king for at-a-glance status.
        calendarDate: new Date(),
        placeholders: [],
        // New features:
        categories: [],
        events: [], // Formerly "trips" - sounds much more professional for the cluster.
        eventItems: [],
        assignments: [],
        currentEvent: null,
        currentEventItems: [],
        currentEventAssignments: [],
        editingItem: null,
        shouldRefreshBoard: false
    },

    init: async () => {
        console.log("Practica initializing...");

        // Load saved theme preference
        if (localStorage.getItem('practica_theme') === 'dark') {
            document.documentElement.classList.add('dark-theme');
        }

        // Close modal on outside click
        document.getElementById('modal-container').addEventListener('mousedown', function (e) {
            if (e.target === this) {
                App.closeModal();
            }
        });

        // Load fun placeholders
        try {
            const res = await fetch('placeholders.json');
            App.state.placeholders = await res.json();
        } catch (e) {
            console.error("Failed to load placeholders:", e);
            App.state.placeholders = ["Add a new item..."];
        }

        await App.checkAuth();
    },

    // --- Helpers ---
    formatTime: (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${m} ${ampm}`;
    },
    getUserAvatar: (username) => {
        if (!username) return { icon: 'fa-user', color: '#999' };
        const icons = ['fa-cat', 'fa-dog', 'fa-hippo', 'fa-otter', 'fa-frog', 'fa-kiwi-bird', 'fa-fish', 'fa-dove', 'fa-dragon', 'fa-horse'];
        const colors = ['#f4a261', '#2a9d8f', '#e9c46a', '#e76f51', '#264653', '#8ab17d', '#b56576', '#a8dadc', '#457b9d', '#1d3557'];

        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }

        const index = Math.abs(hash);
        return {
            icon: icons[index % icons.length],
            color: colors[index % colors.length]
        };
    },

    // --- API Interactions ---
    api: async (data) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000); // 5 sec timeout

            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(id);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("API Error (Non-JSON):", text);
                return { error: "Server Error: " + text.substring(0, 100) };
            }
        } catch (error) {
            console.error("API Error:", error);
            return { error: "Network error" };
        }
    },

    // --- Authentication ---
    checkAuth: async () => {
        const res = await App.api({ action: 'check_auth' });
        if (res.authenticated) {
            App.state.user = res.user;
            App.loadWorkspaces(); // Load workspaces after auth
            App.updateNav();
        } else {
            App.renderLogin();
        }
    },

    login: async (username, password) => {
        const res = await App.api({ action: 'login', username, password });
        if (res.success) {
            App.state.user = res.user;
            App.loadWorkspaces();
            App.updateNav();
        } else {
            alert(res.error || "Login failed");
        }
    },

    register: async (username, password, first_name, last_name) => {
        const res = await App.api({ action: 'register', username, password, first_name, last_name });
        if (res.success) {
            App.state.user = res.user;
            App.loadWorkspaces();
            App.updateNav();
        } else {
            alert(res.error || "Registration failed");
        }
    },

    logout: async () => {
        await App.api({ action: 'logout' });
        App.state.user = null;
        App.state.currentWorkspace = null;
        App.state.workspaces = [];
        App.renderLogin();
        App.updateNav();
    },

    // --- Workspace Logic ---
    loadWorkspaces: async () => {
        const res = await App.api({ action: 'get_workspaces' });
        if (res.workspaces) {
            App.state.workspaces = res.workspaces;
            App.renderDashboard();
        }
    },

    submitCreateWorkspace: async () => {
        const name = document.getElementById('new-workspace-name').value;
        if (!name) return;

        const res = await App.api({ action: 'create_workspace', name });
        if (res.success) {
            App.closeModal();
            App.loadWorkspaces();
        } else {
            alert(res.error || "Failed to create workspace");
        }
    },

    openWorkspace: async (id) => {
        console.log("Opening workspace ID:", id);
        // alert("Opening workspace: " + id); // Debug

        const workspace = App.state.workspaces.find(w => w.id == id); // Loose equality for string/number safety
        if (!workspace) {
            console.error("Workspace not found in state:", id, App.state.workspaces);
            alert("Error: Workspace not found locally.");
            return;
        }
        App.state.currentWorkspace = workspace;

        // Load details
        try {
            const res = await App.api({ action: 'get_workspace_details', workspace_id: id });
            console.log("Workspace details loaded:", res);

            if (res.error) {
                alert("API Error: " + res.error);
                return;
            }

            App.state.categories = res.categories || [];
            App.state.events = res.events || [];
            App.state.eventItems = res.event_items || [];
            App.state.assignments = res.assignments || [];
            App.state.workspaceMembers = res.members || [];
            App.state.activityLog = res.activity_log || [];

            // Update workspace details from server (to get latest notes)
            if (res.workspace) {
                App.state.currentWorkspace = res.workspace;
            }

            App.renderBoard();
        } catch (e) {
            console.error("Error opening workspace:", e);
            alert("Error opening workspace: " + e.message);
        }
    },

    createCategory: async () => {
        const name = prompt("Category Name:");
        if (!name) return;

        const res = await App.api({
            action: 'create_category',
            workspace_id: App.state.currentWorkspace.id,
            name: name
        });

        if (res.success) {
            App.openWorkspace(App.state.currentWorkspace.id); // Reload
        }
    },

    createEvent: async (categoryId) => {
        const title = prompt("Event Title (e.g. Grad Visit Day):");
        if (!title) return;

        const res = await App.api({
            action: 'create_event',
            category_id: categoryId,
            title: title
        });

        if (res.success) {
            App.openWorkspace(App.state.currentWorkspace.id); // Reload
        }
    },

    // --- Rendering ---
    renderLogin: () => {
        const app = document.getElementById('app');
        app.innerHTML = `
			<div class="auth-container">
				<div class="auth-hero hidden-mobile">
					<div class="auth-hero-content">
						<h2 style="color: white; margin-bottom: 15px;">Welcome to Practica</h2>
						<p style="color: rgba(255,255,255,0.9); line-height: 1.6;">
							Efficient, simple shared event management for the UC Davis community.
						</p>
					</div>
				</div>

				<div class="card auth-form">
					<h3 style="margin-bottom: 25px;">Sign In</h3>
					<div class="form-group">
						<label><i class="fa-solid fa-user"></i> Username</label>
						<input type="text" id="username" class="form-control" placeholder="Enter username">
					</div>
					<div class="form-group">
						<label><i class="fa-solid fa-lock"></i> Password</label>
						<input type="password" id="password" class="form-control" placeholder="Enter password">
					</div>
					<button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="App.handleLoginBtn()">Login</button>
					<div class="auth-divider"><span>or</span></div>
					<button class="btn btn-secondary" style="width: 100%;" onclick="App.renderRegister()">Create Account</button>
					
					<div style="margin-top: 20px; font-size: 0.85rem; color: #777; text-align: center;">
						Forgot your password? <a href="#" onclick="alert('Please contact your workspace administrator to reset your password.')" style="color: var(--color-sea-blue);">Contact Admin</a>
					</div>
				</div>
			</div>
		`;
    },

    renderRegister: () => {
        const app = document.getElementById('app');
        app.innerHTML = `
			<div class="auth-container">
				<div class="auth-hero hidden-mobile">
					<div class="auth-hero-content">
						<h2 style="color: white; margin-bottom: 15px;">Get Started</h2>
						<p style="color: rgba(255,255,255,0.9); line-height: 1.6;">
							Organize symposia, faculty lunches, and department events with your team.
						</p>
						<div style="margin-top: 30px; display: flex; flex-direction: column; gap: 15px;">
							<div style="display: flex; align-items: center; gap: 12px; color: white; font-size: 0.9rem;">
								<i class="fa-solid fa-check-circle" style="color: var(--color-sunset);"></i> 
								<span>Real-time event collaboration</span>
							</div>
							<div style="display: flex; align-items: center; gap: 12px; color: white; font-size: 0.9rem;">
								<i class="fa-solid fa-check-circle" style="color: var(--color-sunset);"></i> 
								<span>Task assignments & tracking</span>
							</div>
							<div style="display: flex; align-items: center; gap: 12px; color: white; font-size: 0.9rem;">
								<i class="fa-solid fa-check-circle" style="color: var(--color-sunset);"></i> 
								<span>Easy shares and exports</span>
							</div>
						</div>
					</div>
				</div>

				<div class="card auth-form" style="padding-bottom: 20px;">
					<h3 style="margin-bottom: 25px;">Create Account</h3>
					
					<div style="display: flex; gap: 15px;">
						<div class="form-group" style="flex: 1;">
							<label><i class="fa-solid fa-address-card"></i> First Name</label>
							<input type="text" id="reg-firstname" class="form-control" placeholder="Jane">
						</div>
						<div class="form-group" style="flex: 1;">
							<label>Last Name</label>
							<input type="text" id="reg-lastname" class="form-control" placeholder="Doe">
						</div>
					</div>

					<div class="form-group">
						<label><i class="fa-solid fa-user"></i> Choose a Username</label>
						<input type="text" id="reg-username" class="form-control" placeholder="jdoe">
					</div>

					<div class="form-group">
						<label><i class="fa-solid fa-lock"></i> Choose a Password</label>
						<input type="password" id="reg-password" class="form-control" placeholder="••••••••">
					</div>

					<button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="App.handleRegisterBtn()">Create My Account</button>
					
					<div class="auth-divider"><span>or</span></div>
					
					<button class="btn btn-secondary" style="width: 100%;" onclick="App.renderLogin()">Return to Sign In</button>

					<div class="auth-disclaimer">
						<strong>Reminder:</strong> Practica is in testing and has not been audited by college or campus IET. Please do not enter any information which is not public or made-up.
					</div>
				</div>
			</div>
		`;
    },

    renderDashboard: () => {
        const app = document.getElementById('app');

        let workspaceHtml = App.state.workspaces.map(w => `
			<div class="card workspace-card existing" onclick="App.openWorkspace(${w.id})">
				<i class="fa-solid fa-calendar-days" style="font-size: 2rem; color: var(--color-sea-dark); margin-bottom: 10px;"></i>
				<h3>${w.name}</h3>
				<p class="role-badge">${w.role}</p>
			</div>
		`).join('');

        app.innerHTML = `
			<h2>My Workspaces</h2>
			<div class="workspace-list">
				<div class="card workspace-card" onclick="App.openCreateWorkspaceModal()">
					<i class="fa-solid fa-plus" style="font-size: 2rem; color: var(--color-sea-blue);"></i>
					<p style="margin-top: 10px;">Create New Workspace</p>
				</div>
				${workspaceHtml}
			</div>
		`;
        App.updateNav();
    },

    renderBoard: () => {
        const app = document.getElementById('app');
        const ws = App.state.currentWorkspace;
        const today = new Date().toISOString().split('T')[0];

        // Filter Logic: Active events have end_date >= today OR no end_date
        const activeEvents = App.state.events.filter(t => !t.end_date || t.end_date >= today);
        const allItems = App.state.eventItems || []; // Items fetched from API

        let columnsHtml = App.state.categories.map(cat => {
            const events = activeEvents.filter(t => t.event_category_id === cat.id);
            // Sort by sort_order
            events.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            const eventsHtml = events.map(t => {
                // Get items for this event and sort chronologically
                let items = allItems.filter(i => i.event_id === t.id);
                items.sort((a, b) => {
                    // Primary sort: User's manual sort_order
                    const orderA = a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 9999;
                    const orderB = b.sort_order !== undefined && b.sort_order !== null ? b.sort_order : 9999;
                    if (orderA !== orderB) return orderA - orderB;

                    // Secondary sort: Dates
                    if (a.item_date && b.item_date) return a.item_date.localeCompare(b.item_date);
                    if (a.item_date) return -1; // Dates come first
                    if (b.item_date) return 1;
                    return 0;
                });

                const limit = t.board_items_limit !== undefined && t.board_items_limit !== null ? parseInt(t.board_items_limit, 10) : 3;
                const itemsToShow = items.slice(0, limit);
                const remaining = items.length - itemsToShow.length;

                const itemsHtml = itemsToShow.map(i => {
                    const isFlagged = (i.is_flagged == 1 || i.is_flagged === true);
                    const isDone = (i.is_done == 1 || i.is_done === true);
                    const isDivider = (i.is_divider == 1 || i.is_divider === true);

                    if (isDivider) {
                        return `
						<div class="mini-event-divider">
							${i.title}
						</div>
						`;
                    }

                    // Format date as MM/DD if present
                    let dateStr = '';
                    if (i.item_date) {
                        const startTime = App.formatTime(i.start_time);
                        const endTime = App.formatTime(i.end_time);
                        let range = '';
                        if (i.end_date || endTime) {
                            range = ' - ' + (i.end_date ? i.end_date.slice(5) : '') + (endTime ? ' ' + endTime : '');
                        }
                        dateStr = `<span style="font-size: 0.7em; color: var(--color-sea-blue); margin-right: 4px;">${i.item_date.slice(5)}${startTime ? ' ' + startTime : ''}${range}</span>`;
                    }

                    return `
					<div class="mini-event-item ${isDone ? 'is-done' : ''}" style="display: flex; flex-direction: column; margin-bottom: 4px;">
						<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
							<div style="display: flex; align-items: center; flex: 1; min-width: 0; flex-wrap: wrap;">
								${dateStr}
								<span class="mini-item-title" style="font-weight: 500; margin-right: 6px;">${i.title}</span>
								<div class="mini-item-assignees" style="display: flex; flex-wrap: wrap; gap: 3px; align-items: center;">
									${(App.state.assignments || []).filter(a => a.item_id == i.id).map(a => {
                        const avatar = App.getUserAvatar(a.username);
                        const name = a.first_name || a.username;
                        return `<div class="assignment-pill mini" title="${a.first_name} ${a.last_name}"><div class="avatar-circle" style="background-color: ${avatar.color};"><i class="fa-solid ${avatar.icon}"></i></div><span>${name}</span></div>`;
                    }).join('')}
								</div>
							</div>
							<div class="mini-item-icons" style="display: flex; align-items: center; gap: 4px; color: var(--color-text-light); flex-shrink: 0; margin-top: 2px;">
								${i.link_url ? `<i class="fa-solid fa-link" style="font-size: 0.75rem;"></i>` : ''}
								${isFlagged ? '<i class="fa-solid fa-flag" style="color: var(--color-accent); font-size: 0.75rem;"></i>' : ''}
							</div>
						</div>
						${(t.show_details == 1 && i.subtitle) ? `<div class="mini-item-details" style="margin-top: 0px; margin-bottom: 8px; color: #777; font-size: 0.75rem; line-height: 1.2;">${i.subtitle}</div>` : ''}
					</div>
					`;
                }).join('');

                const startTime = App.formatTime(t.start_time);
                const endTime = App.formatTime(t.end_time);
                let dateRange = t.start_date ? `${t.start_date}${startTime ? ' ' + startTime : ''}` : '';
                if (t.end_date || endTime) {
                    dateRange += ` - ${t.end_date || ''}${endTime ? ' ' + endTime : ''}`;
                }

                // The Event Card: Our primary unit of organization. 
                // We're keeping the header Blue to match the UC Davis aesthetic.
                return `
					<div class="card event-card" draggable="true" ondragstart="App.drag(event, ${t.id})" onclick="App.openEvent(${t.id})" id="event-${t.id}">
						<h4 style="color: var(--color-sea-blue); margin-bottom: 5px;">${t.title}</h4>
					${t.location ? `<div class="event-meta"><i class="fa-solid fa-location-dot"></i> ${t.location}</div>` : ''}
					${dateRange ? `<div class="event-meta"><i class="fa-regular fa-calendar"></i> ${dateRange}</div>` : ''}
					
					${items.length > 0 ? `<div class="mini-items-container">${itemsHtml}</div>` : ''}
					${remaining > 0 ? `<div class="mini-items-more">+${remaining} more</div>` : ''}
				</div>
	`;
            }).join('');

            return `
	<div class="category-column" draggable="true" ondragstart="App.dragCategory(event, ${cat.id})" id="cat-${cat.id}">
				<div class="column-header" style="cursor: grab;">
					<span>${cat.name} <span style="font-weight: normal; color: #777; font-size: 0.9em;">(${events.length})</span></span>
					<button class="btn-icon delete" onclick="App.deleteCategory(${cat.id})" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
				</div>
				<div class="event-list" ondragover="App.allowDrop(event)" ondrop="App.drop(event, ${cat.id})">
					${eventsHtml}
				</div>
				<button class="btn btn-secondary btn-sm" style="margin-top: 10px; width: 100%;" onclick="App.createEvent(${cat.id})"><i class="fa-solid fa-plus"></i> Add Event</button>
			</div>
	`;
        }).join('');

        const facepileHtml = (App.state.workspaceMembers || []).map(m => {
            const avatar = App.getUserAvatar(m.username);
            return `<div class="avatar-circle" style="background-color: ${avatar.color};" title="${m.username}"><i class="fa-solid ${avatar.icon}"></i></div>`;
        }).join('');

        app.innerHTML = `
			<div class="workspace-header-actions">
				<div class="workspace-title-group">
					<h2><i class="fa-solid fa-calendar-check"></i> ${ws.name}</h2>
					<div class="facepile-container" onclick="App.openShareModal()" title="Manage Members & Activity">
						${facepileHtml}
						<button class="btn btn-sm btn-secondary facepile-btn"><i class="fa-solid fa-user-plus"></i></button>
					</div>
					<div class="view-toggle">
						<button class="btn btn-sm ${App.state.view === 'board' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setView('board')"><i class="fa-solid fa-columns"></i></button>
						<button class="btn btn-sm ${App.state.view === 'calendar' ? 'btn-primary' : 'btn-secondary'}" onclick="App.setView('calendar')"><i class="fa-solid fa-calendar-days"></i></button>
					</div>
					<button class="btn btn-primary btn-sm mobile-menu-toggle" onclick="document.getElementById('workspace-actions').classList.toggle('active')"><i class="fa-solid fa-bars"></i></button>
				</div>
				<div id="workspace-actions" class="workspace-actions-group">
					<button class="btn btn-secondary" onclick="App.renderDashboard()"><i class="fa-solid fa-arrow-left"></i> Back</button>
					<button class="btn btn-secondary" onclick="App.renderArchive()"><i class="fa-solid fa-box-archive"></i> Archive</button>
					<button class="btn btn-primary" onclick="App.createCategory()"><i class="fa-solid fa-plus"></i> New Event Category</button>
				</div>
			</div>

			<!-- Workspace Notes -->
	<div class="workspace-notes-container">
		<details>
			<summary><span class="details-icon"><i class="fa-solid fa-play"></i></span> <i class="fa-solid fa-note-sticky"></i> Workspace Notes</summary>
			<textarea class="form-control workspace-notes-input" placeholder="General team info, Box or policy links, etc..." onblur="App.saveWorkspaceNotes(this.value)">${ws.notes || ''}</textarea>
		</details>
	</div>

			${App.state.view === 'calendar' ? App.renderCalendar() : `
			<div class="board-container" ondragover="App.allowDropCategory(event)" ondrop="App.dropCategory(event)">
				${columnsHtml}
				${App.state.categories.length === 0 ? '<div style="padding: 20px; color: var(--color-text-light);">No categories yet. Click "New Category" to start!</div>' : ''}
			</div>
			`}
`;
        setTimeout(() => window.scrollTo(0, 0), 10); // Prevent browser from maintaining previous scroll position and wait for DOM layout
        App.updateNav();
    },

    setView: (view) => {
        App.state.view = view;
        App.renderBoard();
    },

    saveWorkspaceNotes: async (notes) => {
        await App.api({
            action: 'update_workspace',
            workspace_id: App.state.currentWorkspace.id,
            notes
        });
        App.state.currentWorkspace.notes = notes;
    },

    renderCalendar: () => {
        const today = new Date();
        const currentMonth = App.state.calendarDate || today;
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Month Name
        const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Calendar Grid Generation
        let daysHtml = '';

        // Empty slots for days before start of month
        for (let i = 0; i < firstDay.getDay(); i++) {
            daysHtml += `<div class="calendar-day empty"></div>`;
        }

        // Days of month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // Find events active on this day
            const eventsOnDay = App.state.events.filter(t => {
                if (!t.start_date) return false;
                if (!t.end_date) return t.start_date === dateStr;
                return dateStr >= t.start_date && dateStr <= t.end_date;
            });

            const eventsHtml = eventsOnDay.map(t => {
                // Determine if start, middle, or end of event for styling
                let classes = 'course-bar';
                if (t.start_date === dateStr) classes += ' start';
                if (t.end_date === dateStr) classes += ' end';

                return `<div class="${classes}" onclick="App.openEvent(${t.id})" title="${t.title}">${t.title}</div>`;
            }).join('');

            daysHtml += `
	<div class="calendar-day">
					<div class="day-number">${d}</div>
					<div class="day-events">${eventsHtml}</div>
				</div>
	`;
        }

        return `
	<div class="calendar-container">
				<div class="calendar-header">
					<button class="btn btn-sm btn-secondary" onclick="App.changeMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
					<h3>${monthName}</h3>
					<button class="btn btn-sm btn-secondary" onclick="App.changeMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
				</div>
				<div class="calendar-grid-header">
					<div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
				</div>
				<div class="calendar-grid">
					${daysHtml}
				</div>
	`;
    },

    changeMonth: (delta) => {
        const current = App.state.calendarDate || new Date();
        App.state.calendarDate = new Date(current.getFullYear(), current.getMonth() + delta, 1);
        App.renderBoard();
    },

    renderArchive: () => {
        const app = document.getElementById('app');
        const ws = App.state.currentWorkspace;
        const today = new Date().toISOString().split('T')[0];

        // Archived events have end_date < today
        const archivedEvents = App.state.events.filter(t => t.end_date && t.end_date < today);

        let eventsHtml = archivedEvents.map(t => `
	<div class="card event-card" onclick="App.openEvent(${t.id})" style="background: #f0f0f0; opacity: 0.8;">
		<h4 style="color: var(--color-text-light); text-decoration: line-through;">${t.title}</h4>
				${t.location ? `<div class="event-meta"><i class="fa-solid fa-location-dot"></i> ${t.location}</div>` : ''}
<div class="event-meta"><i class="fa-solid fa-check"></i> Completed: ${t.end_date}</div>
			</div>
	`).join('');

        app.innerHTML = `
	<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
				<h2><i class="fa-solid fa-box-archive"></i> ${ws.name} Archive</h2>
				<button class="btn btn-secondary" onclick="App.renderBoard()"><i class="fa-solid fa-arrow-left"></i> Back to Board</button>
			</div>
	<div class="workspace-list">
		${eventsHtml.length ? eventsHtml : '<p>No past events yet.</p>'}
	</div>
`;
        App.updateNav();
    },

    openShareModal: async () => {
        const body = document.getElementById('modal-body');

        const activityHtml = (App.state.activityLog || []).map(log => {
            const date = new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `<div class="activity-item">
				<span class="activity-time">${date}</span>
				<span class="activity-text"><strong>${log.username}</strong> ${log.action} <em>${log.target_name}</em></span>
			</div>`;
        }).join('');

        body.innerHTML = `
	<h3>Workspace Members</h3>
			<p>Invite others to collaborate on <strong>${App.state.currentWorkspace.name}</strong>.</p>
			<div class="form-group" style="margin: 20px 0; position: relative;">
				<label>Search for users to invite</label>
				<div style="display: flex; gap: 10px;">
					<input type="text" id="share-search" class="form-control" placeholder="Type name or username..." oninput="App.handleUserSearch(this.value)" autocomplete="off">
				</div>
				<div id="user-search-results" class="search-results-dropdown" style="display: none;"></div>
			</div>
			
			<div style="margin-top: 30px;">
				<h4 style="margin-bottom: 10px;">Current Users</h4>
				<div id="workspace-users-list" style="max-height: 200px; overflow-y: auto; background: var(--color-bg-sky); border-radius: 8px; padding: 10px;">
					<div style="text-align: center; color: var(--color-text-light);"><i class="fa-solid fa-spinner fa-spin"></i> Loading users...</div>
				</div>
			</div>

			<div style="margin-top: 30px;">
				<h4 style="margin-bottom: 10px;">Recent Activity</h4>
				<div class="activity-log-container">
					${activityHtml || '<div style="color: var(--color-text-light); font-size: 0.9em;">No recent activity.</div>'}
				</div>
			</div>
`;
        document.getElementById('modal-container').classList.add('active');
        document.body.classList.add('modal-open');

        // Fetch users dynamically
        await App.loadWorkspaceUsers();
    },

    loadWorkspaceUsers: async () => {
        const listDiv = document.getElementById('workspace-users-list');
        if (!listDiv) return;

        const res = await App.api({
            action: 'get_workspace_users',
            workspace_id: App.state.currentWorkspace.id
        });

        if (res.users) {
            App.state.workspaceMembers = res.users; // Sync global state

            // Update board facepile if visible
            const facepile = document.querySelector('.facepile-container');
            if (facepile) {
                const facepileHtml = res.users.map(m => {
                    const avatar = App.getUserAvatar(m.username);
                    return `<div class="avatar-circle" style="background-color: ${avatar.color};" title="${m.username}"><i class="fa-solid ${avatar.icon}"></i></div>`;
                }).join('') + '<button class="btn btn-sm btn-secondary facepile-btn"><i class="fa-solid fa-user-plus"></i></button>';
                facepile.innerHTML = facepileHtml;
            }

            if (res.users.length === 0) {
                listDiv.innerHTML = '<div style="color: var(--color-text-light);">No other users.</div>';
                return;
            }

            const isCurrentAdmin = App.state.user && res.users.some(u => u.id === App.state.user.id && u.role === 'admin');

            listDiv.innerHTML = res.users.map(u => {
                const avatar = App.getUserAvatar(u.username);
                const isMe = u.id === App.state.user?.id;
                const canManage = isCurrentAdmin && !isMe;
                const fullName = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username;

                return `
				<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.05); ${isMe ? 'background: rgba(108, 202, 152, 0.05);' : ''}">
					<div style="display: flex; align-items: center; gap: 10px; flex: 1;">
						<div class="avatar-circle" style="background-color: ${avatar.color}; width: 28px; height: 28px; font-size: 14px; margin-left: 0; border: none;" title="${u.username}"><i class="fa-solid ${avatar.icon}"></i></div>
						<div style="display: flex; flex-direction: column;">
							<span style="font-weight: 600; font-size: 0.95rem;">${fullName} ${isMe ? '<small>(You)</small>' : ''}</span>
							<span style="font-size: 0.75rem; color: var(--color-text-light);">@${u.username} • ${u.role === 'admin' ? '<span style="color: #DAAA00; font-weight: bold;"><i class="fa-solid fa-crown"></i> Admin</span>' : u.role}</span>
						</div>
					</div>
					<div style="display: flex; gap: 5px;">
						${canManage ? `
							<select class="form-control" style="width: auto; padding: 2px 10px; font-size: 0.8rem; height: 28px;" onchange="App.updateMemberRole(${u.id}, this.value)">
								<option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
								<option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
								<option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
							</select>
							<button class="btn-icon" onclick="App.resetUserPassword(${u.id}, '${fullName}')" title="Reset Password">
								<i class="fa-solid fa-key"></i>
							</button>
							<button class="btn-icon delete" onclick="App.removeWorkspaceUser(${u.id})" title="Remove access">
								<i class="fa-solid fa-xmark"></i>
							</button>
						` : ''}
					</div>
				</div>
			`}).join('');
        } else {
            listDiv.innerHTML = '<div style="color: red;">Failed to load users.</div>';
        }
    },

    removeWorkspaceUser: async (userId) => {
        if (!confirm("Are you sure you want to remove this user's access?")) return;

        const res = await App.api({
            action: 'remove_workspace_user',
            workspace_id: App.state.currentWorkspace.id,
            user_id: userId
        });

        if (res.success) {
            await App.loadWorkspaceUsers();
        } else {
            alert(res.error || "Failed to remove user");
        }
    },

    resetUserPassword: async (userId, fullName) => {
        if (!confirm(`Are you sure you want to reset the password for ${fullName}?`)) return;

        const res = await App.api({
            action: 'admin_reset_password',
            workspace_id: App.state.currentWorkspace.id,
            user_id: userId
        });

        if (res.success) {
            alert(`Password reset successfully for ${fullName}.\n\nNew Temporary Password: ${res.temp_password}\n\nPlease give this to them immediately.`);
        } else {
            alert(res.error || "Failed to reset password");
        }
    },

    handleUserSearch: async (query) => {
        const resultsDiv = document.getElementById('user-search-results');
        if (!query || query.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        const res = await App.api({ action: 'search_users', query });
        if (res.users && res.users.length > 0) {
            resultsDiv.innerHTML = res.users.map(u => {
                const fullName = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username;
                return `
					<div class="search-result-item" onclick="App.inviteUser('${u.username}')">
						<div style="font-weight: 600;">${fullName}</div>
						<div style="font-size: 0.8rem; color: #666;">@${u.username}</div>
					</div>
				`;
            }).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = '<div style="padding: 10px; color: #999;">No users found</div>';
            resultsDiv.style.display = 'block';
        }
    },

    inviteUser: async (username) => {
        const res = await App.api({
            action: 'add_workspace_user',
            workspace_id: App.state.currentWorkspace.id,
            username
        });

        if (res.success) {
            document.getElementById('share-search').value = '';
            document.getElementById('user-search-results').style.display = 'none';
            await App.loadWorkspaceUsers();
        } else {
            alert(res.error || "Failed to add user");
        }
    },

    updateMemberRole: async (userId, role) => {
        const res = await App.api({
            action: 'update_workspace_user_role',
            workspace_id: App.state.currentWorkspace.id,
            user_id: userId,
            role: role
        });

        if (res.success) {
            await App.loadWorkspaceUsers();
        } else {
            alert(res.error || "Failed to update role");
            await App.loadWorkspaceUsers(); // Revert UI
        }
    },

    updateNav: () => {
        const nav = document.getElementById('nav-menu');
        if (App.state.user) {
            // Weighted greetings pool: "Hi," has a much higher chance of appearing.
            const greetings = [
                "Hi,", "Hi,", "Hi,", "Hi,", "Hi,",
            ];
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

            nav.innerHTML = `
                <span class="nav-greeting"> ${randomGreeting} ${App.state.user.username} <i class="fa-solid fa-user-astronaut"></i></span>
                <a href="docs.php" class="btn btn-secondary" style="text-decoration: none;"><i class="fa-solid fa-book"></i> Docs</a>
                <button class="btn btn-secondary" onclick="App.logout()">Logout</button>
            `;
        } else {
            nav.innerHTML = '';
        }
    },

    openEvent: async (id) => {
        const res = await App.api({ action: 'get_event', event_id: id });
        if (res.event) {
            App.state.currentEvent = res.event;
            App.state.currentEventItems = res.items;
            App.state.currentEventAssignments = res.assignments;
            App.renderEventModal();
        }
    },

    renderEventModal: () => {
        const event = App.state.currentEvent;
        const items = App.state.currentEventItems;
        const editingItem = App.state.editingItem || null;

        const body = document.getElementById('modal-body');

        let itemsHtml = items.map(item => {
            // Fix boolean casting for flags (DB might return "0" or "1")
            const isFlagged = (item.is_flagged == 1 || item.is_flagged === true);
            const isDone = (item.is_done == 1 || item.is_done === true);
            const isDivider = (item.is_divider == 1 || item.is_divider === true);

            if (isDivider) {
                return `
	<div class="event-divider" draggable="true" ondragstart="App.dragItem(event, ${item.id})" ondragover="App.allowDropItem(event)" ondrop="App.dropItem(event, ${item.id})" id="event-item-${item.id}">
		<div style="flex: 1; display: flex; align-items: center; gap: 8px;">
			<span class="event-divider-text">${item.title}</span>
		</div>
		<div class="item-actions">
			<button class="btn-icon" onclick="App.startEditItem(${item.id})"><i class="fa-solid fa-pencil"></i></button>
			<button class="btn-icon delete" onclick="App.deleteItem(${item.id})"><i class="fa-solid fa-trash"></i></button>
		</div>
	</div>
	`;
            }

            return `
	<div class="event-item ${editingItem && editingItem.id === item.id ? 'editing' : ''} ${isDone ? 'is-done' : ''}" draggable="true" ondragstart="App.dragItem(event, ${item.id})" ondragover="App.allowDropItem(event)" ondrop="App.dropItem(event, ${item.id})" id="event-item-${item.id}">
		<div class="event-item-header">
			<div style="flex: 1; display: flex; align-items: center; gap: 8px;">
				<strong>${item.title}</strong>
				${item.link_url ? `<a href="${item.link_url}" target="_blank" class="item-link-icon" style="margin-left: 5px; margin-right: 5px;" title="Open Link"><i class="fa-solid fa-link"></i></a>` : ''}
				${isFlagged ? '<i class="fa-solid fa-flag" style="color: var(--color-accent);"></i>' : ''}
				<div id="item-assignees-${item.id}" class="item-assignees">
					${(App.state.currentEventAssignments || []).filter(a => a.item_id == item.id).map(a => {
                const avatar = App.getUserAvatar(a.username);
                const fullName = a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.username;
                return `<div class="assignment-pill clickable" title="Click to remove ${fullName}" onclick="event.stopPropagation(); App.toggleAssignment(${item.id}, ${a.user_id}, true)"><div class="avatar-circle" style="background-color: ${avatar.color};"><i class="fa-solid ${avatar.icon}"></i></div><span>${fullName}</span></div>`;
            }).join('')}
				</div>
			</div>
			<div class="item-actions">
				${item.item_date ? `
					<span class="item-date">
						${item.item_date}${item.start_time ? ' ' + App.formatTime(item.start_time) : ''}
						${(item.end_date || item.end_time) ? ' to ' + (item.end_date || '') + (item.end_time ? ' ' + App.formatTime(item.end_time) : '') : ''}
					</span>` : ''}

				<button class="btn-icon assign-btn" onclick="App.openAssignPopup(event, ${item.id})" title="Assign User"><i class="fa-solid fa-user-plus"></i></button>
				<button class="btn-icon" onclick="App.startEditItem(${item.id})"><i class="fa-solid fa-pencil"></i></button>

				<button class="btn-icon ${isFlagged ? 'active' : ''}" onclick="App.toggleFlag(${item.id})">
					<i class="${isFlagged ? 'fa-solid' : 'fa-regular'} fa-flag" style="${isFlagged ? 'color: var(--color-accent);' : ''}"></i>
				</button>
				<button class="btn-icon ${isDone ? 'done-active' : ''}" onclick="App.toggleDone(${item.id})">
					<i class="fa-solid fa-check" style="${isDone ? 'color: var(--color-sea-blue);' : ''}"></i>
				</button>
				<button class="btn-icon delete" onclick="App.deleteItem(${item.id})"><i class="fa-solid fa-trash"></i></button>
			</div>
		</div>
				${item.subtitle ? `<div class="event-item-subtitle">${item.subtitle}</div>` : ''}
			</div>
	`;
        }).join('');

        let placeholderText = "Add a new item (e.g. Flight to Tokyo)...";
        if (App.state.placeholders && App.state.placeholders.length > 0) {
            const index = Math.floor(Math.random() * App.state.placeholders.length);
            placeholderText = "e.g. " + App.state.placeholders[index] + "...";
        }

        body.innerHTML = `
	<div class="event-detail-header">
		<input type="text" class="event-title-input" value="${event.title ? event.title.replace(/"/g, '&quot;') : ''}" onblur="App.updateEventField('title', this.value)">
				<div class="event-meta-inputs" style="gap: 10px; align-items: center;">
					<div class="meta-field">
						<i class="fa-solid fa-location-dot"></i>
						<input type="text" class="${!event.location ? 'is-empty' : ''}" value="${event.location ? event.location.replace(/"/g, '&quot;') : ''}" placeholder="Add location..." onchange="App.updateEventField('location', this.value)" style="width: 140px;">
					</div>
					<div class="meta-field">
						<i class="fa-regular fa-calendar"></i>
						<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
							<input type="date" class="${!event.start_date ? 'is-empty' : ''}" value="${event.start_date ? event.start_date.substring(0, 10) : ''}" oninput="App.updateEventField('start_date', this.value)" onchange="App.updateEventField('start_date', this.value)" onblur="App.handleDateBlur(this, 'start_date')" title="Start Date">
							<input type="time" class="${!event.start_time ? 'is-empty' : ''}" value="${event.start_time || ''}" onchange="App.updateEventField('start_time', this.value)" title="Start Time" style="width: auto;">
							<span style="font-size: 0.8rem; color: #94a3b8; font-weight: bold; margin: 0 2px;">to</span>
							<input type="date" class="${!event.end_date ? 'is-empty' : ''}" value="${event.end_date ? event.end_date.substring(0, 10) : ''}" oninput="App.updateEventField('end_date', this.value)" onchange="App.updateEventField('end_date', this.value)" onblur="App.handleDateBlur(this, 'end_date')" placeholder="End Date (optional)">
							<input type="time" class="${!event.end_time ? 'is-empty' : ''}" value="${event.end_time || ''}" onchange="App.updateEventField('end_time', this.value)" title="End Time (optional)" style="width: auto;">
						</div>
					</div>
				</div>
			<div class="event-action-bar">
				<!-- Action Bar: All the tools you need in one clean line. -->
				<a href="download_ics.php?event_id=${event.id}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i> ICS</a>
				<button onclick="App.generatePDF(${event.id})" class="btn btn-secondary btn-sm"><i class="fa-solid fa-file-pdf"></i> PDF</button>
				<button onclick="App.openSharingModal(${event.id})" class="btn btn-secondary btn-sm" style="background: var(--color-sea); color: white; border-color: var(--color-sea);"><i class="fa-solid fa-share-nodes"></i> Share</button>
				
				<div class="display-options-bar">
					<label title="Toggle showing details on the main board">
						<input type="checkbox" ${event.show_details == 1 ? 'checked' : ''} onchange="App.updateEventField('show_details', this.checked ? 1 : 0)">
						Show details
					</label>
					<span style="color: var(--color-border-subtle); margin: 0 4px;">|</span>
					<label>
						Limit: 
						<input type="number" min="0" max="100" style="width: 40px; padding: 0 4px; font-size: 0.85rem; height: 20px; border: 1px solid #ddd; border-radius: 4px;" value="${event.board_items_limit !== undefined && event.board_items_limit !== null ? event.board_items_limit : 3}" onchange="App.updateEventField('board_items_limit', this.value)">
					</label>
				</div>
			</div>
			<div class="event-items-container">
						<h3 style="margin-bottom: 15px;">Event Items</h3>
						<div class="add-item-form">
							${editingItem ? '<div style="margin-bottom: 5px; color: var(--color-sea-blue); font-weight: bold;">Editing Item</div>' : ''}

							<label style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px; font-size: 0.9rem; color: var(--color-text-light);">
								<input type="checkbox" id="new-item-is-divider" style="cursor: pointer;" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'checked' : ''} onchange="App.toggleDividerForm(this.checked)">
									Cosmetic Divider
							</label>

							<input type="text" id="new-item-title" placeholder="${placeholderText}" class="form-control" style="margin-bottom: 5px;" value="${editingItem && editingItem.title ? editingItem.title.replace(/"/g, '&quot;') : ''}">
							<textarea id="new-item-subtitle" placeholder="Details, notes..." class="form-control" style="margin-bottom: 5px; min-height: 60px; ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'display: none;' : ''}" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'disabled' : ''}>${editingItem ? editingItem.subtitle || '' : ''}</textarea>
							<input type="text" id="new-item-link" placeholder="Optional Link URL" class="form-control" style="margin-bottom: 5px; ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'display: none;' : ''}" value="${editingItem && editingItem.link_url ? editingItem.link_url.replace(/"/g, '&quot;') : ''}" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'disabled' : ''}>
							<div style="display: flex; gap: 10px; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-top: 4px;">
								<div id="new-item-meta-container" style="${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'display: none;' : 'display: flex;'} align-items: center; gap: 10px; flex: 1;">
									<div class="meta-field editable" style="width: 100%; justify-content: flex-start; gap: 8px;">
										<i class="fa-regular fa-calendar"></i>
										<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
											<input type="date" id="new-item-date" class="${editingItem && editingItem.item_date ? '' : 'is-empty'}" value="${editingItem ? (editingItem.item_date ? editingItem.item_date.substring(0, 10) : '') : ''}" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'disabled' : ''} onchange="this.classList.toggle('is-empty', !this.value)">
											<input type="time" id="new-item-start-time" class="${editingItem && editingItem.start_time ? '' : 'is-empty'}" value="${editingItem ? editingItem.start_time || '' : ''}" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'disabled' : ''} onchange="this.classList.toggle('is-empty', !this.value)" style="width: auto;">
											<span style="font-size: 0.8rem; color: #94a3b8; font-weight: bold; margin: 0 2px;">to</span>
											<input type="date" id="new-item-end-date" class="${editingItem && editingItem.end_date ? '' : 'is-empty'}" value="${editingItem ? (editingItem.end_date ? editingItem.end_date.substring(0, 10) : '') : ''}" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'disabled' : ''} placeholder="End Date (optional)" onchange="this.classList.toggle('is-empty', !this.value)">
											<input type="time" id="new-item-end-time" class="${editingItem && editingItem.end_time ? '' : 'is-empty'}" value="${editingItem ? editingItem.end_time || '' : ''}" ${editingItem && (editingItem.is_divider == 1 || editingItem.is_divider === true) ? 'disabled' : ''} onchange="this.classList.toggle('is-empty', !this.value)" style="width: auto;">
										</div>
									</div>
								</div>
								<div style="align-self: center;">
											${editingItem
                ? `<button class="btn btn-primary btn-sm" onclick="App.updateItem(${editingItem.id})">Update</button> <button class="btn btn-secondary btn-sm" onclick="App.cancelEdit()">Cancel</button>`
                : `<button class="btn btn-primary btn-sm" style="height: 34px; padding: 0 16px;" onclick="App.addItem(${event.id})"><i class="fa-solid fa-plus"></i> Add</button>`
            }
										</div>
								</div>
							</div>

							<div class="items-list">
								${itemsHtml}
							</div>
						</div>
						`;
        document.querySelector('.modal-content').classList.add('event-modal-wide');
        document.getElementById('modal-container').classList.add('active');
        document.body.classList.add('modal-open');
    },

    updateEventField: async (field, value) => {
        console.log(`[DEBUG] updateEventField called - field: ${field}, value: ${value}`);
        let data = { action: 'update_event', event_id: App.state.currentEvent.id };
        data[field] = value;

        console.log(`[DEBUG] Payload to be sent:`, data);

        const res = await App.api(data);

        if (res && res.error) {
            alert('Failed to update event: ' + res.error);
        } else {
            // Silently update local state on success
            App.state.currentEvent[field] = value;
            // Optionally refresh parent view when closing modal
            App.shouldRefreshBoard = true;
        }
    },

    handleDateBlur: (inputElement, fieldName) => {
        // If the browser natively thinks the value is empty, but the user actually typed
        // characters into the native input box (meaning only the year is left blank)
        if (!inputElement.value) {
            // The browser hides the real raw text from javascript for <input type="date">
            // But we can trick it by briefly switching to text
            inputElement.type = 'text';
            let rawValue = inputElement.value;
            inputElement.type = 'date'; // Switch back immediately to preserve UI

            if (rawValue && rawValue.length > 0) {
                // Try to figure out if it's MM/DD or YYYY-MM
                // Browsers often format "text" reading as YYYY-MM-DD
                let parts = rawValue.split('-');
                if (parts.length > 1) {
                    let currentYear = new Date().getFullYear();

                    // Depending on browser locale, the text representation varies wildly. 
                    // We just fallback to grabbing current year and forcing a standard save
                    // Often when year is missing it looks like --MM-DD or 0000-MM-DD
                    if (rawValue.startsWith('0000') || rawValue.startsWith('--')) {
                        let monthDay = rawValue.substring(rawValue.length - 5);
                        let newDateStr = `${currentYear}-${monthDay}`;
                        inputElement.value = newDateStr;
                        App.updateEventField(fieldName, newDateStr);
                    }
                }
            }
        }
    },

    toggleDividerForm: (isDivider) => {
        const subtitle = document.getElementById('new-item-subtitle');
        const link = document.getElementById('new-item-link');
        const meta = document.getElementById('new-item-meta-container');

        if (isDivider) {
            subtitle.disabled = true; subtitle.style.display = 'none';
            link.disabled = true; link.style.display = 'none';
            meta.style.display = 'none';
        } else {
            subtitle.disabled = false; subtitle.style.display = 'block';
            link.disabled = false; link.style.display = 'block';
            meta.style.display = 'flex';
        }
    },

    addItem: async () => {
        const title = document.getElementById('new-item-title').value;
        const subtitle = document.getElementById('new-item-subtitle').value;
        const link_url = document.getElementById('new-item-link').value;
        const date = document.getElementById('new-item-date').value;
        const start_time = document.getElementById('new-item-start-time')?.value || null;
        const end_date = document.getElementById('new-item-end-date')?.value || null;
        const end_time = document.getElementById('new-item-end-time')?.value || null;
        const is_divider = document.getElementById('new-item-is-divider').checked ? 1 : 0;

        if (!title) return;

        const res = await App.api({
            action: 'add_item',
            event_id: App.state.currentEvent.id,
            title,
            subtitle,
            link_url,
            item_date: date,
            start_time,
            end_date,
            end_time,
            is_divider
        });

        if (res.success) {
            App.openEvent(App.state.currentEvent.id); // Reload modal
            App.shouldRefreshBoard = true;
        }
    },

    startEditItem: (id) => {
        // Use loose equality to handle string/number mismatch
        const item = App.state.currentEventItems.find(i => i.id == id);
        if (item) {
            App.state.editingItem = item;
            App.renderEventModal();
        }
    },

    cancelEdit: () => {
        App.state.editingItem = null;
        App.renderEventModal();
    },

    updateItem: async (id) => {
        const title = document.getElementById('new-item-title').value;
        const subtitle = document.getElementById('new-item-subtitle').value;
        const link_url = document.getElementById('new-item-link').value;
        const date = document.getElementById('new-item-date').value;
        const start_time = document.getElementById('new-item-start-time')?.value || null;
        const end_date = document.getElementById('new-item-end-date')?.value || null;
        const end_time = document.getElementById('new-item-end-time')?.value || null;
        const is_divider = document.getElementById('new-item-is-divider').checked ? 1 : 0;

        if (!title) return;

        const res = await App.api({
            action: 'update_item',
            item_id: id,
            title,
            subtitle,
            link_url,
            item_date: date,
            start_time,
            end_date,
            end_time,
            is_divider
        });

        if (res.success) {
            App.state.editingItem = null;
            App.openEvent(App.state.currentEvent.id); // Reload modal
            App.shouldRefreshBoard = true;
        }
    },

    deleteItem: async (id) => {
        if (!confirm("Remove this item?")) return;
        await App.api({ action: 'delete_item', item_id: id });
        App.openEvent(App.state.currentEvent.id);
        App.shouldRefreshBoard = true;
    },

    deleteCategory: async (id) => {
        const cat = App.state.categories.find(c => c.id == id);
        if (!cat) return;

        const eventsInCat = App.state.events.filter(e => e.event_category_id == id).length;

        if (!window.confirm(`Are you sure you want to delete the category "${cat.name}"?`)) return;

        if (eventsInCat > 0) {
            if (!window.confirm(`WARNING: This category contains ${eventsInCat} event(s). Deleting it will delete ALL these events permanently.\n\nAre you ABSOLUTELY sure?`)) return;
        }

        await App.api({ action: 'delete_category', id });
        App.openWorkspace(App.state.currentWorkspace.id);
    },

    toggleFlag: async (id) => {
        await App.api({ action: 'toggle_flag', item_id: id });
        App.openEvent(App.state.currentEvent.id);
        App.shouldRefreshBoard = true;
    },

    toggleDone: async (id) => {
        await App.api({ action: 'toggle_done', item_id: id });
        App.openEvent(App.state.currentEvent.id);
        App.shouldRefreshBoard = true;
    },

    generatePDF: async (tripId) => {
        const event = App.state.currentEvent;
        const items = App.state.currentEventItems;

        let itemsHtml = items.map(item => {
            const isDivider = (item.is_divider == 1 || item.is_divider === true);

            if (isDivider) {
                return `
						<div class="pdf-divider">
							${item.title}
						</div>
						`;
            }

            return `
						<div class="pdf-item">
							<div class="pdf-item-header">
								<strong>${item.title}</strong>
								${item.item_date ? `<span class="pdf-item-date">${item.item_date}${item.end_date ? ' to ' + item.end_date : ''}</span>` : ''}
							</div>
							${item.subtitle ? `<div class="pdf-item-subtitle">${item.subtitle}</div>` : ''}
							${item.link_url ? `
				<div class="pdf-item-link-container" style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">
					<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.link_url)}" style="width: 90px; height: 90px; border-radius: 4px;" alt="QR Code">
					<div class="pdf-item-link" style="font-size: 0.8em; color: gray;">${item.link_url}</div>
				</div>
				` : ''}
						</div>
						`;
        }).join('');

        const dateRange = trip.start_date ? `${trip.start_date}${trip.end_date ? ' to ' + trip.end_date : ''}` : '';

        // Provide raw HTML. html2pdf manages the invisible rendering iframe automatically. 
        // We inject the CSS directly here because the iframe won't inherit styles from index.css or event_details.css
        const htmlStr = `
						<div style="width: 700px; max-width: 100%; box-sizing: border-box; padding: 30px; background-color: white; font-family: system-ui, -apple-system, sans-serif; color: #333;">
							<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
								<style>
									html, body {
										margin: 0;
									padding: 0;
					}
									.pdf-header {border - bottom: 2px solid #E8F4F8; margin-bottom: 20px; padding-bottom: 12px; }
									.pdf-header h1 {font - family: 'Fredoka', sans-serif; color: #00796B; font-size: 2rem; margin: 0 0 10px 0; }
									.pdf-meta {font - size: 0.95rem; color: #009688; margin-bottom: 6px; }

									.pdf-body {background: #FAFAFA; padding: 20px; border-radius: 8px; }

									.pdf-item {
										background: white;
									padding: 14px;
									border-radius: 6px;
									border-left: 4px solid #009688;
									margin-bottom: 14px;
									box-shadow: 0 1px 3px rgba(0,0,0,0.05);
									page-break-inside: avoid;
					}
									.pdf-item-header {display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
									.pdf-item-header strong {font - size: 1.1rem; color: #333; }
									.pdf-item-date {font - size: 0.85rem; color: #666; background: #E8F4F8; padding: 3px 8px; border-radius: 4px; }
									.pdf-item-subtitle {font - size: 0.95rem; color: #555; white-space: pre-wrap; margin-bottom: 8px; line-height: 1.4; }
									.pdf-item-link {font - size: 0.85rem; color: #009688; word-break: break-all; }

									.pdf-divider {
										font - size: 0.9rem;
									color: #009688;
									font-weight: 600;
									margin-top: 20px;
									margin-bottom: 10px;
									padding-bottom: 4px;
									border-bottom: 2px dashed #E8F4F8;
									page-break-inside: avoid;
					}
								</style>
								<div class="pdf-header">
									<h1>${trip.title}</h1>
									${trip.location ? `<div class="pdf-meta"><i class="fa-solid fa-location-dot"></i> ${trip.location}</div>` : ''}
									${dateRange ? `<div class="pdf-meta"><i class="fa-regular fa-calendar"></i> ${dateRange}</div>` : ''}
								</div>
								<div class="pdf-body">
									${itemsHtml ? itemsHtml : '<p>No itinerary items planned yet.</p>'}
								</div>
						</div>
						`;

        const opt = {
            margin: 0.5,
            filename: `${trip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        const btn = document.querySelector(`button[onclick="App.generatePDF(${tripId})"]`);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
            btn.disabled = true;
        }

        try {
            await html2pdf().set(opt).from(htmlStr).save();
        } catch (e) {
            console.error("PDF Generation error:", e);
            alert("Error generating PDF.");
        } finally {
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
                btn.disabled = false;
            }
        }
    },

    // --- Modal Logic ---
    openCreateWorkspaceModal: () => {
        App.shouldRefreshBoard = false; // Reset
        const body = document.getElementById('modal-body');
        body.innerHTML = `
						<h3>Create a New Workspace</h3>
						<div class="form-group" style="margin: 20px 0;">
							<label>Workspace Name</label>
							<input type="text" id="new-workspace-name" class="form-control" placeholder="e.g., Blue Cluster Events">
						</div>
						<button class="btn btn-primary" onclick="App.submitCreateWorkspace()">Create</button>
						`;
        document.getElementById('modal-container').classList.add('active');
        document.body.classList.add('modal-open');
    },

    closeModal: () => {
        document.getElementById('modal-container').classList.remove('active');
        document.querySelector('.modal-content').classList.remove('event-modal-wide');
        document.body.classList.remove('modal-open');
        if (App.shouldRefreshBoard && App.state.currentWorkspace) {
            App.openWorkspace(App.state.currentWorkspace.id); // Refresh board to show new trip dates/titles
        }
    },

    // --- Event Handlers ---
    handleLoginBtn: () => {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if (u && p) App.login(u, p);
    },

    handleRegisterBtn: () => {
        const u = document.getElementById('reg-username').value;
        const p = document.getElementById('reg-password').value;
        const f = document.getElementById('reg-firstname').value;
        const l = document.getElementById('reg-lastname').value;
        if (u && p) App.register(u, p, f, l);
    },

    toggleTheme: () => {
        document.documentElement.classList.toggle('dark-theme');
        if (document.documentElement.classList.contains('dark-theme')) {
            localStorage.setItem('practica_theme', 'dark');
        } else {
            localStorage.setItem('practica_theme', 'light');
        }
    },

    openSharingModal: async (tripId) => {
        const data = await App.api({ action: 'get_share_info', event_id: tripId });
        const modalBody = document.getElementById('modal-body');
        const shareUrl = `${window.location.origin}${window.location.pathname.replace('index.php', '')}share.php?token=${data.share_token}`;

        modalBody.innerHTML = `
			<div style="padding: 20px;">
				<h3><i class="fa-solid fa-share-nodes"></i> Share Event</h3>
				<p style="color: var(--color-text-light); margin-bottom: 20px;">Anyone with the link can view a read-only version of this trip.</p>
				
				<div style="background: var(--color-card-muted); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600;">
						<input type="checkbox" id="share-toggle" ${data.is_public == 1 ? 'checked' : ''} onchange="App.toggleSharing(${tripId}, this.checked)">
						Public Sharing Enabled
					</label>
				</div>

				<div id="share-link-section" style="display: ${data.is_public == 1 ? 'block' : 'none'};">
					<p style="font-size: 0.9rem; margin-bottom: 8px;">Public Link:</p>
					<div style="display: flex; gap: 10px; margin-bottom: 10px;">
						<input type="text" id="share-url-input" class="form-control" readonly value="${shareUrl}" style="background: #f8f9fa;">
						<button onclick="App.copyShareLink(event)" class="btn btn-secondary"><i class="fa-regular fa-copy"></i> Copy</button>
					</div>
					<p style="font-size: 0.8rem; color: var(--color-sea-dark);"><i class="fa-solid fa-circle-info"></i> Shared events include all categories, items, and notes within this specific event.</p>
				</div>

				<div style="display: flex; justify-content: flex-end; margin-top: 20px;">
					<button onclick="App.closeModal()" class="btn btn-primary">Done</button>
				</div>
			</div>
		`;
        document.getElementById('modal-container').style.display = 'flex';
    },

    toggleSharing: async (tripId, isEnabled) => {
        const data = await App.api({ action: 'toggle_sharing', event_id: tripId, is_public: isEnabled ? 1 : 0 });
        if (data.success) {
            // Update UI
            const linkSection = document.getElementById('share-link-section');
            if (linkSection) linkSection.style.display = isEnabled ? 'block' : 'none';

            // Refresh share info to ensure token is populated if it was just generated
            if (isEnabled) {
                App.openSharingModal(tripId);
            }
        }
    },

    copyShareLink: (e) => {
        const copyText = document.getElementById("share-url-input");
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(copyText.value);

        // Visual feedback
        const btn = e.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.style.background = 'var(--color-sea)';
        btn.style.color = 'white';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 2000);
    },


    createNewWorkspace: () => {
        App.openCreateWorkspaceModal();
    },

    // --- Drag and Drop ---
    drag: (ev, tripId) => {
        ev.dataTransfer.setData("text/plain", tripId);
        ev.dataTransfer.effectAllowed = "move";
        ev.currentTarget.classList.add('dragging');
    },

    allowDrop: (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";

        const list = ev.currentTarget;
        const afterElement = App.getDragAfterElement(list, ev.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            list.appendChild(draggable);
        } else {
            list.insertBefore(draggable, afterElement);
        }
    },

    getDragAfterElement: (container, y) => {
        const draggableElements = [...container.querySelectorAll('.event-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    drop: async (ev, categoryId) => {
        ev.preventDefault();
        const tripId = ev.dataTransfer.getData("text/plain");
        const draggable = document.querySelector('.dragging');
        draggable.classList.remove('dragging');

        // Update UI (DOM is already updated by allowDrop, but we need to update state and persist)

        // Find the new order
        const list = ev.currentTarget;
        const eventCards = [...list.querySelectorAll('.event-card')];
        const newEventIds = eventCards.map(card => card.id.replace('event-', ''));

        // Update local state
        const event = App.state.events.find(t => t.id == eventId);
        if (event) {
            event.category_id = categoryId;
            // Update sort orders in state
            newEventIds.forEach((id, index) => {
                const t = App.state.events.find(event => event.id == id);
                if (t) t.sort_order = index;
            });
        }

        // Call API
        await App.api({
            action: 'reorder_events',
            category_id: categoryId,
            event_ids: newEventIds
        });
    },
    // --- Trip Item Drag and Drop ---
    dragItem: (ev, itemId) => {
        ev.dataTransfer.setData("text/item", itemId);
        ev.dataTransfer.effectAllowed = "move";
        ev.currentTarget.classList.add('dragging-item');
    },

    allowDropItem: (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";

        const list = document.querySelector('.items-list');
        const afterElement = App.getDragAfterItemElement(list, ev.clientY);
        const draggable = document.querySelector('.dragging-item');
        if (!draggable || !list) return;

        if (afterElement == null) {
            list.appendChild(draggable);
        } else {
            list.insertBefore(draggable, afterElement);
        }
    },

    getDragAfterItemElement: (container, y) => {
        const draggableElements = [...container.querySelectorAll('.event-item:not(.dragging-item), .event-divider:not(.dragging-item)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    dropItem: async (ev, targetItemId) => {
        ev.preventDefault();
        const itemId = ev.dataTransfer.getData("text/item");
        if (!itemId) return;
        const draggable = document.querySelector('.dragging-item');
        if (draggable) draggable.classList.remove('dragging-item');

        const list = document.querySelector('.items-list');
        const itemElements = [...list.querySelectorAll('.event-item, .event-divider')];
        const newItemIds = itemElements.map(el => el.id.replace('event-item-', ''));

        // Update local state sort order for both the modal and the main board cache
        newItemIds.forEach((id, index) => {
            const currentItem = App.state.currentEventItems.find(i => i.id == id);
            if (currentItem) currentItem.sort_order = index;

            const globalItem = App.state.eventItems.find(i => i.id == id);
            if (globalItem) globalItem.sort_order = index;
        });

        // Re-sort local state array
        App.state.currentEventItems.sort((a, b) => a.sort_order - b.sort_order);

        await App.api({
            action: 'reorder_items',
            item_ids: newItemIds
        });
    },

    // --- Category Drag and Drop ---
    dragCategory: (ev, categoryId) => {
        // Prevent triggering if dragging a trip *inside* the category
        if (ev.target.classList.contains('event-card')) return;

        ev.dataTransfer.setData("text/category", categoryId);
        ev.dataTransfer.effectAllowed = "move";
        ev.currentTarget.classList.add('dragging-category');
        // Add a visual cue to the CSS so it stands out while dragging
        ev.currentTarget.style.opacity = "0.5";
    },

    allowDropCategory: (ev) => {
        // Only allow dropping categories, not events
        if (!ev.dataTransfer.types.includes("text/category")) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";

        const container = ev.currentTarget;
        const afterElement = App.getDragAfterCategory(container, ev.clientX);
        const draggable = document.querySelector('.dragging-category');

        if (draggable) {
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        }
    },

    getDragAfterCategory: (container, x) => {
        const draggableElements = [...container.querySelectorAll('.category-column:not(.dragging-category)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    dropCategory: async (ev) => {
        // Only process if it's a category
        if (!ev.dataTransfer.types.includes("text/category")) return;
        ev.preventDefault();

        const categoryId = ev.dataTransfer.getData("text/category");
        const draggable = document.querySelector('.dragging-category');

        if (draggable) {
            draggable.classList.remove('dragging-category');
            draggable.style.opacity = "1";
        }

        const container = ev.currentTarget;
        const categoryColumns = [...container.querySelectorAll('.category-column')];
        const newCategoryIds = categoryColumns.map(col => col.id.replace('cat-', ''));

        // Update local state
        newCategoryIds.forEach((id, index) => {
            const c = App.state.categories.find(cat => cat.id == id);
            if (c) c.sort_order = index;
        });

        // Call API
        await App.api({
            action: 'reorder_categories',
            workspace_id: App.state.currentWorkspace.id,
            category_ids: newCategoryIds
        });
    },

    // --- Item Assignments ---
    openAssignPopup: (e, itemId) => {
        e.stopPropagation();
        // Remove existing popup if any
        const existing = document.querySelector('.assign-popup');
        if (existing) existing.remove();

        const itemRect = e.currentTarget.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = 'assign-popup';
        popup.style.top = `${window.scrollY + itemRect.bottom + 5}px`;
        popup.style.left = `${window.scrollX + itemRect.left - 100}px`;

        const itemAssignments = App.state.currentEventAssignments || [];
        const itemAssignedUserIds = itemAssignments.filter(a => a.item_id == itemId).map(a => a.user_id);

        const membersList = App.state.workspaceMembers.map(m => {
            const isAssigned = itemAssignedUserIds.includes(m.id);
            const avatar = App.getUserAvatar(m.username);
            const fullName = m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username;
            const searchStr = `${m.first_name || ''} ${m.last_name || ''} ${m.username}`.toLowerCase();
            return `
				<div class="assign-member-item ${isAssigned ? 'assigned' : ''}" 
					 data-search="${searchStr}"
					 onclick="App.toggleAssignment(${itemId}, ${m.id}, ${isAssigned})">
					<!-- Individual assignment picker: now with full names and usernames! -->
					<div class="avatar-circle" style="background-color: ${avatar.color}; width: 24px; height: 24px; font-size: 0.75rem;"><i class="fa-solid ${avatar.icon}"></i></div>
					<div style="display: flex; flex-direction: column;">
						<span style="font-weight: 500;">${fullName}</span>
						${m.first_name ? `<span style="font-size: 0.7rem; color: #999;">@${m.username}</span>` : ''}
					</div>
					${isAssigned ? '<i class="fa-solid fa-check" style="margin-left: auto; color: var(--color-sea-blue);"></i>' : ''}
				</div>
			`;
        }).join('');

        popup.innerHTML = `
			<h4>Assign User</h4>
			<input type="text" class="assign-search" placeholder="Search members..." oninput="App.filterAssignees(this.value)">
			<div class="assign-member-list">
				${membersList}
			</div>
		`;

        document.body.appendChild(popup);

        // Close popup when clicking outside
        const closeHandler = (ev) => {
            if (!popup.contains(ev.target) && ev.target !== e.currentTarget) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    },

    toggleAssignment: async (itemId, userId, isAssigned) => {
        // Toggle user assignments: "Sticky" and real-time, just the way we like it.
        const action = isAssigned ? 'unassign_item' : 'assign_item';
        try {
            await App.api({ action, item_id: itemId, user_id: userId });
            // Refresh event details to get new assignments
            const res = await App.api({ action: 'get_event', event_id: App.state.currentEvent.id });
            App.state.currentEventAssignments = res.assignments;
            App.renderEventModal();
            App.shouldRefreshBoard = true; // Mark board for refresh on close
        } catch (e) {
            console.error(e);
        }
    },

    filterAssignees: (val) => {
        const items = document.querySelectorAll('.assign-member-item');
        val = val.toLowerCase();
        items.forEach(item => {
            const searchStr = item.getAttribute('data-search') || '';
            item.style.display = searchStr.includes(val) ? 'flex' : 'none';
        });
    }
};

// Global helpers for HTML onclick events
function closeModal() {
    App.closeModal();
}

window.showModal = () => {
    document.getElementById('modal-container').classList.add('active');
    document.body.classList.add('modal-open');
};

window.closeModal = () => {
    document.getElementById('modal-container').classList.remove('active');
    document.body.classList.remove('modal-open');
    if (App.shouldRefreshBoard) {
        App.renderBoard();
        App.shouldRefreshBoard = false;
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
