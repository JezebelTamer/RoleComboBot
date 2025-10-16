# RoleComboBot

A simple Discord bot that automatically grants roles based on role combinations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Edit `config.json` with your bot token

3. Start the bot:
```bash
npm start
```

## Commands

All commands require Administrator permissions.

### Add a role combo
```
!rolecombo add @role1,@role2 @resultRole
```
Example: `!rolecombo add @Supporter,@Active @VIP`

When users have ALL required roles, they get the result role.
When they lose ANY required role, the result role is removed.

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

1. Admin runs: `!rolecombo add @Supporter,@Active @VIP`
2. Bot automatically grants "VIP" to users with both "Supporter" AND "Active" roles
3. Bot removes "VIP" if they lose either role
4. Automatic checking on member join and role changes

## License

MIT
