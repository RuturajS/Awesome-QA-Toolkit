(function () {
    if (window.hasScreenshotRun) return;
    window.hasScreenshotRun = true;

    let startX, startY;
    let isSelecting = false;
    let isDrawing = false;
    let overlay, selectionBox;
    let buttonContainer;
    let annotationCanvas;
    let ctx;
    let capturedImage; // Stores the cropped image for annotation

    function createOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '999999';
        overlay.style.cursor = 'crosshair';
        overlay.style.background = 'rgba(0, 0, 0, 0.3)';

        selectionBox = document.createElement('div');
        selectionBox.style.border = '2px solid #00E676';
        selectionBox.style.background = 'rgba(0, 230, 118, 0.1)';
        selectionBox.style.position = 'absolute';
        selectionBox.style.display = 'none';

        overlay.appendChild(selectionBox);
        document.body.appendChild(overlay);

        overlay.addEventListener('mousedown', onMouseDown);
        overlay.addEventListener('mousemove', onMouseMove);
        overlay.addEventListener('mouseup', onMouseUp);

        document.addEventListener('keydown', onKeyDown);
    }

    function removeOverlay() {
        if (overlay) {
            document.body.removeChild(overlay);
            overlay = null;
            selectionBox = null;
            buttonContainer = null;
            annotationCanvas = null;
            capturedImage = null;
        }
        window.hasScreenshotRun = false;
        document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            removeOverlay();
        } else if ((e.key === 'Enter' || ((e.metaKey || e.ctrlKey) && e.key === 'c')) && selectionBox.style.display === 'block') {
            // Confirm copy on Enter or Ctrl+C
            e.preventDefault();
            const rect = selectionBox.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                // Use existing logic if buttonContainer is present, or just process
                processCapture(rect, 'copy');
            }
        }
    }

    function onMouseDown(e) {
        if (e.target.closest('.screenshot-btn')) return;
        if (annotationCanvas) return; // Don't restart selection if annotating

        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;

        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';

        if (buttonContainer) {
            buttonContainer.style.display = 'none';
        }
    }

    function onMouseMove(e) {
        if (isSelecting) {
            const currentX = e.clientX;
            const currentY = e.clientY;

            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const left = Math.min(currentX, startX);
            const top = Math.min(currentY, startY);

            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
            selectionBox.style.left = left + 'px';
            selectionBox.style.top = top + 'px';
        }
    }

    function onMouseUp(e) {
        if (isSelecting) {
            isSelecting = false;
            const rect = selectionBox.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) return;
            showActionButtons(rect);
        }
    }

    function showActionButtons(rect, isAnnotating = false) {
        if (buttonContainer) {
            if (buttonContainer.parentNode) buttonContainer.parentNode.removeChild(buttonContainer);
        }

        buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.left = rect.left + 'px';
        buttonContainer.style.top = (rect.bottom + 10 > window.innerHeight ? rect.top - 50 : rect.bottom + 10) + 'px';
        buttonContainer.style.zIndex = '1000000';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';

        const createBtn = (text, onClick, color) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.className = 'screenshot-btn';
            btn.style.padding = '8px 12px';
            btn.style.cursor = 'pointer';
            btn.style.background = color;
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            btn.style.fontWeight = 'bold';
            btn.style.fontSize = '14px';
            btn.onclick = (e) => {
                e.stopPropagation();
                onClick();
            };
            return btn;
        };

        if (!isAnnotating) {
            buttonContainer.appendChild(createBtn('✎ Draw', () => startAnnotation(rect), '#FF9800'));
        }

        buttonContainer.appendChild(createBtn('Copy', () => finishCapture(rect, 'copy'), '#2196F3'));
        buttonContainer.appendChild(createBtn('Save', () => finishCapture(rect, 'save'), '#4CAF50'));
        buttonContainer.appendChild(createBtn('Cancel', () => removeOverlay(), '#f44336'));

        overlay.appendChild(buttonContainer);
    }

    function startAnnotation(rect) {
        // Hide UI to capture the underlying page cleanly
        overlay.style.display = 'none';

        setTimeout(() => {
            chrome.runtime.sendMessage({ action: "captureVisibleTab" }, async (response) => {
                overlay.style.display = 'block'; // Restore overlay

                if (response && response.dataUrl) {
                    const cropArea = {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height,
                        deviceScaleFactor: window.devicePixelRatio || 1
                    };

                    const blob = await cropImage(response.dataUrl, cropArea);
                    const imageUrl = URL.createObjectURL(blob);

                    setupCanvas(imageUrl, rect);
                }
            });
        }, 100);
    }

    function setupCanvas(imageUrl, rect) {
        selectionBox.style.display = 'none'; // Hide border box
        const scale = window.devicePixelRatio || 1;

        annotationCanvas = document.createElement('canvas');
        annotationCanvas.width = rect.width * scale;
        annotationCanvas.height = rect.height * scale;
        annotationCanvas.style.position = 'absolute';
        annotationCanvas.style.left = rect.left + 'px';
        annotationCanvas.style.top = rect.top + 'px';
        annotationCanvas.style.width = rect.width + 'px';
        annotationCanvas.style.height = rect.height + 'px';
        annotationCanvas.style.cursor = 'crosshair';
        annotationCanvas.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

        ctx = annotationCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width * scale, rect.height * scale);
        };
        img.src = imageUrl;

        // Drawing events
        let painting = false;

        function startPaint(e) {
            painting = true;
            draw(e);
        }

        function endPaint() {
            painting = false;
            ctx.beginPath(); // Reset path
        }

        function draw(e) {
            if (!painting) return;

            const x = (e.clientX - rect.left) * scale;
            const y = (e.clientY - rect.top) * scale;

            ctx.lineWidth = 3 * scale;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'red';

            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }

        annotationCanvas.addEventListener('mousedown', startPaint);
        annotationCanvas.addEventListener('mouseup', endPaint);
        annotationCanvas.addEventListener('mousemove', draw);
        // Also handle mouse leaving canvas
        annotationCanvas.addEventListener('mouseleave', endPaint);

        overlay.appendChild(annotationCanvas);

        // Update buttons to show we are in annotation mode (remove "Annotate" button)
        showActionButtons(rect, true);
    }

    async function finishCapture(rect, action) {
        let blob;

        if (annotationCanvas) {
            // If annotated, getting blob from canvas is easy
            blob = await new Promise(resolve => annotationCanvas.toBlob(resolve, 'image/png'));
        } else {
            // If not annotated, we need to capture and crop now
            overlay.style.display = 'none';
            await new Promise(r => setTimeout(r, 100)); // Wait for UI hide

            const response = await new Promise(resolve => chrome.runtime.sendMessage({ action: "captureVisibleTab" }, resolve));
            overlay.style.display = 'block';

            if (response && response.dataUrl) {
                const cropArea = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, deviceScaleFactor: window.devicePixelRatio || 1 };
                blob = await cropImage(response.dataUrl, cropArea);
            }
        }

        if (blob) {
            if (action === 'copy') {
                await copyToClipboard(blob);
                showNotification("Screenshot copied!");
            } else {
                downloadImage(blob);
            }
        }

        removeOverlay();
    }

    function cropImage(dataUrl, area) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scale = area.deviceScaleFactor;
                canvas.width = area.width * scale;
                canvas.height = area.height * scale;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, area.x * scale, area.y * scale, area.width * scale, area.height * scale, 0, 0, area.width * scale, area.height * scale);

                // Add timestamp if enabled
                const addTimestamp = window.screenshotAddTimestamp !== false;
                if (addTimestamp) {
                    const now = new Date();
                    const timestamp = now.toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });

                    ctx.font = `${14 * scale}px monospace`;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(10 * scale, 10 * scale, 180 * scale, 25 * scale);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(timestamp, 15 * scale, 28 * scale);
                }

                canvas.toBlob(resolve, 'image/png');
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    async function copyToClipboard(blob) {
        try {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        } catch (err) {
            console.error(err);
            alert("Clipboard permission needed or failed.");
        }
    }

    function downloadImage(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screenshot-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showNotification(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = "position:fixed;bottom:20px;right:20px;padding:10px 20px;background:#333;color:white;border-radius:4px;z-index:9999999;";
        document.body.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 500);
        }, 2000);
    }

    createOverlay();
})();
