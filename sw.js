// sw.js - شنونده نوتیفیکیشن‌های دریافتی در پس‌زمینه گوشی
self.addEventListener('push', function(event) {
    let data = { title: '⚽ پیش‌بینی جام جهانی', body: 'بازی‌های جدید قفل خواهند شد!' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'icons/icon-192x192.png', // آیکون برنامه شما
        badge: 'icons/badge-72x72.png', // آیکون کوچک استاتوس بار
        vibrate: [200, 100, 200],
        direction: 'rtl', // نمایش درست متن‌های فارسی
        data: {
            url: 'dashboard.html' // صفحه‌ای که با کلیک روی نوتیفیکیشن باز می‌شود
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// مدیریت کلیک روی نوتیفیکیشن
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});