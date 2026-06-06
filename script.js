// تنظیمات اختصاصی دیتابیس پروژه عظیم شما در ریجن توکیو
const SUPABASE_URL = "https://rzvuvrfrkbsthzzimbce.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_La0ndqo_3bHPHl-HKXtkBw_aZ74Kip2";

// راه‌اندازی کلاینت سوبابیس
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // ⭐ بخش جدید: بررسی لاگین خودکار (Remember Me Auto-Login)
    const userRole = localStorage.getItem('userRole');
    const loggedInUser = localStorage.getItem('loggedInUser');
    
    // اگر کاربر قبلاً وارد شده باشد، بدون نمایش فرم مستقیماً هدایت می‌شود
    if (userRole && loggedInUser) {
        window.location.href = 'dashboard.html';
        return; // توقف اجرای بقیه کدها
    }

    const loginForm = document.getElementById('loginForm');
    // در همان فایل script.js شما
const passwordInput = document.getElementById('password');
// بقیه کدهای قبلی بدون تغییر اجرا می‌شوند...
    
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const forgotModal = document.getElementById('forgotModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // ۱. بررسی فرآیند ورود (بدون تأخیر و با مانیتورینگ خطا)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passwordValue = passwordInput.value.trim();
        const ADMIN_PASSWORD = "14y88";

        if (passwordValue === "") {
            alert('لطفاً رمز عبور را وارد کنید.');
            return;
        }

        // بررسی رمز عبور مدیرکل (مستقل از دیتابیس کار می‌کند)
        if (passwordValue === ADMIN_PASSWORD) {
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('loggedInUser', 'مدیرکل');
            window.location.href = 'dashboard.html';
            return;
        }

        // استعلام آنی از جدول دیتابیس پروژه شما
        try {
            const { data, error } = await supabaseClient
                .from('project_users')
                .select('username')
                .eq('password', passwordValue);

            // اگر خطایی در ساختار اتصال یا نام جدول رخ دهد
            if (error) {
                console.error("Supabase Error:", error);
                alert("خطا در پاسخ دیتابیس: " + error.message);
                return;
            }

            // اگر کاربری با این رمز پیدا شد
            if (data && data.length > 0) {
                localStorage.setItem('userRole', 'user');
                localStorage.setItem('loggedInUser', data[0].username);
                window.location.href = 'dashboard.html';
            } else {
                alert('رمز عبور اشتباه است یا چنین کاربری در سیستم تعریف نشده است.');
            }

        } catch (err) {
            console.error("JS Catch Error:", err);
            alert('اتصال به سرور برقرار نشد. لطفاً وضعیت اینترنت خود را چک کنید.');
        }
    });

    // ۲. مدیریت بخش فراموشی رمز عبور (کاملاً مقاوم در برابر قفل شدن)
    forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        forgotModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        forgotModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            forgotModal.style.display = 'none';
        }
    });
});