# RoleComboBot

A simple Discord bot that automatically grants roles based on role combinations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `config.json` from the example:
```bash
cp config.json.example config.json
```

3. Edit `config.json` with your bot token

4. Start the bot:
```bash
npm start
```

## Commands

All commands require Administrator permissions.

### Add a role combo
```
!rolecombo add roleID1,roleID2 resultRoleID
```
Example: `!rolecombo add 123456789,987654321 111222333`

When users have ALL required roles, they get the result role.
When they lose ANY required role, the result role is removed.

**Level Roles:** Roles named "Level X" (e.g., "Level 5", "Level 10") are special. If a combo requires "Level 5", members with "Level 10" or higher will also qualify. Level roles can be used as a single requirement (e.g., `!rolecombo add levelID5 resultRoleID`).

**How to get role IDs:** Enable Developer Mode in Discord (Settings → Advanced), then right-click a role and select "Copy ID"

### List all combos
```
!rolecombo list
```

### Remove a combo
```
!rolecombo remove <id>
```
Example: `!rolecombo remove 1`

## Bot Permissions

- Manage Roles
- View Channels
- Read Messages
- Send Messages

**Note:** Bot can only manage roles below its highest role.

## How It Works

1. Admin runs: `!rolecombo add 123456789,987654321 111222333`
2. Bot automatically grants the result role to users with both required roles
3. Bot removes the result role if they lose any required role
4. Automatic checking on member join and role changes

## License

MIT
