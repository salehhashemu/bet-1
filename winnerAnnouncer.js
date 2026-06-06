/**
 * سیستم هوشمند اعلام برنده نهایی مسابقات پیش‌بینی جام جهانی 2026
 * به همراه دکمه اختصاصی و انیمیشنی اهدای جایزه
 */

document.addEventListener('DOMContentLoaded', () => {
    // اجرای تابع پس از اتمام لود کامل المان‌های صفحه
    setTimeout(checkTournamentCompletion, 1500); 
});

async function checkTournamentCompletion() {
    // اگر کاربر ادمین باشد، نیازی به نمایش پیام تبریک قهرمانی به خودش نیست
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') return;

    try {
        // ۱. دریافت اطلاعات آنی از دیتابیس سوبابیس
        const { data: matches } = await supabaseClient.from('matches').select('*');
        const { data: users } = await supabaseClient.from('project_users').select('username');
        const { data: allPredictions } = await supabaseClient.from('predictions').select('*');

        if (!matches || matches.length === 0) return;

        const totalMatchesCount = matches.length;
const settledMatchesCount = matches.filter(m => m.home_score !== null && m.away_score !== null).length;

// شرط اصلاح شده: بررسی اتمام دقیق هر 104 بازی جام جهانی
if (settledMatchesCount === 104 && totalMatchesCount === 104) {
            
            // ۳. محاسبه دقیق امتیازات تمام کاربران برای یافتن نفر اول
            const userScores = {};
            users?.forEach(u => { userScores[u.username] = 0; });

            allPredictions?.forEach(pred => {
                const match = matches.find(m => String(m.id) === String(pred.match_id));
                if (match && match.home_score !== null && match.away_score !== null) {
                    const prH = parseInt(pred.home_prediction);
                    const prA = parseInt(pred.away_prediction);
                    const reH = parseInt(match.home_score);
                    const reA = parseInt(match.away_score);

                    if (!isNaN(prH) && !isNaN(prA) && !isNaN(reH) && !isNaN(reA)) {
                        let realWinner = reH > reA ? 1 : (reA > reH ? 2 : 0);
                        let predWinner = prH > prA ? 1 : (prA > prH ? 2 : 0);
                        const realDiff = reH - reA;
                        const predDiff = prH - prA;

                        if (prH === reH && prA === reA) userScores[pred.username] += 10;
                        else if (realWinner === predWinner && realDiff === predDiff) userScores[pred.username] += 7;
                        else if (realWinner === predWinner) userScores[pred.username] += 5;
                        else userScores[pred.username] += 2;
                    }
                }
            });

            // مرتب‌سازی لیست بر اساس امتیاز برای مشخص شدن قهرمان
            const leaderboard = Object.keys(userScores).map(username => ({
                username: username,
                score: userScores[username]
            })).sort((a, b) => b.score - a.score);

            if (leaderboard.length > 0) {
                const champion = leaderboard[0].username; // نام کاربری نفر اول
                renderChampionBanner(champion);
            }
        }
    } catch (error) {
        console.error("Error in winner announcer system:", error);
    }
}

// تابع رندر کردن باکس مدرن، انیمیشنی و شیک تبریک قهرمانی به همراه دکمه اهدای جایزه
function renderChampionBanner(championName) {
    const appContent = document.querySelector('.app-content');
    if (!appContent) return;

    if (document.getElementById('championCelebrationBox')) return;

    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
        @keyframes glowPulse {
            0% { box-shadow: 0 0 20px rgba(255, 204, 0, 0.2), inset 0 0 15px rgba(255, 204, 0, 0.1); }
            100% { box-shadow: 0 0 40px rgba(255, 204, 0, 0.5), inset 0 0 25px rgba(255, 204, 0, 0.2); }
        }
        @keyframes floatAnim {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-5px); }
            100% { transform: translateY(0px); }
        }
        @keyframes buttonGlow {
            0% { box-shadow: 0 4px 15px rgba(0, 200, 83, 0.4); }
            100% { box-shadow: 0 4px 25px rgba(0, 200, 83, 0.8); }
        }
        @keyframes btnSpin { to { transform: rotate(360deg); } }
        
        .champion-card {
            background: linear-gradient(135deg, rgba(255, 204, 0, 0.1) 0%, rgba(15, 18, 36, 0.8) 100%) !important;
            border: 2px dashed #ffcc00 !important;
            border-radius: 20px !important;
            padding: 30px 20px !important;
            text-align: center;
            margin-bottom: 25px;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(20px);
            animation: glowPulse 2s infinite alternate, floatAnim 4s infinite ease-in-out;
        }
        .champion-badge {
            font-size: 55px;
            margin-bottom: 10px;
            display: inline-block;
            filter: drop-shadow(0 0 15px #ffcc00);
        }
        .champion-title {
            font-size: 24px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            margin-bottom: 12px !important;
            text-shadow: 0 0 10px rgba(255,255,255,0.5);
        }
        .champion-name-highlight {
            color: #000000 !important;
            background: linear-gradient(90deg, #ffcc00, #ffee55);
            padding: 4px 18px;
            border-radius: 50px;
            font-weight: 900;
            display: inline-block;
            box-shadow: 0 5px 15px rgba(255, 204, 0, 0.4);
            font-size: 20px;
            margin: 5px 0 20px 0;
        }
        .btn-claim-reward {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            padding: 14px 28px !important;
            background: linear-gradient(135deg, #00c853 0%, #00b248 100%) !important;
            color: #ffffff !important;
            border: none !important;
            border-radius: 12px !important;
            font-size: 14px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            text-decoration: none;
            transition: all 0.3s ease;
            animation: buttonGlow 1.5s infinite alternate;
        }
        .btn-claim-reward:hover {
            transform: scale(1.03);
        }
        .btn-claim-reward:disabled {
            background: #2a2d34 !important;
            color: #8a8f98 !important;
            cursor: not-allowed;
            animation: none;
            box-shadow: none !important;
        }
        .champion-subtitle {
            color: #8a8f98 !important;
            font-size: 14px !important;
            margin-top: 20px !important;
            line-height: 1.6;
        }
        .btn-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: btnSpin 0.8s linear infinite;
            margin-left: 8px;
        }
    `;
    document.head.appendChild(styleTag);

    const championBox = document.createElement('div');
    championBox.id = 'championCelebrationBox';
    championBox.className = 'champion-card';
    
    championBox.innerHTML = `
        <div class="champion-badge">👑</div>
        <h2 class="champion-title">رقابت به پایان رسید!</h2>
        <p style="font-size: 16px; color: #ffee55; margin-bottom: 10px;">تبریک فراوان به قهرمان این دوره:</p>
        <div class="champion-name-highlight">✨ ${championName} ✨</div>
        
        <div>
            <button id="claimRewardBtn" class="btn-claim-reward" onclick="handleRewardClaim('${championName}')">
                <span>🎁 برای اهدای جایزه وارد شوید</span>
            </button>
        </div>

        <p class="champion-subtitle">
            شما با کسب بالاترین امتیاز در صدر جدول، <b>برنده قاطع این دوره از رقابت‌های پیش‌بینی</b> شدید! 🏆⚽
        </p>
    `;

    appContent.insertBefore(championBox, appContent.firstChild);
}

// تابع مدیریت ادعای جایزه بر اساس امضای قرارداد کاربر
async function handleRewardClaim(championName) {
    const currentLoggedInUser = localStorage.getItem('loggedInUser') || '';
    
    try {
        // ۱. دریافت مشخصات مالی قهرمان مسابقات
        const { data: champData } = await supabaseClient
            .from('project_users')
            .select('is_eligible_for_reward, card_number')
            .eq('username', championName)
            .single();

        // ۲. دریافت وضعیت قرارداد کاربر فعلی که روی دکمه کلیک کرده است
        const { data: currentUserData } = await supabaseClient
            .from('project_users')
            .select('is_eligible_for_reward')
            .eq('username', currentLoggedInUser)
            .single();

        const isCurrentUserPremium = currentUserData?.is_eligible_for_reward || false;

        if (currentLoggedInUser === championName) {
            // اگر خودِ برنده روی دکمه کلیک کرد
            if (champData && champData.is_eligible_for_reward) {
                alert(`🎉 تبریک ${championName} عزیز! شما در چالش شرکت کرده بودید. شماره کارت شما (${champData.card_number}) ثبت شده است و بازندگانی که قرارداد را امضا کرده بودند باید مبلغ را به حساب شما واریز کنند.`);
            } else {
                alert(`🎉 تبریک ${championName} عزیز! شما اول شدید، اما چون تیک طرح مالی جایزه را در پنل خود فعال نکرده بودید، مشمول دریافت جایزه ۳۰۰ هزار تومانی از بازندگان نمی‌شوید.`);
            }
        } else {
            // اگر شخص دیگری (بازنده) کلیک کرد
            if (champData && champData.is_eligible_for_reward && champData.card_number) {
                
                // شرط جدید: آیا خودِ این کاربر بازنده قرارداد را امضا کرده بود؟
                if (isCurrentUserPremium) {
                    // بله، امضا کرده پس باید پرداخت کند
                    alert(`💸 طبق قوانین مسابقه و قراردادی که امضا کردید، شما متعهد به پرداخت ۳۰۰,۰۰۰ تومان به برنده مسابقات هستید.\n\n🏆 قهرمان: ${championName}\n💳 شماره کارت واریز: ${champData.card_number}\n\nلطفاً پس از واریز، فیش آن را برای ادمین ارسال کنید.`);
                } else {
                    // خیر، امضا نکرده پس مشمول پرداخت یا دریافت نیست
                    alert(`🏆 قهرمان این دوره از مسابقات ${championName} است.\n\nشما چون وارد چالش مالی مسابقات نشده بودید، مشمول پرداخت خسارت ۳۰۰ هزار تومانی نیستید و تعهدی ندارید.`);
                }

            } else {
                alert(`🏆 قهرمان این رقابت ${championName} است. این کاربر در طرح چالش مالی شرکت نکرده بود.`);
            }
        }
    } catch (err) {
        console.error("خطا در سیستم مالی جایزه:", err);
    }
}