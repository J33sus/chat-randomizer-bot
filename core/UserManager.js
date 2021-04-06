const User = require('./User.js');
const UserStats = require('./UserStates.js');
const Database = require('./Database.js')();
const Language = require(`../languages/lang_${process.env.BOT_LANG}.js`);

class UserManager {
	constructor() {
		// List of users in runtime
		this.users = [];

		for (const userdb of Database.get('users').value()) {
			this.add(userdb.user_id, false);

			const user = this.get(userdb.user_id);
			user.setState(userdb.state, false);
			user.setPartner(userdb.partner, false);
		}
	}

	add(user_id, register = true) {
		// Add user into list
		this.users.push(new User(user_id, register));
	}

	get(user_id) {
		return this.users.find(user => user.getId() == user_id);
	}

	exists(user_id) {
		// Exists this user in db?
		return (typeof this.get(user_id) != 'undefined');
	}

	findPartner(except) {
		return this.users.find(user => user.getId() != except && user.getState() == UserStats.STATE_WAITING);
	}

	async start(bot, user_id) {
		const user = this.get(user_id);

		if(user.getState() == UserStats.STATE_PAUSED) {
			user.setState(UserStats.STATE_WAITING);

			// Find partner
			await bot.sendMessage(user_id, Language.SEARCHING_PARTNER_MSG);

			const partner = this.findPartner(user_id);
			if(partner == undefined) return;

			partner.setState(UserStats.STATE_CHATTING);
			user.setState(UserStats.STATE_CHATTING);

			partner.setPartner(user_id);
			user.setPartner(partner.getId());

			await bot.sendMessage(user_id, Language.PARTNER_FOUND_MSG, {parse_mode: 'Markdown'});
			await bot.sendMessage(partner.getId(), Language.PARTNER_FOUND_MSG, {parse_mode: 'Markdown'});
		}
		else if(user.getState() == UserStats.STATE_CHATTING) {
			bot.sendMessage(user_id, Language.ERROR_CHATTING, {parse_mode: 'Markdown'});
		}
	}
};
module.exports = UserManager;