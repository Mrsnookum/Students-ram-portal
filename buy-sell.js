// js/buy-sell.js

const SUPABASE_URL = 'https://atkcgxthfgpadgxgqeaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2NneHRoZmdwYWRneGdxZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDIzNjIsImV4cCI6MjA5Nzc3ODM2Mn0.ivC1B2QLjDGmyi_Glr8fnhGaZerLe2V1dHRfrVaZ1zc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentStudent = null;
let selectedFile = null;
let activeCategory = 'All'; 

document.addEventListener('DOMContentLoaded', () => {
    initializeMarketplace();
    
    const filterOverlay = document.getElementById('filterOverlay');
    if (filterOverlay) {
        filterOverlay.addEventListener('click', closeFilterModal);
    }
});

async function initializeMarketplace() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (!session || error) {
        window.location.href = "login.html";
        return;
    }
    currentUser = session.user;

    const { data: student } = await supabaseClient
        .from('students')
        .select('*')
        .eq('auth_id', currentUser.id)
        .single();
    
    currentStudent = student;
    
    if (student) {
        document.getElementById('ui-name-sidebar').innerText = `${student.first_name} ${student.last_name}`;
        document.getElementById('ui-id-sidebar').innerText = student.admission_number;
        document.getElementById('ui-welcome-name').innerText = `Welcome Back, ${student.first_name}!`;
        document.getElementById('ui-avatar').src = `https://ui-avatars.com/api/?name=${student.first_name}+${student.last_name}&background=003366&color=fff`;
        document.getElementById('ui-block-header').innerText = student.block || "Not Set";
        document.getElementById('ui-intake-badge').innerText = student.intake || "Pending";
        
        if (student.whatsapp_phone) {
            document.getElementById('payhero-phone').value = student.whatsapp_phone;
        }
    }

    loadMarketplaceItems();
    subscribeToMarketplace(); 
}

function openFilterModal() {
    const overlay = document.getElementById('filterOverlay');
    const sheet = document.getElementById('filterSheet');
    overlay.classList.remove('hidden');
    sheet.classList.remove('translate-y-full');
    setTimeout(() => { overlay.classList.replace('opacity-0', 'opacity-100'); }, 10);
}

function closeFilterModal() {
    const overlay = document.getElementById('filterOverlay');
    const sheet = document.getElementById('filterSheet');
    sheet.classList.add('translate-y-full');
    overlay.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => { overlay.classList.add('hidden'); }, 300);
}

function applyFilter(categoryName, element) {
    activeCategory = categoryName;
    const btnText = categoryName === 'All' ? 'All Items' : categoryName;
    document.getElementById('current-filter-text').innerText = `Filter: ${btnText}`;
    
    document.querySelectorAll('.filter-option').forEach(el => {
        el.classList.remove('bg-blue-50', 'text-ramBlue', 'font-bold');
        el.querySelector('.check-icon').classList.add('hidden');
    });
    
    element.classList.add('bg-blue-50', 'text-ramBlue', 'font-bold');
    element.querySelector('.check-icon').classList.remove('hidden');

    closeFilterModal();
    loadMarketplaceItems();
}

function openListingModal() {
    document.getElementById('listingModal').classList.remove('hidden');
}

function closeListingModal() {
    document.getElementById('listingModal').classList.add('hidden');
    document.getElementById('item-title').value = '';
    document.getElementById('item-price').value = '';
    document.getElementById('item-desc').value = '';
    document.getElementById('promote-toggle').checked = false;
    document.getElementById('payhero-phone').value = currentStudent?.whatsapp_phone || '';
    
    selectedFile = null;
    document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('image-placeholder').classList.remove('hidden');
    
    togglePayhero(); 
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview').classList.remove('hidden');
            document.getElementById('image-placeholder').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
}

function togglePayhero() {
    const isPromoted = document.getElementById('promote-toggle').checked;
    const payheroBlock = document.getElementById('payhero-block');
    const submitBtn = document.getElementById('btn-submit-listing');
    const stkStatus = document.getElementById('stk-status');

    stkStatus.classList.add('hidden');

    if (isPromoted) {
        payheroBlock.classList.remove('hidden');
        submitBtn.innerHTML = 'PAY 20 KES & POST LISTING NOW';
        submitBtn.classList.replace('bg-ramBlue', 'bg-ramGold');
        submitBtn.classList.replace('hover:bg-blue-800', 'hover:bg-yellow-600');
        submitBtn.classList.replace('text-white', 'text-ramBlue');
    } else {
        payheroBlock.classList.add('hidden');
        submitBtn.innerHTML = 'Post Item (Free)';
        submitBtn.classList.replace('bg-ramGold', 'bg-ramBlue');
        submitBtn.classList.replace('hover:bg-yellow-600', 'hover:bg-blue-800');
        submitBtn.classList.replace('text-ramBlue', 'text-white');
    }
}

// --- SUBMIT LOGIC ---
async function submitListing() {
    const title = document.getElementById('item-title').value.trim();
    const category = document.getElementById('item-category').value;
    const price = document.getElementById('item-price').value;
    const desc = document.getElementById('item-desc').value.trim();
    const isPromoted = document.getElementById('promote-toggle').checked;
    const phone = document.getElementById('payhero-phone').value.trim();
    const btn = document.getElementById('btn-submit-listing');

    if (!title || !price || !desc || !selectedFile) {
        return showToast("Please fill all details and upload an image.", "error");
    }

    if (isPromoted && !phone) {
        return showToast("Please enter your M-Pesa number for promotion.", "error");
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Uploading...';

    try {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${currentStudent.admission_number}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('marketplace-images')
            .upload(fileName, selectedFile);
            
        if (uploadError) throw new Error("Image upload failed");

        const { data: publicUrlData } = supabaseClient.storage
            .from('marketplace-images')
            .getPublicUrl(fileName);

        // INSERT LOGIC: If Promoted, hide it in 'pending' status so it doesn't show in the feed yet.
        const payload = {
            seller_id: currentStudent.auth_id,
            title: title,
            category: category,
            price: parseFloat(price),
            description: desc,
            image_url: publicUrlData.publicUrl,
            is_promoted: false, 
            status: isPromoted ? 'pending' : 'active' 
        };

        const { data: insertedData, error: dbError } = await supabaseClient
            .from('marketplace_items')
            .insert([payload])
            .select(); 

        if (dbError) throw dbError;
        
        const newItemId = insertedData[0].item_id;

        if (isPromoted) {
            btn.innerHTML = 'Awaiting M-Pesa...';
            document.getElementById('stk-status').classList.remove('hidden');

            const apiResponse = await fetch('http://127.0.0.1:8000/api/promote-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: newItemId, phone_number: phone })
            });

            const apiData = await apiResponse.json();
            
            if (apiData.status === "success") {
                // Listen specifically for our Python webhook to update this item
                listenForPaymentResult(newItemId);
            } else {
                handlePaymentFailure(newItemId);
            }
        } else {
            showToast("Item listed successfully!", "success");
            closeListingModal();
        }

    } catch (e) {
        console.error(e);
        showToast("Error listing item. Try again.", "error");
        btn.disabled = false;
        togglePayhero(); 
    }
}

// --- PAYMENT RESULT LISTENER & FALLBACK MODAL ---
function listenForPaymentResult(itemId) {
    // 1. Listen to Supabase for changes to our pending item
    const paymentListener = supabaseClient
        .channel(`payment_status_${itemId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', schema: 'public', table: 'marketplace_items', filter: `item_id=eq.${itemId}` 
        }, (payload) => {
            const updatedItem = payload.new;
            
            if (updatedItem.status === 'active' && updatedItem.is_promoted === true) {
                // Success!
                supabaseClient.removeChannel(paymentListener);
                clearTimeout(paymentTimeout);
                showToast("Payment successful! Item promoted.", "success");
                closeListingModal();
            } else if (updatedItem.status === 'payment_failed') {
                // Cancelled or Insufficient Funds
                supabaseClient.removeChannel(paymentListener);
                clearTimeout(paymentTimeout);
                handlePaymentFailure(itemId);
            }
        })
        .subscribe();

    // 2. Set a 60-second timeout in case Payhero goes down
    const paymentTimeout = setTimeout(() => {
        supabaseClient.removeChannel(paymentListener);
        handlePaymentFailure(itemId);
    }, 60000); 
}

function handlePaymentFailure(itemId) {
    const btn = document.getElementById('btn-submit-listing');
    btn.disabled = false;
    togglePayhero(); // Reset buttons
    
    // Show the custom HTML modal instead of the browser confirm
    const fallbackModal = document.getElementById('paymentFailedModal');
    fallbackModal.classList.remove('hidden');

    // Attach event listener for "Yes, Post for Free"
    document.getElementById('btn-fallback-free').onclick = async function() {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Posting...';
        btn.disabled = true;
        fallbackModal.classList.add('hidden');
        
        await supabaseClient.from('marketplace_items')
            .update({ status: 'active', is_promoted: false })
            .eq('item_id', itemId);
            
        showToast("Item posted for free.", "success");
        closeListingModal();
    };

    // Attach event listener for "Cancel Listing"
    document.getElementById('btn-fallback-cancel').onclick = async function() {
        fallbackModal.classList.add('hidden');
        // Delete the hidden item since they abandoned it
        await supabaseClient.from('marketplace_items').delete().eq('item_id', itemId);
        showToast("Listing cancelled.", "error");
        closeListingModal();
    };
}


// --- FETCH & RENDER LOGIC ---
async function loadMarketplaceItems() {
    const grid = document.getElementById('marketplace-grid');
    
    grid.innerHTML = `
        <div class="animate-pulse bg-white rounded-2xl p-4 shadow-sm h-64 border border-gray-100"></div>
        <div class="animate-pulse bg-white rounded-2xl p-4 shadow-sm h-64 border border-gray-100"></div>
        <div class="animate-pulse bg-white rounded-2xl p-4 shadow-sm h-64 border border-gray-100 hidden md:block"></div>
        <div class="animate-pulse bg-white rounded-2xl p-4 shadow-sm h-64 border border-gray-100 hidden md:block"></div>
    `;
    
    let query = supabaseClient.from('marketplace_items')
        .select(`*, students (first_name, last_name, block, whatsapp_phone)`)
        .eq('status', 'active') // IMPORTANT: Hides pending items
        .order('is_promoted', { ascending: false }) 
        .order('created_at', { ascending: false }); 
        
    if (activeCategory !== 'All') {
        query = query.eq('category', activeCategory);
    }

    const { data: items, error } = await query;

    if (error) {
        grid.innerHTML = '<p class="col-span-full text-center text-red-500 py-10 font-bold">Failed to load marketplace.</p>';
        return;
    }

    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <i class="fas fa-box-open text-4xl mb-3"></i>
                <p class="font-bold">No items found.</p>
                <p class="text-xs">Be the first to list something in this category!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    items.forEach(item => {
        const seller = item.students;
        const borderClass = item.is_promoted ? 'border-ramGold border-2' : 'border-gray-200 border';
        const badgeHTML = item.is_promoted ? `<div class="absolute top-3 right-3 bg-yellow-100 text-yellow-800 text-[10px] font-black px-2 py-1 rounded shadow-sm z-10"><i class="fas fa-crown mr-1"></i> Promoted</div>` : '';
        
        const waMessage = encodeURIComponent(`Hi ${seller.first_name}, I saw your '${item.title}' on the RAM Portal for KES ${item.price}. Is it still available?`);
        const waLink = seller.whatsapp_phone ? `https://wa.me/${seller.whatsapp_phone.replace(/^0/, '254')}?text=${waMessage}` : '#';

        grid.innerHTML += `
            <div class="bg-white rounded-2xl p-4 shadow-sm h-full flex flex-col relative transition-transform hover:-translate-y-1 ${borderClass}">
                ${badgeHTML}
                <div class="h-40 bg-gray-100 rounded-xl mb-4 overflow-hidden flex items-center justify-center shrink-0 relative">
                    <img src="${item.image_url}" alt="${item.title}" class="w-full h-full object-cover">
                    <span class="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded backdrop-blur-sm uppercase font-bold">${item.category}</span>
                </div>
                
                <h3 class="font-bold text-gray-800 text-sm line-clamp-2">${item.title}</h3>
                <p class="text-xs text-gray-500 mt-1 flex-1 line-clamp-2">${item.description}</p>
                
                <div class="mt-4 flex items-center gap-2">
                    <img src="https://ui-avatars.com/api/?name=${seller.first_name}+${seller.last_name}&background=f3f4f6&color=374151" class="w-6 h-6 rounded-full border">
                    <p class="text-[10px] font-bold text-gray-500 truncate">${seller.first_name} - ${seller.block}</p>
                </div>
                
                <div class="mt-4 flex flex-col gap-2">
                    <span class="text-lg font-black text-gray-900">KES ${item.price.toLocaleString()}</span>
                    <a href="${waLink}" target="_blank" class="w-full bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center">
                        <i class="fab fa-whatsapp mr-2 text-lg"></i> Contact Seller
                    </a>
                </div>
            </div>
        `;
    });
}

function subscribeToMarketplace() {
    supabaseClient
        .channel('public:marketplace_items')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, payload => {
            loadMarketplaceItems(); 
        })
        .subscribe();
}

// --- UTILS ---
function showToast(msg, type) {
    const container = document.getElementById('toastContainer');
    container.classList.remove('hidden');
    
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