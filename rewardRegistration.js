/**
 * سیستم مدیریت ثبت‌نام جایزه، تعهد مالی و تزریق نشان «کاربر پریمیوم»
 * تاریخ انقضای چالش: 2026/06/11 ساعت 22:30
 */

// تعریف تاریخ دقیق انقضای چالش (۶ ژوئن ۲۰۲۶ ساعت ۱۲:۱۴ ظهر)
const CHALLENGE_DEADLINE = new Date('2026-06-11T22:30:00');

// تابعی برای بررسی اینکه آیا مهلت چالش تمام شده است یا خیر
function isChallengeExpired() {
    const now = new Date();
    return now > CHALLENGE_DEADLINE;
}

document.addEventListener('DOMContentLoaded', () => {
    // اجرای سیستم پس از بارگذاری صفحه برای کاربران عادی
    setTimeout(initRewardRegistration, 1000);
    
    // اجرای یک‌بار پس از لود کامل (به جای polling هر ۲ ثانیه)
    setTimeout(applyPremiumBadgesToLeaderboard, 2500); 
});

async function initRewardRegistration() {
    const userRole = localStorage.getItem('userRole');
    const currentUsername = localStorage.getItem('loggedInUser'); 

    // ادمین مشمول این طرح یا پرداخت خسارت نمی‌شود
    if (userRole === 'admin' || !currentUsername) return;

    try {
        // ۱. دریافت وضعیت فعلی کاربر از دیتابیس
        const { data: userData, error } = await supabaseClient
            .from('project_users')
            .select('is_eligible_for_reward, card_number')
            .eq('username', currentUsername)
            .single();

        if (error) throw error;

        // ۲. رندر کردن ظاهر باکس در صفحه کاربر
        renderRewardBox(userData || { is_eligible_for_reward: false, card_number: '' });

    } catch (err) {
        console.error("خطا در بارگذاری سیستم جایزه:", err);
    }
}

function renderRewardBox(userStatus) {
    const appContent = document.querySelector('.app-content');
    if (!appContent) return;

    // جلوگیری از رندر تکراری
    if (document.getElementById('rewardRegistrationBox')) return;

    // تزریق استایل‌های مدرن و گلس‌مورفیسم تاریک/فضایی (استایل‌های قبلی شما)
    if (!document.getElementById('rewardBoxStyles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'rewardBoxStyles';
        styleTag.innerHTML = `
            .reward-box {
                background: rgba(30, 41, 59, 0.4) !important;
                backdrop-filter: blur(16px) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                border-radius: 16px !important;
                padding: 20px !important;
                margin-bottom: 20px;
                color: #ffffff;
                direction: rtl;
                text-align: right;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            }
            .reward-title {
                font-size: 16px !important;
                font-weight: bold !important;
                color: #38bdf8 !important;
                margin-bottom: 10px !important;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .reward-law-text {
                font-size: 13px !important;
                color: #94a3b8 !important;
                line-height: 1.6 !important;
                margin-bottom: 15px !important;
            }
            .reward-law-text b { color: #f43f5e; }
            .switch-container {
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                user-select: none;
                margin-bottom: 15px;
            }
            .switch-container.disabled { cursor: not-allowed; opacity: 0.6; }
            .reward-checkbox {
                width: 20px;
                height: 20px;
                cursor: pointer;
                accent-color: #38bdf8;
            }
            .reward-checkbox:disabled { cursor: not-allowed; opacity: 0.5; }
            .card-input-container { position: relative; display: flex; align-items: center; width: 100%; }
            .card-input-wrapper { display: block; transition: all 0.3s ease; max-height: 0; overflow: hidden; opacity: 0; }
            .card-input-wrapper.show { max-height: 150px; opacity: 1; margin-top: 10px; }
            .card-input {
                width: 100%;
                background: rgba(15, 23, 42, 0.6) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                border-radius: 8px !important;
                padding: 10px 45px 10px 12px !important;
                color: #ffffff !important;
                font-family: monospace !important;
                letter-spacing: 2px;
                text-align: center;
                font-size: 16px !important;
                outline: none;
            }
            .card-input:focus { border-color: #38bdf8 !important; }
            .card-input:disabled { background: rgba(15, 23, 42, 0.3) !important; color: #64748b !important; cursor: not-allowed; }
            .btn-copy-card {
                position: absolute;
                right: 8px;
                background: rgba(56, 189, 248, 0.1);
                border: 1px solid rgba(56, 189, 248, 0.2);
                color: #38bdf8;
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s;
            }
            .btn-copy-card:hover { background: rgba(56, 189, 248, 0.2); }
            .btn-save-reward {
                background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%) !important;
                color: white !important;
                border: none !important;
                padding: 8px 16px !important;
                border-radius: 8px !important;
                font-size: 13px !important;
                font-weight: bold !important;
                cursor: pointer;
                margin-top: 12px;
                width: 100%;
                transition: opacity 0.2s;
            }
            .btn-save-reward:hover { opacity: 0.9; }
            .btn-save-reward:disabled {
                background: #1e293b !important;
                color: #94a3b8 !important;
                border: 1px solid #334155 !important;
                cursor: not-allowed;
                box-shadow: none !important;
            }
            .expired-notice {
                background: rgba(244, 63, 94, 0.1);
                border: 1px solid rgba(244, 63, 94, 0.2);
                color: #f43f5e;
                padding: 10px;
                border-radius: 8px;
                text-align: center;
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 15px;
            }
            .already-registered-notice {
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid rgba(16, 185, 129, 0.2);
                color: #10b981;
                padding: 10px;
                border-radius: 8px;
                text-align: center;
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 15px;
            }
        `;
        document.head.appendChild(styleTag);
    }

    const rewardBox = document.createElement('div');
    rewardBox.id = 'rewardRegistrationBox';
    rewardBox.className = 'reward-box';

    const expired = isChallengeExpired();
    const isChecked = userStatus.is_eligible_for_reward === true; // بررسی دقیق ثبت‌نام قبلی
    const cardValue = userStatus.card_number || '';

    // مدیریت پیام‌های بالای باکس
    let noticeHtml = '';
    if (expired) {
        noticeHtml = `<div class="expired-notice">🔒 مهلت شرکت در این چالش (2026/06/11 ساعت 22:30) به پایان رسیده است.</div>`;
    } else if (isChecked) {
        noticeHtml = `<div class="already-registered-notice">✅ شما در این چالش شرکت کرده‌اید و اطلاعات شما قفل شده است.</div>`;
    }

    // تعیین وضعیت غیرفعال بودن المان‌ها (اگر وقت تمام شده باشد یا کاربر قبلاً ثبت‌نام کرده باشد)
    const isDisabled = expired || isChecked;

    // تعیین متن دکمه بر اساس وضعیت
    let buttonText = 'ذخیره و ثبت وضعیت در سیستم';
    if (expired) buttonText = 'ثبت‌نام غیرفعال است (پایان مهلت)';
    if (isChecked) buttonText = '🔒 شما شرکت کرده‌اید و امکان تغییر وجود ندارد';

    rewardBox.innerHTML = `
        <div class="reward-title">
            <span>🎁 طرح بزرگ جایزه و چالش مالی مسابقات</span>
        </div>
        ${noticeHtml}
        <p class="reward-law-text">
            <b>قانون مسابقه:</b> در صورت فعال‌سازی این تیک، شما مشمول دریافت جایزه بزرگ مسابقات (در صورت اول شدن) خواهید بود. 
            توجه داشته باشید که <b>مهلت شرکت در این چالش تا تاریخ 2026/06/11 ساعت 22:30 می‌باشد.</b> 
            همچنین در صورت باخت و اول نشدن، <b>متعهد می‌شوید که مبلغ ۳۰۰ هزار تومان به نفر اول جدول پرداخت کنید.</b> 
            جهت تایید، تیک زیر را زده و شماره کارت خود را وارد نمایید.
        </p>
        
        <label class="switch-container ${isDisabled ? 'disabled' : ''}">
            <input type="checkbox" id="chkEligible" class="reward-checkbox" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
            <span>این شرط و قانون مالی را می‌پذیرم و وارد چالش می‌شوم.</span>
        </label>

        <div id="cardWrapper" class="card-input-wrapper ${isChecked ? 'show' : ''}">
            <label style="display:block; margin-bottom: 5px; font-size: 12px; color: #cbd5e1;">شماره کارت ۱۶ رقمی بانکی شما:</label>
            <div class="card-input-container">
                <input type="text" id="txtCardNumber" class="card-input" placeholder="---- ---- ---- ----" maxlength="16" value="${cardValue}" ${isDisabled ? 'disabled' : ''}>
                <button class="btn-copy-card" type="button" onclick="copyCardNumber()">📋 کپی</button>
            </div>
        </div>

        <button id="btnSaveReward" class="btn-save-reward" onclick="saveRewardStatus()" ${isDisabled ? 'disabled' : ''}>
            ${buttonText}
        </button>
    `;

    appContent.insertBefore(rewardBox, appContent.firstChild);

    // لیسنر تغییر وضعیت چک‌باکس (فقط در صورتی کار می‌کند که قفل نباشد)
    if (!isDisabled) {
        document.getElementById('chkEligible').addEventListener('change', function() {
            const wrapper = document.getElementById('cardWrapper');
            if(this.checked) {
                wrapper.classList.add('show');
            } else {
                wrapper.classList.remove('show');
                document.getElementById('txtCardNumber').value = '';
            }
        });
    }
}

// مطمئن شوید تابع کپی شما دقیقاً به این شکل است و از showFloatingToast استفاده می‌کند:
function copyCardNumber() {
    const cardInput = document.getElementById('txtCardNumber');
    if (!cardInput || !cardInput.value.trim()) {
        showFloatingToast("شماره کارتی برای کپی کردن وجود ندارد!", "warning"); // جایگزین آلرت بی‌روح
        return;
    }
    
    cardInput.select();
    cardInput.setSelectionRange(0, 99999); 

    navigator.clipboard.writeText(cardInput.value)
        .then(() => {
            showFloatingToast("شماره کارت با موفقیت در کلیپ‌بورد کپی شد. 💳", "success");
        })
        .catch(() => {
            try {
                document.execCommand('copy');
                showFloatingToast("شماره کارت با موفقیت کپی شد. 💳", "success");
            } catch (err) {
                showFloatingToast("خطایی در کپی شماره کارت رخ داد.", "error");
            }
        });
}

// تابع ثبت اطلاعات در دیتابیس سوبابیس با گرافیک و افکت بارگذاری مدرن
async function saveRewardStatus() {
    if (isChallengeExpired()) {
        showFloatingToast("متأسفیم، مهلت زمان ثبت‌نام و ورود به چالش به پایان رسیده است.", "error");
        return;
    }

    const currentUsername = localStorage.getItem('loggedInUser');
    const isEligible = document.getElementById('chkEligible').checked;
    const cardNumber = document.getElementById('txtCardNumber').value.trim();
    const btn = document.getElementById('btnSaveReward');

    if (isEligible && cardNumber.length < 16) {
        showFloatingToast("لطفاً شماره کارت ۱۶ رقمی خود را به صورت کامل و صحیح وارد کنید.", "warning");
        return;
    }

    // --- شروع تغییرات گرافیکی دکمه (حالت بارگذاری) ---
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.innerHTML = `
        <span class="btn-loading-spinner" style="
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: btnSpin 0.8s linear infinite;
            margin-left: 8px;
            vertical-align: middle;
        "></span>
        در حال ارتباط با سرور و ثبت وضعیت...
    `;

    if (!document.getElementById('btnSpinAnimation')) {
        const spinStyle = document.createElement('style');
        spinStyle.id = 'btnSpinAnimation';
        spinStyle.innerHTML = `@keyframes btnSpin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(spinStyle);
    }
    // --- پایان تغییرات گرافیکی دکمه ---

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
        // داخل تابع saveRewardStatus بعد از ثبت موفقیت آمیز:
showFloatingToast("وضعیت شما با موفقیت به‌روزرسانی شد و در سیستم محفوظ است.", "success");

setTimeout(() => {
    // بازخوانی سیستم برای اعمال قفل بدون نیاز به رفرش دستی کاربر
    document.getElementById('rewardRegistrationBox').remove();
    initRewardRegistration();
}, 2000);

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'; 
        btn.innerHTML = '❌ خطایی رخ داد! مجدداً تلاش کنید';
        showFloatingToast("خطایی در ذخیره‌سازی اطلاعات رخ داد. مجدداً تلاش کنید.", "error");
        
        setTimeout(() => {
            btn.style.background = '';
            btn.innerHTML = originalBtnText;
        }, 3000);
    }
}

// تابع نمایش پیام مدرن و کهکشانی در وسط صفحه با قابلیت بستن دستی و کپی کارت
function showFloatingToast(message, type = "success") {
    // حذف مپینگ‌های قدیمی اگر وجود داشته باشند
    const oldModal = document.getElementById('customCenterModal');
    if (oldModal) oldModal.remove();

    // ساخت تگ استایل برای انیمیشن‌ها و طراحی مدرن شیشه‌ای (Glassmorphic)
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
                background: rgba(8, 10, 20, 0.6); backdrop-filter: blur(8px);
                z-index: 99998; transition: opacity 0.3s ease;
            }
            .center-modal-box {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 90%; max-width: 450px; background: rgba(18, 22, 43, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
                padding: 25px; z-index: 99999; text-align: center; direction: rtl;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1);
                animation: modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            .modal-type-success { border-top: 4px solid #00c853; }
            .modal-type-warning { border-top: 4px solid #ffcc00; }
            .modal-type-error { border-top: 4px solid #ff3d00; }
            
            .modal-icon { font-size: 45px; margin-bottom: 15px; }
            .modal-text { color: #ffffff; font-size: 16px; line-height: 1.7; margin-bottom: 20px; font-weight: 500; }
            
            /* استایل باکس کپی شماره کارت */
            .card-copy-box {
                display: flex; align-items: center; justify-content: space-between;
                background: rgba(255, 255, 255, 0.05); border: 1px dashed rgba(255, 255, 255, 0.2);
                padding: 10px 15px; border-radius: 10px; margin: 15px 0; direction: ltr;
            }
            .card-number-text { color: #ffcc00; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
            .btn-copy {
                background: rgba(255, 204, 0, 0.2); color: #ffcc00; border: none;
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

    // استخراج شماره کارت از متن پیام (اگر وجود داشته باشد)
    // این ریجکس به دنبال یک رشته عددی ۱۶ رقمی یا فرمت کارت می‌گردد
    const cardMatch = message.match(/\d{16}/) || message.match(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/);
    let cardNumber = cardMatch ? cardMatch[0].replace(/[-\s]/g, '') : null;

    // تمیز کردن متن پیام از پرانتزهای شماره کارت برای ظاهر زیباتر
    let cleanMessage = message;
    if (cardNumber) {
        cleanMessage = message.replace(`(${cardNumber})`, '').replace(cardNumber, '');
    }

    // انتخاب ایموجی بر اساس نوع پیام
    let icon = "✨";
    if (type === "success") icon = "🏆";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "❌";

    // ایجاد المان‌های مودال
    const overlay = document.createElement('div');
    overlay.className = 'center-modal-overlay';
    overlay.id = 'customCenterModalOverlay';

    const modalBox = document.createElement('div');
    modalBox.id = 'customCenterModal';
    modalBox.className = `center-modal-box modal-type-${type}`;

    // ساختار داخلی پیام
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

    // افزودن به صفحه
    document.body.appendChild(overlay);
    document.body.appendChild(modalBox);
}

// تابع بستن مودال
function closeCustomModal() {
    const overlay = document.getElementById('customCenterModalOverlay');
    const modal = document.getElementById('customCenterModal');
    if (overlay) overlay.remove();
    if (modal) modal.remove();
}

// تابع کمکی برای فرمت‌دهی ۴ رقم ۴ رقم شماره کارت
function formatCardNumber(card) {
    return card.replace(/(\d{4})(?=\d)/g, '$1 - ');
}

// تابع کپی کردن کدهای شماره کارت در کلیپ‌بورد کاربر
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
    }).catch(err => {
        console.error('خطا در کپی شماره کارت:', err);
    });
}

/**
 * سیستم خودکار تزریق نشان «کاربر پریمیوم» به جدول رتبه‌بندی
 */
(function injectPremiumStyles() {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
        .premium-badge {
            background: linear-gradient(135deg, #ffe066 0%, #f59f00 100%) !important;
            color: #1c1c1e !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            padding: 2px 8px !important;
            border-radius: 50px !important;
            margin-right: 8px;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            box-shadow: 0 0 12px rgba(245, 159, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.4);
            vertical-align: middle;
            animation: premiumGlowPulse 1.5s infinite alternate;
        }

        @keyframes premiumGlowPulse {
            0% { box-shadow: 0 0 6px rgba(245, 159, 0, 0.3); transform: scale(1); }
            100% { box-shadow: 0 0 16px rgba(245, 159, 0, 0.7); transform: scale(1.02); }
        }

        .leaderboard-username-container {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            direction: rtl;
        }
    `;
    document.head.appendChild(styleTag);
})();

async function applyPremiumBadgesToLeaderboard() {
    const tableRows = document.querySelectorAll('table tbody tr, .leaderboard-row');
    if (tableRows.length === 0) return;

    try {
        const { data: premiumUsers, error } = await supabaseClient
            .from('project_users')
            .select('username')
            .eq('is_eligible_for_reward', true);

        if (error || !premiumUsers) return;

        const premiumUsernames = premiumUsers.map(u => u.username);

        tableRows.forEach(row => {
            const textContent = row.textContent.trim();
            
            premiumUsernames.forEach(premiumName => {
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

    } catch (err) {
        console.error("خطا در سیستم تزریق تگ پریمیوم:", err);
    }
}