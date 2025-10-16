const fs = require('fs');
const path = require('path');

const COMBOS_FILE = path.join(__dirname, '..', 'roleCombos.json');

function loadCombos() {
    if (!fs.existsSync(COMBOS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(COMBOS_FILE, 'utf8'));
    } catch (error) {
        console.error('Error loading role combos:', error);
        return {};
    }
}

function saveCombos(combos) {
    try {
        fs.writeFileSync(COMBOS_FILE, JSON.stringify(combos, null, 2));
    } catch (error) {
        console.error('Error saving role combos:', error);
    }
}

function saveRoleCombo(guildId, requiredRoles, resultRole) {
    const combos = loadCombos();
    if (!combos[guildId]) combos[guildId] = [];

    const nextId = combos[guildId].length > 0 
        ? Math.max(...combos[guildId].map(c => c.id)) + 1 
        : 1;

    const newCombo = { id: nextId, requiredRoles, resultRole };
    combos[guildId].push(newCombo);
    saveCombos(combos);
    return newCombo;
}

function getRoleCombos(guildId) {
    const combos = loadCombos();
    return combos[guildId] || [];
}

function deleteRoleCombo(guildId, comboId) {
    const combos = loadCombos();
    if (!combos[guildId]) return false;

    const index = combos[guildId].findIndex(c => c.id === comboId);
    if (index === -1) return false;

    combos[guildId].splice(index, 1);
    saveCombos(combos);
    return true;
}

async function checkMemberRoles(member) {
    if (member.user.bot) return false;

    const combos = getRoleCombos(member.guild.id);
    if (combos.length === 0) return false;

    let updated = false;

    for (const combo of combos) {
        const hasAllRequiredRoles = combo.requiredRoles.every(roleId => 
            member.roles.cache.has(roleId)
        );
        const hasResultRole = member.roles.cache.has(combo.resultRole);

        try {
            if (hasAllRequiredRoles && !hasResultRole) {
                await member.roles.add(combo.resultRole);
                console.log(`Granted role ${combo.resultRole} to ${member.user.tag}`);
                updated = true;
            } else if (!hasAllRequiredRoles && hasResultRole) {
                await member.roles.remove(combo.resultRole);
                console.log(`Removed role ${combo.resultRole} from ${member.user.tag}`);
                updated = true;
            }
        } catch (error) {
            console.error(`Error updating roles for ${member.user.tag}:`, error);
        }
    }

    return updated;
}

module.exports = {
    saveRoleCombo,
    getRoleCombos,
    deleteRoleCombo,
    checkMemberRoles,
};
