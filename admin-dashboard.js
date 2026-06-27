// admin-dashboard.js

// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentAdmin = null;
let adminProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeAdminDashboard();
});

// --- INITIALIZATION & RBAC LOGIC ---
async function initializeAdminDashboard() {
    // 1. Verify Session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (!session || sessionError) {
        window.location.href = "admin-login.html"; 
        return;
    }
    currentAdmin = session.user;

    // 2. Fetch RBAC Profile
    const { data: profile, error: profileError } = await supabaseClient
        .from('staff_profiles')
        .select('*')
        .eq('auth_id', currentAdmin.id)
        .single();

    if (profileError || !profile || !profile.is_active) {
        await supabaseClient.auth.signOut();
        window.location.href = "admin-login.html";
        return;
    }

    adminProfile = profile;

    // 3. Update UI Headers
    document.getElementById('ui-admin-name').innerText = profile.full_name;
    document.getElementById('ui-admin-dept').innerText = profile.department;
    document.getElementById('ui-role-badge').innerText = profile.role_level;
    document.getElementById('welcome-name').innerText = profile.full_name.split(' ')[0];

    // 4. Build Navigation based on Role
    buildNavigation(profile.role_level);
}

function buildNavigation(role) {
    const navMenu = document.getElementById('admin-nav-menu');
    navMenu.innerHTML = ''; // Clear existing

    // Define all possible modules and who can access them
    const modules = [
        { id: 'overview', icon: 'fa-chart-pie', label: 'Overview', roles: ['SuperAdmin', 'Principal', 'HOD', 'Deputy HOD', 'Lecturer', 'Welfare', 'Placement'] },
        { id: 'staff', icon: 'fa-users-cog', label: 'Staff Management', roles: ['SuperAdmin'] },
        { id: 'academics', icon: 'fa-graduation-cap', label: 'Academics & Results', roles: ['SuperAdmin', 'Principal', 'HOD', 'Deputy HOD', 'Lecturer'] },
        { id: 'placements', icon: 'fa-hospital-user', label: 'Clinical Placements', roles: ['SuperAdmin', 'Principal', 'Placement'] },
        { id: 'welfare', icon: 'fa-headset', label: 'Student Welfare', roles: ['SuperAdmin', 'Principal', 'Welfare'] },
        { id: 'announcements', icon: 'fa-bullhorn', label: 'Announcements', roles: ['SuperAdmin', 'Principal', 'HOD', 'Deputy HOD'] },
        { id: 'settings', icon: 'fa-cog', label: 'My Account', roles: ['SuperAdmin', 'Principal', 'HOD', 'Deputy HOD', 'Lecturer', 'Welfare', 'Placement'] }
    ];

    modules.forEach(mod => {
        // If the admin's role is in the allowed list for this module, generate the button
        if (mod.roles.includes(role)) {
            const btn = document.createElement('button');
            btn.onclick = () => showAdminSection(mod.id);
            btn.id = `nav-${mod.id}`;
            // Base classes for unselected state
            btn.className = `nav-btn w-full flex items-center px-6 py-3.5 text-gray-400 hover:text-white hover:bg-adminAccent/50 transition-all font-medium text-sm`;
            btn.innerHTML = `<i class="fas ${mod.icon} w-6 text-center mr-2"></i><span>${mod.label}</span>`;
            navMenu.appendChild(btn);
        }
    });

    // Default to first permitted module
    showAdminSection('overview');
}

// --- NAVIGATION HANDLER ---
function showAdminSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'text-white');
        btn.classList.add('text-gray-400');
    });

    const targetSec = document.getElementById(`section-${sectionId}`);
    if (targetSec) targetSec.classList.remove('hidden');

    const targetNav = document.getElementById(`nav-${sectionId}`);
    if (targetNav) {
        targetNav.classList.add('active', 'text-white');
        targetNav.classList.remove('text-gray-400');
    }

    const titles = {
        'overview': 'Dashboard Overview',
        'staff': 'Staff Management',
        'academics': 'Academic Control Center',
        'placements': 'Clinical Placement Manager',
        'welfare': 'Student Welfare Desk',
        'announcements': 'Broadcast Center',
        'settings': 'Account Settings'
    };
    document.getElementById('page-title').innerText = titles[sectionId] || 'Dashboard';

    // TRIGGER DATA FETCHES
    if (sectionId === 'overview') loadDynamicOverview();
    if (sectionId === 'staff') fetchStaffList();
    if (sectionId === 'academics') renderAcademicsModule();
    if (sectionId === 'announcements') fetchAnnouncements(); 
    if (sectionId === 'placements') fetchPlacementStudents();
    if (sectionId === 'welfare') fetchWelfareTickets();

    if (window.innerWidth < 768) toggleDrawer(false);
}

// --- ACADEMICS: LECTURER VS HOD ROUTING ---
function renderAcademicsModule() {
    const isLecturer = adminProfile.role_level === 'Lecturer';
    
    if (isLecturer) {
        document.getElementById('lecturer-view').classList.remove('hidden');
        document.getElementById('hod-view').classList.add('hidden');
        fetchMyUnits(); 
        fetchLecturerSubmissions(); // Added to ensure the activity UI populates
    } else {
        document.getElementById('lecturer-view').classList.add('hidden');
        document.getElementById('hod-view').classList.remove('hidden');
        // Fetch the lecturers list for the HOD
        fetchDepartmentLecturers();
        // Fetch pending results for HOD approval
        fetchPendingApprovals();
    }
}

// --- LECTURER: CLAIM AND VIEW UNITS ---
async function claimUnit(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-claim-unit');
    const block = document.getElementById('lec-block').value;
    const unit = document.getElementById('lec-unit').value.trim();

    btn.disabled = true;
    btn.innerHTML = "Adding...";

    try {
        const payload = {
            lecturer_id: adminProfile.id,
            block_name: block,
            unit_name: unit
        };

        const { error } = await supabaseClient.from('unit_assignments').insert([payload]);
        if (error) {
            if (error.code === '23505') throw new Error("You have already registered this unit for this block.");
            throw error;
        }

        showToast(`${unit} added to your roster.`, "success");
        document.getElementById('addUnitForm').reset();
        fetchMyUnits(); 

    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Add Unit";
    }
}

async function fetchMyUnits() {
    const list = document.getElementById('my-units-list');
    list.innerHTML = '<p class="text-sm text-gray-400 italic">Fetching your units...</p>';
    
    try {
        const { data, error } = await supabaseClient
            .from('unit_assignments')
            .select('*')
            .eq('lecturer_id', adminProfile.id)
            .order('block_name', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400">You have not registered any units yet.</p>';
            return;
        }

        list.innerHTML = '';
        data.forEach(u => {
            list.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <div>
                        <span class="text-[10px] font-black uppercase text-ramGold">${u.block_name}</span>
                        <p class="text-sm font-bold text-gray-800">${u.unit_name}</p>
                    </div>
                    <button onclick="openGradebook('${u.block_name}', '${u.unit_name}')" class="text-xs font-bold text-ramBlue hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition border border-blue-100 shadow-sm">
                        Enter Grades <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            `;
        });
    } catch (e) {
        list.innerHTML = '<p class="text-sm text-red-500">Failed to load units.</p>';
    }
}

// --- STAFF SETTINGS (PASSWORD UPDATE) ---
async function updatePassword(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-update-pwd');
    const newPassword = document.getElementById('new-password').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        showToast("Password updated successfully!", "success");
        document.getElementById('settingsForm').reset();
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Password";
    }
}

// --- DATA FETCHERS (SuperAdmin Only) ---
async function fetchStaffList() {
    if (adminProfile.role_level !== 'SuperAdmin') return;

    const tbody = document.getElementById('staff-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading staff directory...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('staff_profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No staff found.</td></tr>';
            return;
        }

        data.forEach(staff => {
            const statusBadge = staff.is_active 
                ? '<span class="px-2.5 py-1 bg-green-100 text-green-700 font-bold text-[10px] rounded-full">Active</span>'
                : '<span class="px-2.5 py-1 bg-red-100 text-red-700 font-bold text-[10px] rounded-full">Disabled</span>';
            
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4">
                        <p class="font-bold text-gray-800">${staff.full_name}</p>
                        <p class="text-[10px] text-gray-400">${staff.email}</p>
                    </td>
                    <td class="px-6 py-4 text-xs font-medium text-gray-600 uppercase tracking-wider">${staff.department}</td>
                    <td class="px-6 py-4 font-bold text-adminDark text-xs">${staff.role_level}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                </tr>
            `;
        });
    } catch (e) {
        showToast("Failed to load staff list.", "error");
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
    }
}

// --- TOASTS & LOGOUT ---
function showToast(msg, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const border = type === 'success' ? 'border-green-500' : 'border-red-500';
    const icon = type === 'success' ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-500';
    
    toast.className = `bg-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl border-l-4 ${border} font-semibold text-xs md:text-sm flex items-center justify-between mb-3 animate-fade-in pointer-events-auto`;
    toast.innerHTML = `<div class="flex items-center"><i class="fas ${icon} mr-3 text-lg"></i><span class="text-gray-800">${msg}</span></div>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function logoutAdmin() {
    await supabaseClient.auth.signOut();
    window.location.href = "admin-login.html";
}

// --- STAFF MANAGEMENT LOGIC ---
function openStaffModal() {
    const modal = document.getElementById('addStaffModal');
    const backdrop = document.getElementById('staffModalBackdrop');
    const box = document.getElementById('staffModalBox');

    document.getElementById('addStaffForm').reset();

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);
}

function closeStaffModal() {
    const backdrop = document.getElementById('staffModalBackdrop');
    const box = document.getElementById('staffModalBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('addStaffModal').classList.add('hidden');
    }, 300);
}

async function submitNewStaff(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-staff');
    
    const uid = document.getElementById('staff-uid').value.trim();
    const name = document.getElementById('staff-name').value.trim();
    const email = document.getElementById('staff-email').value.trim();
    const dept = document.getElementById('staff-dept').value;
    const role = document.getElementById('staff-role').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

    try {
        const payload = {
            auth_id: uid,
            full_name: name,
            email: email,
            department: dept,
            role_level: role,
            is_active: true
        };

        const { error } = await supabaseClient.from('staff_profiles').insert([payload]);
        
        if (error) {
            // Check for specific unique constraint errors
            if (error.code === '23505') throw new Error("A staff member with this UID or Email already exists.");
            throw error;
        }

        showToast(`${name} added successfully as a ${role}.`, "success");
        closeStaffModal();
        fetchStaffList(); // Refresh the table

    } catch (e) {
        console.error(e);
        showToast(e.message || "Failed to add staff member.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Staff Member";
    }
}

// --- HOD LECTURER MANAGEMENT ---
function openHodLecturerModal() {
    const modal = document.getElementById('hodLecturerModal');
    const backdrop = document.getElementById('hodLecBackdrop');
    const box = document.getElementById('hodLecBox');

    document.getElementById('hodLecturerForm').reset();

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);
}

function closeHodLecturerModal() {
    const backdrop = document.getElementById('hodLecBackdrop');
    const box = document.getElementById('hodLecBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('hodLecturerModal').classList.add('hidden');
    }, 300);
}

// Fetch the newly added department lecturers from the database
async function fetchDepartmentLecturers() {
    const list = document.getElementById('hod-lecturer-list');
    if (!list) return;

    list.innerHTML = '<p class="text-sm text-gray-400 italic">Loading lecturers from database...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('staff_profiles')
            .select('*')
            .eq('department', 'Academics')
            .eq('role_level', 'Lecturer')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400">No lecturers found in this department.</p>';
            return;
        }

        list.innerHTML = '';
        data.forEach(lec => {
            const initials = lec.full_name.substring(0, 2).toUpperCase();
            list.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-blue-100 text-ramBlue rounded-full flex items-center justify-center font-bold text-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">${lec.full_name}</p>
                            <p class="text-[10px] text-gray-400">${lec.email}</p>
                        </div>
                    </div>
                    <span class="px-2 py-1 bg-green-100 text-green-700 font-bold text-[10px] rounded-full">Active</span>
                </div>
            `;
        });

    } catch (e) {
        list.innerHTML = '<p class="text-sm text-red-500">Error loading lecturers.</p>';
        console.error(e);
    }
}

// --- UPDATE THE HOD LECTURER SUBMIT FUNCTION FOR EXTERNAL BACKEND ---
async function hodSubmitLecturer(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-hod-save-lec');
    
    const name = document.getElementById('hod-lec-name').value.trim();
    const email = document.getElementById('hod-lec-email').value.trim();
    const password = document.getElementById('hod-lec-pwd').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Deploying via External Server...';

    // Replace this URL with your actual deployed backend URL (e.g., Render, Railway, or VPS)
    const EXTERNAL_BACKEND_URL = 'https://ram-portal-backend.onrender.com/api/create-staff';

    try {
        const response = await fetch(EXTERNAL_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                fullName: name, 
                email: email, 
                password: password,
                department: 'Academics',
                role_level: 'Lecturer'
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || `Server responded with status ${response.status}`);
        }

        showToast(`Account for ${name} created securely.`, "success");
        closeHodLecturerModal();
        
        // Refresh the local department lecturers view if the function exists
        if (typeof fetchDepartmentLecturers === 'function') {
            fetchDepartmentLecturers(); 
        }
        
    } catch (e) {
        console.error(e);
        showToast(e.message || "Failed to generate account via external backend.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate Secure Account";
    }
}

// --- DIRECT SUPABASE: FETCH PENDING APPROVALS ---
async function fetchPendingApprovals() {
    const list = document.getElementById('hod-approvals-list');
    if (!list) return;

    list.innerHTML = '<p class="text-sm text-gray-400 italic">Checking for pending results...</p>';

    try {
        const { data: results, error } = await supabaseClient
            .from('exam_results')
            .select('block_name, unit_name')
            .eq('status', 'Pending');

        if (error) throw error;

        if (!results || results.length === 0) {
            list.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-file-signature text-4xl text-gray-200 mb-3"></i>
                    <p class="text-sm text-gray-400 italic">No results pending approval at this time.</p>
                </div>`;
            return;
        }

        // Group the results by unit and block
        const pendingGroups = {};
        results.forEach(r => {
            const key = `${r.block_name}_${r.unit_name}`;
            if (!pendingGroups[key]) {
                pendingGroups[key] = { block: r.block_name, unit: r.unit_name, count: 0 };
            }
            pendingGroups[key].count++;
        });

        list.innerHTML = '';
        Object.values(pendingGroups).forEach(group => {
            list.innerHTML += `
                <div class="flex justify-between items-center p-4 bg-gray-50 border border-gray-100 rounded-xl mb-3">
                    <div>
                        <span class="text-[10px] font-black uppercase text-ramGold">${group.block}</span>
                        <p class="text-sm font-bold text-gray-800">${group.unit}</p>
                        <p class="text-[10px] text-gray-500">${group.count} student result(s) waiting</p>
                    </div>
                    <button onclick="approveResults('${group.block}', '${group.unit}')" class="text-xs font-bold text-white bg-ramGreen hover:bg-green-700 px-4 py-2 rounded-lg transition shadow-sm">
                        Approve <i class="fas fa-check ml-1"></i>
                    </button>
                </div>
            `;
        });
    } catch (e) {
        list.innerHTML = '<p class="text-sm text-red-500">Error loading approvals.</p>';
        console.error(e);
    }
}

// --- DIRECT SUPABASE: APPROVE RESULTS ---
async function approveResults(blockName, unitName) {
    try {
        const { error } = await supabaseClient
            .from('exam_results')
            .update({ status: 'Approved' })
            .eq('block_name', blockName)
            .eq('unit_name', unitName)
            .eq('status', 'Pending');

        if (error) throw error;
        
        showToast(`Results for ${unitName} approved!`, "success");
        fetchPendingApprovals(); // Refresh list
        loadActivityFeed(adminProfile.role_level);
    } catch (e) {
        showToast(e.message, "error");
        console.error(e);
    }
}

// --- DYNAMIC DASHBOARD METRICS ---
async function loadDynamicOverview() {
    const container = document.getElementById('overview-metrics-container');
    if (!container) return;
    container.innerHTML = '<p class="text-xs text-gray-400 animate-pulse col-span-full">Calculating metrics...</p>';

    let metricsHTML = '';
    const role = adminProfile.role_level;

    try {
        if (role === 'SuperAdmin' || role === 'Principal' || role === 'Principal / Deputy') {
            const [staffReq, studentReq] = await Promise.all([
                supabaseClient.from('staff_profiles').select('*', { count: 'exact', head: true }),
                supabaseClient.from('students').select('*', { count: 'exact', head: true })
            ]);
            metricsHTML += createMetricCard('Total Staff', staffReq.count || 0, 'fa-users', 'text-ramBlue');
            metricsHTML += createMetricCard('Total Students', studentReq.count || 0, 'fa-user-graduate', 'text-ramGreen');
        
        } else if (role === 'HOD' || role === 'Deputy HOD') {
            const { count } = await supabaseClient.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('department', 'Academics');
            metricsHTML += createMetricCard('Dept Lecturers', count || 0, 'fa-chalkboard-teacher', 'text-ramBlue');
            metricsHTML += createMetricCard('Pending Approvals', '0', 'fa-file-signature', 'text-ramGold');
        
        } else if (role === 'Lecturer') {
            const { count } = await supabaseClient.from('unit_assignments').select('*', { count: 'exact', head: true }).eq('lecturer_id', adminProfile.id);
            metricsHTML += createMetricCard('Assigned Units', count || 0, 'fa-book', 'text-ramBlue');
        
        } else if (role === 'Welfare' || role === 'Welfare Officer') {
            // UPDATED: Fetch both Open Tickets and Urgent Cases simultaneously
            const [openReq, urgentReq] = await Promise.all([
                supabaseClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
                supabaseClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('priority', 'High')
            ]);
            metricsHTML += createMetricCard('Open Tickets', openReq.count || 0, 'fa-envelope-open-text', 'text-ramBlue');
            metricsHTML += createMetricCard('Urgent Cases', urgentReq.count || 0, 'fa-exclamation-triangle', 'text-ramRed');
        
        } else if (role === 'Placement Officer') {
            const { count } = await supabaseClient.from('clinical_placements').select('*', { count: 'exact', head: true });
            metricsHTML += createMetricCard('Active Placements', count || 0, 'fa-hospital-user', 'text-ramGreen');
        }

        container.innerHTML = metricsHTML || '<p class="text-xs text-gray-400 col-span-full mt-4">Dashboard ready.</p>';
        
        // Fetch and display live activity feed
        loadActivityFeed(role);
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-xs text-red-500 col-span-full">Failed to load metrics.</p>';
    }
}

// --- NEW FUNCTION: POPULATE LIVE ACTIVITY FEED ---
async function loadActivityFeed(role) {
    const feedContainer = document.getElementById('activity-feed');
    if (!feedContainer) return;

    feedContainer.innerHTML = '<p class="text-sm text-gray-400 italic">Fetching activity stream...</p>';

    try {
        let activitiesHTML = '';

        if (role === 'Lecturer') {
            const { data, error } = await supabaseClient
                .from('exam_results')
                .select('student_name, unit_name, block_name, status')
                .eq('lecturer_id', adminProfile.id)
                .limit(5);

            if (error) throw error;

            if (!data || data.length === 0) {
                activitiesHTML = '<p class="text-sm text-gray-400 italic">No recent activity found.</p>';
            } else {
                data.forEach(act => {
                    const statusColor = act.status === 'Approved' ? 'text-green-500' : (act.status === 'Rejected' ? 'text-red-500' : 'text-yellow-500');
                    activitiesHTML += `
                        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-ramBlue shrink-0">
                                <i class="fas fa-edit text-xs"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">Graded ${act.student_name}</p>
                                <p class="text-[10px] text-gray-500 uppercase">${act.block_name} - ${act.unit_name} • <span class="${statusColor} font-bold">${act.status}</span></p>
                            </div>
                        </div>
                    `;
                });
            }
        } else if (role === 'HOD' || role === 'Deputy HOD') {
            const { data, error } = await supabaseClient
                .from('exam_results')
                .select('unit_name, block_name, status')
                .eq('status', 'Pending')
                .limit(5);

            if (error) throw error;

            if (!data || data.length === 0) {
                activitiesHTML = '<p class="text-sm text-gray-400 italic">No pending activity.</p>';
            } else {
                data.forEach(act => {
                    activitiesHTML += `
                        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div class="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-ramGold shrink-0">
                                <i class="fas fa-file-signature text-xs"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">Results submitted for ${act.unit_name}</p>
                                <p class="text-[10px] text-gray-500 uppercase">${act.block_name} • Awaiting your approval</p>
                            </div>
                        </div>
                    `;
                });
            }
        } else {
            activitiesHTML = '<p class="text-sm text-gray-400 italic">Activity feed not configured for this role.</p>';
        }

        feedContainer.innerHTML = activitiesHTML;
    } catch (e) {
        console.error(e);
        feedContainer.innerHTML = '<p class="text-sm text-red-500">Failed to load activity stream.</p>';
    }
}

function createMetricCard(title, value, icon, colorClass) {
    return `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-wider">${title}</p>
                <h3 class="text-2xl font-bold text-gray-800 mt-1">${value}</h3>
            </div>
            <div class="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center ${colorClass}">
                <i class="fas ${icon} text-xl"></i>
            </div>
        </div>
    `;
}

// ==========================================
// LECTURER GRADEBOOK & AUTO-CALCULATOR
// ==========================================

let currentGradingSession = { block: '', unit: '' };

async function openGradebook(blockName, unitName) {
    currentGradingSession = { block: blockName, unit: unitName };
    
    document.getElementById('gb-unit-title').innerText = unitName;
    document.getElementById('gb-block-title').innerText = blockName;
    
    const modal = document.getElementById('gradebookModal');
    const backdrop = document.getElementById('gradebookBackdrop');
    const box = document.getElementById('gradebookBox');
    const tbody = document.getElementById('gradebook-tbody');

    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading students...</td></tr>';

    // FIX: Restore animation code so modal becomes visible!
    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);

    try {
        const { data: students, error } = await supabaseClient
            .from('students')
            .select('first_name, last_name, admission_number')
            .eq('block', blockName);

        if (error) throw error;

        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-400">No students found in ' + blockName + '.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        students.forEach((student, index) => {
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
            const admNumber = student.admission_number || 'N/A';

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition student-row" data-adm="${admNumber}" data-name="${fullName}">
                    <td class="px-4 py-4">
                        <p class="font-bold text-gray-800">${fullName}</p>
                        <p class="text-[10px] text-gray-400 font-mono">${admNumber}</p>
                    </td>
                    <td class="px-4 py-4">
                        <input type="number" min="0" max="100" class="cat-input w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-ramBlue" placeholder="0" oninput="calculateRowGrade(${index})">
                    </td>
                    <td class="px-4 py-4">
                        <input type="number" min="0" max="100" class="exam-input w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-ramBlue" placeholder="0" oninput="calculateRowGrade(${index})">
                    </td>
                    <td class="px-4 py-4 text-center font-black text-gray-700 total-score">0</td>
                    <td class="px-4 py-4 font-bold text-xs grade-display text-gray-400">--</td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-500">Error loading student roster.</td></tr>';
        console.error(e);
    }
}

// --- FETCH SUPPLEMENTARY/RETAKE STUDENTS ---
async function addSupplementaryStudent() {
    const admInput = document.getElementById('supp-adm-input');
    const admNumber = admInput.value.trim();
    
    if (!admNumber) {
        showToast("Please enter an admission number.", "error");
        return;
    }

    const existingRow = document.querySelector(`.student-row[data-adm="${admNumber}"]`);
    if (existingRow) {
        showToast("Student is already in the grading roster.", "error");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('students')
            .select('first_name, last_name, admission_number')
            .eq('admission_number', admNumber)
            .single();

        if (error || !data) throw new Error("Student not found.");

        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        const tbody = document.getElementById('gradebook-tbody');
        
        if (tbody.innerHTML.includes("No students found")) tbody.innerHTML = '';

        const newRowIndex = document.querySelectorAll('.student-row').length;

        const newRowHTML = `
            <tr class="hover:bg-yellow-50 transition student-row border-l-4 border-ramGold bg-yellow-50/30" data-adm="${data.admission_number}" data-name="${fullName}">
                <td class="px-4 py-4">
                    <p class="font-bold text-gray-800">${fullName} <span class="text-[9px] bg-ramGold text-white px-2 py-0.5 rounded-full ml-2 uppercase font-black tracking-wider">Retake</span></p>
                    <p class="text-[10px] text-gray-500 font-mono">${data.admission_number}</p>
                </td>
                <td class="px-4 py-4">
                    <input type="number" min="0" max="100" class="cat-input w-full px-3 py-2 bg-white border border-yellow-200 rounded text-sm outline-none focus:ring-2 focus:ring-ramGold" placeholder="0" oninput="calculateRowGrade(${newRowIndex})">
                </td>
                <td class="px-4 py-4">
                    <input type="number" min="0" max="100" class="exam-input w-full px-3 py-2 bg-white border border-yellow-200 rounded text-sm outline-none focus:ring-2 focus:ring-ramGold" placeholder="0" oninput="calculateRowGrade(${newRowIndex})">
                </td>
                <td class="px-4 py-4 text-center font-black text-gray-700 total-score">0</td>
                <td class="px-4 py-4 font-bold text-xs grade-display text-gray-400">--</td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', newRowHTML);
        admInput.value = '';
        showToast(`${fullName} added to grading roster.`, "success");

    } catch (e) {
        showToast("Student with that admission number not found.", "error");
    }
}

function closeGradebookModal() {
    const backdrop = document.getElementById('gradebookBackdrop');
    const box = document.getElementById('gradebookBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('gradebookModal').classList.add('hidden');
    }, 300);
}

// Visual feedback ONLY. The server will re-calculate everything securely.
function calculateRowGrade(rowIndex) {
    const row = document.querySelectorAll('.student-row')[rowIndex];
    const catVal = parseFloat(row.querySelector('.cat-input').value) || 0;
    const examVal = parseFloat(row.querySelector('.exam-input').value) || 0;
    
    const total = catVal + examVal;
    row.querySelector('.total-score').innerText = total;

    const gradeDisplay = row.querySelector('.grade-display');
    
    if (total >= 80) {
        gradeDisplay.innerText = "Distinction";
        gradeDisplay.className = "px-4 py-4 font-black text-xs grade-display text-ramGold";
    } else if (total >= 70) {
        gradeDisplay.innerText = "Credit";
        gradeDisplay.className = "px-4 py-4 font-bold text-xs grade-display text-ramBlue";
    } else if (total >= 60) {
        gradeDisplay.innerText = "Pass";
        gradeDisplay.className = "px-4 py-4 font-bold text-xs grade-display text-ramGreen";
    } else {
        gradeDisplay.innerText = "Fail";
        gradeDisplay.className = "px-4 py-4 font-bold text-xs grade-display text-red-500";
    }
}

// --- DIRECT SUPABASE: SUBMIT GRADES & PREVENT DUPLICATES ---
async function submitGrades() {
    const btn = document.getElementById('btn-submit-grades');
    const rows = document.querySelectorAll('.student-row');
    const gradesPayload = [];

    // 1. Calculate and pack grades locally
    rows.forEach(row => {
        const catStr = row.querySelector('.cat-input').value;
        const examStr = row.querySelector('.exam-input').value;

        // Only pack if the lecturer actually typed something in
        if (catStr !== '' || examStr !== '') {
            const catScore = parseFloat(catStr) || 0;
            const examScore = parseFloat(examStr) || 0;
            const totalScore = catScore + examScore;

            let grade = 'Fail';
            if (totalScore >= 80) grade = 'Distinction';
            else if (totalScore >= 70) grade = 'Credit';
            else if (totalScore >= 60) grade = 'Pass';

            gradesPayload.push({
                student_name: row.getAttribute('data-name'),
                admission_number: row.getAttribute('data-adm'),
                block_name: currentGradingSession.block,
                unit_name: currentGradingSession.unit,
                lecturer_id: adminProfile.id,
                cat_score: catScore,
                exam_score: examScore,
                total_score: totalScore,
                grade: grade,
                status: 'Pending'
            });
        }
    });

    if (gradesPayload.length === 0) {
        showToast("No grades entered to submit.", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Checking database...';

    try {
        // 2. Prevent Duplicates Lock (Check database first)
        const { data: existingRecords, error: fetchError } = await supabaseClient
            .from('exam_results')
            .select('admission_number')
            .eq('block_name', currentGradingSession.block)
            .eq('unit_name', currentGradingSession.unit);

        if (fetchError) throw fetchError;

        const existingAdms = existingRecords.map(r => r.admission_number);

        // 3. Filter out duplicate students 
        const newGrades = gradesPayload.filter(g => !existingAdms.includes(g.admission_number));
        const duplicateCount = gradesPayload.length - newGrades.length;

        if (newGrades.length === 0) {
            throw new Error("All selected students already have grades submitted for this unit.");
        }

        // 4. Send directly to Supabase
        const { error: insertError } = await supabaseClient.from('exam_results').insert(newGrades);
        if (insertError) throw insertError;

        let successMsg = `Submitted ${newGrades.length} result(s).`;
        if (duplicateCount > 0) successMsg += ` Skipped ${duplicateCount} duplicate(s).`;

        showToast(successMsg, "success");
        closeGradebookModal();
        fetchLecturerSubmissions(); // Update the local table
        loadActivityFeed(adminProfile.role_level); // Update live feed instantly
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit to HOD";
    }
}

// --- LECTURER: FETCH SUBMISSIONS ---
async function fetchLecturerSubmissions() {
    const list = document.getElementById('lecturer-submissions-list');
    if (!list) return;

    try {
        const { data, error } = await supabaseClient
            .from('exam_results')
            .select('student_name, admission_number, block_name, unit_name, total_score, grade, status')
            .eq('lecturer_id', adminProfile.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400 italic">No results submitted yet.</p>';
            return;
        }

        // Build the table dynamically
        list.innerHTML = `
            <table class="w-full text-left text-sm">
                <thead class="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100">
                    <tr><th class="py-3">Student</th><th class="py-3">Unit/Block</th><th class="py-3">Score</th><th class="py-3">Status</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${data.map(res => `
                        <tr>
                            <td class="py-3"><p class="font-bold text-gray-800">${res.student_name}</p><p class="text-[10px] text-gray-400 font-mono">${res.admission_number}</p></td>
                            <td class="py-3"><p class="font-bold text-ramGold uppercase text-[10px]">${res.block_name}</p><p class="text-xs">${res.unit_name}</p></td>
                            <td class="py-3 font-bold">${res.total_score} <span class="text-[10px] text-gray-400">(${res.grade})</span></td>
                            <td class="py-3"><span class="px-2 py-1 rounded-full text-[9px] font-bold ${res.status === 'Approved' ? 'bg-green-100 text-green-700' : (res.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}">${res.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) { list.innerHTML = '<p class="text-sm text-red-500">Error loading submissions.</p>'; }
}


// ==========================================
// ANNOUNCEMENTS & BROADCAST LOGIC
// ==========================================

function openAnnouncementModal() {
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementModal').classList.remove('hidden');
    setTimeout(() => { 
        document.getElementById('announcementBackdrop').classList.replace('opacity-0', 'opacity-100'); 
        document.getElementById('announcementBox').classList.replace('scale-90', 'scale-100'); 
        document.getElementById('announcementBox').classList.replace('opacity-0', 'opacity-100'); 
    }, 10);
}

function closeAnnouncementModal() {
    document.getElementById('announcementBackdrop').classList.replace('opacity-100', 'opacity-0');
    document.getElementById('announcementBox').classList.replace('scale-100', 'scale-90');
    document.getElementById('announcementBox').classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => { document.getElementById('announcementModal').classList.add('hidden'); }, 300);
}

async function submitAnnouncement(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-announcement');
    const target = document.getElementById('ann-target').value;
    const title = document.getElementById('ann-title').value.trim();
    const message = document.getElementById('ann-message').value.trim();

    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Broadcasting...';

    try {
        const payload = {
            title: title,
            message: message,
            target_audience: target,
            posted_by: currentAdmin.id // Links to the logged-in staff member
        };

        const { error } = await supabaseClient.from('global_announcements').insert([payload]);
        if (error) throw error;

        showToast(`Announcement successfully sent to ${target}!`, "success");
        closeAnnouncementModal();
        fetchAnnouncements(); // Refresh the feed immediately
    } catch (e) { 
        showToast(e.message, "error"); 
        console.error("Announcement Error:", e);
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Send Broadcast'; 
    }
}

async function fetchAnnouncements() {
    const feed = document.getElementById('announcements-feed');
    if (!feed) return;
    feed.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-300"></i></div>';

    try {
        // Fetch announcements and join with staff_profiles to get the author's real name
        const { data, error } = await supabaseClient
            .from('global_announcements')
            .select('*, staff_profiles(full_name)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            return feed.innerHTML = `
                <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center">
                    <i class="fas fa-envelope-open-text text-4xl text-gray-200 mb-3"></i>
                    <p class="text-gray-500 text-sm">No announcements have been posted yet.</p>
                </div>`;
        }

        feed.innerHTML = data.map(ann => {
            const date = new Date(ann.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const author = ann.staff_profiles ? ann.staff_profiles.full_name : 'Admin';
            
            // Highlight specific targets in Gold, Global ones in Blue
            const audienceBadge = ann.target_audience === 'All Students' 
                ? '<span class="bg-blue-100 text-ramBlue px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">Global</span>'
                : `<span class="bg-ramGold/20 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">${ann.target_audience}</span>`;

            return `
                <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h4 class="text-lg font-bold text-gray-800">${ann.title}</h4>
                            <p class="text-[10px] text-gray-400 mt-1">Posted by <span class="font-bold">${author}</span> on ${date}</p>
                        </div>
                        ${audienceBadge}
                    </div>
                    <p class="text-sm text-gray-600 whitespace-pre-wrap">${ann.message}</p>
                </div>
            `;
        }).join('');

    } catch (e) { 
        feed.innerHTML = '<p class="text-sm text-red-500">Failed to load announcements.</p>'; 
        console.error(e);
    }
}

// ==========================================
// CLINICAL PLACEMENTS LOGIC
// ==========================================

async function fetchPlacementStudents() {
    const tbody = document.getElementById('placements-table-body');
    const block = document.getElementById('placement-block-filter').value;
    
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading students...</td></tr>';

    try {
        // Fetch students and their current placements simultaneously
        const [studentsRes, placementsRes] = await Promise.all([
            supabaseClient.from('students').select('first_name, last_name, admission_number').eq('block', block),
            supabaseClient.from('clinical_placements').select('*').eq('block_name', block)
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (placementsRes.error) throw placementsRes.error;

        if (studentsRes.data.length === 0) {
            return tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-400">No students found in ${block}.</td></tr>`;
        }

        // Map placements to students (keeps the most recent assignment)
        const placementMap = {};
        placementsRes.data.forEach(p => { placementMap[p.admission_number] = p; });

        tbody.innerHTML = studentsRes.data.map(student => {
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
            const adm = student.admission_number;
            const placement = placementMap[adm];

            if (placement) {
                // Formatting Dates
                const start = new Date(placement.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const end = new Date(placement.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                
                return `
                    <tr class="hover:bg-gray-50 transition">
                        <td class="px-6 py-4"><p class="font-bold text-gray-800">${fullName}</p><p class="text-[10px] text-gray-400 font-mono">${adm}</p></td>
                        <td class="px-6 py-4"><p class="text-sm font-bold text-ramBlue">${placement.hospital_name}</p><span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-black uppercase tracking-wider">${placement.status}</span></td>
                        <td class="px-6 py-4 text-xs text-gray-600 font-medium">${start} - ${end}</td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="openPlacementModal('${fullName}', '${adm}', '${block}')" class="text-xs font-bold text-gray-500 hover:text-ramBlue px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-200 transition">Update</button>
                        </td>
                    </tr>`;
            } else {
                return `
                    <tr class="hover:bg-gray-50 transition">
                        <td class="px-6 py-4"><p class="font-bold text-gray-800">${fullName}</p><p class="text-[10px] text-gray-400 font-mono">${adm}</p></td>
                        <td class="px-6 py-4"><span class="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">Unassigned</span></td>
                        <td class="px-6 py-4 text-xs text-gray-400">--</td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="openPlacementModal('${fullName}', '${adm}', '${block}')" class="text-xs font-bold text-white bg-adminDark hover:bg-slate-800 px-4 py-2 rounded-lg shadow-sm transition">Assign</button>
                        </td>
                    </tr>`;
            }
        }).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load placements.</td></tr>';
        console.error(e);
    }
}

function openPlacementModal(studentName, admNumber, blockName) {
    document.getElementById('placementForm').reset();
    document.getElementById('placement-student-name').innerText = studentName;
    document.getElementById('place-adm').value = admNumber;
    document.getElementById('place-block').value = blockName;

    const modal = document.getElementById('placementModal');
    modal.classList.remove('hidden');
    setTimeout(() => { 
        document.getElementById('placementBackdrop').classList.replace('opacity-0', 'opacity-100'); 
        document.getElementById('placementBox').classList.replace('scale-90', 'scale-100'); 
        document.getElementById('placementBox').classList.replace('opacity-0', 'opacity-100'); 
    }, 10);
}

function closePlacementModal() {
    document.getElementById('placementBackdrop').classList.replace('opacity-100', 'opacity-0');
    document.getElementById('placementBox').classList.replace('scale-100', 'scale-90');
    document.getElementById('placementBox').classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => { document.getElementById('placementModal').classList.add('hidden'); }, 300);
}

async function submitPlacement(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-placement');
    
    const payload = {
        student_name: document.getElementById('placement-student-name').innerText,
        admission_number: document.getElementById('place-adm').value,
        block_name: document.getElementById('place-block').value,
        hospital_name: document.getElementById('place-hospital').value.trim(),
        start_date: document.getElementById('place-start').value,
        end_date: document.getElementById('place-end').value,
        // THE FIX: We must use auth_id to satisfy the database foreign key
        assigned_by: adminProfile.auth_id 
    };

    if (new Date(payload.start_date) > new Date(payload.end_date)) {
        return showToast("End date cannot be before start date.", "error");
    }

    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Assigning...';

    try {
        const { error } = await supabaseClient.from('clinical_placements').insert([payload]);
        if (error) throw error;

        showToast("Placement assigned successfully!", "success");
        closePlacementModal();
        fetchPlacementStudents(); // Refresh the table
    } catch (e) {
        showToast("Failed to assign placement.", "error");
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Placement";
    }
}

// ==========================================
// WELFARE & SUPPORT DESK LOGIC
// ==========================================

let allWelfareTickets = []; // Store loaded tickets in memory for fast switching

async function fetchWelfareTickets() {
    const list = document.getElementById('welfare-ticket-list');
    const statusFilter = document.getElementById('welfare-status-filter').value;
    if (!list) return;

    list.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-gray-300 text-2xl"></i></div>';

    try {
        const { data, error } = await supabaseClient
            .from('support_tickets')
            .select('*')
            .eq('status', statusFilter)
            .order('priority', { ascending: false }) // High priority at top
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        allWelfareTickets = data || [];

        if (allWelfareTickets.length === 0) {
            return list.innerHTML = `
                <div class="text-center py-6">
                    <i class="fas fa-check-circle text-3xl text-gray-200 mb-2"></i>
                    <p class="text-xs text-gray-400 italic">No ${statusFilter.toLowerCase()} tickets found.</p>
                </div>`;
        }

        list.innerHTML = allWelfareTickets.map(ticket => {
            const date = new Date(ticket.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
            
            // Priority colors
            let pColor = 'bg-gray-100 text-gray-600';
            if (ticket.priority === 'High') pColor = 'bg-red-100 text-red-700 border border-red-200';
            if (ticket.priority === 'Medium') pColor = 'bg-orange-100 text-orange-700 border border-orange-200';

            return `
                <div onclick="openWelfareTicket('${ticket.id}')" class="cursor-pointer p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-ramRed hover:shadow-md transition">
                    <div class="flex justify-between items-start mb-2">
                        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${pColor}">${ticket.priority}</span>
                        <span class="text-[10px] text-gray-400 font-medium">${date}</span>
                    </div>
                    <h5 class="text-sm font-bold text-gray-800 truncate">${ticket.student_name}</h5>
                    <p class="text-[11px] text-gray-500 truncate mt-0.5">${ticket.subject}</p>
                </div>
            `;
        }).join('');

    } catch (e) {
        list.innerHTML = '<p class="text-xs text-red-500 text-center">Error loading inbox.</p>';
        console.error(e);
    }
}

function openWelfareTicket(ticketId) {
    const ticket = allWelfareTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Switch Views
    document.getElementById('welfare-empty-state').classList.add('hidden');
    document.getElementById('welfare-case-file').classList.remove('hidden');

    // Populate Details
    document.getElementById('wf-student-name').innerText = ticket.student_name;
    document.getElementById('wf-adm-number').innerText = ticket.admission_number;
    document.getElementById('wf-category-badge').innerText = ticket.category;
    document.getElementById('wf-subject').innerText = ticket.subject;
    document.getElementById('wf-message').innerText = ticket.message;
    
    // Priority Badge logic
    const pBadge = document.getElementById('wf-priority-badge');
    pBadge.innerText = ticket.priority;
    pBadge.className = `px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        ticket.priority === 'High' ? 'bg-red-100 text-red-700' : (ticket.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600')
    }`;

    // Form fields
    document.getElementById('wf-ticket-id').value = ticket.id;
    document.getElementById('wf-status').value = ticket.status;
    document.getElementById('wf-notes').value = ticket.officer_notes || '';
}

async function updateWelfareTicket(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-welfare');
    const ticketId = document.getElementById('wf-ticket-id').value;
    const newStatus = document.getElementById('wf-status').value;
    const officerNotes = document.getElementById('wf-notes').value.trim();

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

    try {
        const { error } = await supabaseClient
            .from('support_tickets')
            .update({ 
                status: newStatus, 
                officer_notes: officerNotes,
                // THE FIX: We must use auth_id to satisfy the database foreign key constraint
                handled_by: adminProfile.auth_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) throw error;

        // Trigger Success Toast
        showToast("Case file updated successfully.", "success");
        
        // If status changed, hide the case file pane so it doesn't linger in the wrong filter view
        if (newStatus !== document.getElementById('welfare-status-filter').value) {
            document.getElementById('welfare-case-file').classList.add('hidden');
            document.getElementById('welfare-empty-state').classList.remove('hidden');
        }
        
        fetchWelfareTickets(); // Refresh the inbox on the left

    } catch (e) {
        console.error("Welfare Update Error:", e);
        // Trigger Failure Toast
        showToast("Failed to save case updates. Please try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Case';
    }
}
