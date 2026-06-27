// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const admissionRegex = /^\d{3,4}\/\d{2}$/; // Enforces dynamic protocol like 12/24, 894/24, 1056/24

// --- HELPERS ---

function toggleForms() {
    document.getElementById('loginSection').classList.toggle('hidden');
    document.getElementById('registerSection').classList.toggle('hidden');
}

// Converts Admission No to a dummy email for Supabase Auth requirements
function getAuthEmail(admissionNo) {
    const cleanAdm = admissionNo.replace(/\//g, '');
    return `${cleanAdm}@student.ram.ac.ke`;
}

// Sleek, Mobile-Friendly Toast Notification System
function showToast(message, type = 'error') {
    const toast = document.getElementById('toastContainer');
    const toastMsg = document.getElementById('toastMessage');
    const toastText = document.getElementById('toastText');
    const toastIcon = document.getElementById('toastIcon');

    if (type === 'error') {
        toastMsg.className = "bg-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl border-l-4 border-red-500 font-semibold text-xs md:text-sm flex items-center justify-between";
        toastIcon.className = "fas fa-exclamation-circle mr-3 text-base md:text-lg text-red-500";
    } else {
        toastMsg.className = "bg-white px-4 py-3 md:px-6 md:py-4 rounded-xl shadow-2xl border-l-4 border-green-500 font-semibold text-xs md:text-sm flex items-center justify-between";
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

function setLoading(btn, text) {
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${text}`;
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-wait');
}

function resetBtn(btn, text) {
    btn.innerHTML = text;
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-wait');
}

// --- SUPABASE LOGIN LOGIC ---
async function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('loginUsername').value.trim();
    const passwordInput = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!admissionRegex.test(usernameInput)) {
        showToast("Invalid format. Use your exact ID (e.g., 894/24)", "error");
        return;
    }

    setLoading(btn, "Verifying...");

    try {
        const authEmail = getAuthEmail(usernameInput);

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: authEmail,
            password: passwordInput,
        });

        if (error) {
            throw error;
        }

        // Supabase securely handles session storage automatically.
        showToast("Login successful! Redirecting...", "success");
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1000);

    } catch (error) {
        showToast("Invalid admission number or password.", "error");
        resetBtn(btn, "Sign In");
    }
}

// --- SUPABASE REGISTRATION LOGIC ---
// --- SUPABASE REGISTRATION LOGIC ---
async function handleRegister(event) {
    event.preventDefault();
    const adm = document.getElementById('regAdmission').value.trim();
    const first = document.getElementById('regFirst').value.trim();
    const last = document.getElementById('regLast').value.trim();
    const email = document.getElementById('regEmail').value.trim(); 
    const pass = document.getElementById('regPass').value;
    const btn = document.getElementById('regBtn');

    if (!admissionRegex.test(adm)) {
        showToast("Invalid format. Use your exact ID (e.g., 894/24)", "error");
        return;
    }

    setLoading(btn, "Setting up account...");

    try {
        const authEmail = getAuthEmail(adm);

        // 1. Create the Auth Credential
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: authEmail,
            password: pass,
            options: {
                data: {
                    first_name: first,
                    last_name: last,
                    admission_number: adm,
                    contact_email: email
                }
            }
        });

        // If Auth fails, throw it so the catch block can handle it
        if (authError) throw authError;

        // 2. Insert the student into your public 'students' table
        // FIXED: We now pass the auth_id and a valid starting block to satisfy the database!
        const { error: dbError } = await supabaseClient.from('students').insert([{
            auth_id: authData.user.id,        // Links the secure login to the dashboard profile
            admission_number: adm,
            first_name: first,
            last_name: last,
            block: 'Introductory',            // Satisfies the valid_blocks constraint
            course: 'Pending Assignment'      // Matches your existing database structure
        }]);

        if (dbError) {
            console.error("DB Insert Failed:", dbError);
            throw new Error(`Database error: ${dbError.message}`);
        }

        showToast("Account activated successfully! Please log in.", "success");
        
        document.getElementById('registerForm').reset();
        setTimeout(() => {
            toggleForms();
            document.getElementById('loginUsername').value = adm;
            resetBtn(btn, "Activate & Login");
        }, 1500);

    } catch (error) {
        // UNMASK THE ERROR: Pull the actual message from Supabase
        console.error("Supabase Registration Error:", error);
        let errMsg = error.message || "An unknown error occurred.";
        
        if (errMsg.includes("already registered")) {
            errMsg = "This admission number is already activated.";
        }
        
        showToast(errMsg, "error");
        resetBtn(btn, "Activate & Login");
    }
}

// Attach event listeners safely
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
});