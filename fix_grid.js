const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    let changed = false;
    content = content.replace(/<Grid\s+([^>]+)>/g, (match, props) => {
        if (!/\bitem\b/.test(props)) return match; // Only target Grid items
        
        let newProps = props.replace(/\bitem\b/g, ' ').trim();
        let sizes = [];
        
        const extract = (bp) => {
            const regex = new RegExp(`\\b${bp}=\\{(\\d+)\\}`, 'g');
            newProps = newProps.replace(regex, (m, val) => {
                sizes.push(`${bp}: ${val}`);
                return ' ';
            });
        };
        extract('xs');
        extract('sm');
        extract('md');
        extract('lg');
        extract('xl');
        
        newProps = newProps.replace(/\s+/g, ' ').trim();
        
        if (sizes.length > 0) {
            newProps += ` size={{ ${sizes.join(', ')} }}`;
        }
        changed = true;
        
        if (newProps.length > 0) return `<Grid ${newProps}>`;
        return `<Grid>`;
    });
    
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

const dir = 'apps/web/src/pages/admin';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
files.forEach(f => processFile(path.join(dir, f)));

console.log("Done fixing Grid!");
