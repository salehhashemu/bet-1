function initNavigationButtons() {
    const resultsBtn = document.getElementById('globalResultsBtn');
    if (resultsBtn) {
        resultsBtn.addEventListener('click', () => {
            window.location.href = "predictions.html";
        });
    }

    const scoresBtn = document.getElementById('scoresBtn');
    if (scoresBtn) {
        scoresBtn.addEventListener('click', () => {
            window.location.href = "scores.html";
        });
    }
}

document.addEventListener('DOMContentLoaded', initNavigationButtons);