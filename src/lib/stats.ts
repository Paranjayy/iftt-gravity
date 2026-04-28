
import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'house_log.md');

export async function getFrequentedStats() {
    if (!fs.existsSync(LOG_PATH)) return "No logs found.";
    
    const logs = (await fs.promises.readFile(LOG_PATH, 'utf8')).split('\n');
    const freq: Record<string, number> = {};
    
    logs.forEach(line => {
        if (!line.includes(']')) return;
        const action = line.split(']').slice(1).join(']').trim();
        if (!action) return;
        
        // Clean up actions for grouping
        let clean = action;
        if (action.startsWith('🌦 Weather Hub:')) clean = '🌦 Weather Updates';
        if (action.startsWith('🎵 Media Aura:')) clean = '🎵 Media Mood Sync';
        if (action.startsWith('🎵 Liquid Aura:')) clean = '🎵 Liquid Aura Sync';
        if (action.startsWith('📋 Memory Archive:')) clean = '📋 Memory Archiving';
        if (action.startsWith('🎬 Scene Trigger:')) clean = action; // Keep specific scenes
        
        freq[clean] = (freq[clean] || 0) + 1;
    });
    
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let output = "📊 *Most Frequent Signals*\n━━━━━━━━━━━━━━\n";
    sorted.forEach(([action, count], i) => {
        output += `${i + 1}. ${action} (*${count}*)\n`;
    });
    return output;
}
