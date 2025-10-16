const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
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

client.once('ready', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Bot is active in ${client.guilds.cache.size} server(s)`);
});

// Text command handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Check roles for any member who sends a message
    if (message.member) {
        await checkMemberRoles(message.member);
    }

    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    if (commandName !== 'rolecombo') return;

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ You need Administrator permissions to use this command.');
    }

    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'add') {
        // !rolecombo add roleID1,roleID2,roleID3 resultRoleID
        if (args.length < 2) {
            return message.reply('Usage: `!rolecombo add roleID1,roleID2 resultRoleID`');
        }

        const requiredRolesPart = args[1];
        const resultRolePart = args[2];

        if (!requiredRolesPart || !resultRolePart) {
            return message.reply('Usage: `!rolecombo add roleID1,roleID2 resultRoleID`');
        }

        // Parse required roles from mentions
        const requiredRoleMentions = requiredRolesPart.split(',');
        const requiredRoles = [];

        for (const mention of requiredRoleMentions) {
            const roleId = mention.trim().replace(/[<@&>]/g, '');
            if (roleId && message.guild.roles.cache.has(roleId)) {
                requiredRoles.push(roleId);
            }
        }

        // Parse result role
        const resultRoleId = resultRolePart.replace(/[<@&>]/g, '');
        if (!message.guild.roles.cache.has(resultRoleId)) {
            return message.reply('❌ Invalid result role.');
        }

        if (requiredRoles.length < 2) {
            return message.reply('❌ You need at least 2 required roles.');
        }

        // Check bot's role hierarchy
        const botMember = await message.guild.members.fetchMe();
        const botHighestRole = botMember.roles.highest;
        const resultRole = message.guild.roles.cache.get(resultRoleId);
        
        let hierarchyWarning = '';
        const problematicRoles = [];

        // Check if bot can manage the result role
        if (resultRole.position >= botHighestRole.position) {
            problematicRoles.push(resultRole.name);
        }

        // Check if bot can check the required roles (less critical but still useful to know)
        for (const roleId of requiredRoles) {
            const role = message.guild.roles.cache.get(roleId);
            if (role.position >= botHighestRole.position) {
                problematicRoles.push(role.name);
            }
        }

        if (problematicRoles.length > 0) {
            hierarchyWarning = `\n\n⚠️ **Warning:** The bot's role is not high enough to manage: ${problematicRoles.join(', ')}\nMove the bot's role higher in Server Settings → Roles to fix this.`;
        }

        const combo = saveRoleCombo(message.guild.id, requiredRoles, resultRoleId);

        const requiredRoleNames = requiredRoles.map(id => `<@&${id}>`).join(', ');
        const resultRoleName = `<@&${resultRoleId}>`;

        await message.reply(`✅ Role combo created!\n\n**Required Roles:** ${requiredRoleNames}\n**Result Role:** ${resultRoleName}\n**Combo ID:** ${combo.id}${hierarchyWarning}`);

        // Check all members
        const members = await message.guild.members.fetch();
        let updatedCount = 0;
        for (const [, member] of members) {
            const updated = await checkMemberRoles(member);
            if (updated) updatedCount++;
        }

        if (updatedCount > 0) {
            await message.reply(`Checked all members and updated ${updatedCount} member(s).`);
        }

    } else if (subcommand === 'list') {
        const combos = getRoleCombos(message.guild.id);

        if (combos.length === 0) {
            return message.reply('No role combinations configured for this server.');
        }

        let response = '**Role Combinations:**\n\n';
        for (const combo of combos) {
            const requiredRoles = combo.requiredRoles.map(id => `<@&${id}>`).join(', ');
            const resultRole = `<@&${combo.resultRole}>`;
            response += `**ID ${combo.id}:**\nRequired: ${requiredRoles}\nResult: ${resultRole}\n\n`;
        }

        await message.reply(response);

    } else if (subcommand === 'remove') {
        const id = parseInt(args[1]);
        if (!id) {
            return message.reply('Usage: `!rolecombo remove <id>`');
        }

        const success = deleteRoleCombo(message.guild.id, id);

        if (success) {
            await message.reply(`✅ Role combo #${id} has been removed.`);
        } else {
            await message.reply(`❌ Role combo #${id} not found.`);
        }

    } else {
        message.reply('Usage: `!rolecombo <add|list|remove>`\n\nExamples:\n`!rolecombo add 123456789,987654321 111222333`\n`!rolecombo list`\n`!rolecombo remove 1`');
    }
});

// Member join - check roles
client.on('guildMemberAdd', async (member) => {
    setTimeout(async () => {
        await checkMemberRoles(member);
    }, 1000);
});

// Member role update - check roles
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.roles.cache.size !== newMember.roles.cache.size ||
        !oldMember.roles.cache.equals(newMember.roles.cache)) {
        await checkMemberRoles(newMember);
    }
});

client.login(config.token);
