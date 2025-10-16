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

// Helper to extract level from role name (e.g., "Level 10" -> 10)
function getLevelFromRoleName(roleName) {
    const match = roleName?.match(/^Level (\d+)$/i);
    return match ? parseInt(match[1]) : null;
}

// Check if member satisfies a level requirement (has that level or higher)
function memberHasLevelRole(member, requiredRoleId) {
    const requiredRole = member.guild.roles.cache.get(requiredRoleId);
    if (!requiredRole) return false;

    const requiredLevel = getLevelFromRoleName(requiredRole.name);
    
    // If not a level role, check exact match
    if (requiredLevel === null) {
        return member.roles.cache.has(requiredRoleId);
    }

    // For level roles, check if member has this level or higher
    for (const [roleId, role] of member.roles.cache) {
        const memberLevel = getLevelFromRoleName(role.name);
        if (memberLevel !== null && memberLevel >= requiredLevel) {
            return true;
        }
    }

    return false;
}

async function checkMemberRoles(member) {
    if (member.user.bot) return false;

    const combos = getRoleCombos(member.guild.id);
    if (combos.length === 0) return false;

    let updated = false;

    // Separate single-level-role combos from regular combos
    const levelOnlyCombos = [];
    const regularCombos = [];

    for (const combo of combos) {
        if (combo.requiredRoles.length === 1) {
            const role = member.guild.roles.cache.get(combo.requiredRoles[0]);
            if (role && getLevelFromRoleName(role.name) !== null) {
                levelOnlyCombos.push(combo);
                continue;
            }
        }
        regularCombos.push(combo);
    }

    // Handle level-only combos (tiered system)
    if (levelOnlyCombos.length > 0) {
        const qualifyingLevelCombos = levelOnlyCombos.filter(combo => 
            memberHasLevelRole(member, combo.requiredRoles[0])
        );

        // Find the highest level combo they qualify for
        let highestCombo = null;
        let highestLevel = -1;

        for (const combo of qualifyingLevelCombos) {
            const role = member.guild.roles.cache.get(combo.requiredRoles[0]);
            const level = getLevelFromRoleName(role.name);
            if (level > highestLevel) {
                highestLevel = level;
                highestCombo = combo;
            }
        }

        // Grant the highest level role, remove all others
        const allLevelResultRoles = levelOnlyCombos.map(c => c.resultRole);
        
        for (const resultRoleId of allLevelResultRoles) {
            const hasRole = member.roles.cache.has(resultRoleId);
            const shouldHave = highestCombo && resultRoleId === highestCombo.resultRole;

            try {
                if (shouldHave && !hasRole) {
                    await member.roles.add(resultRoleId);
                    console.log(`Granted level role ${resultRoleId} to ${member.user.tag}`);
                    updated = true;
                } else if (!shouldHave && hasRole) {
                    await member.roles.remove(resultRoleId);
                    console.log(`Removed level role ${resultRoleId} from ${member.user.tag}`);
                    updated = true;
                }
            } catch (error) {
                console.error(`Error updating level roles for ${member.user.tag}:`, error);
            }
        }
    }

    // Handle regular combos normally
    for (const combo of regularCombos) {
        const hasAllRequiredRoles = combo.requiredRoles.every(roleId => 
            memberHasLevelRole(member, roleId)
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
