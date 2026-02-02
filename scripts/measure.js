(function () {
    if (window.hasMeasureRun) return;
    window.hasMeasureRun = true;

    let overlay, infoPanel, measureLine, startPoint, endPoint;
    let isDrawing = false;
    let startX, startY;
    let hoveredElement = null;
    let mode = 'hover'; // 'hover' or 'measure'

    function createOverlay() {
        // Main overlay
        overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483646;
            pointer-events: none;
        `;

        // Info panel (draggable)
        infoPanel = document.createElement('div');
        infoPanel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.6;
            z-index: 2147483647;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 280px;
            cursor: move;
            user-select: none;
        `;
        infoPanel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50; border-bottom: 1px solid #444; padding-bottom: 4px;">
                📏 Measurement Tool <span style="font-size: 10px; color: #888; float: right;">Drag to move</span>
            </div>
            <div style="color: #aaa; font-size: 11px;">
                <div><strong>Hover Mode:</strong> Inspect element dimensions</div>
                <div><strong>M Key:</strong> Toggle to Measure mode</div>
                <div><strong>Measure Mode:</strong> Click & drag to measure distance</div>
                <div><strong>ESC:</strong> Exit tool</div>
            </div>
        `;

        // Make info panel draggable
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        infoPanel.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragOffsetX = e.clientX - infoPanel.offsetLeft;
            dragOffsetY = e.clientY - infoPanel.offsetTop;
            infoPanel.style.cursor = 'grabbing';
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const newLeft = e.clientX - dragOffsetX;
                const newTop = e.clientY - dragOffsetY;

                // Keep panel within viewport
                const maxLeft = window.innerWidth - infoPanel.offsetWidth;
                const maxTop = window.innerHeight - infoPanel.offsetHeight;

                infoPanel.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                infoPanel.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                infoPanel.style.cursor = 'move';
            }
        });

        // Measure line (for distance measurement)
        measureLine = document.createElement('div');
        measureLine.style.cssText = `
            position: fixed;
            background: #FF5722;
            height: 2px;
            transform-origin: 0 0;
            display: none;
            z-index: 2147483645;
            pointer-events: none;
        `;

        // Start point marker
        startPoint = document.createElement('div');
        startPoint.style.cssText = `
            position: fixed;
            width: 8px;
            height: 8px;
            background: #FF5722;
            border: 2px solid white;
            border-radius: 50%;
            display: none;
            z-index: 2147483645;
            pointer-events: none;
            transform: translate(-50%, -50%);
        `;

        // End point marker
        endPoint = document.createElement('div');
        endPoint.style.cssText = `
            position: fixed;
            width: 8px;
            height: 8px;
            background: #FF5722;
            border: 2px solid white;
            border-radius: 50%;
            display: none;
            z-index: 2147483645;
            pointer-events: none;
            transform: translate(-50%, -50%);
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(infoPanel);
        document.body.appendChild(measureLine);
        document.body.appendChild(startPoint);
        document.body.appendChild(endPoint);

        // Event listeners
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
    }

    function removeOverlay() {
        if (overlay) document.body.removeChild(overlay);
        if (infoPanel) document.body.removeChild(infoPanel);
        if (measureLine) document.body.removeChild(measureLine);
        if (startPoint) document.body.removeChild(startPoint);
        if (endPoint) document.body.removeChild(endPoint);

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKeyDown);

        if (hoveredElement) {
            hoveredElement.style.outline = '';
        }

        window.hasMeasureRun = false;
    }

    function onMouseMove(e) {
        if (mode === 'hover' && !isDrawing) {
            // Hover mode - highlight and show element info
            const target = document.elementFromPoint(e.clientX, e.clientY);

            if (target && target !== overlay && target !== infoPanel && target !== hoveredElement) {
                if (hoveredElement) {
                    hoveredElement.style.outline = '';
                }

                hoveredElement = target;
                hoveredElement.style.outline = '2px solid #4CAF50';

                const rect = target.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(target);

                // Convert pixels to centimeters (assuming 96 DPI)
                const pxToCm = (px) => (px / 96 * 2.54).toFixed(2);

                infoPanel.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50; border-bottom: 1px solid #444; padding-bottom: 4px;">
                        📏 Element Dimensions <span style="font-size: 10px; color: #888; float: right;">Drag to move</span>
                    </div>
                    <div style="color: #fff;">
                        <div><strong>Width:</strong> ${Math.round(rect.width)}px <span style="color: #888;">(${pxToCm(rect.width)}cm)</span></div>
                        <div><strong>Height:</strong> ${Math.round(rect.height)}px <span style="color: #888;">(${pxToCm(rect.height)}cm)</span></div>
                        <div><strong>Position:</strong> (${Math.round(rect.left)}, ${Math.round(rect.top)})</div>
                    </div>
                    <div style="margin-top: 8px; color: #aaa; font-size: 11px;">
                        <div><strong>Padding:</strong> ${computedStyle.padding}</div>
                        <div><strong>Margin:</strong> ${computedStyle.margin}</div>
                        <div><strong>Tag:</strong> ${target.tagName.toLowerCase()}</div>
                        ${target.className ? `<div><strong>Class:</strong> ${target.className}</div>` : ''}
                    </div>
                    <div style="margin-top: 8px; color: #888; font-size: 10px;">
                        Press <strong>M</strong> to switch to Measure mode
                    </div>
                `;
            }
        } else if (mode === 'measure' && isDrawing) {
            // Measure mode - draw line
            const currentX = e.clientX;
            const currentY = e.clientY;

            const dx = currentX - startX;
            const dy = currentY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            // Convert pixels to centimeters
            const pxToCm = (px) => (px / 96 * 2.54).toFixed(2);

            measureLine.style.width = distance + 'px';
            measureLine.style.left = startX + 'px';
            measureLine.style.top = startY + 'px';
            measureLine.style.transform = `rotate(${angle}deg)`;

            endPoint.style.left = currentX + 'px';
            endPoint.style.top = currentY + 'px';

            infoPanel.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: #FF5722; border-bottom: 1px solid #444; padding-bottom: 4px;">
                    📐 Distance Measurement <span style="font-size: 10px; color: #888; float: right;">Drag to move</span>
                </div>
                <div style="color: #fff; font-size: 14px;">
                    <div><strong>Distance:</strong> ${Math.round(distance)}px <span style="color: #888;">(${pxToCm(distance)}cm)</span></div>
                    <div><strong>Horizontal:</strong> ${Math.abs(Math.round(dx))}px <span style="color: #888;">(${pxToCm(Math.abs(dx))}cm)</span></div>
                    <div><strong>Vertical:</strong> ${Math.abs(Math.round(dy))}px <span style="color: #888;">(${pxToCm(Math.abs(dy))}cm)</span></div>
                    <div><strong>Angle:</strong> ${Math.round(angle)}°</div>
                </div>
                <div style="margin-top: 8px; color: #888; font-size: 10px;">
                    Release to finish measurement
                </div>
            `;
        }
    }

    function onMouseDown(e) {
        if (mode === 'measure') {
            isDrawing = true;
            startX = e.clientX;
            startY = e.clientY;

            measureLine.style.display = 'block';
            startPoint.style.display = 'block';
            endPoint.style.display = 'block';

            startPoint.style.left = startX + 'px';
            startPoint.style.top = startY + 'px';
            endPoint.style.left = startX + 'px';
            endPoint.style.top = startY + 'px';
        }
    }

    function onMouseUp(e) {
        if (mode === 'measure' && isDrawing) {
            isDrawing = false;
            // Keep the measurement visible for review
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            removeOverlay();
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            toggleMode();
        } else if (e.key === 'c' || e.key === 'C') {
            // Clear measurements
            if (mode === 'measure') {
                clearMeasurement();
            }
        }
    }

    function toggleMode() {
        if (mode === 'hover') {
            mode = 'measure';
            if (hoveredElement) {
                hoveredElement.style.outline = '';
                hoveredElement = null;
            }
            clearMeasurement();
            infoPanel.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: #FF5722; border-bottom: 1px solid #444; padding-bottom: 4px;">
                    📐 Measure Mode <span style="font-size: 10px; color: #888; float: right;">Drag to move</span>
                </div>
                <div style="color: #aaa; font-size: 11px;">
                    <div>Click and drag to measure distance</div>
                    <div><strong>M Key:</strong> Back to Hover mode</div>
                    <div><strong>C Key:</strong> Clear measurement</div>
                    <div><strong>ESC:</strong> Exit tool</div>
                </div>
            `;
        } else {
            mode = 'hover';
            clearMeasurement();
            infoPanel.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50; border-bottom: 1px solid #444; padding-bottom: 4px;">
                    📏 Hover Mode <span style="font-size: 10px; color: #888; float: right;">Drag to move</span>
                </div>
                <div style="color: #aaa; font-size: 11px;">
                    <div>Hover over elements to inspect</div>
                    <div><strong>M Key:</strong> Switch to Measure mode</div>
                    <div><strong>ESC:</strong> Exit tool</div>
                </div>
            `;
        }
    }

    function clearMeasurement() {
        measureLine.style.display = 'none';
        startPoint.style.display = 'none';
        endPoint.style.display = 'none';
        isDrawing = false;
    }

    createOverlay();
})();
