// admin-dashboard.js

// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Define your live external API base URL here for easy reference
const BACKEND_API_URL = 'https://ram-portal-backend.onrender.com/api';

let currentAdmin = null;
let adminProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeAdminDashboard();
    setupDropzone();
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

    // --- NEW: Singleton Role Dropdown Enforcement ---
    enforceDropdownSecurity(profile.role_level);

    // 4. Build Navigation based on Role
    buildNavigation(profile.role_level);
}

function enforceDropdownSecurity(roleLevel) {
    // If the user is NOT a SuperAdmin, disable/hide the executive roles from the creation/edit dropdowns
    if (roleLevel !== 'SuperAdmin') {
        const dropdowns = ['staff-role', 'edit-staff-role'];
        const restrictedRoles = ['SuperAdmin', 'Principal', 'QA Officer', 'HOD'];

        dropdowns.forEach(dropdownId => {
            const selectElement = document.getElementById(dropdownId);
            if (selectElement) {
                Array.from(selectElement.options).forEach(option => {
                    if (restrictedRoles.includes(option.value)) {
                        option.disabled = true;
                        option.hidden = true; // Hides it in most modern browsers
                    }
                });
            }
        });
    }
}

function buildNavigation(role) {
    const navMenu = document.getElementById('admin-nav-menu');
    navMenu.innerHTML = ''; // Clear existing

    // Define all possible modules and who can access them
    const modules = [
        { id: 'overview', icon: 'fa-chart-pie', label: 'Overview', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'HOD', 'Deputy HOD', 'Lecturer', 'Welfare', 'Placement'] },
        { id: 'staff', icon: 'fa-users-cog', label: 'Staff Management', roles: ['SuperAdmin', 'Principal', 'QA Officer'] }, // Added QA Officer for view-only
        { id: 'approvals', icon: 'fa-user-check', label: 'Pending Registrations', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'HOD', 'Deputy HOD'] }, // QA added for view/review
        { id: 'academics', icon: 'fa-graduation-cap', label: 'Academics & Results', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'HOD', 'Deputy HOD', 'Lecturer'] },
        { id: 'progression', icon: 'fa-layer-group', label: 'Block Progression', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'HOD', 'Deputy HOD'] }, // NEW PROGRESSION BOARD
        { id: 'placements', icon: 'fa-hospital-user', label: 'Clinical Placements', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'Placement'] },
        { id: 'welfare', icon: 'fa-headset', label: 'Student Welfare', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'Welfare'] },
        { id: 'announcements', icon: 'fa-bullhorn', label: 'Announcements', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'HOD', 'Deputy HOD'] },
        { id: 'settings', icon: 'fa-cog', label: 'My Account', roles: ['SuperAdmin', 'Principal', 'QA Officer', 'HOD', 'Deputy HOD', 'Lecturer', 'Welfare', 'Placement'] }
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
        'approvals': 'Pending Student Registrations',
        'academics': 'Academic Control Center',
        'progression': 'Block Progression Board',
        'placements': 'Clinical Placement Manager',
        'welfare': 'Student Welfare Desk',
        'announcements': 'Broadcast Center',
        'settings': 'Account Settings'
    };
    document.getElementById('page-title').innerText = titles[sectionId] || 'Dashboard';

    // TRIGGER DATA FETCHES
    if (sectionId === 'overview') loadDynamicOverview();
    if (sectionId === 'staff') fetchStaffList();
    if (sectionId === 'approvals') fetchPendingRegistrations();
    if (sectionId === 'academics') renderAcademicsModule();
    if (sectionId === 'announcements') fetchAnnouncements(); 
    if (sectionId === 'placements') fetchPlacementStudents();
    if (sectionId === 'welfare') fetchWelfareTickets();

    if (window.innerWidth < 768) toggleDrawer(false);
}

// --- ACADEMICS: LECTURER VS HOD VS QA ROUTING ---
function renderAcademicsModule() {
    const role = adminProfile.role_level;
    
    if (role === 'Lecturer') {
        document.getElementById('lecturer-view').classList.remove('hidden');
        document.getElementById('hod-view').classList.add('hidden');
        fetchMyUnits(); 
        fetchLecturerSubmissions(); 
    } else if (role === 'QA Officer' || role === 'SuperAdmin' || role === 'Principal' || role === 'Principal / Deputy') {
        // QA and Executives see the HOD view but across ALL departments
        document.getElementById('lecturer-view').classList.add('hidden');
        document.getElementById('hod-view').classList.remove('hidden');
        fetchDepartmentLecturers(true); // True flags it to fetch ALL lecturers, not just one dept
        fetchPendingApprovals();
        fetchHodHistory();
    } else {
        // Standard HOD view (restricted to their department)
        document.getElementById('lecturer-view').classList.add('hidden');
        document.getElementById('hod-view').classList.remove('hidden');
        fetchDepartmentLecturers(false);
        fetchPendingApprovals();
        fetchHodHistory();
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

    if (newPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Updating Securely...';

    try {
        // 1. Update the password via Supabase Auth
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        // 2. Clear the form and show success message
        document.getElementById('settingsForm').reset();
        showToast("Password updated! Forcing secure logout...", "success");
        
        // 3. Force re-login after 2.5 seconds so the new credentials take effect instantly
        setTimeout(async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "admin-login.html";
        }, 2500);

    } catch (e) {
        console.error(e);
        showToast(e.message || "Failed to update password.", "error");
        
        // Only re-enable the button if it failed. If it succeeds, we want it to stay locked while redirecting.
        btn.disabled = false;
        btn.innerText = "Update Password";
    }
}

// --- GLOBAL STAFF MANAGEMENT ---
let allStaffData = []; // Store to quickly populate edit modal

async function fetchStaffList() {
    const role = adminProfile.role_level;
    if (role !== 'SuperAdmin' && role !== 'Principal' && role !== 'Principal / Deputy' && role !== 'QA Officer') return;

    const tbody = document.getElementById('staff-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading staff directory...</td></tr>';

    try {
        const { data, error } = await supabaseClient.from('staff_profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        allStaffData = data;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No staff found.</td></tr>';
            return;
        }

        data.forEach(staff => {
            // GHOST PROTOCOL: Hide SuperAdmins from everyone except themselves
            if (staff.role_level === 'SuperAdmin' && role !== 'SuperAdmin') return;

            const statusBadge = staff.is_active 
                ? '<span class="px-2.5 py-1 bg-green-100 text-green-700 font-bold text-[10px] rounded-full">Active</span>'
                : '<span class="px-2.5 py-1 bg-red-100 text-red-700 font-bold text-[10px] rounded-full">Disabled</span>';
            
            // Disable editing yourself or if you are just a QA Viewer
            const isSelf = staff.id === adminProfile.id;
            let actionBtn = '';
            
            if (role === 'QA Officer') {
                actionBtn = '<span class="text-[10px] text-gray-400 italic">Audit View</span>';
            } else if (isSelf) {
                actionBtn = '<span class="text-[10px] text-gray-400 italic">Current User</span>';
            } else {
                actionBtn = `<button onclick="openEditStaffModal('${staff.id}')" class="text-gray-400 hover:text-ramBlue p-2 transition"><i class="fas fa-edit"></i></button>`;
            }

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition ${!staff.is_active ? 'opacity-60' : ''}">
                    <td class="px-6 py-4">
                        <p class="font-bold text-gray-800">${staff.full_name}</p>
                        <p class="text-[10px] text-gray-400">${staff.email}</p>
                    </td>
                    <td class="px-6 py-4 text-xs font-medium text-gray-600 uppercase tracking-wider">${staff.department}</td>
                    <td class="px-6 py-4 font-bold text-adminDark text-xs">${staff.role_level}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4 text-right">${actionBtn}</td>
                </tr>
            `;
        });
    } catch (e) {
        showToast("Failed to load staff list.", "error");
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
    }
}

// --- NEW: EDIT/DEACTIVATE STAFF ---
function openEditStaffModal(staffId) {
    const staff = allStaffData.find(s => s.id === staffId);
    if (!staff) return;

    // Populate Modal
    document.getElementById('edit-staff-id').value = staff.id;
    document.getElementById('edit-staff-name').value = staff.full_name;
    document.getElementById('edit-staff-email').value = staff.email;
    document.getElementById('edit-staff-dept').value = staff.department;
    
    // Attempt to set the role level. If it's disabled/hidden by security, we force it.
    const roleSelect = document.getElementById('edit-staff-role');
    const roleOption = Array.from(roleSelect.options).find(opt => opt.value === staff.role_level);
    if (roleOption && roleOption.disabled) {
        // Temporarily enable it just so the UI shows current value correctly
        roleOption.disabled = false;
        roleOption.hidden = false;
    }
    roleSelect.value = staff.role_level;
    
    document.getElementById('edit-staff-status').value = staff.is_active.toString();

    // Show Modal
    const modal = document.getElementById('editStaffModal');
    const backdrop = document.getElementById('editStaffModalBackdrop');
    const box = document.getElementById('editStaffModalBox');

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);
}

function closeEditStaffModal() {
    const backdrop = document.getElementById('editStaffModalBackdrop');
    const box = document.getElementById('editStaffModalBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('editStaffModal').classList.add('hidden');
        // Re-enforce security rules on the dropdown to hide the options again
        enforceDropdownSecurity(adminProfile.role_level);
    }, 300);
}

async function submitEditStaff(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-update-staff');
    
    const staffId = document.getElementById('edit-staff-id').value;
    const isActive = document.getElementById('edit-staff-status').value === "true";

    const payload = {
        staff_id: staffId,
        requester_id: currentAdmin.id,
        full_name: document.getElementById('edit-staff-name').value.trim(),
        email: document.getElementById('edit-staff-email').value.trim(),
        department: document.getElementById('edit-staff-dept').value,
        role_level: document.getElementById('edit-staff-role').value,
        is_active: isActive
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Updating...';

    try {
        const response = await fetch(`${BACKEND_API_URL}/update-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.detail || "Failed to update staff member.");

        showToast(`Staff profile updated successfully.`, "success");
        closeEditStaffModal();
        
        // Refresh based on where they edited from
        if (adminProfile.role_level === 'SuperAdmin' || adminProfile.role_level === 'Principal' || adminProfile.role_level === 'Principal / Deputy') {
            fetchStaffList(); 
        } else {
            fetchDepartmentLecturers();
        }

    } catch (e) {
        console.error(e);
        showToast(e.message || "Failed to update staff member.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Staff Member";
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

// --- STAFF MANAGEMENT LOGIC (Add Modal) ---
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

// ==========================================
// STUDENT REGISTRATION APPROVALS LOGIC
// ==========================================

async function fetchPendingRegistrations() {
    const tbody = document.getElementById('pending-students-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading pending registrations...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('students')
            .select('auth_id, first_name, last_name, admission_number, block, course')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-green-500"><i class="fas fa-check-circle mr-2 text-lg"></i>No pending student registrations.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(student => {
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
            
            // QA Viewer Check
            const actionBtn = adminProfile.role_level === 'QA Officer' 
                ? '<span class="text-[10px] text-gray-400 italic">Review Only</span>'
                : `<button onclick="approveStudentRegistration('${student.auth_id}', this)" class="text-xs font-bold text-white bg-ramGreen hover:bg-green-700 px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-2 ml-auto">
                        <span>Approve</span> <i class="fas fa-check"></i>
                   </button>`;

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 font-bold text-gray-800">${fullName}</td>
                    <td class="px-6 py-4 text-xs font-mono text-gray-500">${student.admission_number}</td>
                    <td class="px-6 py-4 text-xs">
                        <span class="font-bold text-ramBlue uppercase">${student.block}</span><br>
                        <span class="text-[10px] text-gray-400">${student.course}</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        ${actionBtn}
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load pending registrations.</td></tr>';
        console.error("Fetch pending students error:", e);
    }
}

async function approveStudentRegistration(authId, btnElement) {
    const originalHTML = btnElement.innerHTML;
    
    // Trigger Loading Animation
    btnElement.disabled = true;
    btnElement.innerHTML = '<span>Approving...</span> <i class="fas fa-spinner fa-spin"></i>';
    btnElement.classList.replace('bg-ramGreen', 'bg-gray-400');
    btnElement.classList.replace('hover:bg-green-700', 'hover:bg-gray-400');

    try {
        const { error } = await supabaseClient
            .from('students')
            .update({ is_approved: true })
            .eq('auth_id', authId);

        if (error) throw error;

        showToast("Student registration approved!", "success");
        fetchPendingRegistrations(); // Refresh list immediately

    } catch (e) {
        showToast("Failed to approve student.", "error");
        console.error("Approve student error:", e);
        
        // Revert Button on Error
        btnElement.disabled = false;
        btnElement.innerHTML = originalHTML;
        btnElement.classList.replace('bg-gray-400', 'bg-ramGreen');
        btnElement.classList.replace('hover:bg-gray-400', 'hover:bg-green-700');
    }
}

// --- HOD & QA LECTURER MANAGEMENT ---
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
async function fetchDepartmentLecturers(fetchAll = false) {
    const list = document.getElementById('hod-lecturer-list');
    if (!list) return;

    list.innerHTML = '<p class="text-sm text-gray-400 italic">Loading lecturers from database...</p>';

    try {
        let query = supabaseClient.from('staff_profiles').select('*').eq('role_level', 'Lecturer');
        
        // If it's a standard HOD, only fetch Academics. If it's QA or Exec, fetch all.
        if (!fetchAll) {
            query = query.eq('department', 'Academics');
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400">No lecturers found.</p>';
            return;
        }

        allStaffData = data; // Store locally for editing

        list.innerHTML = '';
        data.forEach(lec => {
            const initials = lec.full_name.substring(0, 2).toUpperCase();
            
            const statusBadge = lec.is_active 
                ? '<span class="px-2 py-1 bg-green-100 text-green-700 font-bold text-[10px] rounded-full">Active</span>'
                : '<span class="px-2 py-1 bg-red-100 text-red-700 font-bold text-[10px] rounded-full">Disabled</span>';
            
            const actionBtn = adminProfile.role_level === 'QA Officer'
                ? '<span class="text-[10px] text-gray-400 italic">Audit View</span>'
                : `<button onclick="openEditStaffModal('${lec.id}')" class="text-gray-400 hover:text-ramBlue p-1 transition"><i class="fas fa-edit"></i></button>`;

            list.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl mb-2 ${!lec.is_active ? 'opacity-60' : ''}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-blue-100 text-ramBlue rounded-full flex items-center justify-center font-bold text-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">${lec.full_name}</p>
                            <p class="text-[10px] text-gray-400">${lec.email} ${fetchAll ? `<span class="bg-gray-200 px-1 rounded ml-1 text-[8px]">${lec.department}</span>` : ''}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        ${statusBadge}
                        ${actionBtn}
                    </div>
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

    try {
        const response = await fetch(`${BACKEND_API_URL}/create-staff`, {
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
            fetchDepartmentLecturers(adminProfile.role_level !== 'HOD'); 
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
                    <!-- CHANGED FROM 'Approve' to 'Review Results' -->
                    <button onclick="openHodReviewModal('${group.block}', '${group.unit}')" class="text-xs font-bold text-ramBlue bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-2">
                        <span>Review Results</span> <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            `;
        });
    } catch (e) {
        list.innerHTML = '<p class="text-sm text-red-500">Error loading approvals.</p>';
        console.error(e);
    }
}

// --- NEW HOD REVIEW MODAL LOGIC ---
let currentHodReviewSession = { block: '', unit: '' };

async function openHodReviewModal(blockName, unitName) {
    currentHodReviewSession = { block: blockName, unit: unitName };
    
    document.getElementById('hod-review-unit-title').innerText = "Review Results: " + unitName;
    document.getElementById('hod-review-block-title').innerText = blockName;
    
    const modal = document.getElementById('hodReviewModal');
    const backdrop = document.getElementById('hodReviewBackdrop');
    const box = document.getElementById('hodReviewBox');
    const tbody = document.getElementById('hod-review-tbody');

    // UI Updates for QA
    if (adminProfile.role_level === 'QA Officer') {
        document.getElementById('btn-approve-batch').classList.add('hidden');
        document.getElementById('btn-reject-batch').innerHTML = '<i class="fas fa-flag mr-2"></i> Flag Batch';
    } else {
        document.getElementById('btn-approve-batch').classList.remove('hidden');
        document.getElementById('btn-reject-batch').innerHTML = '<i class="fas fa-times mr-2"></i> Reject Batch';
    }

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Fetching pending results from database...</td></tr>';

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);

    try {
        const { data, error } = await supabaseClient
            .from('exam_results')
            .select('student_name, admission_number, total_score, grade')
            .eq('block_name', blockName)
            .eq('unit_name', unitName)
            .eq('status', 'Pending')
            .order('student_name', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-green-500">No pending results found for this unit.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach((student, index) => {
            const scoreDisplay = student.grade === 'DNS' ? 'DNS' : student.total_score;
            
            // Re-use the existing calculateGrade logic to get the right color badges
            const gradeData = calculateGrade(String(scoreDisplay));
            const badgeHTML = `<span class="px-3 py-1 rounded-full text-[10px] font-bold ${gradeData.bg} ${gradeData.color}">${gradeData.label}</span>`;

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition hod-review-row" data-adm="${student.admission_number}" data-name="${student.student_name}">
                    <td class="px-4 py-4">
                        <p class="text-[10px] text-gray-500 font-mono">${student.admission_number}</p>
                    </td>
                    <td class="px-4 py-4 font-bold text-gray-800">${student.student_name}</td>
                    <td class="px-4 py-4 text-center">
                        <input type="text" value="${scoreDisplay}" class="review-score-input w-24 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-ramBlue outline-none transition mx-auto" oninput="updateHodRowGrade(this, ${index})">
                    </td>
                    <td class="px-4 py-4" id="hod-grade-label-${index}">
                        ${badgeHTML}
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Error loading results.</td></tr>';
        console.error(e);
    }
}

function updateHodRowGrade(inputElement, rowIndex) {
    const gradeData = calculateGrade(inputElement.value);
    const gradeCell = document.getElementById(`hod-grade-label-${rowIndex}`);
    
    if (!gradeData) {
        gradeCell.innerHTML = `<span class="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Invalid</span>`;
    } else {
        gradeCell.innerHTML = `<span class="px-3 py-1 rounded-full text-[10px] font-bold ${gradeData.bg} ${gradeData.color}">${gradeData.label}</span>`;
    }
}

function closeHodReviewModal() {
    const backdrop = document.getElementById('hodReviewBackdrop');
    const box = document.getElementById('hodReviewBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('hodReviewModal').classList.add('hidden');
    }, 300);
}

// --- UPDATED: BATCH SUBMISSION TO EXTERNAL BACKEND ---
async function hodSubmitBatch(action) {
    const approveBtn = document.getElementById('btn-approve-batch');
    const rejectBtn = document.getElementById('btn-reject-batch');
    
    // Disable buttons
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    
    const originalText = action === 'Approved' ? approveBtn.innerHTML : rejectBtn.innerHTML;
    
    if (action === 'Approved') {
        approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Approving...';
    } else {
        rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
    }

    try {
        const rows = document.querySelectorAll('.hod-review-row');
        const editedGrades = [];

        // If Approved OR QA is flagging/editing, package up the edits
        rows.forEach(row => {
            const val = row.querySelector('.review-score-input').value.trim().toUpperCase();
            const isDns = val === 'DNS';
            const score = isDns ? 0 : (parseFloat(val) || 0);

            editedGrades.push({
                admission_number: row.getAttribute('data-adm'),
                exam_score: score, 
                is_dns: isDns
            });
        });

        const response = await fetch(`${BACKEND_API_URL}/approve-results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                block_name: currentHodReviewSession.block,
                unit_name: currentHodReviewSession.unit,
                action: action === 'Approved' ? 'Approve' : 'Reject', // Rejection acts as the QA "Flag"
                staff_id: adminProfile.id,
                edited_grades: editedGrades.length > 0 ? editedGrades : null // Send edits
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.detail || `Failed to ${action.toLowerCase()} results.`);
        
        let actionWord = action === 'Approved' ? 'approved' : 'rejected and flagged';
        showToast(`Results for ${currentHodReviewSession.unit} successfully ${actionWord}!`, "success");
        
        closeHodReviewModal();
        fetchPendingApprovals(); // Refresh the pending list
        fetchHodHistory(); // Refresh the log
        loadActivityFeed(adminProfile.role_level);
        
    } catch (e) {
        showToast(e.message, "error");
        console.error(e);
        
        // Revert Buttons
        if (action === 'Approved') {
            approveBtn.innerHTML = originalText;
        } else {
            rejectBtn.innerHTML = originalText;
        }
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
    }
}

// --- NEW: FETCH HOD HISTORY LOG ---
async function fetchHodHistory() {
    const list = document.getElementById('hod-history-list');
    if (!list) return;

    list.innerHTML = '<p class="text-sm text-gray-400 italic">Loading history...</p>';

    try {
        // Fetch recently approved or rejected results
        // FIX: Changed 'updated_at' to 'created_at' to match Supabase defaults
        const { data: results, error } = await supabaseClient
            .from('exam_results')
            .select('block_name, unit_name, status, created_at')
            .in('status', ['Approved', 'Rejected'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400 italic">No approval history found.</p>';
            return;
        }

        // We only want to show one log per unit, so we group them
        const historyGroups = {};
        results.forEach(r => {
            const key = `${r.block_name}_${r.unit_name}_${r.status}`;
            if (!historyGroups[key]) {
                historyGroups[key] = { 
                    block: r.block_name, 
                    unit: r.unit_name, 
                    status: r.status,
                    // FIX: Point date formatting to created_at
                    date: new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                };
            }
        });

        list.innerHTML = '';
        Object.values(historyGroups).forEach(group => {
            const isApproved = group.status === 'Approved';
            const icon = isApproved ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500';
            const bgColor = isApproved ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100';
            
            list.innerHTML += `
                <div class="flex items-center gap-4 p-3 rounded-xl border ${bgColor} mb-2">
                    <i class="fas ${icon} text-lg shrink-0"></i>
                    <div>
                        <p class="text-sm font-bold text-gray-800">${group.unit} <span class="text-xs font-normal text-gray-500">(${group.block})</span></p>
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider">${group.status} on ${group.date}</p>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        list.innerHTML = '<p class="text-sm text-red-500">Error loading history.</p>';
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

    // Show audit button for SuperAdmins & Principals
    const auditBtn = document.getElementById('btn-view-audit');
    if (auditBtn) {
        if (role === 'SuperAdmin' || role === 'Principal' || role === 'Principal / Deputy' || role === 'QA Officer') {
            auditBtn.classList.remove('hidden');
        } else {
            auditBtn.classList.add('hidden');
        }
    }

    try {
        if (role === 'SuperAdmin' || role === 'Principal' || role === 'Principal / Deputy' || role === 'QA Officer') {
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
        } else if (role === 'HOD' || role === 'Deputy HOD' || role === 'QA Officer') { // Added QA to see this feed
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
// LECTURER GRADEBOOK & AUTO-CALCULATOR (STAGING AREA)
// ==========================================

let currentGradingSession = { block: '', unit: '' };
let totalStudentsExpected = 0;

async function openGradebook(blockName, unitName) {
    currentGradingSession = { block: blockName, unit: unitName };
    
    document.getElementById('gb-unit-title').innerText = "Results Staging Area: " + unitName;
    document.getElementById('gb-block-title').innerText = blockName;
    
    const modal = document.getElementById('gradebookModal');
    const backdrop = document.getElementById('gradebookBackdrop');
    const box = document.getElementById('gradebookBox');
    const tbody = document.getElementById('gradebook-tbody');

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Loading roster for staging...</td></tr>';
    
    // Reset 100% Math Counter
    totalStudentsExpected = 0;
    updateMatchCounter();

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);

    try {
        // Fetch ungraded students to populate the staging area 
        // (This simulates an Excel Template being mapped and loaded)
        // FIX: Using query parameters instead of path parameters
        const response = await fetch(`${BACKEND_API_URL}/ungraded-students?block_name=${encodeURIComponent(blockName)}&unit_name=${encodeURIComponent(unitName)}`);
        const resData = await response.json();

        if (!response.ok || !resData.success) throw new Error(resData.detail || "Database Error");

        const students = resData.students;

        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-green-500">All students in ' + blockName + ' have been graded for this unit.</td></tr>';
            return;
        }

        totalStudentsExpected = students.length;
        updateMatchCounter();

        tbody.innerHTML = '';
        students.forEach((student, index) => {
            const fullName = student.student_name ? student.student_name : `${student.first_name || ''} ${student.last_name || ''}`.trim();
            const admNumber = student.admission_number || 'N/A';

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition student-row" data-adm="${admNumber}" data-name="${fullName}">
                    <td class="px-4 py-4">
                        <p class="text-[10px] text-gray-500 font-mono">${admNumber}</p>
                    </td>
                    <td class="px-4 py-4 font-bold text-gray-800">${fullName}</td>
                    <td class="px-4 py-4 text-center">
                        <input type="text" class="score-input w-24 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-ramBlue outline-none transition mx-auto" placeholder="Score or DNS" oninput="updateRowGrade(this, ${index})">
                    </td>
                    <td class="px-4 py-4" id="grade-label-${index}">
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Pending</span>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Error loading student roster.</td></tr>';
        console.error(e);
    }
}

// --- DYNAMIC GRADING MATH ---
function calculateGrade(scoreInput) {
    const val = scoreInput.trim().toUpperCase();
    if (val === '') return null;
    if (val === 'DNS') return { label: 'DNS', color: 'text-gray-500', bg: 'bg-gray-200' };

    const score = parseFloat(val);
    if (isNaN(score) || score < 0 || score > 100) return { label: 'Invalid', color: 'text-red-500', bg: 'bg-red-50' };
    
    if (score >= 80) return { label: 'Distinction', color: 'text-green-700', bg: 'bg-green-100' };
    if (score >= 70) return { label: 'Credit', color: 'text-blue-700', bg: 'bg-blue-100' };
    if (score >= 60) return { label: 'Pass', color: 'text-yellow-700', bg: 'bg-yellow-100' };
    return { label: 'Fail', color: 'text-red-700', bg: 'bg-red-100' };
}

function updateRowGrade(inputElement, rowIndex) {
    const gradeData = calculateGrade(inputElement.value);
    const gradeCell = document.getElementById(`grade-label-${rowIndex}`);
    
    if (!gradeData) {
        gradeCell.innerHTML = `<span class="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Pending</span>`;
    } else {
        gradeCell.innerHTML = `<span class="px-3 py-1 rounded-full text-[10px] font-bold ${gradeData.bg} ${gradeData.color}">${gradeData.label}</span>`;
    }

    // Recalculate 100% Math Gateway status on every keystroke
    updateMatchCounter();
}

function updateMatchCounter() {
    const rows = document.querySelectorAll('.student-row');
    let accountedFor = 0;

    rows.forEach(row => {
        const val = row.querySelector('.score-input').value.trim().toUpperCase();
        if (val === 'DNS' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100)) {
            accountedFor++;
        }
    });

    const countDisplay = document.getElementById('ui-student-count');
    const submitBtn = document.getElementById('btn-submit-grades');
    
    if (countDisplay) {
        countDisplay.innerText = `${accountedFor}/${totalStudentsExpected} Students Accounted For`;
        if (accountedFor === totalStudentsExpected && totalStudentsExpected > 0) {
            countDisplay.classList.replace('text-gray-800', 'text-ramGreen');
        } else {
            countDisplay.classList.replace('text-ramGreen', 'text-gray-800');
        }
    }

    if (submitBtn) {
        if (accountedFor === totalStudentsExpected && totalStudentsExpected > 0) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
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
        
        if (tbody.innerHTML.includes("have been graded")) tbody.innerHTML = '';

        const newRowIndex = document.querySelectorAll('.student-row').length;

        const newRowHTML = `
            <tr class="hover:bg-yellow-50 transition student-row border-l-4 border-ramGold bg-yellow-50/30" data-adm="${data.admission_number}" data-name="${fullName}">
                <td class="px-4 py-4">
                    <p class="text-[10px] text-gray-500 font-mono">${data.admission_number}</p>
                </td>
                <td class="px-4 py-4">
                    <p class="font-bold text-gray-800">${fullName} <span class="text-[9px] bg-ramGold text-white px-2 py-0.5 rounded-full ml-2 uppercase font-black tracking-wider">Added</span></p>
                </td>
                <td class="px-4 py-4 text-center">
                    <input type="text" class="score-input w-24 px-3 py-2 bg-white border border-yellow-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-ramGold outline-none transition mx-auto" placeholder="Score or DNS" oninput="updateRowGrade(this, ${newRowIndex})">
                </td>
                <td class="px-4 py-4" id="grade-label-${newRowIndex}">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Pending</span>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', newRowHTML);
        admInput.value = '';
        
        // Increase the 100% Math requirement to account for the newly added student
        totalStudentsExpected++; 
        updateMatchCounter();
        
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

// --- UPDATED: EXTERNAL BACKEND - SUBMIT GRADES WITH DNS & 100% MATH ---
async function submitGrades() {
    const btn = document.getElementById('btn-submit-grades');
    const rows = document.querySelectorAll('.student-row');
    const gradesPayload = [];

    // 1. Pack grades locally (Server handles final calculation & assignments securely)
    rows.forEach(row => {
        const val = row.querySelector('.score-input').value.trim().toUpperCase();
        const isDns = val === 'DNS';
        const score = isDns ? 0 : (parseFloat(val) || 0);

        gradesPayload.push({
            student_name: row.getAttribute('data-name'),
            admission_number: row.getAttribute('data-adm'),
            cat_score: 0, // Legacy support field mapped to 0
            exam_score: score, // Contains the actual score from the Staging Area
            is_dns: isDns
        });
    });

    if (gradesPayload.length !== totalStudentsExpected || totalStudentsExpected === 0) {
        showToast("Cannot submit. 100% of students must be accounted for.", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting to Server...';

    try {
        const payload = {
            block_name: currentGradingSession.block,
            unit_name: currentGradingSession.unit,
            lecturer_id: adminProfile.id,
            grades: gradesPayload
        };

        const response = await fetch(`${BACKEND_API_URL}/submit-grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.detail || "Server failed to process grades.");
        }

        showToast(data.message || `Submitted ${gradesPayload.length} result(s).`, "success");
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
                            <td class="py-3 font-bold">${res.grade === 'DNS' ? 'DNS' : res.total_score} <span class="text-[10px] text-gray-400">(${res.grade})</span></td>
                            <td class="py-3"><span class="px-2 py-1 rounded-full text-[9px] font-bold ${res.status === 'Approved' ? 'bg-green-100 text-green-700' : (res.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}">${res.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) { list.innerHTML = '<p class="text-sm text-red-500">Error loading submissions.</p>'; }
}


// --- EXCEL FILE READER & TEMPLATE LOGIC ---
function setupDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    // Also allow dropping directly into the modal table area as a fallback
    const modalDropzone = document.getElementById('gradebookBox'); 

    const attachDragEvents = (dz) => {
        if (!dz) return;
        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('border-ramBlue', 'bg-blue-50');
        });
        dz.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dz.classList.remove('border-ramBlue', 'bg-blue-50');
        });
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.classList.remove('border-ramBlue', 'bg-blue-50');
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    };

    attachDragEvents(dropzone);
    attachDragEvents(modalDropzone);

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }
}

function handleFileUpload(file) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
        showToast("Invalid file type. Please upload an Excel or CSV file.", "error");
        return;
    }

    showToast(`Parsing ${file.name}...`, "success");

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            
            // SheetJS is required for this to work
            if (typeof XLSX === 'undefined') {
                throw new Error("SheetJS library not loaded. Please refresh the page.");
            }
            
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const jsonRoster = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            renderStagingTable(jsonRoster);
            
        } catch (error) {
            console.error("Excel Parsing Error:", error);
            showToast(error.message || "Failed to read the Excel file. Please ensure it matches the template.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderStagingTable(parsedData) {
    // Hide upload UI if it exists, show staging
    const uploadZone = document.getElementById('upload-zone-card');
    const stagingTable = document.getElementById('staging-table-card');
    if (uploadZone) uploadZone.classList.add('hidden');
    if (stagingTable) stagingTable.classList.remove('hidden');

    // We target the gradebook-tbody which is inside the staging modal
    const tbody = document.getElementById('gradebook-tbody');
    if (!tbody) {
        showToast("Staging table not found.", "error");
        return;
    }
    
    tbody.innerHTML = "";
    totalStudentsExpected = parsedData.length;

    parsedData.forEach((student, index) => {
        const admNumber = student["Admission No."] || student["Admission Number"] || student["Adm Number"] || "Unknown";
        const fullName = student["Student Name"] || student["Name"] || "Unknown";
        const score = student["Score"] !== undefined && student["Score"] !== null ? String(student["Score"]).trim() : ""; 

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition student-row" data-adm="${admNumber}" data-name="${fullName}">
                <td class="px-4 py-4">
                    <p class="text-[10px] text-gray-500 font-mono">${admNumber}</p>
                </td>
                <td class="px-4 py-4 font-bold text-gray-800">${fullName}</td>
                <td class="px-4 py-4 text-center">
                    <input type="text" value="${score}" class="score-input w-24 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-ramBlue outline-none transition mx-auto" placeholder="Score or DNS" oninput="updateRowGrade(this, ${index})">
                </td>
                <td class="px-4 py-4" id="grade-label-${index}">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Pending</span>
                </td>
            </tr>
        `;
    });

    // Run the grading math and 100% gateway check immediately on the uploaded data
    const rows = document.querySelectorAll('.student-row');
    rows.forEach((row, index) => {
        const input = row.querySelector('.score-input');
        updateRowGrade(input, index);
    });

    // If the modal isn't open, open it
    const modal = document.getElementById('gradebookModal');
    if (modal && modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('gradebookBackdrop').classList.replace('opacity-0', 'opacity-100');
            document.getElementById('gradebookBox').classList.replace('scale-90', 'scale-100');
            document.getElementById('gradebookBox').classList.replace('opacity-0', 'opacity-100');
        }, 10);
    }
    
    showToast("Roster mapped successfully! Please review grades.", "success");
}

async function downloadRosterTemplate() {
    if (!currentGradingSession.block || !currentGradingSession.unit) {
        showToast("Please open a unit gradebook first.", "error");
        return;
    }

    showToast("Generating roster template...", "success");

    try {
        const blockName = currentGradingSession.block;
        const unitName = currentGradingSession.unit;

        // Fetch exactly who is missing grades from the Python backend
        // FIX: Using query parameters instead of path parameters
        const response = await fetch(`${BACKEND_API_URL}/ungraded-students?block_name=${encodeURIComponent(blockName)}&unit_name=${encodeURIComponent(unitName)}`);
        const resData = await response.json();

        if (!response.ok || !resData.success) throw new Error(resData.detail || "Failed to fetch roster.");

        const students = resData.students;

        if (!students || students.length === 0) {
            showToast("All students in this block are already graded.", "success");
            return;
        }

        // Format the data for Excel
        const excelData = students.map(s => ({
            "Admission No.": s.admission_number,
            "Student Name": s.student_name,
            "Score": "" // Leave blank for the lecturer to fill in
        }));

        if (typeof XLSX === 'undefined') {
            throw new Error("SheetJS library not loaded. Please refresh the page.");
        }

        // Create a new workbook and inject the data
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Grade Roster");

        // Trigger the download automatically
        const fileName = `${blockName}_${unitName}_Template.xlsx`.replace(/[^a-zA-Z0-9]/g, "_");
        XLSX.writeFile(workbook, fileName);

    } catch (e) {
        console.error(e);
        showToast(e.message, "error");
    }
}


// ==========================================
// ANNOUNCEMENTS & BROADCAST LOGIC
// ==========================================

function openAnnouncementModal() {
    document.getElementById('announcementForm').reset();
    document.getElementById('ann-id').value = ''; // Clear ID for new posts
    
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

// --- NEW: EDIT ANNOUNCEMENT ---
function openEditAnnouncementModal(id, title, message, target) {
    document.getElementById('ann-id').value = id;
    document.getElementById('ann-title').value = title;
    document.getElementById('ann-message').value = message;
    document.getElementById('ann-target').value = target;

    document.getElementById('announcementModal').classList.remove('hidden');
    setTimeout(() => { 
        document.getElementById('announcementBackdrop').classList.replace('opacity-0', 'opacity-100'); 
        document.getElementById('announcementBox').classList.replace('scale-90', 'scale-100'); 
        document.getElementById('announcementBox').classList.replace('opacity-0', 'opacity-100'); 
    }, 10);
}

// --- NEW: DELETE ANNOUNCEMENT (Soft Delete) ---
async function deleteAnnouncement(id) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    // Optimistic UI Update: instantly fade and prevent further clicks
    const card = document.getElementById(`ann-${id}`);
    if (card) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
    }

    try {
        const payload = {
            announcement_id: id,
            requester_id: adminProfile.auth_id
        };

        const response = await fetch(`${BACKEND_API_URL}/delete-announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.detail || "Failed to delete announcement.");
        
        showToast("Announcement deleted.", "success");
        
        if (card) card.remove(); // Remove immediately for snappy feel
        
        // If it was the last one, we want to show the empty state
        const feed = document.getElementById('announcements-feed');
        if (feed && feed.children.length === 0) {
            fetchAnnouncements(); 
        }
    } catch (e) {
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
        showToast(e.message, "error");
        console.error(e);
    }
}

// --- UPDATED: EXTERNAL BACKEND - BROADCAST (Handles Both Create and Edit) ---
async function submitAnnouncement(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-announcement');
    const annId = document.getElementById('ann-id').value; // Check if we are editing
    const title = document.getElementById('ann-title').value.trim();
    const message = document.getElementById('ann-message').value.trim();
    const targetDropdown = document.getElementById('ann-target');
    const target = targetDropdown ? targetDropdown.value : 'All Students';

    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

    try {
        if (annId) {
            // EDIT EXISTING ANNOUNCEMENT (Via Backend for Authorization)
            const payload = {
                announcement_id: annId,
                title: title,
                message: message,
                target_audience: target,
                requester_id: adminProfile.auth_id 
            };

            const response = await fetch(`${BACKEND_API_URL}/edit-announcement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.detail || "Failed to edit announcement.");
            showToast("Announcement updated successfully!", "success");

        } else {
            // CREATE NEW ANNOUNCEMENT (Via Backend)
            const response = await fetch(`${BACKEND_API_URL}/create-announcement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    message: message,
                    target_audience: target,
                    staff_id: currentAdmin.id 
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.detail || "Broadcast failed.");
            showToast("Announcement successfully sent!", "success");
        }

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
            const audienceBadge = (ann.target_audience === 'All Students' || !ann.target_audience) 
                ? '<span class="bg-blue-100 text-ramBlue px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">Global</span>'
                : `<span class="bg-ramGold/20 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">${ann.target_audience}</span>`;

            // NEW: Scoped Permissions for Edit/Delete Buttons
            let actionButtons = '';
            if (adminProfile.role_level === 'SuperAdmin' || adminProfile.role_level === 'Principal' || ann.posted_by === currentAdmin.id) {
                // Escape single quotes in the message string so they don't break the onclick handler
                const safeMessage = ann.message.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n");
                const safeTitle = ann.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                
                actionButtons = `
                    <div class="flex gap-2">
                        <button onclick="openEditAnnouncementModal('${ann.id}', '${safeTitle}', '${safeMessage}', '${ann.target_audience || 'All Students'}')" class="text-gray-400 hover:text-ramBlue p-1 transition" title="Edit"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteAnnouncement('${ann.id}')" class="text-gray-400 hover:text-ramRed p-1 transition" title="Delete"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
            }

            return `
                <div id="ann-${ann.id}" class="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 relative group">
                    <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${actionButtons}
                    </div>
                    <div class="flex justify-between items-start mb-4 pr-12">
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

// --- AUDIT LOG LOGIC ---
function openAuditModal() {
    const modal = document.getElementById('auditLogModal');
    const backdrop = document.getElementById('auditLogBackdrop');
    const box = document.getElementById('auditLogBox');

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);

    fetchFullAuditLogs();
}

function closeAuditModal() {
    const backdrop = document.getElementById('auditLogBackdrop');
    const box = document.getElementById('auditLogBox');
    
    backdrop.classList.replace('opacity-100', 'opacity-0');
    box.classList.replace('scale-100', 'scale-90');
    box.classList.replace('opacity-100', 'opacity-0');
    
    setTimeout(() => {
        document.getElementById('auditLogModal').classList.add('hidden');
    }, 300);
}

async function fetchFullAuditLogs() {
    const feed = document.getElementById('audit-log-feed');
    const filter = document.getElementById('audit-filter').value;
    if (!feed) return;

    feed.innerHTML = `
        <div class="text-center py-8">
            <i class="fas fa-spinner fa-spin text-3xl text-gray-300 mb-4"></i>
            <p class="text-sm text-gray-500 italic">Fetching secure logs...</p>
        </div>
    `;

    try {
        // Updated to fetch via Python Backend for security
        const response = await fetch(`${BACKEND_API_URL}/audit-logs?requester_id=${adminProfile.auth_id}&filter_type=${filter}`);
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.detail || "Failed to fetch secure audit logs.");
        }

        const data = result.logs;

        if (!data || data.length === 0) {
            feed.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-clipboard-check text-4xl text-gray-200 mb-3"></i>
                    <p class="text-sm text-gray-400 italic">No audit logs found for this category.</p>
                </div>`;
            return;
        }

        feed.innerHTML = data.map(log => {
            const date = new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const staffName = log.staff_profiles ? log.staff_profiles.full_name : 'System / Unknown';
            const staffRole = log.staff_profiles ? log.staff_profiles.role_level : 'Admin';

            // Determine badge style
            let badgeColor = 'bg-gray-100 text-gray-600 border-gray-200';
            const action = log.action_type || '';
            
            if (action.includes('DELETE') || action.includes('REJECT') || log.description.includes('Deactivated')) {
                badgeColor = 'bg-red-50 text-red-700 border-red-200';
            } else if (action.includes('APPROVE') || action.includes('PUBLISH') || action.includes('CREATE')) {
                badgeColor = 'bg-green-50 text-green-700 border-green-200';
            } else if (action.includes('EDIT') || action.includes('UPDATE')) {
                badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
            }

            return `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 flex items-start gap-4">
                    <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-200 shrink-0">
                        <i class="fas fa-fingerprint text-gray-400"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start mb-1">
                            <p class="text-sm font-bold text-gray-800">${staffName} <span class="text-[10px] font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-2">${staffRole}</span></p>
                            <span class="text-[10px] text-gray-400 whitespace-nowrap">${date}</span>
                        </div>
                        <p class="text-xs text-gray-600 mb-2">${log.description}</p>
                        <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${badgeColor}">${action}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        feed.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Failed to load audit trail.</p>';
    }
}

// ==========================================
// BLOCK PROGRESSION & SUPPLEMENTARY LOGIC
// ==========================================

let clearedStudentsForPromotion = [];
let currentProgressionBlock = "";

async function auditProgression() {
    const block = document.getElementById('progression-block-filter').value;
    if (!block) {
        showToast("Please select a block to audit.", "error");
        return;
    }

    const container = document.getElementById('progression-results-container');
    const emptyState = document.getElementById('progression-empty-state');
    const clearedTbody = document.getElementById('cleared-students-tbody');
    const heldBackTbody = document.getElementById('held-back-students-tbody');
    const promoteBtn = document.getElementById('btn-promote-cohort');

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    clearedTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Auditing records...</td></tr>';
    heldBackTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Auditing records...</td></tr>';
    
    promoteBtn.disabled = true;
    promoteBtn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        // 1. Fetch all approved students in the block
        const { data: students, error: studentErr } = await supabaseClient
            .from('students')
            .select('admission_number, first_name, last_name')
            .eq('block', block)
            .eq('is_approved', true);
        
        if (studentErr) throw studentErr;

        // 2. Fetch all verified (Approved) grades for these students
        const { data: grades, error: gradesErr } = await supabaseClient
            .from('exam_results')
            .select('admission_number, unit_name, grade')
            .eq('block_name', block)
            .eq('status', 'Approved');

        if (gradesErr) throw gradesErr;

        // 3. Fetch required units for this block
        const { data: units, error: unitsErr } = await supabaseClient
            .from('unit_assignments')
            .select('unit_name')
            .eq('block_name', block);
        
        if (unitsErr) throw unitsErr;

        const requiredUnits = [...new Set(units.map(u => u.unit_name))];

        if (!students || students.length === 0) {
            clearedTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400">No students found in this block.</td></tr>';
            heldBackTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400">No students found in this block.</td></tr>';
            return;
        }

        // Map grades by student (Keep the best grade if there are multiples from supplementaries)
        const studentGrades = {};
        grades.forEach(g => {
            if (!studentGrades[g.admission_number]) studentGrades[g.admission_number] = {};
            // If they already passed it, don't overwrite with a fail (just in case of weird data)
            const currentGrade = studentGrades[g.admission_number][g.unit_name];
            if (currentGrade !== 'Distinction' && currentGrade !== 'Credit' && currentGrade !== 'Pass') {
                studentGrades[g.admission_number][g.unit_name] = g.grade;
            }
        });

        const cleared = [];
        const heldBack = [];

        students.forEach(student => {
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
            const sGrades = studentGrades[student.admission_number] || {};
            
            let hasFailed = false;
            const failedUnits = [];

            // Check if they took all required units and passed
            requiredUnits.forEach(reqUnit => {
                const grade = sGrades[reqUnit];
                if (!grade) {
                    hasFailed = true;
                    failedUnits.push(`${reqUnit} (Missing)`);
                } else if (grade === 'Fail' || grade === 'DNS' || grade === 'Invalid') {
                    hasFailed = true;
                    failedUnits.push(`${reqUnit} (${grade})`);
                }
            });

            if (hasFailed) {
                heldBack.push({ ...student, fullName, failedUnits });
            } else {
                cleared.push({ ...student, fullName });
            }
        });

        // Render Cleared
        if (cleared.length === 0) {
            clearedTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400">No students cleared for promotion.</td></tr>';
        } else {
            clearedTbody.innerHTML = cleared.map(s => `
                <tr class="hover:bg-green-50 transition">
                    <td class="px-6 py-3 font-mono text-[10px] text-gray-500">${s.admission_number}</td>
                    <td class="px-6 py-3 font-bold text-gray-800">${s.fullName}</td>
                    <td class="px-6 py-3 text-center"><span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">Cleared</span></td>
                </tr>
            `).join('');
            
            // Enable promote button only for allowed roles
            if (['SuperAdmin', 'Principal', 'Principal / Deputy', 'HOD', 'Deputy HOD'].includes(adminProfile.role_level)) {
                promoteBtn.disabled = false;
                promoteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        // Render Held Back
        if (heldBack.length === 0) {
            heldBackTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400">No students held back.</td></tr>';
        } else {
            heldBackTbody.innerHTML = heldBack.map(s => `
                <tr class="hover:bg-red-50 transition">
                    <td class="px-6 py-3 font-mono text-[10px] text-gray-500">${s.admission_number}</td>
                    <td class="px-6 py-3 font-bold text-gray-800">${s.fullName}</td>
                    <td class="px-6 py-3 text-xs text-red-600 font-medium">${s.failedUnits.join(', ')}</td>
                </tr>
            `).join('');
        }

        clearedStudentsForPromotion = cleared.map(s => s.admission_number);
        currentProgressionBlock = block;

    } catch (e) {
        console.error(e);
        showToast("Failed to audit progression.", "error");
        clearedTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-red-500">Audit failed.</td></tr>';
        heldBackTbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-red-500">Audit failed.</td></tr>';
    }
}

async function promoteCohort() {
    if (clearedStudentsForPromotion.length === 0) return;

    const promoteBtn = document.getElementById('btn-promote-cohort');
    const originalText = promoteBtn.innerHTML;

    if (!confirm(`Are you sure you want to promote ${clearedStudentsForPromotion.length} student(s) from ${currentProgressionBlock} to the next block?`)) return;

    promoteBtn.disabled = true;
    promoteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Promoting...';

    try {
        const payload = {
            current_block: currentProgressionBlock,
            students: clearedStudentsForPromotion,
            requester_id: adminProfile.auth_id
        };

        const response = await fetch(`${BACKEND_API_URL}/promote-students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.detail || "Failed to promote students.");

        showToast(`Successfully promoted ${clearedStudentsForPromotion.length} students!`, "success");
        auditProgression(); // Re-audit to verify they are gone

    } catch (e) {
        console.error(e);
        showToast(e.message, "error");
        promoteBtn.disabled = false;
        promoteBtn.innerHTML = originalText;
    }
}
