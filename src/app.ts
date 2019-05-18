import express from "express";
import {
	PugDefaults,
	OAuth2CallbackQuery,
	OAuth2CodeExchange,
	OAuth2CodeExchangeResult,
	ModLookupUserTotals,
	HelixGetUsersResult,
	HelixUser
} from "./models";
import fetch, { Response as FetchResponse } from "node-fetch";
import Session from "express-session";
import formurlencoded from "form-urlencoded";
import Discord from "discord.js";
import { Roles, giveRole } from "./bot/bot";

const app: express.Express = express();

const defaults: PugDefaults = {
	discord_callback: encodeURIComponent(process.env.DISCORD_CALLBACK!),
	discord_client_id: process.env.DISCORD_CLIENT_ID!,
	discord_scopes: "identify%20guilds%20guilds.join",
	twitch_callback: encodeURIComponent(process.env.TWITCH_CALLBACK!),
	twitch_client_id: process.env.TWITCH_CLIENT_ID!,
	twitch_scopes: ""
};

const FOLLOWS_REQUIRED: number = (process.env.FOLLOWS_LIMIT && parseInt(process.env.FOLLOWS_LIMIT, 10)) || 15000;
const PARTNERS_REQUIRED: number = (process.env.PARTNERS_LIMIT && parseInt(process.env.PARTNERS_LIMIT, 10)) || 1;

const BASE_PATH: string = process.env.BASE_PATH || "";
const DISCORD_API_BASE: string = "https://discordapp.com/api/v6";
const TWITCH_ID_BASE: string = "https://id.twitch.tv";

const CODE_EXCHANGE_BASE_MAP: { [key: string]: string } = {
	twitch: TWITCH_ID_BASE,
	discord: DISCORD_API_BASE
};

const exchangeCode: (
	req: express.Request,
	res: express.Response,
	exchange: OAuth2CodeExchange,
	service: string
) => Promise<boolean> = async (
	req: express.Request,
	res: express.Response,
	exchange: OAuth2CodeExchange,
	service: string
) => {
	try {
		const r: FetchResponse = await fetch(`${CODE_EXCHANGE_BASE_MAP[service]}/oauth2/token`, {
			method: "POST",
			body: formurlencoded(exchange, { ignorenull: false }),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			}
		});

		const j: OAuth2CodeExchangeResult = await r.json();
		if (!req.session!.tokens) {
			req.session!.tokens = {};
		}
		req.session!.tokens[service] = j;
		return true;
	} catch (e) {
		console.error("exchangeCode", service, e);
		res.render(`${service}_error`, {
			...defaults,
			title: `${service} Error`,
			session_id: encodeURIComponent(req.sessionID!)
		});
		return false;
	}
};

const twitchUser: (session: Express.Session) => Promise<HelixUser | null> = async (session: Express.Session) => {
	try {
		const r: FetchResponse = await fetch("https://api.twitch.tv/helix/users", {
			headers: {
				Authorization: `Bearer ${session.tokens.twitch.access_token}`
			}
		});

		const j: HelixGetUsersResult = await r.json();
		console.log("twitchUser", r.status, j);
		return j.data[0] || null;
	} catch (e) {
		console.error("twitchUser", e);
		return null;
	}
};

const modTotals: (login: string) => Promise<ModLookupUserTotals | null> = async (login: string) => {
	try {
		const r: FetchResponse = await fetch(`https://modlookup.3v.fi/api/user-totals/${encodeURIComponent(login)}`, {
			headers: {
				"User-Agent": "MSA/0.1.0 (Moderation Station Discord)"
			}
		});

		const j: ModLookupUserTotals = await r.json();
		return j;
	} catch (e) {
		console.error("twitchLogin", e);
		return null;
	}
};

const discordUser: (session: Express.Session) => Promise<Discord.User | null> = async (session: Express.Session) => {
	try {
		const r: FetchResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
			headers: {
				Authorization: `${session.tokens.discord.token_type} ${session.tokens.discord.access_token}`
			}
		});

		const j: Discord.User = await r.json();
		console.log("discordUser", r.status, j);
		return j;
	} catch (e) {
		console.error("discordUser", e);
		return null;
	}
};

const grantRoles: (session: Express.Session, isStaff: boolean, isPartner: boolean) => Promise<boolean> = async (
	session: Express.Session,
	isStaff: boolean,
	isPartner: boolean
) => {
	console.log("grantRoles", isStaff, isPartner);
	const dUser: Discord.User | null = await discordUser(session);
	console.log("grantRoles", dUser);
	if (dUser === null) {
		return false;
	}
	const roles: Roles[] = [Roles.Base];
	if (isStaff) {
		roles.push(Roles.Staff);
	}
	if (isPartner) {
		roles.push(Roles.Partner);
	}
	try {
		await giveRole(dUser.id, roles);
		return true;
	} catch (e) {
		console.error("grantRoles", e);
		return false;
	}
};

app.set("view engine", "pug");
app.set("views", __dirname + "/views");

app.use(
	Session({
		cookie: {
			secure: !!process.env.SECURE_COOKIE
		},
		secret: process.env.COOKIE_SECRET!,
		resave: false,
		saveUninitialized: true
	})
);
app.use(express.static("public"));

app.get("/", (_, res) => {
	res.redirect(302, BASE_PATH + "/discord");
});

app.get("/discord", (req, res) => {
	res.render("discord", { ...defaults, title: "Link Discord", session_id: encodeURIComponent(req.sessionID!) });
});

app.get("/oauth2/discord", async (req, res) => {
	const query: OAuth2CallbackQuery = req.query as OAuth2CallbackQuery;
	if (query.state !== req.sessionID) {
		res.render("state_error", {
			...defaults,
			title: "Cookie Error",
			session_id: encodeURIComponent(req.sessionID!)
		});
	} else {
		const exchange: OAuth2CodeExchange = {
			client_id: defaults.discord_client_id,
			client_secret: process.env.DISCORD_SECRET!,
			code: query.code,
			grant_type: "authorization_code",
			redirect_uri: decodeURIComponent(defaults.discord_callback),
			scope: decodeURIComponent(defaults.discord_scopes)
		};

		if (await exchangeCode(req, res, exchange, "discord")) {
			res.redirect(302, BASE_PATH + "/twitch");
		}
	}
});

app.get("/twitch", (req, res) => {
	res.render("twitch", { ...defaults, title: "Link Twitch", session_id: encodeURIComponent(req.sessionID!) });
});

app.get("/oauth2/twitch", async (req, res) => {
	const query: OAuth2CallbackQuery = req.query as OAuth2CallbackQuery;
	if (query.state !== req.sessionID) {
		res.render("state_error", {
			...defaults,
			title: "Cookie Error",
			session_id: encodeURIComponent(req.sessionID!)
		});
	} else {
		const exchange: OAuth2CodeExchange = {
			client_id: defaults.twitch_client_id,
			client_secret: process.env.TWITCH_SECRET!,
			code: query.code,
			grant_type: "authorization_code",
			redirect_uri: decodeURIComponent(defaults.twitch_callback),
			scope: decodeURIComponent(defaults.twitch_scopes)
		};

		if (await exchangeCode(req, res, exchange, "twitch")) {
			const tUser: HelixUser | null = await twitchUser(req.session!);
			if (tUser === null) {
				res.render("twitch_error", {
					...defaults,
					title: "Twitch Error",
					session_id: encodeURIComponent(req.sessionID!)
				});
			} else if (tUser.type === "staff" || tUser.broadcaster_type === "partner") {
				if (await grantRoles(req.session!, tUser.type === "staff", tUser.broadcaster_type === "partner")) {
					res.render("success", {
						...defaults,
						title: "Success",
						session_id: encodeURIComponent(req.sessionID!)
					});
				} else {
					res.render("discord_error", {
						...defaults,
						title: "Discord Error",
						session_id: encodeURIComponent(req.sessionID!)
					});
				}
			} else {
				const mt: ModLookupUserTotals | null = await modTotals(tUser.login);
				if (mt === null) {
					res.render("ml_error", {
						...defaults,
						title: "Modlookup Error",
						session_id: encodeURIComponent(req.sessionID!)
					});
				} else if (mt.follows >= FOLLOWS_REQUIRED && mt.partners >= PARTNERS_REQUIRED) {
					if (await grantRoles(req.session!, tUser.type === "staff", tUser.broadcaster_type === "partner")) {
						res.render("success", {
							...defaults,
							title: "Success",
							session_id: encodeURIComponent(req.sessionID!)
						});
					} else {
						res.render("discord_error", {
							...defaults,
							title: "Discord Error",
							session_id: encodeURIComponent(req.sessionID!)
						});
					}
				} else {
					res.render("unfortunate", {
						...defaults,
						title: "Too bad",
						session_id: encodeURIComponent(req.sessionID!),
						follows: mt.follows,
						partners: mt.partners,
						follows_required: FOLLOWS_REQUIRED,
						partners_required: PARTNERS_REQUIRED
					});
				}
			}
		}
	}
});

app.listen(process.env.PORT || 8080, () => console.log("listening"));
