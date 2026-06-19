/**
 * سیستم مدیریت ثبت‌نام جایزه، تعهد مالی و تزریق نشان «کاربر پریمیوم»
 * نسخه اصلاح‌شده: کوئری DB هر 2 ثانیه حذف شد - از cache استفاده می‌شود
 */

const CHALLENGE_DEADLINE = new Date('2026-06-11T22:30:00');

function isChallengeExpired() {
    return new Date() > CHALLENGE_DEADLINE;
}

// کش لیست کاربران پریمیوم (برای جلوگیری از کوئری مکرر به DB)
let _cachedPremiumUsernames = null;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initRewardRegistration, 1000);
    // بارگذاری یک‌بار اولیه کاربران پریمیوم و سپس اعمال نشان
    loadPremiumUsersAndApplyBadges();
    // بررسی هر ۳۰ ثانیه یک‌بار (نه هر ۲ ثانیه)
    setInterval(loadPremiumUsersAndApplyBadges, 30000);
});

async function loadPremiumUsersAndApplyBadges() {
    try {
        const { data: premiumUsers, error } = await supabaseClient
            .from('project_users')
            .select('username')
            .eq('is_eligible_for_reward', true);

        if (error || !premiumUsers) return;

        _cachedPremiumUsernames = premiumUsers.map(u => u.username);
        applyPremiumBadgesFromCache();
    } catch (err) {
        console.error("خطا در بارگذاری کاربران پریمیوم:", err);
    }
}

function applyPremiumBadgesFromCache() {
    if (!_cachedPremiumUsernames || _cachedPremiumUsernames.length === 0) return;

    const tableRows = document.querySelectorAll('table tbody tr, .leaderboard-row');
    if (tableRows.length === 0) return;

    tableRows.forEach(row => {
        const textContent = row.textContent.trim();

        _cachedPremiumUsernames.forEach(premiumName => {
            if (textContent.includes(premiumName) && !row.querySelector('.premium-badge')) {
                const targetSpan = Array.from(row.querySelectorAll('span, td')).find(el => {
                    return el.textContent.trim().startsWith(premiumName) || el.textContent.trim() === premiumName;
                });

                if (targetSpan) {
                    targetSpan.style.display = 'inline-flex';
                    targetSpan.style.alignItems = 'center';
                    targetSpan.style.gap = '6px';
                    targetSpan.innerHTML += `<span class="premium-badge">💎 پریمیوم</span>`;
                }
            }
        });
    });
}

// صادر کردن تابع برای استفاده خارجی (مثلاً بعد از رندر جدول)
window.applyPremiumBadgesToLeaderboard = applyPremiumBadgesFromCache;

async function initRewardRegistration() {
    const userRole = localStorage.getItem('userRole');
    const currentUsername = localStorage.getItem('loggedInUser');

    if (userRole === 'admin' || !currentUsername) return;

    try {
        const { data: userData, error } = await supabaseClient
            .from('project_users')
            .select('is_eligible_for_reward, card_number')
            .eq('username', currentUsername)
            .single();

        if (error) throw error;

        renderRewardBox(userData || { is_eligible_for_reward: false, card_number: '' });

    } catch (err) {
        console.error("خطا در بارگذاری سیستم جایزه:", err);
    }
}

function renderRewardBox(userStatus) {
    const appContent = document.querySelector('.app-content');
    if (!appContent) return;
    if (document.getElementById('rewardRegistrationBox')) return;

    if (!document.getElementById('rewardBoxStyles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'rewardBoxStyles';
        styleTag.innerHTML = `
            .reward-box {
                background: rgba(30,41,59,0.4) !important;
                backdrop-filter: blur(16px) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 16px !important;
                padding: 20px !important;
                margin-bottom: 20px;
                color: #ffffff;
                direction: rtl;
                text-align: right;
                box-shadow: 0 8px 32px 0 rgba(0,0,0,0.3);
            }
            .reward-title {
                font-size: 16px !important; font-weight: bold !important;
                color: #38bdf8 !important; margin-bottom: 10px !important;
                display: flex; align-items: center; gap: 8px;
            }
            .reward-law-text {
                font-size: 13px !important; color: #94a3b8 !important;
                line-height: 1.6 !important; margin-bottom: 15px !important;
            }
            .reward-law-text b { color: #f43f5e; }
            .switch-container {
                display: flex; align-items: center; gap: 10px;
                cursor: pointer; user-select: none; margin-bottom: 15px;
            }
            .switch-container.disabled { cursor: not-allowed; opacity: 0.6; }
            .reward-checkbox { width: 20px; height: 20px; cursor: pointer; accent-color: #38bdf8; }
            .reward-checkbox:disabled { cursor: not-allowed; opacity: 0.5; }
            .card-input-container { position: relative; display: flex; align-items: center; width: 100%; }
            .card-input-wrapper { display: block; transition: all 0.3s ease; max-height: 0; overflow: hidden; opacity: 0; }
            .card-input-wrapper.show { max-height: 150px; opacity: 1; margin-top: 10px; }
            .card-input {
                width: 100%;
                background: rgba(15,23,42,0.6) !important;
                border: 1px solid rgba(255,255,255,0.2) !important;
                border-radius: 8px !important;
                padding: 10px 45px 10px 12px !important;
                color: #ffffff !important;
                font-family: monospace !important;
                letter-spacing: 2px; text-align: center; font-size: 16px !important; outline: none;
            }
            .card-input:focus { border-color: #38bdf8 !important; }
            .card-input:disabled { background: rgba(15,23,42,0.3) !important; color: #64748b !important; cursor: not-allowed; }
            .btn-save-reward {
                background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%) !important;
                color: white !important; border: none !important;
                padding: 8px 16px !important; border-radius: 8px !important;
                font-size: 13px !important; font-weight: bold !important;
                cursor: pointer; margin-top: 12px; width: 100%; transition: opacity 0.2s;
            }
            .btn-save-reward:hover { opacity: 0.9; }
            .btn-save-reward:disabled {
                background: #1e293b !important; color: #94a3b8 !important;
                border: 1px solid #334155 !important; cursor: not-allowed; box-shadow: none !important;
            }
            .expired-notice {
                background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2);
                color: #f43f5e; padding: 10px; border-radius: 8px;
                text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 15px;
            }
            .already-registered-notice {
                background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2);
                color: #10b981; padding: 10px; border-radius: 8px;
                text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 15px;
            }
        `;
        document.head.appendChild(styleTag);
    }

    const rewardBox = document.createElement('div');
    rewardBox.id = 'rewardRegistrationBox';
    rewardBox.className = 'reward-box';

    const expired = isChallengeExpired();
    const isChecked = userStatus.is_eligible_for_reward === true;
    const cardValue = userStatus.card_number || '';
    const isDisabled = expired || isChecked;

    let noticeHtml = '';
    if (expired) {
        noticeHtml = `<div class="expired-notice">🔒 مهلت شرکت در این چالش (2026/06/11 ساعت 22:30) به پایان رسیده است.</div>`;
    } else if (isChecked) {
        noticeHtml = `<div class="already-registered-notice">✅ شما در این چالش شرکت کرده‌اید و اطلاعات شما قفل شده است.</div>`;
    }

    let buttonText = 'ذخیره و ثبت وضعیت در سیستم';
    if (expired) buttonText = 'ثبت‌نام غیرفعال است (پایان مهلت)';
    if (isChecked) buttonText = '🔒 شما شرکت کرده‌اید و امکان تغییر وجود ندارد';

    // اگر مهلت تمام شده، جزئیات را پشت دکمه مخفی می‌کنیم
    const detailsId = 'rewardBoxDetails';
    const toggleBtnId = 'rewardBoxToggleBtn';

    rewardBox.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:${expired || isChecked ? '10px' : '0'};">
            <div class="reward-title" style="margin-bottom:0;"><span>🎁 طرح بزرگ جایزه و چالش مالی مسابقات</span></div>
            ${expired || isChecked ? `
            <button id="${toggleBtnId}" onclick="(function(){
                var d=document.getElementById('${detailsId}');
                var b=document.getElementById('${toggleBtnId}');
                var open=d.style.display==='block';
                d.style.display=open?'none':'block';
                b.innerHTML=open?'<span style=\\'margin-left:5px;\\'>جزئیات</span><span style=\\'font-size:10px;\\'>▾</span>':'<span style=\\'margin-left:5px;\\'>بستن</span><span style=\\'font-size:10px;\\'>▴</span>';
            })()" style="
                display:inline-flex;align-items:center;gap:4px;
                font-size:11px;font-weight:700;
                padding:6px 14px;
                border-radius:20px;
                border:1px solid rgba(99,133,255,0.25);
                background:rgba(99,133,255,0.08);
                color:#6385ff;
                cursor:pointer;
                font-family:var(--font,inherit);
                flex-shrink:0;
                transition:all 0.18s;
            " onmouseover="this.style.background='rgba(99,133,255,0.16)'" onmouseout="this.style.background='rgba(99,133,255,0.08)'">
                <span style="margin-left:5px;">جزئیات</span><span style="font-size:10px;">▾</span>
            </button>` : ''}
        </div>
        ${noticeHtml}
        <div id="${detailsId}" style="display:${expired || isChecked ? 'none' : 'block'};">
            <p class="reward-law-text">
                <b>قانون مسابقه:</b> در صورت فعال‌سازی این تیک، شما مشمول دریافت جایزه بزرگ مسابقات (در صورت اول شدن) خواهید بود.
                توجه داشته باشید که <b>مهلت شرکت در این چالش تا تاریخ 2026/06/11 ساعت 22:30 می‌باشد.</b>
                همچنین در صورت باخت، <b>متعهد می‌شوید که مبلغ ۳۰۰ هزار تومان به نفر اول جدول پرداخت کنید.</b>
                جهت تایید، تیک زیر را زده و شماره کارت خود را وارد نمایید.
            </p>
            <label class="switch-container ${isDisabled ? 'disabled' : ''}">
                <input type="checkbox" id="chkEligible" class="reward-checkbox" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                <span>این شرط و قانون مالی را می‌پذیرم و وارد چالش می‌شوم.</span>
            </label>
            <div id="cardWrapper" class="card-input-wrapper ${isChecked ? 'show' : ''}">
                <label style="display:block; margin-bottom:5px; font-size:12px; color:#cbd5e1;">شماره کارت ۱۶ رقمی بانکی شما:</label>
                <div class="card-input-container">
                    <input type="text" id="txtCardNumber" class="card-input" placeholder="---- ---- ---- ----" maxlength="16" value="${cardValue}" ${isDisabled ? 'disabled' : ''}>
                </div>
            </div>
            <button id="btnSaveReward" class="btn-save-reward" onclick="saveRewardStatus()" ${isDisabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        </div>
    `;

    appContent.insertBefore(rewardBox, appContent.firstChild);

    if (!isDisabled) {
        document.getElementById('chkEligible').addEventListener('change', function() {
            const wrapper = document.getElementById('cardWrapper');
            if (this.checked) {
                wrapper.classList.add('show');
            } else {
                wrapper.classList.remove('show');
                document.getElementById('txtCardNumber').value = '';
            }
        });
    }
}


async function saveRewardStatus() {
    if (isChallengeExpired()) {
        showFloatingToast("متأسفیم، مهلت زمان ثبت‌نام به پایان رسیده است.", "error");
        return;
    }

    const currentUsername = localStorage.getItem('loggedInUser');
    const isEligible = document.getElementById('chkEligible').checked;
    const cardNumber = document.getElementById('txtCardNumber').value.trim();
    const btn = document.getElementById('btnSaveReward');

    if (isEligible && cardNumber.length < 16) {
        showFloatingToast("لطفاً شماره کارت ۱۶ رقمی خود را به صورت کامل وارد کنید.", "warning");
        return;
    }

    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:btnSpin 0.8s linear infinite;margin-left:8px;vertical-align:middle;"></span>
        در حال ثبت وضعیت...
    `;

    if (!document.getElementById('btnSpinAnimation')) {
        const spinStyle = document.createElement('style');
        spinStyle.id = 'btnSpinAnimation';
        spinStyle.innerHTML = `@keyframes btnSpin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(spinStyle);
    }

    try {
        const { error } = await supabaseClient
            .from('project_users')
            .update({
                is_eligible_for_reward: isEligible,
                card_number: isEligible ? cardNumber : null
            })
            .eq('username', currentUsername);

        if (error) throw error;

        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        btn.innerHTML = '✨ اطلاعات شما با موفقیت ذخیره شد';
        showFloatingToast("وضعیت شما با موفقیت به‌روزرسانی شد.", "success");

        setTimeout(() => {
            document.getElementById('rewardRegistrationBox').remove();
            initRewardRegistration();
        }, 2000);

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        btn.innerHTML = '❌ خطایی رخ داد! مجدداً تلاش کنید';
        showFloatingToast("خطایی در ذخیره‌سازی اطلاعات رخ داد.", "error");
        setTimeout(() => {
            btn.style.background = '';
            btn.innerHTML = originalBtnText;
        }, 3000);
    }
}

// ==========================================
// سیستم توست/مدال مرکزی
// ==========================================
function showFloatingToast(message, type = "success") {
    const oldModal = document.getElementById('customCenterModal');
    const oldOverlay = document.getElementById('customCenterModalOverlay');
    if (oldModal) oldModal.remove();
    if (oldOverlay) oldOverlay.remove();

    if (!document.getElementById('modalCenterStyles')) {
        const style = document.createElement('style');
        style.id = 'modalCenterStyles';
        style.innerHTML = `
            @keyframes modalFadeIn {
                from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            .center-modal-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(8,10,20,0.6); backdrop-filter: blur(8px);
                z-index: 99998; transition: opacity 0.3s ease;
            }
            .center-modal-box {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 90%; max-width: 450px; background: rgba(18,22,43,0.9);
                border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
                padding: 25px; z-index: 99999; text-align: center; direction: rtl;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
                animation: modalFadeIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
            }
            .modal-type-success { border-top: 4px solid #00c853; }
            .modal-type-warning { border-top: 4px solid #ffcc00; }
            .modal-type-error { border-top: 4px solid #ff3d00; }
            .modal-icon { font-size: 45px; margin-bottom: 15px; }
            .modal-text { color: #ffffff; font-size: 16px; line-height: 1.7; margin-bottom: 20px; font-weight: 500; }
            .card-copy-box {
                display: flex; align-items: center; justify-content: space-between;
                background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2);
                padding: 10px 15px; border-radius: 10px; margin: 15px 0; direction: ltr;
            }
            .card-number-text { color: #ffcc00; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
            .btn-copy {
                background: rgba(255,204,0,0.2); color: #ffcc00; border: none;
                padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;
                transition: all 0.2s ease; font-family: sans-serif;
            }
            .btn-copy:hover { background: #ffcc00; color: #000; }
            .btn-modal-close {
                background: #ffffff; color: #0f1224; border: none; padding: 10px 30px;
                border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;
                transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(255,255,255,0.1);
            }
            .btn-modal-close:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);
    }

    const cardMatch = message.match(/\d{16}/) || message.match(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/);
    let cardNumber = cardMatch ? cardMatch[0].replace(/[-\s]/g, '') : null;
    let cleanMessage = message;
    if (cardNumber) {
        cleanMessage = message.replace(`(${cardNumber})`, '').replace(cardNumber, '');
    }

    let icon = "✨";
    if (type === "success") icon = "🏆";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "❌";

    const overlay = document.createElement('div');
    overlay.className = 'center-modal-overlay';
    overlay.id = 'customCenterModalOverlay';

    const modalBox = document.createElement('div');
    modalBox.id = 'customCenterModal';
    modalBox.className = `center-modal-box modal-type-${type}`;

    let cardHtml = '';
    if (cardNumber) {
        cardHtml = `
            <div class="card-copy-box">
                <button class="btn-copy" onclick="copyCardToClipboard('${cardNumber}', this)">کپی کارت</button>
                <span class="card-number-text">${formatCardNumber(cardNumber)}</span>
            </div>
        `;
    }

    modalBox.innerHTML = `
        <div class="modal-icon">${icon}</div>
        <div class="modal-text">${cleanMessage}</div>
        ${cardHtml}
        <button class="btn-modal-close" onclick="closeCustomModal()">متوجه شدم</button>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modalBox);

    // بسته شدن با کلیک روی overlay
    overlay.addEventListener('click', closeCustomModal);
}

function closeCustomModal() {
    const overlay = document.getElementById('customCenterModalOverlay');
    const modal = document.getElementById('customCenterModal');
    if (overlay) overlay.remove();
    if (modal) modal.remove();
}

function formatCardNumber(card) {
    return card.replace(/(\d{4})(?=\d)/g, '$1 - ');
}

function copyCardToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = buttonElement.innerText;
        buttonElement.innerText = "کپی شد! ✓";
        buttonElement.style.background = "#00c853";
        buttonElement.style.color = "#fff";
        setTimeout(() => {
            buttonElement.innerText = originalText;
            buttonElement.style.background = "";
            buttonElement.style.color = "";
        }, 2000);
    }).catch(err => { console.error('خطا در کپی:', err); });
}

// ==========================================
// استایل‌های نشان پریمیوم
// ==========================================
(function injectPremiumStyles() {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
        .leaderboard-username-container {
            display: inline-flex; align-items: center; gap: 6px; direction: rtl;
        }
    `;
    document.head.appendChild(styleTag);
})();
