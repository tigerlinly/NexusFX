const fs = require('fs');
let c = fs.readFileSync('index.css', 'utf16le');
if (!c.includes('/ *')) {
  c = fs.readFileSync('index.css', 'utf8');
}
// Strip the broken comment
c = c.replace(/\/ \*   R E S P O N S I V E.*\r?\n? */g, '');
// Let's also enforce valid ascii
c = c.replace(/\0/g, ''); 
fs.writeFileSync('index.css', c, 'utf8');
