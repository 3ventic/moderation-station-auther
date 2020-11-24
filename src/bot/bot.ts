import Discord from 'discord.js';
import fetch from 'node-fetch';

export const GUILD_ID: string = process.env.DISCORD_GUILD_ID || '352896412880470017';
export const DISCORD_API_BASE: string = 'https://discord.com/api/v6';

export enum Roles {
	Base = 'Verified',
	Partner = 'Twitch Partner',
	Staff = 'Twitch Staff',
}

const allRoles: Roles[] = [Roles.Base, Roles.Partner, Roles.Staff];

const notifyHook: (
	member: Discord.GuildMember,
	removedRoles: Roles[],
	addedRoles: Roles[],
	nick: string
) => void = async (member: Discord.GuildMember, removedRoles: Roles[], addedRoles: Roles[], nick: string) => {
	if (process.env.DISCORD_HOOK) {
		const payload: Discord.WebhookMessageOptions = {
			username: 'Gatekeeper',
			embeds: [
				{
					fields: [
						{
							inline: true,
							name: 'User',
							value: `<@${member.id}> (${member.user.tag})`,
						},
						{
							inline: true,
							name: 'Name',
							value: nick,
						},
						{
							inline: true,
							name: 'Joined',
							value: member.joinedAt?.toISOString().replace('T', ' ').replace(/\.\d+/, ''),
						},
						{
							inline: false,
							name: 'Removed Roles',
							value: '-' + removedRoles.join('\n-'),
						},
						{
							inline: false,
							name: 'Added Roles',
							value: '+' + addedRoles.join('\n+'),
						},
					],
				},
			],
		};
		await fetch(process.env.DISCORD_HOOK, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
	}
};

const client: Discord.Client = new Discord.Client({
	retryLimit: 5,
});

client.on('error', (e) => {
	console.error('discord.js', e);
});

client.on('ready', () => {
	console.log(`bot connected ${client.user!.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

export const setRolesAndNick: (
	session: Express.Session,
	user: Discord.User,
	roles: Roles[],
	nick: string
) => Promise<void> = async (session: Express.Session, user: Discord.User, roles: Roles[], nick: string) => {
	const guild: Discord.Guild = client.guilds.resolve(GUILD_ID)!;
	const member: Discord.GuildMember = await guild.addMember(user, {
		accessToken: session.tokens.discord.access_token,
		nick: nick,
		deaf: false,
		mute: false,
	});
	console.log('setRolesAndNick', member);
	const newRoles: Discord.Role[] = roles
		.map((r) => guild.roles.cache.filter((r2) => r2.name === r).first())
		.filter((r) => r) as Discord.Role[]; // safe cast due to filter
	const rolesToAdd: Discord.Role[] = newRoles.filter((r) => !member.roles.cache.has(r.id));
	const rolesToRemove: Discord.Role[] = allRoles
		.filter((r) => !newRoles.map((r) => r.name).includes(r))
		.map((r) => guild.roles.cache.filter((r2) => r2.name === r).first())
		.filter((r) => r && !!member.roles.cache.has(r.id)) as Discord.Role[]; // safe cast due to `r &&` in filter
	console.log(
		'setRolesAndNick',
		nick,
		user,
		'+',
		rolesToAdd.map((r) => r.name),
		'-',
		rolesToRemove.map((r) => r.name)
	);
	if (member.nickname !== nick) {
		await member.setNickname(nick, 'Twitch display name');
	}
	if (rolesToAdd.length > 0) {
		await member.roles.add(rolesToAdd);
	}
	if (rolesToRemove.length > 0) {
		await member.roles.remove(rolesToRemove);
	}
	notifyHook(
		member,
		rolesToRemove.map((r) => r.name as Roles),
		rolesToAdd.map((r) => r.name as Roles),
		nick
	);
	return;
};
