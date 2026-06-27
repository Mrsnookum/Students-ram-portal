// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

// Initialize the Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// UI FUNCTIONS (Modals & Toasts)
// ==========================================

function openApplyModal() {
    const modal = document.getElementById('applyModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeApplyModal() {
    const modal = document.getElementById('applyModal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore background scrolling
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toastText = document.getElementById('toastText');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    toastText.textContent = message;
    
    // Reset classes
    toastIcon.className = 'fas mr-3 text-lg ';
    toastMessage.className = 'bg-white px-6 py-4 rounded-xl shadow-2xl border-l-4 font-semibold text-sm flex items-center justify-between ';

    // Apply styles based on toast type
    if (type === 'success') {
        toastIcon.classList.add('fa-check-circle', 'text-green-500');
        toastMessage.classList.add('border-green-500');
    } else if (type === 'error') {
        toastIcon.classList.add('fa-exclamation-circle', 'text-red-500');
        toastMessage.classList.add('border-red-500');
    } else {
        toastIcon.classList.add('fa-info-circle', 'text-blue-500');
        toastMessage.classList.add('border-blue-500');
    }

    toastContainer.classList.remove('hidden');
    toastMessage.classList.add('toast-enter');

    // Auto hide after 5 seconds
    setTimeout(hideToast, 5000);
}

function hideToast() {
    const toastContainer = document.getElementById('toastContainer');
    toastContainer.classList.add('hidden');
}


// ==========================================
// SUPABASE FORM SUBMISSION
// ==========================================

async function submitApplication(event) {
    event.preventDefault(); // Stop default form submission
    
    const btn = document.getElementById('applyBtn');
    const originalBtnText = btn.innerHTML;
    
    // Set loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
    btn.disabled = true;

    try {
        // 1. Gather basic inputs
        const firstName = document.getElementById('appFirstName').value;
        const lastName = document.getElementById('appLastName').value;
        const email = document.getElementById('appEmail').value;
        const phone = document.getElementById('appPhone').value;
        const indexNumber = document.getElementById('appIndex').value;
        const meanGrade = document.getElementById('appMeanGrade').value;
        const course = document.getElementById('appCourse').value;

        // 2. Gather subject grades
        const subjectsArray = [];
        const subjectNames = document.querySelectorAll('.appSubjName');
        const subjectGrades = document.querySelectorAll('.appSubjGrade');
        
        for (let i = 0; i < subjectNames.length; i++) {
            const name = subjectNames[i].value.trim();
            const grade = subjectGrades[i].value;
            // Only add if both subject name and grade are provided
            if (name && grade) {
                subjectsArray.push({ subject: name, grade: grade });
            }
        }

        // 3. Construct payload object matching your Supabase table columns
        const payload = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            index_number: indexNumber,
            mean_grade: meanGrade,
            course: course,
            subjects: subjectsArray // Ensure your Supabase table has a JSONB column for subjects
        };

        // 4. Insert data into Supabase (Replace 'applications' with your actual table name)
        const { data, error } = await supabaseClient
            .from('applications') 
            .insert([payload]);

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        // 5. Handle successful submission
        showToast('Application submitted successfully! We will contact you soon.', 'success');
        document.getElementById('applicationForm').reset();
        closeApplyModal();

    } catch (error) {
        // Handle errors
        console.error('Error submitting application:', error);
        showToast(error.message || 'An error occurred while submitting. Please try again.', 'error');
    } finally {
        // Revert button state
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
}

// ==========================================
// SUPABASE CONTACT FORM (DB SAVE ONLY)
// ==========================================

async function submitInquiry(event) {
    // Stop the page from reloading
    event.preventDefault(); 
    
    // Grab the button to show a loading state
    const btn = document.querySelector('#contactForm button[type="submit"]'); 
    const originalBtnText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Sending...';
    btn.disabled = true;

    try {
        const name = document.getElementById('contactName').value;
        const email = document.getElementById('contactEmail').value;
        const message = document.getElementById('contactMessage').value;
        const subject = "Website Inquiry from " + name; 

        // The exact payload for our Supabase table
        const payload = {
            name: name,
            email: email,
            subject: subject,
            message: message
        };

        // Push directly to Supabase
        const { error } = await supabaseClient
            .from('inquiries') 
            .insert([payload]);

        if (error) {
            console.error('Database Error:', error);
            throw new Error("Failed to save message.");
        }

        // Show success and clear the form
        showToast('Message sent! The administration will check it shortly.', 'success');
        document.getElementById('contactForm').reset();

    } catch (error) {
        console.error('Submission Error:', error);
        showToast('Failed to send message. Please try again.', 'error');
    } finally {
        // Reset button
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
}

// Attach the listener to the form
const contactFormElement = document.getElementById('contactForm');
if (contactFormElement) {
    contactFormElement.addEventListener('submit', submitInquiry);
}

// ==========================================
// DYNAMIC CAMPUS GALLERY
// ==========================================

async function loadGallery() {
    try {
        // Fetch the images, ordering by newest first
        const { data: images, error } = await supabaseClient
            .from('gallery_images')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error fetching gallery:', error);
            throw error;
        }

        const galleryContainer = document.getElementById('galleryContainer');
        if (!galleryContainer) return; // Exit if we aren't on the page with the gallery

        // Clear the loading spinner
        galleryContainer.innerHTML = '';

        // If the database is empty
        if (!images || images.length === 0) {
            galleryContainer.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">Gallery images coming soon.</p>';
            return;
        }

        // Loop through the data and create the image tags dynamically
        images.forEach(img => {
            const imgElement = document.createElement('img');
            imgElement.src = img.image_url;
            imgElement.alt = img.alt_text || 'Campus Image';
            imgElement.className = 'rounded-xl w-full h-48 md:h-56 object-cover hover:opacity-80 transition cursor-pointer shadow';
            
            galleryContainer.appendChild(imgElement);
        });

    } catch (error) {
        console.error('Error loading gallery:', error);
        const galleryContainer = document.getElementById('galleryContainer');
        if (galleryContainer) {
            galleryContainer.innerHTML = '<p class="col-span-full text-center text-red-400 py-8">Failed to load gallery. Please refresh the page.</p>';
        }
    }
}

// Trigger the gallery load as soon as the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadGallery);