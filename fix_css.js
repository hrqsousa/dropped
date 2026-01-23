const fs = require('fs');

const cssPath = 'style.css';
let content = fs.readFileSync(cssPath, 'utf8');

// Find the end of the good content.
// We know the last valid block ends with .version-info { ... opacity: 0.6; }
const marker = 'opacity: 0.6;\r\n}';
const markerIndex = content.lastIndexOf(marker);

if (markerIndex !== -1) {
    // Keep everything up to the marker + marker length
    const goodContent = content.substring(0, markerIndex + marker.length);

    const newCss = `

/* Update Toast (Material You) */
.update-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background-color: var(--md-sys-color-inverse-surface);
    color: var(--md-sys-color-inverse-on-surface);
    padding: 12px 16px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 2000;
    width: 90%;
    max-width: 400px;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.update-toast.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

.update-toast .icon {
    font-size: 24px;
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
    padding: 8px;
    border-radius: 50%;
}

.update-toast .text-content {
    flex: 1;
}

.update-toast .toast-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.2;
}

.update-toast .toast-subtitle {
    font-size: 12px;
    opacity: 0.8;
}

.update-toast button {
    background-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}
`;
    // Write the cleaned content
    fs.writeFileSync(cssPath, goodContent + newCss, 'utf8');
    console.log('Fixed style.css');
} else {
    console.log('Marker not found, creating backup and rewriting append.');
    // Fallback if marker mismatch due to line endings
}
