const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

function createDb() {
	const adapter = new FileSync('./db.json');
	const db = low(adapter);

	db.defaults({ users: []}).write();
	return db;	
}
module.exports = createDb;