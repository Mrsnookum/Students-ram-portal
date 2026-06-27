// js/dashboard.js

const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentStudent = null;
let isProfileComplete = false; // Tracks if they are allowed to navigate

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
    const block = (student.block === 'Not Set' || !student.block) ? "" : student.block;
    const isLocked = student.is_locked;

    document.getElementById('ui-name-sidebar').innerText = name;
    document.getElementById('ui-id-sidebar').innerText = id;
    document.getElementById('ui-welcome-name').innerText = `Welcome Back, ${student.first_name}!`;
    document.getElementById('ui-avatar').src = `https://ui-avatars.com/api/?name=${name}&background=003366&color=fff`;

    document.getElementById('ui-block-header').innerText = block || "Setup Required";
    document.getElementById('ui-block-main').innerText = block || "Not Assigned";
    document.getElementById('ui-intake-badge').innerText = intake ? `${intake}` : "Intake Pending";
    document.getElementById('ui-attendance-main').innerText = student.attendance || '0%';

    setupProfileFields(intake, block, isLocked, id);
    
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

// --- SUPER FETCHER RENDERING ---
async function fetchAcademicData(admissionId, block, intake) {
    document.getElementById('announcement-mini-list').innerHTML = '<p class="text-xs text-gray-400 animate-pulse text-center py-4">Fetching updates...</p>';

    try {
        const [resultsRes, announcementsRes, placementRes, issuesRes] = await Promise.all([
            // Matches your 'exam_results' table schema for approved results
            supabaseClient.from('exam_results').select('*').eq('admission_number', admissionId).eq('block_name', block).eq('status', 'Approved'),
            // Matches your 'global_announcements' table and targets - updated to include staff_profiles(full_name)
            supabaseClient.from('global_announcements').select('*, staff_profiles(full_name)').eq('is_active', true).in('target_audience', ['All Students', block, intake]).order('created_at', { ascending: false }),
            // Fetches the most recent clinical placement securely without crashing on empty
            supabaseClient.from('clinical_placements').select('*').eq('admission_number', admissionId).order('created_at', { ascending: false }).limit(1),
            // Matches your 'support_tickets' schema linking via admission number
            supabaseClient.from('support_tickets').select('*').eq('admission_number', admissionId).order('created_at', { ascending: false })
        ]);

        const tableBody = document.getElementById('results-table-body');
        const miniList = document.getElementById('results-mini-list');
        if(tableBody) tableBody.innerHTML = "";
        if(miniList) miniList.innerHTML = "";

        const results = resultsRes.data || [];
        if (results.length > 0) {
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
            if (miniList && miniList.innerHTML === "") miniList.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No results released yet.</p>';
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
            if (el) el.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Failed to load content.</p>';
        });
    }
}

// --- NAVIGATION INTERCEPTOR ---
function showSection(sectionId) {
    // Intercept navigation if profile is incomplete
    if (!isProfileComplete && sectionId !== 'home' && sectionId !== 'support') {
        document.getElementById('forcedSetupModal').classList.remove('hidden');
        return; 
    }

    const sections = ['home', 'academics', 'clinical', 'announcements', 'support'];
    sections.forEach(id => {
        const sec = document.getElementById('section-' + id);
        const nav = document.getElementById('nav-' + id);
        if (sec) sec.classList.add('hidden');
        if (nav) nav.classList.replace('bg-blue-800', 'hover:bg-blue-700/50');
    });

    document.getElementById('section-' + sectionId).classList.remove('hidden');
    document.getElementById('nav-' + sectionId).classList.replace('hover:bg-blue-700/50', 'bg-blue-800');
    
    const titles = {
        'home': 'Overview', 'academics': 'Academic Results',
        'clinical': 'Clinicals', 'announcements': 'Announcements', 'support': 'Support'
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