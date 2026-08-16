// js/dashboard.js

const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const FASTAPI_URL = 'http://127.0.0.1:8000'; // Backend URL for Notification APIs

let currentUser = null;
let currentStudent = null;
let isProfileComplete = false; // Tracks if they are allowed to navigate block logic
let isNotificationsLinked = false; // NEW: Tracks if both channels are linked

document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

// --- INITIALIZATION ---
async function initializeDashboard() {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (!session || sessionError) {
        window.location.href = "login.html"; 
        return;
    }
    currentUser = session.user;

    const { data: student, error: dbError } = await supabaseClient
        .from('students')
        .select('*')
        .eq('auth_id', currentUser.id)
        .single();

    if (dbError || !student) {
        showToast("Error loading profile data.", "error");
        return;
    }
    
    currentStudent = student;
    const name = `${student.first_name} ${student.last_name}`;
    const id = student.admission_number;
    
    const intake = (student.intake === 'Not Set' || !student.intake) ? "" : student.intake;
    const block = (student.block === 'Not Set' || student.block === 'Pending' || !student.block) ? "" : student.block;
    const isLocked = student.is_locked;

    // Check Notification Links
    const tgLinked = !!student.telegram_chat_id;
    const waLinked = !!student.whatsapp_phone;
    isNotificationsLinked = tgLinked || waLinked;

    document.getElementById('ui-name-sidebar').innerText = name;
    document.getElementById('ui-id-sidebar').innerText = id;
    document.getElementById('ui-welcome-name').innerText = `Welcome Back, ${student.first_name}!`;
    document.getElementById('ui-avatar').src = `https://ui-avatars.com/api/?name=${name}&background=003366&color=fff`;

    document.getElementById('ui-block-header').innerText = block || "Setup Required";
    document.getElementById('ui-block-main').innerText = block || "Not Assigned";
    document.getElementById('ui-intake-badge').innerText = intake ? `${intake}` : "Intake Pending";
    document.getElementById('ui-attendance-main').innerText = student.attendance || '0%';

    setupProfileFields(intake, block, isLocked, id);
    updateNotificationUI(tgLinked, waLinked); // Update the setup screen UI
    
    // Check if the student needs to be blocked
    if (!block || !intake) {
        isProfileComplete = false;
        document.getElementById('forcedSetupModal').classList.remove('hidden');
        document.getElementById('setup-banner').classList.remove('hidden');
    } else {
        isProfileComplete = true;
        fetchAcademicData(id, block, intake); 
    }
}

// --- PROFILE & BLOCK LOGIC ---
function setupProfileFields(intake, block, isLocked, admNumber) {
    const intakeSelect = document.getElementById('prof-intake');
    const blockSelect = document.getElementById('prof-block');
    const lockBtn = document.getElementById('btn-lock-profile');
    const admInput = document.getElementById('prof-adm');

    admInput.value = admNumber;
    if (intake) intakeSelect.value = intake;
    if (block) blockSelect.value = block;

    if (isLocked) {
        intakeSelect.disabled = true;
        blockSelect.disabled = true;
        lockBtn.innerHTML = '<i class="fas fa-lock mr-2"></i> Profile Locked';
        lockBtn.classList.replace('bg-ramBlue', 'bg-gray-400');
        lockBtn.onclick = () => showToast("Contact Admin to change Block or Intake.", "error");
    }
}

async function lockProfile() {
    const intake = document.getElementById('prof-intake').value;
    const block = document.getElementById('prof-block').value;

    if (!intake || !block) {
        showToast("Please select both Intake and Block.", "error");
        return;
    }

    openCustomConfirm({
        title: "Lock Progression?",
        desc: "Once locked, you cannot change your Block or Intake without Admin permission. Proceed?",
        icon: "fa-lock",
        color: "ramBlue",
        onConfirm: async () => {
            const lockBtn = document.getElementById('btn-lock-profile');
            lockBtn.disabled = true;
            lockBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Locking...';

            try {
                const { data, error } = await supabaseClient
                    .from('students')
                    .update({ 
                        intake: intake, 
                        block: block, 
                        is_locked: true 
                    })
                    .eq('auth_id', currentUser.id)
                    .select();

                if (error) throw error;
                
                if (!data || data.length === 0) {
                    throw new Error("Update blocked by security policy.");
                }

                showToast("Profile locked successfully!", "success");
                setTimeout(() => location.reload(), 1500);
                
            } catch (e) {
                showToast("Action blocked or server error.", "error");
                lockBtn.disabled = false;
                lockBtn.innerHTML = "Save & Lock Progression";
            }
        }
    });
}

// --- NOTIFICATION SETUP LOGIC (NEW) ---
function updateNotificationUI(tg, wa) {
    // 1. Sidebar Badge
    if (tg || wa) {
        const notifBadge = document.querySelector('#nav-notifications .bg-ramGold');
        if (notifBadge) notifBadge.classList.add('hidden');
    }

    // 2. Telegram Status
    if (tg) {
        document.getElementById('tg-status-card').classList.replace('border-red-100', 'border-green-100');
        document.getElementById('tg-status-icon').classList.replace('text-gray-300', 'text-green-500');
        document.getElementById('tg-status-text').innerText = "Linked";
        document.getElementById('tg-status-text').classList.replace('text-gray-800', 'text-green-600');
        
        const btnTg = document.getElementById('btnLinkTelegram');
        if (btnTg) {
            btnTg.disabled = true;
            btnTg.innerHTML = '<i class="fas fa-check"></i> Linked';
            btnTg.classList.replace('bg-blue-500', 'bg-green-500');
            btnTg.classList.replace('hover:bg-blue-600', 'hover:bg-green-600');
        }
    }

    // 3. WhatsApp Status
    if (wa) {
        document.getElementById('wa-status-card').classList.replace('border-red-100', 'border-green-100');
        document.getElementById('wa-status-icon').classList.replace('text-gray-300', 'text-green-500');
        document.getElementById('wa-status-text').innerText = "Linked";
        document.getElementById('wa-status-text').classList.replace('text-gray-800', 'text-green-600');
        
        const waContainer = document.getElementById('whatsappInputContainer');
        if (waContainer) {
            waContainer.innerHTML = '<div class="px-6 py-3 bg-green-100 text-green-700 text-sm font-bold rounded-xl flex items-center justify-center gap-2"><i class="fas fa-check-circle"></i> Verified</div>';
        }
    }

    // 4. Completion Banner
    if (tg || wa) {
        const lockMsg = document.getElementById('completion-lock-msg');
        if (lockMsg) {
            lockMsg.classList.replace('bg-yellow-50', 'bg-green-50');
            lockMsg.classList.replace('border-yellow-200', 'border-green-200');
            lockMsg.classList.replace('text-yellow-800', 'text-green-800');
            lockMsg.innerHTML = '<i class="fas fa-unlock"></i> Notification channels secured. Full portal access granted.';
        }
    }
}

async function startTelegramLink() {
    const btn = document.getElementById('btnLinkTelegram');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${FASTAPI_URL}/api/generate-telegram-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admission_number: currentStudent.admission_number })
        });
        
        if (!response.ok) throw new Error("Failed to generate link");
        const data = await response.json();
        
        window.open(data.link, '_blank');
        showToast("Opening Telegram. Click 'Start' in the bot to link!", "success");
        
        btn.innerHTML = '<i class="fas fa-sync"></i> Refresh Page After Linking';
        btn.disabled = false;
        btn.onclick = () => location.reload();
        
    } catch (e) {
        console.error(e);
        showToast("Error generating Telegram link.", "error");
        btn.innerHTML = '<i class="fas fa-link"></i> Link Telegram';
        btn.disabled = false;
    }
}

async function saveWhatsApp() {
    const phone = document.getElementById('waPhoneInput').value.trim();
    const btn = document.getElementById('btnLinkWhatsapp');
    
    if (!phone) return showToast("Please enter your WhatsApp number.", "error");
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${FASTAPI_URL}/api/link-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                admission_number: currentStudent.admission_number,
                phone_number: phone
            })
        });
        
        if (!response.ok) throw new Error("Failed to link WhatsApp");
        
        showToast("WhatsApp successfully linked!", "success");
        setTimeout(() => location.reload(), 1500);
    } catch (e) {
        console.error(e);
        showToast("Error saving WhatsApp number.", "error");
        btn.innerHTML = '<i class="fas fa-save"></i> Save';
        btn.disabled = false;
    }
}


// --- SUPER FETCHER RENDERING ---
async function fetchAcademicData(admissionId, block, intake) {
    document.getElementById('announcement-mini-list').innerHTML = '<p class="text-xs text-gray-400 animate-pulse text-center py-4">Fetching updates...</p>';

    try {
        const now = new Date().toISOString(); // Current time for the expiry check

        const [blockStatusRes, resultsRes, announcementsRes, placementRes, issuesRes] = await Promise.all([
            // 1. Checks if the entire block is published (All-or-Nothing Logic)
            supabaseClient.from('student_blocks').select('is_published').eq('block_name', block).maybeSingle(),
            // 2. Fetch approved results
            supabaseClient.from('exam_results').select('*').eq('admission_number', admissionId).eq('block_name', block).eq('status', 'Approved'),
            // 3. Fetch active announcements matching the student's block or global
            supabaseClient.from('global_announcements').select('*, staff_profiles(full_name)').eq('is_active', true).in('target_audience', ['All Students', block, intake]).order('created_at', { ascending: false }),
            // 4. Fetches the most recent clinical placement securely
            supabaseClient.from('clinical_placements').select('*').eq('admission_number', admissionId).order('created_at', { ascending: false }).limit(1),
            // 5. Matches your 'support_tickets' schema
            supabaseClient.from('support_tickets').select('*').eq('admission_number', admissionId).order('created_at', { ascending: false })
        ]);

        const tableBody = document.getElementById('results-table-body');
        const miniList = document.getElementById('results-mini-list');
        if(tableBody) tableBody.innerHTML = "";
        if(miniList) miniList.innerHTML = "";

        // Evaluate "All-or-Nothing" Grade Status
        const isPublished = blockStatusRes.data && blockStatusRes.data.is_published === true;
        const results = resultsRes.data || [];
        
        if (!isPublished) {
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 text-sm"><i class="fas fa-lock text-2xl text-gray-300 mb-3 block"></i>Results Pending Final Approval</td></tr>';
            if(miniList) miniList.innerHTML = '<p class="text-center text-xs text-gray-400 py-4"><i class="fas fa-lock mr-1 text-gray-300"></i> Results Pending Approval</p>';
        } else if (results.length > 0) {
            results.forEach(item => {
                if(tableBody) {
                    tableBody.innerHTML += `
                        <tr>
                            <td class="px-6 py-4 font-medium text-gray-700">${item.unit_name}</td>
                            <td class="px-6 py-4">${item.total_score}</td>
                            <td class="px-6 py-4 font-bold text-ramBlue">${item.grade}</td>
                            <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Verified</span></td>
                        </tr>`;
                }
                if(miniList) {
                    miniList.innerHTML += `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl mb-2"><span class="text-xs font-bold text-gray-600">${item.unit_name}</span><span class="text-xs font-black text-ramBlue">${item.grade}</span></div>`;
                }
            });
        } else {
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500 text-sm">No units found for this block.</td></tr>';
            if(miniList) miniList.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No units found.</p>';
        }

        const miniAnnounce = document.getElementById('announcement-mini-list');
        const fullAnnounce = document.getElementById('full-announcement-list');
        if(miniAnnounce) miniAnnounce.innerHTML = "";
        if(fullAnnounce) fullAnnounce.innerHTML = "";

        const announcements = announcementsRes.data || [];
        if (announcements.length === 0) {
            if(miniAnnounce) miniAnnounce.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">No announcements for your block.</p>';
            if(fullAnnounce) fullAnnounce.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No announcements at this time.</p>';
        } else {
            announcements.forEach(news => {
                const dateStr = new Date(news.created_at).toLocaleDateString();
                const author = news.staff_profiles ? news.staff_profiles.full_name : 'Administration';
                
                if(miniAnnounce) miniAnnounce.innerHTML += `<div class="border-l-2 border-ramGold pl-3 py-1 mb-3"><p class="text-[9px] font-black text-ramGold uppercase">${dateStr}</p><p class="text-xs font-bold text-gray-800">${news.title}</p></div>`;
                if(fullAnnounce) fullAnnounce.innerHTML += `<div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4"><div class="flex justify-between items-start mb-2"><h4 class="font-bold text-ramBlue">${news.title}</h4><span class="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100"><i class="fas fa-user-edit mr-1 text-gray-400"></i> ${author} • ${dateStr}</span></div><p class="text-sm text-gray-600 leading-relaxed">${news.message}</p></div>`;
            });
        }

        const placement = placementRes.data && placementRes.data.length > 0 ? placementRes.data[0] : null;
        if (placement && document.getElementById('ui-placement-status')) {
            document.getElementById('ui-placement-status').innerHTML = `<span class="text-ramGreen">${placement.status}</span>`;
            document.getElementById('ui-placement-hospital').innerText = placement.hospital_name;
            document.getElementById('ui-placement-details').innerText = `Clinical Assignment`;
            document.getElementById('ui-placement-start').innerText = new Date(placement.start_date).toLocaleDateString();
            document.getElementById('ui-placement-end').innerText = new Date(placement.end_date).toLocaleDateString();
        }

        const issuesList = document.getElementById('issues-list');
        const issues = issuesRes.data || [];
        if (issues.length > 0 && issuesList) {
            issuesList.innerHTML = "";
            issues.forEach(issue => {
                const isResolved = issue.status.toLowerCase() === 'resolved';
                issuesList.innerHTML += `
                    <div class="border border-gray-100 rounded-xl p-4 bg-gray-50 mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] font-black uppercase text-gray-500">${issue.category}</span>
                            <span class="text-[10px] font-bold px-2 py-1 rounded ${isResolved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${issue.status}</span>
                        </div>
                        <p class="text-xs text-gray-600 mb-3">${issue.message}</p>
                        <div class="border-t border-gray-200 pt-2 mt-2">
                            <p class="text-[10px] font-bold text-ramBlue mb-1">Admin Notes:</p>
                            <p class="text-xs text-gray-500 italic">${issue.officer_notes || 'Pending review...'}</p>
                        </div>
                    </div>`;
            });
        }

    } catch (e) {
        console.error("Fetch Error:", e);
        const elements = ['announcement-mini-list', 'results-mini-list'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="text-xs text-red-50 text-center py-4">Failed to load content.</p>';
        });
    }
}

// --- NAVIGATION INTERCEPTOR ---
function showSection(sectionId) {
    // 1. Profile Completion Lock
    if (!isProfileComplete && sectionId !== 'home' && sectionId !== 'support') {
        document.getElementById('forcedSetupModal').classList.remove('hidden');
        return; 
    }

    // 2. Notification Gateway Lock
    // Block Academics, Clinicals, and Announcements if notifications aren't fully linked
    if (isProfileComplete && !isNotificationsLinked && ['academics', 'clinical', 'announcements'].includes(sectionId)) {
        showToast("Please link Telegram and WhatsApp to unlock this feature.", "error");
        showSection('notifications');
        return;
    }

    // ADDED 'notifications' to this array so it properly hides previous pages
    const sections = ['home', 'academics', 'clinical', 'announcements', 'support', 'notifications'];
    
    sections.forEach(id => {
        const sec = document.getElementById('section-' + id);
        const nav = document.getElementById('nav-' + id);
        if (sec) sec.classList.add('hidden');
        if (nav) nav.classList.replace('bg-blue-800', 'hover:bg-blue-700/50');
    });

    document.getElementById('section-' + sectionId).classList.remove('hidden');
    
    // Some buttons (like Notifications) might not have the standard background classes yet, so we handle safely
    const navBtn = document.getElementById('nav-' + sectionId);
    if(navBtn) navBtn.classList.replace('hover:bg-blue-700/50', 'bg-blue-800');
    
    const titles = {
        'home': 'Overview', 
        'academics': 'Academic Results',
        'clinical': 'Clinicals', 
        'announcements': 'Announcements', 
        'support': 'Support',
        'notifications': 'Notification Setup' // Fixed the "undefined" bug
    };
    document.getElementById('page-title').innerText = titles[sectionId];
    toggleDrawer(false); 
}

function goToSetup() {
    document.getElementById('forcedSetupModal').classList.add('hidden');
    showSection('support');
}

// --- CUSTOM MODAL CONTROLLER ---
function openCustomConfirm({ title, desc, icon, onConfirm, color = 'ramBlue' }) {
    const modal = document.getElementById('customModal');
    const backdrop = document.getElementById('modalBackdrop');
    const box = document.getElementById('modalBox');
    const confirmBtn = document.getElementById('modalConfirmBtn');

    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalDescription').innerText = desc;
    document.getElementById('modalIcon').className = `fas ${icon}`;
    
    const colorMap = {
        'ramBlue': 'bg-ramBlue',
        'ramGreen': 'bg-ramGreen',
        'ramRed': 'bg-ramRed',
        'ramGold': 'bg-ramGold'
    };
    confirmBtn.className = `flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition transform active:scale-95 flex items-center justify-center cursor-pointer ${colorMap[color] || 'bg-blue-600'}`;

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);

    confirmBtn.onclick = () => {
        onConfirm();
        closeCustomModal();
    };
}

function closeCustomModal() {
    const backdrop = document.getElementById('modalBackdrop');
    const box = document.getElementById('modalBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('customModal').classList.add('hidden');
    }, 300);
}

// --- ISSUE REPORTING ---
async function submitIssue(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-issue');
    const category = document.getElementById('issue-category').value;
    const message = document.getElementById('issue-msg').value;

    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        const payload = {
            student_name: `${currentStudent.first_name} ${currentStudent.last_name}`,
            admission_number: currentStudent.admission_number,
            category: category,
            subject: `${category} Query`,
            message: message,
            priority: 'Medium',
            status: 'Open'
        };

        const { error } = await supabaseClient.from('support_tickets').insert([payload]);
        
        if (error) throw error;

        showToast("Issue submitted to Admin.", "success");
        document.getElementById('issueForm').reset();
        
        setTimeout(() => location.reload(), 1500);

    } catch (e) {
        console.error(e);
        showToast("Submission failed. Try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit to Administration";
    }
}

// --- TOASTS & LOGOUT ---
function showToast(msg, type) {
    const container = document.getElementById('toastContainer');
    const color = type === 'success' ? 'border-ramGreen' : 'border-ramRed';
    const icon = type === 'success' ? 'fa-check-circle text-ramGreen' : 'fa-exclamation-circle text-ramRed';
    
    const toast = document.createElement('div');
    toast.className = `bg-white border-l-4 ${color} p-4 mb-3 rounded-xl shadow-xl flex items-center animate-fade-in pointer-events-auto transition-opacity duration-300`;
    toast.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><span class="text-xs font-bold text-gray-700">${msg}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function logout() {
    openCustomConfirm({
        title: "Logout?",
        desc: "Are you sure you want to end your current session?",
        icon: "fa-power-off",
        color: "ramRed",
        onConfirm: async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "login.html";
        }
    });
}
