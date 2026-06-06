// خنثی کردن آلرت خام مرورگر و تبدیل خودکار آن به توست کهکشانی
window.alert = function(message) {
    if (typeof showFloatingToast === 'function') {
        showFloatingToast(message, "warning");
    } else {
        // اگر toast هنوز آماده نیست، بعد از کمی تأخیر دوباره تلاش می‌کنیم
        setTimeout(() => {
            if (typeof showFloatingToast === 'function') {
                showFloatingToast(message, "warning");
            }
        }, 1500);
    }
};

const SUPABASE_URL = "https://rzvuvrfrkbsthzzimbce.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_La0ndqo_3bHPHl-HKXtkBw_aZ74Kip2";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loggedInUser = localStorage.getItem('loggedInUser') || 'guest';
let hiddenFolderIds = JSON.parse(localStorage.getItem(`hiddenFolderIds_${loggedInUser}`)) || [];

document.addEventListener('DOMContentLoaded', async () => {
    const userRole = localStorage.getItem('userRole');
    const welcomeMessage = document.getElementById('welcomeMessage');

    if (!userRole) { window.location.href = 'index.html'; return; }
// ۱. ثبت خودکار زمان بازدید فعلی کاربر در دیتابیس سوبابیس
    if (loggedInUser && loggedInUser !== 'guest') {
        const now = new Date();
        const currentVisitString = now.toLocaleDateString('fa-IR') + ' - ساعت ' + now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        
        // آپدیت فیلد last_visit در جدول project_users
        await supabaseClient
            .from('project_users')
            .update({ last_visit: currentVisitString })
            .eq('username', loggedInUser);
    }

    if (userRole === 'admin') {
        welcomeMessage.textContent = '👑 پنل مدیریت کل جام جهانی';
        document.querySelectorAll('.admin-only').forEach(f => f.style.display = 'block');
        initAdminFeatures();
    } else {
        welcomeMessage.textContent = `⚽ پیش‌بینی | خوش آمدید ${loggedInUser}`;
        document.querySelectorAll('.admin-only').forEach(f => f.style.display = 'none');
    }

    // اجرای تابع اصلی لود داده‌ها
    fetchAndRenderContent();

    function initAdminFeatures() {
        const userListWrapper = document.getElementById('userListWrapper');
        
        async function fetchUsers() {
            userListWrapper.innerHTML = 'بارگذاری کاربران...';
            const { data: users } = await supabaseClient.from('project_users').select('*').order('id', {ascending: true});
            userListWrapper.innerHTML = '';
            users?.forEach(u => {
                const row = document.createElement('div');
                row.className = 'user-mobile-row';
                row.innerHTML = `
                    <div class="user-info"><span class="u-name">${u.username}</span><span class="u-pass">🔑 ${u.password}</span></div>
                    <div class="action-icons-group">
                        <button class="btn-icon-edit" onclick="editUserPass(${u.id}, '${u.username}', '${u.password}')">ویرایش</button>
                        <button class="btn-icon-delete" onclick="deleteUser(${u.id})">حذف</button>
                    </div>
                `;
                userListWrapper.appendChild(row);
            });
        }
        
        document.getElementById('addUserBtn').addEventListener('click', async () => {
            const username = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('newUserPassword').value.trim();
            if(username && password) {
                await supabaseClient.from('project_users').insert([{username, password}]);
                document.getElementById('newUsername').value = '';
                document.getElementById('newUserPassword').value = '';
                fetchUsers();
            }
        });

        window.deleteUser = async (id) => { if(confirm('کاربر حذف شود؟')) { await supabaseClient.from('project_users').delete().eq('id', id); fetchUsers(); } };
        window.editUserPass = async (id, name, pass) => { const n = prompt(`رمز جدید ${name}:`, pass); if(n) { await supabaseClient.from('project_users').update({password: n}).eq('id', id); fetchUsers(); } };
        fetchUsers();

        const teamsContainer = document.getElementById('teamsContainer');
        async function fetchTeams() {
            const { data: teams } = await supabaseClient.from('teams').select('*').order('name');
            teamsContainer.innerHTML = '';
            const homeSel = document.getElementById('matchHomeSelect');
            const awaySel = document.getElementById('matchAwaySelect');
            if(homeSel && awaySel) {
                homeSel.innerHTML = '<option value="">تیم میزبان...</option>';
                awaySel.innerHTML = '<option value="">تیم میهمان...</option>';
                
                teams?.forEach(t => {
                    const chip = document.createElement('div');
                    chip.className = 'team-chip';
                    chip.innerHTML = `<span>${t.name}</span><span class="btn-chip-delete" onclick="deleteTeam(${t.id})">×</span>`;
                    teamsContainer.appendChild(chip);

                    homeSel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                    awaySel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                });
            }
        }

        window.deleteTeam = async (id) => { if(confirm('با حذف تیم، تمام بازی‌های مرتبط با آن نیز پاک خواهند شد. موافقید؟')) { await supabaseClient.from('teams').delete().eq('id', id); fetchTeams(); fetchAndRenderContent(); } };
        fetchTeams();
// فعال‌سازی دکمه ثبت تیم جدید
document.getElementById('addTeamBtn').addEventListener('click', async () => {
    const teamName = document.getElementById('teamNameInput').value.trim();
    
    if (teamName) {
        const { error } = await supabaseClient
            .from('teams')
            .insert([{ name: teamName }]);
        
        if (!error) {
            document.getElementById('teamNameInput').value = ''; // خالی کردن باکس متن
            fetchTeams(); // به‌روزرسانی لیست چیپ‌های تیم‌ها
            fetchAndRenderContent(); // به‌روزرسانی لیست کشویی بازی‌ها
            alert(`تیم "${teamName}" با موفقیت ثبت شد.`);
        } else {
            alert("خطا در ثبت تیم: " + error.message);
        }
    } else {
        alert('لطفاً نام تیم را وارد کنید.');
    }
});

        document.getElementById('addFolderBtn').addEventListener('click', async () => {
            const name = document.getElementById('folderNameInput').value.trim();
            if(name) { await supabaseClient.from('folders').insert([{name}]); document.getElementById('folderNameInput').value=''; fetchAndRenderContent(); }
        });

        document.getElementById('addMatchBtn').addEventListener('click', async () => {
            const folder_id = document.getElementById('matchFolderSelect').value;
            const team_home_id = document.getElementById('matchHomeSelect').value;
            const team_away_id = document.getElementById('matchAwaySelect').value;
            const match_date = document.getElementById('matchDateInput').value; 
            const match_time = document.getElementById('matchTimeInput').value; 

            if(folder_id && team_home_id && team_away_id && match_date && match_time) {
                const { error } = await supabaseClient.from('matches').insert([{
                    folder_id, 
                    team_home_id, 
                    team_away_id,
                    match_date,
                    match_time
                }]);
                
                if(!error) {
                    document.getElementById('matchDateInput').value = '';
                    document.getElementById('matchTimeInput').value = '';
                    fetchAndRenderContent();
                } else {
                    alert("خطا در ثبت مسابقه: " + error.message);
                }
            } else { 
                alert('لطفاً تمامی فیلدهای بازی از جمله تاریخ و ساعت را انتخاب کنید.'); 
            }
        });
    }

    window.saveScore = async (matchId) => {
        const homeVal = document.getElementById(`home-input-${matchId}`).value.trim();
        const awayVal = document.getElementById(`away-input-${matchId}`).value.trim();

        if(homeVal === "" || awayVal === "") {
            alert("لطفاً نتایج هر دو تیم را وارد کنید.");
            return;
        }

        const home_score = parseInt(homeVal, 10);
        const away_score = parseInt(awayVal, 10);

        const { error } = await supabaseClient
            .from('matches')
            .update({ home_score, away_score })
            .eq('id', matchId);

        if (!error) {
            alert("نتیجه مسابقه با موفقیت در دیتابیس ثبت شد.");
            fetchAndRenderContent();
        } else {
            alert("خطا در ثبت اطلاعات: " + error.message);
        }
    };

    window.toggleEditScore = (matchId) => {
        const homeInput = document.getElementById(`home-input-${matchId}`);
        const awayInput = document.getElementById(`away-input-${matchId}`);
        const actionBtnZone = document.getElementById(`action-zone-${matchId}`);

        if(homeInput && awayInput) {
            homeInput.disabled = false;
            awayInput.disabled = false;
            homeInput.focus();
        }

        const userRole = localStorage.getItem('userRole');
        if (actionBtnZone) {
            if (userRole === 'admin') {
                actionBtnZone.innerHTML = `<button class="btn-score-submit" onclick="saveScore(${matchId})">💾 ذخیره تغییرات</button>`;
            } else {
                actionBtnZone.innerHTML = `<button class="btn-score-submit" onclick="saveUserPrediction(${matchId})">💾 ذخیره تغییرات پیش‌بینی</button>`;
            }
        }
    };

    // تابع فچ و رندر بدون خطا و امن
    async function fetchAndRenderContent() {
        const displayFoldersContainer = document.getElementById('displayFoldersContainer');
        if (!displayFoldersContainer) return;
        
        displayFoldersContainer.innerHTML = '<p style="text-align:center; color:#8a8f98;">در حال به‌روزرسانی داده‌ها...</p>';

        try {
            const { data: folders } = await supabaseClient.from('folders').select('*').order('id', {ascending: true});
            const { data: matches } = await supabaseClient.from('matches').select('*').order('id', {ascending: true});
            const { data: teams } = await supabaseClient.from('teams').select('*');
            const { data: userPredictions } = await supabaseClient.from('predictions').select('*').eq('username', loggedInUser);

            const matchFolderSelect = document.getElementById('matchFolderSelect');
            if (matchFolderSelect) {
                matchFolderSelect.innerHTML = '<option value="">انتخاب پوشه...</option>';
                folders?.forEach(f => {
                    matchFolderSelect.innerHTML += `<option value="${f.id}">${f.name}</option>`;
                });
            }

            displayFoldersContainer.innerHTML = '';

            if (!folders || folders.length === 0) {
                displayFoldersContainer.innerHTML = '<p style="text-align:center; color:#ffcc00;">هیچ پوشه‌ای تعریف نشده است.</p>';
                return;
            }

            const teamsMap = {};
            teams?.forEach(t => { teamsMap[t.id] = t.name; });

            folders.forEach(folder => {
                const isHidden = hiddenFolderIds.includes(folder.id);
                
                const folderBox = document.createElement('div');
                folderBox.className = 'folder-box';
                
                const adminFolderBtns = userRole === 'admin' ? `
                    <div style="display:flex; gap:5px;">
                        <button class="btn-icon-edit" style="padding:4px 8px;" onclick="editFolder(${folder.id}, '${folder.name}')">✏️</button>
                        <button class="btn-icon-delete" style="padding:4px 8px;" onclick="deleteFolder(${folder.id})">🗑️</button>
                    </div>
                ` : '';

                folderBox.innerHTML = `
                    <div class="folder-header">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="folder-title">📁 ${folder.name}</span>
                            ${adminFolderBtns}
                        </div>
                        <button class="btn-score-edit ${isHidden ? 'collapsed' : ''}" onclick="toggleFolderVisibility(${folder.id}, this)">
                            ${isHidden ? '👁️ نمایش' : '🙈 مخفی‌سازی'}
                        </button>
                    </div>
                    <div class="match-list-wrapper" id="f-list-${folder.id}" style="display: ${isHidden ? 'none' : 'block'};"></div>
                `;

                displayFoldersContainer.appendChild(folderBox);
                const mList = document.getElementById(`f-list-${folder.id}`);

                const folderMatches = matches?.filter(m => m.folder_id == folder.id) || [];
                
                if (folderMatches.length === 0) {
                    mList.innerHTML = '<p style="padding:15px; font-size:12px; color:#8a8f98; text-align:center;">بازی برای این پوشه ثبت نشده است.</p>';
                }

                folderMatches.forEach(match => {
                    const matchRow = document.createElement('div');
                    
                    const foundPred = userPredictions?.find(p => p.match_id === match.id);
                    const hasPrediction = foundPred !== undefined && foundPred !== null;
                    const predHome = hasPrediction ? foundPred.home_prediction : '';
                    const predAway = hasPrediction ? foundPred.away_prediction : '';

                    const realHome = match.home_score !== null ? match.home_score : '-';
                    const realAway = match.away_score !== null ? match.away_score : '-';

                    let isTimeExpired = false;
                    if (match.match_date && match.match_time) {
                        const matchDateTime = new Date(`${match.match_date}T${match.match_time}`);
                        const now = new Date();
                        if (now >= matchDateTime) { isTimeExpired = true; }
                    }

                    // اختصاص کلاس متمایز (بدون کاراکتر اضافه)
                    if (userRole !== 'admin' && !hasPrediction && !isTimeExpired) {
                        matchRow.className = 'match-item not-predicted';
                    } else {
                        matchRow.className = 'match-item';
                    }

                    const dateTimeTag = (match.match_date && match.match_time) 
                        ? `<div class="match-time-tag">📅 ${match.match_date} | ⏰ ${match.match_time}</div>`
                        : `<div class="match-time-tag">زمان نامشخص</div>`;

                    const delMatchBtn = userRole === 'admin' ? `<span class="btn-match-del" onclick="deleteMatch(${match.id})">🗑️ حذف بازی</span>` : '';

                    let scoreSection = '';
                    let actionBtnZone = '';

                    if (userRole === 'admin') {
                        scoreSection = `
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%;">
                                <div class="admin-score-inputs">
                                    <input type="number" id="home-input-${match.id}" class="score-input" value="${match.home_score !== null ? match.home_score : ''}" placeholder="0" disabled>
                                    <span class="score-dash" style="color: #ffcc00;">-</span>
                                    <input type="number" id="away-input-${match.id}" class="score-input" value="${match.away_score !== null ? match.away_score : ''}" placeholder="0" disabled>
                                </div>
                                <span style="font-size: 10px; color: #ffcc00; opacity: 0.8;">نتیجه واقعی دیتابیس</span>
                            </div>
                        `;
                        actionBtnZone = `
                            <div class="score-action-zone" id="action-zone-${match.id}">
                                <button class="btn-score-edit" onclick="toggleEditScore(${match.id})">✏️ ثبت/ویرایش نتیجه</button>
                            </div>
                        `;
                    } else {
                        scoreSection = `
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
                                <div class="user-score-display" style="background: rgba(255, 204, 0, 0.05); border: 1px dashed rgba(255, 204, 0, 0.2); padding: 4px 12px; border-radius: 8px;">
                                    <span style="font-size: 11px; color: #ffcc00; display: block; text-align: center; margin-bottom: 2px;">نتیجه واقعی</span>
                                    <div style="display: flex; justify-content: center; align-items: center; gap: 6px;">
                                        <span class="score-num" style="color: #ffcc00;">${realHome}</span>
                                        <span class="score-dash" style="color: #ffcc00;">:</span>
                                        <span class="score-num" style="color: #ffcc00;">${realAway}</span>
                                    </div>
                                </div>
                                
                                <div class="admin-score-inputs" style="margin-top: 4px;">
                                    <input type="number" id="home-input-${match.id}" class="score-input" value="${predHome}" placeholder="0" 
                                        ${(hasPrediction || isTimeExpired) ? 'disabled' : ''} style="border-color: rgba(0, 149, 255, 0.3); color: #0095ff;">
                                    <span class="score-dash" style="color: #0095ff;">-</span>
                                    <input type="number" id="away-input-${match.id}" class="score-input" value="${predAway}" placeholder="0" 
                                        ${(hasPrediction || isTimeExpired) ? 'disabled' : ''} style="border-color: rgba(0, 149, 255, 0.3); color: #0095ff;">
                                </div>
                                <span style="font-size: 10px; color: #0095ff; opacity: 0.8;">پیش‌بینی شما</span>
                            </div>
                        `;

                        if (isTimeExpired) {
                            actionBtnZone = `
                                <div class="score-action-zone" id="action-zone-${match.id}">
                                    <button class="btn-score-edit" disabled style="background: #2a2d34; color: #8a8f98; border: 1px solid #3a3f47; cursor: not-allowed;">🔒 زمان پایان یافت</button>
                                </div>
                            `;
                        } else {
                            actionBtnZone = `
                                <div class="score-action-zone" id="action-zone-${match.id}">
                                    ${hasPrediction ? 
                                        `<button class="btn-score-edit" onclick="toggleEditScore(${match.id})" style="background: rgba(0, 149, 255, 0.1); color: #0095ff; border: 1px solid rgba(0, 149, 255, 0.2);">✏️ ویرایش پیش‌بینی</button>` : 
                                        `<button class="btn-score-submit" onclick="saveUserPrediction(${match.id})" style="background: linear-gradient(135deg, #0052d4 0%, #0095ff 100%);">🎯 ثبت پیش‌بینی</button>`
                                    }
                                </div>
                            `;
                        }
                    }

                    const homeName = teamsMap[match.team_home_id] || 'تیم حذف شده';
                    const awayName = teamsMap[match.team_away_id] || 'تیم حذف شده';

                    matchRow.innerHTML = `
                        <div class="match-main-info" style="width: 100%;">
                            <div class="match-teams" style="display: flex; align-items: center; justify-content: space-between;">
                                <span class="team-name text-left" style="flex: 1; text-align: left;">${homeName}</span>
                                <div style="flex: 1.5; display: flex; justify-content: center;">${scoreSection}</div>
                                <span class="team-name text-right" style="flex: 1; text-align: right;">${awayName}</span>
                            </div>
                        </div>
                        <div class="match-details" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px;">
                            ${dateTimeTag} 
                            <div style="display: flex; gap: 8px; align-items: center;">
                                ${actionBtnZone}
                                ${delMatchBtn}
                            </div>
                        </div>
                    `;
                    mList.appendChild(matchRow);
                });
            });

        } catch (error) {
            console.error("Error in rendering dashboard:", error);
            displayFoldersContainer.innerHTML = `<p style="text-align:center; color:#ff3b30;">خطا در لود اطلاعات: ${error.message}</p>`;
        }
    }

    window.toggleFolderVisibility = (folderId, button) => {
        const matchLines = document.getElementById(`f-list-${folderId}`);
        if (!matchLines) return;
        if (matchLines.style.display === "none") {
            matchLines.style.display = "block";
            button.textContent = "🙈 مخفی‌سازی";
            button.classList.remove("collapsed");
            hiddenFolderIds = hiddenFolderIds.filter(id => id !== folderId);
        } else {
            matchLines.style.display = "none";
            button.textContent = "👁️ نمایش";
            button.classList.add("collapsed");
            if (!hiddenFolderIds.includes(folderId)) { hiddenFolderIds.push(folderId); }
        }
        localStorage.setItem(`hiddenFolderIds_${loggedInUser}`, JSON.stringify(hiddenFolderIds));
    };

    window.deleteFolder = async (id) => { if(confirm('با حذف پوشه، تمام مسابقات آن نیز حذف می‌شود. موافقید؟')) { await supabaseClient.from('folders').delete().eq('id', id); fetchAndRenderContent(); } };
    window.editFolder = async (id, oldName) => { const n = prompt('نام جدید پوشه:', oldName); if(n) { await supabaseClient.from('folders').update({name: n}).eq('id', id); fetchAndRenderContent(); } };
    window.deleteMatch = async (id) => { if(confirm('مسابقه حذف شود؟')) { await supabaseClient.from('matches').delete().eq('id', id); fetchAndRenderContent(); } };

    window.saveUserPrediction = async (matchId) => {
        const loggedInUser = localStorage.getItem('loggedInUser') || 'guest';
        
        const { data: match, error: matchError } = await supabaseClient
            .from('matches')
            .select('match_date, match_time')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            alert("خطا در بررسی اطلاعات مسابقه.");
            return;
        }

        if (match.match_date && match.match_time) {
            const matchDateTime = new Date(`${match.match_date}T${match.match_time}`);
            const now = new Date();
            if (now >= matchDateTime) {
                alert("❌ متأسفانه زمان پیش‌بینی این مسابقه به پایان رسیده است!");
                fetchAndRenderContent();
                return;
            }
        }

        const homeVal = document.getElementById(`home-input-${matchId}`).value.trim();
        const awayVal = document.getElementById(`away-input-${matchId}`).value.trim();

        if(homeVal === "" || awayVal === "") {
            alert("لطفاً مقادیر پیش‌بینی هر دو تیم را وارد کنید.");
            return;
        }

        const home_prediction = parseInt(homeVal, 10);
        const away_prediction = parseInt(awayVal, 10);

        const { data: existing } = await supabaseClient
            .from('predictions')
            .select('*')
            .eq('username', loggedInUser)
            .eq('match_id', matchId);

        let result;
        if (existing && existing.length > 0) {
            result = await supabaseClient
                .from('predictions')
                .update({ home_prediction, away_prediction })
                .eq('username', loggedInUser)
                .eq('match_id', matchId);
        } else {
            result = await supabaseClient
                .from('predictions')
                .insert([{ username: loggedInUser, match_id: matchId, home_prediction, away_prediction }]);
        }

        if (!result.error) {
            alert("پیش‌بینی شما با موفقیت ثبت شد.");
            fetchAndRenderContent();
        } else {
            alert("خطا در ثبت پیش‌بینی: " + result.error.message);
        }
    };

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'index.html';
    });
// ==========================================
    // سیستم نمایش لیست آخرین بازدید کاربران
    // ==========================================
    const usersLastVisitBtn = document.getElementById('usersLastVisitBtn');
    const lastVisitSection = document.getElementById('lastVisitSection');
    const lastVisitListWrapper = document.getElementById('lastVisitListWrapper');

    if (usersLastVisitBtn && lastVisitSection) {
        usersLastVisitBtn.addEventListener('click', async () => {
            // تافل کردن نمایش پنل
            if (lastVisitSection.style.display === 'block') {
                lastVisitSection.style.display = 'none';
                return;
            }

            lastVisitSection.style.display = 'block';
            lastVisitListWrapper.innerHTML = '<p style="text-align:center; color:#8a8f98;">در حال دریافت اطلاعات...</p>';

            // گرفتن لیست کاربران از دیتابیس
            const { data: users, error } = await supabaseClient
                .from('project_users')
                .select('username, last_visit')
                .order('username', { ascending: true });

            if (error) {
                lastVisitListWrapper.innerHTML = `<p style="color:#ff3b30;">خطا: ${error.message}</p>`;
                return;
            }

            lastVisitListWrapper.innerHTML = '';

            if (!users || users.length === 0) {
                lastVisitListWrapper.innerHTML = '<p style="text-align:center; color:#8a8f98;">کاربری یافت نشد.</p>';
                return;
            }

            // رندر کردن هر کاربر در لیست با استایل هماهنگ خودتان
            users.forEach(u => {
                const row = document.createElement('div');
                row.className = 'user-mobile-row'; // استفاده از کلاس پیش‌فرض پروژه شما
                
                const visitTime = u.last_visit ? u.last_visit : '🔴 هنوز بازدیدی ثبت نشده';
                
                row.innerHTML = `
                    <div class="user-info" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <span class="u-name" style="font-weight: bold; color: #fff;">👤 ${u.username}</span>
                        <span class="u-pass" style="color: #0095ff; font-size: 12px;">🕒 ${visitTime}</span>
                    </div>
                `;
                lastVisitListWrapper.appendChild(row);
            });
        });
    }
});

// ثبت سرویس ورکر و درخواست دسترسی نوتیفیکیشن
async function enableNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('این مرورگر از نوتیفیکیشن پشتیبانی نمی‌کند.');
        return;
    }

    // اگر VAPID key تنظیم نشده، فقط سرویس ورکر را ثبت می‌کنیم
    const VAPID_KEY = 'YOUR_PUBLIC_VAPID_KEY';
    if (VAPID_KEY === 'YOUR_PUBLIC_VAPID_KEY') {
        try {
            await navigator.serviceWorker.register('./sw.js');
            console.log('Service Worker با موفقیت ثبت شد (بدون Push - VAPID key تنظیم نشده).');
        } catch (err) {
            console.warn('خطا در ثبت سرویس ورکر:', err);
        }
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker با موفقیت ثبت شد.');

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('کاربر اجازه دسترسی به نوتیفیکیشن را نداد.');
            return;
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)
        });

        await saveSubscriptionToSupabase(subscription);

    } catch (error) {
        console.error('خطا در راه‌اندازی سیستم نوتیفیکیشن:', error);
    }
}

// ذخیره توکن در جدول project_users سوبابیس
async function saveSubscriptionToSupabase(subscription) {
    const username = localStorage.getItem('loggedInUser');
    if (!username) return;

    // آپدیت فیلد جدید push_subscription در دیتابیس سوبابیس
    await supabaseClient
        .from('project_users')
        .update({ push_subscription: JSON.stringify(subscription) })
        .eq('username', username);
}

// تابع کمکی برای تبدیل کلید سرور
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// سیستم enableNotifications از طریق initNotificationSystem اجرا می‌شود

// سیستم نوتیفیکیشن از طریق enableNotifications که در DOMContentLoaded اصلی اجرا می‌شود مدیریت می‌گردد