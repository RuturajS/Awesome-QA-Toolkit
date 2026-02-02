const Exporter = {
    downloadJson: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        Exporter._triggerDownload(blob, 'scan_results.json');
    },

    downloadCsv: (data) => {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj =>
            Object.values(obj).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const csvContent = headers + '\n' + rows;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        Exporter._triggerDownload(blob, 'scan_results.csv');
    },

    downloadTxt: (data) => {
        let content = "QA SCAN RESULTS\n================\n\n";
        data.forEach((item, index) => {
            content += `Issue #${index + 1}\n`;
            content += `Type: ${item.type}\n`;
            content += `Severity: ${item.severity}\n`;
            content += `Details: ${item.details}\n`;
            content += `Recommendation: ${item.recommendation}\n`;
            content += `----------------------------------------\n`;
        });
        const blob = new Blob([content], { type: 'text/plain' });
        Exporter._triggerDownload(blob, 'scan_results.txt');
    },

    downloadXlsx: (data) => {
        // Minimal HTML-based Excel export (works in Excel as "Web Page" or .xls)
        // This avoids heavy libraries like SheetJS while satisfying "offline" and "no external services".
        let table = '<table><thead><tr>';
        if (data.length > 0) {
            Object.keys(data[0]).forEach(key => {
                table += `<th>${key}</th>`;
            });
            table += '</tr></thead><tbody>';

            data.forEach(row => {
                table += '<tr>';
                Object.values(row).forEach(val => {
                    table += `<td>${val}</td>`;
                });
                table += '</tr>';
            });
            table += '</tbody></table>';
        }

        const template = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Scan Results</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
            <body>${table}</body></html>`;

        const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
        Exporter._triggerDownload(blob, 'scan_results.xls');
    },

    _triggerDownload: (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
