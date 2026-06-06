function initNavigationButtons() {
    const targetUrl = "predictions.html"; // نام فایلی که ساختیم
    
    const resultsBtn = document.getElementById('globalResultsBtn');
    if (resultsBtn) {
        resultsBtn.addEventListener('click', () => {
            window.location.href = targetUrl;
        });
    }
}

document.addEventListener('DOMContentLoaded', initNavigationButtons);