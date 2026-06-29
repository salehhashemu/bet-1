// ==========================================
// تنظیمات مرکزی پروژه
// ==========================================
const SUPABASE_URL = "https://rzvuvrfrkbsthzzimbce.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dnV2cmZya2JzdGh6emltYmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzIxOTEsImV4cCI6MjA5NjI0ODE5MX0.M7db1b124sf9T6-NBewgVPqix1koaytYG-5lJqNnXn8";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// جایگزین کردن alert مرورگر با توست زیبا
// ==========================================
window.alert = function(message) {
    if (typeof showFloatingToast === 'function') {
        showFloatingToast(message, "warning");
    } else {
        console.warn("Toast system not ready:", message);
    }
};

const loggedInUser = localStorage.getItem('loggedInUser') || 'guest';
let hiddenFolderIds = JSON.parse(localStorage.getItem(`hiddenFolderIds_${loggedInUser}`)) || [];

// ==========================================
// دریافت زمان واقعی از سرور (ضد دستکاری ساعت گوشی)
// ==========================================
// زمان سرور رو یک‌بار کش می‌کنیم تا از کوئری مکرر جلوگیری بشه
let _serverTimeCache = null;
let _serverTimeFetchedAt = null;

async function getServerTime() {
    // اگر کمتر از ۳۰ ثانیه از آخرین fetch گذشته، از offset محاسبه‌شده استفاده کن
    if (_serverTimeCache && _serverTimeFetchedAt) {
        const elapsed = Date.now() - _serverTimeFetchedAt;
        return new Date(_serverTimeCache.getTime() + elapsed);
    }

    try {
        // timeout 2 ثانیه — اگر rpc جواب نداد، سریع fallback می‌کنیم
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000)
        );
        const rpcPromise = supabaseClient.rpc('get_server_time');
        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

        if (!error && data) {
            _serverTimeCache = new Date(data);
            _serverTimeFetchedAt = Date.now();
            return _serverTimeCache;
        }
    } catch (e) {
        console.warn("دریافت زمان سرور ناموفق بود، از زمان محلی استفاده می‌شود:", e);
    }

    // fallback به زمان محلی اگر سرور جواب نداد
    return new Date();
}

// تابع کمکی: تبدیل تاریخ/ساعت ذخیره‌شده (به وقت تهران) به Date در UTC
// — مستقل از تایم‌زون مرورگر کاربر
function tehranToUTC(match_date, match_time) {
    if (!match_date || !match_time) return null;
    const t = String(match_time).length === 5 ? `${match_time}:00` : match_time;
    return new Date(`${match_date}T${t}+03:30`);
}

// تابع کمکی: آیا زمان مسابقه گذشته؟ (زمان بازی به وقت تهران UTC+3:30)
async function isMatchTimeExpired(match_date, match_time) {
    if (!match_date || !match_time) return false;
    const matchUTC = tehranToUTC(match_date, match_time);
    const serverNow = await getServerTime();
    return serverNow >= matchUTC;
}

// ==========================================
// اجرای اصلی پس از لود صفحه
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const userRole = localStorage.getItem('userRole');
    const welcomeMessage = document.getElementById('welcomeMessage');

    if (!userRole) {
        window.location.href = 'index.html';
        return;
    }

    // ثبت زمان بازدید کاربر — fire-and-forget تا صفحه بلاک نشه
    if (loggedInUser && loggedInUser !== 'guest') {
        const now = new Date();
        const currentVisitString = now.toLocaleDateString('fa-IR') + ' - ساعت ' + now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        supabaseClient
            .from('project_users')
            .update({ last_visit: currentVisitString })
            .eq('username', loggedInUser)
            .then(() => {})
            .catch(e => console.warn('last_visit update failed:', e));
    }

    if (userRole === 'admin') {
        welcomeMessage.textContent = '👑 پنل مدیریت کل جام جهانی';
        document.querySelectorAll('.admin-only').forEach(f => f.style.display = 'block');
        initAdminFeatures();
    } else {
        welcomeMessage.textContent = `⚽ پیش‌بینی | خوش آمدید ${loggedInUser}`;
        document.querySelectorAll('.admin-only').forEach(f => f.style.display = 'none');
    }

    fetchAndRenderContent();

    // ==========================================
    // سیستم اعلان پیش‌بینی‌های ثبت نشده
    // ==========================================
    const notifBellBtn = document.getElementById('notifBellBtn');
    const notifBadge   = document.getElementById('notifBadge');

    // ── نمایش اعلان برای کاربر عادی (اگر مدیر اعلان صادر کرده باشد) ──
    if (userRole !== 'admin' && loggedInUser !== 'guest') {
        (async () => {
            try {
                // بررسی آیا مدیر اعلان فعال کرده
                const { data: notifRow } = await supabaseClient
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'unpred_notif_active')
                    .single();

                if (!notifRow || notifRow.value !== 'true') return;

                // شمارش بازی‌هایی که هنوز نتیجه‌ای نگرفته‌اند و کاربر پیش‌بینی نداده
                const [{ data: allMatches }, { data: userPreds }] = await Promise.all([
                    supabaseClient.from('matches').select('id, home_score, away_score'),
                    supabaseClient.from('predictions')
                        .select('match_id, home_prediction, away_prediction')
                        .eq('username', loggedInUser)
                ]);

                const predMatchIds = new Set(
                    (userPreds || [])
                        .filter(p => p.home_prediction !== null && p.away_prediction !== null && p.home_prediction !== '' && p.away_prediction !== '')
                        .map(p => String(p.match_id))
                );

                // بازی‌هایی که هنوز قفل نشده‌اند (نتیجه ندارند) و کاربر پیش‌بینی نداده
                const unpredCount = (allMatches || []).filter(m =>
                    m.home_score === null && m.away_score === null &&
                    !predMatchIds.has(String(m.id))
                ).length;

                if (unpredCount > 0) {
                    notifBadge.textContent = unpredCount;
                    notifBadge.style.display = 'inline-block';

                    if (notifBellBtn) {
                        notifBellBtn.addEventListener('click', () => {
                            showFloatingToast(
                                `🔔 خبر فوری!\n\nشما در ${unpredCount} بازی هنوز پیش‌بینی ثبت نکرده‌اید.\nقبل از قفل شدن بازی‌ها پیش‌بینی‌هایتان را ثبت کنید! ⚽`,
                                'warning'
                            );
                        });
                    }
                }
            } catch (e) {
                console.warn('خطا در بارگذاری اعلان:', e);
            }
        })();
    }

    // ── کنترل ارسال اعلان توسط ادمین ──
    if (userRole === 'admin') {
        const sendBtn = document.getElementById('sendUnpredNotifBtn');
        const resultEl = document.getElementById('notifSendResult');
        if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
                sendBtn.disabled = true;
                sendBtn.textContent = '⏳ در حال ارسال...';
                if (resultEl) resultEl.innerHTML = '';
                try {
                    const { error: err } = await supabaseClient
                        .from('app_settings')
                        .upsert({ key: 'unpred_notif_active', value: 'true' }, { onConflict: 'key' });

                    if (err) throw err;
                    showFloatingToast('✅ اعلان فعال شد. کاربران بعد از بازبارگذاری صفحه اعلان را دریافت می‌کنند.', 'success');
                    if (resultEl) resultEl.innerHTML = '<span style="color:var(--green);">✅ اعلان با موفقیت فعال شد.</span>';
                    // نشان فعال روی زنگ ادمین
                    if (notifBadge) { notifBadge.textContent = '!'; notifBadge.style.display = 'inline-block'; }
                } catch (e) {
                    showFloatingToast('خطا در ارسال اعلان: ' + e.message, 'warning');
                    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red);">❌ خطا: ' + e.message + '</span>';
                } finally {
                    sendBtn.disabled = false;
                    sendBtn.textContent = '📣 ارسال اعلان پیش‌بینی‌های ثبت نشده';
                }
            });
        }

        // دکمه زنگ برای ادمین: غیرفعال کردن اعلان
        if (notifBellBtn) {
            notifBellBtn.title = 'کلیک برای غیرفعال کردن اعلان';
            notifBellBtn.addEventListener('click', async () => {
                try {
                    const { error } = await supabaseClient
                        .from('app_settings')
                        .upsert({ key: 'unpred_notif_active', value: 'false' }, { onConflict: 'key' });
                    if (error) throw error;
                    if (notifBadge) notifBadge.style.display = 'none';
                    showFloatingToast('🔕 اعلان غیرفعال شد.', 'success');
                } catch(e) {
                    showFloatingToast('خطا: ' + e.message, 'warning');
                }
            });
            // بررسی وضعیت فعلی اعلان برای ادمین
            (async () => {
                try {
                    const { data } = await supabaseClient
                        .from('app_settings').select('value').eq('key','unpred_notif_active').single();
                    if (data && data.value === 'true' && notifBadge) {
                        notifBadge.textContent = '!';
                        notifBadge.style.display = 'inline-block';
                    }
                } catch(e) {}
            })();
        }
    }

    // ==========================================
    // دکمه خروج
    // ==========================================
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'index.html';
    });

    // ==========================================
    // سیستم نمایش آخرین بازدید کاربران
    // ==========================================
    const usersLastVisitBtn = document.getElementById('usersLastVisitBtn');
    const lastVisitSection = document.getElementById('lastVisitSection');
    const lastVisitListWrapper = document.getElementById('lastVisitListWrapper');

    // ── ساخت مودال آخرین بازدید ──
    if (!document.getElementById('lastVisitModal')) {
        const modalEl = document.createElement('div');
        modalEl.id = 'lastVisitModal';
        modalEl.style.cssText = `
            display:none; position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.65); backdrop-filter:blur(4px);
            align-items:center; justify-content:center; padding:20px;
        `;
        modalEl.innerHTML = `
            <div id="lastVisitModalBox" style="
                background:var(--card); border:1px solid var(--border-pink);
                border-radius:18px; width:100%; max-width:400px; max-height:80vh;
                display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.7),0 0 40px rgba(255,45,110,0.08); overflow:hidden;
            ">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border);">
                    <span style="font-size:14px;font-weight:800;color:var(--text-1);">👥 آخرین بازدید کاربران</span>
                    <button id="closeLastVisitModal" style="
                        width:28px;height:28px;border-radius:50%;border:1px solid var(--border);
                        background:var(--card-2);color:var(--text-3);
                        font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;
                        font-family:var(--font);transition:all 0.15s;text-align:center;
                    ">✕</button>
                </div>
                <div id="lastVisitModalContent" style="overflow-y:auto;padding:12px 14px;flex:1;">
                    <p style="text-align:center;color:var(--text-3);">در حال دریافت...</p>
                </div>
            </div>`;
        document.body.appendChild(modalEl);

        document.getElementById('closeLastVisitModal').addEventListener('click', () => {
            modalEl.style.display = 'none';
        });
        modalEl.addEventListener('click', e => {
            if (e.target === modalEl) modalEl.style.display = 'none';
        });
    }

    if (usersLastVisitBtn) {
        usersLastVisitBtn.addEventListener('click', async () => {
            const modal = document.getElementById('lastVisitModal');
            const content = document.getElementById('lastVisitModalContent');
            modal.style.display = 'flex';
            content.innerHTML = '<p style="text-align:center;color:#8a8f98;padding:20px;">در حال دریافت اطلاعات...</p>';

            const { data: users, error } = await supabaseClient
                .from('project_users')
                .select('username, last_visit')
                .order('last_visit', { ascending: false });

            if (error) {
                content.innerHTML = `<p style="color:#ff3b30;text-align:center;">خطا: ${error.message}</p>`;
                return;
            }
            if (!users || users.length === 0) {
                content.innerHTML = '<p style="text-align:center;color:#8a8f98;">کاربری یافت نشد.</p>';
                return;
            }

            content.innerHTML = users.map(u => {
                const visitTime = u.last_visit || null;
                // تبدیل اعداد فارسی به انگلیسی
                const toEnDigits = s => s ? s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) : s;
                const badge = visitTime
                    ? `<span style="font-size:12px;color:var(--text-2);direction:ltr;">🕒 ${toEnDigits(visitTime)}</span>`
                    : `<span style="font-size:12px;color:var(--red);">🔴 بازدید نشده</span>`;
                return `<div style="
                    display:flex;justify-content:space-between;align-items:center;
                    padding:10px 12px;border-radius:10px;margin-bottom:6px;
                    background:var(--card-2);
                    border:1px solid var(--border);
                    transition:border-color 0.15s;
                ">
                    <span style="font-size:13px;font-weight:700;color:var(--text-1);">👤 ${u.username}</span>
                    ${badge}
                </div>`;
            }).join('');
        });
    }

    // راه‌اندازی نوتیفیکیشن با تأخیر (بدون تداخل)
    setTimeout(initNotificationSystem, 3000);
});

// ==========================================
// قابلیت‌های مدیریت (فقط برای ادمین)
// ==========================================
function initAdminFeatures() {
    const userListWrapper = document.getElementById('userListWrapper');

    async function fetchUsers() {
        userListWrapper.innerHTML = 'بارگذاری کاربران...';
        const { data: users } = await supabaseClient.from('project_users').select('*').order('id', { ascending: true });
        userListWrapper.innerHTML = '';
        users?.forEach(u => {
            const inChallenge = u.is_eligible_for_reward === true;
            const row = document.createElement('div');
            row.className = 'user-mobile-row';
            row.innerHTML = `
                <div class="user-info">
                    <span class="u-name">${u.username} ${inChallenge ? '<span style="color:#f0c040;font-size:11px;">💎 چالش</span>' : ''}</span>
                    <span class="u-pass">🔑 ${u.password}</span>
                </div>
                <div class="action-icons-group">
                    <button class="btn-icon-edit" onclick="editUserPass(${u.id}, '${u.username}', '${u.password}')">ویرایش</button>
                    ${inChallenge ? `<button class="btn-icon-delete" style="background:rgba(240,192,64,0.15);color:#f0c040;border-color:rgba(240,192,64,0.3);" onclick="removeFromChallenge(${u.id}, '${u.username}')">حذف چالش</button>` : ''}
                    <button class="btn-icon-delete" onclick="deleteUser(${u.id})">حذف</button>
                </div>
            `;
            userListWrapper.appendChild(row);
        });
    }

    window.removeFromChallenge = async (id, username) => {
        if (confirm('کاربر ' + username + ' از چالش مالی حذف شود؟')) {
            await supabaseClient
                .from('project_users')
                .update({ is_eligible_for_reward: false, card_number: null })
                .eq('id', id);
            fetchUsers();
            showFloatingToast(username + ' از چالش مالی حذف شد.', 'warning');
        }
    };

    document.getElementById('addUserBtn').addEventListener('click', async () => {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newUserPassword').value.trim();
        if (username && password) {
            await supabaseClient.from('project_users').insert([{ username, password }]);
            document.getElementById('newUsername').value = '';
            document.getElementById('newUserPassword').value = '';
            fetchUsers();
        }
    });

    window.deleteUser = async (id) => {
        if (confirm('کاربر حذف شود؟')) {
            await supabaseClient.from('project_users').delete().eq('id', id);
            fetchUsers();
        }
    };

    window.editUserPass = async (id, name, pass) => {
        const newName = prompt(`نام جدید کاربر (فعلی: ${name}):`, name);
        if (newName === null) return; // کنسل
        const newPass = prompt(`رمز جدید (فعلی: ${pass}):`, pass);
        if (newPass === null) return; // کنسل
        const trimName = newName.trim();
        const trimPass = newPass.trim();
        if (!trimName || !trimPass) {
            showFloatingToast('نام و رمز نمی‌توانند خالی باشند.', 'warning');
            return;
        }
        // اگر نام تغییر کرده، اول پیش‌بینی‌ها را به نام جدید منتقل می‌کنیم
        // (قبل از تغییر نام در project_users، تا قید/پالیسی‌های مرتبط مشکلی ایجاد نکنند)
        if (trimName !== name) {
            const { error: predError, data: predData } = await supabaseClient
                .from('predictions')
                .update({ username: trimName })
                .eq('username', name)
                .select('id');

            if (predError) {
                console.error('خطا در آپدیت predictions:', predError);
                showFloatingToast('خطا در انتقال سوابق پیش‌بینی: ' + predError.message + ' — نام کاربر تغییر نکرد.', 'warning');
                return; // از تغییر نام در project_users جلوگیری می‌کنیم تا پیش‌بینی‌ها یتیم نشوند
            }

            if (!predData || predData.length === 0) {
                // هیچ ردیفی آپدیت نشد - یا کاربر پیش‌بینی نداشته یا RLS مانع شده
                const { data: checkRows } = await supabaseClient
                    .from('predictions')
                    .select('id')
                    .eq('username', name);

                if (checkRows && checkRows.length > 0) {
                    showFloatingToast('سوابق پیش‌بینی این کاربر به‌دلیل محدودیت دسترسی (RLS) منتقل نشد. نام کاربر تغییر نکرد.', 'warning');
                    return;
                }
                console.log('این کاربر هیچ پیش‌بینی‌ای برای انتقال نداشت.');
            } else {
                console.log('predictions updated:', predData.length, 'rows');
            }
        }

        const { error } = await supabaseClient
            .from('project_users')
            .update({ username: trimName, password: trimPass })
            .eq('id', id);

        if (error) {
            showFloatingToast('خطا در ویرایش کاربر: ' + error.message, 'warning');
            // اگر نام در پیش‌بینی‌ها تغییر کرده ولی کاربر آپدیت نشد، برمی‌گردانیم
            if (trimName !== name) {
                await supabaseClient
                    .from('predictions')
                    .update({ username: name })
                    .eq('username', trimName);
            }
        } else {
            showFloatingToast(`کاربر ${name} با موفقیت ویرایش شد.`, 'success');
            fetchUsers();
        }
    };

    fetchUsers();

    // مدیریت تیم‌ها
    const teamsContainer = document.getElementById('teamsContainer');

    async function fetchTeams() {
        const { data: teams } = await supabaseClient.from('teams').select('*').order('name');
        teamsContainer.innerHTML = '';
        const homeSel = document.getElementById('matchHomeSelect');
        const awaySel = document.getElementById('matchAwaySelect');
        if (homeSel && awaySel) {
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

    window.deleteTeam = async (id) => {
        if (confirm('با حذف تیم، تمام بازی‌های مرتبط با آن نیز پاک خواهند شد. موافقید؟')) {
            await supabaseClient.from('teams').delete().eq('id', id);
            fetchTeams();
            fetchAndRenderContent();
        }
    };

    fetchTeams();

    document.getElementById('addTeamBtn').addEventListener('click', async () => {
        const teamName = document.getElementById('teamNameInput').value.trim();
        if (teamName) {
            const { error } = await supabaseClient.from('teams').insert([{ name: teamName }]);
            if (!error) {
                document.getElementById('teamNameInput').value = '';
                fetchTeams();
                fetchAndRenderContent();
                alert(`تیم "${teamName}" با موفقیت ثبت شد.`);
            } else {
                alert("خطا در ثبت تیم: " + error.message);
            }
        } else {
            alert('لطفاً نام تیم را وارد کنید.');
        }
    });

    // مدیریت پوشه‌ها
    document.getElementById('addFolderBtn').addEventListener('click', async () => {
        const name = document.getElementById('folderNameInput').value.trim();
        if (name) {
            await supabaseClient.from('folders').insert([{ name }]);
            document.getElementById('folderNameInput').value = '';
            fetchAndRenderContent();
        }
    });

    // ثبت بازی جدید
    document.getElementById('addMatchBtn').addEventListener('click', async () => {
        const folder_id = document.getElementById('matchFolderSelect').value;
        const team_home_id = document.getElementById('matchHomeSelect').value;
        const team_away_id = document.getElementById('matchAwaySelect').value;
        const match_date = document.getElementById('matchDateInput').value;
        const match_time = document.getElementById('matchTimeInput').value;

        if (folder_id && team_home_id && team_away_id && match_date && match_time) {
            const { error } = await supabaseClient.from('matches').insert([{
                folder_id, team_home_id, team_away_id, match_date, match_time
            }]);
            if (!error) {
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

// ==========================================
// ثبت و ویرایش نتیجه (ادمین)
// ==========================================
window.saveScore = async (matchId) => {
    const homeVal = document.getElementById(`home-input-${matchId}`).value.trim();
    const awayVal = document.getElementById(`away-input-${matchId}`).value.trim();

    if (homeVal === "" || awayVal === "") {
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

    if (homeInput && awayInput) {
        homeInput.disabled = false;
        awayInput.disabled = false;
        homeInput.focus();
    }

    const userRole = localStorage.getItem('userRole');
    if (actionBtnZone) {
        if (userRole === 'admin') {
            actionBtnZone.innerHTML = `<button class="btn-score-submit" onclick="saveScore(${matchId})">ذخیره نتیجه</button>`;
        } else {
            actionBtnZone.innerHTML = `<button class="btn-score-submit" onclick="saveUserPrediction(${matchId})">ذخیره پیش‌بینی</button>`;
        }
    }
};

// ==========================================
// فچ و رندر محتوا
// ==========================================
async function fetchAndRenderContent() {
    const displayFoldersContainer = document.getElementById('displayFoldersContainer');
    if (!displayFoldersContainer) return;

    const userRole = localStorage.getItem('userRole');
    displayFoldersContainer.innerHTML = '<p style="text-align:center; color:#8a8f98;">در حال به‌روزرسانی داده‌ها...</p>';

    try {
        // همه کوئری‌ها را موازی می‌فرستیم تا زمان لود کاهش یابد
        const [
            { data: folders },
            { data: matches },
            { data: teams },
            { data: userPredictions }
        ] = await Promise.all([
            supabaseClient.from('folders').select('*').order('id', { ascending: true }),
            supabaseClient.from('matches').select('*').order('id', { ascending: true }),
            supabaseClient.from('teams').select('*'),
            supabaseClient.from('predictions').select('*').eq('username', loggedInUser)
        ]);

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

        // زمان سرور را به‌صورت موازی با fetch های بالا می‌گیریم (بدون بلاک کردن)
        // اگر از کش باشه آنی است؛ اگر کش خالی باشه timeout 2s داره
        const serverNow = await getServerTime();

        // ─── محاسبه امتیاز هر پوشه برای کاربر جاری ───
        function calcFolderScore(folderId) {
            const folderMatches = matches?.filter(m => m.folder_id == folderId) || [];
            let score = 0;
            let hasSettled = false;
            folderMatches.forEach(m => {
                if (m.home_score === null || m.away_score === null) return;
                hasSettled = true;
                const pred = userPredictions?.find(p => String(p.match_id) === String(m.id));
                if (!pred || pred.home_prediction === null || pred.away_prediction === null ||
                    pred.home_prediction === '' || pred.away_prediction === '') return;
                const prH = parseInt(pred.home_prediction), prA = parseInt(pred.away_prediction);
                const reH = parseInt(m.home_score), reA = parseInt(m.away_score);
                if (isNaN(prH) || isNaN(prA) || isNaN(reH) || isNaN(reA)) return;
                const rW = reH > reA ? 1 : reA > reH ? 2 : 0;
                const pW = prH > prA ? 1 : prA > prH ? 2 : 0;
                if (prH === reH && prA === reA) score += 10;
                else if (rW === pW && (reH - reA) === (prH - prA)) score += 7;
                else if (rW === pW) score += 5;
                else score += 2;
            });
            return hasSettled ? score : null;
        }

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

            // امتیاز پوشه برای کاربر عادی
            const folderScore = (userRole !== 'admin') ? calcFolderScore(folder.id) : null;
            const folderScoreBadge = (folderScore !== null)
                ? `<span style="font-size:11px;font-weight:800;color:var(--accent);background:rgba(255,59,78,0.12);border:1px solid rgba(255,59,78,0.25);padding:2px 9px;border-radius:20px;white-space:nowrap;">⭐ ${folderScore} امتیاز</span>`
                : '';

            folderBox.innerHTML = `
                <div class="folder-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="folder-title">📁 ${folder.name}</span>
                        ${adminFolderBtns}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${folderScoreBadge}
                        <button class="btn-score-edit ${isHidden ? 'collapsed' : ''}" onclick="toggleFolderVisibility(${folder.id}, this)">
                            ${isHidden ? '👁️ نمایش' : '🙈 مخفی‌سازی'}
                        </button>
                    </div>
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
                matchRow.id = `match-row-${match.id}`;
                matchRow.dataset.matchId = match.id;
                matchRow.dataset.folderId = folder.id;
                matchRow.dataset.settled = (match.home_score !== null && match.away_score !== null) ? '1' : '0';

                const foundPred = userPredictions?.find(p => String(p.match_id) === String(match.id));
                const hasPrediction = foundPred !== undefined && foundPred !== null;
                const predHome = hasPrediction ? foundPred.home_prediction : '';
                const predAway = hasPrediction ? foundPred.away_prediction : '';

                const realHome = match.home_score !== null ? match.home_score : '-';
                const realAway = match.away_score !== null ? match.away_score : '-';

                let isTimeExpired = false;
                if (match.match_date && match.match_time) {
                    // زمان بازی به وقت تهران (UTC+3:30) — تفسیر صحیح مستقل از تایم‌زون مرورگر
                    const matchUTC = tehranToUTC(match.match_date, match.match_time);
                    if (serverNow >= matchUTC) { isTimeExpired = true; }
                }

                if (userRole !== 'admin' && !hasPrediction && !isTimeExpired) {
                    matchRow.className = 'match-item not-predicted';
                } else {
                    matchRow.className = 'match-item';
                }

                const dateTimeTag = (match.match_date && match.match_time)
                    ? `<div class="match-time-tag">📅 ${match.match_date} | ⏰ ${match.match_time}</div>`
                    : `<div class="match-time-tag">زمان نامشخص</div>`;

                const delMatchBtn = userRole === 'admin'
                    ? `<button class="btn-match-del" onclick="deleteMatch(${match.id})">حذف</button>`
                    : '';

                const homeName = teamsMap[match.team_home_id] || 'تیم حذف شده';
                const awayName = teamsMap[match.team_away_id] || 'تیم حذف شده';
                const homeNameSafe = homeName.replace(/'/g, "\\'");
                const awayNameSafe = awayName.replace(/'/g, "\\'");

                let scoreSection = '';
                let actionBtnZone = '';

                if (userRole === 'admin') {
                    scoreSection = `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; width:100%;">
                            <div class="admin-score-inputs">
                                <input type="number" id="home-input-${match.id}" class="score-input" value="${match.home_score !== null ? match.home_score : ''}" placeholder="0" disabled>
                                <span class="score-dash">—</span>
                                <input type="number" id="away-input-${match.id}" class="score-input" value="${match.away_score !== null ? match.away_score : ''}" placeholder="0" disabled>
                            </div>
                            <span style="font-size:10px; color:var(--gold); opacity:0.7; margin-top:2px;">نتیجه ثبت‌شده</span>
                        </div>
                    `;
                    actionBtnZone = `
                        <div class="score-action-zone" id="action-zone-${match.id}">
                            <button class="btn-score-edit" onclick="toggleEditScore(${match.id})">ویرایش نتیجه</button>
                            <button class="btn-show-preds" title="ویرایش تاریخ و ساعت" onclick="editMatchDateTime(${match.id},'${match.match_date||''}','${match.match_time||''}')">📅</button>
                            <button class="btn-show-preds" title="ویرایش پیش‌بینی کاربران" onclick="showAdminEditPredModal(${match.id},'${homeNameSafe}','${awayNameSafe}')">✏️👥</button>
                        </div>
                    `;
                } else {
                    scoreSection = `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; width:100%;">
                            <div style="background:var(--gold-dim); border:1px dashed rgba(240,192,64,0.2); padding:5px 14px; border-radius:8px;">
                                <span style="font-size:10px; color:var(--gold); display:block; text-align:center; margin-bottom:3px; opacity:0.8;">نتیجه واقعی</span>
                                <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                                    <span class="score-num">${realHome}</span>
                                    <span style="color:var(--text-muted); font-size:12px;">–</span>
                                    <span class="score-num">${realAway}</span>
                                </div>
                            </div>
                            <div class="admin-score-inputs" style="margin-top:2px;">
                                <input type="number" id="home-input-${match.id}" class="score-input" value="${predHome}" placeholder="0"
                                    ${(hasPrediction || isTimeExpired) ? 'disabled' : ''}
                                    style="border-color:rgba(255,59,78,0.35); color:var(--accent);">
                                <span class="score-dash">–</span>
                                <input type="number" id="away-input-${match.id}" class="score-input" value="${predAway}" placeholder="0"
                                    ${(hasPrediction || isTimeExpired) ? 'disabled' : ''}
                                    style="border-color:rgba(255,59,78,0.35); color:var(--accent);">
                            </div>
                            <span style="font-size:10px; color:var(--accent); opacity:0.7;">پیش‌بینی شما</span>
                        </div>
                    `;

                    if (isTimeExpired) {
                        actionBtnZone = `
                            <div class="score-action-zone" id="action-zone-${match.id}" style="flex-direction:row;align-items:center;gap:6px;width:100%;justify-content:flex-end;">
                                <button class="btn-show-preds match-action-equal-btn" title="پیش‌بینی کاربران" onclick="showMatchPredictions(${match.id}, '${homeNameSafe}', '${awayNameSafe}')">👥 پیش‌بینی کاربران</button>
                                <button class="btn-score-edit match-action-equal-btn" disabled
                                    style="cursor:not-allowed; opacity:0.6;">
                                    🔒 به پایان رسید
                                </button>
                            </div>
                        `;
                    } else {
                        // زمان بازی نرسیده — دکمه پیش‌بینی کاربران قفل است
                        const predsLocked = !isTimeExpired;
                        actionBtnZone = `
                            <div class="score-action-zone" id="action-zone-${match.id}" style="flex-direction:row;align-items:center;gap:6px;width:100%;justify-content:flex-end;">
                                ${predsLocked
                                    ? `<button class="btn-show-preds match-action-equal-btn" disabled title="پیش‌بینی کاربران بعد از شروع بازی نمایش داده می‌شود"
                                        style="opacity:0.4;cursor:not-allowed;filter:grayscale(1);">🔒 پیش‌بینی کاربران</button>`
                                    : `<button class="btn-show-preds match-action-equal-btn" title="پیش‌بینی کاربران" onclick="showMatchPredictions(${match.id}, '${homeNameSafe}', '${awayNameSafe}')">👥 پیش‌بینی کاربران</button>`
                                }
                                ${hasPrediction
                                    ? `<button class="btn-score-edit btn-edit-blue match-action-equal-btn" onclick="toggleEditScore(${match.id})">ویرایش</button>`
                                    : `<button class="btn-score-submit match-action-equal-btn" onclick="saveUserPrediction(${match.id})">ثبت پیش‌بینی</button>`
                                }
                            </div>
                        `;
                    }
                }

                matchRow.innerHTML = `
                    <div class="match-main-info" style="width:100%;">
                        <div class="match-teams" style="display:flex; align-items:center; justify-content:space-between;">
                            <span class="team-name text-left" style="flex:1; text-align:left;">${homeName}</span>
                            <div style="flex:1.5; display:flex; justify-content:center;">${scoreSection}</div>
                            <span class="team-name text-right" style="flex:1; text-align:right;">${awayName}</span>
                        </div>
                    </div>
                    <div class="match-footer" style="flex-direction:column;align-items:center;gap:8px;">
                        <div style="display:flex;justify-content:center;width:100%;">${dateTimeTag}</div>
                        <div class="match-actions" style="width:100%;display:flex;justify-content:flex-end;">
                            ${actionBtnZone}
                            ${delMatchBtn}
                        </div>
                    </div>
                `;
                mList.appendChild(matchRow);
            });

            // فضای خالی + دکمه sticky برای کاربران عادی
            if (userRole !== 'admin') {
                const stickyWrap = document.createElement('div');
                stickyWrap.className = 'folder-sticky-btn-wrap';
                stickyWrap.innerHTML = `
                    <button class="folder-sticky-save-btn" onclick="window.saveFolderPredictions(${folder.id})">
                        <span>⚡</span><span>ثبت پیش‌بینی‌های ${folder.name}</span>
                    </button>`;
                mList.appendChild(stickyWrap);
            }
        });

    } catch (error) {
        console.error("Error in rendering dashboard:", error);
        displayFoldersContainer.innerHTML = `<p style="text-align:center; color:#ff3b30;">خطا در لود اطلاعات: ${error.message}</p>`;
    }
}

// ==========================================
// توابع عمومی مدیریت پوشه و بازی
// ==========================================
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

// ==========================================
// رفتن به آخرین بازی که نتیجه‌اش ثبت شده
// ==========================================
window.scrollToLastSettledMatch = () => {
    const settledRows = Array.from(document.querySelectorAll('#displayFoldersContainer .match-item[data-settled="1"]'));

    if (settledRows.length === 0) {
        alert('هنوز نتیجه هیچ بازی‌ای ثبت نشده است.');
        return;
    }

    // پیدا کردن بازی با بیشترین شناسه (آخرین بازی تعیین‌شده)
    let target = settledRows[0];
    let maxId = parseInt(target.dataset.matchId, 10);
    settledRows.forEach(row => {
        const id = parseInt(row.dataset.matchId, 10);
        if (id > maxId) { maxId = id; target = row; }
    });

    // اگر پوشه مربوط به این بازی مخفی است، نمایشش بده
    const folderId = parseInt(target.dataset.folderId, 10);
    const listWrapper = document.getElementById(`f-list-${folderId}`);
    if (listWrapper && listWrapper.style.display === 'none') {
        hiddenFolderIds = hiddenFolderIds.filter(id => id !== folderId);
        localStorage.setItem(`hiddenFolderIds_${loggedInUser}`, JSON.stringify(hiddenFolderIds));
        listWrapper.style.display = 'block';
        const folderBox = listWrapper.closest('.folder-box');
        const toggleBtn = folderBox?.querySelector('.btn-score-edit');
        if (toggleBtn) {
            toggleBtn.classList.remove('collapsed');
            toggleBtn.textContent = '🙈 مخفی‌سازی';
        }
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('match-highlight-flash');
    setTimeout(() => target.classList.remove('match-highlight-flash'), 2000);
};

document.addEventListener('DOMContentLoaded', () => {
    const goToLastMatchBtn = document.getElementById('goToLastMatchBtn');
    if (goToLastMatchBtn) {
        goToLastMatchBtn.addEventListener('click', () => {
            window.scrollToLastSettledMatch();
        });
    }
});


window.deleteFolder = async (id) => {
    if (confirm('با حذف پوشه، تمام مسابقات آن نیز حذف می‌شود. موافقید؟')) {
        await supabaseClient.from('folders').delete().eq('id', id);
        fetchAndRenderContent();
    }
};

window.editFolder = async (id, oldName) => {
    const n = prompt('نام جدید پوشه:', oldName);
    if (n) {
        await supabaseClient.from('folders').update({ name: n }).eq('id', id);
        fetchAndRenderContent();
    }
};

window.deleteMatch = async (id) => {
    if (confirm('مسابقه حذف شود؟')) {
        await supabaseClient.from('matches').delete().eq('id', id);
        fetchAndRenderContent();
    }
};

// ==========================================
// ویرایش تاریخ و ساعت بازی توسط ادمین
// ==========================================
window.editMatchDateTime = (matchId, currentDate, currentTime) => {
    let modal = document.getElementById('editDateTimeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editDateTimeModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:340px;padding:24px 20px;text-align:right;direction:rtl;">
                <div class="modal-icon">📅</div>
                <h3 style="margin-bottom:4px;">ویرایش تاریخ و ساعت بازی</h3>
                <p style="font-size:12px;color:var(--text-muted);margin-bottom:18px;">پس از ذخیره، زمان قفل‌شدن پیش‌بینی‌ها نیز تغییر می‌کند.</p>
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
                    <div>
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px;">تاریخ بازی</label>
                        <input type="date" id="edtDateInput" class="custom-datetime-input" style="width:100%;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px;">ساعت بازی</label>
                        <input type="time" id="edtTimeInput" class="custom-datetime-input" style="width:100%;box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button id="edtSaveBtn" class="btn-success" style="flex:1;" onclick="saveMatchDateTime()">💾 ذخیره</button>
                    <button class="btn-close" style="flex:1;" id="edtCloseBtn">انصراف</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => {
            modal.style.display = 'none';
            // ریست کامل دکمه ذخیره
            const btn = document.getElementById('edtSaveBtn');
            if (btn) { btn.disabled = false; btn.innerHTML = '💾 ذخیره'; }
            modal.dataset.matchId = '';
        };

        modal.querySelector('#edtCloseBtn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    // ریست دکمه ذخیره قبل از هر بار باز کردن
    const btn = document.getElementById('edtSaveBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 ذخیره'; }

    modal.dataset.matchId = matchId;
    document.getElementById('edtDateInput').value = currentDate || '';
    document.getElementById('edtTimeInput').value = currentTime || '';
    modal.style.display = 'flex';
};

window.saveMatchDateTime = async () => {
    const modal = document.getElementById('editDateTimeModal');
    if (!modal) return;
    const matchId = modal.dataset.matchId;
    if (!matchId) return;
    const newDate = document.getElementById('edtDateInput').value;
    const newTime = document.getElementById('edtTimeInput').value;

    const btn = document.getElementById('edtSaveBtn');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ در حال ذخیره...';

    try {
        const { error } = await supabaseClient
            .from('matches')
            .update({ match_date: newDate || null, match_time: newTime || null })
            .eq('id', matchId);
        if (error) throw error;
        modal.style.display = 'none';
        modal.dataset.matchId = '';
        btn.disabled = false;
        btn.innerHTML = '💾 ذخیره';
        showFloatingToast('✅ تاریخ و ساعت بازی با موفقیت ذخیره شد.', 'success');
        fetchAndRenderContent();
    } catch (err) {
        showFloatingToast('خطا در ذخیره: ' + err.message, 'warning');
        btn.disabled = false;
        btn.innerHTML = orig;
    }
};

// ==========================================
// ثبت پیش‌بینی کاربر
// ==========================================
window.saveUserPrediction = async (matchId) => {
    const currentUser = localStorage.getItem('loggedInUser') || 'guest';

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
        // زمان بازی به وقت تهران (UTC+3:30) — تفسیر صحیح مستقل از تایم‌زون مرورگر
        const matchUTC = tehranToUTC(match.match_date, match.match_time);
        const serverNow = await getServerTime();
        if (serverNow >= matchUTC) {
            alert("❌ متأسفانه زمان پیش‌بینی این مسابقه به پایان رسیده است!");
            fetchAndRenderContent();
            return;
        }
    }

    const homeVal = document.getElementById(`home-input-${matchId}`).value.trim();
    const awayVal = document.getElementById(`away-input-${matchId}`).value.trim();

    if (homeVal === "" || awayVal === "") {
        alert("لطفاً مقادیر پیش‌بینی هر دو تیم را وارد کنید.");
        return;
    }

    const home_prediction = parseInt(homeVal, 10);
    const away_prediction = parseInt(awayVal, 10);

    const { data: existing } = await supabaseClient
        .from('predictions')
        .select('*')
        .eq('username', currentUser)
        .eq('match_id', matchId);

    let result;
    if (existing && existing.length > 0) {
        result = await supabaseClient
            .from('predictions')
            .update({ home_prediction, away_prediction })
            .eq('username', currentUser)
            .eq('match_id', matchId);
    } else {
        result = await supabaseClient
            .from('predictions')
            .insert([{ username: currentUser, match_id: matchId, home_prediction, away_prediction }]);
    }

    if (!result.error) {
        alert("پیش‌بینی شما با موفقیت ثبت شد.");
        fetchAndRenderContent();
    } else {
        alert("خطا در ثبت پیش‌بینی: " + result.error.message);
    }
};

// ==========================================
// ثبت دسته‌جمعی پیش‌بینی‌های یک پوشه
// ==========================================
window.saveFolderPredictions = async (folderId) => {
    const currentUser = localStorage.getItem('loggedInUser') || 'guest';

    // دکمه می‌تونه دکمه شناور باشه یا هر دکمه‌ای با id مشخص
    const btn = document.getElementById('floating-bulk-save-btn') || document.getElementById(`bulk-save-btn-${folderId}`);

    // پیدا کردن همه بازی‌های این پوشه از DOM
    const folderList = document.getElementById(`f-list-${folderId}`);
    if (!folderList) return;

    // جمع‌آوری همه match id هایی که input دارن
    const homeInputs = folderList.querySelectorAll('[id^="home-input-"]');
    if (homeInputs.length === 0) {
        showFloatingToast("هیچ بازی قابل ثبتی در این پوشه وجود ندارد.", "warning");
        return;
    }

    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:btnSpin 0.8s linear infinite;vertical-align:middle;margin-left:6px;"></span> در حال ثبت...`;
    }

    const serverNow = await getServerTime();
    const { data: allMatchesInFolder } = await supabaseClient
        .from('matches')
        .select('id, match_date, match_time')
        .eq('folder_id', folderId);

    const { data: existingPreds } = await supabaseClient
        .from('predictions')
        .select('match_id')
        .eq('username', currentUser);

    const existingMatchIds = new Set((existingPreds || []).map(p => String(p.match_id)));

    let successCount = 0;
    const errors = [];

    for (const input of homeInputs) {
        const matchId = input.id.replace('home-input-', '');
        const awayInput = document.getElementById(`away-input-${matchId}`);

        // اگر disabled بود (قفل شده یا قبلاً ثبت شده) رد کن
        if (input.disabled) continue;

        const homeVal = input.value.trim();
        const awayVal = awayInput ? awayInput.value.trim() : '';

        // بررسی زمان — به وقت تهران (UTC+3:30)
        const matchInfo = allMatchesInFolder?.find(m => String(m.id) === String(matchId));
        if (matchInfo && matchInfo.match_date && matchInfo.match_time) {
            const matchUTC = tehranToUTC(matchInfo.match_date, matchInfo.match_time);
            if (serverNow >= matchUTC) continue; // قفل شده، رد کن
        }

        // بررسی خطای ناقص
        const homeEmpty = homeVal === '';
        const awayEmpty = awayVal === '';

        if (homeEmpty || awayEmpty) {
            const homeName = input.closest('.match-item')?.querySelector('.team-name.text-left')?.textContent?.trim() || `بازی ${matchId}`;
            const awayName = input.closest('.match-item')?.querySelector('.team-name.text-right')?.textContent?.trim() || '';
            const label = awayName ? `${homeName} - ${awayName}` : homeName;
            errors.push(`⚠️ ${label}: ${homeEmpty && awayEmpty ? 'هر دو مقدار' : homeEmpty ? 'تیم اول' : 'تیم دوم'} وارد نشده`);
            continue;
        }

        const home_prediction = parseInt(homeVal, 10);
        const away_prediction = parseInt(awayVal, 10);

        let result;
        if (existingMatchIds.has(String(matchId))) {
            result = await supabaseClient
                .from('predictions')
                .update({ home_prediction, away_prediction })
                .eq('username', currentUser)
                .eq('match_id', matchId);
        } else {
            result = await supabaseClient
                .from('predictions')
                .insert([{ username: currentUser, match_id: matchId, home_prediction, away_prediction }]);
        }

        if (!result.error) {
            successCount++;
        } else {
            errors.push(`❌ خطا در ثبت بازی ${matchId}: ${result.error.message}`);
        }
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }

    if (successCount > 0 && errors.length === 0) {
        showFloatingToast(`✅ ${successCount} پیش‌بینی با موفقیت ثبت شد.`, "success");
        fetchAndRenderContent();
    } else if (successCount > 0 && errors.length > 0) {
        showFloatingToast(`✅ ${successCount} پیش‌بینی ثبت شد.\n${errors.join('\n')}`, "warning");
        fetchAndRenderContent();
    } else if (successCount === 0 && errors.length > 0) {
        showFloatingToast(`${errors.join('\n')}`, "warning");
    } else {
        showFloatingToast("همه بازی‌های این پوشه قبلاً ثبت شده یا قفل هستند.", "warning");
    }
};

// ==========================================
// ویرایش پیش‌بینی کاربران توسط ادمین
// ==========================================
window.showAdminEditPredModal = async (matchId, homeName, awayName) => {
    let modal = document.getElementById('adminPredEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'adminPredEditModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px; max-height:85vh; display:flex; flex-direction:column; padding:24px 18px; overflow:hidden;">
                <div class="modal-icon">✏️</div>
                <h3 id="apemTitle" style="margin-bottom:4px;">ویرایش پیش‌بینی‌ها</h3>
                <p id="apemSubtitle" style="font-size:12px;color:var(--text-muted);margin-bottom:14px;"></p>
                <div id="apemBody" style="overflow-y:auto; flex:1; margin-bottom:16px;"></div>
                <button class="btn-close" id="apemCloseBtn">بستن</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#apemCloseBtn').addEventListener('click', () => { modal.style.display = 'none'; });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    const titleEl  = modal.querySelector('#apemTitle');
    const subEl    = modal.querySelector('#apemSubtitle');
    const bodyEl   = modal.querySelector('#apemBody');
    titleEl.textContent = `${homeName} — ${awayName}`;
    subEl.textContent   = 'ادمین می‌تواند پیش‌بینی هر کاربر را تغییر دهد.';
    bodyEl.innerHTML    = '<p style="text-align:center;color:var(--text-muted);padding:20px;">در حال بارگذاری…</p>';
    modal.style.display = 'flex';

    try {
        const [{ data: allUsers }, { data: preds }] = await Promise.all([
            supabaseClient.from('project_users').select('username').order('username', { ascending: true }),
            supabaseClient.from('predictions').select('*').eq('match_id', matchId)
        ]);

        const predMap = {};
        (preds || []).forEach(p => { predMap[p.username] = p; });

        let html = '';
        (allUsers || []).forEach(u => {
            const p = predMap[u.username];
            const h = p ? p.home_prediction : '';
            const a = p ? p.away_prediction : '';
            const hasPred = !!p;
            html += `
                <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
                    <span style="flex:1; font-size:13px; font-weight:600; color:${hasPred?'var(--text-primary)':'var(--text-muted)'};">
                        👤 ${u.username}${hasPred?'':' <span style=\'font-size:10px;color:var(--red);\'>نداده</span>'}
                    </span>
                    <input type="number" id="apem-h-${matchId}-${u.username}" value="${h}" placeholder="0" min="0"
                        style="width:44px; text-align:center; padding:6px 4px; background:var(--bg-elevated);
                        border:1px solid var(--border-mid); border-radius:8px; color:var(--accent);
                        font-size:14px; font-weight:700; font-family:var(--font);">
                    <span style="color:var(--text-muted);">—</span>
                    <input type="number" id="apem-a-${matchId}-${u.username}" value="${a}" placeholder="0" min="0"
                        style="width:44px; text-align:center; padding:6px 4px; background:var(--bg-elevated);
                        border:1px solid var(--border-mid); border-radius:8px; color:var(--accent);
                        font-size:14px; font-weight:700; font-family:var(--font);">
                    <button onclick="saveAdminPredEdit(${matchId},'${u.username}',${hasPred})"
                        style="padding:6px 10px; background:var(--accent-dim); color:var(--accent);
                        border:1px solid var(--border-active); border-radius:8px; font-size:11px;
                        font-weight:700; cursor:pointer; font-family:var(--font); white-space:nowrap;">ثبت</button>
                </div>`;
        });
        bodyEl.innerHTML = html || '<p style="text-align:center;color:var(--text-muted);">کاربری یافت نشد.</p>';
    } catch(err) {
        bodyEl.innerHTML = `<p style="color:var(--red);text-align:center;">خطا: ${err.message}</p>`;
    }
};

window.saveAdminPredEdit = async (matchId, username, hasPred) => {
    const hEl = document.getElementById(`apem-h-${matchId}-${username}`);
    const aEl = document.getElementById(`apem-a-${matchId}-${username}`);
    if (!hEl || !aEl) return;
    const hv = hEl.value.trim(), av = aEl.value.trim();
    if (hv === '' || av === '') {
        showFloatingToast('هر دو مقدار را وارد کنید.', 'warning');
        return;
    }
    const home_prediction = parseInt(hv, 10);
    const away_prediction = parseInt(av, 10);

    // ─── بررسی مجدد وجود رکورد در لحظه ذخیره، برای جلوگیری از ایجاد رکورد تکراری ───
    const { data: existingRows, error: checkErr } = await supabaseClient
        .from('predictions')
        .select('id')
        .eq('username', username)
        .eq('match_id', matchId)
        .order('id', { ascending: true });

    if (checkErr) {
        showFloatingToast('خطا در بررسی پیش‌بینی موجود: ' + checkErr.message, 'warning');
        return;
    }

    let result;
    if (existingRows && existingRows.length > 0) {
        // اگر به هر دلیلی چند ردیف برای این کاربر/بازی وجود دارد، همه را با مقدار جدید یکسان می‌کنیم
        // و در صورت وجود بیش از یک ردیف، نسخه‌های اضافی را حذف می‌کنیم تا فقط یک ردیف باقی بماند
        const keepId = existingRows[existingRows.length - 1].id; // آخرین (بیشترین id)
        result = await supabaseClient.from('predictions')
            .update({ home_prediction, away_prediction })
            .eq('id', keepId);

        if (!result.error && existingRows.length > 1) {
            const extraIds = existingRows.slice(0, -1).map(r => r.id);
            await supabaseClient.from('predictions').delete().in('id', extraIds);
            showFloatingToast(`⚠️ ${existingRows.length - 1} رکورد تکراری برای ${username} پیدا و حذف شد.`, 'warning');
        }
    } else {
        result = await supabaseClient.from('predictions')
            .insert([{ username, match_id: matchId, home_prediction, away_prediction }]);
        // پس از insert باید دکمه را hasPred=true بکنیم
        if (!result.error) {
            const btn = hEl.closest('div').querySelector('button');
            if (btn) btn.setAttribute('onclick', `saveAdminPredEdit(${matchId},'${username}',true)`);
            const label = hEl.closest('div').querySelector('span');
            if (label) label.innerHTML = `👤 ${username}`;
        }
    }
    if (!result.error) {
        showFloatingToast(`✅ پیش‌بینی ${username} ثبت شد.`, 'success');
    } else {
        showFloatingToast('خطا: ' + result.error.message, 'warning');
    }
};

// ==========================================
// سیستم نوتیفیکیشن (یک نسخه واحد)
// ==========================================
async function initNotificationSystem() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('این مرورگر از Push Notification پشتیبانی نمی‌کند.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('سرویس ورکر با موفقیت ثبت شد:', registration.scope);

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('دسترسی نوتیفیکیشن توسط کاربر تایید شد.');
        }
    } catch (error) {
        console.error('خطا در ثبت سرویس ورکر:', error);
    }
}

// ==========================================
// نمایش پیش‌بینی کاربران برای یک بازی خاص (مودال — همان ظاهر قبلی)
// داده از همان مسیر بخش پیش‌بینی‌های صفحه نتایج دریافت می‌شود:
// همه کاربران + همه پیش‌بینی‌ها → فیلتر بر اساس match_id
// ==========================================
window.showMatchPredictions = async (matchId, homeName, awayName) => {
    let modal = document.getElementById('predictionsViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'predictionsViewModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:380px; max-height:80vh; display:flex; flex-direction:column; padding:24px 18px;">
                <div class="modal-icon">👀</div>
                <h3 id="predModalTitle">پیش‌بینی کاربران</h3>
                <div id="predModalBody" style="overflow-y:auto; flex:1; margin-bottom:16px; text-align:right;"></div>
                <button class="btn-close" id="predModalCloseBtn">بستن</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#predModalCloseBtn').addEventListener('click', () => { modal.style.display = 'none'; });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    const titleEl = modal.querySelector('#predModalTitle');
    const bodyEl  = modal.querySelector('#predModalBody');
    titleEl.textContent = `پیش‌بینی‌های ${homeName} مقابل ${awayName}`;
    bodyEl.innerHTML = '<p style="text-align:center; color:#8a8f98; padding:20px 0;">در حال بارگذاری...</p>';
    modal.style.display = 'flex';

    try {
        // دریافت داده دقیقاً مثل بخش پیش‌بینی‌های صفحه نتایج (predictions.html → initResultsPage)
        const [
            { data: allUsers,       error: e1 },
            { data: allPredictions, error: e2 },
            { data: matchRow,       error: e3 }
        ] = await Promise.all([
            supabaseClient.from('project_users').select('username'),
            supabaseClient.from('predictions').select('*'),
            supabaseClient.from('matches').select('home_score, away_score').eq('id', matchId).single()
        ]);
        if (e1) throw e1; if (e2) throw e2;

        // ─── همان sentinel و dedup که predictions.html استفاده می‌کند ───
        const SENTINEL_P = '99';
        const isValidP = p =>
            p.home_prediction !== null && p.away_prediction !== null &&
            p.home_prediction !== ''   && p.away_prediction !== ''   &&
            !(String(p.home_prediction) === SENTINEL_P && String(p.away_prediction) === SENTINEL_P);

        // اولین رکورد معتبر برای هر username+match_id (مثل scoreIdx در predictions.html)
        const predIdx = {};
        [...allPredictions]
            .filter(p => isValidP(p))
            .sort((a, b) => Number(a.id) - Number(b.id))
            .forEach(p => {
                const key = p.username + '_' + String(p.match_id);
                if (!predIdx[key]) predIdx[key] = p;
            });

        // پیش‌بینی‌های این بازی خاص (از ایندکس dedup‌شده)
        const preds = (allUsers || []).map(u => {
            const p = predIdx[u.username + '_' + String(matchId)];
            return p ? { username: u.username, home_prediction: p.home_prediction, away_prediction: p.away_prediction } : null;
        });
        const hasPredMap   = {}; // username -> pred|null
        (allUsers || []).forEach(u => {
            hasPredMap[u.username] = predIdx[u.username + '_' + String(matchId)] || null;
        });

        const realHome = matchRow?.home_score !== null && matchRow?.home_score !== undefined ? matchRow.home_score : '-';
        const realAway = matchRow?.away_score !== null && matchRow?.away_score !== undefined ? matchRow.away_score : '-';
        const reH = parseInt(matchRow?.home_score);
        const reA = parseInt(matchRow?.away_score);
        const hasRealResult = !isNaN(reH) && !isNaN(reA);

        const realResultBlock = `
            <div style="background:var(--gold-dim); border:1px dashed rgba(240,192,64,0.25); border-radius:10px; padding:10px 12px; margin-bottom:14px; text-align:center;">
                <div style="font-size:10px; color:var(--gold); opacity:0.8; margin-bottom:6px;">نتیجه واقعی</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:10px; font-size:14px; font-weight:800; color:var(--text-primary);">
                    <span>${homeName}</span>
                    <span style="color:var(--gold);">${realHome} – ${realAway}</span>
                    <span>${awayName}</span>
                </div>
            </div>`;

        const calcPoints = (prH, prA) => {
            if (!hasRealResult) return null;
            const rW = reH > reA ? 1 : (reA > reH ? 2 : 0);
            const pW = prH > prA ? 1 : (prA > prH ? 2 : 0);
            if (prH === reH && prA === reA) return 10;
            if (rW === pW && (reH - reA) === (prH - prA)) return 7;
            if (rW === pW) return 5;
            return 2;
        };

        const validPreds = Object.values(hasPredMap).filter(p => p !== null);
        const notPredictedUsers = (allUsers || [])
            .map(u => u.username)
            .filter(name => !hasPredMap[name])
            .sort((a, b) => a.localeCompare(b, 'fa'));

        const notPredictedBlock = notPredictedUsers.length > 0 ? `
            <div style="margin-top:6px; background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:10px; overflow:hidden;">
                <div style="padding:8px 12px; background:rgba(248,113,113,0.06); border-bottom:1px solid var(--border-subtle);">
                    <span style="font-size:12px; font-weight:800; color:var(--red);">پیش‌بینی نکرده‌اند</span>
                </div>
                <div style="padding:8px 12px; display:flex; flex-direction:column; gap:6px;">
                    ${notPredictedUsers.map(u => `<span style="font-size:13px; color:var(--text-muted); font-weight:600;">👤 ${u}</span>`).join('')}
                </div>
            </div>` : '';

        if (validPreds.length === 0) {
            bodyEl.innerHTML = realResultBlock
                + '<p style="text-align:center; color:#8a8f98; padding:10px 0;">هیچ کاربری برای این بازی پیش‌بینی ثبت نکرده است.</p>'
                + notPredictedBlock;
            return;
        }

        // گروه‌بندی پیش‌بینی‌ها بر اساس نتیجه (همه ۲–۱ها زیر هم)
        const groups = {};
        validPreds.forEach(p => {
            const key = `${p.home_prediction}-${p.away_prediction}`;
            if (!groups[key]) {
                groups[key] = {
                    home: p.home_prediction,
                    away: p.away_prediction,
                    points: calcPoints(parseInt(p.home_prediction), parseInt(p.away_prediction)),
                    users: []
                };
            }
            groups[key].users.push(p.username);
        });

        const sortedGroups = Object.values(groups).sort((a, b) => {
            if (hasRealResult && (b.points ?? -1) !== (a.points ?? -1)) return (b.points ?? -1) - (a.points ?? -1);
            return b.users.length - a.users.length;
        });
        sortedGroups.forEach(g => g.users.sort((a, b) => a.localeCompare(b, 'fa')));

        const pointsBadge = (points) => {
            if (points === null) return '';
            const colors = {
                10: { bg: 'rgba(52,211,153,0.15)', fg: 'var(--green)', border: 'rgba(52,211,153,0.3)' },
                7:  { bg: 'rgba(255,59,78,0.15)', fg: 'var(--accent)', border: 'rgba(255,59,78,0.3)' },
                5:  { bg: 'rgba(240,192,64,0.15)', fg: 'var(--gold)',   border: 'rgba(240,192,64,0.3)' },
                2:  { bg: 'var(--bg-elevated)',    fg: 'var(--text-muted)', border: 'var(--border-subtle)' },
            };
            const c = colors[points] || colors[2];
            return `<span style="font-size:11px; font-weight:800; color:${c.fg}; background:${c.bg}; border:1px solid ${c.border}; padding:3px 9px; border-radius:7px; white-space:nowrap;">⭐ ${points} امتیاز</span>`;
        };

        bodyEl.innerHTML = realResultBlock + sortedGroups.map(g => `
            <div style="margin-bottom:12px; background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:10px; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 12px; background:rgba(255,59,78,0.06); border-bottom:1px solid var(--border-subtle);">
                    <span style="font-size:13px; font-weight:800; color:var(--accent); display:flex; align-items:center; gap:6px; white-space:nowrap;">
                        <span style="font-size:10px; color:var(--text-muted); font-weight:600;">${homeName}</span>
                        <span>${g.home} – ${g.away}</span>
                        <span style="font-size:10px; color:var(--text-muted); font-weight:600;">${awayName}</span>
                    </span>
                    ${pointsBadge(g.points)}
                </div>
                <div style="padding:8px 12px; display:flex; flex-direction:column; gap:6px;">
                    ${g.users.map(u => `<span style="font-size:13px; color:var(--text-primary); font-weight:600;">👤 ${u}</span>`).join('')}
                </div>
            </div>
        `).join('') + notPredictedBlock;

    } catch (err) {
        console.error('خطا در دریافت پیش‌بینی‌ها:', err);
        bodyEl.innerHTML = `<p style="text-align:center; color:#ff3b30; padding:20px 0;">خطا در بارگذاری: ${err.message}</p>`;
    }
};

// ==========================================
// بررسی و رفع پیش‌بینی‌های تکراری (یک کاربر/یک بازی چند رکورد)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const checkBtn = document.getElementById('checkDuplicatePredsBtn');
    if (!checkBtn) return;
    checkBtn.addEventListener('click', () => runDuplicatePredsScan(checkBtn));
});

async function runDuplicatePredsScan(checkBtn) {
    const resultEl = document.getElementById('duplicatePredsResult');
    checkBtn.disabled = true;
    const originalText = '🔍 بررسی موارد تکراری';
    checkBtn.textContent = '⏳ در حال بررسی…';
    resultEl.innerHTML = '';

    try {
        const [{ data: predictions }, { data: matches }, { data: teams }] = await Promise.all([
            supabaseClient.from('predictions').select('*').order('id', { ascending: true }),
            supabaseClient.from('matches').select('id, team_home_id, team_away_id'),
            supabaseClient.from('teams').select('*')
        ]);

        const teamsMap = {};
        (teams || []).forEach(t => { teamsMap[t.id] = t.name; });
        const matchesMap = {};
        (matches || []).forEach(m => { matchesMap[m.id] = m; });

        // فقط رکوردهایی که واقعاً مقدار پیش‌بینی دارند (نه null/خالی) را در نظر می‌گیریم
        const isValidPred = p => p.home_prediction !== null && p.away_prediction !== null &&
            p.home_prediction !== '' && p.away_prediction !== '';

        // گروه‌بندی بر اساس username + match_id
        const groups = {};
        (predictions || []).forEach(p => {
            if (!isValidPred(p)) return;
            const key = `${p.username}_${p.match_id}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        const dupGroups = Object.values(groups).filter(g => g.length > 1);

        if (dupGroups.length === 0) {
            resultEl.innerHTML = `<p style="font-size:12px;color:var(--green);padding:10px 0;text-align:center;">✅ هیچ پیش‌بینی تکراری پیدا نشد. همه چیز سالم است.</p>`;
            return;
        }

        window._duplicatePredGroups = dupGroups;

        let html = `<p style="font-size:12px;color:var(--red);font-weight:700;margin-bottom:10px;">⚠️ ${dupGroups.length} مورد پیش‌بینی تکراری پیدا شد:</p>`;

        dupGroups.forEach((g, idx) => {
            const sample = g[0];
            const match = matchesMap[sample.match_id];
            const homeName = match ? (teamsMap[match.team_home_id] || '—') : 'بازی نامشخص';
            const awayName = match ? (teamsMap[match.team_away_id] || '—') : '';
            const sorted = [...g].sort((a, b) => Number(a.id) - Number(b.id));

            html += `
            <div class="dup-pred-group" style="border:1px solid var(--border-subtle); border-radius:10px; margin-bottom:10px; overflow:hidden; background:var(--bg-elevated);">
                <div style="padding:8px 12px; background:rgba(248,113,113,0.06); border-bottom:1px solid var(--border-subtle); font-size:12px; font-weight:700; color:var(--text-primary);">
                    👤 ${sample.username} — ${homeName} ${awayName ? '⚔️ ' + awayName : ''} (شناسه بازی: ${sample.match_id})
                </div>
                <div style="padding:8px 12px; display:flex; flex-direction:column; gap:6px;">
                    ${sorted.map((p, i) => `
                        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text-secondary);">
                            <span>رکورد ${i === sorted.length - 1 ? '(آخرین — نگه‌داشته می‌شود)' : '(حذف/غیرفعال می‌شود)'} — id: ${p.id}</span>
                            <span style="font-weight:800;color:${i === sorted.length - 1 ? 'var(--green)' : 'var(--red)'};">${p.home_prediction} - ${p.away_prediction}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="padding:8px 12px; border-top:1px solid var(--border-subtle);">
                    <button class="btn-success" style="font-size:11px;padding:6px 12px;" onclick="fixDuplicatePredGroup(${idx}, this)">✅ حذف موارد تکراری (نگه‌داشتن آخرین)</button>
                </div>
            </div>`;
        });

        html += `<button class="btn-success" id="fixAllDupBtn" style="margin-top:6px;width:100%;" onclick="fixAllDuplicatePredGroups(this)">✅ اصلاح همه موارد تکراری یکجا</button>`;

        resultEl.innerHTML = html;

    } catch (err) {
        resultEl.innerHTML = `<p style="color:var(--red);font-size:12px;text-align:center;">خطا: ${err.message}</p>`;
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = originalText;
    }
}

// ─── تلاش برای حذف کامل رکوردها؛ اگر به هر دلیلی (مثلاً محدودیت دسترسی) حذف انجام نشد،
// مقدار پیش‌بینی آن‌ها صفر/خالی می‌شود تا در محاسبه امتیاز هیچ‌گاه شرکت نکنند ───
async function removeOrDisablePredictionRows(ids) {
    if (!ids || ids.length === 0) return { deleted: 0, disabled: 0, error: null };

    const delRes = await supabaseClient.from('predictions').delete().in('id', ids);

    // تأیید نتیجه با کوئری مجدد — برخی محدودیت‌های دسترسی بدون اعلام خطا، حذف را نادیده می‌گیرند
    const { data: stillThere, error: checkErr } = await supabaseClient
        .from('predictions').select('id').in('id', ids);

    if (checkErr) {
        return { deleted: 0, disabled: 0, error: checkErr };
    }

    const remainingIds = (stillThere || []).map(r => r.id);

    if (remainingIds.length > 0) {
        const { error: updErr } = await supabaseClient
            .from('predictions')
            .update({ home_prediction: null, away_prediction: null })
            .in('id', remainingIds);

        if (updErr) {
            return { deleted: ids.length - remainingIds.length, disabled: 0, error: updErr };
        }
    }

    return {
        deleted: ids.length - remainingIds.length,
        disabled: remainingIds.length,
        error: delRes.error || null
    };
}

window.fixDuplicatePredGroup = async (idx, btn) => {
    const group = window._duplicatePredGroups?.[idx];
    if (!group) return;
    const sorted = [...group].sort((a, b) => Number(a.id) - Number(b.id));
    const extraIds = sorted.slice(0, -1).map(p => p.id);

    btn.disabled = true;
    btn.textContent = '⏳ در حال حذف…';

    const res = await removeOrDisablePredictionRows(extraIds);
    if (res.error) {
        showFloatingToast('خطا: ' + res.error.message, 'warning');
        btn.disabled = false;
        btn.textContent = '✅ حذف موارد تکراری (نگه‌داشتن آخرین)';
        return;
    }

    let msg = '';
    if (res.deleted > 0) msg += `${res.deleted} رکورد حذف شد. `;
    if (res.disabled > 0) msg += `${res.disabled} رکورد به‌دلیل محدودیت دسترسی، غیرفعال (بدون امتیاز) شد.`;
    showFloatingToast('✅ ' + msg, 'success');

    // اسکن مجدد برای نمایش وضعیت واقعی
    const checkBtn = document.getElementById('checkDuplicatePredsBtn');
    if (checkBtn) runDuplicatePredsScan(checkBtn);
};

window.fixAllDuplicatePredGroups = async (btn) => {
    const groups = window._duplicatePredGroups || [];
    if (groups.length === 0) return;

    let allExtraIds = [];
    groups.forEach(g => {
        const sorted = [...g].sort((a, b) => Number(a.id) - Number(b.id));
        allExtraIds = allExtraIds.concat(sorted.slice(0, -1).map(p => p.id));
    });

    btn.disabled = true;
    btn.textContent = '⏳ در حال اصلاح همه موارد…';

    const res = await removeOrDisablePredictionRows(allExtraIds);
    if (res.error) {
        showFloatingToast('خطا: ' + res.error.message, 'warning');
        btn.disabled = false;
        btn.textContent = '✅ اصلاح همه موارد تکراری یکجا';
        return;
    }

    let msg = '';
    if (res.deleted > 0) msg += `${res.deleted} رکورد حذف شد. `;
    if (res.disabled > 0) msg += `${res.disabled} رکورد به‌دلیل محدودیت دسترسی، غیرفعال (بدون امتیاز) شد.`;
    showFloatingToast('✅ ' + msg + ' امتیازها از این پس صحیح محاسبه می‌شوند.', 'success');

    // اسکن مجدد برای نمایش وضعیت واقعی
    const checkBtn = document.getElementById('checkDuplicatePredsBtn');
    if (checkBtn) runDuplicatePredsScan(checkBtn);
};
