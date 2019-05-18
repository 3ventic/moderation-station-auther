import Discord, { GuildMember } from "discord.js";

const GUILD_ID: string = process.env.DISCORD_GUILD_ID || "352896412880470017";

export enum Roles {
	Base = "Verified",
	Partner = "Twitch Partner",
	Staff = "Twitch Staff"
}

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

export const giveRole: (userID: string, roles: Roles[]) => void = async (userID: string, roles: Roles[]) => {
	const guild: Discord.Guild = client.guilds.get(GUILD_ID)!;
	const member: Discord.GuildMember = await guild.fetchMember(userID);
	const rolesToAdd: Discord.Role[] = roles
		.map(r => guild.roles.filter(r2 => r2.name === r).first())
		.filter(r => !member.roles.get(r.id));
	console.log("giveRole", userID, rolesToAdd.map(r => r.name));
	if (rolesToAdd.length === 0) {
		return;
	}
	await member.addRoles(rolesToAdd);
	return;
};
