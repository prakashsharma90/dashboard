const supabaseUrl = 'https://rrbbbhvethxtbvupolqo.supabase.co';
const supabaseKey = 'sb_publishable_5zK8zx6xnGkD_-QIoOGZAg_5uBOEVv2';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

function showToast(message, type = 'success') {
    const toaster = document.getElementById('toaster');
    if (!toaster) return;
    toaster.textContent = message;
    toaster.className = `toaster show ${type}`;
    setTimeout(() => { toaster.className = 'toaster'; }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. ACTIVATE ACCOUNT (/activate-account.html) ---
    const activateForm = document.getElementById('activate-form');
    if (activateForm) {
        // Handle when user arrives with invite link via Supabase Auth
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && (window.location.hash.includes('type=invite') || window.location.hash.includes('type=signup')))) {
                document.getElementById('welcome-text').innerText = 'Approve your account! Please set a new permanent password.';
            }
        });

        activateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-activate');
            const newPwd = document.getElementById('new-password').value;
            const confirmPwd = document.getElementById('confirm-password').value;

            if (newPwd !== confirmPwd) {
                document.getElementById('pwd-error').style.display = 'block';
                return;
            }
            document.getElementById('pwd-error').style.display = 'none';

            btn.disabled = true;
            btn.innerHTML = 'Saving...';

            const { data, error } = await supabaseClient.auth.updateUser({ password: newPwd });

            if (error) {
                showToast(error.message, 'error');
                btn.disabled = false;
                btn.innerHTML = 'Save & Continue';
            } else {
                showToast('Password set successfully! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            }
        });
    }

    // --- 2. LOGIN FLOW (/login.html) ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-login');
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            btn.disabled = true;
            btn.innerHTML = 'Authenticating...';

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                showToast(error.message, 'error');
                btn.disabled = false;
                btn.innerHTML = 'Login';
                return;
            }

            // Verify Profile Status and Role
            const user = data.user;
            const { data: empData, error: empErr } = await supabaseClient
                .from('employees')
                .select('profile_completed, role')
                .eq('user_id', user.id)
                .single();

            if (empData && empData.profile_completed === true) {
                showToast('Welcome back! Logging in...');
                setTimeout(() => {
                    if (empData.role === 'employer' || empData.role === 'admin') {
                        window.location.href = 'employer-dashboard.html';
                    } else {
                        window.location.href = 'employee-dashboard.html';
                    }
                }, 1000);
            } else {
                showToast('First time here? Redirecting to setup...');
                setTimeout(() => { window.location.href = 'complete-profile.html'; }, 1000);
            }
        });
    }

    // --- 3. COMPLETE PROFILE (/complete-profile.html) ---
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        // Enforce Session Access
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        const userId = session.user.id;

        // Helper: safe set value
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        const setRadio = (name, val) => { const r = document.querySelector(`input[name="${name}"][value="${val}"]`); if (r) r.checked = true; };
        const setSelect = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

        // Auto-fill existing fields from DB
        const { data: empData } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (empData) {
            document.getElementById('welcome-heading').innerText = `Welcome, ${empData.first_name || 'there'}!`;
            // Section 1: Basic Info
            setVal('p-emp-id', empData.emp_id);
            setVal('p-full-name', `${empData.first_name || ''} ${empData.last_name || ''}`.trim());
            setVal('p-email', session.user.email);
            setVal('p-phone', empData.contact_number);
            setRadio('gender', empData.gender);
            setVal('p-dob', empData.date_of_birth);
            setSelect('p-marital-status', empData.marital_status);
            // Section 2: Address
            setVal('c-addr-line1', empData.current_address_line1);
            setVal('c-addr-line2', empData.current_address_line2);
            setVal('c-pincode', empData.current_pincode);
            setVal('c-city', empData.current_city);
            setVal('c-state', empData.current_state);
            setVal('p-addr-line1', empData.permanent_address_line1);
            setVal('p-addr-line2', empData.permanent_address_line2);
            setVal('p-pincode', empData.permanent_pincode);
            setVal('p-city', empData.permanent_city);
            setVal('p-state', empData.permanent_state);
            // Section 3: Employment
            setVal('e-dept', empData.department);
            setVal('e-designation', empData.designation);
            setVal('e-manager', empData.reporting_manager);
            setSelect('e-type', empData.employment_type);
            setVal('e-doj', empData.joining_date);
            setVal('e-location', empData.work_location);
            // Section 4: Bank
            setVal('b-name', empData.bank_name);
            setVal('b-holder', empData.bank_holder_name);
            setVal('b-acc', empData.bank_account_number);
            setVal('b-ifsc', empData.bank_ifsc);
            setVal('b-branch', empData.bank_branch);
            // Section 5: Emergency
            setVal('em-name', empData.emergency_contact_name);
            setVal('em-rel', empData.emergency_contact_relationship);
            setVal('em-phone', empData.emergency_contact_number);
        }

        // Helper: Upload a single file to Supabase Storage
        async function uploadFile(file, folder) {
            // Sanitize filename: replace spaces and special chars
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${Date.now()}_${safeName}`;
            const filePath = `${folder}/${fileName}`;
            const { data, error } = await supabaseClient.storage
                .from('employee-documents')
                .upload(filePath, file, { upsert: true });
            if (error) { console.error('Upload error:', error); return null; }
            const { data: urlData } = supabaseClient.storage
                .from('employee-documents')
                .getPublicUrl(filePath);
            return urlData?.publicUrl || null;
        }

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.submitter || profileForm.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Uploading & Saving...</span>';
                btn.dataset.original = originalText;
            }

            // Use userId (UUID) for folder — it's always URL-safe
            const empFolder = userId;

            // Upload documents
            const aadhaarFile = document.getElementById('doc-aadhaar')?.files[0];
            const panFile = document.getElementById('doc-pan')?.files[0];
            const resumeFile = document.getElementById('doc-resume')?.files[0];
            const photoFile = document.getElementById('doc-photo')?.files[0];
            const offerFile = document.getElementById('doc-offer')?.files[0];
            const educationFiles = document.getElementById('doc-education')?.files;
            const employmentFiles = document.getElementById('doc-employment')?.files;

            const [aadhaarUrl, panUrl, resumeUrl, photoUrl, offerUrl] = await Promise.all([
                aadhaarFile ? uploadFile(aadhaarFile, `${empFolder}/aadhaar`) : Promise.resolve(empData?.doc_aadhaar_url || null),
                panFile ? uploadFile(panFile, `${empFolder}/pan`) : Promise.resolve(empData?.doc_pan_url || null),
                resumeFile ? uploadFile(resumeFile, `${empFolder}/resume`) : Promise.resolve(empData?.doc_resume_url || null),
                photoFile ? uploadFile(photoFile, `${empFolder}/photo`) : Promise.resolve(empData?.doc_photo_url || null),
                offerFile ? uploadFile(offerFile, `${empFolder}/offer`) : Promise.resolve(empData?.doc_offer_url || null)
            ]);

            let educationUrls = empData?.doc_education_urls || [];
            if (educationFiles && educationFiles.length > 0) {
                const uploads = await Promise.all(Array.from(educationFiles).map(f => uploadFile(f, `${empFolder}/education`)));
                educationUrls = uploads.filter(u => u !== null);
            }
            let employmentUrls = empData?.doc_employment_urls || [];
            if (employmentFiles && employmentFiles.length > 0) {
                const uploads = await Promise.all(Array.from(employmentFiles).map(f => uploadFile(f, `${empFolder}/employment`)));
                employmentUrls = uploads.filter(u => u !== null);
            }

            const updates = {
                // Basic Info
                contact_number: document.getElementById('p-phone')?.value || '',
                date_of_birth: document.getElementById('p-dob')?.value || null,
                gender: document.querySelector('input[name="gender"]:checked')?.value || null,
                marital_status: document.getElementById('p-marital-status')?.value || null,
                // Current Address
                current_address_line1: document.getElementById('c-addr-line1')?.value || '',
                current_address_line2: document.getElementById('c-addr-line2')?.value || '',
                current_pincode: document.getElementById('c-pincode')?.value || '',
                current_city: document.getElementById('c-city')?.value || '',
                current_state: document.getElementById('c-state')?.value || '',
                // Permanent Address
                permanent_address_line1: document.getElementById('p-addr-line1')?.value || '',
                permanent_address_line2: document.getElementById('p-addr-line2')?.value || '',
                permanent_pincode: document.getElementById('p-pincode')?.value || '',
                permanent_city: document.getElementById('p-city')?.value || '',
                permanent_state: document.getElementById('p-state')?.value || '',
                // Employment Info
                department: document.getElementById('e-dept')?.value || '',
                designation: document.getElementById('e-designation')?.value || '',
                reporting_manager: document.getElementById('e-manager')?.value || '',
                employment_type: document.getElementById('e-type')?.value || '',
                work_location: document.getElementById('e-location')?.value || '',
                // Bank Details
                bank_name: document.getElementById('b-name')?.value || '',
                bank_holder_name: document.getElementById('b-holder')?.value || '',
                bank_account_number: document.getElementById('b-acc')?.value || '',
                bank_ifsc: document.getElementById('b-ifsc')?.value || '',
                bank_branch: document.getElementById('b-branch')?.value || '',
                // Emergency Contact
                emergency_contact_name: document.getElementById('em-name')?.value || '',
                emergency_contact_relationship: document.getElementById('em-rel')?.value || '',
                emergency_contact_number: document.getElementById('em-phone')?.value || '',
                // Document URLs
                doc_aadhaar_url: aadhaarUrl,
                doc_pan_url: panUrl,
                doc_resume_url: resumeUrl,
                doc_photo_url: photoUrl,
                doc_offer_url: offerUrl,
                doc_education_urls: educationUrls,
                doc_employment_urls: employmentUrls,
                // Legacy combined fields (for backwards compat)
                address: `${document.getElementById('c-addr-line1')?.value || ''}, ${document.getElementById('c-city')?.value || ''}, ${document.getElementById('c-state')?.value || ''} - ${document.getElementById('c-pincode')?.value || ''}`,
                bank_details: `${document.getElementById('b-name')?.value || ''} | A/C: ${document.getElementById('b-acc')?.value || ''} | IFSC: ${document.getElementById('b-ifsc')?.value || ''}`,
                emergency_contact: `${document.getElementById('em-name')?.value || ''} (${document.getElementById('em-rel')?.value || ''}) - ${document.getElementById('em-phone')?.value || ''}`,
                profile_photo_url: photoUrl || empData?.profile_photo_url || '',
                // Status
                verification_status: 'Pending'
            };

            const { error: updateErr } = await supabaseClient
                .from('employees')
                .update(updates)
                .eq('user_id', userId)
                .select('role')
                .single();

            if (updateErr) {
                showToast(updateErr.message, 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = btn.dataset.original || 'Save';
                }
            } else {
                showToast('Profile completed beautifully! Launching dashboard...');

                // Fetch to determine where to redirect after a successful first-time completion
                let targetDashboard = 'employee-dashboard.html';
                const { data: finalEmpData } = await supabaseClient
                    .from('employees').select('role').eq('user_id', userId).single();
                if (finalEmpData && (finalEmpData.role === 'employer' || finalEmpData.role === 'admin')) {
                    targetDashboard = 'employer-dashboard.html';
                }

                setTimeout(() => {
                    window.location.href = targetDashboard;
                }, 1500);
            }
        });
    }
});
