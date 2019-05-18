import Discord from "discord.js";
import fetch, { Response as FetchResponse } from "node-fetch";

export const GUILD_ID: string = process.env.DISCORD_GUILD_ID || "352896412880470017";
export const DISCORD_API_BASE: string = "https://discordapp.com/api/v6";

export enum Roles {
	Base = "Verified",
	Partner = "Twitch Partner",
	Staff = "Twitch Staff"
}

const joinGuild: (session: Express.Session, userID: string) => Promise<Discord.GuildMember | null> = async (
	session: Express.Session,
	userID: string
) => {
	try {
		const r: FetchResponse = await fetch(`${DISCORD_API_BASE}/guilds/${GUILD_ID}/members/${userID}`, {
			method: "PUT",
			headers: {
				Authorization: `${session.tokens.discord.token_type} ${session.tokens.discord.access_token}`
			}
		});

		const j: Discord.GuildMember = await r.json();
		console.log("discordJoin", r.status, j);
		return j;
	} catch (e) {
		console.error("discordJoin", e);
		return null;
	}
};

const client: Discord.Client = new Discord.Client({
	retryLimit: 5
});

client.on("error", e => {
	console.error("discord.js", e);
});

client.on("ready", () => {
	console.log(`bot connected ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

export const setRolesAndNick: (session: Express.Session, userID: string, roles: Roles[], nick: string) => void = async (
	session: Express.Session,
	userID: string,
	roles: Roles[],
	nick: string
) => {
	const guild: Discord.Guild = client.guilds.get(GUILD_ID)!;
	const member: Discord.GuildMember = await guild.addMember(userID, {
		accessToken: session.tokens.discord.access_token,
		nick: nick,
		deaf: false,
		mute: false
	});
	const rolesToAdd: Discord.Role[] = roles
		.map(r => guild.roles.filter(r2 => r2.name === r).first())
		.filter(r => !member.roles.get(r.id));
	console.log("setRolesAndNick", nick, userID, rolesToAdd.map(r => r.name));
	if (member.nickname !== nick) {
		await member.setNickname(nick, "Twitch display name");
	}
	if (rolesToAdd.length === 0) {
		return;
	}
	await member.addRoles(rolesToAdd);
	return;
};
