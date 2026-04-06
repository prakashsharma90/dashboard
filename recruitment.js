/**
 * Salarite Recruitment & ATS Logic
 */

// Supabase Configuration
const supabaseUrl = 'https://rrbbbhvethxtbvupolqo.supabase.co';
const supabaseKey = 'sb_publishable_5zK8zx6xnGkD_-QIoOGZAg_5uBOEVv2';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Data store
let atsData = {
    jobs: [],
    candidates: [],
    applications: [],
    interviews: []
};

// Initial Setup
$(document).ready(function() {
    initATS();
    setupKanban();
    setupFilters();
    setupTabNavigation();
    
    // AI Assistant Toggle
    $('#ai-assistant-btn').click(function() {
        $('#ai-chat-bubble').css('display', $('#ai-chat-bubble').css('display') === 'none' ? 'flex' : 'none');
    });
});

function setupTabNavigation() {
    $('.ats-tab').click(function() {
        const section = $(this).data('section');
        switchSection(section);
    });
}

function switchSection(sectionId) {
    $('.section-content').removeClass('active');
    $(`#section-${sectionId}`).addClass('active');
    
    $('.ats-tab').removeClass('active');
    $(`.ats-tab[data-section="${sectionId}"]`).addClass('active');

    // Update breadcrumb
    const tabName = $(`.ats-tab[data-section="${sectionId}"]`).text().trim();
    $('#active-breadcrumb').text(tabName);
}

async function initATS() {
    try {
        // Fetch Jobs
        const { data: jobs, error: jobErr } = await supabaseClient.from('jobs').select('*');
        const { data: candidates, error: candidateErr } = await supabaseClient.from('candidates').select('*');
        const { data: applications, error: appErr } = await supabaseClient.from('job_applications').select('*, jobs(*), candidates(*)');
        const { data: interviews, error: intErr } = await supabaseClient.from('interviews').select('*, job_applications(*, jobs(*), candidates(*))');

        atsData.jobs = jobs || [];
        atsData.candidates = candidates || [];
        atsData.applications = applications || [];
        atsData.interviews = interviews || [];

        // If no data, use mock data for demo
        if (atsData.jobs.length === 0) {
            useMockData();
        }

        renderJobManagementTab();
        renderPipelineKanban();
        renderCandidatesTable();
        renderInterviews();
        updateStats();

    } catch (e) {
        console.error('Error initializing ATS:', e);
    }
}

// Stats Update
function updateStats() {
    const openJobs = atsData.jobs.filter(j => j.status === 'Open').length;
    const totalApplicants = atsData.applications.length;
    const interviewsToday = atsData.interviews.length; // Simplified
    const hiredCount = atsData.applications.filter(a => a.stage === 'Hired').length;

    $('#stat-open-jobs').text(openJobs || 12);
    $('#stat-applicants').text(totalApplicants || 438);
    $('#stat-interviews').text(interviewsToday || 8);
    $('#stat-hired').text(hiredCount || 24);
}

// Pipeline Kanban Board Logic
function setupKanban() {
    const stages = [
        'Applied', 'Screening', 'Shortlisted', 'Interview Scheduled', 'Interviewed', 'Selected', 'Rejected', 'Offered', 'Hired'
    ];

    stages.forEach(stage => {
        const listId = `stage-${stage.toLowerCase().replace(/ /g, '-')}`;
        const el = document.getElementById(listId);
        if (!el) return;

        new Sortable(el, {
            group: 'pipeline',
            animation: 150,
            ghostClass: 'kanban-ghost',
            onEnd: function(evt) {
                const applicationId = evt.item.dataset.id;
                const newStage = evt.to.id.replace('stage-', '').replace(/-/g, ' ');
                // In a real app, update Supabase here
                updateApplicationStage(applicationId, newStage);
            }
        });
    });
}

function renderPipelineKanban() {
    const stages = [
        'Applied', 'Screening', 'Shortlisted', 'Interview Scheduled', 'Interviewed', 'Selected', 'Rejected', 'Offered', 'Hired'
    ];

    // Clear columns
    stages.forEach(stage => {
        const listId = `stage-${stage.toLowerCase().replace(/ /g, '-')}`;
        const col = $(`#${listId}`);
        if (col.length) {
            col.empty();
        }
    });

    atsData.applications.forEach(app => {
        const candidate = app.candidates || { full_name: 'John Doe', email: 'john@example.com', skills: [] };
        const job = app.jobs || { title: 'General Role' };
        
        const stageId = `stage-${app.stage.toLowerCase().replace(/ /g, '-')}`;
        const container = $(`#${stageId}`);
        
        if (container.length) {
            const card = createCandidateCard(app, candidate, job);
            container.append(card);
        }
    });

    // Update counts & handle empty states
    stages.forEach(stage => {
        const listId = `stage-${stage.toLowerCase().replace(/ /g, '-')}`;
        const col = $(`#${listId}`);
        if (!col.length) return;

        const count = col.find('.candidate-card').length;
        col.closest('.kanban-col').find('.kanban-count').text(count);

        if (count === 0 && !col.find('.kanban-empty').length) {
            col.append(`
                <div class="kanban-empty">
                    <i data-lucide="inbox"></i>
                    <p>No candidates here yet</p>
                </div>
            `);
        } else if (count > 0) {
            col.find('.kanban-empty').remove();
        }
    });

    lucide.createIcons();
}

function createCandidateCard(app, candidate, job) {
    const initials = candidate.full_name.split(' ').map(n => n[0]).join('');
    const ai_score = candidate.ai_score || Math.floor(Math.random() * 40) + 60;
    const scoreColor = ai_score > 85 ? '#059669' : ai_score > 70 ? '#2563eb' : '#d97706';
    
    // Skill chips (limit to 3)
    const skills = candidate.skills ? candidate.skills.slice(0, 3) : ['React', 'Node', 'UI'];
    const skillHTML = skills.map(s => `<span class="skill-chip">${s}</span>`).join('');
    
    // Status tag
    const tagClass = ai_score > 90 ? 'hot' : (Math.random() > 0.5 ? 'referred' : '');
    const tagLabel = ai_score > 90 ? 'HOT' : (tagClass === 'referred' ? 'REFERRED' : 'ACTIVE');

    return `
        <div class="candidate-card" data-id="${app.id}">
            <div class="candidate-card-top" onclick="openCandidateModal('${app.id}')" style="cursor: pointer;">
                <div class="candidate-info">
                    <div class="candidate-avatar">${initials}</div>
                    <div class="candidate-details">
                        <h4>${candidate.full_name}</h4>
                        <p>${job.title}</p>
                    </div>
                </div>
                <div class="card-tag ${tagClass}">${tagLabel}</div>
            </div>

            <div class="skill-chips">
                ${skillHTML}
                ${candidate.skills && candidate.skills.length > 3 ? `<span class="skill-chip">+${candidate.skills.length - 3}</span>` : ''}
            </div>

            <div class="candidate-stats">
                <div class="c-stat-box" style="border-right: 1px solid #f1f5f9; padding-right: 8px;">
                    <span>Expected</span>
                    <b>₹${(candidate.expected_salary || '12L').toLocaleString()}</b>
                </div>
                <div class="c-stat-box" style="padding-left: 8px;">
                    <span>Experience</span>
                    <b>${candidate.experience_years || '0'}+ Yrs</b>
                </div>
            </div>

            <div class="ai-score" style="background: ${scoreColor}15; color: ${scoreColor}; margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: 1px solid ${scoreColor}30;">
                <i data-lucide="zap" style="width:14px; height: 14px; fill: ${scoreColor};"></i> Match: ${ai_score}%
            </div>

            <div class="candidate-footer" style="padding-top: 10px; border-top: 1px dashed #f1f5f9; margin-top: 10px;">
                <div class="preview-btn" onclick="openCandidateModal('${app.id}')">
                    <i data-lucide="eye" style="width:14px;"></i> Preview
                </div>
                <div class="time-ago">
                    <i data-lucide="clock" style="width:12px;"></i> 2h ago
                </div>
            </div>
        </div>
    `;
}

// Job Management Logic
function renderJobManagementTab() {
    const container = $('#job-list-container');
    container.empty();

    atsData.jobs.forEach(job => {
        container.append(`
            <div class="job-card">
                <div class="job-main">
                    <div class="job-icon"><i data-lucide="briefcase"></i></div>
                    <div class="job-title-group">
                        <h3>${job.title}</h3>
                        <p>${job.department} • ${job.location} • ${job.employment_type}</p>
                        <div class="job-tags">
                            <span class="status-badge status-active" style="display:inline-block;">${job.status}</span>
                            <span class="premium-pill" style="display:inline-block;">${job.openings_count} Openings</span>
                        </div>
                    </div>
                </div>
                <div class="job-stats">
                    <div class="job-stat-box">
                        <h5>${Math.floor(Math.random() * 100) + 50}</h5>
                        <p>Total Apps</p>
                    </div>
                    <div class="job-stat-box">
                        <h5>${Math.floor(Math.random() * 20) + 5}</h5>
                        <p>Shortlisted</p>
                    </div>
                    <div class="action-btns" style="margin-left: 40px;">
                        <button class="btn-icon" title="Edit"><i data-lucide="edit-3"></i></button>
                        <button class="btn-icon" title="View Public Page"><i data-lucide="external-link"></i></button>
                    </div>
                </div>
            </div>
        `);
    });
    lucide.createIcons();
}

// Candidate Table Logic
function renderCandidatesTable() {
    const tbody = $('#candidates-table-body');
    tbody.empty();

    atsData.candidates.forEach(c => {
        const score = c.ai_score || Math.floor(Math.random() * 40) + 60;
        const color = score > 85 ? 'green' : 'blue';
        
        tbody.append(`
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:36px; height:36px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-weight:700; color:#4D4286;">${c.full_name[0]}</div>
                        <div>
                            <div style="font-weight:700; color:var(--ats-text);">${c.full_name}</div>
                            <div style="font-size:0.75rem; color:var(--ats-text-muted);">${c.email}</div>
                        </div>
                    </div>
                </td>
                <td>Senior Product Designer</td>
                <td>${c.experience_years} Years</td>
                <td>${(c.skills || []).slice(0,3).join(', ')}</td>
                <td><span class="status-badge" style="background:#f0f9ff; color:#0369a1;">${score}% Match</span></td>
                <td><span class="status-badge status-active">Active</span></td>
                <td>
                    <button class="btn-icon" onclick="openCandidateModal('${c.id}')"><i data-lucide="eye"></i></button>
                </td>
            </tr>
        `);
    });

    if ($.fn.DataTable.isDataTable('#candidates-table')) {
        $('#candidates-table').DataTable().destroy();
    }
    $('#candidates-table').DataTable({
        paging: true,
        searching: true,
        info: false,
        lengthChange: false,
        pageLength: 10,
        language: { search: "", searchPlaceholder: "Search pool..." }
    });
    lucide.createIcons();
}

// Interview Management
function renderInterviews() {
    const container = $('#interviews-container');
    container.empty();

    const mockInterviews = [
        { name: 'Sarah Wilson', time: '10:00 AM', role: 'Design Lead', type: 'Online (Zoom)' },
        { name: 'David Smith', time: '11:30 AM', role: 'Frontend Eng', type: 'Telephonic' },
        { name: 'Michael Brown', time: '02:00 PM', role: 'DevOps', type: 'In-person' },
        { name: 'Emily Davis', time: '04:15 PM', role: 'HR Manager', type: 'Online (GMeet)' }
    ];

    mockInterviews.forEach(int => {
        container.append(`
            <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;">
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div style="background: #f5f3ff; color: #4D4286; padding: 10px; border-radius: 10px; font-weight: 800; text-align: center; min-width: 60px;">
                        <span style="display: block; font-size: 0.65rem;">TIME</span>
                        ${int.time.split(' ')[0]}
                    </div>
                    <div>
                        <h4 style="font-size: 0.95rem; margin: 0;">${int.name}</h4>
                        <p style="font-size: 0.8rem; color: #64748b; margin: 4px 0 0;">${int.role} • ${int.type}</p>
                    </div>
                </div>
                <button class="btn-ats-primary" style="padding: 8px 16px; font-size: 0.8rem; border-radius: 8px;">Join Meeting</button>
            </div>
        `);
    });
}

// Logic: Status Updates
async function updateApplicationStage(appId, stage) {
    console.log(`Updating ${appId} to stage ${stage}`);
    try {
        const { error } = await supabaseClient
            .from('job_applications')
            .update({ stage: stage })
            .eq('id', appId);
        
        if (error) {
            // Probably mock data, just update local state
            const app = atsData.applications.find(a => a.id == appId);
            if (app) app.stage = stage;
        }
        updateStats();
    } catch (e) {
        console.error('Update error:', e);
    }
}

// Mock Data for Demo
function useMockData() {
    const mockJobs = [
        { id: 'j1', title: 'Senior React Developer', department: 'Engineering', location: 'Remote', employment_type: 'Full-time', status: 'Open', openings_count: 2 },
        { id: 'j2', title: 'UX Designer', department: 'Product', location: 'Hybrid', employment_type: 'Full-time', status: 'Open', openings_count: 1 },
        { id: 'j3', title: 'HR Specialist', department: 'HR', location: 'Onsite', employment_type: 'Full-time', status: 'Draft', openings_count: 1 },
        { id: 'j4', title: 'Backend Engineer (Go)', department: 'Engineering', location: 'Remote', employment_type: 'Contract', status: 'Open', openings_count: 3 },
        { id: 'j5', title: 'Marketing Lead', department: 'Marketing', location: 'Onsite', employment_type: 'Full-time', status: 'Open', openings_count: 1 }
    ];

    const mockCandidates = [
        { id: 'c1', full_name: 'John Doe', email: 'john@gmail.com', experience_years: 5, skills: ['React', 'Node', 'TypeScript'], current_location: 'Mumbai', ai_score: 92 },
        { id: 'c2', full_name: 'Alice Cooper', email: 'alice@yahoo.com', experience_years: 8, skills: ['Figma', 'UX Research'], current_location: 'Delhi', ai_score: 88 },
        { id: 'c3', full_name: 'Bob Marley', email: 'bob@gmail.com', experience_years: 3, skills: ['Go', 'Docker', 'AWS'], current_location: 'Remote', ai_score: 75 },
        { id: 'c4', full_name: 'Charlie Chaplin', email: 'charlie@outlook.com', experience_years: 12, skills: ['Human Resources', 'Payroll'], current_location: 'Bangalore', ai_score: 95 }
    ];

    const mockApps = [
        { id: 'app1', job_id: 'j1', candidate_id: 'c1', stage: 'Applied', candidates: mockCandidates[0], jobs: mockJobs[0] },
        { id: 'app2', job_id: 'j1', candidate_id: 'c2', stage: 'Screening', candidates: mockCandidates[1], jobs: mockJobs[0] },
        { id: 'app3', job_id: 'j2', candidate_id: 'c3', stage: 'Shortlisted', candidates: mockCandidates[2], jobs: mockJobs[1] },
        { id: 'app4', job_id: 'j4', candidate_id: 'c4', stage: 'Interview Scheduled', candidates: mockCandidates[3], jobs: mockJobs[3] }
    ];

    atsData.jobs = mockJobs;
    atsData.candidates = mockCandidates;
    atsData.applications = mockApps;
}

// Helpers
function openCandidateModal(id) {
    const app = atsData.applications.find(a => a.id == id);
    if (!app) return;
    const c = app.candidates;
    
    $('#candidate-modal-title').text(c.full_name);
    $('#candidate-modal-content').html(`
        <div style="display:flex; gap:32px;">
            <div style="flex: 1.5; display: flex; flex-direction: column; gap: 24px;">
                <!-- Profile Summary -->
                <div style="background: white; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0;">
                    <h4 style="margin-bottom:16px; font-size:0.85rem; color:#64748b; font-weight:800; letter-spacing:0.5px;">PERSONAL INFORMATION</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div><span style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">EMAIL</span><b>${c.email}</b></div>
                        <div><span style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">LOCATION</span><b>${c.current_location}</b></div>
                        <div><span style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">EXPECTED CTC</span><b>₹${candidate.expected_salary || '12,00,000'} PA</b></div>
                        <div><span style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">NOTICE PERIOD</span><b>15 Days (Immediate)</b></div>
                    </div>
                    
                    <h4 style="margin-top:24px; margin-bottom:12px; font-size:0.85rem; color:#64748b; font-weight:800;">SKILLS & EXPERTISE</h4>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${(c.skills || []).map(s => `<span class="skill-chip">${s}</span>`).join('')}
                    </div>
                </div>

                <!-- Activity Timeline -->
                <div style="background: white; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0;">
                    <h4 style="margin-bottom:16px; font-size:0.85rem; color:#64748b; font-weight:800;">CANDIDATE JOURNEY</h4>
                    <div style="display:flex; flex-direction:column; gap:16px; position:relative; padding-left: 20px;">
                        <div style="position:absolute; left:0; top:5px; bottom:5px; width:2px; background:#e2e8f0;"></div>
                        <div style="position:relative;">
                            <div style="position:absolute; left:-24px; top:4px; width:10px; height:10px; border-radius:50%; background:#10b981; border:3px solid white;"></div>
                            <b style="font-size:0.8rem;">Shortlisted by HR</b>
                            <p style="font-size:0.7rem; color:#64748b; margin:2px 0;">"Exhibits strong React fundamentals." • 2h ago</p>
                        </div>
                        <div style="position:relative;">
                            <div style="position:absolute; left:-24px; top:4px; width:10px; height:10px; border-radius:50%; background:#4D4286; border:3px solid white;"></div>
                            <b style="font-size:0.8rem;">Applied via LinkedIn</b>
                            <p style="font-size:0.7rem; color:#64748b; margin:2px 0;">Automatically parsed into database. • yesterday</p>
                        </div>
                    </div>
                </div>

                <!-- Collaboration / Comments -->
                <div style="background: white; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0;">
                    <h4 style="margin-bottom:16px; font-size:0.85rem; color:#64748b; font-weight:800;">TEAM FEEDBACK</h4>
                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 16px;" id="candidate-comments">
                        <div style="background:#f8fafc; padding:12px; border-radius:12px; font-size:0.8rem;">
                            <b>@SeniorHR:</b> Great communication skills during screening.
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <input type="text" placeholder="Add a comment..." style="flex:1; padding:10px 14px; border:1px solid #e2e8f0; border-radius:12px; font-size:0.85rem;">
                        <button class="btn-ats-primary" style="padding:10px 20px; border-radius:12px;">Post</button>
                    </div>
                </div>
            </div>

            <!-- AI Sidebar -->
            <div style="width:320px; flex-shrink:0;">
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 24px; padding: 28px; color: white; box-shadow: 0 20px 40px rgba(0,0,0,0.15);">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom: 24px;">
                        <div style="background:rgba(255,255,255,0.1); padding:8px; border-radius:10px;"><i data-lucide="zap" style="color:#fbbf24;"></i></div>
                        <h4 style="margin:0; font-size:0.9rem; font-weight:800; letter-spacing:0.5px;">AI MATCH ANALYSIS</h4>
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <div style="font-size:3.5rem; font-weight:950; letter-spacing:-2px; line-height: 1;">${c.ai_score}%</div>
                        <p style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top: 10px;">Candidate matches <b>Tier-1</b> core requirements.</p>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:14px; margin-bottom: 24px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.75rem; opacity:0.6;">Skills Match</span>
                            <span style="font-weight:700; color:#10b981;">85%</span>
                        </div>
                        <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px;"><div style="width:85%; height:100%; background:#10b981; border-radius:10px;"></div></div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.75rem; opacity:0.6;">Experience Depth</span>
                            <span style="font-weight:700; color:#fbbf24;">70%</span>
                        </div>
                        <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px;"><div style="width:70%; height:100%; background:#fbbf24; border-radius:10px;"></div></div>
                    </div>

                    <button class="btn-ats" style="width:100%; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; font-size:0.85rem; padding: 14px;">
                        <i data-lucide="file-text"></i> Full Resume Analysis
                    </button>
                    
                    <button class="btn-ats-primary" style="width:100%; margin-top:12px; padding: 14px; background: white; color: var(--ats-primary);">
                        Schedule Final Round
                    </button>
                </div>
                
                <div style="margin-top: 24px; padding: 24px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 20px;">
                    <div style="display:flex; align-items:center; gap:10px; color:#ef4444; margin-bottom: 8px;">
                        <i data-lucide="alert-circle" style="width:14px;"></i>
                        <b style="font-size:0.75rem; text-transform:uppercase;">Internal Warning</b>
                    </div>
                    <p style="font-size:0.75rem; color:#991b1b; line-height:1.4;">Expected salary is 15% above allocated budget for this role.</p>
                </div>
            </div>
        </div>
    `);
    
    $('#candidate-modal').css('display', 'flex');
    lucide.createIcons();
}

function closeCandidateModal() {
    $('#candidate-modal').hide();
}

function setupFilters() {
    // Basic search filtering logic can be added here
}
