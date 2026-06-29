// ==========================================
// تنظیمات اتصال به دیتابیس
// ==========================================
const SUPABASE_URL = "https://rzvuvrfrkbsthzzimbce.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dnV2cmZya2JzdGh6emltYmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzIxOTEsImV4cCI6MjA5NjI0ODE5MX0.M7db1b124sf9T6-NBewgVPqix1koaytYG-5lJqNnXn8";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {

    // ⭐ بررسی لاگین خودکار
    const userRole = localStorage.getItem('userRole');
    const loggedInUser = localStorage.getItem('loggedInUser');

    if (userRole && loggedInUser) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const forgotModal = document.getElementById('forgotModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // فرآیند ورود
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passwordValue = passwordInput.value.trim();
        const ADMIN_PASSWORD = "14y88";

        if (passwordValue === "") {
            alert('لطفاً رمز عبور را وارد کنید.');
            return;
        }

        // بررسی رمز ادمین
        if (passwordValue === ADMIN_PASSWORD) {
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('loggedInUser', 'مدیرکل');
            window.location.href = 'dashboard.html';
            return;
        }

        // استعلام از دیتابیس
        try {
            const { data, error } = await supabaseClient
                .from('project_users')
                .select('username')
                .eq('password', passwordValue);

            if (error) {
                console.error("Supabase Error:", error);
                alert("خطا در پاسخ دیتابیس: " + error.message);
                return;
            }

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

    // مدیریت مودال فراموشی رمز عبور
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
