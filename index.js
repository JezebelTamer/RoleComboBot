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

client.once('clientReady', () => {
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

        // Check for duplicate combo
        const existingCombos = getRoleCombos(message.guild.id);
        const sortedRequiredRoles = [...requiredRoles].sort();
        
        const duplicate = existingCombos.find(combo => {
            const sortedExistingRoles = [...combo.requiredRoles].sort();
            return combo.resultRole === resultRoleId &&
                   sortedExistingRoles.length === sortedRequiredRoles.length &&
                   sortedExistingRoles.every((role, index) => role === sortedRequiredRoles[index]);
        });

        if (duplicate) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Duplicate Combo')
                .setDescription(`This role combination already exists as combo #${duplicate.id}.`)
                .setTimestamp();
            return message.reply({ embeds: [embed] });
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

        const requiredRoleNames = requiredRoles.map(id => {
            const role = message.guild.roles.cache.get(id);
            return role ? role.name : id;
        }).join(', ');
        const resultRoleName = resultRole.name;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Role Combo Created!')
            .addFields(
                { name: 'Required Roles', value: requiredRoleNames, inline: false },
                { name: 'Result Role', value: resultRoleName, inline: false },
                { name: 'Combo ID', value: combo.id.toString(), inline: false }
            )
            .setTimestamp();

        if (hierarchyWarning) {
            embed.addFields({ name: '⚠️ Warning', value: `The bot's role is not high enough to manage: ${problematicRoles.join(', ')}\nMove the bot's role higher in Server Settings → Roles to fix this.`, inline: false });
        }

        await message.reply({ embeds: [embed] });

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
            const embed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('Role Combinations')
                .setDescription('No role combinations configured for this server.')
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Role Combinations')
            .setTimestamp();

        for (const combo of combos) {
            const requiredRoles = combo.requiredRoles.map(id => {
                const role = message.guild.roles.cache.get(id);
                return role ? role.name : id;
            }).join(', ');
            const resultRole = message.guild.roles.cache.get(combo.resultRole);
            const resultRoleName = resultRole ? resultRole.name : combo.resultRole;
            
            embed.addFields({
                name: `ID ${combo.id}`,
                value: `**Required:** ${requiredRoles}\n**Result:** ${resultRoleName}`,
                inline: false
            });
        }

        await message.reply({ embeds: [embed] });

    } else if (subcommand === 'remove') {
        const id = parseInt(args[1]);
        if (!id) {
            return message.reply('Usage: `!rolecombo remove <id>`');
        }

        const success = deleteRoleCombo(message.guild.id, id);

        const embed = new EmbedBuilder()
            .setTimestamp();

        if (success) {
            embed
                .setColor(0x00FF00)
                .setTitle('✅ Role Combo Removed')
                .setDescription(`Role combo #${id} has been removed.`);
        } else {
            embed
                .setColor(0xFF0000)
                .setTitle('❌ Not Found')
                .setDescription(`Role combo #${id} not found.`);
        }

        await message.reply({ embeds: [embed] });

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
