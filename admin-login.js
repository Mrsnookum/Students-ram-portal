// admin-login.js

// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if already logged in as admin
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        // Verify they are actually staff before auto-redirecting
        const { data: profile } = await supabaseClient
            .from('staff_profiles')
            .select('id, role_level')
            .eq('auth_id', session.user.id)
            .single();
            
        if (profile) {
            window.location.href = "admin-dashboard.html";
        }
    }
});

// --- UI HELPERS ---
function showToast(message, type = 'error') {
    const toast = document.getElementById('toastContainer');
    const toastMsg = document.getElementById('toastMessage');
    const toastText = document.getElementById('toastText');
    const toastIcon = document.getElementById('toastIcon');

    if (type === 'error') {
        toastMsg.className = "bg-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl border-l-4 border-red-500 font-semibold text-xs md:text-sm flex items-center justify-between pointer-events-auto";
        toastIcon.className = "fas fa-shield-alt mr-3 text-base md:text-lg text-red-500";
    } else {
        toastMsg.className = "bg-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl border-l-4 border-green-500 font-semibold text-xs md:text-sm flex items-center justify-between pointer-events-auto";
        toastIcon.className = "fas fa-check-circle mr-3 text-base md:text-lg text-green-500";
    }

    toastText.innerText = message;
    
    toast.classList.remove('hidden');
    toast.classList.add('toast-enter');

    setTimeout(() => hideToast(), 4000);
}

function hideToast() {
    const toast = document.getElementById('toastContainer');
    toast.classList.add('hidden');
    toast.classList.remove('toast-enter');
}

function setLoading(btn) {
    btn.dataset.originalText = btn.innerHTML; // Store original HTML
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i> Authenticating...`;
    btn.disabled = true;
    btn.classList.add('opacity-70', 'cursor-wait');
}

function resetBtn(btn) {
    btn.innerHTML = btn.dataset.originalText;
    btn.disabled = false;
    btn.classList.remove('opacity-70', 'cursor-wait');
}

// --- ADMIN LOGIN LOGIC ---
async function handleAdminLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById('adminEmail').value.trim();
    const passwordInput = document.getElementById('adminPassword').value;
    const btn = document.getElementById('adminLoginBtn');

    setLoading(btn);

    try {
        // Step 1: Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput,
        });

        if (authError) {
            throw new Error("Invalid email or password.");
        }

        // Step 2: Verify RBAC (Role-Based Access Control)
        // Check if this user actually exists in the staff_profiles table
        const { data: staffProfile, error: profileError } = await supabaseClient
            .from('staff_profiles')
            .select('is_active, role_level')
            .eq('auth_id', authData.user.id)
            .single();

        // If they aren't in the table, or their account is deactivated
        if (profileError || !staffProfile || !staffProfile.is_active) {
            // Instantly destroy the session
            await supabaseClient.auth.signOut();
            throw new Error("Unauthorized access. Contact System Administrator.");
        }

        // Step 3: Success! Route to dashboard
        showToast(`Welcome back, ${staffProfile.role_level}.`, "success");
        setTimeout(() => {
            window.location.href = "admin-dashboard.html";
        }, 1000);

    } catch (error) {
        showToast(error.message, "error");
        resetBtn(btn);
    }
}

// Attach event listener
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) loginForm.addEventListener('submit', handleAdminLogin);
});