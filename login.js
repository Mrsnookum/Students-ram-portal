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

// --- DYNAMIC MODAL HANDLER ---
function showAuthModal(title, message, iconClass, colorClass) {
    document.getElementById('authModalTitle').innerText = title;
    document.getElementById('authModalMessage').innerText = message;
    
    const icon = document.getElementById('authModalIcon');
    icon.className = `fas ${iconClass} ${colorClass}`;
    
    document.getElementById('authStatusModal').classList.remove('hidden');
    
    // Slight delay to trigger CSS transitions
    setTimeout(() => {
        document.getElementById('authModalBackdrop').classList.replace('opacity-0', 'opacity-100');
        const box = document.getElementById('authModalBox');
        box.classList.replace('scale-90', 'scale-100');
        box.classList.replace('opacity-0', 'opacity-100');
    }, 10);
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

        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: authEmail,
            password: passwordInput,
        });

        if (authError) {
            throw authError;
        }

        // Check if the student is approved by Admin/HOD
        const { data: studentData, error: studentError } = await supabaseClient
            .from('students')
            .select('is_approved')
            .eq('auth_id', authData.user.id)
            .single();

        if (studentError || !studentData) {
            await supabaseClient.auth.signOut();
            throw new Error("Student profile could not be verified.");
        }

        // If not approved, kick them out and show the locked modal
        if (studentData.is_approved === false) {
            await supabaseClient.auth.signOut(); // Destroy the session immediately
            resetBtn(btn, "Sign In");
            showAuthModal(
                "Account Pending Approval",
                "Your account is currently awaiting verification by the Administration. You will be able to log in once your admission status is confirmed.",
                "fa-user-lock",
                "text-ramGold"
            );
            return;
        }

        // If approved, proceed normally
        showToast("Login successful! Redirecting...", "success");
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1000);

    } catch (error) {
        showToast(error.message || "Invalid admission number or password.", "error");
        resetBtn(btn, "Sign In");
    }
}

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

        if (authError) throw authError;

        // 2. Insert the student into your public 'students' table (is_approved defaults to false via DB)
        const { error: dbError } = await supabaseClient.from('students').insert([{
            auth_id: authData.user.id,
            admission_number: adm,
            first_name: first,
            last_name: last,
            block: 'Pending',
            course: 'KRCHN'
        }]);

        if (dbError) {
            console.error("DB Insert Failed:", dbError);
            throw new Error(`Database error: ${dbError.message}`);
        }

        // Successfully created. Show pending modal instead of immediately logging them in.
        document.getElementById('registerForm').reset();
        toggleForms();
        document.getElementById('loginUsername').value = adm;
        resetBtn(btn, "Activate & Login");
        
        showAuthModal(
            "Registration Successful",
            "Your student account has been created securely. However, it must be verified and approved by the HOD before you can log in. Please check back later.",
            "fa-shield-check",
            "text-ramBlue"
        );

    } catch (error) {
        console.error("Supabase Registration Error:", error);
        let errMsg = error.message || "An unknown error occurred.";
        
        if (errMsg.includes("already registered")) {
            errMsg = "This admission number is already activated.";
        }
        
        showToast(errMsg, "error");
        resetBtn(btn, "Activate & Login");
    }
}


// ==========================================
// 3-STEP PASSWORD RESET LOGIC (FASTAPI + BREVO)
// ==========================================

// Global state to track the user through the 3 modal steps
let resetState = {
    admissionNo: '',
    email: '',
    otpCode: ''
};

// URL for the Python Backend (Update this when deploying to Render/Railway)
const FASTAPI_URL = 'https://ram-portal-backend.onrender.com';

async function handleRequestOtp(event) {
    event.preventDefault();
    const adm = document.getElementById('resetAdmNo').value.trim();
    const email = document.getElementById('resetEmail').value.trim();
    const btn = document.getElementById('btnRequestOtp');

    if (!admissionRegex.test(adm)) {
        return showToast("Invalid format. Use your exact ID (e.g., 894/24)", "error");
    }

    setLoading(btn, "Sending Code...");

    try {
        const response = await fetch(`${FASTAPI_URL}/api/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admission_number: adm, email: email })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to send verification code. Check your details.");
        }

        // Save data to state
        resetState.admissionNo = adm;
        resetState.email = email;

        showToast("Code sent! Check your email inbox.", "success");
        goToStep(2);

    } catch (error) {
        showToast(error.message, "error");
    } finally {
        resetBtn(btn, `<span>Send Verification Code</span> <i class="fas fa-paper-plane"></i>`);
    }
}

async function handleVerifyOtp(event) {
    event.preventDefault();
    const btn = document.getElementById('btnVerifyOtp');
    
    // Stitch the 6 digits together from the boxes
    const otpInputs = document.querySelectorAll('.otp-input');
    let otp = '';
    otpInputs.forEach(input => otp += input.value);

    if (otp.length !== 6) {
        return showToast("Please enter the full 6-digit code.", "error");
    }

    setLoading(btn, "Verifying Identity...");

    try {
        const response = await fetch(`${FASTAPI_URL}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                admission_number: resetState.admissionNo, 
                otp_code: otp 
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Invalid or expired code. Please try again.");
        }

        resetState.otpCode = otp; // Save for the final password change step
        showToast("Identity Verified!", "success");
        goToStep(3);

    } catch (error) {
        showToast(error.message, "error");
        // Clear the boxes if they got it wrong
        otpInputs.forEach(input => input.value = '');
        otpInputs[0].focus();
    } finally {
        resetBtn(btn, `<span>Verify Identity</span> <i class="fas fa-check-circle"></i>`);
    }
}

async function handleUpdatePassword(event) {
    event.preventDefault();
    const newPass = document.getElementById('resetNewPass').value;
    const confirmPass = document.getElementById('resetConfirmPass').value;
    const btn = document.getElementById('btnUpdatePassword');

    if (newPass !== confirmPass) {
        return showToast("Passwords do not match.", "error");
    }

    if (newPass.length < 6) {
        return showToast("Password must be at least 6 characters long.", "error");
    }

    setLoading(btn, "Securing Account...");

    try {
        const response = await fetch(`${FASTAPI_URL}/api/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                admission_number: resetState.admissionNo,
                otp_code: resetState.otpCode,
                new_password: newPass 
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to update password.");
        }

        showToast("Success! Password securely updated. You can now log in.", "success");
        
        // Auto-close modal and fill in the login form
        setTimeout(() => {
            closeForgotPasswordModal();
            document.getElementById('loginUsername').value = resetState.admissionNo;
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginPassword').focus();
        }, 2000);

    } catch (error) {
        showToast(error.message, "error");
    } finally {
        resetBtn(btn, `<span>Secure Account & Login</span> <i class="fas fa-lock"></i>`);
    }
}

// ==========================================
// ATTACH EVENT LISTENERS SAFELY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Existing Forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    // New OTP Forms
    const requestOtpForm = document.getElementById('requestOtpForm');
    const verifyOtpForm = document.getElementById('verifyOtpForm');
    const newPasswordForm = document.getElementById('newPasswordForm');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    // *Important:* Since we added event listeners here, make sure to REMOVE the inline 
    // `onsubmit="event.preventDefault(); goToStep(x);"` from your HTML form tags!
    if (requestOtpForm) {
        requestOtpForm.onsubmit = null; // Clear inline placeholder
        requestOtpForm.addEventListener('submit', handleRequestOtp);
    }
    
    if (verifyOtpForm) {
        verifyOtpForm.onsubmit = null; // Clear inline placeholder
        verifyOtpForm.addEventListener('submit', handleVerifyOtp);
    }
    
    if (newPasswordForm) {
        newPasswordForm.onsubmit = null; // Clear inline placeholder
        newPasswordForm.addEventListener('submit', handleUpdatePassword);
    }
});
