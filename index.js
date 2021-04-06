//
const TelegramBot = require('node-telegram-bot-api');
const https = require('https')
const fs = require('fs');
const Config = {
	token: process.env.BOT_TOKEN,
	download_dir: './images',
};
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

			return bot.sendMessage(user_id, '*|_CHAT RANDOMIZER BOT_|*\nEl chat donde podrás interactuar con extranjeros de todo el mundo de forma anonima.\n\nEscriba /search para encontrar un nuevo compañero.', {parse_mode : "Markdown"});
		}
		else return userManager.start(bot, user_id);
	}
	else if(/\/stop/.test(msg.text) && userManager.exists(user_id)) {
		const user = userManager.get(user_id);
		switch(user.getState()) {
			case UserStats.STATE_PAUSED:
				bot.sendMessage(user_id, 'No estás en ninguna charla.\nEscribe /search para encontrar un compañero.');
				break;
			case UserStats.STATE_WAITING:
				user.setState(UserStats.STATE_PAUSED);
				bot.sendMessage(user_id, 'Has detenido la busqueda de compañero.\nEscribe /search para encontrar un compañero.');
				break;
			case UserStats.STATE_CHATTING:
				const partner = userManager.get(user.getPartner());

				partner.setState(UserStats.STATE_PAUSED);
				await bot.sendMessage(partner.getId(), 'Tu compañero ha detenido la charla.\nEscribe /search para encontrar un nuevo compañero.');

				console.log(userManager.get(user_id))
				user.setState(UserStats.STATE_PAUSED);
				console.log(userManager.get(user_id))

				await bot.sendMessage(user_id, 'Has detenido la charla.\nEscribe /search para encontrar un nuevo compañero.');
				break;
			default: break;	
		}
		return;
	}
	else if(/\/next/.test(msg.text) && userManager.exists(user_id)) {
		const user = userManager.get(user_id);
		if(user.getState() == UserStats.STATE_WAITING) {
			return bot.sendMessage(user_id, 'Ya estás esperando por un compañero.\nEscribe /stop para cancelar la busqueda de tu compañero.');
		}
		else if(user.getState() == UserStats.STATE_PAUSED || user.getState() == UserStats.STATE_CHATTING) {
			if(user.getState() == UserStats.STATE_CHATTING) {
				const partner = userManager.get(user.getPartner());

				partner.setState(UserStats.STATE_PAUSED);
				await bot.sendMessage(partner.getId(), 'Tu compañero ha detenido la charla.\nEscribe /search para encontrar un nuevo compañero.');
			}
			user.setState(UserStats.STATE_PAUSED);
			await bot.sendMessage(user_id, 'Has detenido la charla para buscar un nuevo compañero.\nEscribe /stop para cancerlar la busqueda de un nuevo compañero.');
			await userManager.start(bot, user_id);
			return;
		}
		else return bot.sendMessage(user_id, 'No estás en ninguna charla.\nEscribe /search para encontrar un nuevo compañero.');
	}
	else if(/^\/help/.test(msg.text)) {
		await bot.sendMessage(user_id, '*|_CHAT RANDOMIZER BOT_|*\nEste bot es para chatear con desconocidos en Telegram.\n\nEl bot puede enviar mensajes, links, gifs, stickers, fotos y audio.', {parse_mode: 'Markdown'});
		await bot.sendMessage(user_id, '/search - encontrar un compañero.\n/next - terminar la charla y busca un nuevo compañero.\n/stop - detener la charla.\n/share - compartir tu enlace de perfil a tu compañero.\n\nSi tienes alguna duda, puedes contactar al soporte (@j33sus).')
		return;
	}
	else if(/^\/share/.test(msg.text)) {
		const user = userManager.get(user_id);
		if(user.getState() == UserStats.STATE_CHATTING) {
			await bot.sendMessage(user.getPartner(), `*CONTACTO COMPARTIDO:* @${msg.from.username}`, {parse_mode: 'Markdown'});
			return bot.sendMessage(user_id, '¡Perfil enviado!');
		}
		else return bot.sendMessage(user_id, 'No tienes un compañero.\nEscribe /search para encontrar un compañero.');
	}

	if(userManager.exists(user_id)) {
		const user = userManager.get(user_id);

		if(user.getState() == UserStats.STATE_CHATTING) {
			console.log(msg);
			
			if(msg.document) {
				bot.sendMessage(user_id, '¡No puede enviar archivos!');
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
console.log('[BOT_CHAT] Bot initialized successfully.');