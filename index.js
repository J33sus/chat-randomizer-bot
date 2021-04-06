//
const TelegramBot = require('node-telegram-bot-api');
const https = require('https')
const fs = require('fs');
const Config = {
	token: process.env.BOT_TOKEN,
	download_dir: './images',
};
const Language = require(`./languages/lang_${process.env.BOT_LANG}.js`);
const UserStats = require('./core/UserStates.js');

// Telegram bot
const bot = new TelegramBot(Config.token, {polling: true});

// Users
const userManager = new (require('./core/UserManager.js'));

bot.on('message', async (msg) => {
	const user_id = msg.chat.id;

	if(/^\/start|search/.test(msg.text)) {
		if(!userManager.exists(user_id)) {
			userManager.add(user_id);

			return bot.sendMessage(user_id, `${Language.BOT_NAME}\n${Language.START_MSG}\n\n${Language.FIND_PARTNER_MSG}`, {parse_mode : 'Markdown'});
		}
		else return userManager.start(bot, user_id);
	}
	else if(/\/stop/.test(msg.text) && userManager.exists(user_id)) {
		const user = userManager.get(user_id);
		switch(user.getState()) {
			case UserStats.STATE_PAUSED:
				bot.sendMessage(user_id, `${Language.ERRROR_WITHOUT_PARTNER}\n${Language.FIND_PARTNER_MSG}`, {parse_mode: 'Markdown'});
				break;
			case UserStats.STATE_WAITING:
				user.setState(UserStats.STATE_PAUSED);
				bot.sendMessage(user_id, `${Language.STOPPED_SEARCH_MSG}\n${Language.FIND_PARTNER_MSG}`, {parse_mode: 'Markdown'});
				break;
			case UserStats.STATE_CHATTING:
				const partner = userManager.get(user.getPartner());

				partner.setState(UserStats.STATE_PAUSED);
				await bot.sendMessage(partner.getId(), `${Language.STOPPED_CHAT_PARTNER_MSG}\n${Language.FIND_PARTNER_MSG}`, {parse_mode: 'Markdown'});

				user.setState(UserStats.STATE_PAUSED);
				await bot.sendMessage(user_id, `${Language.STOPPED_CHAT_MSG}\n${Language.FIND_PARTNER_MSG}`, {parse_mode: 'Markdown'});
				break;
			default: break;	
		}
		return;
	}
	else if(/\/next/.test(msg.text) && userManager.exists(user_id)) {
		const user = userManager.get(user_id);
		if(user.getState() == UserStats.STATE_WAITING) {
			return bot.sendMessage(user_id, `${Language.ERROR_WAITING_PARTNER}\n${Language.STOP_PARTNET_SEARCH_MSG}`, {parse_mode: 'Markdown'});
		}
		else if(user.getState() == UserStats.STATE_PAUSED || user.getState() == UserStats.STATE_CHATTING) {
			if(user.getState() == UserStats.STATE_CHATTING) {
				const partner = userManager.get(user.getPartner());

				partner.setState(UserStats.STATE_PAUSED);
				await bot.sendMessage(partner.getId(), `${Language.STOPPED_CHAT_PARTNER_MSG}\n${Language.FIND_PARTNER_MSG}`, {parse_mode: 'Markdown'});
			}
			user.setState(UserStats.STATE_PAUSED);
			await bot.sendMessage(user_id, `${Language.FIND_NEW_PARTNER_MSG}\n${Language.STOP_PARTNET_SEARCH_MSG}`, {parse_mode: 'Markdown'});
			await userManager.start(bot, user_id);
			return;
		}
		else return bot.sendMessage(user_id, `${Language.ERRROR_WITHOUT_PARTNER}\n${Language.FIND_PARTNER_MSG}`, {parse_mode: 'Markdown'});
	}
	else if(/^\/help/.test(msg.text)) {
		await bot.sendMessage(user_id, `${Language.BOT_NAME}\n${Language.HELP_MSG}`, {parse_mode: 'Markdown'});
		await bot.sendMessage(user_id, Language.COMMANDS_INFO_MSG, {parse_mode: 'Markdown'});
		return;
	}
	else if(/^\/share/.test(msg.text)) {
		const user = userManager.get(user_id);
		if(user.getState() == UserStats.STATE_CHATTING) {
			await bot.sendMessage(user.getPartner(), Language.SHARE_CONTACT_MSG.replace('{0}', `@${msg.from.username}`), {parse_mode: 'Markdown'});
			return bot.sendMessage(user_id, Language.SHARED_CONTACT_MSG, {parse_mode: 'Markdown'});
		}
		else return bot.sendMessage(user_id, `${Language.ERRROR_WITHOUT_PARTNER}\n${Language.FIND_PARTNER_MSG}`, {parse_mode : 'Markdown'});
	}

	if(userManager.exists(user_id)) {
		const user = userManager.get(user_id);

		if(user.getState() == UserStats.STATE_CHATTING) {
			if(msg.document) {
				bot.sendMessage(user_id, Language.ERROR_SEND_FILE, {parse_mode : 'Markdown'});
			}
			else if (msg.sticker) { // Sticker
				bot.sendSticker(user.getPartner(), msg.sticker.file_id);
			}
			else if (msg.voice) { // Voice				
				bot.getFileLink(msg.voice.file_id).then(async(fileUri) => {
					let time = process.hrtime();
					let newName = `${time[0]}${time[1]}.${fileUri.split('.').pop()}`;

					let file_path = `${Config.download_dir}/${newName}`;
					let file = fs.createWriteStream(file_path);
					await https.get(fileUri, (response) => {
						response.pipe(file);
					});
					file.on('finish', async () => {
						await bot.sendAudio(user.getPartner(), file_path);
						fs.unlinkSync(file_path);
					});
 				});
			}
			else if (msg.photo) { // Photos
				bot.getFileLink(msg.photo[msg.photo.length - 1].file_id).then(async(fileUri) => {
					let time = process.hrtime();
					let newName = `${time[0]}${time[1]}.${fileUri.split('.').pop()}`;

					let file_path = `${Config.download_dir}/${newName}`;
					let file = fs.createWriteStream(file_path);
					await https.get(fileUri, (response) => {
						response.pipe(file);
					});
					file.on('finish', async () => {
						await bot.sendPhoto(user.getPartner(), file_path);
						fs.unlinkSync(file_path);
					});
 				});
			}
			else if(msg.text) bot.sendMessage(user.getPartner(), msg.text);
		}
	}
});

// DEBUG
bot.on('polling_error', (error) => {
  console.log(error);  // => 'EFATAL'
});

// START
if (!fs.existsSync(Config.download_dir)){
    fs.mkdirSync(Config.download_dir);
}
console.log(`[BOT_CHAT] ${Language.BOT_INITIALIZE}`);