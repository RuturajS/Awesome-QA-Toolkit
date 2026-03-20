const fs = require('fs');
let code = fs.readFileSync('popup/popup.js', 'utf8');

// replace document.getElementById().innerHTML = ...
code = code.replace(/document\.getElementById\('([^']+)'\)\.innerHTML\s*=\s*([^;\n]+);/g, "setSafeHTML(document.getElementById('$1'), $2);");

// replace element.innerHTML = '';
code = code.replace(/([a-zA-Z0-9_\.]+)\.innerHTML\s*=\s*'';/g, '$1.replaceChildren();');

// replace single line string
code = code.replace(/([a-zA-Z0-9_\.]+)\.innerHTML\s*=\s*('[^\n]*?');/g, 'setSafeHTML($1, $2);');

// replace map join
code = code.replace(/([a-zA-Z0-9_\.]+)\.innerHTML\s*=\s*([a-zA-Z0-9_]+\.map[\s\S]+?\.join\(''?\));/g, 'setSafeHTML($1, $2);');

// replace template literal multiline
code = code.replace(/([a-zA-Z0-9_\.]+)\.innerHTML\s*=\s*(`[\s\S]+?`);/g, 'setSafeHTML($1, $2);');

fs.writeFileSync('popup/popup.js', code);
