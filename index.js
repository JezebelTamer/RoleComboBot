const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const { saveRoleCombo, getRoleCombos, deleteRoleCombo, checkMemberRoles } = require('./utils/roleComboManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Helper to create embeds
const createEmbed = (color, title, description = null) => {
    const embed = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
};

// Helper to get role name or ID
const getRoleName = (guild, roleId) => guild.roles.cache.get(roleId)?.name || roleId;

// Helper to check if a role is a level role
const isLevelRole = (roleName) => /^Level \d+$/i.test(roleName);

// Helper to parse role IDs from string
const parseRoleIds = (str, guild) => str.split(',')
    .map(id => id.trim().replace(/[<@&>]/g, ''))
    .filter(id => id && guild.roles.cache.has(id));

client.once('clientReady', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Bot is active in ${client.guilds.cache.size} server(s)`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.member) await checkMemberRoles(message.member);
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    if (args.shift().toLowerCase() !== 'rolecombo') return;
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ You need Administrator permissions to use this command.');
    }

    const subcommand = args[0]?.toLowerCase();
    const handlers = { add: handleAdd, list: handleList, remove: handleRemove };
    const handler = handlers[subcommand];
    
    if (handler) {
        await handler(message, args);
    } else {
        message.reply('Usage: `!rolecombo <add|list|remove>`\n\nExamples:\n`!rolecombo add 123456789,987654321 111222333`\n`!rolecombo list`\n`!rolecombo remove 1`');
    }
});

async function handleAdd(message, args) {
    if (args.length < 3) return message.reply('Usage: `!rolecombo add roleID1,roleID2 resultRoleID`');

    const requiredRoles = parseRoleIds(args[1], message.guild);
    const resultRoleId = args[2].replace(/[<@&>]/g, '');

    if (!message.guild.roles.cache.has(resultRoleId)) {
        return message.reply('❌ Invalid result role.');
    }
    if (requiredRoles.length < 1) {
        return message.reply('❌ You need at least 1 required role.');
    }
    if (requiredRoles.includes(resultRoleId)) {
        return message.reply('❌ The result role cannot be one of the required roles.');
    }

    // Check for multiple level roles
    const levelRoles = requiredRoles.filter(id => {
        const role = message.guild.roles.cache.get(id);
        return role && isLevelRole(role.name);
    });
    if (levelRoles.length > 1) {
        return message.reply('❌ You can only have one level role requirement per combo.');
    }

    // If no level role, require at least 2 roles
    if (levelRoles.length === 0 && requiredRoles.length < 2) {
        return message.reply('❌ You need at least 2 required roles (or 1 level role).');
    }

    // Check for duplicates
    const existingCombos = getRoleCombos(message.guild.id);
    const sortedRequired = [...requiredRoles].sort();
    const duplicate = existingCombos.find(c => 
        c.resultRole === resultRoleId &&
        [...c.requiredRoles].sort().toString() === sortedRequired.toString()
    );

    if (duplicate) {
        return message.reply({ embeds: [createEmbed(0xFF0000, '❌ Duplicate Combo', `This combo already exists as #${duplicate.id}.`)] });
    }

    // Check hierarchy
    const botRole = (await message.guild.members.fetchMe()).roles.highest;
    const resultRole = message.guild.roles.cache.get(resultRoleId);
    const problematicRoles = [resultRole, ...requiredRoles.map(id => message.guild.roles.cache.get(id))]
        .filter(role => role.position >= botRole.position)
        .map(role => role.name);

    const combo = saveRoleCombo(message.guild.id, requiredRoles, resultRoleId);
    const embed = createEmbed(0x00FF00, '✅ Role Combo Created!')
        .addFields(
            { name: 'Required Roles', value: requiredRoles.map(id => getRoleName(message.guild, id)).join(', ') },
            { name: 'Result Role', value: resultRole.name },
            { name: 'Combo ID', value: combo.id.toString() }
        );

    if (problematicRoles.length > 0) {
        embed.addFields({ name: '⚠️ Warning', value: `Bot's role is not high enough to manage: ${problematicRoles.join(', ')}\nMove the bot's role higher in Server Settings → Roles.` });
    }

    await message.reply({ embeds: [embed] });
}

async function handleList(message) {
    const combos = getRoleCombos(message.guild.id);

    if (combos.length === 0) {
        return message.reply({ embeds: [createEmbed(0xFFAA00, 'Role Combinations', 'No role combinations configured for this server.')] });
    }

    const embed = createEmbed(0x0099FF, 'Role Combinations');
    combos.forEach(combo => {
        const required = combo.requiredRoles.map(id => getRoleName(message.guild, id)).join(', ');
        const result = getRoleName(message.guild, combo.resultRole);
        embed.addFields({ name: `ID ${combo.id}`, value: `**Required:** ${required}\n**Result:** ${result}` });
    });

    await message.reply({ embeds: [embed] });
}

async function handleRemove(message, args) {
    const id = parseInt(args[1]);
    if (!id) return message.reply('Usage: `!rolecombo remove <id>`');

    const success = deleteRoleCombo(message.guild.id, id);
    const embed = success 
        ? createEmbed(0x00FF00, '✅ Role Combo Removed', `Role combo #${id} has been removed.`)
        : createEmbed(0xFF0000, '❌ Not Found', `Role combo #${id} not found.`);

    await message.reply({ embeds: [embed] });
}

client.on('guildMemberAdd', async (member) => {
    setTimeout(() => checkMemberRoles(member), 1000);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.roles.cache.size !== newMember.roles.cache.size ||
        !oldMember.roles.cache.equals(newMember.roles.cache)) {
        await checkMemberRoles(newMember);
    }
});

client.login(config.token);
